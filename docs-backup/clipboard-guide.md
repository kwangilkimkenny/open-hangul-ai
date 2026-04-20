# Clipboard Commands 가이드

## 개요

Clipboard Commands는 HWPX 뷰어에서 텍스트 복사, 잘라내기, 붙여넣기 기능을
제공합니다. 브라우저의 Clipboard API와 통합되어 시스템 클립보드와 완벽하게
연동됩니다.

## 주요 기능

### 1. Copy (복사)

- 선택된 텍스트를 시스템 클립보드에 복사
- 원본 문서는 변경되지 않음
- 단축키: `Ctrl+C` (Mac: `Cmd+C`)

### 2. Cut (잘라내기)

- 선택된 텍스트를 시스템 클립보드에 복사하고 삭제
- Undo/Redo 지원
- 단축키: `Ctrl+X` (Mac: `Cmd+X`)

### 3. Paste (붙여넣기)

- 클립보드의 텍스트를 커서 위치에 삽입
- 선택 영역이 있으면 선택 영역을 대체
- Undo/Redo 지원
- 단축키: `Ctrl+V` (Mac: `Cmd+V`)

## 아키텍처

```
사용자 입력 (Ctrl+C/X/V)
    ↓
Cursor._handleKeyDown()
    ↓
Cursor._handleCopy/Cut/Paste()
    ↓
Command API (copy/cut/paste)
    ↓
CommandAdapt (executeCopy/Cut/Paste)
    ↓
RangeManager (선택 영역 관리)
    ↓
Browser Clipboard API
```

## 기본 사용법

### 1. Copy

```javascript
// 텍스트 선택
viewer.command.setRange(0, 10);

// 복사
const text = viewer.command.copy();
console.log('Copied:', text);

// 또는 키보드 단축키 사용
// Ctrl+C (Mac: Cmd+C)
```

### 2. Cut

```javascript
// 텍스트 선택
viewer.command.setRange(0, 10);

// 잘라내기
const text = viewer.command.cut();
console.log('Cut:', text);

// Undo로 복원 가능
viewer.command.undo();

// 또는 키보드 단축키 사용
// Ctrl+X (Mac: Cmd+X)
```

### 3. Paste

```javascript
// 커서 위치 설정
viewer.getCursor().setCursorPosition(20);

// 붙여넣기
viewer.command.paste('Hello World');

// 또는 클립보드에서 직접 붙여넣기
const clipboardText = await navigator.clipboard.readText();
viewer.command.paste(clipboardText);

// 또는 키보드 단축키 사용
// Ctrl+V (Mac: Cmd+V)
```

## 키보드 단축키

### 클립보드 단축키

| 단축키   | Mac     | 기능     |
| -------- | ------- | -------- |
| `Ctrl+C` | `Cmd+C` | 복사     |
| `Ctrl+X` | `Cmd+X` | 잘라내기 |
| `Ctrl+V` | `Cmd+V` | 붙여넣기 |

### 추가 단축키

| 단축키          | Mac             | 기능        |
| --------------- | --------------- | ----------- |
| `Ctrl+Z`        | `Cmd+Z`         | 실행 취소   |
| `Ctrl+Y`        | `Cmd+Y`         | 다시 실행   |
| `Shift+화살표`  | `Shift+화살표`  | 텍스트 선택 |
| `마우스 드래그` | `마우스 드래그` | 텍스트 선택 |

## 고급 사용법

### 1. 선택 영역과 함께 사용

```javascript
// 텍스트 선택
viewer.command.setRange(0, 10);

// 선택된 텍스트 복사
const copiedText = viewer.command.copy();

// 다른 위치로 이동
viewer.getCursor().setCursorPosition(50);

// 붙여넣기
viewer.command.paste(copiedText);
```

### 2. 선택 영역 교체

```javascript
// 텍스트 선택
viewer.command.setRange(0, 10);

// 선택 영역에 새 텍스트 붙여넣기 (자동으로 선택 영역 삭제)
viewer.command.paste('New Text');
```

### 3. 프로그래밍 방식 클립보드 조작

```javascript
// 브라우저 클립보드에 직접 쓰기
await navigator.clipboard.writeText('Custom text');

// 브라우저 클립보드에서 읽기
const text = await navigator.clipboard.readText();
viewer.command.paste(text);
```

### 4. 복사/붙여넣기 유틸리티

