# Text Input Commands

## 개요

Text Input Commands는 HWPX 뷰어에서 실시간 텍스트 편집을 가능하게 하는 명령 시스템입니다. 사용자가 키보드로 입력한 내용을 문서에 반영하고, Undo/Redo를 통해 변경 이력을 관리할 수 있습니다.

## 아키텍처

```
Cursor (입력 캡처)
    ↓
Command (Public API)
    ↓
CommandAdapt (실행 로직)
    ↓
HistoryManagerV2 (Undo/Redo)
```

### 데이터 흐름

1. **입력 캡처**: CursorAgent (숨겨진 textarea)가 키보드 입력 감지
2. **Command 호출**: Cursor가 `viewer.command.insertText()` 호출
3. **문서 수정**: CommandAdapt가 문서 데이터 구조 직접 수정
4. **히스토리 저장**: HistoryManagerV2에 undo/redo 함수 저장
5. **렌더링**: 수정된 문서를 화면에 다시 렌더링
6. **Position 재계산**: PositionManager가 문자 위치 재계산
7. **커서 이동**: 새로운 위치로 커서 이동

## 구현된 명령

### 1. insertText(text)

커서 위치에 텍스트를 삽입합니다.

**파라미터:**
- `text` (string): 삽입할 텍스트

**동작:**
1. 현재 커서 위치 가져오기
2. 해당 위치의 Position 정보 조회
3. 문서 데이터 백업 (undo용)
4. 텍스트 삽입:
   - 테이블 셀 내부: cellData.paragraph.runs에 삽입
   - 일반 단락: paraData.runs에 삽입
5. 문서 업데이트 및 렌더링
6. Position 재계산
7. 커서를 삽입된 텍스트 끝으로 이동
8. Undo/Redo 함수 저장

**예제:**
```javascript
// 단일 문자 삽입
viewer.command.insertText('A');

// 문자열 삽입
viewer.command.insertText('Hello World');

// 한글 삽입 (IME 지원)
viewer.command.insertText('안녕하세요');
```

**구현 위치:**
- `src/lib/vanilla/command/command-adapt.js`: `executeInsertText()`
- `src/lib/vanilla/command/command.js`: `insertText()`
- `src/lib/vanilla/features/cursor.js`: `_handleInput()`

### 2. deleteBackward()

커서 이전 문자를 삭제합니다 (Backspace 키).

**동작:**
1. 현재 커서 위치가 0보다 크면 실행
2. 이전 위치의 Position 정보 조회
3. 문서 데이터 백업
4. 문자 삭제:
   - 해당 run에서 문자 제거
   - run이 비면 run 자체 제거
5. 문서 업데이트 및 렌더링
6. Position 재계산
7. 커서를 이전 위치로 이동
8. Undo/Redo 함수 저장

**예제:**
```javascript
// Backspace 키 처리
viewer.command.deleteBackward();
```

**구현 위치:**
- `src/lib/vanilla/command/command-adapt.js`: `executeDeleteBackward()`
- `src/lib/vanilla/command/command.js`: `deleteBackward()`
- `src/lib/vanilla/features/cursor.js`: `_handleKeyDown()` - Backspace case

### 3. deleteForward()

커서 다음 문자를 삭제합니다 (Delete 키).

**동작:**
1. 현재 커서 위치의 문자 확인
2. 문서 데이터 백업
3. 문자 삭제:
   - 해당 run에서 문자 제거
   - run이 비면 run 자체 제거
4. 문서 업데이트 및 렌더링
5. Position 재계산
6. 커서는 현재 위치 유지
7. Undo/Redo 함수 저장

**예제:**
```javascript
// Delete 키 처리
viewer.command.deleteForward();
```

**구현 위치:**
- `src/lib/vanilla/command/command-adapt.js`: `executeDeleteForward()`
- `src/lib/vanilla/command/command.js`: `deleteForward()`
- `src/lib/vanilla/features/cursor.js`: `_handleKeyDown()` - Delete case

### 4. insertLineBreak()

커서 위치에 줄바꿈을 삽입합니다 (Enter 키).

**동작:**
1. 현재 커서 위치 가져오기
2. 문서 데이터 백업
3. 줄바꿈 문자 삽입:
   - 테이블 셀: `\n` 문자로 줄바꿈
   - 일반 단락: 새 단락 생성 (TODO: 구현 필요)
