/**
 * Performance Monitoring and Caching System
 * LLM Provider 성능 모니터링 및 최적화
 */

import type { LLMProvider, LLMConfig } from '../../types/universal-llm';

// ================================
// 메트릭 수집 시스템
// ================================

export interface RequestMetrics {
  provider: LLMProvider;
  model: string;
  requestId: string;
  timestamp: number;
  duration: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  success: boolean;
  errorType?: string;
  tokensPerSecond: number;
}

export interface ProviderMetrics {
  provider: LLMProvider;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  avgTokensPerSecond: number;
  errorRate: number;
  uptime: number;
  lastRequest: number;
}

export class MetricsCollector {
  private metrics: Map<LLMProvider, RequestMetrics[]> = new Map();
  private readonly maxMetrics = 1000; // 메모리 사용량 제한

  /**
   * 요청 메트릭 기록
   */
  recordRequest(metrics: RequestMetrics): void {
    const { provider } = metrics;

    if (!this.metrics.has(provider)) {
      this.metrics.set(provider, []);
    }

    const providerMetrics = this.metrics.get(provider)!;
    providerMetrics.push(metrics);

    // 메트릭 개수 제한 (FIFO)
    if (providerMetrics.length > this.maxMetrics) {
      providerMetrics.splice(0, providerMetrics.length - this.maxMetrics);
    }
  }

  /**
   * Provider별 집계 메트릭 계산
   */
  getProviderMetrics(provider: LLMProvider, timeWindow?: number): ProviderMetrics {
    const requests = this.metrics.get(provider) || [];

    // 시간 윈도우 필터링
    const now = Date.now();
    const filteredRequests = timeWindow
      ? requests.filter(r => now - r.timestamp <= timeWindow)
      : requests;

    if (filteredRequests.length === 0) {
      return {
        provider,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        avgLatency: 0,
        avgTokensPerSecond: 0,
        errorRate: 0,
        uptime: 100,
        lastRequest: 0,
      };
    }

    const successfulRequests = filteredRequests.filter(r => r.success);
    const totalDuration = filteredRequests.reduce((sum, r) => sum + r.duration, 0);
    const totalTokens = filteredRequests.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCost = filteredRequests.reduce((sum, r) => sum + r.cost, 0);
    const totalTPS = successfulRequests.reduce((sum, r) => sum + r.tokensPerSecond, 0);

    return {
      provider,
      totalRequests: filteredRequests.length,
      successfulRequests: successfulRequests.length,
      failedRequests: filteredRequests.length - successfulRequests.length,
      totalTokens,
      totalCost,
      avgLatency: Math.round(totalDuration / filteredRequests.length),
      avgTokensPerSecond: successfulRequests.length > 0 ? Math.round(totalTPS / successfulRequests.length) : 0,
      errorRate: Number(((filteredRequests.length - successfulRequests.length) / filteredRequests.length * 100).toFixed(2)),
      uptime: Number((successfulRequests.length / filteredRequests.length * 100).toFixed(2)),
      lastRequest: Math.max(...filteredRequests.map(r => r.timestamp)),
    };
  }

  /**
   * 모든 Provider 메트릭 반환
   */
  getAllMetrics(timeWindow?: number): Record<LLMProvider, ProviderMetrics> {
    const result: Record<string, ProviderMetrics> = {};

    for (const provider of this.metrics.keys()) {
      result[provider] = this.getProviderMetrics(provider, timeWindow);
    }

    return result as Record<LLMProvider, ProviderMetrics>;
  }

