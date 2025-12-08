/**
 * Shape Component
 * 참조 프로젝트 렌더링 로직 100% 포팅
 * 
 * @module components/viewer/Shape
 * @version 3.0.0
 */

import { useMemo } from 'react';
import type { HWPXShape, HWPXParagraph } from '../../types/hwpx';
import { Paragraph } from './Paragraph';
import { Image } from './Image';

interface ShapeProps {
  data: HWPXShape;
  images: Map<string, string>;
}

export function Shape({ data, images }: ShapeProps) {
  const shapeType = data.shapeType || data.type || 'unknown';

  // Line 렌더링 (SVG)
  if (shapeType === 'line') {
    return <LineShape data={data} />;
  }

  // 기본 도형 스타일
  const shapeStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      boxSizing: 'border-box',
      overflow: 'visible',
      textAlign: 'initial',
    };

    // 크기
    if (data.width) {
      style.width = typeof data.width === 'number' ? `${data.width}px` : data.width;
    }
    if (data.height) {
      style.height = typeof data.height === 'number' ? `${data.height}px` : data.height;
    }

    // 위치
    if (data.position) {
      if (data.position.treatAsChar || data.treatAsChar) {
        style.display = 'inline-block';
        style.verticalAlign = 'middle';
        style.overflow = 'visible';
      } else {
        style.maxWidth = '100%';
        style.overflow = 'hidden';
        style.position = 'absolute';

        const MAX_POSITION = 10000;
        
        if (data.position.x !== undefined && data.position.x !== null) {
          const x = typeof data.position.x === 'number' ? data.position.x : parseFloat(String(data.position.x));
          if (x < MAX_POSITION && x > -MAX_POSITION) {
            style.left = `${x}px`;
          }
        }

        if (data.position.y !== undefined && data.position.y !== null) {
          let y = typeof data.position.y === 'number' ? data.position.y : parseFloat(String(data.position.y));
          
          // 작은 숫자 박스 조정
          const isSmallNumberBox = (data.width || 0) < 50 && (data.height || 0) < 50 && 
            (data as any).drawText?.paragraphs?.[0]?.text?.trim().length <= 2;
          
          if (isSmallNumberBox) {
            y = y - 7;
          }
          
          if (y < MAX_POSITION && y > -MAX_POSITION) {
            style.top = `${y}px`;
          }
        }
      }
    }

    // 배경색
    if (data.fill) {
      style.backgroundColor = data.fill;
    }
    if ((data as any).style?.backgroundColor) {
      style.backgroundColor = (data as any).style.backgroundColor;
    }

    // 도형별 스타일
    if (shapeType === 'ellipse' || shapeType === 'circle') {
      style.borderRadius = '50%';
    } else if (shapeType === 'rect' || shapeType === 'rectangle') {
      style.borderRadius = '2px';
    }

    // 테두리
    const borderColor = data.stroke || (data as any).style?.borderColor;
    const borderWidth = data.strokeWidth || (data as any).style?.borderWidth;
    const borderStyle = (data as any).style?.borderStyle || 'solid';

    if (borderColor && borderWidth) {
      const width = typeof borderWidth === 'string' ? borderWidth : `${borderWidth || 1}px`;
      style.border = `${width} ${borderStyle} ${borderColor}`;
    }

    // 회전
    if ((data as any).rotation) {
      style.transform = `rotate(${(data as any).rotation}deg)`;
    }

    // 투명도
    if ((data as any).opacity !== undefined) {
      style.opacity = (data as any).opacity;
    }

    return style;
  }, [data, shapeType]);

  // DrawText 렌더링
  const renderDrawText = () => {
    const drawText = (data as any).drawText;
    if (!drawText?.paragraphs) return null;

    const textContainerStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'initial',
      alignItems: 'stretch',
    };

    // 수직 정렬
    const vertAlign = drawText.vertAlign || 'TOP';
    if (vertAlign === 'CENTER') {
      textContainerStyle.justifyContent = 'center';
    } else if (vertAlign === 'BOTTOM') {
      textContainerStyle.justifyContent = 'flex-end';
    } else {
      textContainerStyle.justifyContent = 'flex-start';
    }

    // 텍스트 여백
    if (drawText.textMargin) {
      const m = drawText.textMargin;
      if (m.right !== undefined) textContainerStyle.paddingRight = `${m.right}px`;
      if (m.bottom !== undefined) textContainerStyle.paddingBottom = `${m.bottom}px`;
      if (m.left !== undefined) textContainerStyle.paddingLeft = `${m.left}px`;
    }

    return (
      <div className="hwp-shape-drawtext" style={textContainerStyle}>
        {drawText.paragraphs.map((para: HWPXParagraph, idx: number) => (
          <div 
            key={idx}
            style={{
              lineHeight: 1.0,
              margin: 0,
              padding: 0,
              boxSizing: 'border-box',
              maxWidth: '100%',
              width: '100%',
            }}
          >
            <Paragraph data={para} images={images} />
          </div>
        ))}
      </div>
    );
  };

  // 자식 요소 렌더링
  const renderChildren = () => {
    if (!data.elements || data.elements.length === 0) return null;

    return data.elements.map((elem, idx) => {
      if (elem.type === 'paragraph') {
        return <Paragraph key={idx} data={elem as HWPXParagraph} images={images} />;
      }
      if (elem.type === 'image') {
        return <Image key={idx} data={elem as any} images={images} />;
      }
      if (elem.type === 'shape') {
        return <Shape key={idx} data={elem as HWPXShape} images={images} />;
      }
      return null;
    });
  };

  return (
    <div 
      className={`hwp-shape hwp-shape-${shapeType}`}
      style={shapeStyle}
    >
      {renderDrawText()}
      {data.text && !(data as any).drawText && (
        <div 
          className="hwp-shape-text"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            textAlign: 'center',
            overflow: 'hidden',
            fontSize: data.textStyle?.fontSize ? `${data.textStyle.fontSize}px` : undefined,
            fontFamily: data.textStyle?.fontFamily,
            color: data.textStyle?.color,
            fontWeight: data.textStyle?.fontWeight,
          }}
        >
          {data.text}
        </div>
      )}
      {renderChildren()}
    </div>
  );
}

