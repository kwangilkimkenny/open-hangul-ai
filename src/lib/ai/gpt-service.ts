/**
 * GPT Service v3.0
 * OpenAI GPT API 통신 서비스 — 시맨틱 그리드 인코딩 + 멀티패스 지원
 *
 * @module lib/ai/gpt-service
 * @version 3.0.0
 * @description SpreadsheetLLM 영감의 그리드 인코딩으로 복잡한 표 구조를 효율적으로 LLM에 전달
 */

import { AIConfig } from './ai-config';
import { getLogger } from '../utils/logger';
import type { EnhancedDocumentStructure } from './structure-extractor';
import {
  getFullHeaderLabel,
  getCellAddress,
  type SemanticGrid,
  type SemanticCell,
} from './table-semantics';

const logger = getLogger();

// ── PII 자동 보호 파이프라인 ──

interface PiiProtectionResult {
  messages: Array<{ role: string; content: string }>;
  sessionId: string | null;
  piiDetected: boolean;
  piiCount: number;
}

let _piiModulesLoaded = false;
let _PiiScannerClass: any = null;
let _PiiProxyEngineClass: any = null;

async function loadPiiModules(): Promise<boolean> {
  if (_piiModulesLoaded) return !!_PiiScannerClass;
  try {
    const sdk = await import('@aegis-sdk');
    _PiiScannerClass = sdk.PiiScanner;
    _PiiProxyEngineClass = sdk.PiiProxyEngine;
    _piiModulesLoaded = true;
    logger.info('AEGIS PII 모듈 로드 완료');
    return true;
  } catch {
    _piiModulesLoaded = true;
    logger.warn('AEGIS PII 모듈을 로드할 수 없습니다 — PII 보호 비활성화');
    return false;
  }
}

let _scanner: any = null;
let _proxy: any = null;

function getPiiEngines() {
  if (!_PiiScannerClass) return null;
  if (!_scanner) _scanner = new _PiiScannerClass();
  if (!_proxy) _proxy = new _PiiProxyEngineClass();
  return { scanner: _scanner, proxy: _proxy };
}

// ── Types ──

interface GPTResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface GPTGenerationResult {
  content: Record<string, string>;
  metadata: {
    model: string;
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
  };
}

/** 멀티패스 생성 단위 */
export interface GenerationPass {
  passNumber: number;
  cells: SemanticCell[];
  grid: SemanticGrid;
  dependsOnPasses: number[];
  promptStrategy: 'column-grouped' | 'row-grouped' | 'single-batch';
  estimatedTokens: number;
  /** 병렬 실행 그룹 ID — 같은 groupId는 동시 실행 가능 */
  parallelGroupId?: number;
}

/** 진행률 콜백 */
export interface GenerationProgress {
  phase: 'planning' | 'generating' | 'merging' | 'complete';
  totalPasses: number;
  completedPasses: number;
  totalCells: number;
  completedCells: number;
  currentTable?: number;
  percent: number;
  message: string;
}

// ── GPTService ──

