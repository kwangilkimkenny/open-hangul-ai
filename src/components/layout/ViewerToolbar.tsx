/**
 * Viewer Toolbar Component
 * 뷰어 툴바 - 맞춤, 확대/축소, 회전
 * 
 * @module components/layout/ViewerToolbar
 * @version 1.0.0
 */

import { useCallback } from 'react';
import { 
  Maximize2, 
  Minimize2,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface ViewerToolbarProps {
  className?: string;
}

export function ViewerToolbar({ className }: ViewerToolbarProps) {
  const { zoom, setZoom, rotation, setRotation } = useUIStore();

  // 너비 맞춤
  const handleFitWidth = useCallback(() => {
    // 뷰어 컨테이너 너비에 맞춤
    const viewerContainer = document.querySelector('.viewer-main');
    const pageContainer = document.querySelector('.hwp-page-container');
    
    if (viewerContainer && pageContainer) {
      const containerWidth = viewerContainer.clientWidth - 80; // padding
      const pageWidth = 794; // A4 기본 너비
      const newZoom = Math.floor((containerWidth / pageWidth) * 100);
      setZoom(Math.min(Math.max(newZoom, 25), 300));
    }
  }, [setZoom]);

  // 페이지 맞춤
  const handleFitPage = useCallback(() => {
    // 뷰어 컨테이너에 전체 페이지가 보이도록 맞춤
    const viewerContainer = document.querySelector('.viewer-main');
    const pageContainer = document.querySelector('.hwp-page-container');
    
    if (viewerContainer && pageContainer) {
      const containerWidth = viewerContainer.clientWidth - 80;
      const containerHeight = viewerContainer.clientHeight - 80;
      const pageWidth = 794;
      const pageHeight = 1123;
      
      const widthRatio = containerWidth / pageWidth;
      const heightRatio = containerHeight / pageHeight;
      const newZoom = Math.floor(Math.min(widthRatio, heightRatio) * 100);
      
      setZoom(Math.min(Math.max(newZoom, 25), 300));
    }
  }, [setZoom]);

  // 왼쪽 회전
  const handleRotateLeft = useCallback(() => {
    setRotation((rotation - 90 + 360) % 360);
  }, [rotation, setRotation]);

  // 오른쪽 회전
  const handleRotateRight = useCallback(() => {
    setRotation((rotation + 90) % 360);
  }, [rotation, setRotation]);

  // 줌 선택 변경
  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setZoom(parseInt(e.target.value, 10));
  }, [setZoom]);

  return (
    <div className={`viewer-toolbar ${className || ''}`}>
      <div className="toolbar-group">
        <button 
          className="toolbar-btn" 
          onClick={handleFitWidth}
          title="너비 맞춤"
        >
          <Maximize2 size={16} />
          <span className="btn-text">너비 맞춤</span>
        </button>
        
        <button 
          className="toolbar-btn" 
          onClick={handleFitPage}
          title="페이지 맞춤"
        >
          <Minimize2 size={16} />
          <span className="btn-text">페이지 맞춤</span>
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <span className="toolbar-label">확대/축소:</span>
        <select 
          className="zoom-select" 
          value={zoom}
          onChange={handleZoomChange}
        >
          <option value={50}>50%</option>
          <option value={75}>75%</option>
          <option value={100}>100%</option>
          <option value={125}>125%</option>
          <option value={150}>150%</option>
          <option value={200}>200%</option>
        </select>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button 
          className="toolbar-btn" 
          onClick={handleRotateLeft}
          title="왼쪽 회전"
        >
          <RotateCcw size={16} />
          <span className="btn-text">왼쪽 회전</span>
        </button>
        
        <button 
          className="toolbar-btn" 
          onClick={handleRotateRight}
          title="오른쪽 회전"
        >
          <RotateCw size={16} />
          <span className="btn-text">오른쪽 회전</span>
        </button>
      </div>
    </div>
  );
}

export default ViewerToolbar;

