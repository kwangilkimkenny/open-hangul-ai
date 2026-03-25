# @hanview/hwpx-parser

HWP/HWPX 문서 파서 및 시리얼라이저 패키지.
HWPX(ZIP 기반 한글 문서) 파일을 JSON 문서 구조로 파싱하고, JSON을 다시 HWPX로 내보내는 라이브러리입니다.

## 기능 요약

| 기능 | 설명 |
|------|------|
| HWPX 파싱 | ZIP 압축 해제 -> XML 파싱 -> JSON 문서 구조 변환 |
| 스타일 파싱 | 폰트, 문단, 글자, 테두리, 배경, 번호매기기 등 |
| 이미지 처리 | BinData 내 이미지를 Blob URL로 변환 |
| 표 파싱 | 병합 셀, 테두리, 배경, 대각선 등 완전 지원 |
| 도형 파싱 | 사각형, 원, 텍스트박스, 컨테이너, 중첩 도형 |
| 머리말/꼬리말 | header/footer 파싱 |
| 번호매기기 | 한글, 한자, 로마자, 원문자 등 10+ 포맷 |
| JSON -> XML | 문서 JSON을 HWPX XML로 역변환 |
| HWPX 내보내기 | JSON 문서를 HWPX ZIP 파일로 패키징 |
| 안전 내보내기 | 원본 HWPX 기반으로 수정된 section만 교체 |
| Web Worker | 메인 스레드 블로킹 없는 백그라운드 파싱 |
| HWP -> HWPX | HWP(OLE) 파일을 HWPX로 변환 (hwp-converter/) |

## 디렉토리 구조

```
packages/hwpx-parser/
├── src/
│   ├── index.js                    # 패키지 진입점 (모든 export)
│   ├── core/
│   │   ├── parser.js               # SimpleHWPXParser (v3.0, 2395줄)
│   │   └── constants.js            # HWPU/px 단위 변환, 페이지 상수
│   ├── export/
│   │   ├── json-to-xml.js          # JSON -> HWPX XML 변환기
│   │   ├── hwpx-exporter.js        # 새 HWPX 파일 생성 + 다운로드
│   │   ├── hwpx-safe-exporter.js   # 원본 기반 안전한 HWPX 저장
│   │   └── header-based-replacer.js # 헤더 기반 섹션 텍스트 교체
│   ├── utils/
│   │   ├── logger.js               # 로그 레벨 관리, 성능 측정
│   │   ├── error.js                # HWPXError 커스텀 에러, ErrorHandler
│   │   ├── numbering.js            # 번호매기기 변환 (한글/한자/로마자 등)
│   │   └── format.js               # 파일 크기, 날짜, Base64 변환
│   └── worker/
│       └── parser.worker.js        # Web Worker 파싱 (진행률 보고)
├── types/
│   └── hwpx.d.ts                   # TypeScript 타입 정의 (383줄)
├── tests/
│   ├── parser.test.js              # 파서 단위 테스트 (14 tests)
│   ├── parser.shape.test.js        # 도형 파싱 통합 테스트 (6 tests, 파일 필요)
│   ├── json-to-xml.test.js         # XML 변환 테스트 (26 tests)
│   ├── hwpx-save.test.js           # 저장 기능 테스트 (12 tests)
│   └── fixtures/                   # 테스트 픽스처 (sample-document, table, xml 등)
├── hwp-converter/                  # HWP -> HWPX 변환기 (별도 모듈)
│   ├── hwplib-js/                  #   HWP OLE 파싱 라이브러리
│   └── hwp2hwpx-js/                #   HWPX 생성 + 웹 데모
├── package.json
├── vitest.config.ts
└── README.md
```

## 사용법

### 1. HWPX 파일 파싱

```js
import { HWPXParser } from '@hanview/hwpx-parser';

const parser = new HWPXParser({
  parseImages: true,
  parseTables: true,
  parseStyles: true
});

// ArrayBuffer (File.arrayBuffer()로 얻은 것)를 전달
const document = await parser.parse(arrayBuffer);

console.log(document.sections);    // HWPXSection[]
console.log(document.images);      // Map<id, {url, path, mimeType, ...}>
console.log(document.metadata);    // {parsedAt, sectionsCount, imagesCount, ...}
```

### 2. Web Worker에서 파싱 (UI 블로킹 방지)

```js
const worker = new Worker(
  new URL('@hanview/hwpx-parser/worker', import.meta.url),
  { type: 'module' }
);

worker.postMessage({
  type: 'PARSE_HWPX',
  payload: { buffer: arrayBuffer },
  id: 'req-1'
});

worker.onmessage = (e) => {
  if (e.data.type === 'PROGRESS') {
    console.log(`${e.data.progress.percent}% - ${e.data.progress.message}`);
  }
  if (e.data.type === 'PARSE_COMPLETE') {
    console.log(e.data.result);
  }
};
```

### 3. JSON 문서를 HWPX로 내보내기

```js
import { HwpxExporter } from '@hanview/hwpx-parser';

const exporter = new HwpxExporter();
await exporter.exportToFile(document, 'output.hwpx');
```

### 4. 원본 HWPX 기반 안전한 저장

```js
import { HwpxSafeExporter } from '@hanview/hwpx-parser';

const safeExporter = new HwpxSafeExporter();
// 원본 파일의 구조는 보존하고, 수정된 텍스트만 교체
await safeExporter.exportModifiedHwpx(originalFile, modifiedDocument, 'edited.hwpx');
```

### 5. 단위 변환

