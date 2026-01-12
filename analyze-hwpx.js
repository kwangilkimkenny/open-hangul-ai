/**
 * HWPX 파일 상세 분석 스크립트
 */

import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function analyzeHWPXFile() {
    console.log('🔬 HWPX 파일 상세 분석\n');

    try {
        const filePath = join(__dirname, 'public', '놀이아이디어(월안-출력값 포함).hwpx');
        const buffer = await readFile(filePath);
        const zip = await JSZip.loadAsync(buffer);

        // 1. version.xml
        const versionFile = zip.file('version.xml');
        if (versionFile) {
            const version = await versionFile.async('string');
            console.log('📋 version.xml:');
            console.log(version.substring(0, 300) + '...\n');
        }

        // 2. section0.xml
        const sectionFile = zip.file('Contents/section0.xml');
        if (sectionFile) {
            const section = await sectionFile.async('string');
            console.log('📄 section0.xml:');
            console.log('  파일 크기:', section.length, 'chars');

            // 주요 태그 카운트
            const paragraphCount = (section.match(/<p /g) || []).length;
            const tableCount = (section.match(/<tbl /g) || []).length;
            const textCount = (section.match(/<t>/g) || []).length;

            console.log('  - 단락(p):', paragraphCount, '개');
            console.log('  - 표(tbl):', tableCount, '개');
            console.log('  - 텍스트(t):', textCount, '개');

            // 첫 100줄 미리보기
            const lines = section.split('\n').slice(0, 20);
            console.log('\n  첫 20줄 미리보기:');
            lines.forEach((line, i) => {
                if (line.trim()) {
                    console.log(`    ${i + 1}: ${line.trim().substring(0, 100)}`);
                }
            });
        }

        // 3. settings.xml
        const settingsFile = zip.file('settings.xml');
        if (settingsFile) {
            const settings = await settingsFile.async('string');
            console.log('\n⚙️ settings.xml:');
            console.log('  파일 크기:', settings.length, 'chars');
        }

        // 4. 이미지 파일들
        console.log('\n🖼️ 이미지 파일:');
        const images = Object.keys(zip.files).filter(f => f.startsWith('BinData/'));
        images.forEach(img => {
            const file = zip.files[img];
            console.log(`  - ${img} (${file._data.uncompressedSize} bytes)`);
        });

        console.log('\n✅ 분석 완료!');

    } catch (error) {
        console.error('❌ 에러:', error.message);
    }
}

analyzeHWPXFile();
