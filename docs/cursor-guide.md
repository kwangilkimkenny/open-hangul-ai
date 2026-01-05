# Cursor 시스템 사용 가이드

## 개요

Cursor 시스템은 편집 가능한 문서에서 텍스트 커서를 표시하고 관리하는 시스템입니다. Canvas-editor의 Cursor 시스템을 DOM 기반으로 적용하여 구현되었습니다.

## 주요 기능

### 1. 커서 렌더링
- 깜빡이는 세로선 커서
- 정확한 문자 위치에 표시
- 커스터마이징 가능 (색상, 너비, 깜빡임)

### 2. 커서 이동
- 클릭으로 위치 이동
- 화살표 키로 이동
- Home/End로 줄 시작/끝 이동

### 3. 입력 캡처
- CursorAgent (숨겨진 textarea)로 키보드 입력 감지
- IME (한글 입력) 지원
- 특수 키 (Backspace, Delete, Enter) 처리

## 아키텍처

```
Cursor
├── cursorElement (DOM: 깜빡이는 세로선)
├── cursorAgent (DOM: 숨겨진 textarea, 입력 캡처)
└── Position tracking (PositionManager 연동)
```

## 기본 사용법

### 1. Cursor 가져오기

```javascript
const viewer = window.viewer;
const cursor = viewer.getCursor();
```

### 2. 커서 위치 설정

```javascript
// 인덱스로 위치 설정
cursor.setCursorPosition(100);  // 100번째 문자에 커서

// 클릭으로 자동 설정 (자동으로 활성화됨)
// 문서 클릭 시 해당 위치에 커서 표시
```

### 3. 커서 표시/숨기기

```javascript
// 커서 표시
cursor.show();

// 커서 숨기기
cursor.hide();

// 포커스
cursor.focus();  // 키보드 입력 활성화

// 포커스 해제
cursor.blur();
```

### 4. 커서 이동

```javascript
// 상대 이동
cursor.moveCursor(1);   // 1글자 앞으로
cursor.moveCursor(-1);  // 1글자 뒤로

// 현재 위치 가져오기
const index = cursor.getCursorIndex();
console.log('Cursor at:', index);
```

### 5. 커서 커스터마이징

```javascript
// 색상 변경
cursor.setColor('#ff0000');

// 너비 변경
cursor.setWidth(3);  // 3px

// 깜빡임 활성화/비활성화
cursor.setBlinking(false);  // 깜빡임 중지
cursor.setBlinking(true);   // 깜빡임 시작
```

## 키보드 내비게이션

### 자동으로 지원되는 키

커서가 활성화되면 다음 키가 자동으로 처리됩니다:

- **←** (ArrowLeft): 왼쪽으로 1글자 이동
- **→** (ArrowRight): 오른쪽으로 1글자 이동
- **↑** (ArrowUp): 위로 한 줄 이동
- **↓** (ArrowDown): 아래로 한 줄 이동
- **Home**: 줄 시작으로 이동
- **End**: 줄 끝으로 이동
- **Backspace**: 이전 문자 삭제
- **Delete**: 다음 문자 삭제
- **Enter**: 줄바꿈
- **텍스트 입력**: 모든 키보드 입력 지원 (한글 IME 포함)
- **Ctrl+C** (Mac: **Cmd+C**): 선택 영역 복사
- **Ctrl+X** (Mac: **Cmd+X**): 선택 영역 잘라내기
- **Ctrl+V** (Mac: **Cmd+V**): 클립보드에서 붙여넣기
- **Ctrl+Z** (Mac: **Cmd+Z**): 실행 취소
- **Ctrl+Y** (Mac: **Cmd+Y**): 다시 실행

## 고급 사용법

### 1. 커서 위치와 선택 연동

```javascript
// 커서 위치에서 선택 시작
const cursorIndex = cursor.getCursorIndex();

// 선택 확장
viewer.setRange(cursorIndex, cursorIndex + 10);

// 선택 해제 시 커서 표시
viewer.clearSelection();
cursor.show();
```

### 2. 프로그래밍 방식으로 커서 이동

```javascript
// 특정 단어로 이동
const searchResults = viewer.searchText('중요');
if (searchResults.length > 0) {
    cursor.setCursorPosition(searchResults[0].startIndex);
    cursor.focus();
}

// 문서 시작으로 이동
cursor.setCursorPosition(0);

// 문서 끝으로 이동
const lastIndex = viewer.getPositionManager().getPositionList().length - 1;
cursor.setCursorPosition(lastIndex);
```

### 3. 커서 이벤트 감지

