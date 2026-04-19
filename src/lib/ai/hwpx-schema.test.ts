import { describe, it, expect } from 'vitest';
import {
  validateDraft,
  draftToHwpx,
  HWPX_DRAFT_SCHEMA,
  SYSTEM_INSTRUCTION,
  type DraftOutput,
} from './hwpx-schema';

describe('HWPX Draft Schema', () => {
  it('스키마 — 최상위 required', () => {
    expect(HWPX_DRAFT_SCHEMA.required).toContain('title');
    expect(HWPX_DRAFT_SCHEMA.required).toContain('sections');
  });

  it('validateDraft — 정상', () => {
    const draft: DraftOutput = {
      title: '2026 보고서',
      sections: [
        {
          elements: [
            { type: 'heading', level: 1, text: '개요' },
            { type: 'paragraph', text: '본 문서는 ...' },
          ],
        },
      ],
    };
    expect(validateDraft(draft)).toBe(true);
  });

  it('validateDraft — 불법 (title 없음)', () => {
    expect(validateDraft({ sections: [] })).toBe(false);
  });

  it('validateDraft — 빈 sections', () => {
    expect(validateDraft({ title: 't', sections: [] })).toBe(false);
  });

  it('validateDraft — 잘못된 element type', () => {
    const bad = {
      title: 't',
      sections: [{ elements: [{ type: 'unknown', text: 'x' }] }],
    };
    expect(validateDraft(bad)).toBe(false);
  });

  it('draftToHwpx — 제목·단락·목록 변환', () => {
    const draft: DraftOutput = {
      title: '제목',
      sections: [
        {
          elements: [
            { type: 'heading', level: 1, text: '1장' },
            { type: 'paragraph', text: '본문입니다.' },
            { type: 'bullet-list', items: ['첫째', '둘째'] },
          ],
        },
      ],
    };
    const doc = draftToHwpx(draft);
    expect(doc.sections).toHaveLength(1);
    const els = doc.sections[0].elements;
    // 제목 paragraph 가 앞에 추가됨
    expect(els[0].type).toBe('paragraph');
    expect((els[0] as { runs: Array<{ text: string }> }).runs[0].text).toBe('제목');
    // 본문 단락·bullet 포함
    expect(els.length).toBeGreaterThanOrEqual(4);
  });

  it('draftToHwpx — 표 변환 (headers + rows)', () => {
    const draft: DraftOutput = {
      title: 't',
      sections: [
        {
          elements: [
            {
              type: 'table',
              table: {
                headers: ['이름', '금액'],
                rows: [['김', '100'], ['이', '200']],
              },
            },
          ],
        },
      ],
    };
    const doc = draftToHwpx(draft);
    const table = doc.sections[0].elements.find(e => e.type === 'table');
    expect(table).toBeDefined();
    expect((table as { rows: unknown[] }).rows).toHaveLength(3); // headers + 2 rows
  });

  it('SYSTEM_INSTRUCTION — JSON 강제 지시 포함', () => {
    expect(SYSTEM_INSTRUCTION).toContain('JSON');
    expect(SYSTEM_INSTRUCTION).toContain('한국어');
  });
});
