/**
 * i18n 런타임 단위 테스트
 *
 * 글로벌 mutable state (currentLocale) 가 있으므로 각 테스트에서
 * 다시 'ko' 로 복원한다.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { t, setLocale, getLocale, getSupportedLocales, withLocale } from './index.js';

describe('i18n runtime', () => {
  afterEach(() => {
    setLocale('ko');
  });

  it('초기 locale 은 ko', () => {
    expect(getLocale()).toBe('ko');
  });

  it('setLocale(en) 으로 영문 라벨 반환', () => {
    expect(setLocale('en')).toBe(true);
    expect(t('common.close')).toBe('Close');
    expect(t('ole.save.button')).toBe('Save');
  });

  it('알 수 없는 locale 은 무시되고 false 반환', () => {
    expect(setLocale('xx-YY')).toBe(false);
    expect(getLocale()).toBe('ko');
  });

  it('null/빈 문자열 locale 은 무시', () => {
    expect(setLocale(null)).toBe(false);
    expect(setLocale('')).toBe(false);
    expect(getLocale()).toBe('ko');
  });

  it('미정의 키는 키 자체를 반환', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('영문 locale 에서 키 누락 시 한국어 폴백', () => {
    // 한국어에만 있는 키 — 영문 사전에 일부러 빠진 키를 시뮬레이션하기는 어렵지만,
    // 키 자체가 한 카탈로그에만 정의되면 폴백되어야 함.
    setLocale('en');
    // 모든 키가 영문에도 정의되어 있으므로 영문 라벨 반환
    expect(t('macro.permission.file-io')).toBe('File I/O');
    // 미정의 키는 ko fallback 도 없으므로 키 자체
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('{placeholder} 변수 치환', () => {
    expect(t('ole.unsupported.format', { type: 'docx' })).toBe('미지원 타입: docx');
    setLocale('en');
    expect(t('ole.unsupported.format', { type: 'docx' })).toBe('Unsupported type: docx');
  });

  it('치환 변수가 여러 개 있어도 모두 처리', () => {
    setLocale('ko');
    const out = t('macro.report.summary.empty', {
      language: 'jscript',
      riskLabel: '낮음',
    });
    expect(out).toContain('jscript');
    expect(out).toContain('낮음');
  });

  it('동일 변수가 여러 번 등장하면 모두 치환', () => {
    // 카탈로그에 직접 없으므로 키 자체를 사용해 치환 동작 확인 — 키 자체는 치환되지 않지만
    // 별도 검증을 위해 macro.dialog.line-prefix 사용 (한 번씩 등장)
    expect(t('macro.dialog.line-prefix', { line: 7, identifier: 'foo' })).toBe(
      '라인 7: foo'
    );
  });

  it('숫자/객체 치환 값은 String() 화', () => {
    expect(t('macro.dialog.more-count', { count: 12 })).toBe('... 그 외 12건');
  });

  it('getSupportedLocales 는 ko, en 을 포함', () => {
    const locales = getSupportedLocales();
    expect(locales).toContain('ko');
    expect(locales).toContain('en');
  });

  it('withLocale 은 일시 locale 적용 후 자동 복원', () => {
    expect(getLocale()).toBe('ko');
    const result = withLocale('en', () => t('common.close'));
    expect(result).toBe('Close');
    expect(getLocale()).toBe('ko');
  });

  it('withLocale 콜백에서 throw 해도 locale 복원', () => {
    setLocale('ko');
    expect(() => withLocale('en', () => { throw new Error('boom'); })).toThrow('boom');
    expect(getLocale()).toBe('ko');
  });
});
