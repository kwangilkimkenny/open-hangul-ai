import { DocInfo } from 'hwplib-js';
import { NAMESPACES } from '../constants/xml-namespaces';
import { generateFontfacesXml } from './header/ForFontFaces';
import { generateBorderFillsXml } from './header/ForBorderFills';
import { generateCharPropertiesXml } from './header/ForCharProperties';
import { generateParaPropertiesXml } from './header/ForParaProperties';
import { generateStylesXml } from './header/ForStyles';
import { generateTabPropertiesXml } from './header/ForTabProperties';
import { generateNumberingsXml } from './header/ForNumberings';
import { generateBinDataListXml } from './header/ForBinData';
import {
    generateTrackChangeConfig,
    generateTrackChangesXml,
    TrackChangeFlags,
    DEFAULT_TRACK_CHANGE_FLAGS
} from './header/ForTrackChanges';
import type { TrackChange, TrackChangeAuthor } from '../adapters/IHwpParser';

/**
 * Header generation options
 */
export interface HeaderOptions {
    binDataList?: { id: number; extension: string }[];
    trackChangeFlags?: TrackChangeFlags | number;
    trackChangeList?: TrackChange[];
    trackChangeAuthorList?: TrackChangeAuthor[];
    sectionCount?: number;
}

/**
 * Generates header.xml based on DocInfo
 *
 * @param docInfo - Document info from HWP parsing
 * @param binDataList - Actual extracted binary data list (for consistency with BinData folder)
 * @deprecated Use generateHeaderXmlWithOptions for full feature support
 */
export function generateHeaderXml(
  docInfo: DocInfo,
  binDataList: { id: number; extension: string }[] = []
): string {
  return generateHeaderXmlWithOptions(docInfo, { binDataList });
}

/**
 * Generates header.xml with full options support
 *
 * @param docInfo - Document info from HWP parsing
 * @param options - Header generation options
 */
export function generateHeaderXmlWithOptions(
  docInfo: DocInfo,
  options: HeaderOptions = {}
): string {
  const {
    binDataList = [],
    trackChangeFlags,
    trackChangeList,
    trackChangeAuthorList,
    sectionCount = 1
  } = options;

  const binDataXml = generateBinDataListXml(binDataList);
  const trackChangeConfigXml = generateTrackChangeConfig(trackChangeFlags ?? DEFAULT_TRACK_CHANGE_FLAGS);
  const trackChangesXml = generateTrackChangesXml(trackChangeList, trackChangeAuthorList);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hh:head ${NAMESPACES} version="1.5" secCnt="${sectionCount}">
<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
<hh:refList>
${generateFontfacesXml(docInfo)}
${generateBorderFillsXml(docInfo)}
${generateCharPropertiesXml(docInfo)}
${generateTabPropertiesXml(docInfo)}
${generateNumberingsXml(docInfo)}
${generateParaPropertiesXml(docInfo)}
${generateStylesXml(docInfo)}
${binDataXml}
</hh:refList>
<hh:compatibleDocument targetProgram="HWP201X">
  <hh:layoutCompatibility/>
</hh:compatibleDocument>
<hh:docOption>
  <hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/>
</hh:docOption>
${trackChangeConfigXml}
${trackChangesXml}
</hh:head>`;
}
