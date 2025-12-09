/**
 * External Data Fetcher
 * 외부 API에서 JSON 데이터를 가져와 템플릿 문서와 병합하는 기능
 * 
 * @module api/external-data-fetcher
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 외부 데이터 가져오기 클래스
 */
export class ExternalDataFetcher {
    constructor() {
        this.cache = new Map();
        this.lastResponse = null;
        this.lastError = null;
        
        logger.info('ExternalDataFetcher initialized');
    }
    
    /**
     * 외부 API에서 JSON 데이터 가져오기
     * @param {string} apiUrl - API 엔드포인트
     * @param {Object} options - fetch 옵션
     * @returns {Promise<Object>} JSON 데이터
     */
    async fetchData(apiUrl, options = {}) {
        logger.info(`Fetching data from: ${apiUrl}`);
        logger.time('External API Fetch');
        
        try {
            const defaultOptions = {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                }
            };
            
            // POST/PUT 요청 시 body 추가
            if (options.body && ['POST', 'PUT', 'PATCH'].includes(defaultOptions.method)) {
                defaultOptions.body = typeof options.body === 'string' 
                    ? options.body 
                    : JSON.stringify(options.body);
            }
            
            const response = await fetch(apiUrl, defaultOptions);
            
            logger.info(`  Response status: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API 오류 (${response.status}): ${errorText || response.statusText}`);
            }
            
            const jsonData = await response.json();
            
            this.lastResponse = {
                url: apiUrl,
                status: response.status,
                data: jsonData,
                timestamp: new Date().toISOString()
            };
            
            // 캐시에 저장
            this.cache.set(apiUrl, {
                data: jsonData,
                timestamp: Date.now()
            });
            
            logger.timeEnd('External API Fetch');
            logger.info(`  Data received: ${JSON.stringify(jsonData).substring(0, 100)}...`);
            
