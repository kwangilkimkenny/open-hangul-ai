
/**
 * Mock AEGIS implementation for open source development
 * Real implementation available with commercial license
 */
export class MockAEGIS {
  async scan(input) {
    console.warn('Using mock AEGIS - install commercial module for full protection');
    return {
      allowed: true,
      score: 0,
      reason: 'Mock implementation',
      categories: [],
      blocked: false
    };
  }

  configure(config) {
    console.log('Mock AEGIS configured:', config);
  }
}
