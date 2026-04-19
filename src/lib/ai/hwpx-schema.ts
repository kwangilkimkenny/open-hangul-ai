/**
 * HWPX JSON Schema — Gemini function calling 용
 *
 * LLM 출력 형식을 HWPXDocument 에 근접한 JSON 스키마로 고정.
 * Gemini responseSchema / tools.functionDeclarations 모두와 호환.
 *
 * @module lib/ai/hwpx-schema
 */

import type { HWPXDocument, HWPXSection, HWPXParagraph, HWPXTable } from '../../types/hwpx';

// ─── Schema definition ──────────────────────────────────────────────────

export const HWPX_DRAFT_SCHEMA = {
  type: 'object',
  required: ['title', 'sections'],
  properties: {
    title: { type: 'string', description: '문서 제목' },
    subtitle: { type: 'string', description: '부제 (선택)' },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['elements'],
        properties: {
          elements: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                type: { type: 'string', enum: ['heading', 'paragraph', 'table', 'bullet-list'] },
                level: { type: 'integer', minimum: 1, maximum: 6, description: 'heading 전용' },
                text: { type: 'string', description: 'heading/paragraph 본문' },
                alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
                items: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'bullet-list 항목',
                },
                table: {
                  type: 'object',
                  properties: {
                    headers: { type: 'array', items: { type: 'string' } },
                    rows: {
                      type: 'array',
                      items: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

// ─── Runtime types ──────────────────────────────────────────────────────

export interface DraftHeading { type: 'heading'; level: number; text: string }
export interface DraftParagraph { type: 'paragraph'; text: string; alignment?: 'left' | 'center' | 'right' | 'justify' }
export interface DraftBulletList { type: 'bullet-list'; items: string[] }
export interface DraftTable { type: 'table'; table: { headers?: string[]; rows: string[][] } }

export type DraftElement = DraftHeading | DraftParagraph | DraftBulletList | DraftTable;

export interface DraftSection {
  elements: DraftElement[];
}

export interface DraftOutput {
  title: string;
  subtitle?: string;
  sections: DraftSection[];
}

// ─── Validation ─────────────────────────────────────────────────────────

export function validateDraft(data: unknown): data is DraftOutput {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.title !== 'string') return false;
  if (!Array.isArray(d.sections) || d.sections.length === 0) return false;
  for (const s of d.sections) {
    if (!s || typeof s !== 'object') return false;
    const sec = s as Record<string, unknown>;
    if (!Array.isArray(sec.elements)) return false;
    for (const el of sec.elements) {
      if (!validateElement(el)) return false;
    }
  }
  return true;
}

function validateElement(el: unknown): boolean {
  if (!el || typeof el !== 'object') return false;
  const e = el as Record<string, unknown>;
  switch (e.type) {
    case 'heading':
      return typeof e.text === 'string' && typeof e.level === 'number';
    case 'paragraph':
      return typeof e.text === 'string';
    case 'bullet-list':
      return Array.isArray(e.items) && e.items.every(i => typeof i === 'string');
    case 'table':
      return !!e.table && Array.isArray((e.table as { rows?: unknown }).rows);
    default:
      return false;
  }
}

// ─── Conversion: DraftOutput → HWPXDocument ─────────────────────────────

export function draftToHwpx(draft: DraftOutput): HWPXDocument {
  const sections: HWPXSection[] = draft.sections.map((sec, idx) => ({
    id: `s${idx}`,
    elements: sec.elements.map(elementToHwpx).flat(),
  }));

  // 제목 / 부제 를 첫 섹션 앞에 삽입
  if (draft.title) {
    sections[0].elements.unshift(titleParagraph(draft.title, 28, true));
  }
  if (draft.subtitle) {
    sections[0].elements.splice(1, 0, titleParagraph(draft.subtitle, 18, false));
  }

  return {
    sections,
    images: new Map(),
    metadata: { title: draft.title, createdAt: new Date().toISOString() },
  };
}

function titleParagraph(text: string, fontSize: number, bold: boolean): HWPXParagraph {
  return {
    type: 'paragraph',
    runs: [{ text, style: { fontSize, bold, ...(bold ? { fontWeight: 'bold' as const } : {}) } }],
    alignment: 'center',
  };
}

function elementToHwpx(el: DraftElement): (HWPXParagraph | HWPXTable)[] {
  switch (el.type) {
    case 'heading':
      return [{
        type: 'paragraph',
        runs: [{
          text: el.text,
          style: {
            fontSize: headingSize(el.level),
            bold: true,
            fontWeight: 'bold',
          },
        }],
        alignment: 'left',
      }];

    case 'paragraph':
      return [{
        type: 'paragraph',
        runs: [{ text: el.text }],
        alignment: el.alignment ?? 'left',
      }];

    case 'bullet-list':
      return el.items.map(item => ({
        type: 'paragraph' as const,
        runs: [{ text: `• ${item}` }],
        alignment: 'left' as const,
      }));

    case 'table': {
      const { headers, rows } = el.table;
      const allRows = headers ? [headers, ...rows] : rows;
      return [{
        type: 'table',
        rows: allRows.map(row => ({
          cells: row.map(cellText => ({
            elements: [{
              type: 'paragraph' as const,
              runs: [{ text: cellText }],
            }],
          })),
        })),
      }];
    }
  }
}

function headingSize(level: number): number {
  const sizes = [24, 20, 17, 15, 14, 13];
  return sizes[Math.max(0, Math.min(5, level - 1))];
}

// ─── Prompt helpers ─────────────────────────────────────────────────────

export const SYSTEM_INSTRUCTION = `당신은 한국 공공·기업 문서 작성 전문가입니다.
다음 규칙을 엄격히 지켜 JSON 으로만 응답하세요:

1. 최상위 키: title, subtitle(선택), sections[]
2. 각 section 은 elements[] 를 포함하며, 요소 type 은 "heading" | "paragraph" | "bullet-list" | "table" 중 하나
3. heading 은 level (1~6), text 필수
4. paragraph 는 text, alignment(선택) 포함
5. bullet-list 는 items[] 배열
6. table 은 table.headers[] + table.rows[][] 구조
7. 한국어로 작성하며 공식적·명료한 어조
8. JSON 외 다른 텍스트·설명·마크다운 울타리 사용 금지
9. 참조 문서가 제공된 경우 그 내용·용어·수치를 일관되게 활용`;

export const DRAFT_FUNCTION_DECLARATION = {
  name: 'emit_draft',
  description: '한컴 한글 문서 초안을 JSON 구조로 출력',
  parameters: HWPX_DRAFT_SCHEMA,
};
