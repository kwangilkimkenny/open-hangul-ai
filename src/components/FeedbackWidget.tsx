/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import './FeedbackWidget.css';

interface FeedbackWidgetProps {
  /** 피드백 제출 시 호출되는 콜백 함수 */
  onSubmit?: (feedback: FeedbackData) => void;
  /** 위젯 위치 */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** 위젯 표시 여부 제어 */
  enabled?: boolean;
  /** 커스텀 스타일 */
  className?: string;
}

export interface FeedbackData {
  /** 피드백 유형 */
  type: 'bug' | 'feature' | 'general' | 'performance' | 'docs';
  /** 만족도 점수 (1-5) */
  rating: number;
  /** 피드백 메시지 */
  message: string;
  /** 이메일 (선택사항) */
  email?: string;
  /** 사용자 환경 정보 */
  userInfo: {
    version: string;
    browser: string;
    timestamp: string;
    url: string;
  };
}

/**
 * 사용자 피드백을 수집하는 위젯 컴포넌트
 *
 * @example
 * ```tsx
 * <FeedbackWidget
 *   position="bottom-right"
 *   onSubmit={(feedback) => console.log(feedback)}
 * />
 * ```
 */
export function FeedbackWidget({
  onSubmit,
  position = 'bottom-right',
  enabled = true,
  className,
}: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [feedback, setFeedback] = useState<Partial<FeedbackData>>({
    type: 'general',
    rating: 3,
  });

  // 사용자 동의 확인
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('han-view-analytics-consent');
    setHasConsent(consent === 'true');
  }, []);

  if (!enabled || !hasConsent) {
    return null;
  }

  const handleSubmit = async () => {
    if (!feedback.message?.trim() || !feedback.rating) {
      alert('피드백 내용과 평점을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    const feedbackData: FeedbackData = {
      type: feedback.type || 'general',
      rating: feedback.rating || 3,
      message: feedback.message.trim(),
      email: feedback.email?.trim(),
      userInfo: {
        version: '5.0.1',
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      },
    };

    try {
      if (onSubmit) {
        await onSubmit(feedbackData);
      } else {
        // 기본: GitHub Issue 생성 URL로 리다이렉트
        const issueUrl = createGitHubIssueUrl(feedbackData);
        window.open(issueUrl, '_blank');
      }

      // 성공 상태 표시
      setShowThankYou(true);
      setTimeout(() => {
        setIsOpen(false);
        setShowThankYou(false);
        setFeedback({ type: 'general', rating: 3 });
      }, 2000);
    } catch (error) {
      console.error('피드백 전송 실패:', error);
      alert('피드백 전송에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createGitHubIssueUrl = (data: FeedbackData): string => {
    const typeLabels = {
      bug: '🐛 버그',
      feature: '✨ 기능 요청',
      general: '💬 일반 피드백',
      performance: '⚡ 성능',
      docs: '📚 문서',
    };

    const title = `[USER FEEDBACK] ${typeLabels[data.type]}: ${data.message.slice(0, 50)}...`;

    const body = `
## 피드백 유형
${typeLabels[data.type]}

## 만족도
${'⭐'.repeat(data.rating)} (${data.rating}/5)

## 내용
${data.message}

${data.email ? `## 연락처\n${data.email}` : ''}

## 환경 정보
- **버전**: ${data.userInfo.version}
- **URL**: ${data.userInfo.url}
- **브라우저**: ${data.userInfo.browser}
- **시간**: ${data.userInfo.timestamp}

---
*이 피드백은 오픈한글AI 피드백 위젯을 통해 자동 생성되었습니다.*
    `.trim();

    const url = new URL('https://github.com/kwangilkimkenny/open-hangul-ai/issues/new');
    url.searchParams.set('title', title);
    url.searchParams.set('body', body);
    url.searchParams.set('labels', `feedback,user-experience,${data.type}`);

    return url.toString();
  };

  const typeOptions = [
    { value: 'general', label: '💬 일반 피드백', description: '전반적인 사용 경험' },
    { value: 'bug', label: '🐛 버그 신고', description: '오류나 문제점' },
    { value: 'feature', label: '✨ 기능 요청', description: '새로운 기능 제안' },
    { value: 'performance', label: '⚡ 성능', description: '속도나 성능 관련' },
    { value: 'docs', label: '📚 문서', description: '문서화 개선' },
  ];

  // 트리거 버튼
  if (!isOpen) {
    return (
      <div
        className={`feedback-widget-trigger feedback-widget-${position} ${className || ''}`}
        onClick={() => setIsOpen(true)}
        title="피드백을 남겨주세요!"
      >
        💬
        <span className="feedback-trigger-text">피드백</span>
      </div>
    );
  }

  // 감사 메시지
  if (showThankYou) {
    return (
      <div className={`feedback-widget feedback-widget-${position} ${className || ''}`}>
        <div className="feedback-widget-content feedback-thank-you">
          <div className="thank-you-animation">🎉</div>
          <h3>감사합니다!</h3>
          <p>
            소중한 피드백을 남겨주셔서 감사합니다.
            <br />더 나은 서비스로 보답하겠습니다.
          </p>
        </div>
      </div>
    );
  }

  // 피드백 폼
  return (
    <div className={`feedback-widget feedback-widget-${position} ${className || ''}`}>
      <div className="feedback-widget-content">
        <header className="feedback-header">
          <h3>피드백 남기기 🙏</h3>
          <button
            className="feedback-close"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </header>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {/* 피드백 유형 선택 */}
          <div className="feedback-field">
            <label htmlFor="feedback-type">유형</label>
            <select
              id="feedback-type"
              value={feedback.type || 'general'}
              onChange={e => setFeedback({ ...feedback, type: e.target.value as any })}
              disabled={isSubmitting}
            >
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="feedback-field-description">
              {typeOptions.find(opt => opt.value === feedback.type)?.description}
            </small>
          </div>

          {/* 만족도 평가 */}
          <div className="feedback-field">
            <label>만족도</label>
            <div className="feedback-rating">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`rating-button ${feedback.rating === num ? 'active' : ''} ${feedback.rating && feedback.rating >= num ? 'filled' : ''}`}
                  onClick={() => setFeedback({ ...feedback, rating: num })}
                  disabled={isSubmitting}
                  title={`${num}점`}
                >
                  ⭐
                </button>
              ))}
              <span className="rating-text">{feedback.rating}/5</span>
            </div>
          </div>

          {/* 피드백 메시지 */}
          <div className="feedback-field">
            <label htmlFor="feedback-message">메시지 *</label>
            <textarea
              id="feedback-message"
              placeholder="구체적인 피드백을 입력해 주세요. 어떤 점이 좋았는지, 개선이 필요한지 알려주세요."
              value={feedback.message || ''}
              onChange={e => setFeedback({ ...feedback, message: e.target.value })}
              rows={4}
              maxLength={1000}
              disabled={isSubmitting}
              required
            />
            <small className="char-count">{(feedback.message || '').length}/1000</small>
          </div>

          {/* 선택적 이메일 */}
          <div className="feedback-field">
            <label htmlFor="feedback-email">이메일 (선택사항)</label>
            <input
              id="feedback-email"
              type="email"
              placeholder="후속 연락을 원하시면 이메일을 남겨주세요"
              value={feedback.email || ''}
              onChange={e => setFeedback({ ...feedback, email: e.target.value })}
              disabled={isSubmitting}
            />
            <small className="feedback-field-description">
              이메일은 필요시 후속 질문을 위해서만 사용됩니다
            </small>
          </div>

          {/* 액션 버튼 */}
          <div className="feedback-actions">
            <button
              type="submit"
              className="feedback-submit"
              disabled={isSubmitting || !feedback.message?.trim()}
            >
              {isSubmitting ? '전송 중...' : '피드백 전송'}
            </button>
            <button
              type="button"
              className="feedback-cancel"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              취소
            </button>
          </div>
        </form>

        <footer className="feedback-footer">
          <small>
            이 피드백은{' '}
            <a
              href="https://github.com/kwangilkimkenny/open-hangul-ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Issues
            </a>
            로 전송됩니다
          </small>
        </footer>
      </div>
    </div>
  );
}

export default FeedbackWidget;