// Line 도형 (SVG)
function LineShape({ data }: { data: HWPXShape }) {
  const x0 = (data as any).x0 || (data as any).start?.x || 0;
  const y0 = (data as any).y0 || (data as any).start?.y || 0;
  const x1 = (data as any).x1 || (data as any).end?.x || 100;
  const y1 = (data as any).y1 || (data as any).end?.y || 0;

  const minX = Math.min(x0, x1);
  const minY = Math.min(y0, y1);
  const maxX = Math.max(x0, x1);
  const maxY = Math.max(y0, y1);
  const width = maxX - minX || 100;
  const height = maxY - minY || 10;

  const svgStyle: React.CSSProperties = {
    display: 'block',
    overflow: 'visible',
  };

  if (data.position) {
    svgStyle.position = 'absolute';
    if (data.position.x !== undefined) {
      svgStyle.left = `${data.position.x}px`;
    }
    if (data.position.y !== undefined) {
      svgStyle.top = `${data.position.y}px`;
    }
  }

  const color = data.stroke || (data as any).strokeColor || (data as any).color || '#000000';
  const strokeWidth = data.strokeWidth || (data as any).width || 1;

  return (
    <svg 
      className="hwp-shape-line"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={svgStyle}
    >
      <line
        x1={x0 - minX}
        y1={y0 - minY}
        x2={x1 - minX}
        y2={y1 - minY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={(data as any).opacity}
      />
    </svg>
  );
}

// Container 컴포넌트 (그룹 객체)
interface ContainerProps {
  data: any;
  images: Map<string, string>;
}

export function Container({ data, images }: ContainerProps) {
  const containerStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'relative',
    };

    if (data.width) {
      style.width = typeof data.width === 'number' ? `${data.width}px` : data.width;
    }
    if (data.height) {
      style.height = typeof data.height === 'number' ? `${data.height}px` : data.height;
    }

    if (data.treatAsChar) {
      style.display = 'inline-block';
      style.verticalAlign = 'middle';
    } else {
      style.display = 'block';
    }

    // 큰 컨테이너
    if (data.width && data.width > 500) {
      style.display = 'block';
      style.marginTop = '10px';
      style.marginBottom = '10px';
    }

    return style;
  }, [data]);

  return (
    <div className="hwp-container" style={containerStyle}>
      {data.elements?.map((elem: any, idx: number) => {
        if (elem.type === 'image') {
          return <Image key={idx} data={elem} images={images} />;
        }
        if (elem.type === 'shape') {
          return <Shape key={idx} data={elem} images={images} />;
        }
        if (elem.type === 'container') {
          return <Container key={idx} data={elem} images={images} />;
        }
        return null;
      })}
    </div>
  );
}

export default Shape;
