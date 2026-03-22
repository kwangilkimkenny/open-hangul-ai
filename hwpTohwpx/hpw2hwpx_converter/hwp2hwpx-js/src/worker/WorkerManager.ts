/**
 * 웹 워커 관리자
 *
 * 워커 생성, 통신, 생명주기 관리를 위한 고수준 API
 *
 * @module Worker
 * @category Worker
 */

import type {
    WorkerResponse,
    ConvertRequest,
    AbortRequest
} from './types';
import { generateRequestId } from './types';
import type { ConversionProgress } from '../core/ConversionOptions';
import { Logger } from '../util/Logger';

/**
 * 워커 변환 옵션 (메인 스레드용)
 */
export interface WorkerConversionOptions {
    /** 진행률 콜백 */
    onProgress?: (progress: ConversionProgress) => void;
    /** 압축 레벨 (0-9) */
    compressionLevel?: number;
    /** 미리보기 최대 길이 */
    previewMaxLength?: number;
    /** 타임아웃 (ms) */
    timeout?: number;
}

/**
 * 대기 중인 요청 정보
 */
interface PendingRequest {
    resolve: (result: Uint8Array) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: ConversionProgress) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * 웹 워커 관리자
 *
 * @example
 * ```typescript
 * // 워커 URL 직접 지정
 * const manager = new WorkerManager('/worker/converter.worker.js');
 *
 * // 변환 실행
 * const result = await manager.convert(hwpData, {
 *     onProgress: (progress) => console.log(progress.percent)
 * });
 *
 * // 사용 완료 후 정리
 * manager.terminate();
 * ```
 */
export class WorkerManager {
    private worker: Worker | null = null;
    private workerUrl: string | URL;
    private pendingRequests = new Map<string, PendingRequest>();
    private isReady = false;
    private readyPromise: Promise<void> | null = null;

    /**
     * WorkerManager 생성
     *
     * @param workerUrl - 워커 스크립트 URL
     */
    constructor(workerUrl: string | URL) {
        this.workerUrl = workerUrl;
    }

    /**
     * 워커 초기화
     */
    private async ensureWorker(): Promise<void> {
        if (this.worker && this.isReady) {
            return;
        }

        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = new Promise((resolve, reject) => {
            try {
                this.worker = new Worker(this.workerUrl, { type: 'module' });

                const onReady = (event: MessageEvent<WorkerResponse>) => {
                    if (event.data.type === 'ready') {
                        this.isReady = true;
                        this.worker!.removeEventListener('message', onReady);
                        resolve();
                    }
                };

                this.worker.addEventListener('message', onReady);
                this.worker.addEventListener('message', this.handleMessage.bind(this));
                this.worker.addEventListener('error', this.handleError.bind(this));

                // 5초 타임아웃
                setTimeout(() => {
                    if (!this.isReady) {
                        reject(new Error('Worker initialization timeout'));
                    }
                }, 5000);

            } catch (error) {
                reject(error);
            }
        });

        return this.readyPromise;
    }

    /**
     * 워커 메시지 핸들러
     */
    private handleMessage(event: MessageEvent<WorkerResponse>): void {
        const response = event.data;

        if (response.type === 'ready') {
            return; // 이미 처리됨
        }

        const requestId = 'requestId' in response ? response.requestId : null;
        if (!requestId) return;

        const pending = this.pendingRequests.get(requestId);
        if (!pending) return;

        switch (response.type) {
            case 'progress':
                pending.onProgress?.(response.progress);
                break;

            case 'complete':
                if (pending.timeoutId) {
                    clearTimeout(pending.timeoutId);
                }
                this.pendingRequests.delete(requestId);
                pending.resolve(new Uint8Array(response.payload));
                break;

            case 'error': {
                if (pending.timeoutId) {
                    clearTimeout(pending.timeoutId);
                }
                this.pendingRequests.delete(requestId);
                const error = new Error(response.message);
                error.name = response.name || 'WorkerError';
                pending.reject(error);
                break;
            }
        }
    }

    /**
     * 워커 에러 핸들러
     */
    private handleError(event: ErrorEvent): void {
        Logger.error(`Worker error: ${event.message}`);

        // 모든 대기 중인 요청에 에러 전파
        for (const [, pending] of this.pendingRequests) {
            if (pending.timeoutId) {
                clearTimeout(pending.timeoutId);
            }
            pending.reject(new Error(`Worker error: ${event.message}`));
        }
        this.pendingRequests.clear();
    }

    /**
     * HWP → HWPX 변환 (워커에서 실행)
     *
     * @param data - HWP 파일 바이너리
     * @param options - 변환 옵션
     * @returns HWPX 파일 바이너리
     */
    async convert(data: Uint8Array, options?: WorkerConversionOptions): Promise<Uint8Array> {
        await this.ensureWorker();

        const requestId = generateRequestId();
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

        return new Promise((resolve, reject) => {
            const pending: PendingRequest = {
                resolve,
                reject,
                onProgress: options?.onProgress
            };

            // 타임아웃 설정
            if (options?.timeout) {
                pending.timeoutId = setTimeout(() => {
                    this.pendingRequests.delete(requestId);
                    this.abort(requestId);
                    reject(new Error('Conversion timeout'));
                }, options.timeout);
            }

            this.pendingRequests.set(requestId, pending);

            const request: ConvertRequest = {
                type: 'convert',
                requestId,
                payload: buffer,
                options: {
                    compressionLevel: options?.compressionLevel,
                    previewMaxLength: options?.previewMaxLength
                }
            };

            // Transferable로 전송 (메모리 효율)
            this.worker!.postMessage(request, [buffer]);
        });
    }

    /**
     * 변환 취소
     *
     * @param requestId - 취소할 요청 ID
     */
    abort(requestId: string): void {
        if (!this.worker) return;

        const request: AbortRequest = {
            type: 'abort',
            requestId
        };

        this.worker.postMessage(request);
    }

    /**
     * 워커 종료
     */
    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
            this.readyPromise = null;
        }

        // 대기 중인 요청 정리
        for (const [, pending] of this.pendingRequests) {
            if (pending.timeoutId) {
                clearTimeout(pending.timeoutId);
            }
            pending.reject(new Error('Worker terminated'));
        }
        this.pendingRequests.clear();
    }

    /**
     * 워커 활성 상태 확인
     */
    get isActive(): boolean {
        return this.worker !== null && this.isReady;
    }

    /**
     * 대기 중인 요청 수
     */
    get pendingCount(): number {
        return this.pendingRequests.size;
    }
}

/**
 * 워커 지원 여부 확인
 */
export function isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined';
}

/**
 * 싱글톤 워커 관리자 팩토리
 */
let sharedManager: WorkerManager | null = null;

/**
 * 공유 워커 관리자 가져오기
 *
 * @param workerUrl - 워커 스크립트 URL
 * @returns 공유 WorkerManager 인스턴스
 */
export function getSharedWorkerManager(workerUrl: string | URL): WorkerManager {
    if (!sharedManager) {
        sharedManager = new WorkerManager(workerUrl);
    }
    return sharedManager;
}

/**
 * 공유 워커 관리자 종료
 */
export function terminateSharedWorkerManager(): void {
    if (sharedManager) {
        sharedManager.terminate();
        sharedManager = null;
    }
}
