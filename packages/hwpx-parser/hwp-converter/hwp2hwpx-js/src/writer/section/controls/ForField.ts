/**
 * HWPML-compliant Field XML Generation
 * Supports: FIELD_BEGIN, FIELD_END, and various field types
 */

import { generateInstanceId } from '../../../util/IdGenerator';

/**
 * Complete field type enumeration based on OWPML specification
 * 모든 필드 타입을 포함하는 완전한 열거형
 */
const FieldType = {
    // 기본 필드
    PAGE_NUMBER: 0,      // 쪽 번호
    TOTAL_PAGES: 1,      // 총 쪽수
    DATE: 2,             // 날짜
    TIME: 3,             // 시간
    TITLE: 4,            // 문서 제목
    AUTHOR: 5,           // 저자
    FILENAME: 6,         // 파일명
    PATH: 7,             // 파일 경로

    // 확장 필드
    BOOKMARK: 8,         // 책갈피
    MAIL_MERGE: 9,       // 메일 머지
    CROSS_REF: 10,       // 상호 참조
    FORMULA: 11,         // 계산식
    CLICK_HERE: 12,      // 누름틀
    SUMMARY: 13,         // 요약 정보
    USER_INFO: 14,       // 사용자 정보
    HYPERLINK: 15,       // 하이퍼링크

    // 머리글/꼬리글 필드
    REVISION_DATE: 16,   // 수정 날짜
    REVISION_TIME: 17,   // 수정 시간
    PRINT_DATE: 18,      // 인쇄 날짜
    PRINT_TIME: 19,      // 인쇄 시간

    // 추가 필드
    EDIT_TIME: 20,       // 편집 시간
    CHAR_COUNT: 21,      // 글자 수
    WORD_COUNT: 22,      // 단어 수
    LINE_COUNT: 23,      // 줄 수
    PARA_COUNT: 24,      // 문단 수
    PAGE_COUNT: 25,      // 페이지 수

    // 메모/주석
    MEMO: 26,            // 메모
    PRIVATE_INFO: 27,    // 개인 정보
    TABLE_OF_CONTENTS: 28, // 목차
    INDEX: 29,           // 색인

    // 양식
    FORM_TEXT: 30,       // 텍스트 양식
    FORM_CHECK: 31,      // 체크박스 양식
    FORM_COMBO: 32,      // 콤보박스 양식
} as const;

// Field interface matching the control object
interface Field {
    id?: number;
    type?: number;
    autoUpdate?: boolean;
    data?: FieldData;
}

interface FieldData {
    type?: string;
    format?: string;
    value?: string;
    totalPages?: boolean;
    expression?: string;
    fieldName?: string;
}

/**
 * Convert Field control to OWPML XML (Field Begin)
 */
export function fieldBeginToXml(field: Field): string {
    const instId = generateInstanceId();
    const fieldTypeName = getFieldTypeName(field.type);
    const fieldValue = getFieldValue(field);

    return `<hp:fieldBegin id="${instId}" type="${fieldTypeName}" name="" autoUpdate="${field.autoUpdate ? '1' : '0'}">
  <hp:fieldData>${escapeXml(fieldValue)}</hp:fieldData>
</hp:fieldBegin>`;
}

/**
 * Convert Field control to OWPML XML (Field End)
 */
export function fieldEndToXml(fieldId?: number): string {
    const instId = fieldId || generateInstanceId();

    return `<hp:fieldEnd id="${instId}"/>`;
}

// === Helper Functions ===

/**
 * Get OWPML field type name from numeric type
 * 숫자 타입에서 OWPML 필드 타입 이름 반환
 */
