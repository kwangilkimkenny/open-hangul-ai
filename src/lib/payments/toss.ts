/**
 * Toss Payments Integration
 * 토스페이먼츠 결제 서비스
 *
 * @module lib/payments/toss
 * @version 2.0.0
 *
 * 듀얼 모드:
 * - Supabase 활성화: Edge Function 'toss-confirm'으로 서버 검증
 * - Supabase 비활성화: 데모 시뮬레이션
 */

import type { PaymentRequest } from './types';
import { getSupabase, isSupabaseEnabled } from '../supabase/client';

// 토스페이먼츠 공식 테스트 클라이언트 키
// 운영 환경: 환경변수 VITE_TOSS_CLIENT_KEY 사용
const TOSS_TEST_CLIENT_KEY = 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

let tossInstance: any = null;

/**
 * Toss Payments SDK 초기화 (lazy)
 */
async function ensureToss(): Promise<any> {
  if (tossInstance) return tossInstance;

  const { loadTossPayments } = await import('@tosspayments/payment-sdk');
  const clientKey = (import.meta.env.VITE_TOSS_CLIENT_KEY as string) || TOSS_TEST_CLIENT_KEY;
  tossInstance = await loadTossPayments(clientKey);
  return tossInstance;
}

/**
 * 토스페이먼츠 카드 결제 요청
 * 결제창이 열리고, 완료 후 successUrl 또는 failUrl로 리다이렉트됩니다.
 */
export async function requestTossCardPayment(req: PaymentRequest): Promise<void> {
  const toss = await ensureToss();

  await toss.requestPayment('카드', {
    amount: req.amount,
    orderId: req.orderId,
    orderName: req.orderName,
    customerName: req.customerName,
    customerEmail: req.customerEmail,
    successUrl: req.successUrl,
    failUrl: req.failUrl,
  });
}

/**
 * 토스페이먼츠 계좌이체 결제
 */
export async function requestTossTransferPayment(req: PaymentRequest): Promise<void> {
  const toss = await ensureToss();

  await toss.requestPayment('계좌이체', {
    amount: req.amount,
    orderId: req.orderId,
    orderName: req.orderName,
    customerName: req.customerName,
    customerEmail: req.customerEmail,
    successUrl: req.successUrl,
    failUrl: req.failUrl,
  });
}

/**
 * 토스페이먼츠 가상계좌 결제
 */
export async function requestTossVirtualAccountPayment(req: PaymentRequest): Promise<void> {
  const toss = await ensureToss();

  await toss.requestPayment('가상계좌', {
    amount: req.amount,
    orderId: req.orderId,
    orderName: req.orderName,
    customerName: req.customerName,
    customerEmail: req.customerEmail,
    successUrl: req.successUrl,
    failUrl: req.failUrl,
    validHours: 24,
  });
}

/**
 * 결제 승인 (운영 환경에서는 백엔드에서 수행)
 *
 * 데모 모드: 클라이언트에서 시뮬레이션만 수행
 * 운영 모드: 백엔드 API 호출이 필요합니다
 *
 * 백엔드 구현 예시:
 * ```
 * POST /api/payments/toss/confirm
 * Body: { paymentKey, orderId, amount }
 * → 백엔드가 https://api.tosspayments.com/v1/payments/confirm 호출
 * → Authorization: Basic {base64(secretKey:)}
 * ```
 */
export async function confirmTossPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
  meta?: { planId: string; planName: string; period: 'monthly' | 'yearly' },
): Promise<{ success: boolean; message: string; receiptUrl?: string }> {
  // Supabase 모드: Edge Function으로 서버 검증
  if (isSupabaseEnabled) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase.functions.invoke('toss-confirm', {
      body: {
        paymentKey,
        orderId,
        amount,
        planId: meta?.planId,
        planName: meta?.planName,
        period: meta?.period,
      },
    });

    if (error) {
      console.error('[Toss] Edge function error:', error);
      return { success: false, message: error.message || '결제 승인에 실패했습니다' };
    }
    if (data?.error) {
      return { success: false, message: data.error };
    }
    return {
      success: true,
      message: '결제가 완료되었습니다',
      receiptUrl: data?.receiptUrl,
    };
  }

  // 데모 모드 폴백
  console.info('[Toss] 결제 승인 시뮬레이션:', { paymentKey, orderId, amount });
  await new Promise(resolve => setTimeout(resolve, 800));
  return { success: true, message: '결제가 완료되었습니다 (데모 모드)' };
}

export default {
  requestTossCardPayment,
  requestTossTransferPayment,
  requestTossVirtualAccountPayment,
  confirmTossPayment,
};
