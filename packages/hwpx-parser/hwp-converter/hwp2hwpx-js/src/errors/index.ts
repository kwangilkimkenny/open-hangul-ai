/**
 * Custom Error Classes
 *
 * HWP 변환 과정에서 발생하는 에러를 구체적으로 분류
 *
 * @module Errors
 * @category Errors
 */

import type { ConversionStage } from '../core/ConversionOptions';

// Re-export from ConversionErrors
export {
    ConversionError,
    BufferUnderflowError,
    InvalidRecordError,
    InvalidIdReferenceError,
    UnsupportedFeatureError,
    ConversionContext,
    createContext,
    getGlobalContext,
    setGlobalContext,
    type DataLossLevel,
    type ConversionWarning as DetailedConversionWarning,
    type ConversionStatistics,
    type ConversionResult as DetailedConversionResult
} from './ConversionErrors';

/**
 * 기본 변환 에러
 */
export class HwpConversionError extends Error {
    constructor(
        message: string,
        public readonly stage?: ConversionStage,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'HwpConversionError';

        // ES5 호환을 위한 프로토타입 체인 유지
        Object.setPrototypeOf(this, HwpConversionError.prototype);
    }
}

/**
 * 파싱 에러 - HWP 파일 구조 파싱 실패
 */
export class HwpParseError extends HwpConversionError {
    constructor(
        message: string,
        public readonly offset?: number,
        cause?: Error
    ) {
        super(message, 'parsing', cause);
        this.name = 'HwpParseError';
        Object.setPrototypeOf(this, HwpParseError.prototype);
    }
}

/**
 * 유효성 검사 에러 - 잘못된 HWP 파일 형식
 */
export class HwpValidationError extends HwpConversionError {
    constructor(
        message: string,
        public readonly field?: string,
        cause?: Error
    ) {
        super(message, 'parsing', cause);
        this.name = 'HwpValidationError';
        Object.setPrototypeOf(this, HwpValidationError.prototype);
    }
}

/**
 * 지원하지 않는 기능 에러
 */
export class HwpUnsupportedError extends HwpConversionError {
    constructor(
        message: string,
        public readonly feature?: string,
        cause?: Error
    ) {
        super(message, undefined, cause);
        this.name = 'HwpUnsupportedError';
        Object.setPrototypeOf(this, HwpUnsupportedError.prototype);
    }
}

/**
 * 변환 취소 에러
 */
export class HwpAbortError extends HwpConversionError {
    constructor(stage?: ConversionStage) {
        super('Conversion aborted', stage);
        this.name = 'HwpAbortError';
        Object.setPrototypeOf(this, HwpAbortError.prototype);
    }
}

/**
 * 패키징 에러 - HWPX ZIP 생성 실패
 */
export class HwpPackagingError extends HwpConversionError {
    constructor(
        message: string,
        public readonly filePath?: string,
        cause?: Error
    ) {
        super(message, 'packaging', cause);
        this.name = 'HwpPackagingError';
        Object.setPrototypeOf(this, HwpPackagingError.prototype);
    }
}

/**
 * BinData 처리 에러
 */
export class HwpBinDataError extends HwpConversionError {
    constructor(
        message: string,
        public readonly binDataId?: number,
        cause?: Error
    ) {
        super(message, 'bindata', cause);
        this.name = 'HwpBinDataError';
        Object.setPrototypeOf(this, HwpBinDataError.prototype);
    }
}

/**
 * 섹션 처리 에러 - 특정 섹션만 실패
 */
export class HwpSectionError extends HwpConversionError {
    constructor(
        message: string,
        public readonly sectionIndex: number,
        cause?: Error
    ) {
        super(message, 'sections', cause);
        this.name = 'HwpSectionError';
        Object.setPrototypeOf(this, HwpSectionError.prototype);
    }
}

/**
 * 변환 경고 - 부분 실패 정보
 */
export interface ConversionWarning {
    type: 'section' | 'bindata' | 'control' | 'style';
    message: string;
    index?: number;
    recoveryAction?: string;
}

/**
 * 부분 성공 결과 - 일부 요소가 실패해도 변환 계속
 */
export interface PartialConversionResult {
    /** 변환된 HWPX 데이터 */
    data: Uint8Array;
    /** 성공 여부 (경고만 있으면 true) */
    success: boolean;
    /** 경고 목록 */
    warnings: ConversionWarning[];
    /** 실패한 섹션 인덱스 목록 */
    failedSections: number[];
    /** 실패한 BinData ID 목록 */
    failedBinData: number[];
    /** 총 섹션 수 */
    totalSections: number;
    /** 성공한 섹션 수 */
    successfulSections: number;
}

/**
 * 에러 타입 가드
 */
export function isHwpConversionError(error: unknown): error is HwpConversionError {
    return error instanceof HwpConversionError;
}

export function isHwpParseError(error: unknown): error is HwpParseError {
    return error instanceof HwpParseError;
}

export function isHwpAbortError(error: unknown): error is HwpAbortError {
    return error instanceof HwpAbortError;
}

export function isHwpSectionError(error: unknown): error is HwpSectionError {
    return error instanceof HwpSectionError;
}

