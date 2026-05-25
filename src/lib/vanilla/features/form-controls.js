/**
 * Form Controls
 * HWPX 양식 컨트롤 ↔ HTML input 매핑 + 상태 변경 콜백.
 *
 *  HWPX 태그      run.type        HTML element
 *  ───────────────────────────────────────────────
 *  hp:checkbox    checkbox        <input type="checkbox">
 *  hp:radio       radio           <input type="radio">
 *  hp:combobox    combobox        <select>
 *  hp:textInput   textInput       <input type="text">
 *  hp:button      button          <button>
 *
 * 본 모듈은 두 가지를 export 한다:
 *  - parseFormControl(elem, tag): XML 요소 → run-like 객체
 *  - renderFormControl(run, opts): run 객체 → HTMLElement
 *
 * @module features/form-controls
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/** parseInt 안전 wrapper */
function _attrInt(elem, name) {
  if (!elem || typeof elem.getAttribute !== 'function') return null;
  const v = elem.getAttribute(name);
  if (v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function _attrBool(elem, name) {
  if (!elem || typeof elem.getAttribute !== 'function') return false;
  const v = elem.getAttribute(name);
  if (v === null) return false;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'checked' || s === 'yes' || s === '';
}

/**
 * HWPX 양식 컨트롤 XML 요소 → run-like 객체로 정규화한다.
 * @param {Element} elem
 * @param {string} tag  소문자 tag 명 (예: 'checkbox', 'radio', 'combobox', 'textinput', 'button')
 * @returns {Object|null}
 */
export function parseFormControl(elem, tag) {
  if (!elem || !tag) return null;
  const normalized = String(tag).toLowerCase();

  switch (normalized) {
    case 'checkbox': {
      const run = {
        type: 'checkbox',
        text: '',
        checked: _attrBool(elem, 'checked') || _attrBool(elem, 'value'),
        name: elem.getAttribute('name') || elem.getAttribute('id') || null,
        label: elem.getAttribute('label') || elem.textContent || '',
        disabled: _attrBool(elem, 'disabled') || _attrBool(elem, 'readOnly'),
        style: {},
      };
      return run;
    }
    case 'radio': {
      return {
        type: 'radio',
        text: '',
        group: elem.getAttribute('group') || elem.getAttribute('name') || '',
        name: elem.getAttribute('name') || elem.getAttribute('id') || null,
        value: elem.getAttribute('value') || '',
        checked: _attrBool(elem, 'checked'),
        label: elem.getAttribute('label') || elem.textContent || '',
        disabled: _attrBool(elem, 'disabled') || _attrBool(elem, 'readOnly'),
        style: {},
      };
    }
    case 'combobox':
    case 'dropdown': {
      const items = [];
      // 우선 items 속성 (comma-separated) → 그 다음 자식 <hp:item> 또는 <option>
      const itemsAttr = elem.getAttribute('items');
      if (itemsAttr) {
        itemsAttr.split(/[,;|]/).forEach(t => {
          const trimmed = t.trim();
          if (trimmed) items.push({ value: trimmed, label: trimmed });
        });
      }
      const childItems = elem.querySelectorAll
        ? elem.querySelectorAll('item, hp\\:item, option')
        : [];
      childItems.forEach(child => {
        const value = child.getAttribute('value') || child.textContent || '';
        const label = child.getAttribute('label') || child.textContent || value;
        if (value || label) items.push({ value, label });
      });
      return {
        type: 'combobox',
        text: '',
        name: elem.getAttribute('name') || elem.getAttribute('id') || null,
        items,
        value: elem.getAttribute('value') || elem.getAttribute('selected') || '',
        disabled: _attrBool(elem, 'disabled') || _attrBool(elem, 'readOnly'),
        style: {},
      };
    }
    case 'textinput':
    case 'text-input': {
      return {
        type: 'textInput',
        text: '',
        name: elem.getAttribute('name') || elem.getAttribute('id') || null,
        value: elem.getAttribute('value') || elem.textContent || '',
        placeholder: elem.getAttribute('placeholder') || '',
        maxLength: _attrInt(elem, 'maxLength') || _attrInt(elem, 'maxlength'),
        disabled: _attrBool(elem, 'disabled') || _attrBool(elem, 'readOnly'),
        style: {},
      };
    }
    case 'button':
    case 'pushbutton': {
      return {
        type: 'button',
        text: elem.getAttribute('label') || elem.textContent || '버튼',
        name: elem.getAttribute('name') || elem.getAttribute('id') || null,
        action: elem.getAttribute('action') || '',
        disabled: _attrBool(elem, 'disabled'),
        style: {},
      };
    }
    default:
      return null;
  }
}

/**
 * run 객체 → HTMLElement 변환.
 *
 * @param {Object} run
 * @param {Object} [opts]
 * @param {boolean} [opts.editable=false]  편집 모드 (false → readonly/disabled)
 * @param {Function} [opts.onChange]       (run, newValue) => void
 * @returns {HTMLElement|null}
 */
export function renderFormControl(run, opts = {}) {
  if (!run || typeof run.type !== 'string') return null;

  const editable = opts.editable === true;
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
  const markDirty = typeof opts.onDirty === 'function' ? opts.onDirty : null;

  const fireChange = newValue => {
    if (onChange) {
      try {
        onChange(run, newValue);
      } catch (err) {
        logger.error('renderFormControl onChange error', err);
      }
    }
    if (markDirty) {
      try {
        markDirty();
      } catch (err) {
        logger.error('renderFormControl onDirty error', err);
      }
    }
  };

  const disabled = !editable || run.disabled === true;

  switch (run.type) {
    case 'checkbox': {
      const wrap = document.createElement('label');
      wrap.className = 'hwp-form-control hwp-form-checkbox';
      wrap.style.display = 'inline-flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '4px';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'hwp-form-control__input';
      if (run.checked) input.checked = true;
      if (run.name) input.name = run.name;
      input.disabled = disabled;
      input.addEventListener('change', () => {
        run.checked = input.checked;
        fireChange(input.checked);
      });
      wrap.appendChild(input);

      if (run.label) {
        const lbl = document.createElement('span');
        lbl.className = 'hwp-form-control__label';
        lbl.textContent = run.label;
        wrap.appendChild(lbl);
      }
      return wrap;
    }
    case 'radio': {
      const wrap = document.createElement('label');
      wrap.className = 'hwp-form-control hwp-form-radio';
      wrap.style.display = 'inline-flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '4px';

      const input = document.createElement('input');
      input.type = 'radio';
      input.className = 'hwp-form-control__input';
      if (run.group) input.name = run.group;
      else if (run.name) input.name = run.name;
      if (run.value !== undefined && run.value !== null) input.value = String(run.value);
      if (run.checked) input.checked = true;
      input.disabled = disabled;
      input.addEventListener('change', () => {
        run.checked = input.checked;
        fireChange(input.value);
      });
      wrap.appendChild(input);

      if (run.label) {
        const lbl = document.createElement('span');
        lbl.className = 'hwp-form-control__label';
        lbl.textContent = run.label;
        wrap.appendChild(lbl);
      }
      return wrap;
    }
    case 'combobox': {
      const select = document.createElement('select');
      select.className = 'hwp-form-control hwp-form-combobox';
      if (run.name) select.name = run.name;
      select.disabled = disabled;
      const items = Array.isArray(run.items) ? run.items : [];
      for (const item of items) {
        const opt = document.createElement('option');
        opt.value = item.value !== undefined ? String(item.value) : '';
        opt.textContent = item.label || item.value || '';
        if (run.value !== undefined && String(run.value) === opt.value) {
          opt.selected = true;
        }
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        run.value = select.value;
        fireChange(select.value);
      });
      return select;
    }
    case 'textInput': {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'hwp-form-control hwp-form-text';
      if (run.name) input.name = run.name;
      if (run.value !== undefined && run.value !== null) input.value = String(run.value);
      if (run.placeholder) input.placeholder = run.placeholder;
      if (Number.isFinite(run.maxLength) && run.maxLength > 0) {
        input.maxLength = run.maxLength;
      }
      if (disabled) {
        input.readOnly = true;
        if (run.disabled) input.disabled = true;
      }
      input.addEventListener('input', () => {
        run.value = input.value;
        fireChange(input.value);
      });
      return input;
    }
    case 'button': {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hwp-form-control hwp-form-button';
      if (run.name) btn.name = run.name;
      btn.textContent = run.text || '버튼';
      btn.disabled = disabled;
      btn.addEventListener('click', () => {
        fireChange(run.action || run.name || 'click');
      });
      return btn;
    }
    default:
      return null;
  }
}

/** 본 모듈이 인식하는 양식 컨트롤 tag 목록 (대소문자 무관). */
export const FORM_CONTROL_TAGS = [
  'checkbox',
  'radio',
  'combobox',
  'dropdown',
  'textinput',
  'text-input',
  'button',
  'pushbutton',
];

/**
 * 주어진 tag 가 양식 컨트롤인지 판정.
 * @param {string} tag
 */
export function isFormControlTag(tag) {
  if (!tag) return false;
  return FORM_CONTROL_TAGS.includes(String(tag).toLowerCase());
}

export default {
  parseFormControl,
  renderFormControl,
  isFormControlTag,
  FORM_CONTROL_TAGS,
};
