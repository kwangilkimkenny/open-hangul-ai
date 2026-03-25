/**
 * BinData ID Remapper
 *
 * Native Hancom HWPX remaps binData IDs sequentially (1, 2, 3...) based on usage order.
 * This utility builds a mapping from original HWP binData IDs to new sequential IDs.
 */

import type { ParsedHwp, EnhancedSection, EnhancedParagraph, DocInfo } from '../adapters/IHwpParser';

/**
 * FillInfo structure with optional imgBrush/imageFill
 */
interface FillInfoExtended {
    imgBrush?: { binItemId?: number; binDataId?: number };
    imageFill?: { binItemId?: number; binDataId?: number };
    type?: number;
    fillType?: number;
    binItemId?: number;
    binDataId?: number;
}

/**
 * BorderFill with optional imgBrush containing binItemId
 */
interface BorderFillWithImage {
    id?: number;
    fillBrush?: FillInfoExtended;
    fillInfo?: FillInfoExtended;
    fill?: FillInfoExtended;
}

/**
 * DocInfo extended with borderFillList
 */
interface ExtendedDocInfo extends Omit<DocInfo, 'borderFillList'> {
    borderFillList?: Map<number, BorderFillWithImage> | BorderFillWithImage[];
}

/**
 * Control with optional picture properties
 */
interface ControlWithPicture {
    type: string;
    ctrlId?: string;
    binDataIDRef?: number;
    binDataId?: number;
    cells?: Array<{
        paragraphs?: EnhancedParagraph[];
    }>;
    paragraphs?: EnhancedParagraph[];
}

export interface BinDataIdMap {
    oldToNew: Map<number, number>;  // Original ID -> New sequential ID
    newToOld: Map<number, number>;  // New sequential ID -> Original ID
}

/**
 * Global context for current conversion session's ID mapping
 * Set at the start of conversion, used throughout XML generation
 */
let currentIdMap: BinDataIdMap | null = null;

/**
 * Set the current ID map for this conversion session
 */
export function setCurrentBinDataIdMap(idMap: BinDataIdMap | null): void {
    currentIdMap = idMap;
}

/**
 * Get the current ID map (may be null if not set)
 */
export function getCurrentBinDataIdMap(): BinDataIdMap | null {
    return currentIdMap;
}

/**
 * Build binData ID remapping from parsed HWP document
 *
 * Native Hancom HWPX remaps IDs in the ORDER they are first referenced:
 * 1. BorderFill imgBrush references (in BorderFill ID order)
 * 2. Picture controls (in document order)
 * 3. Any remaining binData IDs
 *
 * Returns a mapping that renumbers them sequentially starting from 1.
 */
export function buildBinDataIdMap(parsed: ParsedHwp): BinDataIdMap {
    // Use array to preserve order (not Set which doesn't guarantee order)
    const orderedIds: number[] = [];
    const seenIds = new Set<number>();

    const addId = (id: number) => {
        if (id > 0 && !seenIds.has(id)) {
            seenIds.add(id);
            orderedIds.push(id);
        }
    };

    // 1. Collect IDs from BorderFill imgBrush IN ORDER (by BorderFill ID)
    const docInfo = parsed.docInfo as ExtendedDocInfo;
    const borderFillSource = docInfo.raw?.borderFills ||
        docInfo.borderFillList ||
        docInfo.raw?.borderFillList;

    if (borderFillSource) {
        // Get BorderFills sorted by their ID to ensure consistent order
        let borderFillEntries: [number, BorderFillWithImage][];

        if (borderFillSource instanceof Map) {
            // Cast to handle both BorderFill and BorderFillWithImage maps
            borderFillEntries = Array.from(
                borderFillSource.entries() as IterableIterator<[number, BorderFillWithImage]>
            );
        } else if (Array.isArray(borderFillSource)) {
            borderFillEntries = borderFillSource.map((bf, idx) => [
                (bf as BorderFillWithImage).id ?? idx + 1,
                bf as BorderFillWithImage
            ]);
        } else {
            borderFillEntries = [];
        }

        // Sort by BorderFill ID to match native Hancom order
        borderFillEntries.sort((a, b) => a[0] - b[0]);

        for (const [, bf] of borderFillEntries) {
            const binItemId = extractBinItemIdFromBorderFill(bf);
            if (binItemId) {
                addId(binItemId);
            }
        }
    }

    // 2. Collect IDs from pictures in sections (in document order)
    for (const section of parsed.sections) {
        collectPictureBinDataIdsOrdered(section, addId);
    }

    // 3. Add any remaining binData IDs (sorted for consistency)
    const remainingIds = Array.from(parsed.binData.keys())
        .filter(id => !seenIds.has(id))
        .sort((a, b) => a - b);
    for (const id of remainingIds) {
        addId(id);
    }

    // 4. Create sequential mapping from ordered IDs
    const oldToNew = new Map<number, number>();
    const newToOld = new Map<number, number>();

    let newId = 1;
    for (const oldId of orderedIds) {
        oldToNew.set(oldId, newId);
        newToOld.set(newId, oldId);
        newId++;
    }

    return { oldToNew, newToOld };
}

