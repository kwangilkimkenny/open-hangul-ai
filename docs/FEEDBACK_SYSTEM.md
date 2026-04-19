# 피드백 수집 시스템

오픈한글AI 사용자들로부터 효과적으로 피드백을 수집하고 분석하기 위한 체계적인 시스템입니다.

## 📊 피드백 수집 전략

### 1. 다층적 피드백 채널
- **즉시 피드백**: 앱 내 피드백 위젯
- **구조화된 피드백**: GitHub Issues/Discussions
- **심화 피드백**: 사용자 인터뷰 및 설문조사
- **암묵적 피드백**: 사용량 분석 및 에러 추적

### 2. 타겟 사용자 세그먼트
- **신규 사용자**: 첫 사용 경험 (0-7일)
- **활성 사용자**: 정기 사용자 (1주-1달)
- **파워 유저**: 고급 기능 사용자 (1달+)
- **기업 사용자**: 프로덕션 환경 사용자

## 🛠 구현 방법

### A. GitHub 기반 피드백

#### 1. GitHub Issues 템플릿 활용
이미 구현된 이슈 템플릿을 통한 구조화된 피드백 수집:

```yaml
# .github/ISSUE_TEMPLATE/user_feedback.md
---
name: 사용자 피드백
about: 라이브러리 사용 경험에 대한 피드백을 공유해 주세요
title: "[FEEDBACK] "
labels: feedback, user-experience
assignees: ''
---

## 🎯 사용 목적
어떤 용도로 오픈한글AI를 사용하고 계신가요?
- [ ] 개인 프로젝트
- [ ] 스타트업/소규모 회사
- [ ] 중견기업
- [ ] 대기업
- [ ] 교육기관
- [ ] 정부기관
- [ ] 기타: ___________

## ⭐ 전반적인 만족도 (1-5점)
- [ ] 5점 - 매우 만족
- [ ] 4점 - 만족  
- [ ] 3점 - 보통
- [ ] 2점 - 불만족
- [ ] 1점 - 매우 불만족

## 💡 가장 유용한 기능
어떤 기능이 가장 도움이 되었나요?
- [ ] HWPX 파일 뷰어
- [ ] AI 문서 분석
- [ ] TypeScript 지원
- [ ] 커스터마이징 기능
- [ ] 다양한 파일 형식 지원
- [ ] API 문서
- [ ] 기타: ___________

## 😕 개선이 필요한 부분
어떤 부분이 개선되면 좋겠나요?
- [ ] 성능 (로딩 속도)
- [ ] UI/UX
- [ ] 문서화
- [ ] 에러 핸들링
- [ ] 브라우저 호환성
- [ ] 모바일 최적화
- [ ] 기타: ___________

## 🚀 원하는 새 기능
향후 추가되었으면 하는 기능이 있다면?

## 📝 자유 의견
기타 의견이나 제안사항을 자유롭게 작성해 주세요.

## 📞 연락처 (선택사항)
후속 인터뷰나 추가 질문을 위해 연락 가능한 이메일이 있다면:
```

#### 2. GitHub Discussions 활용
```yaml
# .github/discussions/categories.yml
feedback:
  name: "💬 사용자 피드백"
  description: "라이브러리 사용 경험을 공유해 주세요"
  
showcase:
  name: "🎨 사용 사례 쇼케이스" 
  description: "오픈한글AI로 만든 프로젝트를 소개해 주세요"

ideas:
  name: "💡 아이디어"
  description: "새로운 기능 아이디어나 개선 제안"

help:
  name: "🙋 도움말"
  description: "사용법이나 문제 해결 관련 질문"
```

### B. 웹 기반 피드백 수집

#### 1. 피드백 위젯 컴포넌트

