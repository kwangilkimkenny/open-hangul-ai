/**
 * PDF Parser
 * PDF 파일을 편집기 문서 데이터(HWPXDocument)로 변환
 *
 * pdfjs-dist를 사용하여 텍스트 추출 + 캔버스 렌더링
 *
 * @module lib/pdf/parser
 * @version 1.0.0
 */

interface Run {
  text: string;
  type?: string;
  inlineStyle?: Record<string, any>;
}

interface Element {
  type: string;
  runs?: Run[];
  rows?: any[];
  style?: Record<string, any>;
  src?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
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
  /** 리소스 정리 — Object URL 해제 */
  cleanup?: () => void;
}

interface TextLine {
  y: number;
  items: Array<{ text: string; x: number; fontSize: number; fontName: string }>;
}

/**
 * PDF 파일을 문서 데이터로 변환
 */
export async function parsePDF(buffer: ArrayBuffer, fileName: string): Promise<DocumentData> {
  const pdfjsLib = await import('pdfjs-dist');

  // Worker 설정
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const sections: Section[] = [];
  const images = new Map<string, any>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    // PDF 포인트를 px로 (96 DPI 기준, PDF는 72 DPI)
    const scale = 96 / 72;
    const widthPx = Math.round(viewport.width * scale);
    const heightPx = Math.round(viewport.height * scale);

    // 텍스트 추출
    const textContent = await page.getTextContent();
    const elements: Element[] = [];

    // 텍스트 아이템을 Y 좌표별로 그룹핑 (라인 구성)
    const lines: TextLine[] = [];
    const Y_TOLERANCE = 3; // 같은 라인으로 간주할 Y 허용 오차

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;

      const tx = item.transform;
      const x = tx[4] * scale;
      const y = (viewport.height - tx[5]) * scale; // PDF Y는 아래→위, 뒤집기
      const fontSize = Math.abs(tx[0]) * scale;
      const fontName = item.fontName || '';

      // 기존 라인에 합칠 수 있는지 확인
      let merged = false;
      for (const line of lines) {
        if (Math.abs(line.y - y) < Y_TOLERANCE) {
          line.items.push({ text: item.str, x, fontSize, fontName });
          merged = true;
          break;
        }
      }
      if (!merged) {
        lines.push({ y, items: [{ text: item.str, x, fontSize, fontName }] });
      }
    }

    // Y 좌표 순 정렬 (위→아래)
    lines.sort((a, b) => a.y - b.y);

    // 라인을 paragraph 요소로 변환
    for (const line of lines) {
      // X 좌표 순 정렬 (왼→오른쪽)
      line.items.sort((a, b) => a.x - b.x);

      const runs: Run[] = [];
      let currentFontSize = 0;
      let currentFontName = '';

      for (const item of line.items) {
        const style: Record<string, any> = {};

        if (item.fontSize && item.fontSize > 0) {
          style.fontSize = `${Math.round(item.fontSize)}pt`;
        }

        // 볼드 감지 (fontName에 Bold 포함)
        if (item.fontName.toLowerCase().includes('bold')) {
          style.bold = true;
        }
        if (item.fontName.toLowerCase().includes('italic')) {
          style.italic = true;
        }

        // 같은 스타일이면 텍스트 합치기
        if (
          runs.length > 0 &&
          item.fontSize === currentFontSize &&
          item.fontName === currentFontName
        ) {
          const lastRun = runs[runs.length - 1];
          lastRun.text += item.text;
        } else {
          runs.push({
            text: item.text,
            inlineStyle: Object.keys(style).length > 0 ? style : undefined,
          });
          currentFontSize = item.fontSize;
          currentFontName = item.fontName;
        }
      }

      if (runs.length > 0) {
        const avgFontSize = line.items.reduce((s, i) => s + i.fontSize, 0) / line.items.length;
        const paraStyle: Record<string, any> = {};

        // 들여쓰기 감지 (첫 아이템의 X가 50px 이상이면)
        if (line.items[0] && line.items[0].x > 60) {
          paraStyle.paddingLeft = `${Math.round(line.items[0].x - 40)}px`;
        }

        // 큰 폰트 = 제목
        if (avgFontSize > 18) {
          paraStyle.marginTop = '12px';
          paraStyle.marginBottom = '8px';
        }

        elements.push({
          type: 'paragraph',
          runs,
          style: Object.keys(paraStyle).length > 0 ? paraStyle : undefined,
        });
      }
    }

    // 페이지 배경 이미지 렌더링 (텍스트가 없는 그래픽 요소 보존)
    try {
      const renderScale = 1.5;
      const renderViewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvas, canvasContext: ctx, viewport: renderViewport }).promise;
        const blob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, 'image/png', 0.85),
        );
        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          const imgKey = `pdf-page-${pageNum}`;
          images.set(imgKey, { src: objectUrl, path: `page-${pageNum}.png` });

          // 텍스트가 없는 페이지면 이미지만 표시
          if (elements.length === 0) {
            elements.push({
              type: 'image',
              src: objectUrl,
              width: widthPx,
              height: heightPx,
              alt: `Page ${pageNum}`,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[PDF Parser] 페이지 ${pageNum} 렌더링 실패:`, err);
    }

    sections.push({
      elements,
      pageSettings: {
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        marginLeft: '40px',
        marginRight: '40px',
        marginTop: '40px',
        marginBottom: '40px',
      },
      pageWidth: widthPx,
      pageHeight: heightPx,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    });
  }

  return {
    sections,
    images,
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: sections.length,
      imagesCount: images.size,
      borderFillsCount: 0,
      sourceFormat: 'pdf',
      fileName,
      totalPages: pdf.numPages,
    },
    cleanup() {
      for (const [, img] of images) {
        if (img?.src) URL.revokeObjectURL(img.src);
      }
      images.clear();
    },
  };
}

export default { parsePDF };