```js
import { HWPXConstants } from '@hanview/hwpx-parser';

HWPXConstants.hwpuToPx(7200);      // HWPU -> 픽셀 (스케일 적용)
HWPXConstants.hwpuToPxUnscaled(7200); // HWPU -> 픽셀 (원본 크기)
HWPXConstants.ptToPx(10);          // 포인트 -> 픽셀
HWPXConstants.mmToPx(210);         // mm -> 픽셀 (794, A4 너비)
```

### 6. 번호매기기 변환

```js
import { toRoman, toHangulGanada, toCircledDecimal, getNumberingMarker } from '@hanview/hwpx-parser';

toRoman(4);                // 'IV'
toHangulGanada(3);         // '다'
toCircledDecimal(5);       // '⑤'
getNumberingMarker(1, 'DECIMAL', '.'); // '1.'
```

## 파싱 파이프라인

```
HWPX 파일 (ZIP)
  │
  ├── 1. unzip()           - JSZip으로 ZIP 압축 해제
  ├── 2. loadBinData()     - BinData/ 내 이미지를 Blob URL로 변환
  ├── 3. loadHeaderDefinitions()  - header.xml 단일 패스 파싱 (v3.0)
  │       ├── borderFills      (테두리/배경)
  │       ├── paraProperties   (문단 속성)
  │       ├── fontFaces        (폰트)
  │       ├── charProperties   (글자 속성)
  │       ├── numberings       (번호매기기)
  │       ├── bulletDefs       (글머리 기호)
  │       ├── tabDefs          (탭 정의)
  │       └── namedStyles      (이름있는 스타일)
  ├── 4. parseContent()    - section*.xml 파싱
  │       ├── paragraphs   (텍스트 + 스타일 + 인라인 요소)
  │       ├── tables       (셀 병합, 테두리, 배경)
  │       ├── images       (크기, 위치, treatAsChar)
  │       ├── shapes       (도형, 텍스트박스, 중첩)
  │       ├── headers/footers
  │       └── footnotes/endnotes
  └── 5. document 반환     - {sections, images, borderFills, metadata}
```

## 내보내기 파이프라인

```
JSON 문서
  │
  ├── HwpxExporter (새 파일 생성)
  │   ├── mimetype
  │   ├── version.xml
  │   ├── settings.xml
  │   ├── Contents/header.xml   (또는 rawHeaderXml 보존)
  │   ├── Contents/section*.xml
  │   ├── META-INF/container.xml, manifest.xml, container.rdf
  │   ├── Contents/content.hpf
  │   └── BinData/*             (이미지)
  │
  └── HwpxSafeExporter (원본 기반 수정)
      ├── 원본 HWPX ZIP 로드
      ├── header.xml 자동 줄바꿈 속성 수정
      ├── 수정된 section XML만 교체
      └── 새 ZIP 생성 + 다운로드
```

## 타입 정의 (핵심)

```typescript
interface HWPXDocument {
  sections: HWPXSection[];
  images: Map<string, HWPXImageInfo>;
  metadata?: HWPXMetadata;
  rawHeaderXml?: string;
}

interface HWPXSection {
  id: string;
  pageSettings?: HWPXPageSettings;
  elements: HWPXElement[];          // paragraph | table | image | shape | container
  headers?: HWPXHeaderFooter;
  footers?: HWPXHeaderFooter;
}

interface HWPXParagraph {
  type: 'paragraph';
  runs: HWPXRun[];                   // 텍스트 + 스타일
  alignment?: 'left' | 'center' | 'right' | 'justify';
  numbering?: HWPXNumbering;
}

interface HWPXTable {
  type: 'table';
  rows: HWPXTableRow[];
  colWidths?: string[];
}

interface HWPXRun {
  text: string;
  style?: HWPXTextStyle;             // fontFamily, fontSize, bold, italic, color, ...
  type?: 'text' | 'tab' | 'linebreak' | 'image' | 'table' | 'shape';
}
```

전체 타입 정의는 `types/hwpx.d.ts` (383줄)를 참조하세요.

## 의존성

| 패키지 | 용도 |
|--------|------|
| `jszip` (^3.10.1) | HWPX ZIP 압축/해제 |

## 테스트

```bash
cd packages/hwpx-parser
npx vitest run --config vitest.config.ts
```

테스트 결과 (2026-03-25):
- `parser.test.js`: 14/14 passed
- `json-to-xml.test.js`: 26/26 passed
- `hwpx-save.test.js`: 12/12 passed
- `parser.shape.test.js`: 6 tests (통합 테스트, 샘플 HWPX 파일 필요)

## HWP -> HWPX 변환기

`hwp-converter/` 디렉토리에는 HWP(OLE 기반) 파일을 HWPX로 변환하는 별도 모듈이 포함되어 있습니다.

- **hwplib-js/**: HWP 바이너리 파싱 라이브러리 (OLE, DocInfo, Table, Picture, Shape 등)
- **hwp2hwpx-js/**: HWPX XML 생성 + 웹 데모

자세한 내용은 `hwp-converter/README.md`를 참조하세요.

## 버전 히스토리

| 버전 | 주요 변경사항 |
|------|-------------|
| 3.0.0 | Single-pass header.xml 파싱 (5x 성능 향상), 번호매기기/글머리 기호 시스템, 머리말/꼬리말, 각주/미주, 하이퍼링크, 필드코드, 이름있는 스타일 |
| 2.0.0 | 표 고도화 (셀 병합, 배경, 테두리), 도형 파싱, 인라인 이미지 |
| 1.0.0 | 기본 HWPX 파싱 (텍스트, 표, 이미지) |

## 라이선스

MIT
