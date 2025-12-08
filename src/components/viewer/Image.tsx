/**
 * Image Component
 * 참조 프로젝트 렌더링 로직 100% 포팅
 * 
 * @module components/viewer/Image
 * @version 3.0.0
 */

import { useState, useMemo } from 'react';
import type { HWPXImage, HWPXElement } from '../../types/hwpx';
import { Shape } from './Shape';

interface ImageProps {
  data: HWPXImage;
  images: Map<string, string>;
}

// 최대 콘텐츠 영역 (A4 페이지 794px - padding 114px)
const MAX_CONTENT_WIDTH = 680;

export function Image({ data, images }: ImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 이미지 URL
  const imageUrl = useMemo(() => {
    if (data.src) return data.src;
    if (data.url) return data.url;
    if (data.id && images) return images.get(data.id);
    if ((data as any).binaryItemIDRef && images) return images.get((data as any).binaryItemIDRef);
    return null;
  }, [data, images]);

  // 래퍼 스타일
  const wrapperStyle = useMemo((): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'relative',
    };

    const pos = typeof data.position === 'object' ? data.position : null;

    // 크기 설정
    if (data.width) {
      const widthValue = typeof data.width === 'number' ? data.width : parseFloat(String(data.width));
      
      // 컨테이너 내부인지 확인
      if (pos && (pos.x !== undefined || pos.y !== undefined)) {
        style.width = '100%';
        style.height = '100%';
      } else {
        if (widthValue > MAX_CONTENT_WIDTH) {
          style.maxWidth = `${MAX_CONTENT_WIDTH}px`;
          style.width = 'auto';
        } else {
          style.width = `${widthValue}px`;
          style.maxWidth = `${MAX_CONTENT_WIDTH}px`;
          if (data.height) {
            style.height = typeof data.height === 'number' ? `${data.height}px` : String(data.height);
          }
        }
      }
    }

    // 위치 설정
    if (pos) {
      if (pos.treatAsChar || data.treatAsChar) {
        style.display = 'inline-block';
        style.verticalAlign = 'middle';
      } else {
        style.position = 'absolute';
        if (pos.x !== undefined && pos.x !== null) {
          style.left = `${pos.x}px`;
        }
        if (pos.y !== undefined && pos.y !== null) {
          const yPos = pos.y < 0 ? 0 : pos.y;
          style.top = `${yPos}px`;
        }
      }
    } else if (data.position) {
      // string 타입일 경우
      style.position = 'absolute';
      style.left = '0';
      style.top = '0';
    }

    return style;
  }, [data]);

  // 이미지 스타일
  const imgStyle = useMemo((): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    height: data.height ? '100%' : 'auto',
    maxWidth: '100%',
    objectFit: 'contain',
  }), [data.height]);

  if (!imageUrl) {
    return (
      <div 
        className="hwp-image-wrapper hwp-image-missing"
        style={{
          ...wrapperStyle,
          padding: '20px',
          backgroundColor: '#f5f5f5',
          border: '1px dashed #ccc',
          color: '#666',
          fontSize: '14px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100px',
        }}
      >
        <div>🖼️</div>
        <div>이미지를 불러올 수 없습니다</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div 
        className="hwp-image-wrapper hwp-image-error"
        style={{
          ...wrapperStyle,
          padding: '20px',
          backgroundColor: '#fff5f5',
          border: '1px dashed #e74c3c',
          color: '#c0392b',
          fontSize: '14px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100px',
        }}
      >
        <div>⚠️</div>
        <div>이미지 로드 실패</div>
      </div>
    );
  }

  return (
    <div className="hwp-image-wrapper" style={wrapperStyle}>
      {!isLoaded && (
        <div 
          style={{
            width: data.width || '100%',
            height: data.height || '100px',
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          로딩 중...
        </div>
      )}
      
      <img
        className="hwp-image"
        src={imageUrl}
        alt={data.alt || '문서 이미지'}
        style={{
          ...imgStyle,
          display: isLoaded ? 'block' : 'none',
        }}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
      />
      
      {/* 자식 요소 (이미지 위에 오버레이되는 도형/컨테이너) */}
      {(data as any).children && (data as any).children.length > 0 && (
        (data as any).children.map((child: HWPXElement, idx: number) => {
          if (child.type === 'shape') {
            return (
              <div 
                key={idx}
                style={{
                  position: 'absolute',
                  zIndex: 10,
                }}
              >
                <Shape data={child as any} images={images} />
              </div>
            );
          }
          return null;
        })
      )}
    </div>
  );
}

export default Image;
