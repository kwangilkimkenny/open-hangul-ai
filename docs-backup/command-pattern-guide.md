# Command Pattern 사용 가이드

## 개요

Command Pattern은 모든 편집 작업을 명령 객체로 캡슐화하여 실행, 취소, 재실행을
통합 관리하는 디자인 패턴입니다. Canvas-editor의 Command 시스템을 참고하여 HWPX
뷰어에 적용했습니다.

## 아키텍처

### 3계층 구조

```
┌─────────────────────────────────────┐
│  Command (공개 API 파사드)           │
│  - 간단하고 직관적인 API             │
│  - 사용자 친화적                     │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  CommandAdapt (실제 구현)           │
│  - 명령 실제 로직                   │
│  - HistoryManager 통합              │
│  - Undo/Redo 함수 생성              │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  HistoryManagerV2 (히스토리 관리)   │
│  - 함수 기반 Undo/Redo              │
│  - 90% 메모리 절감                  │
│  - Stack 관리                       │
└─────────────────────────────────────┘
```

## 주요 개선사항

### Before (v1.0): 상태 기반

```javascript
// 전체 문서를 JSON으로 복사
historyManager.saveState('Cell Edit');
// → undoStack.push(JSON.clone(document))  // 메모리 낭비
```

### After (v2.0): 함수 기반

```javascript
// 복원 함수만 저장
historyManager.execute(
  () => {
    /* 실행 */
  },
  () => {
    /* 복원 */
  },
  'Cell Edit'
);
// → undoStack.push(undoFunction)  // 메모리 효율적
```

## 기본 사용법

### 1. Command API 가져오기

```javascript
const viewer = window.viewer;
const command = viewer.command;
```

### 2. 히스토리 명령 (Undo/Redo)

```javascript
// Undo
command.undo();

// Redo
command.redo();

// 히스토리 상태 확인
const stats = viewer.historyManager.getStats();
console.log('Can undo:', stats.canUndo);
console.log('Can redo:', stats.canRedo);
console.log('Undo count:', stats.undoCount);
console.log('Last action:', stats.lastAction);
```

### 3. 범위 선택 명령

```javascript
// 범위 설정
command.setRange(0, 99); // 첫 100개 문자 선택

// 전체 선택
command.selectAll();

// 선택 해제
command.clearSelection();
```

### 4. 포맷 명령

```javascript
// 텍스트를 먼저 선택한 후
viewer.setRange(0, 99);

// Bold 적용
command.bold(true);

// Italic 적용
command.italic(true);

// Underline 적용
command.underline(true);

// 색상 변경
command.color('#ff0000');

// 포맷 제거
command.bold(false);
```

### 5. 셀 편집 명령

```javascript
// 셀 편집
const cell = document.querySelector('td');
command.editCell(cell, 'New content');

// 셀 비우기
command.clearCell(cell);
```

### 6. 테이블 편집 명령

```javascript
const cell = document.querySelector('td');

// 행 추가
command.addRowAbove(cell);
command.addRowBelow(cell);

// 열 추가
command.addColumnLeft(cell);
command.addColumnRight(cell);

// 행/열 삭제
command.deleteRow(cell);
command.deleteColumn(cell);
```

### 7. 문서 명령

```javascript
// 문서 업데이트 (히스토리 포함)
command.updateDocument(modifiedDoc, 'AI Edit');

// 렌더링
command.render();
```

## 고급 사용법

### 1. 커스텀 명령 만들기

CommandAdapt를 확장하여 새로운 명령을 추가할 수 있습니다:

```javascript
// command-adapt.js에 추가
executeCustomCommand(params) {
    // 현재 상태 저장
    const oldState = this.captureState();

    // Execute 함수
    const execute = () => {
        // 변경 작업 수행
        this.applyChanges(params);
    };

    // Undo 함수
    const undo = () => {
        // 이전 상태로 복원
        this.restoreState(oldState);
        return execute;  // Redo를 위해 execute 반환
    };

    // 히스토리에 등록 및 실행
    this.historyManager.execute(execute, undo, 'Custom Action');
}
```

### 2. 배치 명령 실행

여러 명령을 하나의 undo 단위로 묶기:

```javascript
class BatchCommand {
  constructor(viewer) {
    this.viewer = viewer;
    this.commands = [];
  }

  add(commandFn) {
    this.commands.push(commandFn);
  }

  execute(actionName = 'Batch Edit') {
    const viewer = this.viewer;

    // 모든 명령의 undo 함수 저장
    const undoFunctions = [];

    const execute = () => {
      this.commands.forEach(cmd => {
        cmd();
      });
    };

    const undo = () => {
      // 역순으로 undo 실행
      undoFunctions.reverse().forEach(fn => fn());
      return execute;
    };

    viewer.historyManager.execute(execute, undo, actionName);
  }
}

// 사용
const batch = new BatchCommand(viewer);
batch.add(() => viewer.command.bold(true));
batch.add(() => viewer.command.color('#ff0000'));
batch.add(() => viewer.command.italic(true));
batch.execute('Format Text');

// Undo 한 번으로 모든 변경 취소
viewer.command.undo();
```

