/**
 * Structure Extractor Tests
 * 
 * @module ai/structure-extractor.test
 */

import { strict as assert } from 'assert';
import { DocumentStructureExtractor, extractDocumentStructure } from './structure-extractor.js';

// Mock 문서 데이터
const SIMPLE_PARAGRAPH_DOC = {
    sections: [{
        pageSettings: { width: '794px', height: '1123px' },
        elements: [{
            type: 'paragraph',
            runs: [
                { text: 'Hello World', style: { fontSize: '12pt' } },
                { text: ' This is a test.', style: { fontSize: '12pt' } }
            ],
            style: { textAlign: 'left' }
        }]
    }],
    images: new Map(),
    metadata: { parsedAt: '2024-11-23T00:00:00Z' }
};

const TABLE_DOCUMENT = {
    sections: [{
        pageSettings: { width: '794px', height: '1123px' },
        elements: [{
            type: 'table',
            rows: [
                {
                    cells: [
                        {
                            elements: [{
                                type: 'paragraph',
                                runs: [{ text: 'Cell A1' }]
                            }]
                        },
                        {
                            elements: [{
                                type: 'paragraph',
                                runs: [{ text: 'Cell B1' }]
                            }]
                        }
                    ]
                },
                {
                    cells: [
                        {
                            elements: [{
                                type: 'paragraph',
                                runs: [{ text: 'Cell A2' }]
                            }]
                        },
                        {
                            elements: [{
                                type: 'paragraph',
                                runs: [{ text: 'Cell B2' }]
                            }]
                        }
                    ]
                }
            ],
            colWidths: ['50%', '50%']
        }]
    }],
    images: new Map(),
    metadata: { parsedAt: '2024-11-23T00:00:00Z' }
};

const MIXED_DOCUMENT = {
    sections: [{
        pageSettings: { width: '794px', height: '1123px' },
        elements: [
            {
                type: 'paragraph',
                runs: [{ text: 'Introduction paragraph' }],
                style: { textAlign: 'left' }
            },
            {
                type: 'table',
                rows: [{
                    cells: [{
                        elements: [{
                            type: 'paragraph',
                            runs: [{ text: 'Table cell text' }]
                        }]
                    }]
                }],
                colWidths: ['100%']
            },
            {
                type: 'paragraph',
                runs: [{ text: 'Conclusion paragraph' }],
                style: { textAlign: 'left' }
            }
        ]
    }],
    images: new Map(),
    metadata: { parsedAt: '2024-11-23T00:00:00Z' }
};

/**
 * 테스트 실행
 */
