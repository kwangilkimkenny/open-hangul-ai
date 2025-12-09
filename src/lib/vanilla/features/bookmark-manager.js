/**
 * Bookmark Manager - 북마크 관리
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Bookmark Manager 클래스
 */
export class BookmarkManager {
    constructor(options = {}) {
        this.options = {
            storageKey: 'hwpx-bookmarks',
            maxBookmarks: 50,
            ...options
        };
        
        this.bookmarks = this.load();
        
        logger.info('BookmarkManager initialized');
    }
    
    /**
     * 북마크 추가
     */
    add(pageNumber, name = null) {
        if (!pageNumber) {
            throw new Error('Page number is required');
        }
        
        const bookmark = {
            id: Date.now().toString(),
            pageNumber,
            name: name || `Page ${pageNumber}`,
            createdAt: new Date().toISOString(),
            color: this.getRandomColor()
        };
        
        // 중복 체크
        const exists = this.bookmarks.find(b => b.pageNumber === pageNumber);
        if (exists) {
            logger.warn(`Bookmark already exists for page ${pageNumber}`);
            return exists;
        }
        
        // 최대 개수 체크
        if (this.bookmarks.length >= this.options.maxBookmarks) {
            this.bookmarks.shift(); // 가장 오래된 것 제거
        }
        
        this.bookmarks.push(bookmark);
        this.save();
        
        logger.info(`Bookmark added: ${bookmark.name}`);
        
        return bookmark;
    }
    
    /**
     * 북마크 제거
     */
    remove(bookmarkId) {
        const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
        
        if (index === -1) {
            logger.warn(`Bookmark not found: ${bookmarkId}`);
            return false;
        }
        
        this.bookmarks.splice(index, 1);
        this.save();
        
        logger.info(`Bookmark removed: ${bookmarkId}`);
        
        return true;
    }
    
    /**
     * 북마크 업데이트
     */
    update(bookmarkId, updates) {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        
        if (!bookmark) {
            logger.warn(`Bookmark not found: ${bookmarkId}`);
            return null;
        }
        
        Object.assign(bookmark, updates);
        this.save();
        
        logger.info(`Bookmark updated: ${bookmarkId}`);
        
        return bookmark;
    }
    
    /**
     * 모든 북마크 가져오기
     */
    getAll() {
        return [...this.bookmarks].sort((a, b) => a.pageNumber - b.pageNumber);
    }
    
    /**
     * 특정 페이지의 북마크 가져오기
     */
    getByPage(pageNumber) {
        return this.bookmarks.find(b => b.pageNumber === pageNumber);
    }
    
    /**
     * 북마크 존재 여부
     */
    has(pageNumber) {
        return this.bookmarks.some(b => b.pageNumber === pageNumber);
    }
    
    /**
     * 모든 북마크 제거
     */
    clear() {
        this.bookmarks = [];
        this.save();
        logger.info('All bookmarks cleared');
    }
    
    /**
     * 로컬 스토리지에 저장
     */
    save() {
        try {
            localStorage.setItem(
                this.options.storageKey,
                JSON.stringify(this.bookmarks)
            );
        } catch (error) {
            logger.error(`Failed to save bookmarks: ${error.message}`);
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
            logger.error(`Failed to load bookmarks: ${error.message}`);
            return [];
        }
    }
    
    /**
     * 랜덤 색상 생성
     */
    getRandomColor() {
        const colors = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7',
            '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
            '#009688', '#4caf50', '#8bc34a', '#cddc39',
            '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    /**
     * JSON으로 내보내기
     */
    export() {
        return JSON.stringify(this.bookmarks, null, 2);
    }
    
    /**
     * JSON에서 가져오기
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            
            if (!Array.isArray(imported)) {
                throw new Error('Invalid bookmark data');
            }
            
            this.bookmarks = imported;
            this.save();
            
            logger.info(`Imported ${imported.length} bookmarks`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to import bookmarks: ${error.message}`);
            return false;
        }
    }
}

export default BookmarkManager;

