/**
 * ForColumn.ts - Multi-Column Layout OWPML Generator
 * 다단 레이아웃 OWPML 생성 모듈
 */

import { ColumnDef } from '../../models/hwp.types';

/** Column type constants */
export const ColumnType = {
    NEWSPAPER: 'NEWSPAPER',    // 일반 다단 (신문형)
    BALANCED: 'BALANCED',      // 균형 잡힌 다단
    PARALLEL: 'PARALLEL'       // 평행 다단
} as const;

/** Column layout direction */
export const ColumnLayout = {
    LEFT: 'LEFT',
    RIGHT: 'RIGHT'
} as const;

/**
 * Extended ColumnDef with additional properties for OWPML compatibility
 */
export interface ExtendedColumnDef extends ColumnDef {
    type?: keyof typeof ColumnType;
    layout?: keyof typeof ColumnLayout;
    lineBetween?: boolean;           // 단 사이 구분선
    lineType?: 'SOLID' | 'DASHED' | 'DOTTED' | 'NONE';
    lineWidth?: number;              // 선 굵기 (HWPUNIT)
    lineColor?: string;              // 선 색상 (#RRGGBB)
    widths?: number[];               // 각 단의 너비 (sameWidth가 false일 때)
}

/**
 * Generate OWPML column definition XML
 * @param columnDef Column definition object
 * @returns OWPML column XML string
 */
export function columnDefToXml(columnDef: ExtendedColumnDef): string {
    const type = columnDef.type || 'NEWSPAPER';
    const layout = columnDef.layout || 'LEFT';
    const colCount = columnDef.columnCount || 1;
    const sameSz = columnDef.sameWidth ? '1' : '0';
    const sameGap = columnDef.gap || 0;

    let colszContent = '';

    // 단 너비가 다른 경우 각 단의 너비 지정
    if (!columnDef.sameWidth && columnDef.widths && columnDef.widths.length > 0) {
        colszContent = columnDef.widths
            .map((width, idx) => `<hp:colSz id="${idx}" width="${width}" gap="${sameGap}"/>`)
            .join('\n        ');
    }

    // 단 사이 구분선
    let lineContent = '';
    if (columnDef.lineBetween) {
        const lineType = columnDef.lineType || 'SOLID';
        const lineWidth = columnDef.lineWidth || 100; // 0.1mm default
        const lineColor = columnDef.lineColor || '#000000';
        lineContent = `<hp:colLine type="${lineType}" width="${lineWidth}" color="${lineColor}"/>`;
    }

    const innerContent = colszContent || lineContent
        ? `\n        ${colszContent}${lineContent}\n      `
        : '';

    return `<hp:ctrl>
      <hp:colPr id="" type="${type}" layout="${layout}" colCount="${colCount}" sameSz="${sameSz}" sameGap="${sameGap}">${innerContent}</hp:colPr>
    </hp:ctrl>`;
}

/**
 * Generate column break control
 * 단 나누기 컨트롤 생성
 */
export function columnBreakToXml(): string {
    return '<hp:ctrl><hp:columnBreak/></hp:ctrl>';
}

/**
 * Helper to create default single column definition
 */
export function createDefaultColumnDef(): ExtendedColumnDef {
    return {
        columnCount: 1,
        sameWidth: true,
        gap: 0,
        type: 'NEWSPAPER',
        layout: 'LEFT'
    };
}

/**
 * Helper to create multi-column definition
 * @param count Number of columns
 * @param gap Gap between columns (HWPUNIT)
 * @param sameWidth Whether all columns have same width
 */
export function createMultiColumnDef(
    count: number,
    gap: number,
    sameWidth: boolean = true
): ExtendedColumnDef {
    return {
        columnCount: count,
        sameWidth,
        gap,
        type: 'NEWSPAPER',
        layout: 'LEFT'
    };
}
