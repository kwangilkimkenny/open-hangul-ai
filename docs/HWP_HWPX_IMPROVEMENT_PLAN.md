# HWP/HWPX 정교 파서·렌더러 — 점검 결과 및 개선 로드맵

> 점검 4축: 현행 인벤토리 · HWP 바이너리 경로 · 공식 명세 · 렌더러 미지원 영역
> 기준일: 2026-05-25 · 현 버전 v5.0.5

---

## A. 현 상태 종합

### A-1. 파서 (HWPX 직접 파싱) — 현 수준 우수, 약 90%

- `SimpleHWPXParser`(`src/lib/vanilla/core/parser.js`, 2,600줄)는 header.xml
  single-pass + 본문 재귀 구조로 35+ 태그 × 80+ 속성 파싱
- borderFill/fontFace/paraPr/charPr/numbering/bullet/tabDef/style 컬렉션 완전
  추출
- 표(병합/중첩/높이 타입), 도형(rect/ellipse/line/picture),
  필드(date/page/filename/mailmerge)까지 데이터 모델로 들어옴

### A-2. HWP 바이너리 경로 — 변환 의존, 약 95%

- 모든 `.hwp` 입력은 `hwp2hwpx-js`로 메모리 변환 후 HWPX 경로로 합류
  (`HWPXViewerWrapper.tsx:357-399`)
- hwp2hwpx-js는 이미 cfb 기반 직접 파싱 (외부 서버 없음, 순수 JS)
- 손실: 매크로 100%, OLE 임베드 100%, 양식 컨트롤 100%, TrackChange/메모 부분
- `.hwp` 역저장은 불가능 (Hwpx2Hwp 역변환기 미완성)

### A-3. 렌더러 — 갭이 가장 큼, 약 60-70%

- 파서는 읽지만 렌더러가 무시/단순화하는 영역이 큰 갭의 본체
- 인라인 컨트롤(각주·미주·필드·책갈피), 페이지 요소(머리/꼬리말·다단·페이지
  테두리·워터마크), 도형 고급 속성(그라데이션·그림자·회전·곡선/호/다각형 SVG)이
  통째로 누락 또는 단순 텍스트 격하

### A-4. canvas-editor 라운드트립 — Phase 1 명시 제약

- `hwpx-to-canvas-editor.js:9-19` 주석에 "Out of scope: list numbering,
  footnotes, fields, shapes, complex floating positions, header/footer
  round-trip" 명시
- canvas 모드 편집 후 저장 시 위 정보가 의도적으로 손실

---

## B. 공식 명세 vs 현 구현 갭 매트릭스

