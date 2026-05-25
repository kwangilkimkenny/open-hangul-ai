# 03 · Image (이미지)

## 검증 의도

- 인라인 vs. 플로팅 (anchor: char / para / page)
- 텍스트 래핑 (square / tight / through / behind / inFront / topAndBottom)
- 크기·회전·자르기
- 미디어 바이너리 참조 (`BinData/`)

## 기대 결과

- 파서: 각 이미지가 정확한 anchor / wrap / size 메타 보유
- 렌더러: wrap=square일 때 텍스트가 회피
- Round-trip: BinData 손실 없음 (zip 단계까지)

## 회귀 시나리오

1. 인라인 이미지 (문단 내 100x100)
2. 플로팅 이미지, square 래핑
3. 회전 90° 이미지
