/**
 * Sample table data for testing
 */

export function createSampleTable(overrides = {}) {
  return {
    type: 'table',
    rows: overrides.rows || [
      createTableRow(['이름', '나이', '직업']),
      createTableRow(['홍길동', '30', '개발자']),
      createTableRow(['김철수', '25', '디자이너']),
    ],
    colWidths: overrides.colWidths || ['200px', '100px', '200px'],
    colWidthsPercent: overrides.colWidthsPercent || ['40%', '20%', '40%'],
    style: {
      width: '500px',
      height: overrides.height || undefined,
      borderFillId: null,
      ...overrides.style,
    },
    borders: overrides.borders || {},
  };
}

export function createTableRow(cellTexts, overrides = {}) {
  return {
    cells: cellTexts.map((text, index) => createTableCell(text, overrides.cellOverrides?.[index])),
    ...overrides,
  };
}

export function createTableCell(text, overrides = {}) {
  return {
    elements: [
      {
        type: 'paragraph',
        runs: [{ text, style: { fontSize: '12px', color: '#000000' } }],
        style: { textAlign: 'left' },
        paraPr: {},
      },
    ],
    style: {
      backgroundColor: overrides.backgroundColor || null,
      borderTop: overrides.borderTop || '1px solid #000',
      borderBottom: overrides.borderBottom || '1px solid #000',
      borderLeft: overrides.borderLeft || '1px solid #000',
      borderRight: overrides.borderRight || '1px solid #000',
      verticalAlign: overrides.verticalAlign || 'middle',
      padding: overrides.padding || '4px',
      ...overrides.style,
    },
    colspan: overrides.colspan || 1,
    rowspan: overrides.rowspan || 1,
    ...overrides,
  };
}

export function createMergedTable() {
  return {
    type: 'table',
    rows: [
      {
        cells: [
          createTableCell('합쳐진 셀', { colspan: 2 }),
          createTableCell('일반 셀'),
        ],
      },
      {
        cells: [
          createTableCell('세로 합침', { rowspan: 2 }),
          createTableCell('일반 1'),
          createTableCell('일반 2'),
        ],
      },
      {
        cells: [
          // First cell merged with above row
          createTableCell('일반 3'),
          createTableCell('일반 4'),
        ],
      },
    ],
    colWidths: ['200px', '150px', '150px'],
    colWidthsPercent: ['40%', '30%', '30%'],
    style: { width: '500px' },
  };
}

export function createEmptyTable() {
  return {
    type: 'table',
    rows: [],
    colWidths: [],
    colWidthsPercent: [],
    style: { width: '100%' },
  };
}

export function createLargeTable(rowCount = 100, colCount = 5) {
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const cellTexts = [];
    for (let c = 0; c < colCount; c++) {
      cellTexts.push(`R${r}C${c}`);
    }
    rows.push(createTableRow(cellTexts));
  }

  const colWidths = Array(colCount).fill(`${Math.floor(100 / colCount)}%`);

  return {
    type: 'table',
    rows,
    colWidths,
    colWidthsPercent: colWidths,
    style: { width: '100%' },
  };
}

export function createNestedTable() {
  return {
    type: 'table',
    rows: [
      {
        cells: [
          {
            elements: [
              {
                type: 'table',
                rows: [
                  createTableRow(['내부 1', '내부 2']),
                  createTableRow(['내부 3', '내부 4']),
                ],
                colWidths: ['50%', '50%'],
                colWidthsPercent: ['50%', '50%'],
                style: { width: '100%' },
              },
            ],
            style: { padding: '4px' },
            colspan: 1,
            rowspan: 1,
          },
          createTableCell('외부 셀'),
        ],
      },
    ],
    colWidths: ['60%', '40%'],
    colWidthsPercent: ['60%', '40%'],
    style: { width: '100%' },
  };
}
