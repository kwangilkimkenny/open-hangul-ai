/**
 * Markdown Parser
 * Markdown 텍스트를 편집기 문서 데이터로 변환
 *
 * @module lib/markdown/parser
 * @version 1.0.0
 */

interface Run {
  text: string;
  type?: string;
  inlineStyle?: Record<string, any>;
  style?: Record<string, any>;
}

interface Element {
  type: string;
  runs?: Run[];
  rows?: any[];
  style?: Record<string, any>;
}

interface Section {
  elements: Element[];
  pageSettings: Record<string, string>;
  pageWidth: number;
  pageHeight: number;
  headers: { both: null; odd: null; even: null };
  footers: { both: null; odd: null; even: null };
}

interface DocumentData {
  sections: Section[];
  images: Map<string, any>;
  borderFills: Map<string, any>;
  metadata: Record<string, any>;
}

/**
 * 인라인 마크다운(굵게, 기울임, 코드, 링크)을 runs 배열로 변환
 */
function parseInlineMarkdown(text: string): Run[] {
  const runs: Run[] = [];
  // 패턴: **bold**, *italic*, `code`, ~~strike~~, [text](url)
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~|\[(.+?)\]\((.+?)\))/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 매치 전 일반 텍스트
    if (match.index > lastIndex) {
      runs.push({ text: text.substring(lastIndex, match.index) });
    }

    if (match[2]) {
      // ***bold italic***
      runs.push({ text: match[2], inlineStyle: { bold: true, italic: true } });
    } else if (match[3]) {
      // **bold**
      runs.push({ text: match[3], inlineStyle: { bold: true } });
    } else if (match[4]) {
      // *italic*
      runs.push({ text: match[4], inlineStyle: { italic: true } });
    } else if (match[5]) {
      // `code`
      runs.push({ text: match[5], inlineStyle: { fontFamily: 'monospace', backgroundColor: '#f0f0f0' } });
    } else if (match[6]) {
      // ~~strikethrough~~
      runs.push({ text: match[6], inlineStyle: { strikethrough: true } });
    } else if (match[7] && match[8]) {
      // [text](url)
      runs.push({ text: `${match[7]} (${match[8]})`, inlineStyle: { color: '#2b579a', underline: true } });
    }

    lastIndex = match.index + match[0].length;
  }

  // 나머지 텍스트
  if (lastIndex < text.length) {
    runs.push({ text: text.substring(lastIndex) });
  }

  if (runs.length === 0) {
    runs.push({ text });
  }

  return runs;
}

/**
 * Markdown 테이블을 문서 테이블 데이터로 변환
 */
function parseTable(lines: string[]): Element {
  const rows: any[] = [];

  lines.forEach((line, lineIdx) => {
    // 구분선(---|---|---) 스킵
    if (/^\|?\s*[-:]+\s*\|/.test(line)) return;

    const cells = line
      .replace(/^\||\|$/g, '') // 양 끝 | 제거
      .split('|')
      .map(cell => cell.trim());

    const isHeader = lineIdx === 0;
    rows.push({
      cells: cells.map(cellText => ({
        elements: [{
          type: 'paragraph',
          runs: parseInlineMarkdown(cellText).map(r =>
            isHeader ? { ...r, inlineStyle: { ...r.inlineStyle, bold: true } } : r
          ),
        }],
      })),
    });
  });

  return { type: 'table', rows };
}

/**
 * Markdown 텍스트를 편집기 문서 데이터로 변환
 */
