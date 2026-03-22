/**
 * ForMedia.ts - Multimedia (Video/Audio) OWPML Generator
 * 멀티미디어 (동영상/사운드) OWPML 생성 모듈
 */

/**
 * Media types
 */
export const MediaType = {
    VIDEO: 'VIDEO',
    AUDIO: 'AUDIO'
} as const;

/**
 * Video format types
 */
export const VideoFormat = {
    AVI: 'AVI',
    MP4: 'MP4',
    WMV: 'WMV',
    MOV: 'MOV',
    FLV: 'FLV',
    MKV: 'MKV',
    WEBM: 'WEBM'
} as const;

/**
 * Audio format types
 */
export const AudioFormat = {
    WAV: 'WAV',
    MP3: 'MP3',
    WMA: 'WMA',
    OGG: 'OGG',
    AAC: 'AAC',
    FLAC: 'FLAC'
} as const;

/**
 * Media object interface
 */
export interface MediaObject {
    id: number;
    type: keyof typeof MediaType;
    format: string;                   // 파일 포맷
    binDataIDRef: number;             // 미디어 데이터 BinData ID
    previewBinDataIDRef?: number;     // 미리보기 이미지 BinData ID
    width: number;                    // 너비 (HWPUNIT)
    height: number;                   // 높이 (HWPUNIT)
    x?: number;                       // X 위치
    y?: number;                       // Y 위치
    zOrder?: number;                  // Z 순서
    autoPlay?: boolean;               // 자동 재생
    loop?: boolean;                   // 반복 재생
    showControls?: boolean;           // 컨트롤 표시
    muted?: boolean;                  // 음소거
    volume?: number;                  // 볼륨 (0-100)
    startTime?: number;               // 시작 시간 (ms)
    endTime?: number;                 // 종료 시간 (ms)
}

/**
 * HWP Media control interface
 */
export interface HWPMediaControl {
    type: 'MEDIA';
    mediaObject: MediaObject;
}

/**
 * Generate OWPML media object XML
 * @param media Media object definition
 * @returns OWPML media XML string
 */
export function mediaToXml(media: MediaObject): string {
    const showControls = media.showControls ?? true;
    const autoPlay = media.autoPlay ?? false;
    const loop = media.loop ?? false;
    const muted = media.muted ?? false;
    const volume = media.volume ?? 100;

    // Size and position
    const sizeContent = `<hp:sz width="${media.width}" height="${media.height}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE"/>`;
    const posContent = `<hp:pos vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" treatAsChar="1"/>`;

    // Media-specific attributes
    const mediaAttrs = [
        `type="${media.type}"`,
        `format="${media.format}"`,
        `binDataIDRef="${media.binDataIDRef}"`,
        `autoPlay="${autoPlay ? '1' : '0'}"`,
        `loop="${loop ? '1' : '0'}"`,
        `showControls="${showControls ? '1' : '0'}"`,
        `muted="${muted ? '1' : '0'}"`,
        `volume="${volume}"`,
        media.startTime !== undefined ? `startTime="${media.startTime}"` : '',
        media.endTime !== undefined ? `endTime="${media.endTime}"` : ''
    ].filter(Boolean).join(' ');

    // Preview image (for video thumbnails)
    let previewContent = '';
    if (media.previewBinDataIDRef !== undefined) {
        previewContent = `
      <hp:preview binDataIDRef="${media.previewBinDataIDRef}"/>`;
    }

    return `<hp:ctrl>
    <hp:shapeObject id="${media.id}" zOrder="${media.zOrder ?? 0}" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0">
      ${sizeContent}
      ${posContent}
      <hp:outMargin left="0" right="0" top="0" bottom="0"/>
      <hp:media ${mediaAttrs}>${previewContent}
      </hp:media>
    </hp:shapeObject>
  </hp:ctrl>`;
}

/**
 * Create media fallback as static preview image
 * Used when media playback is not supported in target viewer
 */
