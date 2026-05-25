/**
 * presence.test.js — 사용자 추가/제거/cursor 업데이트
 *
 * 1차에서는 외부 awareness 의존을 피하기 위해 로컬-only 모드를 검증한다.
 * awareness 어댑터는 collab-manager 통합 테스트에서 함께 검증된다.
 */

import { describe, it, expect } from 'vitest';
import { Presence, pickColorForId } from './presence.js';

describe('presence :: pickColorForId', () => {
  it('returns deterministic color for same id', () => {
    expect(pickColorForId('alice')).toBe(pickColorForId('alice'));
  });

  it('returns a valid hex string', () => {
    expect(pickColorForId('user-1')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('presence :: local-only mode', () => {
  it('registers self user by default', () => {
    const p = new Presence({ userInfo: { id: 'me', name: '나' } });
    const users = p.getUsers();
    expect(users.length).toBe(1);
    expect(users[0].id).toBe('me');
    expect(users[0].name).toBe('나');
    expect(users[0].cursor).toBeNull();
    p.destroy();
  });

  it('updates local cursor and emits change', () => {
    const p = new Presence({ userInfo: { id: 'me' } });
    let last = null;
    p.onChange(users => { last = users; });
    p.setLocalCursor({ paragraphId: 's0-p0', offset: 4 });
    expect(last).toBeTruthy();
    expect(last.find(u => u.id === 'me').cursor.offset).toBe(4);
    p.destroy();
  });

  it('adds and removes synthetic remote users', () => {
    const p = new Presence({ userInfo: { id: 'me' } });
    expect(p._addLocalRemoteUser({ id: 'bob' })).toBe(true);
    expect(p.getUsers().some(u => u.id === 'bob')).toBe(true);
    expect(p._removeLocalRemoteUser('bob')).toBe(true);
    expect(p.getUsers().some(u => u.id === 'bob')).toBe(false);
    p.destroy();
  });

  it('updates remote cursor', () => {
    const p = new Presence({ userInfo: { id: 'me' } });
    p._addLocalRemoteUser({ id: 'bob' });
    p._setLocalRemoteCursor('bob', { paragraphId: 's0-p1', offset: 2 });
    const bob = p.getUsers().find(u => u.id === 'bob');
    expect(bob.cursor.paragraphId).toBe('s0-p1');
    expect(bob.cursor.offset).toBe(2);
    p.destroy();
  });

  it('assigns deterministic color when user has no color', () => {
    const p = new Presence({ userInfo: { id: 'colorless' } });
    const u = p.getUsers()[0];
    expect(u.color).toBe(pickColorForId('colorless'));
    p.destroy();
  });

  it('honors explicit color in userInfo', () => {
    const p = new Presence({ userInfo: { id: 'me', color: '#123456' } });
    expect(p.getUsers()[0].color).toBe('#123456');
    p.destroy();
  });
});
