/**
 * section0.xml 내용 추출
 */

import JSZip from 'jszip';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function extractSection() {
    try {
        const filePath = join(__dirname, 'public', '놀이아이디어(월안-출력값 포함).hwpx');
        const buffer = await readFile(filePath);
        const zip = await JSZip.loadAsync(buffer);

        const sectionFile = zip.file('Contents/section0.xml');
        if (sectionFile) {
            const content = await sectionFile.async('string');

            // 파일로 저장
            await writeFile('section0-extracted.xml', content, 'utf8');
            console.log('✅ section0.xml 추출 완료!');
            console.log('📁 파일: section0-extracted.xml');
            console.log('📊 크기:', content.length, 'chars');

            // 첫 1000자 출력
            console.log('\n📄 내용 미리보기 (첫 1000자):');
            console.log(content.substring(0, 1000));
            console.log('...\n');

            // 주요 태그 찾기
            console.log('🔍 태그 분석:');
            const tags = [
                'hp:p', 'hp:t', 'hp:tbl', 'hp:tr', 'hp:tc',
                'hh:run', 'hh:p', 'hh:t', 'hh:tbl',
                ':p>', ':t>', ':tbl>', ':tr>', ':tc>'
            ];

            tags.forEach(tag => {
                const count = (content.match(new RegExp(`<${tag.replace(':', '\\:')}`, 'g')) || []).length;
                if (count > 0) {
                    console.log(`  ${tag}: ${count}개`);
                }
            });
        }
    } catch (error) {
        console.error('❌ 에러:', error.message);
    }
}

extractSection();
