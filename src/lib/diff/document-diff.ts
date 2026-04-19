/**
 * Document Diff
 * 두 문서의 내용 차이를 비교하고 시각적으로 표시
 *
 * @module lib/diff/document-diff
 * @version 1.0.0
 */

export interface DiffChange {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  lineNumber: { old?: number; new?: number };
  oldText?: string;
  newText?: string;
}

export interface DiffResult {
  changes: DiffChange[];
  stats: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    similarity: number; // 0-100%
  };
}

/**
 * 문서 데이터에서 텍스트 라인 추출
 */
function extractLines(doc: any): string[] {
  const lines: string[] = [];
  if (!doc?.sections) return lines;

  for (const section of doc.sections) {
    for (const el of section.elements || []) {
      if (el.type === 'paragraph' && el.runs) {
        const text = el.runs.map((r: any) => r.text || '').join('');
        lines.push(text);
      } else if (el.type === 'table' && el.rows) {
        for (const row of el.rows) {
          const cellTexts = (row.cells || []).map((cell: any) => {
            return (cell.elements || [])
              .flatMap((e: any) => (e.runs || []).map((r: any) => r.text || ''))
              .join('');
          });
          lines.push(cellTexts.join('\t'));
        }
      } else if (el.type === 'image') {
        lines.push(`[이미지: ${el.alt || el.src || ''}]`);
      }
    }
  }
  return lines;
}

/**
 * LCS (Longest Common Subsequence) 기반 diff
 * 대규모 문서를 위해 최대 2000라인으로 제한 (O(m×n) 메모리)
 */
