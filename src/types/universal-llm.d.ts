/**
 * Universal LLM Types - 모든 LLM Provider 통합 인터페이스
 */

export type LLMProvider =
  | 'openai'
  | 'claude'
  | 'vertex'
  | 'grok'
  | 'azure-openai'
  | 'cohere'
  | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  endpoint?: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  model: string;
  finishReason?: string;
  error?: string;
}

export interface LLMStreamChunk {
  delta: string;
  usage?: Partial<LLMUsage>;
  finishReason?: string;
  error?: string;
}

export interface LLMGenerateOptions {
  stream?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: LLMStreamChunk) => void;
  timeout?: number;
}

export interface LLMProviderInterface {
  name: LLMProvider;
  displayName: string;
  icon: string;
  supportedFeatures: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
    json: boolean;
  };

  generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse>;

  streamText(
    messages: LLMMessage[],
    config: LLMConfig,
    options?: LLMGenerateOptions
  ): AsyncGenerator<LLMStreamChunk>;

  validateConfig(config: LLMConfig): Promise<boolean>;
  getModels(): Promise<string[]>;
  getAvailableModels?(config: LLMConfig): Promise<string[]>;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  description?: string;
  maxTokens: number;
  inputCostPer1K?: number;
  outputCostPer1K?: number;
  features: string[];
}

// Provider별 모델 정의
export const PROVIDER_MODELS: Record<LLMProvider, LLMModelInfo[]> = {
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4 Omni',
      maxTokens: 128000,
      inputCostPer1K: 0.0025,
      outputCostPer1K: 0.01,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4 Omni Mini',
      maxTokens: 128000,
      inputCostPer1K: 0.00015,
      outputCostPer1K: 0.0006,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      maxTokens: 16385,
      inputCostPer1K: 0.0005,
      outputCostPer1K: 0.0015,
      features: ['streaming', 'json', 'function-calling'],
    },
  ],
  claude: [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      maxTokens: 200000,
      inputCostPer1K: 0.003,
      outputCostPer1K: 0.015,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      maxTokens: 200000,
      inputCostPer1K: 0.00025,
      outputCostPer1K: 0.00125,
      features: ['streaming', 'vision', 'json'],
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      maxTokens: 200000,
      inputCostPer1K: 0.015,
      outputCostPer1K: 0.075,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
  ],
  vertex: [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      maxTokens: 2000000,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      maxTokens: 1000000,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      maxTokens: 2000000,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
  ],
  grok: [
    {
      id: 'grok-beta',
      name: 'Grok Beta',
      maxTokens: 131072,
      features: ['streaming', 'json'],
    },
    {
      id: 'grok-vision-beta',
      name: 'Grok Vision Beta',
      maxTokens: 131072,
      features: ['streaming', 'vision', 'json'],
    },
  ],
  'azure-openai': [
    {
      id: 'gpt-4o',
      name: 'GPT-4 Omni (Azure)',
      maxTokens: 128000,
      features: ['streaming', 'vision', 'json', 'function-calling'],
    },
    {
      id: 'gpt-35-turbo',
      name: 'GPT-3.5 Turbo (Azure)',
      maxTokens: 16385,
      features: ['streaming', 'json', 'function-calling'],
    },
  ],
  cohere: [
    {
      id: 'command-r-plus',
      name: 'Command R+',
      maxTokens: 128000,
      features: ['streaming', 'json', 'function-calling'],
    },
    {
      id: 'command-r',
      name: 'Command R',
      maxTokens: 128000,
      features: ['streaming', 'json'],
    },
  ],
  local: [
    {
      id: 'qwen2.5:7b',
      name: 'Qwen 2.5 7B',
      maxTokens: 32768,
      features: ['streaming', 'json'],
    },
    {
      id: 'llama3.2:3b',
      name: 'Llama 3.2 3B',
      maxTokens: 128000,
      features: ['streaming', 'json'],
    },
    {
      id: 'mistral:7b',
      name: 'Mistral 7B',
      maxTokens: 32768,
      features: ['streaming', 'json'],
    },
    {
      id: 'phi3:mini',
      name: 'Phi-3 Mini',
      maxTokens: 128000,
      features: ['streaming', 'json'],
    },
    {
      id: 'gemma2:9b',
      name: 'Gemma 2 9B',
      maxTokens: 8192,
      features: ['streaming', 'json'],
    },
    {
      id: 'custom',
      name: 'Custom Model',
      maxTokens: 4096,
      features: ['streaming'],
    },
  ],
};