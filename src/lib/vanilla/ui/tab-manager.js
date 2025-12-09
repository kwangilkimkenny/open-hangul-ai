/**
 * Tab Manager - 멀티 파일 탭 관리
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Tab Manager 클래스
 */
export class TabManager {
    constructor(options = {}) {
        this.options = {
            container: '#tabBar',
            maxTabs: 10,
            enableReorder: true,
            ...options
        };
        
        this.tabs = new Map();
        this.activeTabId = null;
        this.tabIdCounter = 0;
        
        this.container = null;
        
        logger.info('TabManager initialized');
    }
    
    /**
     * 초기화
     */
    init() {
        const containerEl = document.querySelector(this.options.container);
        
        if (!containerEl) {
            throw new Error(`Tab container not found: ${this.options.container}`);
        }
        
        this.container = containerEl;
        this.container.className = 'tab-bar';
        this.container.style.cssText = `
            display: flex;
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
            padding: 0;
            overflow-x: auto;
            overflow-y: hidden;
            white-space: nowrap;
        `;
        
        // 새 탭 버튼
        this.addNewTabButton();
        
        logger.debug('TabManager initialized');
    }
    
    /**
     * 탭 추가
     */
    addTab(title, data = {}) {
        if (this.tabs.size >= this.options.maxTabs) {
            logger.warn('Maximum tabs reached');
            return null;
        }
        
        const tabId = `tab-${++this.tabIdCounter}`;
        
        const tab = {
            id: tabId,
            title: title || `Document ${this.tabIdCounter}`,
            data,
            element: this.createTabElement(tabId, title),
            createdAt: Date.now()
        };
        
        this.tabs.set(tabId, tab);
        
        // 탭 활성화
        this.activateTab(tabId);
        
        logger.info(`Tab added: ${tab.title}`);
        
        return tab;
    }
    
    /**
     * 탭 요소 생성
     */
    createTabElement(tabId, title) {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.setAttribute('data-tab-id', tabId);
        tab.style.cssText = `
            display: inline-flex;
            align-items: center;
            padding: 10px 16px;
            background: #e0e0e0;
            border-right: 1px solid #ccc;
            cursor: pointer;
            user-select: none;
            max-width: 200px;
            min-width: 120px;
            transition: background 0.2s;
        `;
        
        // 제목
        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.textContent = title || 'Untitled';
        titleSpan.style.cssText = `
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
        `;
        
        // 닫기 버튼
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            margin-left: 8px;
            background: none;
            border: none;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s;
        `;
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.opacity = '1';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.opacity = '0.6';
        });
        
        tab.appendChild(titleSpan);
        tab.appendChild(closeBtn);
        
        // 탭 클릭 이벤트
        tab.addEventListener('click', () => {
            this.activateTab(tabId);
        });
        
        // hover 효과
        tab.addEventListener('mouseenter', () => {
            if (!tab.classList.contains('active')) {
                tab.style.background = '#d5d5d5';
            }
        });
        
        tab.addEventListener('mouseleave', () => {
            if (!tab.classList.contains('active')) {
                tab.style.background = '#e0e0e0';
            }
        });
        
        // 새 탭 버튼 전에 삽입
        const newTabBtn = this.container.querySelector('.new-tab-btn');
        this.container.insertBefore(tab, newTabBtn);
        
        return tab;
    }
    
    /**
     * 탭 활성화
     */
    activateTab(tabId) {
        const tab = this.tabs.get(tabId);
        
        if (!tab) {
            logger.warn(`Tab not found: ${tabId}`);
            return false;
        }
        
        // 이전 활성 탭 비활성화
        if (this.activeTabId) {
            const prevTab = this.tabs.get(this.activeTabId);
            if (prevTab) {
                prevTab.element.classList.remove('active');
                prevTab.element.style.background = '#e0e0e0';
            }
        }
        
        // 새 탭 활성화
        tab.element.classList.add('active');
        tab.element.style.background = '#fff';
        this.activeTabId = tabId;
        
        // 이벤트 발생
        this.emitEvent('tabActivated', { tabId, tab });
        
        logger.debug(`Tab activated: ${tabId}`);
        
        return true;
    }
    
    /**
     * 탭 닫기
     */
    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        
        if (!tab) {
            logger.warn(`Tab not found: ${tabId}`);
            return false;
        }
        
        // 이벤트 발생 (취소 가능)
        const event = this.emitEvent('tabClosing', { tabId, tab });
        if (event && event.defaultPrevented) {
            logger.debug('Tab close prevented');
            return false;
        }
        
        // DOM에서 제거
        tab.element.remove();
        
        // Map에서 제거
        this.tabs.delete(tabId);
        
        // 활성 탭이었다면 다른 탭 활성화
        if (this.activeTabId === tabId) {
            const remainingTabs = Array.from(this.tabs.keys());
            if (remainingTabs.length > 0) {
                this.activateTab(remainingTabs[remainingTabs.length - 1]);
            } else {
                this.activeTabId = null;
            }
        }
        
        // 이벤트 발생
        this.emitEvent('tabClosed', { tabId });
        
        logger.info(`Tab closed: ${tabId}`);
        
        return true;
    }
    
    /**
     * 탭 제목 업데이트
     */
    updateTabTitle(tabId, newTitle) {
        const tab = this.tabs.get(tabId);
        
        if (!tab) {
            logger.warn(`Tab not found: ${tabId}`);
            return false;
        }
        
        tab.title = newTitle;
        const titleSpan = tab.element.querySelector('.tab-title');
        if (titleSpan) {
            titleSpan.textContent = newTitle;
        }
        
        logger.debug(`Tab title updated: ${tabId}`);
        
        return true;
    }
    
    /**
     * 새 탭 버튼 추가
     */
    addNewTabButton() {
        const btn = document.createElement('button');
        btn.className = 'new-tab-btn';
        btn.innerHTML = '+';
        btn.style.cssText = `
            padding: 10px 16px;
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s;
        `;
        
        btn.addEventListener('click', () => {
            this.emitEvent('newTabRequest');
        });
        
        btn.addEventListener('mouseenter', () => {
            btn.style.opacity = '1';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.opacity = '0.6';
        });
        
        this.container.appendChild(btn);
    }
    
    /**
     * 모든 탭 가져오기
     */
    getAllTabs() {
        return Array.from(this.tabs.values());
    }
    
    /**
     * 활성 탭 가져오기
     */
    getActiveTab() {
        return this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    }
    
    /**
     * 탭 개수
     */
    getTabCount() {
        return this.tabs.size;
    }
    
    /**
     * 이벤트 발생
     */
    emitEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true,
            cancelable: true
        });
        
        this.container.dispatchEvent(event);
        
        return event;
    }
    
    /**
     * 이벤트 리스너 추가
     */
    on(eventName, handler) {
        this.container.addEventListener(eventName, handler);
    }
    
    /**
     * 이벤트 리스너 제거
     */
    off(eventName, handler) {
        this.container.removeEventListener(eventName, handler);
    }
}

export default TabManager;