function computeLCS(a: string[], b: string[]): boolean[][] {
  const m = a.length;
  const n = b.length;

  // 메모리 보호 — 너무 큰 문서는 잘라서 비교
  const MAX = 2000;
  const aSlice = m > MAX ? a.slice(0, MAX) : a;
  const bSlice = n > MAX ? b.slice(0, MAX) : b;
  const ml = aSlice.length;
  const nl = bSlice.length;

  const dp: number[][] = Array.from({ length: ml + 1 }, () => Array(nl + 1).fill(0));

  for (let i = 1; i <= ml; i++) {
    for (let j = 1; j <= nl; j++) {
      if (aSlice[i - 1] === bSlice[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack — 배열 크기를 원본 길이(m, n)로 생성
  const inLCS: boolean[][] = [
    new Array(m).fill(false),
    new Array(n).fill(false),
  ];
  let i = ml, j = nl;
  while (i > 0 && j > 0) {
    if (aSlice[i - 1] === bSlice[j - 1]) {
      inLCS[0][i - 1] = true;
      inLCS[1][j - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return inLCS;
}

/**
 * 두 문서 비교
 */
export function diffDocuments(oldDoc: any, newDoc: any): DiffResult {
  const oldLines = extractLines(oldDoc);
  const newLines = extractLines(newDoc);

  const lcs = computeLCS(oldLines, newLines);
  const changes: DiffChange[] = [];

  let oi = 0, ni = 0;
  let oldNum = 0, newNum = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && lcs[0][oi]) {
      if (ni < newLines.length && lcs[1][ni]) {
        // 둘 다 LCS에 포함 — unchanged
        changes.push({
          type: 'unchanged',
          lineNumber: { old: ++oldNum, new: ++newNum },
          oldText: oldLines[oi],
          newText: newLines[ni],
        });
        oi++;
        ni++;
      } else if (ni < newLines.length) {
        // new에만 있는 라인 — added
        changes.push({
          type: 'added',
          lineNumber: { new: ++newNum },
          newText: newLines[ni],
        });
        ni++;
      }
    } else if (oi < oldLines.length) {
      // old에만 있는 라인 — removed
      changes.push({
        type: 'removed',
        lineNumber: { old: ++oldNum },
        oldText: oldLines[oi],
      });
      oi++;
    } else if (ni < newLines.length) {
      // new에만 있는 라인 — added
      changes.push({
        type: 'added',
        lineNumber: { new: ++newNum },
        newText: newLines[ni],
      });
      ni++;
    }
  }

  // 인접한 removed+added 를 modified로 병합
  const merged: DiffChange[] = [];
  for (let k = 0; k < changes.length; k++) {
    if (
      changes[k].type === 'removed' &&
      k + 1 < changes.length &&
      changes[k + 1].type === 'added'
    ) {
      // 유사도 체크 — 50% 이상이면 modified
      const sim = stringSimilarity(changes[k].oldText || '', changes[k + 1].newText || '');
      if (sim > 0.3) {
        merged.push({
          type: 'modified',
          lineNumber: { old: changes[k].lineNumber.old, new: changes[k + 1].lineNumber.new },
          oldText: changes[k].oldText,
          newText: changes[k + 1].newText,
        });
        k++; // skip next
        continue;
      }
    }
    merged.push(changes[k]);
  }

  const stats = {
    added: merged.filter(c => c.type === 'added').length,
    removed: merged.filter(c => c.type === 'removed').length,
    modified: merged.filter(c => c.type === 'modified').length,
    unchanged: merged.filter(c => c.type === 'unchanged').length,
    similarity: 0,
  };

  const total = stats.added + stats.removed + stats.modified + stats.unchanged;
  stats.similarity = total > 0 ? Math.round((stats.unchanged / total) * 100) : 100;

  return { changes: merged, stats };
}

/**
 * 두 문자열의 유사도 (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  const editDist = levenshtein(longer, shorter);
  return (longer.length - editDist) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // 메모리 최적화 — 2행만 사용
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Diff 결과를 HTML로 렌더링
 */
export function renderDiffHTML(result: DiffResult): string {
  const header = `
    <div style="font-family:-apple-system,sans-serif;padding:16px;background:#fafafa;border:1px solid #ddd;margin-bottom:12px;display:flex;gap:20px;font-size:13px;">
      <span><strong>유사도:</strong> ${result.stats.similarity}%</span>
      <span style="color:#22863a;">+ 추가: ${result.stats.added}</span>
      <span style="color:#cb2431;">- 삭제: ${result.stats.removed}</span>
      <span style="color:#e36209;">~ 수정: ${result.stats.modified}</span>
      <span style="color:#666;">= 동일: ${result.stats.unchanged}</span>
    </div>`;

  const lines = result.changes.map(c => {
    const ln = [
      c.lineNumber.old ? String(c.lineNumber.old).padStart(4) : '    ',
      c.lineNumber.new ? String(c.lineNumber.new).padStart(4) : '    ',
    ].join(' ');

    switch (c.type) {
      case 'added':
        return `<div style="background:#e6ffed;padding:2px 8px;font-family:monospace;font-size:12px;border-left:3px solid #22863a;"><span style="color:#999;">${ln}</span> <span style="color:#22863a;">+ ${escapeHtml(c.newText || '')}</span></div>`;
      case 'removed':
        return `<div style="background:#ffeef0;padding:2px 8px;font-family:monospace;font-size:12px;border-left:3px solid #cb2431;"><span style="color:#999;">${ln}</span> <span style="color:#cb2431;">- ${escapeHtml(c.oldText || '')}</span></div>`;
      case 'modified':
        return `<div style="background:#fff5e6;padding:2px 8px;font-family:monospace;font-size:12px;border-left:3px solid #e36209;"><span style="color:#999;">${ln}</span> <span style="color:#cb2431;text-decoration:line-through;">  ${escapeHtml(c.oldText || '')}</span><br/><span style="color:#999;">         </span> <span style="color:#22863a;">  ${escapeHtml(c.newText || '')}</span></div>`;
      default:
        return `<div style="padding:2px 8px;font-family:monospace;font-size:12px;color:#666;"><span style="color:#ccc;">${ln}</span>   ${escapeHtml(c.oldText || '')}</div>`;
    }
  }).join('');

  return header + `<div style="border:1px solid #ddd;overflow:auto;max-height:600px;">${lines}</div>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default { diffDocuments, renderDiffHTML, extractLines };

// ─────────────────────────────────────────────────────────────────────────
// Structural / Style-aware Diff (v2)
// 기존 라인 기반 diff 위에 블록 단위 + 서식 변경 탐지를 추가한 API.
// 계약서·규정 개정 워크플로우처럼 서식 변경이 의미있는 경우 사용.
// ─────────────────────────────────────────────────────────────────────────

import type {
  HWPXDocument,
  HWPXSection,
  HWPXParagraph,
  HWPXTable,
  HWPXTableCell,
  HWPXRun,
  HWPXTextStyle,
} from '../../types/hwpx';

export type StructuralDiffOp = 'equal' | 'insert' | 'delete' | 'modify';

export interface DiffBlock {
  id: string;
  kind: 'paragraph' | 'table-cell';
  text: string;
  path: { section: number; element: number; row?: number; cell?: number };
  style?: HWPXTextStyle;
  alignment?: string;
}

export interface TextTokenChange {
  op: 'insert' | 'delete' | 'equal';
  text: string;
}

export interface StyleChange {
  property: string;
  from: unknown;
  to: unknown;
}

export interface StructuralDiffEntry {
  op: StructuralDiffOp;
  left?: DiffBlock;
  right?: DiffBlock;
  textChanges?: TextTokenChange[];
  styleChanges?: StyleChange[];
}

export interface StructuralDiffResult {
  entries: StructuralDiffEntry[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    totalLeft: number;
    totalRight: number;
  };
}

export function flattenDocument(doc: HWPXDocument): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  doc.sections.forEach((section, sIdx) => flattenSection(section, sIdx, blocks));
  return blocks;
}

function flattenSection(section: HWPXSection, sIdx: number, out: DiffBlock[]) {
  section.elements.forEach((el, eIdx) => {
    if (el.type === 'paragraph') {
      out.push(paragraphToBlock(el as HWPXParagraph, sIdx, eIdx));
    } else if (el.type === 'table') {
      const table = el as HWPXTable;
      table.rows?.forEach((row, rIdx) => {
        row.cells?.forEach((cell, cIdx) => {
          out.push(cellToBlock(cell, sIdx, eIdx, rIdx, cIdx));
        });
      });
    }
  });
}

function paragraphToBlock(para: HWPXParagraph, sIdx: number, eIdx: number): DiffBlock {
  const text = (para.runs ?? []).map(r => r.text ?? '').join('');
  const firstRun = (para.runs ?? [])[0];
  return {
    id: `s${sIdx}/e${eIdx}`,
    kind: 'paragraph',
    text,
    path: { section: sIdx, element: eIdx },
    style: firstRun?.style,
    alignment: para.alignment,
  };
}

function cellToBlock(cell: HWPXTableCell, sIdx: number, eIdx: number, rIdx: number, cIdx: number): DiffBlock {
  const texts: string[] = [];
  let firstStyle: HWPXTextStyle | undefined;
  for (const elem of cell.elements ?? []) {
    if (elem.type === 'paragraph') {
      const para = elem as HWPXParagraph;
      const line = (para.runs ?? []).map((r: HWPXRun) => r.text ?? '').join('');
      if (line) texts.push(line);
      if (!firstStyle && para.runs?.[0]?.style) firstStyle = para.runs[0].style;
    }
  }
  return {
    id: `s${sIdx}/e${eIdx}/r${rIdx}/c${cIdx}`,
    kind: 'table-cell',
    text: texts.join('\n'),
    path: { section: sIdx, element: eIdx, row: rIdx, cell: cIdx },
    style: firstStyle,
  };
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function lcsMatrix(a: string[], b: string[]): number[][] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function tokenize(s: string): string[] {
  return s.split(/(\s+|[.,!?;:])/).filter(t => t.length > 0);
}

function pushTokenChange(out: TextTokenChange[], op: TextTokenChange['op'], text: string) {
  const last = out[out.length - 1];
  if (last && last.op === op) last.text += text;
  else out.push({ op, text });
}

export function diffText(a: string, b: string): TextTokenChange[] {
  if (a === b) return [{ op: 'equal', text: a }];

  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  const dp = lcsMatrix(aTokens, bTokens);

  const out: TextTokenChange[] = [];
  let i = aTokens.length, j = bTokens.length;

  while (i > 0 && j > 0) {
    if (aTokens[i - 1] === bTokens[j - 1]) {
      pushTokenChange(out, 'equal', aTokens[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      pushTokenChange(out, 'delete', aTokens[i - 1]);
      i--;
    } else {
      pushTokenChange(out, 'insert', bTokens[j - 1]);
      j--;
    }
  }
  while (i > 0) pushTokenChange(out, 'delete', aTokens[--i]);
  while (j > 0) pushTokenChange(out, 'insert', bTokens[--j]);

  return out.reverse();
}

function diffStyles(a?: HWPXTextStyle, b?: HWPXTextStyle): StyleChange[] {
  if (!a && !b) return [];
  const tracked: (keyof HWPXTextStyle)[] = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color',
    'backgroundColor', 'underline', 'strikethrough', 'bold', 'italic',
  ];
  const changes: StyleChange[] = [];
  for (const prop of tracked) {
    const av = a?.[prop];
    const bv = b?.[prop];
    if (av !== bv) changes.push({ property: prop as string, from: av, to: bv });
  }
  return changes;
}

function samePath(a: DiffBlock['path'], b: DiffBlock['path']): boolean {
  return a.section === b.section && a.element === b.element && a.row === b.row && a.cell === b.cell;
}

function compareMatched(l: DiffBlock, r: DiffBlock): StructuralDiffEntry {
  const styleChanges = diffStyles(l.style, r.style);
  if (l.alignment !== r.alignment) {
    styleChanges.push({ property: 'alignment', from: l.alignment, to: r.alignment });
  }
  return styleChanges.length === 0
    ? { op: 'equal', left: l, right: r }
    : { op: 'modify', left: l, right: r, styleChanges };
}

function mergeToModify(entries: StructuralDiffEntry[]): StructuralDiffEntry[] {
  const out: StructuralDiffEntry[] = [];
  const consumed = new Set<number>();

  for (let k = 0; k < entries.length; k++) {
    if (consumed.has(k)) continue;
    const cur = entries[k];

    if (cur.op === 'delete' || cur.op === 'insert') {
      // 뒤쪽으로 인접 pair 를 찾음 — 중간에 equal 은 건너뜀
      for (let m = k + 1; m < Math.min(entries.length, k + 4); m++) {
        if (consumed.has(m)) continue;
        const other = entries[m];
        const pair = matchDeleteInsert(cur, other);
        if (pair) {
          out.push(pair);
          consumed.add(k);
          consumed.add(m);
          break;
        }
        if (other.op === 'equal') continue;
        break;
      }
      if (consumed.has(k)) continue;
    }
    out.push(cur);
  }
  return out;
}

function matchDeleteInsert(a: StructuralDiffEntry, b: StructuralDiffEntry): StructuralDiffEntry | null {
  const del = a.op === 'delete' ? a : b.op === 'delete' ? b : null;
  const ins = a.op === 'insert' ? a : b.op === 'insert' ? b : null;
  if (!del || !ins || !del.left || !ins.right) return null;
  if (del.left.kind !== ins.right.kind) return null;
  if (!samePath(del.left.path, ins.right.path)) return null;

  return {
    op: 'modify',
    left: del.left,
    right: ins.right,
    textChanges: diffText(del.left.text, ins.right.text),
    styleChanges: diffStyles(del.left.style, ins.right.style),
  };
}

/**
 * 구조 인식 diff — 블록(단락·셀) 단위 매칭 + 서식/정렬 변경 탐지
 */
export function diffDocumentsStructural(left: HWPXDocument, right: HWPXDocument): StructuralDiffResult {
  const L = flattenDocument(left);
  const R = flattenDocument(right);

  const lKeys = L.map(b => normalize(b.text));
  const rKeys = R.map(b => normalize(b.text));
  const dp = lcsMatrix(lKeys, rKeys);

  const entries: StructuralDiffEntry[] = [];
  let i = L.length, j = R.length;

  while (i > 0 && j > 0) {
    if (lKeys[i - 1] === rKeys[j - 1]) {
      entries.unshift(compareMatched(L[i - 1], R[j - 1]));
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      entries.unshift({ op: 'delete', left: L[i - 1] });
      i--;
    } else {
      entries.unshift({ op: 'insert', right: R[j - 1] });
      j--;
    }
  }
  while (i > 0) entries.unshift({ op: 'delete', left: L[--i] });
  while (j > 0) entries.unshift({ op: 'insert', right: R[--j] });

  const merged = mergeToModify(entries);

  let added = 0, removed = 0, modified = 0, unchanged = 0;
  for (const e of merged) {
    if (e.op === 'insert') added++;
    else if (e.op === 'delete') removed++;
    else if (e.op === 'modify') modified++;
    else unchanged++;
  }

  return {
    entries: merged,
    summary: { added, removed, modified, unchanged, totalLeft: L.length, totalRight: R.length },
  };
}
