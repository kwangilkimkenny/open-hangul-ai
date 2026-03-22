import { DocInfo, Style } from 'hwplib-js';
import { escapeXml } from '../common/XmlUtils';
import { StringXmlWriter } from '../stream/StringXmlWriter';

/**
 * Generates <hh:styles> XML
 * Optimized with direct iteration and StringBuilder
 */
export function generateStylesXml(docInfo: DocInfo): string {
    const stylesMap = docInfo.styles;

    // Direct iteration without Array.from()
    const styles: Style[] = [];
    for (const s of stylesMap.values()) {
        styles.push(s);
    }
    styles.sort((a, b) => a.id - b.id);

    const sb = new StringXmlWriter();
    sb.append(`<hh:styles itemCnt="${styles.length}">`);

    const count = styles.length;
    for (let i = 0; i < count; i++) {
        sb.append('\n');
        sb.append(styleToXml(styles[i]));
    }

    sb.append(`\n</hh:styles>`);
    return sb.toString();
}

export function styleToXml(style: Style): string {
    const typeName = style.type === 0 ? 'PARA' : 'CHAR';
    return `<hh:style id="${style.id}" type="${typeName}" name="${escapeXml(style.name)}" engName="${escapeXml(style.engName)}" paraPrIDRef="${style.paraPrID}" charPrIDRef="${style.charPrID}" nextStyleIDRef="${style.nextStyleID}" langID="${style.langID}" lockForm="${style.lockForm ? '1' : '0'}"/>`;
}