```javascript
class ClipboardHelper {
  constructor(viewer) {
    this.viewer = viewer;
  }

  // 현재 선택된 텍스트 복사
  async copySelection() {
    const text = this.viewer.command.copy();
    if (text) {
      await navigator.clipboard.writeText(text);
      return text;
    }
    return null;
  }

  // 클립보드 내용을 현재 위치에 붙여넣기
  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.viewer.command.paste(text);
        return text;
      }
    } catch (error) {
      console.error('Paste failed:', error);
    }
    return null;
  }

  // 텍스트를 클립보드에 복사하고 특정 위치에 붙여넣기
  async copyAndPaste(sourceStart, sourceEnd, targetIndex) {
    // 복사
    this.viewer.command.setRange(sourceStart, sourceEnd);
    const text = await this.copySelection();

    if (text) {
      // 붙여넣기
      this.viewer.getCursor().setCursorPosition(targetIndex);
      this.viewer.command.paste(text);
    }
  }

  // 텍스트 이동 (잘라내기 + 붙여넣기)
  async moveText(sourceStart, sourceEnd, targetIndex) {
    // 잘라내기
    this.viewer.command.setRange(sourceStart, sourceEnd);
    const text = this.viewer.command.cut();

    if (text) {
      // 붙여넣기
      await navigator.clipboard.writeText(text);
      this.viewer.getCursor().setCursorPosition(targetIndex);
      this.viewer.command.paste(text);
    }
  }
}

// 사용
const clipboardHelper = new ClipboardHelper(viewer);
await clipboardHelper.copySelection();
await clipboardHelper.pasteFromClipboard();
```

### 5. 복사/붙여넣기 히스토리

```javascript
class ClipboardHistory {
  constructor(maxSize = 10) {
    this.history = [];
    this.maxSize = maxSize;
  }

  // 클립보드에 추가
  add(text) {
    this.history.unshift(text);
    if (this.history.length > this.maxSize) {
      this.history.pop();
    }
  }

  // 히스토리에서 가져오기
  get(index = 0) {
    return this.history[index] || null;
  }

  // 히스토리 목록
  getAll() {
    return [...this.history];
  }

  // 히스토리 초기화
  clear() {
    this.history = [];
  }
}

// 사용
const clipboardHistory = new ClipboardHistory(10);

// 복사 시 히스토리에 추가
viewer.getCursor().addEventListener('copy', e => {
  const text = viewer.command.copy();
  if (text) {
    clipboardHistory.add(text);
  }
});

// 이전 복사 내용 확인
console.log('Clipboard history:', clipboardHistory.getAll());

// 이전 복사 내용 붙여넣기
const previousCopy = clipboardHistory.get(1); // 2번째 복사 내용
if (previousCopy) {
  viewer.command.paste(previousCopy);
}
```

### 6. 다중 복사/붙여넣기

```javascript
class MultiClipboard {
  constructor() {
    this.clips = new Map();
  }

  // 특정 슬롯에 저장
  copy(viewer, slot = 'default') {
    const text = viewer.command.copy();
    if (text) {
      this.clips.set(slot, text);
      return text;
    }
    return null;
  }

  // 특정 슬롯에서 붙여넣기
  paste(viewer, slot = 'default') {
    const text = this.clips.get(slot);
    if (text) {
      viewer.command.paste(text);
      return text;
    }
    return null;
  }

  // 모든 슬롯 목록
  getSlots() {
    return Array.from(this.clips.keys());
  }

  // 슬롯 삭제
  delete(slot) {
    this.clips.delete(slot);
  }
}

// 사용
const multiClip = new MultiClipboard();

// 여러 텍스트를 다른 슬롯에 저장
viewer.command.setRange(0, 10);
multiClip.copy(viewer, 'header');

viewer.command.setRange(20, 30);
multiClip.copy(viewer, 'footer');

viewer.command.setRange(40, 50);
multiClip.copy(viewer, 'content');

// 나중에 필요한 슬롯에서 붙여넣기
multiClip.paste(viewer, 'header');
multiClip.paste(viewer, 'content');
```

## 브라우저 Clipboard API

### 권한

클립보드 접근에는 브라우저 권한이 필요할 수 있습니다:

```javascript
// 클립보드 읽기 권한 확인
const permission = await navigator.permissions.query({
  name: 'clipboard-read',
});
console.log('Clipboard read permission:', permission.state);

// 클립보드 쓰기 권한 확인
const writePermission = await navigator.permissions.query({
  name: 'clipboard-write',
});
console.log('Clipboard write permission:', writePermission.state);
```

### 폴백 처리

```javascript
async function copyToClipboard(text) {
  try {
    // 최신 Clipboard API 사용
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // 폴백: document.execCommand (deprecated)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
}

async function pasteFromClipboard() {
  try {
    // 최신 Clipboard API 사용
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }

    // 폴백: 사용자에게 수동 붙여넣기 요청
    const text = prompt('클립보드에서 텍스트를 붙여넣으세요:');
    return text;
  } catch (error) {
    console.error('Paste failed:', error);
    return null;
  }
}
```

## 보안 고려사항

### 1. HTTPS 필수

Clipboard API는 HTTPS 또는 localhost에서만 작동합니다:

```javascript
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.warn('⚠️ Clipboard API requires HTTPS or localhost');
}
```

### 2. 사용자 제스처 필요

일부 브라우저에서는 사용자 제스처(클릭, 키보드 입력) 내에서만 클립보드 접근이
가능합니다:

```javascript
// ✅ 버튼 클릭 핸들러 내에서 - 작동
button.addEventListener('click', async () => {
  await navigator.clipboard.writeText('text');
});

// ❌ setTimeout 내에서 - 작동하지 않을 수 있음
setTimeout(async () => {
  await navigator.clipboard.writeText('text'); // 오류 발생 가능
}, 1000);
```

