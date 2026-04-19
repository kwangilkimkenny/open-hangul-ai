/**
 * ReferenceUploader — AI 초안 생성용 참조 문서 업로드
 *
 * 지원 포맷: .txt, .md, .pdf, .docx, .hwpx, .html
 * 파일 → 텍스트 추출 → 토큰 카운트 → 세션 스토어에 추가
 */

import { useCallback, useState } from 'react';
import { estimateTokens } from '../lib/ai/ai-quota';
import { useDraftStore } from '../stores/draftStore';
import type { ReferenceDoc } from '../types/ai-draft';

interface Props {
  sessionId: string;
}

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html') || file.type.startsWith('text/')) {
    return file.text();
  }

  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map(it => ('str' in it ? (it as { str?: string }).str ?? '' : '')).join(' '));
    }
    return parts.join('\n\n');
  }

  if (name.endsWith('.docx')) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const doc = await zip.file('word/document.xml')?.async('string');
    if (!doc) return '';
    return doc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (name.endsWith('.hwpx')) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const parts: string[] = [];
    const files = Object.keys(zip.files).filter(f => f.match(/Contents\/section\d+\.xml$/));
    for (const f of files) {
      const xml = await zip.file(f)?.async('string');
      if (xml) parts.push(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
    return parts.join('\n\n');
  }

  return `[지원되지 않는 포맷: ${file.name}]`;
}

export default function ReferenceUploader({ sessionId }: Props) {
  const session = useDraftStore(s => s.sessions[sessionId]);
  const addReference = useDraftStore(s => s.addReference);
  const removeReference = useDraftStore(s => s.removeReference);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    setIsBusy(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        const text = await extractText(file);
        const ref: ReferenceDoc = {
          fileId: `${file.name}-${file.size}-${file.lastModified}`,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          tokenCount: estimateTokens(text),
          text,
          uploadedAt: new Date().toISOString(),
        };
        addReference(sessionId, ref);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsBusy(false);
    }
  }, [sessionId, addReference]);

  if (!session) return null;

  const totalTokens = session.references.reduce((s, r) => s + r.tokenCount, 0);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <strong style={{ fontSize: 13 }}>참조 문서</strong>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          ({session.references.length}개 · 약 {totalTokens.toLocaleString()} 토큰)
        </span>
      </div>

      <label
        style={{
          display: 'block',
          border: '2px dashed #d1d5db',
          borderRadius: 6,
          padding: 12,
          textAlign: 'center',
          cursor: 'pointer',
          fontSize: 13,
          color: '#6b7280',
        }}
      >
        {isBusy ? '처리 중...' : '파일을 선택하거나 여기로 드래그 (PDF, DOCX, HWPX, TXT, MD)'}
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.hwpx,.txt,.md,.html"
          style={{ display: 'none' }}
          disabled={isBusy}
          onChange={e => handleFiles(e.target.files)}
        />
      </label>

      {error && (
        <div role="alert" style={{ marginTop: 8, padding: 6, background: '#fee', color: '#900', fontSize: 12, borderRadius: 4 }}>
          {error}
        </div>
      )}

      {session.references.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', fontSize: 12 }}>
          {session.references.map(r => (
            <li
              key={r.fileId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.fileName}
              </span>
              <span style={{ color: '#9ca3af', marginRight: 8 }}>
                {r.tokenCount.toLocaleString()}t
              </span>
              <button
                onClick={() => removeReference(sessionId, r.fileId)}
                aria-label={`${r.fileName} 제거`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
