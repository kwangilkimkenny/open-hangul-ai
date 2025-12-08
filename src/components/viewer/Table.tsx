/**
 * Table Component
 * 참조 프로젝트 렌더링 로직 100% 포팅
 * 
 * @module components/viewer/Table
 * @version 3.0.0
 */

import { useMemo, useCallback } from 'react';
import type { HWPXTable, HWPXTableRow, HWPXTableCell, HWPXElement, HWPXParagraph } from '../../types/hwpx';
import { Paragraph } from './Paragraph';
import { useCellSelectionStore } from '../../stores/cellSelectionStore';
import { makeCellKey } from '../../types/cell-selection';

interface TableProps {
  data: HWPXTable;
  images: Map<string, string>;
  nested?: boolean;
  sectionIndex?: number;
  tableIndex?: number;
}

export function Table({ data, images, nested = false, sectionIndex = 0, tableIndex = 0 }: TableProps) {
  // 테이블 스타일
  const tableStyle = useMemo((): React.CSSProperties => {
    // 테이블 폭 계산 - 페이지 폭을 초과하지 않도록 100%로 제한
    // 원본 폭은 colWidths에서 비율로 처리
    return {
      borderCollapse: 'separate',
      borderSpacing: 0,
      tableLayout: 'fixed',
      boxSizing: 'border-box',
      position: 'relative',
      width: '100%', // 항상 100%로 설정하여 부모 폭에 맞춤
      maxWidth: '100%',
      fontSize: '13.33px',
      lineHeight: 1.1,
      fontFamily: "'Malgun Gothic', '맑은 고딕', Arial, sans-serif",
      fontVariantNumeric: 'tabular-nums',
      textRendering: 'optimizeLegibility',
      WebkitFontSmoothing: 'antialiased',
    };
  }, []);

  // Colgroup 렌더링
  const renderColGroup = () => {
    if (data.colWidthsPercent && data.colWidthsPercent.length > 0) {
      return (
        <colgroup>
          {data.colWidthsPercent.map((width, idx) => (
            <col key={idx} style={{ width }} />
          ))}
        </colgroup>
      );
    }
    
    if (data.colWidths && data.colWidths.length > 0) {
      return (
        <colgroup>
          {data.colWidths.map((width, idx) => (
            <col key={idx} style={{ width }} />
          ))}
        </colgroup>
      );
    }
    
    return null;
  };

  return (
    <div 
      className="hwp-table-wrapper"
      style={{
        maxWidth: '100%',
        overflowX: 'auto',
        overflowY: 'visible',
        margin: nested ? 0 : '10px 0',
        position: 'relative',
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <table className="hwp-table" style={tableStyle}>
        {renderColGroup()}
      <tbody>
        {data.rows.map((row, rowIndex) => (
          <TableRow 
            key={rowIndex} 
            data={row} 
            images={images}
            sectionIndex={sectionIndex}
            tableIndex={tableIndex}
            rowIndex={rowIndex}
          />
        ))}
      </tbody>
      </table>
    </div>
  );
}

// 테이블 행 컴포넌트
interface TableRowProps {
  data: HWPXTableRow;
  images: Map<string, string>;
  sectionIndex: number;
  tableIndex: number;
  rowIndex: number;
}

function TableRow({ data, images, sectionIndex, tableIndex, rowIndex }: TableRowProps) {
  const rowStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {};
    
    if (data.height) {
      style.height = data.height;
      style.maxHeight = data.height;
      style.minHeight = data.height;
    }
    
    return style;
  }, [data.height]);

  return (
    <tr className="hwp-table-row" style={rowStyle}>
      {data.cells.map((cell, cellIndex) => (
        <TableCell 
          key={cellIndex} 
          data={cell} 
          images={images}
          sectionIndex={sectionIndex}
          tableIndex={tableIndex}
          rowIndex={rowIndex}
          colIndex={cellIndex}
        />
      ))}
    </tr>
  );
}

// 테이블 셀 컴포넌트
interface TableCellProps {
  data: HWPXTableCell;
  images: Map<string, string>;
  sectionIndex: number;
  tableIndex: number;
  rowIndex: number;
  colIndex: number;
}

