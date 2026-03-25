/**
 * CellImageProcessor - Convert cell background images to inline pictures
 *
 * HWP stores some images as cell background fills (BorderFill imgBrush).
 * HWPX format's BorderFill imgBrush is not fully supported by Hancom Office.
 * This processor converts such images to inline <hp:pic> elements.
 */

import type { EnhancedSection, BinDataItem, EnhancedParagraph } from '../adapters/IHwpParser';
import type { HWPControl, HWPParagraph } from '../models/hwp.types';

interface ImageFillInfo {
    binDataId: number;
    mode: number;
}

/**
 * BorderFill with imgBrush for image fills
 */
interface BorderFillWithImageBrush {
    id?: number;
    fillBrush?: {
        type?: number;
        imgBrush?: {
            binItemId?: number;
            mode?: number;
        };
    };
}

/**
 * Table cell structure
 */
interface TableCell {
    borderFillIDRef?: number;
    width?: number;
    height?: number;
    rowAddr?: number;
    colAddr?: number;
    paragraphs?: EnhancedParagraph[];
}

/**
 * Table row structure
 */
interface TableRow {
    cells?: TableCell[];
}

/**
 * Table data structure
 */
interface TableData {
    rows?: TableRow[];
}

/**
 * Build a map of borderFillId -> image fill info
 */
function buildImageFillMap(borderFills: Map<number, BorderFillWithImageBrush>): Map<number, ImageFillInfo> {
    const map = new Map<number, ImageFillInfo>();

    for (const [id, bf] of borderFills) {
        if (bf.fillBrush && bf.fillBrush.type === 4 && bf.fillBrush.imgBrush) {
            const imgBrush = bf.fillBrush.imgBrush;
            if (imgBrush.binItemId && imgBrush.binItemId > 0) {
                map.set(id, {
                    binDataId: imgBrush.binItemId,
                    mode: imgBrush.mode || 0
                });
            }
        }
    }

    return map;
}

/**
 * Create a synthetic PICTURE control for a cell with image fill
 */
function createPictureControl(
    imageFill: ImageFillInfo,
    cellWidth: number,
    cellHeight: number,
    binData?: Map<number, BinDataItem>
): HWPControl {
    // Get actual image dimensions (in HWP units)
    // imgWidth/imgHeight are the ORIGINAL image dimensions for imgRect/imgDim
    // width/height are the DISPLAY dimensions (cell size)
    let origImgWidth = cellWidth;
    let origImgHeight = cellHeight;

    if (binData) {
        const item = binData.get(imageFill.binDataId);
        if (item && item.data) {
            // Get original image dimensions from image header
            const dims = getImageDimensions(item.data, item.extension);
            if (dims) {
                origImgWidth = dims.width;
                origImgHeight = dims.height;
            }
        }
    }

    const pictureData = {
        binDataIDRef: imageFill.binDataId,
        // Display size = cell size (fill entire cell)
        width: cellWidth,
        height: cellHeight,
        // Original image dimensions for imgRect/imgDim
        imgWidth: origImgWidth,
        imgHeight: origImgHeight,
        // Crop values: use ORIGINAL IMAGE dimensions (show entire image)
        cropLeft: 0,
        cropRight: origImgWidth,
        cropTop: 0,
        cropBottom: origImgHeight,
        x: 0,
        y: 0,
        // Position as foreground image (in front of text to avoid being hidden by cell background)
        treatAsChar: false,
        textWrap: 5, // IN_FRONT_OF_TEXT - image appears in front, not hidden by cell fill
        textFlow: 0, // BOTH_SIDES
        vertRelTo: 2, // PARA
        horzRelTo: 3, // PARA
        vertAlign: 0, // TOP
        horzAlign: 0, // LEFT
        vertOffset: 0,
        horzOffset: 0
    };

    return {
        type: 'PICTURE' as const,
        obj: pictureData
    };
}

/**
 * Get image dimensions from image data
 */