export function parseMarkdown(markdown: string): DocumentData {
  const lines = markdown.split('\n');
  const elements: Element[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (line.trim() === '') {
      elements.push({ type: 'paragraph', runs: [{ text: '' }] });
      i++;
      continue;
    }

    // 제목 (# ~ ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizeMap: Record<number, string> = { 1: '24pt', 2: '20pt', 3: '16pt', 4: '14pt', 5: '12pt', 6: '11pt' };
      const runs = parseInlineMarkdown(headingMatch[2]);
      runs.forEach(r => {
        r.inlineStyle = { ...r.inlineStyle, bold: true, fontSize: sizeMap[level] };
      });
      elements.push({ type: 'paragraph', runs });
      i++;
      continue;
    }

    // 수평선 (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      elements.push({ type: 'paragraph', runs: [{ text: '────────────────────────────────────────' }] });
      i++;
      continue;
    }

    // 테이블 (| 로 시작하는 연속 줄)
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(parseTable(tableLines));
      continue;
    }

    // 코드 블록 (```)
    if (line.trim().startsWith('```')) {
      const lang = line.trim().replace('```', '').trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // 닫는 ``` 스킵

      if (lang) {
        elements.push({
          type: 'paragraph',
          runs: [{ text: `[${lang}]`, inlineStyle: { bold: true, fontSize: '10pt', color: '#666666' } }],
        });
      }
      codeLines.forEach(codeLine => {
        elements.push({
          type: 'paragraph',
          runs: [{ text: codeLine || ' ', inlineStyle: { fontFamily: 'monospace', fontSize: '10pt' } }],
          style: { backgroundColor: '#f5f5f5' },
        });
      });
      continue;
    }

    // 인용 (> )
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '');
      elements.push({
        type: 'paragraph',
        runs: parseInlineMarkdown(quoteText).map(r => ({
          ...r,
          inlineStyle: { ...r.inlineStyle, italic: true, color: '#666666' },
        })),
        style: { paddingLeft: '20px', borderLeft: '3px solid #ccc' },
      });
      i++;
      continue;
    }

    // 비순서 목록 (- , * , + )
    if (/^\s*[-*+]\s+/.test(line)) {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const depth = Math.floor(indent / 2);
      const bullets = ['●', '○', '■', '▪'];
      const bullet = bullets[Math.min(depth, bullets.length - 1)];
      const text = line.replace(/^\s*[-*+]\s+/, '');
      const padding = `${20 + depth * 20}px`;
      elements.push({
        type: 'paragraph',
        runs: [
          { text: `${bullet} `, inlineStyle: { color: '#333' } },
          ...parseInlineMarkdown(text),
        ],
        style: { paddingLeft: padding },
      });
      i++;
      continue;
    }

    // 순서 목록 (1. , 2. )
    if (/^\s*\d+\.\s+/.test(line)) {
      const numMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
      if (numMatch) {
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const padding = `${20 + Math.floor(indent / 2) * 20}px`;
        elements.push({
          type: 'paragraph',
          runs: [
            { text: `${numMatch[1]}. `, inlineStyle: { bold: true } },
            ...parseInlineMarkdown(numMatch[2]),
          ],
          style: { paddingLeft: padding },
        });
      }
      i++;
      continue;
    }

    // 체크리스트 (- [ ] , - [x] )
    if (/^\s*-\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /\[[xX]\]/.test(line);
      const text = line.replace(/^\s*-\s+\[[ xX]\]\s+/, '');
      elements.push({
        type: 'paragraph',
        runs: [
          { text: checked ? '☑ ' : '☐ ', inlineStyle: { fontSize: '14pt' } },
          ...parseInlineMarkdown(text).map(r =>
            checked ? { ...r, inlineStyle: { ...r.inlineStyle, strikethrough: true, color: '#999' } } : r
          ),
        ],
        style: { paddingLeft: '20px' },
      });
      i++;
      continue;
    }

    // 이미지 (![alt](url))
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      elements.push({
        type: 'paragraph',
        runs: [{ text: `[이미지: ${imgMatch[1] || imgMatch[2]}]`, inlineStyle: { italic: true, color: '#2b579a' } }],
      });
      i++;
      continue;
    }

    // 일반 단락
    elements.push({ type: 'paragraph', runs: parseInlineMarkdown(line) });
    i++;
  }

  return {
    sections: [{
      elements,
      pageSettings: {
        width: '794px', height: '1123px',
        marginLeft: '85px', marginRight: '85px',
        marginTop: '71px', marginBottom: '57px',
      },
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
      sourceFormat: 'markdown',
    },
  };
}

/**
 * Run의 스타일 정보를 통합적으로 읽기 (inlineStyle / style 모두 지원)
 * - inlineStyle: parseMarkdown으로 생성된 문서
 * - style: HWPX 파서에서 생성된 문서 (HWPXTextStyle)
 */
function getRunStyle(run: any): { bold: boolean; italic: boolean; strikethrough: boolean; underline: boolean; fontSize: number; fontFamily: string } {
  const s = run.inlineStyle || run.style || {};
  return {
    bold: !!(s.bold || s.fontWeight === 'bold'),
    italic: !!(s.italic || s.fontStyle === 'italic'),
    strikethrough: !!s.strikethrough,
    underline: !!s.underline,
    fontSize: s.fontSize ? parseFloat(String(s.fontSize)) : 0,
    fontFamily: s.fontFamily || '',
  };
}

/**
 * 문단이 제목인지 감지 (HWPX 문서의 큰 bold 텍스트)
 */