```tsx
// src/components/FeedbackWidget.tsx
import React, { useState } from 'react';

interface FeedbackWidgetProps {
  onSubmit?: (feedback: FeedbackData) => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

interface FeedbackData {
  type: 'bug' | 'feature' | 'general';
  rating: number;
  message: string;
  userInfo?: {
    version: string;
    browser: string;
    timestamp: string;
  };
}

export function FeedbackWidget({ onSubmit, position = 'bottom-right' }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<Partial<FeedbackData>>({});

  const handleSubmit = () => {
    const feedbackData: FeedbackData = {
      type: feedback.type || 'general',
      rating: feedback.rating || 3,
      message: feedback.message || '',
      userInfo: {
        version: '5.0.1',
        browser: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    };

    // GitHub Issue 생성 또는 외부 서비스 전송
    if (onSubmit) {
      onSubmit(feedbackData);
    } else {
      // 기본: GitHub Issue로 리다이렉트
      const issueUrl = createGitHubIssueUrl(feedbackData);
      window.open(issueUrl, '_blank');
    }
    
    setIsOpen(false);
    setFeedback({});
  };

  const createGitHubIssueUrl = (data: FeedbackData) => {
    const title = `[USER FEEDBACK] ${data.type.toUpperCase()}: ${data.message.slice(0, 50)}...`;
    const body = `
## 피드백 유형: ${data.type}
## 평점: ${data.rating}/5

## 내용:
${data.message}

## 환경 정보:
- 버전: ${data.userInfo?.version}
- 브라우저: ${data.userInfo?.browser}
- 시간: ${data.userInfo?.timestamp}
    `.trim();

    const url = new URL('https://github.com/yatav-team/open-hangul-ai/issues/new');
    url.searchParams.set('title', title);
    url.searchParams.set('body', body);
    url.searchParams.set('labels', 'feedback,user-experience');
    
    return url.toString();
  };

  if (!isOpen) {
    return (
      <div 
        className={`feedback-widget-trigger ${position}`}
        onClick={() => setIsOpen(true)}
      >
        💬 피드백
      </div>
    );
  }

  return (
    <div className={`feedback-widget ${position}`}>
      <div className="feedback-widget-content">
        <h3>피드백 주세요! 🙏</h3>
        
        <div className="feedback-type">
          <label>유형:</label>
          <select 
            value={feedback.type || ''} 
            onChange={(e) => setFeedback({...feedback, type: e.target.value as any})}
          >
            <option value="">선택하세요</option>
            <option value="bug">🐛 버그 신고</option>
            <option value="feature">✨ 기능 요청</option>
            <option value="general">💬 일반 피드백</option>
          </select>
        </div>

        <div className="feedback-rating">
          <label>만족도 (1-5):</label>
          {[1,2,3,4,5].map(num => (
            <button
              key={num}
              className={feedback.rating === num ? 'active' : ''}
              onClick={() => setFeedback({...feedback, rating: num})}
            >
              {'⭐'.repeat(num)}
            </button>
          ))}
        </div>

        <textarea
          placeholder="상세한 피드백을 입력해 주세요..."
          value={feedback.message || ''}
          onChange={(e) => setFeedback({...feedback, message: e.target.value})}
          rows={4}
        />

        <div className="feedback-actions">
          <button onClick={handleSubmit}>전송</button>
          <button onClick={() => setIsOpen(false)}>취소</button>
        </div>
      </div>
    </div>
  );
}

// CSS는 별도 파일 또는 styled-components로 구현
```

#### 2. 사용량 분석 컴포넌트

