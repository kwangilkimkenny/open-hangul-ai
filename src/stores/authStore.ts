/**
 * Auth Store
 * 사용자 인증 상태 관리 (Zustand + persist)
 *
 * @module stores/authStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'personal' | 'business' | 'enterprise';
  avatarUrl?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  updatePlan: (plan: User['plan']) => void;
  clearError: () => void;
}

// 데모 사용자 (실제 백엔드 연결 전까지)
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'demo@hanview.ai': {
    password: 'demo1234',
    user: {
      id: 'user-demo-1',
      email: 'demo@hanview.ai',
      name: '데모 사용자',
      plan: 'personal',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  },
  'admin@hanview.ai': {
    password: 'admin1234',
    user: {
      id: 'user-admin-1',
      email: 'admin@hanview.ai',
      name: '관리자',
      plan: 'enterprise',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        // 실제 API 호출 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 500));

        const record = DEMO_USERS[email.toLowerCase()];
        if (record && record.password === password) {
          set({ user: record.user, isAuthenticated: true, isLoading: false, error: null });
          return true;
        }
        set({ isLoading: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' });
        return false;
      },

      signup: async (email, password, name) => {
        set({ isLoading: true, error: null });
        await new Promise(resolve => setTimeout(resolve, 600));

        if (DEMO_USERS[email.toLowerCase()]) {
          set({ isLoading: false, error: '이미 가입된 이메일입니다' });
          return false;
        }
        if (password.length < 8) {
          set({ isLoading: false, error: '비밀번호는 최소 8자 이상이어야 합니다' });
          return false;
        }

        // 새 사용자 생성 (메모리에만 — 새로고침 시 사라짐)
        const newUser: User = {
          id: `user-${Date.now()}`,
          email,
          name,
          plan: 'free',
          createdAt: new Date().toISOString(),
        };
        DEMO_USERS[email.toLowerCase()] = { password, user: newUser };

        set({ user: newUser, isAuthenticated: true, isLoading: false, error: null });
        return true;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null });
      },

      updatePlan: plan => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, plan } });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'hanview-auth',
      partialize: state => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
