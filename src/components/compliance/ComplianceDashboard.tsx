/**
 * ComplianceDashboard
 * 4개 프레임워크 카드 그리드 + 리포트 뷰 통합
 */

import { memo, useState, useCallback } from 'react';
import { ComplianceCard } from './ComplianceCard';
import { ComplianceReportView } from './ComplianceReportView';
import { FRAMEWORK_LIST } from '../../lib/ai/compliance-rules';
import { complianceReporter } from '../../lib/ai/compliance-reporter';
import { useComplianceStore } from '../../stores/complianceStore';
import type { FrameworkType, ComplianceReport } from '../../types/compliance';
import '../../styles/compliance.css';

interface ComplianceDashboardProps {
  onClose: () => void;
}

export const ComplianceDashboard = memo(function ComplianceDashboard({
  onClose,
}: ComplianceDashboardProps) {
  const [generatingId, setGeneratingId] = useState<FrameworkType | null>(null);
  const [activeReport, setActiveReport] = useState<ComplianceReport | null>(null);

  const activityLogs = useComplianceStore((s) => s.activityLogs);
  const setReport = useComplianceStore((s) => s.setReport);

  const handleGenerateReport = useCallback(
    (frameworkId: FrameworkType) => {
      setGeneratingId(frameworkId);

      // 약간의 딜레이로 UI 피드백
      setTimeout(() => {
        const report = complianceReporter.evaluate(frameworkId, activityLogs);
        setReport(frameworkId, report);
        setActiveReport(report);
        setGeneratingId(null);
      }, 500);
    },
    [activityLogs, setReport]
  );

  const handleCloseReport = useCallback(() => {
    setActiveReport(null);
  }, []);

  return (
    <div className="compliance-dashboard-overlay" onClick={onClose}>
      <div className="compliance-dashboard" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="compliance-dashboard__header">
          <div>
            <h2 className="compliance-dashboard__title">AI Compliance Reports</h2>
            <p className="compliance-dashboard__desc">
              AI 사용에 대한 규제 준수 리포트를 생성합니다
            </p>
          </div>
          <div className="compliance-dashboard__header-right">
            <span className="compliance-dashboard__log-count">
              AI 활동 로그: <strong>{activityLogs.length}</strong>건
            </span>
            <button className="compliance-dashboard__close" onClick={onClose} title="닫기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="compliance-dashboard__grid">
          {FRAMEWORK_LIST.map((fw) => (
            <ComplianceCard
              key={fw.id}
              framework={fw}
              onGenerateReport={handleGenerateReport}
              isGenerating={generatingId === fw.id}
            />
          ))}
        </div>

        {/* Report View */}
        {activeReport && (
          <ComplianceReportView report={activeReport} onClose={handleCloseReport} />
        )}
      </div>
    </div>
  );
});

export default ComplianceDashboard;
