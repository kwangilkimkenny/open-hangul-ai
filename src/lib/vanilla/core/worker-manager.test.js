/**
 * WorkerManager tests
 */

// Mock logger
vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), time: vi.fn(), timeEnd: vi.fn()
  })
}));

// Set up Worker mock before imports
const mockWorkerInstance = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  postMessage: vi.fn(),
  terminate: vi.fn(),
};
vi.stubGlobal('Worker', function MockWorker() { return mockWorkerInstance; });

import { WorkerManager } from './worker-manager.js';

describe('WorkerManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new WorkerManager();
  });

  // 1. Constructor initializes with default state
  it('should initialize with default state', () => {
    expect(manager.worker).toBeNull();
    expect(manager.callbacks).toBeInstanceOf(Map);
    expect(manager.callbacks.size).toBe(0);
    expect(manager.requestId).toBe(0);
    expect(manager.isReady).toBe(false);
  });

  // 2. isSupported() returns true when Worker exists
  it('should return true from isSupported when Worker exists', () => {
    expect(WorkerManager.isSupported()).toBe(true);
  });

  // 3. isSupported() returns false when Worker undefined
  it('should return false from isSupported when Worker is undefined', () => {
    const originalWorker = globalThis.Worker;
    delete globalThis.Worker;
    expect(WorkerManager.isSupported()).toBe(false);
    globalThis.Worker = originalWorker;
  });

  // 4. initialize() creates Worker instance
  it('should create a Worker instance on initialize', async () => {
    // Simulate READY message immediately on addEventListener
    mockWorkerInstance.addEventListener.mockImplementation((event, handler) => {
      if (event === 'message') {
        setTimeout(() => handler({ data: { type: 'READY' } }), 0);
      }
    });

    await manager.initialize();
    expect(manager.worker).toBe(mockWorkerInstance);
  });

  // 5. initialize() skips if already initialized
  it('should skip initialization if worker already exists', async () => {
    // Set up READY handler
    mockWorkerInstance.addEventListener.mockImplementation((event, handler) => {
      if (event === 'message') {
        setTimeout(() => handler({ data: { type: 'READY' } }), 0);
      }
    });

    await manager.initialize();
    const addEventListenerCallCount = mockWorkerInstance.addEventListener.mock.calls.length;

    await manager.initialize(); // second call should skip - no new addEventListener calls
    expect(mockWorkerInstance.addEventListener.mock.calls.length).toBe(addEventListenerCallCount);
  });

  // 6. initialize() resolves when READY received
  it('should resolve when READY message is received', async () => {
    mockWorkerInstance.addEventListener.mockImplementation((event, handler) => {
      if (event === 'message') {
        setTimeout(() => handler({ data: { type: 'READY' } }), 0);
      }
    });

    await expect(manager.initialize()).resolves.toBeUndefined();
    expect(manager.isReady).toBe(true);
  });

  // 7. sendMessage() throws if not initialized
  it('should throw from sendMessage if worker not initialized', async () => {
    await expect(manager.sendMessage('TEST', {})).rejects.toThrow('Worker not initialized');
  });

  // 8. sendMessage() posts message with incremented id
  it('should post message with incremented request id', async () => {
    // Manually set up ready state
    manager.worker = mockWorkerInstance;
    manager.isReady = true;

    // Don't await - we just want to check postMessage was called
    const promise = manager.sendMessage('TEST_TYPE', { data: 'test' });

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: 'TEST_TYPE',
      payload: { data: 'test' },
      id: 'req_1',
    });

    // Send second message
    const promise2 = manager.sendMessage('TEST_TYPE2', { data: 'test2' });

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: 'TEST_TYPE2',
      payload: { data: 'test2' },
      id: 'req_2',
    });
  });

  // 9. handleMessage PARSE_COMPLETE resolves callback
  it('should resolve callback on PARSE_COMPLETE message', async () => {
    manager.worker = mockWorkerInstance;
    manager.isReady = true;

    const result = { sections: [] };
    const promise = manager.sendMessage('PARSE_HWPX', { buffer: new ArrayBuffer(0) });

    // Simulate PARSE_COMPLETE response
    manager.handleMessage({ type: 'PARSE_COMPLETE', id: 'req_1', result });

    await expect(promise).resolves.toBe(result);
  });

  // 10. handleMessage ERROR rejects callback
  it('should reject callback on ERROR message', async () => {
    manager.worker = mockWorkerInstance;
    manager.isReady = true;

    const promise = manager.sendMessage('PARSE_HWPX', { buffer: new ArrayBuffer(0) });

    manager.handleMessage({
      type: 'ERROR',
      id: 'req_1',
      error: { message: 'Something failed', stack: '' },
    });

    await expect(promise).rejects.toThrow('Something failed');
  });

  // 11. handleMessage PROGRESS calls onProgress
  it('should call onProgress on PROGRESS message', () => {
    manager.worker = mockWorkerInstance;
    manager.isReady = true;

    const onProgress = vi.fn();
    manager.sendMessage('PARSE_HWPX', { buffer: new ArrayBuffer(0) }, onProgress);

    manager.handleMessage({ type: 'PROGRESS', id: 'req_1', progress: { percent: 50 } });

    expect(onProgress).toHaveBeenCalledWith({ percent: 50 });
  });

  // 12. handleMessage CANCELLED rejects
  it('should reject callback on CANCELLED message', async () => {
    manager.worker = mockWorkerInstance;
    manager.isReady = true;

    const promise = manager.sendMessage('PARSE_HWPX', {});
    manager.handleMessage({ type: 'CANCELLED', id: 'req_1' });

    await expect(promise).rejects.toThrow('Request cancelled');
  });

  // 13. handleMessage unknown type warns (no callback found)
  it('should warn on unknown message type with no callback', () => {
    // handleMessage with unknown type and no matching callback just logs
    manager.handleMessage({ type: 'UNKNOWN_TYPE', id: 'nonexistent' });
    // Should not throw
  });

  // 14. parseHWPX delegates to sendMessage
  it('should delegate parseHWPX to sendMessage', async () => {
    manager.worker = mockWorkerInstance;
    manager.isReady = true;

    const buffer = new ArrayBuffer(10);
    const onProgress = vi.fn();
    const parsePromise = manager.parseHWPX(buffer, onProgress);

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PARSE_HWPX',
        payload: { buffer },
      })
    );

    // Resolve the promise
    manager.handleMessage({ type: 'PARSE_COMPLETE', id: 'req_1', result: { sections: [] } });
    const result = await parsePromise;
    expect(result).toEqual({ sections: [] });
  });

  // 15. terminate() cleans up
  it('should clean up on terminate', () => {
    manager.worker = mockWorkerInstance;
    manager.isReady = true;
    manager.callbacks.set('test', { resolve: vi.fn() });

    manager.terminate();

    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    expect(manager.worker).toBeNull();
    expect(manager.isReady).toBe(false);
    expect(manager.callbacks.size).toBe(0);
  });
});
