/* eslint-disable no-console */
/**
 * 브라우저 콘솔에서 직접 테스트할 수 있는 코드
 * 개발자 도구 콘솔에 복사해서 실행하세요
 */

/**
 * 콘솔 테스트 함수 1: 기본 테스트
 * 
 * 사용법: 콘솔에 복사해서 실행
 */
export const testHWPXUpdate = `
// ============================================
// HWPX 문서 업데이트 테스트
// ============================================

async function testHWPXUpdate() {
  const { HWPXDocumentHelper } = await import('./src/owpml/document/HWPXDocumentHelper');
  
  // 파일 경로 (실제 경로로 변경)
  const filePath = '파일경로.hwpx';
  
  console.log('🧪 [TEST] Starting HWPX update test...');
  console.log('📂 [TEST] File path:', filePath);
  
  const helper = new HWPXDocumentHelper();
  
  try {
    // 1. 파일 열기
    console.log('📂 [TEST] Step 1: Opening file...');
    const opened = await helper.openFile(filePath);
    if (!opened) {
      console.error('❌ [TEST] Failed to open file');
      return false;
    }
    console.log('✅ [TEST] File opened successfully');
    
    // 2. 현재 섹션 확인
    const sectionCount = helper.getSectionCount();
    console.log('📊 [TEST] Current sections:', sectionCount);
    
    // 3. 테스트 섹션 생성
    const testSectionXML = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>테스트 내용: 가을 여행 놀이 월간 기획서</t>
    </run>
  </p>
</section>\`;
    
    // 4. 섹션 업데이트
    console.log('📝 [TEST] Step 2: Updating section 0...');
    const sectionsMap = new Map();
    sectionsMap.set(0, testSectionXML);
    helper.updateSectionsXML(sectionsMap);
    console.log('✅ [TEST] Section updated in memory');
    
    // 5. 저장
    console.log('💾 [TEST] Step 3: Saving changes...');
    const saved = await helper.saveChanges();
    
    if (saved) {
      console.log('✅ [TEST] File saved successfully!');
      console.log('🔄 [TEST] Please reload the document viewer to see changes');
      return true;
    } else {
      console.error('❌ [TEST] Failed to save file');
      return false;
    }
  } catch (error) {
    console.error('❌ [TEST] Error:', error);
    return false;
  }
}

// 실행
testHWPXUpdate().then(result => {
  console.log('🏁 [TEST] Test completed:', result ? 'SUCCESS' : 'FAILED');
});
`;

/**
 * 콘솔 테스트 함수 2: AI 편집 결과 시뮬레이션
 */
export const testAIEditResult = `
// ============================================
// AI 편집 결과 시뮬레이션 테스트
// ============================================

async function testAIEditResult() {
  const { handleAIEditComplete } = await import('./src/owpml/document/ai-edit-complete-handler');
  
  // 파일 경로 (실제 경로로 변경)
  const filePath = '파일경로.hwpx';
  
  // AI 편집 결과 시뮬레이션
  const aiResult = {
    itemsUpdated: 3,
    sections: [
      {
        index: 0,
        xml: \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>가을 여행 놀이 월간 기획서 - 1주차</t>
    </run>
  </p>
</section>\`
      },
      {
        index: 1,
        xml: \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>가을 여행 놀이 월간 기획서 - 2주차</t>
    </run>
  </p>
</section>\`
      },
      {
        index: 2,
        xml: \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>가을 여행 놀이 월간 기획서 - 3주차</t>
    </run>
  </p>
</section>\`
      }
    ],
    tokensUsed: 1249,
    cost: 0.0136
  };
  
  console.log('🧪 [TEST] Starting AI edit result test...');
  console.log('📊 [TEST] Items to update:', aiResult.itemsUpdated);
  
  const success = await handleAIEditComplete(
    filePath,
    aiResult,
    {
      onDocumentReload: () => {
        console.log('🔄 [TEST] Document reload callback called');
        // 실제 문서 리로드 함수 호출
        // reloadDocument();
      },
      onSaveComplete: (saved) => {
        console.log('💾 [TEST] Save complete:', saved);
      }
    }
  );
  
  console.log('🏁 [TEST] Test result:', success ? 'SUCCESS' : 'FAILED');
  return success;
}

// 실행
testAIEditResult();
`;

