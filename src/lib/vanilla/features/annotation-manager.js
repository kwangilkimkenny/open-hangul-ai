/**
 * Annotation Manager - 주석 관리
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Annotation Manager 클래스
 */
export class AnnotationManager {
    constructor(options = {}) {
        this.options = {
            storageKey: 'hwpx-annotations',
            maxAnnotations: 100,
            defaultColor: '#ffeb3b',
            ...options
        };
        
        this.annotations = this.load();
        
        logger.info('AnnotationManager initialized');
    }
    
    /**
     * 주석 추가
     */
    add(selection, type = 'highlight', data = {}) {
        if (!selection) {
            throw new Error('Selection is required');
        }
        
        const annotation = {
            id: Date.now().toString(),
            type, // highlight, note, underline
            text: selection.toString(),
            color: data.color || this.options.defaultColor,
            note: data.note || '',
            pageNumber: this.getCurrentPage(),
            createdAt: new Date().toISOString(),
            position: this.getSelectionPosition(selection),
            ...data
        };
        
        // 최대 개수 체크
        if (this.annotations.length >= this.options.maxAnnotations) {
            this.annotations.shift();
        }
        
        this.annotations.push(annotation);
        this.save();
        
        // DOM에 주석 표시
        this.renderAnnotation(annotation, selection);
        
        logger.info(`Annotation added: ${annotation.type}`);
        
        return annotation;
    }
    
    /**
     * 주석 제거
     */
    remove(annotationId) {
        const index = this.annotations.findIndex(a => a.id === annotationId);
        
        if (index === -1) {
            logger.warn(`Annotation not found: ${annotationId}`);
            return false;
        }
        
        this.annotations.splice(index, 1);
        this.save();
        
        // DOM에서 제거
        const element = document.querySelector(`[data-annotation-id="${annotationId}"]`);
        if (element) {
            const text = document.createTextNode(element.textContent);
            element.parentNode.replaceChild(text, element);
        }
        
        logger.info(`Annotation removed: ${annotationId}`);
        
        return true;
    }
    
    /**
     * 주석 업데이트
     */
    update(annotationId, updates) {
        const annotation = this.annotations.find(a => a.id === annotationId);
        
        if (!annotation) {
            logger.warn(`Annotation not found: ${annotationId}`);
            return null;
        }
        
        Object.assign(annotation, updates);
        this.save();
        
        // DOM 업데이트
        const element = document.querySelector(`[data-annotation-id="${annotationId}"]`);
        if (element && updates.color) {
            element.style.backgroundColor = updates.color;
        }
        
        logger.info(`Annotation updated: ${annotationId}`);
        
        return annotation;
    }
    
    /**
     * 모든 주석 가져오기
     */
    getAll() {
        return [...this.annotations];
    }
    
    /**
     * 특정 페이지의 주석 가져오기
     */
    getByPage(pageNumber) {
        return this.annotations.filter(a => a.pageNumber === pageNumber);
    }
    
    /**
     * 주석 타입별 가져오기
     */
    getByType(type) {
        return this.annotations.filter(a => a.type === type);
    }
    
    /**
     * 모든 주석 제거
     */
    clear() {
        // DOM에서 제거
        document.querySelectorAll('[data-annotation-id]').forEach(el => {
            const text = document.createTextNode(el.textContent);
            el.parentNode.replaceChild(text, el);
        });
        
        this.annotations = [];
        this.save();
        
        logger.info('All annotations cleared');
    }
    
    /**
     * DOM에 주석 렌더링
     */
    renderAnnotation(annotation, selection) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        
        span.className = `annotation annotation-${annotation.type}`;
        span.setAttribute('data-annotation-id', annotation.id);
        span.style.cssText = `
            background-color: ${annotation.color};
            padding: 2px 0;
            cursor: pointer;
            position: relative;
        `;
        
        // 노트가 있으면 툴팁 추가
        if (annotation.note) {
            span.title = annotation.note;
            span.style.borderBottom = '2px dotted rgba(0,0,0,0.3)';
        }
        
        // 클릭 이벤트
        span.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAnnotationDetails(annotation);
        });
        
        try {
            range.surroundContents(span);
        } catch (e) {
            // 여러 요소에 걸친 선택의 경우 폴백
            logger.warn('Could not surround contents, using fallback');
        }
    }
    
    /**
     * 주석 상세 정보 표시
     */
    showAnnotationDetails(annotation) {
        // 간단한 알림 표시 (실제로는 모달이나 사이드 패널 사용)
        const message = `
주석 정보:
- 텍스트: ${annotation.text.substring(0, 50)}...
- 타입: ${annotation.type}
- 노트: ${annotation.note || '없음'}
- 생성일: ${new Date(annotation.createdAt).toLocaleString()}
        `.trim();
        
        alert(message);
    }
    
    /**
     * 현재 페이지 번호 가져오기
     */
    getCurrentPage() {
        // 실제로는 스크롤 위치나 다른 방법으로 계산
        return 1;
    }
    
    /**
     * 선택 영역의 위치 정보 저장
     */
    getSelectionPosition(selection) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        return {
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            top: rect.top,
            left: rect.left
        };
    }
    
    /**
     * 로컬 스토리지에 저장
     */
    save() {
        try {
            localStorage.setItem(
                this.options.storageKey,
                JSON.stringify(this.annotations)
            );
        } catch (error) {
            logger.error(`Failed to save annotations: ${error.message}`);
        }
    }
    
    /**
     * 로컬 스토리지에서 로드
     */
    load() {
        try {
            const data = localStorage.getItem(this.options.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            logger.error(`Failed to load annotations: ${error.message}`);
            return [];
        }
    }
    
    /**
     * JSON으로 내보내기
     */
    export() {
        return JSON.stringify(this.annotations, null, 2);
    }
    
    /**
     * JSON에서 가져오기
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            
            if (!Array.isArray(imported)) {
                throw new Error('Invalid annotation data');
            }
            
            this.annotations = imported;
            this.save();
            
            logger.info(`Imported ${imported.length} annotations`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to import annotations: ${error.message}`);
            return false;
        }
    }
}

export default AnnotationManager;