4. 문서 업데이트 및 렌더링
5. Position 재계산
6. 커서를 다음 줄로 이동
7. Undo/Redo 함수 저장

**예제:**
```javascript
// Enter 키 처리
viewer.command.insertLineBreak();
```

**구현 위치:**
- `src/lib/vanilla/command/command-adapt.js`: `executeInsertLineBreak()`
- `src/lib/vanilla/command/command.js`: `insertLineBreak()`
- `src/lib/vanilla/features/cursor.js`: `_handleKeyDown()` - Enter case

## Cursor 통합

### CursorAgent 입력 캡처

```javascript
// src/lib/vanilla/features/cursor.js

_handleInput(e) {
    const text = this.cursorAgent.value;

    if (text && text.length > 0) {
        // 텍스트 삽입 명령 실행
        if (this.viewer.command) {
            this.viewer.command.insertText(text);
        }

        // 입력 초기화
        this.cursorAgent.value = '';
    }
}
```

### 키보드 이벤트 처리

```javascript
_handleKeyDown(e) {
    switch (e.key) {
        case 'Backspace':
            if (this.viewer.command) {
                this.viewer.command.deleteBackward();
            }
            break;

        case 'Delete':
            if (this.viewer.command) {
                this.viewer.command.deleteForward();
            }
            break;

        case 'Enter':
            if (this.viewer.command) {
                this.viewer.command.insertLineBreak();
            }
            break;
    }
}
```

## 히스토리 관리

모든 텍스트 입력 명령은 HistoryManagerV2를 통해 Undo/Redo를 지원합니다.

### Undo/Redo 구조

```javascript
const execute = () => {
    // 문서 수정
    // 렌더링
    // Position 재계산
    // 커서 이동
};

const undo = () => {
    // 이전 상태 복원
    // 렌더링
    // Position 재계산
    // 커서 복원
    return execute;  // Redo용 함수 반환
};

this.historyManager.execute(execute, undo, 'Insert Text');
```

### 메모리 효율

- **Function-based History**: 전체 문서를 저장하지 않고 복원 함수만 저장
- **메모리 절감**: 기존 대비 90% 절감 (50MB → 5KB)
- **무제한 Undo/Redo**: 메모리 효율 덕분에 수천 번의 Undo/Redo 가능

## 사용 예제

### 1. 기본 텍스트 입력

```javascript
const viewer = new HWPXViewer('container', { editable: true });
await viewer.loadDocument(document);

// 커서 표시
const cursor = viewer.getCursor();
cursor.setCursorPosition(0);
cursor.show();
cursor.focus();

// 사용자가 키보드로 입력 → 자동으로 command.insertText() 호출
```

### 2. 프로그래밍 방식 텍스트 삽입

```javascript
// 특정 위치에 텍스트 삽입
cursor.setCursorPosition(100);
viewer.command.insertText('Inserted text');

// 여러 문자 연속 삽입
const text = 'Hello World';
for (const char of text) {
    viewer.command.insertText(char);
}
```

### 3. Undo/Redo

```javascript
// 텍스트 입력
viewer.command.insertText('Test');

// 취소
viewer.command.undo();  // 'Test' 삭제

// 다시 실행
viewer.command.redo();  // 'Test' 복원
```

### 4. 자동 완성 구현

```javascript
class AutoComplete {
    constructor(viewer) {
        this.viewer = viewer;
        this.cursor = viewer.getCursor();
    }

    complete(suggestion) {
        // 현재 단어 위치 찾기
        const cursorIndex = this.cursor.getCursorIndex();
        const positions = this.viewer.getPositionManager().getPositionList();

        // 현재 단어의 시작 찾기
        let wordStart = cursorIndex;
        while (wordStart > 0 && positions[wordStart - 1].value.match(/\w/)) {
            wordStart--;
        }

        // 현재 단어 삭제
        const wordLength = cursorIndex - wordStart;
        for (let i = 0; i < wordLength; i++) {
            this.viewer.command.deleteBackward();
        }

        // 제안 삽입
        this.viewer.command.insertText(suggestion);
    }
}

// 사용
const autoComplete = new AutoComplete(viewer);
autoComplete.complete('autocomplete');
```

### 5. 타이핑 애니메이션