/**
 * 콘솔 테스트 함수 3: 현재 파일 상태 확인
 */
export const testCheckFileStatus = `
// ============================================
// 현재 파일 상태 확인
// ============================================

async function testCheckFileStatus(filePath) {
  const { HWPXDocumentHelper } = await import('./src/owpml/document/HWPXDocumentHelper');
  
  console.log('🔍 [CHECK] Checking file status...');
  console.log('📂 [CHECK] File path:', filePath);
  
  const helper = new HWPXDocumentHelper();
  
  try {
    // 파일 열기
    const opened = await helper.openFile(filePath);
    if (!opened) {
      console.error('❌ [CHECK] Failed to open file');
      return;
    }
    
    // 섹션 개수
    const sectionCount = helper.getSectionCount();
    console.log('📊 [CHECK] Section count:', sectionCount);
    
    // 각 섹션 확인
    for (let i = 0; i < sectionCount; i++) {
      const sectionXML = helper.getSectionXML(i);
      if (sectionXML) {
        console.log(\`📄 [CHECK] Section \${i}:\`, sectionXML.substring(0, 200));
      } else {
        console.log(\`⚠️ [CHECK] Section \${i}: null or invalid\`);
      }
    }
    
    // 헤더 확인
    const headerXML = helper.getHeaderXML();
    if (headerXML) {
      console.log('📋 [CHECK] Header:', headerXML.substring(0, 200));
    } else {
      console.log('⚠️ [CHECK] Header: null or invalid');
    }
    
    console.log('✅ [CHECK] Status check completed');
  } catch (error) {
    console.error('❌ [CHECK] Error:', error);
  }
}

// 실행 (파일 경로를 실제 경로로 변경)
// testCheckFileStatus('파일경로.hwpx');
`;

/**
 * 콘솔 테스트 함수 4: 간단한 섹션 업데이트
 */
export const testSimpleUpdate = `
// ============================================
// 간단한 섹션 업데이트 테스트
// ============================================

async function testSimpleUpdate(filePath, sectionIndex, newContent) {
  const { HWPXDocumentHelper } = await import('./src/owpml/document/HWPXDocumentHelper');
  
  console.log('🧪 [SIMPLE] Simple update test...');
  console.log('📂 [SIMPLE] File:', filePath);
  console.log('📝 [SIMPLE] Section:', sectionIndex);
  console.log('📄 [SIMPLE] New content:', newContent.substring(0, 50) + '...');
  
  const helper = new HWPXDocumentHelper();
  
  try {
    // 파일 열기
    await helper.openFile(filePath);
    console.log('✅ [SIMPLE] File opened');
    
    // 섹션 XML 생성
    const sectionXML = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>\${newContent}</t>
    </run>
  </p>
</section>\`;
    
    // 업데이트
    helper.updateSectionXML(sectionIndex, sectionXML);
    console.log('✅ [SIMPLE] Section updated in memory');
    
    // 저장
    const saved = await helper.saveChanges();
    
    if (saved) {
      console.log('✅ [SIMPLE] File saved!');
      console.log('🔄 [SIMPLE] Reload document to see changes');
      return true;
    } else {
      console.error('❌ [SIMPLE] Save failed');
      return false;
    }
  } catch (error) {
    console.error('❌ [SIMPLE] Error:', error);
    return false;
  }
}

// 실행 예제
// testSimpleUpdate('파일경로.hwpx', 0, '가을 여행 놀이 월간 기획서');
`;

