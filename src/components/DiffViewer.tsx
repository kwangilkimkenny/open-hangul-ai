/**
 * DiffViewer — 구조 인식 diff 결과 렌더링
 * diffDocumentsStructural 결과를 받아 단락/셀 단위로 시각화.
 */

import type {
  StructuralDiffResult,
  StructuralDiffEntry,
  TextTokenChange,
  StyleChange,
} from '../lib/diff/document-diff';

interface DiffViewerProps {
  result: StructuralDiffResult;
}

const colors = {
  insert: { bg: '#e6ffed', border: '#22863a', text: '#166534' },
  delete: { bg: '#ffeef0', border: '#cb2431', text: '#991b1b' },
  modify: { bg: '#fff5e6', border: '#e36209', text: '#9a3412' },
  equal: { bg: 'transparent', border: '#e5e7eb', text: '#374151' },
};

function renderTextChanges(changes: TextTokenChange[]) {
  return changes.map((c, i) => {
    if (c.op === 'equal') return <span key={i}>{c.text}</span>;
    if (c.op === 'insert') {
      return <ins key={i} style={{ background: '#d1fae5', textDecoration: 'none' }}>{c.text}</ins>;
    }
    return <del key={i} style={{ background: '#fee2e2' }}>{c.text}</del>;
  });
}

function renderStyleChanges(changes: StyleChange[]) {
  if (changes.length === 0) return null;
  return (
    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontFamily: 'monospace' }}>
      {changes.map((c, i) => (
        <span key={i} style={{ marginRight: 8 }}>
          {c.property}: <del>{String(c.from ?? '—')}</del> → <ins style={{ textDecoration: 'none', fontWeight: 600 }}>{String(c.to ?? '—')}</ins>
        </span>
      ))}
    </div>
  );
}

function pathLabel(entry: StructuralDiffEntry): string {
  const path = entry.left?.path ?? entry.right?.path;
  if (!path) return '';
  if (path.row !== undefined) {
    return `§${path.section}·표${path.element}·${path.row + 1}행${(path.cell ?? 0) + 1}열`;
  }
  return `§${path.section}·블록${path.element}`;
}

function renderEntry(entry: StructuralDiffEntry, idx: number) {
  const c = colors[entry.op];
  const kindLabel = (entry.left?.kind ?? entry.right?.kind) === 'table-cell' ? '셀' : '단락';
  const opLabel = { equal: '동일', insert: '추가', delete: '삭제', modify: '수정' }[entry.op];

  return (
    <div
      key={idx}
      style={{
        padding: '8px 12px',
        marginBottom: 4,
        background: c.bg,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 4,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 11, color: '#6b7280' }}>
        <span style={{ fontWeight: 600, color: c.text }}>{opLabel}</span>
        <span>{pathLabel(entry)}</span>
        <span>({kindLabel})</span>
      </div>
      <div style={{ fontFamily: 'monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {entry.op === 'insert' && <span style={{ color: c.text }}>+ {entry.right?.text}</span>}
        {entry.op === 'delete' && <span style={{ color: c.text }}>− {entry.left?.text}</span>}
        {entry.op === 'modify' && entry.textChanges && renderTextChanges(entry.textChanges)}
        {entry.op === 'modify' && !entry.textChanges && entry.left?.text}
        {entry.op === 'equal' && <span style={{ color: '#9ca3af' }}>{entry.left?.text}</span>}
      </div>
      {entry.op === 'modify' && entry.styleChanges && renderStyleChanges(entry.styleChanges)}
    </div>
  );
}

export default function DiffViewer({ result }: DiffViewerProps) {
  const { summary, entries } = result;

  return (
    <div style={{ fontFamily: '-apple-system, sans-serif' }}>
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '12px 16px',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <span><strong>총:</strong> {summary.totalLeft} → {summary.totalRight}</span>
        <span style={{ color: colors.insert.text }}>+추가 {summary.added}</span>
        <span style={{ color: colors.delete.text }}>−삭제 {summary.removed}</span>
        <span style={{ color: colors.modify.text }}>~수정 {summary.modified}</span>
        <span style={{ color: '#6b7280' }}>=동일 {summary.unchanged}</span>
      </div>
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        {entries.map((e, i) => renderEntry(e, i))}
        {entries.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>변경사항 없음</div>
        )}
      </div>
    </div>
  );
}
