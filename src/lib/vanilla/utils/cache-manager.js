/**
 * Cache Manager
 * IndexedDB를 사용한 문서 캐싱
 * 
 * @module utils/cache-manager
 */

import { getLogger } from './logger.js';

const logger = getLogger();

const DB_NAME = 'HWPXViewerCache';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const MAX_CACHE_SIZE = 50; // 최대 50개 문서 캐시
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일

/**
 * Cache Manager 클래스
 */
export class CacheManager {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    /**
     * IndexedDB 초기화
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                logger.error('Failed to open IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                logger.info('Cache Manager initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('fileHash', 'fileHash', { unique: false });
                }
            };
        });
    }

    /**
     * 문서 캐시 저장
     * @param {string} fileHash - 파일 해시
     * @param {Object} document - 문서 데이터
     */
    async set(fileHash, document) {
        if (!this.initialized) {
            await this.initialize();
        }

        const entry = {
            id: fileHash,
            fileHash,
            document,
            timestamp: Date.now(),
            size: JSON.stringify(document).length
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onsuccess = async () => {
                logger.debug(`Cached document: ${fileHash}`);
                await this.cleanup(); // 오래된 캐시 정리
                resolve();
            };

            request.onerror = () => {
                logger.error('Failed to cache document');
                reject(request.error);
            };
        });
    }

    /**
     * 캐시에서 문서 가져오기
     * @param {string} fileHash
     * @returns {Promise<Object|null>}
     */
    async get(fileHash) {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(fileHash);

            request.onsuccess = () => {
                const entry = request.result;
                
                if (!entry) {
                    resolve(null);
                    return;
                }

                // TTL 체크
                if (Date.now() - entry.timestamp > CACHE_TTL) {
                    logger.debug(`Cache expired: ${fileHash}`);
                    this.delete(fileHash);
                    resolve(null);
                    return;
                }

                logger.debug(`Cache hit: ${fileHash}`);
                resolve(entry.document);
            };

            request.onerror = () => {
                logger.error('Failed to get cached document');
                reject(request.error);
            };
        });
    }

    /**
     * 캐시 삭제
     * @param {string} fileHash
     */
    async delete(fileHash) {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(fileHash);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 오래된 캐시 정리 (LRU)
     * @private
     */
    async cleanup() {
        if (!this.initialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            const request = index.openCursor();

            const entries = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    entries.push({
                        id: cursor.value.id,
                        timestamp: cursor.value.timestamp
                    });
                    cursor.continue();
                } else {
                    // 정렬 (오래된 것부터)
                    entries.sort((a, b) => a.timestamp - b.timestamp);

                    // MAX_CACHE_SIZE 초과 시 삭제
                    const toDelete = entries.slice(0, Math.max(0, entries.length - MAX_CACHE_SIZE));
                    
                    toDelete.forEach(entry => {
                        store.delete(entry.id);
                    });

                    if (toDelete.length > 0) {
                        logger.debug(`Cleaned up ${toDelete.length} old cache entries`);
                    }

                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 전체 캐시 삭제
     */
    async clear() {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                logger.info('Cache cleared');
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 캐시 통계
     * @returns {Promise<Object>}
     */
    async getStats() {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result;
                const totalSize = entries.reduce((sum, e) => sum + (e.size || 0), 0);

                resolve({
                    count: entries.length,
                    totalSize,
                    oldestTimestamp: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
                    newestTimestamp: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null
                });
            };

            request.onerror = () => reject(request.error);
        });
    }
}

/**
 * 파일 해시 생성 (간단한 버전)
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
export async function generateFileHash(buffer) {
    // Crypto API 사용
    if (crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback: 간단한 해시
    const bytes = new Uint8Array(buffer);
    let hash = 0;
    for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
        hash = ((hash << 5) - hash) + bytes[i];
        hash = hash & hash;
    }
    return hash.toString(36);
}

// Singleton
let cacheManagerInstance = null;

export function getCacheManager() {
    if (!cacheManagerInstance) {
        cacheManagerInstance = new CacheManager();
    }
    return cacheManagerInstance;
}

export default CacheManager;

