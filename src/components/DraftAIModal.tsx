/**
 * DraftAIModal — Vertex AI 초안 생성 통합 모달
 *
 * 구성: 프롬프트 입력 + ReferenceUploader + TokenBudgetBar + 스트리밍 결과 + 취소
 * 완성 시 onComplete(document) 콜백으로 HWPX 문서 전달 → 뷰어에 로드
 */

import { useEffect, useMemo, useState } from 'react';
import { useDraftStore } from '../stores/draftStore';
import { useDraftStream } from '../hooks/useDraftStream';
import { computeBudget, estimateTokens } from '../lib/ai/ai-quota';
import { buildPromptFromTemplate, type DraftTemplate } from '../lib/ai/templates';
import ReferenceUploader from './ReferenceUploader';
import TokenBudgetBar from './TokenBudgetBar';
import TemplateGallery from './TemplateGallery';
import type { HWPXDocument } from '../types/hwpx';
import type { VertexModel } from '../types/ai-draft';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (document: HWPXDocument) => void;
  initialPrompt?: string;
}

export default function DraftAIModal({ isOpen, onClose, onComplete, initialPrompt = '' }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [model, setModel] = useState<VertexModel>('gemini-2.5-pro');
  const [template, setTemplate] = useState<DraftTemplate | null>(null);
  const [view, setView] = useState<'gallery' | 'compose'>(initialPrompt ? 'compose' : 'gallery');

  const session = useDraftStore(s => (sessionId ? s.sessions[sessionId] : null));
  const createSession = useDraftStore(s => s.createSession);
  const deleteSession = useDraftStore(s => s.deleteSession);

  const { state, generate, cancel, reset } = useDraftStream(sessionId);

  // 모달 열릴 때 세션 생성
  useEffect(() => {
    if (isOpen && !sessionId) {
      const id = createSession(initialPrompt || 'AI 초안', initialPrompt);
      setSessionId(id);
    }
    if (!isOpen && sessionId) {
      reset();
    }
  }, [isOpen, sessionId, createSession, initialPrompt, reset]);

  // 초기 프롬프트 업데이트 시 반영
  useEffect(() => {
    setPrompt(initialPrompt);
    if (initialPrompt) setView('compose');
  }, [initialPrompt]);

  function handleTemplateSelect(tpl: DraftTemplate) {
    setTemplate(tpl);
    setPrompt(tpl.promptScaffold);
    if (tpl.preferredModel) setModel(tpl.preferredModel);
    setView('compose');
  }

  // 예산 계산 (실시간)
  const budget = useMemo(() => {
    if (!session) return null;
    return computeBudget({
      model,
      prompt,
      references: session.references,
    });
  }, [model, prompt, session]);

  async function onGenerate() {
    if (!session || !prompt.trim()) return;
    const finalPrompt = template ? buildPromptFromTemplate(template, prompt) : prompt;
    try {
      const result = await generate({
        prompt: finalPrompt,
        references: session.references,
        model,
      });
      onComplete(result.document);
      handleClose();
    } catch (err) {
      // error state 는 useDraftStream 이 이미 관리
      console.error('[DraftAIModal]', err);
    }
  }

  function handleClose() {
    if (state.status === 'generating') {
      cancel();
    }
    if (sessionId) {
      deleteSession(sessionId);
      setSessionId(null);
    }
    setTemplate(null);
    setView(initialPrompt ? 'compose' : 'gallery');
    onClose();
  }

  if (!isOpen || !session) return null;

  const busy = state.status === 'preparing' || state.status === 'generating';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 초안 생성"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.5)',
        zIndex: 1500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(820px, 94vw)',
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>✨ AI 초안 생성</h2>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Vertex AI · {model} · 최대 {(budget?.contextLimit ?? 2_000_000).toLocaleString()} 토큰
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="닫기"
            disabled={busy}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {view === 'gallery' && (
            <TemplateGallery
              onSelect={handleTemplateSelect}
              onSkip={() => setView('compose')}
            />
          )}

          {view === 'compose' && (
          <>
          {template && (
            <div style={{ padding: 10, marginBottom: 12, background: '#f0f9ff', borderRadius: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{template.icon} 템플릿: <strong>{template.name}</strong></span>
              <button
                onClick={() => { setTemplate(null); setView('gallery'); }}
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}
              >
                템플릿 변경
              </button>
            </div>
          )}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            작성 요청
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="예: 2026년 상반기 영업 실적과 주요 성과, 하반기 전략을 담은 사업 보고서를 작성해 주세요."
            disabled={busy}
            rows={4}
            style={{
              width: '100%',
              padding: 10,
              fontSize: 14,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#6b7280' }}>모델:</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value as VertexModel)}
              disabled={busy}
              style={{ padding: '4px 8px', fontSize: 13 }}
            >
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (2M)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (1M · 빠름)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (2M)</option>
            </select>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              프롬프트: {estimateTokens(prompt).toLocaleString()} 토큰
            </span>
          </div>

          <div style={{ marginTop: 16 }}>
            <ReferenceUploader sessionId={session.id} />
          </div>

          <div style={{ marginTop: 16 }}>
            <TokenBudgetBar budget={budget} />
          </div>

          {state.status === 'generating' && (
            <div style={{ marginTop: 16, padding: 12, background: '#eff6ff', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="spinner" style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: '2px solid #3b82f6',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <strong style={{ fontSize: 13 }}>생성 중... ({state.tokensUsed.toLocaleString()} 토큰)</strong>
              </div>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: 11,
                maxHeight: 160,
                overflow: 'auto',
                color: '#475569',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}>{state.streamText.slice(-1200)}</pre>
            </div>
          )}

          {state.status === 'failed' && state.error && (
            <div role="alert" style={{ marginTop: 16, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
              ❌ {state.error}
            </div>
          )}
          </>
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {view === 'gallery' && !busy && (
            <button
              onClick={handleClose}
              style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              닫기
            </button>
          )}
          {view === 'compose' && (
          <>
          {busy ? (
            <button
              onClick={cancel}
              style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              취소
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                닫기
              </button>
              <button
                onClick={onGenerate}
                disabled={!prompt.trim() || budget?.overflow}
                style={{
                  padding: '8px 20px',
                  background: prompt.trim() && !budget?.overflow ? '#3b82f6' : '#9ca3af',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: prompt.trim() && !budget?.overflow ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                ✨ 생성
              </button>
            </>
          )}
          </>
          )}
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
