/**
 * HWP → HWPX 변환 웹 워커
 *
 * 메인 스레드를 차단하지 않고 백그라운드에서 변환 수행
 *
 * @module Worker
 * @category Worker
 */

import { Hwp2Hwpx } from '../core/Hwp2Hwpx';
import type {
    WorkerRequest,
    WorkerResponse,
    ProgressMessage,
    CompleteMessage,
    ErrorMessage,
    UnknownRequest
} from './types';

// Worker 컨텍스트에서 self 타입 지정
declare const self: DedicatedWorkerGlobalScope;

// 현재 처리 중인 요청 추적 (취소용)
const activeRequests = new Map<string, AbortController>();

/**
 * 워커 메시지 핸들러
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;

    switch (request.type) {
        case 'convert':
            await handleConvert(request.requestId, request.payload, request.options);
            break;

        case 'abort':
            handleAbort(request.requestId);
            break;

        default:
            sendError('unknown', `Unknown request type: ${(request as UnknownRequest).type}`);
    }
};

/**
 * 변환 처리
 */
async function handleConvert(
    requestId: string,
    payload: ArrayBuffer,
    options?: { compressionLevel?: number; previewMaxLength?: number }
): Promise<void> {
    // AbortController 생성
    const controller = new AbortController();
    activeRequests.set(requestId, controller);

    try {
        const data = new Uint8Array(payload);

        const result = await Hwp2Hwpx.convert(data, {
            ...options,
            signal: controller.signal,
            onProgress: (progress) => {
                sendProgress(requestId, progress);
            }
        });

        // 변환 완료 - Transferable로 전송
        const buffer = result.buffer as ArrayBuffer;
        const response: CompleteMessage = {
            type: 'complete',
            requestId,
            payload: buffer
        };

        self.postMessage(response, [buffer]);

    } catch (error) {
        const err = error as Error;
        sendError(requestId, err.message, err.name);
    } finally {
        activeRequests.delete(requestId);
    }
}

/**
 * 취소 처리
 */
function handleAbort(requestId: string): void {
    const controller = activeRequests.get(requestId);
    if (controller) {
        controller.abort();
        activeRequests.delete(requestId);
    }
}

/**
 * 진행률 메시지 전송
 */
function sendProgress(requestId: string, progress: import('../core/ConversionOptions').ConversionProgress): void {
    const response: ProgressMessage = {
        type: 'progress',
        requestId,
        progress
    };
    self.postMessage(response);
}

/**
 * 에러 메시지 전송
 */
function sendError(requestId: string, message: string, name?: string): void {
    const response: ErrorMessage = {
        type: 'error',
        requestId,
        message,
        name
    };
    self.postMessage(response);
}

// 워커 준비 완료 알림
self.postMessage({ type: 'ready' } as WorkerResponse);
