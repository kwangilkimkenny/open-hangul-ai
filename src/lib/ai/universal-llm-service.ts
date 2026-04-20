/**
 * Universal LLM Service
 *
 * 다양한 LLM 제공자를 단일 인터페이스로 통합 관리합니다.
 *
 * 지원 제공자:
 * - OpenAI (GPT-4o, GPT-3.5)
 * - Anthropic Claude (3.5 Sonnet/Haiku/Opus)
 * - Google Vertex AI (Gemini)
 * - X.AI Grok
 * - Azure OpenAI
 * - Cohere Command R/R+
 * - 로컬 모델 (Ollama, vLLM, TGI)
 *
 * 주요 기능:
 * - Smart Provider Selection & Fallback
 * - Performance Monitoring & Analytics
 * - Cost Optimization & Rate Limiting
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: provider-agnostic LLM response shapes intentionally use `any`.

import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMGenerateOptions,
  LLMProviderInterface,
  LLMProvider,
} from '../../types/universal-llm';
import { PROVIDER_MODELS } from '../../types/universal-llm';
import {
  metricsCollector,
  validationCache,
  loadBalancer,
  dashboard,
  type RequestMetrics,
  type DashboardData,
} from './performance';
import { LLMError } from './errors';

export class UniversalLLMService {
  private providers = new Map<LLMProvider, LLMProviderInterface>();
  private initialized = false;

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    if (this.initialized) return;

    try {
      // 동적 import로 Provider들 로드 (번들 크기 최적화)
      const [
        openaiModule,
        claudeModule,
        vertexModule,
        grokModule,
        azureModule,
        cohereModule,
        localModule,
      ] = await Promise.allSettled([
        import('./providers/openai-provider'),
        import('./providers/claude-provider'),
        import('./providers/vertex-provider'),
        import('./providers/grok-provider'),
        import('./providers/azure-openai-provider'),
        import('./providers/cohere-provider'),
        import('./providers/local-provider'),
      ]);

      // 성공적으로 로드된 Provider만 등록
      if (openaiModule.status === 'fulfilled') {
        this.providers.set('openai', new openaiModule.value.OpenAIProvider());
      }
      if (claudeModule.status === 'fulfilled') {
        this.providers.set('claude', new claudeModule.value.ClaudeProvider());
      }
      if (vertexModule.status === 'fulfilled') {
        this.providers.set('vertex', new vertexModule.value.VertexProvider());
      }
      if (grokModule.status === 'fulfilled') {
        this.providers.set('grok', new grokModule.value.GrokProvider());
      }
      if (azureModule.status === 'fulfilled') {
        this.providers.set('azure-openai', new azureModule.value.AzureOpenAIProvider());
      }
      if (cohereModule.status === 'fulfilled') {
        this.providers.set('cohere', new cohereModule.value.CohereProvider());
      }
      if (localModule.status === 'fulfilled') {
        this.providers.set('local', new localModule.value.LocalProvider());
      }

      this.initialized = true;
      console.log(`✅ UniversalLLMService 초기화 완료: ${this.providers.size}개 Provider 로드`);
    } catch (error) {
      console.error('❌ UniversalLLMService 초기화 실패:', error);
    }
  }

  /**
   * 사용 가능한 모든 Provider 목록 반환
   */
  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 특정 Provider 정보 반환
   */
  getProvider(provider: LLMProvider): LLMProviderInterface | null {
    return this.providers.get(provider) || null;
  }

  /**
   * Provider별 지원 모델 목록 반환
   */
  getModelsForProvider(provider: LLMProvider): string[] {
    const models = PROVIDER_MODELS[provider];
    return models ? models.map(m => m.id) : [];
  }

  /**
   * 설정 검증 (캐싱 지원)
   */
  async validateConfig(
    config: LLMConfig,
    useCache: boolean = true
  ): Promise<{ valid: boolean; error?: string }> {
    await this.initializeProviders();

    // 캐시 확인
    if (useCache) {
      const cachedResult = validationCache.get(config);
      if (cachedResult !== null) {
        console.debug(`[${config.provider}] Validation cache hit`);
        return { valid: cachedResult };
      }
    }

    const provider = this.providers.get(config.provider);
    if (!provider) {
      const error = `Provider '${config.provider}' not available`;
      validationCache.set(config, false, 30000); // 30초 캐시
      return { valid: false, error };
    }

    try {
      const startTime = performance.now();
      const isValid = await provider.validateConfig(config);
      const endTime = performance.now();

      console.debug(
        `[${config.provider}] Validation completed in ${Math.round(endTime - startTime)}ms`
      );

      // 성공한 검증만 캐시 (실패는 재시도 가능성 고려)
      if (isValid) {
        validationCache.set(config, isValid, 300000); // 5분 캐시
      }

      return { valid: isValid };
    } catch (error) {
      const errorMessage =
        error instanceof LLMError ? error.getUserMessage() : (error as Error).message;
      validationCache.set(config, false, 30000); // 짧은 캐시 (재시도 허용)
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * 텍스트 생성 (단일 응답) - 성능 모니터링 포함
   */
  async generateText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse> {
    await this.initializeProviders();

    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new LLMError(
        `Provider '${config.provider}' not available`,
        'validation' as any,
        config.provider
      );
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = performance.now();
    let response: LLMResponse;
    let success = false;
    let errorType: string | undefined;

    try {
      console.debug(`[${config.provider}] Starting generation request ${requestId}`);
      response = await provider.generateText(messages, config, options);
      success = true;

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 메트릭 수집
      const metrics: RequestMetrics = {
        provider: config.provider,
        model: config.model,
        requestId,
        timestamp: Date.now(),
        duration,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        cost: response.usage.cost || 0,
        success,
        tokensPerSecond: Math.round(response.usage.completionTokens / (duration / 1000)),
      };

      metricsCollector.recordRequest(metrics);
      loadBalancer.updateHealthStatus(config.provider, true);

      console.debug(
        `[${config.provider}] Request ${requestId} completed successfully in ${Math.round(duration)}ms`
      );
      return response;
    } catch (error) {
      success = false;
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (error instanceof LLMError) {
        errorType = error.type;
        loadBalancer.updateHealthStatus(
          config.provider,
          !['rate_limit', 'server_error'].includes(error.type)
        );
      } else {
        errorType = 'unknown';
        loadBalancer.updateHealthStatus(config.provider, false);
      }

      // 실패 메트릭 수집
      const metrics: RequestMetrics = {
        provider: config.provider,
        model: config.model,
        requestId,
        timestamp: Date.now(),
        duration,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        success: false,
        errorType,
        tokensPerSecond: 0,
      };

      metricsCollector.recordRequest(metrics);

      console.error(
        `[${config.provider}] Request ${requestId} failed after ${Math.round(duration)}ms:`,
        (error as any)?.message
      );

      if (error instanceof LLMError) {
        throw error;
      }

      throw new LLMError(
        `${config.provider} generation failed: ${(error as Error).message}`,
        'unknown' as any,
        config.provider,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 스트리밍 텍스트 생성
   */
  async *streamText(
    messages: LLMMessage[],
    config: LLMConfig,
    options: LLMGenerateOptions = {}
  ): AsyncGenerator<LLMStreamChunk> {
    await this.initializeProviders();

    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`Provider '${config.provider}' not available`);
    }

    try {
      yield* provider.streamText(messages, config, options);
    } catch (error) {
      throw new Error(`${config.provider} streaming failed: ${(error as Error).message}`);
    }
  }

  /**
   * 다중 Provider 병렬 생성 (결과 비교/선택용)
   */
  async generateWithMultipleProviders(
    messages: LLMMessage[],
    configs: LLMConfig[],
    options: LLMGenerateOptions = {}
  ): Promise<{ provider: LLMProvider; response: LLMResponse; error?: string }[]> {
    const results = await Promise.allSettled(
      configs.map(async config => ({
        provider: config.provider,
        response: await this.generateText(messages, config, options),
      }))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          provider: configs[index].provider,
          response: {
            content: '',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            model: configs[index].model,
          },
          error: result.reason.message,
        };
      }
    });
  }

  /**
   * 성능 기반 Provider 추천 (개선된 알고리즘)
   */
  getRecommendedProvider(
    promptLength: number,
    quality: 'fast' | 'balanced' | 'best' | 'cost-effective',
    context?: {
      maxCost?: number;
      maxLatency?: number;
      privacyRequired?: boolean;
      languages?: string[];
    }
  ): { provider: LLMProvider; model: string; reason: string; confidence: number } {
    const estimatedTokens = Math.ceil(promptLength / 4);

    // 프라이버시가 필요한 경우 로컬 모델 우선
    if (context?.privacyRequired) {
      return {
        provider: 'local',
        model: 'qwen2.5:7b',
        reason: '프라이버시 보장, 로컬 처리',
        confidence: 0.9,
      };
    }

    // 성능 메트릭 기반 추천
    const recentMetrics = metricsCollector.getAllMetrics(1800000); // 30분 윈도우
    const availableProviders = Object.keys(recentMetrics) as LLMProvider[];

    if (availableProviders.length > 0) {
      const recommendation = loadBalancer.selectProvider(availableProviders, {
        maxLatency: context?.maxLatency || (quality === 'fast' ? 5000 : 30000),
        minUptime: 95,
      });

      if (recommendation) {
        const metrics = recentMetrics[recommendation];
        return {
          provider: recommendation,
          model: this.getModelForProvider(recommendation, quality, estimatedTokens),
          reason: `실시간 성능 최적 (지연: ${metrics.avgLatency}ms, 성공률: ${metrics.uptime}%)`,
          confidence: 0.95,
        };
      }
    }

    // 기본 추천 로직 (메트릭이 없는 경우)
    switch (quality) {
      case 'fast':
        if (estimatedTokens < 8000) {
          return {
            provider: 'claude',
            model: 'claude-3-haiku-20240307',
            reason: '빠른 응답, 저비용',
            confidence: 0.8,
          };
        }
        break;

      case 'cost-effective':
        if (context?.maxCost && context.maxCost < 0.01) {
          return {
            provider: 'local',
            model: 'qwen2.5:7b',
            reason: '무료, 저비용',
            confidence: 0.7,
          };
        }
        return {
          provider: 'openai',
          model: 'gpt-4o-mini',
          reason: '가성비 최적',
          confidence: 0.85,
        };

      case 'balanced':
        if (estimatedTokens < 50000) {
          return {
            provider: 'openai',
            model: 'gpt-4o-mini',
            reason: '균형잡힌 품질과 비용',
            confidence: 0.8,
          };
        }
        break;

      case 'best':
        if (estimatedTokens > 100000) {
          return {
            provider: 'claude',
            model: 'claude-3-5-sonnet-20241022',
            reason: '긴 컨텍스트, 최고 품질',
            confidence: 0.9,
          };
        }
        return {
          provider: 'openai',
          model: 'gpt-4o',
          reason: '최고 품질',
          confidence: 0.85,
        };
    }

    // 기본값
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      reason: '안정적인 기본 선택',
      confidence: 0.7,
    };
  }

  /**
   * Provider별 최적 모델 선택
   */
  private getModelForProvider(provider: LLMProvider, quality: string, tokenCount: number): string {
    const models = PROVIDER_MODELS[provider] || [];

    switch (provider) {
      case 'openai':
        if (quality === 'fast' || tokenCount < 4000) return 'gpt-4o-mini';
        return 'gpt-4o';

      case 'claude':
        if (quality === 'fast') return 'claude-3-haiku-20240307';
        if (tokenCount > 50000) return 'claude-3-5-sonnet-20241022';
        return 'claude-3-5-sonnet-20241022';

      case 'vertex':
        if (quality === 'fast') return 'gemini-2.5-flash';
        return 'gemini-2.5-pro';

      case 'local':
        if (tokenCount < 4000) return 'llama3.2:3b';
        return 'qwen2.5:7b';

      default:
        return models[0]?.id || 'default';
    }
  }

  /**
   * 자동 Fallback 생성 (Primary 실패 시 Secondary로 자동 전환)
   */
  async generateWithFallback(
    messages: LLMMessage[],
    primaryConfig: LLMConfig,
    fallbackConfigs: LLMConfig[],
    options: LLMGenerateOptions = {}
  ): Promise<{ response: LLMResponse; usedProvider: LLMProvider; attempts: number }> {
    const allConfigs = [primaryConfig, ...fallbackConfigs];
    let lastError: Error | null = null;

    for (let i = 0; i < allConfigs.length; i++) {
      try {
        const response = await this.generateText(messages, allConfigs[i], options);
        return {
          response,
          usedProvider: allConfigs[i].provider,
          attempts: i + 1,
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ ${allConfigs[i].provider} 실패, fallback 시도 중...`);
        continue;
      }
    }

    throw new Error(`모든 Provider 실패. 마지막 오류: ${lastError?.message}`);
  }

  /**
   * 통계 및 사용량 반환 (실제 구현)
   */
  getUsageStats(timeWindow?: number): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalCost: number;
    avgLatency: number;
    providerBreakdown: Record<LLMProvider, number>;
    topPerformers: {
      fastest: LLMProvider | null;
      cheapest: LLMProvider | null;
      mostReliable: LLMProvider | null;
    };
  } {
    const allMetrics = metricsCollector.getAllMetrics(timeWindow);
    const providers = Object.keys(allMetrics) as LLMProvider[];

    const totalRequests = providers.reduce((sum, p) => sum + allMetrics[p].totalRequests, 0);
    const successfulRequests = providers.reduce(
      (sum, p) => sum + allMetrics[p].successfulRequests,
      0
    );
    const totalCost = providers.reduce((sum, p) => sum + allMetrics[p].totalCost, 0);

    const avgLatency =
      totalRequests > 0
        ? Math.round(
            providers.reduce(
              (sum, p) => sum + allMetrics[p].avgLatency * allMetrics[p].totalRequests,
              0
            ) / totalRequests
          )
        : 0;

    const providerBreakdown = providers.reduce(
      (acc, provider) => {
        acc[provider] = allMetrics[provider].totalRequests;
        return acc;
      },
      {} as Record<LLMProvider, number>
    );

    // 성능 순위
    const latencyRanking = metricsCollector
      .getPerformanceRanking('avgLatency')
      .filter(p => allMetrics[p.provider]?.totalRequests > 0);
    const uptimeRanking = metricsCollector
      .getPerformanceRanking('uptime')
      .filter(p => allMetrics[p.provider]?.totalRequests > 0);

    const costRanking = providers
      .filter(p => allMetrics[p].totalTokens > 0)
      .map(p => ({
        provider: p,
        value: allMetrics[p].totalCost / allMetrics[p].totalTokens,
      }))
      .sort((a, b) => a.value - b.value);

    return {
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      totalCost: Number(totalCost.toFixed(4)),
      avgLatency,
      providerBreakdown,
      topPerformers: {
        fastest: latencyRanking[0]?.provider || null,
        cheapest: costRanking[0]?.provider || null,
        mostReliable: uptimeRanking[0]?.provider || null,
      },
    };
  }

  /**
   * 성능 대시보드 데이터 생성
   */
  getPerformanceDashboard(timeWindow?: number): DashboardData {
    return dashboard.generateDashboardData(timeWindow);
  }

  /**
   * Provider 성능 메트릭 상세 조회
   */
  getProviderMetrics(provider: LLMProvider, timeWindow?: number) {
    return metricsCollector.getProviderMetrics(provider, timeWindow);
  }

  /**
   * 성능 기반 자동 Provider 선택
   */
  async generateWithAutoSelection(
    messages: LLMMessage[],
    requirements: {
      quality: 'fast' | 'balanced' | 'best' | 'cost-effective';
      maxCost?: number;
      maxLatency?: number;
      privacyRequired?: boolean;
      excludeProviders?: LLMProvider[];
    },
    options: LLMGenerateOptions = {}
  ): Promise<LLMResponse & { usedProvider: LLMProvider; recommendation: any }> {
    const promptLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const availableProviders = this.getAvailableProviders().filter(
      p => !requirements.excludeProviders?.includes(p)
    );

    if (availableProviders.length === 0) {
      throw new LLMError('사용 가능한 Provider가 없습니다', 'validation' as any, 'system');
    }

    // 성능 기반 추천
    const recommendation = this.getRecommendedProvider(promptLength, requirements.quality, {
      maxCost: requirements.maxCost,
      maxLatency: requirements.maxLatency,
      privacyRequired: requirements.privacyRequired,
    });

    // 추천된 Provider가 사용 가능한지 확인
    let selectedProvider = recommendation.provider;
    if (!availableProviders.includes(selectedProvider)) {
      selectedProvider =
        loadBalancer.selectProvider(availableProviders, {
          maxCost: requirements.maxCost,
          maxLatency: requirements.maxLatency,
          minUptime: 90,
        }) || availableProviders[0];
    }

    const config = this.getDefaultConfigForProvider(selectedProvider);
    config.model = this.getModelForProvider(
      selectedProvider,
      requirements.quality,
      Math.ceil(promptLength / 4)
    );

    const response = await this.generateText(messages, config, options);

    return {
      ...response,
      usedProvider: selectedProvider,
      recommendation: {
        ...recommendation,
        actualProvider: selectedProvider,
        reasonForChange:
          selectedProvider !== recommendation.provider
            ? `${recommendation.provider} 사용 불가, ${selectedProvider}로 대체`
            : undefined,
      },
    };
  }

  /**
   * Provider별 기본 설정 반환
   */
  private getDefaultConfigForProvider(provider: LLMProvider): LLMConfig {
    const baseConfig = {
      provider,
      model: '',
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1.0,
    };

    // Provider별 기본 설정 커스터마이징
    switch (provider) {
      case 'local':
        return {
          ...baseConfig,
          endpoint: 'http://localhost:11434/v1/chat/completions',
        };
      case 'azure-openai':
        return {
          ...baseConfig,
          endpoint: '',
          apiKey: '',
        };
      default:
        return {
          ...baseConfig,
          apiKey: '',
        };
    }
  }

  /**
   * 캐시 관리
   */
  clearCache(provider?: LLMProvider): void {
    validationCache.invalidate(provider);
    console.log(`Validation cache cleared${provider ? ` for ${provider}` : ''}`);
  }

  /**
   * 메트릭 내보내기
   */
  exportMetrics(): string {
    return metricsCollector.exportMetrics();
  }

  /**
   * Provider 상태 체크 (향상된 버전)
   */
  async checkProviderHealth(): Promise<
    Record<
      LLMProvider,
      {
        status: 'ok' | 'error' | 'degraded';
        latency?: number;
        error?: string;
        uptime?: number;
        lastCheck?: number;
      }
    >
  > {
    const results: Record<string, any> = {};
    const healthChecks = Array.from(this.providers.entries()).map(
      async ([providerName, provider]) => {
        const start = Date.now();
        try {
          // 기본 설정으로 테스트
          const testConfig = this.getDefaultConfigForProvider(providerName);
          testConfig.model = this.getModelsForProvider(providerName)[0] || 'default';
          testConfig.maxTokens = 10;
          testConfig.temperature = 0;

          const isValid = await provider.validateConfig(testConfig);
          const latency = Date.now() - start;

          // 최근 메트릭 확인
          const metrics = metricsCollector.getProviderMetrics(providerName, 900000); // 15분 윈도우

          let status: 'ok' | 'error' | 'degraded' = 'ok';
          if (!isValid) {
            status = 'error';
          } else if (metrics.uptime < 95 || metrics.avgLatency > 10000) {
            status = 'degraded';
          }

          results[providerName] = {
            status,
            latency,
            uptime: metrics.uptime,
            lastCheck: Date.now(),
          };

          loadBalancer.updateHealthStatus(providerName, status !== 'error');
        } catch (error) {
          const latency = Date.now() - start;
          results[providerName] = {
            status: 'error',
            latency,
            error: error instanceof Error ? error.message : String(error),
            lastCheck: Date.now(),
          };

          loadBalancer.updateHealthStatus(providerName, false);
        }
      }
    );

    await Promise.allSettled(healthChecks);
    return results;
  }
}

// 싱글톤 인스턴스
export const universalLLM = new UniversalLLMService();
export default universalLLM;
