import { describe, it, expect, beforeEach } from 'vitest';
import { useDraftStore } from './draftStore';
import type { ReferenceDoc } from '../types/ai-draft';

function mkRef(name: string, tokens: number): ReferenceDoc {
  return {
    fileId: `f-${name}`,
    fileName: name,
    mimeType: 'text/plain',
    tokenCount: tokens,
    text: 'x',
    uploadedAt: new Date().toISOString(),
  };
}

describe('DraftStore', () => {
  beforeEach(() => {
    useDraftStore.getState().reset();
  });

  it('세션 생성 → currentSessionId 설정', () => {
    const id = useDraftStore.getState().createSession('테스트', '프롬프트');
    const state = useDraftStore.getState();
    expect(state.sessions[id]).toBeDefined();
    expect(state.currentSessionId).toBe(id);
    expect(state.sessions[id].title).toBe('테스트');
    expect(state.sessions[id].status).toBe('idle');
  });

  it('세션 삭제 — currentSessionId 초기화', () => {
    const id = useDraftStore.getState().createSession('t', 'p');
    useDraftStore.getState().deleteSession(id);
    expect(useDraftStore.getState().sessions[id]).toBeUndefined();
    expect(useDraftStore.getState().currentSessionId).toBeNull();
  });

  it('참조 추가 / 중복 방지 / 제거', () => {
    const id = useDraftStore.getState().createSession('t', 'p');
    const ref = mkRef('a', 100);
    useDraftStore.getState().addReference(id, ref);
    useDraftStore.getState().addReference(id, ref); // 중복
    expect(useDraftStore.getState().sessions[id].references).toHaveLength(1);

    useDraftStore.getState().removeReference(id, ref.fileId);
    expect(useDraftStore.getState().sessions[id].references).toHaveLength(0);
  });

  it('clearReferences', () => {
    const id = useDraftStore.getState().createSession('t', 'p');
    useDraftStore.getState().addReference(id, mkRef('a', 1));
    useDraftStore.getState().addReference(id, mkRef('b', 2));
    useDraftStore.getState().clearReferences(id);
    expect(useDraftStore.getState().sessions[id].references).toHaveLength(0);
  });

  it('버전 추가 및 조회', () => {
    const id = useDraftStore.getState().createSession('t', 'p');
    useDraftStore.getState().addVersion(id, {
      id: 'v1',
      createdAt: new Date().toISOString(),
      document: { sections: [], images: new Map() },
      tokensUsed: 100,
      model: 'gemini-2.5-pro',
      prompt: 'p',
    });
    expect(useDraftStore.getState().getLatestVersion(id)?.id).toBe('v1');
  });

  it('상태 업데이트 with error', () => {
    const id = useDraftStore.getState().createSession('t', 'p');
    useDraftStore.getState().setStatus(id, 'failed', 'oops');
    const s = useDraftStore.getState().sessions[id];
    expect(s.status).toBe('failed');
    expect(s.error).toBe('oops');
  });

  it('getCurrentSession — null 처리', () => {
    expect(useDraftStore.getState().getCurrentSession()).toBeNull();
    const id = useDraftStore.getState().createSession('t', 'p');
    expect(useDraftStore.getState().getCurrentSession()?.id).toBe(id);
  });
});
