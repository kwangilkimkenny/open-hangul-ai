/**
 * No-op stub for the AEGIS SDK.
 *
 * Used at build time to satisfy `import('@aegis-sdk')` /
 * `import('@hanview/aegis-enterprise')` references when the proprietary
 * SDK is not present (default in this repository). Constructors throw so
 * runtime callers fall back to their own degraded paths.
 */

export class Aegis {
  static async create(): Promise<never> {
    throw new Error('AEGIS SDK is not bundled with this build');
  }
}

export class PiiScanner {
  constructor() {
    throw new Error('AEGIS SDK is not bundled with this build');
  }
}

export class PiiProxyEngine {
  constructor() {
    throw new Error('AEGIS SDK is not bundled with this build');
  }
}

export { Aegis as default };
export { PiiProxyEngine as PiiProxy };
