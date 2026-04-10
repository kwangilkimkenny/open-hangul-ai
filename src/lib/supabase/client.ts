/**
 * Supabase Client
 * 듀얼 모드: 환경변수 설정 시 실서버, 미설정 시 데모 모드 폴백
 *
 * @module lib/supabase/client
 * @version 1.0.0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase 통합이 활성화되었는지 확인
 * 환경변수가 설정되어 있고 placeholder가 아닐 때 true
 */
export const isSupabaseEnabled = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_PROJECT'),
);

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Supabase 클라이언트 인스턴스 (싱글톤)
 * 환경변수 미설정 시 null 반환 → 호출부에서 데모 모드 폴백
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseEnabled) return null;
  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'hanview-supabase-auth',
    },
    global: {
      headers: { 'x-application-name': 'hanview-ai' },
    },
  });

  return supabaseInstance;
}

/**
 * 디버깅용: 현재 모드 출력
 */
export function getSupabaseMode(): 'production' | 'demo' {
  return isSupabaseEnabled ? 'production' : 'demo';
}

if (import.meta.env.DEV) {
  console.info(
    `[Supabase] Mode: ${getSupabaseMode()}` +
    (isSupabaseEnabled ? ` (${SUPABASE_URL})` : ' — VITE_SUPABASE_URL/ANON_KEY 미설정'),
  );
}
