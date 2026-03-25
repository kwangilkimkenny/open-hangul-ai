/**
 * HWP → HWPX 변환 옵션 정의
 *
 * 메모리 최적화, 진행률 콜백 등 변환 동작을 제어하는 옵션
 *
 * @module Core
 * @category Core
 */

/**
 * 변환 진행 상태
 */
export interface ConversionProgress {
    /** 현재 단계 */
    stage: ConversionStage;

    /** 전체 진행률 (0-100) */
    percent: number;

    /** 현재 처리 중인 항목 설명 */
    message: string;

    /** 현재 단계 내 세부 진행률 (0-100) */
    stagePercent?: number;

    /** 처리된 바이트 수 */
    bytesProcessed?: number;

    /** 전체 바이트 수 */
    totalBytes?: number;
}

/**
 * 변환 단계 열거형
 */
export type ConversionStage =
    | 'parsing'      // HWP 파싱 중
    | 'docinfo'      // DocInfo 처리 중
    | 'sections'     // 섹션 변환 중
    | 'bindata'      // 바이너리 데이터 처리 중
    | 'packaging'    // ZIP 패키징 중
    | 'complete';    // 완료

/**
 * 진행률 콜백 함수 타입
 */
export type ProgressCallback = (progress: ConversionProgress) => void;

/**
 * 변환 옵션 인터페이스
 *
 * @example
 * ```typescript
 * const options: ConversionOptions = {
 *     // 진행률 콜백
 *     onProgress: (progress) => {
 *         console.log(`${progress.stage}: ${progress.percent}%`);
 *     },
 *
 *     // 메모리 최적화 활성화
 *     streaming: true,
 *
 *     // 대용량 BinData 청크 처리
 *     chunkSize: 1024 * 1024  // 1MB
 * };
 *
 * const result = await Hwp2Hwpx.convert(hwpData, options);
 * ```
 */
export interface ConversionOptions {
    /**
     * 진행률 콜백 함수
     * 변환 진행 상태를 실시간으로 받아볼 수 있음
     */
    onProgress?: ProgressCallback;

    /**
     * 스트리밍 모드 활성화
     * true: 메모리 최적화 모드 (대용량 파일에 적합)
     * false: 일반 모드 (기본값, 소규모 파일에 적합)
     *
     * @default false
     */
    streaming?: boolean;

    /**
     * 청크 크기 (바이트)
     * 대용량 BinData 처리 시 사용
     *
     * @default 1048576 (1MB)
     */
    chunkSize?: number;

    /**
     * 미리보기 텍스트 최대 길이
     *
     * @default 1000
     */
    previewMaxLength?: number;

    /**
     * 압축 레벨 (0-9)
     * 0: 무압축, 9: 최대 압축
     *
     * @default 6
     */
    compressionLevel?: number;

    /**
     * 취소 토큰
     * AbortController.signal을 전달하여 변환 중단 가능
     */
    signal?: AbortSignal;
}

/**
 * 기본 변환 옵션
 */
export const DEFAULT_CONVERSION_OPTIONS: Required<Omit<ConversionOptions, 'onProgress' | 'signal'>> = {
    streaming: false,
    chunkSize: 1024 * 1024,  // 1MB
    previewMaxLength: 1000,
    compressionLevel: 6,
};

/**
 * 옵션 병합 유틸리티
 */
export function mergeOptions(options?: ConversionOptions): ConversionOptions & typeof DEFAULT_CONVERSION_OPTIONS {
    return {
        ...DEFAULT_CONVERSION_OPTIONS,
        ...options,
    };
}
