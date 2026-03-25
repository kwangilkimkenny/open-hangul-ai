/**
 * ForNumberings.ts - Numbering and Bullet OWPML Generator
 * 번호 매기기 및 글머리 기호 OWPML 생성 모듈
 */

import { DocInfo, Numbering } from 'hwplib-js';

/**
 * Numbering format types for OWPML
 */
export const NumberingFormat = {
    DIGIT: 'DIGIT',                 // 1, 2, 3...
    CIRCLED_DIGIT: 'CIRCLED_DIGIT', // ①, ②, ③...
    LATIN_UPPER: 'LATIN_UPPER',     // A, B, C...
    LATIN_LOWER: 'LATIN_LOWER',     // a, b, c...
    ROMAN_UPPER: 'ROMAN_UPPER',     // I, II, III...
    ROMAN_LOWER: 'ROMAN_LOWER',     // i, ii, iii...
    HANGUL: 'HANGUL',               // 가, 나, 다...
    HANGUL_JAMO: 'HANGUL_JAMO',     // ㄱ, ㄴ, ㄷ...
    CIRCLED_HANGUL: 'CIRCLED_HANGUL', // ㉮, ㉯, ㉰...
    HANJA: 'HANJA',                 // 一, 二, 三...
    BULLET: 'BULLET'                // 글머리 기호
} as const;

/**
 * Generate paragraph numbering level XML
 */
function generateParaHeadXml(level: number, numFormat: string, startNum: number, textOffset: number, charPrIDRef: number): string {
    // Format string based on level (e.g., "^1.", "^2)", "^3-")
    const suffixes = ['.', ')', '-', '.', ')', '-', '.', ')', '-', '.'];
    const formatStr = `^${level + 1}${suffixes[level % 10]}`;

    return `<hh:paraHead start="${startNum}" level="${level}" align="LEFT" useInstWidth="1" autoIndent="1" textOffset="${textOffset}" numFormat="${numFormat}" charPrIDRef="${charPrIDRef}">
        <hh:paraHeadText>${formatStr}</hh:paraHeadText>
      </hh:paraHead>`;
}

/**
 * Generate bullet style XML
 */
export function generateBulletXml(bulletId: number, bulletChar: string, charPrIDRef: number): string {
    return `<hh:bullet id="${bulletId}" charPrIDRef="${charPrIDRef}">
      <hh:bulletChar>${bulletChar}</hh:bulletChar>
    </hh:bullet>`;
}

/**
 * Generate complete numbering definition XML
 */
function generateNumberingItemXml(numbering: Numbering): string {
    const levels: string[] = [];

    // Generate up to 10 levels (HWP supports 10-level hierarchy)
    for (let i = 0; i < 10; i++) {
        const levelDef = numbering.levels?.[i];
        const numFormat = levelDef?.numFormat
            ? mapNumFormatToOwpml(levelDef.numFormat)
            : 'DIGIT';
        const startNum = levelDef?.start ?? 1;
        const textOffset = levelDef?.textOffset ?? 0;
        const charPrIDRef = levelDef?.charPrID ?? 0;

        levels.push(generateParaHeadXml(i, numFormat, startNum, textOffset, charPrIDRef));
    }

    return `<hh:numbering id="${numbering.id}" start="${numbering.start ?? 1}">
      ${levels.join('\n      ')}
    </hh:numbering>`;
}

/**
 * Map HWP numFormat value to OWPML format string
 */
function mapNumFormatToOwpml(numFormat: number): string {
    const formatMap: Record<number, string> = {
        0: 'DIGIT',          // 1, 2, 3
        1: 'CIRCLED_DIGIT',  // ①, ②, ③
        2: 'LATIN_UPPER',    // A, B, C
        3: 'LATIN_LOWER',    // a, b, c
        4: 'ROMAN_UPPER',    // I, II, III
        5: 'ROMAN_LOWER',    // i, ii, iii
        6: 'HANGUL',         // 가, 나, 다
        7: 'HANGUL_JAMO',    // ㄱ, ㄴ, ㄷ
        8: 'CIRCLED_HANGUL', // ㉮, ㉯, ㉰
        9: 'HANJA',          // 一, 二, 三
    };
    return formatMap[numFormat] || 'DIGIT';
}

