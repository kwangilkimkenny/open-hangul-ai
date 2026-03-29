// ============================================================
// AEGIS REST API Client — native fetch, retry, fail-close/open
// ============================================================

import type { Decision } from '../core/types';
import type { AegisConfig } from '../core/config';
import { withRetry, RetryableError } from './retry';

// --- Request/Response types ---

export interface JudgeRequest {
  prompt: string;
  context?: string;
  options?: {
    scenario?: string;
    enablePiiScan?: boolean;
    enableInjectionDetect?: boolean;
    provider?: string;
  };
}

export interface JudgeResponse {
  decision: Decision;
  risks: Array<{
    label: string;
    severity: string;
    description: string;
    score: number;
  }>;
  confidence: number;
  modifiedContent?: string;
  piiDetected?: Array<{ type: string; masked: string }>;
  latencyMs: number;
}

// --- Client ---

export class AegisClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private failPolicy: 'close' | 'open';

  constructor(config: AegisConfig) {
    if (!config.serverUrl) {
      throw new Error('AegisClient requires serverUrl in config');
    }
    if (!config.apiKey) {
      throw new Error('AegisClient requires apiKey in config');
    }

    // Remove trailing slash
    this.baseUrl = config.serverUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 3000;
    this.failPolicy = config.failPolicy ?? 'close';
  }

  /**
   * POST /v1/judge — Main judgment endpoint.
   * Sends prompt and options, returns decision with risk analysis.
   */
  async judge(request: JudgeRequest): Promise<JudgeResponse> {
    return this.fetchJson<JudgeResponse>('/v1/judge', {
      prompt: request.prompt,
      context: request.context,
      ...request.options,
    });
  }

  /**
   * Input check before LLM call.
   * Convenience wrapper around judge() for pre-call filtering.
   */
  async checkInput(
    prompt: string,
    options?: JudgeRequest['options'],
  ): Promise<JudgeResponse> {
    return this.judge({
      prompt,
      options: {
        ...options,
        enableInjectionDetect: options?.enableInjectionDetect ?? true,
        enablePiiScan: options?.enablePiiScan ?? true,
      },
    });
  }

  /**
   * Output check after LLM response.
   * Checks the model's output for harmful content, PII leakage, etc.
   */
  async checkOutput(
    response: string,
    originalPrompt?: string,
  ): Promise<JudgeResponse> {
    return this.fetchJson<JudgeResponse>('/v1/judge', {
      prompt: response,
      context: originalPrompt,
      checkType: 'output',
      enablePiiScan: true,
    });
  }

  /**
   * Health check endpoint.
   */
  async health(): Promise<{ status: string; version: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
      }

      return (await res.json()) as { status: string; version: string };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Internal fetch with retry, timeout, and fail-policy handling.
   */
  private async fetchJson<T>(path: string, body: unknown): Promise<T> {
    try {
      return await withRetry(
        () => this.doFetch<T>(path, body),
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          retryableStatuses: [429, 500, 502, 503, 504],
        },
      );
    } catch (err: unknown) {
      // Apply fail policy
      if (this.failPolicy === 'open') {
        // Fail-open: return a permissive default response
        return {
          decision: 'APPROVE',
          risks: [],
          confidence: 0,
          latencyMs: 0,
        } as unknown as T;
      }

      // Fail-close: return a blocking response
      if (this.failPolicy === 'close') {
        return {
          decision: 'BLOCK',
          risks: [
            {
              label: 'service_unavailable',
              severity: 'high',
              description:
                err instanceof Error
                  ? `AEGIS service error: ${err.message}`
                  : 'AEGIS service unavailable',
              score: 1.0,
            },
          ],
          confidence: 0,
          latencyMs: 0,
        } as unknown as T;
      }

      throw err;
    }
  }

  /**
   * Single fetch attempt with timeout via AbortController.
   */
  private async doFetch<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'aegis-sdk/1.0',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new RetryableError(
          `AEGIS API error ${res.status}: ${text || res.statusText}`,
          res.status,
          [429, 500, 502, 503, 504].includes(res.status),
        );
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof RetryableError) throw err;

      // AbortController timeout
      if (
        err instanceof DOMException ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        throw new RetryableError(
          `AEGIS API timeout after ${this.timeout}ms`,
          408,
          true,
        );
      }

      // Network errors (TypeError from fetch)
      if (err instanceof TypeError) {
        throw new RetryableError(
          `AEGIS API network error: ${err.message}`,
          0,
          true,
        );
      }

      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
