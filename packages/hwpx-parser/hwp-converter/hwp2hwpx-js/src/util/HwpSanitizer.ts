/**
 * HWP Sanitizer
 * Handles heuristics and fixups for legacy HWP inconsistencies
 *
 * Phase 4.1: TextSanitizer 통합으로 화이트리스트 기반 문자 검증
 */

import type { DocInfo, EnhancedSection, EnhancedParagraph } from '../adapters/IHwpParser';
import type { HWPControl, HWPPicture } from '../models/hwp.types';
import {
    quickSanitize,
    sanitizeEquationScript as sanitizeEqScript,
} from './TextSanitizer';

/**
 * HWP 파일 구조 인터페이스 (Sanitizer용)
 */
export interface SanitizableHwpFile {
    docInfo: Omit<DocInfo, 'borderFillList'> & {
        binData?: Map<number, unknown>;
        borderFillList?: Map<number, unknown> | unknown[];
    };
    sections: EnhancedSection[];
}

/**
 * Table row structure for sanitization
 */
interface SanitizableTableRow {
    cells?: Array<{
        paragraphs?: EnhancedParagraph[];
    }>;
}

/**
 * Table data structure for sanitization
 */
interface SanitizableTable {
    rows?: SanitizableTableRow[];
}

/**
 * TextBox data structure for sanitization
 */
interface SanitizableTextBox {
    paragraphs?: EnhancedParagraph[];
}

/**
 * Picture 컨트롤 타입 가드
 */
interface PictureControl extends HWPControl {
    type: 'PICTURE';
    obj: HWPPicture;
}

function isPictureControl(control: HWPControl): control is PictureControl {
    return control.type === 'PICTURE' && control.obj !== undefined;
}

// Phase 4.1: 기존 EQUATION_SPECIAL_CHAR_RANGES는 TextSanitizer로 이전됨
// TextSanitizer의 화이트리스트 기반 검증 사용

export class HwpSanitizer {
    /**
     * 텍스트에서 수식 특수 문자 제거
     * Phase 4.1: TextSanitizer의 화이트리스트 기반 검증으로 위임
     * @param text 원본 텍스트
     * @returns 정리된 텍스트
     */
    static sanitizeText(text: string): string {
        if (!text) return text;
        return quickSanitize(text);
    }

    /**
     * 수식 스크립트 정리 (HWPX equation script 속성용)
     * Phase 4.1: TextSanitizer 사용 (PUA 문자 허용)
     * @param script 원본 수식 스크립트
     * @returns XML에 안전한 형태의 스크립트
     */
    static sanitizeEquationScript(script: string): string {
        if (!script) return script;
        return sanitizeEqScript(script).sanitized;
    }

    /**
     * 문단 텍스트 정리 (전체 섹션)
     */
    static sanitizeSectionTexts(sections: EnhancedSection[]): void {
        for (const section of sections) {
            for (const para of section.paragraphs) {
                if (para.text) {
                    para.text = HwpSanitizer.sanitizeText(para.text);
                }
            }
        }
    }
    /**
     * 그림 개체의 binDataIDRef가 0인 경우 순차적으로 ID를 할당하여 보정
     * (HWP 파싱 시 ID를 찾지 못하는 경우에 대비한 휴리스틱)
     *
     * 재귀적으로 모든 컨트롤(테이블 셀, 텍스트박스 등)을 탐색하여
     * 중첩된 그림 개체도 처리합니다.
     */
    static fixProvisionalPictureReferences(hwpFile: SanitizableHwpFile): void {
        // DocInfo의 BinData 개수 확인
        const binDataCount = hwpFile.docInfo.binData?.size || 0;
        if (binDataCount === 0) return;

        // 모든 섹션의 그림을 순차적으로 처리하기 위한 컨텍스트
        const context = { pictureCount: 0, binDataCount };

        hwpFile.sections.forEach((section: EnhancedSection) => {
            section.paragraphs.forEach((para: EnhancedParagraph) => {
                HwpSanitizer.fixParagraphPictureRefs(para, context);
            });
        });
    }

    /**
     * 문단 내 그림 참조 수정 (재귀)
     */
    private static fixParagraphPictureRefs(
        para: EnhancedParagraph,
        context: { pictureCount: number; binDataCount: number }
    ): void {
        if (!para.controls) return;

        para.controls.forEach((control: HWPControl) => {
            // 그림 컨트롤 처리
            if (isPictureControl(control)) {
                HwpSanitizer.fixSinglePictureRef(control.obj, context);
            }
            // 테이블 컨트롤 - 셀 내부의 그림 처리
            else if (control.type === 'TABLE' && control.obj) {
                HwpSanitizer.fixTablePictureRefs(control.obj, context);
            }
            // 텍스트박스 컨트롤 - 내부 문단의 그림 처리
            else if (control.type === 'TEXTBOX' && control.obj) {
                HwpSanitizer.fixTextBoxPictureRefs(control.obj, context);
            }
        });
    }

    /**
     * 단일 그림 개체의 binDataIDRef 수정
     *
     * 다음 경우에 보정:
     * 1. binDataIDRef가 0인 경우
     * 2. binDataIDRef가 유효 범위(1~binDataCount)를 벗어난 경우
     */
    private static fixSinglePictureRef(
        picture: HWPPicture,
        context: { pictureCount: number; binDataCount: number }
    ): void {
        const currentId = picture.binDataIDRef;

        // 유효한 범위: 1 ~ binDataCount
        const isInvalidId = !currentId ||
            currentId === 0 ||
            currentId > context.binDataCount;

        if (isInvalidId) {
            context.pictureCount++;
            // BinData 개수 내에서 순차 할당 (1-based)
            if (context.pictureCount <= context.binDataCount) {
                picture.binDataIDRef = context.pictureCount;
            } else {
                // BinData를 모두 사용한 경우 순환 (이미지 재사용 가정)
                picture.binDataIDRef = ((context.pictureCount - 1) % context.binDataCount) + 1;
            }
        }
    }

    /**
     * 테이블 내 모든 셀의 그림 참조 수정 (재귀)
     */
    private static fixTablePictureRefs(
        table: SanitizableTable,
        context: { pictureCount: number; binDataCount: number }
    ): void {
        const rows = table.rows || [];
        for (const row of rows) {
            const cells = row.cells || [];
            for (const cell of cells) {
                // 셀 내부 문단 처리
                const paragraphs = cell.paragraphs || [];
                for (const para of paragraphs) {
                    HwpSanitizer.fixParagraphPictureRefs(para, context);
                }
            }
        }
    }

    /**
     * 텍스트박스 내 그림 참조 수정 (재귀)
     */
    private static fixTextBoxPictureRefs(
        textBox: SanitizableTextBox,
        context: { pictureCount: number; binDataCount: number }
    ): void {
        const paragraphs = textBox.paragraphs || [];
        for (const para of paragraphs) {
            HwpSanitizer.fixParagraphPictureRefs(para, context);
        }
    }
}
