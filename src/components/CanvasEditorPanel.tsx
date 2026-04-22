/**
 * CanvasEditorPanel
 *
 * React surface that mounts canvas-editor (via the vanilla
 * CanvasEditorAdapter) onto its own container element. Use alongside
 * HWPXViewerWrapper when whole-document editing is desired:
 *
 *   const [viewer, setViewer] = useState<HWPXViewerInstance | null>(null);
 *   ...
 *   <HWPXViewerWrapper editorType="canvas" onDocumentLoad={setViewer} ... />
 *   {viewer && <CanvasEditorPanel viewer={viewer} />}
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import type { HWPXViewerInstance } from '../types/viewer';

interface CanvasEditorPanelProps {
  viewer: HWPXViewerInstance | null;
  className?: string;
  /** Called whenever the editor content changes (debounced inside adapter). */
  onChange?: (hwpxDoc: unknown) => void;
  /** Optional canvas-editor IEditorOption overrides. */
  editorOptions?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export function CanvasEditorPanel({
  viewer,
  className = '',
  onChange,
  editorOptions,
  style,
}: CanvasEditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<any>(null);

  useEffect(() => {
    if (!viewer || !containerRef.current) return;

    let cancelled = false;
    const v = viewer as any;

    (async () => {
      const adapter = await v.mountCanvasEditor(containerRef.current, editorOptions || {});
      if (cancelled) {
        adapter.destroy();
        return;
      }
      adapterRef.current = adapter;
      if (onChange) adapter.onChange(onChange);
    })();

    return () => {
      cancelled = true;
      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  useEffect(() => {
    if (adapterRef.current && onChange) {
      adapterRef.current.onChange(onChange);
    }
  }, [onChange]);

  return (
    <div
      ref={containerRef}
      className={`canvas-editor-panel ${className}`}
      style={{ width: '100%', height: '100%', overflow: 'auto', ...style }}
    />
  );
}

export default CanvasEditorPanel;