```tsx
// src/hooks/useAnalytics.ts
import { useEffect } from 'react';

interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

export function useAnalytics() {
  const trackEvent = (event: AnalyticsEvent) => {
    // 개인정보 보호를 위한 익명화된 분석
    const anonymizedEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: getSessionId(),
      version: '5.0.1'
    };

    // Local Storage에 저장 (사용자 동의 하에)
    if (hasUserConsent()) {
      const events = JSON.parse(localStorage.getItem('han-view-analytics') || '[]');
      events.push(anonymizedEvent);
      // 최대 1000개 이벤트만 보관
      if (events.length > 1000) events.shift();
      localStorage.setItem('han-view-analytics', JSON.stringify(events));
    }
  };

  const trackComponentUsage = (componentName: string, action: string) => {
    trackEvent({
      action,
      category: 'component',
      label: componentName
    });
  };

  const trackError = (error: Error, context?: string) => {
    trackEvent({
      action: 'error',
      category: 'error',
      label: error.message,
      metadata: {
        stack: error.stack?.slice(0, 500), // 스택 트레이스 일부
        context
      }
    });
  };

  const trackPerformance = (metric: string, value: number) => {
    trackEvent({
      action: 'performance',
      category: 'performance',
      label: metric,
      value
    });
  };

  return {
    trackEvent,
    trackComponentUsage,
    trackError,
    trackPerformance
  };
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('han-view-session');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2);
    sessionStorage.setItem('han-view-session', sessionId);
  }
  return sessionId;
}

function hasUserConsent(): boolean {
  return localStorage.getItem('han-view-analytics-consent') === 'true';
}
```

### C. 설문조사 시스템

#### 1. 온보딩 설문

```tsx
// src/components/OnboardingSurvey.tsx
import React, { useState } from 'react';

interface OnboardingSurveyProps {
  onComplete: (data: OnboardingData) => void;
  onSkip: () => void;
}

interface OnboardingData {
  role: string;
  company: string;
  useCase: string[];
  experience: string;
  expectations: string;
}

export function OnboardingSurvey({ onComplete, onSkip }: OnboardingSurveyProps) {
  const [data, setData] = useState<Partial<OnboardingData>>({});
  const [step, setStep] = useState(0);

  const questions = [
    {
      id: 'role',
      title: '어떤 역할로 개발하고 계신가요?',
      type: 'select',
      options: [
        'Frontend 개발자',
        'Fullstack 개발자', 
        'Backend 개발자',
        'PM/기획자',
        '디자이너',
        '학생',
        '기타'
      ]
    },
    {
      id: 'company',
      title: '어떤 규모의 조직에서 일하고 계신가요?',
      type: 'select',
      options: [
        '개인 프로젝트',
        '스타트업 (1-50명)',
        '중소기업 (51-200명)',
        '중견기업 (201-1000명)',
        '대기업 (1000명+)',
        '프리랜서',
        '학생/연구기관'
      ]
    },
    {
      id: 'useCase',
      title: '어떤 용도로 사용하실 계획인가요? (복수 선택)',
      type: 'checkbox',
      options: [
        '문서 뷰어 기능',
        'AI 문서 분석',
        '문서 편집 기능', 
        '교육/학습 플랫폼',
        '업무용 문서 관리',
        '개인 프로젝트',
        '연구/실험 목적'
      ]
    },
    {
      id: 'experience',
      title: 'React 개발 경험이 얼마나 되시나요?',
      type: 'select',
      options: [
        '처음 시작',
        '6개월 미만',
        '6개월 - 1년',
        '1년 - 3년', 
        '3년 - 5년',
        '5년 이상'
      ]
    },
    {
      id: 'expectations',
      title: '오픈한글AI에 가장 기대하는 점은 무엇인가요?',
      type: 'textarea',
      placeholder: '자유롭게 작성해 주세요...'
    }
  ];

  const currentQuestion = questions[step];

  const handleNext = () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(data as OnboardingData);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const updateData = (value: any) => {
    setData({ ...data, [currentQuestion.id]: value });
  };

  return (
    <div className="onboarding-survey">
      <div className="survey-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span>{step + 1} / {questions.length}</span>
      </div>

      <div className="survey-content">
        <h3>{currentQuestion.title}</h3>
        
        {currentQuestion.type === 'select' && (
          <div className="options">
            {currentQuestion.options?.map(option => (
              <button
                key={option}
                className={data[currentQuestion.id as keyof OnboardingData] === option ? 'selected' : ''}
                onClick={() => updateData(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {currentQuestion.type === 'checkbox' && (
          <div className="checkbox-options">
            {currentQuestion.options?.map(option => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={((data[currentQuestion.id as keyof OnboardingData] as string[]) || []).includes(option)}
                  onChange={(e) => {
                    const current = (data[currentQuestion.id as keyof OnboardingData] as string[]) || [];
                    if (e.target.checked) {
                      updateData([...current, option]);
                    } else {
                      updateData(current.filter(item => item !== option));
                    }
                  }}
                />
                {option}
              </label>
            ))}
          </div>
        )}

        {currentQuestion.type === 'textarea' && (
          <textarea
            value={(data[currentQuestion.id as keyof OnboardingData] as string) || ''}
            onChange={(e) => updateData(e.target.value)}
            placeholder={currentQuestion.placeholder}
            rows={4}
          />
        )}
      </div>

      <div className="survey-actions">
        <button onClick={onSkip} className="skip">건너뛰기</button>
        {step > 0 && (
          <button onClick={handlePrev} className="prev">이전</button>
        )}
        <button 
          onClick={handleNext} 
          disabled={!data[currentQuestion.id as keyof OnboardingData]}
          className="next"
        >
          {step < questions.length - 1 ? '다음' : '완료'}
        </button>
      </div>
    </div>
  );
}
```

