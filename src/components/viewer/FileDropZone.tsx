/**
 * File Drop Zone Component
 * 파일 드래그 앤 드롭 영역
 * 
 * @module components/viewer/FileDropZone
 * @version 1.0.0
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileDropZoneProps {
  onFileDrop: (file: File) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileDropZone({ onFileDrop, onFileSelect }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.hwpx')) {
      onFileDrop(file);
    }
  }, [onFileDrop]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div 
      className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".hwpx"
        onChange={onFileSelect}
        style={{ display: 'none' }}
      />
      
      <div className="drop-zone-content">
        <div className="drop-zone-icon">
          {isDragOver ? <FileText size={64} /> : <Upload size={64} />}
        </div>
        
        <h2 className="drop-zone-title">
          {isDragOver ? '파일을 놓으세요!' : 'HWPX 파일을 여기에 드롭하세요'}
        </h2>
        
        <p className="drop-zone-subtitle">
          또는 클릭하여 파일 선택
        </p>
        
        <div className="drop-zone-hint">
          <span className="hint-icon">ℹ️</span>
          <span>지원 형식: .hwpx (한글 문서)</span>
        </div>
      </div>
    </div>
  );
}

export default FileDropZone;

