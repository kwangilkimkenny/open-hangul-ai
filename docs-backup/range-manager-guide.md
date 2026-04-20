# RangeManager 사용 가이드

## 개요

RangeManager는 HWPX 뷰어에서 텍스트 범위 선택을 관리하는 시스템입니다.
Canvas-editor의 RangeManager를 DOM 기반으로 적용하여 마우스 드래그, 키보드 선택,
포맷 적용 등을 지원합니다.

## 주요 기능

### 1. 드래그 선택

- 마우스로 드래그하여 텍스트 선택
- 실시간 시각적 하이라이트
- 선택 범위 자동 추적

### 2. 키보드 선택

- Shift + Arrow 키로 선택 확장
- Shift + Home/End로 줄 단위 선택 (예정)
- Ctrl + A로 전체 선택

### 3. 포맷 적용

- 선택된 텍스트에 볼드, 이탤릭, 밑줄 등 적용
- 색상 변경
- 스타일 정보 추출

### 4. 선택 관리

- 범위 설정/해제
- 선택된 텍스트 추출
- 선택 정보 조회

## API 사용법

### 1. RangeManager 가져오기

```javascript
const viewer = window.viewer;
const rangeManager = viewer.getRangeManager();
```

### 2. 범위 선택

#### 프로그래밍 방식으로 선택

```javascript
// 특정 범위 선택 (인덱스 기반)
viewer.setRange(0, 99); // 첫 100개 문자 선택

// 전체 선택
viewer.selectAll();

// 선택 해제
viewer.clearSelection();
```

#### 드래그로 선택

```javascript
// 자동으로 활성화됨 (loadFile 후)
// 마우스로 드래그하면 선택 영역이 파란색으로 표시됨
```

#### 키보드로 선택

```javascript
// Shift + Arrow 키로 선택 확장
// - Shift + ← : 왼쪽으로 한 글자 확장
// - Shift + → : 오른쪽으로 한 글자 확장
// - Ctrl + Shift + A : 전체 선택
```

### 3. 선택된 텍스트 가져오기

```javascript
// 선택된 텍스트
const text = viewer.getSelectedText();
console.log('Selected:', text);

// 선택 정보
const range = rangeManager.getRange();
console.log('Range:', range);
// { startIndex: 0, endIndex: 99, isCollapsed: false }

// 선택 여부 확인
if (rangeManager.hasSelection()) {
  console.log('Text is selected');
}
```

### 4. 선택 범위 정보

```javascript
const info = rangeManager.getRangeInfo();
console.log('Range Info:', info);
/*
{
    hasSelection: true,
    startIndex: 0,
    endIndex: 99,
    length: 100,
    text: "선택된 텍스트...",
    characterCount: 85,      // 공백 제외
    whitespaceCount: 15      // 공백만
}
*/
```

### 5. 포맷 적용

```javascript
// 선택된 텍스트를 볼드로
viewer.applyFormat('bold', true);

// 이탤릭 적용
viewer.applyFormat('italic', true);

// 밑줄 적용
viewer.applyFormat('underline', true);

// 색상 변경
viewer.applyFormat('color', '#ff0000');

// 포맷 제거
viewer.applyFormat('bold', false);
```

### 6. 스타일 추출

```javascript
const style = rangeManager.getSelectionStyle();
console.log('Selection Style:', style);
/*
{
    fontFamily: "Malgun Gothic",
    fontSize: "12pt",
    fontWeight: "700",
    fontStyle: "normal",
    color: "rgb(0, 0, 0)",
    textDecoration: "none",
    backgroundColor: "rgba(0, 0, 0, 0)"
}
*/
```

### 7. 선택된 위치/요소

```javascript
// 선택된 위치들 (Position 객체 배열)
const positions = rangeManager.getSelectedPositions();
console.log(`Selected ${positions.length} characters`);

// 선택된 DOM 요소들
const elements = rangeManager.getSelectedElements();
console.log(`${elements.length} elements affected`);
```

### 8. 클립보드 작업

```javascript
// 선택된 텍스트 복사
const success = await rangeManager.copySelection();
if (success) {
  console.log('Copied to clipboard');
}

// 또는 viewer API 사용
await viewer.getRangeManager().copySelection();
```

### 9. 선택 삭제

```javascript
// 선택된 텍스트 삭제
rangeManager.deleteSelection();
```

## 이벤트 및 상호작용

### 드래그 선택 동작

1. **마우스 다운**: 선택 시작 위치 기록
2. **마우스 이동**: 범위 확장, 하이라이트 업데이트
3. **마우스 업**: 선택 완료, 최종 범위 확정

```javascript
// 선택 시작 감지
document.addEventListener('mousedown', e => {
  // RangeManager가 내부적으로 처리
});

// 선택 중
document.addEventListener('mousemove', e => {
  // 드래그 중 하이라이트 업데이트
});

// 선택 완료
document.addEventListener('mouseup', e => {
  const text = viewer.getSelectedText();
  if (text) {
    console.log(`Selected: ${text.length} chars`);
  }
});
```

