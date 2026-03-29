/**
 * StreamingHwp2Hwpx 테스트
 */

import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { StreamingHwp2Hwpx, HwpxStreamingConverter } from '../StreamingHwp2Hwpx';
import type { StreamingProgress } from '../StreamingHwp2Hwpx';

const DOCS_DIR = path.resolve(__dirname, '../../../../../../docs');

function findFirstHwp(): string | null {
    const sampleDir = path.join(DOCS_DIR, '할수있다한글2020_예제파일');
    if (!fs.existsSync(sampleDir)) return null;

    for (const dir of fs.readdirSync(sampleDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const subDir = path.join(sampleDir, dir.name);
        for (const file of fs.readdirSync(subDir)) {
            if (file.endsWith('.hwp')) return path.join(subDir, file);
        }
    }
    return null;
}

const hwpFile = findFirstHwp();
const hasHwpFile = hwpFile !== null;

describe('StreamingHwp2Hwpx', () => {
    const describeWithFile = hasHwpFile ? describe : describe.skip;

    describeWithFile('convert', () => {
        it('스트리밍 모드로 HWP를 HWPX로 변환한다', async () => {
            const data = new Uint8Array(fs.readFileSync(hwpFile!));
            const result = await StreamingHwp2Hwpx.convert(data);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBeGreaterThan(0);

            const zip = await JSZip.loadAsync(result);
            const mimetype = await zip.file('mimetype')?.async('text');
            expect(mimetype).toBe('application/hwp+zip');
        }, 30000);

        it('스트리밍 진행률 콜백이 호출된다', async () => {
            const data = new Uint8Array(fs.readFileSync(hwpFile!));
            const progresses: StreamingProgress[] = [];

            await StreamingHwp2Hwpx.convert(data, {
                onStreamingProgress: (p) => progresses.push({ ...p })
            });

            expect(progresses.length).toBeGreaterThan(0);
            expect(progresses.some(p => p.stage === 'parsing')).toBe(true);
            expect(progresses.some(p => p.stage === 'sections')).toBe(true);
            expect(progresses.some(p => p.stage === 'complete')).toBe(true);
        }, 30000);
    });

    describeWithFile('convertWithRecovery', () => {
        it('복구 모드에서 변환이 성공한다', async () => {
            const data = new Uint8Array(fs.readFileSync(hwpFile!));
            const result = await StreamingHwp2Hwpx.convertWithRecovery(data);

            expect(result.success).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);
            expect(result.warnings).toHaveLength(0);
            expect(result.failedSections).toHaveLength(0);
        }, 30000);
    });

    describe('recommendConversionMethod', () => {
        it('작은 파일은 standard를 추천한다', () => {
            expect(StreamingHwp2Hwpx.recommendConversionMethod(1024 * 1024)).toBe('standard');
        });

        it('대용량 파일은 streaming을 추천한다', () => {
            expect(StreamingHwp2Hwpx.recommendConversionMethod(200 * 1024 * 1024)).toBe('streaming');
        });
    });
});

describe('HwpxStreamingConverter', () => {
    const describeWithFile = hasHwpFile ? describe : describe.skip;

    describeWithFile('청크 기반 변환', () => {
        it('청크를 모아서 변환을 수행한다', async () => {
            const data = new Uint8Array(fs.readFileSync(hwpFile!));
            const converter = new HwpxStreamingConverter();

            await converter.initialize();

            // 데이터를 청크로 나누어 처리
            const chunkSize = Math.ceil(data.length / 3);
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
                await converter.processChunk(chunk);
            }

            const result = await converter.finalize();
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBeGreaterThan(0);

            const zip = await JSZip.loadAsync(result);
            expect(zip.file('mimetype')).not.toBeNull();
        }, 30000);
    });
});
