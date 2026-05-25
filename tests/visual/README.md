# Visual Regression Test Setup

본 디렉토리는 **Playwright + pixelmatch** 조합의 시각 회귀(visual regression)
테스트 셋업 가이드입니다. Phase 0 에서는 디렉토리 구조와 가이드만 제공하며
실제 실행 코드는 Phase 1 에서 추가됩니다.

## 목표

HWPX 문서 렌더링 결과가 PR 사이에 시각적으로 회귀하지 않는지를 픽셀 단위로
보장합니다. 텍스트 줄바꿈, 표 셀 위치, 도형 회전 등 사람 눈으로 확인해야
하는 출력을 자동화합니다.

## 디렉토리 구조

```
tests/visual/
├── README.md                   ← 본 문서
├── baseline/                   ← 기준 PNG (git 으로 버전관리)
│   ├── 01-paragraph.png
│   ├── 02-table.png
│   └── ...
├── current/                    ← 테스트 실행 시 캡처 (gitignore 권장)
└── diff/                       ← 차이 시각화 (gitignore 권장)
```

## 의존성 (Phase 1 도입 예정)

```bash
npm install -D pixelmatch pngjs
# Playwright 는 이미 @playwright/test 로 설치되어 있음
```

## 베이스라인 캡처 (Phase 1 셸 예시)

```bash
# 모든 골든 디렉토리를 순회하며 새 baseline 생성
npx playwright test tests/visual --update-snapshots
```

## 회귀 검증 (Phase 1 셸 예시)

```bash
# CI 에서 실행. diff PNG 가 임계치 (기본 0.1%) 초과 시 fail
npx playwright test tests/visual
```

## 테스트 패턴 (Phase 1 작성 예시)

```ts
// tests/visual/01-paragraph.visual.spec.ts
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

test('paragraph alignment renders pixel-stable', async ({ page }) => {
  await page.goto('/?fixture=tests/golden/01-paragraph/fixture.hwpx');
  await page.waitForSelector('.hwpx-page');

  const buf = await page.locator('.hwpx-page').screenshot();
  const current = PNG.sync.read(buf);
  const baseline = PNG.sync.read(readFileSync('tests/visual/baseline/01-paragraph.png'));
  const diff = new PNG({ width: current.width, height: current.height });

  const mismatch = pixelmatch(
    current.data, baseline.data, diff.data,
    current.width, current.height,
    { threshold: 0.1 }
  );
  const totalPx = current.width * current.height;
  expect(mismatch / totalPx).toBeLessThan(0.001); // < 0.1%
});
```

## .gitignore 권장 패턴

`tests/visual/current/`, `tests/visual/diff/` 는 매 실행마다 새로 생성되므로
프로젝트 루트의 `.gitignore` 에 다음을 추가하길 권장합니다 (Phase 1 작업 시
적용):

```
tests/visual/current/
tests/visual/diff/
```

## 베이스라인 갱신 절차

1. 의도된 시각 변경이 있는 PR 에서 `npx playwright test --update-snapshots` 실행
2. `tests/visual/baseline/*.png` 변경분 검토
3. PR 설명에 "visual baseline updated" 명시 후 커밋
4. 리뷰어는 변경된 PNG 를 직접 눈으로 확인 후 승인

## 관련 항목

- 골든 파일 디렉토리: `tests/golden/`
- 적합성 매트릭스:    `tests/conformance.yaml`
- 라운드트립 테스트:  `tests/roundtrip/roundtrip.test.ts`
