/**
 * HWP BinData (이미지/OLE 객체) 구조 정의
 */

// HWP BinData 관련 레코드 태그 ID
export const enum BinDataTag {
  HWPTAG_BIN_DATA = 18,          // BinData (HWP 5.0+)
  HWPTAG_BIN_DATA_OLD = 26,      // BinData (HWP 3.x/4.x)
}

/**
 * BinData 타입
 */
export const enum BinDataType {
  LINK = 0,           // 외부 링크
  EMBEDDING = 1,      // 포함
  STORAGE = 2,        // 저장소
}

/**
 * 이미지 포맷
 */
export const enum ImageFormat {
  UNKNOWN = 'UNKNOWN',
  JPG = 'JPG',
  JPEG = 'JPEG',
  PNG = 'PNG',
  BMP = 'BMP',
  GIF = 'GIF',
  TIFF = 'TIFF',
  EMF = 'EMF',
  WMF = 'WMF',
}

/**
 * BinData 압축 타입
 */
export const enum CompressionType {
  NONE = 0,           // 압축 없음
  ZLIB = 1,           // zlib 압축
  STORAGE = 2,        // 저장소 압축
}

/**
 * BinData (이미지/OLE 데이터)
 */
export interface BinData {
  id: number;                    // BinData ID (0부터 시작)
  type: BinDataType;             // 타입 (링크/포함/저장소)
  compression: CompressionType;  // 압축 타입
  
  // 데이터 정보
  format: ImageFormat;           // 이미지 포맷
  extension: string;             // 확장자 ("jpg", "png", "bmp" 등)
  
  // 원본 데이터
  data: Uint8Array;              // 실제 이미지 데이터 (압축 해제됨)
  compressedData?: Uint8Array;   // 압축된 데이터 (옵션)
  
  // 크기 정보
  size: number;                  // 데이터 크기 (압축 해제 후)
  compressedSize?: number;       // 압축된 크기
  
  // 추가 정보
  name?: string;                 // 파일명 (옵션)
  absolutePath?: string;         // 절대 경로 (링크 타입인 경우)
  relativePathBase?: string;     // 상대 경로 기준
  
  // 메타데이터
  width?: number;                // 이미지 너비 (픽셀)
  height?: number;               // 이미지 높이 (픽셀)
  bpp?: number;                  // Bits Per Pixel
}

/**
 * 이미지 시그니처 (매직 넘버)
 */
export const IMAGE_SIGNATURES = {
  JPG: [0xFF, 0xD8, 0xFF],
  PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  BMP: [0x42, 0x4D],
  GIF: [0x47, 0x49, 0x46, 0x38],
  TIFF_LE: [0x49, 0x49, 0x2A, 0x00],  // Little Endian
  TIFF_BE: [0x4D, 0x4D, 0x00, 0x2A],  // Big Endian
  EMF: [0x01, 0x00, 0x00, 0x00],
  WMF: [0xD7, 0xCD, 0xC6, 0x9A],
};

/**
 * 이미지 포맷 식별
 */
export function identifyImageFormat(data: Uint8Array): ImageFormat {
  if (data.length < 8) return ImageFormat.UNKNOWN;
  
  // JPG
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return ImageFormat.JPG;
  }
  
  // PNG
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
      data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A) {
    return ImageFormat.PNG;
  }
  
  // BMP
  if (data[0] === 0x42 && data[1] === 0x4D) {
    return ImageFormat.BMP;
  }
  
  // GIF
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return ImageFormat.GIF;
  }
  
  // TIFF
  if ((data[0] === 0x49 && data[1] === 0x49 && data[2] === 0x2A && data[3] === 0x00) ||
      (data[0] === 0x4D && data[1] === 0x4D && data[2] === 0x00 && data[3] === 0x2A)) {
    return ImageFormat.TIFF;
  }
  
  // EMF
  if (data[0] === 0x01 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x00) {
    return ImageFormat.EMF;
  }
  
  // WMF
  if (data[0] === 0xD7 && data[1] === 0xCD && data[2] === 0xC6 && data[3] === 0x9A) {
    return ImageFormat.WMF;
  }
  
  return ImageFormat.UNKNOWN;
}

/**
 * 파일명에서 확장자 추출
 */
export function getExtensionFromName(name: string): string {
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * 포맷에서 확장자 얻기
 */
export function getExtensionFromFormat(format: ImageFormat): string {
  switch (format) {
    case ImageFormat.JPG:
    case ImageFormat.JPEG:
      return 'jpg';
    case ImageFormat.PNG:
      return 'png';
    case ImageFormat.BMP:
      return 'bmp';
    case ImageFormat.GIF:
      return 'gif';
    case ImageFormat.TIFF:
      return 'tif';
    case ImageFormat.EMF:
      return 'emf';
    case ImageFormat.WMF:
      return 'wmf';
    default:
      return 'bin';
  }
}