### 키보드 선택 동작

```javascript
// Shift + Arrow 키
container.addEventListener('keydown', e => {
  if (e.shiftKey) {
    // RangeManager가 내부적으로 처리
    // 선택 범위 확장
  }
});
```

## 고급 사용법

### 1. 검색 결과 선택

```javascript
// 텍스트 검색 후 선택
const results = viewer.searchText('검색어');
if (results.length > 0) {
  const first = results[0];
  viewer.setRange(first.startIndex, first.endIndex);
}
```

### 2. 선택 범위 순회

```javascript
const positions = rangeManager.getSelectedPositions();

positions.forEach(pos => {
  console.log(
    `[${pos.index}] "${pos.value}" at (${pos.coordinate.left}, ${pos.coordinate.top})`
  );
});
```

### 3. 커스텀 하이라이트

```javascript
// PositionManager를 사용한 커스텀 하이라이트
const results = viewer.searchText('중요');
results.forEach(result => {
  viewer.highlightRange(result.startIndex, result.endIndex, '#ffff00');
});

// 제거
viewer.clearHighlight();
```

### 4. 범위 기반 작업

```javascript
function formatSelectedText(format, value) {
  if (!rangeManager.hasSelection()) {
    alert('텍스트를 먼저 선택하세요.');
    return;
  }

  // 히스토리에 저장 (undo 지원)
  const currentRange = rangeManager.getRange();

  // 포맷 적용
  viewer.applyFormat(format, value);

  // 문서 저장 플래그
  viewer.autoSaveManager?.markDirty();
}

// 사용
formatSelectedText('bold', true);
```

### 5. 다중 영역 하이라이트 (검색 결과)

```javascript
function highlightAllMatches(searchTerm) {
  const results = viewer.searchText(searchTerm);

  // 각 결과를 다른 색으로 표시
  const colors = ['#ffeb3b', '#4caf50', '#2196f3', '#f44336'];

  results.forEach((result, index) => {
    const color = colors[index % colors.length];
    viewer.highlightRange(result.startIndex, result.endIndex, color);
  });

  console.log(`Highlighted ${results.length} matches`);
}

// 사용
highlightAllMatches('테스트');
```

## 스타일 커스터마이징

### CSS 변수 오버라이드

```css
/* 선택 하이라이트 색상 변경 */
.hwpx-selection-highlight {
  background-color: rgba(255, 200, 0, 0.4) !important;
}

/* 드래그 중 커서 */
.hwpx-selecting {
  cursor: crosshair !important;
}

/* 선택 툴팁 스타일 */
.hwpx-selection-tooltip {
  background: rgba(0, 0, 0, 0.9) !important;
  font-size: 14px !important;
}
```

### 디버그 모드

```javascript
// 선택 경계선 표시
document.querySelector('#hwpx-viewer').classList.add('hwpx-selection-debug');

// 제거
document.querySelector('#hwpx-viewer').classList.remove('hwpx-selection-debug');
```

## 실전 예제

### 1. 간단한 텍스트 에디터 툴바

```javascript
class EditorToolbar {
  constructor(viewer) {
    this.viewer = viewer;
    this.rangeManager = viewer.getRangeManager();
    this.setupButtons();
  }

  setupButtons() {
    // Bold 버튼
    document.getElementById('btn-bold').addEventListener('click', () => {
      if (this.rangeManager.hasSelection()) {
        this.viewer.applyFormat('bold', true);
      }
    });

    // Italic 버튼
    document.getElementById('btn-italic').addEventListener('click', () => {
      if (this.rangeManager.hasSelection()) {
        this.viewer.applyFormat('italic', true);
      }
    });

    // Color picker
    document.getElementById('color-picker').addEventListener('change', e => {
      if (this.rangeManager.hasSelection()) {
        this.viewer.applyFormat('color', e.target.value);
      }
    });

    // Copy 버튼
    document.getElementById('btn-copy').addEventListener('click', async () => {
      const success = await this.rangeManager.copySelection();
      if (success) {
        alert('복사되었습니다!');
      }
    });
  }

  updateToolbarState() {
    // 선택 여부에 따라 버튼 활성화/비활성화
    const hasSelection = this.rangeManager.hasSelection();
    document.getElementById('btn-bold').disabled = !hasSelection;
    document.getElementById('btn-italic').disabled = !hasSelection;

    // 현재 스타일 표시
    if (hasSelection) {
      const style = this.rangeManager.getSelectionStyle();
      document
        .getElementById('btn-bold')
        .classList.toggle(
          'active',
          style.fontWeight === '700' || style.fontWeight === 'bold'
        );
    }
  }
}

// 사용
const toolbar = new EditorToolbar(viewer);

// 선택 변경 시 툴바 업데이트
setInterval(() => toolbar.updateToolbarState(), 100);
```

