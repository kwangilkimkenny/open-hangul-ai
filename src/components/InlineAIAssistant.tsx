/**
 * InlineAIAssistant
 *
 * canvas-editor 위에서 텍스트를 선택하면 떠오르는 플로팅 AI 툴바.
 * - 요약 / 번역(영문) / 리라이트(다듬기) / 맞춤법 교정
 * - LLM 호출 결과를 미리보기 모달로 보여주고, 수락 시 선택 영역을 교체.
 *
 * 어댑터의 `getRangeText` / `getRangeBoundingRect` / `replaceRangeText` 와
 * `universalLLM.generateText` 를 합쳐서 동작한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HWPXViewerInstance } from '../types/viewer';
import type { LLMMessage } from '../types/universal-llm';
import { universalLLM } from '../lib/ai/universal-llm-service';
import { useActiveConfig } from '../stores/llmConfigStore';

interface InlineAIAssistantProps {
  viewer?: HWPXViewerInstance | null;
  /** 선택 텍스트 길이가 이 값 미만이면 툴바를 표시하지 않는다. */
  minSelectionLength?: number;
}

interface AssistAction {
  id: 'summarize' | 'translate' | 'rewrite' | 'proofread';
  label: string;
  icon: string;
  systemPrompt: string;
  buildUserPrompt: (text: string) => string;
}

const ACTIONS: AssistAction[] = [
  {
    id: 'summarize',
    label: '요약',
    icon: '📝',
    systemPrompt:
      '너는 한국어 문서 요약 전문가다. 입력 텍스트의 핵심을 보존하며 간결하게 요약하라. ' +
      '결과만 출력하고 설명·접두 문구·마크다운을 포함하지 마라.',
    buildUserPrompt: text => `다음 텍스트를 3문장 이내로 요약해줘:\n\n${text}`,
  },
  {
    id: 'translate',
    label: '영문 번역',
    icon: '🌐',
    systemPrompt:
      'You are a professional Korean→English translator. Translate the input faithfully ' +
      'and naturally. Output only the translated text — no commentary, no markdown.',
    buildUserPrompt: text => `Translate to natural English:\n\n${text}`,
  },
  {
    id: 'rewrite',
    label: '다듬기',
    icon: '✨',
    systemPrompt:
      '너는 한국어 문장을 다듬는 편집자다. 의미를 바꾸지 않고, 자연스럽고 명확한 한국어로 ' +
      '리라이트하라. 결과만 출력하라.',
    buildUserPrompt: text => `다음을 자연스러운 한국어로 다듬어줘:\n\n${text}`,
  },
  {
    id: 'proofread',
    label: '맞춤법',
    icon: '✓',
    systemPrompt:
      '너는 한국어 맞춤법·띄어쓰기 교정기다. 의미는 그대로 두고, 맞춤법·띄어쓰기·문장부호만 ' +
      '교정해 출력하라. 변경 사유나 설명은 포함하지 마라.',
    buildUserPrompt: text => `맞춤법과 띄어쓰기를 교정해줘:\n\n${text}`,
  },
];

interface SelectionState {
  text: string;
  rect: { left: number; top: number; right: number; bottom: number };
}

interface CanvasEditorAdapterLike {
  onRangeStyleChange?: (cb: () => void) => (() => void) | void;
  getRangeText?: () => string;
  getRangeBoundingRect?: () => SelectionState['rect'] | null;
  replaceRangeText?: (text: string) => boolean;
}

