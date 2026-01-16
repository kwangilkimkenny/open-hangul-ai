/**
 * Constants Module Tests
 * @jest-environment jsdom
 */

import { HWPXConstants } from './constants.js';

describe('HWPXConstants', () => {
    describe('Constants Values', () => {
        it('should have correct DPI values', () => {
            expect(HWPXConstants.DPI_STANDARD).toBe(96);
            expect(HWPXConstants.DPI_PRINT).toBe(72);
        });

        it('should have correct A4 dimensions', () => {
            expect(HWPXConstants.PAGE_WIDTH_A4_PX).toBe(794);
            expect(HWPXConstants.PAGE_HEIGHT_A4_PX).toBe(1123);
        });

        it('should have correct file size limits', () => {
            expect(HWPXConstants.MAX_FILE_SIZE_MB).toBe(50);
            expect(HWPXConstants.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
        });

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(HWPXConstants)).toBe(true);
        });
    });

    describe('Unit Conversion Functions', () => {
        describe('ptToPx', () => {
            it('should convert 10pt to 13.33px', () => {
                expect(HWPXConstants.ptToPx(10)).toBeCloseTo(13.33, 2);
            });

            it('should convert 72pt to 96px', () => {
                expect(HWPXConstants.ptToPx(72)).toBe(96);
            });

            it('should handle zero', () => {
                expect(HWPXConstants.ptToPx(0)).toBe(0);
            });

            it('should handle negative values', () => {
                expect(HWPXConstants.ptToPx(-10)).toBeCloseTo(-13.33, 2);
            });
        });

        describe('hwpuToPx', () => {
            it('should convert 7200 HWPU to 117.12px (with scale factor)', () => {
                expect(HWPXConstants.hwpuToPx(7200)).toBe(117.12);
            });

            it('should convert 3600 HWPU to 58.56px (with scale factor)', () => {
                expect(HWPXConstants.hwpuToPx(3600)).toBe(58.56);
            });

            it('should handle zero', () => {
                expect(HWPXConstants.hwpuToPx(0)).toBe(0);
            });
        });

        describe('mmToPx', () => {
            it('should convert 210mm to approximately 794px (A4 width)', () => {
                expect(HWPXConstants.mmToPx(210)).toBeCloseTo(794, 0);
            });

            it('should convert 297mm to approximately 1123px (A4 height)', () => {
                expect(HWPXConstants.mmToPx(297)).toBeCloseTo(1123, 0);
            });

            it('should convert 25.4mm to 96px (1 inch)', () => {
                expect(HWPXConstants.mmToPx(25.4)).toBeCloseTo(96, 0);
            });

            it('should handle zero', () => {
                expect(HWPXConstants.mmToPx(0)).toBe(0);
            });
        });

        describe('pxToPt', () => {
            it('should convert 96px to 72pt', () => {
                expect(HWPXConstants.pxToPt(96)).toBe(72);
            });

            it('should convert 13.33px to approximately 10pt', () => {
                expect(HWPXConstants.pxToPt(13.33)).toBeCloseTo(10, 0);
            });

            it('should handle zero', () => {
                expect(HWPXConstants.pxToPt(0)).toBe(0);
            });
        });

        describe('inchToPx', () => {
            it('should convert 1 inch to 96px', () => {
                expect(HWPXConstants.inchToPx(1)).toBe(96);
            });

            it('should convert 2 inches to 192px', () => {
                expect(HWPXConstants.inchToPx(2)).toBe(192);
            });

            it('should handle zero', () => {
                expect(HWPXConstants.inchToPx(0)).toBe(0);
            });
        });

        describe('pxToInch', () => {
            it('should convert 96px to 1 inch', () => {
                expect(HWPXConstants.pxToInch(96)).toBe(1);
            });

            it('should convert 192px to 2 inches', () => {
                expect(HWPXConstants.pxToInch(192)).toBe(2);
            });

            it('should handle zero', () => {
                expect(HWPXConstants.pxToInch(0)).toBe(0);
            });
        });
    });

    describe('Conversion Round-trip', () => {
        it('ptToPx <-> pxToPt should be reversible', () => {
            const pt = 10;
            const px = HWPXConstants.ptToPx(pt);
            const ptBack = HWPXConstants.pxToPt(px);
            expect(ptBack).toBeCloseTo(pt, 2);
        });

        it('inchToPx <-> pxToInch should be reversible', () => {
            const inch = 5;
            const px = HWPXConstants.inchToPx(inch);
            const inchBack = HWPXConstants.pxToInch(px);
            expect(inchBack).toBeCloseTo(inch, 2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large values', () => {
            const largePt = 1000000;
            const largePx = HWPXConstants.ptToPx(largePt);
            expect(largePx).toBeGreaterThan(0);
            expect(isFinite(largePx)).toBe(true);
        });

        it('should handle very small values', () => {
            const smallPt = 0.001;
            const smallPx = HWPXConstants.ptToPx(smallPt);
            expect(smallPx).toBeGreaterThan(0);
            expect(isFinite(smallPx)).toBe(true);
        });

        it('should handle decimal values', () => {
            const decimalPt = 10.5;
            const decimalPx = HWPXConstants.ptToPx(decimalPt);
            expect(decimalPx).toBeCloseTo(14, 0);
        });
    });
});

