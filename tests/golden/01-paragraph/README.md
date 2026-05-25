# 01 · Paragraph (문단)

## 검증 의도

HWPX 문단 단위에서 다음 속성이 손실 없이 round-trip 되는지 확인합니다.

- 정렬 (`align`: left/center/right/justify/distribute)
- 들여쓰기 (`indent`, `firstLineIndent`, `marginLeft`, `marginRight`)
- 줄 간격 (`lineHeight`, `lineSpacing` mode/value)
- 위/아래 여백 (`spaceBefore`, `spaceAfter`)
- 인라인 런 서식 (bold / italic / underline / strike / size / color / fontFamily)

## 기대 결과

- 파서: `expected.json`의 `paragraphs[]` 배열을 동일 키/값으로 생성
- 렌더러: `align=center` + `firstLineIndent=20pt` 시각적 일치
- Round-trip: 입력 ↔ 출력 XML 의 의미 동등 (속성 순서·whitespace 차이만 허용)

## 회귀 시나리오

1. center 정렬 + 굵게 한 줄
2. justify + 첫 줄 들여쓰기 + 더블 줄간격 두 줄
3. 인라인 색상 + 폰트 패밀리 혼합 한 줄