function TableCell({ data, images, sectionIndex, tableIndex, rowIndex, colIndex }: TableCellProps) {
  // 셀 선택 Store
  const { mode, toggleCell, getSelection } = useCellSelectionStore();
  const cellKey = makeCellKey(sectionIndex, tableIndex, rowIndex, colIndex);
  const selection = getSelection(cellKey);
  // 셀 텍스트 길이 계산
  const cellTextLength = useMemo(() => {
    return data.elements?.reduce((total, elem) => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        return total + (para.runs?.reduce((sum, run) => 
          sum + (run.text?.length || 0), 0) || 0);
      }
      return total;
    }, 0) || 0;
  }, [data.elements]);

  const isLongContent = cellTextLength > 100;

  // 셀 스타일 계산
  const cellStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'relative',
      padding: data.padding || '3px 5px',
      verticalAlign: data.verticalAlign || 'top',
      wordBreak: 'break-word',
      wordWrap: 'break-word',
      fontSize: '13.33px',
      lineHeight: 1.1,
      boxSizing: 'border-box',
      whiteSpace: 'pre-wrap',
    };

    // 배경색
    if (data.backgroundColor) {
      style.backgroundColor = data.backgroundColor;
      if ((data as any).opacity !== undefined && (data as any).opacity !== 1.0) {
        style.opacity = (data as any).opacity;
      }
    }

    // 배경 그라디언트
    if (data.backgroundGradient) {
      style.background = data.backgroundGradient;
    }

    // 배경 이미지
    if (data.backgroundImage && images) {
      const imageData = images.get(data.backgroundImage.binaryItemIDRef);
      if (imageData) {
        const mode = data.backgroundImage.mode || 'TILE';
        const backgroundSize = mode === 'TOTAL' ? 'cover' : 
                               mode === 'TILE' ? 'auto' : 
                               mode === 'CENTER' ? 'contain' : '100% 100%';
        const backgroundRepeat = mode === 'TILE' ? 'repeat' : 'no-repeat';
        const backgroundPosition = mode === 'CENTER' ? 'center' : '0 0';
        
        style.backgroundImage = `url(${imageData})`;
        style.backgroundSize = backgroundSize;
        style.backgroundRepeat = backgroundRepeat;
        style.backgroundPosition = backgroundPosition;
      }
    }

    // 패턴
    if ((data as any).patternType && (data as any).patternForeground) {
      const patternColor = (data as any).patternForeground;
      const baseColor = data.backgroundColor || '#ffffff';
      style.backgroundColor = baseColor;
      style.backgroundImage = `repeating-linear-gradient(45deg, ${patternColor}20, ${patternColor}20 2px, transparent 2px, transparent 10px)`;
    }

    // 텍스트 정렬
    if (data.textAlign) {
      style.textAlign = data.textAlign as React.CSSProperties['textAlign'];
    }

    // 수직 정렬
    if (data.verticalAlign) {
      style.verticalAlign = data.verticalAlign;
      if (data.verticalAlign === 'middle') {
        style.display = 'table-cell';
      }
    }

    // 셀 너비 - colgroup으로 제어하므로 개별 셀에는 설정하지 않음
    // table-layout: fixed가 적용되면 colgroup의 col 스타일이 우선됨

    // 셀 높이 - 자동 확장
    if (data.height) {
      style.minHeight = data.height;
      style.height = 'auto';
    }

    // 테두리 - 정밀 처리
    if (data.borderTop && data.borderTop.visible !== false) {
      const { width, style: borderStyle, color } = data.borderTop;
      style.borderTop = `${width}px ${borderStyle || 'solid'} ${color || '#000'}`;
    } else {
      style.borderTop = 'none';
    }

    if (data.borderBottom && data.borderBottom.visible !== false) {
      const { width, style: borderStyle, color } = data.borderBottom;
      style.borderBottom = `${width}px ${borderStyle || 'solid'} ${color || '#000'}`;
    } else {
      style.borderBottom = 'none';
    }

    if (data.borderLeft && data.borderLeft.visible !== false) {
      const { width, style: borderStyle, color } = data.borderLeft;
      style.borderLeft = `${width}px ${borderStyle || 'solid'} ${color || '#000'}`;
    } else {
      style.borderLeft = 'none';
    }

    if (data.borderRight && data.borderRight.visible !== false) {
      const { width, style: borderStyle, color } = data.borderRight;
      style.borderRight = `${width}px ${borderStyle || 'solid'} ${color || '#000'}`;
    } else {
      style.borderRight = 'none';
    }

    // 기본 테두리 (정의되지 않은 경우)
    const hasBorder = data.borderTop || data.borderBottom || data.borderLeft || data.borderRight;
    if (!hasBorder) {
      style.border = '1px solid #000';
    }

    // 긴 내용 압축
    if (isLongContent) {
      style.padding = '2px 3px';
      style.lineHeight = 1.0;
    }

    return style;
  }, [data, images, isLongContent]);

  // 셀 텍스트 추출 (선택용)
  const extractCellText = useCallback((): string => {
    return data.elements?.map(elem => {
      if (elem.type === 'paragraph') {
        const para = elem as HWPXParagraph;
        return para.runs?.map(run => run.text || '').join('') || '';
      }
      return '';
    }).join('\n').trim() || '';
  }, [data.elements]);

  // 셀 클릭 핸들러
  const handleCellClick = useCallback((e: React.MouseEvent) => {
    if (!mode.isActive) return;
    
    e.stopPropagation();
    
    const cellContent = extractCellText();
    toggleCell({
      section: sectionIndex,
      table: tableIndex,
      row: rowIndex,
      col: colIndex,
      content: cellContent,
      isHeader: rowIndex === 0 || colIndex === 0  // 첫 행/열은 헤더로 추정
    });
  }, [mode.isActive, sectionIndex, tableIndex, rowIndex, colIndex, extractCellText, toggleCell]);

  // 선택 상태 스타일
  const selectionStyle = useMemo((): React.CSSProperties => {
    if (!mode.isActive) return {};
    
    if (selection) {
      if (selection.role === 'keep') {
        return {
          outline: '3px solid #10b981',
          outlineOffset: '-3px',
          backgroundColor: data.backgroundColor || 'rgba(16, 185, 129, 0.08)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        };
      } else if (selection.role === 'generate') {
        return {
          outline: '3px solid #3b82f6',
          outlineOffset: '-3px',
          backgroundColor: data.backgroundColor || 'rgba(59, 130, 246, 0.08)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        };
      }
    }
    
    // 선택 모드이지만 선택 안 됨
    return {
      opacity: 0.6,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    };
  }, [mode.isActive, selection, data.backgroundColor]);

  // 합쳐진 스타일
  const finalStyle = useMemo(() => ({
    ...cellStyle,
    ...selectionStyle
  }), [cellStyle, selectionStyle]);

  return (
    <td 
      className="hwp-table-cell"
      style={finalStyle}
      onClick={handleCellClick}
      colSpan={data.colSpan}
      rowSpan={data.rowSpan}
      lang="ko"
    >
      {/* 선택 상태 배지 */}
      {mode.isActive && selection && (
        <div style={{
          position: 'absolute',
          top: 2,
          right: 2,
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          backgroundColor: selection.role === 'keep' ? '#10b981' : '#3b82f6',
          color: 'white',
          fontWeight: 'bold',
          zIndex: 100,
          pointerEvents: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}>
          {selection.role === 'keep' ? '✓ 유지' : '⚡ 생성'}
        </div>
      )}
      
      {data.elements.map((element, index) => (
        <CellElement 
          key={index} 
          element={element} 
          images={images}
          isLongContent={isLongContent}
          paraIndex={index}
          cellStyle={data}
        />
      ))}
      
      {/* 대각선 렌더링 */}
      {(((data as any).slashDef?.visible) || ((data as any).backSlashDef?.visible)) && (
        <DiagonalLines 
          slash={(data as any).slashDef}
          backSlash={(data as any).backSlashDef}
        />
      )}
    </td>
  );
}

// 셀 내부 요소 렌더러
interface CellElementProps {
  element: HWPXElement;
  images: Map<string, string>;
  isLongContent: boolean;
  paraIndex: number;
  cellStyle?: HWPXTableCell;
}

function CellElement({ element, images, isLongContent, paraIndex, cellStyle }: CellElementProps) {
  if (element.type === 'paragraph') {
    const para = element as HWPXParagraph;
    
    // 셀 정렬 우선
    const paraStyle: React.CSSProperties = {
      padding: 0,
      wordBreak: 'keep-all',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      textRendering: 'optimizeLegibility',
    };

    // margin 개별 속성 설정 (shorthand 사용 안 함)
    if (isLongContent) {
      paraStyle.lineHeight = 1.0;
      paraStyle.marginTop = '0';
      paraStyle.marginBottom = '0';
      paraStyle.marginLeft = '0';
      paraStyle.marginRight = '0';
    } else if (paraIndex > 0) {
      paraStyle.marginTop = '1px';
      paraStyle.marginBottom = '0';
      paraStyle.marginLeft = '0';
      paraStyle.marginRight = '0';
    } else {
      paraStyle.marginTop = '0';
      paraStyle.marginBottom = '0';
      paraStyle.marginLeft = '0';
      paraStyle.marginRight = '0';
    }

    // 셀 정렬 상속
    if (cellStyle?.textAlign && !para.alignment) {
      paraStyle.textAlign = cellStyle.textAlign as React.CSSProperties['textAlign'];
      if (cellStyle.textAlign === 'justify') {
        paraStyle.textJustify = 'inter-word';
      }
    }

    return (
      <div style={paraStyle}>
        <Paragraph data={para} images={images} />
      </div>
    );
  }

  // 중첩 테이블
  if (element.type === 'table') {
    return <Table data={element as HWPXTable} images={images} nested sectionIndex={0} tableIndex={0} />;
  }

  return null;
}

// 대각선 렌더링 컴포넌트 (SVG)
interface DiagonalLinesProps {
  slash?: {
    visible: boolean;
    color: string;
    widthRaw?: number;
    width?: number;
  };
  backSlash?: {
    visible: boolean;
    color: string;
    widthRaw?: number;
    width?: number;
  };
}

function DiagonalLines({ slash, backSlash }: DiagonalLinesProps) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {/* Slash (/) */}
      {slash?.visible && (
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="0"
          stroke={slash.color || '#000'}
          strokeWidth={slash.widthRaw || slash.width || 1}
        />
      )}
      
      {/* BackSlash (\) */}
      {backSlash?.visible && (
        <line
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          stroke={backSlash.color || '#000'}
          strokeWidth={backSlash.widthRaw || backSlash.width || 1}
        />
      )}
    </svg>
  );
}

export default Table;
