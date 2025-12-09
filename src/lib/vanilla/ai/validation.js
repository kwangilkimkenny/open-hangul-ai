/**
 * Validation Module
 * 문서 구조 및 데이터 검증
 * 
 * @module ai/validation
 * @version 2.1.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 문서 구조 검증
 * 원본과 업데이트된 문서의 구조가 동일한지 확인
 * 
 * @param {Object} original - 원본 문서
 * @param {Object} updated - 업데이트된 문서
 * @returns {Object} 검증 결과
 * 
 * @example
 * const result = validateStructure(originalDoc, updatedDoc);
 * if (!result.isValid) {
 *   console.error('구조 불일치:', result.errors);
 * }
 */
export function validateStructure(original, updated) {
    const errors = [];
    
    logger.debug('🔍 Validating document structure...');
    
    // 기본 null/undefined 체크
    if (!original || !updated) {
        errors.push('원본 또는 업데이트 문서가 null/undefined입니다');
        return { isValid: false, errors };
    }
    
    // 섹션 체크
    if (!original.sections || !updated.sections) {
        errors.push('sections 속성이 없습니다');
        return { isValid: false, errors };
    }
    
    // 섹션 수 체크
    if (original.sections.length !== updated.sections.length) {
        errors.push(`섹션 수 불일치: 원본=${original.sections.length}, 업데이트=${updated.sections.length}`);
    }
    
    // 각 섹션 검증
    const minSections = Math.min(original.sections.length, updated.sections.length);
    for (let i = 0; i < minSections; i++) {
        validateSection(original.sections[i], updated.sections[i], i, errors);
    }
    
    const result = {
        isValid: errors.length === 0,
        errors
    };
    
    if (result.isValid) {
        logger.debug('✅ Structure validation passed');
    } else {
        logger.warn(`⚠️  Structure validation failed: ${errors.length} errors`);
    }
    
    return result;
}

/**
 * 섹션 검증
 * @param {Object} originalSection - 원본 섹션
 * @param {Object} updatedSection - 업데이트된 섹션
 * @param {number} sectionIdx - 섹션 인덱스
 * @param {Array} errors - 에러 배열
 * @private
 */
function validateSection(originalSection, updatedSection, sectionIdx, errors) {
    if (!originalSection.elements || !updatedSection.elements) {
        errors.push(`섹션 ${sectionIdx}: elements 속성이 없습니다`);
        return;
    }
    
    // 요소 수 체크
    if (originalSection.elements.length !== updatedSection.elements.length) {
        errors.push(
            `섹션 ${sectionIdx}: 요소 수 불일치 (원본=${originalSection.elements.length}, 업데이트=${updatedSection.elements.length})`
        );
    }
    
    // 각 요소 검증
    const minElements = Math.min(originalSection.elements.length, updatedSection.elements.length);
    for (let i = 0; i < minElements; i++) {
        validateElement(originalSection.elements[i], updatedSection.elements[i], sectionIdx, i, errors);
    }
}

/**
 * 요소 검증
 * @param {Object} originalElement - 원본 요소
 * @param {Object} updatedElement - 업데이트된 요소
 * @param {number} sectionIdx - 섹션 인덱스
 * @param {number} elementIdx - 요소 인덱스
 * @param {Array} errors - 에러 배열
 * @private
 */
function validateElement(originalElement, updatedElement, sectionIdx, elementIdx, errors) {
    // 타입 체크
    if (originalElement.type !== updatedElement.type) {
        errors.push(
            `섹션 ${sectionIdx}, 요소 ${elementIdx}: 타입 불일치 (원본=${originalElement.type}, 업데이트=${updatedElement.type})`
        );
        return;
    }
    
    // 타입별 세부 검증
    switch (originalElement.type) {
    case 'table':
        validateTable(originalElement, updatedElement, sectionIdx, elementIdx, errors);
        break;
        
    case 'paragraph':
        // 단락은 텍스트 변경만 허용되므로 구조 검증 불필요
        break;
        
    default:
        // 기타 요소는 기본 검증만
        break;
    }
}

/**
 * 표 검증
 * @param {Object} originalTable - 원본 표
 * @param {Object} updatedTable - 업데이트된 표
 * @param {number} sectionIdx - 섹션 인덱스
 * @param {number} elementIdx - 요소 인덱스
 * @param {Array} errors - 에러 배열
 * @private
 */
function validateTable(originalTable, updatedTable, sectionIdx, elementIdx, errors) {
    if (!originalTable.rows || !updatedTable.rows) {
        errors.push(`섹션 ${sectionIdx}, 표 ${elementIdx}: rows 속성이 없습니다`);
        return;
    }
    
    // 행 수 체크
    if (originalTable.rows.length !== updatedTable.rows.length) {
        errors.push(
            `섹션 ${sectionIdx}, 표 ${elementIdx}: 행 수 불일치 (원본=${originalTable.rows.length}, 업데이트=${updatedTable.rows.length})`
        );
    }
    
    // 각 행의 셀 수 체크
    const minRows = Math.min(originalTable.rows.length, updatedTable.rows.length);
    for (let rowIdx = 0; rowIdx < minRows; rowIdx++) {
        const originalCells = originalTable.rows[rowIdx].cells || [];
        const updatedCells = updatedTable.rows[rowIdx].cells || [];
        
        if (originalCells.length !== updatedCells.length) {
            errors.push(
                `섹션 ${sectionIdx}, 표 ${elementIdx}, 행 ${rowIdx}: 셀 수 불일치 (원본=${originalCells.length}, 업데이트=${updatedCells.length})`
            );
        }
    }
}