### D. 피드백 분석 및 관리

#### 1. 피드백 대시보드

```tsx
// src/components/admin/FeedbackDashboard.tsx (관리자용)
import React, { useState, useEffect } from 'react';

interface FeedbackSummary {
  totalFeedbacks: number;
  averageRating: number;
  topIssues: string[];
  featureRequests: string[];
  recentFeedbacks: FeedbackData[];
}

export function FeedbackDashboard() {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadFeedbackSummary();
  }, [timeRange]);

  const loadFeedbackSummary = async () => {
    // GitHub API를 통해 이슈 및 디스커션 데이터 수집
    const feedbacks = await fetchFeedbacksFromGitHub(timeRange);
    const analytics = getAnalyticsData();
    
    setSummary({
      totalFeedbacks: feedbacks.length,
      averageRating: calculateAverageRating(feedbacks),
      topIssues: extractTopIssues(feedbacks),
      featureRequests: extractFeatureRequests(feedbacks),
      recentFeedbacks: feedbacks.slice(0, 10)
    });
  };

  return (
    <div className="feedback-dashboard">
      <header>
        <h1>피드백 대시보드</h1>
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="7d">최근 7일</option>
          <option value="30d">최근 30일</option>
          <option value="90d">최근 3개월</option>
        </select>
      </header>

      {summary && (
        <>
          <div className="metrics-grid">
            <div className="metric">
              <h3>총 피드백</h3>
              <span className="value">{summary.totalFeedbacks}</span>
            </div>
            <div className="metric">
              <h3>평균 만족도</h3>
              <span className="value">{summary.averageRating.toFixed(1)}/5</span>
            </div>
            <div className="metric">
              <h3>주요 이슈</h3>
              <ul>{summary.topIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>
            </div>
            <div className="metric">
              <h3>기능 요청</h3>
              <ul>{summary.featureRequests.map(req => <li key={req}>{req}</li>)}</ul>
            </div>
          </div>

          <div className="recent-feedbacks">
            <h3>최근 피드백</h3>
            {summary.recentFeedbacks.map(feedback => (
              <div key={feedback.id} className="feedback-item">
                <div className="feedback-header">
                  <span className="rating">{'⭐'.repeat(feedback.rating)}</span>
                  <span className="type">{feedback.type}</span>
                  <span className="date">{feedback.createdAt}</span>
                </div>
                <p className="feedback-message">{feedback.message}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

#### 2. 자동 분석 스크립트

```javascript
// scripts/analyze-feedback.js
const { Octokit } = require('@octokit/rest');

