/**
 * Header-Based Replacer 단위 테스트
 * @version 1.0.0
 */

import { HeaderBasedReplacer } from './header-based-replacer.js';

// 테스트용 간단한 XML 문서 생성
function createTestXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section">
    <hp:p>
        <hp:run><hp:t>일일 놀이계획안</hp:t></hp:run>
    </hp:p>
    <hp:p>
        <hp:run>
            <hp:tbl>
                <hp:tr>
                    <hp:tc>
                        <hp:subList>
                            <hp:p><hp:run><hp:t>놀이명</hp:t></hp:run></hp:p>
                        </hp:subList>
                    </hp:tc>
                    <hp:tc>
                        <hp:subList>
                            <hp:p><hp:run><hp:t>비행기 타고 세계여행 떠나요</hp:t></hp:run></hp:p>
                        </hp:subList>
                    </hp:tc>
                </hp:tr>
                <hp:tr>
                    <hp:tc>
                        <hp:subList>
                            <hp:p><hp:run><hp:t>놀이속배움</hp:t></hp:run></hp:p>
                        </hp:subList>
                    </hp:tc>
                    <hp:tc>
                        <hp:subList>
                            <hp:p><hp:run><hp:t>1. 비행기 역할 놀이를 통해...</hp:t></hp:run></hp:p>
                            <hp:p><hp:run><hp:t>2. 비행기 조종 및...</hp:t></hp:run></hp:p>
                        </hp:subList>
                    </hp:tc>
                </hp:tr>
            </hp:tbl>
        </hp:run>
    </hp:p>
</hs:sec>`;
}

// 테스트 실행 함수
function runTests() {
    console.log('🧪 HeaderBasedReplacer 단위 테스트 시작...\n');
    
    const replacer = new HeaderBasedReplacer();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(createTestXml(), 'text/xml');
    
    // 테스트 1: 테이블 셀 추출
    console.log('📋 테스트 1: 테이블 셀 추출');
    const cells = replacer.extractTableCells(xmlDoc);
    console.log(`✅ ${cells.length}개 셀 추출`);
    console.assert(cells.length === 4, `❌ 예상: 4개, 실제: ${cells.length}개`);
    
    // 테스트 2: 헤더 셀 판별
    console.log('\n📋 테스트 2: 헤더 셀 판별');
    const headerCells = cells.filter(cell => cell.isHeader);
    console.log(`✅ ${headerCells.length}개 헤더 셀 발견`);
    console.assert(headerCells.length === 2, `❌ 예상: 2개, 실제: ${headerCells.length}개`);
    
    if (headerCells.length > 0) {
        console.log(`   - 헤더 1: "${headerCells[0].text}"`);
        console.log(`   - 헤더 2: "${headerCells[1].text}"`);
        console.assert(headerCells[0].text === '놀이명', `❌ 예상: "놀이명", 실제: "${headerCells[0].text}"`);
        console.assert(headerCells[1].text === '놀이속배움', `❌ 예상: "놀이속배움", 실제: "${headerCells[1].text}"`);
    }
    
    // 테스트 3: 헤더-섹션 쌍 생성
    console.log('\n📋 테스트 3: 헤더-섹션 쌍 생성');
    const pairs = replacer.createHeaderSectionPairs(cells);
    console.log(`✅ ${pairs.length}개 헤더-섹션 쌍 생성`);
    console.assert(pairs.length === 2, `❌ 예상: 2개, 실제: ${pairs.length}개`);
    
    if (pairs.length > 0) {
        console.log(`   - 쌍 1: "${pairs[0].header}" → "${pairs[0].originalContent.substring(0, 30)}..."`);
        console.log(`   - 쌍 2: "${pairs[1].header}" → "${pairs[1].originalContent.substring(0, 30)}..."`);
    }
    
    // 테스트 4: 섹션 내용 교체
    console.log('\n📋 테스트 4: 섹션 내용 교체');
    const testPair = pairs[0];
    const newContent = '자전거 타고 세계여행 떠나요';
    const success = replacer.replaceSectionContent(xmlDoc, testPair, newContent);
    console.assert(success === true, '❌ 섹션 교체 실패');
    
    // 교체 후 확인
    const serializer = new XMLSerializer();
    const modifiedXml = serializer.serializeToString(xmlDoc);
    const hasNewContent = modifiedXml.includes(newContent);
    console.assert(hasNewContent, `❌ 새 내용이 XML에 반영되지 않음`);
    console.log(`✅ 섹션 교체 성공: "${newContent}"`);
    
    // 테스트 5: 여러 줄 내용 교체
    console.log('\n📋 테스트 5: 여러 줄 내용 교체');
    const testPair2 = pairs[1];
    const multiLineContent = '1. 자전거를 타며 세계 여러 나라를 여행\n2. 협동심 및 문제 해결 능력 발달\n3. 창의적인 표현 능력 향상';
    const success2 = replacer.replaceSectionContent(xmlDoc, testPair2, multiLineContent);
    console.assert(success2 === true, '❌ 여러 줄 섹션 교체 실패');
    
    // 교체 후 단락 수 확인
    const modifiedSubList = testPair2.contentCell.subList;
    const paragraphs = modifiedSubList.getElementsByTagNameNS(replacer.hpNamespace, 'p');
    const expectedParagraphCount = 3; // 3개 줄
    console.assert(paragraphs.length === expectedParagraphCount, `❌ 예상: ${expectedParagraphCount}개 단락, 실제: ${paragraphs.length}개`);
    console.log(`✅ 여러 줄 교체 성공: ${paragraphs.length}개 단락 생성`);
    
    // 최종 XML 출력 (디버그)
    console.log('\n📄 최종 XML (처음 1000자):');
    const finalXml = serializer.serializeToString(xmlDoc);
    console.log(finalXml.substring(0, 1000) + '...');
    
    console.log('\n✅ 모든 테스트 통과!');
    return true;
}

// 브라우저 환경에서 테스트 실행
if (typeof window !== 'undefined') {
    // 전역 테스트 함수 등록
    window.testHeaderBasedReplacer = runTests;
    console.log('💡 브라우저 콘솔에서 window.testHeaderBasedReplacer()를 실행하세요!');
}

export { runTests };

