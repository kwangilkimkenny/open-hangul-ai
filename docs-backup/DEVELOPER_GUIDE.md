# HWPX Viewer + AI Editor 개발자 가이드

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [핵심 아키텍처](#핵심-아키텍처)
5. [주요 모듈 상세](#주요-모듈-상세)
6. [데이터 흐름](#데이터-흐름)
7. [개발 환경 설정](#개발-환경-설정)
8. [확장 가이드](#확장-가이드)
9. [트러블슈팅](#트러블슈팅)
10. [최적화 포인트](#최적화-포인트)

---

## 프로젝트 개요

### 목적

한글(HWP/HWPX) 문서를 웹 브라우저에서 뷰잉, 편집, AI 기반 내용 생성, 외부 API
연동을 지원하는 React 애플리케이션입니다.

### 주요 기능

- **HWPX 파싱 및 렌더링**: 한글 문서를 브라우저에서 표시
- **인라인 편집**: 테이블 셀, 단락 직접 편집
- **AI 문서 편집**: GPT API를 통한 내용 생성/수정
- **외부 API 연동**: JSON 데이터를 템플릿 문서에 채우기
- **셀 선택 모드**: 템플릿 추출 시 셀 단위 모드 설정
- **HWPX 저장**: 편집된 내용을 HWPX로 다운로드

### 핵심 설계 결정

- **Vanilla JS Wrapper 패턴**: 기존 순수 JavaScript 뷰어를 React로 래핑
- **원본 보존 전략**: HWPX 저장 시 원본 ZIP 기반으로 수정된 부분만 교체
- **자동 줄바꿈 처리**: `linesegarray` 제거 및 `lineWrap` 속성 추가

---

## 기술 스택

| 분류           | 기술            | 버전  | 용도              |
| -------------- | --------------- | ----- | ----------------- |
| **프레임워크** | React           | 19.x  | UI 컴포넌트       |
| **언어**       | TypeScript      | 5.9.x | 타입 안전성       |
| **빌드**       | Vite            | 7.x   | 빌드 및 개발 서버 |
| **상태관리**   | Zustand         | 5.x   | 전역 상태         |
| **ZIP 처리**   | JSZip           | 3.x   | HWPX 압축/해제    |
| **아이콘**     | Lucide React    | -     | UI 아이콘         |
| **토스트**     | React Hot Toast | -     | 알림              |
| **AI**         | OpenAI GPT-4    | -     | 내용 생성         |

---

## 프로젝트 구조

```
src/
├── components/                    # React 컴포넌트
│   ├── HWPXViewerWrapper.tsx     # ⭐ 핵심: Vanilla JS 뷰어 래퍼
│   ├── SimpleHeader.tsx          # 헤더 (파일 열기, 저장, 인쇄)
│   └── layout/
│       └── AppLayout.tsx         # 앱 레이아웃
│
├── lib/
│   └── vanilla/                  # ⭐ Vanilla JS 모듈들
│       ├── viewer.js             # ⭐ 핵심: HWPX 뷰어 메인
│       │
│       ├── core/                 # 코어 모듈
│       │   ├── parser.js         # ⭐ HWPX 파싱 (ZIP → JSON)
│       │   └── renderer.js       # 문서 렌더링 (JSON → HTML)
│       │
│       ├── ai/                   # AI 모듈
│       │   ├── ai-controller.js  # ⭐ AI 총괄 컨트롤러
│       │   ├── structure-extractor.js  # 문서 구조 추출
│       │   ├── gpt-content-generator.js # GPT 내용 생성
│       │   ├── content-merger.js # 내용 병합
│       │   └── prompt-builder.js # 프롬프트 빌더
│       │
│       ├── api/                  # 외부 API 모듈
│       │   └── external-data-fetcher.js # ⭐ 외부 API 데이터 가져오기
│       │
│       ├── export/               # 내보내기 모듈
│       │   └── hwpx-safe-exporter.js # ⭐ 안전한 HWPX 저장
│       │
│       ├── features/             # 기능 모듈
│       │   ├── cell-selector.js  # ⭐ 셀 선택 모드
│       │   ├── inline-editor.js  # 인라인 편집
│       │   ├── history-manager.js # 실행취소/다시실행
│       │   └── edit-mode-manager.js # 편집 모드 관리
│       │
│       ├── ui/                   # UI 모듈
│       │   ├── chat-panel.js     # ⭐ AI 채팅 패널
│       │   └── context-menu.js   # 컨텍스트 메뉴
│       │
│       ├── config/               # 설정
│       │   └── ai-config.js      # AI 설정 (API 키, 프롬프트 등)
│       │
│       └── utils/                # 유틸리티
│           ├── logger.js         # 로깅
│           ├── error.js          # 에러 처리
│           └── ui.js             # UI 유틸 (토스트 등)
│
├── styles/
│   └── vanilla/                  # Vanilla CSS
│       ├── viewer.css            # 뷰어 스타일
│       ├── ai-chat.css           # AI 패널 스타일
│       ├── cell-selector.css     # 셀 선택 모드 스타일
│       └── external-api.css      # 외부 API 모달 스타일
│
├── stores/                       # Zustand 스토어
│   └── documentStore.ts          # 문서 상태 관리
│
├── App.tsx                       # 앱 진입점
└── main.tsx                      # React 마운트
```

---

## 핵심 아키텍처

### 1. Vanilla JS Wrapper 패턴

```
┌─────────────────────────────────────────────────────┐
│                    React Layer                       │
│  ┌─────────────────────────────────────────────┐   │
│  │           HWPXViewerWrapper.tsx              │   │
│  │  - useEffect로 Vanilla 뷰어 초기화           │   │
│  │  - DOM 요소 제공 (container, AI panel 등)   │   │
│  └─────────────────────────────────────────────┘   │
│                         │                           │
│                         ▼                           │
│  ┌─────────────────────────────────────────────┐   │
│  │              Vanilla JS Layer                │   │
│  │  ┌─────────────────────────────────────┐    │   │
│  │  │           HWPXViewer                 │    │   │
│  │  │  - parser (HWPX → JSON)             │    │   │
│  │  │  - renderer (JSON → HTML)           │    │   │
│  │  │  - aiController (AI 기능)           │    │   │
│  │  │  - inlineEditor (편집 기능)         │    │   │
│  │  └─────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 2. HWPX 파일 구조

```
document.hwpx (ZIP)
├── mimetype
├── META-INF/
│   └── container.xml
├── Contents/
│   ├── header.xml      # 문서 헤더 (스타일, 폰트 정의)
│   ├── section0.xml    # 본문 내용 (단락, 테이블, 이미지)
│   └── section1.xml    # (다중 섹션 시)
├── BinData/
│   ├── image1.png      # 이미지 파일들
│   └── image2.jpg
└── settings.xml
```

### 3. 데이터 모델

```typescript
// 파싱된 문서 구조
interface HWPXDocument {
  sections: Section[];
  images: Map<string, ImageInfo>;
  rawHeaderXml: string; // 원본 header.xml 보존
  metadata: {
    parsedAt: string;
    sectionsCount: number;
    imagesCount: number;
  };
}

interface Section {
  elements: (Paragraph | Table | Image | Shape)[];
}

interface Table {
  type: 'table';
  rows: Row[];
  style: TableStyle;
}

interface Row {
  cells: Cell[];
}

interface Cell {
  elements: Paragraph[];
  style: CellStyle;
  colspan?: number;
  rowspan?: number;
}

interface Paragraph {
  type: 'paragraph';
  runs: Run[];
  style: ParagraphStyle;
}

interface Run {
  text: string;
  style: RunStyle;
}
```

---

## 주요 모듈 상세

### 1. HWPXViewer (`viewer.js`)

**역할**: 전체 뷰어 기능을 통합하는 메인 클래스

```javascript
// 초기화
const viewer = new HWPXViewer({
  container: document.getElementById('viewer'),
  enableAI: true,
  useWorker: false,
});

// 파일 로드
await viewer.loadFile(file);

// 문서 가져오기
const document = viewer.getDocument();

// 저장
await viewer.saveFile('output.hwpx');
```

**주요 속성**:

- `parser`: SimpleHWPXParser 인스턴스
- `renderer`: DocumentRenderer 인스턴스
- `aiController`: AIDocumentController 인스턴스
- `inlineEditor`: InlineEditor 인스턴스
- `state.document`: 현재 파싱된 문서
- `state.currentFile`: 현재 로드된 파일

### 2. SimpleHWPXParser (`parser.js`)

**역할**: HWPX ZIP 파일을 JSON 구조로 파싱

```javascript
const parser = new SimpleHWPXParser();
const document = await parser.parse(fileBuffer);
```

**핵심 메서드**:

- `parse(buffer)`: 메인 파싱 함수
- `unzip(buffer)`: ZIP 해제 및 `this.zip` 저장
- `parseSection(xml)`: section\*.xml 파싱
- `parseTable(element)`: 테이블 파싱
- `parseParagraph(element)`: 단락 파싱
- `parseImage(element)`: 이미지 파싱

**주의사항**:

```javascript
// rawHeaderXml 추출 (HWPX 저장 시 필요)
const headerEntry = this.zip.file('Contents/header.xml');
this.rawHeaderXml = await headerEntry.async('string');
```

### 3. HwpxSafeExporter (`hwpx-safe-exporter.js`)

**역할**: 원본 HWPX를 기반으로 수정된 내용만 교체하여 저장

```javascript
const exporter = new HwpxSafeExporter();
await exporter.exportModifiedHwpx(
  originalFile,
  modifiedDocument,
  'output.hwpx'
);
```

**핵심 로직**:

1. 원본 HWPX ZIP 로드
2. header.xml 수정 (lineWrap, wordWrap 속성)
3. section\*.xml 수정:
   - `linesegarray` 제거 (자동 줄바꿈 위해)
   - 텍스트 내용 교체
   - `ctrl` 요소(이미지) 보존
4. 새 ZIP 생성 및 다운로드

**중요 함수**:

```javascript
// 자동 줄바꿈 속성 추가 및 linesegarray 제거
_addLineWrapAttributes(sectionXml) {
    // DOM 파싱
    const parser = new DOMParser();
    const doc = parser.parseFromString(sectionXml, 'text/xml');

    // subList에 lineWrap="BREAK" 추가
    // paragraph에 autoLineBreak="1" 추가
    // linesegarray 제거 (핵심!)

    return new XMLSerializer().serializeToString(doc);
}
```

### 4. AIDocumentController (`ai-controller.js`)

**역할**: AI 관련 모든 기능을 통합 관리

```javascript
const controller = new AIDocumentController(viewer);
controller.setApiKey('sk-...');

// GPT로 내용 생성
await controller.handleUserRequest('쉽게 바꿔줘');

// 셀 선택 데이터로 생성
await controller.handleUserRequestWithCellSelection(message, cellData);

// 외부 API 데이터로 채우기
await controller.fillFromExternalAPI('https://api.example.com/data', {
  mapping: { '학생 이름': 'student.name' },
});

// HWPX 저장
await controller.saveAsHwpx('output.hwpx');
```

**구성 모듈**:

- `extractor`: 문서 구조 추출
- `generator`: GPT 내용 생성
- `merger`: 내용 병합
- `exporter`: HWPX 내보내기
- `dataFetcher`: 외부 API 데이터 가져오기

### 5. CellSelector (`cell-selector.js`)

**역할**: 템플릿 추출 시 셀 단위 모드 설정

```javascript
const selector = new CellSelector(viewer);

// 활성화
selector.activate();

// 셀 모드 설정
selector.setCellMode('t0-r1-c2', 'keep'); // 유지
selector.setCellMode('t0-r1-c3', 'generate'); // 생성

// 모든 셀 한번에
selector.setAllCellsMode('generate');

// 자동 헤더 감지
selector.autoDetectHeaders();

// AI 요청 데이터 생성
const data = selector.buildAIRequestData();
```

**모드 종류**:

- `auto`: 자동 감지 (기본)
- `keep`: 유지 (원본 그대로)
- `edit`: 수정 (기존 내용 기반)
- `generate`: 생성 (새로 생성)

### 6. ExternalDataFetcher (`external-data-fetcher.js`)

**역할**: 외부 API에서 JSON 데이터를 가져와 문서에 채우기

```javascript
const fetcher = new ExternalDataFetcher();

// API 호출
const data = await fetcher.fetchData('https://api.example.com/data', {
  method: 'GET',
  headers: { Authorization: 'Bearer xxx' },
});

// 필드 매핑 변환
const mapped = fetcher.transformToTemplateFormat(data, {
  '학생 이름': 'student.name',
  점수: 'scores.total',
});

// 자동 키 추출
const flat = fetcher.autoExtractKeys(data);

// 샘플 데이터
const sample = ExternalDataFetcher.getSampleData();
```

### 7. ChatPanel (`chat-panel.js`)

**역할**: AI 채팅 UI 및 사용자 상호작용

```javascript
const panel = new ChatPanel(aiController);
panel.init();

// 메시지 추가
panel.addUserMessage('내용 수정해줘');
panel.addAssistantMessage('완료!');
panel.addSystemMessage('시스템 알림');

// 모달 표시
panel.showExternalApiModal();
```

**UI 요소**:

- AI 채팅 입력/출력
- 문서 구조 보기
- 스타일 적용
- 템플릿 추출
- 셀 선택
- 외부 API
- HWPX 저장

---

## 데이터 흐름

### 1. 문서 로드 흐름

```
사용자가 파일 선택
        │
        ▼
┌─────────────────┐
│ HWPXViewer      │
│ loadFile()      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SimpleHWPXParser│
│ parse()         │
│ - unzip()       │
│ - parseSection()│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DocumentRenderer│
│ render()        │
└────────┬────────┘
         │
         ▼
    HTML 렌더링
```

### 2. AI 편집 흐름

```
사용자 요청 입력
        │
        ▼
┌─────────────────┐
│ ChatPanel       │
│ handleSend()    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AIController    │
│ handleRequest() │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
추출기     GPT API
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│ ContentMerger   │
│ merge()         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Renderer        │
│ updateDocument()│
└────────┬────────┘
         │
         ▼
    화면 갱신
```

### 3. HWPX 저장 흐름

```
저장 버튼 클릭
        │
        ▼
┌─────────────────┐
│ _syncFromDOM()  │  ← DOM 변경 → document 동기화
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ HwpxSafeExporter│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
원본 ZIP   수정된 document
  로드         │
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│ section*.xml    │
│ 수정            │
│ - 텍스트 교체   │
│ - lineseg 제거  │
│ - lineWrap 추가 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 새 ZIP 생성     │
│ 다운로드        │
└─────────────────┘
```

---

## 개발 환경 설정

### 1. 설치

```bash
# 저장소 클론
git clone <repository-url>
cd hanview-react-app

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### 2. 환경 변수

```env
# .env (선택)
VITE_OPENAI_API_KEY=sk-...
VITE_DEFAULT_API_URL=https://api.example.com
```

### 3. 포트 설정

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5090,
  },
});
```

### 4. 빌드

```bash
# 프로덕션 빌드
npm run build

# 미리보기
npm run preview
```

---

## 확장 가이드

### 1. 새로운 AI 기능 추가

```javascript
// ai-controller.js에 메서드 추가
async myNewAIFeature(params) {
    // 1. 문서 데이터 추출
    const document = this.viewer.getDocument();

    // 2. GPT 호출 또는 처리
    const result = await this.generator.generate(prompt);

    // 3. 문서 업데이트
    const updated = this.merger.merge(document, result);

    // 4. 렌더링
    await this.viewer.updateDocument(updated);

    return { success: true };
}

// chat-panel.js에 버튼 핸들러 추가
handleMyNewFeature() {
    this.aiController.myNewAIFeature(params);
}
```

### 2. 새로운 문서 요소 파서 추가

```javascript
// parser.js
parseNewElement(element) {
    return {
        type: 'newElement',
        // 속성 추출
        property: element.getAttribute('property'),
        children: this.parseChildren(element)
    };
}

// parseSection에서 호출
if (tagName === 'newElement') {
    elements.push(this.parseNewElement(child));
}
```

### 3. 새로운 렌더러 추가

```javascript
// renderer.js
renderNewElement(element, container) {
    const div = document.createElement('div');
    div.className = 'new-element';
    div.innerHTML = element.content;
    container.appendChild(div);
}

// render에서 호출
case 'newElement':
    this.renderNewElement(element, container);
    break;
```

### 4. 외부 API 커스텀 변환

```javascript
// external-data-fetcher.js
customTransform(data) {
    // 특수 데이터 형식 처리
    return {
        field1: data.nested.deeply.value,
        field2: data.array.map(x => x.name).join(', ')
    };
}
```

---

## 트러블슈팅

### 1. HWPX 파일 손상

**증상**: 저장된 파일이 한글에서 열리지 않음

**해결**:

```javascript
// 1. header.xml 원본 보존 확인
console.log(document.rawHeaderXml);

// 2. linesegarray 제거 확인
// section XML에서 <hp:linesegarray> 검색

// 3. 이미지 경로 확인
// BinData/ 폴더 내 파일명 대소문자
```

### 2. 자동 줄바꿈 안됨

**증상**: 긴 텍스트가 셀 밖으로 넘침

**해결**:

```javascript
// hwpx-safe-exporter.js _addLineWrapAttributes 확인
// 1. subList에 lineWrap="BREAK"
// 2. paragraph에 autoLineBreak="1"
// 3. linesegarray 제거 필수!
```

### 3. 이미지 누락

**증상**: 저장 후 이미지가 보이지 않음

**해결**:

```javascript
// _replaceByElementTypeMatching에서 ctrl 요소 보존 확인
const preservedCtrlNodes = Array.from(xmlP.children).filter(
  child => child.tagName === 'hp:ctrl' || child.localName === 'ctrl'
);
```

### 4. DOM 동기화 문제

**증상**: 편집 내용이 저장에 반영 안됨

**해결**:

```javascript
// viewer.js _syncDocumentFromDOM 확인
// 1. inlineEditor.finishEditing() 호출
// 2. _cellData, _paraData 체크
console.log(cell._cellData);
```

---

## 최적화 포인트

### 1. 파싱 성능

```javascript
// 현재: 전체 DOM 순회
// 개선: Web Worker 사용 (useWorker: true)
// 주의: Vite에서 Worker 경로 설정 필요
```

### 2. 렌더링 성능

```javascript
// 현재: 전체 재렌더링
// 개선: 변경된 요소만 부분 업데이트
// Virtual DOM 또는 diff 알고리즘 적용
```

### 3. 메모리 관리

```javascript
// 이미지 Blob URL 정리
images.forEach(url => URL.revokeObjectURL(url));

// 큰 문서 언로드
viewer.unload();
```

### 4. API 호출 최적화

```javascript
// 배치 처리
await Promise.all(pages.map(page => processPage(page)));

// 캐싱
const cached = fetcher.getCached(url);
if (cached) return cached;
```

### 5. 번들 사이즈

```javascript
// 동적 import
const JSZip = await import('jszip');

// Tree shaking 확인
import { specific } from 'large-library';
```

---

## 디버깅 도구

### 콘솔 명령어

```javascript
// 현재 문서 확인
window.viewer.getDocument();

// 셀 데이터 확인
document.querySelector('.table-cell')._cellData;

// AI 컨트롤러 상태
window.viewer.aiController.state;

// 로깅 레벨 변경
window.setLogLevel('debug');
```

### HWPX 분석 코드

```javascript
// 저장된 HWPX 분석
const input = document.createElement('input');
input.type = 'file';
input.accept = '.hwpx';
input.onchange = async e => {
  const file = e.target.files[0];
  const zip = await JSZip.loadAsync(file);

  // header.xml 확인
  const header = await zip.file('Contents/header.xml').async('string');
  console.log(header);

  // section0.xml 확인
  const section = await zip.file('Contents/section0.xml').async('string');
  console.log(section);
};
input.click();
```

---

## 참고 자료

- [HWPX 파일 형식 명세](https://www.hancom.com)
- [OpenAI API 문서](https://platform.openai.com/docs)
- [JSZip 문서](https://stuk.github.io/jszip/)
- [React 19 문서](https://react.dev)
- [Vite 문서](https://vitejs.dev)

---

## 버전 히스토리

| 버전  | 날짜    | 변경 내용          |
| ----- | ------- | ------------------ |
| 1.0.0 | 2025-01 | 초기 버전          |
| 1.1.0 | 2025-01 | AI 편집 기능 추가  |
| 1.2.0 | 2025-01 | HWPX 저장 안정화   |
| 1.3.0 | 2025-01 | 셀 선택 모드 추가  |
| 1.4.0 | 2025-01 | 외부 API 연동 추가 |

---

## 문의

프로젝트 관련 문의사항은 이슈 트래커를 이용해주세요.
