/**
 * Chat Panel Component
 * AI 문서 편집을 위한 채팅 인터페이스
 * 
 * @module ui/chat-panel
 * @version 3.0.0-MVP
 */

import { getLogger } from '../utils/logger.js';
import { showToast } from '../utils/ui.js';
import { AIConfig } from '../config/ai-config.js';  // 🆕

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
            customApiButton: null,  // 🆕 커스텀 API 버튼
            saveButton: null
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
        this.elements.customApiButton = document.getElementById('custom-api-settings-btn');  // 🆕
        this.elements.saveButton = document.getElementById('ai-save-btn');
        
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
                
                result = await this.aiController.handleUserRequest(message);
                
                // 로딩 메시지 제거
                this.removeMessage(loadingMessageId);
                
                // 성공 메시지 표시
                this.addAssistantMessage(
                    `✅ [완료] 문서가 성공적으로 업데이트되었습니다!\n\n` +
                    `- 변경된 텍스트 슬롯: ${result.metadata?.slotsUpdated || '알 수 없음'}개\n` +
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

