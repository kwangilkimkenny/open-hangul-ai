/**
 * Track Changes Panel
 * 변경 추적 사이드바 패널
 */
import { useState, useEffect, useCallback } from 'react';

interface TrackedChange {
  id: string;
  type: 'insert' | 'delete' | 'modify';
  author: string;
  timestamp: number;
  oldContent: string | null;
  newContent: string | null;
  status: 'pending' | 'accepted' | 'rejected';
}

interface TrackChangesPanelProps {
  viewer: any;
  onClose?: () => void;
}

export function TrackChangesPanel({ viewer, onClose }: TrackChangesPanelProps) {
  const [changes, setChanges] = useState<TrackedChange[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [authorName, setAuthorName] = useState('사용자');

  const refreshChanges = useCallback(() => {
    const tracker = viewer?.changeTracker;
    if (tracker) {
      setChanges(tracker.getChanges());
      setIsTracking(tracker.isTracking);
    }
  }, [viewer]);

  useEffect(() => {
    refreshChanges();
    const tracker = viewer?.changeTracker;
    if (tracker) {
      tracker.onChange(() => refreshChanges());
    }
    return () => {
      if (tracker) tracker.onChange(null);
    };
  }, [viewer, refreshChanges]);

  const toggleTracking = () => {
    const tracker = viewer?.changeTracker;
    if (!tracker) return;
    if (isTracking) {
      tracker.disable();
    } else {
      tracker.enable(authorName);
    }
    setIsTracking(!isTracking);
  };

  const accept = (id: string) => {
    viewer?.changeTracker?.acceptChange(id);
    refreshChanges();
  };

  const reject = (id: string) => {
    viewer?.changeTracker?.rejectChange(id);
    refreshChanges();
  };

  const acceptAll = () => {
    viewer?.changeTracker?.acceptAll();
    refreshChanges();
  };

  const rejectAll = () => {
    viewer?.changeTracker?.rejectAll();
    refreshChanges();
  };

  const pendingChanges = changes.filter(c => c.status === 'pending');
  const typeLabel: Record<string, string> = { insert: '삽입', delete: '삭제', modify: '수정' };
  const typeColor: Record<string, string> = { insert: '#2e7d32', delete: '#c62828', modify: '#1565c0' };

  return (
    <div style={{ width: 320, borderLeft: '1px solid #ddd', background: '#fafafa', display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #ddd', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>변경 추적</strong>
          {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888' }}>x</button>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            type="text"
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            placeholder="작성자 이름"
            style={{ flex: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
            disabled={isTracking}
          />
          <button
            onClick={toggleTracking}
            style={{
              padding: '4px 12px', border: '1px solid', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: isTracking ? '#c62828' : '#2e7d32', color: '#fff', borderColor: isTracking ? '#c62828' : '#2e7d32',
            }}
          >
            {isTracking ? '추적 중지' : '추적 시작'}
          </button>
        </div>

        {pendingChanges.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={acceptAll} style={{ flex: 1, padding: '3px 8px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 3, fontSize: 11, cursor: 'pointer', color: '#2e7d32' }}>
              모두 수락 ({pendingChanges.length})
            </button>
            <button onClick={rejectAll} style={{ flex: 1, padding: '3px 8px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 3, fontSize: 11, cursor: 'pointer', color: '#c62828' }}>
              모두 거부
            </button>
          </div>
        )}
      </div>

      {/* Change List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {pendingChanges.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 24, fontSize: 13 }}>
            {isTracking ? '변경 사항이 없습니다' : '추적을 시작하세요'}
          </div>
        ) : (
          pendingChanges.map(change => (
            <div key={change.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 4, padding: '8px 10px', marginBottom: 6, borderLeft: `3px solid ${typeColor[change.type] || '#666'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: typeColor[change.type] || '#666' }}>
                  {typeLabel[change.type] || change.type}
                </span>
                <span style={{ fontSize: 10, color: '#999' }}>
                  {new Date(change.timestamp).toLocaleTimeString('ko-KR')}
                </span>
              </div>

              {change.oldContent && (
                <div style={{ fontSize: 11, color: '#c62828', textDecoration: 'line-through', marginBottom: 2, wordBreak: 'break-all' }}>
                  {change.oldContent.length > 60 ? change.oldContent.slice(0, 60) + '...' : change.oldContent}
                </div>
              )}
              {change.newContent && (
                <div style={{ fontSize: 11, color: '#2e7d32', marginBottom: 4, wordBreak: 'break-all' }}>
                  {change.newContent.length > 60 ? change.newContent.slice(0, 60) + '...' : change.newContent}
                </div>
              )}

              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={() => accept(change.id)} style={{ padding: '2px 8px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 3, fontSize: 10, cursor: 'pointer', color: '#2e7d32' }}>
                  수락
                </button>
                <button onClick={() => reject(change.id)} style={{ padding: '2px 8px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 3, fontSize: 10, cursor: 'pointer', color: '#c62828' }}>
                  거부
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid #ddd', fontSize: 10, color: '#999', textAlign: 'center' }}>
        전체 {changes.length}건 | 대기 {pendingChanges.length}건
      </div>
    </div>
  );
}

export default TrackChangesPanel;
