/**
 * 웹 워커 메시지 타입 정의
 *
 * 메인 스레드와 워커 간의 통신 프로토콜
 *
 * @module Worker
 * @category Worker
 */

import type { ConversionProgress, ConversionOptions } from '../core/ConversionOptions';

// ============================================
// 메인 → 워커 메시지
// ============================================

/**
 * 변환 요청 메시지
 */
export interface ConvertRequest {
    type: 'convert';
    /** HWP 파일 바이너리 (Transferable) */
    payload: ArrayBuffer;
    /** 변환 옵션 (signal 제외) */
    options?: Omit<ConversionOptions, 'signal' | 'onProgress'>;
    /** 요청 ID (응답 매칭용) */
    requestId: string;
}

/**
 * 취소 요청 메시지
 */
export interface AbortRequest {
    type: 'abort';
    /** 취소할 요청 ID */
    requestId: string;
}

/**
 * 알 수 없는 요청 메시지 (확장 가능성 대비)
 */
export interface UnknownRequest {
    type: string;
    requestId?: string;
    [key: string]: unknown;
}

/**
 * 워커로 보내는 메시지 타입
 */
export type WorkerRequest = ConvertRequest | AbortRequest;

// ============================================
// 워커 → 메인 메시지
// ============================================

/**
 * 진행률 메시지
 */
export interface ProgressMessage {
    type: 'progress';
    /** 요청 ID */
    requestId: string;
    /** 진행 상태 */
    progress: ConversionProgress;
}

/**
 * 완료 메시지
 */
export interface CompleteMessage {
    type: 'complete';
    /** 요청 ID */
    requestId: string;
    /** HWPX 파일 바이너리 (Transferable) */
    payload: ArrayBuffer;
}

/**
 * 에러 메시지
 */
export interface ErrorMessage {
    type: 'error';
    /** 요청 ID */
    requestId: string;
    /** 에러 메시지 */
    message: string;
    /** 에러 이름 */
    name?: string;
}

/**
 * 워커 준비 완료 메시지
 */
export interface ReadyMessage {
    type: 'ready';
}

/**
 * 워커에서 보내는 메시지 타입
 */
export type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage | ReadyMessage;

// ============================================
// 유틸리티 타입
// ============================================

// 요청 ID 생성은 util/IdGenerator에서 가져옴
export { generateRequestId } from '../util/IdGenerator';

/**
 * Transferable 객체인지 확인
 */
export function isTransferable(obj: unknown): obj is ArrayBuffer {
    return obj instanceof ArrayBuffer;
}
