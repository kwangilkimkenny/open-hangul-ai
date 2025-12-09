/**
 * Theme Manager - 테마 관리 시스템
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Theme Manager 클래스
 */
export class ThemeManager {
    constructor(options = {}) {
        this.options = {
            storageKey: 'hwpx-theme',
            defaultTheme: 'light',
            ...options
        };
        
        this.currentTheme = null;
        this.themes = new Map();
        
        // 내장 테마 등록
        this.registerBuiltInThemes();
        
        logger.info('ThemeManager initialized');
    }
    
    /**
     * 내장 테마 등록
     */
    registerBuiltInThemes() {
        // Light Theme
        this.registerTheme('light', {
            name: 'Light',
            colors: {
                '--bg-primary': '#ffffff',
                '--bg-secondary': '#f5f5f5',
                '--bg-tertiary': '#e0e0e0',
                '--text-primary': '#333333',
                '--text-secondary': '#666666',
                '--text-tertiary': '#999999',
                '--border-color': '#dddddd',
                '--accent-color': '#4CAF50',
                '--accent-hover': '#45a049',
                '--shadow': 'rgba(0,0,0,0.1)'
            }
        });
        
        // Dark Theme
        this.registerTheme('dark', {
            name: 'Dark',
            colors: {
                '--bg-primary': '#1e1e1e',
                '--bg-secondary': '#2d2d2d',
                '--bg-tertiary': '#3c3c3c',
                '--text-primary': '#ffffff',
                '--text-secondary': '#cccccc',
                '--text-tertiary': '#999999',
                '--border-color': '#444444',
                '--accent-color': '#66BB6A',
                '--accent-hover': '#5cb860',
                '--shadow': 'rgba(0,0,0,0.3)'
            }
        });
        
        // Auto (System)
        this.registerTheme('auto', {
            name: 'Auto (System)',
            isAuto: true
        });
    }
    
    /**
     * 테마 등록
     */
    registerTheme(id, theme) {
        this.themes.set(id, theme);
        logger.debug(`Theme registered: ${id}`);
    }
    
    /**
     * 테마 적용
     */
    applyTheme(themeId) {
        let theme = this.themes.get(themeId);
        
        if (!theme) {
            logger.warn(`Theme not found: ${themeId}, using default`);
            theme = this.themes.get(this.options.defaultTheme);
        }
        
        // Auto 테마인 경우 시스템 설정 확인
        if (theme.isAuto) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            themeId = prefersDark ? 'dark' : 'light';
            theme = this.themes.get(themeId);
        }
        
        // CSS 변수 적용
        if (theme.colors) {
            const root = document.documentElement;
            Object.entries(theme.colors).forEach(([key, value]) => {
                root.style.setProperty(key, value);
            });
        }
        
        // body 클래스 업데이트
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add(`theme-${themeId}`);
        
        this.currentTheme = themeId;
        this.save();
        
        // 이벤트 발생
        this.emitEvent('themeChanged', { themeId, theme });
        
        logger.info(`Theme applied: ${themeId}`);
    }
    
    /**
     * 현재 테마 가져오기
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    /**
     * 모든 테마 가져오기
     */
    getAllThemes() {
        return Array.from(this.themes.entries()).map(([id, theme]) => ({
            id,
            name: theme.name,
            isAuto: theme.isAuto || false
        }));
    }
    
    /**
     * 테마 토글 (Light <-> Dark)
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }
    
    /**
     * 초기화 (저장된 테마 로드)
     */
    init() {
        const savedTheme = this.load();
        const themeToApply = savedTheme || this.options.defaultTheme;
        this.applyTheme(themeToApply);
        
        // 시스템 테마 변경 감지 (Auto 테마용)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.currentTheme === 'auto' || this.themes.get(this.currentTheme)?.isAuto) {
                this.applyTheme('auto');
            }
        });
    }
    
    /**
     * 로컬 스토리지에 저장
     */
    save() {
        try {
            localStorage.setItem(this.options.storageKey, this.currentTheme);
        } catch (error) {
            logger.error(`Failed to save theme: ${error.message}`);
        }
    }
    
    /**
     * 로컬 스토리지에서 로드
     */
    load() {
        try {
            return localStorage.getItem(this.options.storageKey);
        } catch (error) {
            logger.error(`Failed to load theme: ${error.message}`);
            return null;
        }
    }
    
    /**
     * 이벤트 발생
     */
    emitEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true,
            cancelable: false
        });
        
        document.dispatchEvent(event);
        
        return event;
    }
    
    /**
     * 이벤트 리스너 추가
     */
    on(eventName, handler) {
        document.addEventListener(eventName, handler);
    }
}

export default ThemeManager;