            return jsonData;
            
        } catch (error) {
            this.lastError = {
                url: apiUrl,
                message: error.message,
                timestamp: new Date().toISOString()
            };
            
            logger.error('External API fetch failed:', error);
            logger.timeEnd('External API Fetch');
            throw error;
        }
    }
    
    /**
     * 캐시된 데이터 가져오기 (유효기간 내)
     * @param {string} apiUrl - API URL
     * @param {number} maxAge - 최대 캐시 시간 (ms), 기본 5분
     * @returns {Object|null} 캐시된 데이터 또는 null
     */
    getCached(apiUrl, maxAge = 5 * 60 * 1000) {
        const cached = this.cache.get(apiUrl);
        
        if (cached && (Date.now() - cached.timestamp) < maxAge) {
            logger.info(`Using cached data for: ${apiUrl}`);
            return cached.data;
        }
        
        return null;
    }
    
    /**
     * 캐시 초기화
     */
    clearCache() {
        this.cache.clear();
        logger.info('Cache cleared');
    }
    
    /**
     * JSON 데이터를 템플릿 매핑 형식으로 변환
     * @param {Object} jsonData - 외부 API 응답
     * @param {Object} mappingConfig - 필드 매핑 설정 { templateKey: jsonPath }
     * @returns {Object} 템플릿 호환 형식
     * 
     * @example
     * const mapping = {
     *   "학생 이름": "student.name",
     *   "점수": "scores.total"
     * };
     * const result = fetcher.transformToTemplateFormat(data, mapping);
     */
    transformToTemplateFormat(jsonData, mappingConfig) {
        logger.info('Transforming data with mapping config...');
        
        const result = {};
        
        for (const [templateKey, jsonPath] of Object.entries(mappingConfig)) {
            const value = this._getNestedValue(jsonData, jsonPath);
            
            if (value !== undefined) {
                result[templateKey] = this._formatValue(value);
                logger.debug(`  Mapped: "${templateKey}" ← "${jsonPath}" = "${result[templateKey]}"`);
            } else {
                logger.warn(`  Missing: "${jsonPath}" for template key "${templateKey}"`);
            }
        }
        
        logger.info(`  Transformed ${Object.keys(result).length} fields`);
        
        return result;
    }
    
    /**
     * 중첩된 객체에서 값 가져오기
     * @private
     */
    _getNestedValue(obj, path) {
        if (!path) return obj;
        
        const keys = path.split('.');
        let value = obj;
        
        for (const key of keys) {
            // 배열 인덱스 처리: "items[0].name"
            const match = key.match(/^(\w+)\[(\d+)\]$/);
            
            if (match) {
                const [, arrayKey, index] = match;
                value = value?.[arrayKey]?.[parseInt(index)];
            } else {
                value = value?.[key];
            }
            
            if (value === undefined) break;
        }
        
        return value;
    }
    
    /**
     * 값 포맷팅 (배열, 객체 처리)
     * @private
     */
    _formatValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        
        return String(value);
    }
    
    /**
     * JSON 데이터에서 자동으로 템플릿 키 추출
     * @param {Object} jsonData - JSON 데이터
     * @param {string} prefix - 키 접두사
     * @returns {Object} 평탄화된 키-값 쌍
     */
    autoExtractKeys(jsonData, prefix = '') {
        const result = {};
        
        const flatten = (obj, currentPrefix) => {
            for (const [key, value] of Object.entries(obj)) {
                const newKey = currentPrefix ? `${currentPrefix}.${key}` : key;
                
                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    flatten(value, newKey);
                } else {
                    // 마지막 키만 사용 (예: student.name → name)
                    const simpleKey = key;
                    result[simpleKey] = this._formatValue(value);
                }
            }
        };
        
        flatten(jsonData, prefix);
        
        return result;
    }
    
    /**
     * 문서의 편집 가능 영역과 JSON 키 자동 매핑
     * @param {Object} document - HWPX 문서 객체
     * @param {Object} jsonData - JSON 데이터
     * @returns {Object} 자동 생성된 매핑
     */
    autoMapToDocument(document, jsonData) {
        const flattenedData = this.autoExtractKeys(jsonData);
        const documentHeaders = this._extractDocumentHeaders(document);
        
        const mapping = {};
        
        // 유사도 기반 매칭
        for (const [jsonKey, jsonValue] of Object.entries(flattenedData)) {
            const bestMatch = this._findBestMatch(jsonKey, documentHeaders);
            
            if (bestMatch) {
                mapping[bestMatch] = jsonKey;
            }
        }
        
        logger.info(`Auto-mapped ${Object.keys(mapping).length} fields`);
        
        return { mapping, flattenedData };
    }
    
    /**
     * 문서에서 헤더(편집 가능 영역 이름) 추출
     * @private
     */
    _extractDocumentHeaders(document) {
        const headers = new Set();
        
        if (!document || !document.sections) return Array.from(headers);
        
        for (const section of document.sections) {
            for (const element of (section.elements || [])) {
                if (element.type === 'table') {
                    for (const row of (element.rows || [])) {
                        for (const cell of (row.cells || [])) {
                            if (cell.isHeader) {
                                const text = this._getCellText(cell);
                                if (text) headers.add(text);
                            }
                        }
                    }
                }
            }
        }
        
        return Array.from(headers);
    }
    
    /**
     * 셀 텍스트 추출
     * @private
     */
    _getCellText(cell) {
        if (!cell.elements || cell.elements.length === 0) return '';
        
        const paragraph = cell.elements[0];
        if (!paragraph.runs || paragraph.runs.length === 0) return '';
        
        return paragraph.runs.map(r => r.text || '').join('').trim();
    }
    
    /**
     * 유사도 기반 최적 매칭 찾기
     * @private
     */
    _findBestMatch(jsonKey, documentHeaders) {
        const normalizedKey = jsonKey.toLowerCase().replace(/[_-]/g, '');
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const header of documentHeaders) {
            const normalizedHeader = header.toLowerCase().replace(/\s+/g, '');
            
            // 완전 일치
            if (normalizedHeader === normalizedKey) {
                return header;
            }
            
            // 포함 관계
            if (normalizedHeader.includes(normalizedKey) || normalizedKey.includes(normalizedHeader)) {
                const score = Math.min(normalizedKey.length, normalizedHeader.length) / 
                              Math.max(normalizedKey.length, normalizedHeader.length);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = header;
                }
            }
        }
        
        // 임계값 이상일 때만 반환
        return bestScore > 0.5 ? bestMatch : null;
    }
    
    /**
     * 테스트용: 샘플 데이터 생성
     * @returns {Object} 샘플 JSON 데이터
     */
    static getSampleData() {
        return {
            student: {
                name: '홍길동',
                grade: '3학년',
                class: '2반',
                number: 15
            },
            scores: {
                korean: 95,
                math: 88,
                english: 92,
                science: 90,
                total: 365,
                average: 91.25
            },
            evaluation: {
                comment: '학업 성취도가 우수하며, 적극적인 수업 참여를 보입니다.',
                grade: 'A',
                rank: 5
            },
            date: '2025-01-15'
        };
    }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.ExternalDataFetcher = ExternalDataFetcher;
}

export default ExternalDataFetcher;

