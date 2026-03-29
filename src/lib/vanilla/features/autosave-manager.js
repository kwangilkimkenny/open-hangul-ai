/**
 * AutoSave Manager
 * 자동 저장 및 충돌 복구 기능
 * 
 * @module features/autosave-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('AutoSaveManager');

// 설정
const DB_NAME = 'HWPX_AutoSave';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const DEFAULT_INTERVAL = 30000; // 30초
const MAX_SESSIONS = 10;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7일

// 스토리지 쿼터 임계값
const QUOTA_WARNING_THRESHOLD = 10 * 1024 * 1024; // 10MB
const QUOTA_CRITICAL_THRESHOLD = 1 * 1024 * 1024;  // 1MB

/**
 * 자동 저장 관리자 클래스
 */
export class AutoSaveManager {
    constructor(viewer, options = {}) {
        this.viewer = viewer;
        this.options = {
            interval: options.interval || DEFAULT_INTERVAL,
            maxSessions: options.maxSessions || MAX_SESSIONS,
            maxAge: options.maxAge || MAX_AGE,
            storageKey: options.storageKey || 'hwpx-autosave-meta',
            onSave: options.onSave || null,
            onRestore: options.onRestore || null
        };

        this.db = null;
        this.initialized = false;
        this.isDirty = false;
        this.autoSaveTimer = null;
        this.currentSessionId = null;
        this.lastSaveTime = null;
        this.isPageUnloading = false;

        logger.info('💾 AutoSaveManager initialized');
    }