| 영역                                       | 한글 공식 기능 |      파서      |           렌더러            |      라운드트립       |   갭 등급   |
| ------------------------------------------ | -------------- | :------------: | :-------------------------: | :-------------------: | :---------: |
| 단락 정렬/들여쓰기/줄간격                  | 완전           |       ✅       |             ✅              |          ✅           |     🟢      |
| 글자 7-국어 글꼴, 굵기/색/밑줄/취소        | 완전           |       ✅       |             ✅              |          ✅           |     🟢      |
| 자간/장평/위첨자/아래첨자                  | 완전           |       ✅       |             ✅              |          ✅           |     🟢      |
| 글자 외곽선/그림자/양각/음각/강조점        | 완전           |       ✅       |           🟡 부분           |          🟡           |     🟡      |
| 발음 표기(루비/Dutmal)                     | 지원           |       ✅       |             ❌              |          ❌           |     🔴      |
| 한자 변환(괄호 병기)                       | 지원           |       ⚠️       |             ❌              |          ❌           |     🔴      |
| 표 행/열/병합/중첩                         | 완전           |       ✅       |             ✅              |          ✅           |     🟢      |
| 표 헤더 행 페이지 반복                     | 지원           |       ✅       |     ❌ HTML table 한계      |          ❌           |     🔴      |
| 표 셀 그라데이션/이미지 채우기             | 지원           |       ✅       |          🟡 패턴만          |          🟡           |     🟡      |
| 셀 회전/임의 각도 텍스트 회전              | 지원           |       ✅       |             ❌              |          ❌           |     🔴      |
| 도형 rect/ellipse/line                     | 지원           |       ✅       |             ✅              |          🟡           |     🟢      |
| 도형 curve/arc/polygon/freeform            | 지원           |       ✅       |        ❌ SVG 미구현        |          ❌           |     🔴      |
| 도형 그라데이션·그림자·회전·3D             | 지원           |       ✅       |             ❌              |          ❌           |     🔴      |
| 도형 wrap(square/tight/through/top-bottom) | 지원           |       ✅       |         🟡 BEHIND만         |          ❌           |     🔴      |
| 그림 효과(밝기/대비/색조)                  | 지원           |       ✅       |    ❌ CSS filter 미적용     |          ❌           |     🟡      |
| 머리말/꼬리말 (짝/홀/첫)                   | 완전           |       ✅       |          ❌ 렌더 0          |          ❌           |     🔴      |
| 쪽 번호(동적)                              | 완전           |       ✅       |       ❌ 고정 텍스트        |          ❌           |     🔴      |
| 각주/미주                                  | 완전           |       ✅       |          ❌ 렌더 0          |          ❌           |     🔴      |
| 다단(multi-column)·단 구분선               | 완전           |       ✅       |    ❌ CSS columns 미사용    |          ❌           |     🔴      |
| 페이지 테두리/워터마크                     | 지원           |       ✅       |             ❌              |          ❌           |     🔴      |
| 글머리표/한글식 번호(가/나/ㄱ/일)          | 완전           |       ✅       |             ✅              | 🟡 canvas-editor 손실 |     🟡      |
| 책갈피·하이퍼링크                          | 완전           |       ✅       | 🟡 하이퍼링크 run-loop 누락 |          ❌           |     🔴      |
| 필드(date/time/page/filename/author)       | 완전           |       ✅       |     🟡 정적 placeholder     |          ❌           |     🟡      |
| 메일 병합                                  | 완전           |   🟡 구조만    |             ❌              |          ❌           |     🟡      |
| 상호 참조·색인·차례(TOC)                   | 완전           |       🟡       |       ❌ 동적 생성 0        |          ❌           |     🔴      |
| 메모/주석(comment)                         | 완전           |       ⚠️       |             ❌              |          ❌           |     🔴      |
| 변경 추적(track changes)                   | 완전           |       ⚠️       |       🟡 별도 패널만        |          ❌           |     🟡      |
| 양식 컨트롤(checkbox/radio/combo/edit)     | 완전           |       ⚠️       |             ❌              |          ❌           |     🔴      |
| 누름틀(input form)                         | 완전           |       ⚠️       |             ❌              |          ❌           |     🟡      |
| 한컴 자체 수식(MathML I/O)                 | 완전           | 🟡 placeholder |        🟡 KaTeX 한정        |          ❌           |     🔴      |
| 차트(막대/선/원/방사형)                    | 완전           |       ❌       |             ❌              |          ❌           |     🔴      |
| OLE 임베드(Excel/Word)                     | 지원           |       ❌       |             ❌              |          ❌           |     🔴      |
| 매크로(JScript/BeanShell)                  | 지원           |  ❌ 보안 차단  |             ❌              |          ❌           | ⚫ (의도적) |
| HWP → HWPX 변환                            | —              | ✅ hwp2hwpx-js |              —              |           —           |     🟢      |
| HWPX → HWP 역변환                          | —              |       ❌       |              —              |          ❌           |     🔴      |

레전드: 🟢 양호 / 🟡 부분 / 🔴 큰 갭 / ⚫ 의도적 제외

---

## C. 단계별 개선 로드맵 (6단계, 약 6개월)

### Phase 0 — 기반 인프라 (1주, 모든 후속의 전제)

1. 골든 파일 테스트 셋 구축 — 한글 공식 기능별 샘플 HWPX 30~50개를
   `tests/golden/`
2. KS X 6101 적합성 매트릭스 YAML — `tests/conformance.yaml`로 코드화
3. Round-trip diff 테스트 — `import → export → diff` 자동화
4. 렌더 시각 회귀 — Playwright + pixelmatch

### Phase 1 — 작은 갭 즉시 메우기 (1-2주)

| #   | 항목                      | 위치                                |
| --- | ------------------------- | ----------------------------------- |
| 1.1 | 하이퍼링크 run-loop 누락  | `paragraph.js:356-372`              |
| 1.2 | 책갈피 anchor             | `paragraph.js`                      |
| 1.3 | 페이지 번호 동적 업데이트 | `parser.js:1576` + `renderer.js`    |
| 1.4 | 이미지 CSS filter         | `image.js:183-220`                  |
| 1.5 | 이미지 rotation           | `image.js`                          |
| 1.6 | 도형 회전·텍스트 회전     | `shape.js`, `table.js`              |
| 1.7 | 강조점(symMark)           | `parser.js:610-739`, `paragraph.js` |
| 1.8 | 외곽선/그림자 글자        | `parser.js`, `paragraph.js`         |

### Phase 2 — 핵심 누락 기능 (3-4주)

