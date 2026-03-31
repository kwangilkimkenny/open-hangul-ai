/**
 * AI Document Controller
 * 모든 AI 모듈을 통합하는 고수준 컨트롤러
 *
 * @module ai/ai-controller
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';
import { HWPXError, ErrorType } from '../utils/error.js';
import { AIConfig } from '../config/ai-config.js';
import { DocumentStructureExtractor } from './structure-extractor.js';
import { GPTContentGenerator } from './gpt-content-generator.js';
import { ContentMerger } from './content-merger.js';
import { HwpxSafeExporter } from '../export/hwpx-safe-exporter.js';
import { MultiPageAnalyzer } from './multi-page-analyzer.js';
import { SequentialPageGenerator } from './sequential-page-generator.js';
import { PromptBuilder } from './prompt-builder.js';
import { DocumentTypeDetector } from './document-type-detector.js';
import { ExternalDataFetcher } from '../api/external-data-fetcher.js';
import { pipelineLogger } from './pipeline-logger.js';

const logger = getLogger();

/**
 * AI 문서 컨트롤러 클래스
 * 전체 AI 워크플로우 관리: 추출 → 생성 → 병합 → 재렌더링
 *
 * @example
 * const controller = new AIDocumentController(viewer);
 * await controller.handleUserRequest('초등학생이 이해할 수 있게 바꿔줘');
 */
