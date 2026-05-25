# 11 · Hyperlink (하이퍼링크)

## 검증 의도

- 외부 URL (http/https/mailto)
- 문서 내 책갈피로 점프
- 클릭 가능 범위 (런 단위)
- tooltip / target

## 기대 결과

- 파서: 런 메타에 `hyperlink` 객체 (`href`, `target`, `tooltip`)
- 렌더러: 밑줄+컬러, 클릭 시 nav
- Round-trip: URL 인코딩 유지

## 회귀 시나리오

1. 외부 https URL
2. 메일 mailto:
3. 내부 책갈피 점프 (#bm1)