/**
 * Generates <hh:numberings> XML
 * @param docInfo DocInfo object containing numbering definitions
 * @returns OWPML numberings XML string
 */
export function generateNumberingsXml(docInfo: DocInfo): string {
    // Check if docInfo has numberings
    if (!docInfo?.numberings || docInfo.numberings.size === 0) {
        return `<hh:numberings itemCnt="0"/>`;
    }

    const numberings: Numbering[] = Array.from(docInfo.numberings.values());
    const numberingXmls = numberings.map(n => generateNumberingItemXml(n));

    return `<hh:numberings itemCnt="${numberings.length}">
    ${numberingXmls.join('\n    ')}
  </hh:numberings>`;
}

/**
 * Bullet interface for internal use
 */
interface BulletDef {
    id: number;
    bulletChar?: string;
    charPrIDRef?: number;
    imageBullet?: boolean;
    imageBulletId?: number;
}

/**
 * Extended DocInfo interface with bullet support
 */
interface DocInfoWithBullets extends DocInfo {
    bullets?: Map<number, BulletDef> | BulletDef[];
    bulletList?: Map<number, BulletDef> | BulletDef[];
}

/**
 * Generates <hh:bullets> XML
 * @param docInfo DocInfo object containing bullet definitions
 * @returns OWPML bullets XML string
 */
export function generateBulletsXml(docInfo: DocInfo): string {
    // Check multiple possible locations for bullets
    const bulletSource = (docInfo as DocInfoWithBullets)?.bullets ||
        (docInfo as DocInfoWithBullets)?.bulletList;

    if (!bulletSource) {
        return `<hh:bullets itemCnt="0"/>`;
    }

    // Convert to array if it's a Map
    let bullets: BulletDef[] = [];
    if (bulletSource instanceof Map) {
        if (bulletSource.size === 0) {
            return `<hh:bullets itemCnt="0"/>`;
        }
        for (const b of bulletSource.values()) {
            bullets.push(b);
        }
        bullets.sort((a, b) => a.id - b.id);
    } else if (Array.isArray(bulletSource)) {
        if (bulletSource.length === 0) {
            return `<hh:bullets itemCnt="0"/>`;
        }
        bullets = bulletSource;
    }

    if (bullets.length === 0) {
        return `<hh:bullets itemCnt="0"/>`;
    }

    const bulletXmls = bullets.map((bullet, index) => {
        const id = bullet.id ?? index;
        const charPrIDRef = bullet.charPrIDRef ?? 0;
        const bulletChar = bullet.bulletChar || DefaultBulletChars.DISC;

        if (bullet.imageBullet && bullet.imageBulletId) {
            // Image bullet
            return `<hh:bullet id="${id}" charPrIDRef="${charPrIDRef}">
      <hh:bulletImage binItemIDRef="${bullet.imageBulletId}"/>
    </hh:bullet>`;
        } else {
            // Character bullet
            return `<hh:bullet id="${id}" charPrIDRef="${charPrIDRef}">
      <hh:bulletChar>${escapeXml(bulletChar)}</hh:bulletChar>
    </hh:bullet>`;
        }
    });

    return `<hh:bullets itemCnt="${bullets.length}">
    ${bulletXmls.join('\n    ')}
  </hh:bullets>`;
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
 * Default bullet characters for common bullet types
 */
export const DefaultBulletChars = {
    DISC: '●',
    CIRCLE: '○',
    SQUARE: '■',
    DIAMOND: '◆',
    CHECK: '✓',
    ARROW: '→',
    DASH: '—'
} as const;