export class AIDocumentController {
  /**
   * AIDocumentController 생성자
   * @param {Object} viewer - HWPX Viewer 인스턴스
   * @param {Object} [options={}] - 컨트롤러 옵션
   */
  constructor(viewer, options = {}) {
    if (!viewer) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, 'Viewer 인스턴스가 필요합니다');
    }

    this.viewer = viewer;
    this.options = {
      autoRender: options.autoRender !== false,
      saveHistory: options.saveHistory !== false,
      ...options,
    };

    // AI 모듈 초기화 (API 키는 나중에 설정)
    this.extractor = new DocumentStructureExtractor();
    this.generator = null; // API 키 필요
    this.merger = new ContentMerger();
    this.exporter = new HwpxSafeExporter(); // 안전한 HWPX 내보내기
    this.dataFetcher = new ExternalDataFetcher(); // 외부 API 데이터 가져오기

    // 상태 관리
    this.state = {
      isProcessing: false,
      currentRequest: null,
      originalDocument: null,
      updatedDocument: null,
      extractedData: null,
      error: null,
    };

    // 변경 이력
    this.history = [];

    // 보안/검증 모듈 (lazy loading - OFF 시 번들 영향 zero)
    this.securityGateway = null;
    this.truthAnchorClient = null;
    this._initSecurityModules();

    // 프록시 모드 또는 환경변수 API 키로 자동 초기화
    try {
      if (typeof AIConfig.isProxyMode === 'function' && AIConfig.isProxyMode()) {
        this.generator = new GPTContentGenerator('proxy');
        logger.info('🔒 Proxy mode: generator auto-initialized');
      } else {
        const envKey = AIConfig.openai?.getApiKey?.();
        if (envKey) {
          this.generator = new GPTContentGenerator(envKey);
          logger.info('✅ API key loaded from environment');
        }
      }
    } catch (e) {
      // 자동 초기화 실패는 무시 (사용자가 나중에 수동 설정)
    }

    logger.info('🤖 AIDocumentController initialized');
  }

  /**
   * 보안/검증 모듈 초기화 (활성화된 경우에만 동적 import)
   * @private
   */
  async _initSecurityModules() {
    try {
      if (AIConfig.security?.aegis?.isEnabled()) {
        const m = await import('./security-gateway.js');
        this.securityGateway = new m.SecurityGateway();
        await this.securityGateway.ensureReady();
        logger.info('AEGIS SecurityGateway loaded');
      }
    } catch (e) {
      logger.warn('AEGIS load failed:', e.message);
      this.securityGateway = null;
    }

    try {
      if (AIConfig.security?.truthAnchor?.isEnabled()) {
        const m = await import('./truthanchor-client.js');
        this.truthAnchorClient = new m.TruthAnchorClient();
        await this.truthAnchorClient.checkHealth();
        logger.info('TruthAnchor client loaded');
      }
    } catch (e) {
      logger.warn('TruthAnchor load failed:', e.message);
      this.truthAnchorClient = null;
    }
  }

  /**
   * AEGIS 보안 토글
   * @param {boolean} enabled
   */
  async toggleAegis(enabled) {
    AIConfig.security.aegis.setEnabled(enabled);
    if (enabled && !this.securityGateway) {
      try {
        const m = await import('./security-gateway.js');
        this.securityGateway = new m.SecurityGateway();
        await this.securityGateway.ensureReady();
        logger.info('AEGIS enabled');
      } catch (e) {
        logger.error('AEGIS toggle failed:', e);
        this.securityGateway = null;
      }
    } else if (!enabled) {
      this.securityGateway = null;
      logger.info('AEGIS disabled');
    }
  }

  /**
   * TruthAnchor 할루시네이션 검증 토글
   * @param {boolean} enabled
   * @returns {Promise<{ available: boolean }>}
   */
  async toggleTruthAnchor(enabled) {
    AIConfig.security.truthAnchor.setEnabled(enabled);
    if (enabled && !this.truthAnchorClient) {
      try {
        const m = await import('./truthanchor-client.js');
        this.truthAnchorClient = new m.TruthAnchorClient();
        const health = await this.truthAnchorClient.checkHealth();
        logger.info('TruthAnchor enabled, server available:', health.available);
        return health;
      } catch (e) {
        logger.error('TruthAnchor toggle failed:', e);
        this.truthAnchorClient = null;
        return { available: false };
      }
    } else if (!enabled) {
      this.truthAnchorClient = null;
      logger.info('TruthAnchor disabled');
      return { available: false };
    }
    return { available: true };
  }

  /**
   * API 키 설정
   * @param {string} apiKey - OpenAI API 키
   */
  setApiKey(apiKey) {
    if (!apiKey) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, 'API 키가 유효하지 않습니다');
    }

    this.generator = new GPTContentGenerator(apiKey);
    AIConfig.openai.setApiKey(apiKey);
    logger.info('✅ API 키가 설정되었습니다');

    // 🆕 aiTextEditor의 gptGenerator 참조 업데이트 (v2.3.2)
    if (typeof window.updateAITextEditorGenerator === 'function') {
      window.updateAITextEditorGenerator();
    }
  }

  /**
   * API 키 확인
   * @returns {boolean} API 키 설정 여부
   */
  hasApiKey() {
    return this.generator !== null;
  }

  /**
   * 사용자 요청 처리 (메인 메서드)
   * @param {string} userMessage - 사용자 요청 메시지
   * @returns {Promise<Object>} 처리 결과
   *
   * @example
   * const result = await controller.handleUserRequest('쉽게 바꿔줘');
   * // Returns: { success: true, updatedDocument, metadata }
   */
  async handleUserRequest(userMessage, onProgress = null) {
    logger.info('🤖 Handling user request...');
    logger.time('AI Request Processing');
    pipelineLogger.startSession('edit', userMessage);

    // 동시 요청 방지
    if (this.state.isProcessing) {
      pipelineLogger.log('session', 'error', 'Concurrent request blocked');
      pipelineLogger.endSession('error', { reason: 'concurrent_request' });
      throw new HWPXError(
        ErrorType.VALIDATION_ERROR,
        '이미 요청을 처리 중입니다. 완료 후 다시 시도하세요.'
      );
    }

    // API 키 확인
    if (!this.hasApiKey()) {
      pipelineLogger.log('session', 'error', 'No API key');
      pipelineLogger.endSession('error', { reason: 'no_api_key' });
      throw new HWPXError(ErrorType.VALIDATION_ERROR, AIConfig.prompts.errorMessages.noApiKey);
    }

    // 상태 업데이트
    this.state.isProcessing = true;
    this.state.currentRequest = userMessage;
    this.state.error = null;

    // AEGIS Pre-LLM: PII 가명화 세션 ID
    let piiSessionId = null;

    try {
      // 0. AEGIS Pre-LLM: 입력 보안 스캔
      if (this.securityGateway?.isEnabled()) {
        await this.securityGateway.ensureReady();
        pipelineLogger.log('security', 'start', 'AEGIS input scan');
        const scanResult = this.securityGateway.scanInput(userMessage);
        if (!scanResult.allowed) {
          pipelineLogger.log('security', 'blocked', scanResult.reason);
          throw new HWPXError(
            ErrorType.VALIDATION_ERROR,
            AIConfig.prompts.errorMessages.aegisBlocked.replace('{REASON}', scanResult.reason)
          );
        }
        pipelineLogger.log('security', 'passed', `Score: ${scanResult.score}`);

        // PII 가명화 (사용자 메시지만, 문서 내용은 제외)
        const piiResult = this.securityGateway.pseudonymize(userMessage);
        if (piiResult.changed) {
          piiSessionId = piiResult.sessionId;
          userMessage = piiResult.pseudonymized;
          pipelineLogger.log('security', 'info', 'PII pseudonymized');
        }
      }

      // 1. 현재 문서 가져오기 (DOM 동기화 포함)
      pipelineLogger.log('extract', 'start', 'Syncing document from DOM');
      if (this.viewer._syncDocumentFromDOM) {
        this.viewer._syncDocumentFromDOM();
      }
      const currentDocument = this.viewer.getDocument();
      if (!currentDocument) {
        pipelineLogger.log('extract', 'error', 'No document loaded');
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다. 문서를 열거나 새 문서를 생성해주세요.');
      }

      this.state.originalDocument = currentDocument;
      const sectionCount = currentDocument.sections?.length || 0;
      pipelineLogger.log('extract', 'info', `Document loaded: ${sectionCount} sections`);

      // 2. 구조 추출 (구조화된 방식)
      logger.info('  📊 Step 1/4: Extracting table structure...');
      pipelineLogger.timeStart('structure_extraction');

      // 🔥 새로운 방식: 헤더-내용 쌍 추출
      const headerContentPairs = this.extractor.extractTableHeaderContentPairs(currentDocument);
      this.state.headerContentPairs = headerContentPairs;

      const extractDuration = pipelineLogger.timeEnd('structure_extraction', 'extract');
      pipelineLogger.log('extract', 'success', `Extracted ${headerContentPairs.length} header-content pairs`, {
        pairCount: headerContentPairs.length,
        headers: headerContentPairs.map(p => p.header),
        duration: extractDuration,
      });

      logger.info(`    ✓ Extracted ${headerContentPairs.length} header-content pairs`);

      // 모든 헤더 출력 (디버깅용)
      headerContentPairs.forEach(pair => {
        logger.info(
          `      📋 "${pair.header}" → "${pair.content ? pair.content.substring(0, 30) + '...' : '(비어있음)'}"`
        );
      });

      // 🆕 2.5. 부분 수정 감지 및 필터링
      let pairsToGenerate = headerContentPairs;
      let isPartialEdit = false;

      if (window.partialEditor) {
        const partialRequest = window.partialEditor.parsePartialRequest(userMessage);
        if (partialRequest) {
          isPartialEdit = true;
          pipelineLogger.log('extract', 'info', `Partial edit: ${partialRequest.targetItems.join(', ')}`);
          logger.info(`  ✏️ Partial edit detected: ${partialRequest.targetItems.join(', ')}`);
          pairsToGenerate = window.partialEditor.filterPairs(
            headerContentPairs,
            partialRequest.targetItems
          );
          logger.info(
            `    → Generating only ${pairsToGenerate.length}/${headerContentPairs.length} items`
          );
        }
      }

      // 3. GPT 콘텐츠 생성 (구조화된 방식)
      logger.info('  🤖 Step 2/4: Generating content with GPT (structured)...');
      pipelineLogger.log('generate', 'start', `Generating for ${pairsToGenerate.length} pairs`);
      pipelineLogger.timeStart('gpt_generation');

      let { content: generatedJSON, tokensUsed } = await this.generateStructuredContent(
        pairsToGenerate,
        userMessage,
        null,
        onProgress
      );

      // AEGIS Post-LLM: 출력 필터링 + PII 복원
      if (this.securityGateway?.isEnabled()) {
        const outputCheck = this.securityGateway.filterOutput(JSON.stringify(generatedJSON));
        if (!outputCheck.safe) {
          pipelineLogger.log('security', 'warning', `Output detections: ${outputCheck.detections.join(', ')}`);
          try { generatedJSON = JSON.parse(outputCheck.filtered); } catch (_) { /* 필터링 실패 시 원본 유지 */ }
        }
        // PII 복원: LLM은 가명화된 입력을 받았으므로 출력에도 가명이 포함됨 → 원본으로 복원
        if (piiSessionId) {
          for (const key of Object.keys(generatedJSON)) {
            if (typeof generatedJSON[key] === 'string') {
              generatedJSON[key] = this.securityGateway.restore(generatedJSON[key], piiSessionId);
            }
          }
          pipelineLogger.log('security', 'info', 'PII restored in output');
        }
      }

      const genDuration = pipelineLogger.timeEnd('gpt_generation', 'generate');
      const generatedKeys = Object.keys(generatedJSON);
      pipelineLogger.log('generate', 'success', `Generated ${generatedKeys.length} items`, {
        keys: generatedKeys,
        tokensUsed,
        duration: genDuration,
        isPartialEdit,
      });

      logger.info(`    ✓ Generated content for ${generatedKeys.length} items`);

      // 4. 콘텐츠 병합 (구조화된 방식)
      logger.info('  🔀 Step 3/4: Merging generated content...');
      pipelineLogger.log('merge', 'start', `Merging ${generatedKeys.length} items`);
      pipelineLogger.timeStart('content_merge');

      const mergeResult = this.mergeStructuredContent(
        currentDocument,
        generatedJSON,
        headerContentPairs
      );
      const updatedDocument = mergeResult.document;
      const actualUpdatedCount = mergeResult.updatedCount;

      const mergeDuration = pipelineLogger.timeEnd('content_merge', 'merge');
      pipelineLogger.log('merge', 'success', `Merged ${actualUpdatedCount}/${headerContentPairs.length}`, {
        updatedCount: actualUpdatedCount,
        totalPairs: headerContentPairs.length,
        generatedCount: generatedKeys.length,
        duration: mergeDuration,
        unmatchedKeys: generatedKeys.filter(k => !headerContentPairs.some(p => p.header === k)),
      });

      this.state.updatedDocument = updatedDocument;

      // 5. 재렌더링 (선택적)
      if (this.options.autoRender) {
        logger.info('  🎨 Step 4/4: Re-rendering document...');
        pipelineLogger.log('render', 'start', 'Re-rendering document');
        pipelineLogger.timeStart('render');
        // 🔥 중요: updateDocument()를 사용하여 상태와 렌더링을 원자적으로 수행
        await this.viewer.updateDocument(updatedDocument);
        pipelineLogger.timeEnd('render', 'render');
        pipelineLogger.log('render', 'success', 'Document re-rendered');
      }

      // 6. 이력 저장 (선택적)
      if (this.options.saveHistory) {
        this.saveToHistory({
          request: userMessage,
          original: currentDocument,
          updated: updatedDocument,
          metadata: {
            timestamp: new Date().toISOString(),
            itemsUpdated: actualUpdatedCount,
            tokensUsed: tokensUsed,
          },
        });
      }

      // TruthAnchor: 할루시네이션 검증 (비차단 - 결과만 반환)
      let validationResult = null;
      if (this.truthAnchorClient?.isEnabled()) {
        pipelineLogger.log('validation', 'start', 'TruthAnchor validation');
        const sourceText = headerContentPairs.map(p => `${p.header}: ${p.content}`).join('\n');
        const llmOutput = Object.entries(generatedJSON).map(([k, v]) => `${k}: ${v}`).join('\n');
        validationResult = await this.truthAnchorClient.validate(sourceText, llmOutput);
        if (validationResult.available) {
          pipelineLogger.log('validation', 'complete',
            `Score: ${validationResult.overallScore}, Claims: ${validationResult.totalClaims}, Contradicted: ${validationResult.contradictedClaims}`);
        } else {
          pipelineLogger.log('validation', 'warning', 'TruthAnchor unavailable: ' + (validationResult.error || ''));
        }
      }

      // 결과 객체
      const result = {
        success: true,
        updatedDocument: updatedDocument,
        validation: validationResult,
        metadata: {
          request: userMessage,
          itemsUpdated: actualUpdatedCount,
          itemsGenerated: generatedKeys.length,
          tokensUsed: tokensUsed,
          processingTime: Date.now() - (this.state.processingStartTime || Date.now()),
        },
      };

      logger.timeEnd('AI Request Processing');
      logger.info('✅ Request processed successfully');

      pipelineLogger.endSession('success', {
        itemsUpdated: actualUpdatedCount,
        itemsGenerated: generatedKeys.length,
        tokensUsed,
        isPartialEdit,
      });

      return result;
    } catch (error) {
      this.state.error = error;
      logger.error('❌ Request processing failed:', error);
      logger.timeEnd('AI Request Processing');
      pipelineLogger.log('session', 'error', error.message, { stack: error.stack?.substring(0, 300) });
      pipelineLogger.endSession('error', { error: error.message });
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.state.currentRequest = null;
    }
  }

  /**
   * 변경 미리보기 (렌더링 없이 변경 사항만 확인)
   * @param {string} userMessage - 사용자 요청 메시지
   * @returns {Promise<Object>} 미리보기 결과
   *
   * @example
   * const preview = await controller.previewChanges('쉽게 바꿔줘');
   * console.log('변경될 슬롯:', preview.updatedSlots.length);
   */
  async previewChanges(userMessage) {
    logger.info('👁️  Previewing changes...');

    // 임시로 autoRender를 false로 설정
    const originalAutoRender = this.options.autoRender;
    this.options.autoRender = false;

    try {
      const result = await this.handleUserRequest(userMessage);

      // 변경 사항 요약
      const preview = {
        updatedSlots: result.metadata.slotsUpdated,
        tokensUsed: result.metadata.tokensUsed,
        changes: this.summarizeChanges(this.state.originalDocument, result.updatedDocument),
      };

      return preview;
    } finally {
      this.options.autoRender = originalAutoRender;
    }
  }

  /**
   * 변경 사항 적용
   * previewChanges 후 사용자가 승인하면 실제 적용
   * @returns {Promise<void>}
   */
  async applyChanges() {
    if (!this.state.updatedDocument) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, '적용할 변경 사항이 없습니다');
    }

    logger.info('✅ Applying changes...');

    // 🔥 updateDocument()를 사용하여 상태와 렌더링을 원자적으로 수행
    await this.viewer.updateDocument(this.state.updatedDocument);

    logger.info('✅ Changes applied successfully');
  }

  /**
   * 변경 사항 취소 (원본으로 되돌리기)
   * @returns {Promise<void>}
   */
  async revertChanges() {
    if (!this.state.originalDocument) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, '되돌릴 원본 문서가 없습니다');
    }

    logger.info('🔙 Reverting changes...');

    // 🔥 updateDocument()를 사용하여 상태와 렌더링을 원자적으로 수행
    await this.viewer.updateDocument(this.state.originalDocument);

    this.state.updatedDocument = null;

    logger.info('✅ Changes reverted successfully');
  }

  /**
   * 변경 사항 요약
   * @param {Object} original - 원본 문서
   * @param {Object} updated - 업데이트된 문서
   * @returns {Object} 변경 사항 요약
   * @private
   */
  summarizeChanges(original, updated) {
    // 간단한 요약 생성
    return {
      sectionsChanged: 0, // 실제로는 비교 필요
      elementsChanged: 0,
      totalChanges: this.state.extractedData?.textSlots.size || 0,
    };
  }

  /**
   * 이력 저장
   * @param {Object} entry - 이력 항목
   * @private
   */
  saveToHistory(entry) {
    this.history.push(entry);

    // 최대 크기 제한
    const maxSize = this.merger.options.maxHistorySize;
    if (this.history.length > maxSize) {
      this.history.shift();
    }
  }

  /**
   * 변경 이력 조회
   * @param {number} [count=10] - 조회할 개수
   * @returns {Array} 이력 배열
   */
  getHistory(count = 10) {
    return this.history.slice(-count).map(entry => ({
      request: entry.request,
      timestamp: entry.metadata.timestamp,
      slotsUpdated: entry.metadata.slotsUpdated,
      tokensUsed: entry.metadata.tokensUsed,
    }));
  }

  /**
   * 이력 클리어
   */
  clearHistory() {
    this.history = [];
    logger.info('🗑️  History cleared');
  }

  /**
   * 현재 상태 조회
   * @returns {Object} 상태 객체
   */
  getState() {
    return {
      isProcessing: this.state.isProcessing,
      hasApiKey: this.hasApiKey(),
      hasDocument: this.viewer.getDocument() !== null,
      currentRequest: this.state.currentRequest,
      error: this.state.error
        ? {
            type: this.state.error.type,
            message: this.state.error.message,
          }
        : null,
    };
  }

  /**
   * 통계 조회 (모든 모듈의 통계 통합)
   * @returns {Object} 통합 통계
   */
  getStatistics() {
    return {
      extractor: this.extractor.getStatistics(),
      generator: this.generator ? this.generator.getStatistics() : null,
      merger: this.merger.getStatistics(),
      history: {
        totalEntries: this.history.length,
      },
    };
  }

  /**
   * 구조화된 콘텐츠 생성 (헤더-내용 쌍 기반)
   * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍
   * @param {string} userRequest - 사용자 요청
   * @returns {Promise<Object>} 생성된 JSON 객체와 메타데이터 { content: Object, tokensUsed: number }
   * @private
   */
  async generateStructuredContent(headerContentPairs, userRequest, promptBuilderFn = null, onProgress = null) {
    const pairCount = headerContentPairs?.length || 0;

    // ═══════════════════════════════════════════════
    // 분할 생성: 항목이 많으면 배치로 나눠서 호출
    // ═══════════════════════════════════════════════
    const BATCH_THRESHOLD = 15; // 15개 이상이면 분할

    if (pairCount > BATCH_THRESHOLD && !promptBuilderFn) {
      return await this._generateInBatches(headerContentPairs, userRequest, onProgress);
    }

    // ═══════════════════════════════════════════════
    // 단일 배치 생성 (기존 로직)
    // ═══════════════════════════════════════════════
    onProgress?.({ phase: 'generating', percent: 0, completed: 0, total: pairCount, message: `${pairCount}개 항목 생성 중...` });
    const result = await this._generateSingleBatch(headerContentPairs, userRequest, promptBuilderFn);
    onProgress?.({ phase: 'complete', percent: 100, completed: pairCount, total: pairCount, message: '생성 완료' });
    return result;
  }

  /**
   * 분할 배치 생성 — 타임아웃 방지 + 중간 저장 + 진행률 콜백
   * @param {Array} headerContentPairs
   * @param {string} userRequest
   * @param {Function|null} onProgress - (progress) => void
   * @private
   */
  async _generateInBatches(headerContentPairs, userRequest, onProgress = null) {
    const BATCH_SIZE = 12;
    const batches = [];

    for (let i = 0; i < headerContentPairs.length; i += BATCH_SIZE) {
      batches.push(headerContentPairs.slice(i, i + BATCH_SIZE));
    }

    const totalItems = headerContentPairs.length;
    logger.info(`📦 분할 생성: ${totalItems}항목 → ${batches.length}배치 (배치당 ~${BATCH_SIZE}항목)`);

    const mergedJSON = {};
    let totalTokens = 0;
    let completedItems = 0;

    const report = (message) => {
      const percent = totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0;
      onProgress?.({
        phase: 'generating',
        percent,
        completed: completedItems,
        total: totalItems,
        batch: `${Object.keys(mergedJSON).length}/${totalItems}`,
        message,
      });
    };

    report(`${batches.length}개 배치로 분할 생성 시작...`);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const batchLabel = `[${batchIdx + 1}/${batches.length}]`;

      report(`배치 ${batchLabel} 처리 중... (${batch.length}항목)`);
      logger.info(`  🔄 배치 ${batchLabel}: ${batch.length}항목 처리 중...`);

      try {
        const contextHint = Object.keys(mergedJSON).length > 0
          ? `\n\n(이미 생성된 항목 참고: ${Object.keys(mergedJSON).slice(-3).map(k => `"${k}"`).join(', ')} 등 ${Object.keys(mergedJSON).length}개)`
          : '';

        const batchMaxTokens = Math.min(Math.max(800, batch.length * 120), 4000);
        const savedMaxTokens = this.generator.options.maxTokens;
        const savedTimeout = this.generator.options.timeout;
        this.generator.options.maxTokens = batchMaxTokens;
        this.generator.options.timeout = Math.min(90000 + batch.length * 5000, 180000);

        const { content: batchJSON, tokensUsed } = await this._generateSingleBatch(
          batch,
          userRequest + contextHint,
          null
        );

        this.generator.options.maxTokens = savedMaxTokens;
        this.generator.options.timeout = savedTimeout;

        Object.assign(mergedJSON, batchJSON);
        totalTokens += tokensUsed;
        completedItems += Object.keys(batchJSON).length;

        logger.info(`  ✅ 배치 ${batchLabel} 완료: ${Object.keys(batchJSON).length}항목 (${tokensUsed}토큰)`);
        report(`배치 ${batchLabel} 완료 — ${completedItems}/${totalItems}항목`);

      } catch (error) {
        logger.error(`  ❌ 배치 ${batchLabel} 실패:`, error.message);
        report(`배치 ${batchLabel} 실패, 분할 재시도 중...`);

        if (batch.length > 3) {
          const mid = Math.ceil(batch.length / 2);
          const halves = [batch.slice(0, mid), batch.slice(mid)];

          for (let hi = 0; hi < halves.length; hi++) {
            const halfBatch = halves[hi];
            try {
              report(`분할 재시도 ${hi + 1}/2 (${halfBatch.length}항목)...`);

              const savedMaxTokens2 = this.generator.options.maxTokens;
              const savedTimeout2 = this.generator.options.timeout;
              this.generator.options.maxTokens = Math.min(Math.max(600, halfBatch.length * 120), 3000);
              this.generator.options.timeout = Math.min(60000 + halfBatch.length * 5000, 120000);

              const { content: halfJSON, tokensUsed: halfTokens } = await this._generateSingleBatch(
                halfBatch, userRequest, null
              );

              this.generator.options.maxTokens = savedMaxTokens2;
              this.generator.options.timeout = savedTimeout2;

              Object.assign(mergedJSON, halfJSON);
              totalTokens += halfTokens;
              completedItems += Object.keys(halfJSON).length;
              report(`분할 재시도 성공 — ${completedItems}/${totalItems}항목`);
            } catch (retryError) {
              logger.error(`     ❌ 분할 재시도 실패:`, retryError.message);
            }
          }
        }
      }
    }

    report(`생성 완료: ${completedItems}/${totalItems}항목`);
    logger.info(`📦 분할 생성 완료: ${Object.keys(mergedJSON).length}/${totalItems}항목, ${totalTokens}토큰`);

    onProgress?.({
      phase: 'complete',
      percent: 100,
      completed: completedItems,
      total: totalItems,
      message: `생성 완료: ${completedItems}개 항목`,
    });

    return { content: mergedJSON, tokensUsed: totalTokens };
  }

  /**
   * 단일 배치 API 호출
   * @private
   */
  async _generateSingleBatch(headerContentPairs, userRequest, promptBuilderFn = null) {
    const promptBuilder = new PromptBuilder();

    const messages = promptBuilderFn
      ? promptBuilderFn(promptBuilder, headerContentPairs, userRequest)
      : promptBuilder.buildStructuredPrompt(headerContentPairs, userRequest);

    // GPT API 호출 (재시도 포함)
    const response = await this.generator.callAPIWithRetry(messages);

    // 토큰 사용량 추출
    const tokensUsed = response.usage?.total_tokens || 0;

    // JSON 파싱
    try {
      let jsonText = '';

      if (response.choices && response.choices[0] && response.choices[0].message) {
        jsonText = response.choices[0].message.content.trim();
      } else if (response.content) {
        jsonText = response.content.trim();
      } else {
        throw new Error('응답에서 content를 찾을 수 없습니다');
      }

      logger.debug('📥 Raw GPT response:', jsonText.substring(0, 200) + '...');

      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/{[\s\S]*}/);
      let jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : jsonText;

      // finish_reason: "length"인 경우 잘린 JSON 복구
      const finishReason = response.choices?.[0]?.finish_reason;
      if (finishReason === 'length') {
        logger.warn('GPT 응답이 토큰 한도로 잘렸습니다. 불완전 JSON 복구 시도...');
        jsonStr = this._repairTruncatedJSON(jsonStr);
      }

      const generatedJSON = JSON.parse(jsonStr);

      logger.info(
        `✅ Generated JSON with ${Object.keys(generatedJSON).length} keys (${tokensUsed} tokens used)`
      );

      return { content: generatedJSON, tokensUsed };
    } catch (error) {
      logger.error('❌ Failed to parse JSON response:', error);
      throw new HWPXError(
        ErrorType.VALIDATION_ERROR,
        'GPT 응답을 JSON으로 파싱할 수 없습니다. 응답: ' +
          (response.choices?.[0]?.message?.content?.substring(0, 200) || 'undefined')
      );
    }
  }

  /**
   * 잘린 JSON 문자열을 복구 (finish_reason: "length" 대응)
   * 마지막 완성된 키-값 쌍까지만 유지하고 JSON을 닫음
   * @param {string} jsonStr - 잘린 JSON
   * @returns {string} 복구된 JSON
   * @private
   */
  _repairTruncatedJSON(jsonStr) {
    // 마지막 완성된 "key": "value" 쌍을 찾음
    const lastCompleteEntry = jsonStr.lastIndexOf('",');
    if (lastCompleteEntry > 0) {
      // 마지막 완성된 엔트리까지 자르고 } 로 닫음
      const repaired = jsonStr.substring(0, lastCompleteEntry + 1) + '\n}';
      logger.info(`JSON 복구: ${jsonStr.length}자 → ${repaired.length}자 (잘린 끝부분 제거)`);
      return repaired;
    }
    // ", 를 찾지 못한 경우: 마지막 " 뒤에 } 추가
    const lastQuote = jsonStr.lastIndexOf('"');
    if (lastQuote > 0) {
      return jsonStr.substring(0, lastQuote + 1) + '\n}';
    }
    return jsonStr;
  }

  /**
   * 구조화된 콘텐츠 병합 (헤더-내용 쌍 기반)
   * @param {Object} document - 원본 문서
   * @param {Object} generatedJSON - 생성된 JSON 객체
   * @param {Array<Object>} headerContentPairs - 헤더-내용 쌍
   * @returns {Object} 업데이트된 문서
   * @private
   */
  mergeStructuredContent(document, generatedJSON, headerContentPairs) {
    // 문서 딥 복사 (Map, Blob URL 등 non-serializable 속성 보존)
    const updatedDocument = JSON.parse(JSON.stringify(document));

    // 🔥 Map 타입 복원: JSON.parse(JSON.stringify())는 Map을 {}로 변환하므로 원본 참조를 복원
    if (document.images instanceof Map) {
      updatedDocument.images = document.images;
    }
    // borderFills, charProperties 등 기타 Map 속성 복원
    if (document.borderFills instanceof Map) {
      updatedDocument.borderFills = document.borderFills;
    }
    if (document.charProperties instanceof Map) {
      updatedDocument.charProperties = document.charProperties;
    }
    if (document.paraProperties instanceof Map) {
      updatedDocument.paraProperties = document.paraProperties;
    }

    let updatedCount = 0;

    logger.info(`🔀 Merging ${Object.keys(generatedJSON).length} items into document...`);

    // 생성된 JSON 키 출력 (디버깅)
    logger.debug('Generated JSON keys:', Object.keys(generatedJSON));

    // 각 헤더-내용 쌍에 대해 처리
    headerContentPairs.forEach((pair, idx) => {
      const newContent = generatedJSON[pair.header];

      logger.debug(
        `[${idx}] Processing "${pair.header}" → "${newContent ? newContent.substring(0, 30) + '...' : 'undefined'}"`
      );

      if (newContent) {
        try {
          const section = updatedDocument.sections[pair.path.section];
          if (!section) {
            logger.error(`  ❌ Section ${pair.path.section} not found`);
            return;
          }

          // 단락(paragraph) 타입 처리
          if (pair.path.type === 'paragraph') {
            const element = section.elements[pair.path.element];
            if (!element) {
              logger.error(`  ❌ Element ${pair.path.element} not found`);
              return;
            }

            if (!element.runs || element.runs.length === 0) {
              element.runs = [{ text: newContent, style: {} }];
            } else {
              // 기존 runs의 텍스트를 모두 합쳐서 첫 번째 run에 새 내용으로 교체
              const firstRunStyle = element.runs[0].style || {};
              element.runs = [{ text: newContent, style: firstRunStyle }];
            }

            updatedCount++;
            logger.info(`  ✓ Updated paragraph "${pair.header}": "${newContent.substring(0, 30)}..."`);
            return;
          }

          // 테이블 셀 타입 처리
          const table = section.elements[pair.path.table];
          if (!table) {
            logger.error(`  ❌ Table ${pair.path.table} not found`);
            return;
          }

          const row = table.rows[pair.path.row];
          if (!row) {
            logger.error(`  ❌ Row ${pair.path.row} not found`);
            return;
          }

          const cell = row.cells[pair.path.contentCell];
          if (!cell) {
            logger.error(`  ❌ Cell ${pair.path.contentCell} not found`);
            return;
          }

          // 셀 내용 전체 업데이트 (다중 paragraph 지원)
          const firstStyle = cell.elements?.[0]?.runs?.[0]?.style || {};
          const contentLines = newContent.split('\n').filter(l => l.trim());

          if (contentLines.length <= 1) {
            // 단일 줄: 첫 paragraph만 업데이트, 나머지 제거
            cell.elements = [{
              type: 'paragraph',
              runs: [{ text: newContent, style: { ...firstStyle } }],
            }];
          } else {
            // 다중 줄: 각 줄을 별도 paragraph로
            cell.elements = contentLines.map(line => ({
              type: 'paragraph',
              runs: [{ text: line, style: { ...firstStyle } }],
            }));
          }

          updatedCount++;
          logger.info(`  ✓ Updated "${pair.header}": "${newContent.substring(0, 30)}..."`);
        } catch (error) {
          logger.error(`  ❌ Error updating "${pair.header}":`, error);
        }
      } else {
        logger.warn(`  ⚠️  No content generated for "${pair.header}"`);
      }
    });

    logger.info(`✅ Updated ${updatedCount} / ${headerContentPairs.length} items`);

    return { document: updatedDocument, updatedCount };
  }

  /**
   * 모든 통계 리셋
   */
  resetStatistics() {
    this.extractor.getStatistics &&
      this.extractor.resetStatistics &&
      this.extractor.resetStatistics();
    this.generator && this.generator.resetStatistics && this.generator.resetStatistics();
    this.merger.resetStatistics && this.merger.resetStatistics();
    logger.info('📊 All statistics reset');
  }

  /**
   * 현재 문서를 HWPX 파일로 저장 (안전한 방식)
   * @param {string} filename - 저장할 파일명 (기본값: 'document.hwpx')
   * @returns {Promise<void>}
   */
  /**
   * 다중 페이지 요청 처리
   * @param {string} userMessage - 사용자 요청 메시지
   * @returns {Promise<Object>} 처리 결과
   */
  async handleMultiPageRequest(userMessage) {
    logger.info('📄 Handling multi-page request...');
    logger.time('Multi-Page Processing');

    try {
      const currentDocument = this.viewer.getDocument();

      if (!currentDocument || !currentDocument.sections) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다');
      }

      // 1. 다중 페이지 분석
      logger.info('  📊 Step 1/5: Analyzing document structure...');
      const multiPageAnalyzer = new MultiPageAnalyzer();
      const analysis = multiPageAnalyzer.analyzeDocument(currentDocument);

      // 분석 결과 출력
      logger.info(multiPageAnalyzer.summarizeAnalysis(analysis));

      // 2. 각 페이지 데이터 추출
      logger.info('  📋 Step 2/5: Extracting page data...');
      const allPagesData = [];

      for (let i = 0; i < currentDocument.sections.length; i++) {
        const section = currentDocument.sections[i];
        // 섹션을 문서 형태로 감싸서 extractTableHeaderContentPairs 호출
        const wrappedDoc = { sections: [section] };
        const pairs = this.extractor.extractTableHeaderContentPairs(wrappedDoc);
        // path.section을 0으로 보정 (감싼 문서 기준)
        pairs.forEach(p => { p.path.section = 0; });
        allPagesData.push(pairs);
        logger.debug(`    Page ${i + 1}: ${pairs.length} items extracted`);
      }

      // 3. 생성 전략에 따라 처리
      logger.info('  🤖 Step 3/5: Generating content...');

      let results;
      if (analysis.strategy === 'sequential' || analysis.strategy === 'semi-sequential') {
        // 순차 생성 (페이지 간 관계 고려)
        logger.info('     → Sequential generation (pages are related)');
        const promptBuilder = new PromptBuilder();
        const sequentialGenerator = new SequentialPageGenerator(this.generator, promptBuilder);
        results = await sequentialGenerator.generatePageByPage(analysis, allPagesData, userMessage);

        // 통계 출력
        const stats = sequentialGenerator.getGenerationStats(results);
        logger.info(`\n📊 Generation Statistics:`);
        logger.info(`  Total: ${stats.total} pages`);
        logger.info(`  Successful: ${stats.successful} pages`);
        logger.info(`  Failed: ${stats.failed} pages`);
        logger.info(`  Avg contexts used: ${stats.avgContextsUsed}`);
      } else {
        // 병렬 생성 (독립적인 페이지들)
        logger.info('     → Parallel generation (pages are independent)');
        results = await this.generatePagesInParallel(analysis, allPagesData, userMessage);
      }

      // 4. 결과 병합
      logger.info('  🔀 Step 4/5: Merging results...');
      const updatedDocument = this.mergeMultiPageResults(currentDocument, results, allPagesData);

      this.state.updatedDocument = updatedDocument;

      // 5. 재렌더링
      if (this.options.autoRender) {
        logger.info('  🎨 Step 5/5: Re-rendering document...');
        await this.viewer.updateDocument(updatedDocument);
      }

      logger.timeEnd('Multi-Page Processing');
      logger.info('✅ Multi-page request completed!');

      return {
        success: true,
        analysis,
        results,
        totalPages: analysis.totalPages,
        strategy: analysis.strategy,
      };
    } catch (error) {
      logger.timeEnd('Multi-Page Processing');
      logger.error('❌ Multi-page request failed:', error);

      this.state.error = error;

      throw new HWPXError(ErrorType.AI_ERROR, `다중 페이지 처리 실패: ${error.message}`, error);
    }
  }

  /**
   * 병렬 페이지 생성
   * @private
   */
  async generatePagesInParallel(analysis, allPagesData, userRequest) {
    logger.info('     Generating all pages in parallel...');

    const promises = allPagesData.map(async (pageData, i) => {
      const pageAnalysis = analysis.pages[i];

      logger.debug(`       → Starting page ${i + 1} generation...`);

      try {
        // 구조화된 방식으로 생성
        const { content: generatedJSON, tokensUsed } = await this.generateStructuredContent(
          pageData,
          userRequest + `\n(페이지 ${i + 1}: ${pageAnalysis.type} - ${pageAnalysis.role})`
        );

        logger.debug(`       ✅ Page ${i + 1} completed (${tokensUsed} tokens)`);

        return {
          pageNumber: i + 1,
          content: generatedJSON,
          analysis: pageAnalysis,
          tokensUsed: tokensUsed,
        };
      } catch (error) {
        logger.error(`       ❌ Page ${i + 1} failed:`, error.message);

        return {
          pageNumber: i + 1,
          content: null,
          analysis: pageAnalysis,
          error: error.message,
          tokensUsed: 0,
        };
      }
    });

    const results = await Promise.all(promises);

    const successCount = results.filter(r => r.content !== null).length;
    logger.info(`     ✅ Parallel generation: ${successCount}/${results.length} successful`);

    return results;
  }

  /**
   * 다중 페이지 결과 병합
   * @private
   */
  mergeMultiPageResults(originalDocument, results, allPagesData) {
    logger.debug('  🔀 Merging multi-page results...');

    const updatedDocument = JSON.parse(JSON.stringify(originalDocument));

    results.forEach((result, pageIndex) => {
      if (result.content && updatedDocument.sections[pageIndex]) {
        // 각 페이지별로 병합
        const pageData = allPagesData[pageIndex];
        const section = updatedDocument.sections[pageIndex];

        // 구조화된 콘텐츠 병합
        const mergeResult = this.mergeStructuredContent(
          { sections: [section] },
          result.content,
          pageData
        );

        // 업데이트된 섹션 적용
        if (mergeResult.document?.sections?.[0]) {
          updatedDocument.sections[pageIndex] = mergeResult.document.sections[0];
          logger.debug(`    ✓ Page ${pageIndex + 1} merged (${mergeResult.updatedCount} items)`);
        }
      } else if (result.error) {
        logger.warn(`    ⚠️ Page ${pageIndex + 1} skipped (generation failed)`);
      }
    });

    logger.info(`  ✅ Merged ${results.filter(r => r.content !== null).length} pages`);

    return updatedDocument;
  }

  async saveAsHwpx(filename = 'document.hwpx') {
    try {
      logger.info('💾 HWPX 파일 저장 시작...');
      logger.time('Save HWPX');

      // 원본 HWPX 파일 가져오기
      const originalFile = this.viewer.state.currentFile;

      if (!originalFile) {
        throw new HWPXError(
          ErrorType.VALIDATION_ERROR,
          '원본 HWPX 파일이 없습니다. 먼저 파일을 로드해주세요.'
        );
      }

      // ✅ v2.1.3: 항상 viewer.getDocument() 사용 (수동 편집 반영)
      // viewer.saveFile()에서 _syncDocumentFromDOM()이 viewer.state.document를 업데이트하므로,
      // this.state.updatedDocument 대신 viewer.getDocument()를 사용해야 수동 편집 내용이 저장됨
      const document = this.viewer.getDocument();

      // 디버그 로깅
      logger.info(`  📄 Document source: viewer.getDocument() (수동 편집 반영)`);
      if (this.state.updatedDocument) {
        logger.info(`  ⚠️ AI updatedDocument exists but NOT used - prioritizing manual edits`);
        // AI 변경 후 수동 편집이 있었으므로 updatedDocument 초기화
        this.state.updatedDocument = null;
      }

      if (!document) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '저장할 문서가 없습니다');
      }

      // 안전한 HWPX 파일 내보내기 (원본 기반으로 수정된 부분만 교체)
      await this.exporter.exportModifiedHwpx(originalFile, document, filename);

      logger.timeEnd('Save HWPX');
      logger.info('✅ HWPX 파일 저장 완료!');

      return {
        success: true,
        filename: filename,
        message: 'HWPX 파일이 성공적으로 저장되었습니다',
      };
    } catch (error) {
      logger.error('❌ HWPX 파일 저장 실패:', error);
      throw new HWPXError(ErrorType.EXPORT_ERROR, 'HWPX 파일 저장에 실패했습니다', error);
    }
  }

  /**
   * 업데이트된 문서가 있는지 확인
   * @returns {boolean} 업데이트된 문서 존재 여부
   */
  hasUpdatedDocument() {
    return this.state.updatedDocument !== null;
  }

  /**
   * 현재 문서 상태 가져오기
   * @returns {Object} 현재 문서 (업데이트된 문서 또는 원본 문서)
   */
  getCurrentDocument() {
    return this.state.updatedDocument || this.viewer.getDocument();
  }

  /**
   * 🆕 셀 선택 데이터를 포함한 사용자 요청 처리
   * @param {string} userMessage - 사용자 요청 메시지
   * @param {Object} cellSelectionData - 셀 선택 데이터
   * @returns {Promise<Object>} 처리 결과
   */
  async handleUserRequestWithCellSelection(userMessage, cellSelectionData) {
    logger.info('🎯 Processing request with cell selection data...');
    logger.time('Cell Selection AI Processing');

    // 동시 요청 방지
    if (this.state.isProcessing) {
      throw new HWPXError(
        ErrorType.VALIDATION_ERROR,
        '이미 요청을 처리 중입니다. 완료 후 다시 시도하세요.'
      );
    }

    // API 키 확인
    if (!this.hasApiKey()) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, 'API 키가 설정되지 않았습니다.');
    }

    this.state.isProcessing = true;
    this.state.currentRequest = userMessage;
    this.state.error = null;

    try {
      const currentDocument = this.viewer.getDocument();
      if (!currentDocument) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다');
      }

      this.state.originalDocument = currentDocument;

      // 셀 선택 데이터를 기반으로 헤더-내용 쌍 필터링
      const { keepCells, editCells, generateCells, autoCells } = cellSelectionData;

      logger.info(
        `📊 Cell Selection: Keep=${keepCells.length}, Edit=${editCells.length}, Generate=${generateCells.length}, Auto=${autoCells.length}`
      );

      // 생성/수정할 셀만 추출
      const pairsToProcess = [];

      // Edit 모드 셀: 기존 내용 포함
      editCells.forEach(cell => {
        pairsToProcess.push({
          header: cell.header || cell.id,
          content: cell.content,
          path: cell.path,
          mode: 'edit',
        });
      });

      // Generate 모드 셀: 빈 내용
      generateCells.forEach(cell => {
        pairsToProcess.push({
          header: cell.header || cell.id,
          content: '', // 새로 생성
          path: cell.path,
          mode: 'generate',
        });
      });

      // Auto 모드 셀: 기존 로직 따름 (첫 행/열은 유지, 나머지는 생성)
      autoCells.forEach(cell => {
        // 내용이 비어있거나 짧으면 생성, 아니면 수정
        const hasContent = cell.content && cell.content.trim().length > 5;
        pairsToProcess.push({
          header: cell.header || cell.id,
          content: cell.content,
          path: cell.path,
          mode: hasContent ? 'edit' : 'generate',
        });
      });

      if (pairsToProcess.length === 0) {
        throw new HWPXError(
          ErrorType.VALIDATION_ERROR,
          '생성하거나 수정할 셀이 없습니다. 셀 선택을 확인해주세요.'
        );
      }

      logger.info(`📝 Processing ${pairsToProcess.length} cells with cell selection...`);

      // 프롬프트에 셀 선택 정보 포함
      const enhancedMessage = this._buildCellSelectionPrompt(
        userMessage,
        pairsToProcess,
        keepCells
      );

      // GPT 콘텐츠 생성
      logger.info('  🤖 Generating content with GPT (cell selection mode)...');
      const { content: generatedJSON, tokensUsed } = await this.generateStructuredContent(
        pairsToProcess,
        enhancedMessage
      );

      logger.info(`    ✓ Generated content for ${Object.keys(generatedJSON).length} items`);

      // 콘텐츠 병합 (Keep 셀 제외)
      logger.info('  🔀 Merging generated content (excluding Keep cells)...');
      const updatedDocument = this._mergeWithCellSelection(
        currentDocument,
        generatedJSON,
        pairsToProcess,
        keepCells
      );

      this.state.updatedDocument = updatedDocument;

      // 재렌더링
      if (this.options.autoRender) {
        logger.info('  🎨 Re-rendering document...');
        await this.viewer.updateDocument(updatedDocument);
      }

      const result = {
        success: true,
        updatedDocument: updatedDocument,
        metadata: {
          request: userMessage,
          itemsUpdated: Object.keys(generatedJSON).length,
          keepCount: keepCells.length,
          editCount: editCells.length,
          generateCount: generateCells.length,
          tokensUsed: tokensUsed,
        },
      };

      logger.timeEnd('Cell Selection AI Processing');
      logger.info('✅ Cell selection request processed successfully');

      return result;
    } catch (error) {
      this.state.error = error;
      logger.error('❌ Cell selection request failed:', error);
      logger.timeEnd('Cell Selection AI Processing');
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.state.currentRequest = null;
    }
  }

  /**
   * 셀 선택 프롬프트 빌드
   * @private
   */
  _buildCellSelectionPrompt(userMessage, pairsToProcess, keepCells) {
    let prompt = userMessage + '\n\n';

    prompt += '📋 셀 선택 정보:\n';

    // 유지할 셀 목록 (참고용)
    if (keepCells.length > 0) {
      prompt += '\n🔒 유지할 셀 (변경하지 마세요):\n';
      keepCells.slice(0, 10).forEach(cell => {
        prompt += `  - ${cell.header || cell.id}: "${(cell.content || '').substring(0, 30)}..."\n`;
      });
      if (keepCells.length > 10) {
        prompt += `  ... 외 ${keepCells.length - 10}개\n`;
      }
    }

    // 생성/수정할 셀
    const editCells = pairsToProcess.filter(p => p.mode === 'edit');
    const genCells = pairsToProcess.filter(p => p.mode === 'generate');

    if (editCells.length > 0) {
      prompt += '\n✏️ 수정할 셀 (기존 내용을 참고하여 수정):\n';
      editCells.forEach(cell => {
        prompt += `  - ${cell.header}: "${(cell.content || '').substring(0, 50)}..."\n`;
      });
    }

    if (genCells.length > 0) {
      prompt += '\n✨ 새로 생성할 셀 (적절한 내용 생성):\n';
      genCells.forEach(cell => {
        prompt += `  - ${cell.header}\n`;
      });
    }

    return prompt;
  }

  /**
   * 셀 선택 기반 병합
   * @private
   */
  _mergeWithCellSelection(document, generatedJSON, pairsToProcess, keepCells) {
    // 문서 딥 복사
    const updatedDocument = JSON.parse(JSON.stringify(document));

    // Keep 셀의 ID 목록
    const keepCellIds = new Set(keepCells.map(c => c.id));

    let updatedCount = 0;

    // 생성된 JSON으로 업데이트
    pairsToProcess.forEach(pair => {
      const newContent = generatedJSON[pair.header];

      if (!newContent) {
        logger.warn(`  ⚠️ No content generated for "${pair.header}"`);
        return;
      }

      if (!pair.path) {
        logger.warn(`  ⚠️ No path for "${pair.header}"`);
        return;
      }

      try {
        const section = updatedDocument.sections[pair.path.section];
        if (!section) return;

        const table = section.elements[pair.path.table];
        if (!table) return;

        const row = table.rows[pair.path.row];
        if (!row) return;

        const cell =
          row.cells[pair.path.contentCell !== undefined ? pair.path.contentCell : pair.path.cell];
        if (!cell) return;

        // 셀 내용 업데이트
        if (!cell.elements || cell.elements.length === 0) {
          cell.elements = [
            {
              type: 'paragraph',
              runs: [{ text: newContent, style: {} }],
            },
          ];
        } else {
          const paragraph = cell.elements[0];
          if (!paragraph.runs || paragraph.runs.length === 0) {
            paragraph.runs = [{ text: newContent, style: {} }];
          } else {
            paragraph.runs[0].text = newContent;
          }
        }

        updatedCount++;
        logger.info(`  ✓ Updated "${pair.header}": "${newContent.substring(0, 30)}..."`);
      } catch (error) {
        logger.error(`  ❌ Error updating "${pair.header}":`, error);
      }
    });

    logger.info(`✅ Updated ${updatedCount} / ${pairsToProcess.length} cells`);

    return updatedDocument;
  }

  // ===================================
  // 외부 API 연동 메서드
  // ===================================

  /**
   * 외부 API에서 데이터를 가져와 문서에 채우기
   * @param {string} apiUrl - 외부 API URL
   * @param {Object} options - 옵션
   * @param {Object} [options.mapping] - 필드 매핑 설정 { templateKey: jsonPath }
   * @param {Object} [options.headers] - API 요청 헤더
   * @param {string} [options.method] - HTTP 메서드 (기본: GET)
   * @param {Object} [options.body] - POST 요청 시 body
   * @param {boolean} [options.autoMap] - 자동 매핑 사용 여부
   * @returns {Promise<Object>} 결과
   */
  async fillFromExternalAPI(apiUrl, options = {}) {
    logger.info('External API data fill started...');
    logger.time('External API Fill');

    // 동시 요청 방지
    if (this.state.isProcessing) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, '이미 요청을 처리 중입니다.');
    }

    this.state.isProcessing = true;
    this.state.error = null;

    try {
      const currentDocument = this.viewer.getDocument();
      if (!currentDocument) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다');
      }

      this.state.originalDocument = currentDocument;

      // 1. 외부 API에서 데이터 가져오기
      logger.info('  Fetching data from external API...');
      const jsonData = await this.dataFetcher.fetchData(apiUrl, {
        headers: options.headers,
        method: options.method,
        body: options.body,
      });

      logger.info(`  Received data: ${JSON.stringify(jsonData).substring(0, 200)}...`);

      // 2. 데이터 변환
      let templateData;

      if (options.mapping) {
        // 명시적 매핑 사용
        logger.info('  Using explicit mapping...');
        templateData = this.dataFetcher.transformToTemplateFormat(jsonData, options.mapping);
      } else if (options.autoMap) {
        // 자동 매핑 사용
        logger.info('  Using auto-mapping...');
        const { flattenedData } = this.dataFetcher.autoMapToDocument(currentDocument, jsonData);
        templateData = flattenedData;
      } else {
        // 매핑 없이 직접 사용 (1단계 객체)
        logger.info('  Using direct data (no mapping)...');
        templateData = this.dataFetcher.autoExtractKeys(jsonData);
      }

      logger.info(`  Template data: ${JSON.stringify(templateData).substring(0, 200)}...`);

      // 3. 문서에 데이터 병합
      logger.info('  Merging data into document...');
      const updatedDocument = this._mergeExternalDataToDocument(currentDocument, templateData);

      this.state.updatedDocument = updatedDocument;

      // 4. 렌더링
      if (this.options.autoRender) {
        logger.info('  Re-rendering document...');
        await this.viewer.updateDocument(updatedDocument);
      }

      const result = {
        success: true,
        updatedDocument: updatedDocument,
        metadata: {
          apiUrl: apiUrl,
          itemsUpdated: Object.keys(templateData).length,
          data: templateData,
        },
      };

      logger.timeEnd('External API Fill');
      logger.info('External API data fill completed');

      return result;
    } catch (error) {
      this.state.error = error;
      logger.error('External API fill failed:', error);
      logger.timeEnd('External API Fill');
      throw error;
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * 외부 데이터를 문서에 병합 (헤더 매칭 기반)
   * @private
   */
  _mergeExternalDataToDocument(document, templateData) {
    const updatedDocument = JSON.parse(JSON.stringify(document));

    let updatedCount = 0;

    // 모든 섹션의 테이블 순회
    for (const section of updatedDocument.sections || []) {
      for (const element of section.elements || []) {
        if (element.type === 'table') {
          updatedCount += this._fillTableWithData(element, templateData);
        }
      }
    }

    logger.info(`  Merged ${updatedCount} fields from external API`);

    return updatedDocument;
  }

  /**
   * 테이블에 데이터 채우기
   * @private
   */
  _fillTableWithData(table, templateData) {
    let updatedCount = 0;

    for (const row of table.rows || []) {
      // 헤더-내용 쌍 찾기
      for (let i = 0; i < row.cells.length - 1; i++) {
        const headerCell = row.cells[i];
        const contentCell = row.cells[i + 1];

        // 헤더 셀 텍스트 추출
        const headerText = this._getCellText(headerCell);

        if (!headerText) continue;

        // 템플릿 데이터에서 매칭되는 값 찾기
        const matchedValue = this._findMatchingValue(headerText, templateData);

        if (matchedValue !== null) {
          // 내용 셀 업데이트
          this._updateCellContent(contentCell, matchedValue);
          updatedCount++;
          logger.info(`    Updated: "${headerText}" = "${matchedValue.substring(0, 30)}..."`);
        }
      }
    }

    return updatedCount;
  }

  /**
   * 셀 텍스트 추출
   * @private
   */
  _getCellText(cell) {
    if (!cell || !cell.elements || cell.elements.length === 0) return '';

    const paragraph = cell.elements[0];
    if (!paragraph.runs || paragraph.runs.length === 0) return '';

    return paragraph.runs
      .map(r => r.text || '')
      .join('')
      .trim();
  }

  /**
   * 템플릿 데이터에서 매칭 값 찾기
   * @private
   */
  _findMatchingValue(headerText, templateData) {
    const normalizedHeader = headerText.toLowerCase().replace(/\s+/g, '');

    // 완전 일치
    if (templateData[headerText] !== undefined) {
      return String(templateData[headerText]);
    }

    // 키 정규화 후 매칭
    for (const [key, value] of Object.entries(templateData)) {
      const normalizedKey = key.toLowerCase().replace(/[_\-\s]+/g, '');

      if (normalizedKey === normalizedHeader) {
        return String(value);
      }

      // 부분 매칭
      if (normalizedHeader.includes(normalizedKey) || normalizedKey.includes(normalizedHeader)) {
        return String(value);
      }
    }

    return null;
  }

  /**
   * 셀 내용 업데이트
   * @private
   */
  _updateCellContent(cell, newContent) {
    if (!cell.elements || cell.elements.length === 0) {
      cell.elements = [
        {
          type: 'paragraph',
          runs: [{ text: newContent, style: {} }],
        },
      ];
    } else {
      const paragraph = cell.elements[0];
      if (!paragraph.runs || paragraph.runs.length === 0) {
        paragraph.runs = [{ text: newContent, style: {} }];
      } else {
        paragraph.runs[0].text = newContent;
      }
    }
  }

  /**
   * 샘플 데이터로 미리보기
   * @returns {Promise<Object>} 결과
   */
  async previewWithSampleData() {
    logger.info('Preview with sample data...');

    const sampleData = ExternalDataFetcher.getSampleData();
    const currentDocument = this.viewer.getDocument();

    if (!currentDocument) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다');
    }

    const templateData = this.dataFetcher.autoExtractKeys(sampleData);
    const updatedDocument = this._mergeExternalDataToDocument(currentDocument, templateData);

    this.state.updatedDocument = updatedDocument;

    if (this.options.autoRender) {
      await this.viewer.updateDocument(updatedDocument);
    }

    return {
      success: true,
      sampleData: sampleData,
      templateData: templateData,
    };
  }

  /**
   * ExternalDataFetcher 인스턴스 반환
   * @returns {ExternalDataFetcher} 데이터 fetcher
   */
  getDataFetcher() {
    return this.dataFetcher;
  }

  /**
   * 템플릿 모드: 레이아웃 유지 + 내용 비우기 + AI로 전체 채우기
   * @param {string} userMessage - 채울 내용에 대한 요청 (예: "3월 유치원 알림장")
   * @param {Object} [options={}] - 옵션
   * @param {boolean} [options.preview=false] - 미리보기 모드 (렌더링 안 함)
   * @returns {Promise<Object>} 처리 결과
   */
  async fillTemplate(userMessage, options = {}) {
    logger.info('Handling template fill request...');
    logger.time('Template Fill');

    if (this.state.isProcessing) {
      throw new HWPXError(
        ErrorType.VALIDATION_ERROR,
        '이미 요청을 처리 중입니다. 완료 후 다시 시도하세요.'
      );
    }

    if (!this.hasApiKey()) {
      throw new HWPXError(ErrorType.VALIDATION_ERROR, AIConfig.prompts.errorMessages.noApiKey);
    }

    this.state.isProcessing = true;
    this.state.currentRequest = userMessage;
    this.state.error = null;

    try {
      // 1. 현재 문서 가져오기 (DOM 동기화 포함)
      if (this.viewer._syncDocumentFromDOM) {
        this.viewer._syncDocumentFromDOM();
      }
      const currentDocument = this.viewer.getDocument();
      if (!currentDocument) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다. 문서를 열거나 새 문서를 생성해주세요.');
      }

      // 원본 문서 백업 (되돌리기용)
      this.state.originalDocument = JSON.parse(JSON.stringify(currentDocument));

      // 2. 템플릿 추출 - 레이아웃 유지, 내용 셀 비우기
      logger.info('  Step 1/3: Extracting template (clearing content cells)...');
      const { templateDocument, headerContentMap, clearedCount } =
        this._extractTemplate(currentDocument);

      logger.info(`    Cleared ${clearedCount} content cells, ${headerContentMap.length} headers found`);

      if (headerContentMap.length === 0) {
        throw new HWPXError(
          ErrorType.VALIDATION_ERROR,
          '문서에서 채울 수 있는 내용 셀을 찾지 못했습니다. 표 구조가 있는 문서를 사용해주세요.'
        );
      }

      // 3. GPT로 전체 내용 생성
      logger.info('  Step 2/3: Generating content with GPT...');
      const pairsToGenerate = headerContentMap.map(item => ({
        header: item.header,
        content: '', // 빈 내용 — GPT가 새로 생성
        path: item.path,
        mode: 'generate',
      }));

      const { content: generatedJSON, tokensUsed } = await this.generateStructuredContent(
        pairsToGenerate,
        userMessage
      );

      logger.info(`    Generated content for ${Object.keys(generatedJSON).length} items`);

      // 4. 생성된 내용을 템플릿에 병합
      logger.info('  Step 3/3: Merging generated content into template...');
      const filledDocument = this.mergeStructuredContent(
        templateDocument,
        generatedJSON,
        pairsToGenerate
      );

      this.state.updatedDocument = filledDocument;

      // 5. 렌더링 (미리보기가 아닌 경우)
      if (!options.preview && this.options.autoRender) {
        await this.viewer.updateDocument(filledDocument);
      }

      // 6. 이력 저장
      if (this.options.saveHistory) {
        this.saveToHistory({
          request: `[템플릿 채우기] ${userMessage}`,
          original: this.state.originalDocument,
          updated: filledDocument,
          metadata: {
            timestamp: new Date().toISOString(),
            mode: 'template-fill',
            clearedCount,
            itemsGenerated: Object.keys(generatedJSON).length,
            tokensUsed,
          },
        });
      }

      const result = {
        success: true,
        updatedDocument: filledDocument,
        metadata: {
          request: userMessage,
          mode: 'template-fill',
          headers: headerContentMap.map(h => h.header),
          clearedCount,
          itemsGenerated: Object.keys(generatedJSON).length,
          tokensUsed,
          generatedContent: generatedJSON,
        },
      };

      logger.timeEnd('Template Fill');
      logger.info('Template fill completed successfully');

      return result;
    } catch (error) {
      this.state.error = error;
      logger.error('Template fill failed:', error);
      logger.timeEnd('Template Fill');
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.state.currentRequest = null;
    }
  }

  /**
   * 문서에서 템플릿 추출 (레이아웃 유지, 내용 비우기)
   * @param {Object} document - 원본 문서
   * @returns {Object} { templateDocument, headerContentMap, clearedCount }
   * @private
   */
  _extractTemplate(document) {
    const templateDocument = JSON.parse(JSON.stringify(document));
    const headerContentMap = [];
    let clearedCount = 0;

    templateDocument.sections?.forEach((section, sectionIdx) => {
      section.elements?.forEach((element, tableIdx) => {
        if (element.type !== 'table') return;

        element.rows?.forEach((row, rowIdx) => {
          const cells = row.cells || [];

          // 첫 번째 행은 헤더로 유지
          if (rowIdx === 0) return;

          cells.forEach((cell, cellIdx) => {
            const cellText = this._getCellText(cell);

            // 첫 번째 열이면서 30자 이하면 헤더 라벨로 유지
            const isHeaderLabel = cellIdx === 0 && cellText.trim().length <= 30;

            if (isHeaderLabel) {
              // 이 헤더에 대응하는 내용 셀 찾기 (오른쪽 셀)
              if (cellIdx + 1 < cells.length) {
                headerContentMap.push({
                  header: cellText.trim(),
                  path: {
                    section: sectionIdx,
                    table: tableIdx,
                    row: rowIdx,
                    headerCell: cellIdx,
                    contentCell: cellIdx + 1,
                  },
                });

                // 내용 셀 비우기
                const contentCell = cells[cellIdx + 1];
                clearedCount += this._clearCellContent(contentCell);
              }
            } else if (cellIdx > 0) {
              // 헤더가 아닌 셀의 내용 비우기 (이미 headerContentMap에 추가되지 않은 경우)
              const alreadyMapped = headerContentMap.some(
                h =>
                  h.path.section === sectionIdx &&
                  h.path.table === tableIdx &&
                  h.path.row === rowIdx &&
                  h.path.contentCell === cellIdx
              );
              if (!alreadyMapped && cellText.trim().length > 0) {
                // 왼쪽에서 헤더 찾기
                let headerText = null;
                for (let i = cellIdx - 1; i >= 0; i--) {
                  const leftText = this._getCellText(cells[i]);
                  if (leftText.trim().length > 0 && leftText.trim().length <= 30) {
                    headerText = leftText.trim();
                    headerContentMap.push({
                      header: headerText,
                      path: {
                        section: sectionIdx,
                        table: tableIdx,
                        row: rowIdx,
                        headerCell: i,
                        contentCell: cellIdx,
                      },
                    });
                    break;
                  }
                }
                clearedCount += this._clearCellContent(cell);
              }
            }
          });
        });
      });
    });

    return { templateDocument, headerContentMap, clearedCount };
  }

  // ═══════════════════════════════════════════════════════════
  // AI 친화 문서 기능 (Phase 1)
  // ═══════════════════════════════════════════════════════════

  /**
   * AI 친화 문서 교정 요청 처리
   * 정부 AI 친화 문서 표준에 따라 문서를 교정
   *
   * @param {string} userMessage - 사용자 추가 요청 (선택)
   * @param {Object} [options={}] - 옵션
   * @param {string} [options.documentType] - 문서 유형 (자동감지 또는 수동 지정)
   * @returns {Promise<Object>} 교정 결과
   */
  async handleRefinementRequest(userMessage = '', options = {}) {
    logger.info('🔧 Handling AI-friendly refinement request...');
    pipelineLogger.startSession('refinement', userMessage || 'AI 친화 교정');

    if (this.state.isProcessing) {
      pipelineLogger.endSession('error', { reason: 'concurrent_request' });
      throw new HWPXError(ErrorType.VALIDATION_ERROR, '이미 요청을 처리 중입니다.');
    }

    if (!this.hasApiKey()) {
      pipelineLogger.endSession('error', { reason: 'no_api_key' });
      throw new HWPXError(ErrorType.VALIDATION_ERROR, AIConfig.prompts.errorMessages.noApiKey);
    }

    this.state.isProcessing = true;
    this.state.currentRequest = userMessage;
    this.state.error = null;

    try {
      // 1. 문서 동기화 및 가져오기
      if (this.viewer._syncDocumentFromDOM) this.viewer._syncDocumentFromDOM();
      const currentDocument = this.viewer.getDocument();
      if (!currentDocument) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다.');
      }
      this.state.originalDocument = currentDocument;

      // 2. 헤더-내용 쌍 추출
      pipelineLogger.timeStart('structure_extraction');
      const headerContentPairs = this.extractor.extractTableHeaderContentPairs(currentDocument);
      pipelineLogger.timeEnd('structure_extraction', 'extract');
      pipelineLogger.log('extract', 'success', `Extracted ${headerContentPairs.length} pairs`);

      if (headerContentPairs.length === 0) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '교정할 내용이 없습니다.');
      }

      // 3. 문서 유형 감지 (자동 또는 수동)
      let documentType = options.documentType;
      if (!documentType) {
        const detector = new DocumentTypeDetector();
        const detection = detector.detect(headerContentPairs);
        documentType = detection.type;
        pipelineLogger.log('extract', 'info', `Auto-detected type: ${documentType} (${detection.confidence})`);
      }

      // 4. 교정 프롬프트로 GPT 생성
      pipelineLogger.timeStart('gpt_generation');
      const { content: generatedJSON, tokensUsed } = await this.generateStructuredContent(
        headerContentPairs,
        userMessage || 'AI 친화적 문서 표준에 맞게 전체 교정해주세요.',
        (builder, pairs, request) => builder.buildRefinementPrompt(pairs, request, documentType)
      );
      pipelineLogger.timeEnd('gpt_generation', 'generate');

      // 5. 병합
      pipelineLogger.timeStart('content_merge');
      const mergeResult = this.mergeStructuredContent(currentDocument, generatedJSON, headerContentPairs);
      pipelineLogger.timeEnd('content_merge', 'merge');

      this.state.updatedDocument = mergeResult.document;

      // 6. 렌더링
      if (this.options.autoRender) {
        await this.viewer.updateDocument(mergeResult.document);
      }

      // 7. 이력 저장
      if (this.options.saveHistory) {
        this.saveToHistory({
          request: `[교정] ${userMessage}`,
          original: currentDocument,
          updated: mergeResult.document,
          metadata: {
            timestamp: new Date().toISOString(),
            itemsUpdated: mergeResult.updatedCount,
            tokensUsed,
            documentType,
          },
        });
      }

      const result = {
        success: true,
        updatedDocument: mergeResult.document,
        metadata: {
          mode: 'refinement',
          documentType,
          itemsUpdated: mergeResult.updatedCount,
          tokensUsed,
        },
      };

      pipelineLogger.endSession('success', result.metadata);
      logger.info(`✅ Refinement complete: ${mergeResult.updatedCount} items updated (type: ${documentType})`);
      return result;
    } catch (error) {
      this.state.error = error;
      logger.error('❌ Refinement failed:', error);
      pipelineLogger.endSession('error', { error: error.message });
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.state.currentRequest = null;
    }
  }

  /**
   * AI 친화도 품질 검증 요청 처리
   * 문서가 AI 처리에 적합한지 5가지 기준으로 평가
   *
   * @returns {Promise<Object>} 검증 결과 { score, grade, criteria, suggestions, summary }
   */
  async handleReadinessCheck() {
    logger.info('🔍 Handling AI readiness check...');
    pipelineLogger.startSession('readiness_check', 'AI 친화도 검증');

    if (this.state.isProcessing) {
      pipelineLogger.endSession('error', { reason: 'concurrent_request' });
      throw new HWPXError(ErrorType.VALIDATION_ERROR, '이미 요청을 처리 중입니다.');
    }

    if (!this.hasApiKey()) {
      pipelineLogger.endSession('error', { reason: 'no_api_key' });
      throw new HWPXError(ErrorType.VALIDATION_ERROR, AIConfig.prompts.errorMessages.noApiKey);
    }

    this.state.isProcessing = true;
    this.state.error = null;

    try {
      // 1. 문서 가져오기
      if (this.viewer._syncDocumentFromDOM) this.viewer._syncDocumentFromDOM();
      const currentDocument = this.viewer.getDocument();
      if (!currentDocument) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 로드되지 않았습니다.');
      }

      // 2. 구조 추출
      pipelineLogger.timeStart('structure_extraction');
      const headerContentPairs = this.extractor.extractTableHeaderContentPairs(currentDocument);
      pipelineLogger.timeEnd('structure_extraction', 'extract');

      if (headerContentPairs.length === 0) {
        throw new HWPXError(ErrorType.VALIDATION_ERROR, '검증할 내용이 없습니다.');
      }

      // 3. 검증 프롬프트로 GPT 호출
      pipelineLogger.timeStart('gpt_generation');
      const promptBuilder = new PromptBuilder();
      const messages = promptBuilder.buildReadinessCheckPrompt(headerContentPairs);
      const response = await this.generator.callAPIWithRetry(messages);
      pipelineLogger.timeEnd('gpt_generation', 'generate');

      // 4. 응답 파싱
      let jsonText = '';
      if (response.choices && response.choices[0]?.message) {
        jsonText = response.choices[0].message.content.trim();
      } else if (response.content) {
        jsonText = response.content.trim();
      } else {
        throw new Error('응답에서 content를 찾을 수 없습니다');
      }

      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : jsonText;
      const assessment = JSON.parse(jsonStr);

      // 5. 문서 유형 자동 감지 (추가 정보)
      const detector = new DocumentTypeDetector();
      const typeDetection = detector.detect(headerContentPairs);

      const result = {
        success: true,
        assessment: {
          ...assessment,
          documentType: typeDetection.type,
          documentTypeConfidence: typeDetection.confidence,
        },
        metadata: {
          mode: 'readiness_check',
          pairsAnalyzed: headerContentPairs.length,
          tokensUsed: response.usage?.total_tokens || 0,
        },
      };

      pipelineLogger.endSession('success', {
        score: assessment.score,
        grade: assessment.grade,
      });
      logger.info(`✅ Readiness check complete: Score ${assessment.score}/100 (${assessment.grade})`);
      return result;
    } catch (error) {
      this.state.error = error;
      logger.error('❌ Readiness check failed:', error);
      pipelineLogger.endSession('error', { error: error.message });
      throw error;
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * 셀에서 전체 텍스트 추출
   * @private
   */
  _getCellText(cell) {
    let text = '';
    const extract = (elements) => {
      elements?.forEach(el => {
        if (el.type === 'paragraph' && el.runs) {
          el.runs.forEach(run => {
            text += run.text || '';
          });
        } else if (el.elements) {
          extract(el.elements);
        }
      });
    };
    extract(cell.elements);
    return text;
  }

  /**
   * 셀 내용 비우기 (구조는 유지)
   * @private
   * @returns {number} 비운 텍스트 런 수
   */
  _clearCellContent(cell) {
    let count = 0;
    const clear = (elements) => {
      elements?.forEach(el => {
        if (el.type === 'paragraph' && el.runs) {
          el.runs.forEach(run => {
            if (run.text && run.text.trim()) {
              run.text = '';
              count++;
            }
          });
        } else if (el.elements) {
          clear(el.elements);
        }
      });
    };
    clear(cell.elements);
    return count;
  }
}

export async function processAIRequest(viewer, apiKey, userMessage, options = {}) {
  const controller = new AIDocumentController(viewer, options);
  controller.setApiKey(apiKey);
  return await controller.handleUserRequest(userMessage);
}

// Default export
export default AIDocumentController;
