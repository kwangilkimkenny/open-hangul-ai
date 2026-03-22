/* eslint-disable no-console */
/**
 * HWPX 문서 편집 사용 예제
 * AI 편집 후 문서에 변경사항을 반영하는 방법
 */

import { HWPXDocumentHelper, applyAIEditsToHWPX } from './HWPXDocumentHelper';

/**
 * 예제 1: AI 편집 후 간단하게 적용
 */
export async function example1_SimpleUpdate() {
  // AI 편집 결과 (예: GPT가 생성한 XML)
  const updatedSections = new Map<number, string>();
  updatedSections.set(0, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>가을놀이 주제로 변경된 내용입니다.</t>
    </run>
  </p>
</section>`);

  // 한 줄로 적용 및 저장
  await applyAIEditsToHWPX('document.hwpx', updatedSections);
}

/**
 * 예제 2: 여러 섹션 업데이트
 */
export async function example2_MultipleSections() {
  const helper = new HWPXDocumentHelper();

  // 파일 열기
  await helper.openFile('document.hwpx');

  // AI 편집 결과
  const updatedSections = new Map<number, string>();
  
  // 첫 번째 섹션 업데이트
  updatedSections.set(0, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>첫 번째 섹션: 가을놀이 주제</t>
    </run>
  </p>
</section>`);

  // 두 번째 섹션 업데이트
  updatedSections.set(1, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>두 번째 섹션: 가을놀이 활동</t>
    </run>
  </p>
</section>`);

  // 모든 섹션 업데이트
  helper.updateSectionsXML(updatedSections);

  // 저장
  await helper.saveChanges();
}

/**
 * 예제 3: 헤더와 섹션 모두 업데이트
 */
export async function example3_HeaderAndSections() {
  const helper = new HWPXDocumentHelper();

  // 파일 열기
  await helper.openFile('document.hwpx');

  // 헤더 업데이트 (선택사항)
  const updatedHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<head>
  <!-- 업데이트된 헤더 내용 -->
</head>`;
  helper.updateHeaderXML(updatedHeader);

  // 섹션 업데이트
  const updatedSections = new Map<number, string>();
  updatedSections.set(0, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<section>
  <p>
    <run>
      <t>업데이트된 섹션 내용</t>
    </run>
  </p>
</section>`);
  helper.updateSectionsXML(updatedSections);

  // 저장
  await helper.saveChanges();
}

/**
 * 예제 4: AI 편집 결과를 받아서 처리하는 실제 시나리오
 */
export async function example4_AIEditIntegration(
  filePath: string,
  aiEditResult: {
    updatedSections?: Map<number, string>;
    updatedHeader?: string;
  }
) {
  const helper = new HWPXDocumentHelper();

  try {
    // 파일 열기
    console.log(`[INFO] Opening file: ${filePath}`);
    const opened = await helper.openFile(filePath);
    if (!opened) {
      throw new Error('Failed to open HWPX file');
    }

    // 현재 섹션 개수 확인
    const sectionCount = helper.getSectionCount();
    console.log(`[INFO] Current section count: ${sectionCount}`);

    // 헤더 업데이트
    if (aiEditResult.updatedHeader) {
      console.log('[INFO] Updating header...');
      helper.updateHeaderXML(aiEditResult.updatedHeader);
    }

    // 섹션 업데이트
    if (aiEditResult.updatedSections && aiEditResult.updatedSections.size > 0) {
      console.log(`[INFO] Updating ${aiEditResult.updatedSections.size} sections...`);
      helper.updateSectionsXML(aiEditResult.updatedSections);
    }

    // 저장
    console.log('[INFO] Saving changes...');
    const saved = await helper.saveChanges();
    
    if (saved) {
      console.log('[INFO] ✅ Document updated successfully!');
      return true;
    } else {
      console.error('[ERROR] ❌ Failed to save document');
      return false;
    }
  } catch (error) {
    console.error('[ERROR] Failed to update document:', error);
    return false;
  }
}

/**
 * 예제 5: React/Vue 등 프론트엔드에서 사용하는 경우
 */
export async function example5_FrontendIntegration(
  filePath: string,
  aiEditResponse: {
    itemsUpdated: number;
    sections: Array<{ index: number; xml: string }>;
    header?: string;
  }
) {
  const helper = new HWPXDocumentHelper();

  await helper.openFile(filePath);

  // AI 응답을 Map으로 변환
  const sectionsMap = new Map<number, string>();
  for (const section of aiEditResponse.sections) {
    sectionsMap.set(section.index, section.xml);
  }

  // 업데이트
  if (aiEditResponse.header) {
    helper.updateHeaderXML(aiEditResponse.header);
  }
  helper.updateSectionsXML(sectionsMap);

  // 저장
  const success = await helper.saveChanges();

  return {
    success,
    itemsUpdated: aiEditResponse.itemsUpdated,
    message: success 
      ? `✅ ${aiEditResponse.itemsUpdated}개 항목이 성공적으로 업데이트되었습니다.`
      : '❌ 문서 저장에 실패했습니다.'
  };
}