function detectHeadingLevel(el: any): number {
  const runs = el.runs || [];
  if (runs.length === 0) return 0;

  // 모든 run이 bold이고 텍스트가 있는 경우만 제목으로 판단
  const textRuns = runs.filter((r: any) => (r.text || '').trim());
  if (textRuns.length === 0) return 0;

  const allBold = textRuns.every((r: any) => getRunStyle(r).bold);
  if (!allBold) return 0;

  // 가장 큰 폰트 크기로 레벨 결정
  const maxPt = Math.max(...textRuns.map((r: any) => getRunStyle(r).fontSize || 0));
  if (maxPt >= 24) return 1;
  if (maxPt >= 20) return 2;
  if (maxPt >= 16) return 3;
  if (maxPt >= 14) return 4;
  return 0;
}

/**
 * Run 텍스트에 인라인 마크다운 스타일 적용
 */
function applyRunStyle(text: string, run: any): string {
  if (!text) return '';
  const s = getRunStyle(run);
  if (s.bold && s.italic) return `***${text}***`;
  if (s.bold) return `**${text}**`;
  if (s.italic) return `*${text}*`;
  if (s.strikethrough) return `~~${text}~~`;
  if (s.fontFamily === 'monospace') return `\`${text}\``;
  return text;
}

/**
 * 테이블 셀의 텍스트를 추출 (linebreak 처리 포함)
 */
function extractCellText(cell: any): string {
  return (cell.elements || [])
    .map((ce: any) => {
      if (ce.type !== 'paragraph' || !ce.runs) return '';
      return ce.runs.map((r: any) => {
        if (r.type === 'linebreak') return ' ';
        return (r.text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      }).join('');
    })
    .join(' ')
    .trim();
}

/**
 * 문서 데이터를 Markdown으로 내보내기
 * HWPX 파서 출력(style)과 마크다운 파서 출력(inlineStyle) 모두 지원
 */
export function exportToMarkdown(doc: DocumentData): string {
  const lines: string[] = [];

  doc.sections.forEach((section, sectionIdx) => {
    if (sectionIdx > 0) lines.push('', '---', '');

    section.elements.forEach(el => {
      if (el.type === 'paragraph' && el.runs) {
        // linebreak-only or tab-only 처리
        const hasText = el.runs.some((r: any) => (r.text || '').trim());
        if (!hasText) {
          lines.push('');
          return;
        }

        // 제목 감지
        const headingLevel = detectHeadingLevel(el);
        if (headingLevel > 0) {
          const text = el.runs.map((r: any) => r.text || '').join('').trim();
          lines.push(`${'#'.repeat(headingLevel)} ${text}`);
          return;
        }

        // 일반 문단
        let line = '';
        el.runs.forEach((run: any) => {
          if (run.type === 'linebreak') {
            line += '  \n'; // MD 줄바꿈 (trailing 2 spaces)
            return;
          }
          if (run.type === 'tab') {
            line += '\t';
            return;
          }
          const text = run.text || '';
          if (!text) return;
          line += applyRunStyle(text, run);
        });
        lines.push(line);

      } else if (el.type === 'table' && el.rows) {
        // 빈 줄 추가 (테이블 앞)
        if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');

        const rows = el.rows || [];
        if (rows.length === 0) return;

        // 열 수 결정 (첫 행 기준)
        const colCount = Math.max(...rows.map((row: any) => (row.cells || []).length));
        if (colCount === 0) return;

        rows.forEach((row: any, rowIdx: number) => {
          const cells = (row.cells || []).map((cell: any) => extractCellText(cell));
          // 열 수 맞추기
          while (cells.length < colCount) cells.push('');
          lines.push(`| ${cells.join(' | ')} |`);
          // 첫 행 다음에 구분선
          if (rowIdx === 0) {
            lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
          }
        });
        lines.push(''); // 테이블 뒤 빈 줄

      } else if (el.type === 'image') {
        const img = el as any;
        const alt = img.alt || '이미지';
        const src = img.src || img.url || '';
        lines.push(`![${alt}](${src})`);

      } else if (el.type === 'shape') {
        // shape 내부 텍스트 추출
        const shape = el as any;
        if (shape.paragraphs) {
          shape.paragraphs.forEach((p: any) => {
            if (p.runs) {
              const text = p.runs.map((r: any) => r.text || '').join('');
              if (text.trim()) lines.push(text);
            }
          });
        } else if (shape.elements) {
          shape.elements.forEach((child: any) => {
            if (child.type === 'paragraph' && child.runs) {
              const text = child.runs.map((r: any) => r.text || '').join('');
              if (text.trim()) lines.push(text);
            }
          });
        }
      }
    });
  });

  return lines.join('\n');
}

export default { parseMarkdown, exportToMarkdown };
