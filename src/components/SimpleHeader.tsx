/**
 * Simple Header for HWPX Viewer
 * 파일 열기, 저장, 인쇄 등 기본 기능
 * 
 * @version 1.0.0
 */

import { useRef } from 'react';
import { toast } from 'react-hot-toast';

interface SimpleHeaderProps {
  onFileSelect?: (file: File) => void;
  viewer?: any; // ✅ Vanilla Viewer 인스턴스
}

export function SimpleHeader({ onFileSelect, viewer }: SimpleHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.hwpx')) {
        toast.error('HWPX 파일만 지원됩니다');
        return;
      }
      onFileSelect?.(file);
    }
  };

  const handleSave = async () => {
    if (!viewer) {
      toast.error('뷰어가 초기화되지 않았습니다');
      return;
    }
    
    console.log('💾 Save button clicked');
    console.log('🔍 Has saveFile?', typeof viewer.saveFile);
    console.log('🔍 Has aiController?', !!viewer.aiController);
    
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
        toast.error(`저장 실패: ${error.message}`);
      }
    } else {
      console.error('❌ saveFile method not found on viewer');
      toast.error('저장 기능이 지원되지 않습니다');
    }
  };

  const handlePrint = () => {
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
  };

  return (
    <>
      <header
        style={{
          height: '64px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              letterSpacing: '-0.5px',
            }}
          >
            HAN-View
          </h1>
          <span
            style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: 500,
            }}
          >
            HWPX Viewer & AI Editor
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleFileClick}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            📁 파일 열기
          </button>

          <button
            onClick={handleSave}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            title="Ctrl+S"
          >
            💾 저장
          </button>

          <button
            onClick={handlePrint}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            title="Ctrl+P"
          >
            🖨️ 인쇄
          </button>
        </div>
      </header>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".hwpx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </>
  );
}

export default SimpleHeader;

