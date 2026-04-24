/**
 * Chat Panel API Module
 * AI API 통신 및 응답 처리 로직
 *
 * @module ui/chat-panel-api
 * @version 1.0.0
 */

import { getLogger } from '../utils/logger.js';
import { AIConfig } from '../config/ai-config.js';

const logger = getLogger();

/**
 * ChatPanel API 통신 관리 클래스
 */
export class ChatPanelAPI {
  constructor(aiController) {
    this.aiController = aiController;
    this.currentRequest = null;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1초
  }

  /**
   * AI 응답 생성
   */
  async generateResponse(message, options = {}) {
    if (this.currentRequest) {
      logger.warn('Request already in progress, canceling previous request');
      this.currentRequest.abort();
    }

    const controller = new AbortController();
    this.currentRequest = controller;

    try {
      const context = await this.prepareContext(options);
      const requestPayload = this.buildRequestPayload(message, context, options);

      logger.info('Sending AI request', {
        messageLength: message.length,
        hasContext: !!context,
        provider: AIConfig.getProvider(),
      });

      const response = await this.sendRequestWithRetry(requestPayload, controller.signal);
      const processedResponse = await this.processResponse(response);

      logger.info('AI response received', {
        responseLength: processedResponse.content?.length || 0,
        model: response.model,
        tokenUsage: response.usage,
      });

      return processedResponse;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('AI request was aborted');
        throw new Error('요청이 취소되었습니다');
      }

      logger.error('AI request failed', error);
      throw this.handleAPIError(error);
    } finally {
      this.currentRequest = null;
    }
  }

  /**
   * 컨텍스트 준비
   */
  async prepareContext(options) {
    const context = {
      timestamp: new Date().toISOString(),
      userPreferences: AIConfig.getUserPreferences(),
      ...options.context,
    };

    // 문서 컨텍스트 추가 — canvas-editor 가 활성이면 그쪽을 우선 사용
    const viewer = this.aiController?.viewer;
    if (viewer) {
      try {
        const document = viewer.canvasEditor?.getDocument?.() || viewer.getDocument?.();
        if (document) {
          const pageCount = document.pages?.length || document.sections?.length || 0;
          context.document = {
            title: document.title || document.metadata?.title || '제목 없음',
            pageCount,
            sectionCount: document.sections?.length || 0,
            hasContent: pageCount > 0 || (document.sections?.length || 0) > 0,
          };
          const selectedText = this.getSelectedText();
          if (selectedText) context.selectedText = selectedText;
        }
      } catch (error) {
        logger.warn('Failed to get document context', error);
      }
    }

    return context;
  }

  /**
   * 선택된 텍스트 가져오기 — canvas-editor 활성 시 어댑터에서 먼저 시도
   */
  getSelectedText() {
    try {
      const adapter = this.aiController?.viewer?.canvasEditor;
      const ed = adapter?.editor;
      if (ed?.command?.getRangeText) {
        const t = ed.command.getRangeText();
        if (t) return t;
      }
      const selection = window.getSelection();
      return selection?.toString?.().trim() || null;
    } catch (error) {
      logger.debug('Failed to get selected text', error);
      return null;
    }
  }

  /**
   * 요청 페이로드 구성
   */
  buildRequestPayload(message, context, options) {
    const config = AIConfig.getCurrentConfig();

    return {
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(context, options),
        },
        {
          role: 'user',
          content: message,
        },
      ],
      model: config.model,
      temperature: options.temperature || config.temperature,
      maxTokens: options.maxTokens || config.maxTokens,
      stream: options.stream !== false,
      metadata: {
        source: 'chat-panel',
        timestamp: context.timestamp,
        hasDocumentContext: !!context.document,
      },
    };
  }

  /**
   * 시스템 프롬프트 구성
   */
  buildSystemPrompt(context, options) {
    let systemPrompt = `당신은 한글 문서 편집 전문 AI 어시스턴트입니다.
사용자의 문서 작성과 편집을 도와주는 것이 주요 역할입니다.

현재 상황:
- 시간: ${new Date(context.timestamp).toLocaleString('ko-KR')}
- 플랫폼: HanView 문서 편집기`;

    if (context.document) {
      systemPrompt += `
- 현재 문서: ${context.document.title}
- 페이지 수: ${context.document.pageCount}개`;
    }

    if (context.selectedText) {
      systemPrompt += `
- 선택된 텍스트: "${context.selectedText}"`;
    }

    systemPrompt += `

지침:
1. 한국어로 정확하고 도움이 되는 답변을 제공하세요
2. 문서 편집에 관련된 질문에는 구체적인 해결책을 제시하세요
3. 필요시 마크다운 형식을 사용하여 구조화된 답변을 제공하세요
4. 사용자의 작업 효율성을 높이는 팁을 포함하세요`;

    if (options.customPrompt) {
      systemPrompt += `

추가 지침:
${options.customPrompt}`;
    }

    return systemPrompt;
  }

  /**
   * 재시도 로직이 포함된 요청 전송
   */
  async sendRequestWithRetry(payload, signal, attempt = 1) {
    try {
      return await this.aiController.generateText(
        payload.messages,
        {
          model: payload.model,
          temperature: payload.temperature,
          maxTokens: payload.maxTokens,
        },
        {
          signal,
          stream: payload.stream,
          metadata: payload.metadata,
        }
      );
    } catch (error) {
      if (signal.aborted) throw error;

      if (attempt < this.retryAttempts && this.isRetriableError(error)) {
        logger.warn(`Request failed, retrying (${attempt}/${this.retryAttempts})`, {
          error: error.message,
          attempt,
        });

        await this.delay(this.retryDelay * attempt);
        return this.sendRequestWithRetry(payload, signal, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  isRetriableError(error) {
    const retriableErrorCodes = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMIT',
      'SERVER_ERROR',
      500,
      502,
      503,
      504,
    ];

    return retriableErrorCodes.some(
      code => error.code === code || error.status === code || error.message?.includes(code)
    );
  }

  /**
   * 응답 후처리
   */
  async processResponse(response) {
    if (!response || !response.content) {
      throw new Error('빈 응답을 받았습니다');
    }

    let processedContent = response.content;

    // 마크다운 처리
    if (this.containsMarkdown(processedContent)) {
      processedContent = this.processMarkdown(processedContent);
    }

    // 코드 블록 처리
    processedContent = this.processCodeBlocks(processedContent);

    return {
      content: processedContent,
      originalContent: response.content,
      metadata: {
        model: response.model,
        usage: response.usage,
        finishReason: response.finishReason,
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 마크다운 포함 여부 확인
   */
  containsMarkdown(text) {
    const markdownPatterns = [
      /\*\*.*?\*\*/, // Bold
      /\*.*?\*/, // Italic
      /`.*?`/, // Inline code
      /```[\s\S]*?```/, // Code blocks
      /^#+\s/m, // Headers
      /^\s*[-*+]\s/m, // Lists
      /^\s*\d+\.\s/m, // Numbered lists
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 마크다운 처리
   */
  processMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^\s*[-*+]\s(.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.*)$/gm, '<p>$1</p>')
      .replace(/<p><\/p>/g, '');
  }

  /**
   * 코드 블록 처리
   */
  processCodeBlocks(text) {
    return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const lang = language || 'text';
      return `<div class="code-block">
                <div class="code-header">
                    <span class="language">${lang}</span>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`)">복사</button>
                </div>
                <pre><code class="language-${lang}">${code}</code></pre>
            </div>`;
    });
  }

  /**
   * API 에러 처리
   */
  handleAPIError(error) {
    let userMessage = '알 수 없는 오류가 발생했습니다.';

    if (error.code === 'NETWORK_ERROR') {
      userMessage = '네트워크 연결을 확인해 주세요.';
    } else if (error.code === 'INVALID_API_KEY') {
      userMessage = 'API 키가 유효하지 않습니다. 설정을 확인해 주세요.';
    } else if (error.code === 'RATE_LIMIT') {
      userMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    } else if (error.code === 'QUOTA_EXCEEDED') {
      userMessage = 'API 사용량이 초과되었습니다.';
    } else if (error.message) {
      userMessage = error.message;
    }

    return new Error(userMessage);
  }

  /**
   * 현재 요청 취소
   */
  cancelCurrentRequest() {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
      logger.info('Current AI request canceled');
    }
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * API 상태 확인
   */
  async checkAPIStatus() {
    try {
      if (!this.aiController.hasApiKey()) {
        return { status: 'no_api_key', message: 'API 키가 설정되지 않았습니다.' };
      }

      // 간단한 테스트 요청
      await this.aiController.generateText([{ role: 'user', content: 'test' }], {
        maxTokens: 1,
      });

      return { status: 'ok', message: 'API 연결이 정상입니다.' };
    } catch (error) {
      return {
        status: 'error',
        message: `API 연결 실패: ${error.message}`,
        error,
      };
    }
  }
}

export default ChatPanelAPI;