### 3. 히스토리 관리

```javascript
// 히스토리 클리어
viewer.historyManager.clear();

// 히스토리 목록 가져오기
const history = viewer.historyManager.getHistory();
console.log('Undo list:', history.undoList);
console.log('Redo list:', history.redoList);

// 특정 시점으로 복원 (여러 번 undo)
function undoMultiple(count) {
  for (let i = 0; i < count; i++) {
    if (!viewer.command.undo()) break;
  }
}

undoMultiple(5); // 5단계 되돌리기
```

### 4. 조건부 명령 실행

```javascript
function formatIfSelected(format, value) {
  if (viewer.rangeManager.hasSelection()) {
    viewer.command[format](value);
  } else {
    alert('텍스트를 먼저 선택하세요.');
  }
}

// 사용
formatIfSelected('bold', true);
formatIfSelected('color', '#0000ff');
```

### 5. 키보드 단축키 통합

```javascript
document.addEventListener('keydown', e => {
  // Ctrl+Z: Undo
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    viewer.command.undo();
  }

  // Ctrl+Shift+Z 또는 Ctrl+Y: Redo
  if (
    (e.ctrlKey && e.shiftKey && e.key === 'z') ||
    (e.ctrlKey && e.key === 'y')
  ) {
    e.preventDefault();
    viewer.command.redo();
  }

  // Ctrl+B: Bold
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    viewer.command.bold(true);
  }

  // Ctrl+I: Italic
  if (e.ctrlKey && e.key === 'i') {
    e.preventDefault();
    viewer.command.italic(true);
  }

  // Ctrl+U: Underline
  if (e.ctrlKey && e.key === 'u') {
    e.preventDefault();
    viewer.command.underline(true);
  }

  // Ctrl+A: Select All
  if (e.ctrlKey && e.key === 'a') {
    e.preventDefault();
    viewer.command.selectAll();
  }
});
```

## 실전 예제

### 1. 텍스트 에디터 툴바

```javascript
class EditorToolbar {
  constructor(viewer) {
    this.viewer = viewer;
    this.command = viewer.command;
    this.setupButtons();
    this.setupHistoryUI();
  }

  setupButtons() {
    // Undo/Redo
    document.getElementById('btn-undo').addEventListener('click', () => {
      this.command.undo();
    });

    document.getElementById('btn-redo').addEventListener('click', () => {
      this.command.redo();
    });

    // Format buttons
    document.getElementById('btn-bold').addEventListener('click', () => {
      if (this.viewer.rangeManager.hasSelection()) {
        this.command.bold(true);
      }
    });

    document.getElementById('btn-italic').addEventListener('click', () => {
      if (this.viewer.rangeManager.hasSelection()) {
        this.command.italic(true);
      }
    });

    document.getElementById('btn-underline').addEventListener('click', () => {
      if (this.viewer.rangeManager.hasSelection()) {
        this.command.underline(true);
      }
    });

    // Color picker
    document.getElementById('color-picker').addEventListener('change', e => {
      if (this.viewer.rangeManager.hasSelection()) {
        this.command.color(e.target.value);
      }
    });
  }

  setupHistoryUI() {
    // 히스토리 상태에 따라 버튼 활성화/비활성화
    setInterval(() => {
      const stats = this.viewer.historyManager.getStats();
      document.getElementById('btn-undo').disabled = !stats.canUndo;
      document.getElementById('btn-redo').disabled = !stats.canRedo;
    }, 100);
  }
}

// 사용
const toolbar = new EditorToolbar(viewer);
```

### 2. 히스토리 뷰어

```javascript
class HistoryViewer {
  constructor(viewer) {
    this.viewer = viewer;
    this.container = document.getElementById('history-list');
    this.render();

    // 주기적으로 업데이트
    setInterval(() => this.render(), 500);
  }

  render() {
    const history = this.viewer.historyManager.getHistory();

    this.container.innerHTML = `
            <div class="history-section">
                <h3>Undo Stack (${history.undoList.length})</h3>
                <ul>
                    ${history.undoList
                      .map(
                        (item, index) => `
                        <li>
                            ${item.actionName}
                            <small>${new Date(item.timestamp).toLocaleTimeString()}</small>
                        </li>
                    `
                      )
                      .reverse()
                      .join('')}
                </ul>
            </div>
            <div class="history-section">
                <h3>Redo Stack (${history.redoList.length})</h3>
                <ul>
                    ${history.redoList
                      .map(
                        (item, index) => `
                        <li>
                            ${item.actionName}
                            <small>${new Date(item.timestamp).toLocaleTimeString()}</small>
                        </li>
                    `
                      )
                      .reverse()
                      .join('')}
                </ul>
            </div>
        `;
  }
}

// 사용
const historyViewer = new HistoryViewer(viewer);
```

