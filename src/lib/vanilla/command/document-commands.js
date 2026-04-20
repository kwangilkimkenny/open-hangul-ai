/**
 * Document Commands Module
 * 문서 레벨 명령
 *
 * @module command/document-commands
 * @version 1.0.0
 * @author Kwang-il Kim (김광일) <yatav@yatavent.com>
 * @since 2025
 * @see {@link https://www.linkedin.com/in/kwang-il-kim-a399b3196/}
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * 문서 명령 클래스
 */
export class DocumentCommands {
  constructor(viewer) {
    this.viewer = viewer;
    this.historyManager = viewer.historyManager;
  }

  /**
   * 문서 전체 업데이트
   * @param {Object} newDocument - 새 문서
   * @param {string} actionName - 액션 이름
   */
  executeUpdateDocument(newDocument, actionName = 'Update Document') {
    try {
      const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

      const execute = () => {
        this.viewer.updateDocument(newDocument);
      };

      const undo = () => {
        this.viewer.updateDocument(oldDocument);
        return execute;
      };

      this.historyManager.execute(execute, undo, actionName);
      logger.debug('Document updated', { actionName });
    } catch (error) {
      logger.error('Failed to update document', error);
      throw error;
    }
  }

  /**
   * 셀 내용 비우기
   * @param {HTMLElement} cellElement - 셀 요소
   */
  executeClearCell(cellElement) {
    try {
      if (!cellElement || !cellElement._cellData) {
        logger.warn('Invalid cell element or missing cell data');
        return;
      }

      const oldText = this._extractTextFromCellData(cellElement._cellData);
      this.executeEditCell(cellElement, '');
      logger.debug('Cell cleared', { cellElement });
    } catch (error) {
      logger.error('Failed to clear cell', error);
      throw error;
    }
  }

  /**
   * 셀 편집
   * @param {HTMLElement} cellElement - 셀 요소
   * @param {string} newText - 새 텍스트
   */
  executeEditCell(cellElement, newText) {
    try {
      if (!cellElement || !cellElement._cellData) {
        logger.warn('Invalid cell element or missing cell data');
        return;
      }

      const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));

      const execute = () => {
        // 셀 데이터 업데이트
        this._updateCellText(cellElement._cellData, newText);

        // 문서 재렌더링
        this.viewer.updateDocument(this.viewer.getDocument());
      };

      const undo = () => {
        this.viewer.updateDocument(oldDocument);
        return execute;
      };

