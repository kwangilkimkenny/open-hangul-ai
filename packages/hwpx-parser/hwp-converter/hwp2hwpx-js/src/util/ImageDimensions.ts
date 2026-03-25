/**
 * 이미지 파일에서 픽셀 크기를 추출하는 유틸리티
 *
 * PNG, JPEG, GIF, BMP 등 주요 이미지 포맷 지원
 */

export interface ImageDimensions {
    width: number;
    height: number;
}

/**
 * 바이너리 데이터에서 이미지 픽셀 크기 추출
 */
export function getImageDimensions(data: Uint8Array): ImageDimensions | null {
    if (!data || data.length < 8) {
        return null;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
        return getPngDimensions(data);
    }

    // JPEG: FF D8 FF
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
        return getJpegDimensions(data);
    }

    // GIF: 47 49 46 38 (GIF87a or GIF89a)
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
        return getGifDimensions(data);
    }

    // BMP: 42 4D
    if (data[0] === 0x42 && data[1] === 0x4D) {
        return getBmpDimensions(data);
    }

    // TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
    if ((data[0] === 0x49 && data[1] === 0x49 && data[2] === 0x2A && data[3] === 0x00) ||
        (data[0] === 0x4D && data[1] === 0x4D && data[2] === 0x00 && data[3] === 0x2A)) {
        return getTiffDimensions(data);
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
        data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
        return getWebpDimensions(data);
    }

    return null;
}

/**
 * PNG 이미지 크기 추출
 * IHDR 청크에서 너비와 높이를 읽음 (offset 16-23)
 */
function getPngDimensions(data: Uint8Array): ImageDimensions | null {
    if (data.length < 24) return null;

    // IHDR is always the first chunk after the PNG signature (8 bytes)
    // Structure: Length (4) + Type (4) + Data + CRC (4)
    // Width and Height are at offset 16-23 (big-endian)
    const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
    const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];

    return { width, height };
}

/**
 * JPEG 이미지 크기 추출
 * SOF0/SOF2 마커에서 크기 정보를 읽음
 */
function getJpegDimensions(data: Uint8Array): ImageDimensions | null {
    let offset = 2; // Skip SOI marker

    while (offset < data.length - 8) {
        // Look for marker
        if (data[offset] !== 0xFF) {
            offset++;
            continue;
        }

        const marker = data[offset + 1];

        // Skip padding FF bytes
        if (marker === 0xFF) {
            offset++;
            continue;
        }

        // Skip standalone markers (0x00, 0x01, 0xD0-0xD7, 0xD8, 0xD9)
        if (marker === 0x00 || marker === 0x01 ||
            (marker >= 0xD0 && marker <= 0xD9)) {
            offset += 2;
            continue;
        }

        // SOF markers (Start of Frame) - 0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCF
        if ((marker >= 0xC0 && marker <= 0xC3) ||
            (marker >= 0xC5 && marker <= 0xC7) ||
            (marker >= 0xC9 && marker <= 0xCB) ||
            (marker >= 0xCD && marker <= 0xCF)) {

            if (offset + 9 >= data.length) return null;

            // Height at offset+5-6, Width at offset+7-8 (big-endian)
            const height = (data[offset + 5] << 8) | data[offset + 6];
            const width = (data[offset + 7] << 8) | data[offset + 8];

            return { width, height };
        }

        // Skip other markers
        if (offset + 4 >= data.length) return null;
        const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
        offset += 2 + segmentLength;
    }

    return null;
}

/**
 * GIF 이미지 크기 추출
 * 헤더의 offset 6-9에서 너비와 높이를 읽음
 */
function getGifDimensions(data: Uint8Array): ImageDimensions | null {
    if (data.length < 10) return null;

    // Little-endian at offset 6-9
    const width = data[6] | (data[7] << 8);
    const height = data[8] | (data[9] << 8);

    return { width, height };
}

/**
 * BMP 이미지 크기 추출
 * DIB 헤더에서 너비와 높이를 읽음
 */
function getBmpDimensions(data: Uint8Array): ImageDimensions | null {
    if (data.length < 26) return null;

    // DIB header starts at offset 14
    // Width at offset 18-21, Height at offset 22-25 (little-endian, signed for height)
    const width = data[18] | (data[19] << 8) | (data[20] << 16) | (data[21] << 24);
    let height = data[22] | (data[23] << 8) | (data[24] << 16) | (data[25] << 24);

    // Height can be negative (top-down DIB)
    if (height < 0) height = -height;

    return { width, height };
}

/**
 * TIFF 이미지 크기 추출 (기본 지원)
 */
function getTiffDimensions(data: Uint8Array): ImageDimensions | null {
    if (data.length < 16) return null;

    const littleEndian = data[0] === 0x49;

    const readUint16 = (offset: number) => {
        if (littleEndian) {
            return data[offset] | (data[offset + 1] << 8);
        }
        return (data[offset] << 8) | data[offset + 1];
    };

    const readUint32 = (offset: number) => {
        if (littleEndian) {
            return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
        }
        return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    };

    // IFD offset at offset 4
    const ifdOffset = readUint32(4);
    if (ifdOffset + 2 >= data.length) return null;

    const numEntries = readUint16(ifdOffset);
    let width = 0;
    let height = 0;

    for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifdOffset + 2 + (i * 12);
        if (entryOffset + 12 > data.length) break;

        const tag = readUint16(entryOffset);
        const type = readUint16(entryOffset + 2);

        // Tag 256 = ImageWidth, Tag 257 = ImageLength
        if (tag === 256 || tag === 257) {
            let value;
            if (type === 3) { // SHORT
                value = readUint16(entryOffset + 8);
            } else { // LONG
                value = readUint32(entryOffset + 8);
            }

            if (tag === 256) width = value;
            else height = value;
        }
    }

    if (width && height) {
        return { width, height };
    }

    return null;
}

/**
 * WebP 이미지 크기 추출
 */
function getWebpDimensions(data: Uint8Array): ImageDimensions | null {
    if (data.length < 30) return null;

    // Check for VP8 or VP8L or VP8X
    const chunk = String.fromCharCode(data[12], data[13], data[14], data[15]);

    if (chunk === 'VP8 ') {
        // Lossy format
        // Width at offset 26-27, Height at offset 28-29 (14 bits each)
        if (data.length < 30) return null;
        const width = (data[26] | (data[27] << 8)) & 0x3FFF;
        const height = (data[28] | (data[29] << 8)) & 0x3FFF;
        return { width, height };
    }

    if (chunk === 'VP8L') {
        // Lossless format
        if (data.length < 25) return null;
        // Signature byte at offset 21
        const b0 = data[21];
        const b1 = data[22];
        const b2 = data[23];
        const b3 = data[24];

        const width = 1 + ((b1 & 0x3F) << 8 | b0);
        const height = 1 + ((b3 & 0xF) << 10 | b2 << 2 | (b1 >> 6));
        return { width, height };
    }

    if (chunk === 'VP8X') {
        // Extended format
        if (data.length < 30) return null;
        // Canvas width at offset 24-26 (24 bits, little-endian)
        // Canvas height at offset 27-29 (24 bits, little-endian)
        const width = 1 + (data[24] | (data[25] << 8) | (data[26] << 16));
        const height = 1 + (data[27] | (data[28] << 8) | (data[29] << 16));
        return { width, height };
    }

    return null;
}

/**
 * HWPUNIT * 75 factor for extra size field
 * HWP uses 7200 HWPUNIT per inch, and at 96 DPI:
 * 7200 / 96 = 75 HWPUNIT per pixel
 */
export const HWPUNIT_PER_PIXEL_96DPI = 75;
