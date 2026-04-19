/**
 * Protected Modules Interface
 * 공개될 인터페이스만 정의 - 구현체는 바이너리 모듈에서 제공
 */

export interface AEGISModule {
  scan(input: string): Promise<{
    allowed: boolean;
    score: number;
    reason: string;
    categories: string[];
    blocked: boolean;
    piiDetected?: unknown[];
  }>;

  configure(config: {
    blockThreshold?: number;
    sensitivity?: number;
    korean?: { enabled: boolean };
  }): void;
}

export interface TruthAnchorModule {
  verify(content: string, sources?: string[]): Promise<{
    truthScore: number;
    confidence: number;
    sources: Array<{
      url: string;
      relevance: number;
      trustScore: number;
    }>;
    flags: string[];
  }>;

  configure(config: {
    strictMode?: boolean;
    sourcePriority?: string[];
  }): void;
}

// 동적 로딩 인터페이스
export interface ProtectedModuleLoader {
  loadAEGIS(): Promise<AEGISModule>;
  loadTruthAnchor(): Promise<TruthAnchorModule>;
  isAvailable(): boolean;
}