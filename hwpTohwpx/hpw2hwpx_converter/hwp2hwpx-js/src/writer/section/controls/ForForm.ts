/**
 * ForForm.ts - Form Controls OWPML Generator
 * 양식 컨트롤 (체크박스, 라디오, 콤보박스 등) OWPML 생성 모듈
 */

/**
 * Form control types
 */
export const FormControlType = {
    EDIT: 'EDIT',               // 입력 필드
    CHECKBOX: 'CHECKBOX',       // 체크박스
    RADIO: 'RADIO',             // 라디오 버튼
    COMBOBOX: 'COMBOBOX',       // 콤보박스 (드롭다운)
    LISTBOX: 'LISTBOX',         // 리스트박스
    BUTTON: 'BUTTON',           // 버튼
    DATEPICKER: 'DATEPICKER',   // 날짜 선택기
    NUMERICUD: 'NUMERICUD'      // 숫자 업다운
} as const;

/**
 * Base form control interface
 */
export interface FormControl {
    id: number;
    type: keyof typeof FormControlType;
    name: string;                    // 컨트롤 이름
    width: number;                   // 너비 (HWPUNIT)
    height: number;                  // 높이 (HWPUNIT)
    enabled?: boolean;               // 활성화 여부
    readonly?: boolean;              // 읽기 전용
    tabOrder?: number;               // 탭 순서
    tooltip?: string;                // 도움말 텍스트
    charPrIDRef?: number;            // 문자 서식 ID
}

/**
 * Edit/Text input control
 */
export interface EditControl extends FormControl {
    type: 'EDIT';
    value?: string;                  // 현재 값
    placeholder?: string;            // 플레이스홀더
    maxLength?: number;              // 최대 길이
    password?: boolean;              // 비밀번호 모드
    multiLine?: boolean;             // 여러 줄
}

/**
 * Checkbox control
 */
export interface CheckboxControl extends FormControl {
    type: 'CHECKBOX';
    checked?: boolean;               // 체크 상태
    groupName?: string;              // 그룹 이름 (그룹 체크박스용)
    triState?: boolean;              // 3상태 지원
}

/**
 * Radio button control
 */
export interface RadioControl extends FormControl {
    type: 'RADIO';
    checked?: boolean;               // 선택 상태
    groupName: string;               // 그룹 이름 (필수)
    value?: string;                  // 값
}

/**
 * Combobox/Dropdown control
 */
export interface ComboboxControl extends FormControl {
    type: 'COMBOBOX';
    items: string[];                 // 선택 항목들
    selectedIndex?: number;          // 선택된 인덱스
    editable?: boolean;              // 편집 가능 여부
}

/**
 * Listbox control
 */
export interface ListboxControl extends FormControl {
    type: 'LISTBOX';
    items: string[];                 // 항목들
    selectedIndices?: number[];      // 선택된 인덱스 (다중 선택)
    multiSelect?: boolean;           // 다중 선택 허용
}

/**
 * Button control
 */
export interface ButtonControl extends FormControl {
    type: 'BUTTON';
    caption: string;                 // 버튼 텍스트
    action?: string;                 // 클릭 액션 (매크로 등)
}

/**
 * Any form control type
 */
export type AnyFormControl =
    | EditControl
    | CheckboxControl
    | RadioControl
    | ComboboxControl
    | ListboxControl
    | ButtonControl
    | FormControl;

/**
 * Extended form control interface with formType for HWP compatibility
 */
interface FormControlWithFormType extends FormControl {
    formType?: keyof typeof FormControlType;
}

/**
 * Generate OWPML form control XML
 * @param control Form control definition
 * @returns OWPML form control XML string
 */