function getFieldTypeName(type: number | undefined): string {
    if (type === undefined || type === null) return 'CLICK_HERE'; // 기본값: 누름틀

    const names: { [key: number]: string } = {
        // 기본 필드
        [FieldType.PAGE_NUMBER]: 'PAGE_NUM',
        [FieldType.TOTAL_PAGES]: 'PAGE_CNT',
        [FieldType.DATE]: 'CREATE_DATE',
        [FieldType.TIME]: 'CREATE_TIME',
        [FieldType.TITLE]: 'DOC_TITLE',
        [FieldType.AUTHOR]: 'DOC_AUTHOR',
        [FieldType.FILENAME]: 'FILE_NAME',
        [FieldType.PATH]: 'FILE_PATH',

        // 확장 필드
        [FieldType.BOOKMARK]: 'BOOKMARK',
        [FieldType.MAIL_MERGE]: 'MAIL_MERGE',
        [FieldType.CROSS_REF]: 'CROSS_REF',
        [FieldType.FORMULA]: 'FORMULA',
        [FieldType.CLICK_HERE]: 'CLICK_HERE',
        [FieldType.SUMMARY]: 'DOC_SUMMARY',
        [FieldType.USER_INFO]: 'USER_INFO',
        [FieldType.HYPERLINK]: 'HYPERLINK',

        // 머리글/꼬리글 필드
        [FieldType.REVISION_DATE]: 'REVISION_DATE',
        [FieldType.REVISION_TIME]: 'REVISION_TIME',
        [FieldType.PRINT_DATE]: 'PRINT_DATE',
        [FieldType.PRINT_TIME]: 'PRINT_TIME',

        // 추가 필드
        [FieldType.EDIT_TIME]: 'EDIT_TIME',
        [FieldType.CHAR_COUNT]: 'CHAR_CNT',
        [FieldType.WORD_COUNT]: 'WORD_CNT',
        [FieldType.LINE_COUNT]: 'LINE_CNT',
        [FieldType.PARA_COUNT]: 'PARA_CNT',
        [FieldType.PAGE_COUNT]: 'PAGE_CNT',

        // 메모/주석
        [FieldType.MEMO]: 'MEMO',
        [FieldType.PRIVATE_INFO]: 'PRIVATE_INFO',
        [FieldType.TABLE_OF_CONTENTS]: 'TOC',
        [FieldType.INDEX]: 'INDEX',

        // 양식
        [FieldType.FORM_TEXT]: 'FORM_TEXT',
        [FieldType.FORM_CHECK]: 'FORM_CHECK',
        [FieldType.FORM_COMBO]: 'FORM_COMBO',
    };
    return names[type] || 'CLICK_HERE';
}

/**
 * Get field value based on field data type
 * 필드 데이터 타입에 따른 값 반환
 */
function getFieldValue(field: Field): string {
    if (!field.data) return '';

    switch (field.data.type) {
        // 페이지 관련
        case 'PAGE_NUMBER':
            return field.data.totalPages ? '1/1' : '1';
        case 'TOTAL_PAGES':
            return '1';

        // 날짜/시간
        case 'DATE':
        case 'CREATE_DATE':
            return field.data.format || 'YYYY-MM-DD';
        case 'TIME':
        case 'CREATE_TIME':
            return field.data.format || 'HH:mm:ss';
        case 'REVISION_DATE':
            return field.data.format || 'YYYY-MM-DD';
        case 'REVISION_TIME':
            return field.data.format || 'HH:mm:ss';
        case 'PRINT_DATE':
            return field.data.format || 'YYYY-MM-DD';
        case 'PRINT_TIME':
            return field.data.format || 'HH:mm:ss';

        // 문서 정보
        case 'TITLE':
        case 'DOC_TITLE':
            return field.data.value || '';
        case 'AUTHOR':
        case 'DOC_AUTHOR':
            return field.data.value || '';
        case 'FILENAME':
        case 'FILE_NAME':
            return field.data.value || 'document.hwpx';
        case 'PATH':
        case 'FILE_PATH':
            return field.data.value || '';

        // 수식/계산
        case 'FORMULA':
            return field.data.expression || '';

        // 메일 머지
        case 'MAIL_MERGE':
            return field.data.fieldName || '';

        // 하이퍼링크
        case 'HYPERLINK':
            return field.data.value || '';

        // 책갈피/상호참조
        case 'BOOKMARK':
        case 'CROSS_REF':
            return field.data.fieldName || '';

        // 요약 정보
        case 'SUMMARY':
        case 'DOC_SUMMARY':
            return field.data.value || '';

        // 사용자 정보
        case 'USER_INFO':
            return field.data.value || '';

        // 통계 정보
        case 'CHAR_COUNT':
        case 'WORD_COUNT':
        case 'LINE_COUNT':
        case 'PARA_COUNT':
        case 'PAGE_COUNT':
        case 'EDIT_TIME':
            return field.data.value || '0';

        // 양식 필드
        case 'FORM_TEXT':
            return field.data.value || '';
        case 'FORM_CHECK':
            return field.data.value || '0';
        case 'FORM_COMBO':
            return field.data.value || '';

        // 목차/색인
        case 'TOC':
        case 'INDEX':
            return '';

        // 메모
        case 'MEMO':
            return field.data.value || '';

        // 누름틀 (기본)
        case 'CLICK_HERE':
        default:
            return field.data.value || '';
    }
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
