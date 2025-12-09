/**
 * HWPX Inspector - 개발자 디버깅 도구
 * XML 구조, 파싱 추적, 성능 분석 등을 제공
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * HWPX Inspector 클래스
 */
export class HWPXInspector {
    constructor(options = {}) {
        this.options = {
            theme: 'light', // light, dark
            position: 'right', // left, right, bottom
            width: '400px',
            height: '600px',
            autoOpen: false,
            ...options
        };
        
        this.isOpen = false;
        this.panel = null;
        this.currentDocument = null;
        this.parsingSteps = [];
        this.performanceData = [];
        
        logger.info('HWPXInspector initialized');
    }
    
    /**
     * Inspector 패널 생성
     */
    createPanel() {
        if (this.panel) {
            return this.panel;
        }
        
        this.panel = document.createElement('div');
        this.panel.id = 'hwpx-inspector';
        this.panel.className = `inspector-panel inspector-${this.options.theme} inspector-${this.options.position}`;
        this.panel.style.cssText = `
            position: fixed;
            ${this.options.position}: 0;
            top: 0;
            width: ${this.options.width};
            height: ${this.options.height};
            background: ${this.options.theme === 'dark' ? '#1e1e1e' : '#f5f5f5'};
            border-left: 1px solid ${this.options.theme === 'dark' ? '#333' : '#ddd'};
            box-shadow: -2px 0 8px rgba(0,0,0,0.1);
            z-index: 10000;
            display: none;
            flex-direction: column;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 12px;
            overflow: hidden;
        `;
        
        // Header
        const header = document.createElement('div');
        header.className = 'inspector-header';
        header.style.cssText = `
            padding: 12px 16px;
            background: ${this.options.theme === 'dark' ? '#2d2d2d' : '#fff'};
            border-bottom: 1px solid ${this.options.theme === 'dark' ? '#333' : '#ddd'};
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span style="font-weight: bold; color: ${this.options.theme === 'dark' ? '#fff' : '#333'};">
                🔍 HWPX Inspector
            </span>
            <button id="inspector-close" style="
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: ${this.options.theme === 'dark' ? '#999' : '#666'};
            ">✕</button>
        `;
        
        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'inspector-tabs';
        tabs.style.cssText = `
            display: flex;
            background: ${this.options.theme === 'dark' ? '#2d2d2d' : '#fff'};
            border-bottom: 1px solid ${this.options.theme === 'dark' ? '#333' : '#ddd'};
        `;
        tabs.innerHTML = `
            <button class="inspector-tab active" data-tab="structure">구조</button>
            <button class="inspector-tab" data-tab="parsing">파싱</button>
            <button class="inspector-tab" data-tab="performance">성능</button>
            <button class="inspector-tab" data-tab="styles">스타일</button>
        `;
        
        // Content
        const content = document.createElement('div');
        content.className = 'inspector-content';
        content.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            color: ${this.options.theme === 'dark' ? '#ccc' : '#333'};
        `;
        
        this.panel.appendChild(header);
        this.panel.appendChild(tabs);
        this.panel.appendChild(content);
        
        document.body.appendChild(this.panel);
        
        // Event listeners
        header.querySelector('#inspector-close').addEventListener('click', () => this.close());
        tabs.querySelectorAll('.inspector-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.querySelectorAll('.inspector-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.switchTab(e.target.dataset.tab);
            });
            
            // 탭 스타일
            tab.style.cssText = `
                padding: 10px 16px;
                background: none;
                border: none;
                cursor: pointer;
                color: ${this.options.theme === 'dark' ? '#999' : '#666'};
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
            `;
        });
        
        logger.debug('Inspector panel created');
        return this.panel;
    }
    
    /**
     * Inspector 열기
     */
    open() {
        if (!this.panel) {
            this.createPanel();
        }
        
        this.panel.style.display = 'flex';
        this.isOpen = true;
        this.render();
        
        logger.info('Inspector opened');
    }
    
    /**
     * Inspector 닫기
     */
    close() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.isOpen = false;
        
        logger.info('Inspector closed');
    }
    
    /**
     * Inspector 토글
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    /**
     * 탭 전환
     */
    switchTab(tabName) {
        const content = this.panel.querySelector('.inspector-content');
        
        switch (tabName) {
        case 'structure':
            this.renderStructure(content);
            break;
        case 'parsing':
            this.renderParsing(content);
            break;
        case 'performance':
            this.renderPerformance(content);
            break;
        case 'styles':
            this.renderStyles(content);
            break;
        default:
            content.innerHTML = '<p>탭을 선택하세요.</p>';
        }
        
        logger.debug(`Switched to tab: ${tabName}`);
    }
    
    /**
     * 현재 활성 탭 렌더링
     */
    render() {
        if (!this.panel) {
            return;
        }
        
        const activeTab = this.panel.querySelector('.inspector-tab.active');
        if (activeTab) {
            this.switchTab(activeTab.dataset.tab);
        }
    }
    
    /**
     * 문서 구조 렌더링
     */
    renderStructure(container) {
        if (!this.currentDocument) {
            container.innerHTML = '<p style="color: #999;">문서를 로드해주세요.</p>';
            return;
        }
        
        const html = `
            <div class="structure-view">
                <h3>📄 문서 구조</h3>
                <div class="tree-view">
                    ${this.renderDocumentTree(this.currentDocument)}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * 문서 트리 렌더링 (재귀)
     */
    renderDocumentTree(doc, level = 0) {
        if (!doc) {
            return '';
        }
        
        const indent = '  '.repeat(level);
        let html = '';
        
        if (doc.sections) {
            html += `${indent}<div>📑 Sections (${doc.sections.length})</div>`;
            doc.sections.forEach((section, i) => {
                html += `${indent}  <div>└─ Section ${i + 1}</div>`;
                if (section.elements) {
                    html += `${indent}    <div>Elements: ${section.elements.length}</div>`;
                }
            });
        }
        
        return `<pre style="margin: 0; line-height: 1.6;">${html}</pre>`;
    }
    
    /**
     * 파싱 단계 렌더링
     */
    renderParsing(container) {
        if (this.parsingSteps.length === 0) {
            container.innerHTML = '<p style="color: #999;">파싱 추적 데이터가 없습니다.</p>';
            return;
        }
        
        const html = `
            <div class="parsing-view">
                <h3>⚙️ 파싱 단계 (${this.parsingSteps.length})</h3>
                <div class="steps-list">
                    ${this.parsingSteps.map((step, i) => `
                        <div class="step-item" style="
                            margin-bottom: 8px;
                            padding: 8px;
                            background: ${this.options.theme === 'dark' ? '#2d2d2d' : '#fff'};
                            border-radius: 4px;
                        ">
                            <div><strong>${i + 1}. ${step.name}</strong></div>
                            <div style="color: #999; font-size: 11px;">${step.duration}ms</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * 성능 데이터 렌더링
     */
    renderPerformance(container) {
        if (this.performanceData.length === 0) {
            container.innerHTML = '<p style="color: #999;">성능 데이터가 없습니다.</p>';
            return;
        }
        
        const html = `
            <div class="performance-view">
                <h3>⚡ 성능 분석</h3>
                <div class="metrics-list">
                    ${this.performanceData.map(metric => `
                        <div class="metric-item" style="
                            margin-bottom: 12px;
                            padding: 12px;
                            background: ${this.options.theme === 'dark' ? '#2d2d2d' : '#fff'};
                            border-radius: 4px;
                        ">
                            <div><strong>${metric.name}</strong></div>
                            <div style="color: ${metric.value > 100 ? '#ff6b6b' : '#51cf66'};">
                                ${metric.value}${metric.unit}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * 스타일 정보 렌더링
     */
    renderStyles(container) {
        container.innerHTML = `
            <div class="styles-view">
                <h3>🎨 스타일 정보</h3>
                <p style="color: #999;">요소를 선택하여 스타일을 확인하세요.</p>
            </div>
        `;
    }
    
    /**
     * 문서 설정
     */
    setDocument(doc) {
        this.currentDocument = doc;
        if (this.isOpen) {
            this.render();
        }
        logger.debug('Document set in Inspector');
    }
    
    /**
     * 파싱 단계 추가
     */
    addParsingStep(name, duration) {
        this.parsingSteps.push({ name, duration, timestamp: Date.now() });
        if (this.isOpen) {
            this.render();
        }
    }
    
    /**
     * 성능 데이터 추가
     */
    addPerformanceMetric(name, value, unit = 'ms') {
        this.performanceData.push({ name, value, unit, timestamp: Date.now() });
        if (this.isOpen) {
            this.render();
        }
    }
    
    /**
     * 데이터 초기화
     */
    clear() {
        this.currentDocument = null;
        this.parsingSteps = [];
        this.performanceData = [];
        if (this.isOpen) {
            this.render();
        }
        logger.debug('Inspector data cleared');
    }
}

// 전역 인스턴스 생성
export function createInspector(options) {
    return new HWPXInspector(options);
}

export default HWPXInspector;

