/**
 * Paragraph Component
 * 참조 프로젝트 렌더링 로직 100% 포팅
 * 
 * @module components/viewer/Paragraph
 * @version 3.0.0
 */

import { useMemo, Fragment, useState, useRef, useCallback } from 'react';
import type { HWPXParagraph, HWPXRun, HWPXShape, HWPXTable } from '../../types/hwpx';
import { HWPXConstants } from '../../lib/core/constants';
import { Shape } from './Shape';
import { Table } from './Table';
import {
  toRoman,
  toLetter,
  toHangulGanada,
  toHangulJamo,
  toCircledHangul,
  toCircledDecimal,
  toKoreanHanja,
  toChineseHanja
} from '../../lib/utils/numbering';
import { useEditingStore, type EditingPath } from '../../stores/editingStore';
import { useContextMenu } from '../../hooks/useContextMenu';
import { ContextMenu, createEditingMenuItems } from '../ui/ContextMenu';
import { AIGenerationModal } from '../ui/AIGenerationModal';
import { InlineContentGenerator } from '../../lib/ai/inline-generator';

interface ParagraphProps {
  data: HWPXParagraph;
  images?: Map<string, string>;
  sectionIndex?: number;
  elementIndex?: number;
}

export function Paragraph({ data, images, sectionIndex = 0, elementIndex = 0 }: ParagraphProps) {
  // 편집 Store
  const { isEditingAt, startEditing, endEditing, updateContent } = useEditingStore();
  const editingPath: EditingPath = {
    type: 'paragraph',
    section: sectionIndex,
    element: elementIndex,
  };
  const isEditing = isEditingAt(editingPath);
  
  // Context Menu
  const contextMenu = useContextMenu();
  const [showAIModal, setShowAIModal] = useState(false);
  const paragraphRef = useRef<HTMLDivElement>(null);
  
  // 텍스트 추출
  const extractParagraphText = useCallback((): string => {
    return data.runs?.map(run => run.text || '').join('') || '';
  }, [data.runs]);
  
  // 더블클릭 핸들러 (편집 모드)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const paragraphContent = extractParagraphText();
    startEditing(editingPath, paragraphContent);
  }, [editingPath, extractParagraphText, startEditing]);
  
  // 블러 핸들러 (편집 완료)
  const handleBlur = useCallback(() => {
    if (isEditing) {
      endEditing();
    }
  }, [isEditing, endEditing]);
  
  // 입력 핸들러
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isEditing) {
      const newContent = e.currentTarget.textContent || '';
      updateContent(newContent);
    }
  }, [isEditing, updateContent]);
  
  // 우클릭 핸들러
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (paragraphRef.current) {
      contextMenu.openMenu(e, paragraphRef.current);
    }
  }, [contextMenu]);
  
  // 편집 시작
  const handleEdit = useCallback(() => {
    const paragraphContent = extractParagraphText();
    startEditing(editingPath, paragraphContent);
  }, [editingPath, extractParagraphText, startEditing]);
  
  // AI 생성 시작
  const handleAIGenerate = useCallback(() => {
    setShowAIModal(true);
  }, []);
  
  // AI 생성 적용
  const handleAIApply = useCallback((content: string) => {
    startEditing(editingPath, content);
    updateContent(content);
    endEditing();
    setShowAIModal(false);
  }, [editingPath, startEditing, updateContent, endEditing]);
  
  // AI 생성 컨텍스트 생성
  const aiContext = useMemo(() => {
    return InlineContentGenerator.createParagraphContext(
      extractParagraphText()
    );
  }, [extractParagraphText]);

  // 기본 폰트 크기 계산
  const baseFontSize = useMemo(() => {
    if (!data.runs || data.runs.length === 0) return 13.33;
    const runWithFont = data.runs.find(r => r.style?.fontSizePx || r.style?.fontSize);
    if (runWithFont?.style?.fontSizePx) {
      return parseFloat(runWithFont.style.fontSizePx);
    } else if (runWithFont?.style?.fontSize) {
      return HWPXConstants.ptToPx(parseFloat(String(runWithFont.style.fontSize)));
    }
    return 13.33;
  }, [data.runs]);

  // 문단 스타일 계산
  const paragraphStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      padding: 0,
      fontSize: `${baseFontSize}px`,
      wordBreak: 'keep-all',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      textRendering: 'optimizeLegibility',
      WebkitFontSmoothing: 'antialiased',
    };

    // 정렬
    if (data.alignment) {
      style.textAlign = data.alignment as React.CSSProperties['textAlign'];
      if (data.alignment === 'justify') {
        style.textJustify = 'inter-word';
      }
    }

    // 줄 간격
    if (data.lineHeight) {
      const lineHeightValue = typeof data.lineHeight === 'number' 
        ? data.lineHeight 
        : parseFloat(String(data.lineHeight));
      
      if (lineHeightValue > 0) {
        const lineHeightPx = baseFontSize * lineHeightValue;
        style.lineHeight = `${lineHeightPx.toFixed(2)}px`;
      }
    } else {
      style.lineHeight = 1.6;
    }

    // 여백 (개별 속성만 사용, shorthand와 혼용 금지)
    style.marginTop = data.marginTop ? `${data.marginTop}px` : '0';
    style.marginBottom = data.marginBottom ? `${data.marginBottom}px` : '0';
    style.marginLeft = data.marginLeft ? `${data.marginLeft}px` : '0';
    style.marginRight = data.marginRight ? `${data.marginRight}px` : '0';
    if (data.indent) style.textIndent = `${data.indent}px`;

    // justify + tab 처리를 위한 flex
    const hasTabs = data.runs?.some(r => r.type === 'tab');
    if (data.alignment === 'justify' && hasTabs) {
      style.display = 'flex';
      style.alignItems = 'baseline';
      style.flexWrap = 'nowrap';
    }

    return style;
  }, [data, baseFontSize]);

  // 콘텐츠 확인
  const hasContent = data.runs && data.runs.length > 0 && 
    data.runs.some(r => (r.text && r.text.trim().length > 0) || r.type === 'tab' || r.hasImage || r.hasTable);

  // 빈 문단 처리
  if (!hasContent && !data.images && !data.tables && !data.shapes) {
    return (
      <div 
        className="hwp-paragraph hwp-empty" 
        style={{
          ...paragraphStyle,
          fontSize: '13.33px',
          lineHeight: 1.1,
          minHeight: '15px',
        }}
      >
        <br />
      </div>
    );
  }

  // 번호 매기기 렌더링
  const renderNumbering = () => {
    if (!data.numbering) return null;
    
    const { level, definition, prefix } = data.numbering;
    
    if (prefix) {
      return (
        <span className="hwp-numbering hwp-numbering-marker" style={{ marginRight: '8px', minWidth: '20px', display: 'inline-block' }}>
          {prefix}
        </span>
      );
    }

    if (!definition) return null;

    const levelData = definition.levels?.find(l => l.level === level) || definition.levels?.[0];
    if (!levelData) return null;

    let markerText = '';
    const currentNumber = definition.start || 1;

    switch (levelData.format?.toUpperCase()) {
      case 'DIGIT':
      case 'DECIMAL':
      case 'KOREAN_DIGITAL':
        markerText = levelData.numberFormat?.replace('%d', currentNumber.toString()) || currentNumber.toString();
        break;
      case 'LOWER_ROMAN':
        markerText = levelData.numberFormat?.replace('%d', toRoman(currentNumber).toLowerCase()) || toRoman(currentNumber).toLowerCase();
        break;
      case 'UPPER_ROMAN':
        markerText = levelData.numberFormat?.replace('%d', toRoman(currentNumber)) || toRoman(currentNumber);
        break;
      case 'LOWER_LETTER':
      case 'LOWER_ALPHA':
        markerText = levelData.numberFormat?.replace('%d', toLetter(currentNumber).toLowerCase()) || toLetter(currentNumber).toLowerCase();
        break;
      case 'UPPER_LETTER':
      case 'UPPER_ALPHA':
        markerText = levelData.numberFormat?.replace('%d', toLetter(currentNumber)) || toLetter(currentNumber);
        break;
      case 'HANGUL_SYLLABLE':
      case 'HANGUL_GANADA':
        markerText = levelData.numberFormat?.replace('%d', toHangulGanada(currentNumber)) || toHangulGanada(currentNumber);
        break;
      case 'HANGUL_JAMO':
      case 'HANGUL_CONSONANT':
        markerText = levelData.numberFormat?.replace('%d', toHangulJamo(currentNumber)) || toHangulJamo(currentNumber);
        break;
      case 'CIRCLED_HANGUL':
        markerText = levelData.numberFormat?.replace('%d', toCircledHangul(currentNumber)) || toCircledHangul(currentNumber);
        break;
      case 'CIRCLED_DECIMAL':
      case 'CIRCLED_NUMBER':
        markerText = levelData.numberFormat?.replace('%d', toCircledDecimal(currentNumber)) || toCircledDecimal(currentNumber);
        break;
      case 'HANJA':
      case 'IDEOGRAPH_KOREAN':
      case 'KOREAN_HANJA':
        markerText = levelData.numberFormat?.replace('%d', toKoreanHanja(currentNumber)) || toKoreanHanja(currentNumber);
        break;
      case 'IDEOGRAPH':
      case 'IDEOGRAPH_TRADITIONAL':
      case 'CHINESE_HANJA':
        markerText = levelData.numberFormat?.replace('%d', toChineseHanja(currentNumber)) || toChineseHanja(currentNumber);
        break;
      case 'BULLET':
      case 'SYMBOL':
        markerText = levelData.numberFormat?.replace('%d', '') || '•';
        break;
      default:
        markerText = levelData.numberFormat?.replace('%d', currentNumber.toString()) || currentNumber.toString();
    }

    return (
      <span className="hwp-numbering hwp-numbering-marker" style={{ marginRight: '8px', minWidth: '20px', display: 'inline-block' }}>
        {markerText}
      </span>
    );
  };

  return (
    <>
      <div 
        ref={paragraphRef}
        className={`hwp-paragraph ${isEditing ? 'editing-paragraph' : ''}`}
        style={paragraphStyle}
        lang="ko"
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onBlur={handleBlur}
        onInput={handleInput}
        contentEditable={isEditing}
        suppressContentEditableWarning
      >
        {renderNumbering()}
        {data.runs?.map((run, index) => (
          <Run 
            key={index} 
            data={run} 
            images={images}
            paragraphData={data}
            paragraphStyle={paragraphStyle}
          />
        ))}
        {/* 인라인 도형 렌더링 */}
        {data.shapes && data.shapes.length > 0 && images && data.shapes.map((shape, idx) => (
          <Shape key={`shape-${idx}`} data={shape as HWPXShape} images={images} />
        ))}
      {/* 인라인 테이블 렌더링 */}
      {data.tables && data.tables.length > 0 && images && data.tables.map((table, idx) => (
        <Table key={`table-${idx}`} data={table as HWPXTable} images={images} nested />
      ))}
    </div>
    
    {/* Context Menu */}
    {contextMenu.isOpen && contextMenu.targetElement === paragraphRef.current && (
      <ContextMenu
        position={contextMenu.position}
        items={createEditingMenuItems(handleEdit, handleAIGenerate)}
        onClose={contextMenu.closeMenu}
      />
    )}
    
    {/* AI Generation Modal */}
    <AIGenerationModal
      isOpen={showAIModal}
      context={aiContext}
      onClose={() => setShowAIModal(false)}
      onApply={handleAIApply}
    />
  </>
  );
}

