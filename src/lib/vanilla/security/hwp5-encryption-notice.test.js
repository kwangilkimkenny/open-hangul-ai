import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { showHwp5EncryptionNotice, isHwp5EncryptionError } from './hwp5-encryption-notice.js';

describe('hwp5-encryption-notice', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a modal with the document name and 안내 문구', () => {
    const { element, close } = showHwp5EncryptionNotice({ documentName: '계약서.hwp' });
    expect(element).toBeTruthy();
    expect(document.querySelector('.hwp5-encryption-notice')).toBeTruthy();
    expect(element.textContent).toContain('계약서.hwp');
    expect(element.textContent).toContain('암호로 보호');
    expect(element.getAttribute('role')).toBe('dialog');
    expect(element.getAttribute('aria-modal')).toBe('true');
    close();
  });

  it('lists 4 conversion steps in order', () => {
    const { element, close } = showHwp5EncryptionNotice({ documentName: 'doc.hwp' });
    const items = element.querySelectorAll('ol li');
    expect(items.length).toBe(4);
    expect(items[0].textContent).toContain('한컴 한글');
    expect(items[1].textContent).toContain('HWPX');
    close();
  });

  it('does not use innerHTML for any text injection', () => {
    const { element, close } = showHwp5EncryptionNotice({
      documentName: '<script>alert(1)</script>',
    });
    // 텍스트가 escape 되어 script 요소로 파싱되지 않아야 함
    expect(element.querySelector('script')).toBeNull();
    expect(element.textContent).toContain('<script>alert(1)</script>');
    close();
  });

  it('closes on ESC and removes itself from DOM', () => {
    showHwp5EncryptionNotice({ documentName: 'a.hwp' });
    expect(document.querySelector('.hwp5-encryption-notice')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.hwp5-encryption-notice')).toBeNull();
  });

  it('closes when 확인 버튼 is clicked and calls onClose', () => {
    let closed = false;
    showHwp5EncryptionNotice({
      documentName: 'b.hwp',
      onClose: () => {
        closed = true;
      },
    });
    const btn = document.querySelector('.hwp5-encryption-notice button');
    btn.click();
    expect(closed).toBe(true);
    expect(document.querySelector('.hwp5-encryption-notice')).toBeNull();
  });

  it('closes when clicking the overlay (outside the card)', () => {
    const { element } = showHwp5EncryptionNotice({ documentName: 'c.hwp' });
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.hwp5-encryption-notice')).toBeNull();
  });

  it('isHwp5EncryptionError() detects HWP5_ENCRYPTED code', () => {
    expect(isHwp5EncryptionError({ code: 'HWP5_ENCRYPTED' })).toBe(true);
    expect(isHwp5EncryptionError({ code: 'HWPX_DECRYPT_FAILED' })).toBe(false);
    expect(isHwp5EncryptionError(null)).toBe(false);
    expect(isHwp5EncryptionError(undefined)).toBe(false);
    expect(isHwp5EncryptionError('error')).toBe(false);
  });
});
