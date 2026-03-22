import { DocInfo, FaceName } from 'hwplib-js';
import { escapeXml } from '../common/XmlUtils';
import { StringXmlWriter } from '../stream/StringXmlWriter';
import { DEFAULTS } from '../../constants/DefaultValues';

// Language types for fontface blocks
const FONT_LANGUAGES = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'] as const;

/**
 * Generates <hh:fontfaces> XML from DocInfo
 * Optimized with StringBuilder
 */
export function generateFontfacesXml(docInfo: DocInfo): string {
    const sb = new StringXmlWriter();
    sb.append(`<hh:fontfaces itemCnt="7">`);

    // Generate all 7 language blocks
    for (let i = 0; i < FONT_LANGUAGES.length; i++) {
        sb.append(generateFontfaceBlock(docInfo, FONT_LANGUAGES[i]));
    }

    sb.append(`</hh:fontfaces>`);
    return sb.toString();
}

function generateFontfaceBlock(docInfo: DocInfo, lang: string): string {
    // HWP usually shares the same FaceID list across languages
    const faceNamesMap = docInfo.faceNames;
    if (!faceNamesMap || faceNamesMap.size === 0) {
        // Default fallback - 로케일별 기본 폰트 사용
        const defaultFont = DEFAULTS.font.hangul;
        return `<hh:fontface lang="${lang}" fontCnt="1"><hh:font id="0" face="${defaultFont}" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="8" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font></hh:fontface>`;
    }

    // Direct iteration without Array.from()
    const fonts: FaceName[] = [];
    for (const f of faceNamesMap.values()) {
        fonts.push(f);
    }
    fonts.sort((a: FaceName, b: FaceName) => a.id - b.id);

    const sb = new StringXmlWriter();
    const count = fonts.length;

    for (let i = 0; i < count; i++) {
        const faceName = fonts[i];
        // FontType: 0=TTF, 1=HFT, ?=SYMBOL
        const fontType = faceName.fontType === 0 ? 'TTF' : faceName.fontType === 1 ? 'HFT' : 'SYMBOL';

        sb.append(`<hh:font id="${faceName.id}" face="${escapeXml(faceName.name)}" type="${fontType}" isEmbedded="${faceName.isEmbedded ? '1' : '0'}">`);
        sb.append(`<hh:typeInfo familyType="FCAT_GOTHIC" weight="8" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>`);
        sb.append(`</hh:font>`);
    }

    return `<hh:fontface lang="${lang}" fontCnt="${count}">${sb.toString()}</hh:fontface>`;
}