// Run 컴포넌트
interface RunProps {
  data: HWPXRun;
  images?: Map<string, string>;
  paragraphData?: HWPXParagraph;
  paragraphStyle?: React.CSSProperties;
}

function Run({ data, images, paragraphData, paragraphStyle }: RunProps) {
  // Tab 처리
  if (data.type === 'tab' || (data as any).isTab) {
    const widthPx = (data as any).widthPx;
    const leader = (data as any).leader;
    const isJustify = paragraphStyle?.textAlign === 'justify';
    
    const tabStyle: React.CSSProperties = {
      display: 'inline-block',
      position: 'relative',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textAlign: 'left',
    };

    // Flex 모드에서 탭 확장
    if (isJustify && leader && leader !== 0) {
      tabStyle.flexGrow = 1;
      tabStyle.flexShrink = 1;
      tabStyle.minWidth = '20px';
    } else if (widthPx) {
      tabStyle.width = `${widthPx}px`;
      tabStyle.minWidth = `${widthPx}px`;
      tabStyle.maxWidth = `${widthPx}px`;
    } else {
      tabStyle.width = '2em';
    }

    // 탭 리더 처리
    let tabContent: React.ReactNode = '\u00A0';
    if (leader !== undefined && leader !== 0) {
      switch (leader) {
        case 1: // DOT
          tabContent = '·'.repeat(100);
          tabStyle.letterSpacing = '0.3em';
          tabStyle.color = '#666';
          tabStyle.fontSize = '10.67px';
          break;
        case 2: // HYPHEN
          tabContent = '-'.repeat(100);
          tabStyle.letterSpacing = '0.2em';
          tabStyle.color = '#666';
          tabStyle.fontSize = '12px';
          break;
        case 3: // DASH (목차 점선)
          tabContent = '.'.repeat(200);
          tabStyle.letterSpacing = '0.15em';
          tabStyle.color = '#000';
          tabStyle.fontSize = '13.33px';
          tabStyle.lineHeight = 1.2;
          break;
        case 4: // LINE
          tabStyle.borderBottom = '1px solid #666';
          tabStyle.fontSize = '13.33px';
          tabStyle.lineHeight = 1.2;
          tabContent = '\u00A0';
          break;
        case 5: // MIDDLE_DOT
          tabContent = '·'.repeat(100);
          tabStyle.letterSpacing = '0.5em';
          tabStyle.color = '#666';
          tabStyle.fontSize = '13.33px';
          break;
        default:
          tabStyle.fontSize = '13.33px';
          tabStyle.lineHeight = 1.2;
      }
    }

    return (
      <span className="hwp-tab" style={tabStyle}>
        {tabContent}
      </span>
    );
  }

  // 줄바꿈 처리
  if (data.type === 'linebreak') {
    return <br />;
  }

  // 인라인 이미지 처리
  if (data.hasImage && paragraphData?.images) {
    const imageIndex = data.imageIndex ?? 0;
    const image = paragraphData.images[imageIndex];
    if (image && images) {
      const imgUrl = image.src || image.url || (image.id && images.get(image.id));
      if (imgUrl) {
        const wrapperStyle: React.CSSProperties = {
          display: 'inline-block',
          verticalAlign: 'middle',
          margin: '0 2px',
          maxWidth: '100%',
        };
        
        const imgStyle: React.CSSProperties = {
          width: image.width ? `${image.width}px` : 'auto',
          height: image.height ? `${image.height}px` : 'auto',
          maxWidth: '100%',
          display: 'block',
          objectFit: 'contain',
        };

        return (
          <span className="hwp-image-wrapper" style={wrapperStyle}>
            <img src={imgUrl} alt="" style={imgStyle} loading="lazy" />
          </span>
        );
      }
    }
    return null;
  }

  // 인라인 테이블 마커 (테이블은 별도 렌더링)
  if (data.hasTable) {
    return <span className="hwp-inline-table-placeholder" data-table-index={data.tableIndex} />;
  }

  // Run 스타일 계산
  const runStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {};
    const textStyle = data.style || {};

    // Font size
    if (textStyle.fontSizePx) {
      style.fontSize = textStyle.fontSizePx;
    } else if (textStyle.fontSize) {
      const ptValue = typeof textStyle.fontSize === 'number' 
        ? textStyle.fontSize 
        : parseFloat(String(textStyle.fontSize));
      const pxValue = HWPXConstants.ptToPx(ptValue);
      style.fontSize = `${pxValue}px`;
    }

    // Font family
    if (textStyle.fontFamily) {
      style.fontFamily = `${textStyle.fontFamily}, 'Malgun Gothic', '맑은 고딕', sans-serif`;
    }

    // Color
    if (textStyle.color) {
      style.color = textStyle.color;
    }

    // Background
    if (textStyle.backgroundColor) {
      style.backgroundColor = textStyle.backgroundColor;
      style.padding = '1px 2px';
    }

    // Bold
    if (textStyle.fontWeight === 'bold' || textStyle.bold) {
      style.fontWeight = 'bold';
    }

    // Italic
    if (textStyle.fontStyle === 'italic' || textStyle.italic) {
      style.fontStyle = 'italic';
    }

    // Text decoration
    const decorations: string[] = [];
    if (textStyle.underline) {
      decorations.push('underline');
      if (textStyle.underlineColor) {
        style.textDecorationColor = textStyle.underlineColor;
      }
    }
    if (textStyle.strikethrough) {
      decorations.push('line-through');
      if (textStyle.strikethroughColor) {
        style.textDecorationColor = textStyle.strikethroughColor;
      }
    }
    if (decorations.length > 0) {
      style.textDecoration = decorations.join(' ');
    }

    // Outline
    if (textStyle.outline) {
      style.WebkitTextStroke = '0.5px currentColor';
      (style as any).paintOrder = 'stroke fill';
    }

    // Shadow
    if (textStyle.textShadowValue) {
      style.textShadow = textStyle.textShadowValue;
    }

    // Letter spacing
    if (textStyle.letterSpacing) {
      style.letterSpacing = textStyle.letterSpacing;
    }

    // Scale X
    if (textStyle.scaleX && textStyle.scaleX !== 1) {
      style.transform = `scaleX(${textStyle.scaleX})`;
      style.display = 'inline-block';
      style.transformOrigin = 'left center';
    }

    // Vertical align
    if (textStyle.verticalAlign === 'superscript' || textStyle.verticalAlign === 'super') {
      style.verticalAlign = 'super';
      style.fontSize = '0.75em';
    } else if (textStyle.verticalAlign === 'subscript' || textStyle.verticalAlign === 'sub') {
      style.verticalAlign = 'sub';
      style.fontSize = '0.75em';
    }

    // Flex 모드에서 텍스트 shrink 방지
    if (paragraphStyle?.display === 'flex') {
      style.flexShrink = 0;
    }

    return style;
  }, [data.style, paragraphStyle]);

  // 스타일 없으면 텍스트만
  if (Object.keys(runStyle).length === 0) {
    return <Fragment>{data.text}</Fragment>;
  }

  return (
    <span className="hwp-run" style={runStyle}>
      {data.text}
    </span>
  );
}

export default Paragraph;
