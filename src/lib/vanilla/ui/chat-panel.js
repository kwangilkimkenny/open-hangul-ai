/**
 * Chat Panel Component
 * AI 문서 편집을 위한 채팅 인터페이스
 * 
 * @module ui/chat-panel
 * @version 3.0.0-MVP
 */

import { getLogger } from '../utils/logger.js';
import { showToast } from '../utils/ui.js';
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
            externalApiBtn: null      // 외부 API 연동 버튼
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
        
        // 🆕 AI 기능 버튼들
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
        
        // CellSelector 초기화
        if (this.aiController && this.aiController.viewer) {
            this.cellSelector = new CellSelector(this.aiController.viewer);
            this.cellSelector.onSelectionChange = (summary) => {
                this._onCellSelectionChange(summary);
            };
            
            // 셀 선택 적용 이벤트 리스너
            document.addEventListener('cellSelectionApplied', (e) => {
                this._handleCellSelectionApplied(e.detail);
            });
        }
        
        if (!this.elements.panel || !this.elements.input || !this.elements.messages) {
            logger.error('❌ Required DOM elements not found');
            return;
        }
        
        // 이벤트 리스너 등록
        this.attachEventListeners();
        
        // 초기 메시지 표시
        this.addSystemMessage('AI 문서 편집 기능에 오신 것을 환영합니다! 문서 구조를 유지하면서 내용을 변경할 수 있습니다.');
        
        // API 키 상태 확인
        this.updateApiKeyStatus();
        
        logger.info('✅ Chat panel initialized');
    }
    
    /**
     * 이벤트 리스너 등록
     * @private
     */
    attachEventListeners() {
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
    }
    
    /**
     * 메시지 전송 처리
     * @private
     */
    async handleSendMessage() {
        const message = this.elements.input.value.trim();
        
        if (!message) {
            return;
        }
        
        // API 키 확인
        if (!this.aiController.hasApiKey()) {
            this.addSystemMessage('[알림] OpenAI API 키를 먼저 설정해주세요.');
            this.promptForApiKey();
            return;
        }
        
        // 입력창 비우기
        this.elements.input.value = '';
        
        // 사용자 메시지 표시
        this.addUserMessage(message);
        
        // 로딩 메시지 표시
        const loadingMessageId = this.addLoadingMessage('요청을 처리하는 중...');
        
        try {
            // 📄 다중 페이지 감지 및 처리
            const document = this.aiController.viewer.getDocument();
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
                
                // 성공 메시지 표시
                this.addAssistantMessage(
                    `✅ [완료] 문서가 성공적으로 업데이트되었습니다!\n\n` +
                    `- 변경된 텍스트 슬롯: ${result.metadata?.slotsUpdated || result.metadata?.itemsUpdated || '알 수 없음'}개\n` +
                    `- 사용된 토큰: ${result.metadata?.tokensUsed || '알 수 없음'}개`
                );
                
                // 토스트 알림 (단일 페이지)
                showToast('success', '성공', '문서가 업데이트되었습니다');
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
    addMessage(type, content) {
        const messageId = `msg-${++this.messageIdCounter}`;
        
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `ai-message ${type}`;
        messageDiv.textContent = content;
        
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
            const viewerContainer = document.querySelector('.viewer-container');
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
        const apiKey = prompt('OpenAI API 키를 입력하세요:');
        
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
                               value="${AIConfig.custom.getEndpoint() || ''}"
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
                               value="${AIConfig.custom.getApiKey() || ''}"
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
                                // 첫 번째 행 또는 첫 번째 열은 헤더로 유지
                                const isHeader = rowIdx === 0 || cellIdx === 0;
                                
                                if (!isHeader && cell.elements) {
                                    cell.elements.forEach(para => {
                                        if (para.runs) {
                                            para.runs.forEach(run => {
                                                if (run.text && run.text.trim()) {
                                                    run.text = '';  // 내용 제거
                                                    clearedCount++;
                                                }
                                            });
                                        }
                                    });
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
                               value="${this.externalApiConfig.url || ''}">
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
                                  placeholder='{"Authorization": "Bearer xxx"}'>${JSON.stringify(this.externalApiConfig.headers || {}, null, 2)}</textarea>
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

