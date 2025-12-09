/**
 * PDF Exporter - HWPX를 PDF로 내보내기
 * html2pdf.js 사용
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * PDF Exporter 클래스
 */
export class PDFExporter {
    constructor(options = {}) {
        this.options = {
            filename: 'document.pdf',
            margin: 10, // mm
            format: 'a4',
            orientation: 'portrait', // portrait, landscape
            quality: 2, // 1-5
            ...options
        };
        
        logger.info('PDFExporter initialized');
    }
    
    /**
     * HTML 요소를 PDF로 변환
     * @param {HTMLElement} element - 변환할 HTML 요소
     * @param {Object} customOptions - 커스텀 옵션
     */
    async exportToPDF(element, customOptions = {}) {
        if (!element) {
            throw new Error('Element is required for PDF export');
        }
        
        const options = { ...this.options, ...customOptions };
        
        try {
            logger.info(`Exporting to PDF: ${options.filename}`);
            
            // html2pdf.js 사용 (CDN 또는 npm 패키지 필요)
            if (typeof html2pdf === 'undefined') {
                logger.warn('html2pdf.js not loaded, creating simple download');
                return this.fallbackExport(element, options);
            }
            
            const opt = {
                margin: options.margin,
                filename: options.filename,
                image: { type: 'jpeg', quality: options.quality / 5 },
                html2canvas: { scale: options.quality },
                jsPDF: { unit: 'mm', format: options.format, orientation: options.orientation }
            };
            
            await html2pdf().set(opt).from(element).save();
            
            logger.info('PDF export completed successfully');
            return true;
            
        } catch (error) {
            logger.error(`PDF export failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 폴백 내보내기 (html2pdf 없을 경우)
     */
    fallbackExport(element, options) {
        logger.info('Using fallback export method');
        
        // 기본적으로 print 다이얼로그 열기
        window.print();
        
        return Promise.resolve(false);
    }
    
    /**
     * 문서 전체를 PDF로 내보내기
     * @param {string} selector - 문서 컨테이너 셀렉터
     */
    async exportDocument(selector = '#contentArea') {
        const element = document.querySelector(selector);
        
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }
        
        return this.exportToPDF(element);
    }
    
    /**
     * 특정 페이지만 PDF로 내보내기
     * @param {number[]} pageNumbers - 페이지 번호 배열
     */
    async exportPages(pageNumbers, containerSelector = '#contentArea') {
        const container = document.querySelector(containerSelector);
        
        if (!container) {
            throw new Error(`Container not found: ${containerSelector}`);
        }
        
        // 임시 컨테이너 생성
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);
        
        try {
            // 선택된 페이지만 복사
            pageNumbers.forEach(pageNum => {
                const page = container.querySelector(`[data-page="${pageNum}"]`);
                if (page) {
                    tempContainer.appendChild(page.cloneNode(true));
                }
            });
            
            await this.exportToPDF(tempContainer, {
                filename: `pages_${pageNumbers.join('_')}.pdf`
            });
            
        } finally {
            // 임시 컨테이너 제거
            document.body.removeChild(tempContainer);
        }
    }
}

/**
 * 간단한 PDF 내보내기 헬퍼 함수
 */
export async function exportToPDF(elementOrSelector, options = {}) {
    const exporter = new PDFExporter(options);
    
    if (typeof elementOrSelector === 'string') {
        return exporter.exportDocument(elementOrSelector);
    } else {
        return exporter.exportToPDF(elementOrSelector, options);
    }
}

export default PDFExporter;

