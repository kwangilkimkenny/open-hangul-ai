/**
 * Auth Store — 듀얼 모드
 * Supabase 활성화 시: 실서버 인증 (bcrypt, JWT, 이메일 인증)
 * Supabase 비활성화 시: 데모 모드 (메모리 + localStorage 폴백)
 *
 * @module stores/authStore
 * @version 2.0.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSupabase, isSupabaseEnabled } from '../lib/supabase/client';

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
  logout: () => Promise<void>;
  updatePlan: (plan: User['plan']) => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// 데모 사용자 (Supabase 미설정 환경 폴백)
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

/**
 * Supabase profile row → User 타입 변환
 */
function profileToUser(profile: any): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    plan: profile.plan,
    avatarUrl: profile.avatar_url || undefined,
    createdAt: profile.created_at,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ===== LOGIN =====
      login: async (email, password) => {
        set({ isLoading: true, error: null });

        // Supabase 모드
        if (isSupabaseEnabled) {
          const supabase = getSupabase()!;
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });

          if (error) {
            set({ isLoading: false, error: error.message === 'Invalid login credentials'
              ? '이메일 또는 비밀번호가 올바르지 않습니다'
              : error.message });
            return false;
          }
          if (!data.user) {
            set({ isLoading: false, error: '로그인에 실패했습니다' });
            return false;
          }

          // profile 조회
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError || !profile) {
            set({ isLoading: false, error: '프로필 정보를 가져올 수 없습니다' });
            return false;
          }

          set({ user: profileToUser(profile), isAuthenticated: true, isLoading: false, error: null });
          return true;
        }

        // 데모 모드 폴백
        await new Promise(resolve => setTimeout(resolve, 500));
        const record = DEMO_USERS[email.toLowerCase()];
        if (record && record.password === password) {
          set({ user: record.user, isAuthenticated: true, isLoading: false, error: null });
          return true;
        }
        set({ isLoading: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' });
        return false;
      },

      // ===== SIGNUP =====
      signup: async (email, password, name) => {
        set({ isLoading: true, error: null });

        // Supabase 모드
        if (isSupabaseEnabled) {
          const supabase = getSupabase()!;
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo: `${window.location.origin}/login`,
            },
          });

          if (error) {
            set({ isLoading: false, error: error.message === 'User already registered'
              ? '이미 가입된 이메일입니다'
              : error.message });
            return false;
          }
          if (!data.user) {
            set({ isLoading: false, error: '가입에 실패했습니다' });
            return false;
          }

          // 이메일 인증 필요한 경우 (session이 null이면)
          if (!data.session) {
            set({
              isLoading: false,
              error: '인증 이메일이 발송되었습니다. 이메일을 확인해주세요.',
            });
            return false;
          }

          // 자동 로그인 (이메일 인증 비활성화 환경)
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            set({ user: profileToUser(profile), isAuthenticated: true, isLoading: false, error: null });
          }
          return true;
        }

        // 데모 모드 폴백
        await new Promise(resolve => setTimeout(resolve, 600));
        if (DEMO_USERS[email.toLowerCase()]) {
          set({ isLoading: false, error: '이미 가입된 이메일입니다' });
          return false;
        }
        if (password.length < 8) {
          set({ isLoading: false, error: '비밀번호는 최소 8자 이상이어야 합니다' });
          return false;
        }

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

      // ===== LOGOUT =====
      logout: async () => {
        if (isSupabaseEnabled) {
          const supabase = getSupabase()!;
          await supabase.auth.signOut();
        }
        set({ user: null, isAuthenticated: false, error: null });
      },

      // ===== UPDATE PLAN =====
      updatePlan: async plan => {
        const current = get().user;
        if (!current) return;

        if (isSupabaseEnabled) {
          const supabase = getSupabase()!;
          const { error } = await supabase
            .from('profiles')
            .update({ plan })
            .eq('id', current.id);
          if (error) {
            console.error('updatePlan failed:', error);
            return;
          }
        }

        set({ user: { ...current, plan } });
      },

      // ===== PASSWORD RESET =====
      resetPassword: async email => {
        if (isSupabaseEnabled) {
          const supabase = getSupabase()!;
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login?reset=true`,
          });
          if (error) {
            set({ error: error.message });
            return false;
          }
          return true;
        }
        // 데모 모드: 메시지만 표시
        set({ error: '데모 모드에서는 비밀번호 재설정을 지원하지 않습니다' });
        return false;
      },

      // ===== REFRESH (앱 시작 시 세션 복원) =====
      refresh: async () => {
        if (!isSupabaseEnabled) return;

        const supabase = getSupabase()!;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          set({ user: profileToUser(profile), isAuthenticated: true });
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

// Supabase 인증 상태 변화 자동 동기화
if (typeof window !== 'undefined' && isSupabaseEnabled) {
  const supabase = getSupabase();
  supabase?.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      useAuthStore.setState({ user: null, isAuthenticated: false });
    } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      // 세션 갱신 시 프로필 재조회
      useAuthStore.getState().refresh();
    }
  });
}
