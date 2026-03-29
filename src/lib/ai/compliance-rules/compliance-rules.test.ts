import { describe, it, expect } from 'vitest';
import { FRAMEWORKS, FRAMEWORK_LIST, EU_AI_ACT, K_AI_ACT, NIST_AI_RMF, OWASP_LLM_TOP10 } from './index';
import type { FrameworkMeta, FrameworkType } from '../../../types/compliance';

describe('Compliance Rules', () => {
  // =========================================
  // Index exports
  // =========================================

  describe('index exports', () => {
    it('FRAMEWORKS에 4개 프레임워크가 있어야 한다', () => {
      const keys = Object.keys(FRAMEWORKS);
      expect(keys).toHaveLength(4);
      expect(keys).toContain('eu-ai-act');
      expect(keys).toContain('k-ai-act');
      expect(keys).toContain('nist-ai-rmf');
      expect(keys).toContain('owasp-llm-top10');
    });

    it('FRAMEWORK_LIST에 4개 프레임워크가 있어야 한다', () => {
      expect(FRAMEWORK_LIST).toHaveLength(4);
    });

    it('FRAMEWORKS와 FRAMEWORK_LIST가 동일한 데이터를 가져야 한다', () => {
      for (const fw of FRAMEWORK_LIST) {
        expect(FRAMEWORKS[fw.id]).toBe(fw);
      }
    });
  });

  // =========================================
  // 공통 구조 검증
  // =========================================

  describe.each([
    ['EU AI Act', EU_AI_ACT],
    ['K-AI Act', K_AI_ACT],
    ['NIST AI RMF', NIST_AI_RMF],
    ['OWASP LLM Top 10', OWASP_LLM_TOP10],
  ])('%s 구조 검증', (name, fw: FrameworkMeta) => {
    it('필수 필드가 존재해야 한다', () => {
      expect(fw.id).toBeDefined();
      expect(fw.name).toBeDefined();
      expect(fw.subtitle).toBeDefined();
      expect(fw.description).toBeDefined();
      expect(fw.version).toBeDefined();
      expect(fw.icon).toBeDefined();
      expect(fw.tags).toBeDefined();
      expect(fw.categories).toBeDefined();
    });

    it('id가 유효한 FrameworkType이어야 한다', () => {
      const validIds: FrameworkType[] = ['eu-ai-act', 'k-ai-act', 'nist-ai-rmf', 'owasp-llm-top10'];
      expect(validIds).toContain(fw.id);
    });

    it('tags가 1개 이상이어야 한다', () => {
      expect(fw.tags.length).toBeGreaterThanOrEqual(1);
    });

    it('categories가 1개 이상이어야 한다', () => {
      expect(fw.categories.length).toBeGreaterThanOrEqual(1);
    });

    it('모든 카테고리에 checks가 있어야 한다', () => {
      for (const cat of fw.categories) {
        expect(cat.name).toBeDefined();
        expect(cat.checks.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('모든 check에 id와 description이 있어야 한다', () => {
      for (const cat of fw.categories) {
        for (const check of cat.checks) {
          expect(check.id).toBeDefined();
          expect(check.id.length).toBeGreaterThan(0);
          expect(check.description).toBeDefined();
          expect(check.description.length).toBeGreaterThan(0);
        }
      }
    });

    it('check id가 프레임워크 내에서 고유해야 한다', () => {
      const ids = fw.categories.flatMap((c) => c.checks.map((ch) => ch.id));
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // =========================================
  // 프레임워크별 상세 검증
  // =========================================

  describe('EU AI Act 상세', () => {
    it('5개 카테고리가 있어야 한다', () => {
      expect(EU_AI_ACT.categories).toHaveLength(5);
      const names = EU_AI_ACT.categories.map((c) => c.name);
      expect(names).toContain('Transparency');
      expect(names).toContain('Risk Management');
      expect(names).toContain('Data Governance');
      expect(names).toContain('Human Oversight');
      expect(names).toContain('Technical Robustness');
    });

    it('Transparency 항목에 Article 참조가 있어야 한다', () => {
      const transparency = EU_AI_ACT.categories.find((c) => c.name === 'Transparency')!;
      const withArticle = transparency.checks.filter((c) => c.article);
      expect(withArticle.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('K-AI Act 상세', () => {
    it('5개 카테고리가 있어야 한다', () => {
      expect(K_AI_ACT.categories).toHaveLength(5);
      const names = K_AI_ACT.categories.map((c) => c.name);
      expect(names).toContain('안전성');
      expect(names).toContain('투명성');
      expect(names).toContain('공정성');
      expect(names).toContain('책임성');
      expect(names).toContain('프라이버시');
    });
  });

  describe('NIST AI RMF 상세', () => {
    it('4개 카테고리(Govern/Map/Measure/Manage)가 있어야 한다', () => {
      expect(NIST_AI_RMF.categories).toHaveLength(4);
      const names = NIST_AI_RMF.categories.map((c) => c.name);
      expect(names).toEqual(['Govern', 'Map', 'Measure', 'Manage']);
    });
  });

  describe('OWASP LLM Top 10 상세', () => {
    it('10개 카테고리(LLM01~LLM10)가 있어야 한다', () => {
      expect(OWASP_LLM_TOP10.categories).toHaveLength(10);
    });

    it('LLM01이 Prompt Injection이어야 한다', () => {
      expect(OWASP_LLM_TOP10.categories[0].name).toContain('Prompt Injection');
    });

    it('총 체크 항목이 20개 이상이어야 한다', () => {
      const totalChecks = OWASP_LLM_TOP10.categories.reduce((s, c) => s + c.checks.length, 0);
      expect(totalChecks).toBeGreaterThanOrEqual(20);
    });
  });
});
