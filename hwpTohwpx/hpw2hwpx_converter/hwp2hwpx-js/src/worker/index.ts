/**
 * 웹 워커 모듈
 *
 * HWP → HWPX 변환을 백그라운드에서 실행하기 위한 웹 워커 지원
 *
 * @module Worker
 * @category Worker
 *
 * @example Usage in Browser
 * ```typescript
 * import { WorkerManager, isWorkerSupported } from 'hwp2hwpx-js/worker';
 *
 * if (isWorkerSupported()) {
 *     const manager = new WorkerManager('/path/to/converter.worker.js');
 *
 *     const result = await manager.convert(hwpData, {
 *         onProgress: (progress) => {
 *             updateProgressBar(progress.percent);
 *         }
 *     });
 *
 *     manager.terminate();
 * }
 * ```
 */

// Types
export type {
    WorkerRequest,
    WorkerResponse,
    ConvertRequest,
    AbortRequest,
    ProgressMessage,
    CompleteMessage,
    ErrorMessage,
    ReadyMessage
} from './types';

export { generateRequestId, isTransferable } from './types';

// Manager
export {
    WorkerManager,
    isWorkerSupported,
    getSharedWorkerManager,
    terminateSharedWorkerManager,
    type WorkerConversionOptions
} from './WorkerManager';
