import { describe, it, expect, beforeEach } from 'vitest';
import {
  getQuota,
  getRemainingQuota,
  checkQuota,
  assertQuota,
  recordUsage,
  resetQuota,
  DEFAULT_DAILY_LIMIT,
  _setMemoryOnly,
} from './ai-quota.js';

describe('ai-quota', () => {
  beforeEach(() => {
    _setMemoryOnly(true);
    resetQuota();
  });

  it('exposes default daily limit', () => {
    expect(DEFAULT_DAILY_LIMIT).toBe(100);
  });

  it('starts with zero usage', () => {
    const q = getQuota();
    expect(q.count).toBe(0);
    expect(q.limit).toBe(DEFAULT_DAILY_LIMIT);
    expect(getRemainingQuota()).toBe(DEFAULT_DAILY_LIMIT);
    expect(checkQuota()).toBe(true);
  });

  it('records usage incrementally', () => {
    recordUsage();
    expect(getQuota().count).toBe(1);
    expect(getRemainingQuota()).toBe(99);
    recordUsage();
    recordUsage();
    expect(getQuota().count).toBe(3);
  });

  it('honors custom limit', () => {
    expect(getRemainingQuota({ limit: 5 })).toBe(5);
    recordUsage({ limit: 5 });
    expect(getRemainingQuota({ limit: 5 })).toBe(4);
  });

  it('throws when limit exceeded via recordUsage', () => {
    for (let i = 0; i < 3; i++) recordUsage({ limit: 3 });
    expect(() => recordUsage({ limit: 3 })).toThrowError(/한도/);
    expect(checkQuota({ limit: 3 })).toBe(false);
  });

  it('assertQuota throws with code at exhaustion', () => {
    for (let i = 0; i < 2; i++) recordUsage({ limit: 2 });
    let caught = null;
    try { assertQuota({ limit: 2 }); } catch (e) { caught = e; }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('AI_SPELL_QUOTA_EXCEEDED');
  });

  it('memory persistence survives across calls', () => {
    recordUsage();
    recordUsage();
    expect(getQuota().count).toBe(2);
  });

  it('resetQuota clears the stored record', () => {
    recordUsage();
    expect(getQuota().count).toBe(1);
    resetQuota();
    expect(getQuota().count).toBe(0);
  });

  it('allows multi-step count via options.count', () => {
    recordUsage({ count: 5 });
    expect(getQuota().count).toBe(5);
  });

  it('refuses to exceed via batch count', () => {
    expect(() => recordUsage({ limit: 3, count: 4 })).toThrowError();
  });
});
