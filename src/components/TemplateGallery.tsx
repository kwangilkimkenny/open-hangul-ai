/**
 * TemplateGallery — 초안 템플릿 선택 그리드
 */

import { useState } from 'react';
import { DRAFT_TEMPLATES, type DraftTemplate } from '../lib/ai/templates';

interface Props {
  onSelect: (template: DraftTemplate) => void;
  onSkip?: () => void;
}

const CATEGORIES: Array<DraftTemplate['category'] | '전체'> = ['전체', '공공', '기업', '연구', '범용'];

export default function TemplateGallery({ onSelect, onSkip }: Props) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('전체');

  const filtered = category === '전체'
    ? DRAFT_TEMPLATES
    : DRAFT_TEMPLATES.filter(t => t.category === category);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>템플릿으로 시작</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
          자주 쓰이는 문서 유형을 선택하면 프롬프트 구조가 자동 채워집니다.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 999,
              background: category === c ? '#3b82f6' : '#fff',
              color: category === c ? '#fff' : '#374151',
              cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        {filtered.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            style={{
              textAlign: 'left',
              padding: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.background = '#f0f9ff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.background = '#fff';
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{tpl.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{tpl.name}</div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
              {tpl.description}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '2px 6px', background: '#f3f4f6', borderRadius: 4, color: '#6b7280' }}>
                {tpl.category}
              </span>
              {tpl.preferredModel === 'gemini-2.5-flash' && (
                <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef3c7', borderRadius: 4, color: '#92400e' }}>
                  Flash 추천
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {onSkip && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            onClick={onSkip}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >
            템플릿 없이 직접 작성
          </button>
        </div>
      )}
    </div>
  );
}
