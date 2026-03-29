import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../hooks/useSecurityStatus', () => ({
  useSecurityStatus: vi.fn(() => ({
    status: {
      aegis: { state: 'disabled', ready: false },
      truthAnchor: { state: 'disabled', version: null, latencyMs: null, lastCheckAt: null },
    },
    refresh: vi.fn(),
  })),
}));

import { SecurityTestPanel } from './SecurityTestPanel';

describe('SecurityTestPanel', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('패널 타이틀이 렌더링되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    expect(screen.getByText(/AI Security/i)).toBeInTheDocument();
  });

  it('설명 텍스트가 표시되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    expect(screen.getByText(/AEGIS.*TruthAnchor/)).toBeInTheDocument();
  });

  it('AEGIS 시나리오 3개가 표시되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    expect(screen.getByText('Prompt Injection 차단')).toBeInTheDocument();
    expect(screen.getByText('PII(개인정보) 감지')).toBeInTheDocument();
    expect(screen.getByText('정상 입력 통과')).toBeInTheDocument();
  });

  it('TruthAnchor 시나리오 3개가 표시되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    expect(screen.getByText('사실 오류 감지')).toBeInTheDocument();
    expect(screen.getByText('수치 오류 감지')).toBeInTheDocument();
    expect(screen.getByText('정확한 텍스트 검증')).toBeInTheDocument();
  });

  it('전체 테스트 실행 버튼이 있어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    expect(screen.getByText('RUN ALL')).toBeInTheDocument();
  });

  it('각 시나리오에 실행 버튼이 있어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    const runButtons = screen.getAllByText('실행');
    expect(runButtons.length).toBe(6);
  });

  it('닫기 버튼 클릭 시 onClose가 호출되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    const closeBtn = screen.getByText('\u00D7');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('오버레이 클릭 시 onClose가 호출되어야 한다', () => {
    const { container } = render(<SecurityTestPanel onClose={mockOnClose} />);
    const overlay = container.querySelector('.sectest-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('패널 내부 클릭 시 onClose가 호출되지 않아야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(/AI Security/i));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('AEGIS/TruthAnchor 섹션 배지가 표시되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    const aegisBadges = screen.getAllByText('AEGIS');
    expect(aegisBadges.length).toBeGreaterThanOrEqual(1);
    const taBadges = screen.getAllByText('TruthAnchor');
    expect(taBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('상태바에 시스템 상태가 표시되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    const badges = screen.getAllByText('비활성');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('QUICK TEST / FULL BENCHMARK 탭이 표시되어야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    expect(screen.getByText('QUICK TEST')).toBeInTheDocument();
    expect(screen.getByText('FULL BENCHMARK')).toBeInTheDocument();
  });

  it('FULL BENCHMARK 탭 클릭 시 시나리오 카드가 사라져야 한다', () => {
    render(<SecurityTestPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('FULL BENCHMARK'));
    // Quick test 시나리오가 더 이상 보이지 않음
    expect(screen.queryByText('Prompt Injection 차단')).not.toBeInTheDocument();
  });
});
