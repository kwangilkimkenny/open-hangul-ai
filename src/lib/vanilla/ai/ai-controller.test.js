/**
 * Tests for AIDocumentController
 * @module ai/ai-controller.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn(),
  }),
}));

vi.mock('../config/ai-config.js', () => ({
  AIConfig: {
    openai: {
      setApiKey: vi.fn(),
    },
    extraction: {
      slotIdPrefix: 'slot-',
      elementIdPrefix: 'elem-',
      minTextLength: 1,
      maxTextLength: 10000,
    },
    merging: {
      validateStructure: false,
      saveHistory: false,
      maxHistorySize: 10,
    },
    prompts: {
      errorMessages: {
        noApiKey: 'API key is not set',
      },
    },
  },
}));

// Mock sub-modules using class syntax for proper constructor support
vi.mock('./structure-extractor.js', () => ({
  DocumentStructureExtractor: class {
    constructor() {
      this.extractStructure = vi.fn(() => ({
        structure: { sections: [] },
        textSlots: new Map(),
        metadata: {},
      }));
      this.extractTableHeaderContentPairs = vi.fn(() => [
        {
          pairId: 'pair-1',
          header: 'Name',
          content: 'Alice',
          path: { section: 0, table: 0, row: 0, headerCell: 0, contentCell: 1 },
          isEmpty: false,
        },
      ]);
      this.getStatistics = vi.fn(() => ({ totalSlots: 0, cacheSize: 0 }));
    }
  },
}));

vi.mock('./gpt-content-generator.js', () => ({
  GPTContentGenerator: class {
    constructor() {
      this.callAPIWithRetry = vi.fn(async () => ({
        choices: [{ message: { content: '{"Name": "Bob"}' } }],
        usage: { total_tokens: 100 },
      }));
      this.getStatistics = vi.fn(() => ({}));
    }
  },
}));

vi.mock('./content-merger.js', () => ({
  ContentMerger: class {
    constructor() {
      this.mergeGeneratedContent = vi.fn((doc) => ({ ...doc, merged: true }));
      this.getStatistics = vi.fn(() => ({}));
      this.resetStatistics = vi.fn();
      this.options = { maxHistorySize: 10 };
    }
  },
}));

vi.mock('../export/hwpx-safe-exporter.js', () => ({
  HwpxSafeExporter: class { constructor() {} },
}));

vi.mock('./multi-page-analyzer.js', () => ({
  MultiPageAnalyzer: class { constructor() {} },
}));

vi.mock('./sequential-page-generator.js', () => ({
  SequentialPageGenerator: class { constructor() {} },
}));

vi.mock('./prompt-builder.js', () => ({
  PromptBuilder: class {
    constructor() {
      this.buildStructuredPrompt = vi.fn(() => [{ role: 'user', content: 'test' }]);
    }
  },
}));

vi.mock('../api/external-data-fetcher.js', () => ({
  ExternalDataFetcher: class { constructor() {} },
}));

vi.mock('../utils/error.js', () => ({
  HWPXError: class extends Error {
    constructor(type, message) { super(message); this.type = type; }
  },
  ErrorType: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
  },
}));

import { AIDocumentController } from './ai-controller.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockViewer(doc = null) {
  return {
    getDocument: vi.fn(() => doc),
    updateDocument: vi.fn(async () => {}),
  };
}

function makeSampleDocument() {
  return {
    sections: [{
      elements: [{
        type: 'table',
        rows: [{
          cells: [
            { elements: [{ type: 'paragraph', runs: [{ text: 'Name' }] }] },
            { elements: [{ type: 'paragraph', runs: [{ text: 'Alice' }] }] },
          ],
        }],
      }],
    }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AIDocumentController', () => {
  let viewer;
  let controller;

  beforeEach(() => {
    viewer = createMockViewer(makeSampleDocument());
    controller = new AIDocumentController(viewer);
    // Clean up potential global side-effects
    if (typeof globalThis.window !== 'undefined') {
      delete globalThis.window.partialEditor;
    }
  });

  // 1. Constructor initializes with viewer
  it('initializes with a viewer instance', () => {
    expect(controller.viewer).toBe(viewer);
    expect(controller.state.isProcessing).toBe(false);
    expect(controller.history).toEqual([]);
  });

  it('throws when constructed without a viewer', () => {
    expect(() => new AIDocumentController(null)).toThrow();
  });

  // 2. setApiKey stores key
  it('creates a generator when setApiKey is called', () => {
    expect(controller.hasApiKey()).toBe(false);
    controller.setApiKey('sk-test-key');
    expect(controller.generator).not.toBeNull();
  });

  it('throws when setApiKey receives a falsy value', () => {
    expect(() => controller.setApiKey('')).toThrow();
    expect(() => controller.setApiKey(null)).toThrow();
  });

  // 3. hasApiKey returns correct state
  it('returns false before setApiKey and true after', () => {
    expect(controller.hasApiKey()).toBe(false);
    controller.setApiKey('sk-test');
    expect(controller.hasApiKey()).toBe(true);
  });

  // 4. handleUserRequest flow
  it('processes a user request end-to-end', async () => {
    controller.setApiKey('sk-test');

    const result = await controller.handleUserRequest('Make it simpler');

    expect(result.success).toBe(true);
    expect(result.updatedDocument).toBeDefined();
    expect(result.metadata.request).toBe('Make it simpler');
    expect(result.metadata.tokensUsed).toBe(100);
    expect(viewer.updateDocument).toHaveBeenCalled();
  });

  // 5. handleUserRequest with no API key throws
  it('throws when handleUserRequest is called without an API key', async () => {
    await expect(controller.handleUserRequest('test')).rejects.toThrow();
  });

  // 6. generateStructuredContent delegates to generator
  it('calls generator.callAPIWithRetry during handleUserRequest', async () => {
    controller.setApiKey('sk-test');

    await controller.handleUserRequest('rewrite');

    expect(controller.generator.callAPIWithRetry).toHaveBeenCalled();
  });

  // 7. getHistory returns history
  it('returns empty history initially', () => {
    expect(controller.getHistory()).toEqual([]);
  });

  it('stores history entries after processing', async () => {
    controller.setApiKey('sk-test');
    controller.options.saveHistory = true;

    await controller.handleUserRequest('rewrite');

    const history = controller.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].request).toBe('rewrite');
  });

  // 8. clearHistory empties history
  it('clears all history entries', async () => {
    controller.setApiKey('sk-test');
    controller.options.saveHistory = true;

    await controller.handleUserRequest('rewrite');
    expect(controller.getHistory().length).toBe(1);

    controller.clearHistory();
    expect(controller.getHistory()).toEqual([]);
  });

  // 9. getState returns current state
  it('returns current processing state', () => {
    const state = controller.getState();

    expect(state.isProcessing).toBe(false);
    expect(state.hasApiKey).toBe(false);
    expect(state.hasDocument).toBe(true);
    expect(state.currentRequest).toBeNull();
    expect(state.error).toBeNull();
  });

  it('reflects hasApiKey after setting the key', () => {
    controller.setApiKey('sk-test');
    expect(controller.getState().hasApiKey).toBe(true);
  });

  // 10. Error handling in pipeline
  it('sets state.error and resets isProcessing on failure', async () => {
    controller.setApiKey('sk-test');

    // Make the generator throw
    controller.generator.callAPIWithRetry.mockRejectedValueOnce(new Error('API down'));

    await expect(controller.handleUserRequest('fail')).rejects.toThrow('API down');

    expect(controller.state.isProcessing).toBe(false);
    expect(controller.state.error).toBeDefined();
    expect(controller.state.error.message).toBe('API down');
  });

  it('rejects concurrent requests', async () => {
    controller.setApiKey('sk-test');

    // Make the generator hang so the first request stays in-flight
    controller.generator.callAPIWithRetry.mockImplementationOnce(
      () => new Promise(() => {}) // never resolves
    );

    // Fire first request (will not resolve)
    const first = controller.handleUserRequest('first');

    // Second request should throw immediately
    await expect(controller.handleUserRequest('second')).rejects.toThrow();

    // Clean up: the first promise is abandoned (no unhandled rejection because it never settles)
  });
});
