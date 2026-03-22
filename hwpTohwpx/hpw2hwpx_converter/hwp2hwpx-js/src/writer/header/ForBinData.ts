import { getRemappedBinId } from '../../util/BinDataIdMapper';

/**
 * Generates <hh:binDataList> XML for header.xml
 *
 * Uses the actual extracted binary data list to ensure consistency
 * between header.xml binDataList, content.hpf manifest, and BinData files.
 *
 * Native Hancom HWPX uses "image1", "image2" format (decimal)
 * for binItem IDs and filenames.
 */
export function generateBinDataListXml(_binDataList: { id: number; extension: string }[]): string {
    // Native Hancom HWPX does NOT include binDataList in header.xml
    // All binary data references are in content.hpf only
    return '';
}

/**
 * Format binary ID to native Hancom format: image1, image2, image3...
 * Uses remapped sequential IDs to match native Hancom behavior
 */
export function formatBinId(id: number): string {
    const newId = getRemappedBinId(id);
    return 'image' + newId;
}
