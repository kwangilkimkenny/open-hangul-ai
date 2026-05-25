/**
 * form-controls 테스트
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  parseFormControl,
  renderFormControl,
  isFormControlTag,
  FORM_CONTROL_TAGS,
} from './form-controls.js';

function fakeElem({ attrs = {}, text = '', children = [] } = {}) {
  return {
    getAttribute: k => (k in attrs ? attrs[k] : null),
    textContent: text,
    querySelectorAll: sel => {
      // 단순 'item, hp:item, option' 처리 — children 의 type 비교
      const wanted = sel.split(',').map(s => s.trim().replace(/^hp\\?:/, ''));
      return children.filter(c => wanted.includes(c.type));
    },
  };
}

describe('form-controls.parseFormControl', () => {
  it('checkbox: checked + label + disabled', () => {
    const elem = fakeElem({ attrs: { checked: '1', label: 'agree', disabled: '1' }, text: '' });
    const run = parseFormControl(elem, 'checkbox');
    expect(run.type).toBe('checkbox');
    expect(run.checked).toBe(true);
    expect(run.label).toBe('agree');
    expect(run.disabled).toBe(true);
  });

  it('radio: group + value', () => {
    const elem = fakeElem({ attrs: { group: 'g1', value: 'opt-a', checked: '1' } });
    const run = parseFormControl(elem, 'radio');
    expect(run.type).toBe('radio');
    expect(run.group).toBe('g1');
    expect(run.value).toBe('opt-a');
    expect(run.checked).toBe(true);
  });

  it('combobox: items attr', () => {
    const elem = fakeElem({ attrs: { items: 'apple,banana,cherry', value: 'banana' } });
    const run = parseFormControl(elem, 'combobox');
    expect(run.type).toBe('combobox');
    expect(run.items.length).toBe(3);
    expect(run.items[1].label).toBe('banana');
    expect(run.value).toBe('banana');
  });

  it('textInput: value + maxLength', () => {
    const elem = fakeElem({ attrs: { value: 'hello', maxLength: '12' } });
    const run = parseFormControl(elem, 'textInput');
    expect(run.type).toBe('textInput');
    expect(run.value).toBe('hello');
    expect(run.maxLength).toBe(12);
  });

  it('button: label + action', () => {
    const elem = fakeElem({ attrs: { label: 'Send', action: 'submit' } });
    const run = parseFormControl(elem, 'pushbutton');
    expect(run.type).toBe('button');
    expect(run.text).toBe('Send');
    expect(run.action).toBe('submit');
  });

  it('unknown tag returns null', () => {
    expect(parseFormControl(fakeElem(), 'unknown')).toBeNull();
    expect(parseFormControl(null, 'checkbox')).toBeNull();
  });

  it('isFormControlTag recognises all known tags', () => {
    for (const tag of FORM_CONTROL_TAGS) {
      expect(isFormControlTag(tag)).toBe(true);
    }
    expect(isFormControlTag('paragraph')).toBe(false);
  });
});

describe('form-controls.renderFormControl', () => {
  it('checkbox → <input type=checkbox> + change callback', () => {
    const run = { type: 'checkbox', checked: false, label: 'agree', name: 'a' };
    const onChange = vi.fn();
    const onDirty = vi.fn();
    const wrap = renderFormControl(run, { editable: true, onChange, onDirty });
    expect(wrap.tagName).toBe('LABEL');
    const input = wrap.querySelector('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect(input.disabled).toBe(false);
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    expect(run.checked).toBe(true);
    expect(onChange).toHaveBeenCalledWith(run, true);
    expect(onDirty).toHaveBeenCalled();
  });

  it('radio → <input type=radio> with group name', () => {
    const run = { type: 'radio', group: 'g', value: 'v', checked: true, label: 'L' };
    const wrap = renderFormControl(run, { editable: true });
    const input = wrap.querySelector('input[type="radio"]');
    expect(input.name).toBe('g');
    expect(input.value).toBe('v');
    expect(input.checked).toBe(true);
  });

  it('combobox → <select> with options', () => {
    const run = {
      type: 'combobox',
      items: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      value: 'b',
    };
    const select = renderFormControl(run, { editable: true });
    expect(select.tagName).toBe('SELECT');
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('b');
  });

  it('textInput → readonly when not editable', () => {
    const run = { type: 'textInput', value: 'x' };
    const input = renderFormControl(run, { editable: false });
    expect(input.tagName).toBe('INPUT');
    expect(input.readOnly).toBe(true);
  });

  it('button → click triggers onChange with action', () => {
    const run = { type: 'button', text: 'Go', action: 'fire' };
    const onChange = vi.fn();
    const btn = renderFormControl(run, { editable: true, onChange });
    expect(btn.tagName).toBe('BUTTON');
    btn.click();
    expect(onChange).toHaveBeenCalledWith(run, 'fire');
  });
});