function getImageDimensions(data: Uint8Array, ext: string): { width: number; height: number } | null {
    try {
        const lowerExt = ext.toLowerCase();

        if (lowerExt === 'png') {
            // PNG: width at bytes 16-19, height at bytes 20-23 (big endian)
            if (data.length >= 24 && data[0] === 0x89 && data[1] === 0x50) {
                const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
                const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
                // Convert pixels to HWP units (1 pixel ≈ 20 HWP units at 96 DPI)
                return { width: width * 20, height: height * 20 };
            }
        } else if (lowerExt === 'jpg' || lowerExt === 'jpeg') {
            // JPEG: Find SOF0/SOF2 marker for dimensions
            let offset = 2;
            while (offset < data.length - 9) {
                if (data[offset] === 0xFF) {
                    const marker = data[offset + 1];
                    if (marker === 0xC0 || marker === 0xC2) {
                        // SOF0 or SOF2: height at offset+5, width at offset+7
                        const height = (data[offset + 5] << 8) | data[offset + 6];
                        const width = (data[offset + 7] << 8) | data[offset + 8];
                        return { width: width * 20, height: height * 20 };
                    }
                    // Skip to next marker
                    const length = (data[offset + 2] << 8) | data[offset + 3];
                    offset += 2 + length;
                } else {
                    offset++;
                }
            }
        } else if (lowerExt === 'gif') {
            // GIF: width at bytes 6-7, height at bytes 8-9 (little endian)
            if (data.length >= 10 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
                const width = data[6] | (data[7] << 8);
                const height = data[8] | (data[9] << 8);
                return { width: width * 20, height: height * 20 };
            }
        } else if (lowerExt === 'bmp') {
            // BMP: width at bytes 18-21, height at bytes 22-25 (little endian)
            if (data.length >= 26 && data[0] === 0x42 && data[1] === 0x4D) {
                const width = data[18] | (data[19] << 8) | (data[20] << 16) | (data[21] << 24);
                const height = Math.abs(data[22] | (data[23] << 8) | (data[24] << 16) | (data[25] << 24));
                return { width: width * 20, height: height * 20 };
            }
        }
    } catch {
        // Ignore errors, return null
    }

    return null;
}

/**
 * Process a single cell to inject picture if it has image fill
 */
function processCell(
    cell: TableCell,
    imageFillMap: Map<number, ImageFillInfo>,
    binData?: Map<number, BinDataItem>,
    processedCells?: Set<string>
): void {
    const borderFillId = cell.borderFillIDRef;
    if (!borderFillId) return;

    const imageFill = imageFillMap.get(borderFillId);
    if (!imageFill) return;

    // Create a unique key for this cell to prevent duplicate processing
    const cellKey = `${cell.rowAddr}-${cell.colAddr}-${borderFillId}`;
    if (processedCells?.has(cellKey)) return;
    processedCells?.add(cellKey);

    // Get cell dimensions
    const cellWidth = cell.width || 8000;
    const cellHeight = cell.height || 6000;

    // Create picture control
    const pictureControl = createPictureControl(imageFill, cellWidth, cellHeight, binData);

    // Ensure cell has paragraphs
    if (!cell.paragraphs) {
        cell.paragraphs = [];
    }

    // Ensure first paragraph exists
    if (cell.paragraphs.length === 0) {
        cell.paragraphs.push({
            text: '',
            runs: [],
            controls: [],
            paraShapeID: 0,
            styleID: 0,
            charShapeID: 0
        });
    }

    // Add picture control to first paragraph
    const firstPara = cell.paragraphs[0] as HWPParagraph;
    if (!firstPara.controls) {
        firstPara.controls = [];
    }

    // Insert at beginning to ensure image appears first
    firstPara.controls.unshift(pictureControl);

    // Change borderFillIDRef to transparent style (no fill, no borders)
    // The original BorderFill had image fill + decorative borders
    // Since image is now inline, we use transparent style (ID 3 = no border/fill)
    cell.borderFillIDRef = 3;
}

/**
 * Process table controls recursively
 */
function processTableControl(
    control: HWPControl,
    imageFillMap: Map<number, ImageFillInfo>,
    binData?: Map<number, BinDataItem>,
    processedCells?: Set<string>
): void {
    if (control.type !== 'TABLE' || !control.obj) return;

    const table = control.obj as TableData;  // Table data is in control.obj
    const rows = table.rows || [];

    for (const row of rows) {
        const cells = row.cells || [];
        for (const cell of cells) {
            // Process this cell
            processCell(cell, imageFillMap, binData, processedCells);

            // Recursively process nested tables in cell paragraphs
            if (cell.paragraphs) {
                for (const para of cell.paragraphs) {
                    if (para.controls) {
                        for (const nestedControl of para.controls) {
                            processTableControl(nestedControl, imageFillMap, binData, processedCells);
                        }
                    }
                }
            }
        }
    }
}

/**
 * Process all sections to convert cell background images to inline pictures
 *
 * @param sections - Parsed sections from EnhancedAdapter
 * @param borderFills - BorderFill map from docInfo
 * @param binData - Binary data map for image dimension extraction
 */
export function processCellImages(
    sections: EnhancedSection[],
    borderFills: Map<number, BorderFillWithImageBrush>,
    binData?: Map<number, BinDataItem>
): void {
    // Build image fill map
    const imageFillMap = buildImageFillMap(borderFills);

    if (imageFillMap.size === 0) {
        return; // No image fills to process
    }

    // Track processed cells to avoid duplicates
    const processedCells = new Set<string>();

    // Process all sections
    for (const section of sections) {
        if (!section.paragraphs) continue;

        for (const para of section.paragraphs) {
            if (!para.controls) continue;

            for (const control of para.controls) {
                processTableControl(control, imageFillMap, binData, processedCells);
            }
        }
    }
}