### 3. 민감한 정보

클립보드에는 비밀번호나 개인정보를 복사하지 않도록 주의:

```javascript
function sanitizeClipboardText(text) {
  // 비밀번호 패턴 제거
  if (text.includes('password') || text.includes('secret')) {
    console.warn('⚠️ Sensitive information detected in clipboard');
    return null;
  }
  return text;
}
```

## 테스트

### 단위 테스트

테스트 파일: `docs/test-clipboard.html`

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 열기
open http://localhost:5173/docs/test-clipboard.html
```

### 테스트 시나리오

1. ✅ 텍스트 선택
2. ✅ Copy (Ctrl+C)
3. ✅ Cut (Ctrl+X)
4. ✅ Paste (Ctrl+V)
5. ✅ Undo/Redo
6. ✅ 선택 영역 교체
7. ✅ 시스템 클립보드 연동

### 수동 테스트

1. 텍스트 선택 (드래그 또는 Shift+화살표)
2. `Ctrl+C` 눌러 복사
3. 다른 위치로 커서 이동
4. `Ctrl+V` 눌러 붙여넣기
5. `Ctrl+Z`로 Undo 테스트
6. 외부 앱(메모장 등)에서 복사한 텍스트 붙여넣기 테스트

## 브라우저 호환성

### 지원 브라우저

| 브라우저 | 버전  | Clipboard API |
| -------- | ----- | ------------- |
| Chrome   | 66+   | ✅            |
| Firefox  | 63+   | ✅            |
| Safari   | 13.1+ | ✅            |
| Edge     | 79+   | ✅            |

### 폴백 지원

- `document.execCommand('copy')` (deprecated): 레거시 브라우저 지원
- 수동 붙여넣기 프롬프트: Clipboard API 미지원 시

## 제한사항

### 1. 플레인 텍스트만 지원

현재는 플레인 텍스트만 복사/붙여넣기가 가능합니다. Rich Text 포맷은 TODO입니다.

```javascript
// TODO: Rich Text 지원
// const html = viewer.command.copyAsHTML();
// viewer.command.pasteHTML(html);
```

### 2. 이미지/표 복사

이미지나 표를 포함한 복잡한 구조는 아직 지원하지 않습니다.

```javascript
// TODO: 구조화된 데이터 복사
// const data = viewer.command.copyWithFormat();
// viewer.command.pasteWithFormat(data);
```

### 3. 크로스 브라우저 일관성

브라우저마다 클립보드 동작이 약간씩 다를 수 있습니다.

## 향후 계획

- [ ] Rich Text 포맷 복사/붙여넣기
- [ ] 이미지 복사/붙여넣기
- [ ] 표 구조 복사/붙여넣기
- [ ] 여러 선택 영역 동시 복사
- [ ] 클립보드 히스토리 UI
- [ ] 붙여넣기 옵션 (서식 유지/제거)
- [ ] 드래그 앤 드롭 지원

## 트러블슈팅

### 클립보드 권한 오류

```javascript
// 문제: "Read permission denied" 오류
// 해결: 사용자 제스처 내에서 실행하거나 권한 요청

try {
  const text = await navigator.clipboard.readText();
} catch (error) {
  if (error.name === 'NotAllowedError') {
    console.warn('⚠️ 클립보드 권한이 필요합니다');
    // 사용자에게 권한 요청 안내
  }
}
```

### HTTPS 필요 오류

```javascript
// 문제: "Clipboard API not available"
// 해결: HTTPS 또는 localhost 사용

if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  alert('클립보드 기능을 사용하려면 HTTPS가 필요합니다');
}
```

### 빈 클립보드

```javascript
// 문제: 붙여넣기 시 빈 문자열
// 해결: 클립보드 내용 확인

const text = await navigator.clipboard.readText();
if (!text || text.length === 0) {
  console.warn('⚠️ 클립보드가 비어있습니다');
  return;
}
```

## API 레퍼런스

### Command 클래스

#### copy()

```javascript
/**
 * 선택된 텍스트 복사
 * @returns {string} 복사된 텍스트
 */
const text = viewer.command.copy();
```

#### cut()

```javascript
/**
 * 선택된 텍스트 잘라내기
 * @returns {string} 잘라낸 텍스트
 */
const text = viewer.command.cut();
```

#### paste(text)

```javascript
/**
 * 텍스트 붙여넣기
 * @param {string} text - 붙여넣을 텍스트
 */
viewer.command.paste('Hello World');
```

### Cursor 클래스

키보드 단축키는 자동으로 처리됩니다:

- `Ctrl+C`: 복사
- `Ctrl+X`: 잘라내기
- `Ctrl+V`: 붙여넣기

## 참고 자료

- [MDN: Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [Command Pattern 가이드](./command-pattern-guide.md)
- [RangeManager 가이드](./range-manager-guide.md)
- [Cursor 가이드](./cursor-guide.md)

## 문의

문제가 발생하거나 개선 제안이 있으면 이슈를 등록해주세요.
