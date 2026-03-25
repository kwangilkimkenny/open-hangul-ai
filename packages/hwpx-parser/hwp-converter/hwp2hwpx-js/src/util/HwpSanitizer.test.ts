/**
 * HwpSanitizer Unit Tests
 */

import { HwpSanitizer, type SanitizableHwpFile } from './HwpSanitizer';
import type { HWPControl, HWPPicture } from '../models/hwp.types';
import type { EnhancedSection, EnhancedParagraph } from '../adapters/IHwpParser';

/**
 * 테스트용 Picture 컨트롤 인터페이스
 */
interface TestPictureControl extends HWPControl {
    type: 'PICTURE';
    obj: HWPPicture;
}

describe('HwpSanitizer', () => {
    describe('fixProvisionalPictureReferences', () => {
        it('should not modify pictures that already have valid binDataIDRef', () => {
            const hwpFile = createMockHwpFile([
                { type: 'PICTURE', obj: { binDataIDRef: 1 } },
                { type: 'PICTURE', obj: { binDataIDRef: 2 } },
            ], 3);

            HwpSanitizer.fixProvisionalPictureReferences(hwpFile);

            const controls = hwpFile.sections[0].paragraphs[0].controls as TestPictureControl[];
            expect(controls[0].obj.binDataIDRef).toBe(1);
            expect(controls[1].obj.binDataIDRef).toBe(2);
        });

        it('should assign sequential IDs to pictures with binDataIDRef = 0', () => {
            const hwpFile = createMockHwpFile([
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
            ], 5);

            HwpSanitizer.fixProvisionalPictureReferences(hwpFile);

            const controls = hwpFile.sections[0].paragraphs[0].controls as TestPictureControl[];
            expect(controls[0].obj.binDataIDRef).toBe(1);
            expect(controls[1].obj.binDataIDRef).toBe(2);
            expect(controls[2].obj.binDataIDRef).toBe(3);
        });

        it('should handle mixed valid and invalid IDs', () => {
            const hwpFile = createMockHwpFile([
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
                { type: 'PICTURE', obj: { binDataIDRef: 5 } }, // Already valid
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
            ], 10);

            HwpSanitizer.fixProvisionalPictureReferences(hwpFile);

            const controls = hwpFile.sections[0].paragraphs[0].controls as TestPictureControl[];
            // First 0 -> 1
            expect(controls[0].obj.binDataIDRef).toBe(1);
            // Already valid, unchanged
            expect(controls[1].obj.binDataIDRef).toBe(5);
            // Second 0 -> 2
            expect(controls[2].obj.binDataIDRef).toBe(2);
        });

        it('should cycle IDs when pictures exceed binData count', () => {
            const hwpFile = createMockHwpFile([
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
            ], 2); // Only 2 BinData entries

            HwpSanitizer.fixProvisionalPictureReferences(hwpFile);

            const controls = hwpFile.sections[0].paragraphs[0].controls as TestPictureControl[];
            expect(controls[0].obj.binDataIDRef).toBe(1);
            expect(controls[1].obj.binDataIDRef).toBe(2);
            // Third one cycles back to 1 (image reuse assumption)
            expect(controls[2].obj.binDataIDRef).toBe(1);
        });

        it('should do nothing when binDataCount is 0', () => {
            const hwpFile = createMockHwpFile([
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
            ], 0);

            HwpSanitizer.fixProvisionalPictureReferences(hwpFile);

            const controls = hwpFile.sections[0].paragraphs[0].controls as TestPictureControl[];
            // Should remain 0, no BinData to reference
            expect(controls[0].obj.binDataIDRef).toBe(0);
        });

        it('should handle non-PICTURE controls without error', () => {
            const hwpFile = createMockHwpFile([
                { type: 'TABLE', obj: {} },
                { type: 'PICTURE', obj: { binDataIDRef: 0 } },
                { type: 'SHAPE', obj: {} },
            ], 2);

            expect(() => HwpSanitizer.fixProvisionalPictureReferences(hwpFile)).not.toThrow();
            const controls = hwpFile.sections[0].paragraphs[0].controls as TestPictureControl[];
            expect(controls[1].obj.binDataIDRef).toBe(1);
        });
    });
});

/**
 * Helper to create mock HWP file structure
 */
function createMockHwpFile(controls: HWPControl[], binDataCount: number): SanitizableHwpFile {
    const binDataMap = new Map<number, unknown>();
    for (let i = 1; i <= binDataCount; i++) {
        binDataMap.set(i, { id: i });
    }

    const mockParagraph: EnhancedParagraph = {
        text: '',
        runs: [],
        controls: controls,
        paraShapeID: 0,
        styleID: 0,
        charShapeID: 0
    };

    const mockSection: EnhancedSection = {
        index: 0,
        paragraphs: [mockParagraph]
    };

    return {
        docInfo: { binData: binDataMap },
        sections: [mockSection]
    };
}
