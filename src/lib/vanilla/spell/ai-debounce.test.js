import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAIDebouncer, hashText } from './ai-debounce.js';

describe('ai-debounce / hashText', () => {
  it('produces stable hash for same input', () => {
    expect(hashText('hello')).toBe(hashText('hello'));
  });
  it('differs across inputs', () => {
    expect(hashText('a')).not.toBe(hashText('b'));
  });
  it('handles empty input', () => {
    expect(hashText('')).toBe('0');
  });
});

describe('ai-debounce / createAIDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays runner by configured delay', async () => {
    const deb = createAIDebouncer({ delay: 5000 });
    const runner = vi.fn(async () => 'result');
    const p = deb.schedule('text', runner);
    expect(runner).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4999);
    expect(runner).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2);
    expect(runner).toHaveBeenCalledTimes(1);
    await expect(p).resolves.toBe('result');
  });

  it('cancels in-flight schedule when new text arrives', async () => {
    const deb = createAIDebouncer({ delay: 1000 });
    const runner1 = vi.fn(async () => 'first');
    const runner2 = vi.fn(async () => 'second');

    const p1 = deb.schedule('a', runner1);
    // Avoid unhandled rejection by attaching a noop
    p1.catch(() => {});

    await vi.advanceTimersByTimeAsync(500);
    deb.schedule('b', runner2).catch(() => {});

    await vi.advanceTimersByTimeAsync(1001);

    expect(runner1).not.toHaveBeenCalled();
    expect(runner2).toHaveBeenCalled();
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns cached result immediately for repeated text', async () => {
    const deb = createAIDebouncer({ delay: 1000 });
    let calls = 0;
    const runner = vi.fn(async () => {
      calls++;
      return ['issue-' + calls];
    });

    const p1 = deb.schedule('same', runner);
    await vi.advanceTimersByTimeAsync(1001);
    const r1 = await p1;

    // Same text → cache hit, no timer wait, no second runner call
    const p2 = deb.schedule('same', runner);
    await expect(p2).resolves.toEqual(r1);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('cancel() rejects any pending call', async () => {
    const deb = createAIDebouncer({ delay: 1000 });
    const runner = vi.fn(async () => 'x');
    const p = deb.schedule('text', runner);
    deb.cancel();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(runner).not.toHaveBeenCalled();
  });

  it('passes AbortSignal to runner', async () => {
    const deb = createAIDebouncer({ delay: 100 });
    let receivedSignal = null;
    const runner = vi.fn(async ({ signal }) => {
      receivedSignal = signal;
      return 'ok';
    });
    const p = deb.schedule('q', runner);
    await vi.advanceTimersByTimeAsync(150);
    await p;
    expect(receivedSignal).toBeTruthy();
    expect(typeof receivedSignal.aborted).toBe('boolean');
  });

  it('clearCache wipes cached results', async () => {
    const deb = createAIDebouncer({ delay: 50 });
    const runner = vi.fn(async () => ['ok']);
    const p1 = deb.schedule('same', runner);
    await vi.advanceTimersByTimeAsync(60);
    await p1;
    expect(deb.peekCache('same')).toEqual(['ok']);
    deb.clearCache();
    expect(deb.peekCache('same')).toBeUndefined();
  });
});
