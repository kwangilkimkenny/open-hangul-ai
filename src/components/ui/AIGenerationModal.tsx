/**
 * AI Generation Modal Component
 * AI 콘텐츠 생성 모달 (요청 → 미리보기 → 적용)
 * 
 * @module components/ui/AIGenerationModal
 * @version 1.0.0
 */

import { useState } from 'react';
import { X, Sparkles, Check, Loader2 } from 'lucide-react';
import { InlineContentGenerator, type InlineGenerationContext } from '../../lib/ai/inline-generator';
import { getLogger } from '../../lib/utils/logger';
import '../../styles/editing.css';

const logger = getLogger();

export interface AIGenerationModalProps {
  isOpen: boolean;
  context: InlineGenerationContext;
  onClose: () => void;
  onApply: (content: string) => void;
}

export function AIGenerationModal({
  isOpen,
  context,
  onClose,
  onApply,
}: AIGenerationModalProps) {
  const [userRequest, setUserRequest] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!userRequest.trim()) {
      setError('요청 내용을 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      logger.info('🤖 AI 생성 시작:', userRequest);

      const generator = new InlineContentGenerator();
      const result = await generator.generateContent(context, userRequest);

      setGeneratedContent(result.content);
      logger.info('✅ AI 생성 완료:', result.content.slice(0, 50) + '...');
    } catch (err) {
      logger.error('❌ AI 생성 실패:', err);
      setError(err instanceof Error ? err.message : 'AI 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!generatedContent.trim()) {
      setError('적용할 내용이 없습니다. 먼저 생성 버튼을 클릭해주세요.');
      return;
    }

    logger.info('✅ 생성된 내용 적용:', generatedContent.slice(0, 50) + '...');
    onApply(generatedContent);
    handleClose();
  };

  const handleClose = () => {
    setUserRequest('');
    setGeneratedContent('');
    setError(null);
    setIsGenerating(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && e.ctrlKey && userRequest.trim()) {
      handleGenerate();
    }
  };

  return (
    <div className="ai-generation-modal-overlay" onClick={handleClose}>
      <div
        className="ai-generation-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="ai-generation-modal-header">
          <div className="ai-generation-modal-title">
            <Sparkles size={20} />
            <span>AI로 콘텐츠 생성</span>
          </div>
          <button
            className="ai-generation-modal-close"
            onClick={handleClose}
            title="닫기 (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="ai-generation-modal-body">
          {/* 컨텍스트 정보 표시 */}
          {(context.rowHeaders?.length || context.colHeaders?.length) && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>
              {context.rowHeaders && context.rowHeaders.length > 0 && (
                <div>
                  <strong>행 헤더:</strong> {context.rowHeaders.join(', ')}
                </div>
              )}
              {context.colHeaders && context.colHeaders.length > 0 && (
                <div>
                  <strong>열 헤더:</strong> {context.colHeaders.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* 사용자 요청 입력 */}
          <div className="ai-generation-input-group">
            <label className="ai-generation-label">
              요청 내용 <span style={{ color: '#667eea' }}>*</span>
            </label>
            <textarea
              className="ai-generation-input"
              placeholder="예: 겨울 놀이 활동에 대해 작성해줘"
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              disabled={isGenerating}
              autoFocus
            />
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#999' }}>
              Ctrl+Enter로 생성
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                borderRadius: '8px',
                color: '#c33',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {/* 미리보기 */}
          <div className="ai-generation-input-group">
            <label className="ai-generation-label">미리보기</label>
            <div className="ai-generation-preview">
              {isGenerating ? (
                <div className="ai-generation-preview-loading">
                  <div className="ai-generation-loading-spinner" />
                  <span>AI가 콘텐츠를 생성하고 있습니다...</span>
                </div>
              ) : generatedContent ? (
                <div>{generatedContent}</div>
              ) : (
                <div className="ai-generation-preview-empty">
                  생성 버튼을 클릭하면 미리보기가 표시됩니다
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ai-generation-modal-footer">
          <button
            className="ai-generation-button ai-generation-button-cancel"
            onClick={handleClose}
            disabled={isGenerating}
          >
            취소
          </button>
          {!generatedContent ? (
            <button
              className="ai-generation-button ai-generation-button-generate"
              onClick={handleGenerate}
              disabled={isGenerating || !userRequest.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="ai-generation-loading-spinner" />
                  <span>생성 중...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>생성</span>
                </>
              )}
            </button>
          ) : (
            <button
              className="ai-generation-button ai-generation-button-apply"
              onClick={handleApply}
              disabled={isGenerating}
            >
              <Check size={16} />
              <span>적용</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIGenerationModal;

