/**
 * OCRDialog — 이미지/PDF 파일을 텍스트로 변환하는 모달
 */

import { useCallback, useRef, useState } from 'react';
import { recognize, recognizePdf, concatResults, type OCRLanguage } from '../lib/ocr/ocr-service';

interface OCRDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (text: string) => void;
}

export default function OCRDialog({ isOpen, onClose, onExtracted }: OCRDialogProps) {
  const [language, setLanguage] = useState<OCRLanguage>('kor+eng');
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setResult('');
    setError(null);
    setStatus('');
    setProgress(0);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      reset();
      setIsBusy(true);
      try {
        const onProgress = ({ status, progress }: { status: string; progress: number }) => {
          setStatus(status);
          setProgress(Math.round(progress * 100));
        };

        let text = '';
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const results = await recognizePdf(file, { language, onProgress });
          text = concatResults(results);
        } else {
          const r = await recognize(file, { language, onProgress });
          text = r.text;
        }
        setResult(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsBusy(false);
      }
    },
    [language, reset]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          width: 'min(700px, 92vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 id="ocr-dialog-title" style={{ margin: 0, fontSize: 18 }}>이미지·PDF 텍스트 추출 (OCR)</h2>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, marginRight: 8 }}>인식 언어:</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as OCRLanguage)}
            disabled={isBusy}
          >
            <option value="kor+eng">한국어 + 영어</option>
            <option value="kor">한국어</option>
            <option value="eng">영어</option>
          </select>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          disabled={isBusy}
          style={{ marginBottom: 12 }}
        />

        {isBusy && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{status} ({progress}%)</div>
            <div style={{ background: '#eee', height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, background: '#3b82f6', height: '100%', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={{ background: '#fee', color: '#900', padding: 8, borderRadius: 4, marginBottom: 12 }}>
            오류: {error}
          </div>
        )}

        {result && (
          <>
            <textarea
              value={result}
              onChange={e => setResult(e.target.value)}
              style={{ width: '100%', minHeight: 220, fontFamily: 'monospace', fontSize: 13, padding: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => navigator.clipboard.writeText(result)}>클립보드 복사</button>
              <button
                onClick={() => { onExtracted(result); onClose(); }}
                style={{ background: '#3b82f6', color: '#fff', padding: '6px 14px', border: 'none', borderRadius: 4 }}
              >
                문서에 삽입
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
