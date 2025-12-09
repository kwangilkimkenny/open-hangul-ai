/**
 * Text Replacer
 * 선택된 텍스트 교체 및 데이터 구조 업데이트
 * 
 * @module features/text-replacer
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('TextReplacer');

/**
 * 텍스트 교체기 클래스
 */
export class TextReplacer {
    constructor(historyManager) {
        this.historyManager = historyManager;
        logger.info('🔄 TextReplacer initialized');
    }
    
    /**
     * 텍스트 교체 (메인 메서드)
     * @param {Range} range - 선택 범위
     * @param {HTMLElement} element - 편집 가능한 요소
     * @param {string} oldText - 원본 텍스트
     * @param {string} newText - 새로운 텍스트
     */
    async replace(range, element, oldText, newText) {
        if (!range || !element) {
            throw new Error('Invalid range or element');
        }
        
        logger.info('🔄 Replacing text...');
        logger.debug(`   Old: "${oldText.substring(0, 30)}..."`);
        logger.debug(`   New: "${newText.substring(0, 30)}..."`);
        
        try {
            // 1. History에 기록 (Undo 가능하도록)
            if (this.historyManager) {
                this.historyManager.recordChange({
                    type: 'ai_text_edit',
                    element: element,
                    oldText: oldText,
                    newText: newText,
                    timestamp: Date.now()
                });
            }
            
            // 2. DOM 업데이트
            this._updateDOM(range, newText);
            
            // 3. 데이터 구조 업데이트
            this._updateDataStructure(element, oldText, newText);
            
            logger.info('✅ Text replaced successfully');
            
        } catch (error) {
            logger.error('❌ Text replacement failed:', error);
            throw error;
        }
    }
    
    /**
     * DOM 업데이트
     * @private
     */
    _updateDOM(range, newText) {
        try {
            // 선택 범위 삭제
            range.deleteContents();
            
            // 새 텍스트 노드 생성 및 삽입
            const textNode = document.createTextNode(newText);
            range.insertNode(textNode);
            
            // 커서를 새 텍스트 끝으로 이동
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            
            // 선택 범위 업데이트
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            logger.debug('✅ DOM updated');
            
        } catch (error) {
            logger.error('❌ DOM update failed:', error);
            throw new Error('DOM 업데이트 실패');
        }
    }
    
    /**
     * 데이터 구조 업데이트
     * @private
     */
    _updateDataStructure(element, oldText, newText) {
        // 요소의 데이터 참조 찾기
        const cellData = element._cellData;
        const paraData = element._paraData;
        
        if (cellData) {
            // 테이블 셀 데이터 업데이트
            this._updateCellData(cellData, element, oldText, newText);
        } else if (paraData) {
            // 일반 단락 데이터 업데이트
            this._updateParagraphData(paraData, element, oldText, newText);
        } else {
            logger.warn('⚠️ No data reference found for element');
        }
    }
    
    /**
     * 셀 데이터 업데이트
     * @private
     */
    _updateCellData(cellData, element, oldText, newText) {
        if (!cellData.elements || cellData.elements.length === 0) {
            logger.warn('⚠️ Cell has no paragraph elements');
            return;
        }
        
        // 현재 요소의 전체 텍스트
        const fullText = element.textContent || '';
        
        // 셀의 모든 단락을 하나의 텍스트로 합치기
        let currentText = '';
        cellData.elements.forEach(el => {
            if (el.type === 'paragraph' && el.runs) {
                el.runs.forEach(run => {
                    if (run.text) {
                        currentText += run.text;
                    }
                });
            }
        });
        
        // 텍스트 교체
        const updatedText = fullText.replace(oldText, newText);
        
        // 단락 데이터를 새 텍스트로 재구성
        cellData.elements = cellData.elements.filter(e => e.type !== 'paragraph');
        
        // 줄바꿈으로 분리
        const lines = updatedText.split('\n');
        lines.forEach(line => {
            cellData.elements.push({
                type: 'paragraph',
                runs: line ? [{ text: line }] : []
            });
        });
        
        logger.debug(`✅ Cell data updated: ${lines.length} paragraphs`);
    }
    
    /**
     * 단락 데이터 업데이트
     * @private
     */
    _updateParagraphData(paraData, element, oldText, newText) {
        if (!paraData.runs) {
            logger.warn('⚠️ Paragraph has no runs');
            return;
        }
        
        // 현재 요소의 전체 텍스트
        const fullText = element.textContent || '';
        
        // 텍스트 교체
        const updatedText = fullText.replace(oldText, newText);
        
        // runs 배열 재구성
        paraData.runs = [];
        
        // 줄바꿈 처리
        const lines = updatedText.split('\n');
        lines.forEach((line, idx) => {
            if (idx > 0) {
                paraData.runs.push({ type: 'linebreak' });
            }
            if (line) {
                paraData.runs.push({ text: line });
            }
        });
        
        logger.debug(`✅ Paragraph data updated: ${lines.length} lines`);
    }
    
    /**
     * 텍스트 교체 롤백 (Undo)
     * @param {Object} changeRecord - 변경 기록
     */
    rollback(changeRecord) {
        const { element, oldText, newText } = changeRecord;
        
        if (!element) {
            logger.error('❌ Cannot rollback: element not found');
            return;
        }
        
        logger.info('↩️ Rolling back text change...');
        
        try {
            // DOM에서 newText를 oldText로 교체
            const fullText = element.textContent || '';
            const restoredText = fullText.replace(newText, oldText);
            
            // 텍스트 노드 교체
            element.textContent = restoredText;
            
            // 데이터 구조 업데이트
            this._updateDataStructure(element, newText, oldText);
            
            logger.info('✅ Rollback successful');
            
        } catch (error) {
            logger.error('❌ Rollback failed:', error);
        }
    }
}

export default TextReplacer;