### 2. 선택 정보 표시

```javascript
function showSelectionInfo() {
  const rangeManager = viewer.getRangeManager();

  if (!rangeManager.hasSelection()) {
    console.log('No selection');
    return;
  }

  const info = rangeManager.getRangeInfo();

  console.log('=== Selection Info ===');
  console.log(`Range: [${info.startIndex}, ${info.endIndex}]`);
  console.log(`Length: ${info.length} chars`);
  console.log(`Characters: ${info.characterCount}`);
  console.log(`Whitespace: ${info.whitespaceCount}`);
  console.log(`Text: "${info.text.substring(0, 50)}..."`);
}

// 마우스 업 시 정보 표시
document.addEventListener('mouseup', () => {
  setTimeout(showSelectionInfo, 100);
});
```

### 3. 선택 범위 저장/복원

```javascript
class SelectionHistory {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
  }

  save(rangeManager) {
    const range = rangeManager.getRange();
    if (!range.isCollapsed) {
      this.history.push(range);
      this.currentIndex = this.history.length - 1;
    }
  }

  restore(viewer, index) {
    if (index >= 0 && index < this.history.length) {
      const range = this.history[index];
      viewer.setRange(range.startIndex, range.endIndex);
      this.currentIndex = index;
    }
  }

  previous(viewer) {
    if (this.currentIndex > 0) {
      this.restore(viewer, this.currentIndex - 1);
    }
  }

  next(viewer) {
    if (this.currentIndex < this.history.length - 1) {
      this.restore(viewer, this.currentIndex + 1);
    }
  }
}

// 사용
const selectionHistory = new SelectionHistory();

document.addEventListener('mouseup', () => {
  selectionHistory.save(viewer.getRangeManager());
});

// Ctrl+[ : 이전 선택
// Ctrl+] : 다음 선택
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === '[') {
    selectionHistory.previous(viewer);
  } else if (e.ctrlKey && e.key === ']') {
    selectionHistory.next(viewer);
  }
});
```

## 제약사항 및 주의사항

### 1. 테이블 셀 내부

- 테이블 셀 내부는 InlineEditor가 별도로 처리
- 셀 클릭 시 RangeManager의 드래그 선택 비활성화
- 셀 편집 모드에서는 브라우저 네이티브 선택 사용

### 2. 성능 고려사항

- 대용량 문서에서 드래그 선택 시 하이라이트 렌더링 부하
- 수천 개 이상의 문자 선택 시 하이라이트 요소 많아짐
- 필요시 `_updateSelectionHighlight()` 최적화 필요

### 3. 스크롤

- 하이라이트 위치는 viewport 기준이 아닌 컨테이너 기준
- 스크롤 시 하이라이트 위치 자동 조정
- 스크롤 중 선택하면 자동 스크롤 미지원 (향후 추가 예정)

### 4. 편집 모드

- 전역 편집 모드(`EditModeManager`)와 연동 필요
- 읽기 전용 모드에서는 선택만 가능, 포맷 적용 불가

## 트러블슈팅

### 선택이 안 됨

```javascript
// PositionManager 준비 확인
const pm = viewer.getPositionManager();
console.log('Position ready:', pm.isPositionReady());

// RangeManager 활성화 확인
const rm = viewer.getRangeManager();
console.log('RangeManager:', rm);

// 수동 활성화
rm.enableSelection();
```

### 하이라이트가 잘못된 위치에 표시

```javascript
// 위치 정보 재계산
await viewer.getPositionManager().computePositions(viewer.container);

// 선택 하이라이트 업데이트
viewer.getRangeManager()._updateSelectionHighlight();
```

### 드래그가 느림

```javascript
// 하이라이트 간소화 (CSS)
.hwpx-selection-highlight {
    transition: none !important;
    will-change: auto;
}

// 또는 하이라이트 비활성화
.hwpx-selection-highlight {
    display: none;
}
```

## 향후 계획

- [ ] 자동 스크롤 (드래그 중 화면 끝 도달 시)
- [ ] 줄 단위 선택 (Shift + Home/End)
- [ ] 단어 단위 선택 (더블 클릭)
- [ ] 단락 단위 선택 (트리플 클릭)
- [ ] 다중 선택 (Ctrl + 드래그)
- [ ] 선택 툴팁 (문자 수, 단어 수 표시)
- [ ] 선택 히스토리 (Undo/Redo)
- [ ] 스마트 선택 (단어 경계 자동 조정)

## 참고 자료

- [PositionManager 가이드](./position-manager-guide.md)
- [Canvas-editor Range System](https://github.com/Hufe921/canvas-editor)
- MDN:
  [Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection)
- MDN: [Range API](https://developer.mozilla.org/en-US/docs/Web/API/Range)

## 문의

문제가 발생하거나 개선 제안이 있으면 이슈를 등록해주세요.
