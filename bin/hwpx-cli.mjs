#!/usr/bin/env node
/**
 * hwpx-cli — Headless HWPX 변환 CLI
 * -----------------------------------------------------------------------------
 * 사용법:
 *   hwpx-cli convert <input.hwpx> --to html  [--output out.html] [--inline] [--embed-images]
 *   hwpx-cli convert <input.hwpx> --to text  [--output out.txt]
 *   hwpx-cli convert <input.hwpx> --to json  [--output out.json]
 *   hwpx-cli info <input.hwpx>
 *   hwpx-cli --help
 *
 * 옵션:
 *   --to <format>      html | text | json (필수, convert 명령)
 *   --output, -o       출력 파일 경로 (생략 시 stdout)
 *   --password         암호화된 HWPX 비밀번호
 *   --inline           HTML 출력 시 CSS 를 inline 으로
 *   --embed-images     HTML 출력 시 이미지 base64 인라인
 *   --no-page-breaks   섹션 사이 page-break div 비활성화
 *   --pretty           JSON 출력 시 2-space pretty-print
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
  hwpx-cli info <input.hwpx>
  hwpx-cli --help

Options:
  --to <html|text|json>   Target format (required for convert)
  --output, -o <path>     Output file (default: stdout)
  --password <pw>         Password for encrypted HWPX
  --inline                Inline CSS into elements (html only)
  --embed-images          Inline images as base64 (html only)
  --no-page-breaks        Disable page-break divs between sections (html only)
  --pretty                Pretty-print JSON output
  --help, -h              Show this help
  --version, -v           Show version
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
  if (!args.to) throw new Error('--to <html|text|json> 옵션이 필요합니다.');
  if (!['html', 'text', 'json'].includes(args.to)) {
    throw new Error(`지원하지 않는 형식: ${args.to} (html|text|json)`);
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
