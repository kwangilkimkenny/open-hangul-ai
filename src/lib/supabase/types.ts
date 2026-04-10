/**
 * Supabase Database Types
 * supabase/migrations/*.sql 과 동기화 필요
 *
 * 자동 생성 명령: supabase gen types typescript --local > src/lib/supabase/types.ts
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          plan: 'free' | 'personal' | 'business' | 'enterprise';
          plan_period: 'monthly' | 'yearly' | null;
          plan_expires_at: string | null;
          ai_credits_remaining: number;
          ai_credits_reset_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          plan?: 'free' | 'personal' | 'business' | 'enterprise';
          plan_period?: 'monthly' | 'yearly' | null;
          plan_expires_at?: string | null;
          ai_credits_remaining?: number;
          ai_credits_reset_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: 'personal' | 'business' | 'enterprise';
          period: 'monthly' | 'yearly';
          status: 'active' | 'canceled' | 'past_due' | 'trialing';
          started_at: string;
          current_period_end: string;
          canceled_at: string | null;
          provider: 'toss' | 'kakao';
          provider_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          order_id: string;
          provider: 'toss' | 'kakao';
          provider_payment_id: string;
          amount: number;
          currency: string;
          status: 'pending' | 'completed' | 'failed' | 'refunded' | 'canceled';
          plan_id: string;
          plan_period: 'monthly' | 'yearly';
          method: string;
          receipt_url: string | null;
          paid_at: string | null;
          refunded_at: string | null;
          metadata: Record<string, any> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          format: 'hwpx' | 'docx' | 'xlsx' | 'pdf' | 'pptx' | 'odt' | 'ods' | 'md';
          size_bytes: number;
          storage_path: string;
          content_hash: string | null;
          version: number;
          is_archived: boolean;
          last_opened_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Record<string, any> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
    };
  };
};
