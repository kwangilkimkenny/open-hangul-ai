/**
 * TrackChanges (변경 추적) XML Generation
 * HWPML-compliant track changes XML generation
 */

import type { TrackChange, TrackChangeAuthor } from '../../adapters/IHwpParser';

/**
 * Track change type enumeration
 */
export enum TrackChangeType {
    INSERT = 0,        // 삽입
    DELETE = 1,        // 삭제
    REPLACE = 2,       // 대체
    MODIFY = 3,        // 수정
    MOVE_FROM = 4,     // 이동 시작
    MOVE_TO = 5,       // 이동 끝
}

/**
 * TrackChange config flags
 * Based on HWP binary flag structure
 */
export interface TrackChangeFlags {
    trackChangesEnabled: boolean;    // 변경 추적 사용
    showInsertions: boolean;         // 삽입 표시
    showDeletions: boolean;          // 삭제 표시
    showFormatting: boolean;         // 서식 변경 표시
    showComments: boolean;           // 메모 표시
    showMarkup: boolean;             // 마크업 표시
}

/**
 * Default track change flags
 */
export const DEFAULT_TRACK_CHANGE_FLAGS: TrackChangeFlags = {
    trackChangesEnabled: false,
    showInsertions: true,
    showDeletions: true,
    showFormatting: true,
    showComments: true,
    showMarkup: true,
};

/**
 * Encode track change flags to numeric value
 */
export function encodeTrackChangeFlags(flags: TrackChangeFlags): number {
    let value = 0;

    if (flags.trackChangesEnabled) value |= 0x01;
    if (flags.showInsertions) value |= 0x02;
    if (flags.showDeletions) value |= 0x04;
    if (flags.showFormatting) value |= 0x08;
    if (flags.showComments) value |= 0x10;
    if (flags.showMarkup) value |= 0x20;

    return value;
}

/**
 * Decode numeric value to track change flags
 */
export function decodeTrackChangeFlags(value: number): TrackChangeFlags {
    return {
        trackChangesEnabled: (value & 0x01) !== 0,
        showInsertions: (value & 0x02) !== 0,
        showDeletions: (value & 0x04) !== 0,
        showFormatting: (value & 0x08) !== 0,
        showComments: (value & 0x10) !== 0,
        showMarkup: (value & 0x20) !== 0,
    };
}

/**
 * Generate trackchageConfig XML element
 * @param flags Track change flags or numeric value
 */
export function generateTrackChangeConfig(flags?: TrackChangeFlags | number): string {
    let flagValue: number;

    if (typeof flags === 'number') {
        flagValue = flags;
    } else if (flags) {
        flagValue = encodeTrackChangeFlags(flags);
    } else {
        // Default: show all but disabled
        flagValue = encodeTrackChangeFlags(DEFAULT_TRACK_CHANGE_FLAGS);
    }

    return `<hh:trackchageConfig flags="${flagValue}"/>`;
}

/**
 * Get track change type name for XML output
 */
export function getTrackChangeTypeName(type: number | undefined): string {
    switch (type) {
        case TrackChangeType.INSERT:
            return 'INSERT';
        case TrackChangeType.DELETE:
            return 'DELETE';
        case TrackChangeType.REPLACE:
            return 'REPLACE';
        case TrackChangeType.MODIFY:
            return 'MODIFY';
        case TrackChangeType.MOVE_FROM:
            return 'MOVE_FROM';
        case TrackChangeType.MOVE_TO:
            return 'MOVE_TO';
        default:
            return 'MODIFY';
    }
}

/**
 * Generate track change author list XML
 */
export function generateTrackChangeAuthorsXml(authors?: TrackChangeAuthor[]): string {
    if (!authors || authors.length === 0) {
        return '';
    }

    const authorXmls = authors.map(author =>
        `<hh:tcAuthor id="${author.id}" name="${escapeXml(author.name || '')}"/>`
    ).join('');

    return `<hh:tcAuthors>${authorXmls}</hh:tcAuthors>`;
}

/**
 * Generate track change list XML
 */
export function generateTrackChangesXml(changes?: TrackChange[], authors?: TrackChangeAuthor[]): string {
    if (!changes || changes.length === 0) {
        return '';
    }

    const changeXmls = changes.map(change => {
        const date = change.date ? change.date.toISOString() : new Date().toISOString();
        const type = getTrackChangeTypeName(change.type);
        const authorId = change.authorId ?? 0;

        return `<hh:tc id="${change.id}" type="${type}" date="${date}" authorId="${authorId}"/>`;
    }).join('');

    const authorsXml = generateTrackChangeAuthorsXml(authors);

    return `<hh:trackChanges>${authorsXml}<hh:tcList>${changeXmls}</hh:tcList></hh:trackChanges>`;
}

/**
 * Generate track change inline marker for content
 * Used to mark changed text in paragraphs
 */
export function generateTrackChangeMarker(changeId: number, type: 'begin' | 'end'): string {
    if (type === 'begin') {
        return `<hp:tcPr id="${changeId}"/>`;
    }
    return `</hp:tcPr>`;
}

/**
 * XML escape helper
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
