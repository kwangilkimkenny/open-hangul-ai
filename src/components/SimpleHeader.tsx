/**
 * Simple Header for HWPX Viewer
 * 파일 열기, 저장, 인쇄 등 기본 기능
 *
 * @version 2.0.0
 */

import { useRef, useCallback, memo } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import type { HWPXViewerInstance } from '../types/viewer';
import { devLog, devWarn } from '../utils/logger';

interface AdditionalButton {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface SimpleHeaderProps {
  onFileSelect?: (file: File) => void;
  viewer?: HWPXViewerInstance | null;
  /** 헤더 제목 */
  title?: string;
  /** 부제목 */
  subtitle?: string;
  /** 로고 (ReactNode 또는 이미지 URL) */
  logo?: ReactNode | string;
  /** 추가 버튼 */
  additionalButtons?: AdditionalButton[];
  /** 헤더 배경 그라디언트 */
  backgroundGradient?: string;
}

export const SimpleHeader = memo(function SimpleHeader({
  onFileSelect,
  viewer,
  title = '오픈한글 AI',
  subtitle = 'HWPX Viewer & AI Editor',
  logo,
  additionalButtons = [],
  backgroundGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
}: SimpleHeaderProps) {
  // 파일 입력 ref - 디버깅용
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    devLog('📁 [SimpleHeader] File change event triggered');
    devLog('📁 [SimpleHeader] Selected file:', file?.name, 'size:', file?.size);

    if (file) {
      if (!file.name.toLowerCase().match(/\.(hwpx|hwp|md)$/i)) {
        toast.error('HWPX 파일만 지원됩니다');
        return;
      }
      devLog('✅ [SimpleHeader] Calling onFileSelect with:', file.name);
      onFileSelect?.(file);
    } else {
      devWarn('⚠️ [SimpleHeader] No file selected');
    }

    // 같은 파일 다시 선택할 수 있도록 초기화
    e.target.value = '';
  }, [onFileSelect]);

  const handleSave = useCallback(async () => {
    if (!viewer) {
      toast.error('뷰어가 초기화되지 않았습니다');
      return;
    }

    devLog('💾 Save button clicked');
    devLog('🔍 Has saveFile?', typeof viewer.saveFile);
    devLog('🔍 Has aiController?', !!viewer.getAIController);

    // Vanilla Viewer의 saveFile 메서드 호출
    if (typeof viewer.saveFile === 'function') {
      try {
        toast.loading('저장 중...', { id: 'saving' });
        await viewer.saveFile();
        toast.dismiss('saving');
        toast.success('✅ 저장 완료!');
      } catch (error) {
        console.error('❌ Save error:', error);
        toast.dismiss('saving');
        const message = error instanceof Error ? error.message : '알 수 없는 오류';
        toast.error(`저장 실패: ${message}`);
      }
    } else {
      console.error('❌ saveFile method not found on viewer');
      toast.error('저장 기능이 지원되지 않습니다');
    }
  }, [viewer]);

  const handlePrint = useCallback(() => {
    if (!viewer) {
      toast.error('뷰어가 초기화되지 않았습니다');
      return;
    }

    // Vanilla Viewer의 printDocument 메서드 호출
    if (viewer.printDocument) {
      viewer.printDocument();
    } else {
      window.print();
    }
  }, [viewer]);

  // 버튼 스타일 헬퍼
  const getButtonStyle = (variant?: 'primary' | 'secondary' | 'danger') => {
    const baseStyle = {
      padding: '10px 20px',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    };

    switch (variant) {
      case 'primary':
        return { ...baseStyle, background: 'rgba(76, 175, 80, 0.3)' };
      case 'danger':
        return { ...baseStyle, background: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { ...baseStyle, background: 'rgba(255, 255, 255, 0.2)' };
    }
  };

  return (
    <>
      <header
        style={{
          height: '64px',
          background: backgroundGradient,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'relative',
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 커스텀 로고 */}
          {logo &&
            (typeof logo === 'string' ? (
              <img src={logo} alt="Logo" style={{ height: '32px' }} />
            ) : (
              logo
            ))}
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              letterSpacing: '-0.5px',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 500,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* 파일 열기 - 파일 입력을 버튼 스타일 div 위에 겹쳐서 실제 클릭 */}
          <label
            aria-label="HWPX 파일 열기"
            style={{
              position: 'relative',
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            📁 파일 열기
            <input
              ref={fileInputRef}
              type="file"
              accept=".hwpx,.hwp,.md"
              onChange={handleFileChange}
              aria-label="Load HWPX file"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
          </label>

          <button
            onClick={handleSave}
            aria-label="문서 저장 (Ctrl+S)"
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            title="Ctrl+S"
          >
            💾 저장
          </button>

          <button
            onClick={handlePrint}
            aria-label="인쇄 (Ctrl+P)"
            style={{
              visibility: 'hidden', // 임시로 숨김
              position: 'absolute', // 레이아웃에서 제거
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            title="Ctrl+P"
          >
            🖨️ 인쇄
          </button>

          {/* 추가 버튼 */}
          {additionalButtons.map(btn => (
            <button
              key={btn.id}
              onClick={btn.onClick}
              disabled={btn.disabled}
              style={{
                ...getButtonStyle(btn.variant),
                opacity: btn.disabled ? 0.5 : 1,
                cursor: btn.disabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!btn.disabled) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={e => {
                if (!btn.disabled) {
                  e.currentTarget.style.background = getButtonStyle(btn.variant)
                    .background as string;
                }
              }}
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>
      </header>

      {/* 파일 입력은 이제 버튼 위에 직접 배치됨 - 브라우저 보안 정책 준수 */}
    </>
  );
});

export default SimpleHeader;
