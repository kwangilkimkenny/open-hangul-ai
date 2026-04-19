/**
 * AI Format Converter
 * AI 기반 문서 포맷 간 지능형 변환
 *
 * @module lib/ai/format-converter
 * @version 1.0.0
 */

export type DocumentFormat = 'hwpx' | 'docx' | 'xlsx' | 'pdf' | 'odt' | 'ods' | 'pptx' | 'md' | 'html';

export interface ConversionOptions {
  sourceFormat: DocumentFormat;
  targetFormat: DocumentFormat;
  preserveStyles?: boolean;
  optimizeLayout?: boolean;
  language?: string;
}

export interface ConversionResult {
  success: boolean;
  blob?: Blob;
  fileName?: string;
  warnings: string[];
  conversionNotes: string[];
}


/**
 * 문서 데이터를 Markdown으로 변환
 */
export function convertToMarkdown(doc: any): string {
  const lines: string[] = [];
  if (!doc?.sections) return '';

  for (const section of doc.sections) {
    for (const el of section.elements || []) {
      if (el.type === 'paragraph' && el.runs) {
        let text = '';
        for (const run of el.runs) {
          let t = run.text || '';
          const s = run.inlineStyle || run.style || {};
          if (s.bold) t = `**${t}**`;
          if (s.italic) t = `*${t}*`;
          if (s.strikethrough) t = `~~${t}~~`;
          if (s.underline) t = `<u>${t}</u>`;
          text += t;
        }

        // 제목 감지
        const firstRun = el.runs[0];
        const fontSize = parseFloat(firstRun?.inlineStyle?.fontSize || '0');
        if (fontSize >= 24 || el.style?._headingLevel === 1) {
          lines.push(`# ${text}`);
        } else if (fontSize >= 20 || el.style?._headingLevel === 2) {
          lines.push(`## ${text}`);
        } else if (fontSize >= 16 || el.style?._headingLevel === 3) {
          lines.push(`### ${text}`);
        } else {
          lines.push(text);
        }
        lines.push('');
      } else if (el.type === 'table' && el.rows) {
        const tableRows: string[][] = [];
        for (const row of el.rows) {
          const cells = (row.cells || []).map((cell: any) =>
            (cell.elements || [])
              .flatMap((e: any) => (e.runs || []).map((r: any) => r.text || ''))
              .join(''),
          );
          tableRows.push(cells);
        }

        if (tableRows.length > 0) {
          const colCount = Math.max(...tableRows.map(r => r.length));
          // Header
          lines.push('| ' + tableRows[0].map(c => c || ' ').join(' | ') + ' |');
          lines.push('| ' + Array(colCount).fill('---').join(' | ') + ' |');
          // Body
          for (let i = 1; i < tableRows.length; i++) {
            lines.push('| ' + tableRows[i].map(c => c || ' ').join(' | ') + ' |');
          }
          lines.push('');
        }
      } else if (el.type === 'image') {
        lines.push(`![${el.alt || '이미지'}](${el.src || ''})`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * 문서 데이터를 HTML로 변환
 */
export function convertToHTML(doc: any): string {
  const parts: string[] = ['<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>'];
  parts.push('body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333;}');
  parts.push('table{border-collapse:collapse;width:100%;margin:12px 0;}');
  parts.push('td,th{border:1px solid #ddd;padding:6px 10px;text-align:left;}');
  parts.push('th{background:#f5f5f5;font-weight:bold;}');
  parts.push('img{max-width:100%;height:auto;}');
  parts.push('</style></head><body>');

  if (!doc?.sections) return parts.join('') + '</body></html>';

  for (const section of doc.sections) {
    for (const el of section.elements || []) {
      if (el.type === 'paragraph' && el.runs) {
        const style = el.style || {};
        const cssProps: string[] = [];
        if (style.textAlign) cssProps.push(`text-align:${style.textAlign}`);
        if (style.paddingLeft) cssProps.push(`padding-left:${style.paddingLeft}`);
        if (style.marginTop) cssProps.push(`margin-top:${style.marginTop}`);
        if (style.marginBottom) cssProps.push(`margin-bottom:${style.marginBottom}`);
        const cssStr = cssProps.length > 0 ? ` style="${cssProps.join(';')}"` : '';

        let html = `<p${cssStr}>`;
        for (const run of el.runs) {
          const s = run.inlineStyle || run.style || {};
          const spanCss: string[] = [];
          if (s.bold) spanCss.push('font-weight:bold');
          if (s.italic) spanCss.push('font-style:italic');
          if (s.underline) spanCss.push('text-decoration:underline');
          if (s.fontSize) spanCss.push(`font-size:${s.fontSize}`);
          if (s.color) spanCss.push(`color:${s.color}`);
          if (s.fontFamily) spanCss.push(`font-family:${s.fontFamily}`);

          const text = escapeHtml(run.text || '');
          if (spanCss.length > 0) {
            html += `<span style="${spanCss.join(';')}">${text}</span>`;
          } else {
            html += text;
          }
        }
        html += '</p>';
        parts.push(html);
      } else if (el.type === 'table' && el.rows) {
        parts.push('<table>');
        for (let ri = 0; ri < el.rows.length; ri++) {
          const row = el.rows[ri];
          parts.push('<tr>');
          const tag = ri === 0 ? 'th' : 'td';
          for (const cell of row.cells || []) {
            const attrs: string[] = [];
            if (cell.colSpan > 1) attrs.push(`colspan="${cell.colSpan}"`);
            if (cell.rowSpan > 1) attrs.push(`rowspan="${cell.rowSpan}"`);
            const text = (cell.elements || [])
              .flatMap((e: any) => (e.runs || []).map((r: any) => r.text || ''))
              .join('');
            parts.push(`<${tag} ${attrs.join(' ')}>${escapeHtml(text)}</${tag}>`);
          }
          parts.push('</tr>');
        }
        parts.push('</table>');
      } else if (el.type === 'image') {
        parts.push(`<figure><img src="${escapeHtml(el.src || '')}" alt="${escapeHtml(el.alt || '')}" width="${escapeHtml(String(el.width || 'auto'))}"/></figure>`);
      }
    }
  }

  parts.push('</body></html>');
  return parts.join('\n');
}

/**
 * AI 기반 포맷 변환 실행
 */
export async function convertDocument(
  doc: any,
  options: ConversionOptions,
): Promise<ConversionResult> {
  const warnings: string[] = [];
  const notes: string[] = [];

  try {
    const { targetFormat } = options;

    switch (targetFormat) {
      case 'md': {
        const md = convertToMarkdown(doc);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        notes.push('Markdown으로 변환 완료');
        if (doc?.images?.size > 0) warnings.push('이미지는 원본 URL로 참조됩니다');
        return { success: true, blob, fileName: '문서.md', warnings, conversionNotes: notes };
      }

      case 'html': {
        const html = convertToHTML(doc);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        notes.push('HTML로 변환 완료');
        return { success: true, blob, fileName: '문서.html', warnings, conversionNotes: notes };
      }

      case 'docx': {
        const { exportToDocx } = await import('../docx/parser');
        const blob = await exportToDocx(doc);
        notes.push('DOCX로 변환 완료');
        return { success: true, blob, fileName: '문서.docx', warnings, conversionNotes: notes };
      }

      case 'xlsx': {
        const { downloadExcel } = await import('../excel/parser');
        // Excel은 다운로드 함수만 있으므로 직접 호출
        await downloadExcel(doc, '문서.xlsx');
        notes.push('Excel로 변환 및 다운로드 완료');
        return { success: true, fileName: '문서.xlsx', warnings, conversionNotes: notes };
      }

      case 'pdf': {
        warnings.push('PDF 변환은 현재 열려 있는 문서의 DOM에서 수행됩니다');
        notes.push('PDF 내보내기는 뷰어의 저장 기능을 사용하세요');
        return { success: true, fileName: '문서.pdf', warnings, conversionNotes: notes };
      }

      default:
        warnings.push(`${targetFormat} 포맷은 아직 지원되지 않습니다`);
        return { success: false, warnings, conversionNotes: notes };
    }
  } catch (error: any) {
    warnings.push(`변환 실패: ${error?.message || '알 수 없는 오류'}`);
    return { success: false, warnings, conversionNotes: notes };
  }
}

/**
 * 변환 결과 다운로드
 */
export function downloadConversionResult(result: ConversionResult): void {
  if (!result.blob || !result.fileName) return;

  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 지원되는 변환 경로 목록
 */
export function getSupportedConversions(): Array<{ from: DocumentFormat; to: DocumentFormat[] }> {
  return [
    { from: 'hwpx', to: ['docx', 'xlsx', 'pdf', 'md', 'html'] },
    { from: 'docx', to: ['hwpx', 'pdf', 'md', 'html'] },
    { from: 'xlsx', to: ['hwpx', 'md', 'html'] },
    { from: 'pdf', to: ['hwpx', 'docx', 'md', 'html'] },
    { from: 'odt', to: ['hwpx', 'docx', 'md', 'html'] },
    { from: 'ods', to: ['hwpx', 'xlsx', 'md', 'html'] },
    { from: 'pptx', to: ['hwpx', 'pdf', 'md', 'html'] },
    { from: 'md', to: ['hwpx', 'docx', 'html'] },
  ];
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default { convertDocument, convertToMarkdown, convertToHTML, downloadConversionResult, getSupportedConversions };
