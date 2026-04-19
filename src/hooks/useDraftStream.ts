/**
 * useDraftStream — AI 초안 스트리밍 훅
 *
 * DraftGenerator 를 훅 형태로 감싸서 React 컴포넌트에서 쉽게 사용.
 * 중간 delta · usage · done 이벤트를 state 로 노출.
 */

import { useCallback, useRef, useState } from 'react';
import type { DraftRequest, DraftStatus, DraftVersion, TokenBudget } from '../types/ai-draft';
import { DraftGenerator } from '../lib/ai/draft-generator';
import { useDraftStore } from '../stores/draftStore';

export interface DraftStreamState {
  status: DraftStatus;
  streamText: string;
  tokensUsed: number;
  budget: TokenBudget | null;
  error: string | null;
}

const initial: DraftStreamState = {
  status: 'idle',
  streamText: '',
  tokensUsed: 0,
  budget: null,
  error: null,
};

export function useDraftStream(sessionId: string | null) {
  const [state, setState] = useState<DraftStreamState>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const generator = useRef<DraftGenerator>(new DraftGenerator());
  const setStatus = useDraftStore(s => s.setStatus);
  const addVersion = useDraftStore(s => s.addVersion);

  const generate = useCallback(async (req: DraftRequest) => {
    if (!sessionId) throw new Error('세션이 선택되지 않았습니다');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...initial, status: 'preparing' });
    setStatus(sessionId, 'preparing');

    try {
      const result = await generator.current.generate(req, {
        signal: ctrl.signal,
        onEvent: (e) => {
          if (e.type === 'start') {
            setState(s => ({ ...s, status: 'generating', budget: e.budget }));
            setStatus(sessionId, 'generating');
          } else if (e.type === 'delta') {
            setState(s => ({ ...s, streamText: s.streamText + e.text }));
          } else if (e.type === 'usage') {
            setState(s => ({ ...s, tokensUsed: e.promptTokens + e.outputTokens }));
          } else if (e.type === 'done') {
            setState(s => ({ ...s, status: 'completed', tokensUsed: e.tokensUsed }));
          } else if (e.type === 'error') {
            setState(s => ({ ...s, status: 'failed', error: e.message }));
          }
        },
      });

      const version: DraftVersion = {
        id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        document: result.document,
        tokensUsed: result.tokensUsed,
        model: req.model ?? 'gemini-2.5-pro',
        prompt: req.prompt,
      };
      addVersion(sessionId, version);
      setStatus(sessionId, 'completed');
      return result;
    } catch (err) {
      const isAbort = (err as Error).name === 'AbortError' || ctrl.signal.aborted;
      if (isAbort) {
        setState(s => ({ ...s, status: 'cancelled' }));
        setStatus(sessionId, 'cancelled');
      } else {
        const msg = (err as Error).message;
        setState(s => ({ ...s, status: 'failed', error: msg }));
        setStatus(sessionId, 'failed', msg);
      }
      throw err;
    }
  }, [sessionId, setStatus, addVersion]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState(initial);
  }, []);

  return { state, generate, cancel, reset };
}
