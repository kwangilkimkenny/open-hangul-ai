/**
 * ComplianceReportView
 * 생성된 컴플라이언스 리포트 상세 뷰
 */

import { memo, useCallback, useRef } from 'react';
import type { ComplianceReport, ComplianceCategory, ComplianceCheck, CheckResult } from '../../types/compliance';
import { FRAMEWORKS } from '../../lib/ai/compliance-rules';
import { printComplianceReport } from '../../lib/ai/compliance-pdf';

interface ComplianceReportViewProps {
  report: ComplianceReport;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  compliant: 'Compliant',
  partial: 'Partial',
  'non-compliant': 'Non-Compliant',
};

const CHECK_ICONS: Record<CheckResult, string> = {
  pass: '\u2705',
  warn: '\u26A0\uFE0F',
  fail: '\u274C',
  'n/a': '\u2796',
};

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 80 ? '#222' : score >= 50 ? '#777' : '#aaa';
  const radius = size === 'lg' ? 54 : size === 'md' ? 40 : 28;
  const stroke = size === 'lg' ? 8 : size === 'md' ? 6 : 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = (radius + stroke) * 2;

  return (
    <div className={`score-badge score-badge--${size}`}>
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${radius + stroke} ${radius + stroke})`}
        />
      </svg>
      <span className="score-badge__value" style={{ color }}>{score}</span>
    </div>
  );
}

function CategorySection({ category }: { category: ComplianceCategory }) {
  const statusColor = category.score >= 80 ? '#222' : category.score >= 50 ? '#777' : '#aaa';

  return (
    <div className="report-category">
      <div className="report-category__header">
        <h4 className="report-category__title">{category.name}</h4>
        <div className="report-category__score">
          <span style={{ color: statusColor, fontWeight: 600 }}>{category.score}%</span>
        </div>
      </div>
      <div className="report-category__checks">
        {category.checks.map((check) => (
          <CheckItem key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}

function CheckItem({ check }: { check: ComplianceCheck }) {
  return (
    <div className={`report-check report-check--${check.result}`}>
      <span className="report-check__icon">{CHECK_ICONS[check.result]}</span>
      <div className="report-check__content">
        <div className="report-check__desc">
          <span>{check.description}</span>
          {check.article && <span className="report-check__article">{check.article}</span>}
        </div>
        <p className="report-check__evidence">{check.evidence}</p>
        {check.remediation && (
          <p className="report-check__remediation">{check.remediation}</p>
        )}
      </div>
    </div>
  );
}

export const ComplianceReportView = memo(function ComplianceReportView({
  report,
  onClose,
}: ComplianceReportViewProps) {
  const framework = FRAMEWORKS[report.framework];
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrintPDF = useCallback(() => {
    printComplianceReport(report, framework);
  }, [report, framework]);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${report.framework}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  return (
    <div className="compliance-report-overlay" onClick={onClose}>
      <div className="compliance-report" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="compliance-report__header">
          <div className="compliance-report__header-left">
            <h2>{framework.name} Compliance Report</h2>
            <p className="compliance-report__meta">
              {framework.subtitle} &middot; {new Date(report.generatedAt).toLocaleString('ko-KR')}
            </p>
          </div>
          <button className="compliance-report__close" onClick={onClose} title="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Score Overview */}
        <div className="compliance-report__overview">
          <div className="compliance-report__score-section">
            <ScoreBadge score={report.overallScore} size="lg" />
            <div>
              <span className={`compliance-report__status compliance-report__status--${report.overallStatus}`}>
                {STATUS_LABELS[report.overallStatus]}
              </span>
              <p className="compliance-report__summary-text">
                {report.summary.totalChecks}개 항목 중{' '}
                <strong>{report.summary.passed}</strong>개 통과,{' '}
                <span style={{ color: '#f59e0b' }}>{report.summary.warned}</span>개 경고,{' '}
                <span style={{ color: '#ef4444' }}>{report.summary.failed}</span>개 미충족
              </p>
            </div>
          </div>

          {/* AI Usage Summary */}
          <div className="compliance-report__ai-summary">
            <h4>AI 사용 요약</h4>
            <div className="compliance-report__ai-grid">
              <div className="compliance-report__ai-item">
                <span className="compliance-report__ai-label">AI 활동</span>
                <span className="compliance-report__ai-value">{report.aiUsageSummary.totalActions}건</span>
              </div>
              <div className="compliance-report__ai-item">
                <span className="compliance-report__ai-label">모델</span>
                <span className="compliance-report__ai-value">{report.aiUsageSummary.model}</span>
              </div>
              <div className="compliance-report__ai-item">
                <span className="compliance-report__ai-label">승인율</span>
                <span className="compliance-report__ai-value">
                  {(report.aiUsageSummary.approvalRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="compliance-report__ai-item">
                <span className="compliance-report__ai-label">검증 점수</span>
                <span className="compliance-report__ai-value">
                  {report.aiUsageSummary.avgHallucinationScore !== null
                    ? `${(report.aiUsageSummary.avgHallucinationScore * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="compliance-report__ai-item">
                <span className="compliance-report__ai-label">총 토큰</span>
                <span className="compliance-report__ai-value">
                  {(report.aiUsageSummary.totalInputTokens + report.aiUsageSummary.totalOutputTokens).toLocaleString()}
                </span>
              </div>
              <div className="compliance-report__ai-item">
                <span className="compliance-report__ai-label">전체 검토</span>
                <span className="compliance-report__ai-value">
                  {report.aiUsageSummary.allReviewed ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="compliance-report__categories">
          {report.categories.map((cat) => (
            <CategorySection key={cat.name} category={cat} />
          ))}
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="compliance-report__recommendations">
            <h4>개선 권고사항</h4>
            <ul>
              {report.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="compliance-report__actions">
          <button className="compliance-report__btn-pdf" onClick={handlePrintPDF}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            PDF 인쇄
          </button>
          <button className="compliance-report__btn-export" onClick={handleExportJSON}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            JSON 내보내기
          </button>
          <button className="compliance-report__btn-close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
});