```javascript
// 커서 위치 변경 감지
let lastCursorIndex = -1;

setInterval(() => {
    const currentIndex = cursor.getCursorIndex();
    if (currentIndex !== lastCursorIndex) {
        console.log('Cursor moved:', lastCursorIndex, '→', currentIndex);
        lastCursorIndex = currentIndex;

        // 현재 위치의 문자 정보
        const position = viewer.getPositionManager().getPositionByIndex(currentIndex);
        if (position) {
            console.log('Character:', position.value);
            console.log('Element type:', position.elementType);
        }
    }
}, 100);
```

### 4. 커서 스타일 테마

```javascript
// 파란색 커서
cursor.setColor('#0078d4');

// 빨간색 커서
cursor.setColor('#e74c3c');

// 초록색 커서
cursor.setColor('#27ae60');

// 두꺼운 커서
cursor.setWidth(4);

// CSS 클래스 추가
cursor.cursorElement.classList.add('theme-blue');
```

### 5. 커서 위치 정보

```javascript
function showCursorInfo() {
    const index = cursor.getCursorIndex();
    if (index < 0) {
        console.log('Cursor not visible');
        return;
    }

    const position = viewer.getPositionManager().getPositionByIndex(index);
    if (!position) {
        return;
    }

    console.log('=== Cursor Info ===');
    console.log('Index:', index);
    console.log('Character:', position.value);
    console.log('Page:', position.pageNumber);
    console.log('Element type:', position.elementType);
    console.log('Coordinate:', position.coordinate);

    // 주변 텍스트
    const positions = viewer.getPositionManager().getPositionList();
    const start = Math.max(0, index - 10);
    const end = Math.min(positions.length, index + 10);
    const context = positions.slice(start, end).map(p => p.value).join('');
    console.log('Context:', context);
}

// 사용
showCursorInfo();
```

## 실전 예제

### 1. 커서 네비게이션 UI

```javascript
class CursorNavigator {
    constructor(viewer) {
        this.viewer = viewer;
        this.cursor = viewer.getCursor();
        this.setupButtons();
    }

    setupButtons() {
        // 이전 글자
        document.getElementById('btn-cursor-prev').addEventListener('click', () => {
            this.cursor.moveCursor(-1);
        });

        // 다음 글자
        document.getElementById('btn-cursor-next').addEventListener('click', () => {
            this.cursor.moveCursor(1);
        });

        // 문서 시작
        document.getElementById('btn-cursor-start').addEventListener('click', () => {
            this.cursor.setCursorPosition(0);
        });

        // 문서 끝
        document.getElementById('btn-cursor-end').addEventListener('click', () => {
            const lastIndex = this.viewer.getPositionManager().getPositionList().length - 1;
            this.cursor.setCursorPosition(lastIndex);
        });

        // 커서 표시/숨기기 토글
        document.getElementById('btn-cursor-toggle').addEventListener('click', () => {
            if (this.cursor.isVisible()) {
                this.cursor.hide();
            } else {
                this.cursor.show();
            }
        });
    }
}

// 사용
const navigator = new CursorNavigator(viewer);
```

### 2. 커서 위치 표시기

```javascript
class CursorIndicator {
    constructor(viewer) {
        this.viewer = viewer;
        this.cursor = viewer.getCursor();
        this.indicator = document.getElementById('cursor-indicator');

        // 주기적으로 업데이트
        setInterval(() => this.update(), 100);
    }

    update() {
        const index = this.cursor.getCursorIndex();

        if (index < 0) {
            this.indicator.textContent = 'No cursor';
            return;
        }

        const position = this.viewer.getPositionManager().getPositionByIndex(index);
        if (!position) {
            return;
        }

        this.indicator.innerHTML = `
            <div>Position: ${index}</div>
            <div>Character: "${position.value}"</div>
            <div>Page: ${position.pageNumber}</div>
            <div>Type: ${position.elementType}</div>
        `;
    }
}

// 사용
const indicator = new CursorIndicator(viewer);
```

### 3. 타이핑 시뮬레이터

```javascript
class TypingSimulator {
    constructor(viewer) {
        this.viewer = viewer;
        this.cursor = viewer.getCursor();
    }

    async typeText(text, speed = 100) {
        for (const char of text) {
            // 현재 위치에 문자 삽입
            this.viewer.command.insertText(char);

            // 지연
            await this.delay(speed);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 사용
const simulator = new TypingSimulator(viewer);
simulator.typeText('Hello, World!', 100);
```

### 4. 커서 히스토리 (이동 기록)

```javascript
class CursorHistory {
    constructor(viewer) {
        this.viewer = viewer;
        this.cursor = viewer.getCursor();
        this.history = [];
        this.currentIndex = -1;

        this.startTracking();
    }

    startTracking() {
        setInterval(() => {
            const index = this.cursor.getCursorIndex();
            if (index >= 0 && index !== this.history[this.history.length - 1]) {
                this.history.push(index);
                this.currentIndex = this.history.length - 1;

                // 최대 100개 기록
                if (this.history.length > 100) {
                    this.history.shift();
                    this.currentIndex--;
                }
            }
        }, 500);
    }

    goBack() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.cursor.setCursorPosition(this.history[this.currentIndex]);
        }
    }

    goForward() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            this.cursor.setCursorPosition(this.history[this.currentIndex]);
        }
    }
}

// 사용
const history = new CursorHistory(viewer);

// Alt+← : 이전 위치
// Alt+→ : 다음 위치
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') {
        history.goBack();
    } else if (e.altKey && e.key === 'ArrowRight') {
        history.goForward();
    }
});
```