  /**
   * 성능 순위 반환
   */
  getPerformanceRanking(metric: keyof ProviderMetrics = 'avgTokensPerSecond'): Array<{ provider: LLMProvider; value: number }> {
    const allMetrics = this.getAllMetrics();

    return Object.entries(allMetrics)
      .map(([provider, metrics]) => ({
        provider: provider as LLMProvider,
        value: metrics[metric] as number,
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * 메트릭 리셋
   */
  reset(provider?: LLMProvider): void {
    if (provider) {
      this.metrics.delete(provider);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * 메트릭 내보내기 (분석용)
   */
  exportMetrics(): string {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics.entries()),
      summary: this.getAllMetrics(),
    };

    return JSON.stringify(data, null, 2);
  }
}

// ================================
// 설정 검증 캐싱 시스템
// ================================

interface ValidationCacheEntry {
  result: boolean;
  timestamp: number;
  expiry: number;
}

export class ConfigValidationCache {
  private cache = new Map<string, ValidationCacheEntry>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5분

  /**
   * 캐시 키 생성
   */
  private getCacheKey(config: LLMConfig): string {
    const keyData = {
      provider: config.provider,
      model: config.model,
      endpoint: config.endpoint,
      // API 키는 해시화 (보안)
      apiKeyHash: config.apiKey ? this.hashString(config.apiKey) : undefined,
    };
    return JSON.stringify(keyData);
  }

  /**
   * 간단한 해시 함수 (보안용)
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32-bit integer 변환
    }
    return hash.toString(16);
  }

  /**
   * 캐시된 검증 결과 조회
   */
  get(config: LLMConfig): boolean | null {
    const key = this.getCacheKey(config);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * 검증 결과 캐시 저장
   */
  set(config: LLMConfig, result: boolean, ttl?: number): void {
    const key = this.getCacheKey(config);
    const now = Date.now();

    this.cache.set(key, {
      result,
      timestamp: now,
      expiry: now + (ttl || this.defaultTTL),
    });
  }

  /**
   * 만료된 캐시 정리
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 특정 Provider 캐시 무효화
   */
  invalidate(provider?: LLMProvider): void {
    if (!provider) {
      this.cache.clear();
      return;
    }

    for (const [key, _] of this.cache.entries()) {
      try {
        const keyData = JSON.parse(key);
        if (keyData.provider === provider) {
          this.cache.delete(key);
        }
      } catch {
        // 파싱 실패한 키는 삭제
        this.cache.delete(key);
      }
    }
  }

  /**
   * 캐시 통계
   */
  getStats(): {
    totalEntries: number;
    hitRate: number;
    memoryUsage: string;
  } {
    return {
      totalEntries: this.cache.size,
      hitRate: 0, // 실제 구현에서는 hit/miss 추적 필요
      memoryUsage: `${Math.round(JSON.stringify([...this.cache.entries()]).length / 1024)}KB`,
    };
  }
}

// ================================
// Provider 로드 밸런싱
// ================================

export interface LoadBalancerConfig {
  strategy: 'round-robin' | 'least-latency' | 'least-cost' | 'weighted';
  weights?: Record<LLMProvider, number>;
  healthCheckInterval?: number;
}

export class ProviderLoadBalancer {
  private roundRobinIndex = 0;
  private healthStatus = new Map<LLMProvider, boolean>();
  private metrics: MetricsCollector;
  private config: LoadBalancerConfig;

  constructor(
    metrics: MetricsCollector,
    config: LoadBalancerConfig = { strategy: 'least-latency' }
  ) {
    this.metrics = metrics;
    this.config = config;
  }

  /**
   * 최적 Provider 선택
   */
  selectProvider(availableProviders: LLMProvider[], requirements?: {
    maxCost?: number;
    maxLatency?: number;
    minUptime?: number;
  }): LLMProvider | null {
    const healthyProviders = availableProviders.filter(p =>
      this.healthStatus.get(p) !== false
    );

    if (healthyProviders.length === 0) {
      return availableProviders[0] || null;
    }

    // 요구사항 필터링
    let candidates = healthyProviders;
    if (requirements) {
      candidates = healthyProviders.filter(provider => {
        const metrics = this.metrics.getProviderMetrics(provider, 300000); // 5분 윈도우

        if (requirements.maxLatency && metrics.avgLatency > requirements.maxLatency) {
          return false;
        }

        if (requirements.minUptime && metrics.uptime < requirements.minUptime) {
          return false;
        }

        // maxCost는 실제 요청 시점에 계산해야 함
        return true;
      });
    }

    if (candidates.length === 0) {
      return healthyProviders[0];
    }

    switch (this.config.strategy) {
      case 'round-robin':
        return this.selectRoundRobin(candidates);

      case 'least-latency':
        return this.selectLeastLatency(candidates);

      case 'least-cost':
        return this.selectLeastCost(candidates);

      case 'weighted':
        return this.selectWeighted(candidates);

      default:
        return candidates[0];
    }
  }

  private selectRoundRobin(providers: LLMProvider[]): LLMProvider {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex++;
    return provider;
  }

  private selectLeastLatency(providers: LLMProvider[]): LLMProvider {
    let bestProvider = providers[0];
    let bestLatency = Infinity;

    for (const provider of providers) {
      const metrics = this.metrics.getProviderMetrics(provider, 300000);
      if (metrics.avgLatency < bestLatency && metrics.totalRequests > 0) {
        bestLatency = metrics.avgLatency;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  private selectLeastCost(providers: LLMProvider[]): LLMProvider {
    let bestProvider = providers[0];
    let bestCostPerToken = Infinity;

    for (const provider of providers) {
      const metrics = this.metrics.getProviderMetrics(provider, 300000);
      if (metrics.totalTokens > 0) {
        const costPerToken = metrics.totalCost / metrics.totalTokens;
        if (costPerToken < bestCostPerToken) {
          bestCostPerToken = costPerToken;
          bestProvider = provider;
        }
      }
    }

    return bestProvider;
  }

  private selectWeighted(providers: LLMProvider[]): LLMProvider {
    const weights = this.config.weights || {};
    const totalWeight = providers.reduce((sum, p) => sum + (weights[p] || 1), 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (const provider of providers) {
      currentWeight += weights[provider] || 1;
      if (random <= currentWeight) {
        return provider;
      }
    }

    return providers[0];
  }

  /**
   * Provider 상태 업데이트
   */
  updateHealthStatus(provider: LLMProvider, isHealthy: boolean): void {
    this.healthStatus.set(provider, isHealthy);
  }

  /**
   * 로드 밸런서 통계
   */
  getStats(): {
    healthyProviders: LLMProvider[];
    unhealthyProviders: LLMProvider[];
    requestDistribution: Record<LLMProvider, number>;
  } {
    const allMetrics = this.metrics.getAllMetrics();

    const healthy: LLMProvider[] = [];
    const unhealthy: LLMProvider[] = [];
    const distribution: Record<string, number> = {};

    for (const [provider, isHealthy] of this.healthStatus.entries()) {
      if (isHealthy) {
        healthy.push(provider);
      } else {
        unhealthy.push(provider);
      }

      distribution[provider] = allMetrics[provider]?.totalRequests || 0;
    }

    return {
      healthyProviders: healthy,
      unhealthyProviders: unhealthy,
      requestDistribution: distribution as Record<LLMProvider, number>,
    };
  }
}

// ================================
// 성능 모니터링 데시보드 데이터
// ================================

export interface DashboardData {
  overview: {
    totalRequests: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
    activeProviders: number;
  };
  providerMetrics: Record<LLMProvider, ProviderMetrics>;
  topPerformers: {
    fastestProvider: LLMProvider;
    cheapestProvider: LLMProvider;
    mostReliableProvider: LLMProvider;
  };
  trends: {
    requestsOverTime: Array<{ timestamp: number; count: number }>;
    latencyOverTime: Array<{ timestamp: number; latency: number }>;
    costOverTime: Array<{ timestamp: number; cost: number }>;
  };
}

export class PerformanceDashboard {
  private metrics: MetricsCollector;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
  }

  /**
   * 대시보드 데이터 생성
   */
  generateDashboardData(timeWindow: number = 3600000): DashboardData { // 1시간 기본값
    const allMetrics = this.metrics.getAllMetrics(timeWindow);
    const providers = Object.keys(allMetrics) as LLMProvider[];

    // 전체 개요
    const totalRequests = providers.reduce((sum, p) => sum + allMetrics[p].totalRequests, 0);
    const totalSuccessful = providers.reduce((sum, p) => sum + allMetrics[p].successfulRequests, 0);
    const totalCost = providers.reduce((sum, p) => sum + allMetrics[p].totalCost, 0);
    const avgLatency = totalRequests > 0
      ? Math.round(providers.reduce((sum, p) => sum + (allMetrics[p].avgLatency * allMetrics[p].totalRequests), 0) / totalRequests)
      : 0;

    // 최고 성능자들
    const latencyRanking = this.metrics.getPerformanceRanking('avgLatency').filter(p => p.value > 0);
    const uptimeRanking = this.metrics.getPerformanceRanking('uptime');

    // 비용은 토큰당 비용으로 계산
    const costRanking = providers
      .map(provider => ({
        provider,
        value: allMetrics[provider].totalTokens > 0
          ? allMetrics[provider].totalCost / allMetrics[provider].totalTokens
          : Infinity
      }))
      .filter(p => p.value < Infinity)
      .sort((a, b) => a.value - b.value);

    return {
      overview: {
        totalRequests,
        successRate: totalRequests > 0 ? Number((totalSuccessful / totalRequests * 100).toFixed(2)) : 0,
        avgLatency,
        totalCost,
        activeProviders: providers.filter(p => allMetrics[p].totalRequests > 0).length,
      },
      providerMetrics: allMetrics,
      topPerformers: {
        fastestProvider: latencyRanking[0]?.provider || providers[0],
        cheapestProvider: costRanking[0]?.provider || providers[0],
        mostReliableProvider: uptimeRanking[0]?.provider || providers[0],
      },
      trends: {
        requestsOverTime: [], // 실제 구현에서는 시계열 데이터 필요
        latencyOverTime: [],
        costOverTime: [],
      },
    };
  }
}

// 싱글톤 인스턴스들
export const metricsCollector = new MetricsCollector();
export const validationCache = new ConfigValidationCache();
export const loadBalancer = new ProviderLoadBalancer(metricsCollector);
export const dashboard = new PerformanceDashboard(metricsCollector);

// 주기적인 정리 작업
setInterval(() => {
  validationCache.cleanup();
}, 60000); // 1분마다 캐시 정리