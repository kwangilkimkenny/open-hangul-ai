/**
 * Font Metrics Persistence — idb-factory 통합 확인
 *
 * 1.x → 2.x 마이그레이션 후 외부 API 가 그대로 유지되는지,
 * `idb-factory` 의 메모리 폴백 공유 Map 을 올바르게 사용하는지 검증한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  STORE_NAME,
  buildCacheKey,
  readMetrics,
  writeMetrics,
  deleteMetrics,
  listMetrics,
  clearCache,
  memoryCacheSize,
} from './persistence.js';

import {
  __getRegisteredStores,
  getMemoryFallback,
} from '../../storage/idb-factory.ts';

beforeEach(async () => {
  await clearCache();
});

describe('font-metrics/persistence — idb-factory 통합', () => {
  it('모듈 로드 시 font-metrics 스토어가 팩토리에 등록된다', () => {
    expect(__getRegisteredStores()).toContain(STORE_NAME);
    expect(STORE_NAME).toBe('font-metrics');
  });

  it('writeMetrics 는 idb-factory 의 공유 메모리 Map 에 즉시 반영된다', async () => {
    const key = buildCacheKey('테스트폰트');
    await writeMetrics(key, { familyName: '테스트폰트', ascent: 800 });

    // idb-factory 가 노출하는 메모리 Map 으로 직접 확인 — 자체 Map 이
    // 아니라 팩토리 공유 Map 을 사용한다는 사실의 증거.
    const mem = getMemoryFallback(STORE_NAME);
    expect(mem.has(key)).toBe(true);
    expect(/** @type {any} */ (mem.get(key)).familyName).toBe('테스트폰트');
  });

  it('readMetrics 는 메모리 hit 으로 즉시 반환된다', async () => {
    const key = buildCacheKey('읽기테스트');
    await writeMetrics(key, { familyName: '읽기테스트', ascent: 750 });
    const got = await readMetrics(key);
    expect(got).not.toBeNull();
    expect(got.ascent).toBe(750);
  });

  it('readMetrics 는 미존재 키에 대해 null 을 반환한다', async () => {
    const got = await readMetrics(buildCacheKey('없는폰트'));
    expect(got).toBeNull();
  });

  it('buildCacheKey 는 family + variant + version 을 정규화한다', () => {
    expect(buildCacheKey('Nanum Gothic')).toBe('nanumgothic|400-normal|v1');
    expect(buildCacheKey('  맑은  고딕  ', '700-italic', 'v2')).toBe(
      '맑은고딕|700-italic|v2',
    );
  });

  it('deleteMetrics 는 메모리 Map 에서 해당 키를 제거한다', async () => {
    const key = buildCacheKey('지울폰트');
    await writeMetrics(key, { familyName: '지울폰트' });
    expect(memoryCacheSize()).toBeGreaterThanOrEqual(1);
    await deleteMetrics(key);
    const got = await readMetrics(key);
    expect(got).toBeNull();
  });

  it('listMetrics 는 메모리에 저장된 모든 키를 반환한다', async () => {
    await writeMetrics(buildCacheKey('A'), { familyName: 'A' });
    await writeMetrics(buildCacheKey('B'), { familyName: 'B' });
    await writeMetrics(buildCacheKey('C'), { familyName: 'C' });
    const keys = await listMetrics();
    expect(keys.length).toBeGreaterThanOrEqual(3);
    expect(keys).toContain(buildCacheKey('A'));
    expect(keys).toContain(buildCacheKey('B'));
    expect(keys).toContain(buildCacheKey('C'));
  });

  it('clearCache 는 memoryCacheSize 를 0 으로 만든다', async () => {
    await writeMetrics(buildCacheKey('X'), { familyName: 'X' });
    expect(memoryCacheSize()).toBeGreaterThanOrEqual(1);
    await clearCache();
    expect(memoryCacheSize()).toBe(0);
  });

  it('memoryCacheSize 는 idb-factory 공유 Map 의 size 를 반영한다', async () => {
    const mem = getMemoryFallback(STORE_NAME);
    expect(mem.size).toBe(memoryCacheSize());
    await writeMetrics(buildCacheKey('Y'), { familyName: 'Y' });
    expect(mem.size).toBe(memoryCacheSize());
  });
});
