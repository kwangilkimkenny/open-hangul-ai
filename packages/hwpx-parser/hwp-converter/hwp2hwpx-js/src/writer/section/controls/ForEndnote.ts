/**
 * HWPML-compliant Endnote (미주) XML Generation
 */

import { Endnote, FootnoteParagraph, NumberingType } from 'hwplib-js';
import { generateParagraphsXml } from '../ForParagraph';
import { generateInstanceId } from '../../../util/IdGenerator';

// EndnotePlacement enum (matching hwplib-js internal model)
const EndnotePlacement = {
    END_OF_SECTION: 0,
    END_OF_DOCUMENT: 1,
} as const;


/**
 * Convert Endnote control to OWPML XML
 */
export function endnoteToXml(endnote: Endnote): string {
    const instId = generateInstanceId();
    const numberFormat = getNumberFormat(endnote.numberingType);
    const placement = getPlacement(endnote.placement);

    // Convert Endnote paragraphs to standard paragraph format
    const paragraphs = endnote.paragraphs?.map((p: FootnoteParagraph) => ({
        text: p.text || '',
        charShapeID: p.charShapeID,
        paraShapeID: p.paraShapeID,
    })) || [];

    const contentXml = generateParagraphsXml(paragraphs);

    return `<hp:ctrl>
  <hp:endNote id="${instId}" autoNum="1" autoNumFormat="${numberFormat}" supscript="1">
    <hp:notePr>
      <hp:autoNumFormat type="${numberFormat}" userChar="" prefixChar="" suffixChar=")" supscript="1"/>
      <hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/>
      <hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>
      <hp:numbering type="CONTINUOUS" newNum="${endnote.numberingStart || 1}"/>
      <hp:placement place="${placement}" beneathText="0"/>
    </hp:notePr>
    <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="BASELINE" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
      ${contentXml}
    </hp:subList>
  </hp:endNote>
</hp:ctrl>`;
}

// === Helper Functions ===

/**
 * Number format conversion (OWPML specification complete)
 * 번호 형식 변환 (OWPML 전체 스펙)
 */
function getNumberFormat(type: NumberingType | undefined): string {
    if (type === undefined || type === null) return 'DIGIT';

    switch (type) {
        // 기본 번호 형식
        case NumberingType.ARABIC: return 'DIGIT';                    // 1, 2, 3
        case NumberingType.ROMAN_UPPER: return 'ROMAN_CAPITAL';       // I, II, III
        case NumberingType.ROMAN_LOWER: return 'ROMAN_SMALL';         // i, ii, iii
        case NumberingType.ALPHA_UPPER: return 'LATIN_CAPITAL';       // A, B, C
        case NumberingType.ALPHA_LOWER: return 'LATIN_SMALL';         // a, b, c

        // 한글 번호 형식
        case NumberingType.HANGUL_SYLLABLE: return 'HANGUL_SYLLABLE'; // 가, 나, 다
        case NumberingType.HANGUL_JAMO: return 'HANGUL_JAMO';         // ㄱ, ㄴ, ㄷ
        case NumberingType.HANGUL_CIRCLED: return 'CIRCLED_DIGIT';    // ①, ②, ③

        // 한자 번호 형식
        case NumberingType.IDEOGRAPH_TRADITIONAL: return 'IDEOGRAPH'; // 一, 二, 三

        default: {
            // Handle numeric values not in enum
            const numType = type as number;
            if (numType === 9) return 'CIRCLED_HANGUL_SYLLABLE';   // ㉮, ㉯, ㉰
            if (numType === 10) return 'CIRCLED_HANGUL_JAMO';      // ㉠, ㉡, ㉢
            if (numType === 11) return 'CIRCLED_LATIN_CAPITAL';    // Ⓐ, Ⓑ, Ⓒ
            if (numType === 12) return 'CIRCLED_LATIN_SMALL';      // ⓐ, ⓑ, ⓒ
            if (numType === 13) return 'IDEOGRAPH_CIRCLED';        // ㊀, ㊁, ㊂
            if (numType === 14) return 'IDEOGRAPH_PARENTHESIS';    // ㈠, ㈡, ㈢
            if (numType === 15) return 'SYMBOL';                   // *, †, ‡
            if (numType === 16) return 'USER_CHAR';                // 사용자 정의
            return 'DIGIT';
        }
    }
}

function getPlacement(placement: number | undefined): string {
    if (placement === undefined || placement === null) return 'END_OF_DOCUMENT';

    switch (placement) {
        case EndnotePlacement.END_OF_SECTION: return 'END_OF_SECTION';
        case EndnotePlacement.END_OF_DOCUMENT: return 'END_OF_DOCUMENT';
        default: return 'END_OF_DOCUMENT';
    }
}
