/**
 * useAutoSave Hook
 * 자동 저장 및 충돌 복구 기능을 위한 Hook
 * 
 * @module hooks/useAutoSave
 * @version 2.0.0
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDocumentStore } from '../stores/documentStore';
import { useUIStore } from '../stores/uiStore';
import { getLogger } from '../lib/utils/logger';
import type { HWPXDocument } from '../types/hwpx';

const logger = getLogger();

// IndexedDB 설정
const DB_NAME = 'HWPX_AutoSave';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const TEMP_STORAGE_KEY = 'hwpx-crash-recovery';
const META_STORAGE_KEY = 'hwpx-autosave-meta';

// 스토리지 쿼터 임계값
const QUOTA_WARNING_THRESHOLD = 10 * 1024 * 1024; // 10MB
const QUOTA_CRITICAL_THRESHOLD = 1 * 1024 * 1024;  // 1MB

// 싱글톤 패턴: 타이머는 한 번만 시작
let globalTimerId: number | null = null;
let initializationCount = 0;

/**
 * 자동 저장 세션 인터페이스
 */
export interface AutoSaveSession {
  id: string;
  fileName: string;
  timestamp: number;
  document: HWPXDocument;
  size: number;
  editCount?: number;
}

/**
 * 충돌 복구 정보 인터페이스
 */
export interface CrashRecoveryInfo {
  id: string;
  fileName: string;
  timestamp: number;
  isCrashRecovery?: boolean;
  isUnsaved?: boolean;
}

/**
 * 자동 저장 메타데이터 인터페이스
 */
interface AutoSaveMeta {
  currentSessionId: string | null;
  lastSaveTime: number | null;
  isDirty: boolean;
}

/**
 * 자동 저장 옵션 인터페이스
 */
export interface UseAutoSaveOptions {
  interval?: number;
  maxSessions?: number;
  maxAge?: number;
  enabled?: boolean;
  onSave?: (session: { sessionId: string; fileName: string; timestamp: number; size: number }) => void;
  onRestore?: (session: AutoSaveSession) => void;
}

/**
 * 자동 저장 통계 인터페이스
 */
export interface AutoSaveStats {
  sessionCount: number;
  totalSize: string;
  lastSaveTime: number | null;
  currentSessionId: string | null;
  isDirty: boolean;
  autoSaveEnabled: boolean;
}

