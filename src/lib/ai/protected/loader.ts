/**
 * Protected Module Loader
 * 바이너리 모듈, WASM, 또는 원격 API를 통해 보호된 기능 로드
 */

import type { AEGISModule, TruthAnchorModule, ProtectedModuleLoader } from './interfaces';

class ProtectedLoader implements ProtectedModuleLoader {
  private aegisModule?: AEGISModule;
  private truthAnchorModule?: TruthAnchorModule;

  async loadAEGIS(): Promise<AEGISModule> {
    if (this.aegisModule) return this.aegisModule;

    try {
      // Method 1: Native 바이너리 모듈 시도 (Community Edition에서는 사용 불가)
      if (this.hasNativeModule('@hanview/aegis-binary')) {
        try {
          // @ts-ignore - Enterprise binary module not available in Community Edition
          const nativeModule = await import('@hanview/aegis-binary');
          if (nativeModule?.AEGISNative) {
            this.aegisModule = new nativeModule.AEGISNative();
            return this.aegisModule!
          }
        } catch (error) {
          console.warn('Native AEGIS module unavailable in Community Edition');
        }
      }

      // Method 2: WebAssembly 모듈 시도
      if (await this.hasWASM('./aegis.wasm')) {
        const wasmModule = await this.loadWASM('./aegis.wasm');
        this.aegisModule = new WASMAEGISWrapper(wasmModule);
        return this.aegisModule;
      }

      // Method 3: 원격 API 폴백 (항상 사용 가능)
      console.info('Using AEGIS remote API fallback');
      this.aegisModule = new RemoteAEGISAPI();
      return this.aegisModule;

    } catch (error) {
      console.error('Failed to load AEGIS module:', error);
      // 최종 폴백으로 원격 API 사용
      this.aegisModule = new RemoteAEGISAPI();
      return this.aegisModule;
    }
  }

  async loadTruthAnchor(): Promise<TruthAnchorModule> {
    if (this.truthAnchorModule) return this.truthAnchorModule;

    try {
      // 유사한 로직으로 TruthAnchor 로드 (Community Edition에서는 사용 불가)
      if (this.hasNativeModule('@hanview/truthanchor-binary')) {
        try {
          // @ts-ignore - Enterprise binary module not available in Community Edition
          const nativeModule = await import('@hanview/truthanchor-binary');
          if (nativeModule?.TruthAnchorNative) {
            this.truthAnchorModule = new nativeModule.TruthAnchorNative();
            return this.truthAnchorModule!
          }
        } catch (error) {
          console.warn('Native TruthAnchor module unavailable in Community Edition');
        }
      }

      if (await this.hasWASM('./truthanchor.wasm')) {
        const wasmModule = await this.loadWASM('./truthanchor.wasm');
        this.truthAnchorModule = new WASMTruthAnchorWrapper(wasmModule);
        return this.truthAnchorModule;
      }

      console.info('Using TruthAnchor remote API fallback');
      this.truthAnchorModule = new RemoteTruthAnchorAPI();
      return this.truthAnchorModule;

    } catch (error) {
      console.error('Failed to load TruthAnchor module:', error);
      // 최종 폴백으로 원격 API 사용
      this.truthAnchorModule = new RemoteTruthAnchorAPI();
      return this.truthAnchorModule;
    }
  }

  isAvailable(): boolean {
    return this.hasNativeModule('@hanview/aegis-binary') ||
           this.hasNativeModule('@hanview/truthanchor-binary') ||
           navigator.userAgent.includes('HanView'); // 커스텀 브라우저 체크
  }

  private hasNativeModule(moduleName: string): boolean {
    try {
      require.resolve(moduleName);
      return true;
    } catch {
      return false;
    }
  }

  private async hasWASM(path: string): Promise<boolean> {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async loadWASM(path: string): Promise<WebAssembly.Module> {
    const response = await fetch(path);
    const bytes = await response.arrayBuffer();
    return await WebAssembly.compile(bytes);
  }
}

// WASM Wrapper 구현체들
class WASMAEGISWrapper implements AEGISModule {
  private wasmModule: WebAssembly.Module;

  constructor(wasmModule: WebAssembly.Module) {
    this.wasmModule = wasmModule;
  }

  async scan(input: string) {
    // WASM 함수 호출 로직
    const instance = await WebAssembly.instantiate(this.wasmModule);
    const result = (instance.exports as any).scanContent(input);
    return this.parseResult(result);
  }

  configure(_config: any) {
    // WASM 설정 호출
  }

  private parseResult(wasmResult: any) {
    // WASM 결과를 JavaScript 객체로 변환
    return {
      allowed: wasmResult.allowed,
      score: wasmResult.score,
      reason: wasmResult.reason || 'WASM Analysis',
      categories: wasmResult.categories || [],
      blocked: !wasmResult.allowed,
    };
  }
}

class WASMTruthAnchorWrapper implements TruthAnchorModule {
  private wasmModule: WebAssembly.Module;

  constructor(wasmModule: WebAssembly.Module) {
    this.wasmModule = wasmModule;
  }

  async verify(content: string, sources?: string[]) {
    const instance = await WebAssembly.instantiate(this.wasmModule);
    const result = (instance.exports as any).verifyTruth(content, sources);
    return this.parseResult(result);
  }

  configure(_config: any) {
    // WASM 설정
  }

  private parseResult(wasmResult: any) {
    return {
      truthScore: wasmResult.truthScore || 0.5,
      confidence: wasmResult.confidence || 0.5,
      sources: wasmResult.sources || [],
      flags: wasmResult.flags || [],
    };
  }
}

// 원격 API 폴백 구현체들
class RemoteAEGISAPI implements AEGISModule {
  private readonly apiEndpoint = 'https://api.hanview.ai/aegis';

  async scan(input: string) {
    const response = await fetch(`${this.apiEndpoint}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAPIKey()}`
      },
      body: JSON.stringify({ input })
    });

    if (!response.ok) {
      throw new Error('AEGIS API unavailable');
    }

    return response.json();
  }

  configure(_config: any) {
    // API 설정 저장
  }

  private getAPIKey(): string {
    return localStorage.getItem('hanview-api-key') || '';
  }
}

class RemoteTruthAnchorAPI implements TruthAnchorModule {
  private readonly apiEndpoint = 'https://api.hanview.ai/truthanchor';

  async verify(content: string, sources?: string[]) {
    const response = await fetch(`${this.apiEndpoint}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAPIKey()}`
      },
      body: JSON.stringify({ content, sources })
    });

    if (!response.ok) {
      throw new Error('TruthAnchor API unavailable');
    }

    return response.json();
  }

  configure(_config: any) {
    // API 설정
  }

  private getAPIKey(): string {
    return localStorage.getItem('hanview-api-key') || '';
  }
}

// 싱글톤 인스턴스 내보내기
export const protectedLoader = new ProtectedLoader();

// 편의 함수들
export const loadAEGIS = () => protectedLoader.loadAEGIS();
export const loadTruthAnchor = () => protectedLoader.loadTruthAnchor();
export const isProtectedModuleAvailable = () => protectedLoader.isAvailable();