      this.historyManager.execute(execute, undo, 'Edit Cell');
      logger.debug('Cell edited', { cellElement, newText });
    } catch (error) {
      logger.error('Failed to edit cell', error);
      throw error;
    }
  }

  /**
   * 문서 새로 만들기
   */
  executeNewDocument() {
    try {
      const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
      const newDocument = this._createEmptyDocument();

      const execute = () => {
        this.viewer.updateDocument(newDocument);
      };

      const undo = () => {
        this.viewer.updateDocument(oldDocument);
        return execute;
      };

      this.historyManager.execute(execute, undo, 'New Document');
      logger.debug('New document created');
    } catch (error) {
      logger.error('Failed to create new document', error);
      throw error;
    }
  }

  /**
   * 문서 복사본 만들기
   */
  executeCloneDocument() {
    try {
      const currentDocument = this.viewer.getDocument();
      const clonedDocument = JSON.parse(JSON.stringify(currentDocument));

      // 문서 메타데이터 업데이트
      if (clonedDocument.metadata) {
        clonedDocument.metadata.title = `${clonedDocument.metadata.title || 'Document'} - Copy`;
        clonedDocument.metadata.createdAt = new Date().toISOString();
        clonedDocument.metadata.modifiedAt = new Date().toISOString();
      }

      const execute = () => {
        this.viewer.updateDocument(clonedDocument);
      };

      const undo = () => {
        this.viewer.updateDocument(currentDocument);
        return execute;
      };

      this.historyManager.execute(execute, undo, 'Clone Document');
      logger.debug('Document cloned');
    } catch (error) {
      logger.error('Failed to clone document', error);
      throw error;
    }
  }

  /**
   * 문서 메타데이터 업데이트
   * @param {Object} metadata - 메타데이터
   */
  executeUpdateMetadata(metadata) {
    try {
      const oldDocument = JSON.parse(JSON.stringify(this.viewer.getDocument()));
      const newDocument = JSON.parse(JSON.stringify(oldDocument));

      if (!newDocument.metadata) {
        newDocument.metadata = {};
      }

      Object.assign(newDocument.metadata, metadata, {
        modifiedAt: new Date().toISOString(),
      });

      const execute = () => {
        this.viewer.updateDocument(newDocument);
      };

      const undo = () => {
        this.viewer.updateDocument(oldDocument);
        return execute;
      };

      this.historyManager.execute(execute, undo, 'Update Metadata');
      logger.debug('Metadata updated', { metadata });
    } catch (error) {
      logger.error('Failed to update metadata', error);
      throw error;
    }
  }

  /**
   * 셀 데이터에서 텍스트 추출 (내부 메서드)
   * @private
   */
  _extractTextFromCellData(cellData) {
    if (!cellData || !cellData.paragraphs) {
      return '';
    }

    return cellData.paragraphs
      .map(para => (para.runs ? para.runs.map(run => run.text).join('') : ''))
      .join('\n');
  }

  /**
   * 셀 텍스트 업데이트 (내부 메서드)
   * @private
   */
  _updateCellText(cellData, newText) {
    if (!cellData) {
      return;
    }

    // 기본 단락 구조 생성
    cellData.paragraphs = [
      {
        runs: newText
          ? [
              {
                text: newText,
                formatting: {},
              },
            ]
          : [],
      },
    ];
  }

  /**
   * 빈 문서 생성 (내부 메서드)
   * @private
   */
  _createEmptyDocument() {
    return {
      metadata: {
        title: 'Untitled Document',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        version: '1.0.0',
      },
      pages: [
        {
          sections: [
            {
              paragraphs: [
                {
                  runs: [
                    {
                      text: '',
                      formatting: {},
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      styles: {},
      numberings: {},
      settings: {
        pageSize: { width: 595, height: 842 }, // A4
        margins: { top: 56, right: 56, bottom: 56, left: 56 },
      },
    };
  }

  /**
   * 문서 유효성 검사
   */
  validateDocument(document) {
    try {
      if (!document) {
        throw new Error('Document is null or undefined');
      }

      if (!document.pages || !Array.isArray(document.pages)) {
        throw new Error('Document must have pages array');
      }

      if (document.pages.length === 0) {
        throw new Error('Document must have at least one page');
      }

      // 각 페이지 검증
      for (let i = 0; i < document.pages.length; i++) {
        const page = document.pages[i];
        if (!page.sections || !Array.isArray(page.sections)) {
          throw new Error(`Page ${i} must have sections array`);
        }
      }

      logger.debug('Document validation passed');
      return true;
    } catch (error) {
      logger.error('Document validation failed', error);
      return false;
    }
  }

  /**
   * 문서 통계 정보 가져오기
   */
  getDocumentStats() {
    try {
      const document = this.viewer.getDocument();

      let pageCount = document.pages?.length || 0;
      let paragraphCount = 0;
      let wordCount = 0;
      let characterCount = 0;

      if (document.pages) {
        for (const page of document.pages) {
          if (page.sections) {
            for (const section of page.sections) {
              if (section.paragraphs) {
                paragraphCount += section.paragraphs.length;

                for (const para of section.paragraphs) {
                  if (para.runs) {
                    for (const run of para.runs) {
                      if (run.text) {
                        characterCount += run.text.length;
                        wordCount += run.text.split(/\s+/).filter(word => word.length > 0).length;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      const stats = {
        pageCount,
        paragraphCount,
        wordCount,
        characterCount,
        characterCountWithSpaces: characterCount,
        estimatedReadingTime: Math.ceil(wordCount / 200), // 200 words per minute
      };

      logger.debug('Document stats calculated', stats);
      return stats;
    } catch (error) {
      logger.error('Failed to calculate document stats', error);
      return null;
    }
  }

  /**
   * 현재 문서 가져오기
   */
  getCurrentDocument() {
    return this.viewer.getDocument();
  }

  /**
   * 문서가 비어있는지 확인
   */
  isDocumentEmpty() {
    const document = this.viewer.getDocument();
    const stats = this.getDocumentStats();
    return stats ? stats.characterCount === 0 || stats.wordCount === 0 : true;
  }

  /**
   * 문서가 수정되었는지 확인
   */
  isDocumentModified() {
    // 이것은 문서의 수정 상태를 추적하는 로직이 필요합니다
    // 현재는 히스토리 매니저가 변경사항을 가지고 있는지 확인
    return this.historyManager ? this.historyManager.hasChanges() : false;
  }
}

export default DocumentCommands;
