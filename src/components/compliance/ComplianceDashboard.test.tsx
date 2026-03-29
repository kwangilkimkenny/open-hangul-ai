import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';

// Mock stores
vi.mock('../../stores/complianceStore', () => {
  const mockSetReport = vi.fn();
  const store = {
    activityLogs: [],
    setReport: mockSetReport,
    isDashboardOpen: true,
    setDashboardOpen: vi.fn(),
  };
  return {
    useComplianceStore: vi.fn((selector?: (s: typeof store) => unknown) => {
      if (typeof selector === 'function') return selector(store);
      return store;
    }),
    __mockStore: store,
    __mockSetReport: mockSetReport,
  };
});

// Mock compliance reporter
vi.mock('../../lib/ai/compliance-reporter', () => ({
  complianceReporter: {
    evaluate: vi.fn(() => ({
      documentId: 'doc-1',
      documentName: '',
      generatedAt: new Date().toISOString(),
      framework: 'eu-ai-act',
      overallScore: 85,
      overallStatus: 'compliant',
      categories: [
        {
          name: 'Transparency',
          score: 90,
          status: 'pass',
          checks: [
            { id: 'EU-T1', description: 'AI 워터마크', result: 'pass', evidence: '활성화됨' },
          ],
        },
      ],
      recommendations: [],
      summary: { totalChecks: 1, passed: 1, warned: 0, failed: 0, notApplicable: 0 },
      aiUsageSummary: {
        totalActions: 0,
        model: 'N/A',
        generatedRatio: 0,
        allReviewed: true,
        approvalRate: 1,
        avgHallucinationScore: null,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      },
    })),
  },
}));

// Mock compliance-pdf
vi.mock('../../lib/ai/compliance-pdf', () => ({
  printComplianceReport: vi.fn(),
}));

// Mock compliance rules
vi.mock('../../lib/ai/compliance-rules', () => ({
  FRAMEWORK_LIST: [
    {
      id: 'eu-ai-act',
      name: 'EU AI Act',
      subtitle: 'European Union AI Act',
      description: 'Regulation (EU) 2024/1689',
      version: '2024/1689',
      icon: 'globe',
      tags: ['Transparency', 'Risk Management'],
      categories: [],
    },
    {
      id: 'k-ai-act',
      name: 'K-AI Act',
      subtitle: '한국 인공지능 기본법',
      description: '인공지능산업 육성법',
      version: '2026',
      icon: 'zap',
      tags: ['안전성', '투명성'],
      categories: [],
    },
    {
      id: 'nist-ai-rmf',
      name: 'NIST AI RMF',
      subtitle: 'NIST AI Risk Management Framework',
      description: 'AI RMF 1.0',
      version: '1.0',
      icon: 'target',
      tags: ['Govern', 'Map'],
      categories: [],
    },
    {
      id: 'owasp-llm-top10',
      name: 'OWASP LLM Top 10',
      subtitle: 'OWASP Top 10 for LLM',
      description: 'v1.1',
      version: 'v1.1',
      icon: 'alert-triangle',
      tags: ['LLM01: Prompt Injection'],
      categories: [],
    },
  ],
  FRAMEWORKS: {
    'eu-ai-act': {
      id: 'eu-ai-act',
      name: 'EU AI Act',
      subtitle: 'European Union AI Act',
      tags: ['Transparency'],
      categories: [],
    },
  },
}));

import { ComplianceDashboard } from './ComplianceDashboard';

describe('ComplianceDashboard', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================
  // 렌더링
  // =========================================

  it('대시보드 타이틀이 렌더링되어야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    expect(screen.getByText('AI Compliance Reports')).toBeInTheDocument();
  });

  it('설명 텍스트가 표시되어야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    expect(screen.getByText(/규제 준수 리포트를 생성합니다/)).toBeInTheDocument();
  });

  it('AI 활동 로그 수가 표시되어야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    expect(screen.getByText(/AI 활동 로그/)).toBeInTheDocument();
  });

  // =========================================
  // 4개 카드 렌더링
  // =========================================

  it('4개 프레임워크 카드가 렌더링되어야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    expect(screen.getByText('EU AI Act')).toBeInTheDocument();
    expect(screen.getByText('K-AI Act')).toBeInTheDocument();
    expect(screen.getByText('NIST AI RMF')).toBeInTheDocument();
    expect(screen.getByText('OWASP LLM Top 10')).toBeInTheDocument();
  });

  it('각 카드에 Generate Report 버튼이 있어야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    const buttons = screen.getAllByText('Generate Report');
    expect(buttons).toHaveLength(4);
  });

  it('프레임워크 태그가 표시되어야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    expect(screen.getByText('Transparency')).toBeInTheDocument();
    expect(screen.getByText('안전성')).toBeInTheDocument();
    expect(screen.getByText('Govern')).toBeInTheDocument();
  });

  // =========================================
  // 닫기
  // =========================================

  it('닫기 버튼 클릭 시 onClose가 호출되어야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    const closeBtn = screen.getByTitle('닫기');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('오버레이 클릭 시 onClose가 호출되어야 한다', () => {
    const { container } = render(<ComplianceDashboard onClose={mockOnClose} />);
    const overlay = container.querySelector('.compliance-dashboard-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('대시보드 내부 클릭 시 onClose가 호출되지 않아야 한다', () => {
    render(<ComplianceDashboard onClose={mockOnClose} />);
    const title = screen.getByText('AI Compliance Reports');
    fireEvent.click(title);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // =========================================
  // 리포트 생성
  // =========================================

  it('Generate Report 클릭 시 리포트가 생성되어야 한다', async () => {
    const { complianceReporter } = await import('../../lib/ai/compliance-reporter');
    render(<ComplianceDashboard onClose={mockOnClose} />);
    const buttons = screen.getAllByText('Generate Report');
    fireEvent.click(buttons[0]); // EU AI Act

    // setTimeout(500ms)으로 동작하므로 waitFor 사용
    await waitFor(() => {
      expect(complianceReporter.evaluate).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
});
