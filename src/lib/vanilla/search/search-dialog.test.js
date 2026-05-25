import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountSearchDialog } from './search-dialog.js';

let mount;

beforeEach(() => {
  document.body.innerHTML = '';
  mount = document.createElement('div');
  document.body.appendChild(mount);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('search-dialog', () => {
  it('mounts as hidden floating panel by default', () => {
    const handle = mountSearchDialog(mount);
    expect(handle.element.classList.contains('search-dialog')).toBe(true);
    expect(handle.element.style.display).toBe('none');
    handle.destroy();
  });

  it('open() shows the panel and close() hides it', () => {
    const handle = mountSearchDialog(mount);
    handle.open();
    expect(handle.element.style.display).not.toBe('none');
    handle.close();
    expect(handle.element.style.display).toBe('none');
    handle.destroy();
  });

  it('input typing fires onChange with current query/options', () => {
    let lastQuery = '';
    let lastOpts = null;
    const handle = mountSearchDialog(mount, {
      onChange: (q, o) => {
        lastQuery = q;
        lastOpts = o;
      },
    });
    const input = handle.element.querySelector('input');
    input.value = '안녕';
    input.dispatchEvent(new Event('input'));
    expect(lastQuery).toBe('안녕');
    expect(lastOpts).toBeTruthy();
    expect(lastOpts.regex).toBe(false);
    handle.destroy();
  });

  it('toggle buttons flip pressed state and reflect in options', () => {
    const handle = mountSearchDialog(mount);
    const regexBtn = handle.element.querySelector('[data-role="regex"]');
    regexBtn.click();
    expect(regexBtn.dataset.pressed).toBe('true');
    expect(handle.getOptions().regex).toBe(true);
    regexBtn.click();
    expect(handle.getOptions().regex).toBe(false);
    handle.destroy();
  });

  it('setCount updates label', () => {
    const handle = mountSearchDialog(mount);
    handle.setCount(0, -1);
    expect(handle.element.querySelector('.search-dialog__count').textContent).toBe('0/0');
    handle.setCount(5, 2);
    expect(handle.element.querySelector('.search-dialog__count').textContent).toBe('3/5');
    handle.destroy();
  });

  it('Ctrl+F opens dialog, ESC closes', () => {
    const handle = mountSearchDialog(mount);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }),
    );
    expect(handle.element.style.display).not.toBe('none');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(handle.element.style.display).toBe('none');
    handle.destroy();
  });

  it('F3 calls onNext, Shift+F3 calls onPrev', () => {
    let nextCount = 0;
    let prevCount = 0;
    const handle = mountSearchDialog(mount, {
      onNext: () => nextCount++,
      onPrev: () => prevCount++,
    });
    handle.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', bubbles: true }));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F3', shiftKey: true, bubbles: true }),
    );
    expect(nextCount).toBe(1);
    expect(prevCount).toBe(1);
    handle.destroy();
  });

  it('destroy removes the panel and detaches listeners', () => {
    const handle = mountSearchDialog(mount);
    handle.open();
    handle.destroy();
    expect(mount.querySelector('.search-dialog')).toBeNull();
    // After destroy, Ctrl+F should not re-create
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }),
    );
    expect(mount.querySelector('.search-dialog')).toBeNull();
  });
});
