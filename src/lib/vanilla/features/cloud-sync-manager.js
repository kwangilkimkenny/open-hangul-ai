/**
 * Cloud Sync Manager
 * Google Drive 동기화 기능
 * 
 * @module features/cloud-sync-manager
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('CloudSyncManager');

// Google Drive API 설정
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY'; // 사용자가 설정
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // 사용자가 설정
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

// 앱 폴더 이름
const APP_FOLDER_NAME = 'HWPX_AutoSave';

/**
 * 클라우드 동기화 관리자 클래스
 */
export class CloudSyncManager {
    constructor(autoSaveManager, options = {}) {
        this.autoSaveManager = autoSaveManager;
        this.options = {
            apiKey: options.apiKey || GOOGLE_API_KEY,
            clientId: options.clientId || GOOGLE_CLIENT_ID,
            autoSync: options.autoSync !== false, // 기본: true
            syncInterval: options.syncInterval || 60000, // 1분
            onAuth: options.onAuth || null,
            onSync: options.onSync || null,
            onError: options.onError || null
        };

        this.isAuthenticated = false;
        this.userInfo = null;
        this.appFolderId = null;
        this.syncTimer = null;
        this.lastSyncTime = null;
        this.isSyncing = false;
        
        // API 로드 상태
        this.gapiLoaded = false;
        this.gisLoaded = false;
        this.tokenClient = null;

        logger.info('☁️ CloudSyncManager initialized');
    }

    /**
     * Google API 라이브러리 로드
     */
    async loadGoogleAPIs() {
        if (this.gapiLoaded && this.gisLoaded) {
            return true;
        }

        try {
            // GAPI 로드
            await this._loadScript('https://apis.google.com/js/api.js');
            await new Promise((resolve) => {
                window.gapi.load('client', resolve);
            });
            
            await window.gapi.client.init({
                apiKey: this.options.apiKey,
                discoveryDocs: DISCOVERY_DOCS
            });
            
            this.gapiLoaded = true;
            logger.info('✅ GAPI loaded');

            // GIS (Google Identity Services) 로드
            await this._loadScript('https://accounts.google.com/gsi/client');
            
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: this.options.clientId,
                scope: SCOPES,
                callback: (response) => {
                    if (response.error) {
                        logger.error('Auth error:', response.error);
                        if (this.options.onError) {
                            this.options.onError(response.error);
                        }
                        return;
                    }
                    
                    this.isAuthenticated = true;
                    this._onAuthSuccess();
                }
            });
            
            this.gisLoaded = true;
            logger.info('✅ GIS loaded');

