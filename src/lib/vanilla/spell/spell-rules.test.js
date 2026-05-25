import { describe, it, expect } from 'vitest';
import {
  SPELLING_RULES,
  SPACING_RULES,
  FOREIGN_RULES,
  PARTICLE_RULES,
  getAllRules,
  getRuleStats,
  getRulesByCategory,
  findRuleById,
} from './spell-rules.js';

/**
 * 한 규칙이 주어진 텍스트에서 (적어도 한 번) 매칭하는지 빠르게 검사.
 * 각 RegExp 는 'g' 플래그를 가지므로 lastIndex 를 미리 0으로 초기화.
 * @param {string} ruleId
 * @param {string} text
 * @returns {{ matched: boolean, replaced: string }}
 */
function runRule(ruleId, text) {
  const rule = findRuleById(ruleId);
  if (!rule) return { matched: false, replaced: text };
  rule.pattern.lastIndex = 0;
  const matched = rule.pattern.test(text);
  rule.pattern.lastIndex = 0;
  const replaced = text.replace(rule.pattern, rule.replacement);
  return { matched, replaced };
}

describe('spell-rules / catalog', () => {
  it('exports four non-empty categories', () => {
    expect(SPELLING_RULES.length).toBeGreaterThanOrEqual(50);
    expect(SPACING_RULES.length).toBeGreaterThanOrEqual(20);
    expect(FOREIGN_RULES.length).toBeGreaterThanOrEqual(25);
    expect(PARTICLE_RULES.length).toBeGreaterThanOrEqual(8);
  });

  it('getAllRules() returns 100+ rules total', () => {
    expect(getAllRules().length).toBeGreaterThanOrEqual(100);
  });

  it('every rule has the required shape', () => {
    for (const r of getAllRules()) {
      expect(typeof r.id).toBe('string');
      expect(r.id.length).toBeGreaterThan(0);
      expect(r.pattern).toBeInstanceOf(RegExp);
      expect(typeof r.replacement).toBe('string');
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(['spelling', 'spacing', 'foreign', 'particle']).toContain(r.category);
      expect(typeof r.hint).toBe('string');
    }
  });

  it('rule IDs are unique', () => {
    const ids = getAllRules().map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('getRuleStats() returns aggregated counts', () => {
    const s = getRuleStats();
    expect(s.spelling).toBe(SPELLING_RULES.length);
    expect(s.spacing).toBe(SPACING_RULES.length);
    expect(s.foreign).toBe(FOREIGN_RULES.length);
    expect(s.particle).toBe(PARTICLE_RULES.length);
    expect(s.total).toBe(s.spelling + s.spacing + s.foreign + s.particle);
  });

  it('getRulesByCategory("foreign") returns only foreign rules', () => {
    const rules = getRulesByCategory('foreign');
    expect(rules.length).toBe(FOREIGN_RULES.length);
    for (const r of rules) expect(r.category).toBe('foreign');
  });

  it('getRulesByCategory("unknown") returns empty array', () => {
    // @ts-expect-error invalid input
    expect(getRulesByCategory('unknown')).toEqual([]);
  });
});

describe('spell-rules / spelling category (A)', () => {
  it("matches '있읍니다' → '있습니다'", () => {
    const r = runRule('sp-eupnida', '여기에 있읍니다.');
    expect(r.matched).toBe(true);
    expect(r.replaced).toBe('여기에 있습니다.');
  });

  it("matches '됬다' → '됐다'", () => {
    expect(runRule('sp-doeda', '드디어 됬다.').matched).toBe(true);
  });

  it("matches '왠지' typo '웬지' → '왠지'", () => {
    const r = runRule('sp-waenji', '웬지 슬프다');
    expect(r.matched).toBe(true);
    expect(r.replaced).toBe('왠지 슬프다');
  });

  it("matches '금새' → '금세'", () => {
    expect(runRule('sp-geumse', '금새 끝났다').replaced).toBe('금세 끝났다');
  });

  it("matches '구지' → '굳이'", () => {
    expect(runRule('sp-guji', '구지 그럴 필요는').replaced).toBe('굳이 그럴 필요는');
  });

  it("matches '오랫만' → '오랜만'", () => {
    expect(runRule('sp-oraenman', '오랫만에 만났다').replaced).toBe('오랜만에 만났다');
  });

  it("matches '깍다' → '깎다'", () => {
    expect(runRule('sp-kkakkda', '연필을 깍다.').replaced).toBe('연필을 깎다.');
  });

  it("matches '어떻해' → '어떡해'", () => {
    expect(runRule('sp-eotteokae', '나 어떻해').replaced).toBe('나 어떡해');
  });

  it("matches '몇일' → '며칠'", () => {
    expect(runRule('sp-myeochil', '몇일 동안').replaced).toBe('며칠 동안');
  });

  it("matches '역활' → '역할'", () => {
    expect(runRule('sp-yeokhal', '주요 역활을').replaced).toBe('주요 역할을');
  });

  it("matches '어의없' → '어이없'", () => {
    expect(runRule('sp-eoieopda', '어의없는 일이').replaced).toBe('어이없는 일이');
  });

  it("matches '깨끗히' → '깨끗이'", () => {
    expect(runRule('sp-kkaekkeusi', '깨끗히 청소했다').replaced).toBe('깨끗이 청소했다');
  });
});

describe('spell-rules / spacing category (B)', () => {
  it("matches '할수있' → '할 수 있'", () => {
    expect(runRule('sp-halsuitda', '나도 할수있다').replaced).toBe('나도 할 수 있다');
  });

  it("matches '먹을것' → '먹을 것'", () => {
    expect(runRule('sp-meogeulgeot', '먹을것이 없다').replaced).toBe('먹을 것이 없다');
  });

  it("matches '읽고있' → '읽고 있'", () => {
    expect(runRule('sp-ikgoitda', '책을 읽고있다').replaced).toBe('책을 읽고 있다');
  });

  it("matches '한개' → '한 개'", () => {
    expect(runRule('sp-hangae', '사과 한개').replaced).toBe('사과 한 개');
  });
});

describe('spell-rules / foreign category (C)', () => {
  it("matches '초콜렛' → '초콜릿'", () => {
    expect(runRule('fr-chocolit', '맛있는 초콜렛').replaced).toBe('맛있는 초콜릿');
  });

  it("matches '메세지' → '메시지'", () => {
    expect(runRule('fr-message', '메세지 도착').replaced).toBe('메시지 도착');
  });

  it("matches '리더쉽' → '리더십'", () => {
    expect(runRule('fr-leadership', '뛰어난 리더쉽').replaced).toBe('뛰어난 리더십');
  });

  it("matches '컨텐츠' → '콘텐츠'", () => {
    expect(runRule('fr-contents', '컨텐츠 제작').replaced).toBe('콘텐츠 제작');
  });

  it("matches '워크샵' → '워크숍'", () => {
    expect(runRule('fr-workshop', '워크샵 일정').replaced).toBe('워크숍 일정');
  });
});

describe('spell-rules / particle category (D)', () => {
  it("matches '일찍히' → '일찍이'", () => {
    expect(runRule('pt-iljjikhi', '아침에 일찍히 일어나').replaced).toBe('아침에 일찍이 일어나');
  });

  it("matches '할께' → '할게'", () => {
    expect(runRule('pt-rge', '내가 할께').replaced).toBe('내가 할게');
  });

  it("matches '갈께' → '갈게'", () => {
    expect(runRule('pt-galge', '먼저 갈께').replaced).toBe('먼저 갈게');
  });
});

describe('spell-rules / safety', () => {
  it('regex patterns do not get stuck (no infinite zero-width matches)', () => {
    const text = '나도 할수있다. 할수있다. 할수있다.';
    const rule = findRuleById('sp-halsuitda');
    rule.pattern.lastIndex = 0;
    let count = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      count++;
      if (count > 10) break;
      if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
    }
    expect(count).toBe(3);
  });
});
