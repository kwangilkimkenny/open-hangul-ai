/**
 * Chat Panel Component
 * AI 문서 편집을 위한 채팅 인터페이스
 * 
 * @module ui/chat-panel
 * @version 3.0.0-MVP
 */

import { getLogger } from '../utils/logger.js';
import { showToast, escapeHtml } from '../utils/ui.js';
import { AIConfig } from '../config/ai-config.js';
import { CellSelector, CellMode } from '../features/cell-selector.js';

const logger = getLogger();

/**
 * 채팅 패널 클래스
 * 사용자와 AI 간의 대화 인터페이스 제공
 * 
 * @example
 * const chatPanel = new ChatPanel(controller);
 * chatPanel.init();
 */
export class ChatPanel {
    /**
     * ChatPanel 생성자
     * @param {Object} aiController - AI 컨트롤러 인스턴스
     * @param {Object} [options={}] - 패널 옵션
     */
    constructor(aiController, options = {}) {
        this.aiController = aiController;
        this.options = {
            containerId: options.containerId || 'ai-chat-panel',
            inputId: options.inputId || 'ai-chat-input',
            messagesId: options.messagesId || 'ai-chat-messages',
            sendButtonId: options.sendButtonId || 'ai-chat-send',
            toggleButtonId: options.toggleButtonId || 'ai-panel-toggle',
            apiKeyButtonId: options.apiKeyButtonId || 'ai-api-key-btn',
            autoScroll: options.autoScroll !== false,
            ...options
        };
        
        // DOM 요소 참조
        this.elements = {
            panel: null,
            input: null,
            messages: null,
            sendButton: null,
            toggleButton: null,
            closeButton: null,
            apiKeyButton: null,
            customApiButton: null,
            saveButton: null,
            // 🆕 AI 기능 버튼들
            previewStructureBtn: null,
            applyStyleBtn: null,
            extractTemplateBtn: null,
            regenerateBtn: null,
            partialEditBtn: null,
            validateBtn: null,
            batchGenerateBtn: null,
            clearBtn: null,
            cellSelectModeBtn: null,  // 셀 선택 모드 버튼
            externalApiBtn: null,     // 외부 API 연동 버튼
            fillTemplateBtn: null     // 템플릿 채우기 버튼
        };
        
        // 셀 선택기 (나중에 초기화)
        this.cellSelector = null;
        
        // 외부 API 설정
        this.externalApiConfig = {
            url: '',
            method: 'GET',
            headers: {},
            mapping: null
        };
        
        // 메시지 ID 카운터
        this.messageIdCounter = 0;

        // 로딩 메시지 interval 관리
        this.loadingIntervals = new Map();

        logger.info('💬 ChatPanel initialized');
    }
    
    /**
     * 초기화 (DOM 요소 바인딩 및 이벤트 리스너 등록)
     */
    init() {
        logger.info('💬 Initializing chat panel...');

        // DOM 요소 가져오기
        this.elements.panel = document.getElementById(this.options.containerId);
        this.elements.input = document.getElementById(this.options.inputId);
        this.elements.messages = document.getElementById(this.options.messagesId);
        this.elements.sendButton = document.getElementById(this.options.sendButtonId);
        this.elements.toggleButton = document.getElementById(this.options.toggleButtonId);
        this.elements.closeButton = document.getElementById('ai-chat-toggle');
        this.elements.apiKeyButton = document.getElementById(this.options.apiKeyButtonId);
        this.elements.customApiButton = document.getElementById('custom-api-settings-btn');
        this.elements.saveButton = document.getElementById('ai-save-btn');

        // AI 기능 버튼들
        this.elements.previewStructureBtn = document.getElementById('preview-structure-btn');
        this.elements.applyStyleBtn = document.getElementById('apply-style-btn');
        this.elements.extractTemplateBtn = document.getElementById('extract-template-btn');
        this.elements.regenerateBtn = document.getElementById('ai-regenerate-btn');
        this.elements.partialEditBtn = document.getElementById('partial-edit-btn');
        this.elements.validateBtn = document.getElementById('validate-document-btn');
        this.elements.batchGenerateBtn = document.getElementById('batch-generate-btn');
        this.elements.clearBtn = document.getElementById('ai-clear-btn');
        this.elements.cellSelectModeBtn = document.getElementById('cell-select-mode-btn');
        this.elements.externalApiBtn = document.getElementById('external-api-btn');
        this.elements.fillTemplateBtn = document.getElementById('fill-template-btn');

        if (!this.elements.panel || !this.elements.input || !this.elements.messages) {
            logger.error('❌ Required DOM elements not found');
            return;
        }

        // 중복 init 방지: 이미 초기화된 경우 DOM 재바인딩만 하고 리턴
        if (this._initialized) {
            logger.info('💬 Chat panel re-initialized (DOM rebind only)');
            return;
        }
        this._initialized = true;

        // CellSelector 초기화
        if (this.aiController && this.aiController.viewer) {
            this.cellSelector = new CellSelector(this.aiController.viewer);
            this.cellSelector.onSelectionChange = (summary) => {
                this._onCellSelectionChange(summary);
            };

            document.addEventListener('cellSelectionApplied', (e) => {
                this._handleCellSelectionApplied(e.detail);
            });
        }

        // 이벤트 리스너 등록 (최초 1회만)
        this.attachEventListeners();

        // 초기 메시지 표시 (최초 1회만)
        if (this.aiController.hasApiKey()) {
            this.addSystemMessage('AI 어시스턴트에 오신 것을 환영합니다! 자유롭게 대화하거나, 문서를 열어 편집할 수 있습니다. "문서로 만들어줘"라고 하면 대화 내용을 문서로 변환합니다.');
        } else {
            this.addSystemMessage('AI 기능을 사용하려면 .env 파일에 VITE_OPENAI_API_KEY를 설정하고 서버를 재시작해주세요.');
        }

        logger.info('✅ Chat panel initialized');
    }
    