            return true;
        } catch (error) {
            logger.error('❌ Failed to load Google APIs:', error);
            return false;
        }
    }

    /**
     * 스크립트 로드 헬퍼
     * @private
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            // 이미 로드된 경우
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 인증 시작 (로그인)
     */
    async signIn() {
        if (!this.gapiLoaded || !this.gisLoaded) {
            const loaded = await this.loadGoogleAPIs();
            if (!loaded) {
                throw new Error('Google APIs not loaded');
            }
        }

        if (this.isAuthenticated) {
            logger.info('Already authenticated');
            return true;
        }

        try {
            // 토큰 요청
            this.tokenClient.requestAccessToken();
            return true;
        } catch (error) {
            logger.error('❌ Sign in failed:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
            return false;
        }
    }

    /**
     * 인증 성공 처리
     * @private
     */
    async _onAuthSuccess() {
        try {
            // 사용자 정보 가져오기
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`
                }
            });
            
            this.userInfo = await response.json();
            logger.info('✅ Authenticated:', this.userInfo.email);

            // 앱 폴더 생성/확인
            await this._ensureAppFolder();

            // 콜백 호출
            if (this.options.onAuth) {
                this.options.onAuth(this.userInfo);
            }

            // 자동 동기화 시작
            if (this.options.autoSync) {
                this.startAutoSync();
            }

        } catch (error) {
            logger.error('Failed to get user info:', error);
        }
    }

    /**
     * 로그아웃
     */
    signOut() {
        const token = window.gapi.client.getToken();
        if (token) {
            window.google.accounts.oauth2.revoke(token.access_token);
            window.gapi.client.setToken(null);
        }

        this.isAuthenticated = false;
        this.userInfo = null;
        this.stopAutoSync();

        logger.info('👋 Signed out');
    }

    /**
     * 앱 폴더 생성/확인
     * @private
     */
    async _ensureAppFolder() {
        try {
            // 기존 폴더 검색
            const response = await window.gapi.client.drive.files.list({
                q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (response.result.files.length > 0) {
                this.appFolderId = response.result.files[0].id;
                logger.info('📁 App folder found:', this.appFolderId);
            } else {
                // 폴더 생성
                const createResponse = await window.gapi.client.drive.files.create({
                    resource: {
                        name: APP_FOLDER_NAME,
                        mimeType: 'application/vnd.google-apps.folder'
                    },
                    fields: 'id'
                });

                this.appFolderId = createResponse.result.id;
                logger.info('📁 App folder created:', this.appFolderId);
            }
        } catch (error) {
            logger.error('Failed to ensure app folder:', error);
            throw error;
        }
    }

    /**
     * 파일 업로드 (동기화)
     * @param {string} fileName - 파일명
     * @param {Object} data - 데이터 객체
     */
    async uploadFile(fileName, data) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            const content = JSON.stringify(data);
            const blob = new Blob([content], { type: 'application/json' });

            // 기존 파일 확인
            const existingFile = await this._findFile(fileName);

            let fileId;
            if (existingFile) {
                // 업데이트
                const response = await this._updateFile(existingFile.id, blob);
                fileId = response.result.id;
                logger.info('📤 File updated:', fileName);
            } else {
                // 신규 생성
                const response = await this._createFile(fileName, blob);
                fileId = response.result.id;
                logger.info('📤 File uploaded:', fileName);
            }

            return fileId;
        } catch (error) {
            logger.error('❌ Upload failed:', error);
            throw error;
        }
    }

    /**
     * 파일 다운로드
     * @param {string} fileName - 파일명
     */
    async downloadFile(fileName) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            const file = await this._findFile(fileName);
            if (!file) {
                logger.warn('File not found:', fileName);
                return null;
            }

            const response = await window.gapi.client.drive.files.get({
                fileId: file.id,
                alt: 'media'
            });

            const data = JSON.parse(response.body);
            logger.info('📥 File downloaded:', fileName);
            return data;
        } catch (error) {
            logger.error('❌ Download failed:', error);
            throw error;
        }
    }

    /**
     * 파일 검색
     * @private
     */
    async _findFile(fileName) {
        const response = await window.gapi.client.drive.files.list({
            q: `name='${fileName}' and '${this.appFolderId}' in parents and trashed=false`,
            fields: 'files(id, name, modifiedTime)',
            spaces: 'drive'
        });

        return response.result.files[0] || null;
    }

    /**
     * 파일 생성
     * @private
     */
    async _createFile(fileName, blob) {
        const metadata = {
            name: fileName,
            parents: [this.appFolderId],
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`
                },
                body: form
            }
        );

        return { result: await response.json() };
    }

    /**
     * 파일 업데이트
     * @private
     */
    async _updateFile(fileId, blob) {
        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
                    'Content-Type': 'application/json'
                },
                body: blob
            }
        );

        return { result: await response.json() };
    }

    /**
     * 모든 파일 목록
     */
    async listFiles() {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            const response = await window.gapi.client.drive.files.list({
                q: `'${this.appFolderId}' in parents and trashed=false`,
                fields: 'files(id, name, modifiedTime, size)',
                orderBy: 'modifiedTime desc',
                spaces: 'drive'
            });

            return response.result.files || [];
        } catch (error) {
            logger.error('Failed to list files:', error);
            throw error;
        }
    }

    /**
     * 파일 삭제
     * @param {string} fileName - 파일명
     */
    async deleteFile(fileName) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            const file = await this._findFile(fileName);
            if (!file) {
                logger.warn('File not found:', fileName);
                return false;
            }

            await window.gapi.client.drive.files.delete({
                fileId: file.id
            });

            logger.info('🗑️ File deleted:', fileName);
            return true;
        } catch (error) {
            logger.error('Failed to delete file:', error);
            throw error;
        }
    }

    /**
     * 자동 동기화 시작
     */
    startAutoSync() {
        if (this.syncTimer) {
            logger.warn('Auto sync already started');
            return;
        }

        this.syncTimer = setInterval(async () => {
            await this.syncNow();
        }, this.options.syncInterval);

        logger.info(`✅ Auto sync started (interval: ${this.options.syncInterval}ms)`);
    }

    /**
     * 자동 동기화 중지
     */
    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            logger.info('⏸️ Auto sync stopped');
        }
    }

    /**
     * 즉시 동기화
     */
    async syncNow() {
        if (!this.isAuthenticated) {
            logger.warn('Cannot sync: not authenticated');
            return false;
        }

        if (this.isSyncing) {
            logger.warn('Sync already in progress');
            return false;
        }

        this.isSyncing = true;

        try {
            logger.info('🔄 Syncing...');

            // AutoSave 세션들 가져오기
            const sessions = await this.autoSaveManager.getSavedSessions();

            // 각 세션을 클라우드에 업로드
            let uploadCount = 0;
            for (const session of sessions) {
                const fileName = `${session.id}.json`;
                await this.uploadFile(fileName, session);
                uploadCount++;
            }

            this.lastSyncTime = Date.now();
            logger.info(`✅ Sync completed: ${uploadCount} files uploaded`);

            // 콜백 호출
            if (this.options.onSync) {
                this.options.onSync({
                    uploadCount,
                    timestamp: this.lastSyncTime
                });
            }

            return true;
        } catch (error) {
            logger.error('❌ Sync failed:', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
            return false;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * 클라우드에서 복원
     * @param {string} sessionId - 세션 ID
     */
    async restoreFromCloud(sessionId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            const fileName = `${sessionId}.json`;
            const session = await this.downloadFile(fileName);

            if (!session) {
                throw new Error('Session not found in cloud');
            }

            // AutoSave에 복원
            await this.autoSaveManager.restoreSession(session.id);

            logger.info('✅ Restored from cloud:', sessionId);
            return true;
        } catch (error) {
            logger.error('❌ Restore from cloud failed:', error);
            throw error;
        }
    }

    /**
     * 통계
     */
    async getStats() {
        if (!this.isAuthenticated) {
            return {
                isAuthenticated: false,
                userEmail: null,
                cloudFiles: 0,
                lastSyncTime: null
            };
        }

        try {
            const files = await this.listFiles();
            return {
                isAuthenticated: true,
                userEmail: this.userInfo?.email,
                cloudFiles: files.length,
                lastSyncTime: this.lastSyncTime,
                autoSyncEnabled: this.syncTimer !== null
            };
        } catch (error) {
            logger.error('Failed to get stats:', error);
            return {
                isAuthenticated: true,
                userEmail: this.userInfo?.email,
                cloudFiles: 0,
                lastSyncTime: this.lastSyncTime,
                error: error.message
            };
        }
    }

    /**
     * API 키 설정
     */
    setApiKey(apiKey) {
        this.options.apiKey = apiKey;
        localStorage.setItem('google-api-key', apiKey);
        logger.info('✅ API key updated');
    }

    /**
     * Client ID 설정
     */
    setClientId(clientId) {
        this.options.clientId = clientId;
        localStorage.setItem('google-client-id', clientId);
        logger.info('✅ Client ID updated');
    }

    /**
     * 저장된 설정 로드
     */
    loadSettings() {
        const apiKey = localStorage.getItem('google-api-key');
        const clientId = localStorage.getItem('google-client-id');

        if (apiKey) this.options.apiKey = apiKey;
        if (clientId) this.options.clientId = clientId;

        return {
            hasApiKey: !!apiKey,
            hasClientId: !!clientId
        };
    }

    /**
     * 충돌 감지 및 해결
     * @param {string} sessionId - 세션 ID
     */
    async detectAndResolveConflict(sessionId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            // 로컬 세션 가져오기
            const localSession = await this.autoSaveManager.getSession(sessionId);
            if (!localSession) {
                throw new Error('Local session not found');
            }

            // 클라우드 세션 가져오기
            const fileName = `${sessionId}.json`;
            const cloudFile = await this._findFile(fileName);
            
            if (!cloudFile) {
                // 클라우드에 없으면 충돌 없음
                return { hasConflict: false, local: localSession, cloud: null };
            }

            const cloudSession = await this.downloadFile(fileName);

            // 타임스탬프 비교
            const localTime = localSession.timestamp;
            const cloudTime = cloudSession.timestamp;

            if (localTime === cloudTime) {
                // 동일한 버전
                return { hasConflict: false, local: localSession, cloud: cloudSession };
            }

            // 충돌 발생
            logger.warn('⚠️ Conflict detected:', sessionId);
            return {
                hasConflict: true,
                local: localSession,
                cloud: cloudSession,
                localNewer: localTime > cloudTime,
                cloudNewer: cloudTime > localTime
            };

        } catch (error) {
            logger.error('Failed to detect conflict:', error);
            throw error;
        }
    }

    /**
     * 충돌 해결: 로컬 유지
     */
    async resolveConflictKeepLocal(sessionId) {
        try {
            const localSession = await this.autoSaveManager.getSession(sessionId);
            const fileName = `${sessionId}.json`;
            await this.uploadFile(fileName, localSession);
            logger.info('✅ Conflict resolved: kept local');
            return true;
        } catch (error) {
            logger.error('Failed to resolve conflict (keep local):', error);
            return false;
        }
    }

    /**
     * 충돌 해결: 클라우드 유지
     */
    async resolveConflictKeepCloud(sessionId) {
        try {
            const fileName = `${sessionId}.json`;
            const cloudSession = await this.downloadFile(fileName);
            
            // 로컬에 저장 (덮어쓰기)
            await this.autoSaveManager._saveToIndexedDB(cloudSession);
            
            logger.info('✅ Conflict resolved: kept cloud');
            return true;
        } catch (error) {
            logger.error('Failed to resolve conflict (keep cloud):', error);
            return false;
        }
    }

    /**
     * 충돌 해결: 둘 다 유지 (로컬을 복사본으로)
     */
    async resolveConflictKeepBoth(sessionId) {
        try {
            const localSession = await this.autoSaveManager.getSession(sessionId);
            
            // 로컬 세션을 새 ID로 복사
            const conflictSession = {
                ...localSession,
                id: `${sessionId}-conflict-${Date.now()}`,
                fileName: `${localSession.fileName} (충돌 사본)`
            };
            
            await this.autoSaveManager._saveToIndexedDB(conflictSession);
            
            // 클라우드 버전을 원본에 덮어쓰기
            await this.resolveConflictKeepCloud(sessionId);
            
            logger.info('✅ Conflict resolved: kept both');
            return true;
        } catch (error) {
            logger.error('Failed to resolve conflict (keep both):', error);
            return false;
        }
    }

    /**
     * 스마트 동기화 (충돌 자동 해결)
     */
    async smartSync() {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated');
        }

        try {
            logger.info('🔄 Smart sync started...');

            const sessions = await this.autoSaveManager.getSavedSessions();
            const conflicts = [];

            for (const session of sessions) {
                const result = await this.detectAndResolveConflict(session.id);
                
                if (result.hasConflict) {
                    conflicts.push({
                        sessionId: session.id,
                        fileName: session.fileName,
                        local: result.local,
                        cloud: result.cloud,
                        recommendation: result.localNewer ? 'local' : 'cloud'
                    });
                } else {
                    // 충돌 없으면 자동 업로드
                    await this.uploadFile(`${session.id}.json`, session);
                }
            }

            logger.info(`✅ Smart sync completed: ${conflicts.length} conflicts`);
            return {
                success: true,
                synced: sessions.length - conflicts.length,
                conflicts
            };

        } catch (error) {
            logger.error('❌ Smart sync failed:', error);
            throw error;
        }
    }

    /**
     * 정리
     */
    dispose() {
        this.stopAutoSync();
        this.signOut();
        logger.info('👋 CloudSyncManager disposed');
    }
}

export default CloudSyncManager;