export function InlineAIAssistant({ viewer, minSelectionLength = 5 }: InlineAIAssistantProps) {
  const adapter = (viewer as { canvasEditor?: CanvasEditorAdapterLike } | null | undefined)
    ?.canvasEditor;
  const config = useActiveConfig();

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [pending, setPending] = useState<AssistAction | null>(null);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshSelection = useCallback(() => {
    if (!adapter?.getRangeText || !adapter?.getRangeBoundingRect) {
      setSelection(null);
      return;
    }
    const text = adapter.getRangeText().trim();
    if (!text || text.length < minSelectionLength) {
      setSelection(null);
      return;
    }
    const rect = adapter.getRangeBoundingRect();
    if (!rect) {
      setSelection(null);
      return;
    }
    setSelection({ text, rect });
  }, [adapter, minSelectionLength]);

  // canvas-editor 의 rangeStyleChange 는 선택 변경마다 발생 → 선택 추적의 가장 안정적 신호.
  useEffect(() => {
    if (!adapter?.onRangeStyleChange) return;
    const unsub = adapter.onRangeStyleChange(refreshSelection);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [adapter, refreshSelection]);

  // 툴바가 떠 있을 때 ESC 로 닫기 + 모달이 떠 있을 때도 ESC 처리.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pending) {
        setPending(null);
        setResult('');
        setError(null);
        abortRef.current?.abort();
      } else if (selection) {
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, selection]);

  const runAction = useCallback(
    async (action: AssistAction) => {
      if (!selection) return;
      setPending(action);
      setResult('');
      setError(null);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const messages: LLMMessage[] = [
          { role: 'system', content: action.systemPrompt },
          { role: 'user', content: action.buildUserPrompt(selection.text) },
        ];
        const response = await universalLLM.generateText(messages, config, {
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        setResult(response.content.trim());
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    },
    [selection, config]
  );

  const acceptResult = useCallback(() => {
    if (!result || !adapter?.replaceRangeText) return;
    adapter.replaceRangeText(result);
    setPending(null);
    setResult('');
    setSelection(null);
  }, [adapter, result]);

  const cancelResult = useCallback(() => {
    abortRef.current?.abort();
    setPending(null);
    setResult('');
    setError(null);
  }, []);

  if (!adapter) return null;

  return (
    <>
      {selection && !pending && (
        <div
          role="toolbar"
          aria-label="AI 어시스트"
          data-testid="inline-ai-toolbar"
          style={{
            position: 'fixed',
            // 선택 영역 바로 위에 띄우되, 화면 위쪽에 가까우면 아래로 회피.
            top: selection.rect.top > 60 ? selection.rect.top - 44 : selection.rect.bottom + 8,
            left: Math.max(8, selection.rect.left),
            zIndex: 1100,
            display: 'flex',
            gap: 4,
            background: '#1f2937',
            color: '#fff',
            padding: '4px 6px',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            font: '13px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif',
          }}
        >
          {ACTIONS.map(a => (
            <button
              key={a.id}
              onClick={() => runAction(a)}
              data-testid={`inline-ai-action-${a.id}`}
              title={a.label}
              style={{
                background: 'transparent',
                color: '#fff',
                border: 'none',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#374151';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <span aria-hidden="true">{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {pending && (
        <div
          role="dialog"
          aria-label={`${pending.label} 결과`}
          data-testid="inline-ai-result-modal"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1200,
            width: 'min(640px, 90vw)',
            maxHeight: '80vh',
            background: '#fff',
            border: '1px solid #d0d0d0',
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            font: '14px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif',
          }}
        >
          <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true">{pending.icon}</span>
            <strong>{pending.label}</strong>
            <span style={{ color: '#888', fontSize: 12, marginLeft: 'auto' }}>
              {config.provider} · {config.model}
            </span>
          </header>

          <section>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>원문</div>
            <div
              style={{
                padding: 8,
                background: '#f7f7f9',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                maxHeight: 120,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                color: '#444',
                fontSize: 13,
              }}
            >
              {selection?.text ?? ''}
            </div>
          </section>

          <section>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>결과</div>
            {error ? (
              <div
                role="alert"
                style={{
                  padding: 8,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  color: '#991b1b',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {error}
              </div>
            ) : result ? (
              <textarea
                value={result}
                onChange={e => setResult(e.target.value)}
                data-testid="inline-ai-result-text"
                style={{
                  width: '100%',
                  minHeight: 120,
                  maxHeight: 240,
                  padding: 8,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  font: 'inherit',
                  resize: 'vertical',
                  whiteSpace: 'pre-wrap',
                }}
              />
            ) : (
              <div
                style={{
                  padding: 12,
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 6,
                  color: '#075985',
                  fontSize: 13,
                }}
                aria-live="polite"
              >
                생성 중…
              </div>
            )}
          </section>

          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button onClick={cancelResult} style={btnSecondary} data-testid="inline-ai-cancel">
              취소
            </button>
            <button
              onClick={acceptResult}
              style={btnPrimary}
              disabled={!result || !!error}
              data-testid="inline-ai-accept"
            >
              교체
            </button>
          </footer>
        </div>
      )}
    </>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #2b579a',
  background: '#2b579a',
  color: '#fff',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
};
const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #ccc',
  background: '#fff',
  color: '#333',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
};

export default InlineAIAssistant;