    /**
     * 이벤트 리스너 등록
     * @private
     */
    attachEventListeners() {
        // 이벤트 중복 바인딩 방지 (React re-render 또는 다중 인스턴스 대응)
        const panel = this.elements.panel;
        if (panel && panel.dataset.eventsAttached === 'true') {
            logger.info('💬 Events already attached, skipping');
            return;
        }
        if (panel) {
            panel.dataset.eventsAttached = 'true';
        }

        // 전송 버튼 클릭
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => {
                this.handleSendMessage();
            });
        }

        // Enter 키로 전송 (Shift+Enter는 줄바꿈)
        if (this.elements.input) {
            this.elements.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }
        
        // 토글 버튼 클릭
        if (this.elements.toggleButton) {
            this.elements.toggleButton.addEventListener('click', () => {
                this.toggle();
            });
        }

        // 닫기 버튼 클릭
        if (this.elements.closeButton) {
            this.elements.closeButton.addEventListener('click', () => {
                this.close();
            });
        }

        // API 키 버튼 클릭
        if (this.elements.apiKeyButton) {
            this.elements.apiKeyButton.addEventListener('click', () => {
                this.promptForApiKey();
            });
        }
        
        // 🆕 커스텀 API 설정 버튼 클릭
        if (this.elements.customApiButton) {
            this.elements.customApiButton.addEventListener('click', () => {
                this.showCustomApiSettings();
            });
        }
        
        // 저장 버튼 클릭
        if (this.elements.saveButton) {
            this.elements.saveButton.addEventListener('click', () => {
                this.handleSaveDocument();
            });
        }
        
        // 🆕 문서 구조 보기 버튼
        if (this.elements.previewStructureBtn) {
            this.elements.previewStructureBtn.addEventListener('click', () => {
                this.handlePreviewStructure();
            });
        }
        
        // 🆕 스타일 적용 버튼
        if (this.elements.applyStyleBtn) {
            this.elements.applyStyleBtn.addEventListener('click', () => {
                this.handleApplyStyle();
            });
        }
        
        // 🆕 템플릿 추출 버튼
        if (this.elements.extractTemplateBtn) {
            this.elements.extractTemplateBtn.addEventListener('click', () => {
                this.handleExtractTemplate();
            });
        }
        
        // 🆕 다시 생성 버튼
        if (this.elements.regenerateBtn) {
            this.elements.regenerateBtn.addEventListener('click', () => {
                this.handleRegenerate();
            });
        }
        
        // 🆕 부분 수정 버튼
        if (this.elements.partialEditBtn) {
            this.elements.partialEditBtn.addEventListener('click', () => {
                this.handlePartialEdit();
            });
        }
        
        // 🆕 검증 버튼
        if (this.elements.validateBtn) {
            this.elements.validateBtn.addEventListener('click', () => {
                this.handleValidateDocument();
            });
        }
        
        // 🆕 일괄 생성 버튼
        if (this.elements.batchGenerateBtn) {
            this.elements.batchGenerateBtn.addEventListener('click', () => {
                this.handleBatchGenerate();
            });
        }
        
        // 🆕 대화 지우기 버튼
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => {
                this.handleClearChat();
            });
        }
        
        // 셀 선택 모드 버튼
        if (this.elements.cellSelectModeBtn) {
            this.elements.cellSelectModeBtn.addEventListener('click', () => {
                this.handleCellSelectMode();
            });
        }
        
        // 외부 API 연동 버튼
        if (this.elements.externalApiBtn) {
            this.elements.externalApiBtn.addEventListener('click', () => {
                this.showExternalApiModal();
            });
        }

        // 템플릿 채우기 버튼
        if (this.elements.fillTemplateBtn) {
            this.elements.fillTemplateBtn.addEventListener('click', () => {
                this.handleFillTemplate();
            });
        }

        // ── AI 어시스턴트 퀵 액션 버튼들 ──
        // 분석/생성 액션: 채팅에만 결과 표시 (문서 수정 안 함)
        const chatOnlyActions = {
            'ai-ast-summary':       '이 문서의 핵심 내용을 3줄로 요약해줘. 결론과 핵심 키워드를 포함해줘.',
            'ai-ast-keywords':      '이 문서의 핵심 키워드와 태그를 10개 추출해줘. 카테고리별로 분류해줘.',
            'ai-ast-audience':      '이 문서의 난이도, 적합한 독자 수준, 전문성 정도를 분석해줘.',
            'ai-ast-forward-email': '이 문서를 첨부파일로 보낼 때 사용할 전달 이메일을 작성해줘. 수신자에게 문서 내용을 간략히 안내하는 형태로 작성해줘.',
            'ai-ast-report-email':  '이 문서 내용을 요약하여 상사에게 보고하는 이메일을 작성해줘. 핵심 사항, 진행 상황, 건의 사항을 포함해줘.',
            'ai-ast-meeting':       '이 문서를 회의록 형태(일시/참석자/안건/논의내용/결정사항/후속조치)로 변환해줘.',
            'ai-ast-review':        '이 문서의 검토자가 확인해야 할 체크리스트를 만들어줘. 완성도, 정확성, 누락 항목을 점검해줘.',
            'ai-ast-improve':       '이 문서의 개선이 필요한 부분과 구체적인 수정 방향을 제안해줘. 구조, 표현, 내용 측면에서 분석해줘.',
            'ai-ast-actions':       '이 문서에서 담당자별 액션 아이템(할 일)을 추출해줘. 우선순위와 기한도 제안해줘.',
        };

        // 문서 변환 액션: AI가 문서 본문을 직접 수정
        const documentEditActions = {
            'ai-ast-simplify':      '이 문서를 초등학생도 이해할 수 있도록 쉽게 다시 써줘. 어려운 단어는 쉬운 말로 바꿔줘.',
            'ai-ast-formal':        '이 문서를 공식 문서(공문) 스타일로 격식체로 변환해줘. 발신/수신/제목/본문 형식을 갖춰줘.',
            'ai-ast-translate':     '이 문서를 영어로 번역해줘. 원문의 구조와 형식을 최대한 유지해줘.',
        };

        Object.entries(chatOnlyActions).forEach(([btnId, prompt]) => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    this._executeAssistantAction(prompt);
                });
            }
        });

        Object.entries(documentEditActions).forEach(([btnId, prompt]) => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.elements.input.value = prompt;
                    this.handleSendMessage();
                });
            }
        });

        // ── AI 문서 품질 버튼들 ──
        const refineBtn = document.getElementById('ai-ast-refine');
        if (refineBtn) {
            refineBtn.addEventListener('click', () => this.handleAIRefinement());
        }
        const readinessBtn = document.getElementById('ai-ast-readiness');
        if (readinessBtn) {
            readinessBtn.addEventListener('click', () => this.handleAIReadinessCheck());
        }
        const localCheckBtn = document.getElementById('ai-ast-local-check');
        if (localCheckBtn) {
            localCheckBtn.addEventListener('click', () => this.handleLocalQualityCheck());
        }

        // ── 레퍼런스 파일 업로드 ──
        this._referenceTexts = [];
        const dropzone = document.getElementById('ai-ref-dropzone');
        const fileInput = document.getElementById('ai-ref-file-input');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                this._handleReferenceFiles(e.dataTransfer.files);
            });
            fileInput.addEventListener('change', (e) => {
                this._handleReferenceFiles(e.target.files);
                fileInput.value = '';
            });
        }
    }
    
    /**
     * 메시지 전송 처리
     * @private
     */
    /**
     * 문서화 요청 키워드 감지
     * @param {string} message - 사용자 메시지
     * @returns {boolean} 문서화 요청 여부
     * @private
     */
    _isDocumentCreateRequest(message) {
        const keywords = [
            '문서로 만들', '문서로 작성', '문서화', '문서 만들', '문서 작성',
            '문서로 변환', '문서로 정리', '문서에 넣', '문서에 반영',
            '에디터에', '편집기에', '본문에 반영', '본문에 적용', '본문에 넣',
            '반영해', '적용해',
        ];
        return keywords.some(k => message.includes(k));
    }

    /**
     * 마지막 AI 응답을 찾아 문서에 반영
     * @param {string} message - 사용자 메시지
     * @returns {Promise<boolean>} 처리 여부
     * @private
     */
    async _applyLastResponseToDocument(message) {
        // 채팅 히스토리에서 마지막 assistant 응답 찾기
        let lastResponse = '';
        if (this._chatHistory && this._chatHistory.length > 0) {
            for (let i = this._chatHistory.length - 1; i >= 0; i--) {
                if (this._chatHistory[i].role === 'assistant') {
                    lastResponse = this._chatHistory[i].content;
                    break;
                }
            }
        }

        // 채팅 히스토리에 없으면 DOM에서 마지막 assistant 메시지 텍스트 가져오기
        if (!lastResponse && this.elements.messages) {
            const assistantMsgs = this.elements.messages.querySelectorAll('.ai-message.assistant');
            if (assistantMsgs.length > 0) {
                lastResponse = assistantMsgs[assistantMsgs.length - 1].textContent || '';
            }
        }

        if (!lastResponse.trim()) {
            this.addSystemMessage('[알림] 반영할 AI 응답이 없습니다. 먼저 AI에게 내용 생성을 요청해주세요.');
            return true;
        }

        try {
            const { markdownToDocument } = await import('../utils/markdown-to-document.js');
            const doc = markdownToDocument(lastResponse);
            // createNewDocument를 사용하여 isNewDocument 플래그 설정 (저장 시 새 HWPX 생성)
            await this.aiController.viewer.createNewDocument(doc);
            this.addAssistantMessage('이전 AI 응답을 문서 본문에 반영했습니다. 파일 > 저장으로 HWPX 파일을 저장할 수 있습니다.');
            showToast('success', '문서 반영 완료', '본문이 업데이트되었습니다');
        } catch (err) {
            logger.error('❌ Apply to document failed:', err);
            this.addSystemMessage(`[오류] 문서 반영 실패: ${err.message}`);
        }
        return true;
    }

    async handleSendMessage() {
        const message = this.elements.input.value.trim();

        if (!message) {
            return;
        }

        // API 키 확인
        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] AI API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 설정하고 서버를 재시작해주세요.');
            return;
        }

        // 입력창 비우기
        this.elements.input.value = '';

        // 사용자 메시지 표시
        this.addUserMessage(message);

        // "본문에 반영해줘" 같은 요청 → 이전 AI 응답을 문서로 변환
        if (this._isDocumentCreateRequest(message)) {
            await this._applyLastResponseToDocument(message);
            return;
        }

        // 문서가 로드되지 않은 경우 → 자유 대화 모드
        const currentDoc = this.aiController.viewer.getDocument();
        const hasDocument = currentDoc && currentDoc.sections && currentDoc.sections.length > 0
            && currentDoc.sections.some(s => s.elements && s.elements.length > 0);

        if (!hasDocument) {
            await this._handleFreeChat(message);
            return;
        }

        // 로딩 메시지 표시
        const loadingMessageId = this.addLoadingMessage('요청을 처리하는 중...');

        try {
            // 📄 다중 페이지 감지 및 처리
            const document = currentDoc;
            const isMultiPage = document && document.sections && document.sections.length > 1;

            let result;

            if (isMultiPage) {
                // 다중 페이지 처리
                logger.info(`📄 Multi-page document detected (${document.sections.length} pages)`);
                
                // 로딩 메시지 업데이트
                this.updateMessage(
                    loadingMessageId,
                    `다중 페이지 문서 처리 중... (${document.sections.length} 페이지)`
                );
                
                result = await this.aiController.handleMultiPageRequest(message);
                
                // 로딩 메시지 제거
                this.removeMessage(loadingMessageId);
                
                // 성공 메시지 표시 (다중 페이지용)
                const successCount = result.results.filter(r => r.content !== null).length;
                this.addAssistantMessage(
                    `✅ [완료] 다중 페이지 문서가 성공적으로 생성되었습니다!\n\n` +
                    `📊 생성 결과:\n` +
                    `- 총 페이지: ${result.totalPages}개\n` +
                    `- 성공: ${successCount}/${result.totalPages}개\n` +
                    `- 문서 유형: ${result.analysis.documentType}\n` +
                    `- 전체 주제: ${result.analysis.overallTheme}\n` +
                    `- 생성 전략: ${result.strategy}\n\n` +
                    `📄 페이지별 정보:\n` +
                    result.analysis.pages.map((page, i) => 
                        `  ${i + 1}. ${page.type} - ${page.role}`
                    ).join('\n')
                );
                
                // 토스트 알림 (다중 페이지)
                showToast('success', '다중 페이지 생성 완료', `${successCount}/${result.totalPages} 페이지 생성됨`);
                
            } else {
                // 단일 페이지 처리 (기존 방식)
                logger.info('📄 Single-page document - using standard processing');
                
                // 🆕 셀 선택 데이터가 있으면 포함
                const cellSelectionData = this._lastCellSelectionData || null;
                if (cellSelectionData) {
                    logger.info('📋 Using cell selection data for AI request');
                    result = await this.aiController.handleUserRequestWithCellSelection(
                        message, 
                        cellSelectionData
                    );
                    // 사용 후 초기화
                    this._lastCellSelectionData = null;
                } else {
                    result = await this.aiController.handleUserRequest(message);
                }
                
                // 로딩 메시지 제거
                this.removeMessage(loadingMessageId);
                
                // 성공/경고 메시지 표시
                const updatedCount = result.metadata?.slotsUpdated || result.metadata?.itemsUpdated || 0;
                const generatedCount = result.metadata?.itemsGenerated || updatedCount;

                if (updatedCount > 0) {
                    this.addAssistantMessage(
                        `✅ [완료] 문서가 성공적으로 업데이트되었습니다!\n\n` +
                        `- 변경된 텍스트 슬롯: ${updatedCount}개\n` +
                        `- 사용된 토큰: ${result.metadata?.tokensUsed || '알 수 없음'}개`
                    );
                    showToast('success', '성공', '문서가 업데이트되었습니다');
                } else {
                    this.addAssistantMessage(
                        `⚠️ [경고] AI가 콘텐츠를 생성했지만 문서에 반영하지 못했습니다.\n\n` +
                        `- AI 생성 항목: ${generatedCount}개\n` +
                        `- 실제 반영: 0개\n` +
                        `- 사용된 토큰: ${result.metadata?.tokensUsed || '알 수 없음'}개\n\n` +
                        `테이블이 포함된 문서를 열고 다시 시도해주세요.`
                    );
                    showToast('warning', '경고', '문서에 변경 사항을 반영하지 못했습니다');
                }
            }
            
        } catch (error) {
            logger.error('❌ Message handling failed:', error);
            
            // 로딩 메시지 제거
            this.removeMessage(loadingMessageId);
            
            // 에러 메시지 표시
            this.addAssistantMessage(
                `[오류] 오류가 발생했습니다:\n${error.message}\n\n` +
                `다시 시도해주세요.`
            );
            
            // 토스트 알림
            showToast('error', '오류', error.message);
        }
    }
    
    /**
     * 사용자 메시지 추가
     * @param {string} content - 메시지 내용
     * @returns {string} 메시지 ID
     */
    addUserMessage(content) {
        return this.addMessage('user', content);
    }
    
    /**
     * AI 응답 메시지 추가
     * @param {string} content - 메시지 내용
     * @returns {string} 메시지 ID
     */
    addAssistantMessage(content) {
        return this.addMessage('assistant', content);
    }
    
    /**
     * 시스템 메시지 추가
     * @param {string} content - 메시지 내용
     * @returns {string} 메시지 ID
     */
    addSystemMessage(content) {
        return this.addMessage('system', content);
    }
    
    /**
     * 로딩 메시지 추가
     * @param {string} content - 메시지 내용 (사용 안 함, 동적으로 변경됨)
     * @returns {string} 메시지 ID
     */
    addLoadingMessage(content) {
        // 다양한 로딩 메시지 배열 (유머 가미)
        const loadingMessages = [
            '문서를 꼼꼼히 읽는 중...',
            'AI가 커피 한잔 마시며 생각 중...',
            '창의적인 영감을 받는 중...',
            '문장을 예쁘게 다듬는 중...',
            '천재적인 아이디어 떠올리는 중...',
            '마법을 부리는 중...',
            '단어들과 친해지는 중...',
            '문서 구조를 분석하는 중...',
            '내용을 최적화하는 중...',
            '완벽을 추구하는 중...',
            '독자를 생각하며 작성 중...',
            '문맥을 파악하는 중...',
            '적절한 표현 찾는 중...',
            '문장에 생명을 불어넣는 중...',
            '논리를 정리하는 중...',
            '핵심을 찾아내는 중...',
            '아이디어를 구체화하는 중...',
            '글의 흐름을 다듬는 중...',
            '읽기 쉽게 변환하는 중...',
            '전문성을 더하는 중...',
            '명확하게 표현하는 중...',
            '설득력을 높이는 중...',
            'AI 두뇌 풀가동 중...',
            '문서를 업그레이드하는 중...',
            '마지막 점검 중...',
            '거의 다 왔어요...',
            '최종 마무리 중...',
            '품질을 검증하는 중...'
        ];

        // 랜덤 초기 메시지
        const randomIndex = Math.floor(Math.random() * loadingMessages.length);
        const messageId = this.addMessage('assistant', loadingMessages[randomIndex]);
        const messageElement = document.getElementById(messageId);

        if (messageElement) {
            messageElement.classList.add('loading');

            // 사용된 메시지 추적 (중복 방지)
            const usedMessages = new Set([randomIndex]);

            // 2초마다 메시지 변경 (랜덤 선택)
            const interval = setInterval(() => {
                // 모든 메시지를 사용했으면 리셋
                if (usedMessages.size >= loadingMessages.length) {
                    usedMessages.clear();
                }

                // 아직 사용하지 않은 메시지 중에서 랜덤 선택
                let nextIndex;
                do {
                    nextIndex = Math.floor(Math.random() * loadingMessages.length);
                } while (usedMessages.has(nextIndex) && usedMessages.size < loadingMessages.length);

                usedMessages.add(nextIndex);
                messageElement.textContent = loadingMessages[nextIndex];
            }, 2000);

            // interval ID 저장 (나중에 제거하기 위해)
            this.loadingIntervals.set(messageId, interval);
        }

        return messageId;
    }
    
    /**
     * 메시지 추가 (내부)
     * @param {string} type - 메시지 타입 ('user', 'assistant', 'system')
     * @param {string} content - 메시지 내용
     * @returns {string} 메시지 ID
     * @private
     */
    /**
     * 간단한 마크다운 → HTML 변환
     * @param {string} text - 마크다운 텍스트
     * @returns {string} HTML 문자열
     * @private
     */
    _renderMarkdown(text) {
        // XSS 방지: HTML 엔티티 이스케이프
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 코드 블록 (```...```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g,
            (_, lang, code) => `<pre><code>${code.trim()}</code></pre>`);

        // 인라인 코드 (`...`)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 헤더 (###, ##, #)
        html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

        // 굵게 (**...**)
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // 이탤릭 (*...*)
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // 리스트 (- item)
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);

        // 번호 리스트 (1. item)
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        // 수평선 (---)
        html = html.replace(/^---$/gm, '<hr>');

        // 줄바꿈 (연속 줄바꿈은 단락, 단일은 <br>)
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        // 단락 감싸기
        if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<pre')) {
            html = `<p>${html}</p>`;
        }

        return html;
    }

    addMessage(type, content) {
        const messageId = `msg-${++this.messageIdCounter}`;

        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `ai-message ${type}`;

        // assistant 메시지는 마크다운 렌더링, 나머지는 텍스트
        if (type === 'assistant') {
            messageDiv.innerHTML = this._renderMarkdown(content);
            messageDiv.classList.add('markdown');
        } else {
            messageDiv.textContent = content;
        }

        this.elements.messages.appendChild(messageDiv);
        
        // 애니메이션
        setTimeout(() => {
            messageDiv.classList.add('visible');
        }, 10);
        
        // 자동 스크롤
        if (this.options.autoScroll) {
            this.scrollToBottom();
        }
        
        return messageId;
    }
    
    /**
     * 메시지 업데이트
     * @param {string} messageId - 메시지 ID
     * @param {string} newContent - 새로운 내용
     */
    updateMessage(messageId, newContent) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.textContent = newContent;
        }
    }
    
    /**
     * 메시지 제거
     * @param {string} messageId - 메시지 ID
     */
    removeMessage(messageId) {
        // 로딩 interval이 있으면 clear
        if (this.loadingIntervals.has(messageId)) {
            clearInterval(this.loadingIntervals.get(messageId));
            this.loadingIntervals.delete(messageId);
        }

        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.classList.add('fade-out');
            setTimeout(() => {
                messageElement.remove();
            }, 300);
        }
    }
    
    /**
     * 모든 메시지 클리어
     */
    clearMessages() {
        // 모든 로딩 interval clear
        for (const interval of this.loadingIntervals.values()) {
            clearInterval(interval);
        }
        this.loadingIntervals.clear();

        this.elements.messages.innerHTML = '';
        this.messageIdCounter = 0;
    }
    
    /**
     * 패널 토글 (열기/닫기)
     */
    toggle() {
        if (this.elements.panel) {
            this.elements.panel.classList.toggle('open');

            const isOpen = this.elements.panel.classList.contains('open');
            logger.debug(`💬 Chat panel ${isOpen ? 'opened' : 'closed'}`);

            // 뷰어 컨테이너 조정
            const viewerContainer = document.querySelector('.viewer-container') || document.querySelector('.hanview-body-container');
            if (viewerContainer) {
                if (isOpen) {
                    viewerContainer.classList.add('ai-panel-open');
                } else {
                    viewerContainer.classList.remove('ai-panel-open');
                }
            }

            // 열릴 때 입력창에 포커스
            if (isOpen && this.elements.input) {
                setTimeout(() => {
                    this.elements.input.focus();
                }, 300);
            }
        }
    }
    
    /**
     * 패널 열기
     */
    open() {
        if (this.elements.panel) {
            this.elements.panel.classList.add('open');

            // 뷰어 컨테이너 조정
            const viewerContainer = document.querySelector('.viewer-container');
            if (viewerContainer) {
                viewerContainer.classList.add('ai-panel-open');
            }

            if (this.elements.input) {
                setTimeout(() => {
                    this.elements.input.focus();
                }, 300);
            }
        }
    }
    
    /**
     * 패널 닫기
     */
    close() {
        if (this.elements.panel) {
            this.elements.panel.classList.remove('open');

            // 뷰어 컨테이너 조정
            const viewerContainer = document.querySelector('.viewer-container');
            if (viewerContainer) {
                viewerContainer.classList.remove('ai-panel-open');
            }
        }
    }
    
    /**
     * 하단으로 스크롤
     * @private
     */
    scrollToBottom() {
        if (this.elements.messages) {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        }
    }
    
    /**
     * API 키 입력 프롬프트
     * @private
     */
    promptForApiKey() {
        const apiKey = prompt(
            'OpenAI API 키를 입력하세요:\n\n' +
            '⚠️ 보안 안내: API 키는 브라우저 세션에만 저장되며,\n' +
            '탭을 닫으면 자동 삭제됩니다.\n' +
            '프로덕션 환경에서는 서버 프록시 사용을 권장합니다.'
        );
        
        if (apiKey && apiKey.trim()) {
            try {
                this.aiController.setApiKey(apiKey.trim());
                this.addSystemMessage('[완료] API 키가 설정되었습니다. 이제 AI 기능을 사용할 수 있습니다!');
                this.updateApiKeyStatus();
                showToast('success', '성공', 'API 키가 설정되었습니다');
            } catch (error) {
                this.addSystemMessage(`[오류] API 키 설정 실패: ${error.message}`);
                showToast('error', '오류', 'API 키 설정 실패');
            }
        }
    }
    
    /**
     * API 키 상태 업데이트
     * @private
     */
    updateApiKeyStatus() {
        if (this.elements.apiKeyButton) {
            const hasKey = this.aiController.hasApiKey();
            this.elements.apiKeyButton.textContent = hasKey ? 'API 키 변경' : 'API 키 설정';
            this.elements.apiKeyButton.classList.toggle('has-key', hasKey);
        }
    }
    
    /**
     * 입력 활성화/비활성화
     * @param {boolean} enabled - 활성화 여부
     */
    setInputEnabled(enabled) {
        if (this.elements.input) {
            this.elements.input.disabled = !enabled;
        }
        
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = !enabled;
        }
    }
    
    /**
     * 입력창에 텍스트 설정
     * @param {string} text - 설정할 텍스트
     */
    setInput(text) {
        if (this.elements.input) {
            this.elements.input.value = text;
            this.elements.input.focus();
        }
    }
    
    /**
     * 상태 메시지 표시
     * @param {string} message - 상태 메시지
     */
    showStatus(message) {
        // 상태 메시지는 시스템 메시지로 표시
        this.addSystemMessage(`[정보] ${message}`);
    }
    
    /**
     * 문서 저장 처리
     * @private
     */
    async handleSaveDocument() {
        try {
            logger.info('💾 문서 저장 시작...');
            
            // 저장할 문서가 있는지 확인
            const hasDocument = this.aiController.hasUpdatedDocument() || 
                               this.aiController.viewer.getDocument();
            
            if (!hasDocument) {
                this.addSystemMessage('[알림] 저장할 문서가 없습니다.');
                showToast('저장할 문서가 없습니다', 'warning');
                return;
            }
            
            // 파일명 입력 받기
            const defaultFilename = 'document_ai_edited.hwpx';
            const filename = prompt('저장할 파일명을 입력하세요:', defaultFilename);
            
            if (!filename) {
                logger.info('저장 취소됨');
                return;
            }
            
            // 로딩 메시지
            const loadingMessageId = this.addLoadingMessage('HWPX 파일 생성 중...');
            
            // 저장 버튼 비활성화
            if (this.elements.saveButton) {
                this.elements.saveButton.disabled = true;
            }
            
            // HWPX 저장
            const result = await this.aiController.saveAsHwpx(filename);
            
            // 로딩 메시지 제거
            this.removeMessage(loadingMessageId);

            // 성공 메시지
            this.addSystemMessage(`[완료] ${result.message}`);
            showToast(`파일이 저장되었습니다: ${filename}`, 'success');
            
            logger.info('✅ 문서 저장 완료');
            
        } catch (error) {
            logger.error('❌ 문서 저장 실패:', error);
            
            // 로딩 메시지 제거
            this.removeMessage(this.messageIdCounter - 1);
            
            // 에러 메시지
            this.addErrorMessage(`문서 저장 실패: ${error.message || '알 수 없는 오류'}`);
            showToast('문서 저장에 실패했습니다', 'error');
            
        } finally {
            // 저장 버튼 활성화
            if (this.elements.saveButton) {
                this.elements.saveButton.disabled = false;
            }
        }
    }
    
    /**
     * 🆕 커스텀 API 설정 모달 표시
     * @private
     */
    showCustomApiSettings() {
        logger.info('🔌 Opening Custom API settings modal');
        
        // 모달 HTML 생성
        const modal = document.createElement('div');
        modal.className = 'custom-api-modal';
        modal.id = 'custom-api-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>커스텀 API 설정</h2>
                    <button class="modal-close" id="modal-close-btn">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="enable-custom-api"
                                   ${AIConfig.custom.isEnabled() ? 'checked' : ''}>
                            <span>커스텀 API 사용</span>
                        </label>
                        <p class="help-text">
                            체크 시 OpenAI 대신 아래 설정한 API를 사용합니다.
                        </p>
                    </div>
                    
                    <div class="form-group">
                        <label>API 엔드포인트 *</label>
                        <input type="text" 
                               id="custom-endpoint" 
                               placeholder="https://your-api.com/v1/chat/completions"
                               value="${escapeHtml(AIConfig.custom.getEndpoint() || '')}"
                               ${!AIConfig.custom.isEnabled() ? 'disabled' : ''}>
                        <p class="help-text">
                            OpenAI 호환 형식의 엔드포인트를 입력하세요.
                        </p>
                    </div>

                    <div class="form-group">
                        <label>API Key *</label>
                        <input type="password"
                               id="custom-api-key"
                               placeholder="your-api-key-here"
                               value="${escapeHtml(AIConfig.custom.getApiKey() || '')}"
                               ${!AIConfig.custom.isEnabled() ? 'disabled' : ''}>
                        <p class="help-text">
                            Bearer Token으로 사용됩니다.
                        </p>
                    </div>
                    
                    <div class="status-message" id="status-message"></div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-secondary" id="test-connection-btn">
                        연결 테스트
                    </button>
                    <button class="btn-primary" id="save-custom-api-btn">
                        저장
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 이벤트 리스너 설정
        this.setupModalListeners(modal);
    }
    
    /**
     * 🆕 모달 이벤트 리스너 설정
     * @param {HTMLElement} modal - 모달 요소
     * @private
     */
    setupModalListeners(modal) {
        // 닫기 버튼
        const closeBtn = modal.querySelector('#modal-close-btn');
        const backdrop = modal.querySelector('.modal-backdrop');
        
        const closeModal = () => {
            modal.remove();
            logger.info('🔌 Custom API settings modal closed');
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
        
        // 체크박스 - 입력 필드 활성화/비활성화
        const checkbox = modal.querySelector('#enable-custom-api');
        const endpoint = modal.querySelector('#custom-endpoint');
        const apiKey = modal.querySelector('#custom-api-key');
        
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                if (endpoint) endpoint.disabled = !enabled;
                if (apiKey) apiKey.disabled = !enabled;
            });
        }
        
        // 연결 테스트 버튼
        const testBtn = modal.querySelector('#test-connection-btn');
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                await this.testCustomApiConnection(modal);
            });
        }
        
        // 저장 버튼
        const saveBtn = modal.querySelector('#save-custom-api-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveCustomApiSettings(modal);
            });
        }
    }
    
    /**
     * 🆕 커스텀 API 연결 테스트
     * @param {HTMLElement} modal - 모달 요소
     * @private
     */
    async testCustomApiConnection(modal) {
        const statusDiv = modal.querySelector('#status-message');
        const testBtn = modal.querySelector('#test-connection-btn');
        
        if (!statusDiv || !testBtn) return;
        
        // 임시 저장
        const originalEnabled = AIConfig.custom.isEnabled();
        const originalEndpoint = AIConfig.custom.getEndpoint();
        const originalKey = AIConfig.custom.getApiKey();
        
        try {
            // 입력값으로 임시 설정
            const checkbox = modal.querySelector('#enable-custom-api');
            const endpointInput = modal.querySelector('#custom-endpoint');
            const apiKeyInput = modal.querySelector('#custom-api-key');
            
            if (!checkbox || !endpointInput || !apiKeyInput) {
                throw new Error('필수 입력 필드를 찾을 수 없습니다');
            }
            
            AIConfig.custom.setEnabled(checkbox.checked);
            AIConfig.custom.setEndpoint(endpointInput.value);
            AIConfig.custom.setApiKey(apiKeyInput.value);
            
            // 검증
            const validation = AIConfig.custom.validate();
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // 테스트
            testBtn.disabled = true;
            statusDiv.textContent = '[테스트] 연결 테스트 중...';
            statusDiv.className = 'status-message info';

            const result = await this.aiController.generator.testConnection();

            if (result.success) {
                statusDiv.textContent = `[완료] ${result.message}`;
                statusDiv.className = 'status-message success';
                logger.info('✅ Custom API connection test passed');
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            statusDiv.textContent = `[오류] ${error.message}`;
            statusDiv.className = 'status-message error';
            logger.error('❌ Custom API connection test failed:', error);
        } finally {
            testBtn.disabled = false;
            
            // 원래 설정 복원
            AIConfig.custom.setEnabled(originalEnabled);
            if (originalEndpoint) AIConfig.custom.setEndpoint(originalEndpoint);
            if (originalKey) AIConfig.custom.setApiKey(originalKey);
        }
    }
    
    /**
     * 🆕 커스텀 API 설정 저장
     * @param {HTMLElement} modal - 모달 요소
     * @private
     */
    saveCustomApiSettings(modal) {
        const statusDiv = modal.querySelector('#status-message');
        
        if (!statusDiv) return;
        
        try {
            const checkbox = modal.querySelector('#enable-custom-api');
            const endpointInput = modal.querySelector('#custom-endpoint');
            const apiKeyInput = modal.querySelector('#custom-api-key');
            
            if (!checkbox || !endpointInput || !apiKeyInput) {
                throw new Error('필수 입력 필드를 찾을 수 없습니다');
            }
            
            const enabled = checkbox.checked;
            const endpoint = endpointInput.value.trim();
            const apiKey = apiKeyInput.value.trim();
            
            // 활성화 시 검증
            if (enabled) {
                if (!endpoint || !apiKey) {
                    throw new Error('엔드포인트와 API 키를 모두 입력하세요');
                }
                
                // URL 형식 검증
                new URL(endpoint);
            }
            
            // 저장
            AIConfig.custom.setEnabled(enabled);
            if (enabled) {
                AIConfig.custom.setEndpoint(endpoint);
                AIConfig.custom.setApiKey(apiKey);
            }
            
            statusDiv.textContent = '[완료] 설정이 저장되었습니다';
            statusDiv.className = 'status-message success';

            const message = enabled ?
                `[완료] 커스텀 API가 활성화되었습니다: ${endpoint}` :
                '[완료] OpenAI API로 전환되었습니다';

            this.addSystemMessage(message);
            logger.info('✅ Custom API settings saved');
            
            // 2초 후 모달 닫기
            setTimeout(() => {
                modal.remove();
            }, 2000);
            
        } catch (error) {
            statusDiv.textContent = `[오류] ${error.message}`;
            statusDiv.className = 'status-message error';
            logger.error('❌ Failed to save custom API settings:', error);
        }
    }
    
    // ===================================
    // 🆕 AI 기능 핸들러 메서드들
    // ===================================
    
    // ===================================
    // AI 어시스턴트 퀵 액션
    // ===================================

    /**
     * 어시스턴트 퀵 액션 실행
     * 문서 내용을 분석하여 결과를 채팅에 표시 (문서 수정 없음)
     * @param {string} prompt - AI에게 보낼 프롬프트
     * @private
     */
    /**
     * HWP/HWPX 파일에서 텍스트 추출
     * @param {File} file - 파일
     * @param {string} ext - 확장자 (.hwp 또는 .hwpx)
     * @returns {Promise<string>} 추출된 텍스트
     * @private
     */
    async _extractTextFromHwp(file, ext) {
        let arrayBuf = await file.arrayBuffer();

        // HWP → HWPX 변환
        if (ext === '.hwp') {
            try {
                const { Hwp2Hwpx } = await import('@hwp2hwpx/core/Hwp2Hwpx');
                const uint8 = new Uint8Array(arrayBuf);
                const hwpxBinary = await Hwp2Hwpx.convert(uint8);
                arrayBuf = hwpxBinary.buffer || hwpxBinary;
                logger.info(`✅ HWP → HWPX 변환 완료: ${file.name}`);
            } catch (convertErr) {
                logger.error('❌ HWP conversion failed:', convertErr);
                return `(HWP 변환 실패: ${convertErr.message})`;
            }
        }

        // HWPX 파싱
        let text = '';
        try {
            if (this.aiController.viewer && this.aiController.viewer.parser) {
                const parsed = await this.aiController.viewer.parser.parse(arrayBuf);
                if (parsed && parsed.sections) {
                    text = this._extractTextFromSections(parsed.sections);
                }
            }
        } catch (parseErr) {
            logger.error('❌ HWPX parse failed:', parseErr);
        }
        return text.trim() || '(파일 내용을 추출하지 못했습니다)';
    }

    /**
     * 파싱된 섹션에서 텍스트 추출
     * @param {Array} sections - 파싱된 섹션 배열
     * @returns {string} 추출된 텍스트
     * @private
     */
    _extractTextFromSections(sections) {
        let text = '';
        (sections || []).forEach(s => {
            (s.elements || []).forEach(el => {
                if (el.type === 'paragraph' && el.runs) {
                    text += el.runs.map(r => r.text || '').join('') + '\n';
                } else if (el.type === 'table' && el.rows) {
                    el.rows.forEach(row => {
                        (row.cells || []).forEach(cell => {
                            (cell.elements || []).forEach(ce => {
                                if (ce.runs) text += ce.runs.map(r => r.text || '').join('') + '\t';
                            });
                        });
                        text += '\n';
                    });
                }
            });
        });
        return text;
    }

    /**
     * 레퍼런스 파일 처리
     * @param {FileList} files - 업로드된 파일들
     * @private
     */
    async _handleReferenceFiles(files) {
        const fileListEl = document.getElementById('ai-ref-files');
        const supported = ['.txt', '.md', '.csv', '.json', '.html', '.xml', '.hwpx', '.hwp'];

        for (const file of files) {
            const ext = '.' + file.name.split('.').pop().toLowerCase();

            if (!supported.includes(ext)) {
                this.addSystemMessage(`[알림] 지원하지 않는 파일 형식입니다: ${file.name}`);
                continue;
            }

            try {
                let text = '';

                if (ext === '.hwp' || ext === '.hwpx') {
                    text = await this._extractTextFromHwp(file, ext);
                } else {
                    text = await file.text();
                }

                // 너무 긴 텍스트는 잘라내기
                const maxLen = 8000;
                const truncated = text.length > maxLen;
                const finalText = truncated ? text.substring(0, maxLen) + '\n...(이하 생략)' : text;

                this._referenceTexts.push({
                    name: file.name,
                    size: file.size,
                    text: finalText,
                });

                // UI에 파일 표시
                if (fileListEl) {
                    fileListEl.style.display = '';
                    const item = document.createElement('div');
                    item.className = 'ai-ref-file-item';
                    const idx = this._referenceTexts.length - 1;
                    const sizeStr = file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`;
                    item.innerHTML = `<span class="ref-name">${file.name}</span><span class="ref-size">${sizeStr}${truncated ? ' (일부)' : ''}</span><button class="ref-remove" data-idx="${idx}">&times;</button>`;
                    item.querySelector('.ref-remove').addEventListener('click', () => {
                        this._referenceTexts[idx] = null;
                        item.remove();
                        if (!this._referenceTexts.some(r => r !== null)) {
                            fileListEl.style.display = 'none';
                        }
                    });
                    fileListEl.appendChild(item);
                }

                const sizeStr2 = file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`;
                this.addSystemMessage(`[레퍼런스] "${file.name}" 로드 완료 (${sizeStr2}). AI 대화에서 참고 자료로 활용됩니다.`);

            } catch (err) {
                logger.error('❌ Reference file read failed:', err);
                this.addSystemMessage(`[오류] 파일 읽기 실패: ${file.name} — ${err.message}`);
            }
        }
    }

    /**
     * 레퍼런스 텍스트를 프롬프트에 포함할 문자열로 반환
     * @returns {string} 레퍼런스 컨텍스트 문자열
     * @private
     */
    _getReferenceContext() {
        const refs = (this._referenceTexts || []).filter(r => r !== null);
        if (refs.length === 0) return '';
        return '\n\n[참고 자료]\n' + refs.map((r, i) =>
            `--- ${r.name} ---\n${r.text}`
        ).join('\n\n');
    }

    /**
     * 자유 대화 모드 (문서 없이 AI와 대화)
     * "문서로 만들어줘" 등의 키워드 감지 시 AI 응답을 문서로 변환
     * @param {string} message - 사용자 메시지
     * @private
     */
    async _handleFreeChat(message) {
        const loadingId = this.addLoadingMessage('AI와 대화 중...');

        try {
            // 대화 히스토리 관리 (컨텍스트 유지)
            if (!this._chatHistory) {
                this._chatHistory = [
                    { role: 'system', content: '당신은 만능 AI 어시스턴트입니다. 한국어로 친절하게 응답해주세요. 사용자가 문서 작성, 기획, 아이디어 등을 요청하면 구체적이고 실용적인 내용을 제공해주세요.' }
                ];
            }

            // 레퍼런스 자료가 있으면 메시지에 포함
            const refContext = this._getReferenceContext();
            const userContent = refContext ? message + refContext : message;
            this._chatHistory.push({ role: 'user', content: userContent });

            // 히스토리가 너무 길면 최근 20개만 유지
            if (this._chatHistory.length > 21) {
                this._chatHistory = [this._chatHistory[0], ...this._chatHistory.slice(-20)];
            }

            const apiResponse = await this.aiController.generator.callAPIWithRetry(this._chatHistory);
            const responseText = apiResponse?.choices?.[0]?.message?.content || '응답을 받지 못했습니다.';

            // 히스토리에 응답 추가
            this._chatHistory.push({ role: 'assistant', content: responseText });

            this.removeMessage(loadingId);

            // 문서화 요청 감지
            if (this._isDocumentCreateRequest(message)) {
                // AI 응답을 마크다운 문서로 변환하여 에디터에 로드
                try {
                    const { markdownToDocument } = await import('../utils/markdown-to-document.js');
                    const doc = markdownToDocument(responseText);
                    await this.aiController.viewer.createNewDocument(doc);
                    this.addAssistantMessage('문서가 에디터에 생성되었습니다. 파일 > 저장으로 HWPX 파일을 저장할 수 있습니다.\n\n' + responseText);
                    showToast('success', '문서 생성 완료', '에디터에 문서가 로드되었습니다');
                } catch (docError) {
                    logger.error('❌ Document creation failed:', docError);
                    const msgId = this.addAssistantMessage(responseText);
                    this._addCopyButton(msgId, responseText);
                    this.addSystemMessage('[알림] 문서 변환에 실패했습니다. 위 내용을 복사하여 사용해주세요.');
                }
            } else {
                const msgId = this.addAssistantMessage(responseText);
                this._addCopyButton(msgId, responseText);
            }
        } catch (error) {
            this.removeMessage(loadingId);
            logger.error('❌ Free chat failed:', error);
            this.addAssistantMessage(`[오류] AI 응답 실패: ${error.message}`);
        }
    }

    async _executeAssistantAction(prompt) {
        logger.info('🤖 AI Assistant action:', prompt.substring(0, 40));

        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키가 설정되지 않았습니다. 프록시 서버(npm run proxy)를 실행하거나 .env에 API 키를 설정해주세요.');
            return;
        }

        // 문서 텍스트 추출: 데이터 모델 또는 DOM에서 직접 추출
        let docText = '';
        const doc = this.aiController.viewer.getDocument();
        if (doc && doc.sections) {
            (doc.sections || []).forEach(section => {
                (section.elements || []).forEach(el => {
                    if (el.type === 'paragraph' && el.runs) {
                        docText += el.runs.map(r => r.text || '').join('') + '\n';
                    } else if (el.type === 'table' && el.rows) {
                        el.rows.forEach(row => {
                            (row.cells || []).forEach(cell => {
                                (cell.elements || []).forEach(ce => {
                                    if (ce.runs) docText += ce.runs.map(r => r.text || '').join('') + '\t';
                                });
                        });
                        docText += '\n';
                    });
                }
            });
        });
        } else {
            // DOM에서 직접 텍스트 추출 (새 문서 편집 중)
            const container = this.aiController.viewer.container;
            if (container) {
                docText = container.textContent || '';
                docText = docText.replace(/\s+/g, ' ').trim();
            }
        }

        if (!docText.trim()) {
            this.addSystemMessage('[알림] 분석할 문서 내용이 없습니다. 텍스트를 입력한 후 다시 시도해주세요.');
            return;
        }

        // 사용자 메시지 표시
        this.addUserMessage(prompt);
        const loadingId = this.addLoadingMessage('AI가 분석 중입니다...');

        try {
            // AI 호출 (문서 컨텍스트 + 프롬프트)
            const refContext = this._getReferenceContext();
            const fullPrompt = `다음 문서를 기반으로 요청에 응답해줘.\n\n[문서 내용]\n${docText.substring(0, 4000)}${refContext}\n\n[요청]\n${prompt}`;

            if (this.aiController.generator) {
                // GPT API 직접 호출 (문서 수정 없이 텍스트만 생성)
                const messages = [
                    { role: 'system', content: '당신은 문서 분석 및 업무 지원 전문 AI 어시스턴트입니다. 한국어로 응답해주세요.' },
                    { role: 'user', content: fullPrompt }
                ];
                const apiResponse = await this.aiController.generator.callAPIWithRetry(messages);
                const responseText = apiResponse?.choices?.[0]?.message?.content || '응답을 받지 못했습니다.';
                this.removeMessage(loadingId);
                const messageId = this.addAssistantMessage(responseText);
                this._addCopyButton(messageId, responseText);
            } else {
                this.removeMessage(loadingId);
                this.elements.input.value = prompt;
                await this.handleSendMessage();
            }
        } catch (error) {
            this.removeMessage(loadingId);
            logger.error('❌ AI Assistant action failed:', error);
            this.addSystemMessage(`[오류] AI 응답 실패: ${error.message}`);
        }
    }

    /**
     * 메시지에 클립보드 복사 버튼 추가
     * @param {string} messageId - 메시지 ID
     * @param {string} text - 복사할 텍스트
     * @private
     */
    _addCopyButton(messageId, text) {
        const msgEl = this.elements.messages?.querySelector(`[data-message-id="${messageId}"]`);
        if (!msgEl) return;

        const btn = document.createElement('button');
        btn.className = 'ai-copy-btn';
        btn.textContent = '📋 복사';
        btn.title = '결과를 클립보드에 복사';
        btn.style.cssText = 'margin-top:8px;padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;cursor:pointer;font-size:12px;';
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                btn.textContent = '✅ 복사됨';
                setTimeout(() => { btn.textContent = '📋 복사'; }, 2000);
            } catch {
                // fallback
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                btn.textContent = '✅ 복사됨';
                setTimeout(() => { btn.textContent = '📋 복사'; }, 2000);
            }
        });
        msgEl.appendChild(btn);
    }

    /**
     * 문서 구조 보기
     */
    handlePreviewStructure() {
        logger.info('📊 문서 구조 보기 클릭');
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            showToast('warning', '알림', '문서가 없습니다');
            return;
        }
        
        try {
            // 문서 구조 추출
            const pairs = this.aiController.extractor.extractTableHeaderContentPairs(document);
            
            // 구조 정보 생성
            let structureInfo = `📊 문서 구조 분석 결과\n\n`;
            structureInfo += `📄 섹션 수: ${document.sections?.length || 0}개\n`;
            structureInfo += `📋 추출된 항목: ${pairs.length}개\n\n`;
            
            if (pairs.length > 0) {
                structureInfo += `🔑 헤더 목록:\n`;
                pairs.forEach((pair, idx) => {
                    const contentPreview = pair.content 
                        ? pair.content.substring(0, 30) + (pair.content.length > 30 ? '...' : '')
                        : '(비어있음)';
                    structureInfo += `  ${idx + 1}. [${pair.header || '(제목없음)'}] → "${contentPreview}"\n`;
                });
            }
            
            this.addAssistantMessage(structureInfo);
            logger.info(`✅ 문서 구조 분석 완료: ${pairs.length}개 항목`);
            
        } catch (error) {
            logger.error('❌ 문서 구조 분석 실패:', error);
            this.addSystemMessage(`[오류] 문서 구조 분석 실패: ${error.message}`);
        }
    }
    
    /**
     * 스타일 적용 (일관된 서식 자동 적용)
     */
    async handleApplyStyle() {
        logger.info('🎨 스타일 적용 클릭');
        
        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키를 먼저 설정해주세요.');
            this.promptForApiKey();
            return;
        }
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }
        
        // 스타일 옵션 선택
        const styleOptions = [
            '1. 공식 문서 스타일 (격식체)',
            '2. 친근한 스타일 (비격식체)',
            '3. 어린이용 쉬운 표현',
            '4. 전문 보고서 스타일',
            '5. 교육용 설명 스타일'
        ].join('\n');
        
        const choice = prompt(`적용할 스타일을 선택하세요:\n\n${styleOptions}\n\n번호 입력:`);
        
        if (!choice) return;
        
        const styleMap = {
            '1': '공식 문서처럼 격식체로 통일해줘',
            '2': '친근하고 부드러운 말투로 바꿔줘',
            '3': '초등학생도 이해할 수 있게 쉽게 바꿔줘',
            '4': '전문 보고서처럼 간결하고 명확하게 바꿔줘',
            '5': '선생님이 학생에게 설명하듯이 교육적으로 바꿔줘'
        };
        
        const styleRequest = styleMap[choice];
        if (!styleRequest) {
            this.addSystemMessage('[알림] 올바른 번호를 입력해주세요.');
            return;
        }
        
        // 입력창에 요청 설정 후 전송
        this.elements.input.value = styleRequest;
        await this.handleSendMessage();
    }
    
    /**
     * 템플릿 추출 (헤더만 남기고 내용 제거)
     */
    async handleExtractTemplate() {
        logger.info('📝 템플릿 추출 클릭');
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }
        
        const confirmExtract = confirm(
            '템플릿 추출을 진행하시겠습니까?\n\n' +
            '이 기능은 문서의 구조(헤더)는 유지하고 내용은 빈칸으로 만듭니다.\n' +
            '추출된 템플릿은 새 HWPX 파일로 저장됩니다.'
        );
        
        if (!confirmExtract) return;
        
        const loadingId = this.addLoadingMessage('템플릿 추출 중...');
        
        try {
            // 문서 딥 복사
            const templateDocument = JSON.parse(JSON.stringify(document));
            
            // 모든 셀의 내용을 빈칸으로 변환
            let clearedCount = 0;
            
            templateDocument.sections?.forEach(section => {
                section.elements?.forEach(element => {
                    if (element.type === 'table') {
                        element.rows?.forEach((row, rowIdx) => {
                            row.cells?.forEach((cell, cellIdx) => {
                                // 헤더 판별 개선: 첫 번째 행은 무조건 헤더
                                if (rowIdx === 0) {
                                    return; // 첫 행은 건너뜀
                                }
                                
                                // 셀의 전체 텍스트 추출 (재귀적)
                                const getCellText = (elements) => {
                                    let text = '';
                                    elements?.forEach(el => {
                                        if (el.type === 'paragraph' && el.runs) {
                                            el.runs.forEach(run => {
                                                text += run.text || '';
                                            });
                                        } else if (el.type === 'container' && el.elements) {
                                            text += getCellText(el.elements);
                                        }
                                    });
                                    return text;
                                };
                                
                                const cellText = getCellText(cell.elements);
                                const cellTextLength = cellText.trim().length;
                                
                                // 디버깅: 첫 번째 열의 셀 정보 출력
                                if (cellIdx === 0) {
                                    const preview = cellText.trim().substring(0, 50);
                                    logger.debug(`[템플릿추출] Row ${rowIdx}, Col ${cellIdx}: "${preview}..." (${cellTextLength}자)`);
                                }
                                
                                // 첫 번째 열이면서 30자 이하면 헤더로 유지
                                const isHeaderLabel = cellIdx === 0 && cellTextLength <= 30;
                                
                                if (!isHeaderLabel && cell.elements) {
                                    // 재귀적으로 모든 텍스트 제거
                                    const clearText = (elements) => {
                                        elements?.forEach(el => {
                                            if (el.type === 'paragraph' && el.runs) {
                                                el.runs.forEach(run => {
                                                    if (run.text && run.text.trim()) {
                                                        run.text = '';  // 내용 제거
                                                        clearedCount++;
                                                    }
                                                });
                                            } else if (el.type === 'container' && el.elements) {
                                                clearText(el.elements);
                                            }
                                        });
                                    };
                                    
                                    clearText(cell.elements);
                                    
                                    // 디버깅: 제거 확인
                                    if (cellIdx === 0) {
                                        logger.debug(`  → 제거됨 (${cellTextLength}자 > 30자)`);
                                    }
                                } else if (cellIdx === 0) {
                                    logger.debug(`  → 유지됨 (${cellTextLength}자 ≤ 30자, 헤더)`);
                                }
                            });
                        });
                    }
                });
            });
            
            this.removeMessage(loadingId);
            
            // 결과 메시지
            this.addAssistantMessage(
                `✅ 템플릿 추출 완료!\n\n` +
                `- 제거된 내용: ${clearedCount}개 텍스트\n` +
                `- 헤더(첫 행/열)는 유지됨\n\n` +
                `📥 HWPX 저장 버튼을 눌러 템플릿을 저장하세요.`
            );
            
            // 업데이트된 문서 저장
            this.aiController.state.updatedDocument = templateDocument;
            await this.aiController.viewer.updateDocument(templateDocument);
            
            showToast('success', '완료', '템플릿이 추출되었습니다');
            
        } catch (error) {
            this.removeMessage(loadingId);
            logger.error('❌ 템플릿 추출 실패:', error);
            this.addSystemMessage(`[오류] 템플릿 추출 실패: ${error.message}`);
        }
    }

    /**
     * 템플릿 채우기 - 레이아웃 유지하고 AI로 전체 내용 채우기
     */
    async handleFillTemplate() {
        logger.info('Template fill clicked');

        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 HWPX 문서를 로드해주세요.');
            return;
        }

        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키를 먼저 설정해주세요.');
            this.promptForApiKey();
            return;
        }

        // 문서 구조 미리보기 - 어떤 헤더들이 있는지 보여주기
        const pairs = this.aiController.extractor.extractTableHeaderContentPairs(document);
        const headers = [];
        document.sections?.forEach(section => {
            section.elements?.forEach(element => {
                if (element.type === 'table') {
                    element.rows?.forEach((row, rowIdx) => {
                        if (rowIdx === 0) return;
                        const cells = row.cells || [];
                        cells.forEach((cell, cellIdx) => {
                            if (cellIdx === 0) {
                                const text = this.aiController._getCellText(cell).trim();
                                if (text.length > 0 && text.length <= 30) {
                                    headers.push(text);
                                }
                            }
                        });
                    });
                }
            });
        });

        const headerList = headers.length > 0
            ? headers.map(h => `  - ${h}`).join('\n')
            : '  (헤더를 찾지 못했습니다)';

        // 사용자에게 주제 입력 받기
        const userRequest = prompt(
            '문서의 레이아웃은 유지하고, 내용을 AI가 새로 채웁니다.\n\n' +
            '감지된 항목:\n' + headerList + '\n\n' +
            '어떤 내용으로 채울까요?\n' +
            '예시:\n' +
            '- 3월 봄맞이 유치원 알림장\n' +
            '- 5세반 여름 놀이 활동 계획안\n' +
            '- 신입원아 적응 프로그램 안내문'
        );

        if (!userRequest) return;

        // 사용자 메시지 표시
        this.addUserMessage(`[템플릿 채우기] ${userRequest}`);

        const loadingId = this.addLoadingMessage(
            `레이아웃을 유지하고 "${userRequest}" 주제로 내용을 생성하는 중...`
        );

        try {
            const result = await this.aiController.fillTemplate(userRequest);

            this.removeMessage(loadingId);

            // 결과 메시지
            const meta = result.metadata;
            const generatedHeaders = meta.headers || [];
            const contentPreview = generatedHeaders.map(h => {
                const content = meta.generatedContent[h];
                const preview = content ? content.substring(0, 40) + '...' : '(생성 실패)';
                return `  ${h}: ${preview}`;
            }).join('\n');

            this.addAssistantMessage(
                `[완료] 템플릿 채우기가 완료되었습니다!\n\n` +
                `- 비운 셀: ${meta.clearedCount}개\n` +
                `- 생성된 항목: ${meta.itemsGenerated}개\n` +
                `- 토큰 사용량: ${meta.tokensUsed}\n\n` +
                `생성된 내용:\n${contentPreview}\n\n` +
                `되돌리기: "원본으로 되돌리기" 버튼 또는 Ctrl+Z`
            );

            showToast('success', '완료', `${meta.itemsGenerated}개 항목이 생성되었습니다`);

        } catch (error) {
            this.removeMessage(loadingId);
            logger.error('Template fill failed:', error);
            this.addSystemMessage(`[오류] 템플릿 채우기 실패: ${error.message}`);
            showToast('error', '실패', error.message);
        }
    }


    /**
     * 다시 생성 (다른 주제/난이도로 재생성)
     */
    async handleRegenerate() {
        logger.info('🔄 다시 생성 클릭');
        
        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키를 먼저 설정해주세요.');
            this.promptForApiKey();
            return;
        }
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }
        
        const newRequest = prompt(
            '새로운 요청사항을 입력하세요:\n\n' +
            '예시:\n' +
            '- 다른 주제로 바꿔줘 (예: 봄 → 여름)\n' +
            '- 더 상세하게 작성해줘\n' +
            '- 더 간결하게 요약해줘\n' +
            '- 다른 연령대에 맞게 바꿔줘'
        );
        
        if (!newRequest) return;
        
        // 이전 상태로 되돌리기 (원본 유지)
        if (this.aiController.state.originalDocument) {
            await this.aiController.viewer.updateDocument(this.aiController.state.originalDocument);
        }
        
        // 새 요청 전송
        this.elements.input.value = newRequest;
        await this.handleSendMessage();
    }
    
    /**
     * 부분 수정 (선택한 항목만 수정)
     */
    async handlePartialEdit() {
        logger.info('✏️ 부분 수정 클릭');
        
        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키를 먼저 설정해주세요.');
            this.promptForApiKey();
            return;
        }
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }
        
        // 문서 구조 추출
        const pairs = this.aiController.extractor.extractTableHeaderContentPairs(document);
        
        if (pairs.length === 0) {
            this.addSystemMessage('[알림] 수정할 항목이 없습니다.');
            return;
        }
        
        // 헤더 목록 표시
        let headerList = pairs.map((pair, idx) => 
            `${idx + 1}. ${pair.header || '(제목없음)'}`
        ).join('\n');
        
        const selection = prompt(
            `수정할 항목 번호를 입력하세요 (쉼표로 구분):\n\n${headerList}\n\n` +
            `예: 1,3,5 또는 2-5 (범위)`
        );
        
        if (!selection) return;
        
        const editRequest = prompt(
            '선택한 항목에 대한 수정 요청을 입력하세요:\n\n' +
            '예: 더 자세하게 설명해줘'
        );
        
        if (!editRequest) return;
        
        // 부분 수정 요청 생성
        const partialRequest = `[${selection}]번 항목만 ${editRequest}`;
        
        this.elements.input.value = partialRequest;
        await this.handleSendMessage();
    }
    
    /**
     * 검증 (빈 칸, 오류 검사)
     */
    handleValidateDocument() {
        logger.info('✅ 검증 클릭');
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }
        
        try {
            const pairs = this.aiController.extractor.extractTableHeaderContentPairs(document);
            
            let issues = [];
            let emptyCount = 0;
            let shortCount = 0;
            
            pairs.forEach((pair, idx) => {
                const content = pair.content?.trim() || '';
                
                // 빈 내용 체크
                if (!content) {
                    issues.push(`⚠️ [${pair.header || idx + 1}]: 내용이 비어있습니다`);
                    emptyCount++;
                }
                // 너무 짧은 내용 체크
                else if (content.length < 10) {
                    issues.push(`📝 [${pair.header || idx + 1}]: 내용이 너무 짧습니다 (${content.length}자)`);
                    shortCount++;
                }
            });
            
            // 결과 표시
            let resultMessage = `✅ 문서 검증 결과\n\n`;
            resultMessage += `📊 총 항목: ${pairs.length}개\n`;
            resultMessage += `⚠️ 빈 항목: ${emptyCount}개\n`;
            resultMessage += `📝 짧은 항목: ${shortCount}개\n\n`;
            
            if (issues.length > 0) {
                resultMessage += `🔍 발견된 문제:\n${issues.slice(0, 10).join('\n')}`;
                if (issues.length > 10) {
                    resultMessage += `\n... 외 ${issues.length - 10}개`;
                }
            } else {
                resultMessage += `🎉 문제가 발견되지 않았습니다!`;
            }
            
            this.addAssistantMessage(resultMessage);
            
            if (issues.length === 0) {
                showToast('success', '검증 완료', '문제가 없습니다');
            } else {
                showToast('warning', '검증 완료', `${issues.length}개 문제 발견`);
            }
            
        } catch (error) {
            logger.error('❌ 검증 실패:', error);
            this.addSystemMessage(`[오류] 검증 실패: ${error.message}`);
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // AI 문서 품질 기능 (Phase 1)
    // ═══════════════════════════════════════════════════════════

    /**
     * AI 친화적 문서 교정
     */
    async handleAIRefinement() {
        logger.info('🔧 AI 친화 교정 시작');

        if (!this.aiController || !this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키를 먼저 설정해주세요.');
            return;
        }

        const doc = this.aiController.viewer.getDocument();
        if (!doc) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }

        this.addUserMessage('AI 친화적 문서 표준에 따라 교정해주세요.');
        const msgId = this.addLoadingMessage('AI 친화 문서 교정 중...');

        try {
            const result = await this.aiController.handleRefinementRequest();

            let resultText = `✅ AI 친화 문서 교정 완료\n\n`;
            resultText += `📋 문서 유형: ${result.metadata.documentType}\n`;
            resultText += `📊 교정 항목: ${result.metadata.itemsUpdated}개\n`;
            resultText += `🔢 토큰 사용: ${result.metadata.tokensUsed}\n\n`;
            resultText += `**적용된 교정 원칙:**\n`;
            resultText += `• 주어+서술어 완전한 문장으로 수정\n`;
            resultText += `• 개조식 → 서술형 변환\n`;
            resultText += `• 모호한 지시어 → 구체 명사 교체\n`;
            resultText += `• 불필요한 꾸밈/장식 제거\n`;
            resultText += `• 핵심 정보(날짜, 수치, 고유명사) 보존`;

            this.removeLoadingMessage(msgId);
            this.addAssistantMessage(resultText);
            showToast('success', '교정 완료', `${result.metadata.itemsUpdated}개 항목이 교정되었습니다.`);
        } catch (error) {
            this.removeLoadingMessage(msgId);
            logger.error('❌ AI 교정 실패:', error);
            this.addSystemMessage(`[오류] AI 교정 실패: ${error.message}`);
        }
    }

    /**
     * AI 친화도 품질 검증 (GPT 기반)
     */
    async handleAIReadinessCheck() {
        logger.info('🔍 AI 품질 검증 시작');

        if (!this.aiController || !this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키를 먼저 설정해주세요.');
            return;
        }

        const doc = this.aiController.viewer.getDocument();
        if (!doc) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }

        this.addUserMessage('이 문서의 AI 친화도를 검증해주세요.');
        const msgId = this.addLoadingMessage('AI 친화도 분석 중...');

        try {
            const result = await this.aiController.handleReadinessCheck();
            const a = result.assessment;

            let resultText = `📊 AI 친화도 검증 결과\n\n`;
            resultText += `🏆 **종합 점수: ${a.score}/100 (등급: ${a.grade})**\n`;
            resultText += `📋 문서 유형: ${a.documentType}\n\n`;

            if (a.criteria && a.criteria.length > 0) {
                resultText += `**세부 평가:**\n`;
                a.criteria.forEach(c => {
                    const icon = c.pass ? '✅' : '❌';
                    resultText += `${icon} ${c.label || c.name}: ${c.score || (c.pass ? '통과' : '미흡')}\n`;
                    if (c.issues && c.issues.length > 0) {
                        c.issues.forEach(issue => {
                            resultText += `   • ${issue}\n`;
                        });
                    }
                });
            }

            if (a.suggestions && a.suggestions.length > 0) {
                resultText += `\n**개선 제안:**\n`;
                a.suggestions.forEach((s, i) => {
                    resultText += `${i + 1}. ${s}\n`;
                });
            }

            if (a.summary) {
                resultText += `\n**요약:** ${a.summary}`;
            }

            this.removeLoadingMessage(msgId);
            this.addAssistantMessage(resultText);

            const gradeEmoji = a.grade === 'A' ? '🎉' : a.grade === 'B' ? '👍' : '⚠️';
            showToast(
                a.score >= 70 ? 'success' : 'warning',
                'AI 품질 검증 완료',
                `${gradeEmoji} ${a.score}점 (${a.grade}등급)`
            );
        } catch (error) {
            this.removeLoadingMessage(msgId);
            logger.error('❌ AI 품질 검증 실패:', error);
            this.addSystemMessage(`[오류] AI 품질 검증 실패: ${error.message}`);
        }
    }

    /**
     * 로컬 빠른 품질 검사 (GPT 호출 없음)
     */
    handleLocalQualityCheck() {
        logger.info('⚡ 로컬 빠른 품질 검사 시작');

        const doc = this.aiController?.viewer?.getDocument();
        if (!doc) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }

        try {
            const pairs = this.aiController.extractor.extractTableHeaderContentPairs(doc);

            // TextAnalyzer를 동적 import
            import('../ai/text-analyzer.js').then(({ TextAnalyzer }) => {
                const analyzer = new TextAnalyzer();
                const result = analyzer.checkAIFriendliness(pairs);

                let resultText = `⚡ 빠른 AI 친화도 검사 (로컬)\n\n`;
                resultText += `📊 점수: ${result.score}/100 (등급: ${result.grade})\n`;
                resultText += `📋 분석 항목: ${result.summary.totalPairs}개\n`;
                resultText += `⚠️ 발견된 이슈: ${result.summary.totalIssues}개\n\n`;

                const cat = result.summary.byCategory;
                resultText += `**이슈 유형별:**\n`;
                resultText += `• 불완전 문장: ${cat.incompleteSentence}개\n`;
                resultText += `• 모호한 지시어: ${cat.vagueReference}개\n`;
                resultText += `• 개조식 나열: ${cat.bulletOnly}개\n`;
                resultText += `• 과도한 수식어: ${cat.verbose}개\n`;

                if (result.issues.length > 0) {
                    resultText += `\n**주요 이슈 (최대 8개):**\n`;
                    result.issues.slice(0, 8).forEach(issue => {
                        resultText += `• [${issue.header}] ${issue.reason}\n`;
                    });
                    if (result.issues.length > 8) {
                        resultText += `... 외 ${result.issues.length - 8}개\n`;
                    }
                }

                resultText += `\n💡 *정확한 AI 분석이 필요하면 "AI 품질 검증" 버튼을 사용하세요.*`;

                this.addAssistantMessage(resultText);
                showToast(
                    result.score >= 70 ? 'success' : 'warning',
                    '빠른 검사 완료',
                    `${result.score}점 - ${result.summary.totalIssues}개 이슈`
                );
            }).catch(err => {
                this.addSystemMessage(`[오류] 분석 모듈 로딩 실패: ${err.message}`);
            });
        } catch (error) {
            logger.error('❌ 로컬 검사 실패:', error);
            this.addSystemMessage(`[오류] 빠른 검사 실패: ${error.message}`);
        }
    }

    /**
     * 일괄 생성 (여러 주제 한 번에 생성)
     */
    async handleBatchGenerate() {
        logger.info('📚 일괄 생성 클릭');
        
        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] API 키를 먼저 설정해주세요.');
            this.promptForApiKey();
            return;
        }
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            return;
        }
        
        const topics = prompt(
            '생성할 주제들을 입력하세요 (쉼표로 구분):\n\n' +
            '예: 봄, 여름, 가을, 겨울\n' +
            '예: 월요일 활동, 화요일 활동, 수요일 활동\n\n' +
            '각 주제별로 문서가 생성되어 다운로드됩니다.'
        );
        
        if (!topics) return;
        
        const topicList = topics.split(',').map(t => t.trim()).filter(t => t);
        
        if (topicList.length === 0) {
            this.addSystemMessage('[알림] 유효한 주제를 입력해주세요.');
            return;
        }
        
        this.addSystemMessage(`📚 일괄 생성 시작: ${topicList.length}개 주제\n${topicList.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`);
        
        const loadingId = this.addLoadingMessage(`일괄 생성 중... (0/${topicList.length})`);
        
        let successCount = 0;
        
        try {
            for (let i = 0; i < topicList.length; i++) {
                const topic = topicList[i];
                
                this.updateMessage(loadingId, `일괄 생성 중... (${i + 1}/${topicList.length}): ${topic}`);
                
                try {
                    // 원본으로 리셋
                    const originalDoc = this.aiController.state.originalDocument || document;
                    await this.aiController.viewer.updateDocument(JSON.parse(JSON.stringify(originalDoc)));
                    
                    // AI 요청
                    const request = `주제를 "${topic}"으로 변경해서 내용을 생성해줘`;
                    await this.aiController.handleUserRequest(request);
                    
                    // 파일 저장
                    const filename = `${topic.replace(/[^가-힣a-zA-Z0-9]/g, '_')}_문서.hwpx`;
                    await this.aiController.saveAsHwpx(filename);
                    
                    successCount++;
                    logger.info(`✅ ${topic} 생성 완료`);
                    
                } catch (error) {
                    logger.error(`❌ ${topic} 생성 실패:`, error);
                }
                
                // Rate limit 방지를 위한 딜레이
                if (i < topicList.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            this.removeMessage(loadingId);
            
            this.addAssistantMessage(
                `✅ 일괄 생성 완료!\n\n` +
                `📊 결과: ${successCount}/${topicList.length}개 성공\n\n` +
                `생성된 파일들이 다운로드되었습니다.`
            );
            
            showToast('success', '완료', `${successCount}개 문서 생성됨`);
            
        } catch (error) {
            this.removeMessage(loadingId);
            logger.error('❌ 일괄 생성 실패:', error);
            this.addSystemMessage(`[오류] 일괄 생성 실패: ${error.message}`);
        }
    }
    
    /**
     * 대화 지우기
     */
    handleClearChat() {
        logger.info('🗑️ 대화 지우기 클릭');
        
        const confirmClear = confirm('대화 내용을 모두 지우시겠습니까?');
        
        if (confirmClear) {
            this.clearMessages();
            this.addSystemMessage('대화 내용이 지워졌습니다. 새로운 요청을 입력해주세요.');
            showToast('info', '완료', '대화가 지워졌습니다');
        }
    }
    
    /**
     * 에러 메시지 추가
     * @param {string} content - 에러 내용
     */
    addErrorMessage(content) {
        return this.addMessage('system', `[오류] ${content}`);
    }
    
    // ===================================
    // 🆕 셀 선택 모드 관련 메서드
    // ===================================
    
    /**
     * 셀 선택 모드 토글
     */
    handleCellSelectMode() {
        logger.info('🎯 셀 선택 모드 클릭');
        
        const document = this.aiController.viewer.getDocument();
        if (!document) {
            this.addSystemMessage('[알림] 먼저 문서를 로드해주세요.');
            showToast('warning', '알림', '문서가 없습니다');
            return;
        }
        
        if (!this.cellSelector) {
            this.cellSelector = new CellSelector(this.aiController.viewer);
            this.cellSelector.onSelectionChange = (summary) => {
                this._onCellSelectionChange(summary);
            };
        }
        
        // 토글
        const isActive = this.cellSelector.toggle();
        
        // 버튼 상태 업데이트
        if (this.elements.cellSelectModeBtn) {
            if (isActive) {
                this.elements.cellSelectModeBtn.classList.add('active');
                this.elements.cellSelectModeBtn.textContent = '선택 중...';
                
                // 자동 감지 옵션 제공
                const autoDetect = confirm(
                    '헤더를 자동으로 감지하여 설정할까요?\n\n' +
                    '예: 첫 번째 행/열은 "유지", 나머지는 "생성"으로 설정\n\n' +
                    '아니오를 선택하면 직접 클릭하여 설정할 수 있습니다.'
                );
                
                if (autoDetect) {
                    this.cellSelector.autoDetectHeaders();
                }
                
            } else {
                this.elements.cellSelectModeBtn.classList.remove('active');
                this.elements.cellSelectModeBtn.textContent = '셀 선택';
            }
        }
        
        if (isActive) {
            this.addSystemMessage(
                '셀 선택 모드\n\n' +
                '셀 클릭 시 모드 순환: ○ 자동 → — 유지 → / 수정 → + 생성\n\n' +
                '— 유지: 원본 유지 (헤더)\n' +
                '/  수정: 기존 내용 수정\n' +
                '+  생성: 새 내용 생성\n\n' +
                'ESC로 종료'
            );
        }
    }
    
    /**
     * 셀 선택 변경 콜백
     * @private
     */
    _onCellSelectionChange(summary) {
        logger.debug('Cell selection changed:', summary);
        // 필요시 UI 업데이트
    }
    
    /**
     * 셀 선택 적용 처리
     * @private
     */
    async _handleCellSelectionApplied(detail) {
        logger.info('📋 셀 선택 적용됨:', detail);
        
        const { summary, requestData } = detail;
        
        // 셀 선택 데이터 저장 (AI 요청 시 사용)
        this._lastCellSelectionData = requestData;
        
        this.addSystemMessage(
            `템플릿 설정 적용\n\n` +
            `— 유지 ${summary.keep}\n` +
            `/  수정 ${summary.edit}\n` +
            `+  생성 ${summary.generate}\n` +
            `○ 자동 ${summary.auto}\n\n` +
            `AI 요청을 입력하세요.`
        );
        
        // 버튼 상태 복원
        if (this.elements.cellSelectModeBtn) {
            this.elements.cellSelectModeBtn.classList.remove('active');
            this.elements.cellSelectModeBtn.textContent = '셀 선택';
        }
    }
    
    /**
     * 셀 선택 설정 저장
     */
    saveCellSelectionSettings() {
        if (!this.cellSelector) {
            showToast('warning', '알림', '셀 선택 모드를 먼저 활성화해주세요');
            return;
        }
        
        const json = this.cellSelector.saveState();
        
        // 다운로드
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `template-settings-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        showToast('success', '저장 완료', '템플릿 설정이 저장되었습니다');
    }
    
    /**
     * 셀 선택 설정 불러오기
     */
    loadCellSelectionSettings() {
        if (!this.cellSelector) {
            this.cellSelector = new CellSelector(this.aiController.viewer);
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                this.cellSelector.loadState(text);
                
                // 셀 선택 모드 활성화
                if (!this.cellSelector.isActive) {
                    this.cellSelector.activate();
                }
                
            } catch (error) {
                logger.error('설정 불러오기 실패:', error);
                showToast('error', '오류', '설정 파일을 읽을 수 없습니다');
            }
        };
        
        input.click();
    }
    
    // ===================================
    // 외부 API 연동 메서드
    // ===================================
    
    /**
     * 외부 API 설정 모달 표시
     */
    showExternalApiModal() {
        logger.info('외부 API 모달 표시');
        
        const document = this.aiController?.viewer?.getDocument();
        if (!document) {
            this.addSystemMessage('먼저 문서를 로드해주세요.');
            showToast('warning', '알림', '문서 없음');
            return;
        }
        
        // 기존 모달 제거
        const existingModal = document.getElementById?.('external-api-modal') || 
                              window.document.getElementById('external-api-modal');
        if (existingModal) existingModal.remove();
        
        // 모달 생성
        const modal = window.document.createElement('div');
        modal.id = 'external-api-modal';
        modal.className = 'external-api-modal-overlay';
        modal.innerHTML = `
            <div class="external-api-modal">
                <div class="external-api-modal-header">
                    <h3>외부 API 연동</h3>
                    <button class="external-api-modal-close" id="external-api-close">×</button>
                </div>
                
                <div class="external-api-modal-body">
                    <div class="external-api-section">
                        <label>API URL</label>
                        <input type="text" id="external-api-url" 
                               placeholder="https://api.example.com/data"
                               value="${escapeHtml(this.externalApiConfig.url || '')}">
                    </div>
                    
                    <div class="external-api-section">
                        <label>HTTP 메서드</label>
                        <select id="external-api-method">
                            <option value="GET" ${this.externalApiConfig.method === 'GET' ? 'selected' : ''}>GET</option>
                            <option value="POST" ${this.externalApiConfig.method === 'POST' ? 'selected' : ''}>POST</option>
                        </select>
                    </div>
                    
                    <div class="external-api-section">
                        <label>헤더 (JSON)</label>
                        <textarea id="external-api-headers" rows="3" 
                                  placeholder='{"Authorization": "Bearer xxx"}'>${escapeHtml(JSON.stringify(this.externalApiConfig.headers || {}, null, 2))}</textarea>
                    </div>
                    
                    <div class="external-api-section">
                        <label>필드 매핑 (선택)</label>
                        <textarea id="external-api-mapping" rows="4" 
                                  placeholder='{"문서 헤더": "json.path"}\n자동 매핑을 사용하려면 비워두세요'>${this.externalApiConfig.mapping ? JSON.stringify(this.externalApiConfig.mapping, null, 2) : ''}</textarea>
                    </div>
                    
                    <div class="external-api-section">
                        <label>POST 요청 Body (선택)</label>
                        <textarea id="external-api-body" rows="3" 
                                  placeholder='{"param": "value"}'></textarea>
                    </div>
                </div>
                
                <div class="external-api-modal-footer">
                    <button class="external-api-btn-secondary" id="external-api-sample">
                        샘플 데이터
                    </button>
                    <button class="external-api-btn-secondary" id="external-api-test">
                        연결 테스트
                    </button>
                    <button class="external-api-btn-primary" id="external-api-apply">
                        적용
                    </button>
                </div>
            </div>
        `;
        
        window.document.body.appendChild(modal);
        
        // 이벤트 바인딩
        this._bindExternalApiModalEvents(modal);
    }
    
    /**
     * 외부 API 모달 이벤트 바인딩
     * @private
     */
    _bindExternalApiModalEvents(modal) {
        // 닫기
        modal.querySelector('#external-api-close')?.addEventListener('click', () => {
            modal.remove();
        });
        
        // 오버레이 클릭으로 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // 샘플 데이터
        modal.querySelector('#external-api-sample')?.addEventListener('click', async () => {
            await this._applyExternalApiSampleData(modal);
        });
        
        // 연결 테스트
        modal.querySelector('#external-api-test')?.addEventListener('click', async () => {
            await this._testExternalApiConnection(modal);
        });
        
        // 적용
        modal.querySelector('#external-api-apply')?.addEventListener('click', async () => {
            await this._applyExternalApiData(modal);
        });
        
        // ESC로 닫기
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                window.document.removeEventListener('keydown', handleEsc);
            }
        };
        window.document.addEventListener('keydown', handleEsc);
    }
    
    /**
     * 샘플 데이터 적용
     * @private
     */
    async _applyExternalApiSampleData(modal) {
        try {
            this.addSystemMessage('샘플 데이터 적용 중...');
            
            const result = await this.aiController.previewWithSampleData();
            
            this.addSystemMessage(
                `샘플 데이터 적용 완료\n\n` +
                `적용된 필드: ${Object.keys(result.templateData).length}개\n\n` +
                `${Object.entries(result.templateData).slice(0, 5).map(([k, v]) => `· ${k}: ${v}`).join('\n')}`
            );
            
            showToast('success', '적용', '샘플 데이터가 적용되었습니다');
            modal.remove();
            
        } catch (error) {
            logger.error('샘플 데이터 적용 실패:', error);
            showToast('error', '오류', error.message);
        }
    }
    
    /**
     * 외부 API 연결 테스트
     * @private
     */
    async _testExternalApiConnection(modal) {
        const url = modal.querySelector('#external-api-url')?.value?.trim();
        
        if (!url) {
            showToast('warning', '알림', 'API URL을 입력하세요');
            return;
        }
        
        try {
            const headersText = modal.querySelector('#external-api-headers')?.value?.trim();
            const headers = headersText ? JSON.parse(headersText) : {};
            const method = modal.querySelector('#external-api-method')?.value || 'GET';
            
            this.addSystemMessage(`API 연결 테스트 중...\n${url}`);
            
            const dataFetcher = this.aiController.getDataFetcher();
            const data = await dataFetcher.fetchData(url, { headers, method });
            
            this.addSystemMessage(
                `연결 성공\n\n` +
                `응답 키: ${Object.keys(data).join(', ')}\n\n` +
                `데이터 미리보기:\n${JSON.stringify(data, null, 2).substring(0, 300)}...`
            );
            
            showToast('success', '성공', 'API 연결 성공');
            
        } catch (error) {
            logger.error('API 테스트 실패:', error);
            this.addErrorMessage(`API 연결 실패: ${error.message}`);
            showToast('error', '실패', error.message);
        }
    }
    
    /**
     * 외부 API 데이터 적용
     * @private
     */
    async _applyExternalApiData(modal) {
        const url = modal.querySelector('#external-api-url')?.value?.trim();
        
        if (!url) {
            showToast('warning', '알림', 'API URL을 입력하세요');
            return;
        }
        
        try {
            const headersText = modal.querySelector('#external-api-headers')?.value?.trim();
            const mappingText = modal.querySelector('#external-api-mapping')?.value?.trim();
            const bodyText = modal.querySelector('#external-api-body')?.value?.trim();
            const method = modal.querySelector('#external-api-method')?.value || 'GET';
            
            const headers = headersText ? JSON.parse(headersText) : {};
            const mapping = mappingText ? JSON.parse(mappingText) : null;
            const body = bodyText ? JSON.parse(bodyText) : undefined;
            
            // 설정 저장
            this.externalApiConfig = {
                url,
                method,
                headers,
                mapping
            };
            
            this.addSystemMessage(`외부 API 데이터 적용 중...\n${url}`);
            
            const result = await this.aiController.fillFromExternalAPI(url, {
                headers,
                method,
                body,
                mapping,
                autoMap: !mapping
            });
            
            this.addSystemMessage(
                `데이터 적용 완료\n\n` +
                `업데이트된 필드: ${result.metadata.itemsUpdated}개\n\n` +
                `이제 문서를 편집하거나 HWPX로 저장할 수 있습니다.`
            );
            
            showToast('success', '적용', '외부 데이터가 적용되었습니다');
            modal.remove();
            
        } catch (error) {
            logger.error('외부 API 적용 실패:', error);
            this.addErrorMessage(`데이터 적용 실패: ${error.message}`);
            showToast('error', '실패', error.message);
        }
    }

    /**
     * 리소스 정리 및 이벤트 리스너 제거
     * 메모리 누수 방지를 위한 destroy 메서드
     */
    destroy() {
        logger.info('🧹 Cleaning up ChatPanel resources...');

        // 1. 모든 타이머 정리
        if (this.loadingIntervals) {
            this.loadingIntervals.forEach((interval) => {
                clearInterval(interval);
            });
            this.loadingIntervals.clear();
        }

        // 2. CellSelector 정리
        if (this.cellSelector && typeof this.cellSelector.destroy === 'function') {
            this.cellSelector.destroy();
            this.cellSelector = null;
        }

        // 3. 이벤트 리스너 제거 (attachEventListeners에서 등록한 것들)
        if (this.elements.sendButton) {
            this.elements.sendButton.replaceWith(this.elements.sendButton.cloneNode(true));
        }
        if (this.elements.input) {
            this.elements.input.replaceWith(this.elements.input.cloneNode(true));
        }
        if (this.elements.toggleButton) {
            this.elements.toggleButton.replaceWith(this.elements.toggleButton.cloneNode(true));
        }
        if (this.elements.closeButton) {
            this.elements.closeButton.replaceWith(this.elements.closeButton.cloneNode(true));
        }

        // 4. 모든 기능 버튼들 정리
        const buttonIds = [
            'apiKeyButton', 'customApiButton', 'saveButton',
            'previewStructureBtn', 'applyStyleBtn', 'extractTemplateBtn',
            'regenerateBtn', 'partialEditBtn', 'validateBtn',
            'batchGenerateBtn', 'clearBtn', 'cellSelectModeBtn', 'externalApiBtn'
        ];

        buttonIds.forEach(btnId => {
            const btn = this.elements[btnId];
            if (btn) {
                btn.replaceWith(btn.cloneNode(true));
            }
        });

        // 5. 글로벌 이벤트 리스너 제거
        document.removeEventListener('cellSelectionApplied', this._handleCellSelectionApplied);

        // 6. DOM 참조 제거
        Object.keys(this.elements).forEach(key => {
            this.elements[key] = null;
        });

        // 7. 기타 참조 제거
        this.aiController = null;
        this.externalApiConfig = null;

        logger.info('✅ ChatPanel cleaned up successfully');
    }
}

/**
 * 간편 함수: 채팅 패널 초기화
 * @param {Object} aiController - AI 컨트롤러
 * @param {Object} [options={}] - 옵션
 * @returns {ChatPanel} 채팅 패널 인스턴스
 * 
 * @example
 * import { initChatPanel } from './chat-panel.js';
 * const chatPanel = initChatPanel(aiController);
 */
export function initChatPanel(aiController, options = {}) {
    const chatPanel = new ChatPanel(aiController, options);
    chatPanel.init();
    return chatPanel;
}

// Default export
export default ChatPanel;

