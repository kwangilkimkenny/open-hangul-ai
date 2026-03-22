import { escapeXml } from '../common/XmlUtils';
import { controlToXml } from './ForControl';
import { HWPControl, HWPParagraph, HWPRun } from '../../models/hwp.types';
import { FONT_SIZE, LINE_SEGMENT, PAGE } from '../../constants/hwpunit';
import { StringXmlWriter } from '../stream/StringXmlWriter';

/**
 * XML 생성용 확장 문단 인터페이스
 * HWPParagraph를 확장하여 HWPX 호환 필드 추가
 */
interface XmlParagraph extends HWPParagraph {
    paraPrIDRef?: number;
    styleIDRef?: number;
    charPrIDRef?: number;
}

/**
 * XML 생성용 확장 Run 인터페이스
 */
interface XmlRun extends HWPRun {
    charPrIDRef?: number;
}

// Pre-compiled regex for whitespace normalization (performance optimization)
const WHITESPACE_REGEX = /\s{2,}/g;

// Pre-computed Set for O(1) garbage character lookup
const GARBAGE_CHARS = new Set([0x6F20, 0x6773]); // 漠, 杳

/**
 * Check if character code should be skipped (optimized with range checks)
 */
function shouldSkipChar(code: number): boolean {
    // 1. Control characters (0x0000 ~ 0x001F, except tab 0x0009)
    if (code <= 0x001F && code !== 0x0009) return true;

    // 2. Common garbage CJK characters
    if (GARBAGE_CHARS.has(code)) return true;

    // 3. Garbage CJK ranges (binary data misinterpreted as UTF-16)
    if (code >= 0x6200 && code <= 0x63FF) return true;  // 戀-慿, 捀-揿
    if (code >= 0x6C00 && code <= 0x6CFF) return true;  // 汀-泿
    if (code >= 0x7400 && code <= 0x74FF) return true;  // 琀-瓿

    // 4. Private Use Area
    if (code >= 0xE000 && code <= 0xF8FF) return true;

    // 5. Surrogate pairs (incomplete Unicode)
    if (code >= 0xD800 && code <= 0xDFFF) return true;

    // 6. Non-standard control characters
    if (code >= 0x007F && code <= 0x009F) return true;

    // 7. Replacement character
    if (code === 0xFFFD) return true;

    // 8. HWP Equation font special characters (수식 폰트 특수 문자)
    // These characters are used by HWP equation font and appear garbled in standard fonts
    if (code >= 0x0100 && code <= 0x024F) return true;  // Latin Extended-A/B (수식 폰트)
    if (code >= 0x0400 && code <= 0x04FF) return true;  // Cyrillic (수식 폰트 기호)
    if (code >= 0x0530 && code <= 0x058F) return true;  // Armenian (수식 폰트)
    if (code >= 0x0700 && code <= 0x074F) return true;  // Syriac (수식 폰트)
    if (code >= 0x0980 && code <= 0x09FF) return true;  // Bengali (수식 폰트)
    if (code >= 0x0C80 && code <= 0x0CFF) return true;  // Kannada (수식 폰트)
    if (code >= 0x0D00 && code <= 0x0D7F) return true;  // Malayalam (수식 폰트)
    if (code >= 0x0F00 && code <= 0x0FFF) return true;  // Tibetan (분수/지수)
    if (code >= 0x1000 && code <= 0x109F) return true;  // Myanmar (특수 기호)
    if (code >= 0x1200 && code <= 0x137F) return true;  // Ethiopic (수식 폰트)
    if (code >= 0x1400 && code <= 0x167F) return true;  // Canadian Aboriginal (수식 폰트)
    if (code >= 0x1900 && code <= 0x194F) return true;  // Limbu (수식 폰트)
    if (code >= 0x1B00 && code <= 0x1B7F) return true;  // Balinese (수식 폰트)
    if (code >= 0x1D00 && code <= 0x1D7F) return true;  // Phonetic Extensions (수식 폰트)

    // 9. CJK Extension ranges that are often garbage (수식/특수 폰트)
    if (code >= 0x2F00 && code <= 0x2FDF) return true;  // Kangxi Radicals
    if (code >= 0x3F00 && code <= 0x3FFF) return true;  // CJK Extension (garbage)

    return false;
}

/**
 * Sanitize text by removing garbled control characters and invalid Unicode
 * Optimized with StringBuilder and pre-computed character checks
 */