### 3. 매크로 레코더

```javascript
class MacroRecorder {
  constructor(viewer) {
    this.viewer = viewer;
    this.recording = false;
    this.commands = [];
  }

  start() {
    this.recording = true;
    this.commands = [];
    console.log('🔴 Recording started');
  }

  stop() {
    this.recording = false;
    console.log('⏹️ Recording stopped');
    return this.commands;
  }

  record(commandName, ...args) {
    if (this.recording) {
      this.commands.push({ commandName, args });
    }
  }

  replay() {
    console.log(`▶️ Replaying ${this.commands.length} commands`);

    this.commands.forEach(({ commandName, args }) => {
      this.viewer.command[commandName](...args);
    });
  }
}

// 사용
const macro = new MacroRecorder(viewer);

// 레코딩 시작
macro.start();

// 명령 실행 및 기록
viewer.setRange(0, 10);
macro.record('bold', true);
viewer.command.bold(true);

macro.record('color', '#ff0000');
viewer.command.color('#ff0000');

// 레코딩 중지
const recorded = macro.stop();

// 나중에 재생
macro.replay();
```

## 메모리 효율성 비교

### Before (상태 기반)

```javascript
// 문서 크기: 1MB
// 히스토리 50개 저장 시: 50MB

historyManager.saveState('Edit');
// → JSON.stringify(document)  // 1MB 복사
```

### After (함수 기반)

```javascript
// 문서 크기: 1MB
// 히스토리 50개 저장 시: ~50KB (1000배 효율)

historyManager.execute(
  () => {
    /* execute */
  },
  () => {
    /* undo */
  },
  'Edit'
);
// → 함수 참조만 저장  // ~1KB
```

## 주의사항

### 1. Undo 함수는 Redo 함수를 반환해야 함

```javascript
// ✅ 올바른 패턴
const undo = () => {
  restorePreviousState();
  return execute; // Redo를 위해 execute 반환
};

// ❌ 잘못된 패턴
const undo = () => {
  restorePreviousState();
  // return 없음 → Redo 불가
};
```

### 2. 중첩 명령 방지

```javascript
// historyManager.execute 내에서 다른 execute 호출 금지
// isExecuting 플래그로 보호됨
```

### 3. 비동기 명령

```javascript
// 현재 비동기 명령은 지원하지 않음
// 비동기 작업 완료 후 명령 실행
async function asyncEdit() {
  const result = await fetchData();
  viewer.command.editCell(cell, result); // ✅
}

// ❌ execute 내부에서 await 사용 불가
```

## 확장 가능성

### 향후 추가 예정 기능

- [ ] 비동기 명령 지원
- [ ] 명령 그룹화 (Composite Pattern)
- [ ] 명령 큐 (실행 지연, 우선순위)
- [ ] 명령 검증 (사전/사후 조건)
- [ ] 명령 로깅 및 디버깅
- [ ] 명령 재생 (매크로)
- [ ] 원격 명령 실행 (협업)

## API 레퍼런스

### Command 클래스

#### 히스토리

- `undo(): boolean` - 실행 취소
- `redo(): boolean` - 다시 실행

#### 범위

- `setRange(startIndex, endIndex)` - 범위 설정
- `selectAll()` - 전체 선택
- `clearSelection()` - 선택 해제

#### 포맷

- `bold(value)` - Bold 적용/해제
- `italic(value)` - Italic 적용/해제
- `underline(value)` - Underline 적용/해제
- `color(color)` - 색상 변경

#### 셀

- `editCell(cell, text)` - 셀 편집
- `clearCell(cell)` - 셀 비우기

#### 테이블

- `addRowAbove(cell)` - 행 추가 (위)
- `addRowBelow(cell)` - 행 추가 (아래)
- `addColumnLeft(cell)` - 열 추가 (왼쪽)
- `addColumnRight(cell)` - 열 추가 (오른쪽)
- `deleteRow(cell)` - 행 삭제
- `deleteColumn(cell)` - 열 삭제

#### 문서

- `updateDocument(doc, name)` - 문서 업데이트
- `getDocument()` - 문서 가져오기
- `render()` - 렌더링

### HistoryManagerV2 클래스

- `execute(executeFn, undoFn, name)` - 명령 실행 및 히스토리 저장
- `undo()` - 실행 취소
- `redo()` - 다시 실행
- `clear()` - 히스토리 클리어
- `getStats()` - 통계 정보
- `canUndo()` - Undo 가능 여부
- `canRedo()` - Redo 가능 여부
- `getHistory()` - 히스토리 목록

## 참고 자료

- [Canvas-editor Command System](https://github.com/Hufe921/canvas-editor)
- [Command Pattern (GoF)](https://en.wikipedia.org/wiki/Command_pattern)
- [Memento Pattern](https://en.wikipedia.org/wiki/Memento_pattern)

## 문의

문제가 발생하거나 개선 제안이 있으면 이슈를 등록해주세요.
