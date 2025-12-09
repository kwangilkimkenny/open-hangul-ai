# API Reference

## 📋 목차

1. [HWPXViewer](#hwpxviewer)
2. [AIDocumentController](#aidocumentcontroller)
3. [ExternalDataFetcher](#externaldatafetcher)
4. [CellSelector](#cellselector)
5. [ChatPanel](#chatpanel)
6. [이벤트](#이벤트)
7. [타입 정의](#타입-정의)

---

## HWPXViewer

HWPX 문서 뷰어 메인 클래스

### Constructor

```javascript
new HWPXViewer(options)
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `options.container` | HTMLElement \| string | 필수 | 뷰어 컨테이너 |
| `options.enableAI` | boolean | `true` | AI 기능 활성화 |
| `options.useWorker` | boolean | `false` | Web Worker 사용 |
| `options.autoRender` | boolean | `true` | 자동 렌더링 |

### Methods

#### `loadFile(file)`

HWPX 파일 로드

```javascript
await viewer.loadFile(file);
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `file` | File | HWPX 파일 객체 |

**반환**: `Promise<Object>` - 파싱된 문서

#### `getDocument()`

현재 문서 가져오기

```javascript
const document = viewer.getDocument();
```

**반환**: `Object | null` - 파싱된 문서 객체

#### `updateDocument(document)`

문서 업데이트 및 재렌더링

```javascript
await viewer.updateDocument(modifiedDocument);
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `document` | Object | 수정된 문서 객체 |

#### `saveFile(filename?)`

HWPX 파일로 저장

```javascript
await viewer.saveFile('output.hwpx');
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `filename` | string | 원본 파일명 | 저장할 파일명 |

#### `printDocument()`

문서 인쇄

```javascript
viewer.printDocument();
```

#### `reset()`

뷰어 초기화

```javascript
viewer.reset();
```

#### `destroy()`

뷰어 제거 (메모리 정리)

```javascript
viewer.destroy();
```

### Properties

| 속성 | 타입 | 설명 |
|------|------|------|
| `state.document` | Object | 현재 문서 |
| `state.currentFile` | File | 현재 파일 |
| `state.isLoading` | boolean | 로딩 상태 |
| `aiController` | AIDocumentController | AI 컨트롤러 |
| `inlineEditor` | InlineEditor | 인라인 편집기 |

---

## AIDocumentController

AI 문서 편집 컨트롤러

### Constructor

```javascript
new AIDocumentController(viewer, options)
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `viewer` | HWPXViewer | 뷰어 인스턴스 |
| `options.autoRender` | boolean | 자동 렌더링 (기본: true) |

### Methods

#### `setApiKey(apiKey)`

OpenAI API 키 설정

```javascript
controller.setApiKey('sk-...');
```

#### `hasApiKey()`

API 키 설정 여부 확인

```javascript
const hasKey = controller.hasApiKey(); // true/false
```

#### `handleUserRequest(message)`

사용자 요청 처리 (GPT 기반)

```javascript
const result = await controller.handleUserRequest('쉽게 바꿔줘');
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `message` | string | 사용자 요청 메시지 |

**반환**:
```javascript
{
    success: true,
    updatedDocument: Object,
    metadata: {
        request: string,
        slotsUpdated: number,
        tokensUsed: number
    }
}
```

#### `handleUserRequestWithCellSelection(message, cellData)`

셀 선택 데이터를 포함한 요청 처리

```javascript
const result = await controller.handleUserRequestWithCellSelection(
    '내용 생성해줘',
    {
        keepCells: [...],
        editCells: [...],
        generateCells: [...],
        autoCells: [...]
    }
);
```

#### `fillFromExternalAPI(url, options)`

외부 API 데이터로 문서 채우기

```javascript
const result = await controller.fillFromExternalAPI(
    'https://api.example.com/data',
    {
        method: 'GET',
        headers: { 'Authorization': 'Bearer xxx' },
        mapping: {
            '학생 이름': 'student.name',
            '점수': 'scores.total'
        },
        autoMap: false
    }
);
```

| 옵션 | 타입 | 설명 |
|------|------|------|
| `method` | string | HTTP 메서드 (GET/POST) |
| `headers` | Object | 요청 헤더 |
| `body` | Object | POST body |
| `mapping` | Object | 필드 매핑 |
| `autoMap` | boolean | 자동 매핑 사용 |

**반환**:
```javascript
{
    success: true,
    updatedDocument: Object,
    metadata: {
        apiUrl: string,
        itemsUpdated: number,
        data: Object
    }
}
```

#### `previewWithSampleData()`

샘플 데이터로 미리보기

```javascript
const result = await controller.previewWithSampleData();
```

#### `saveAsHwpx(filename)`

HWPX 파일 저장

```javascript
await controller.saveAsHwpx('output.hwpx');
```

#### `getCurrentDocument()`

현재 문서 상태 가져오기 (업데이트된 문서 또는 원본)

```javascript
const doc = controller.getCurrentDocument();
```

#### `getDataFetcher()`

ExternalDataFetcher 인스턴스 반환

```javascript
const fetcher = controller.getDataFetcher();
```

### Properties

| 속성 | 타입 | 설명 |
|------|------|------|
| `state.isProcessing` | boolean | 처리 중 상태 |
| `state.originalDocument` | Object | 원본 문서 |
| `state.updatedDocument` | Object | 수정된 문서 |
| `state.error` | Error | 마지막 에러 |

---

## ExternalDataFetcher

외부 API 데이터 가져오기 클래스

### Constructor

```javascript
new ExternalDataFetcher()
```

### Methods

#### `fetchData(url, options)`

API에서 데이터 가져오기

```javascript
const data = await fetcher.fetchData('https://api.example.com', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer xxx' },
    body: { param: 'value' }  // POST 시
});
```

**반환**: `Promise<Object>` - JSON 데이터

#### `transformToTemplateFormat(data, mapping)`

JSON 데이터를 템플릿 형식으로 변환

```javascript
const result = fetcher.transformToTemplateFormat(
    { student: { name: '홍길동' } },
    { '학생 이름': 'student.name' }
);
// { '학생 이름': '홍길동' }
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `data` | Object | 원본 JSON |
| `mapping` | Object | 매핑 설정 `{ templateKey: jsonPath }` |

#### `autoExtractKeys(data)`

JSON에서 자동으로 키-값 추출

```javascript
const flat = fetcher.autoExtractKeys({
    student: { name: '홍길동', age: 10 }
});
// { name: '홍길동', age: '10' }
```

#### `autoMapToDocument(document, data)`

문서 헤더와 JSON 키 자동 매핑

```javascript
const { mapping, flattenedData } = fetcher.autoMapToDocument(document, jsonData);
```

#### `getCached(url, maxAge?)`

캐시된 데이터 가져오기

```javascript
const cached = fetcher.getCached(url, 5 * 60 * 1000); // 5분
```

#### `clearCache()`

캐시 초기화

```javascript
fetcher.clearCache();
```

#### `static getSampleData()`

샘플 데이터 반환

```javascript
const sample = ExternalDataFetcher.getSampleData();
```

### Properties

| 속성 | 타입 | 설명 |
|------|------|------|
| `lastResponse` | Object | 마지막 API 응답 |
| `lastError` | Object | 마지막 에러 |
| `cache` | Map | 캐시 데이터 |

---

## CellSelector

셀 선택 모드 관리자

### Constructor

```javascript
new CellSelector(viewer)
```

### Methods

#### `activate()`

셀 선택 모드 활성화

```javascript
selector.activate();
```

#### `deactivate()`

셀 선택 모드 비활성화

```javascript
selector.deactivate();
```

#### `toggle()`

토글

```javascript
const isActive = selector.toggle();
```

#### `setCellMode(cellId, mode, cellElement?)`

셀 모드 설정

```javascript
selector.setCellMode('t0-r1-c2', 'keep');
```

| 모드 | 값 | 설명 |
|------|-----|------|
| 자동 | `'auto'` | 자동 감지 |
| 유지 | `'keep'` | 원본 유지 |
| 수정 | `'edit'` | 기존 내용 수정 |
| 생성 | `'generate'` | 새로 생성 |

#### `setAllCellsMode(mode)`

모든 셀에 모드 적용

```javascript
selector.setAllCellsMode('generate');
```

#### `resetAllCells()`

모든 셀 초기화

```javascript
selector.resetAllCells();
```

#### `autoDetectHeaders()`

헤더 자동 감지 및 설정

```javascript
selector.autoDetectHeaders();
// 첫 행/열: keep, 나머지: generate
```

#### `getSelectionSummary()`

선택 요약 가져오기

```javascript
const summary = selector.getSelectionSummary();
// { total: 20, keep: 5, edit: 3, generate: 10, auto: 2 }
```

#### `buildAIRequestData()`

AI 요청용 데이터 생성

```javascript
const data = selector.buildAIRequestData();
// { keepCells: [...], editCells: [...], generateCells: [...], autoCells: [...] }
```

#### `saveState()`

현재 상태 저장 (JSON)

```javascript
const json = selector.saveState();
```

#### `loadState(json)`

상태 불러오기

```javascript
selector.loadState(jsonString);
```

### Properties

| 속성 | 타입 | 설명 |
|------|------|------|
| `isActive` | boolean | 활성화 상태 |
| `cellModes` | Map | 셀별 모드 |
| `onSelectionChange` | Function | 변경 콜백 |

### Events

#### `cellSelectionApplied`

셀 선택 적용 시 발생

```javascript
document.addEventListener('cellSelectionApplied', (e) => {
    const { summary, requestData } = e.detail;
});
```

---

## ChatPanel

AI 채팅 패널

### Constructor

```javascript
new ChatPanel(aiController)
```

### Methods

#### `init()`

패널 초기화

```javascript
panel.init();
```

#### `open() / close() / toggle()`

패널 열기/닫기

```javascript
panel.open();
panel.close();
panel.toggle();
```

#### `addMessage(type, content)`

메시지 추가

```javascript
panel.addMessage('user', '요청 메시지');
panel.addMessage('assistant', '응답 메시지');
panel.addMessage('system', '시스템 알림');
```

#### `addUserMessage(content) / addAssistantMessage(content) / addSystemMessage(content)`

타입별 메시지 추가

```javascript
panel.addUserMessage('요청');
panel.addAssistantMessage('응답');
panel.addSystemMessage('알림');
```

#### `addErrorMessage(content)`

에러 메시지 추가

```javascript
panel.addErrorMessage('오류 발생!');
```

#### `removeMessage(id)`

메시지 제거

```javascript
panel.removeMessage(messageId);
```

#### `clearMessages()`

모든 메시지 삭제

```javascript
panel.clearMessages();
```

#### `showExternalApiModal()`

외부 API 모달 표시

```javascript
panel.showExternalApiModal();
```

#### `handleCellSelectMode()`

셀 선택 모드 토글

```javascript
panel.handleCellSelectMode();
```

---

## 이벤트

### 문서 이벤트

```javascript
// 문서 로드 완료
viewer.on('documentLoaded', (document) => { });

// 문서 업데이트
viewer.on('documentUpdated', (document) => { });

// 저장 완료
viewer.on('documentSaved', (filename) => { });
```

### 편집 이벤트

```javascript
// 셀 편집 시작
viewer.on('cellEditStart', (cell) => { });

// 셀 편집 완료
viewer.on('cellEditEnd', (cell, oldText, newText) => { });
```

### AI 이벤트

```javascript
// AI 처리 시작
aiController.on('processingStart', () => { });

// AI 처리 완료
aiController.on('processingComplete', (result) => { });

// AI 처리 에러
aiController.on('processingError', (error) => { });
```

### 셀 선택 이벤트

```javascript
// 셀 선택 적용
document.addEventListener('cellSelectionApplied', (e) => {
    const { summary, requestData } = e.detail;
});
```

---

## 타입 정의

### HWPXDocument

```typescript
interface HWPXDocument {
    sections: Section[];
    images: Map<string, ImageInfo>;
    rawHeaderXml: string;
    metadata: {
        parsedAt: string;
        sectionsCount: number;
        imagesCount: number;
    };
}
```

### Section

```typescript
interface Section {
    elements: (Paragraph | Table | Image | Shape)[];
}
```

### Table

```typescript
interface Table {
    type: 'table';
    rows: Row[];
    style: {
        width: number;
        borderStyle?: string;
    };
}
```

### Row

```typescript
interface Row {
    cells: Cell[];
    height?: number;
}
```

### Cell

```typescript
interface Cell {
    elements: Paragraph[];
    style: {
        width?: number;
        height?: number;
        backgroundColor?: string;
        borderTop?: string;
        borderBottom?: string;
        borderLeft?: string;
        borderRight?: string;
        verticalAlign?: string;
    };
    colspan?: number;
    rowspan?: number;
    isHeader?: boolean;
}
```

### Paragraph

```typescript
interface Paragraph {
    type: 'paragraph';
    runs: Run[];
    style: {
        textAlign?: 'left' | 'center' | 'right' | 'justify';
        lineHeight?: number;
        marginTop?: number;
        marginBottom?: number;
        indent?: number;
    };
}
```

### Run

```typescript
interface Run {
    text: string;
    style: {
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: string;
        fontStyle?: string;
        color?: string;
        backgroundColor?: string;
        underline?: boolean;
        strikethrough?: boolean;
    };
}
```

### Image

```typescript
interface Image {
    type: 'image';
    binaryId: string;
    src?: string;  // Blob URL
    width: number;
    height: number;
    position?: {
        x: number;
        y: number;
    };
}
```

### CellSelectionData

```typescript
interface CellSelectionData {
    keepCells: CellInfo[];
    editCells: CellInfo[];
    generateCells: CellInfo[];
    autoCells: CellInfo[];
}

interface CellInfo {
    id: string;
    content: string;
    header?: string;
    path?: {
        section: number;
        table: number;
        row: number;
        cell: number;
    };
}
```

### ExternalAPIOptions

```typescript
interface ExternalAPIOptions {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: object;
    mapping?: Record<string, string>;
    autoMap?: boolean;
}
```

### AIResult

```typescript
interface AIResult {
    success: boolean;
    updatedDocument?: HWPXDocument;
    metadata: {
        request?: string;
        slotsUpdated?: number;
        itemsUpdated?: number;
        tokensUsed?: number;
        apiUrl?: string;
        data?: object;
    };
}
```

---

## 전역 객체

디버깅용 전역 접근

```javascript
// 뷰어 인스턴스
window.viewer

// 셀 선택기
window.CellSelector
window.CellMode

// 외부 데이터 fetcher
window.ExternalDataFetcher

// 편집 모드 매니저
window.editModeManager

// 로그 레벨 설정
window.setLogLevel('debug' | 'info' | 'warn' | 'error')
```

---

## 에러 타입

```javascript
import { HWPXError, ErrorType } from './utils/error.js';

// 에러 타입
ErrorType.PARSE_ERROR      // 파싱 에러
ErrorType.RENDER_ERROR     // 렌더링 에러
ErrorType.EXPORT_ERROR     // 내보내기 에러
ErrorType.VALIDATION_ERROR // 유효성 검사 에러
ErrorType.API_ERROR        // API 에러
ErrorType.NETWORK_ERROR    // 네트워크 에러

// 에러 생성
throw new HWPXError(ErrorType.VALIDATION_ERROR, '문서가 없습니다');

// 에러 처리
try {
    await viewer.loadFile(file);
} catch (error) {
    if (error instanceof HWPXError) {
        console.log(error.type, error.message);
    }
}
```

