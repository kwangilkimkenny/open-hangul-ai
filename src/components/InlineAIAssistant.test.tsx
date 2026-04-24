/**
 * InlineAIAssistant tests
 *
 * 어댑터의 selection 이벤트 → 툴바 표시 → 액션 클릭 → LLM 호출 → 결과 미리보기 →
 * "교체" 클릭 시 선택 영역이 LLM 응답으로 교체되는 라운드트립을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { HWPXViewerInstance } from '../types/viewer';

// universalLLM / useActiveConfig mock — InlineAIAssistant import 전에 평가되어야 한다.
const generateText = vi.fn();
vi.mock('../lib/ai/universal-llm-service', () => ({
  universalLLM: {
    generateText: (...args: unknown[]) => generateText(...args),
  },
}));

vi.mock('../stores/llmConfigStore', () => ({
  useActiveConfig: () => ({
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1000,
    apiKey: 'test',
  }),
}));

import { InlineAIAssistant } from './InlineAIAssistant';

function makeAdapter(selectionText = '안녕하세요 세계입니다') {
  let listener: (() => void) | null = null;
  const adapter = {
    onRangeStyleChange: vi.fn((cb: () => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    getRangeText: vi.fn(() => selectionText),
    getRangeBoundingRect: vi.fn(() => ({
      left: 100,
      top: 200,
      right: 300,
      bottom: 220,
      width: 200,
      height: 20,
    })),
    replaceRangeText: vi.fn(() => true),
    _trigger: () => listener?.(),
  };
  return adapter;
}

function makeViewer(adapter: ReturnType<typeof makeAdapter>): HWPXViewerInstance {
  return { canvasEditor: adapter } as unknown as HWPXViewerInstance;
}

describe('InlineAIAssistant', () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it('returns null when there is no canvas-editor adapter', () => {
    const { container } = render(<InlineAIAssistant viewer={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render toolbar before a selection event fires', () => {
    const adapter = makeAdapter();
    render(<InlineAIAssistant viewer={makeViewer(adapter)} />);
    expect(screen.queryByTestId('inline-ai-toolbar')).toBeNull();
  });

  it('shows toolbar with all 4 actions after selection ≥ minSelectionLength', () => {
    const adapter = makeAdapter('이것은 충분히 긴 한국어 선택 텍스트');
    render(<InlineAIAssistant viewer={makeViewer(adapter)} />);
    act(() => adapter._trigger());
    expect(screen.getByTestId('inline-ai-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('inline-ai-action-summarize')).toBeInTheDocument();
    expect(screen.getByTestId('inline-ai-action-translate')).toBeInTheDocument();
    expect(screen.getByTestId('inline-ai-action-rewrite')).toBeInTheDocument();
    expect(screen.getByTestId('inline-ai-action-proofread')).toBeInTheDocument();
  });

  it('hides toolbar when selection text is below minSelectionLength', () => {
    const adapter = makeAdapter('짧음');
    render(<InlineAIAssistant viewer={makeViewer(adapter)} minSelectionLength={5} />);
    act(() => adapter._trigger());
    expect(screen.queryByTestId('inline-ai-toolbar')).toBeNull();
  });

  it('runs LLM and shows result modal with editable textarea', async () => {
    generateText.mockResolvedValue({
      content: '요약된 결과 텍스트',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    });
    const adapter = makeAdapter('이것은 충분히 긴 한국어 선택 텍스트');
    render(<InlineAIAssistant viewer={makeViewer(adapter)} />);
    act(() => adapter._trigger());

    fireEvent.click(screen.getByTestId('inline-ai-action-summarize'));

    await waitFor(() => {
      expect(screen.getByTestId('inline-ai-result-modal')).toBeInTheDocument();
    });
    const textarea = (await screen.findByTestId('inline-ai-result-text')) as HTMLTextAreaElement;
    expect(textarea.value).toBe('요약된 결과 텍스트');

    expect(generateText).toHaveBeenCalledTimes(1);
    const [messages, config] = generateText.mock.calls[0];
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('이것은 충분히 긴 한국어 선택 텍스트');
    expect(config.provider).toBe('openai');
  });

  it('shows error message when LLM throws', async () => {
    generateText.mockRejectedValue(new Error('API rate limit'));
    const adapter = makeAdapter('이것은 충분히 긴 한국어 선택 텍스트');
    render(<InlineAIAssistant viewer={makeViewer(adapter)} />);
    act(() => adapter._trigger());

    fireEvent.click(screen.getByTestId('inline-ai-action-rewrite'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('API rate limit');
    const accept = screen.getByTestId('inline-ai-accept') as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
  });

  it('replaces selection with edited result on accept', async () => {
    generateText.mockResolvedValue({
      content: 'translated',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, cost: 0 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    });
    const adapter = makeAdapter('이것은 충분히 긴 한국어 선택 텍스트');
    render(<InlineAIAssistant viewer={makeViewer(adapter)} />);
    act(() => adapter._trigger());

    fireEvent.click(screen.getByTestId('inline-ai-action-translate'));
    const textarea = (await screen.findByTestId('inline-ai-result-text')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'edited translation' } });
    fireEvent.click(screen.getByTestId('inline-ai-accept'));

    expect(adapter.replaceRangeText).toHaveBeenCalledWith('edited translation');
    // 모달과 툴바가 모두 닫힌다.
    expect(screen.queryByTestId('inline-ai-result-modal')).toBeNull();
    expect(screen.queryByTestId('inline-ai-toolbar')).toBeNull();
  });

  it('cancel button closes modal without calling replace', async () => {
    let resolve!: (v: {
      content: string;
      usage: object;
      model: string;
      finishReason: string;
    }) => void;
    generateText.mockImplementation(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    const adapter = makeAdapter('이것은 충분히 긴 한국어 선택 텍스트');
    render(<InlineAIAssistant viewer={makeViewer(adapter)} />);
    act(() => adapter._trigger());

    fireEvent.click(screen.getByTestId('inline-ai-action-proofread'));
    fireEvent.click(screen.getByTestId('inline-ai-cancel'));

    expect(adapter.replaceRangeText).not.toHaveBeenCalled();
    expect(screen.queryByTestId('inline-ai-result-modal')).toBeNull();

    // 늦게 도착한 응답은 무시되어야 한다.
    resolve({
      content: '교정된 결과',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, cost: 0 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    });
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByTestId('inline-ai-result-modal')).toBeNull();
  });

  it('Escape key closes the toolbar', () => {
    const adapter = makeAdapter('이것은 충분히 긴 한국어 선택 텍스트');
    render(<InlineAIAssistant viewer={makeViewer(adapter)} />);
    act(() => adapter._trigger());
    expect(screen.getByTestId('inline-ai-toolbar')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('inline-ai-toolbar')).toBeNull();
  });
});
