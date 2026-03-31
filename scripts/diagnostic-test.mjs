#!/usr/bin/env node
/**
 * 시맨틱 테이블 인텔리전스 진단 스크립트 (Node.js)
 * HWPX 파일을 직접 파싱하여 시맨틱 그리드 분석 수행
 *
 * 사용법: node scripts/diagnostic-test.mjs [hwpx-file]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';

// JSDOM으로 DOMParser polyfill
const dom = new JSDOM('');
globalThis.DOMParser = dom.window.DOMParser;
globalThis.document = dom.window.document;

// ─── 간이 HWPX 파서 (Node.js용) ─────────────────────────────────────

async function parseHWPX(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // section XML 파일 찾기
  const sectionFiles = [];
  zip.forEach((path, entry) => {
    if (path.match(/Contents\/section\d+\.xml$/i)) {
      sectionFiles.push({ path, entry });
    }
  });

  sectionFiles.sort((a, b) => a.path.localeCompare(b.path));

  const sections = [];

  for (const { path, entry } of sectionFiles) {
    const xml = await entry.async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const section = {
      id: `section${sections.length}`,
      elements: [],
    };

    // 표 파싱 (간이 버전)
    const tables = doc.querySelectorAll('tbl');

    for (const tbl of tables) {
      const table = parseTable(tbl);
      if (table) section.elements.push(table);
    }

    // 문단 파싱 (표 외부)
    const body = doc.querySelector('body') || doc.documentElement;
    const topLevelParagraphs = body.querySelectorAll(':scope > p');
    for (const p of topLevelParagraphs) {
      const para = parseParagraph(p);
      if (para) section.elements.push(para);
    }

    sections.push(section);
    console.log(`  섹션 ${sections.length - 1}: ${section.elements.length}개 요소 (표 ${tables.length}개)`);
  }

  return {
    sections,
    images: new Map(),
    metadata: { parserVersion: 'diagnostic-mini' },
  };
}

function parseTable(tblElem) {
  const rows = [];
  const trElements = tblElem.querySelectorAll(':scope > tr');

  for (const tr of trElements) {
    const cells = [];
    const tcElements = tr.querySelectorAll(':scope > tc');

    for (const tc of tcElements) {
      const cell = parseCell(tc);
      cells.push(cell);
    }

    rows.push({ cells });
  }

  if (rows.length === 0) return null;

  // colCount
  let colCount = 0;
  if (rows[0]) {
    for (const cell of rows[0].cells) {
      colCount += cell.colSpan || 1;
    }
  }

  const table = {
    type: 'table',
    rows,
    colCount,
  };

  // gridMap 구축
  buildGridMap(table);

  return table;
}

function parseCell(tcElem) {
  const cellAddr = tcElem.querySelector('cellAddr');
  const cellSpan = tcElem.querySelector('cellSpan');

  const colSpan = cellSpan ? parseInt(cellSpan.getAttribute('colSpan') || '1') : 1;
  const rowSpan = cellSpan ? parseInt(cellSpan.getAttribute('rowSpan') || '1') : 1;

  // 배경색
  const cellPr = tcElem.querySelector('cellPr');
  let backgroundColor = undefined;
  let textAlign = undefined;

  if (cellPr) {
    const fillIDRef = cellPr.getAttribute('borderFillIDRef');
    textAlign = cellPr.getAttribute('textAlign')?.toLowerCase();
  }

  // 내용 파싱
  const elements = [];
  const paragraphs = tcElem.querySelectorAll(':scope > subList > p, :scope > p');

  for (const p of paragraphs) {
    const para = parseParagraph(p);
    if (para) elements.push(para);
  }

  return {
    elements,
    colSpan,
    rowSpan,
    backgroundColor,
    textAlign,
  };
}

function parseParagraph(pElem) {
  const runs = [];
  const runElements = pElem.querySelectorAll(':scope > run');

  for (const run of runElements) {
    const secPr = run.querySelector('secPr');
    const chars = run.querySelectorAll(':scope > char, :scope > t');

    let text = '';
    for (const ch of chars) {
      text += ch.textContent || '';
    }

    if (text) {
      runs.push({ text, style: {} });
    }
  }

  // 텍스트가 run 바깥에 있는 경우
  if (runs.length === 0) {
    const textContent = pElem.textContent?.trim();
    if (textContent) {
      runs.push({ text: textContent, style: {} });
    }
  }

  return {
    type: 'paragraph',
    runs,
  };
}

function buildGridMap(table) {
  const rows = table.rows || [];
  if (rows.length === 0) return;

  const maxCols = table.colCount || Math.max(...rows.map(r => (r.cells || []).length), 1);
  const maxRows = rows.length;
  const grid = Array.from({ length: maxRows }, () => new Array(maxCols).fill(null));

  rows.forEach((row, rowIdx) => {
    let colPos = 0;
    (row.cells || []).forEach(cell => {
      while (colPos < maxCols && grid[rowIdx][colPos] !== null) {
        colPos++;
      }
      if (colPos >= maxCols) return;

      const rs = cell.rowSpan || 1;
      const cs = cell.colSpan || 1;
      cell.logicalRow = rowIdx;
      cell.logicalCol = colPos;

      for (let r = 0; r < rs && (rowIdx + r) < maxRows; r++) {
        for (let c = 0; c < cs && (colPos + c) < maxCols; c++) {
          grid[rowIdx + r][colPos + c] = (r === 0 && c === 0) ? cell : 'covered';
        }
      }
      colPos += cs;
    });
  });

  table.gridMap = grid;
}

// ─── 시맨틱 분석 (동적 import) ───────────────────────────────────────

async function runDiagnostic(filePath) {
  console.log('═'.repeat(70));
  console.log('  시맨틱 테이블 인텔리전스 진단');
  console.log('═'.repeat(70));
  console.log(`\n파일: ${filePath}\n`);

  // 1. 파일 읽기
  const buffer = readFileSync(filePath);
  console.log(`파일 크기: ${(buffer.length / 1024).toFixed(1)} KB`);

  // 2. HWPX 파싱
  console.log('\n[1/4] HWPX 파싱...');
  const document = await parseHWPX(buffer);
  console.log(`  결과: ${document.sections.length}개 섹션`);

  let totalTables = 0;
  let totalElements = 0;
  for (const section of document.sections) {
    for (const elem of section.elements) {
      totalElements++;
      if (elem.type === 'table') totalTables++;
    }
  }
  console.log(`  요소: ${totalElements}개 (표: ${totalTables}개)`);

  if (totalTables === 0) {
    console.log('\n❌ 표가 없습니다. 진단 중단.');
    return;
  }

  // 3. 시맨틱 그리드 (동적 import — ESM)
  console.log('\n[2/4] 시맨틱 그리드 구축...');

  // table-semantics.ts를 직접 사용할 수 없으므로 순수 JS로 핵심 로직 재현
  for (const section of document.sections) {
    for (const elem of section.elements) {
      if (elem.type !== 'table') continue;

      const table = elem;
      const gridMap = table.gridMap;
      if (!gridMap) continue;

      const numRows = gridMap.length;
      const numCols = gridMap[0]?.length || 0;

      console.log(`\n  ▸ 표 (${numRows}×${numCols})`);

      // 그리드 시각화
      console.log('  ┌' + '─'.repeat(numCols * 20 + numCols - 1) + '┐');

      for (let r = 0; r < numRows; r++) {
        const rowCells = [];
        for (let c = 0; c < numCols; c++) {
          const entry = gridMap[r][c];
          if (entry === 'covered') {
            rowCells.push('(병합)'.padEnd(18));
          } else if (entry === null) {
            rowCells.push('(빈)'.padEnd(18));
          } else {
            // 셀 텍스트 추출
            let text = '';
            for (const el of (entry.elements || [])) {
              if (el.type === 'paragraph') {
                for (const run of (el.runs || [])) {
                  text += run.text || '';
                }
              }
            }
            text = text.trim();
            const display = text.length > 16 ? text.substring(0, 14) + '..' : text;
            const span = (entry.colSpan > 1 || entry.rowSpan > 1)
              ? `[${entry.rowSpan}×${entry.colSpan}]` : '';
            rowCells.push((display + span).padEnd(18));
          }
        }
        console.log(`  │${rowCells.join('│')}│`);
      }
      console.log('  └' + '─'.repeat(numCols * 20 + numCols - 1) + '┘');

      // 헤더 감지 휴리스틱
      let headerRowEnd = 0;
      for (let r = 0; r < Math.min(numRows, 4); r++) {
        let shortCells = 0;
        let totalCells = 0;
        for (let c = 0; c < numCols; c++) {
          const entry = gridMap[r][c];
          if (!entry || entry === 'covered') continue;
          totalCells++;
          let text = '';
          for (const el of (entry.elements || [])) {
            if (el.type === 'paragraph') {
              for (const run of (el.runs || [])) text += run.text || '';
            }
          }
          if (text.trim().length <= 30) shortCells++;
        }
        if (totalCells > 0 && shortCells / totalCells >= 0.5) {
          headerRowEnd = r + 1;
        } else {
          break;
        }
      }

      let headerColEnd = 0;
      for (let c = 0; c < Math.min(numCols, 4); c++) {
        let shortCells = 0;
        let totalCells = 0;
        for (let r = headerRowEnd; r < numRows; r++) {
          const entry = gridMap[r][c];
          if (!entry || entry === 'covered') continue;
          totalCells++;
          let text = '';
          for (const el of (entry.elements || [])) {
            if (el.type === 'paragraph') {
              for (const run of (el.runs || [])) text += run.text || '';
            }
          }
          if (text.trim().length <= 30) shortCells++;
        }
        if (totalCells > 0 && shortCells / totalCells >= 0.4) {
          headerColEnd = c + 1;
        } else {
          break;
        }
      }

      console.log(`\n  코너 영역: ${headerRowEnd}행 × ${headerColEnd}열`);
      console.log(`  컬럼 헤더: 행 0-${headerRowEnd - 1}`);
      console.log(`  행 헤더: 열 0-${headerColEnd - 1}`);

      // 데이터 셀 수
      let dataCells = 0;
      let emptyCells = 0;
      for (let r = headerRowEnd; r < numRows; r++) {
        for (let c = headerColEnd; c < numCols; c++) {
          const entry = gridMap[r][c];
          if (!entry || entry === 'covered') continue;
          dataCells++;
          let text = '';
          for (const el of (entry.elements || [])) {
            if (el.type === 'paragraph') {
              for (const run of (el.runs || [])) text += run.text || '';
            }
          }
          if (text.trim().length === 0) emptyCells++;
        }
      }

      console.log(`  데이터 셀: ${dataCells}개 (빈 셀: ${emptyCells}개)`);
      console.log(`  AI 생성 가능: ${emptyCells > 0 ? '✅ ' + emptyCells + '개 셀' : '⚠️ 모든 셀에 내용 있음'}`);

      // 헤더 체인 샘플
      if (dataCells > 0) {
        console.log('\n  헤더 체인 샘플:');
        let sampleCount = 0;
        for (let r = headerRowEnd; r < numRows && sampleCount < 5; r++) {
          for (let c = headerColEnd; c < numCols && sampleCount < 5; c++) {
            const entry = gridMap[r][c];
            if (!entry || entry === 'covered') continue;

            // 행 헤더 체인
            const rowHeaders = [];
            for (let hc = 0; hc < headerColEnd; hc++) {
              const hEntry = findOwner(gridMap, r, hc);
              if (hEntry) {
                let ht = cellText(hEntry).trim();
                if (ht) rowHeaders.push(ht);
              }
            }

            // 컬럼 헤더 체인
            const colHeaders = [];
            for (let hr = 0; hr < headerRowEnd; hr++) {
              const hEntry = findOwner(gridMap, hr, c);
              if (hEntry) {
                let ht = cellText(hEntry).trim();
                if (ht) colHeaders.push(ht);
              }
            }

            const chain = [...rowHeaders, ...colHeaders].join(' > ');
            const content = cellText(entry).trim();
            const preview = content.length > 40 ? content.substring(0, 38) + '..' : (content || '(빈)');
            console.log(`    [R${r}C${c}] ${chain} = "${preview}"`);
            sampleCount++;
          }
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  진단 완료');
  console.log('═'.repeat(70));
}

function findOwner(gridMap, row, col) {
  const entry = gridMap[row]?.[col];
  if (entry && entry !== 'covered') return entry;
  for (let r = row; r >= 0; r--) {
    for (let c = col; c >= 0; c--) {
      const e = gridMap[r]?.[c];
      if (e && e !== 'covered') {
        if (r + (e.rowSpan || 1) > row && c + (e.colSpan || 1) > col) return e;
      }
    }
  }
  return null;
}

function cellText(cell) {
  let text = '';
  for (const el of (cell.elements || [])) {
    if (el.type === 'paragraph') {
      for (const run of (el.runs || [])) text += run.text || '';
    }
  }
  return text;
}

// ─── 실행 ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filePath = args[0] || 'temp/새문서.hwpx';
const absPath = resolve(filePath);

runDiagnostic(absPath).catch(err => {
  console.error('진단 실패:', err);
  process.exit(1);
});
