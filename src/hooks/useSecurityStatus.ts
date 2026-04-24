/**
 * useSecurityStatus Hook
 * AEGIS + TruthAnchor 실시간 상태 모니터링
 *
 * @module hooks/useSecurityStatus
 * @version 1.1.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ServiceState = 'online' | 'offline' | 'disabled' | 'error';

export interface SecurityStatus {
  aegis: {
    state: ServiceState;
    ready: boolean;
  };
  truthAnchor: {
    state: ServiceState;
    version: string | null;
    latencyMs: number | null;
    lastCheckAt: string | null;
  };
}

const POLL_INTERVAL = 45_000;
const BACKOFF_INTERVAL = 180_000;

function getAegisEnabled(): boolean {
  try {
    return localStorage.getItem('aegis_enabled') === 'true';
  } catch {
    return false;
  }
}

function getTruthAnchorEnabled(): boolean {
  try {
    return localStorage.getItem('truthanchor_enabled') === 'true';
  } catch {
    return false;
  }
}

/**
 * TruthAnchor 서버 헬스체크
 * 서버가 꺼져 있으면 Vite 프록시가 500을 반환하므로,
 * 비활성 상태거나 이미 실패한 경우 불필요한 요청을 하지 않는다.
 */
async function checkTruthAnchorHealth(): Promise<{
  available: boolean;
  version: string | null;
  latencyMs: number;
}> {
  const start = performance.now();
  try {
    const res = await fetch('/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      const data = await res.json().catch(() => ({}) as { available?: boolean; version?: string });
      // Vite proxy stub은 200 + {available:false}를 반환하므로 본문도 확인
      if (data && data.available === false) {
        return { available: false, version: null, latencyMs };
      }
      return { available: true, version: data.version || null, latencyMs };
    }
    return { available: false, version: null, latencyMs };
  } catch {
    return { available: false, version: null, latencyMs: Math.round(performance.now() - start) };
  }
}

function checkAegisReady(): boolean {
  try {
    const viewer = (
      window as unknown as {
        __hwpxViewer?: { aiController?: { securityGateway?: { _ready?: boolean } } };
      }
    ).__hwpxViewer;
    const gw = viewer?.aiController?.securityGateway;
    return gw?._ready === true;
  } catch {
    return false;
  }
}

export function useSecurityStatus() {
  const [status, setStatus] = useState<SecurityStatus>({
    aegis: { state: 'disabled', ready: false },
    truthAnchor: { state: 'disabled', version: null, latencyMs: null, lastCheckAt: null },
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taFailCountRef = useRef(0);

  const refresh = useCallback(async () => {
    // AEGIS
    const aegisEnabled = getAegisEnabled();
    const aegisReady = aegisEnabled ? checkAegisReady() : false;
    const aegisState: ServiceState = !aegisEnabled ? 'disabled' : aegisReady ? 'online' : 'error';

    // TruthAnchor — 비활성이면 fetch 자체를 하지 않음
    const taEnabled = getTruthAnchorEnabled();
    let taState: ServiceState = 'disabled';
    let taVersion: string | null = null;
    let taLatency: number | null = null;
    let taLastCheck: string | null = null;

    if (taEnabled) {
      const health = await checkTruthAnchorHealth();
      taState = health.available ? 'online' : 'offline';
      taVersion = health.version;
      taLatency = health.latencyMs;
      taLastCheck = new Date().toISOString();

      if (health.available) {
        taFailCountRef.current = 0;
      } else {
        taFailCountRef.current += 1;
      }
    } else {
      taFailCountRef.current = 0;
    }

    setStatus({
      aegis: { state: aegisState, ready: aegisReady },
      truthAnchor: {
        state: taState,
        version: taVersion,
        latencyMs: taLatency,
        lastCheckAt: taLastCheck,
      },
    });
  }, []);

  useEffect(() => {
    // 초기 체크 — 2초 지연 (앱 초기화 완료 후)
    const initTimer = setTimeout(() => {
      refresh();
      schedulePoll();
    }, 2000);

    function schedulePoll() {
      // 서버 실패가 누적되면 폴링 간격을 점점 늘림 (최대 5분)
      const failCount = taFailCountRef.current;
      let interval: number;
      if (failCount === 0) {
        interval = POLL_INTERVAL;
      } else if (failCount <= 2) {
        interval = BACKOFF_INTERVAL; // 3분
      } else {
        interval = 300_000; // 5분 — 서버가 계속 꺼져 있으면
      }

      timerRef.current = setTimeout(() => {
        refresh().then(schedulePoll);
      }, interval);
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'aegis_enabled' || e.key === 'truthanchor_enabled') {
        taFailCountRef.current = 0; // 토글 변경 시 카운터 리셋
        refresh();
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleToggle = () => {
      taFailCountRef.current = 0;
      refresh();
    };
    window.addEventListener('security-toggle-changed', handleToggle);

    return () => {
      clearTimeout(initTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('security-toggle-changed', handleToggle);
    };
  }, [refresh]);

  return { status, refresh };
}
