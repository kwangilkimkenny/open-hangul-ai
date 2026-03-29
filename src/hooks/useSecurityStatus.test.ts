import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const storageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storageMap.set(key, value)),
  removeItem: vi.fn((key: string) => storageMap.delete(key)),
  clear: vi.fn(() => storageMap.clear()),
  length: 0,
  key: vi.fn(),
});

import { useSecurityStatus } from './useSecurityStatus';

describe('useSecurityStatus', () => {
  beforeEach(() => {
    storageMap.clear();
    (window as any).__hwpxViewer = null;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as any).__hwpxViewer;
  });

  it('둘 다 비활성일 때 disabled 상태여야 한다', async () => {
    const { result } = renderHook(() => useSecurityStatus());
    // 초기 2초 지연 건너뛰기
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(result.current.status.aegis.state).toBe('disabled');
    expect(result.current.status.truthAnchor.state).toBe('disabled');
  });

  it('AEGIS 활성화 + SDK 미로드 시 error 상태여야 한다', async () => {
    storageMap.set('aegis_enabled', 'true');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('noop'));
    const { result } = renderHook(() => useSecurityStatus());
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(result.current.status.aegis.state).toBe('error');
  });

  it('AEGIS 활성화 + SDK 로드 시 online 상태여야 한다', async () => {
    storageMap.set('aegis_enabled', 'true');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('noop'));
    (window as any).__hwpxViewer = {
      aiController: { securityGateway: { _ready: true } },
    };
    const { result } = renderHook(() => useSecurityStatus());
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(result.current.status.aegis.state).toBe('online');
    expect(result.current.status.aegis.ready).toBe(true);
  });

  it('TruthAnchor 활성화 + 서버 응답 시 online이어야 한다', async () => {
    storageMap.set('truthanchor_enabled', 'true');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', version: '2.0.0' }), { status: 200 })
    );
    const { result } = renderHook(() => useSecurityStatus());
    await act(async () => { vi.advanceTimersByTime(2500); });
    await waitFor(() => {
      expect(result.current.status.truthAnchor.state).toBe('online');
      expect(result.current.status.truthAnchor.version).toBe('2.0.0');
    });
  });

  it('TruthAnchor 활성화 + 서버 불가 시 offline이어야 한다', async () => {
    storageMap.set('truthanchor_enabled', 'true');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useSecurityStatus());
    await act(async () => { vi.advanceTimersByTime(2500); });
    await waitFor(() => {
      expect(result.current.status.truthAnchor.state).toBe('offline');
    });
  });

  it('refresh 함수로 수동 갱신이 가능해야 한다', async () => {
    storageMap.set('truthanchor_enabled', 'true');
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', version: '2.1.0' }), { status: 200 })
      );

    const { result } = renderHook(() => useSecurityStatus());
    await act(async () => { vi.advanceTimersByTime(2500); });
    await waitFor(() => {
      expect(result.current.status.truthAnchor.state).toBe('offline');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status.truthAnchor.state).toBe('online');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('TruthAnchor 비활성 시 fetch를 호출하지 않아야 한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderHook(() => useSecurityStatus());
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
