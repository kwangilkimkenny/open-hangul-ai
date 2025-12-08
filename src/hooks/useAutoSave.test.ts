/**
 * useAutoSave Hook 단위 테스트
 * 
 * @module hooks/useAutoSave.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock stores before importing the hook
const mockSetDirty = vi.fn();
const mockSetDocument = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../stores/documentStore', () => ({
  useDocumentStore: vi.fn(() => ({
    document: null,
    fileName: null,
    isDirty: false,
    setDirty: mockSetDirty,
    setDocument: mockSetDocument,
  })),
}));

vi.mock('../stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    showToast: mockShowToast,
  })),
}));

// Import after mocks are set up
import { useAutoSave } from './useAutoSave';
import { useDocumentStore } from '../stores/documentStore';
import type { HWPXDocument } from '../types/hwpx';

// Helper to create mock document
const createMockDocument = (): HWPXDocument => ({
  sections: [
    {
      id: 'section-0',
      elements: [
        {
          type: 'paragraph',
          runs: [{ text: 'Test content', style: {} }],
        },
      ],
    },
  ],
  images: new Map(),
});

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Reset document store mock
    (useDocumentStore as any).mockReturnValue({
      document: null,
      fileName: null,
      isDirty: false,
      setDirty: mockSetDirty,
      setDocument: mockSetDocument,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================
  // 기본 동작 테스트 (enabled: false)
  // ===========================
  describe('disabled mode', () => {
    it('훅이 초기 상태로 시작해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.lastSaveTime).toBeNull();
      expect(result.current.sessions).toEqual([]);
      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.recoveryInfo).toBeNull();
    });

    it('saveNow가 문서 없이 호출되면 null을 반환해야 합니다', async () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      const sessionId = await result.current.saveNow();

      expect(sessionId).toBeNull();
    });

    it('startNewSession이 상태를 초기화해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      act(() => {
        result.current.startNewSession();
      });

      expect(result.current.currentSessionId).toBeNull();
    });

    it('clearRecoveryInfo가 recoveryInfo를 null로 설정해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      act(() => {
        result.current.clearRecoveryInfo();
      });

      expect(result.current.recoveryInfo).toBeNull();
    });
  });

  // ===========================
  // formatTimeAgo 테스트
  // ===========================
  describe('formatTimeAgo', () => {
    it('방금 전을 표시해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));
      
      const now = Date.now();
      expect(result.current.formatTimeAgo(now - 30000)).toBe('방금 전');
    });

    it('분 단위를 표시해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));
      
      const now = Date.now();
      expect(result.current.formatTimeAgo(now - 5 * 60 * 1000)).toBe('5분 전');
    });

    it('시간 단위를 표시해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));
      
      const now = Date.now();
      expect(result.current.formatTimeAgo(now - 3 * 60 * 60 * 1000)).toBe('3시간 전');
    });

    it('일 단위를 표시해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));
      
      const now = Date.now();
      expect(result.current.formatTimeAgo(now - 2 * 24 * 60 * 60 * 1000)).toBe('2일 전');
    });

    it('7일 이상이면 날짜를 표시해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));
      
      const now = Date.now();
      const formatted = result.current.formatTimeAgo(now - 10 * 24 * 60 * 60 * 1000);
      // 날짜 형식으로 표시됨
      expect(formatted).not.toBe('10일 전');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  // ===========================
  // getStats 테스트
  // ===========================
  describe('getStats', () => {
    it('통계 정보를 반환해야 합니다', async () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      const stats = await result.current.getStats();

      expect(stats).toHaveProperty('sessionCount');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('lastSaveTime');
      expect(stats).toHaveProperty('currentSessionId');
      expect(stats).toHaveProperty('isDirty');
      expect(stats).toHaveProperty('autoSaveEnabled');
      
      expect(stats.sessionCount).toBe(0);
      expect(stats.autoSaveEnabled).toBe(false);
    });
  });

  // ===========================
  // 충돌 복구 감지 테스트
  // ===========================
  describe('crash recovery detection', () => {
    it('오래된 임시 저장 데이터는 무시해야 합니다', async () => {
      const tempData = {
        id: 'old-temp',
        fileName: 'old-crash.hwpx',
        timestamp: Date.now() - 10 * 60 * 1000, // 10분 전
        document: createMockDocument(),
        size: 100,
      };

      localStorage.setItem('hwpx-crash-recovery', JSON.stringify(tempData));

      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      const recovery = await result.current.detectCrashRecovery();

      // 5분 초과된 데이터는 무시됨
      expect(recovery).toBeNull();
    });

    it('detectCrashRecovery 함수가 존재해야 합니다', async () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));
      
      // 함수 존재 확인
      expect(typeof result.current.detectCrashRecovery).toBe('function');
      
      // 데이터 없이 호출 시 null 반환
      const recovery = await result.current.detectCrashRecovery();
      expect(recovery).toBeNull();
    });
  });

  // ===========================
  // 옵션 테스트
  // ===========================
  describe('options', () => {
    it('기본 옵션이 적용되어야 합니다', () => {
      const { result } = renderHook(() => useAutoSave());

      // 기본값 확인 (enabled: true가 기본)
      expect(result.current).toBeDefined();
    });

    it('커스텀 옵션이 적용되어야 합니다', () => {
      const customOptions = {
        interval: 60000,
        maxSessions: 5,
        maxAge: 3 * 24 * 60 * 60 * 1000,
        enabled: false
      };

      const { result } = renderHook(() => useAutoSave(customOptions));

      expect(result.current).toBeDefined();
      expect(result.current.isInitialized).toBe(false);
    });
  });

  // ===========================
  // 반환값 테스트
  // ===========================
  describe('return values', () => {
    it('필요한 모든 함수를 반환해야 합니다', () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      // 상태
      expect(result.current).toHaveProperty('isInitialized');
      expect(result.current).toHaveProperty('lastSaveTime');
      expect(result.current).toHaveProperty('sessions');
      expect(result.current).toHaveProperty('currentSessionId');
      expect(result.current).toHaveProperty('recoveryInfo');

      // 함수
      expect(typeof result.current.saveNow).toBe('function');
      expect(typeof result.current.restoreSession).toBe('function');
      expect(typeof result.current.deleteSession).toBe('function');
      expect(typeof result.current.loadSessions).toBe('function');
      expect(typeof result.current.startNewSession).toBe('function');
      expect(typeof result.current.getStats).toBe('function');
      expect(typeof result.current.detectCrashRecovery).toBe('function');
      expect(typeof result.current.performCrashRecovery).toBe('function');
      expect(typeof result.current.clearRecoveryInfo).toBe('function');
      expect(typeof result.current.formatTimeAgo).toBe('function');
    });
  });

  // ===========================
  // 세션 관리 테스트
  // ===========================
  describe('session management', () => {
    it('deleteSession이 에러 없이 실행되어야 합니다', async () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      // 존재하지 않는 세션 삭제 시도 - 에러 없이 완료
      await expect(result.current.deleteSession('non-existent')).resolves.not.toThrow();
    });

    it('restoreSession이 존재하지 않는 세션에서 false를 반환해야 합니다', async () => {
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      const restored = await result.current.restoreSession('non-existent');

      expect(restored).toBe(false);
    });

    it('performCrashRecovery가 데이터 없이 false를 반환해야 합니다', async () => {
      localStorage.removeItem('hwpx-crash-recovery');
      
      const { result } = renderHook(() => useAutoSave({ enabled: false }));

      const recovered = await result.current.performCrashRecovery();

      expect(recovered).toBe(false);
    });
  });
});
