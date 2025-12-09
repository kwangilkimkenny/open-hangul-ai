/**
 * Page Container Component
 * 참조 프로젝트 렌더링 로직 100% 포팅
 * 
 * @module components/viewer/PageContainer
 * @version 3.0.0
 */

import { useMemo } from 'react';
import type { HWPXSection, HWPXElement, HWPXParagraph, HWPXTable, HWPXImage, HWPXShape, HWPXContainer } from '../../types/hwpx';
import { Paragraph } from './Paragraph';
import { Table } from './Table';
import { Image } from './Image';
import { Shape, Container } from './Shape';
import { HWPXConstants } from '../../lib/core/constants';

interface PageContainerProps {
  section: HWPXSection;
  pageNumber: number;
  images: Map<string, string>;
  sectionIndex?: number;
}

export function PageContainer({ section, pageNumber, images, sectionIndex = 0 }: PageContainerProps) {
  // 페이지 스타일 계산
  const pageStyle = useMemo((): React.CSSProperties => {
    const settings = section.pageSettings || {};
    
    const defaultWidth = `${HWPXConstants.PAGE_WIDTH_A4_PX}px`;
    const defaultHeight = `${HWPXConstants.PAGE_HEIGHT_A4_PX}px`;
    const defaultPadding = `${HWPXConstants.PAGE_PADDING_DEFAULT}px`;
    
    return {
      width: settings.width || defaultWidth,
      minHeight: settings.height || defaultHeight,
      paddingTop: settings.marginTop || defaultPadding,
      paddingBottom: settings.marginBottom || defaultPadding,
      paddingLeft: settings.marginLeft || defaultPadding,
      paddingRight: settings.marginRight || defaultPadding,
      boxSizing: 'border-box',
      position: 'relative',
    };
  }, [section.pageSettings]);

  // 테이블 인덱스 계산
  let tableIndex = 0;

  return (
    <div 
      className="hwp-page-container"
      data-page-number={pageNumber}
      style={pageStyle}
    >
      {section.elements.map((element, index) => {
        const currentTableIndex = element.type === 'table' ? tableIndex++ : -1;
        return (
          <ElementRenderer
            key={`${element.type}-${index}`}
            element={element}
            images={images}
            sectionIndex={sectionIndex}
            elementIndex={index}
            tableIndex={currentTableIndex}
          />
        );
      })}
    </div>
  );
}

// 요소 타입별 렌더러
interface ElementRendererProps {
  element: HWPXElement;
  images: Map<string, string>;
  sectionIndex: number;
  elementIndex: number;
  tableIndex: number;
}

function ElementRenderer({ element, images, sectionIndex, elementIndex, tableIndex }: ElementRendererProps) {
  switch (element.type) {
    case 'paragraph':
      return <Paragraph data={element as HWPXParagraph} images={images} sectionIndex={sectionIndex} elementIndex={elementIndex} />;
    
    case 'table':
      return <Table data={element as HWPXTable} images={images} sectionIndex={sectionIndex} tableIndex={tableIndex} />;
    
    case 'image':
      return <Image data={element as HWPXImage} images={images} />;
    
    case 'shape':
      return <Shape data={element as HWPXShape} images={images} />;
    
    case 'container':
      return <Container data={element as HWPXContainer} images={images} />;
    
    default:
      console.warn(`Unknown element type: ${(element as any).type}`);
      return null;
  }
}

export default PageContainer;
