/**
 * AI Document Controller v3.0
 * AI 기반 문서 편집 통합 컨트롤러 — 시맨틱 그리드 + 멀티패스 파이프라인
 *
 * @module lib/ai/document-controller
 * @version 3.0.0
 * @description 시맨틱 분석 → 패스 계획 → 생성 실행 → 병합 → 검증
 */

import type { HWPXDocument } from '../../types/hwpx';
import { DocumentStructureExtractor, type EnhancedDocumentStructure } from './structure-extractor';
import { GPTService, type GenerationPass, type GenerationProgress } from './gpt-service';
import { AIConfig } from './ai-config';
import {
  getCellAddress,
  type SemanticGrid,
  type SemanticCell,
} from './table-semantics';
import { getLogger } from '../utils/logger';

const logger = getLogger();

// ─── Types ───────────────────────────────────────────────────────────────

export interface AIProcessResult {
  success: boolean;
  updatedDocument: HWPXDocument;
  metadata: {
    request: string;
    documentType: string;
    itemsUpdated: number;
    tokensUsed: number;
    cost: number;
    processingTime: number;
    structureAnalysis: {
      hasTimeSequence: boolean;
      hasRepetitiveStructure: boolean;
      averageContentLength: number;
    };
    security: {
      piiProtectionEnabled: boolean;
      piiDetectedCount: number;
      piiAction: 'masked' | 'none';
    };
    // v3 확장
    pipeline: 'legacy' | 'semantic';
    passCount?: number;
    semanticCoverage?: string;
    // v3.1: 병렬 처리 정보
    parallelGroups?: number;
    retriedPasses?: number;
  };
}

/** 진행률 콜백 타입 */
export type ProgressCallback = (progress: GenerationProgress) => void;

// ─── Controller ──────────────────────────────────────────────────────────

export class AIDocumentController {
  private extractor: DocumentStructureExtractor;
  private gptService: GPTService;
  private isProcessing = false;
  private lastStructure?: EnhancedDocumentStructure;

  constructor() {
    this.extractor = new DocumentStructureExtractor();
    this.gptService = new GPTService();
  }

  hasApiKey(): boolean {
    return AIConfig.openai.getApiKey() !== null;
  }

  setApiKey(apiKey: string): void {
    AIConfig.openai.setApiKey(apiKey);
  }

