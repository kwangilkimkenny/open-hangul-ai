# server/ — Node 사이드 도우미

이 폴더는 브라우저가 아닌 서버(Node.js) 런타임에서 동작하는 도우미들을 모아둔다.

| 파일                | 설명                                                          |
| ------------------- | ------------------------------------------------------------- |
| `proxy.js`          | AI API 프록시 (CORS / 토큰 보호)                              |
| `vertex-proxy.js`   | Google Vertex AI 전용 프록시                                  |
| `hwpx-generator.py` | 픽스처 생성 스크립트 (테스트용)                               |
| `pdf-renderer.js`   | **HWPX → PDF (Puppeteer)** — 한글 폰트 임베드, 텍스트 검색 가능 |

---

## pdf-renderer.js

### 무엇을 해결하나

기존 클라이언트 사이드 PDF 변환(`html2canvas` → `jsPDF`)은 본문을 **래스터 이미지**로
변환한다. 결과 PDF 는

- 텍스트 검색 / 복사 불가 (글자가 픽셀)
- 폰트 종속성 시각적으로만 보존
- 파일 크기가 크다 (이미지 압축)

`pdf-renderer.js` 는 트랙 X 헤드리스 HTML exporter 의 결과물을 **Headless
Chromium** 에 로드한 뒤 `page.pdf()` 를 호출한다. Chromium 이 폰트를 자동으로
임베드하고 텍스트 레이어를 보존하므로:

- 본문 검색 / 복사 가능
- 한글 폰트 자동 임베드 (Google Fonts: Noto Sans KR / Noto Serif KR)
- 벡터 그래픽 + 텍스트 = 작은 파일 크기

### API

```js
import { renderHwpxToPdf } from 'open-hangul-ai/server/pdf-renderer.js';

const buf = await fs.readFile('input.hwpx');
const pdf = await renderHwpxToPdf(buf, {
  title: '문서 제목',
  format: 'A4',
  landscape: false,
  margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
  printBackground: true,
  password: undefined, // 암호화 HWPX 비밀번호
  displayHeaderFooter: false,
  headerTemplate: '',
  footerTemplate: '',
  customFontHtml: '',  // 오프라인 환경에서 base64 임베드 폰트 추가용
  skipFontInjection: false,
});

await fs.writeFile('out.pdf', pdf);
```

### 흐름

```
HWPX buffer
  └─ parseHwpxHeadless()        ─ 트랙 X 헤드리스 파서 (Node 호환)
  └─ exportHtml(doc, {…})       ─ 트랙 X HTML5 직렬화 (인라인 이미지 옵션)
  └─ injectKoreanFonts(html)    ─ Noto Sans/Serif KR <link> 주입
  └─ puppeteer.launch()         ─ Headless Chromium
       └─ page.setContent(html, { waitUntil: 'networkidle0' })
       └─ document.fonts.ready
       └─ page.pdf({ format, margin, printBackground, … })
  └─ Uint8Array (PDF)
```

### CLI 사용법

```bash
# 기본 A4 세로 변환
node bin/hwpx-cli.mjs convert input.hwpx --to pdf --output out.pdf

# 가로 모드 + 커스텀 여백
node bin/hwpx-cli.mjs convert input.hwpx --to pdf -o out.pdf \
  --pdf-format A4 --pdf-landscape \
  --pdf-margin 10mm:10mm:10mm:10mm

# 한글 폰트 자동 주입 비활성 (시스템 폰트만 사용)
node bin/hwpx-cli.mjs convert input.hwpx --to pdf -o out.pdf --pdf-no-fonts

# 암호화된 HWPX
node bin/hwpx-cli.mjs convert encrypted.hwpx --to pdf -o out.pdf --password 비밀번호1234
```

### 환경 변수

| 변수                       | 의미                                                |
| -------------------------- | --------------------------------------------------- |
| `PUPPETEER_SKIP_DOWNLOAD=1` | npm install 시 Chromium 다운로드 생략 (CI 캐시)    |
| `PUPPETEER_EXECUTABLE_PATH` | 외부 Chrome 바이너리 경로 (alpine 컨테이너 등)     |
| `HWPX_CLI_DEBUG=1`         | CLI 에러 스택 출력                                  |

### 보안 주의

- `page.setContent()` 에 임의 HTML 을 주입할 경우 **XSS / SSRF** 위험. 본 모듈은
  exportHtml() 결과를 그대로 사용하므로 입력은 HWPX 바이트로 제한된다. 사용자
  HTML 을 직접 받아 `renderHtmlToPdf()` 를 호출할 때는 반드시 HTML 을 sanitize 한다.
- Headless Chromium 은 기본적으로 sandbox 비활성(`--no-sandbox`) 으로 실행된다.
  컨테이너 안이 아닌 호스트에서 운영할 때는 별도 user namespace 격리를 권장.
- Google Fonts CSS 를 가져오기 위해 외부 네트워크 호출이 발생한다. 망분리 환경은
  `skipFontInjection: true` + `customFontHtml` 으로 base64 폰트를 인라인하라.

### 알려진 한계

1. **Chromium 의존성** — 첫 설치 시 ~150MB 다운로드. `PUPPETEER_SKIP_DOWNLOAD=1` 로
   다운로드를 막은 환경에서는 `PUPPETEER_EXECUTABLE_PATH` 로 시스템 Chrome 을 지정.
2. **메모리 사용량** — 페이지 1개당 ~80MB. 큰 문서나 동시 요청이 많을 때는
   `options.browser` 로 브라우저 인스턴스를 풀링해 재사용한다.
3. **수식 / 차트** — 트랙 X HTML exporter 는 도형 / 수식을 자리표시자로 직렬화한다.
   복잡한 도형은 별도 트랙(DD/EE/FF) 의 SVG 출력이 들어오면 자동으로 보완된다.
4. **컨테이너** — Alpine 등 일부 베이스 이미지에는 Chromium 의존 라이브러리(`libxss`,
   `libnss3` 등) 가 없다. Debian 슬림 이상을 권장.
