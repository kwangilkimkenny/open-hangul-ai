import { describe, it, expect } from 'vitest';
import {
  DRAFT_TEMPLATES,
  getTemplate,
  getTemplatesByCategory,
  buildPromptFromTemplate,
} from './index';

describe('Draft Templates', () => {
  it('6개 프리셋 모두 로드됨', () => {
    expect(DRAFT_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it('각 템플릿 — 필수 필드 존재', () => {
    for (const tpl of DRAFT_TEMPLATES) {
      expect(tpl.id).toBeTypeOf('string');
      expect(tpl.name).toBeTypeOf('string');
      expect(tpl.icon).toBeTypeOf('string');
      expect(tpl.description).toBeTypeOf('string');
      expect(Array.isArray(tpl.outline)).toBe(true);
      expect(tpl.outline.length).toBeGreaterThan(0);
      expect(tpl.promptScaffold).toBeTypeOf('string');
      expect(['공공', '기업', '연구', '범용']).toContain(tpl.category);
    }
  });

  it('템플릿 ID 는 유니크', () => {
    const ids = DRAFT_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getTemplate — 존재/미존재', () => {
    expect(getTemplate('official-letter')).toBeDefined();
    expect(getTemplate('nope')).toBeUndefined();
  });

  it('getTemplatesByCategory', () => {
    const gov = getTemplatesByCategory('공공');
    expect(gov.length).toBeGreaterThan(0);
    expect(gov.every(t => t.category === '공공')).toBe(true);
  });

  it('buildPromptFromTemplate — 사용자 입력이 outline 뒤에 포함', () => {
    const tpl = DRAFT_TEMPLATES[0];
    const out = buildPromptFromTemplate(tpl, '구체적인 사용자 요청 내용');
    expect(out).toContain(tpl.name);
    expect(out).toContain(tpl.outline[0]);
    expect(out).toContain('구체적인 사용자 요청 내용');
  });

  it('buildPromptFromTemplate — 입력 없으면 scaffold 사용', () => {
    const tpl = DRAFT_TEMPLATES[0];
    const out = buildPromptFromTemplate(tpl);
    expect(out).toContain(tpl.promptScaffold.split('\n')[0]);
  });

  it('preferredModel 이 있는 템플릿은 flash/pro 중 하나', () => {
    for (const tpl of DRAFT_TEMPLATES) {
      if (tpl.preferredModel) {
        expect(['gemini-2.5-pro', 'gemini-2.5-flash']).toContain(tpl.preferredModel);
      }
    }
  });
});
