import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printComplianceReport } from './compliance-pdf';
import type { ComplianceReport, FrameworkMeta } from '../../types/compliance';

function createMockReport(overrides: Partial<ComplianceReport> = {}): ComplianceReport {
  return {
    documentId: 'doc-1',
    documentName: 'test.hwpx',
    generatedAt: '2026-03-29T10:00:00.000Z',
    framework: 'eu-ai-act',
    overallScore: 85,
    overallStatus: 'compliant',
    categories: [
      {
        name: 'Transparency',
        score: 90,
        status: 'pass',
        checks: [
          { id: 'EU-T1', description: 'AI 생성 콘텐츠 표시', result: 'pass', evidence: '워터마크 활성화' },
          { id: 'EU-T2', description: '모델 정보 기록', result: 'pass', evidence: 'gpt-4o', article: 'Article 13' },
          { id: 'EU-T3', description: '검증 미수행', result: 'warn', evidence: '일부 미검증', remediation: '검증을 활성화하세요' },
        ],
      },
      {
        name: 'Risk Management',
        score: 60,
        status: 'warn',
        checks: [
          { id: 'EU-R1', description: '위험도 분류', result: 'fail', evidence: '미분류', remediation: '위험도를 분류하세요' },
        ],
      },
    ],
    recommendations: ['[Transparency] 검증을 활성화하세요', '[Risk Management] 위험도를 분류하세요'],
    summary: { totalChecks: 4, passed: 2, warned: 1, failed: 1, notApplicable: 0 },
    aiUsageSummary: {
      totalActions: 5,
      model: 'gpt-4o',
      generatedRatio: 0.3,
      allReviewed: true,
      approvalRate: 0.8,
      avgHallucinationScore: 0.92,
      totalInputTokens: 500,
      totalOutputTokens: 1000,
    },
    ...overrides,
  };
}

const mockFramework: FrameworkMeta = {
  id: 'eu-ai-act',
  name: 'EU AI Act',
  subtitle: 'European Union AI Act compliance',
  description: 'Regulation (EU) 2024/1689',
  version: 'Regulation (EU) 2024/1689',
  icon: 'globe',
  tags: ['Transparency', 'Risk Management'],
  categories: [],
};

describe('compliance-pdf', () => {
  let mockWriteFn: ReturnType<typeof vi.fn>;
  let mockCloseFn: ReturnType<typeof vi.fn>;
  let mockPrintWindow: { document: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockWriteFn = vi.fn();
    mockCloseFn = vi.fn();
    mockPrintWindow = {
      document: { write: mockWriteFn, close: mockCloseFn },
    };
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================
  // window.open 호출
  // =========================================

  it('window.open을 호출해야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    expect(window.open).toHaveBeenCalledWith('', '_blank', 'width=900,height=700');
  });

  it('새 윈도우에 HTML을 작성해야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    expect(mockWriteFn).toHaveBeenCalledTimes(1);
    expect(mockCloseFn).toHaveBeenCalledTimes(1);
  });

  // =========================================
  // HTML 내용 검증
  // =========================================

  it('HTML에 프레임워크 이름이 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('EU AI Act');
    expect(html).toContain('Compliance Report');
  });

  it('HTML에 점수가 포함되어야 한다', () => {
    printComplianceReport(createMockReport({ overallScore: 85 }), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('85');
    expect(html).toContain('COMPLIANT');
  });

  it('HTML에 카테고리 정보가 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('Transparency');
    expect(html).toContain('Risk Management');
    expect(html).toContain('90%');
    expect(html).toContain('60%');
  });

  it('HTML에 체크 항목이 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('AI 생성 콘텐츠 표시');
    expect(html).toContain('워터마크 활성화');
    expect(html).toContain('Article 13');
  });

  it('HTML에 remediation이 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('검증을 활성화하세요');
    expect(html).toContain('위험도를 분류하세요');
  });

  it('HTML에 AI 사용 요약이 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('5건');
    expect(html).toContain('gpt-4o');
    expect(html).toContain('80%'); // 승인율
    expect(html).toContain('92.0%'); // 검증 점수
  });

  it('HTML에 summary 통계가 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('4개 항목');
    expect(html).toContain('2</strong>개 통과');
  });

  it('HTML에 권고사항이 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('[Transparency]');
    expect(html).toContain('[Risk Management]');
  });

  // =========================================
  // 인쇄 전용 구조
  // =========================================

  it('print-color-adjust가 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('print-color-adjust: exact');
  });

  it('@page 규칙이 A4로 설정되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('size: A4');
  });

  it('인쇄 버튼이 no-print 클래스를 가져야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('class="print-bar no-print"');
  });

  it('window.print() 호출 코드가 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('window.print()');
  });

  // =========================================
  // 다양한 상태
  // =========================================

  it('partial 상태일 때 PARTIAL이 표시되어야 한다', () => {
    printComplianceReport(createMockReport({ overallStatus: 'partial', overallScore: 60 }), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('PARTIAL');
  });

  it('non-compliant 상태일 때 NON-COMPLIANT가 표시되어야 한다', () => {
    printComplianceReport(createMockReport({ overallStatus: 'non-compliant', overallScore: 30 }), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('NON-COMPLIANT');
  });

  it('할루시네이션 점수가 null일 때 N/A가 표시되어야 한다', () => {
    const report = createMockReport();
    report.aiUsageSummary.avgHallucinationScore = null;
    printComplianceReport(report, mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('N/A');
  });

  // =========================================
  // 팝업 차단
  // =========================================

  it('팝업이 차단되면 alert를 표시해야 한다', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    printComplianceReport(createMockReport(), mockFramework);

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('팝업'));
    expect(mockWriteFn).not.toHaveBeenCalled();
  });

  // =========================================
  // 권고사항 없을 때
  // =========================================

  it('권고사항이 없으면 권고사항 섹션이 없어야 한다', () => {
    printComplianceReport(createMockReport({ recommendations: [] }), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).not.toContain('개선 권고사항');
  });

  // =========================================
  // Footer
  // =========================================

  it('footer에 OpenHangul AI가 포함되어야 한다', () => {
    printComplianceReport(createMockReport(), mockFramework);
    const html = mockWriteFn.mock.calls[0][0] as string;
    expect(html).toContain('OpenHangul AI');
  });
});
