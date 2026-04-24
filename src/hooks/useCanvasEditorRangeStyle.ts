/**
 * useCanvasEditorRangeStyle
 *
 * canvas-editor 의 selection 변경(`rangeStyleChange`) 이벤트를 구독해
 * 현재 caret/range 의 서식 스냅샷을 React state 로 노출한다.
 *
 * 툴바 버튼의 active 상태(굵게/기울임/정렬/리스트…) 동기화에 사용된다.
 */
import { useEffect, useState } from 'react';
import type { HWPXViewerInstance } from '../types/viewer';

export interface CanvasRangeStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeout?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  rowFlex?: 'left' | 'center' | 'right' | 'alignment' | 'justify';
  font?: string;
  size?: number;
  color?: string | null;
  highlight?: string | null;
  listType?: 'ul' | 'ol' | null;
  listStyle?: string | null;
}

interface CanvasEditorWithRangeStyle {
  canvasEditor?: {
    onRangeStyleChange?: (cb: (s: CanvasRangeStyle | null) => void) => (() => void) | void;
  };
}

export function useCanvasEditorRangeStyle(
  viewer: HWPXViewerInstance | null | undefined
): CanvasRangeStyle | null {
  const [style, setStyle] = useState<CanvasRangeStyle | null>(null);

  useEffect(() => {
    const adapter = (viewer as CanvasEditorWithRangeStyle | null | undefined)?.canvasEditor;
    if (!adapter || typeof adapter.onRangeStyleChange !== 'function') {
      // adapter 가 사라지면 다음 마이크로태스크에 reset — effect 본문에서 직접 setState 하면
      // cascading render 경고가 발생한다.
      queueMicrotask(() => setStyle(null));
      return;
    }
    const unsub = adapter.onRangeStyleChange((s: CanvasRangeStyle | null) => setStyle(s || null));
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [viewer]);

  return style;
}

export default useCanvasEditorRangeStyle;