export function createMediaFallbackImage(media: MediaObject): string {
    const previewId = media.previewBinDataIDRef ?? media.binDataIDRef;

    return `<hp:ctrl>
    <hp:shapeObject id="${media.id}" zOrder="${media.zOrder ?? 0}" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0">
      <hp:sz width="${media.width}" height="${media.height}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE"/>
      <hp:pos vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" treatAsChar="1"/>
      <hp:outMargin left="0" right="0" top="0" bottom="0"/>
      <hp:img bright="0" contrast="0" effect="REAL_PIC" binDataIDRef="${previewId}">
        <hp:imgRect x1="0" y1="0" x2="100" y2="100"/>
        <hp:imgClip left="0" right="0" top="0" bottom="0"/>
        <hp:imgDim dimwidth="${media.width}" dimheight="${media.height}"/>
      </hp:img>
    </hp:shapeObject>
  </hp:ctrl>`;
}

/**
 * Complete video format set
 * 완전한 비디오 형식 목록
 */
const VIDEO_FORMATS = new Set([
    'avi', 'mp4', 'wmv', 'mov', 'flv', 'mkv', 'webm',
    'm4v', 'mpg', 'mpeg', 'vob', '3gp', '3g2', 'ts', 'mts', 'm2ts',
    'divx', 'xvid', 'asf', 'rm', 'rmvb', 'ogv', 'dv', 'f4v', 'swf'
]);

/**
 * Complete audio format set
 * 완전한 오디오 형식 목록
 */
const AUDIO_FORMATS = new Set([
    'wav', 'mp3', 'wma', 'ogg', 'aac', 'flac', 'mid', 'midi',
    'm4a', 'aiff', 'aif', 'au', 'ra', 'ram', 'ape', 'mka', 'opus',
    'ac3', 'dts', 'amr', 'mpc', 'tak', 'tta', 'wv', 'caf', 'pcm'
]);

/**
 * Get media format from file extension (comprehensive support)
 * 파일 확장자에서 미디어 형식 가져오기 (포괄적 지원)
 */
export function getMediaFormat(filename: string): { type: keyof typeof MediaType; format: string } {
    const ext = filename.toLowerCase().split('.').pop() || '';

    // Video formats
    if (VIDEO_FORMATS.has(ext)) {
        // Normalize some formats to common names
        let format = ext.toUpperCase();
        if (ext === 'mpg' || ext === 'mpeg') format = 'MPEG';
        if (ext === 'm4v') format = 'MP4';
        if (ext === 'divx' || ext === 'xvid') format = 'AVI';
        if (ext === 'ogv') format = 'OGV';
        return { type: 'VIDEO', format };
    }

    // Audio formats
    if (AUDIO_FORMATS.has(ext)) {
        // Normalize some formats to common names
        let format = ext.toUpperCase();
        if (ext === 'aiff' || ext === 'aif') format = 'AIFF';
        if (ext === 'm4a') format = 'M4A';
        if (ext === 'ra' || ext === 'ram') format = 'RA';
        return { type: 'AUDIO', format };
    }

    // Default to video with unknown format (better than returning null)
    return { type: 'VIDEO', format: ext.toUpperCase() || 'UNKNOWN' };
}

/**
 * Create video media object
 */
export function createVideo(
    id: number,
    binDataIDRef: number,
    width: number = 80000,
    height: number = 45000,
    format: string = 'MP4'
): MediaObject {
    return {
        id,
        type: 'VIDEO',
        format,
        binDataIDRef,
        width,
        height,
        showControls: true,
        autoPlay: false,
        loop: false
    };
}

/**
 * Create audio media object
 */
export function createAudio(
    id: number,
    binDataIDRef: number,
    format: string = 'MP3'
): MediaObject {
    return {
        id,
        type: 'AUDIO',
        format,
        binDataIDRef,
        width: 40000,   // Standard audio player width
        height: 8000,   // Standard audio player height
        showControls: true,
        autoPlay: false,
        loop: false
    };
}
