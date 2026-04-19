/**
 * Draft Store — AI 초안 생성 세션 관리 (Zustand)
 *
 * 여러 세션을 보관하고, 각 세션은 여러 버전 스냅샷을 가짐.
 * 현재 활성 세션의 참조 문서 · 프롬프트 · 상태를 추적.
 *
 * @module stores/draftStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  DraftSession,
  DraftVersion,
  ReferenceDoc,
  DraftStatus,
} from '../types/ai-draft';

interface DraftState {
  sessions: Record<string, DraftSession>;
  currentSessionId: string | null;

  createSession: (title: string, prompt: string) => string;
  setCurrentSession: (id: string | null) => void;
  deleteSession: (id: string) => void;

  addReference: (sessionId: string, ref: ReferenceDoc) => void;
  removeReference: (sessionId: string, fileId: string) => void;
  clearReferences: (sessionId: string) => void;

  setPrompt: (sessionId: string, prompt: string) => void;
  setStatus: (sessionId: string, status: DraftStatus, error?: string) => void;

  addVersion: (sessionId: string, version: DraftVersion) => void;
  removeVersion: (sessionId: string, versionId: string) => void;

  getCurrentSession: () => DraftSession | null;
  getLatestVersion: (sessionId: string) => DraftVersion | null;
  reset: () => void;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useDraftStore = create<DraftState>()(
  devtools(
    persist(
      (set, get) => ({
        sessions: {},
        currentSessionId: null,

        createSession: (title, prompt) => {
          const id = newId('sess');
          const now = new Date().toISOString();
          const session: DraftSession = {
            id,
            title,
            prompt,
            createdAt: now,
            updatedAt: now,
            references: [],
            versions: [],
            status: 'idle',
          };
          set(state => ({
            sessions: { ...state.sessions, [id]: session },
            currentSessionId: id,
          }));
          return id;
        },

        setCurrentSession: (id) => set({ currentSessionId: id }),

        deleteSession: (id) => set(state => {
          const { [id]: _removed, ...rest } = state.sessions;
          return {
            sessions: rest,
            currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
          };
        }),

        addReference: (sessionId, ref) => set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          if (s.references.some(r => r.fileId === ref.fileId)) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s,
                references: [...s.references, ref],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

        removeReference: (sessionId, fileId) => set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s,
                references: s.references.filter(r => r.fileId !== fileId),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

        clearReferences: (sessionId) => set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...s, references: [], updatedAt: new Date().toISOString() },
            },
          };
        }),

        setPrompt: (sessionId, prompt) => set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...s, prompt, updatedAt: new Date().toISOString() },
            },
          };
        }),

        setStatus: (sessionId, status, error) => set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...s, status, error, updatedAt: new Date().toISOString() },
            },
          };
        }),

        addVersion: (sessionId, version) => set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s,
                versions: [...s.versions, version],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

        removeVersion: (sessionId, versionId) => set(state => {
          const s = state.sessions[sessionId];
          if (!s) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s,
                versions: s.versions.filter(v => v.id !== versionId),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

        getCurrentSession: () => {
          const { sessions, currentSessionId } = get();
          return currentSessionId ? sessions[currentSessionId] ?? null : null;
        },

        getLatestVersion: (sessionId) => {
          const s = get().sessions[sessionId];
          if (!s || s.versions.length === 0) return null;
          return s.versions[s.versions.length - 1];
        },

        reset: () => set({ sessions: {}, currentSessionId: null }),
      }),
      {
        name: 'hanview-draft-store',
        partialize: (s) => ({
          sessions: Object.fromEntries(
            Object.entries(s.sessions).map(([k, v]) => [k, { ...v, versions: v.versions.slice(-3) }])
          ),
          currentSessionId: s.currentSessionId,
        }),
      }
    ),
    { name: 'draft-store' }
  )
);
