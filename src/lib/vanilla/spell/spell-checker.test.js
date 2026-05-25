import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkText,
  applyFix,
  applyAllFixes,
  autoFix,
  getStats,
  hasHangul,
  isHangulSyllable,
} from './spell-checker.js';
import { clearAll, ignoreWord } from './user-dictionary.js';

beforeEach(() => {
  clearAll();
});

describe('spell-checker / basic', () => {
  it('returns empty array for empty input', () => {
    expect(checkText('')).toEqual([]);
    // @ts-expect-error invalid input
    expect(checkText(null)).toEqual([]);
  });

  it('returns empty array when no rules match', () => {
    const issues = checkText('완전히 정상인 문장입니다.');
    expect(issues).toEqual([]);
  });

  it('detects a single spelling issue with correct indices', () => {
    const text = '나는 됬다.';
    const issues = checkText(text);
    expect(issues.length).toBeGreaterThan(0);
    const it0 = issues[0];
    expect(it0.text).toBe('됬다');
    expect(text.slice(it0.start, it0.end)).toBe('됬다');
    expect(it0.replacement).toBe('됐다');
    expect(it0.category).toBe('spelling');
  });

  it('detects multiple issues sorted by position', () => {
    const text = '몇일 동안 깨끗히 정리했다. 그리고 됬다.';
    const issues = checkText(text);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < issues.length; i++) {
      expect(issues[i].start).toBeGreaterThanOrEqual(issues[i - 1].start);
    }
  });

  it('detects foreign loan-word issue', () => {
    const issues = checkText('맛있는 초콜렛을 먹는다.');
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe('foreign');
    expect(issues[0].replacement).toBe('초콜릿');
  });

  it('detects spacing issue', () => {
    const issues = checkText('나도 할수있다.');
    expect(issues.some((i) => i.category === 'spacing')).toBe(true);
  });

  it('respects category filter', () => {
    const text = '몇일 동안 메세지 보내며 할수있다.';
    const onlyForeign = checkText(text, { categories: ['foreign'] });
    expect(onlyForeign.every((i) => i.category === 'foreign')).toBe(true);
    expect(onlyForeign.length).toBeGreaterThanOrEqual(1);
  });

  it('respects severity filter', () => {
    const text = '나는 됬다.';
    const errs = checkText(text, { severities: ['error'] });
    expect(errs.every((i) => i.severity === 'error')).toBe(true);
  });
});

describe('spell-checker / user dictionary integration', () => {
  it('skips issues whose match is in the user dictionary ignore list', () => {
    ignoreWord('초콜렛');
    const issues = checkText('맛있는 초콜렛을 먹는다.');
    expect(issues.find((i) => i.text === '초콜렛')).toBeUndefined();
  });

  it('can disable user-dictionary respect with option', () => {
    ignoreWord('초콜렛');
    const issues = checkText('맛있는 초콜렛을 먹는다.', { respectUserDictionary: false });
    expect(issues.find((i) => i.text === '초콜렛')).toBeDefined();
  });

  it('extraIgnored option overrides per-call', () => {
    const issues = checkText('맛있는 초콜렛을 먹는다.', { extraIgnored: ['초콜렛'] });
    expect(issues.find((i) => i.text === '초콜렛')).toBeUndefined();
  });
});

describe('spell-checker / fix application', () => {
  it('applyFix returns a string with single fix applied', () => {
    const text = '맛있는 초콜렛을 먹는다.';
    const [issue] = checkText(text);
    const fixed = applyFix(text, issue);
    expect(fixed).toBe('맛있는 초콜릿을 먹는다.');
  });

  it('applyAllFixes fixes all issues without index drift', () => {
    const text = '몇일 동안 깨끗히 정리하고 됬다.';
    const issues = checkText(text);
    const fixed = applyAllFixes(text, issues);
    expect(fixed).toContain('며칠');
    expect(fixed).toContain('깨끗이');
    expect(fixed).toContain('됐다');
    expect(fixed).not.toContain('몇일');
    expect(fixed).not.toContain('깨끗히');
    expect(fixed).not.toContain('됬다');
  });

  it('autoFix returns both fixed string and issues', () => {
    const { fixed, issues } = autoFix('맛있는 초콜렛.');
    expect(issues.length).toBe(1);
    expect(fixed).toBe('맛있는 초콜릿.');
  });

  it('applyAllFixes is no-op for empty issues', () => {
    expect(applyAllFixes('hello', [])).toBe('hello');
  });
});

describe('spell-checker / stats & utilities', () => {
  it('getStats() counts by severity and category', () => {
    const text = '몇일 동안 메세지 보내며 할수있다. 됬다.';
    const issues = checkText(text);
    const s = getStats(issues);
    expect(s.total).toBe(issues.length);
    const sumSev = s.bySeverity.error + s.bySeverity.warning + s.bySeverity.info;
    expect(sumSev).toBe(s.total);
    const sumCat = s.byCategory.spelling + s.byCategory.spacing + s.byCategory.foreign + s.byCategory.particle;
    expect(sumCat).toBe(s.total);
  });

  it('hasHangul detects Korean syllables', () => {
    expect(hasHangul('hello')).toBe(false);
    expect(hasHangul('안녕')).toBe(true);
    expect(hasHangul('')).toBe(false);
  });

  it('isHangulSyllable validates single character', () => {
    expect(isHangulSyllable('가')).toBe(true);
    expect(isHangulSyllable('힣')).toBe(true);
    expect(isHangulSyllable('a')).toBe(false);
    expect(isHangulSyllable('')).toBe(false);
  });
});
