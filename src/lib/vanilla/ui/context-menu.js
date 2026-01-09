/**
 * Context Menu
 * 우클릭 컨텍스트 메뉴
 * 
 * @module ui/context-menu
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('ContextMenu');

/**
 * 컨텍스트 메뉴 클래스
 */
export class ContextMenu {
    constructor() {
        this.menuElement = null;
        this.currentTarget = null;
        this.menuItems = [];
        
        this._init();
        logger.info('📋 ContextMenu initialized');
    }

    /**
     * 초기화
     * @private
     */
    _init() {
        // 메뉴 요소 생성
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'context-menu';
        this.menuElement.className = 'context-menu';
        this.menuElement.style.display = 'none';
        document.body.appendChild(this.menuElement);

        // 클릭 시 메뉴 닫기
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', (e) => {
            // 기본 컨텍스트 메뉴만 방지 (우리 메뉴가 표시되지 않을 때)
            if (this.menuElement.style.display === 'none') {
                // 테이블 셀이 아니면 기본 메뉴 허용
                if (!e.target.closest('.hwp-table td, .hwp-table th')) {
                    return;
                }
            }
        });
        
        // Escape로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });
    }

    /**
     * 메뉴 표시
     * @param {MouseEvent} event - 마우스 이벤트
     * @param {Array<Object>} items - 메뉴 항목 배열
     */
    show(event, items) {
        event.preventDefault();
        event.stopPropagation();

        this.currentTarget = event.target;
        this.menuItems = items;

        // 메뉴 내용 생성
        this._renderMenu(items);

        // 위치 계산
        const x = event.clientX;
        const y = event.clientY;

        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;
        this.menuElement.style.display = 'block';

        // 화면 벗어나면 조정
        setTimeout(() => {
            const rect = this.menuElement.getBoundingClientRect();
            
            if (rect.right > window.innerWidth) {
                this.menuElement.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                this.menuElement.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);

        logger.debug(`📋 Context menu shown at (${x}, ${y})`);
    }

    /**
     * 메뉴 숨기기
     */
    hide() {
        this.menuElement.style.display = 'none';
        this.currentTarget = null;
        this.menuItems = [];
    }

    /**
     * 메뉴 렌더링
     * @private
     */
    _renderMenu(items) {
        this.menuElement.innerHTML = '';

        items.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                this.menuElement.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                
                if (item.disabled) {
                    menuItem.classList.add('disabled');
                }
                
                // 아이콘
                if (item.icon) {
                    const icon = document.createElement('span');
                    icon.className = 'context-menu-icon';
                    icon.textContent = item.icon;
                    menuItem.appendChild(icon);
                }
                
                // 라벨
                const label = document.createElement('span');
                label.className = 'context-menu-label';
                label.textContent = item.label;
                menuItem.appendChild(label);
                
                // 단축키
                if (item.shortcut) {
                    const shortcut = document.createElement('span');
                    shortcut.className = 'context-menu-shortcut';
                    shortcut.textContent = item.shortcut;
                    menuItem.appendChild(shortcut);
                }

                // 클릭 이벤트
                if (!item.disabled && item.action) {
                    menuItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.hide();
                        item.action(this.currentTarget);
                    });
                }

                this.menuElement.appendChild(menuItem);
            }
        });
    }

    /**
     * 텍스트 선택 여부 확인
     * @returns {boolean}
     */
    hasTextSelection() {
        const selection = window.getSelection();
        return selection && selection.toString().length > 0;
    }

    /**
     * 클립보드에 복사
     * @param {string} text - 복사할 텍스트
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            logger.info('📋 Copied to clipboard');
            return true;
        } catch (error) {
            logger.error('❌ Failed to copy:', error);
            return false;
        }
    }

    /**
     * 클립보드에서 붙여넣기
     * @returns {Promise<string>}
     */
    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            logger.info('📋 Pasted from clipboard');
            return text;
        } catch (error) {
            logger.error('❌ Failed to paste:', error);
            return null;
        }
    }

    /**
     * 리소스 정리 및 이벤트 리스너 제거
     * 메모리 누수 방지를 위한 destroy 메서드
     */
    destroy() {
        logger.info('🧹 Cleaning up ContextMenu resources...');

        // 1. 메뉴 숨기기
        this.hide();

        // 2. DOM에서 메뉴 요소 제거
        if (this.menuElement && this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }

        // 3. 참조 제거
        this.menuElement = null;
        this.currentTarget = null;
        this.menuItems = [];

        // 4. 이벤트 리스너는 _init에서 익명 함수로 등록되어 제거 불가
        // 실제 프로덕션에서는 바운드 함수로 관리 권장
        // TODO: 리팩토링 시 바운드 함수로 변경하여 제거 가능하게 개선

        logger.info('✅ ContextMenu cleaned up successfully');
    }
}

export default ContextMenu;

