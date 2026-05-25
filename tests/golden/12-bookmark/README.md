# 12 · Bookmark & Cross-reference (책갈피·상호참조)

## 검증 의도

- 책갈피 정의 (이름, 위치)
- 상호 참조 (`see chapter 3`)
- 책갈피 → 하이퍼링크 jump 대상으로 사용
- 책갈피 이름 중복 처리

## 기대 결과

- 파서: bookmarks 목록 + 본문 위치 매핑
- 렌더러: 보이지 않는 앵커, hover 디버그 가능
- Round-trip: 이름·위치 유지

## 회귀 시나리오

1. 본문 한 곳에 책갈피 "bm1"
2. 같은 문서 다른 곳에서 "bm1" 으로 cross-ref