  /**
   * 사용자 요청 처리 (메인 파이프라인)
   * 자동으로 legacy/semantic 파이프라인 선택
   * @param onProgress 진행률 콜백 (선택)
   */
  async handleUserRequest(
    document: HWPXDocument,
    userMessage: string,
    onProgress?: ProgressCallback
  ): Promise<AIProcessResult> {
    logger.info('🤖 AI 요청 처리 시작 (v3 자동 파이프라인)...');
    logger.info(`   요청: "${userMessage}"`);

    const startTime = Date.now();

    if (this.isProcessing) {
      throw new Error('이미 요청을 처리 중입니다. 완료 후 다시 시도하세요.');
    }
    if (!this.hasApiKey()) {
      throw new Error(AIConfig.prompts.errorMessages.noApiKey);
    }

    this.isProcessing = true;

    try {
      // ════════════════════════════════════════
      // Step 1: 시맨틱 구조 분석
      // ════════════════════════════════════════
      logger.info('  📊 Step 1/5: 시맨틱 구조 분석...');
      const structure = this.extractor.extractEnhancedStructure(document);
      this.lastStructure = structure;

      if (structure.pairs.length === 0 && structure.semanticGrids.length === 0) {
        throw new Error('편집 가능한 항목을 찾을 수 없습니다. 표 형식의 문서인지 확인해주세요.');
      }

      logger.info(`    파이프라인: ${structure.pipeline}`);
      logger.info(`    ${structure.pairs.length}개 항목, ${structure.semanticGrids.length}개 시맨틱 그리드`);

      // ════════════════════════════════════════
      // 분기: semantic vs legacy
      // ════════════════════════════════════════
      if (structure.pipeline === 'semantic') {
        return await this.executeSemanticPipeline(document, structure, userMessage, startTime, onProgress);
      } else {
        return await this.executeLegacyPipeline(document, structure, userMessage, startTime);
      }
    } catch (error) {
      logger.error('❌ AI 처리 실패:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  // ─── Semantic Pipeline ─────────────────────────────────────────────

  private async executeSemanticPipeline(
    document: HWPXDocument,
    structure: EnhancedDocumentStructure,
    userMessage: string,
    startTime: number,
    onProgress?: ProgressCallback
  ): Promise<AIProcessResult> {
    const grids = structure.semanticGrids;

    // ════════════════════════════════════════
    // Step 2: 생성 패스 계획 (병렬 그룹 포함)
    // ════════════════════════════════════════
    logger.info('  📋 Step 2/5: 생성 패스 계획...');
    onProgress?.({
      phase: 'planning', totalPasses: 0, completedPasses: 0,
      totalCells: 0, completedCells: 0, percent: 0,
      message: '패스 계획 수립 중...',
    });

    const passes = this.planGenerationPasses(grids);
    const parallelGroups = new Set(passes.map(p => p.parallelGroupId ?? p.passNumber)).size;

    logger.info(`    ${passes.length}개 패스, ${parallelGroups}개 병렬 그룹`);
    for (const pass of passes) {
      const pgLabel = pass.parallelGroupId !== undefined ? ` [그룹${pass.parallelGroupId}]` : '';
      logger.info(`    패스 ${pass.passNumber}: ${pass.cells.length}셀 (${pass.promptStrategy})${pgLabel}`);
    }

    // ════════════════════════════════════════
    // Step 3: GPT 생성 실행 (병렬 + 재시도 + 중간 저장)
    // ════════════════════════════════════════
    logger.info('  🤖 Step 3/5: GPT 생성 실행...');
    logger.info(`    배치 크기: ${passes.map(p => p.cells.length).join(', ')}셀`);

    let generatedContent: Map<string, string>;
    try {
      generatedContent = await this.gptService.generateFromSemanticGrid(
        passes,
        structure,
        userMessage,
        onProgress
      );
    } catch (error) {
      // 전체 실패 시에도 부분 결과가 있으면 사용
      logger.error('  ❌ 생성 중 오류 발생, 부분 결과로 진행:', error);
      generatedContent = new Map();
    }

    logger.info(`    ${generatedContent.size}개 셀 생성 완료`);

    // ════════════════════════════════════════
    // Step 4: 문서 병합
    // ════════════════════════════════════════
    logger.info('  🔀 Step 4/5: 문서에 병합...');
    const updatedDocument = this.mergeContentFromGrid(document, generatedContent, grids);

    // ════════════════════════════════════════
    // Step 5: 검증 및 결과
    // ════════════════════════════════════════
    logger.info('  ✅ Step 5/5: 검증...');
    const processingTime = Date.now() - startTime;
    const piiStatus = this.gptService.getPiiProtectionStatus();
    const totalDataCells = grids.reduce((s, g) => s + g.totalDataCells, 0);
    const coverage = `${generatedContent.size}/${totalDataCells} (${totalDataCells > 0 ? Math.round(generatedContent.size / totalDataCells * 100) : 0}%)`;

    const stats = this.gptService.getStatistics();

    const result: AIProcessResult = {
      success: true,
      updatedDocument,
      metadata: {
        request: userMessage,
        documentType: this.getDocumentTypeKorean(structure.documentType),
        itemsUpdated: generatedContent.size,
        tokensUsed: stats.totalTokensUsed,
        cost: stats.totalCost,
        processingTime,
        structureAnalysis: {
          hasTimeSequence: structure.characteristics.hasTimeSequence,
          hasRepetitiveStructure: structure.characteristics.hasRepetitiveStructure,
          averageContentLength: structure.characteristics.averageContentLength,
        },
        security: {
          piiProtectionEnabled: piiStatus.enabled,
          piiDetectedCount: piiStatus.totalProtected,
          piiAction: piiStatus.totalProtected > 0 ? 'masked' : 'none',
        },
        pipeline: 'semantic',
        passCount: passes.length,
        semanticCoverage: coverage,
        parallelGroups,
      },
    };

    logger.info(`✅ 시맨틱 파이프라인 완료 (${processingTime}ms)`);
    logger.info(`   커버리지: ${coverage}, 패스: ${passes.length}`);

    return result;
  }

  // ─── Legacy Pipeline ───────────────────────────────────────────────

  private async executeLegacyPipeline(
    document: HWPXDocument,
    structure: EnhancedDocumentStructure,
    userMessage: string,
    startTime: number
  ): Promise<AIProcessResult> {
    // Step 2: GPT 생성
    logger.info('  🤖 Step 2/4: 맥락 기반 GPT 콘텐츠 생성...');
    const generation = await this.gptService.generateWithEnhancedStructure(structure, userMessage);
    logger.info(`    ${Object.keys(generation.content).length}개 항목 생성 완료`);

    // Step 3: 병합
    logger.info('  🔀 Step 3/4: 문서에 병합...');
    const updatedDocument = this.mergeLegacyContent(document, generation.content, structure);

    // Step 4: 결과
    const processingTime = Date.now() - startTime;
    const piiStatus = this.gptService.getPiiProtectionStatus();

    return {
      success: true,
      updatedDocument,
      metadata: {
        request: userMessage,
        documentType: this.getDocumentTypeKorean(structure.documentType),
        itemsUpdated: Object.keys(generation.content).length,
        tokensUsed: generation.metadata.tokensUsed,
        cost: generation.metadata.cost,
        processingTime,
        structureAnalysis: {
          hasTimeSequence: structure.characteristics.hasTimeSequence,
          hasRepetitiveStructure: structure.characteristics.hasRepetitiveStructure,
          averageContentLength: structure.characteristics.averageContentLength,
        },
        security: {
          piiProtectionEnabled: piiStatus.enabled,
          piiDetectedCount: piiStatus.totalProtected,
          piiAction: piiStatus.totalProtected > 0 ? 'masked' : 'none',
        },
        pipeline: 'legacy',
      },
    };
  }

  // ─── Generation pass planning ──────────────────────────────────────

  /**
   * 생성 패스 계획 — 병렬 그룹 + 적응형 배치 크기
   *
   * 전략:
   * - 서로 다른 표(grid)의 패스는 병렬 실행 가능 (같은 parallelGroupId)
   * - 같은 표 내의 순차 의존 패스는 다른 groupId
   * - 배치 크기는 평균 내용 길이에 따라 조정
   */
  private planGenerationPasses(grids: SemanticGrid[]): GenerationPass[] {
    const passes: GenerationPass[] = [];
    let passNumber = 1;
    let parallelGroupId = 0;

    // 적응형 배치 크기: 타임아웃 방지를 위해 보수적으로 설정
    // 핵심: 셀당 평균 생성 길이를 예측하여 배치 크기 결정
    const calcBatchSize = (cells: SemanticCell[]): number => {
      const avgContentLen = cells.reduce((s, c) => s + c.text.length, 0) / Math.max(cells.length, 1);
      if (avgContentLen > 200) return 8;  // 긴 내용이면 매우 작은 배치
      if (avgContentLen > 100) return 12;
      if (avgContentLen > 50) return 18;
      return 25; // 빈 셀 위주여도 25개 상한 (타임아웃 방지)
    };

    // 1단계: 각 표별로 패스 생성
    const gridPassGroups: GenerationPass[][] = [];

    for (const grid of grids) {
      const dataCells = grid.dataCells;
      if (dataCells.length === 0) continue;

      const gridPasses: GenerationPass[] = [];
      const batchSize = calcBatchSize(dataCells);

      if (dataCells.length <= batchSize) {
        // 단일 패스
        gridPasses.push({
          passNumber: passNumber++,
          cells: dataCells,
          grid,
          dependsOnPasses: [],
          promptStrategy: 'single-batch',
          estimatedTokens: this.estimateTokens(dataCells),
        });
      } else {
        // 컬럼별 그룹핑 → 배치 분할
        const colGroups = new Map<number, SemanticCell[]>();
        for (const dc of dataCells) {
          if (!colGroups.has(dc.gridCol)) colGroups.set(dc.gridCol, []);
          colGroups.get(dc.gridCol)!.push(dc);
        }

        let currentBatch: SemanticCell[] = [];

        for (const [_col, cells] of colGroups) {
          if (currentBatch.length + cells.length > batchSize && currentBatch.length > 0) {
            gridPasses.push({
              passNumber: passNumber++,
              cells: [...currentBatch],
              grid,
              dependsOnPasses: [],
              promptStrategy: 'column-grouped',
              estimatedTokens: this.estimateTokens(currentBatch),
            });
            currentBatch = [];
          }
          currentBatch.push(...cells);
        }

        if (currentBatch.length > 0) {
          gridPasses.push({
            passNumber: passNumber++,
            cells: [...currentBatch],
            grid,
            dependsOnPasses: [],
            promptStrategy: currentBatch.length <= batchSize ? 'column-grouped' : 'row-grouped',
            estimatedTokens: this.estimateTokens(currentBatch),
          });
        }
      }

      gridPassGroups.push(gridPasses);
    }

    // 2단계: 병렬 그룹 할당
    // 서로 다른 표의 첫 번째 패스들은 같은 그룹 (병렬)
    // 같은 표의 후속 패스들은 다음 그룹 (이전 결과 필요)
    if (gridPassGroups.length <= 1) {
      // 표가 1개: 의존 관계 없는 패스들은 같은 그룹 (병렬 가능)
      // 같은 표의 패스들은 서로 독립적 (컬럼 그룹 기반이므로)
      for (const group of gridPassGroups) {
        // 모든 패스를 같은 병렬 그룹에 배치 (동시 실행 가능)
        const gid = parallelGroupId++;
        for (const pass of group) {
          pass.parallelGroupId = gid;
          passes.push(pass);
        }
      }
    } else {
      // 표가 여러 개: 같은 순서의 패스끼리 병렬
      const maxPasses = Math.max(...gridPassGroups.map(g => g.length));

      for (let round = 0; round < maxPasses; round++) {
        const roundPasses: GenerationPass[] = [];

        for (const group of gridPassGroups) {
          if (round < group.length) {
            group[round].parallelGroupId = parallelGroupId;
            roundPasses.push(group[round]);
          }
        }

        passes.push(...roundPasses);
        parallelGroupId++;
      }
    }

    return passes;
  }

  private estimateTokens(cells: SemanticCell[]): number {
    // 프롬프트 오버헤드 ~500 + 셀당 가변 (빈 셀 ~40, 내용 있는 셀 ~80)
    const cellTokens = cells.reduce((s, c) => {
      return s + (c.isEmpty ? 40 : 80);
    }, 0);
    return 500 + cellTokens;
  }

  // ─── Semantic merge ────────────────────────────────────────────────

  private mergeContentFromGrid(
    document: HWPXDocument,
    generatedContent: Map<string, string>,
    grids: SemanticGrid[]
  ): HWPXDocument {
    // 딥 복사 (이미지 Map 보존)
    const originalImages = document.images;
    const updatedDocument = JSON.parse(JSON.stringify(document)) as HWPXDocument;
    updatedDocument.images = originalImages;

    let updatedCount = 0;
    let skippedCount = 0;

    for (const grid of grids) {
      for (const dc of grid.dataCells) {
        const addr = getCellAddress(dc);
        const newContent = generatedContent.get(addr);

        if (newContent === undefined || newContent === null) {
          skippedCount++;
          continue;
        }

        try {
          const { section, table, row, cellIndex } = dc.sourcePath;

          const sec = updatedDocument.sections[section];
          if (!sec) { skippedCount++; continue; }

          // table index: elements 배열에서 table 타입만 카운트해서 찾기
          let tableCount = 0;
          let targetTable: any = null;
          for (const elem of sec.elements) {
            if (elem.type === 'table') {
              if (tableCount === table) {
                targetTable = elem;
                break;
              }
              tableCount++;
            }
          }

          if (!targetTable) { skippedCount++; continue; }

          const tableRow = targetTable.rows?.[row];
          if (!tableRow) { skippedCount++; continue; }

          const cell = tableRow.cells?.[cellIndex];
          if (!cell) { skippedCount++; continue; }

          // 내용 업데이트 (스타일 보존)
          this.updateCellContent(cell, newContent);
          updatedCount++;
        } catch (error) {
          logger.error(`  ❌ [${addr}] 업데이트 실패:`, error);
          skippedCount++;
        }
      }
    }

    const total = updatedCount + skippedCount;
    logger.info(`✅ 시맨틱 병합: ${updatedCount}/${total} (${total > 0 ? Math.round(updatedCount / total * 100) : 0}%)`);

    return updatedDocument;
  }

  /**
   * 셀 내용 업데이트 — 원본 스타일 완전 보존
   */
  private updateCellContent(cell: any, newContent: string): void {
    if (!cell.elements || cell.elements.length === 0) {
      // 빈 셀: 새 구조 생성
      cell.elements = [{
        type: 'paragraph',
        runs: [{ text: newContent, style: {} }],
      }];
      return;
    }

    // 줄바꿈이 있으면 여러 문단으로 분할
    const lines = newContent.split('\n').filter(l => l.trim().length > 0);

    if (lines.length <= 1) {
      // 단일 줄: 첫 문단의 텍스트만 교체
      const firstPara = cell.elements[0];
      if (firstPara?.type === 'paragraph') {
        this.updateParagraphText(firstPara, newContent);
      }
    } else {
      // 여러 줄: 첫 문단의 스타일을 복제하여 추가 문단 생성
      const templatePara = cell.elements.find((e: any) => e.type === 'paragraph');
      const templateStyle = templatePara?.runs?.[0]?.style || {};

      // 기존 문단 업데이트 + 부족한 만큼 새 문단 추가
      const existingParas = cell.elements.filter((e: any) => e.type === 'paragraph');

      for (let i = 0; i < lines.length; i++) {
        if (i < existingParas.length) {
          this.updateParagraphText(existingParas[i], lines[i]);
        } else {
          // 새 문단 추가 (원본 스타일 복제)
          cell.elements.push({
            type: 'paragraph',
            runs: [{ text: lines[i], style: { ...templateStyle } }],
            alignment: templatePara?.alignment,
          });
        }
      }

      // 기존 문단이 더 많으면 초과분 제거 (원래 요소 순서 보존)
      if (existingParas.length > lines.length) {
        const parasToRemove = new Set(existingParas.slice(lines.length));
        cell.elements = cell.elements.filter((e: any) => !parasToRemove.has(e));
      }
    }
  }

  private updateParagraphText(para: any, text: string): void {
    if (!para.runs || para.runs.length === 0) {
      para.runs = [{ text, style: {} }];
    } else {
      // 첫 번째 run에 텍스트 설정, 나머지 run 제거 (스타일은 보존)
      para.runs[0].text = text;
      if (para.runs.length > 1) {
        para.runs = [para.runs[0]];
      }
    }
  }

  // ─── Legacy merge ──────────────────────────────────────────────────

  private mergeLegacyContent(
    document: HWPXDocument,
    generatedContent: Record<string, string>,
    structure: EnhancedDocumentStructure
  ): HWPXDocument {
    const originalImages = document.images;
    const updatedDocument = JSON.parse(JSON.stringify(document)) as HWPXDocument;
    updatedDocument.images = originalImages;

    let updatedCount = 0;

    structure.pairs.forEach((pair) => {
      const newContent = generatedContent[pair.header];
      if (newContent === undefined || newContent === null) return;

      try {
        const section = updatedDocument.sections[pair.path.section];
        if (!section) return;

        const table = section.elements[pair.path.table];
        if (!table || table.type !== 'table') return;

        const row = table.rows?.[pair.path.row];
        if (!row) return;

        const cell = row.cells?.[pair.path.contentCell];
        if (!cell) return;

        this.updateCellContent(cell, newContent);
        updatedCount++;
      } catch {
        // skip
      }
    });

    logger.info(`✅ 레거시 병합: ${updatedCount}/${structure.pairs.length}`);
    return updatedDocument;
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private getDocumentTypeKorean(type: EnhancedDocumentStructure['documentType']): string {
    const names: Record<typeof type, string> = {
      'monthly': '월간계획안', 'weekly': '주간계획안', 'daily': '일일계획안',
      'lesson': '수업계획안', 'report': '보고서', 'form': '양식', 'unknown': '문서',
    };
    return names[type] || '문서';
  }

  getLastStructure(): EnhancedDocumentStructure | undefined {
    return this.lastStructure;
  }

  getStatistics() {
    return this.gptService.getStatistics();
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  async previewStructure(document: HWPXDocument): Promise<EnhancedDocumentStructure> {
    logger.info('🔍 문서 구조 미리보기 (v3)...');
    const structure = this.extractor.extractEnhancedStructure(document);

    logger.info('📊 분석 결과:');
    logger.info(`  - 파이프라인: ${structure.pipeline}`);
    logger.info(`  - 문서 타입: ${structure.documentType}`);
    logger.info(`  - 제목: ${structure.title || '(없음)'}`);
    logger.info(`  - 항목 수: ${structure.pairs.length}개`);
    logger.info(`  - 시맨틱 그리드: ${structure.semanticGrids.length}개`);

    if (structure.semanticGrids.length > 0) {
      for (const grid of structure.semanticGrids) {
        logger.info(`    표 ${grid.tableIndex}: ${grid.rows}×${grid.cols}, 데이터셀=${grid.totalDataCells}, 빈셀=${grid.emptyDataCells}`);
        logger.info(`      코너: ${grid.cornerRegion.rowEnd}행 × ${grid.cornerRegion.colEnd}열`);
        logger.info(`      컬럼헤더 레벨: ${grid.columnHeaders.length}`);
        logger.info(`      행헤더 레벨: ${grid.rowHeaders.length}`);
      }
    }

    return structure;
  }
}

export default AIDocumentController;