export function formControlToXml(control: AnyFormControl): string {
    // Support both 'type' and 'formType' fields for compatibility
    const extControl = control as FormControlWithFormType;
    const controlType = extControl.formType || control.type;
    const controlId = control.id ?? 0;

    const baseAttrs = [
        `id="${controlId}"`,
        `ctrlId="form"`,
        `name="${escapeXml(control.name)}"`,
        control.enabled === false ? 'enabled="0"' : '',
        control.readonly ? 'readonly="1"' : '',
        control.tabOrder !== undefined ? `tabOrder="${control.tabOrder}"` : ''
    ].filter(Boolean).join(' ');

    const sizeContent = `<hp:sz width="${control.width}" height="${control.height}"/>`;

    // Generate type-specific content
    let typeContent = '';

    switch (controlType) {
        case 'CHECKBOX': {
            const cb = control as CheckboxControl;
            typeContent = `<hp:checkBox checked="${cb.checked ? '1' : '0'}" triState="${cb.triState ? '1' : '0'}"/>`;
            break;
        }

        case 'RADIO': {
            const rb = control as RadioControl;
            typeContent = `<hp:radioButton checked="${rb.checked ? '1' : '0'}" groupName="${escapeXml(rb.groupName)}" value="${escapeXml(rb.value || '')}"/>`;
            break;
        }

        case 'COMBOBOX': {
            const combo = control as ComboboxControl;
            const comboItems = combo.items.map((item, idx) =>
                `<hp:item index="${idx}">${escapeXml(item)}</hp:item>`
            ).join('\n          ');
            typeContent = `<hp:comboBox selectedIndex="${combo.selectedIndex ?? -1}" editable="${combo.editable ? '1' : '0'}">
          ${comboItems}
        </hp:comboBox>`;
            break;
        }

        case 'LISTBOX': {
            const lb = control as ListboxControl;
            const lbItems = lb.items.map((item, idx) =>
                `<hp:item index="${idx}" selected="${(lb.selectedIndices?.includes(idx)) ? '1' : '0'}">${escapeXml(item)}</hp:item>`
            ).join('\n          ');
            typeContent = `<hp:listBox multiSelect="${lb.multiSelect ? '1' : '0'}">
          ${lbItems}
        </hp:listBox>`;
            break;
        }

        case 'EDIT': {
            const ed = control as EditControl;
            typeContent = `<hp:editBox maxLength="${ed.maxLength ?? 0}" password="${ed.password ? '1' : '0'}" multiLine="${ed.multiLine ? '1' : '0'}">
          <hp:value>${escapeXml(ed.value || '')}</hp:value>
          ${ed.placeholder ? `<hp:placeholder>${escapeXml(ed.placeholder)}</hp:placeholder>` : ''}
        </hp:editBox>`;
            break;
        }

        case 'BUTTON': {
            const btn = control as ButtonControl;
            typeContent = `<hp:button>
          <hp:caption>${escapeXml(btn.caption)}</hp:caption>
          ${btn.action ? `<hp:action>${escapeXml(btn.action)}</hp:action>` : ''}
        </hp:button>`;
            break;
        }

        default:
            typeContent = `<!-- Unknown form control type: ${control.type} -->`;
    }

    return `<hp:ctrl>
    <hp:formObject ${baseAttrs}>
      ${sizeContent}
      ${control.tooltip ? `<hp:tooltip>${escapeXml(control.tooltip)}</hp:tooltip>` : ''}
      ${typeContent}
    </hp:formObject>
  </hp:ctrl>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Create a checkbox control
 */
export function createCheckbox(
    id: number,
    name: string,
    checked: boolean = false,
    width: number = 3000,
    height: number = 3000
): CheckboxControl {
    return {
        id,
        type: 'CHECKBOX',
        name,
        width,
        height,
        checked
    };
}

/**
 * Create a combobox control
 */
export function createCombobox(
    id: number,
    name: string,
    items: string[],
    selectedIndex: number = 0,
    width: number = 20000,
    height: number = 4000
): ComboboxControl {
    return {
        id,
        type: 'COMBOBOX',
        name,
        width,
        height,
        items,
        selectedIndex,
        editable: false
    };
}

/**
 * Create a radio button control
 */
export function createRadio(
    id: number,
    name: string,
    groupName: string,
    checked: boolean = false,
    width: number = 3000,
    height: number = 3000
): RadioControl {
    return {
        id,
        type: 'RADIO',
        name,
        width,
        height,
        groupName,
        checked
    };
}

/**
 * Create an edit/text input control
 */
export function createEdit(
    id: number,
    name: string,
    value: string = '',
    width: number = 30000,
    height: number = 4000
): EditControl {
    return {
        id,
        type: 'EDIT',
        name,
        width,
        height,
        value
    };
}
