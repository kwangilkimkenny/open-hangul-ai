#!/usr/bin/env node
/**
 * hwpx-cli — Headless HWPX 변환 CLI
 * -----------------------------------------------------------------------------
 * 사용법:
 *   hwpx-cli convert <input.hwpx> --to html  [--output out.html] [--inline] [--embed-images]
 *   hwpx-cli convert <input.hwpx> --to text  [--output out.txt]
 *   hwpx-cli convert <input.hwpx> --to json  [--output out.json]
 *   hwpx-cli convert <input.hwpx> --to pdf   --output out.pdf [--pdf-format A4] [--pdf-landscape]
 *   hwpx-cli info <input.hwpx>
 *   hwpx-cli --help
 *
 * 옵션:
 *   --to <format>      html | text | json | pdf (필수, convert 명령)
 *   --output, -o       출력 파일 경로 (생략 시 stdout, pdf 는 필수)
 *   --password         암호화된 HWPX 비밀번호
 *   --inline           HTML 출력 시 CSS 를 inline 으로
 *   --embed-images     HTML 출력 시 이미지 base64 인라인
 *   --no-page-breaks   섹션 사이 page-break div 비활성화
 *   --pretty           JSON 출력 시 2-space pretty-print
 *   --pdf-format       PDF 페이지 포맷 (A4, Letter, Legal …) 기본 A4
 *   --pdf-landscape    PDF 가로 모드
 *   --pdf-margin       PDF 여백 CSS 값 (top:right:bottom:left, 예: 20mm:15mm:20mm:15mm)
 *   --pdf-no-fonts     한글 Google Fonts 자동 주입 비활성
 *   --help, -h
 *   --version, -v
 *
 * 종료 코드:
 *   0 정상, 1 입력/인자 오류, 2 파싱/변환 실패
 *
 * @module bin/hwpx-cli
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// stdout 은 변환 결과 전용. 파서의 logger.info/.timeEnd 등은 stderr 로 라우팅한다.
// (HWPX_CLI_VERBOSE=1 환경에서는 원본 그대로 두어 디버깅을 허용)
if (!process.env.HWPX_CLI_VERBOSE) {
  const _origLog = console.log.bind(console);
  console.log = (...args) => process.stderr.write(args.map(String).join(' ') + '\n');
  console.info = (...args) => process.stderr.write(args.map(String).join(' ') + '\n');
  console.debug = (...args) => process.stderr.write(args.map(String).join(' ') + '\n');
  // time/timeEnd 는 stderr 로 가도록 console.* 를 그대로 두되 stdout 오염을 막는다.
  // (Node 의 console.time/.timeEnd 는 stdout 으로 쓰므로 명시적으로 무력화)
  console.time = () => {};
  console.timeEnd = () => {};
  // _origLog 는 의도적 stdout 출력이 필요한 곳에서만 사용 (현재 미사용 — 향후 확장용)
  void _origLog;
}

// 프로젝트 루트의 헤드리스 모듈을 로드한다.
// dev (소스 트리) / 설치 (npm bin) 양쪽 모두에서 동작하도록 두 경로를 시도.
async function loadHeadlessModule() {
  const candidates = [
    // dev: bin/ ⇢ src/lib/headless/
    resolve(__dirname, '../src/lib/headless/index.js'),
    // installed: bin/ ⇢ dist/headless/index.js
    resolve(__dirname, '../dist/headless/index.js'),
    // installed bundle entry
    resolve(__dirname, '../dist/open-hangul-ai.es.js'),
  ];
  for (const p of candidates) {
    try {
      return await import(p);
    } catch {
      // 다음 후보 시도
    }
  }
  throw new Error(
    'hwpx-cli: headless 모듈을 찾을 수 없습니다 (src/lib/headless 또는 dist 빌드 필요).'
  );
}

const HELP = `hwpx-cli — Headless HWPX converter

Usage:
  hwpx-cli convert <input.hwpx> --to html [--output out.html] [--inline] [--embed-images]
  hwpx-cli convert <input.hwpx> --to text [--output out.txt]
  hwpx-cli convert <input.hwpx> --to json [--output out.json] [--pretty]
  hwpx-cli convert <input.hwpx> --to pdf  --output out.pdf [--pdf-format A4] [--pdf-landscape]
  hwpx-cli info <input.hwpx>
  hwpx-cli --help

Options:
  --to <html|text|json|pdf>  Target format (required for convert)
  --output, -o <path>        Output file (default: stdout; required for pdf)
  --password <pw>            Password for encrypted HWPX
  --inline                   Inline CSS into elements (html only)
  --embed-images             Inline images as base64 (html/pdf)
  --no-page-breaks           Disable page-break divs between sections
  --pretty                   Pretty-print JSON output
  --pdf-format <fmt>         PDF page format (A4|Letter|Legal …, default A4)
  --pdf-landscape            PDF landscape orientation
  --pdf-margin <t:r:b:l>     PDF margins, CSS units (default 20mm:15mm:20mm:15mm)
  --pdf-no-fonts             Skip Google Fonts (Noto Sans/Serif KR) injection
  --help, -h                 Show this help
  --version, -v              Show version
`;

function parseArgs(argv) {
  const args = {
    command: null,
    input: null,
    to: null,
    output: null,
    password: null,
    inline: false,
    embedImages: false,
    pageBreaks: true,
    pretty: false,
    help: false,
    version: false,
    // PDF-only options
    pdfFormat: null,
    pdfLandscape: false,
    pdfMargin: null,
    pdfNoFonts: false,
  };

  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    switch (a) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--version':
      case '-v':
        args.version = true;
        break;
      case '--to':
        args.to = rest[++i];
        break;
      case '--output':
      case '-o':
        args.output = rest[++i];
        break;
      case '--password':
        args.password = rest[++i];
        break;
      case '--inline':
        args.inline = true;
        break;
      case '--embed-images':
        args.embedImages = true;
        break;
      case '--no-page-breaks':
        args.pageBreaks = false;
        break;
      case '--pretty':
        args.pretty = true;
        break;
      case '--pdf-format':
        args.pdfFormat = rest[++i];
        break;
      case '--pdf-landscape':
        args.pdfLandscape = true;
        break;
      case '--pdf-margin':
        args.pdfMargin = rest[++i];
        break;
      case '--pdf-no-fonts':
        args.pdfNoFonts = true;
        break;
      default:
        if (!args.command) args.command = a;
        else if (!args.input) args.input = a;
        else throw new Error(`알 수 없는 인자: ${a}`);
    }
  }
  return args;
}

async function getVersion() {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require(resolve(__dirname, '../package.json'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function writeOutput(content, path) {
  if (!path) {
    process.stdout.write(content);
    if (!content.endsWith('\n')) process.stdout.write('\n');
    return;
  }
  await writeFile(resolve(process.cwd(), path), content, 'utf8');
}

/**
 * 바이너리(Uint8Array/Buffer) 를 파일에 기록한다. stdout 출력은 지원하지 않는다.
 */
