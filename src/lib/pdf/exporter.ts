/**
 * PDF Exporter
 * 문서 뷰어 DOM을 PDF로 내보내기
 *
 * @module lib/pdf/exporter
 * @version 1.0.0
 */

interface PDFExportOptions {
  fileName?: string;
  pageSize?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margin?: number; // mm
  quality?: number; // 0-1
  scale?: number;
}

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

/**
 * DOM 요소를 PDF로 내보내기
 */
export async function exportToPDF(
  container: HTMLElement,
  options: PDFExportOptions = {},
): Promise<void> {
  const {
    fileName = '문서.pdf',
    pageSize = 'A4',
    orientation = 'portrait',
    margin = 10,
    quality = 0.95,
    scale = 2,
  } = options;

  // Dynamic imports
  const html2canvasModule = await import('html2canvas');
  const html2canvas = html2canvasModule.default;
  const { jsPDF } = await import('jspdf');

  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  const pageWidth = orientation === 'portrait' ? size.width : size.height;
  const pageHeight = orientation === 'portrait' ? size.height : size.width;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // Find all page containers
  const pages = container.querySelectorAll('.hwp-page-container, .hwp-page');

  if (pages.length === 0) {
    throw new Error('내보낼 페이지가 없습니다');
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  for (let i = 0; i < pages.length; i++) {
    const pageEl = pages[i] as HTMLElement;

    // Render page to canvas
    const canvas = await html2canvas(pageEl, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: pageEl.scrollWidth,
      height: pageEl.scrollHeight,
    });

    // Calculate dimensions to fit content area
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    // If image height exceeds page content height, scale down
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;
    if (imgHeight > contentHeight) {
      finalHeight = contentHeight;
      finalWidth = (canvas.width * contentHeight) / canvas.height;
    }

    // Center horizontally
    const xOffset = margin + (contentWidth - finalWidth) / 2;

    if (i > 0) {
      pdf.addPage([pageWidth, pageHeight], orientation);
    }

    const imgData = canvas.toDataURL('image/jpeg', quality);
    pdf.addImage(imgData, 'JPEG', xOffset, margin, finalWidth, finalHeight);
  }

  // Download
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/**
 * PDF 내보내기 (Blob 반환)
 */
export async function exportToPDFBlob(
  container: HTMLElement,
  options: PDFExportOptions = {},
): Promise<Blob> {
  const {
    pageSize = 'A4',
    orientation = 'portrait',
    margin = 10,
    quality = 0.95,
    scale = 2,
  } = options;

  const html2canvasModule = await import('html2canvas');
  const html2canvas = html2canvasModule.default;
  const { jsPDF } = await import('jspdf');

  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  const pageWidth = orientation === 'portrait' ? size.width : size.height;
  const pageHeight = orientation === 'portrait' ? size.height : size.width;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  const pages = container.querySelectorAll('.hwp-page-container, .hwp-page');

  if (pages.length === 0) {
    throw new Error('내보낼 페이지가 없습니다');
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  for (let i = 0; i < pages.length; i++) {
    const pageEl = pages[i] as HTMLElement;

    const canvas = await html2canvas(pageEl, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    let finalWidth = imgWidth;
    let finalHeight = imgHeight;
    if (imgHeight > contentHeight) {
      finalHeight = contentHeight;
      finalWidth = (canvas.width * contentHeight) / canvas.height;
    }

    const xOffset = margin + (contentWidth - finalWidth) / 2;

    if (i > 0) {
      pdf.addPage([pageWidth, pageHeight], orientation);
    }

    const imgData = canvas.toDataURL('image/jpeg', quality);
    pdf.addImage(imgData, 'JPEG', xOffset, margin, finalWidth, finalHeight);
  }

  return pdf.output('blob');
}

export default { exportToPDF, exportToPDFBlob };