async function runTests() {
    console.log('🧪 Running Structure Extractor Tests...\n');
    
    let passed = 0;
    let failed = 0;
    
    // Test 1: 기본 인스턴스 생성
    try {
        const extractor = new DocumentStructureExtractor();
        assert(extractor !== null, 'Extractor should be created');
        console.log('✅ Test 1: 인스턴스 생성');
        passed++;
    } catch (error) {
        console.error('❌ Test 1 Failed:', error.message);
        failed++;
    }
    
    // Test 2: 단순 단락 문서 추출
    try {
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(SIMPLE_PARAGRAPH_DOC);
        
        assert(result.structure !== null, 'Structure should exist');
        assert(result.textSlots.size === 2, `Expected 2 text slots, got ${result.textSlots.size}`);
        assert(result.structure.sections.length === 1, 'Should have 1 section');
        assert(result.metadata.totalSlots === 2, 'Metadata should show 2 slots');
        
        console.log('✅ Test 2: 단순 단락 문서 추출');
        console.log(`   - Text slots: ${result.textSlots.size}`);
        console.log(`   - Sections: ${result.structure.sections.length}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 2 Failed:', error.message);
        failed++;
    }
    
    // Test 3: 표 문서 추출
    try {
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(TABLE_DOCUMENT);
        
        assert(result.textSlots.size === 4, `Expected 4 text slots (2x2 table), got ${result.textSlots.size}`);
        assert(result.structure.sections[0].elements[0].type === 'table', 'First element should be table');
        assert(result.structure.sections[0].elements[0].rows.length === 2, 'Table should have 2 rows');
        
        console.log('✅ Test 3: 표 문서 추출');
        console.log(`   - Text slots: ${result.textSlots.size}`);
        console.log(`   - Table rows: ${result.structure.sections[0].elements[0].rows.length}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 3 Failed:', error.message);
        failed++;
    }
    
    // Test 4: 혼합 문서 추출
    try {
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(MIXED_DOCUMENT);
        
        assert(result.textSlots.size === 3, `Expected 3 text slots, got ${result.textSlots.size}`);
        assert(result.structure.sections[0].elements.length === 3, 'Should have 3 elements');
        
        // 요소 타입 확인
        const elements = result.structure.sections[0].elements;
        assert(elements[0].type === 'paragraph', 'First element should be paragraph');
        assert(elements[1].type === 'table', 'Second element should be table');
        assert(elements[2].type === 'paragraph', 'Third element should be paragraph');
        
        console.log('✅ Test 4: 혼합 문서 추출');
        console.log(`   - Text slots: ${result.textSlots.size}`);
        console.log(`   - Elements: ${result.structure.sections[0].elements.length}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 4 Failed:', error.message);
        failed++;
    }
    
    // Test 5: 텍스트 슬롯 구조 검증
    try {
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(SIMPLE_PARAGRAPH_DOC);
        
        // 첫 번째 슬롯 확인
        const firstSlot = Array.from(result.textSlots.values())[0];
        assert(firstSlot.text !== undefined, 'Slot should have text');
        assert(firstSlot.path !== undefined, 'Slot should have path');
        assert(firstSlot.context !== undefined, 'Slot should have context');
        assert(firstSlot.path.section === 0, 'Path should have section index');
        assert(firstSlot.path.element === 0, 'Path should have element index');
        assert(firstSlot.path.run !== undefined, 'Path should have run index');
        
        console.log('✅ Test 5: 텍스트 슬롯 구조 검증');
        console.log(`   - First slot text: "${firstSlot.text}"`);
        console.log(`   - First slot path: section=${firstSlot.path.section}, element=${firstSlot.path.element}, run=${firstSlot.path.run}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 5 Failed:', error.message);
        failed++;
    }
    
    // Test 6: 슬롯 ID 고유성
    try {
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(MIXED_DOCUMENT);
        
        const slotIds = Array.from(result.textSlots.keys());
        const uniqueIds = new Set(slotIds);
        
        assert(slotIds.length === uniqueIds.size, 'All slot IDs should be unique');
        
        console.log('✅ Test 6: 슬롯 ID 고유성');
        console.log(`   - Total slots: ${slotIds.length}`);
        console.log(`   - Unique IDs: ${uniqueIds.size}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 6 Failed:', error.message);
        failed++;
    }
    
    // Test 7: 캐시 기능
    try {
        const extractor = new DocumentStructureExtractor({ useCache: true });
        
        // 첫 번째 추출
        const result1 = extractor.extractStructure(SIMPLE_PARAGRAPH_DOC);
        
        // 두 번째 추출 (캐시 사용)
        const result2 = extractor.extractStructure(SIMPLE_PARAGRAPH_DOC);
        
        // 동일한 결과 확인
        assert(result1.textSlots.size === result2.textSlots.size, 'Cached result should be identical');
        
        // 캐시 확인
        const stats = extractor.getStatistics();
        assert(stats.cacheSize > 0, 'Cache should have entries');
        
        console.log('✅ Test 7: 캐시 기능');
        console.log(`   - Cache size: ${stats.cacheSize}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 7 Failed:', error.message);
        failed++;
    }
    
    // Test 8: 구조 검증
    try {
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(SIMPLE_PARAGRAPH_DOC);
        
        const validation = extractor.validateStructure(result.structure);
        assert(validation.isValid === true, 'Structure should be valid');
        assert(validation.errors.length === 0, 'Should have no errors');
        
        console.log('✅ Test 8: 구조 검증');
        console.log(`   - Valid: ${validation.isValid}`);
        console.log(`   - Errors: ${validation.errors.length}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 8 Failed:', error.message);
        failed++;
    }
    
    // Test 9: 빈 텍스트 필터링
    try {
        const docWithEmptyText = {
            sections: [{
                pageSettings: { width: '794px', height: '1123px' },
                elements: [{
                    type: 'paragraph',
                    runs: [
                        { text: '' }, // 빈 문자열
                        { text: '   ' }, // 공백만
                        { text: 'Valid text' }
                    ]
                }]
            }],
            images: new Map(),
            metadata: { parsedAt: '2024-11-23T00:00:00Z' }
        };
        
        const extractor = new DocumentStructureExtractor({ minTextLength: 1 });
        const result = extractor.extractStructure(docWithEmptyText);
        
        // 빈 텍스트와 공백만 있는 텍스트는 필터링되어야 함
        assert(result.textSlots.size === 1, `Expected 1 text slot (empty filtered), got ${result.textSlots.size}`);
        
        console.log('✅ Test 9: 빈 텍스트 필터링');
        console.log(`   - Text slots (after filtering): ${result.textSlots.size}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 9 Failed:', error.message);
        failed++;
    }
    
    // Test 10: 간편 함수
    try {
        const result = extractDocumentStructure(SIMPLE_PARAGRAPH_DOC);
        
        assert(result !== null, 'Result should exist');
        assert(result.textSlots.size > 0, 'Should have text slots');
        
        console.log('✅ Test 10: 간편 함수');
        console.log(`   - Text slots: ${result.textSlots.size}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 10 Failed:', error.message);
        failed++;
    }
    
    // Test 11: 통계 정보
    try {
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(MIXED_DOCUMENT);
        
        const stats = extractor.getStatistics();
        assert(stats.totalSlots > 0, 'Should have total slots');
        assert(stats.paragraphSlots > 0, 'Should have paragraph slots');
        
        console.log('✅ Test 11: 통계 정보');
        console.log(`   - Total slots: ${stats.totalSlots}`);
        console.log(`   - Paragraph slots: ${stats.paragraphSlots}`);
        console.log(`   - Table slots: ${stats.tableSlots}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 11 Failed:', error.message);
        failed++;
    }
    
    // Test 12: 중첩 표 처리
    try {
        const nestedTableDoc = {
            sections: [{
                pageSettings: { width: '794px', height: '1123px' },
                elements: [{
                    type: 'table',
                    rows: [{
                        cells: [{
                            elements: [
                                {
                                    type: 'paragraph',
                                    runs: [{ text: 'Outer cell' }]
                                },
                                {
                                    type: 'table',
                                    rows: [{
                                        cells: [{
                                            elements: [{
                                                type: 'paragraph',
                                                runs: [{ text: 'Inner cell' }]
                                            }]
                                        }]
                                    }]
                                }
                            ]
                        }]
                    }],
                    colWidths: ['100%']
                }]
            }],
            images: new Map(),
            metadata: { parsedAt: '2024-11-23T00:00:00Z' }
        };
        
        const extractor = new DocumentStructureExtractor();
        const result = extractor.extractStructure(nestedTableDoc);
        
        assert(result.textSlots.size === 2, `Expected 2 text slots (nested table), got ${result.textSlots.size}`);
        
        console.log('✅ Test 12: 중첩 표 처리');
        console.log(`   - Text slots: ${result.textSlots.size}`);
        passed++;
    } catch (error) {
        console.error('❌ Test 12 Failed:', error.message);
        failed++;
    }
    
    // 결과 요약
    console.log('\n📊 Test Results:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📝 Total: ${passed + failed}`);
    console.log(`   🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
    
    // 종료 코드
    process.exit(failed > 0 ? 1 : 0);
}

// 테스트 실행
runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});