## CSS 커스터마이징

### 기본 커서 스타일

```css
.hwpx-cursor {
    width: 2px;
    background-color: #000;
    animation: cursor-blink 1.06s step-end infinite;
}
```

### 커서 색상 변경

```css
/* 파란색 커서 */
.hwpx-cursor {
    background-color: #0078d4;
}

/* 빨간색 커서 */
.hwpx-cursor {
    background-color: #e74c3c;
}
```

### 커서 애니메이션 변경

```css
/* 빠른 깜빡임 */
.hwpx-cursor {
    animation: cursor-blink 0.5s step-end infinite;
}

/* 느린 깜빡임 */
.hwpx-cursor {
    animation: cursor-blink 2s step-end infinite;
}

/* 부드러운 페이드 */
@keyframes cursor-fade {
    0%, 49% {
        opacity: 1;
    }
    50%, 100% {
        opacity: 0.3;
    }
}

.hwpx-cursor {
    animation: cursor-fade 1s ease-in-out infinite;
}
```

### 두꺼운 커서 (IME 조합 중)

```css
.hwpx-cursor.composing {
    width: 4px;
    background-color: #0078d4;
    opacity: 0.7;
}
```

## 주의사항

### 1. PositionManager 의존성
커서는 PositionManager에 의존합니다. 문서 렌더링 후 위치 정보가 계산되어야 커서가 작동합니다.

```javascript
// PositionManager 준비 확인
if (viewer.getPositionManager().isPositionReady()) {
    cursor.setCursorPosition(0);
} else {
    console.warn('PositionManager not ready');
}
```

### 2. 테이블 셀 내부
테이블 셀 내부는 InlineEditor가 별도로 처리하므로 커서가 자동으로 숨겨집니다.

### 3. 성능
대용량 문서에서 커서 이동 시 위치 재계산 부하가 있을 수 있습니다.

### 4. 브라우저 호환성
- 모든 모던 브라우저 지원
- IME (한글 입력)는 CursorAgent를 통해 처리

## 향후 계획

- [x] 텍스트 입력 Command 통합 (insertText, deleteText) ✅ 완료
- [ ] IME 조합 중 커서 스타일 변경
- [ ] 다중 커서 (멀티 커서) 지원
- [ ] 커서 이동 애니메이션
- [ ] 가상 커서 (읽기 전용 모드)
- [ ] 커서 위치 북마크
- [ ] 리모트 커서 (협업)

## 트러블슈팅

### 커서가 표시되지 않음

```javascript
// PositionManager 확인
console.log('Position ready:', viewer.getPositionManager().isPositionReady());

// 커서 상태 확인
console.log('Cursor visible:', cursor.isVisible());
console.log('Cursor index:', cursor.getCursorIndex());

// 수동으로 표시
cursor.setCursorPosition(0);
cursor.show();
```

### 커서 위치가 잘못됨

```javascript
// 위치 정보 재계산
await viewer.getPositionManager().computePositions(viewer.container);

// 커서 다시 렌더링
cursor._renderCursor();
```

### 키보드 입력이 안 됨

```javascript
// CursorAgent에 포커스 확인
cursor.focus();

// CursorAgent 요소 확인
console.log('CursorAgent:', cursor.cursorAgent);
console.log('Active element:', document.activeElement);
```

## API 레퍼런스

### Cursor 클래스

#### 위치 관리
- `setCursorPosition(index)` - 커서 위치 설정
- `moveCursor(offset)` - 상대 이동
- `getCursorIndex()` - 현재 위치 가져오기

#### 표시/숨김
- `show()` - 커서 표시
- `hide()` - 커서 숨김
- `isVisible()` - 가시성 확인

#### 포커스
- `focus()` - 키보드 입력 활성화
- `blur()` - 포커스 해제

#### 스타일
- `setColor(color)` - 색상 변경
- `setWidth(width)` - 너비 변경
- `setBlinking(enabled)` - 깜빡임 활성화/비활성화

#### 정리
- `destroy()` - 리소스 정리

## 참고 자료

- [PositionManager 가이드](./position-manager-guide.md)
- [RangeManager 가이드](./range-manager-guide.md)
- [Canvas-editor Cursor](https://github.com/Hufe921/canvas-editor)
- MDN: [Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection)

## 문의

문제가 발생하거나 개선 제안이 있으면 이슈를 등록해주세요.
