# Golden File Test Set

한국어 HWPX 편집기의 핵심 기능별 회귀 안전망용 골든 파일 모음입니다.

## 구조

각 디렉토리는 하나의 핵심 기능을 다룹니다.

```
tests/golden/
├── 01-paragraph/          # 문단 (정렬, 들여쓰기, 줄간격, 인라인 서식)
├── 02-table/              # 표 (셀 병합, 헤더 반복, 셀 서식)
├── 03-image/              # 이미지 (인라인/플로팅, 텍스트 래핑)
├── 04-shape/              # 도형 (선/사각형/그룹/회전)
├── 05-footnote/           # 각주/미주
├── 06-header-footer/      # 머리말/꼬리말 (홀짝, 첫 페이지 별도)
├── 07-field/              # 필드 (날짜, 페이지번호, 사용자정의)
├── 08-multi-column/       # 다단 (균등/불균등, 구분선)
├── 09-numbering/          # 번호매기기/글머리표 (다단계)
├── 10-ruby/               # 루비 (한자 음/훈)
├── 11-hyperlink/          # 하이퍼링크 (외부/내부)
└── 12-bookmark/           # 책갈피 / 상호참조
```

## 각 디렉토리 파일

| 파일 | 용도 |
| --- | --- |
| `README.md` | 이 기능 검증의 의도와 기대 결과 |
| `sample-fragment.xml` | 핵심 HWPX 단편 (실 바이너리 대신 비교용) |
| `expected.json` | 파서가 뽑아야 할 핵심 필드 (값은 추후 채움) |

## 사용

라운드트립 테스트(`tests/roundtrip/roundtrip.test.ts`)와 적합성 리포트
(`scripts/conformance-report.mjs`)가 이 디렉토리를 참조합니다. 실제 바이너리
HWPX 파일이 추가되면(`fixture.hwpx`) 자동으로 import-export-diff 회귀 검증이
활성화됩니다.

## 골든 파일 추가 절차

1. 새로운 기능 디렉토리 생성 (`tests/golden/NN-<feature>/`)
2. `README.md`로 검증 의도 명세
3. `sample-fragment.xml`에 HWPX 단편 작성
4. `expected.json`에 기대 필드 작성
5. (선택) 실제 `fixture.hwpx` 추가하면 라운드트립 활성화
6. `tests/conformance.yaml`에 매트릭스 한 줄 추가