class FeedbackAnalyzer {
  constructor(githubToken) {
    this.octokit = new Octokit({ auth: githubToken });
  }

  async analyzeFeedback(owner, repo, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // GitHub Issues에서 피드백 레이블이 있는 것들 수집
    const { data: issues } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      labels: 'feedback,user-experience',
      since,
      state: 'all'
    });

    // GitHub Discussions에서 피드백 카테고리 수집
    const discussions = await this.fetchDiscussions(owner, repo, since);

    return this.analyzeData([...issues, ...discussions]);
  }

  analyzeData(feedbacks) {
    const analysis = {
      totalCount: feedbacks.length,
      sentiment: this.analyzeSentiment(feedbacks),
      categories: this.categorizeIssues(feedbacks),
      priorities: this.prioritizeIssues(feedbacks),
      trends: this.analyzeTrends(feedbacks)
    };

    return analysis;
  }

  analyzeSentiment(feedbacks) {
    // 간단한 키워드 기반 감정 분석
    const positiveKeywords = ['좋다', '훌륭하다', '만족', '감사', '완벽'];
    const negativeKeywords = ['문제', '버그', '느리다', '어렵다', '불편'];

    let positive = 0, negative = 0, neutral = 0;

    feedbacks.forEach(feedback => {
      const text = feedback.body || feedback.title || '';
      const hasPositive = positiveKeywords.some(word => text.includes(word));
      const hasNegative = negativeKeywords.some(word => text.includes(word));

      if (hasPositive && !hasNegative) positive++;
      else if (hasNegative && !hasPositive) negative++;
      else neutral++;
    });

    return { positive, negative, neutral };
  }

  categorizeIssues(feedbacks) {
    const categories = {
      performance: 0,
      ui_ux: 0,
      documentation: 0,
      features: 0,
      bugs: 0,
      compatibility: 0
    };

    feedbacks.forEach(feedback => {
      const text = (feedback.body + ' ' + feedback.title).toLowerCase();
      
      if (text.match(/성능|속도|느리|빠르|로딩/)) categories.performance++;
      if (text.match(/ui|ux|디자인|인터페이스|사용법/)) categories.ui_ux++;
      if (text.match(/문서|가이드|예제|설명/)) categories.documentation++;
      if (text.match(/기능|추가|새로운|요청/)) categories.features++;
      if (text.match(/버그|오류|에러|문제|작동하지/)) categories.bugs++;
      if (text.match(/브라우저|호환|지원/)) categories.compatibility++;
    });

    return categories;
  }

  prioritizeIssues(feedbacks) {
    // GitHub 이슈의 반응 수, 댓글 수 등으로 우선순위 결정
    return feedbacks
      .map(issue => ({
        ...issue,
        priority: (issue.reactions?.total_count || 0) + (issue.comments || 0)
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10);
  }

  generateReport(analysis) {
    return `
# 피드백 분석 보고서

## 📊 전체 현황
- **총 피드백**: ${analysis.totalCount}건
- **긍정적**: ${analysis.sentiment.positive}건 (${(analysis.sentiment.positive/analysis.totalCount*100).toFixed(1)}%)
- **부정적**: ${analysis.sentiment.negative}건 (${(analysis.sentiment.negative/analysis.totalCount*100).toFixed(1)}%)
- **중립적**: ${analysis.sentiment.neutral}건 (${(analysis.sentiment.neutral/analysis.totalCount*100).toFixed(1)}%)

## 📋 카테고리별 분석
${Object.entries(analysis.categories)
  .sort(([,a], [,b]) => b - a)
  .map(([category, count]) => `- **${category}**: ${count}건`)
  .join('\n')}

## ⚡ 우선순위 이슈 (상위 5개)
${analysis.priorities.slice(0, 5)
  .map((issue, i) => `${i+1}. [${issue.title}](${issue.html_url}) (우선도: ${issue.priority})`)
  .join('\n')}

## 💡 권장사항
${this.generateRecommendations(analysis)}
    `;
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.categories.performance > analysis.totalCount * 0.2) {
      recommendations.push('- 성능 최적화에 집중 필요');
    }
    
    if (analysis.categories.documentation > analysis.totalCount * 0.15) {
      recommendations.push('- 문서 개선 우선순위 상승');
    }
    
    if (analysis.sentiment.negative > analysis.sentiment.positive) {
      recommendations.push('- 사용자 만족도 개선 필요');
    }

    return recommendations.join('\n') || '- 현재 피드백 수준이 양호함';
  }
}

