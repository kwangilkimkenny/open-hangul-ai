/* eslint-disable no-console */
/**
 * AI 편집 통합 유틸리티
 * AI 편집 완료 후 문서에 변경사항을 반영하는 통합 함수
 */

import { HWPXDocumentHelper } from './HWPXDocumentHelper';

/**
 * AI 편집 결과 타입
 */
export interface AIEditResult {
  itemsUpdated: number;
  sections?: Array<{ index: number; xml: string }>;
  header?: string;
  documentType?: string;
  tokensUsed?: number;
  cost?: number;
}

/**
 * AI 편집 완료 후 문서에 변경사항을 반영하는 함수
 * 
 * 이 함수는 AI 편집이 완료된 후 자동으로 호출되어야 합니다.
 * 
 * @param filePath HWPX 파일 경로
 * @param aiResult AI 편집 결과
 * @param options 추가 옵션
 * @returns 성공 여부
 */
export async function applyAIEditResult(
  filePath: string,
  aiResult: AIEditResult,
  options?: {
    reloadAfterSave?: boolean;
    onSaveComplete?: (success: boolean) => void;
  }
): Promise<boolean> {
  const helper = new HWPXDocumentHelper();

  try {
    console.log('[AI Edit] 📂 Opening file:', filePath);
    
    // 1. 파일 열기
    const opened = await helper.openFile(filePath);
    if (!opened) {
      console.error('[AI Edit] ❌ Failed to open file');
      return false;
    }

    console.log('[AI Edit] ✅ File opened successfully');

    // 2. 헤더 업데이트 (있는 경우)
    if (aiResult.header) {
      console.log('[AI Edit] 📝 Updating header...');
      helper.updateHeaderXML(aiResult.header);
    }

    // 3. 섹션 업데이트
    if (aiResult.sections && aiResult.sections.length > 0) {
      console.log(`[AI Edit] 📝 Updating ${aiResult.sections.length} sections...`);
      
      const sectionsMap = new Map<number, string>();
      aiResult.sections.forEach(section => {
        sectionsMap.set(section.index, section.xml);
        console.log(`[AI Edit]   - Section ${section.index}: ${section.xml.substring(0, 50)}...`);
      });

      helper.updateSectionsXML(sectionsMap);
      console.log('[AI Edit] ✅ Sections updated in memory');
    } else {
      console.warn('[AI Edit] ⚠️ No sections to update');
    }

    // 4. 저장 (중요!)
    console.log('[AI Edit] 💾 Saving changes to file...');
    const saved = await helper.saveChanges();
    
    if (!saved) {
      console.error('[AI Edit] ❌ Failed to save file');
      if (options?.onSaveComplete) {
        options.onSaveComplete(false);
      }
      return false;
    }

    console.log('[AI Edit] ✅ File saved successfully');
    console.log(`[AI Edit] 📊 Summary: ${aiResult.itemsUpdated} items updated, ${aiResult.tokensUsed || 0} tokens, $${aiResult.cost || 0}`);

    // 5. 저장 완료 콜백
    if (options?.onSaveComplete) {
      options.onSaveComplete(true);
    }

    // 6. 문서 다시 로드 (필요한 경우)
    if (options?.reloadAfterSave) {
      console.log('[AI Edit] 🔄 Reloading document...');
      // 문서 다시 로드는 호출자가 처리해야 함
      // 예: window.location.reload() 또는 문서 뷰어의 reload 메서드
    }

    return true;
  } catch (error) {
    console.error('[AI Edit] ❌ Error applying AI edits:', error);
    if (options?.onSaveComplete) {
      options.onSaveComplete(false);
    }
    return false;
  }
}

/**
 * AI 편집 완료 핸들러 (콘솔에 표시된 코드용)
 * 
 * 실제 애플리케이션에서 이 함수를 사용하세요:
 * 
 * @example
 * ```typescript
 * // AI 편집 완료 후
 * const result = await processAIEdit(...);
 * 
 * // 문서에 반영
 * await onAIEditComplete(
 *   filePath,
 *   result,
 *   {
 *     reloadAfterSave: true,
 *     onSaveComplete: (success) => {
 *       if (success) {
 *         // UI 업데이트
 *         showSuccessMessage('문서가 업데이트되었습니다.');
 *         // 문서 다시 로드
 *         reloadDocument();
 *       }
 *     }
 *   }
 * );
 * ```
 */
export async function onAIEditComplete(
  filePath: string,
  aiResult: AIEditResult,
  options?: {
    reloadAfterSave?: boolean;
    onSaveComplete?: (success: boolean) => void;
  }
): Promise<boolean> {
  return await applyAIEditResult(filePath, aiResult, options);
}

/**
 * 간단한 사용을 위한 래퍼 함수
 * 
 * @example
 * ```typescript
 * // AI 편집 완료 후
 * await applyAIEdits(filePath, {
 *   itemsUpdated: 3,
 *   sections: [
 *     { index: 0, xml: '<section>...</section>' },
 *     { index: 1, xml: '<section>...</section>' }
 *   ]
 * });
 * ```
 */
export async function applyAIEdits(
  filePath: string,
  aiResult: AIEditResult
): Promise<boolean> {
  return await applyAIEditResult(filePath, aiResult, {
    reloadAfterSave: false,
  });
}