async function writeBinaryOutput(bytes, path) {
  if (!path) {
    throw new Error('바이너리 출력에는 --output FILE 이 필요합니다.');
  }
  await writeFile(resolve(process.cwd(), path), bytes);
}

/**
 * "20mm:15mm:20mm:15mm" 형식의 margin 인자를 파싱한다.
 */
function parsePdfMargin(spec) {
  if (!spec) return undefined;
  const parts = String(spec).split(':').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  }
  if (parts.length === 4) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }
  throw new Error(
    `--pdf-margin 형식이 잘못되었습니다: "${spec}" (예: "20mm" 또는 "20mm:15mm:20mm:15mm")`
  );
}

/**
 * Map / Set 을 직렬화 가능한 형태로 변환.
 * (JSON.stringify 는 기본적으로 Map 을 {} 로 직렬화하므로 변환 필요)
 */
function makeJsonSafe(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') {
    // 함수 등은 무시
    if (typeof value === 'function') return undefined;
    return value;
  }
  if (seen.has(value)) return null;
  seen.add(value);

  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value.entries()) {
      // 바이너리(Uint8Array) 는 길이만 출력 — JSON 폭증 방지
      if (v && typeof v === 'object' && (v instanceof Uint8Array || ArrayBuffer.isView(v))) {
        obj[k] = { __binary: true, byteLength: v.byteLength };
      } else if (
        v &&
        typeof v === 'object' &&
        v.data &&
        (v.data instanceof Uint8Array || ArrayBuffer.isView(v.data))
      ) {
        obj[k] = {
          ...makeJsonSafe({ ...v, data: undefined }, seen),
          data: { __binary: true, byteLength: v.data.byteLength },
        };
      } else {
        obj[k] = makeJsonSafe(v, seen);
      }
    }
    return obj;
  }
  if (value instanceof Set) {
    return Array.from(value).map(v => makeJsonSafe(v, seen));
  }
  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
    return { __binary: true, byteLength: value.byteLength };
  }
  if (Array.isArray(value)) {
    return value.map(v => makeJsonSafe(v, seen));
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const m = makeJsonSafe(v, seen);
    if (m !== undefined) out[k] = m;
  }
  return out;
}