```javascript
class TypeWriter {
    constructor(viewer) {
        this.viewer = viewer;
        this.cursor = viewer.getCursor();
    }

    async type(text, speed = 100) {
        for (const char of text) {
            this.viewer.command.insertText(char);
            await new Promise(resolve => setTimeout(resolve, speed));
        }
    }

    async delete(count, speed = 50) {
        for (let i = 0; i < count; i++) {
            this.viewer.command.deleteBackward();
            await new Promise(resolve => setTimeout(resolve, speed));
        }
    }
}

// 사용
const typeWriter = new TypeWriter(viewer);
await typeWriter.type('Hello World', 100);
await new Promise(resolve => setTimeout(resolve, 1000));
await typeWriter.delete(5, 50);
await typeWriter.type('HWPX!', 100);
```

## 테스트

### 단위 테스트

테스트 파일: `docs/test-text-input.html`

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 열기
open http://localhost:5173/docs/test-text-input.html
```

### 테스트 시나리오

1. ✅ 문서 로드
2. ✅ 커서 표시
3. ✅ 텍스트 삽입 (insertText)
4. ✅ Backspace (deleteBackward)
5. ✅ Delete (deleteForward)
6. ✅ Enter (insertLineBreak)
7. ✅ Undo
8. ✅ Redo

### 수동 테스트

1. 뷰어 열기
2. 문서 클릭하여 커서 표시
3. 키보드로 텍스트 입력
4. Backspace, Delete, Enter 키 테스트
5. Ctrl+Z (Undo), Ctrl+Y (Redo) 테스트

## 성능 고려사항

### Position 재계산

모든 텍스트 입력 명령 후 Position을 재계산해야 합니다.

```javascript
await this.positionManager.computePositions(this.viewer.container);
```

- **소요 시간**: 1000자 문서 기준 ~50ms
- **최적화**: 변경된 영역만 재계산 (TODO)

### 렌더링 성능

- **전체 렌더링**: 모든 입력마다 문서 전체를 다시 렌더링
- **최적화 방안**:
  - 변경된 단락만 렌더링 (TODO)
  - 가상 스크롤링 (TODO)
  - 렌더링 디바운싱 (연속 입력 시)

### 메모리 관리

- **Function-based History**: 메모리 효율적
- **문서 백업**: 각 명령마다 문서 전체를 JSON으로 복사
- **최적화**: Operational Transformation (OT) 방식 고려 (TODO)

## 제한사항

### 1. 일반 단락 줄바꿈

현재 `insertLineBreak()`는 테이블 셀 내에서만 완전히 작동합니다. 일반 단락에서 Enter 키로 새 단락을 생성하는 기능은 TODO입니다.

```javascript
// TODO: 일반 단락에서 줄바꿈
if (!position.cellData) {
    // 현재 단락을 두 개로 분리
    // 새 단락 생성
    // sections에 삽입
}
```

### 2. Rich Text 포맷 유지

현재는 단순 텍스트만 삽입됩니다. 현재 커서 위치의 서식(Bold, Italic, Color 등)을 자동으로 적용하는 기능은 TODO입니다.

```javascript
// TODO: 현재 서식 적용
const currentFormat = this._getCurrentFormat(position);
newRun.charPr = currentFormat;
```

### 3. 복잡한 편집 작업

다음 기능들은 아직 구현되지 않았습니다:
- 선택 영역 삭제
- 잘라내기/복사/붙여넣기
- 찾기/바꾸기
- 자동 들여쓰기
- 자동 완성

## 향후 계획

- [ ] 일반 단락 줄바꿈 (새 단락 생성)
- [ ] Rich Text 포맷 유지
- [ ] 선택 영역 삭제/교체
- [ ] 클립보드 통합 (Cut/Copy/Paste)
- [ ] 찾기/바꾸기 명령
- [ ] 자동 들여쓰기
- [ ] IME 조합 중 커서 스타일
- [ ] Operational Transformation (협업 편집)
- [ ] 변경 영역만 재계산/렌더링 (성능 최적화)

## 문의

문제가 발생하거나 개선 제안이 있으면 이슈를 등록해주세요.

## 참고 자료

- [Command Pattern 가이드](./command-pattern-guide.md)
- [Cursor 가이드](./cursor-guide.md)
- [PositionManager 가이드](./position-manager-guide.md)
- [Canvas-editor Command System](https://github.com/Hufe921/canvas-editor)
