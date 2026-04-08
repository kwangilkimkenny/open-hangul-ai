/**
 * OCR Pipeline
 * Tesseract.js 기반 이미지/스캔 문서 텍스트 추출
 *
 * @module lib/ocr/pipeline
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
}

export interface OCROptions {
  language?: string; // 'kor', 'eng', 'kor+eng' 등
  onProgress?: (progress: { status: string; progress: number }) => void;
}

interface OCRWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface OCRBlock {
  text: string;
  confidence: number;
  lines: OCRLine[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * 이미지에서 텍스트 추출 (OCR)
 */
export async function recognizeImage(
  imageSource: File | Blob | string | HTMLCanvasElement,
  options: OCROptions = {},
): Promise<{ text: string; blocks: OCRBlock[]; confidence: number }> {
  const { language = 'kor+eng', onProgress } = options;

  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker(language, undefined, {
    logger: (m: any) => {
      if (onProgress && m.status) {
        onProgress({ status: m.status, progress: m.progress || 0 });
      }
    },
  });

  try {
    const result = await worker.recognize(imageSource as any);
    const data = result.data;

    const blocks: OCRBlock[] = (data.blocks || []).map((block: any) => ({
      text: block.text || '',
      confidence: block.confidence || 0,
      lines: (block.lines || []).map((line: any) => ({
        text: line.text || '',
        confidence: line.confidence || 0,
        words: (line.words || []).map((word: any) => ({
          text: word.text || '',
          confidence: word.confidence || 0,
          bbox: word.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
        })),
        bbox: line.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
      })),
      bbox: block.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
    }));

    return {
      text: data.text || '',
      blocks,
      confidence: data.confidence || 0,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * 이미지 파일을 문서 데이터로 변환 (OCR)
 */
export async function ocrToDocument(
  imageSource: File | Blob,
  fileName: string,
  options: OCROptions = {},
): Promise<DocumentData> {
  const { text, blocks, confidence } = await recognizeImage(imageSource, options);

  const elements: Element[] = [];

  // 원본 이미지 표시
  const objectUrl = URL.createObjectURL(imageSource instanceof File ? imageSource : new Blob([imageSource]));
  const img = new Image();
  const imgSize = await new Promise<{ width: number; height: number }>((resolve) => {
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => {
      console.warn('[OCR] 이미지 크기 감지 실패, 기본값(600x800) 사용');
      resolve({ width: 600, height: 800 });
    };
    img.src = objectUrl;
  });

  elements.push({
    type: 'image',
    src: objectUrl,
    width: Math.min(imgSize.width, 700),
    height: Math.round(Math.min(imgSize.width, 700) * imgSize.height / imgSize.width),
    alt: fileName,
  });

  // 구분선
  elements.push({
    type: 'paragraph',
    runs: [{ text: '── OCR 추출 텍스트 ──', inlineStyle: { bold: true, color: '#666', fontSize: '11pt' } }],
    style: { textAlign: 'center', marginTop: '16px', marginBottom: '8px' },
  });

  // OCR 블록을 문단으로 변환
  if (blocks.length > 0) {
    for (const block of blocks) {
      for (const line of block.lines) {
        const runs: Run[] = [];
        for (const word of line.words) {
          const style: Record<string, any> = {};
          // 신뢰도 낮은 단어 표시
          if (word.confidence < 60) {
            style.backgroundColor = '#fff3cd';
            style.color = '#856404';
          } else if (word.confidence < 80) {
            style.color = '#666';
          }
          runs.push({
            text: word.text + ' ',
            inlineStyle: Object.keys(style).length > 0 ? style : undefined,
          });
        }
        elements.push({ type: 'paragraph', runs });
      }
      // 블록 간 빈 줄
      elements.push({ type: 'paragraph', runs: [{ text: '' }] });
    }
  } else if (text.trim()) {
    // 블록 없이 텍스트만 있는 경우
    const lines = text.split('\n');
    for (const line of lines) {
      elements.push({
        type: 'paragraph',
        runs: [{ text: line }],
      });
    }
  } else {
    elements.push({
      type: 'paragraph',
      runs: [{ text: '텍스트를 인식하지 못했습니다.', inlineStyle: { italic: true, color: '#999' } }],
    });
  }

  // 신뢰도 정보
  elements.push({
    type: 'paragraph',
    runs: [{ text: `OCR 신뢰도: ${Math.round(confidence)}%`, inlineStyle: { fontSize: '10pt', color: '#888' } }],
    style: { textAlign: 'right', marginTop: '12px' },
  });

  const images = new Map<string, any>();
  images.set('ocr-source', { src: objectUrl, path: fileName });

  return {
    sections: [{
      elements,
      pageSettings: {
        width: '794px', height: '1123px',
        marginLeft: '60px', marginRight: '60px',
        marginTop: '60px', marginBottom: '60px',
      },
      pageWidth: 794,
      pageHeight: 1123,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    }],
    images,
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: 1,
      imagesCount: 1,
      borderFillsCount: 0,
      sourceFormat: 'ocr',
      fileName,
      ocrConfidence: confidence,
      ocrLanguage: options.language || 'kor+eng',
    },
    cleanup() {
      URL.revokeObjectURL(objectUrl);
      images.clear();
    },
  };
}

/**
 * 스캔 PDF에서 OCR 수행
 * PDF의 각 페이지를 이미지로 렌더링한 후 OCR
 */
export async function ocrPDF(
  buffer: ArrayBuffer,
  fileName: string,
  options: OCROptions = {},
): Promise<DocumentData> {
  const pdfjsLib = await import('pdfjs-dist');

  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const allElements: Element[] = [];
  const images = new Map<string, any>();
  let totalConfidence = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    // 페이지를 캔버스에 렌더링
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // 캔버스에서 OCR 수행
    if (options.onProgress) {
      options.onProgress({
        status: `페이지 ${pageNum}/${pdf.numPages} OCR 처리 중...`,
        progress: (pageNum - 1) / pdf.numPages,
      });
    }

    const { blocks, confidence } = await recognizeImage(canvas, options);
    totalConfidence += confidence;

    // 페이지 번호 헤더
    allElements.push({
      type: 'paragraph',
      runs: [{ text: `─── 페이지 ${pageNum} ───`, inlineStyle: { bold: true, color: '#888', fontSize: '10pt' } }],
      style: { textAlign: 'center', marginTop: pageNum > 1 ? '24px' : '0', marginBottom: '8px' },
    });

    for (const block of blocks) {
      for (const line of block.lines) {
        const runs: Run[] = line.words.map(word => {
          const style: Record<string, any> = {};
          if (word.confidence < 60) {
            style.backgroundColor = '#fff3cd';
          }
          return {
            text: word.text + ' ',
            inlineStyle: Object.keys(style).length > 0 ? style : undefined,
          };
        });
        allElements.push({ type: 'paragraph', runs });
      }
      allElements.push({ type: 'paragraph', runs: [{ text: '' }] });
    }
  }

  const avgConfidence = pdf.numPages > 0 ? totalConfidence / pdf.numPages : 0;

  allElements.push({
    type: 'paragraph',
    runs: [{ text: `OCR 평균 신뢰도: ${Math.round(avgConfidence)}% (${pdf.numPages}페이지)`, inlineStyle: { fontSize: '10pt', color: '#888' } }],
    style: { textAlign: 'right', marginTop: '12px' },
  });

  return {
    sections: [{
      elements: allElements,
      pageSettings: {
        width: '794px', height: '1123px',
        marginLeft: '60px', marginRight: '60px',
        marginTop: '60px', marginBottom: '60px',
      },
      pageWidth: 794,
      pageHeight: 1123,
      headers: { both: null, odd: null, even: null },
      footers: { both: null, odd: null, even: null },
    }],
    images,
    borderFills: new Map(),
    metadata: {
      parsedAt: new Date().toISOString(),
      sectionsCount: 1,
      imagesCount: 0,
      borderFillsCount: 0,
      sourceFormat: 'ocr-pdf',
      fileName,
      ocrConfidence: avgConfidence,
      ocrLanguage: options.language || 'kor+eng',
      totalPages: pdf.numPages,
    },
  };
}

export default { recognizeImage, ocrToDocument, ocrPDF };
