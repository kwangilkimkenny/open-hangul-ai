# 08 · Multi-Column (다단)

## 검증 의도

- 단 개수 (2, 3, …)
- 균등/불균등 폭
- 단 사이 간격
- 단 사이 구분선 유무·두께·색

## 기대 결과

- 파서: section의 `columnDef` 객체에 count + gap + lineWidth + per-column width
- 렌더러: 본문이 단 폭에 맞춰 줄바꿈
- Round-trip: 단 정의 유지

## 회귀 시나리오

1. 2단, 균등, 구분선 없음
2. 3단, 불균등 (40/30/30 %), 구분선 1pt
