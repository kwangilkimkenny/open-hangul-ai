/**
 * HWPX 파일 테스트 스크립트
 * 샘플 파일의 구조를 확인합니다
 */

import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testHWPXFile() {
    console.log('🧪 HWPX 파일 테스트 시작\n');

    try {
        // 1. 파일 읽기
        const filePath = join(__dirname, 'public', '놀이아이디어(월안-출력값 포함).hwpx');
        console.log('📁 파일 경로:', filePath);

        const buffer = await readFile(filePath);
        console.log('✅ 파일 읽기 성공:', buffer.length, 'bytes\n');

        // 2. ZIP 압축 해제
        const zip = await JSZip.loadAsync(buffer);
        console.log('📦 ZIP 파일 내용:');

        const files = Object.keys(zip.files);
        files.forEach(file => {
            const fileObj = zip.files[file];
            if (!fileObj.dir) {
                console.log(`  - ${file}`);
            }
        });
        console.log(`\n총 ${files.filter(f => !zip.files[f].dir).length}개 파일\n`);

        // 3. 주요 파일 확인
        console.log('🔍 주요 파일 확인:');

        const contentFile = zip.file('Contents/content.xml');
        if (contentFile) {
            const content = await contentFile.async('string');
            console.log('  ✅ content.xml 발견 (' + content.length + ' chars)');

            // XML 파싱 확인
            if (content.includes('<document>')) {
                console.log('  ✅ <document> 태그 확인');
            }
            if (content.includes('<section>')) {
                const sectionCount = (content.match(/<section/g) || []).length;
                console.log(`  ✅ <section> 태그 ${sectionCount}개 발견`);
            }
            if (content.includes('<table>')) {
                const tableCount = (content.match(/<table/g) || []).length;
                console.log(`  ✅ <table> 태그 ${tableCount}개 발견`);
            }
        } else {
            console.log('  ❌ content.xml 없음');
        }

        const settingsFile = zip.file('Contents/settings.xml');
        if (settingsFile) {
            console.log('  ✅ settings.xml 발견');
        }

        console.log('\n✨ 테스트 완료!');
        console.log('\n💡 브라우저에서 테스트하려면:');
        console.log('   1. http://localhost:5090/ 접속');
        console.log('   2. "파일 열기" 버튼 클릭');
        console.log('   3. public/놀이아이디어(월안-출력값 포함).hwpx 선택');

    } catch (error) {
        console.error('❌ 에러 발생:', error.message);
        console.error(error);
    }
}

testHWPXFile();
