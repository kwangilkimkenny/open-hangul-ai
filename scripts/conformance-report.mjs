#!/usr/bin/env node
/**
 * Conformance Report Generator
 * ----------------------------
 * tests/conformance.yaml 을 읽어 parser/renderer/roundtrip 진척도를 표시한다.
 *
 * 사용법:
 *   node scripts/conformance-report.mjs            # 컬러 콘솔 표
 *   node scripts/conformance-report.mjs --json     # JSON 출력
 *   node scripts/conformance-report.mjs --md       # docs/CONFORMANCE_REPORT.md 생성
 *
 * 점수 환산:
 *   supported = 1.0, partial = 0.5, missing = 0.0
 *   전체 % = (sum / count) * 100
 *
 * 외부 의존성 없음 (의도적). 단순 YAML subset 만 해석한다.
 *   - 최상위 scalar 키:    key: value
 *   - 리스트 시작:          items:\n  - key: value
 *   - 리스트 내 스칼라 필드: 두 칸 들여쓰기 + "- " 시작
 *   - 인용 문자열:          "..." 또는 '...'
 *   - 주석:                # ...
 * 더 복잡한 YAML을 다뤄야 하면 js-yaml 도입을 고려한다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const YAML_PATH = join(ROOT, 'tests', 'conformance.yaml');
const MD_OUT = join(ROOT, 'docs', 'CONFORMANCE_REPORT.md');

// ----------------------------------------------------------
// Minimal YAML parser for our subset
// ----------------------------------------------------------
function stripComment(line) {
  // # only counts as comment if outside quotes
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '#' && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

function unquote(v) {
  if (v == null) return v;
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function coerce(v) {
  if (v == null) return v;
  const t = String(v).trim();
  if (t === '' || t === '~' || t === 'null') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
  return unquote(t);
}

function parseYaml(src) {
  const out = {};
  const lines = src.split(/\r?\n/);
  let i = 0;
  // First pass: extract simple `key: value` and detect the items list block.
  while (i < lines.length) {
    const raw = stripComment(lines[i]);
    if (!raw.trim()) {
      i++;
      continue;
    }
    // Top-level "key: value" (no indentation)
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw);
    if (m && !raw.startsWith(' ')) {
      const key = m[1];
      const val = m[2];
      if (key === 'items' && val.trim() === '') {
        // Parse list block until non-indented line
        const list = [];
        i++;
        let current = null;
        while (i < lines.length) {
          const line = stripComment(lines[i]);
          if (line.trim() === '') {
            i++;
            continue;
          }
          // List item starts with "  - "
          const itemHead = /^\s{2}-\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
          const itemField = /^\s{4}([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
          if (itemHead) {
            if (current) list.push(current);
            current = {};
            current[itemHead[1]] = coerce(itemHead[2]);
          } else if (itemField && current) {
            current[itemField[1]] = coerce(itemField[2]);
          } else if (/^\S/.test(line)) {
            // Non-indented — list ended
            break;
          } else {
            // Unknown indentation in list — ignore silently
          }
          i++;
        }
        if (current) list.push(current);
        out.items = list;
        continue;
      }
      out[key] = coerce(val);
    }
    i++;
  }
  return out;
}

// ----------------------------------------------------------
// Scoring
// ----------------------------------------------------------
const SCORE = { supported: 1.0, partial: 0.5, missing: 0.0 };

function scoreFor(value) {
  if (value == null) return 0;
  return SCORE[String(value).toLowerCase()] ?? 0;
}

function aggregate(items) {
  const dims = ['parser', 'renderer', 'roundtrip'];
  const total = { parser: 0, renderer: 0, roundtrip: 0 };
  const max = items.length;
  for (const it of items) {
    for (const d of dims) total[d] += scoreFor(it[d]);
  }
  return {
    counts: { total: max },
    parser: { score: total.parser, max, pct: max ? (total.parser / max) * 100 : 0 },
    renderer: { score: total.renderer, max, pct: max ? (total.renderer / max) * 100 : 0 },
    roundtrip: { score: total.roundtrip, max, pct: max ? (total.roundtrip / max) * 100 : 0 },
    overall: {
      score: total.parser + total.renderer + total.roundtrip,
      max: max * 3,
      pct: max ? ((total.parser + total.renderer + total.roundtrip) / (max * 3)) * 100 : 0,
    },
  };
}

function byCategory(items) {
  const map = new Map();
  for (const it of items) {
    const k = it.category ?? 'Uncategorized';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

// ----------------------------------------------------------
// Renderers
// ----------------------------------------------------------
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorStatus(s) {
  switch (String(s ?? '').toLowerCase()) {
    case 'supported':
      return `${C.green}✓ supported${C.reset}`;
    case 'partial':
      return `${C.yellow}~ partial  ${C.reset}`;
    case 'missing':
      return `${C.red}✗ missing  ${C.reset}`;
    default:
      return `${C.gray}? unknown  ${C.reset}`;
  }
}

function plainStatus(s) {
  switch (String(s ?? '').toLowerCase()) {
    case 'supported':
      return 'supported';
    case 'partial':
      return 'partial';
    case 'missing':
      return 'missing';
    default:
      return 'unknown';
  }
}

function pad(s, n) {
  s = String(s);
  if (s.length >= n) return s.slice(0, n);
  return s + ' '.repeat(n - s.length);
}

function printConsole(doc) {
  const items = doc.items ?? [];
  const agg = aggregate(items);

  console.log('');
  console.log(`${C.bold}${C.cyan}HWPX Conformance Report${C.reset}`);
  console.log(`${C.gray}spec: ${doc.spec ?? '-'} · generated: ${doc.generated_at ?? '-'}${C.reset}`);
  console.log('');

  const cats = byCategory(items);
  for (const [cat, list] of cats) {
    console.log(`${C.bold}${C.magenta}■ ${cat}${C.reset}  ${C.dim}(${list.length})${C.reset}`);
    for (const it of list) {
      const line =
        `  ${pad(it.feature, 50)} ` +
        `${colorStatus(it.parser)}  ` +
        `${colorStatus(it.renderer)}  ` +
        `${colorStatus(it.roundtrip)}  ` +
        `${C.dim}${it.priority ?? ''}${C.reset}`;
      console.log(line);
    }
    console.log('');
  }

  const bar = (pct) => {
    const w = 30;
    const filled = Math.round((pct / 100) * w);
    return '█'.repeat(filled) + '░'.repeat(w - filled);
  };

  console.log(`${C.bold}Summary${C.reset}`);
  console.log(`  features:   ${agg.counts.total}`);
  console.log(
    `  parser:     ${bar(agg.parser.pct)} ${agg.parser.pct.toFixed(1)}%  (${agg.parser.score.toFixed(1)}/${agg.parser.max})`,
  );
  console.log(
    `  renderer:   ${bar(agg.renderer.pct)} ${agg.renderer.pct.toFixed(1)}%  (${agg.renderer.score.toFixed(1)}/${agg.renderer.max})`,
  );
  console.log(
    `  roundtrip:  ${bar(agg.roundtrip.pct)} ${agg.roundtrip.pct.toFixed(1)}%  (${agg.roundtrip.score.toFixed(1)}/${agg.roundtrip.max})`,
  );
  console.log(
    `  ${C.bold}overall:    ${bar(agg.overall.pct)} ${agg.overall.pct.toFixed(1)}%  (${agg.overall.score.toFixed(1)}/${agg.overall.max})${C.reset}`,
  );
  console.log('');
  return agg;
}

function emitJson(doc) {
  const items = doc.items ?? [];
  const agg = aggregate(items);
  const payload = {
    version: doc.version ?? 1,
    spec: doc.spec ?? null,
    generated_at: doc.generated_at ?? null,
    summary: agg,
    items,
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  return agg;
}

function emitMarkdown(doc) {
  const items = doc.items ?? [];
  const agg = aggregate(items);
  const cats = byCategory(items);

  const fmt = (n) => `${n.toFixed(1)}%`;
  const statusBadge = (s) => {
    const v = plainStatus(s);
    const emoji = v === 'supported' ? '🟢' : v === 'partial' ? '🟡' : v === 'missing' ? '🔴' : '⚪';
    return `${emoji} ${v}`;
  };

  let md = '';
  md += `# HWPX Conformance Report\n\n`;
  md += `> spec: \`${doc.spec ?? '-'}\` · generated: \`${doc.generated_at ?? '-'}\`\n\n`;
  md += `## Summary\n\n`;
  md += `| Dimension | Score | Max | Percent |\n`;
  md += `| --- | ---: | ---: | ---: |\n`;
  md += `| parser | ${agg.parser.score.toFixed(1)} | ${agg.parser.max} | ${fmt(agg.parser.pct)} |\n`;
  md += `| renderer | ${agg.renderer.score.toFixed(1)} | ${agg.renderer.max} | ${fmt(agg.renderer.pct)} |\n`;
  md += `| roundtrip | ${agg.roundtrip.score.toFixed(1)} | ${agg.roundtrip.max} | ${fmt(agg.roundtrip.pct)} |\n`;
  md += `| **overall** | **${agg.overall.score.toFixed(1)}** | **${agg.overall.max}** | **${fmt(agg.overall.pct)}** |\n\n`;

  for (const [cat, list] of cats) {
    md += `## ${cat}\n\n`;
    md += `| Feature | Parser | Renderer | Round-trip | Priority | Golden |\n`;
    md += `| --- | --- | --- | --- | :---: | --- |\n`;
    for (const it of list) {
      md += `| ${it.feature} | ${statusBadge(it.parser)} | ${statusBadge(it.renderer)} | ${statusBadge(it.roundtrip)} | ${it.priority ?? '-'} | ${it.golden ? '`' + it.golden + '`' : '-'} |\n`;
    }
    md += '\n';
  }

  md += `---\n_Generated by \`scripts/conformance-report.mjs\`._\n`;

  // Ensure docs dir exists, write file
  if (!existsSync(dirname(MD_OUT))) {
    mkdirSync(dirname(MD_OUT), { recursive: true });
  }
  writeFileSync(MD_OUT, md, 'utf8');
  console.log(`Wrote ${MD_OUT}`);
  return agg;
}

// ----------------------------------------------------------
// Main
// ----------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const wantJson = args.includes('--json');
  const wantMd = args.includes('--md');
  const wantHelp = args.includes('--help') || args.includes('-h');

  if (wantHelp) {
    console.log(`Usage:
  node scripts/conformance-report.mjs            컬러 콘솔 표
  node scripts/conformance-report.mjs --json     JSON 출력
  node scripts/conformance-report.mjs --md       docs/CONFORMANCE_REPORT.md 생성

Source: ${YAML_PATH}
`);
    return;
  }

  let src;
  try {
    src = readFileSync(YAML_PATH, 'utf8');
  } catch (err) {
    console.error(`[conformance-report] cannot read ${YAML_PATH}: ${err.message}`);
    process.exit(2);
  }

  let doc;
  try {
    doc = parseYaml(src);
  } catch (err) {
    console.error(`[conformance-report] YAML parse failed: ${err.message}`);
    process.exit(3);
  }

  if (!Array.isArray(doc.items) || doc.items.length === 0) {
    console.error('[conformance-report] no items found in YAML');
    process.exit(4);
  }

  if (wantJson) emitJson(doc);
  else if (wantMd) emitMarkdown(doc);
  else printConsole(doc);
}

main();
