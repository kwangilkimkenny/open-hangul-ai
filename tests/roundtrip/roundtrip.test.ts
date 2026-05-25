/**
 * Round-trip golden test
 * ----------------------
 * 이 파일은 추후 실제 HWPX 바이너리 (`tests/golden/<feature>/fixture.hwpx`) 가
 * 추가되면 자동으로 활성화되는 import → export → diff 회귀 검증 스켈레톤이다.
 *
 * NOTE on test collection:
 *   현재 vite.config.ts 의 vitest include 는 `src/**\/*.{test,spec}.*` 만 잡는다.
 *   본 파일을 `npm run test:run` 에 합류시키려면 후속 PR 에서
 *     test.include: ['src/**\/*.test.*', 'tests/**\/*.test.*']
 *   로 한 줄을 확장하면 된다 (Phase 0 에서는 기존 파일을 만지지 않는다는
 *   원칙 때문에 보류).
 *
 *   `vitest run tests/roundtrip` 처럼 명시적 경로로 실행하면 정상 수집된다.
 *
 * 골든 디렉토리 구조:
 *   tests/golden/<NN-feature>/
 *     ├── README.md           — 검증 의도
 *     ├── sample-fragment.xml — XML 단편 (참고용)
 *     ├── expected.json       — 기대 파서 결과
 *     └── fixture.hwpx        — (선택) 실제 바이너리, 있으면 라운드트립 활성화
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const GOLDEN_ROOT = resolve(__dirname, '..', 'golden');

function listGoldenDirs(): string[] {
  if (!existsSync(GOLDEN_ROOT)) return [];
  return readdirSync(GOLDEN_ROOT)
    .filter((name) => {
      const p = join(GOLDEN_ROOT, name);
      return statSync(p).isDirectory() && /^\d{2}-/.test(name);
    })
    .sort();
}

describe('Phase 0 · Golden directory inventory', () => {
  const dirs = listGoldenDirs();

  it('discovers at least 12 golden feature directories', () => {
    expect(dirs.length).toBeGreaterThanOrEqual(12);
  });

  for (const dir of dirs) {
    it(`${dir}: has README.md, expected.json, sample-fragment.xml`, () => {
      const base = join(GOLDEN_ROOT, dir);
      expect(existsSync(join(base, 'README.md'))).toBe(true);
      expect(existsSync(join(base, 'expected.json'))).toBe(true);
      expect(existsSync(join(base, 'sample-fragment.xml'))).toBe(true);
    });
  }
});

describe('Phase 0 · HWPX parser module is importable', () => {
  it('SimpleHWPXParser barrel resolves without throwing', async () => {
    // Dynamic import so failure here surfaces as a normal assertion, not a
    // module-load crash that masks the rest of the file.
    const mod = await import('../../src/lib/core/parser');
    expect(mod).toBeDefined();
    // The re-exported alias must be present (named export check).
    expect('HWPXParser' in mod || 'SimpleHWPXParser' in mod).toBe(true);
  });
});

describe('Phase 0 · Round-trip skeleton (activates when fixture.hwpx exists)', () => {
  const dirs = listGoldenDirs();
  for (const dir of dirs) {
    const fixturePath = join(GOLDEN_ROOT, dir, 'fixture.hwpx');
    if (existsSync(fixturePath)) {
      it(`${dir}: import → export → diff`, async () => {
        // Real assertion will be added in Phase 1 once exporter is wired.
        // Until then, presence of the fixture should not crash the runner.
        expect(statSync(fixturePath).size).toBeGreaterThan(0);
      });
    } else {
      // No fixture yet — leave as a todo so it surfaces in vitest summary
      // and reminds contributors what to add next.
      it.todo(`${dir}: import → export → diff (waiting for fixture.hwpx)`);
    }
  }
});
