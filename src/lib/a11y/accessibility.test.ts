import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccessibilityManager } from './accessibility';

describe('AccessibilityManager', () => {
  let container: HTMLDivElement;
  let a11y: AccessibilityManager;

  beforeEach(() => {
    container = document.createElement('div');

    // 테스트용 문서 구조 생성
    const page = document.createElement('div');
    page.className = 'hwp-page-container';

    const para = document.createElement('div');
    para.className = 'hwp-paragraph editable-paragraph';
    para.textContent = '테스트 문단';
    page.appendChild(para);

    const table = document.createElement('table');
    table.className = 'hwp-table';
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = '헤더';
    const td = document.createElement('td');
    td.textContent = '데이터';
    td.setAttribute('colspan', '2');
    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
    page.appendChild(table);

    const img = document.createElement('img');
    img.src = 'test.png';
    page.appendChild(img);

    container.appendChild(page);
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (a11y) a11y.destroy();
    container.remove();
  });

  describe('ARIA 속성 적용', () => {
    it('컨테이너에 role=document 설정', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      expect(container.getAttribute('role')).toBe('document');
      expect(container.getAttribute('aria-label')).toBe('문서 뷰어');
    });

    it('페이지에 region role 설정', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      const page = container.querySelector('.hwp-page-container');
      expect(page?.getAttribute('role')).toBe('region');
      expect(page?.getAttribute('aria-label')).toBe('페이지 1');
    });

    it('편집 가능 문단에 tabindex 설정', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      const para = container.querySelector('.editable-paragraph');
      expect(para?.getAttribute('tabindex')).toBe('0');
    });

    it('표에 role=table 설정', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      const table = container.querySelector('.hwp-table');
      expect(table?.getAttribute('role')).toBe('table');
    });

    it('th에 columnheader role 설정', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      const th = container.querySelector('th');
      expect(th?.getAttribute('role')).toBe('columnheader');
    });

    it('colspan이 있는 셀에 aria-colspan 설정', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      const td = container.querySelector('td');
      expect(td?.getAttribute('aria-colspan')).toBe('2');
    });

    it('alt 없는 이미지에 기본 alt 설정', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      const img = container.querySelector('img');
      expect(img?.getAttribute('alt')).toBe('문서 이미지');
    });
  });

  describe('키보드 네비게이션', () => {
    it('포커스 가능 요소 목록 업데이트', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      a11y.updateFocusableElements();
      // editable-paragraph + th + td + img = 4개 이상
      expect(a11y['focusableElements'].length).toBeGreaterThan(0);
    });
  });

  describe('announce', () => {
    it('라이브 리전에 메시지 전달', async () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      a11y.announce('테스트 메시지');
      // requestAnimationFrame 후 확인
      await new Promise(resolve => requestAnimationFrame(resolve));
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toBe('테스트 메시지');
    });
  });

  describe('getDocumentSummary', () => {
    it('문서 구조 요약 반환', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      const summary = a11y.getDocumentSummary();
      expect(summary).toContain('1페이지');
      expect(summary).toContain('1개 표');
      expect(summary).toContain('1개 이미지');
    });
  });

  describe('destroy', () => {
    it('리소스 정리', () => {
      a11y = new AccessibilityManager(container);
      a11y.init();
      expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
      a11y.destroy();
      expect(document.querySelector('[aria-live="polite"]')).toBeNull();
      expect(a11y['keydownHandler']).toBeNull();
    });
  });

  describe('고대비 모드', () => {
    it('고대비 스타일 토글', () => {
      a11y = new AccessibilityManager(container, { enableHighContrast: true });
      a11y.init();
      expect(document.getElementById('a11y-high-contrast')).not.toBeNull();
      expect(container.classList.contains('high-contrast')).toBe(true);
    });
  });
});