export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const {
    interval = 30000, // 30초
    maxSessions = 10,
    maxAge = 7 * 24 * 60 * 60 * 1000, // 7일
    enabled = true,
    onSave,
    onRestore
  } = options;

  const { document, fileName, isDirty, setDirty, setDocument } = useDocumentStore();
  const { showToast } = useUIStore();

  const dbRef = useRef<IDBDatabase | null>(null);
  const timerRef = useRef<number | null>(null);
  const saveSessionRef = useRef<(() => Promise<string | null>) | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [sessions, setSessions] = useState<AutoSaveSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<CrashRecoveryInfo | null>(null);

  // IndexedDB 초기화
  const initDB = useCallback(async () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        logger.info('💾 IndexedDB opened');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('fileName', 'fileName', { unique: false });
          logger.info('📦 Object store created');
        }
      };
    });
  }, []);

  // 메타데이터 로드
  const loadMetadata = useCallback((): AutoSaveMeta | null => {
    try {
      const data = localStorage.getItem(META_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn('Failed to load metadata:', error);
    }
    return null;
  }, []);

  // 메타데이터 저장
  const saveMetadata = useCallback((meta: Partial<AutoSaveMeta>) => {
    try {
      const current = loadMetadata() || { currentSessionId: null, lastSaveTime: null, isDirty: false };
      const updated = { ...current, ...meta };
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      logger.error('Failed to save metadata:', error);
    }
  }, [loadMetadata]);

  // 스토리지 쿼터 확인
  const checkStorageQuota = useCallback(async (): Promise<{
    ok: boolean;
    warning: boolean;
    available: number;
  }> => {
    if (!navigator?.storage?.estimate) {
      logger.debug('Storage estimate API not available, skipping quota check');
      return { ok: true, warning: false, available: Infinity };
    }

    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const available = quota - usage;

      if (available < QUOTA_CRITICAL_THRESHOLD) {
        logger.error(
          `Storage quota critical: ${formatSize(available)} remaining (${formatSize(usage)} / ${formatSize(quota)})`
        );
        showToast('error', '저장 공간 부족', '저장 공간이 부족하여 자동 저장을 건너뜁니다. 불필요한 세션을 삭제해 주세요.');
        return { ok: false, warning: true, available };
      }

      if (available < QUOTA_WARNING_THRESHOLD) {
        logger.warn(
          `Storage quota low: ${formatSize(available)} remaining (${formatSize(usage)} / ${formatSize(quota)})`
        );
        showToast('warning', '저장 공간 부족 경고', `남은 저장 공간이 ${formatSize(available)}입니다.`);
        return { ok: true, warning: true, available };
      }

      return { ok: true, warning: false, available };
    } catch (error) {
      logger.warn('Failed to check storage quota:', error);
      return { ok: true, warning: false, available: Infinity };
    }
  }, [showToast]);

  // 세션 저장
  const saveSession = useCallback(async (name?: string): Promise<string | null> => {
    // isDirty가 false면 저장 안 함 (변경사항 없음)
    if (!isDirty && !name) return currentSessionId;
    
    if (!dbRef.current || !document) return null;

    try {
      // 스토리지 쿼터 확인
      const quotaStatus = await checkStorageQuota();
      if (!quotaStatus.ok) {
        logger.error('Auto-save skipped: insufficient storage space');
        return null;
      }

      // 세션 ID 생성/유지
      const sessionId = currentSessionId || `session-${Date.now()}`;
      
      // Map을 직렬화 가능한 형태로 변환
      const serializedDoc = {
        ...document,
        images: document.images ? Array.from(document.images.entries()) : [],
      };
      const documentJson = JSON.stringify(serializedDoc);
      
      // 기존 세션 조회 (editCount 증가용)
      let editCount = 0;
      try {
        const existingSession = await getSessionById(sessionId);
        if (existingSession) {
          editCount = existingSession.editCount || 0;
        }
      } catch {
        // 무시
      }

      const session: AutoSaveSession = {
        id: sessionId,
        fileName: name || fileName || '제목 없음',
        timestamp: Date.now(),
        document: JSON.parse(documentJson),
        size: documentJson.length,
        editCount: editCount + 1
      };

      const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const request = store.put(session);
        request.onsuccess = () => resolve();
        request.onerror = () => {
          const error = request.error;
          if (error?.name === 'QuotaExceededError') {
            logger.error('IndexedDB quota exceeded during save');
            showToast('error', '저장 실패', '저장 공간이 가득 찼습니다. 이전 세션을 삭제해 주세요.');
          }
          reject(error);
        };
      });

      setLastSaveTime(new Date());
      setCurrentSessionId(sessionId);
      setDirty(false);
      
      // 메타데이터 업데이트
      saveMetadata({
        currentSessionId: sessionId,
        lastSaveTime: session.timestamp,
        isDirty: false
      });

      logger.info(`💾 AutoSave: ${session.fileName} (${formatSize(session.size)})`);

      // 콜백 호출
      if (onSave) {
        onSave({
          sessionId: session.id,
          fileName: session.fileName,
          timestamp: session.timestamp,
          size: session.size
        });
      }

      // 세션 목록 업데이트
      await loadSessions();

      // 오래된 세션 정리
      await cleanupOldSessions();

      return sessionId;

    } catch (error) {
      logger.error('AutoSave failed:', error);
      return null;
    }
  }, [document, fileName, currentSessionId, isDirty, setDirty, onSave, saveMetadata, checkStorageQuota, showToast]);
  
  // saveSession을 ref에 저장 (타이머에서 안정적으로 사용)
  saveSessionRef.current = saveSession;

  // 세션 ID로 조회
  const getSessionById = useCallback(async (sessionId: string): Promise<AutoSaveSession | undefined> => {
    if (!dbRef.current) return undefined;

    return new Promise((resolve, reject) => {
      const transaction = dbRef.current!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sessionId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, []);

  // 세션 목록 로드
  const loadSessions = useCallback(async () => {
    if (!dbRef.current) return;

    try {
      const transaction = dbRef.current.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const allSessions = await new Promise<AutoSaveSession[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // 최신순 정렬
      allSessions.sort((a, b) => b.timestamp - a.timestamp);
      setSessions(allSessions);

    } catch (error) {
      logger.error('Failed to load sessions:', error);
    }
  }, []);

  // 세션 복원
  const restoreSession = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!dbRef.current) return false;

    try {
      const session = await getSessionById(sessionId);

      if (session) {
        // Map 복원
        const restoredDoc = {
          ...session.document,
          images: new Map(session.document.images || []),
        };
        
        setDocument(restoredDoc as HWPXDocument);
        setCurrentSessionId(sessionId);
        setLastSaveTime(new Date(session.timestamp));
        setDirty(false);
        
        saveMetadata({
          currentSessionId: sessionId,
          lastSaveTime: session.timestamp,
          isDirty: false
        });

        showToast('success', '복원 완료', `${session.fileName} 세션이 복원되었습니다.`);
        logger.info(`✅ Restored session: ${session.fileName}`);

        if (onRestore) {
          onRestore(session);
        }

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to restore session:', error);
      return false;
    }
  }, [getSessionById, setDocument, setDirty, showToast, onRestore, saveMetadata]);

  // 세션 삭제
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!dbRef.current) return;

    try {
      const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(sessionId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      await loadSessions();
      logger.info(`🗑️ Deleted session: ${sessionId}`);

    } catch (error) {
      logger.error('Failed to delete session:', error);
    }
  }, [loadSessions]);

  // 오래된 세션 정리
  const cleanupOldSessions = useCallback(async () => {
    if (!dbRef.current) return;

    try {
      const allSessions = await new Promise<AutoSaveSession[]>((resolve, reject) => {
        const transaction = dbRef.current!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // 최신순 정렬
      allSessions.sort((a, b) => b.timestamp - a.timestamp);

      // 최대 개수 초과 시 삭제
      if (allSessions.length > maxSessions) {
        const toDelete = allSessions.slice(maxSessions);
        for (const session of toDelete) {
          await deleteSession(session.id);
          logger.debug(`🗑️ Deleted old session: ${session.fileName}`);
        }
      }

      // 만료된 세션 삭제
      const now = Date.now();
      for (const session of allSessions) {
        if (now - session.timestamp > maxAge) {
          await deleteSession(session.id);
          logger.debug(`🗑️ Deleted expired session: ${session.fileName}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old sessions:', error);
    }
  }, [maxSessions, maxAge, deleteSession]);

  // 충돌 복구 감지
  const detectCrashRecovery = useCallback(async (): Promise<CrashRecoveryInfo | null> => {
    // 1. localStorage에서 임시 데이터 확인
    try {
      const tempData = localStorage.getItem(TEMP_STORAGE_KEY);
      if (tempData) {
        const session = JSON.parse(tempData) as { id: string; fileName: string; timestamp: number };
        
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
        localStorage.removeItem(TEMP_STORAGE_KEY);
      }
    } catch (error) {
      logger.error('Failed to detect crash recovery:', error);
    }

    // 2. 마지막 세션 확인 (비정상 종료)
    try {
      const meta = loadMetadata();
      if (meta && meta.isDirty && meta.currentSessionId) {
        const session = await getSessionById(meta.currentSessionId);
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
    } catch (error) {
      logger.error('Failed to check last session:', error);
    }

    return null;
  }, [loadMetadata, getSessionById]);

  // 충돌 복구 실행
  const performCrashRecovery = useCallback(async (): Promise<boolean> => {
    try {
      // localStorage에서 임시 데이터 가져오기
      const tempData = localStorage.getItem(TEMP_STORAGE_KEY);
      if (!tempData) {
        // 메타데이터에서 세션 ID 가져와서 복원 시도
        const meta = loadMetadata();
        if (meta?.currentSessionId) {
          return await restoreSession(meta.currentSessionId);
        }
        return false;
      }

      const sessionData = JSON.parse(tempData) as AutoSaveSession;
      
      // IndexedDB에 저장 (영구 보존)
      if (dbRef.current) {
        const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await new Promise<void>((resolve, reject) => {
          const request = store.put(sessionData);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      // 문서 복원 (Map 복원)
      const restoredDoc = {
        ...sessionData.document,
        images: new Map(sessionData.document.images || []),
      };
      
      setDocument(restoredDoc as HWPXDocument);
      setCurrentSessionId(sessionData.id);
      setLastSaveTime(new Date(sessionData.timestamp));
      setDirty(false);
      
      saveMetadata({
        currentSessionId: sessionData.id,
        lastSaveTime: sessionData.timestamp,
        isDirty: false
      });

      // 임시 데이터 삭제
      localStorage.removeItem(TEMP_STORAGE_KEY);

      logger.info('✅ Crash recovery completed');
      showToast('success', '복구 완료', '이전 작업 내용이 복구되었습니다.');

      return true;
    } catch (error) {
      logger.error('❌ Crash recovery failed:', error);
      return false;
    }
  }, [loadMetadata, restoreSession, setDocument, setDirty, showToast, saveMetadata]);

  // 긴급 저장 (페이지 종료 시)
  const emergencySave = useCallback(() => {
    if (!document) return;

    try {
      const sessionId = currentSessionId || `temp-${Date.now()}`;
      
      // Map을 직렬화 가능한 형태로 변환
      const serializedDoc = {
        ...document,
        images: document.images ? Array.from(document.images.entries()) : [],
      };
      
      const tempData = {
        id: sessionId,
        fileName: fileName || '제목 없음',
        timestamp: Date.now(),
        document: serializedDoc,
        size: JSON.stringify(serializedDoc).length
      };

      localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(tempData));
      saveMetadata({ isDirty: true });
      logger.info('💾 Emergency saved for crash recovery');
    } catch (error) {
      logger.error('Emergency save failed:', error);
    }
  }, [document, fileName, currentSessionId, saveMetadata]);

  // 새 세션 시작
  const startNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setLastSaveTime(null);
    saveMetadata({
      currentSessionId: null,
      lastSaveTime: null,
      isDirty: false
    });
    logger.info('🆕 New session started');
  }, [saveMetadata]);

  // 통계 조회
  const getStats = useCallback(async (): Promise<AutoSaveStats> => {
    const totalSize = sessions.reduce((sum, s) => sum + (s.size || 0), 0);
    
    return {
      sessionCount: sessions.length,
      totalSize: formatSize(totalSize),
      lastSaveTime: lastSaveTime?.getTime() || null,
      currentSessionId,
      isDirty,
      autoSaveEnabled: timerRef.current !== null
    };
  }, [sessions, lastSaveTime, currentSessionId, isDirty]);

  // 초기화
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      try {
        const db = await initDB();
        dbRef.current = db;
        setIsInitialized(true);
        await loadSessions();
        
        // 충돌 복구 감지
        const recovery = await detectCrashRecovery();
        if (recovery) {
          setRecoveryInfo(recovery);
        }

        logger.info('✅ AutoSave initialized');
      } catch (error) {
        logger.error('Failed to initialize AutoSave:', error);
      }
    };

    init();

    return () => {
      dbRef.current?.close();
    };
  }, [enabled, initDB, loadSessions, detectCrashRecovery]);

  // 자동 저장 타이머 (싱글톤 패턴)
  useEffect(() => {
    if (!enabled || !isInitialized) return;

    initializationCount++;
    const currentCount = initializationCount;
    
    // 전역 타이머가 이미 있으면 시작하지 않음
    if (globalTimerId !== null) {
      logger.debug(`⏰ Timer already running (ID: ${globalTimerId}), skipping...`);
      timerRef.current = globalTimerId;
      return;
    }

    // 새 타이머 시작 (전역)
    globalTimerId = window.setInterval(() => {
      // ref를 통해 최신 saveSession 호출 (의존성 문제 해결)
      if (saveSessionRef.current) {
        saveSessionRef.current();
      }
    }, interval);
    
    timerRef.current = globalTimerId;
    logger.info(`⏰ AutoSave timer started (ID: ${globalTimerId}, interval: ${interval}ms, init#${currentCount})`);

    return () => {
      // cleanup은 마지막 인스턴스만 수행
      if (timerRef.current !== null && timerRef.current === globalTimerId) {
        logger.debug(`⏰ AutoSave timer cleanup considered (ID: ${timerRef.current})`);
        // 타이머는 유지 (다른 컴포넌트가 사용 중일 수 있음)
      }
    };
  }, [enabled, isInitialized, interval]);

  // 페이지 종료 시 저장
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        emergencySave();
        e.preventDefault();
        e.returnValue = '저장되지 않은 변경사항이 있습니다.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, emergencySave]);

  return {
    // 상태
    isInitialized,
    lastSaveTime,
    sessions,
    currentSessionId,
    recoveryInfo,
    
    // 기본 동작
    saveNow: saveSession,
    restoreSession,
    deleteSession,
    loadSessions,
    
    // 세션 관리
    startNewSession,
    getStats,
    
    // 충돌 복구
    detectCrashRecovery,
    performCrashRecovery,
    clearRecoveryInfo: () => setRecoveryInfo(null),
    
    // 시간 포맷
    formatTimeAgo
  };
}

// 바이트 포맷
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 상대 시간 포맷
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
  
  return new Date(timestamp).toLocaleString('ko-KR');
}

export default useAutoSave;
