import { DocInfo } from 'hwplib-js';
import { StringXmlWriter } from '../stream/StringXmlWriter';

/** Tab info entry */
interface TabInfo {
    pos: number;
    type: number;
    leader: number;
}

/** Tab definition entry */
interface TabDefEntry {
    id: number;
    autoTabLeft?: boolean;
    autoTabRight?: boolean;
    tabInfos?: TabInfo[];
}

/**
 * Generates <hh:tabProperties> XML
 * Optimized with direct iteration and StringBuilder
 */
export function generateTabPropertiesXml(docInfo: DocInfo): string {
    const tabDefsMap = (docInfo as { tabDefs?: Map<number, TabDefEntry> }).tabDefs;
    if (!tabDefsMap) {
        return `<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>`;
    }

    // Direct iteration without Array.from()
    const tabDefs: TabDefEntry[] = [];
    for (const td of tabDefsMap.values()) {
        tabDefs.push(td);
    }
    tabDefs.sort((a, b) => a.id - b.id);

    if (tabDefs.length === 0) {
        return `<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>`;
    }

    const sb = new StringXmlWriter();
    sb.append(`<hh:tabProperties itemCnt="${tabDefs.length}">`);

    const count = tabDefs.length;
    for (let i = 0; i < count; i++) {
        const td = tabDefs[i];
        sb.append('\n');
        sb.append(tabDefToXml(td, td.id));
    }

    sb.append(`\n</hh:tabProperties>`);
    return sb.toString();
}

function tabDefToXml(tabDef: TabDefEntry, id: number): string {
    const sb = new StringXmlWriter();

    if (tabDef.tabInfos && tabDef.tabInfos.length > 0) {
        const infos = tabDef.tabInfos;
        const count = infos.length;
        for (let i = 0; i < count; i++) {
            const info = infos[i];
            sb.append(`<hh:tabItem pos="${info.pos}" type="${getTabTypeString(info.type)}" leader="${getLeaderTypeString(info.leader)}"/>`);
        }
    }

    return `<hh:tabPr id="${id}" autoTabLeft="${tabDef.autoTabLeft ? '1' : '0'}" autoTabRight="${tabDef.autoTabRight ? '1' : '0'}">${sb.toString()}</hh:tabPr>`;
}

/**
 * Tab alignment type (OWPML specification)
 * 탭 정렬 타입 (OWPML 전체 스펙)
 */
function getTabTypeString(type: number): string {
    switch (type) {
        case 0: return 'LEFT';      // 왼쪽 정렬
        case 1: return 'RIGHT';     // 오른쪽 정렬
        case 2: return 'CENTER';    // 가운데 정렬
        case 3: return 'DECIMAL';   // 소수점 정렬
        case 4: return 'BAR';       // 세로줄
        default: return 'LEFT';
    }
}

/**
 * Tab leader type (OWPML specification)
 * 탭 채움선 타입 (OWPML 전체 스펙)
 * HWP 바이너리 값과 OWPML XML 값 매핑
 */
function getLeaderTypeString(type: number): string {
    switch (type) {
        case 0: return 'NONE';          // 없음
        case 1: return 'DOT';           // 점선 (.......)
        case 2: return 'LONG_DASH';     // 긴 파선 (-------)
        case 3: return 'DASH';          // 짧은 파선 (- - - -)
        case 4: return 'DASH_DOT';      // 일점쇄선 (-.-.-.)
        case 5: return 'DASH_DOT_DOT';  // 이점쇄선 (-..-..-..)
        case 6: return 'SOLID';         // 실선 (_______)
        case 7: return 'CIRCLE';        // 동그라미 (ooooooo)
        case 8: return 'DOUBLE_LINE';   // 이중선 (=======)
        case 9: return 'THICK';         // 굵은 선
        case 10: return 'HAIR_LINE';    // 가는 선
        default: return 'NONE';
    }
}
