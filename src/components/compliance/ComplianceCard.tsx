/**
 * ComplianceCard
 * 개별 프레임워크 카드 컴포넌트 (이미지 레퍼런스 기반)
 */

import React, { memo } from 'react';
import type { FrameworkMeta } from '../../types/compliance';

interface ComplianceCardProps {
  framework: FrameworkMeta;
  onGenerateReport: (frameworkId: FrameworkMeta['id']) => void;
  isGenerating?: boolean;
}

const ICON_MAP: Record<string, React.JSX.Element> = {
  globe: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  zap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  target: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  'alert-triangle': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

export const ComplianceCard = memo(function ComplianceCard({
  framework,
  onGenerateReport,
  isGenerating,
}: ComplianceCardProps) {
  const maxTags = 5;
  const visibleTags = framework.tags.slice(0, maxTags);
  const remainingCount = framework.tags.length - maxTags;

  return (
    <div className="compliance-card">
      <div className="compliance-card__header">
        <span className="compliance-card__icon">
          {ICON_MAP[framework.icon] || ICON_MAP.globe}
        </span>
        <div>
          <h3 className="compliance-card__title">{framework.name}</h3>
          <p className="compliance-card__subtitle">{framework.subtitle}</p>
        </div>
      </div>

      <p className="compliance-card__version">{framework.version}</p>

      <div className="compliance-card__tags">
        {visibleTags.map((tag) => (
          <span key={tag} className="compliance-card__tag">
            {tag}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="compliance-card__tag compliance-card__tag--more">
            +{remainingCount} more
          </span>
        )}
      </div>

      <button
        className="compliance-card__btn"
        onClick={() => onGenerateReport(framework.id)}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <span className="compliance-card__spinner" />
            생성 중...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Generate Report
          </>
        )}
      </button>
    </div>
  );
});
