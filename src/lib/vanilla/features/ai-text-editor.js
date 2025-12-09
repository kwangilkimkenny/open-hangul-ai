/**
 * AI Text Editor
 * AI 기반 텍스트 편집 엔진
 * 
 * @module features/ai-text-editor
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { showAlert, showConfirm } from '../utils/ui.js';

const logger = getLogger('AITextEditor');

/**
 * AI 텍스트 편집기 클래스
 */
export class AITextEditor {
    constructor(gptGenerator, textReplacer) {
        this.gptGenerator = gptGenerator;
        this.textReplacer = textReplacer;
        this.previewDialog = null;
        this.isProcessing = false;
        
        logger.info('🤖 AITextEditor initialized');
    }
    
    /**
     * 텍스트 편집 (메인 메서드)
     * @param {string} selectedText - 선택된 원본 텍스트
     * @param {string} userPrompt - 사용자 요청사항
     * @param {Object} selectionInfo - 선택 정보
     */
    async edit(selectedText, userPrompt, selectionInfo) {
        if (this.isProcessing) {
            logger.warn('⚠️ Already processing another request');
            await showAlert('처리 중', '이미 다른 요청을 처리 중입니다. 잠시만 기다려주세요.');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            logger.info('🤖 Starting AI text editing...');
            logger.debug(`   Original text: "${selectedText.substring(0, 50)}..."`);
            logger.debug(`   User prompt: "${userPrompt}"`);
            
            // 1. 주변 문맥 추출
            const context = this._extractContext(selectionInfo);
            
            // 2. AI 프롬프트 생성
            const aiPrompt = this._buildPrompt(selectedText, userPrompt, context);
            
            // 3. 로딩 표시
            this._showLoading();
            
            // 4. GPT API 호출
            const aiResult = await this._callGPT(aiPrompt);
            
            // 5. 로딩 숨기기
            this._hideLoading();
            
            if (!aiResult || aiResult.trim().length === 0) {
                throw new Error('AI가 빈 응답을 반환했습니다');
            }
            
            logger.info('✅ AI response received');
            logger.debug(`   New text: "${aiResult.substring(0, 50)}..."`);
            
            // 6. 미리보기 표시 및 사용자 확인
            const confirmed = await this._showPreview(selectedText, aiResult, userPrompt);
            
            if (!confirmed) {
                logger.info('⚠️ User cancelled the edit');
                return;
            }
            
            // 7. 텍스트 교체
            await this.textReplacer.replace(
                selectionInfo.range,
                selectionInfo.element,
                selectedText,
                aiResult
            );
            
            logger.info('✅ Text successfully replaced');
            
            await showAlert('✅ 완료', 'AI 편집이 성공적으로 적용되었습니다!');
            
        } catch (error) {
            logger.error('❌ AI text editing failed:', error);
            await showAlert('오류', `AI 편집 중 오류가 발생했습니다:\n${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * 주변 문맥 추출
     * @private
     */
    _extractContext(selectionInfo) {
        const { element } = selectionInfo;
        
        if (!element) {
            return '';
        }
        
        // 요소 전체 텍스트 가져오기
        const fullText = element.textContent || '';
        
        // 선택된 텍스트의 위치 찾기
        const selectedText = selectionInfo.text;
        const index = fullText.indexOf(selectedText);
        
        if (index === -1) {
            return '';
        }
        
        // 앞뒤 100자씩 추출
        const before = fullText.substring(Math.max(0, index - 100), index);
        const after = fullText.substring(index + selectedText.length, Math.min(fullText.length, index + selectedText.length + 100));
        
        return {
            before: before.trim(),
            after: after.trim()
        };
    }
    
    /**
     * AI 프롬프트 생성
     * @private
     */
    _buildPrompt(selectedText, userPrompt, context) {
        let prompt = `다음 텍스트를 수정해주세요.\n\n`;
        
        // 문맥 정보 추가
        if (context.before) {
            prompt += `[앞 문맥]\n${context.before}\n\n`;
        }
        
        prompt += `[수정할 텍스트]\n${selectedText}\n\n`;
        
        if (context.after) {
            prompt += `[뒤 문맥]\n${context.after}\n\n`;
        }
        
        prompt += `[요구사항]\n${userPrompt}\n\n`;
        prompt += `[지침]\n`;
        prompt += `- 수정된 텍스트만 출력하세요 (설명이나 부가 정보 없이)\n`;
        prompt += `- 앞뒤 문맥과 자연스럽게 연결되도록 작성하세요\n`;
        prompt += `- 원본의 핵심 의미는 유지하세요\n`;
        prompt += `- 한국어로 작성하세요\n\n`;
        prompt += `수정된 텍스트:`;
        
        return prompt;
    }
    
    /**
     * GPT API 호출
     * @private
     */
    async _callGPT(prompt) {
        if (!this.gptGenerator) {
            throw new Error('GPTContentGenerator not initialized');
        }
        
        logger.debug('📡 Calling GPT API...');
        
        try {
            // GPTContentGenerator의 generate 메서드 사용
            const response = await this.gptGenerator.generate({
                prompt: prompt,
                temperature: 0.7,
                max_tokens: 1000
            });
            
            // 응답에서 텍스트 추출
            let text = '';
            
            if (typeof response === 'string') {
                text = response;
            } else if (response && response.content) {
                text = response.content;
            } else if (response && response.text) {
                text = response.text;
            } else {
                logger.warn('⚠️ Unexpected response format:', response);
                throw new Error('예상치 못한 응답 형식입니다');
            }
            
            // 앞뒤 공백 제거
            text = text.trim();
            
            // 따옴표 제거 (GPT가 "수정된 텍스트" 형태로 반환할 수 있음)
            if (text.startsWith('"') && text.endsWith('"')) {
                text = text.slice(1, -1);
            }
            if (text.startsWith("'") && text.endsWith("'")) {
                text = text.slice(1, -1);
            }
            
            return text;
            
        } catch (error) {
            logger.error('❌ GPT API call failed:', error);
            throw new Error(`API 호출 실패: ${error.message}`);
        }
    }
    
    /**
     * 로딩 표시
     * @private
     */
    _showLoading() {
        // 기존 로딩이 있으면 제거
        this._hideLoading();
        
        const loading = document.createElement('div');
        loading.id = 'ai-text-editor-loading';
        loading.className = 'ai-loading-overlay';
        loading.innerHTML = `
            <div class="ai-loading-content">
                <div class="ai-loading-spinner"></div>
                <div class="ai-loading-text">AI가 텍스트를 수정하고 있습니다...</div>
            </div>
        `;
        
        document.body.appendChild(loading);
        
        // 애니메이션
        setTimeout(() => {
            loading.classList.add('visible');
        }, 10);
    }
    
    /**
     * 로딩 숨기기
     * @private
     */
    _hideLoading() {
        const loading = document.getElementById('ai-text-editor-loading');
        if (loading) {
            loading.classList.remove('visible');
            setTimeout(() => {
                loading.remove();
            }, 200);
        }
    }
    
    /**
     * 미리보기 표시
     * @private
     */
    async _showPreview(originalText, newText, userPrompt) {
        return new Promise((resolve) => {
            // 미리보기 다이얼로그 생성
            const dialog = document.createElement('div');
            dialog.className = 'ai-edit-dialog ai-preview-dialog';
            dialog.innerHTML = `
                <div class="ai-dialog-overlay"></div>
                <div class="ai-dialog-content">
                    <div class="ai-dialog-header">
                        <h3>💡 AI 편집 결과 미리보기</h3>
                        <button class="ai-dialog-close" data-action="cancel">✕</button>
                    </div>
                    <div class="ai-dialog-body">
                        <div class="ai-prompt-info">
                            <strong>요청사항:</strong> ${this._escapeHtml(userPrompt)}
                        </div>
                        
                        <div class="ai-preview-section">
                            <div class="ai-preview-label">원본 텍스트</div>
                            <div class="ai-preview-text ai-original-text">${this._escapeHtml(originalText)}</div>
                        </div>
                        
                        <div class="ai-preview-arrow">↓</div>
                        
                        <div class="ai-preview-section">
                            <div class="ai-preview-label">수정된 텍스트 (AI 생성)</div>
                            <div class="ai-preview-text ai-new-text">${this._escapeHtml(newText)}</div>
                        </div>
                        
                        <div class="ai-preview-stats">
                            <span>원본: ${originalText.length}자</span>
                            <span>→</span>
                            <span>수정: ${newText.length}자</span>
                            <span class="ai-diff ${newText.length > originalText.length ? 'increase' : newText.length < originalText.length ? 'decrease' : 'same'}">
                                ${newText.length > originalText.length ? '+' : ''}${newText.length - originalText.length}자
                            </span>
                        </div>
                    </div>
                    <div class="ai-dialog-footer">
                        <button class="ai-dialog-btn ai-btn-cancel" data-action="cancel">
                            <span class="icon">✕</span>
                            <span class="text">취소</span>
                        </button>
                        <button class="ai-dialog-btn ai-btn-apply" data-action="apply">
                            <span class="icon">✅</span>
                            <span class="text">적용하기</span>
                        </button>
                    </div>
                </div>
            `;
            
            // 이벤트 리스너
            dialog.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) {
                    // 오버레이 클릭
                    if (e.target.classList.contains('ai-dialog-overlay')) {
                        cleanup(false);
                    }
                    return;
                }
                
                const action = btn.dataset.action;
                
                if (action === 'apply') {
                    cleanup(true);
                } else if (action === 'cancel') {
                    cleanup(false);
                }
            });
            
            // ESC 키로 닫기
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    cleanup(false);
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            
            // 클린업 함수
            const cleanup = (confirmed) => {
                document.removeEventListener('keydown', handleKeyDown);
                dialog.classList.remove('visible');
                setTimeout(() => {
                    dialog.remove();
                }, 200);
                resolve(confirmed);
            };
            
            // DOM에 추가
            document.body.appendChild(dialog);
            this.previewDialog = dialog;
            
            // 애니메이션
            setTimeout(() => {
                dialog.classList.add('visible');
            }, 10);
        });
    }
    
    /**
     * HTML 이스케이프
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default AITextEditor;

