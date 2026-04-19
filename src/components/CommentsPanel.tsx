/**
 * Comments Panel
 * 댓글/리뷰 사이드바 패널
 */
import { useState, useEffect, useCallback } from 'react';

interface CommentThread {
  id: string;
  author: string;
  timestamp: number;
  text: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
  replies: Array<{ id: string; author: string; timestamp: number; text: string }>;
}

interface CommentsPanelProps {
  viewer: any;
  onClose?: () => void;
}

export function CommentsPanel({ viewer, onClose }: CommentsPanelProps) {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [authorName, _setAuthorName] = useState('사용자');

  const refresh = useCallback(() => {
    const mgr = viewer?.annotationManager;
    if (mgr?.getThreads) {
      setThreads(mgr.getThreads());
    }
  }, [viewer]);

  useEffect(() => {
    refresh();
    const mgr = viewer?.annotationManager;
    if (mgr) {
      mgr.onChange(() => refresh());
    }
    return () => { if (mgr) mgr.onChange(null); };
  }, [viewer, refresh]);

  const resolve = (id: string) => {
    viewer?.annotationManager?.resolveComment(id, authorName);
    refresh();
  };

  const unresolve = (id: string) => {
    viewer?.annotationManager?.unresolveComment(id);
    refresh();
  };

  const deleteComment = (id: string) => {
    viewer?.annotationManager?.deleteComment(id);
    refresh();
  };

  const submitReply = (parentId: string) => {
    if (!replyText.trim()) return;
    viewer?.annotationManager?.addReply(parentId, replyText, authorName);
    setReplyText('');
    setReplyingTo(null);
    refresh();
  };

  const filtered = showResolved ? threads : threads.filter(t => !t.resolved);
  const stats = viewer?.annotationManager?.getStats?.() || { total: 0, resolved: 0, unresolved: 0, replies: 0 };

  return (
    <div style={{ width: 320, borderLeft: '1px solid #ddd', background: '#fafafa', display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #ddd', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>댓글</strong>
          {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888' }}>x</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: '#666' }}>
          <span>{stats.unresolved}개 미해결</span>
          <span>{stats.resolved}개 해결</span>
          <label style={{ marginLeft: 'auto', cursor: 'pointer' }}>
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} style={{ marginRight: 4 }} />
            해결 표시
          </label>
        </div>
      </div>

      {/* Thread List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 24, fontSize: 13 }}>댓글이 없습니다</div>
        ) : (
          filtered.map(thread => (
            <div key={thread.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 8, overflow: 'hidden', opacity: thread.resolved ? 0.6 : 1 }}>
              {/* Main comment */}
              <div style={{ padding: '8px 10px', borderBottom: thread.replies.length > 0 ? '1px solid #f0f0f0' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{thread.author}</span>
                  <span style={{ fontSize: 10, color: '#999' }}>{new Date(thread.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p style={{ fontSize: 12, color: '#444', margin: '0 0 6px', lineHeight: 1.5 }}>{thread.text}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => thread.resolved ? unresolve(thread.id) : resolve(thread.id)} style={{ fontSize: 10, background: 'none', border: '1px solid #ddd', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', color: '#666' }}>
                    {thread.resolved ? '다시 열기' : '해결'}
                  </button>
                  <button onClick={() => setReplyingTo(replyingTo === thread.id ? null : thread.id)} style={{ fontSize: 10, background: 'none', border: '1px solid #ddd', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', color: '#666' }}>
                    답글
                  </button>
                  <button onClick={() => deleteComment(thread.id)} style={{ fontSize: 10, background: 'none', border: '1px solid #ddd', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', color: '#c62828' }}>
                    삭제
                  </button>
                </div>
              </div>

              {/* Replies */}
              {thread.replies.map(reply => (
                <div key={reply.id} style={{ padding: '6px 10px 6px 20px', borderBottom: '1px solid #f5f5f5', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{reply.author}</span>
                    <span style={{ fontSize: 9, color: '#bbb' }}>{new Date(reply.timestamp).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#555', margin: 0, lineHeight: 1.4 }}>{reply.text}</p>
                </div>
              ))}

              {/* Reply input */}
              {replyingTo === thread.id && (
                <div style={{ padding: '6px 10px', background: '#f5f5f5', display: 'flex', gap: 4 }}>
                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitReply(thread.id)}
                    placeholder="답글 입력..."
                    style={{ flex: 1, padding: '3px 6px', border: '1px solid #ddd', borderRadius: 3, fontSize: 11 }}
                    autoFocus
                  />
                  <button onClick={() => submitReply(thread.id)} style={{ padding: '3px 8px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}>
                    전송
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default CommentsPanel;