module.exports = FeedbackAnalyzer;
```

### E. 개인정보 보호 및 윤리적 고려사항

#### 1. 사용자 동의 시스템

```tsx
// src/components/ConsentManager.tsx
import React, { useState, useEffect } from 'react';

export function ConsentManager() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const hasConsent = localStorage.getItem('han-view-analytics-consent');
    if (!hasConsent) {
      setShowConsent(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('han-view-analytics-consent', 'true');
    setShowConsent(false);
  };

  const handleDecline = () => {
    localStorage.setItem('han-view-analytics-consent', 'false');
    setShowConsent(false);
  };

  if (!showConsent) return null;

  return (
    <div className="consent-banner">
      <div className="consent-content">
        <h4>사용 현황 수집 동의</h4>
        <p>
          오픈한글AI를 개선하기 위해 익명화된 사용 현황을 수집하고자 합니다. 
          개인식별 정보는 절대 수집하지 않으며, 언제든 철회 가능합니다.
        </p>
        <div className="consent-actions">
          <button onClick={handleAccept}>동의</button>
          <button onClick={handleDecline}>거부</button>
          <a href="/privacy-policy" target="_blank">자세히 보기</a>
        </div>
      </div>
    </div>
  );
}
```

#### 2. 데이터 보호 정책

```markdown
# 개인정보 보호 정책

## 수집하는 정보
- 익명화된 사용량 통계
- 에러 로그 (개인정보 제외)
- 자발적 제공 피드백

## 수집하지 않는 정보  
- 개인식별 정보
- 문서 내용
- IP 주소
- 디바이스 고유 식별자

## 데이터 보관
- 로컬 스토리지: 사용자 기기에만 저장
- 최대 보관: 1000개 이벤트
- 자동 삭제: 30일 후

## 사용자 권리
- 언제든 수집 거부 가능
- 수집된 데이터 확인 가능
- 데이터 삭제 요청 가능
```

## 📈 측정 지표 및 KPI

### 1. 피드백 수집 지표
- **수집률**: 총 사용자 대비 피드백 제출률
- **응답률**: 설문조사 완료율  
- **만족도**: 평균 사용자 만족도 점수
- **카테고리별 분포**: 이슈 유형별 분포

### 2. 품질 지표
- **해결율**: 피드백 기반 이슈 해결 비율
- **응답시간**: 피드백에 대한 평균 응답 시간
- **재방문율**: 피드백 제출 후 재사용률

### 3. 트렌드 분석
- **시계열 변화**: 피드백 양상의 시간별 변화
- **사용자 세그먼트별**: 사용자 그룹별 피드백 차이
- **제품 개선 효과**: 업데이트 후 피드백 개선도

## 🔄 피드백 처리 워크플로우

### 1. 수집 → 분류 → 우선순위 → 처리 → 피드백
```
사용자 피드백 
→ 자동 라벨링 
→ 우선순위 매트릭스 적용 
→ 개발팀 할당 
→ 처리 결과 사용자 알림
```

### 2. 정기 분석 리포트
- **주간**: 긴급 이슈 및 트렌드
- **월간**: 종합 분석 및 개선 방향  
- **분기별**: 전략적 피드백 및 로드맵 반영

---

이 시스템을 통해 사용자들의 소중한 의견을 체계적으로 수집하고, 
오픈한글AI를 지속적으로 개선해 나갈 수 있습니다! 📊✨