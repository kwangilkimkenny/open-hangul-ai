/**
 * Worker Manager
 * Web Worker 관리 및 통신을 담당
 * 
 * @module core/worker-manager
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Worker Manager 클래스
 * Web Worker 생성, 통신, 종료를 관리
 */
export class WorkerManager {
    constructor() {
        this.worker = null;
        this.callbacks = new Map();
        this.requestId = 0;
        this.isReady = false;
    }

    /**
     * Worker 초기화
     * @param {string} workerPath - Worker 스크립트 경로
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.worker) {
            logger.warn('Worker already initialized');
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                this.worker = new Worker(
                    new URL('../workers/parser.worker.js', import.meta.url),
                    { type: 'module' }
                );
                
                this.worker.addEventListener('message', (event) => {
                    this.handleMessage(event.data);
                });

                this.worker.addEventListener('error', (error) => {
                    logger.error('Worker error:', error);
                    reject(error);
                });

                // Wait for READY message
                const readyCallback = (data) => {
                    if (data.type === 'READY') {
                        this.isReady = true;
                        logger.info('Worker ready');
                        resolve();
                    }
                };

                this.callbacks.set('__ready__', { resolve: readyCallback, reject });
                
                // Timeout
                setTimeout(() => {
                    if (!this.isReady) {
                        reject(new Error('Worker initialization timeout'));
                    }
                }, 5000);

            } catch (error) {
                logger.error('Failed to create worker:', error);
                reject(error);
            }
        });
    }

    /**
     * Worker에 메시지 전송 (Promise 기반)
     * @param {string} type - 메시지 타입
     * @param {Object} payload - 페이로드
     * @param {Function} onProgress - 진행률 콜백
     * @returns {Promise<any>}
     */
    async sendMessage(type, payload, onProgress = null) {
        if (!this.worker || !this.isReady) {
            throw new Error('Worker not initialized');
        }

        const id = `req_${++this.requestId}`;

        return new Promise((resolve, reject) => {
            this.callbacks.set(id, { resolve, reject, onProgress });

            this.worker.postMessage({
                type,
                payload,
                id
            });

            // Timeout (30초)
            setTimeout(() => {
                if (this.callbacks.has(id)) {
                    this.callbacks.delete(id);
                    reject(new Error('Worker request timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Worker 메시지 핸들러
     * @param {Object} data - 메시지 데이터
     * @private
     */
    handleMessage(data) {
        const { type, id } = data;

        // READY 메시지 처리
        if (type === 'READY') {
            const callback = this.callbacks.get('__ready__');
            if (callback) {
                callback.resolve(data);
                this.callbacks.delete('__ready__');
            }
            return;
        }

        const callback = this.callbacks.get(id);
        if (!callback) {
            logger.warn('No callback found for request:', id);
            return;
        }

        switch (type) {
        case 'PROGRESS':
            if (callback.onProgress) {
                callback.onProgress(data.progress);
            }
            break;

        case 'PARSE_COMPLETE':
            this.callbacks.delete(id);
            callback.resolve(data.result);
            break;

        case 'ERROR': {
            this.callbacks.delete(id);
            const error = new Error(data.error.message);
            error.stack = data.error.stack;
            callback.reject(error);
            break;
        }

        case 'CANCELLED':
            this.callbacks.delete(id);
            callback.reject(new Error('Request cancelled'));
            break;

        default:
            logger.warn('Unknown message type:', type);
        }
    }

    /**
     * HWPX 파싱 (Worker에서 실행)
     * @param {ArrayBuffer} buffer - HWPX 파일 버퍼
     * @param {Function} onProgress - 진행률 콜백
     * @returns {Promise<Object>} 파싱된 문서
     */
    async parseHWPX(buffer, onProgress = null) {
        logger.time('Worker Parse');
        
        try {
            const result = await this.sendMessage('PARSE_HWPX', { buffer }, onProgress);
            logger.timeEnd('Worker Parse');
            return result;
        } catch (error) {
            logger.timeEnd('Worker Parse');
            throw error;
        }
    }

    /**
     * Worker 종료
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
            this.callbacks.clear();
            logger.info('Worker terminated');
        }
    }

    /**
     * Worker가 사용 가능한지 확인
     * @returns {boolean}
     */
    static isSupported() {
        return typeof Worker !== 'undefined';
    }
}

// Singleton instance
let workerManagerInstance = null;

/**
 * Worker Manager 인스턴스 가져오기
 * @returns {WorkerManager}
 */
export function getWorkerManager() {
    if (!workerManagerInstance) {
        workerManagerInstance = new WorkerManager();
    }
    return workerManagerInstance;
}

export default WorkerManager;

