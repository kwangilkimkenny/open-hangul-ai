/**
 * OWPML 기본 타입 정의
 * hwpx-owpml-model의 Type.h를 참고하여 포팅
 */

/**
 * 에러 코드 타입
 */
export enum ErrorCode {
  NO_ERROR = 0,
  ERROR = 1,
  FATAL_ERROR = 2,
  WARNING = 3,
}

/**
 * COLORREF 타입 (Windows COLORREF와 호환)
 */
export class ColorRef {
  private ext: number = 0;
  private green: number = 0;
  private blue: number = 0;
  private red: number = 0;

  constructor(color?: number) {
    if (color !== undefined) {
      this.ext = (color & 0xff000000) >>> 24;
      this.blue = (color & 0x00ff0000) >>> 16;
      this.green = (color & 0x0000ff00) >>> 8;
      this.red = color & 0x000000ff;
    }
  }

  /**
   * COLORREF 값으로 변환
   */
  toColorRef(): number {
    let color = 0;
    color += this.ext << 24;
    color += this.blue << 16;
    color += this.green << 8;
    color += this.red;
    return color >>> 0; // unsigned int로 변환
  }

  /**
   * RGB 값 설정
   */
  setRgb(rgbcolor: number): void {
    this.ext = (rgbcolor & 0xff000000) >>> 24;
    this.red = (rgbcolor & 0x00ff0000) >>> 16;
    this.green = (rgbcolor & 0x0000ff00) >>> 8;
    this.blue = rgbcolor & 0x000000ff;
  }

  /**
   * RGB 값 가져오기
   */
  getRgb(): number {
    let color = 0;
    color += this.ext << 24;
    color += this.red << 16;
    color += this.green << 8;
    color += this.blue;
    return color >>> 0;
  }

  /**
   * RGB 컴포넌트 가져오기
   */
  getRed(): number {
    return this.red;
  }

  getGreen(): number {
    return this.green;
  }

  getBlue(): number {
    return this.blue;
  }

  getExt(): number {
    return this.ext;
  }

  /**
   * RGB 컴포넌트 설정
   */
  setRed(value: number): void {
    this.red = value & 0xff;
  }

  setGreen(value: number): void {
    this.green = value & 0xff;
  }

  setBlue(value: number): void {
    this.blue = value & 0xff;
  }

  setExt(value: number): void {
    this.ext = value & 0xff;
  }
}

/**
 * ENUMLIST 타입
 */
export interface EnumList {
  id: number;
  token: string;
}

/**
 * IDENUMLIST 타입
 */
export interface IdEnumList {
  hwpid: number;
  owpmlid: number;
}

