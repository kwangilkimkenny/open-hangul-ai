# PositionManager 사용 가이드

## 개요

PositionManager는 HWPX 문서 내 모든 문자의 정확한 위치를 추적하고 관리하는
시스템입니다. Canvas-editor의 Position 시스템을 DOM 기반으로 적용하여
구현되었습니다.

## 주요 기능

### 1. 문자 단위 위치 추적

- 렌더링된 모든 문자의 좌표 정보 수집
- 페이지, 요소 타입, 컨텍스트 정보 포함
- Range API를 사용한 정확한 위치 측정

### 2. 클릭-투-포지션

- 클릭한 위치의 문자 찾기
- Ctrl+Shift+Click으로 디버그 정보 출력
- 시각적 하이라이트 제공

### 3. 텍스트 검색

- 위치 기반 텍스트 검색
- 대소문자 구분 옵션
- 검색 결과의 시작/끝 인덱스 반환

### 4. 범위 하이라이트

- 특정 범위의 텍스트 하이라이트
- 커스텀 색상 지정 가능
- 하이라이트 제거 기능

## API 사용법

### 1. PositionManager 가져오기

```javascript
const viewer = window.viewer;
const positionManager = viewer.getPositionManager();
```

### 2. 위치 정보 조회

```javascript
// 전체 위치 리스트
const positions = positionManager.getPositionList();
console.log(`Total characters: ${positions.length}`);

// 특정 인덱스의 위치
const pos = positionManager.getPositionByIndex(100);
console.log(`Character at index 100: "${pos.value}"`);

// 범위 내 위치들
const range = positionManager.getPositionsInRange(0, 99);
console.log(`First 100 characters`);
```

### 3. 클릭-투-포지션 사용

문서를 로드한 후:

1. **Ctrl+Shift+Click**으로 원하는 위치 클릭
2. 콘솔에서 해당 문자의 상세 정보 확인
3. 클릭한 문자가 0.5초간 노란색으로 하이라이트됨

출력되는 정보:

- Character: 문자 값
- Index: 전체 문서에서의 인덱스
- Page: 페이지 번호
- Element Type: 요소 타입 (table, paragraph, etc.)
- Coordinate: 좌표 정보 (left, top, right, bottom, width, height)

### 4. 텍스트 검색

```javascript
// 기본 검색 (대소문자 구분 안 함)
const results = viewer.searchText('검색어');

// 대소문자 구분 검색
const results = viewer.searchText('SearchTerm', true);

// 결과 순회
results.forEach(result => {
  console.log(
    `Found at index ${result.startIndex}-${result.endIndex}: "${result.text}"`
  );
});
```

### 5. 하이라이트

```javascript
// 특정 범위 하이라이트 (노란색)
viewer.highlightRange(0, 99);

// 커스텀 색상으로 하이라이트
viewer.highlightRange(100, 199, '#ffcccc');

// 모든 하이라이트 제거
viewer.clearHighlight();
```

### 6. 통계 정보

```javascript
const stats = positionManager.getStats();
console.log('Document Statistics:');
console.log(`- Total Characters: ${stats.totalCharacters}`);
console.log(`- Pages: ${stats.pages}`);
console.log(`- Paragraphs: ${stats.paragraphs}`);
console.log(`- Table Cells: ${stats.tableCells}`);
```

### 7. 전체 텍스트 추출

```javascript
const fullText = positionManager.getFullText();
console.log('Full document text:', fullText);
```

## 데이터 구조

### Position 객체

```javascript
{
    index: 0,                      // 전체 문서에서의 인덱스
    value: 'A',                    // 문자 값
    pageNumber: 1,                 // 페이지 번호

    // DOM 참조
    textNode: TextNode,            // 텍스트 노드
    textOffset: 0,                 // 노드 내 오프셋
    parentElement: HTMLElement,    // 부모 요소

    // 좌표 정보
    coordinate: {
        left: 100,
        top: 200,
        right: 110,
        bottom: 220,
        width: 10,
        height: 20
    },

    // 메타데이터
    isWhitespace: false,           // 공백 여부
    isLinebreak: false,            // 줄바꿈 여부
    elementType: 'paragraph',      // 요소 타입
    cellData: {...},               // 셀 데이터 (테이블인 경우)
    paraData: {...}                // 단락 데이터 (단락인 경우)
}
```

## 활용 사례

### 1. 정밀한 커서 포지셔닝

```javascript
container.addEventListener('click', e => {
  const position = positionManager.getPositionByXY(e.clientX, e.clientY);
  if (position) {
    // 커서를 해당 위치로 이동
    setCursorAtPosition(position);
  }
});
```

### 2. 텍스트 범위 선택

```javascript
let startPos = null;

container.addEventListener('mousedown', e => {
  startPos = positionManager.getPositionByXY(e.clientX, e.clientY);
});

container.addEventListener('mouseup', e => {
  const endPos = positionManager.getPositionByXY(e.clientX, e.clientY);
  if (startPos && endPos) {
    const range = positionManager.getPositionsInRange(
      startPos.index,
      endPos.index
    );
    // 선택된 텍스트 처리
    const selectedText = range.map(p => p.value).join('');
    console.log('Selected:', selectedText);
  }
});
```

### 3. 검색 결과 하이라이트

```javascript
const searchTerm = '검색어';
const results = viewer.searchText(searchTerm);

results.forEach((result, index) => {
  // 각 결과를 다른 색으로 하이라이트
  const colors = ['yellow', 'lightblue', 'lightgreen'];
  viewer.highlightRange(
    result.startIndex,
    result.endIndex,
    colors[index % colors.length]
  );
});
```

### 4. 문서 분석

```javascript
// 각 페이지의 문자 수 계산
const positions = positionManager.getPositionList();
const pageCharCounts = {};

positions.forEach(pos => {
  if (!pageCharCounts[pos.pageNumber]) {
    pageCharCounts[pos.pageNumber] = 0;
  }
  if (!pos.isWhitespace) {
    pageCharCounts[pos.pageNumber]++;
  }
});

console.log('Characters per page:', pageCharCounts);
```

## 주의사항

1. **렌더링 후 사용**: PositionManager는 문서가 렌더링된 후에만 사용 가능합니다.
2. **성능**: 큰 문서의 경우 위치 계산에 시간이 걸릴 수 있습니다.
3. **동적 변경**: DOM이 변경되면 `computePositions()`를 다시 호출해야 합니다.
4. **좌표 기준**: 모든 좌표는 viewport 기준입니다 (스크롤 고려 필요).

## 디버깅 팁

### 1. 위치 정보 확인

```javascript
// 첫 100개 문자 출력
const positions = positionManager.getPositionList().slice(0, 100);
positions.forEach(pos => {
  console.log(
    `[${pos.index}] "${pos.value}" at (${pos.coordinate.left}, ${pos.coordinate.top})`
  );
});
```

### 2. 특정 요소의 위치들

```javascript
const paragraph = document.querySelector('.hwp-paragraph');
const positions = positionManager.getPositionsByElement(paragraph);
console.log(`Paragraph has ${positions.length} characters`);
```

### 3. 클릭 위치 디버깅

- Ctrl+Shift+Click으로 자동으로 상세 정보 출력
- 콘솔에서 Position 객체 확인

## 향후 계획

- [ ] 커서 렌더링 시스템
- [ ] 드래그 선택 기능
- [ ] 범위 기반 포맷팅
- [ ] 텍스트 치환 기능
- [ ] 북마크/앵커 지원
- [ ] Virtual scrolling 최적화

## 문의

문제가 발생하거나 개선 제안이 있으면 이슈를 등록해주세요.
