/**
 * HWP → HWPX 변환 E2E 테스트
 *
 * 실제 HWP/HWPX 파일을 사용하여 변환 로직을 통합 검증합니다.
 */

import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { Hwp2Hwpx } from '../Hwp2Hwpx';
import { Hwpx2Hwp } from '../Hwpx2Hwp';

// 테스트 샘플 파일 경로
const DOCS_DIR = path.resolve(__dirname, '../../../../../../docs');
const SAMPLE_DIR = path.join(DOCS_DIR, '할수있다한글2020_예제파일');
const SAMPLE_DIR2 = path.join(DOCS_DIR, '한글hwp_hwpx샘플파일');

// 사용 가능한 샘플 파일을 동적으로 탐색
function findSampleFiles(ext: string, maxCount = 5): string[] {
    const files: string[] = [];

    function walk(dir: string) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (files.length >= maxCount) return;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.name.endsWith(ext) && !entry.name.startsWith('.')) {
                files.push(fullPath);
            }
        }
    }

    walk(SAMPLE_DIR);
    walk(SAMPLE_DIR2);
    // 최상위 docs에서도 탐색
    if (files.length < maxCount && fs.existsSync(DOCS_DIR)) {
        for (const entry of fs.readdirSync(DOCS_DIR, { withFileTypes: true })) {
            if (files.length >= maxCount) break;
            if (!entry.isDirectory() && entry.name.endsWith(ext) && !entry.name.startsWith('.')) {
                files.push(path.join(DOCS_DIR, entry.name));
            }
        }
    }

    return files;
}

const hwpFiles = findSampleFiles('.hwp', 5);
const hwpxFiles = findSampleFiles('.hwpx', 5);

describe('Hwp2Hwpx E2E', () => {
    // HWP 파일이 없으면 건너뛰기
    const describeWithHwp = hwpFiles.length > 0 ? describe : describe.skip;

    describeWithHwp('HWP → HWPX 변환', () => {
        it.each(hwpFiles.map(f => [path.basename(f), f]))(
            '%s 파일을 HWPX로 변환한다',
            async (_name, filePath) => {
                const data = new Uint8Array(fs.readFileSync(filePath));

                const hwpxData = await Hwp2Hwpx.convert(data);

                // 기본 검증: 유효한 ZIP 파일인지
                expect(hwpxData).toBeInstanceOf(Uint8Array);
                expect(hwpxData.length).toBeGreaterThan(0);

                // ZIP 내부 구조 검증
                const zip = await JSZip.loadAsync(hwpxData);
                const fileNames = Object.keys(zip.files);

                // HWPX 필수 파일 존재 확인
                expect(fileNames).toContain('mimetype');
                expect(fileNames.some(f => f.includes('header.xml'))).toBe(true);
                expect(fileNames.some(f => f.includes('section0.xml'))).toBe(true);
                expect(fileNames.some(f => f.includes('version.xml'))).toBe(true);

                // mimetype 확인
                const mimetype = await zip.file('mimetype')?.async('text');
                expect(mimetype).toBe('application/hwp+zip');

                // header.xml이 유효한 XML인지
                const headerXml = await zip.file('Contents/header.xml')?.async('text');
                expect(headerXml).toBeTruthy();
                expect(headerXml).toContain('<?xml');

                // section0.xml이 유효한 XML인지
                const sectionXml = await zip.file('Contents/section0.xml')?.async('text');
                expect(sectionXml).toBeTruthy();
                expect(sectionXml).toContain('<?xml');
            },
            30000  // 30초 타임아웃
        );
    });

    describeWithHwp('HWP → HWPX 변환 옵션', () => {
        const firstHwp = hwpFiles[0];
        if (!firstHwp) return;

        it('진행률 콜백이 호출된다', async () => {
            const data = new Uint8Array(fs.readFileSync(firstHwp));
            const stages: string[] = [];

            await Hwp2Hwpx.convert(data, {
                onProgress: (progress) => {
                    stages.push(progress.stage);
                }
            });

            expect(stages.length).toBeGreaterThan(0);
            expect(stages).toContain('parsing');
        });

        it('AbortSignal로 변환을 취소할 수 있다', async () => {
            const data = new Uint8Array(fs.readFileSync(firstHwp));
            const controller = new AbortController();

            // 즉시 취소
            controller.abort();

            await expect(
                Hwp2Hwpx.convert(data, { signal: controller.signal })
            ).rejects.toThrow();
        });
    });
});

describe('Hwpx2Hwp E2E', () => {
    const describeWithHwpx = hwpxFiles.length > 0 ? describe : describe.skip;

    describeWithHwpx('HWPX → HWP 변환', () => {
        it.each(hwpxFiles.map(f => [path.basename(f), f]))(
            '%s 파일을 HWP로 변환한다',
            async (_name, filePath) => {
                const data = new Uint8Array(fs.readFileSync(filePath));

                const result = await Hwpx2Hwp.convert(data);

                // 기본 검증
                expect(result.data).toBeInstanceOf(Uint8Array);
                expect(result.data.length).toBeGreaterThan(0);

                // 통계 검증
                expect(result.stats.inputSize).toBe(data.length);
                expect(result.stats.outputSize).toBeGreaterThan(0);
                expect(result.stats.sectionCount).toBeGreaterThanOrEqual(1);
                expect(result.stats.elapsedMs).toBeGreaterThanOrEqual(0);

                // HWP 시그니처 검증 (OLE Compound Document)
                // OLE magic: D0 CF 11 E0
                expect(result.data[0]).toBe(0xD0);
                expect(result.data[1]).toBe(0xCF);
                expect(result.data[2]).toBe(0x11);
                expect(result.data[3]).toBe(0xE0);
            },
            30000
        );
    });
});

describe('라운드트립 변환', () => {
    const describeWithHwp = hwpFiles.length > 0 ? describe : describe.skip;

    describeWithHwp('HWP → HWPX → HWP 라운드트립', () => {
        it('변환 후 다시 HWP로 역변환할 수 있다', async () => {
            const firstHwp = hwpFiles[0];
            if (!firstHwp) return;

            const originalData = new Uint8Array(fs.readFileSync(firstHwp));

            // HWP → HWPX
            const hwpxData = await Hwp2Hwpx.convert(originalData);
            expect(hwpxData.length).toBeGreaterThan(0);

            // HWPX → HWP
            const result = await Hwpx2Hwp.convert(hwpxData);
            expect(result.data.length).toBeGreaterThan(0);

            // OLE 시그니처 확인
            expect(result.data[0]).toBe(0xD0);
            expect(result.data[1]).toBe(0xCF);
        }, 60000);
    });

    const describeWithHwpx = hwpxFiles.length > 0 ? describe : describe.skip;

    describeWithHwpx('HWPX → HWP → HWPX 라운드트립', () => {
        it('변환 후 다시 HWPX로 변환할 수 있다', async () => {
            const firstHwpx = hwpxFiles[0];
            if (!firstHwpx) return;

            const originalData = new Uint8Array(fs.readFileSync(firstHwpx));

            // HWPX → HWP
            const hwpResult = await Hwpx2Hwp.convert(originalData);
            expect(hwpResult.data.length).toBeGreaterThan(0);

            // HWP → HWPX
            const hwpxData = await Hwp2Hwpx.convert(hwpResult.data);
            expect(hwpxData.length).toBeGreaterThan(0);

            // 유효한 HWPX ZIP인지 확인
            const zip = await JSZip.loadAsync(hwpxData);
            const mimetype = await zip.file('mimetype')?.async('text');
            expect(mimetype).toBe('application/hwp+zip');
        }, 60000);
    });
});
