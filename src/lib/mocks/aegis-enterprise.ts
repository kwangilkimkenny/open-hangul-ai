/**
 * Mock AEGIS Enterprise Module for Community Edition
 * This module provides empty implementations to allow Community Edition to build
 */

export class Aegis {
  static async create() {
    throw new Error('AEGIS Enterprise features require commercial license');
  }
}

export class PiiScanner {
  constructor() {
    throw new Error('PII Scanner requires AEGIS Enterprise license');
  }
}

export class PiiProxyEngine {
  constructor() {
    throw new Error('PII Proxy Engine requires AEGIS Enterprise license');
  }
}

// Also export for different import patterns
export { Aegis as default };
export { PiiProxyEngine as PiiProxy };