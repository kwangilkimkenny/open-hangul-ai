/**
 * Markdown to HWPX Document Converter
 * 마크다운 문자열을 HWPX 파싱 문서 구조로 변환
 *
 * @module utils/markdown-to-document
 * @version 1.1.0
 */

/**
 * 마크다운 텍스트를 파싱된 HWPX 문서 구조로 변환
 * @param {string} markdown - 마크다운 문자열
 * @param {Object} [options] - 옵션
 * @param {Object} [options.pageSettings] - 페이지 설정
 * @returns {Object} HWPX 문서 구조
 */
export function markdownToDocument(markdown, options = {}) {
  const pageSettings = options.pageSettings || {
    width: '794px', height: '1123px',
    marginLeft: '85px', marginRight: '85px',
    marginTop: '71px', marginBottom: '57px',
  };

  const elements = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 코드 블록 (```) — 배경색이 있는 단일 셀 테이블로 렌더링
    if (line.trimStart().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeRunStyle = { fontFamily: "'Courier New', monospace", fontSize: '9pt', color: '#e6e6e6' };
      const codeTable = {
        type: 'table',
        rows: [{
          cells: [{
            elements: codeLines.map(codeLine => ({
              type: 'paragraph',
              runs: [{ text: codeLine || ' ', style: { ...codeRunStyle } }],
              style: { lineHeight: '1.4' },
            })),
            style: {
              backgroundColor: '#1e1e1e',
              padding: '12px 16px',
              borderLeftDef: { css: '3px solid #007acc' },
              borderRightDef: { css: '1px solid #333' },
              borderTopDef: { css: '1px solid #333' },
              borderBottomDef: { css: '1px solid #333' },
            },
          }],
        }],
      };
      elements.push(codeTable);
      continue;
    }

    // 빈 줄
    if (line.trim() === '') {
      elements.push({ type: 'paragraph', runs: [{ text: '', style: {} }] });
      i++;
      continue;
    }

    // 수평선 (---, ___, ***)
    if (/^(\s*[-_*]){3,}\s*$/.test(line)) {
      elements.push({
        type: 'paragraph',
        runs: [{ text: '─'.repeat(60), style: { color: '#ccc' } }],
        style: { textAlign: 'center' },
      });
      i++;
      continue;
    }

    // 헤더 (#, ##, ###, ####)
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const sizes = { 1: '22pt', 2: '18pt', 3: '15pt', 4: '13pt' };
      elements.push({
        type: 'paragraph',
        runs: parseInlineRuns(headerMatch[2], { bold: true, fontSize: sizes[level] }),
        style: { lineHeight: '2.0' },
      });
      i++;
      continue;
    }

    // 테이블 (| col1 | col2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const row = lines[i].trim();
        // 구분선 행 (|---|---|) 건너뛰기
        if (/^\|[\s\-:]+\|/.test(row) && !row.replace(/[\s|:\-]/g, '')) {
          i++;
          continue;
        }
        const cells = row.slice(1, -1).split('|').map(c => c.trim());
        tableRows.push(cells);
        i++;
      }

      if (tableRows.length > 0) {
        const table = {
          type: 'table',
          rows: tableRows.map((cells, rowIdx) => ({
            cells: cells.map(cellText => ({
              elements: [{
                type: 'paragraph',
                runs: parseInlineRuns(cellText, rowIdx === 0 ? { bold: true } : {}),
              }],
            })),
          })),
        };
        elements.push(table);
      }
      continue;
    }

    // 리스트 (- item, * item, 1. item)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = Math.floor(listMatch[1].length / 2);
      const isOrdered = /^\d+\./.test(listMatch[2]);
      const prefix = isOrdered ? listMatch[2] + ' ' : '  '.repeat(indent) + '\u2022 ';
      elements.push({
        type: 'paragraph',
        runs: [
          { text: prefix, style: { color: '#666' } },
          ...parseInlineRuns(listMatch[3], {}),
        ],
        style: { margin: `0 0 0 ${20 + indent * 16}px` },
      });
      i++;
      continue;
    }

    // 일반 단락 (인라인 서식 포함)
    elements.push({
      type: 'paragraph',
      runs: parseInlineRuns(line, {}),
    });
    i++;
  }

  return {
    sections: [{
      elements,
      pageSettings,
      pageWidth: 794,
      pageHeight: 1123,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    }],
    images: new Map(),
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: 1,
      imagesCount: 0,
      borderFillsCount: 0,
    },
  };
}

/**
 * 인라인 마크다운 서식을 runs 배열로 변환
 * 스타일은 run.style에 직접 설정 (렌더러가 run.style을 사용)
 * @param {string} text - 인라인 텍스트
 * @param {Object} baseStyle - 기본 스타일
 * @returns {Array} runs 배열
 */
function parseInlineRuns(text, baseStyle) {
  const runs = [];
  // 정규식: **bold**, *italic*, `code` 순서로 매칭
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 매칭 전 일반 텍스트
    if (match.index > lastIndex) {
      runs.push({
        text: text.slice(lastIndex, match.index),
        style: { ...baseStyle },
      });
    }

    if (match[2]) {
      // **bold**
      runs.push({
        text: match[2],
        style: { ...baseStyle, bold: true },
      });
    } else if (match[4]) {
      // *italic*
      runs.push({
        text: match[4],
        style: { ...baseStyle, italic: true },
      });
    } else if (match[6]) {
      // `code`
      runs.push({
        text: match[6],
        style: {
          ...baseStyle,
          fontFamily: "'Courier New', monospace",
          fontSize: '9pt',
          backgroundColor: '#f0f0f0',
        },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // 남은 텍스트
  if (lastIndex < text.length) {
    runs.push({
      text: text.slice(lastIndex),
      style: { ...baseStyle },
    });
  }

  // 빈 경우 기본 run 반환
  if (runs.length === 0) {
    runs.push({
      text,
      style: { ...baseStyle },
    });
  }

  return runs;
}

export default markdownToDocument;
