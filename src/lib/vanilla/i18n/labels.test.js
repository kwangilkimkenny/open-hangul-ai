/**
 * labels.js — 카탈로그 완전성 검증
 *
 * 영문 스켈레톤이 한국어 키와 동일한 집합을 갖는지 확인하여,
 * 영문 locale 사용 시 폴백 없이도 의미 있는 라벨이 표시되도록 보장.
 */
import { describe, it, expect } from 'vitest';
import { LABELS, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './labels.js';

describe('i18n/labels', () => {
  it('한국어 카탈로그가 진리원천으로 존재한다', () => {
    expect(LABELS.ko).toBeTruthy();
    expect(Object.keys(LABELS.ko).length).toBeGreaterThan(20);
  });

  it('기본 locale 은 한국어', () => {
    expect(DEFAULT_LOCALE).toBe('ko');
  });

  it('영문 카탈로그가 존재하고 한국어 키와 동일 집합을 갖는다', () => {
    expect(LABELS.en).toBeTruthy();
    const koKeys = new Set(Object.keys(LABELS.ko));
    const enKeys = new Set(Object.keys(LABELS.en));
    const missingInEn = [...koKeys].filter(k => !enKeys.has(k));
    const extraInEn = [...enKeys].filter(k => !koKeys.has(k));
    expect(missingInEn).toEqual([]);
    expect(extraInEn).toEqual([]);
  });

  it('SUPPORTED_LOCALES 에 ko, en 이 모두 포함된다', () => {
    expect(SUPPORTED_LOCALES).toContain('ko');
    expect(SUPPORTED_LOCALES).toContain('en');
  });

  it('주요 macro-sandbox 권한 키가 모든 locale 에 존재한다', () => {
    const required = [
      'macro.permission.file-io',
      'macro.permission.network',
      'macro.permission.shell',
      'macro.permission.activex',
    ];
    for (const locale of ['ko', 'en']) {
      for (const key of required) {
        expect(LABELS[locale][key], `${locale}/${key}`).toBeTruthy();
      }
    }
  });

  it('주요 ole-editor 키가 모든 locale 에 존재한다', () => {
    const required = [
      'ole.unsupported.message',
      'ole.unsupported.format',
      'ole.save.button',
      'ole.cancel.button',
      'ole.saving.indicator',
    ];
    for (const locale of ['ko', 'en']) {
      for (const key of required) {
        expect(LABELS[locale][key], `${locale}/${key}`).toBeTruthy();
      }
    }
  });

  it('common 키가 모든 locale 에 존재한다', () => {
    for (const locale of ['ko', 'en']) {
      expect(LABELS[locale]['common.close']).toBeTruthy();
      expect(LABELS[locale]['common.cancel']).toBeTruthy();
      expect(LABELS[locale]['common.confirm']).toBeTruthy();
    }
  });
});
