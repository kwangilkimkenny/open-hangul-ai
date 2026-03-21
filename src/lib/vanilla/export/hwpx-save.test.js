/**
 * HWPX Save Functionality Tests
 * 저장 기능 테스트 - 편집된 내용이 올바르게 저장되는지 확인
 *
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('HWPX Save Flow', () => {
  describe('Text extraction from DOM', () => {
    it('should extract text with line breaks preserved', () => {
      // DOM 요소 생성
      const element = document.createElement('div');
      element.innerHTML = 'Line 1<br>Line 2<br>Line 3';

      // _extractTextFromElement 로직 시뮬레이션
      const clone = element.cloneNode(true);
      const brs = clone.querySelectorAll('br');
      brs.forEach(br => {
        br.replaceWith('\n');
      });
      const extractedText = clone.textContent || '';

      expect(extractedText).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle text without line breaks', () => {
      const element = document.createElement('div');
      element.textContent = 'Simple text without breaks';

      const clone = element.cloneNode(true);
      const brs = clone.querySelectorAll('br');
      brs.forEach(br => {
        br.replaceWith('\n');
      });
      const extractedText = clone.textContent || '';

      expect(extractedText).toBe('Simple text without breaks');
    });

    it('should handle consecutive line breaks', () => {
      const element = document.createElement('div');
      element.innerHTML = 'Line 1<br><br>Line 3';

      const clone = element.cloneNode(true);
      const brs = clone.querySelectorAll('br');
      brs.forEach(br => {
        br.replaceWith('\n');
      });
      const extractedText = clone.textContent || '';

      expect(extractedText).toBe('Line 1\n\nLine 3');
    });
  });

  describe('Cell data update from text', () => {
    it('should convert text with line breaks to runs array', () => {
      const cellData = {
        elements: [{ type: 'paragraph', runs: [] }],
      };

      const newText = 'Line 1\nLine 2\nLine 3';

      // _updateCellDataFromText 로직 시뮬레이션
      const paragraph = cellData.elements[0];
      paragraph.runs = [];

      const lines = newText.split('\n');
      lines.forEach((line, idx) => {
        if (idx > 0) {
          paragraph.runs.push({ type: 'linebreak' });
        }
        if (line) {
          paragraph.runs.push({ text: line });
        }
      });

      expect(paragraph.runs).toEqual([
        { text: 'Line 1' },
        { type: 'linebreak' },
        { text: 'Line 2' },
        { type: 'linebreak' },
        { text: 'Line 3' },
      ]);
    });

    it('should handle empty lines in text', () => {
      const cellData = {
        elements: [{ type: 'paragraph', runs: [] }],
      };

      const newText = 'Line 1\n\nLine 3';

      const paragraph = cellData.elements[0];
      paragraph.runs = [];

      const lines = newText.split('\n');
      lines.forEach((line, idx) => {
        if (idx > 0) {
          paragraph.runs.push({ type: 'linebreak' });
        }
        if (line) {
          paragraph.runs.push({ text: line });
        }
      });

      // 빈 줄은 linebreak만 추가되고 텍스트는 없음
      expect(paragraph.runs).toEqual([
        { text: 'Line 1' },
        { type: 'linebreak' },
        { type: 'linebreak' },
        { text: 'Line 3' },
      ]);
    });
  });

  describe('Extract text from cell data', () => {
    it('should extract text with line breaks from runs', () => {
      const cellData = {
        elements: [
          {
            type: 'paragraph',
            runs: [
              { text: 'Line 1' },
              { type: 'linebreak' },
              { text: 'Line 2' },
              { type: 'linebreak' },
              { text: 'Line 3' },
            ],
          },
        ],
      };

      // _extractTextFromCellData 로직 시뮬레이션
      let text = '';
      cellData.elements.forEach(element => {
        if (element.type === 'paragraph' && element.runs) {
          element.runs.forEach(run => {
            if (run.text) {
              text += run.text;
            } else if (run.type === 'linebreak') {
              text += '\n';
            }
          });
        }
      });

      expect(text).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Round-trip text preservation', () => {
    it('should preserve text through DOM -> Data -> DOM cycle', () => {
      const originalText = 'First line\nSecond line\nThird line';

      // Step 1: Text to DOM (simulating editor output)
      const element = document.createElement('div');
      element.innerHTML = originalText.split('\n').join('<br>');

      // Step 2: Extract from DOM (using fixed logic)
      const clone = element.cloneNode(true);
      const brs = clone.querySelectorAll('br');
      brs.forEach(br => {
        br.replaceWith('\n');
      });
      const extractedText = clone.textContent || '';

      // Step 3: Update cell data
      const cellData = { elements: [{ type: 'paragraph', runs: [] }] };
      const paragraph = cellData.elements[0];
      paragraph.runs = [];

      const lines = extractedText.split('\n');
      lines.forEach((line, idx) => {
        if (idx > 0) {
          paragraph.runs.push({ type: 'linebreak' });
        }
        if (line) {
          paragraph.runs.push({ text: line });
        }
      });

      // Step 4: Extract from cell data (for verification)
      let finalText = '';
      cellData.elements.forEach(element => {
        if (element.type === 'paragraph' && element.runs) {
          element.runs.forEach(run => {
            if (run.text) {
              finalText += run.text;
            } else if (run.type === 'linebreak') {
              finalText += '\n';
            }
          });
        }
      });

      // Text should be preserved through the round-trip
      expect(finalText).toBe(originalText);
    });
  });

  describe('Document structure rebuild from DOM', () => {
    it('should collect table data from DOM and rebuild document structure', () => {
      // 시나리오: AI가 updateDocument로 문서 구조를 변경했지만,
      // DOM에는 여전히 원래 테이블이 있는 경우

      // 1. DOM 구조 생성 (테이블 포함)
      const container = document.createElement('div');

      // 테이블 생성
      const table = document.createElement('table');
      table.className = 'hwp-table';

      // 테이블 데이터 연결
      const tableData = {
        type: 'table',
        rows: [
          {
            cells: [
              {
                elements: [{ type: 'paragraph', runs: [{ text: '셀 1' }] }],
              },
              {
                elements: [{ type: 'paragraph', runs: [{ text: '셀 2' }] }],
              },
            ],
          },
        ],
      };
      table._tableData = tableData;

      // 셀 생성
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      const td2 = document.createElement('td');
      td1.textContent = '셀 1';
      td2.textContent = '셀 2';
      td1._cellData = tableData.rows[0].cells[0];
      td2._cellData = tableData.rows[0].cells[1];

      tr.appendChild(td1);
      tr.appendChild(td2);
      table.appendChild(tr);
      container.appendChild(table);

      // 2. state.document 시뮬레이션 (잘못된 구조 - AI가 덮어쓴 상태)
      const stateDocument = {
        sections: [
          {
            elements: [
              { type: 'paragraph', runs: [{ text: '잘못된 단락' }] },
            ],
          },
        ],
      };

      // 3. DOM에서 요소 수집 (v2.1.4 로직)
      const elementMap = new Map();
      const tables = container.querySelectorAll('.hwp-table');
      tables.forEach(tableEl => {
        if (tableEl._tableData) {
          elementMap.set(tableEl, tableEl._tableData);
        }
      });

      // 4. 문서 구조 재구성
      const sortedElements = Array.from(elementMap.values());

      // 5. 검증: 테이블이 수집되어야 함
      expect(sortedElements.length).toBe(1);
      expect(sortedElements[0].type).toBe('table');
      expect(sortedElements[0].rows[0].cells.length).toBe(2);

      // 6. state.document 업데이트 시뮬레이션
      stateDocument.sections[0].elements = sortedElements;

      // 7. 최종 검증
      expect(stateDocument.sections[0].elements[0].type).toBe('table');
    });

    it('should preserve element order based on DOM position', () => {
      // DOM 순서가 보존되는지 테스트
      const container = document.createElement('div');

      // 단락 1
      const para1 = document.createElement('div');
      para1.className = 'hwp-paragraph editable-paragraph';
      const para1Data = { type: 'paragraph', runs: [{ text: '단락 1' }] };
      para1._paraData = para1Data;

      // 테이블
      const table = document.createElement('table');
      table.className = 'hwp-table';
      const tableData = { type: 'table', rows: [] };
      table._tableData = tableData;

      // 단락 2
      const para2 = document.createElement('div');
      para2.className = 'hwp-paragraph editable-paragraph';
      const para2Data = { type: 'paragraph', runs: [{ text: '단락 2' }] };
      para2._paraData = para2Data;

      // DOM에 순서대로 추가
      container.appendChild(para1);
      container.appendChild(table);
      container.appendChild(para2);

      // 요소 수집
      const elementMap = new Map();

      // 테이블 수집
      container.querySelectorAll('.hwp-table').forEach(tableEl => {
        if (tableEl._tableData) {
          elementMap.set(tableEl, tableEl._tableData);
        }
      });

      // 단락 수집 (테이블 외부만)
      container.querySelectorAll('.hwp-paragraph.editable-paragraph').forEach(para => {
        if (para._paraData && !para.closest('.hwp-table')) {
          elementMap.set(para, para._paraData);
        }
      });

      // DOM 순서로 정렬
      const sortedElements = Array.from(elementMap.entries())
        .sort((a, b) => {
          const position = a[0].compareDocumentPosition(b[0]);
          if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        })
        .map(([_, data]) => data);

      // 검증: 순서가 para1 -> table -> para2 여야 함
      expect(sortedElements.length).toBe(3);
      expect(sortedElements[0].type).toBe('paragraph');
      expect(sortedElements[0].runs[0].text).toBe('단락 1');
      expect(sortedElements[1].type).toBe('table');
      expect(sortedElements[2].type).toBe('paragraph');
      expect(sortedElements[2].runs[0].text).toBe('단락 2');
    });
  });

  describe('Manual edit to HWPX save flow', () => {
    it('should sync edited cell text and rebuild document structure', () => {
      // 시뮬레이션: 사용자가 테이블 셀을 직접 편집한 경우
      const container = document.createElement('div');

      // 테이블 생성 (hwp-table 클래스)
      const table = document.createElement('table');
      table.className = 'hwp-table';

      // _tableData 설정 (파서에서 생성된 것처럼)
      const tableData = {
        type: 'table',
        rows: [
          {
            cells: [
              {
                elements: [
                  {
                    type: 'paragraph',
                    runs: [{ text: '원래 텍스트' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      table._tableData = tableData;

      // 셀 생성
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = '수정된 텍스트'; // 사용자가 편집한 텍스트
      td._cellData = tableData.rows[0].cells[0]; // cellData 연결

      tr.appendChild(td);
      table.appendChild(tr);
      container.appendChild(table);

      // === _syncDocumentFromDOM 로직 시뮬레이션 ===

      // 1. 테이블 수집
      const elementMap = new Map();
      const tables = container.querySelectorAll('.hwp-table');
      expect(tables.length).toBe(1);

      tables.forEach(tableEl => {
        const tData = tableEl._tableData;
        if (tData) {
          elementMap.set(tableEl, tData);
        }

        // 셀 동기화
        const cells = tableEl.querySelectorAll('td, th');
        cells.forEach(cell => {
          const cellData = cell._cellData;
          if (cellData) {
            const currentText = cell.textContent;

            // _updateCellDataFromText 로직
            if (!cellData.elements || cellData.elements.length === 0) {
              cellData.elements = [{ type: 'paragraph', runs: [] }];
            }
            const paragraph = cellData.elements[0];
            paragraph.runs = [];
            const lines = currentText.split('\n');
            lines.forEach((line, idx) => {
              if (idx > 0) {
                paragraph.runs.push({ type: 'linebreak' });
              }
              if (line) {
                paragraph.runs.push({ text: line });
              }
            });
          }
        });
      });

      // 2. 문서 구조 재구성
      const stateDocument = {
        sections: [
          {
            elements: [
              { type: 'paragraph', runs: [{ text: '잘못된 구조' }] }, // AI가 덮어쓴 잘못된 구조
            ],
          },
        ],
      };

      const sortedElements = Array.from(elementMap.values());
      stateDocument.sections[0].elements = sortedElements;

      // === 검증 ===

      // 1. 문서 구조에 테이블이 있어야 함
      expect(stateDocument.sections[0].elements.length).toBe(1);
      expect(stateDocument.sections[0].elements[0].type).toBe('table');

      // 2. 테이블의 셀 데이터에 수정된 텍스트가 반영되어야 함
      const savedTable = stateDocument.sections[0].elements[0];
      const savedCellRuns = savedTable.rows[0].cells[0].elements[0].runs;
      expect(savedCellRuns.length).toBe(1);
      expect(savedCellRuns[0].text).toBe('수정된 텍스트');
    });

    it('should handle multiline edited text with br tags', () => {
      const container = document.createElement('div');

      const table = document.createElement('table');
      table.className = 'hwp-table';

      const tableData = {
        type: 'table',
        rows: [
          {
            cells: [
              {
                elements: [
                  {
                    type: 'paragraph',
                    runs: [{ text: '원래 텍스트' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      table._tableData = tableData;

      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.innerHTML = '첫번째 줄<br>두번째 줄<br>세번째 줄'; // 사용자가 여러 줄 입력
      td._cellData = tableData.rows[0].cells[0];

      tr.appendChild(td);
      table.appendChild(tr);
      container.appendChild(table);

      // _extractTextFromElement 로직 (br → \n 변환)
      const clone = td.cloneNode(true);
      const brs = clone.querySelectorAll('br');
      brs.forEach(br => br.replaceWith('\n'));
      const currentText = clone.textContent || '';

      expect(currentText).toBe('첫번째 줄\n두번째 줄\n세번째 줄');

      // _updateCellDataFromText 로직
      const cellData = td._cellData;
      const paragraph = cellData.elements[0];
      paragraph.runs = [];
      const lines = currentText.split('\n');
      lines.forEach((line, idx) => {
        if (idx > 0) {
          paragraph.runs.push({ type: 'linebreak' });
        }
        if (line) {
          paragraph.runs.push({ text: line });
        }
      });

      // 검증: runs에 linebreak가 포함되어야 함
      expect(paragraph.runs).toEqual([
        { text: '첫번째 줄' },
        { type: 'linebreak' },
        { text: '두번째 줄' },
        { type: 'linebreak' },
        { text: '세번째 줄' },
      ]);
    });

    it('should work when AI has replaced document structure', () => {
      // 시나리오: AI가 updateDocument로 문서 구조를 변경한 후 사용자가 수동 편집
      const container = document.createElement('div');

      // 1. 원래 테이블 (파서에서 생성된 것처럼)
      const originalTableData = {
        type: 'table',
        rows: [
          {
            cells: [
              {
                elements: [
                  {
                    type: 'paragraph',
                    runs: [{ text: '원래 셀 내용' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      // 2. DOM 생성 (렌더링 시뮬레이션)
      const table = document.createElement('table');
      table.className = 'hwp-table';
      table._tableData = originalTableData; // _tableData 연결

      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = '원래 셀 내용';
      td._cellData = originalTableData.rows[0].cells[0]; // _cellData 연결

      tr.appendChild(td);
      table.appendChild(tr);
      container.appendChild(table);

      // 3. AI가 updateDocument 호출 (다른 구조의 문서로 교체)
      const aiDocument = {
        sections: [
          {
            elements: [
              { type: 'paragraph', runs: [{ text: 'AI가 생성한 잘못된 단락' }] },
            ],
          },
        ],
      };

      // 4. 사용자가 셀 수정 (InlineEditor.saveChanges 시뮬레이션)
      td.textContent = '사용자가 수정한 내용';

      // _updateCellData 로직: cellData.elements 업데이트
      const cellData = td._cellData;
      cellData.elements = [
        {
          type: 'paragraph',
          runs: [{ text: '사용자가 수정한 내용' }],
        },
      ];

      // 5. _syncDocumentFromDOM 실행 (saveFile 시뮬레이션)
      const elementMap = new Map();

      // 테이블 수집
      const tables = container.querySelectorAll('.hwp-table');
      tables.forEach(tableEl => {
        const tData = tableEl._tableData;
        if (tData) {
          if (!tData.type) tData.type = 'table'; // 안전 장치
          elementMap.set(tableEl, tData);
        }
      });

      // 문서 구조 재구성
      const sortedElements = Array.from(elementMap.values());
      aiDocument.sections[0].elements = sortedElements;

      // 6. 검증
      // - AI 문서가 테이블을 포함하도록 수정되어야 함
      expect(aiDocument.sections[0].elements.length).toBe(1);
      expect(aiDocument.sections[0].elements[0].type).toBe('table');

      // - 테이블의 첫 번째 셀에 수정된 내용이 반영되어야 함
      const savedTable = aiDocument.sections[0].elements[0];
      const savedCellRuns = savedTable.rows[0].cells[0].elements[0].runs;
      expect(savedCellRuns[0].text).toBe('사용자가 수정한 내용');
    });
  });
});
