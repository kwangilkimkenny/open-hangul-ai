/**
 * Vertex Provider - Google Vertex AI (Gemini) 모델 지원
 */

import { BaseProvider } from './base-provider';
import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMGenerateOptions,
  LLMProvider,
} from '../../../types/universal-llm';
import { PROVIDER_MODELS } from '../../../types/universal-llm';
import { VertexClient, type VertexRequest, type VertexContent } from '../vertex-client';

export class VertexProvider extends BaseProvider {
  name: LLMProvider = 'vertex';
  displayName = '🟡 Google Gemini';
  icon = '🟡';
  supportedFeatures = {
    streaming: true,
    functionCalling: true,
    vision: true,
    json: true,
  };

  private client: VertexClient;

  constructor() {
    super();
    this.client = new VertexClient();
  }

  async generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    const vertexRequest = this.convertToVertexRequest(messages, config);

    try {
      let fullText = '';
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of this.client.streamGenerate(vertexRequest, { signal: options.signal })) {
        if (chunk.text) {
          fullText += chunk.text;
        }
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount;
          completionTokens = chunk.usageMetadata.candidatesTokenCount;
        }
      }

      const modelInfo = PROVIDER_MODELS.vertex.find(m => m.id === config.model);

      return {
        content: fullText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost: this.calculateCost(
            promptTokens,
            completionTokens,
            modelInfo?.inputCostPer1K,
            modelInfo?.outputCostPer1K
          ),
        },
        model: config.model,
        finishReason: 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *streamText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): AsyncGenerator<LLMStreamChunk> {
    const vertexRequest = this.convertToVertexRequest(messages, config);

    try {
      let accumulatedTokens = {
        promptTokens: 0,
        completionTokens: 0,
      };

      for await (const chunk of this.client.streamGenerate(vertexRequest, { signal: options.signal })) {
        if (chunk.text) {
          const streamChunk: LLMStreamChunk = {
            delta: chunk.text,
          };

          if (chunk.usageMetadata) {
            accumulatedTokens.promptTokens = chunk.usageMetadata.promptTokenCount;
            accumulatedTokens.completionTokens = chunk.usageMetadata.candidatesTokenCount;
            streamChunk.usage = {
              promptTokens: accumulatedTokens.promptTokens,
              completionTokens: accumulatedTokens.completionTokens,
              totalTokens: accumulatedTokens.promptTokens + accumulatedTokens.completionTokens,
            };
          }

          if (chunk.finishReason) {
            streamChunk.finishReason = chunk.finishReason;
          }

          options.onChunk?.(streamChunk);
          yield streamChunk;
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    if (!config.model) return false;

    // 모델이 지원되는지 확인
    const supportedModels = PROVIDER_MODELS.vertex.map(m => m.id);
    if (!supportedModels.includes(config.model)) {
      return false;
    }

    // Vertex AI는 프록시를 통해 호출되므로 프록시 서버 상태 확인
    try {
      const testRequest: VertexRequest = {
        model: config.model as any,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello, respond with just "OK"' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0,
        },
      };

      // 간단한 테스트 요청
      const response = await this.client.generateText(testRequest);
      return response.toLowerCase().includes('ok');
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    return PROVIDER_MODELS.vertex.map(m => m.id);
  }

  /**
   * LLM 메시지를 Vertex AI 형식으로 변환
   */
  private convertToVertexRequest(messages: LLMMessage[], config: LLMConfig): VertexRequest {
    let systemInstruction: VertexContent | undefined;
    const contents: VertexContent[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Vertex AI는 system instruction을 별도 필드로 처리
        systemInstruction = {
          role: 'system',
          parts: [{ text: message.content }],
        };
      } else {
        // user, assistant 메시지 변환
        const role = message.role === 'assistant' ? 'model' : message.role;
        contents.push({
          role: role as 'user' | 'model',
          parts: [{ text: message.content }],
        });
      }
    }

    const request: VertexRequest = {
      model: config.model as any,
      contents,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        topP: config.topP || 1.0,
      },
    };

    if (systemInstruction) {
      request.systemInstruction = systemInstruction;
    }

    return request;
  }

  /**
   * Vertex AI 특화 기능들
   */

  /**
   * Safety Settings 설정
   */
  setSafetySettings(
    _harmCategories: Array<{
      category: string;
      threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
    }>
  ) {
    // Configure safety settings for Vertex AI
    // TODO: Implement safety settings configuration in VertexClient
    console.info('Safety settings configured:', _harmCategories.length, 'categories');
  }

  /**
   * Function Calling 지원
   */
  async generateWithFunctions(
    messages: LLMMessage[],
    config: LLMConfig,
    functions: Array<{
      name: string;
      description: string;
      parameters: any;
    }>,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse & { functionCall?: { name: string; args: any } }> {
    const vertexRequest = this.convertToVertexRequest(messages, config);

    // Function declarations 추가
    vertexRequest.tools = [
      {
        functionDeclarations: functions,
      },
    ];

    try {
      let fullText = '';
      let functionCall: { name: string; args: any } | undefined;
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of this.client.streamGenerate(vertexRequest, { signal: options.signal })) {
        if (chunk.text) {
          fullText += chunk.text;
        }
        if (chunk.functionCall) {
          functionCall = chunk.functionCall;
        }
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount;
          completionTokens = chunk.usageMetadata.candidatesTokenCount;
        }
      }

      const modelInfo = PROVIDER_MODELS.vertex.find(m => m.id === config.model);

      return {
        content: fullText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost: this.calculateCost(
            promptTokens,
            completionTokens,
            modelInfo?.inputCostPer1K,
            modelInfo?.outputCostPer1K
          ),
        },
        model: config.model,
        finishReason: 'stop',
        functionCall,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 이미지 분석 지원 (멀티모달)
   */
  async analyzeImage(
    imageData: string, // base64 encoded image
    prompt: string,
    config: LLMConfig
  ): Promise<LLMResponse> {
    const vertexRequest: VertexRequest = {
      model: config.model as any,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg', // 또는 적절한 MIME type
                data: imageData,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    };

    try {
      const response = await this.client.generateText(vertexRequest);
      return {
        content: response,
        usage: {
          promptTokens: this.estimateTokenCount(prompt),
          completionTokens: this.estimateTokenCount(response),
          totalTokens: this.estimateTokenCount(prompt) + this.estimateTokenCount(response),
          cost: 0,
        },
        model: config.model,
        finishReason: 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * JSON 모드 지원
   */
  async generateJSON<T>(
    messages: LLMMessage[],
    config: LLMConfig,
    schema: any,
    _options: LLMGenerateOptions = {}
  ): Promise<T> {
    const vertexRequest = this.convertToVertexRequest(messages, config);

    // JSON 응답 형식 지정
    vertexRequest.generationConfig = {
      ...vertexRequest.generationConfig,
      responseMimeType: 'application/json',
      responseSchema: schema,
    };

    try {
      const response = await this.client.generateText(vertexRequest);
      return JSON.parse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Removed unused estimatePromptTokens method
}