- 2-1 머리말/꼬리말 (5-7일)
- 2-2 각주/미주 (5-7일)
- 2-3 다단(Multi-column) (3-5일)
- 2-4 발음 표기(Ruby/Dutmal) + 한자 변환 (3-5일)
- 2-5 표 헤더 행 페이지 반복 (3-5일)
- 2-6 페이지 테두리·워터마크 (2-3일)

### Phase 3 — 도형·고급 그래픽 (4-6주)

- 3-1 SVG 렌더러로 도형 전환 (10-14일)
- 3-2 도형 그라데이션/그림자/3D (7-10일)
- 3-3 둘러싸기(wrap) 모드 (7-10일)
- 3-4 도형 안 표/중첩 도형 그룹 (5-7일)

### Phase 4 — 라운드트립 완전성 (4-6주)

- 4-1 canvas-editor Phase 2 (10-14일)
- 4-2 HWPX → HWP 역변환기 (15-20일)
- 4-3 HWP 변환 손실 영역 보강 (5-7일)

### Phase 5 — 차세대 기능 (장기, 6-8주+)

- MathML 양방향 / 차트 렌더링 / 양식 컨트롤 UI / 메모·주석 UI / 상호
  참조·색인·차례 / OLE 임베드

---

## D. 우선순위 — "정부·법무·교육 문서 처리"용 톱5

1. 머리말/꼬리말 + 동적 페이지 번호 (Phase 1.3 + 2-1)
2. 각주/미주 (Phase 2-2)
3. 하이퍼링크·책갈피 fix (Phase 1.1 + 1.2)
4. 표 헤더 행 페이지 반복 (Phase 2-5)
5. 다단 레이아웃 (Phase 2-3)

→ Phase 0 + 1 + 2를 합쳐 약 5-7주에 사용자 체감 80% 향상 가능

---

## E. 결정 사항

| 결정 사안          | 선택                                              |
| ------------------ | ------------------------------------------------- |
| 도형 렌더 기술     | SVG 전환                                          |
| .hwp 역저장        | 직접 구현 (1차) + 서버 fallback (선택)            |
| 매크로             | 차단 유지 (보안)                                  |
| canvas-editor      | 유지 + Phase 4-1로 손실 최소화                    |
| 참조 구현 라이선스 | hwp.js(Apache) 분석, pyhwp(AGPL)는 상용 합류 위험 |

---

## F. 참고 자료

- HWP 5.0 명세:
  https://cdn.hancom.com/link/docs/한글문서파일형식_5.0_revision1.3.pdf
- 한컴 명세 센터: https://www.hancom.com/support/downloadCenter/hwpOwpml
- HWPX 구조 해설: https://tech.hancom.com/hwpxformat/
- KS X 6101:
  https://standard.go.kr/KSCI/standardIntro/getStandardSearchView.do?ksNo=KSX6101
- 한컴 OWPML C++ 모델: https://github.com/hancom-io/hwpx-owpml-model
- 참조 구현: [hwp.js](https://github.com/hahnlee/hwp.js)(Apache),
  [pyhwp](https://github.com/mete0r/pyhwp)(AGPL — 주의)

---

## G. 실행 트랙 (병렬 worktree)

본 문서를 근거로 다음 6트랙 병렬 진행:

| 트랙 | 범위                            | 주요 파일                                                                            | 격리     |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| A    | Phase 0 인프라 + 문서           | `tests/golden/`, `tests/conformance.yaml`, `scripts/conformance-report.mjs`, 본 문서 | 메인     |
| B    | Phase 1 작은 8개 갭             | `paragraph.js`, `image.js`, `shape.js`(회전만), `table.js`, `parser.js`(charPr 확장) | worktree |
| C    | Phase 2-1/2-3/2-6 (페이지 레벨) | `renderer.js` 페이지 컨테이너 + 신규 header/footer/column/border 모듈                | worktree |
| D    | Phase 2-2/2-4/2-5 (인라인 + 표) | `paragraph.js`(각주·ruby), `table.js`(헤더 반복), `renderer.js`(각주 영역)           | worktree |
| E    | Phase 3 도형 SVG 전환           | `shape.js` 전면 재작성, `renderers/svg-shape.js` 신규                                | worktree |
| F    | Phase 4-1/4-2 라운드트립        | `hwpx-to-canvas-editor.js`, `canvas-editor-to-hwpx.js`, `hwpTohwpx/.../Hwpx2Hwp`     | worktree |

통합 순서: A → B → C → D → E → F. 충돌 영역(paragraph.js, renderer.js,
shape.js)은 통합 시 수동 머지.
