/**
 * PDF Exporter barrel export
 * Re-exports PDF exporter from vanilla export for easier importing
 *
 * @module lib/export/pdf-exporter
 * @version 1.0.0
 */

// Note: PDF exporter is not yet implemented in vanilla
// This is a placeholder for future implementation
export class PDFExporter {
  constructor(_options?: any) {
    throw new Error('PDF export is not yet implemented');
  }

  async export(_document: any): Promise<Blob> {
    throw new Error('PDF export is not yet implemented');
  }

  async exportDocument(_selector: string, _options?: { filename?: string } | string): Promise<{ blob?: Blob; filename: string; method?: string }> {
    throw new Error('PDF export is not yet implemented');
  }
}

// Type alias for backward compatibility
export type PdfExporter = PDFExporter;

// Value alias for backward compatibility
export const PdfExporter = PDFExporter;

export default PDFExporter;