export class GPTService {
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokensUsed: 0,
    totalCost: 0,
    piiProtected: 0,
    piiSessionCount: 0,
  };

  private _piiReady = false;
  private _piiInitPromise: Promise<void> | null = null;

  constructor() {
    this._piiInitPromise = this._initPii();
  }

  private async _initPii() {
    this._piiReady = await loadPiiModules();
  }

  private async ensurePiiReady(): Promise<boolean> {
    if (this._piiInitPromise) await this._piiInitPromise;
    return this._piiReady;
  }

  // ─── PII ───────────────────────────────────────────────────────────

  private pseudonymizeMessages(
    messages: Array<{ role: string; content: string }>
  ): PiiProtectionResult {
    const engines = getPiiEngines();
    if (!engines) {
      return { messages, sessionId: null, piiDetected: false, piiCount: 0 };
    }

    const sessionId = `ts_session_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    let totalPiiCount = 0;
    const protectedMessages = messages.map((msg) => {
      const result = engines.proxy.pseudonymize(
        msg.content,
        { enabled: true, mode: 'auto' },
        sessionId
      );
      totalPiiCount += result.piiCount || 0;
      return { role: msg.role, content: result.proxiedText ?? msg.content };
    });

    if (totalPiiCount > 0) {
      logger.info(`🛡️ PII 자동 보호: ${totalPiiCount}건 가명처리 (session: ${sessionId})`);
    }

    return {
      messages: totalPiiCount > 0 ? protectedMessages : messages,
      sessionId: totalPiiCount > 0 ? sessionId : null,
      piiDetected: totalPiiCount > 0,
      piiCount: totalPiiCount,
    };
  }

  private restoreContent(text: string, sessionId: string | null): string {
    if (!sessionId) return text;
    const engines = getPiiEngines();
    if (!engines) return text;
    try {
      return engines.proxy.restore(text, sessionId);
    } catch {
      logger.warn('PII 복원 실패 — 원본 반환');
      return text;
    }
  }

  // ─── Legacy: enhanced structure generation ─────────────────────────

  async generateWithEnhancedStructure(
    structure: EnhancedDocumentStructure,
    userRequest: string
  ): Promise<GPTGenerationResult> {
    logger.info('🤖 맥락 기반 GPT 콘텐츠 생성 시작...');
    this.stats.totalRequests++;

    try {
      await this.ensurePiiReady();

      const messages = this.buildEnhancedPrompt(structure, userRequest);
      const piiResult = this.pseudonymizeMessages(messages);
      if (piiResult.piiDetected) {
        this.stats.piiProtected += piiResult.piiCount;
        this.stats.piiSessionCount++;
      }

      // 적응형 max_tokens: 항목 수에 비례
      const pairCount = structure.pairs.length;
      const adaptiveMaxTokens = Math.min(Math.max(1500, 500 + pairCount * 120), 16000);
      const adaptiveTimeout = Math.min(
        AIConfig.openai.timeout + pairCount * ((AIConfig.openai as any).timeoutPerCell || 3000),
        (AIConfig.openai as any).maxTimeout || 300000
      );

      const response = await this.callAPIWithRetry(
        piiResult.messages, undefined, true, adaptiveMaxTokens, adaptiveTimeout
      );
      const result = this.parseResponse(response);

      if (piiResult.sessionId) {
        for (const key of Object.keys(result.content)) {
          result.content[key] = this.restoreContent(result.content[key], piiResult.sessionId);
        }
      }

      this.updateStatistics(response);
      this.stats.successfulRequests++;

      logger.info(`✅ GPT 생성 완료: ${Object.keys(result.content).length}개 항목`);
      return result;
    } catch (error) {
      this.stats.failedRequests++;
      logger.error('❌ GPT 생성 실패:', error);
      throw error;
    }
  }

  // ─── Semantic grid generation (NEW) ────────────────────────────────

  /**
   * 시맨틱 그리드 기반 콘텐츠 생성
   * 병렬 처리 + 실패 시 자동 분할 재시도
   */
  async generateFromSemanticGrid(
    passes: GenerationPass[],
    structure: EnhancedDocumentStructure,
    userRequest: string,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<Map<string, string>> {
    const totalPasses = passes.length;
    const totalCells = passes.reduce((s, p) => s + p.cells.length, 0);
    logger.info(`🤖 시맨틱 그리드 생성 시작: ${totalPasses}패스, ${totalCells}셀`);

    await this.ensurePiiReady();

    const allResults = new Map<string, string>();
    let completedPasses = 0;
    let completedCells = 0;

    const report = (message: string) => {
      onProgress?.({
        phase: 'generating',
        totalPasses,
        completedPasses,
        totalCells,
        completedCells,
        percent: totalCells > 0 ? Math.round(completedCells / totalCells * 100) : 0,
        message,
      });
    };

    // ─── 병렬 그룹별 실행 ─────────────────────────
    // parallelGroupId가 같은 패스들은 동시 실행
    const groups = new Map<number, GenerationPass[]>();
    for (const pass of passes) {
      const gid = pass.parallelGroupId ?? pass.passNumber;
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid)!.push(pass);
    }

    // 그룹 ID 순서대로 실행 (그룹 내부는 병렬)
    const sortedGroupIds = [...groups.keys()].sort((a, b) => a - b);

    for (const gid of sortedGroupIds) {
      const groupPasses = groups.get(gid)!;

      if (groupPasses.length === 1) {
        // 단일 패스 — 순차 실행
        const pass = groupPasses[0];
        report(`패스 ${pass.passNumber}/${totalPasses} 처리 중 (${pass.cells.length}셀)`);
        const result = await this.executePassWithRetry(pass, structure, userRequest, allResults);
        for (const [k, v] of result) allResults.set(k, v);
        completedPasses++;
        completedCells += result.size; // 실제 생성된 셀만 카운트
        report(`패스 ${pass.passNumber} 완료 (${result.size}셀)`);
      } else {
        // 다중 패스 — 병렬 실행 (최대 동시 3개)
        const CONCURRENCY = 3;
        for (let i = 0; i < groupPasses.length; i += CONCURRENCY) {
          const batch = groupPasses.slice(i, i + CONCURRENCY);
          report(`병렬 처리: ${batch.length}개 패스 동시 실행 (${batch.map(p => p.passNumber).join(',')})`);

          const results = await Promise.allSettled(
            batch.map(pass =>
              this.executePassWithRetry(pass, structure, userRequest, allResults)
            )
          );

          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            const pass = batch[j];
            completedPasses++;
            if (r.status === 'fulfilled') {
              for (const [k, v] of r.value) allResults.set(k, v);
              completedCells += r.value.size; // 실제 생성된 셀 수만 카운트
            } else {
              logger.error(`   ❌ 패스 ${pass.passNumber} 최종 실패:`, r.reason);
            }
          }
          report(`병렬 배치 완료 (${completedCells}/${totalCells}셀)`);
        }
      }
    }

    logger.info(`✅ 시맨틱 생성 완료: ${allResults.size}/${totalCells}셀`);
    onProgress?.({
      phase: 'complete',
      totalPasses,
      completedPasses,
      totalCells,
      completedCells: allResults.size,
      percent: 100,
      message: `생성 완료: ${allResults.size}셀`,
    });

    return allResults;
  }

  /**
   * 단일 패스 실행 — 실패 시 절반으로 분할하여 재시도 (최대 2단계)
   */
  private async executePassWithRetry(
    pass: GenerationPass,
    structure: EnhancedDocumentStructure,
    userRequest: string,
    previousResults: Map<string, string>,
    depth: number = 0
  ): Promise<Map<string, string>> {
    const MAX_SPLIT_DEPTH = 2;

    try {
      return await this.executeSinglePass(pass, structure, userRequest, previousResults);
    } catch (error) {
      // 셀이 1개 이하이거나 분할 깊이 초과 시 포기
      if (pass.cells.length <= 1 || depth >= MAX_SPLIT_DEPTH) {
        logger.error(`   ❌ 패스 ${pass.passNumber} 복구 불가 (depth=${depth}, cells=${pass.cells.length})`);
        return new Map();
      }

      // 절반으로 분할하여 재시도
      const mid = Math.ceil(pass.cells.length / 2);
      const firstHalf = pass.cells.slice(0, mid);
      const secondHalf = pass.cells.slice(mid);

      logger.warn(`   🔄 패스 ${pass.passNumber} 실패 → ${firstHalf.length}+${secondHalf.length}셀로 분할 재시도 (depth=${depth + 1})`);

      const pass1: GenerationPass = {
        ...pass,
        passNumber: pass.passNumber,
        cells: firstHalf,
        estimatedTokens: this.estimatePassTokens(firstHalf),
      };
      const pass2: GenerationPass = {
        ...pass,
        passNumber: pass.passNumber,
        cells: secondHalf,
        estimatedTokens: this.estimatePassTokens(secondHalf),
      };

      // 분할된 2개를 순차 실행
      const r1 = await this.executePassWithRetry(pass1, structure, userRequest, previousResults, depth + 1);
      // 첫 번째 결과를 previous에 포함
      const mergedPrev = new Map([...previousResults, ...r1]);
      const r2 = await this.executePassWithRetry(pass2, structure, userRequest, mergedPrev, depth + 1);

      return new Map([...r1, ...r2]);
    }
  }

  private estimatePassTokens(cells: SemanticCell[]): number {
    return 500 + cells.length * 70;
  }

  /**
   * 단일 패스 실제 실행 — 적응형 타임아웃 + max_tokens
   */
  private async executeSinglePass(
    pass: GenerationPass,
    structure: EnhancedDocumentStructure,
    userRequest: string,
    previousResults: Map<string, string>
  ): Promise<Map<string, string>> {
    this.stats.totalRequests++;

    const cellCount = pass.cells.length;

    // 적응형 max_tokens: 셀당 ~100토큰 + 오버헤드 500
    const adaptiveMaxTokens = Math.min(
      Math.max(1000, 500 + cellCount * 100),
      16000 // GPT-4o 최대
    );

    // 적응형 타임아웃: 기본 + 셀당 추가
    const adaptiveTimeout = Math.min(
      AIConfig.openai.timeout + cellCount * (AIConfig.openai as any).timeoutPerCell,
      (AIConfig.openai as any).maxTimeout || 300000
    );

    logger.info(`   📊 패스 ${pass.passNumber}: ${cellCount}셀, maxTokens=${adaptiveMaxTokens}, timeout=${Math.round(adaptiveTimeout / 1000)}s`);

    const messages = this.buildSemanticPrompt(pass, structure, userRequest, previousResults);
    const piiResult = this.pseudonymizeMessages(messages);
    if (piiResult.piiDetected) {
      this.stats.piiProtected += piiResult.piiCount;
      this.stats.piiSessionCount++;
    }

    const response = await this.callAPIWithRetry(
      piiResult.messages, undefined, true, adaptiveMaxTokens, adaptiveTimeout
    );
    const parsed = this.parseSemanticResponse(response, pass.cells);

    if (piiResult.sessionId) {
      for (const [key, value] of parsed) {
        parsed.set(key, this.restoreContent(value, piiResult.sessionId));
      }
    }

    this.updateStatistics(response);
    this.stats.successfulRequests++;

    logger.info(`   ✅ 패스 ${pass.passNumber} 완료: ${parsed.size}/${cellCount}셀`);
    return parsed;
  }

  // ─── Semantic prompt builder ───────────────────────────────────────

  private buildSemanticPrompt(
    pass: GenerationPass,
    structure: EnhancedDocumentStructure,
    userRequest: string,
    previousResults: Map<string, string>
  ): Array<{ role: string; content: string }> {
    const grid = pass.grid;
    const docTypeName = this.getDocumentTypeName(structure.documentType);
    const styleGuide = this.getStyleGuide(structure.characteristics.dominantStyle);

    // System message
    const systemMsg = `당신은 **${docTypeName} 작성 전문가**입니다.

## 핵심 원칙
1. 표 구조를 절대 변경하지 마세요 — 오직 데이터 셀의 내용만 생성
2. 각 셀은 해당 행 헤더와 열 헤더의 맥락에 맞는 내용이어야 합니다
3. 같은 열의 셀들은 유사한 스타일과 형식을 유지하세요
4. 같은 행의 셀들은 내용적으로 연결되어야 합니다

## 스타일
${styleGuide}

## 응답 형식
반드시 JSON 객체로 응답하세요. 키는 셀 주소 (예: "R2C3"), 값은 생성된 내용입니다.
다른 텍스트나 설명 없이 순수 JSON만 반환하세요.`;

    // User message
    const userMsg = this.buildSemanticUserMessage(pass, grid, structure, userRequest, previousResults);

    return [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg },
    ];
  }

  private buildSemanticUserMessage(
    pass: GenerationPass,
    grid: SemanticGrid,
    structure: EnhancedDocumentStructure,
    userRequest: string,
    previousResults: Map<string, string>
  ): string {
    const parts: string[] = [];

    // 1. 문서 정보
    const docTypeName = this.getDocumentTypeName(structure.documentType);
    parts.push(`# 문서: ${structure.title || docTypeName}`);
    parts.push(`유형: ${docTypeName} | 표 크기: ${grid.rows}×${grid.cols}\n`);

    // 2. 표 구조 인코딩 (SpreadsheetLLM 영감)
    parts.push(this.encodeSemanticGrid(grid));

    // 3. 이전 패스 결과 (참조용)
    if (previousResults.size > 0) {
      parts.push('\n## 이미 생성된 셀 (참조용, 다시 생성하지 마세요)');
      const relevantPrev: string[] = [];
      for (const [addr, content] of previousResults) {
        const preview = content.length > 80 ? content.substring(0, 80) + '...' : content;
        relevantPrev.push(`${addr}: "${preview}"`);
        if (relevantPrev.length >= 15) {
          relevantPrev.push(`... 외 ${previousResults.size - 15}개`);
          break;
        }
      }
      parts.push(relevantPrev.join('\n'));
    }

    // 4. 원본 컨텍스트 예시
    if (structure.contextSamples.length > 0) {
      parts.push('\n## 원본 내용 스타일 예시');
      for (const sample of structure.contextSamples.slice(0, 3)) {
        const preview = sample.originalContent.length > 120
          ? sample.originalContent.substring(0, 120) + '...'
          : sample.originalContent;
        parts.push(`"${sample.header}": "${preview}" (${sample.contentLength}자, ${sample.contentStyle})`);
      }
    }

    // 5. 생성 가이드라인
    if (structure.generationGuide.contextualHints.length > 0) {
      parts.push('\n## 가이드라인');
      for (const hint of structure.generationGuide.contextualHints) {
        parts.push(`- ${hint}`);
      }
    }

    // 6. 생성할 셀 목록
    parts.push(`\n## 사용자 요청: "${userRequest}"`);
    parts.push(`\n## 생성할 셀 (${pass.cells.length}개)`);

    for (const cell of pass.cells) {
      const addr = getCellAddress(cell);
      const label = getFullHeaderLabel(cell);
      const existingContent = cell.isEmpty ? '(빈 셀)' : `현재: "${cell.text.substring(0, 50)}"`;
      parts.push(`[${addr}] ${label} — ${existingContent}`);
    }

    // 7. 응답 형식 예시
    parts.push('\n## 응답 (JSON)');
    const exampleCells = pass.cells.slice(0, 3);
    const exampleObj: Record<string, string> = {};
    for (const c of exampleCells) {
      exampleObj[getCellAddress(c)] = '생성된 내용';
    }
    if (pass.cells.length > 3) {
      exampleObj['...'] = '...';
    }
    parts.push('```json');
    parts.push(JSON.stringify(exampleObj, null, 2));
    parts.push('```');

    return parts.join('\n');
  }

  // ─── Grid encoding (SpreadsheetLLM inspired) ──────────────────────

  encodeSemanticGrid(grid: SemanticGrid): string {
    const parts: string[] = [];

    parts.push(`## 표 구조 (${grid.rows}행 × ${grid.cols}열)\n`);

    // 컬럼 헤더 인코딩
    if (grid.columnHeaders.length > 0) {
      parts.push('### 컬럼 헤더:');
      for (let level = 0; level < grid.columnHeaders.length; level++) {
        const headers = grid.columnHeaders[level];
        const labels: string[] = [];

        // 전체 열을 순회하며 각 위치의 헤더 표시
        for (let c = 0; c < grid.cols; c++) {
          const h = headers.find(h => h.gridCol <= c && h.gridCol + h.colSpan > c);
          if (h) {
            // 이 헤더가 시작하는 위치에서만 표시
            if (h.gridCol === c) {
              const span = h.colSpan > 1 ? ` (×${h.colSpan})` : '';
              labels.push(`${h.text.trim()}${span}`);
            }
          } else if (c < grid.cornerRegion.colEnd) {
            labels.push('_');
          }
        }
        parts.push(`  L${level}: [${labels.join(', ')}]`);
      }
    }

    // 행 헤더 인코딩
    if (grid.rowHeaders.length > 0) {
      parts.push('\n### 행 헤더:');
      for (let level = 0; level < grid.rowHeaders.length; level++) {
        const headers = grid.rowHeaders[level];
        for (const h of headers) {
          const span = h.rowSpan > 1 ? ` (행 ${h.gridRow}-${h.gridRow + h.rowSpan - 1})` : '';
          parts.push(`  ${h.text.trim()}${span}`);
        }
      }
    }

    // 타이틀
    if (grid.titleCell) {
      parts.push(`\n제목: "${grid.titleCell.text.trim()}"`);
    }

    return parts.join('\n');
  }

  // ─── Semantic response parser ──────────────────────────────────────

  private parseSemanticResponse(
    apiResponse: GPTResponse,
    expectedCells: SemanticCell[]
  ): Map<string, string> {
    const content = apiResponse.choices[0]?.message?.content;
    if (!content) throw new Error('API 응답에 content가 없습니다');

    let parsed: Record<string, string>;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsed = JSON.parse(jsonStr);
    } catch (error) {
      logger.error('시맨틱 JSON 파싱 실패:', content.substring(0, 200));
      throw new Error(`JSON 파싱 실패: ${(error as Error).message}`);
    }

    const results = new Map<string, string>();

    // 주소 기반 매칭 (R2C3 형식)
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '...') continue;
      if (typeof value === 'string') {
        results.set(key, value);
      }
    }

    // 매칭되지 않은 셀이 있으면 헤더 라벨 기반 fallback 매칭
    const matchedAddrs = new Set(results.keys());
    for (const cell of expectedCells) {
      const addr = getCellAddress(cell);
      if (!matchedAddrs.has(addr)) {
        // 헤더 라벨로 매칭 시도
        const label = getFullHeaderLabel(cell);
        const matchByLabel = Object.entries(parsed).find(([k]) => k === label);
        if (matchByLabel && typeof matchByLabel[1] === 'string') {
          results.set(addr, matchByLabel[1]);
        }
      }
    }

    return results;
  }

  // ─── Simple text generation ────────────────────────────────────────

  async generateContent(
    prompt: string,
    options: {
      apiKey: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{
    content: string;
    tokensUsed: number;
    cost: number;
  }> {
    logger.info('🤖 GPT 콘텐츠 생성 시작...');
    this.stats.totalRequests++;

    try {
      await this.ensurePiiReady();

      const messages = [{ role: 'user' as const, content: prompt }];
      const piiResult = this.pseudonymizeMessages(messages);
      if (piiResult.piiDetected) {
        this.stats.piiProtected += piiResult.piiCount;
        this.stats.piiSessionCount++;
      }

      const response = await this.callAPIWithRetry(piiResult.messages, options.apiKey, false);
      this.updateStatistics(response);
      this.stats.successfulRequests++;

      let content = response.choices[0]?.message?.content || '';
      if (piiResult.sessionId) {
        content = this.restoreContent(content, piiResult.sessionId);
      }

      const tokensUsed = response.usage?.total_tokens || 0;
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const cost = (promptTokens * AIConfig.costManagement.costPerInputToken) +
                   (completionTokens * AIConfig.costManagement.costPerOutputToken);

      return { content, tokensUsed, cost };
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    }
  }

  // ─── Legacy prompt builder ─────────────────────────────────────────

  private buildEnhancedPrompt(
    structure: EnhancedDocumentStructure,
    userRequest: string
  ): Array<{ role: string; content: string }> {
    const systemMessage = this.buildSystemMessage(structure);
    const userMessage = this.buildUserMessage(structure, userRequest);
    return [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ];
  }

  private buildSystemMessage(structure: EnhancedDocumentStructure): string {
    const docTypeName = this.getDocumentTypeName(structure.documentType);
    const styleGuide = this.getStyleGuide(structure.characteristics.dominantStyle);

    return `당신은 **${docTypeName} 작성 전문가**입니다.

## 핵심 원칙

### 1. 구조 절대 유지
- 표 레이아웃 변경 금지
- 헤더 이름 변경 금지
- 오직 내용만 변경

### 2. 맥락 완전 이해
- 문서 전체의 구조와 흐름 파악
- 항목 간 관계와 연관성 고려
- 원본과 동일한 스타일과 길이 유지

### 3. 내용 품질
${styleGuide}
- 실제 ${docTypeName}에서 사용 가능한 수준의 구체성
- 자연스럽고 전문적인 문장 구성

### 4. 연관성 유지
${structure.characteristics.hasTimeSequence ? '- 시간 순서에 따라 점진적으로 발전하는 내용' : ''}
${structure.characteristics.hasRepetitiveStructure ? '- 반복 구조에서 각 단위별로 적절히 변화하는 내용' : ''}
${structure.relationships.some(r => r.type === 'same-row') ? '- 같은 행의 항목들은 내용적으로 연결되고 일관성 유지' : ''}

## 응답 형식
반드시 **JSON 객체**로 응답하세요:
\`\`\`json
{
  "항목1": "생성된 내용1",
  "항목2": "생성된 내용2"
}
\`\`\`

다른 텍스트나 설명 없이 순수 JSON만 반환하세요.`;
  }

  private buildUserMessage(
    structure: EnhancedDocumentStructure,
    userRequest: string
  ): string {
    const overview = this.buildDocumentOverview(structure);
    const structureAnalysis = this.buildStructureAnalysis(structure);
    const contextExamples = this.buildContextExamples(structure);
    const relationships = this.buildRelationshipsDescription(structure);
    const guidelines = this.buildGenerationGuidelines(structure);
    const itemsList = this.buildItemsList(structure);

    return `# 문서 정보

${overview}

---

# 문서 구조 분석

${structureAnalysis}

---

# 원본 내용 스타일 예시

${contextExamples}

**중요: 위 예시를 참고하여 비슷한 톤, 길이, 스타일로 작성하세요!**

---

# 항목 간 관계

${relationships}

---

# 생성 가이드라인

${guidelines}

---

# 사용자 요청

**"${userRequest}"**

---

# 생성할 항목 목록 (${structure.pairs.length}개)

${itemsList}

---

# 응답 형식

\`\`\`json
{
${structure.pairs.slice(0, 3).map(p => `  "${p.header}": "생성된 내용"`).join(',\n')}${structure.pairs.length > 3 ? ',\n  ...' : ''}
}
\`\`\`

**모든 항목에 대해 위 형식으로 JSON 응답을 생성하세요.**`;
  }

  private buildDocumentOverview(structure: EnhancedDocumentStructure): string {
    const docTypeName = this.getDocumentTypeName(structure.documentType);
    let overview = `- **문서 유형**: ${docTypeName}`;
    if (structure.title) overview += `\n- **제목**: ${structure.title}`;
    if (structure.tableStructure) {
      const ts = structure.tableStructure;
      overview += `\n- **구조**: ${ts.totalRows}행 × ${ts.totalColumns}열 표 형식`;
      if (ts.columnHeaders.length > 0) {
        overview += `\n- **시간 구분**: ${ts.columnHeaders.join(', ')}`;
      }
    }
    overview += `\n- **항목 수**: ${structure.pairs.length}개`;
    overview += `\n- **평균 길이**: 약 ${structure.characteristics.averageContentLength}자`;
    return overview;
  }

  private buildStructureAnalysis(structure: EnhancedDocumentStructure): string {
    const { characteristics, tableStructure } = structure;
    let analysis = '';

    if (characteristics.hasTimeSequence) {
      analysis += '**시간 순서 구조**: 이 문서는 시간 순서에 따라 구성되어 있습니다.\n→ 각 시간대별로 내용이 자연스럽게 발전해야 합니다.\n\n';
    }
    if (characteristics.hasRepetitiveStructure) {
      analysis += '**반복 구조**: 동일한 형식이 여러 단위로 반복됩니다.\n→ 각 단위별로 내용은 다르지만 스타일은 일관되어야 합니다.\n\n';
    }
    if (characteristics.hasCategorization) {
      analysis += '**카테고리 분류**: 여러 카테고리로 분류된 항목들이 있습니다.\n→ 각 카테고리 내에서 일관성을 유지하세요.\n\n';
    }
    if (tableStructure && tableStructure.columnHeaders.length > 0) {
      analysis += `**열 구성**: ${tableStructure.columnHeaders.join(' | ')}\n→ 각 열은 동일한 주제의 다른 시점/단계를 나타냅니다.\n\n`;
    }

    return analysis.trim() || '기본 표 형식 문서입니다.';
  }

  private buildContextExamples(structure: EnhancedDocumentStructure): string {
    if (structure.contextSamples.length === 0) return '(원본 내용 예시 없음)';

    let examples = '';
    structure.contextSamples.slice(0, 5).forEach((sample, index) => {
      const styleEmoji = { 'detailed': '📄', 'brief': '💬', 'list': '📝', 'structured': '📊' }[sample.contentStyle];
      examples += `\n### ${styleEmoji} 예시 ${index + 1}: "${sample.header}"\n`;
      examples += `**스타일**: ${this.getStyleDescription(sample.contentStyle)}\n`;
      examples += `**길이**: ${sample.contentLength}자\n`;
      if (sample.hasBullets) examples += `**형식**: 목록형\n`;
      if (sample.hasLineBreaks) examples += `**형식**: 여러 줄\n`;
      const preview = sample.originalContent.length > 150
        ? sample.originalContent.substring(0, 150) + '...'
        : sample.originalContent;
      examples += `\n\`\`\`\n${preview}\n\`\`\`\n`;
    });

    return examples;
  }

  private buildRelationshipsDescription(structure: EnhancedDocumentStructure): string {
    if (structure.relationships.length === 0) return '각 항목은 독립적입니다.';

    let desc = '';
    structure.relationships.forEach(rel => {
      const icon = {
        'same-row': '↔️', 'same-column': '↕️', 'sequential': '➡️', 'hierarchical': '🔽',
        'same-column-header': '↕️', 'same-row-header': '↔️', 'sibling': '👫',
      }[rel.type] || '🔗';

      desc += `\n${icon} **${rel.description || '관련 항목'}**\n`;
      desc += `   항목들: ${rel.items.slice(0, 3).join(', ')}${rel.items.length > 3 ? ' 등' : ''}\n`;
    });

    return desc.trim();
  }

  private buildGenerationGuidelines(structure: EnhancedDocumentStructure): string {
    const { generationGuide, characteristics } = structure;
    let guidelines = '';

    generationGuide.contextualHints.forEach((hint, index) => {
      guidelines += `${index + 1}. ${hint}\n`;
    });

    if (generationGuide.shouldMaintainContinuity) {
      guidelines += `\n**연속성 필수**: 같은 행의 항목들은 내용적으로 연결되어야 합니다.\n`;
    }
    if (generationGuide.shouldVaryContent) {
      guidelines += `\n**내용 변화**: 각 단위별로 내용이 달라야 하지만 주제는 연관되어야 합니다.\n`;
    }
    if (characteristics.averageContentLength > 0) {
      const lengthRange = `${Math.round(characteristics.averageContentLength * 0.8)}-${Math.round(characteristics.averageContentLength * 1.2)}자`;
      guidelines += `\n**길이 가이드**: 각 항목은 대략 ${lengthRange} 정도가 적절합니다.\n`;
    }

    return guidelines.trim() || '일반적인 작성 규칙을 따르세요.';
  }

  private buildItemsList(structure: EnhancedDocumentStructure): string {
    return structure.pairs.map((p, i) => {
      const rowInfo = structure.relationships.find(r =>
        r.type === 'same-row' && r.items.includes(p.header)
      );
      let line = `${i + 1}. **${p.header}**`;
      if (rowInfo) {
        const sameRowItems = rowInfo.items.filter(item => item !== p.header);
        if (sameRowItems.length > 0) {
          line += ` (연관: ${sameRowItems[0]}${sameRowItems.length > 1 ? ' 등' : ''})`;
        }
      }
      return line;
    }).join('\n');
  }

  // ─── API call ──────────────────────────────────────────────────────

  private async callAPIWithRetry(
    messages: Array<{ role: string; content: string }>,
    apiKey?: string,
    useJsonMode: boolean = true,
    maxTokens?: number,
    timeout?: number
  ): Promise<GPTResponse> {
    const { maxAttempts, delayMs, backoffMultiplier } = AIConfig.openai.retry;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.callAPI(messages, apiKey, useJsonMode, maxTokens, timeout);
      } catch (error) {
        lastError = error as Error;
        const isTimeout = (error as Error).message?.includes('타임아웃') ||
                          (error as Error).message?.includes('timeout');

        if (attempt < maxAttempts) {
          // 타임아웃이면 더 긴 대기 후 재시도
          const delay = isTimeout
            ? delayMs * Math.pow(backoffMultiplier, attempt)
            : delayMs * Math.pow(backoffMultiplier, attempt - 1);
          logger.warn(`⚠️  시도 ${attempt} 실패 (${isTimeout ? '타임아웃' : '오류'}), ${delay}ms 후 재시도...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('API 호출 실패');
  }

  private async callAPI(
    messages: Array<{ role: string; content: string }>,
    providedApiKey?: string,
    useJsonMode: boolean = true,
    maxTokens?: number,
    timeout?: number
  ): Promise<GPTResponse> {
    const apiKey = providedApiKey || AIConfig.openai.getApiKey();
    if (!apiKey) throw new Error(AIConfig.prompts.errorMessages.noApiKey);

    const effectiveMaxTokens = maxTokens || AIConfig.openai.maxTokens;
    const effectiveTimeout = timeout || AIConfig.openai.timeout;

    const requestBody: any = {
      model: AIConfig.openai.model,
      messages,
      temperature: AIConfig.openai.temperature,
      max_tokens: effectiveMaxTokens,
    };

    if (useJsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(AIConfig.openai.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      return await response.json() as GPTResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(AIConfig.prompts.errorMessages.timeout);
      }
      throw error;
    }
  }

  // ─── Response parser (legacy) ──────────────────────────────────────

  private parseResponse(apiResponse: GPTResponse): GPTGenerationResult {
    if (!apiResponse.choices || apiResponse.choices.length === 0) {
      throw new Error('API 응답에 choices가 없습니다');
    }

    const content = apiResponse.choices[0].message?.content;
    if (!content) throw new Error('API 응답에 content가 없습니다');

    let parsedContent: Record<string, string>;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedContent = JSON.parse(jsonStr);
    } catch (error) {
      logger.error('JSON 파싱 실패:', content);
      throw new Error(`JSON 파싱 실패: ${(error as Error).message}`);
    }

    const tokensUsed = apiResponse.usage?.total_tokens || 0;
    const promptTokens = apiResponse.usage?.prompt_tokens || 0;
    const completionTokens = apiResponse.usage?.completion_tokens || 0;
    const cost = (promptTokens * AIConfig.costManagement.costPerInputToken) +
                 (completionTokens * AIConfig.costManagement.costPerOutputToken);

    return {
      content: parsedContent,
      metadata: { model: apiResponse.model, tokensUsed, promptTokens, completionTokens, cost },
    };
  }

  // ─── Statistics ────────────────────────────────────────────────────

  private updateStatistics(apiResponse: GPTResponse): void {
    const tokensUsed = apiResponse.usage?.total_tokens || 0;
    const promptTokens = apiResponse.usage?.prompt_tokens || 0;
    const completionTokens = apiResponse.usage?.completion_tokens || 0;

    this.stats.totalTokensUsed += tokensUsed;

    const cost = (promptTokens * AIConfig.costManagement.costPerInputToken) +
                 (completionTokens * AIConfig.costManagement.costPerOutputToken);
    this.stats.totalCost += cost;

    if (this.stats.totalCost > AIConfig.costManagement.warningThreshold) {
      logger.warn(`⚠️  비용 경고: $${this.stats.totalCost.toFixed(2)}`);
    }
  }

  getStatistics() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0
        ? `${(this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)}%`
        : 'N/A',
      averageTokensPerRequest: this.stats.successfulRequests > 0
        ? Math.round(this.stats.totalTokensUsed / this.stats.successfulRequests)
        : 0,
    };
  }

  getPiiProtectionStatus() {
    return {
      enabled: this._piiReady,
      totalProtected: this.stats.piiProtected,
      sessionCount: this.stats.piiSessionCount,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private getDocumentTypeName(type: EnhancedDocumentStructure['documentType']): string {
    const typeNames: Record<typeof type, string> = {
      'monthly': '월간계획안', 'weekly': '주간계획안', 'daily': '일일계획안',
      'lesson': '수업계획안', 'report': '보고서', 'form': '양식', 'unknown': '문서',
    };
    return typeNames[type] || '문서';
  }

  private getStyleGuide(style: EnhancedDocumentStructure['characteristics']['dominantStyle']): string {
    const guides: Record<typeof style, string> = {
      'educational': '- 교육적이고 발달단계에 적합한 내용\n- 구체적인 활동과 목표 제시\n- 전문 교육자가 작성한 수준의 품질',
      'formal': '- 격식체 사용 (합니다, 됩니다)\n- 전문적이고 정확한 용어\n- 공식 문서 수준의 품질',
      'casual': '- 자연스럽고 읽기 쉬운 문체\n- 일상적인 표현 활용\n- 친근하지만 전문적인 톤',
      'technical': '- 정확한 기술 용어 사용\n- 논리적이고 체계적인 서술\n- 전문가 수준의 정보',
    };
    return guides[style];
  }

  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      'detailed': '상세형', 'brief': '간략형', 'list': '목록형', 'structured': '구조화',
    };
    return descriptions[style] || style;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GPTService;