    /**
     * IndexedDB 초기화
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        this._initPromise = (async () => {
            try {
                await this._openDatabase();
                await this._loadMetadata();
                this._setupUnloadHandler();
                this.initialized = true;
                logger.info('AutoSaveManager ready');
            } catch (error) {
                logger.error('Failed to initialize AutoSaveManager:', error);
                throw error;
            }
        })();

        return this._initPromise;
    }

    /**
     * 데이터베이스 열기
     * @private
     */
    _openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                logger.error('Failed to open IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                logger.info('📂 IndexedDB opened');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('fileName', 'fileName', { unique: false });
                    logger.info('📦 Object store created');
                }
            };
        });
    }

    /**
     * 메타데이터 로드
     * @private
     */
    async _loadMetadata() {
        try {
            const data = localStorage.getItem(this.options.storageKey);
            if (data) {
                const meta = JSON.parse(data);
                this.currentSessionId = meta.currentSessionId;
                this.lastSaveTime = meta.lastSaveTime;
                logger.info('📋 Metadata loaded');
            }
        } catch (error) {
            logger.warn('Failed to load metadata:', error);
        }
    }

    /**
     * 메타데이터 저장
     * @private
     */
    _saveMetadata() {
        try {
            const meta = {
                currentSessionId: this.currentSessionId,
                lastSaveTime: this.lastSaveTime,
                isDirty: this.isDirty
            };
            localStorage.setItem(this.options.storageKey, JSON.stringify(meta));
        } catch (error) {
            logger.error('Failed to save metadata:', error);
        }
    }

    /**
     * 페이지 종료 감지
     * @private
     */
    _setupUnloadHandler() {
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                // 저장되지 않은 변경사항이 있으면 경고
                const message = '저장되지 않은 변경사항이 있습니다. 정말 나가시겠습니까?';
                e.preventDefault();
                e.returnValue = message;
                
                // 마지막 저장 시도
                this.isPageUnloading = true;
                this._saveNowSync(); // 동기 저장
                
                return message;
            }
        });
    }

    /**
     * 자동 저장 활성화
     */
    enableAutoSave() {
        if (!this.initialized) {
            // 초기화 완료 후 자동 재시도 (IndexedDB async 대기)
            if (this._initPromise) {
                this._initPromise.then(() => this.enableAutoSave());
            }
            return;
        }

        if (this.autoSaveTimer) {
            logger.warn('AutoSave already enabled');
            return;
        }

        this.autoSaveTimer = setInterval(async () => {
            if (this.isDirty) {
                await this.saveNow();
            }
        }, this.options.interval);

        logger.info(`✅ AutoSave enabled (interval: ${this.options.interval}ms)`);
    }

    /**
     * 자동 저장 비활성화
     */
    disableAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
            logger.info('⏸️ AutoSave disabled');
        }
    }

    /**
     * 변경 플래그 설정
     */
    markDirty() {
        this.isDirty = true;
    }

    /**
     * 스토리지 쿼터 확인
     * @private
     * @returns {{ ok: boolean, warning: boolean, usage: number, quota: number, available: number }} 쿼터 상태
     */
    async _checkStorageQuota() {
        // navigator.storage.estimate()를 지원하지 않는 환경에서는 검사 건너뜀
        if (!navigator?.storage?.estimate) {
            logger.debug('Storage estimate API not available, skipping quota check');
            return { ok: true, warning: false, usage: 0, quota: 0, available: Infinity };
        }

        try {
            const { usage = 0, quota = 0 } = await navigator.storage.estimate();
            const available = quota - usage;

            if (available < QUOTA_CRITICAL_THRESHOLD) {
                logger.error(
                    `Storage quota critical: ${this._formatBytes(available)} remaining ` +
                    `(${this._formatBytes(usage)} / ${this._formatBytes(quota)})`
                );
                return { ok: false, warning: true, usage, quota, available };
            }

            if (available < QUOTA_WARNING_THRESHOLD) {
                logger.warn(
                    `Storage quota low: ${this._formatBytes(available)} remaining ` +
                    `(${this._formatBytes(usage)} / ${this._formatBytes(quota)})`
                );
                return { ok: true, warning: true, usage, quota, available };
            }

            return { ok: true, warning: false, usage, quota, available };
        } catch (error) {
            logger.warn('Failed to check storage quota:', error);
            // 쿼터 확인 실패 시에도 저장은 진행
            return { ok: true, warning: false, usage: 0, quota: 0, available: Infinity };
        }
    }

    /**
     * 지금 저장
     * @param {string} [name] - 세션 이름
     */
    async saveNow(name = null) {
        if (!this.initialized) {
            logger.error('AutoSaveManager not initialized');
            return null;
        }

        try {
            const document = this.viewer.getDocument();
            if (!document) {
                logger.warn('No document to save');
                return null;
            }

            // 스토리지 쿼터 확인
            const quotaStatus = await this._checkStorageQuota();
            if (!quotaStatus.ok) {
                logger.error('Auto-save skipped: insufficient storage space');
                return null;
            }
            if (quotaStatus.warning) {
                logger.warn(
                    `Storage space running low: ${this._formatBytes(quotaStatus.available)} remaining`
                );
            }

            // 세션 ID 생성 (현재 세션 없으면)
            if (!this.currentSessionId) {
                this.currentSessionId = `session-${Date.now()}`;
            }

            // 세션 데이터 생성
            const session = {
                id: this.currentSessionId,
                fileName: name || this._extractFileName(document) || '제목 없음',
                timestamp: Date.now(),
                document: JSON.parse(JSON.stringify(document)), // Deep clone
                size: JSON.stringify(document).length,
                editCount: (await this.getSession(this.currentSessionId))?.editCount || 0
            };
            
            session.editCount += 1;

            // IndexedDB에 저장
            await this._saveToIndexedDB(session);

            // 메타데이터 업데이트
            this.lastSaveTime = session.timestamp;
            this.isDirty = false;
            this._saveMetadata();

            logger.info(`💾 Saved: ${session.fileName} (${this._formatBytes(session.size)})`);

            // 콜백 호출
            if (this.options.onSave) {
                this.options.onSave({
                    sessionId: session.id,
                    fileName: session.fileName,
                    timestamp: session.timestamp,
                    size: session.size
                });
            }

            // 오래된 세션 정리
            await this._cleanupOldSessions();

            return session.id;
        } catch (error) {
            logger.error('❌ Failed to save:', error);
            return null;
        }
    }

    /**
     * 동기 저장 (페이지 종료 시)
     * @private
     */
    _saveNowSync() {
        try {
            const document = this.viewer.getDocument();
            if (!document) return;

            // localStorage에 임시 저장
            const tempData = {
                id: this.currentSessionId || `temp-${Date.now()}`,
                fileName: this._extractFileName(document) || '제목 없음',
                timestamp: Date.now(),
                document: JSON.parse(JSON.stringify(document))
            };

            localStorage.setItem('hwpx-temp-crash-recovery', JSON.stringify(tempData));
            logger.info('💾 Temp saved for crash recovery');
        } catch (error) {
            logger.error('Failed to sync save:', error);
        }
    }

    /**
     * IndexedDB에 저장
     * @private
     */
    _saveToIndexedDB(session) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(session);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                const error = request.error;
                // QuotaExceededError 처리
                if (error?.name === 'QuotaExceededError') {
                    logger.error('IndexedDB quota exceeded. Attempting cleanup before retry.');
                    this._cleanupOldSessions()
                        .then(() => {
                            // 정리 후 재시도
                            const retryTx = this.db.transaction([STORE_NAME], 'readwrite');
                            const retryStore = retryTx.objectStore(STORE_NAME);
                            const retryReq = retryStore.put(session);
                            retryReq.onsuccess = () => resolve();
                            retryReq.onerror = () => reject(retryReq.error);
                        })
                        .catch(() => reject(error));
                } else {
                    reject(error);
                }
            };
        });
    }

    /**
     * 세션 가져오기
     * @param {string} sessionId - 세션 ID
     */
    getSession(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(sessionId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 모든 세션 목록
     */
    async getSavedSessions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const sessions = request.result || [];
                // 최신순 정렬
                sessions.sort((a, b) => b.timestamp - a.timestamp);
                resolve(sessions);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 세션 복원
     * @param {string} sessionId - 세션 ID
     */
    async restoreSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                logger.error('Session not found:', sessionId);
                return false;
            }

            // 문서 복원
            this.viewer.updateDocument(session.document);
            
            // 현재 세션으로 설정
            this.currentSessionId = sessionId;
            this.lastSaveTime = session.timestamp;
            this.isDirty = false;
            this._saveMetadata();

            logger.info(`✅ Restored: ${session.fileName}`);

            // 콜백 호출
            if (this.options.onRestore) {
                this.options.onRestore(session);
            }

            return true;
        } catch (error) {
            logger.error('❌ Failed to restore:', error);
            return false;
        }
    }

    /**
     * 세션 삭제
     * @param {string} sessionId - 세션 ID
     */
    async deleteSession(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(sessionId);

            request.onsuccess = () => {
                logger.info('🗑️ Session deleted:', sessionId);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 충돌 복구 감지
     */
    async detectCrashRecovery() {
        // 1. localStorage에서 임시 데이터 확인
        try {
            const tempData = localStorage.getItem('hwpx-temp-crash-recovery');
            if (tempData) {
                const session = JSON.parse(tempData);
                
                // 5분 이내면 충돌로 간주
                const age = Date.now() - session.timestamp;
                if (age < 5 * 60 * 1000) {
                    logger.info('💥 Crash detected, recovery available');
                    return {
                        id: session.id,
                        fileName: session.fileName,
                        timestamp: session.timestamp,
                        isCrashRecovery: true
                    };
                }
                
                // 오래되면 삭제
                localStorage.removeItem('hwpx-temp-crash-recovery');
            }
        } catch (error) {
            logger.error('Failed to detect crash recovery:', error);
        }

        // 2. 마지막 세션 확인 (비정상 종료)
        try {
            const meta = localStorage.getItem(this.options.storageKey);
            if (meta) {
                const data = JSON.parse(meta);
                if (data.isDirty && data.currentSessionId) {
                    const session = await this.getSession(data.currentSessionId);
                    if (session) {
                        logger.info('🔄 Unsaved session detected');
                        return {
                            id: session.id,
                            fileName: session.fileName,
                            timestamp: session.timestamp,
                            isUnsaved: true
                        };
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to check last session:', error);
        }

        return null;
    }

    /**
     * 충돌 복구 실행
     */
    async performCrashRecovery() {
        try {
            // localStorage에서 임시 데이터 가져오기
            const tempData = localStorage.getItem('hwpx-temp-crash-recovery');
            if (!tempData) {
                return false;
            }

            const session = JSON.parse(tempData);
            
            // IndexedDB에 저장 (영구 보존)
            await this._saveToIndexedDB(session);
            
            // 문서 복원
            this.viewer.updateDocument(session.document);
            this.currentSessionId = session.id;
            this.lastSaveTime = session.timestamp;
            this.isDirty = false;
            this._saveMetadata();

            // 임시 데이터 삭제
            localStorage.removeItem('hwpx-temp-crash-recovery');

            logger.info('✅ Crash recovery completed');
            return true;
        } catch (error) {
            logger.error('❌ Crash recovery failed:', error);
            return false;
        }
    }

    /**
     * 오래된 세션 정리
     * @private
     */
    async _cleanupOldSessions() {
        try {
            const sessions = await this.getSavedSessions();
            
            // 최대 개수 초과 시 오래된 것 삭제
            if (sessions.length > this.options.maxSessions) {
                const toDelete = sessions.slice(this.options.maxSessions);
                for (const session of toDelete) {
                    await this.deleteSession(session.id);
                    logger.debug(`  🗑️ Deleted old session: ${session.fileName}`);
                }
            }

            // 오래된 세션 삭제 (maxAge 초과)
            const now = Date.now();
            for (const session of sessions) {
                if (now - session.timestamp > this.options.maxAge) {
                    await this.deleteSession(session.id);
                    logger.debug(`  🗑️ Deleted expired session: ${session.fileName}`);
                }
            }
        } catch (error) {
            logger.error('Failed to cleanup:', error);
        }
    }

    /**
     * 파일명 추출
     * @private
     */
    _extractFileName(document) {
        try {
            // 문서 제목 추출 시도
            const firstSection = document.sections?.[0];
            if (firstSection) {
                // 첫 번째 테이블의 "놀이명" 찾기
                const table = firstSection.elements?.find(e => e.type === 'table');
                if (table && table.rows) {
                    for (const row of table.rows) {
                        for (const cell of row.cells || []) {
                            const text = this._extractCellText(cell);
                            if (text && text.length < 50 && text.length > 0) {
                                // "놀이명" 다음 셀의 내용 반환
                                const nextCell = row.cells[row.cells.indexOf(cell) + 1];
                                if (nextCell) {
                                    const title = this._extractCellText(nextCell);
                                    if (title) return title;
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.debug('Failed to extract file name:', error);
        }
        return null;
    }

    /**
     * 셀 텍스트 추출
     * @private
     */
    _extractCellText(cell) {
        if (!cell || !cell.elements) return '';
        
        let text = '';
        for (const element of cell.elements) {
            if (element.type === 'paragraph' && element.runs) {
                for (const run of element.runs) {
                    if (run.text) {
                        text += run.text;
                    }
                }
            }
        }
        return text.trim();
    }

    /**
     * 바이트 포맷
     * @private
     */
    _formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * 시간 포맷 (상대 시간)
     */
    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return '방금 전';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
        
        return new Date(timestamp).toLocaleString('ko-KR');
    }

    /**
     * 통계
     */
    async getStats() {
        const sessions = await this.getSavedSessions();
        const totalSize = sessions.reduce((sum, s) => sum + (s.size || 0), 0);
        
        return {
            sessionCount: sessions.length,
            totalSize: this._formatBytes(totalSize),
            lastSaveTime: this.lastSaveTime,
            currentSessionId: this.currentSessionId,
            isDirty: this.isDirty,
            autoSaveEnabled: this.autoSaveTimer !== null
        };
    }

    /**
     * 새 세션 시작
     */
    startNewSession() {
        this.currentSessionId = null;
        this.isDirty = false;
        this.lastSaveTime = null;
        this._saveMetadata();
        logger.info('🆕 New session started');
    }

    /**
     * 정리
     */
    dispose() {
        this.disableAutoSave();
        if (this.db) {
            this.db.close();
        }
        logger.info('👋 AutoSaveManager disposed');
    }
}

export default AutoSaveManager;

