/**
 * HWPX 파서 통합 테스트
 * 실제 파서를 사용하여 샘플 파일 파싱
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Vanilla JS 파서 import
import { SimpleHWPXParser } from './src/lib/vanilla/core/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testParser() {
    console.log('🧪 HWPX 파서 통합 테스트\n');

    try {
        // 1. 파일 읽기
        const filePath = join(__dirname, 'public', '놀이아이디어(월안-출력값 포함).hwpx');
        console.log('📁 파일:', filePath);

        const buffer = await readFile(filePath);
        console.log('✅ 파일 읽기:', buffer.length, 'bytes\n');

        // 2. 파서 생성
        const parser = new SimpleHWPXParser({
            parseImages: true,
            parseTables: true,
            parseStyles: true
        });
        console.log('✅ 파서 생성 완료\n');

        // 3. 파싱 실행
        console.log('⏳ 파싱 중...');
        const startTime = Date.now();

        const document = await parser.parse(buffer);

        const parseTime = Date.now() - startTime;
        console.log(`✅ 파싱 완료! (${parseTime}ms)\n`);

        // 4. 결과 분석
        console.log('📊 파싱 결과:');
        console.log('  - 섹션:', document.sections?.length || 0, '개');
        console.log('  - 이미지:', document.images?.size || 0, '개');
        console.log('  - 원본 ZIP:', document.rawZip ? '✅' : '❌');
        console.log('  - 메타데이터:', document.metadata ? '✅' : '❌');

        if (document.sections && document.sections.length > 0) {
            const firstSection = document.sections[0];
            console.log('\n📄 첫 번째 섹션:');
            console.log('  - 요소:', firstSection.elements?.length || 0, '개');

            if (firstSection.elements && firstSection.elements.length > 0) {
                // 요소 타입별 카운트
                const elementTypes = {};
                firstSection.elements.forEach(el => {
                    elementTypes[el.type] = (elementTypes[el.type] || 0) + 1;
                });

                console.log('\n  요소 타입별 분포:');
                Object.entries(elementTypes).forEach(([type, count]) => {
                    console.log(`    - ${type}: ${count}개`);
                });

                // 첫 5개 요소 미리보기
                console.log('\n  첫 5개 요소:');
                firstSection.elements.slice(0, 5).forEach((el, i) => {
                    const preview = JSON.stringify(el).substring(0, 100);
                    console.log(`    ${i + 1}. ${el.type}: ${preview}...`);
                });
            }
        }

        if (document.images && document.images.size > 0) {
            console.log('\n🖼️ 이미지 목록:');
            document.images.forEach((value, key) => {
                console.log(`  - ${key}: ${value.length || 0} bytes`);
            });
        }

        console.log('\n✨ 테스트 완료!');
        console.log('\n💡 이제 브라우저에서 테스트해보세요:');
        console.log('   http://localhost:5090/');

    } catch (error) {
        console.error('\n❌ 에러 발생:');
        console.error('  메시지:', error.message);
        console.error('  스택:', error.stack);
    }
}

testParser();
