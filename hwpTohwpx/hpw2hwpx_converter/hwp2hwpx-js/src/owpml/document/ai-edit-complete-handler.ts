/* eslint-disable no-console */
/**
 * AI 편집 완료 핸들러
 * 실제 애플리케이션에서 사용할 수 있는 완전한 통합 예제
 *
 * 이 파일을 복사하여 실제 애플리케이션에 통합하세요.
 */

import { onAIEditComplete, AIEditResult } from './AIEditIntegration';

/**
 * AI 편집 완료 후 호출해야 하는 함수
 * 
 * 사용법:
 * ```typescript
 * // AI 편집 완료 후
 * await handleAIEditComplete(
 *   filePath,
 *   {
 *     itemsUpdated: 3,
 *     sections: [
 *       { index: 0, xml: '<section>...</section>' },
 *       { index: 1, xml: '<section>...</section>' }
 *     ],
 *     tokensUsed: 1249,
 *     cost: 0.0136
 *   },
 *   {
 *     onDocumentReload: () => {
 *       // 문서 뷰어 다시 로드
 *       reloadDocument();
 *     }
 *   }
 * );
 * ```
 */
export async function handleAIEditComplete(
  filePath: string,
  aiResult: {
    itemsUpdated: number;
    sections?: Array<{ index: number; xml: string }>;
    header?: string;
    tokensUsed?: number;
    cost?: number;
  },
  callbacks?: {
    onDocumentReload?: () => void;
    onSaveComplete?: (success: boolean) => void;
  }
): Promise<boolean> {
  console.log('[AI Edit Handler] 🚀 Starting document update...');
  console.log('[AI Edit Handler] File:', filePath);
  console.log('[AI Edit Handler] Items to update:', aiResult.itemsUpdated);

  try {
    // AI 결과를 표준 형식으로 변환
    const result: AIEditResult = {
      itemsUpdated: aiResult.itemsUpdated,
      sections: aiResult.sections || [],
      header: aiResult.header,
      tokensUsed: aiResult.tokensUsed,
      cost: aiResult.cost,
    };

    // 문서에 반영
    const success = await onAIEditComplete(filePath, result, {
      reloadAfterSave: false, // 수동으로 리로드
      onSaveComplete: (saved) => {
        console.log('[AI Edit Handler] Save result:', saved);
        
        if (callbacks?.onSaveComplete) {
          callbacks.onSaveComplete(saved);
        }

        if (saved && callbacks?.onDocumentReload) {
          console.log('[AI Edit Handler] 🔄 Reloading document...');
          // 문서 뷰어 다시 로드
          callbacks.onDocumentReload();
        }
      }
    });

    if (success) {
      console.log('[AI Edit Handler] ✅ Document update completed successfully!');
    } else {
      console.error('[AI Edit Handler] ❌ Document update failed!');
    }

    return success;
  } catch (error) {
    console.error('[AI Edit Handler] ❌ Error:', error);
    return false;
  }
}

/**
 * 간단한 사용을 위한 래퍼
 * 
 * @example
 * ```typescript
 * // 병합 완료 후
 * console.log('✅ 병합 완료: 3 / 3 (100.0%)');
 * 
 * // 바로 적용
 * await applyAIEditsToDocument(
 *   filePath,
 *   mergedSections, // 병합된 섹션 배열
 *   () => reloadDocument() // 문서 리로드 함수
 * );
 * ```
 */
export async function applyAIEditsToDocument(
  filePath: string,
  mergedSections: Array<{ index: number; xml: string }>,
  reloadDocument: () => void
): Promise<boolean> {
  return await handleAIEditComplete(
    filePath,
    {
      itemsUpdated: mergedSections.length,
      sections: mergedSections,
    },
    {
      onDocumentReload: reloadDocument,
    }
  );
}

