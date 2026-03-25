/**
 * MasterPage (바탕쪽) XML Generation
 * HWPML-compliant master page XML generation
 */

import { NAMESPACES } from '../../constants/xml-namespaces';
import { generateParagraphsXml } from './ForParagraph';
import { tableToXml } from './controls/ForTable';
import { pictureToXml } from './controls/ForPicture';
import { MasterPage, HWPTable, HWPPicture } from '../../models/hwp.types';
import type { Table } from 'hwplib-js';
import { generateInstanceId } from '../../util/IdGenerator';

/**
 * Generate master page XML file content
 * @param masterPage Master page data
 * @param _index Master page index (0-based) - reserved for future use
 */
export function generateMasterPageXml(masterPage: MasterPage, _index: number): string {
    const masterPageId = generateInstanceId();

    // Generate content for tables and pictures
    const tableXmls = masterPage.tables
        ? masterPage.tables.map((t: HWPTable) => tableToXml(t as Table))
        : [];
    const pictureXmls = masterPage.pictures
        ? masterPage.pictures.map((p: HWPPicture) => pictureToXml(p))
        : [];

    // Generate paragraphs XML with injected controls
    const paragraphsXml = generateParagraphsXml(
        masterPage.paragraphs,
        [...tableXmls, ...pictureXmls]
    );

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hm:masterPage ${NAMESPACES} id="${masterPageId}" type="${masterPage.type}">
  ${paragraphsXml}
</hm:masterPage>`;
}

/**
 * Generate master page reference for section properties
 * @param masterPages Array of master pages
 */
export function getMasterPageCount(masterPages?: MasterPage[]): number {
    return masterPages?.length ?? 0;
}

/**
 * Get master page type names for XML output
 */
export function getMasterPageTypeName(type: string): string {
    switch (type) {
        case 'BOTH':
            return 'BOTH';
        case 'EVEN':
            return 'EVEN';
        case 'ODD':
            return 'ODD';
        default:
            return 'BOTH';
    }
}
