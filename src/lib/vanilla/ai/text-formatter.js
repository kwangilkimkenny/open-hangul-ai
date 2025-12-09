/**
 * Text Formatter
 * AI 생성 텍스트를 구조화하고 서식을 적용
 * 
 * @module ai/text-formatter
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 텍스트 포맷터 클래스
 * 구조화된 텍스트를 파싱하여 서식 정보 추출
 */
export class TextFormatter {
    constructor() {
        logger.info('🎨 TextFormatter initialized');
    }
    
    /**
     * 텍스트 파싱 및 서식 적용
     * @param {string} text - 원본 텍스트
     * @returns {Array<Object>} 서식이 적용된 텍스트 청크 배열
     * 
     * @example
     * const chunks = formatter.parseText("【1단계】 제목\n→ 내용1\n→ 내용2");
     * // [
     * //   { type: 'heading', text: '【1단계】 제목', bold: true },
     * //   { type: 'item', text: '→ 내용1', indent: 1 },
     * //   { type: 'item', text: '→ 내용2', indent: 1 }
     * // ]
     */
    parseText(text) {
        if (!text) return [];
        
        const lines = text.split('\n');
        const chunks = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // 빈 줄
            if (!trimmed) {
                chunks.push({
                    type: 'blank',
                    text: ''
                });
                continue;
            }
            
            // 【단계】 형식 - 제목 (굵게)
            if (trimmed.includes('【') && trimmed.includes('】')) {
                chunks.push({
                    type: 'heading',
                    text: trimmed,
                    bold: true,
                    style: 'stage-heading'
                });
                continue;
            }
            
            // → 형식 - 항목 (들여쓰기)
            if (trimmed.startsWith('→')) {
                chunks.push({
                    type: 'item',
                    text: trimmed,
                    indent: 1,
                    bulletChar: '→'
                });
                continue;
            }
            
            // 일반 텍스트
            chunks.push({
                type: 'text',
                text: trimmed
            });
        }
        
        logger.debug(`  📝 Parsed ${lines.length} lines → ${chunks.length} chunks`);
        return chunks;
    }
    
    /**
     * 청크를 HWPX 호환 문자열로 변환
     * @param {Array<Object>} chunks - 파싱된 청크 배열
     * @returns {string} HWPX 호환 텍스트
     */
    chunksToText(chunks) {
        return chunks.map(chunk => chunk.text).join('\n');
    }
    
    /**
     * 텍스트에 자동 서식 적용
     * @param {string} text - 원본 텍스트
     * @returns {Object} { text: string, chunks: Array }
     */
    formatText(text) {
        const chunks = this.parseText(text);
        const formattedText = this.chunksToText(chunks);
        
        return {
            text: formattedText,
            chunks: chunks,
            hasFormatting: chunks.some(c => c.type === 'heading' || c.type === 'item')
        };
    }
    
    /**
     * 서식 정보 추출 (HWPX XML 적용용)
     * @param {string} text - 원본 텍스트
     * @returns {Array<Object>} 각 줄의 서식 정보
     * 
     * @example
     * [
     *   { lineIndex: 0, bold: true, type: 'heading' },
     *   { lineIndex: 1, indent: 1, type: 'item' }
     * ]
     */
    extractFormatInfo(text) {
        const chunks = this.parseText(text);
        const formatInfo = [];
        
        chunks.forEach((chunk, index) => {
            if (chunk.type === 'heading' || chunk.type === 'item') {
                formatInfo.push({
                    lineIndex: index,
                    text: chunk.text,
                    bold: chunk.bold || false,
                    indent: chunk.indent || 0,
                    type: chunk.type,
                    style: chunk.style
                });
            }
        });
        
        return formatInfo;
    }
}

/**
 * 간편 함수: 텍스트 포맷팅
 * @param {string} text - 원본 텍스트
 * @returns {Object} 포맷팅 결과
 */
export function formatText(text) {
    const formatter = new TextFormatter();
    return formatter.formatText(text);
}

// Default export
export default TextFormatter;