function sanitizeText(text: string): string {
    if (!text) return '';

    const len = text.length;
    const parts: string[] = [];
    let start = 0;

    for (let i = 0; i < len; i++) {
        const code = text.charCodeAt(i);

        if (shouldSkipChar(code)) {
            // Flush accumulated valid characters
            if (i > start) {
                parts.push(text.slice(start, i));
            }
            start = i + 1;
        }
    }

    // Flush remaining characters
    if (start < len) {
        parts.push(text.slice(start));
    }

    if (parts.length === 0) return '';

    // Join and normalize whitespace
    return parts.join('').replace(WHITESPACE_REGEX, ' ').trim();
}


/**
 * 문단 목록 → XML 변환 (공통 함수)
 * 레퍼런스 분석 결과: 테이블/이미지 컨트롤은 hp:run 내부에 배치 (한컴 공식 저장 방식)
 * Optimized with StringBuilder for O(n) string building instead of O(n²)
 */
export function generateParagraphsXml(paragraphs: XmlParagraph[], injectedXmls: string[] = [], width: number = PAGE.DEFAULT_TEXT_WIDTH): string {
    const sb = new StringXmlWriter();

    if (!paragraphs || paragraphs.length === 0) {
        // 빈 문단 하나 생성
        const defaultBaseline = Math.round(FONT_SIZE.DEFAULT * LINE_SEGMENT.BASELINE_RATIO);
        const defaultSpacing = Math.round(FONT_SIZE.DEFAULT * LINE_SEGMENT.SPACING_RATIO);
        sb.append(`\n    <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`);
        sb.append(`\n      <hp:run charPrIDRef="0">`);
        if (injectedXmls.length > 0) sb.append(injectedXmls.join(''));
        sb.append(`<hp:t></hp:t></hp:run>`);
        sb.append(`\n      <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${FONT_SIZE.DEFAULT}" textheight="${FONT_SIZE.DEFAULT}" baseline="${defaultBaseline}" spacing="${defaultSpacing}" horzpos="0" horzsize="${width}" flags="${LINE_SEGMENT.DEFAULT_FLAGS}"/></hp:linesegarray>`);
        sb.append(`\n    </hp:p>`);
        return sb.toString();
    }

    let localInjectedXmls = [...injectedXmls];
    const paraCount = paragraphs.length;

    for (let index = 0; index < paraCount; index++) {
        const para = paragraphs[index] as XmlParagraph;

        // HWPX paraPrIDRef는 HWP paraShapeID를 그대로 사용 (레퍼런스 기준)
        const paraPrID = para.paraShapeID ?? para.paraPrIDRef ?? 0;
        const styleID = para.styleID ?? para.styleIDRef ?? 0;
        const charPrID = para.charShapeID ?? para.charPrIDRef ?? 0;
        const pageBreak = (index === 0) ? 0 : (para.pageBreak ? 1 : 0);
        const columnBreak = para.columnBreak ? 1 : 0;

        sb.append(`\n    <hp:p id="${index}" paraPrIDRef="${paraPrID}" styleIDRef="${styleID}" pageBreak="${pageBreak}" columnBreak="${columnBreak}" merged="0">`);

        const controls: HWPControl[] = para.controls ? [...para.controls] : [];

        // Check if we have runs or just text
        const hasRuns = para.runs && para.runs.length > 0;
        const rawText = para.text && typeof para.text === 'string' ? para.text : '';
        const cleanText = sanitizeText(rawText);
        const hasText = cleanText.length > 0;

        // TABLE 컨트롤이 있는지 확인 (O(n) -> early exit optimization)
        let hasTableControl = false;
        for (let i = 0; i < controls.length; i++) {
            if (controls[i].type === 'TABLE') {
                hasTableControl = true;
                break;
            }
        }

        if (hasRuns && !hasTableControl) {
            // 일반 텍스트 runs (테이블 없음)
            const runs = para.runs as XmlRun[];
            const runCount = runs.length;

            for (let rIdx = 0; rIdx < runCount; rIdx++) {
                const run = runs[rIdx];
                const runCharPrID = run.charShapeID ?? run.charPrIDRef ?? charPrID;

                sb.append(`\n      <hp:run charPrIDRef="${runCharPrID}">`);

                // Inject secPr, header/footer etc at first paragraph first run
                if (index === 0 && rIdx === 0 && localInjectedXmls.length > 0) {
                    sb.append(localInjectedXmls.join(''));
                    localInjectedXmls = [];
                }

                // 텍스트 처리 - 빈 텍스트 노드 생성 방지
                const textContent = sanitizeText(run.text || '');
                if (textContent.length > 0) {
                    sb.append(`<hp:t>${escapeXml(textContent)}</hp:t>`);
                }
                // 빈 텍스트일 경우 <hp:t/> 생성하지 않음

                sb.append(`</hp:run>`);
            }

            // 비테이블 컨트롤 출력 (TEXTBOX, PICTURE 등)
            for (let i = 0; i < controls.length; i++) {
                const cXml = controlToXml(controls[i]);
                if (cXml) {
                    sb.append(`\n      <hp:run charPrIDRef="${charPrID}">${cXml}</hp:run>`);
                }
            }

        } else if (hasTableControl) {
            // 테이블이 있는 문단 - 텍스트 runs 무시, 테이블만 출력
            sb.append(`\n      <hp:run charPrIDRef="${charPrID}">`);

            // Inject secPr if first paragraph
            if (index === 0 && localInjectedXmls.length > 0) {
                sb.append(localInjectedXmls.join(''));
                localInjectedXmls = [];
            }

            // 테이블 출력
            for (let i = 0; i < controls.length; i++) {
                const cXml = controlToXml(controls[i]);
                if (cXml) {
                    sb.append(cXml);
                }
            }

            sb.append(`</hp:run>`);

        } else if (hasRuns) {
            // runs는 있지만 다른 컨트롤
            const runs = para.runs as XmlRun[];
            const runCount = runs.length;

            for (let rIdx = 0; rIdx < runCount; rIdx++) {
                const run = runs[rIdx];
                const runCharPrID = run.charShapeID ?? run.charPrIDRef ?? charPrID;

                sb.append(`\n      <hp:run charPrIDRef="${runCharPrID}">`);

                if (index === 0 && rIdx === 0 && localInjectedXmls.length > 0) {
                    sb.append(localInjectedXmls.join(''));
                    localInjectedXmls = [];
                }

                const textContent = sanitizeText(run.text || '');
                if (textContent.length > 0) {
                    sb.append(`<hp:t>${escapeXml(textContent)}</hp:t>`);
                }
                // 빈 텍스트일 경우 <hp:t/> 생성하지 않음

                sb.append(`</hp:run>`);
            }

            // 다른 컨트롤 출력
            for (let i = 0; i < controls.length; i++) {
                const cXml = controlToXml(controls[i]);
                if (cXml) {
                    sb.append(`<hp:run charPrIDRef="${charPrID}">${cXml}</hp:run>`);
                }
            }

        } else if (hasText) {
            // Simple text (from hwplib-js table cells)
            sb.append(`\n      <hp:run charPrIDRef="${charPrID}">`);

            if (index === 0 && localInjectedXmls.length > 0) {
                sb.append(localInjectedXmls.join(''));
                localInjectedXmls = [];
            }

            sb.append(`<hp:t>${escapeXml(cleanText)}</hp:t></hp:run>`);

            // 컨트롤 출력 (TEXTBOX, PICTURE 등)
            for (let i = 0; i < controls.length; i++) {
                const cXml = controlToXml(controls[i]);
                if (cXml) {
                    sb.append(`\n      <hp:run charPrIDRef="${charPrID}">${cXml}</hp:run>`);
                }
            }
        } else {
            // Empty paragraph or paragraph with only controls
            sb.append(`\n      <hp:run charPrIDRef="${charPrID}">`);
            if (index === 0 && localInjectedXmls.length > 0) {
                sb.append(localInjectedXmls.join(''));
                localInjectedXmls = [];
            }

            // 컨트롤이 있으면 hp:run 내부에 테이블/이미지 배치 (레퍼런스 구조)
            if (controls.length > 0) {
                for (let i = 0; i < controls.length; i++) {
                    const cXml = controlToXml(controls[i]);
                    if (cXml) {
                        sb.append(cXml);
                    }
                }
            } else {
                sb.append(`<hp:t/>`);
            }

            sb.append(`</hp:run>`);
        }

        // Required linesegarray element
        const fontSize = (charPrID === 1) ? FONT_SIZE.HEADING : FONT_SIZE.DEFAULT;
        const baseline = Math.round(fontSize * LINE_SEGMENT.BASELINE_RATIO);
        const lineSpacing = Math.round(fontSize * LINE_SEGMENT.SPACING_RATIO);

        sb.append(`\n      <hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${fontSize}" textheight="${fontSize}" baseline="${baseline}" spacing="${lineSpacing}" horzpos="0" horzsize="${width}" flags="${LINE_SEGMENT.DEFAULT_FLAGS}"/></hp:linesegarray>`);
        sb.append(`\n    </hp:p>`);
    }

    return sb.toString();
}