/**
 * Extract binItemId from BorderFill's fillInfo/imgBrush
 */
function extractBinItemIdFromBorderFill(bf: BorderFillWithImage): number | null {
    // Check various possible structures for fillInfo
    const fillInfo = bf.fillInfo || bf.fillBrush || bf.fill;
    if (!fillInfo) return null;

    // Direct imgBrush
    if (fillInfo.imgBrush) {
        return fillInfo.imgBrush.binItemId || fillInfo.imgBrush.binDataId || null;
    }

    // Nested in type-specific fill
    if (fillInfo.imageFill) {
        return fillInfo.imageFill.binItemId || fillInfo.imageFill.binDataId || null;
    }

    // Check raw property structure from hwplib-js
    if (fillInfo.type === 4 || fillInfo.fillType === 4) { // Image fill type
        return fillInfo.binItemId || fillInfo.binDataId || null;
    }

    return null;
}

/**
 * Recursively collect binData IDs from pictures in section (ordered)
 */
function collectPictureBinDataIdsOrdered(section: EnhancedSection, addId: (id: number) => void): void {
    for (const para of section.paragraphs) {
        collectFromParagraphOrdered(para, addId);
    }
}

function collectFromParagraphOrdered(para: EnhancedParagraph, addId: (id: number) => void): void {
    // Check controls in paragraph
    if (para.controls) {
        for (const ctrl of para.controls) {
            const typedCtrl = ctrl as ControlWithPicture;

            // Picture control
            if (ctrl.type === 'PICTURE' || typedCtrl.ctrlId === 'gso ') {
                const binId = typedCtrl.binDataIDRef || typedCtrl.binDataId;
                if (binId && binId > 0) {
                    addId(binId);
                }
            }

            // Table control - check cells for pictures
            if (ctrl.type === 'TABLE' && typedCtrl.cells) {
                for (const cell of typedCtrl.cells) {
                    if (cell.paragraphs) {
                        for (const cellPara of cell.paragraphs) {
                            collectFromParagraphOrdered(cellPara, addId);
                        }
                    }
                }
            }

            // Nested containers
            if (typedCtrl.paragraphs) {
                for (const nestedPara of typedCtrl.paragraphs) {
                    collectFromParagraphOrdered(nestedPara, addId);
                }
            }
        }
    }
}

/**
 * Get remapped bin ID for use in HWPX output
 * Uses provided idMap or falls back to global context
 */
export function getRemappedBinId(oldId: number, idMap?: BinDataIdMap | null): number {
    const map = idMap || currentIdMap;
    if (!map) return oldId;
    return map.oldToNew.get(oldId) || oldId;
}

/**
 * Format remapped bin ID as image reference string
 * Uses provided idMap or falls back to global context
 */
export function formatRemappedBinId(oldId: number, idMap?: BinDataIdMap | null): string {
    const newId = getRemappedBinId(oldId, idMap);
    return 'image' + newId;
}
