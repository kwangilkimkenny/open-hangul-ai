/**
 * Accessibility Manager
 * 문서 뷰어 접근성(ARIA, 키보드 네비게이션, 스크린리더) 강화
 *
 * @module lib/a11y/accessibility
 * @version 1.0.0
 */

export interface A11yOptions {
  enableAria?: boolean;
  enableKeyboardNav?: boolean;
  enableHighContrast?: boolean;
  announceChanges?: boolean;
  language?: string;
}

/**
 * 접근성 관리자
 */
export class AccessibilityManager {
  private container: HTMLElement;
  private options: Required<A11yOptions>;
  private liveRegion: HTMLElement | null = null;
  private focusableElements: HTMLElement[] = [];
  private currentFocusIndex = -1;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, options: A11yOptions = {}) {
    this.container = container;
    this.options = {
      enableAria: options.enableAria ?? true,
      enableKeyboardNav: options.enableKeyboardNav ?? true,
      enableHighContrast: options.enableHighContrast ?? false,
      announceChanges: options.announceChanges ?? true,
      language: options.language ?? 'ko',
    };
  }

  /**
   * 접근성 초기화
   */
  init(): void {
    if (this.options.enableAria) this.applyAriaAttributes();
    if (this.options.enableKeyboardNav) this.setupKeyboardNavigation();
    if (this.options.announceChanges) this.createLiveRegion();
    if (this.options.enableHighContrast) this.applyHighContrast();
  }

  /**
   * ARIA 속성 적용
   */
  private applyAriaAttributes(): void {
    // 뷰어 컨테이너
    this.container.setAttribute('role', 'document');
    this.container.setAttribute('aria-label', '문서 뷰어');
    this.container.setAttribute('lang', this.options.language);

    // 페이지 컨테이너
    const pages = this.container.querySelectorAll('.hwp-page-container, .hwp-page');
    pages.forEach((page, index) => {
      page.setAttribute('role', 'region');
      page.setAttribute('aria-label', `페이지 ${index + 1}`);
    });

    // 문단
    const paragraphs = this.container.querySelectorAll('.hwp-paragraph');
    paragraphs.forEach(para => {
      if (!para.getAttribute('role')) {
        para.setAttribute('role', 'paragraph');
      }
      // 편집 가능한 문단
      if (para.classList.contains('editable-paragraph')) {
        para.setAttribute('aria-label', '편집 가능한 문단');
        para.setAttribute('tabindex', '0');
      }
    });

    // 표
    const tables = this.container.querySelectorAll('.hwp-table');
    tables.forEach((table, index) => {
      table.setAttribute('role', 'table');
      table.setAttribute('aria-label', `표 ${index + 1}`);

      // 행
      const rows = table.querySelectorAll('tr');
      rows.forEach((row, ri) => {
        row.setAttribute('role', 'row');
        row.setAttribute('aria-rowindex', String(ri + 1));

        // 셀
        const cells = row.querySelectorAll('td, th');
        cells.forEach((cell, ci) => {
          const isHeader = cell.tagName === 'TH' || ri === 0;
          cell.setAttribute('role', isHeader ? 'columnheader' : 'cell');
          cell.setAttribute('aria-colindex', String(ci + 1));

          const colspan = cell.getAttribute('colspan');
          if (colspan && parseInt(colspan) > 1) {
            cell.setAttribute('aria-colspan', colspan);
          }

          const rowspan = cell.getAttribute('rowspan');
          if (rowspan && parseInt(rowspan) > 1) {
            cell.setAttribute('aria-rowspan', rowspan);
          }
        });
      });
    });

    // 이미지
    const images = this.container.querySelectorAll('img');
    images.forEach(img => {
      if (!img.getAttribute('alt')) {
        img.setAttribute('alt', '문서 이미지');
      }
      img.setAttribute('role', 'img');
    });

    // 링크
    const links = this.container.querySelectorAll('a[href]');
    links.forEach(link => {
      if (!link.getAttribute('aria-label')) {
        link.setAttribute('aria-label', `링크: ${link.textContent || ''}`);
      }
    });
  }

  /**
   * 키보드 네비게이션 설정
   */
  private setupKeyboardNavigation(): void {
    this.updateFocusableElements();

    this.keydownHandler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Tab': {
          // Tab/Shift+Tab으로 요소 간 이동
          e.preventDefault();
          if (e.shiftKey) {
            this.focusPrevious();
          } else {
            this.focusNext();
          }
          break;
        }

        case 'ArrowDown':
        case 'ArrowRight': {
          if (e.altKey) {
            e.preventDefault();
            this.focusNext();
          }
          break;
        }

        case 'ArrowUp':
        case 'ArrowLeft': {
          if (e.altKey) {
            e.preventDefault();
            this.focusPrevious();
          }
          break;
        }

        case 'Home': {
          if (e.ctrlKey) {
            e.preventDefault();
            this.focusFirst();
            this.announce('문서 처음으로 이동');
          }
          break;
        }

        case 'End': {
          if (e.ctrlKey) {
            e.preventDefault();
            this.focusLast();
            this.announce('문서 끝으로 이동');
          }
          break;
        }

        case 'Escape': {
          // 포커스 해제
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          this.currentFocusIndex = -1;
          break;
        }
      }
    };
    this.container.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * 포커스 가능한 요소 업데이트
   */
  updateFocusableElements(): void {
    this.focusableElements = Array.from(
      this.container.querySelectorAll<HTMLElement>(
        '.editable-paragraph, .hwp-table td, .hwp-table th, a[href], button, [tabindex="0"], img',
      ),
    );
  }

  private focusNext(): void {
    if (this.focusableElements.length === 0) return;
    this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusableElements.length;
    this.focusableElements[this.currentFocusIndex]?.focus();
  }

  private focusPrevious(): void {
    if (this.focusableElements.length === 0) return;
    this.currentFocusIndex = this.currentFocusIndex <= 0
      ? this.focusableElements.length - 1
      : this.currentFocusIndex - 1;
    this.focusableElements[this.currentFocusIndex]?.focus();
  }

  private focusFirst(): void {
    this.currentFocusIndex = 0;
    this.focusableElements[0]?.focus();
  }

  private focusLast(): void {
    this.currentFocusIndex = this.focusableElements.length - 1;
    this.focusableElements[this.currentFocusIndex]?.focus();
  }

  /**
   * 라이브 리전 생성 (스크린리더 알림)
   */
  private createLiveRegion(): void {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.className = 'sr-only';
    Object.assign(this.liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    document.body.appendChild(this.liveRegion);
  }

  /**
   * 스크린리더에 메시지 전달
   */
  announce(message: string): void {
    if (!this.liveRegion) return;
    this.liveRegion.textContent = '';
    // 새 메시지를 비동기로 설정해야 스크린리더가 감지
    requestAnimationFrame(() => {
      if (this.liveRegion) this.liveRegion.textContent = message;
    });
  }

  /**
   * 고대비 모드 적용
   */
  applyHighContrast(): void {
    const style = document.createElement('style');
    style.id = 'a11y-high-contrast';
    style.textContent = `
      .hwp-page-container, .hwp-page {
        background: #000 !important;
        color: #fff !important;
      }
      .hwp-paragraph, .hwp-table td, .hwp-table th {
        color: #fff !important;
      }
      .hwp-table td, .hwp-table th {
        border-color: #fff !important;
      }
      a { color: #ffff00 !important; }
      img { filter: contrast(1.5) !important; }
      ::selection { background: #0078d4 !important; color: #fff !important; }
      :focus {
        outline: 3px solid #ffff00 !important;
        outline-offset: 2px !important;
      }
    `;

    const existing = document.getElementById('a11y-high-contrast');
    if (existing) {
      existing.remove();
      this.container.classList.remove('high-contrast');
    } else {
      document.head.appendChild(style);
      this.container.classList.add('high-contrast');
    }
  }

  /**
   * 문서 구조 요약 (스크린리더용)
   */
  getDocumentSummary(): string {
    const pages = this.container.querySelectorAll('.hwp-page-container, .hwp-page').length;
    const paragraphs = this.container.querySelectorAll('.hwp-paragraph').length;
    const tables = this.container.querySelectorAll('.hwp-table').length;
    const images = this.container.querySelectorAll('img').length;

    const parts: string[] = [];
    if (pages > 0) parts.push(`${pages}페이지`);
    if (paragraphs > 0) parts.push(`${paragraphs}개 문단`);
    if (tables > 0) parts.push(`${tables}개 표`);
    if (images > 0) parts.push(`${images}개 이미지`);

    return `문서 구성: ${parts.join(', ')}`;
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    // 이벤트 리스너 해제
    if (this.keydownHandler) {
      this.container.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    // 라이브 리전 제거
    if (this.liveRegion) {
      this.liveRegion.remove();
      this.liveRegion = null;
    }
    // 고대비 스타일 제거
    const hcStyle = document.getElementById('a11y-high-contrast');
    if (hcStyle) hcStyle.remove();
    this.container.classList.remove('high-contrast');
    // 포커스 상태 초기화
    this.focusableElements = [];
    this.currentFocusIndex = -1;
  }
}

export default AccessibilityManager;