/**
 * 슬롯 데이터 검증
 * @param {Array} updatedSlots - 업데이트된 슬롯 배열
 * @param {Map} originalTextSlots - 원본 텍스트 슬롯 맵
 * @returns {Object} 검증 결과
 * 
 * @example
 * const result = validateSlotData(updatedSlots, originalTextSlots);
 */
export function validateSlotData(updatedSlots, originalTextSlots) {
    const errors = [];
    const warnings = [];
    
    logger.debug('🔍 Validating slot data...');
    
    if (!Array.isArray(updatedSlots)) {
        errors.push('updatedSlots가 배열이 아닙니다');
        return { isValid: false, errors, warnings };
    }
    
    if (!(originalTextSlots instanceof Map)) {
        errors.push('originalTextSlots가 Map이 아닙니다');
        return { isValid: false, errors, warnings };
    }
    
    // 각 슬롯 검증
    updatedSlots.forEach((slot, idx) => {
        // slotId 체크
        if (!slot.slotId) {
            errors.push(`슬롯 ${idx}: slotId가 없습니다`);
            return;
        }
        
        // newText 체크
        if (typeof slot.newText !== 'string') {
            errors.push(`슬롯 ${idx} (${slot.slotId}): newText가 문자열이 아닙니다`);
            return;
        }
        
        // 원본에 존재하는 슬롯인지 체크
        if (!originalTextSlots.has(slot.slotId)) {
            warnings.push(`슬롯 ${idx} (${slot.slotId}): 원본에 존재하지 않는 슬롯ID입니다`);
        }
        
        // 텍스트 길이 체크 (너무 긴 경우 경고)
        if (originalTextSlots.has(slot.slotId)) {
            const original = originalTextSlots.get(slot.slotId);
            const lengthRatio = slot.newText.length / original.text.length;
            
            if (lengthRatio > 3.0) {
                warnings.push(
                    `슬롯 ${idx} (${slot.slotId}): 텍스트 길이가 원본의 ${lengthRatio.toFixed(1)}배입니다`
                );
            }
        }
    });
    
    const result = {
        isValid: errors.length === 0,
        errors,
        warnings
    };
    
    if (result.isValid) {
        logger.debug('✅ Slot data validation passed');
        if (warnings.length > 0) {
            logger.warn(`⚠️  ${warnings.length} warnings`);
        }
    } else {
        logger.warn(`⚠️  Slot data validation failed: ${errors.length} errors`);
    }
    
    return result;
}

/**
 * 변경 사항 검증
 * @param {Object} original - 원본 문서
 * @param {Object} updated - 업데이트된 문서
 * @param {Array} updatedSlots - 업데이트된 슬롯 배열
 * @returns {Object} 검증 결과
 * 
 * @example
 * const result = validateChanges(originalDoc, updatedDoc, updatedSlots);
 */
export function validateChanges(original, updated, updatedSlots) {
    const errors = [];
    const warnings = [];
    
    logger.debug('🔍 Validating changes...');
    
    // 구조 검증
    const structureResult = validateStructure(original, updated);
    errors.push(...structureResult.errors);
    
    // 슬롯 변경 통계
    const stats = {
        totalSlots: updatedSlots.length,
        unchangedSlots: 0,
        changedSlots: 0,
        emptySlots: 0
    };
    
    // 각 슬롯의 실제 변경 여부 확인
    updatedSlots.forEach(slot => {
        if (!slot.newText) {
            stats.emptySlots++;
        }
        // 실제 변경 여부는 병합 시점에 확인
    });
    
    const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
        stats
    };
    
    if (result.isValid) {
        logger.debug('✅ Changes validation passed');
    } else {
        logger.warn(`⚠️  Changes validation failed: ${errors.length} errors`);
    }
    
    return result;
}

/**
 * 깊은 비교 (구조 동일성 체크)
 * @param {Object} obj1 - 첫 번째 객체
 * @param {Object} obj2 - 두 번째 객체
 * @param {Array<string>} [ignorePaths=[]] - 무시할 경로 배열
 * @returns {boolean} 동일 여부
 * 
 * @example
 * const isSame = deepCompare(obj1, obj2, ['metadata', 'timestamp']);
 */
export function deepCompare(obj1, obj2, ignorePaths = []) {
    // 타입 체크
    if (typeof obj1 !== typeof obj2) {
        return false;
    }
    
    // Primitive 타입
    if (obj1 === null || obj2 === null) {
        return obj1 === obj2;
    }
    
    if (typeof obj1 !== 'object') {
        return obj1 === obj2;
    }
    
    // 배열
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        if (obj1.length !== obj2.length) {
            return false;
        }
        
        for (let i = 0; i < obj1.length; i++) {
            if (!deepCompare(obj1[i], obj2[i], ignorePaths)) {
                return false;
            }
        }
        
        return true;
    }
    
    // 객체
    const keys1 = Object.keys(obj1).filter(k => !ignorePaths.includes(k));
    const keys2 = Object.keys(obj2).filter(k => !ignorePaths.includes(k));
    
    if (keys1.length !== keys2.length) {
        return false;
    }
    
    for (const key of keys1) {
        if (!keys2.includes(key)) {
            return false;
        }
        
        if (!deepCompare(obj1[key], obj2[key], ignorePaths)) {
            return false;
        }
    }
    
    return true;
}

// Default export
export default {
    validateStructure,
    validateSlotData,
    validateChanges,
    deepCompare
};

