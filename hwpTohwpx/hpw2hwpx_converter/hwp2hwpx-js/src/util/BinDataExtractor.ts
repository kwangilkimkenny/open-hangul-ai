/**
 * BinData Extraction Utility
 *
 * Consolidates common BinData extraction logic from multiple adapters
 * to reduce code duplication and ensure consistency.
 */

import { tryInflate } from '../wasm/CompressionHelper';
import type { BinDataItem } from '../adapters/IHwpParser';

// Pre-compiled regex patterns for performance
const BIN_ENTRY_PATTERN = /^BIN[0-9A-Fa-f]+\./i;
const BIN_FILENAME_PATTERN = /BIN([0-9A-Fa-f]+)\.(.*)/i;

/**
 * Directory entry interface (compatible with hwplib-js and custom parsers)
 */
export interface BinDataDirectoryEntry {
    name: string;
    type: number;
    childId: number;
    leftSiblingId: number;
    rightSiblingId: number;
}

/**
 * OLE Parser interface for BinData extraction
 */
export interface BinDataOLEParser {
    getDirectory(): BinDataDirectoryEntry[];
    readStream(entry: BinDataDirectoryEntry): Uint8Array;
}

/**
 * Parse a BIN filename and extract ID and extension
 */
export function parseBinFilename(filename: string): { id: number; extension: string } | null {
    const match = BIN_FILENAME_PATTERN.exec(filename);
    if (!match) return null;

    return {
        id: parseInt(match[1], 16),
        extension: match[2].toLowerCase()
    };
}

/**
 * Check if an entry name matches BIN data pattern
 */
export function isBinDataEntry(name: string): boolean {
    return BIN_ENTRY_PATTERN.test(name);
}

/**
 * Collect BinData children from OLE directory tree
 */
export function collectBinDataChildren(
    directory: BinDataDirectoryEntry[],
    binDataRoot: BinDataDirectoryEntry
): BinDataDirectoryEntry[] {
    const binDataChildren: BinDataDirectoryEntry[] = [];

    const collectChildren = (entryId: number) => {
        if (entryId === 0xFFFFFFFF || entryId >= directory.length) return;
        const entry = directory[entryId];
        if (entry.type === 2 && isBinDataEntry(entry.name)) {
            binDataChildren.push(entry);
        }
        if (entry.leftSiblingId !== 0xFFFFFFFF) collectChildren(entry.leftSiblingId);
        if (entry.rightSiblingId !== 0xFFFFFFFF) collectChildren(entry.rightSiblingId);
    };

    if (binDataRoot.childId !== 0xFFFFFFFF) {
        collectChildren(binDataRoot.childId);
    }

    return binDataChildren;
}

/**
 * Extract a single BinData item from stream data
 */
export function extractBinDataItem(
    filename: string,
    streamData: Uint8Array
): BinDataItem | null {
    const parsed = parseBinFilename(filename);
    if (!parsed) return null;

    // Try to decompress (WASM accelerated)
    const originalLength = streamData.length;
    const decompressedData = tryInflate(streamData);
    const isCompressed = decompressedData.length !== originalLength;

    return {
        id: parsed.id,
        data: decompressedData,
        extension: parsed.extension,
        isCompressed
    };
}

/**
 * Extract all BinData from an OLE file using the provided parser
 *
 * @param oleParser OLE parser instance
 * @param onError Optional error callback
 * @returns Map of BinData items by ID
 */
export function extractBinData(
    oleParser: BinDataOLEParser,
    onError?: (message: string, error?: unknown) => void
): Map<number, BinDataItem> {
    const binDataMap = new Map<number, BinDataItem>();

    try {
        const directory = oleParser.getDirectory();
        const binDataRoot = directory.find(
            (e: BinDataDirectoryEntry) => e.name === 'BinData' && e.type === 1
        );

        if (!binDataRoot) return binDataMap;

        const binDataChildren = collectBinDataChildren(directory, binDataRoot);

        for (const entry of binDataChildren) {
            try {
                const streamData = oleParser.readStream(entry);
                const item = extractBinDataItem(entry.name, streamData);

                if (item) {
                    binDataMap.set(item.id, item);
                }
            } catch (e) {
                onError?.(`Failed to extract ${entry.name}`, e);
            }
        }
    } catch (e) {
        onError?.('BinData extraction failed', e);
    }

    return binDataMap;
}

/**
 * Async generator for streaming BinData extraction
 * Memory-efficient for large documents
 */
export async function* streamBinDataFromEntries(
    entries: AsyncIterable<{ entry: { name: string }; data: Uint8Array }>
): AsyncGenerator<BinDataItem> {
    for await (const { entry, data } of entries) {
        if (!isBinDataEntry(entry.name)) continue;

        const item = extractBinDataItem(entry.name, data);
        if (item) {
            yield item;
        }
    }
}