async function runConvert(args, mod) {
  if (!args.input) throw new Error('입력 파일 경로가 필요합니다.');
  if (!args.to) throw new Error('--to <html|text|json|pdf> 옵션이 필요합니다.');
  if (!['html', 'text', 'json', 'pdf'].includes(args.to)) {
    throw new Error(`지원하지 않는 형식: ${args.to} (html|text|json|pdf)`);
  }

  // PDF 는 별도 경로 — puppeteer 가 필요하므로 동적 import
  if (args.to === 'pdf') {
    if (!args.output) {
      throw new Error('--to pdf 는 --output FILE.pdf 가 필요합니다.');
    }
    const buf = await readFile(resolve(process.cwd(), args.input));
    let renderer;
    try {
      // server/pdf-renderer.js 는 dev/installed 양쪽 위치에서 시도
      const candidates = [
        resolve(__dirname, '../server/pdf-renderer.js'),
        resolve(__dirname, '../dist/server/pdf-renderer.js'),
      ];
      let lastErr;
      for (const p of candidates) {
        try {
          renderer = await import(p);
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!renderer) throw lastErr || new Error('pdf-renderer 를 찾을 수 없습니다.');
    } catch (e) {
      throw new Error(
        'PDF 변환 모듈 로드 실패: ' +
          ((e && e.message) || e) +
          '\n(puppeteer 가 설치되어 있는지 확인하세요: `npm install --save-dev puppeteer`)'
      );
    }
    const pdfBytes = await renderer.renderHwpxToPdf(buf, {
      password: args.password || undefined,
      fileName: args.input,
      title: args.input,
      embedImages: args.embedImages || true,
      pageBreaks: args.pageBreaks,
      format: args.pdfFormat || 'A4',
      landscape: args.pdfLandscape,
      margin: parsePdfMargin(args.pdfMargin),
      skipFontInjection: args.pdfNoFonts,
    });
    await writeBinaryOutput(pdfBytes, args.output);
    return;
  }

  const buf = await readFile(resolve(process.cwd(), args.input));
  const doc = await mod.parseHwpxHeadless(buf, {
    password: args.password || undefined,
    fileName: args.input,
  });

  let out = '';
  if (args.to === 'text') {
    out = mod.extractPlainText(doc);
  } else if (args.to === 'html') {
    out = mod.exportHtml(doc, {
      inlineStyles: args.inline,
      embedImages: args.embedImages,
      pageBreaks: args.pageBreaks,
      title: args.input,
    });
  } else if (args.to === 'json') {
    const safe = makeJsonSafe(doc);
    out = args.pretty ? JSON.stringify(safe, null, 2) : JSON.stringify(safe);
  }

  await writeOutput(out, args.output);
}

async function runInfo(args, mod) {
  if (!args.input) throw new Error('입력 파일 경로가 필요합니다.');
  const buf = await readFile(resolve(process.cwd(), args.input));
  const doc = await mod.parseHwpxHeadless(buf, {
    password: args.password || undefined,
    fileName: args.input,
  });
  const summary = mod.summarizeDocument(doc);
  await writeOutput(JSON.stringify(summary, null, 2), args.output);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    process.stderr.write(`hwpx-cli: ${e.message}\n\n${HELP}`);
    process.exit(1);
  }

  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  if (args.version) {
    process.stdout.write((await getVersion()) + '\n');
    process.exit(0);
  }
  if (!args.command) {
    process.stderr.write(HELP);
    process.exit(1);
  }

  let mod;
  try {
    mod = await loadHeadlessModule();
  } catch (e) {
    process.stderr.write(`hwpx-cli: ${e.message}\n`);
    process.exit(2);
  }

  try {
    if (args.command === 'convert') {
      await runConvert(args, mod);
    } else if (args.command === 'info') {
      await runInfo(args, mod);
    } else {
      process.stderr.write(`hwpx-cli: 알 수 없는 명령 "${args.command}"\n\n${HELP}`);
      process.exit(1);
    }
  } catch (e) {
    process.stderr.write(`hwpx-cli: ${e.message}\n`);
    if (process.env.HWPX_CLI_DEBUG) {
      process.stderr.write(e.stack + '\n');
    }
    process.exit(2);
  }
}

main();
