/**
 * KakaoPay Integration
 * 카카오페이 결제 서비스
 *
 * @module lib/payments/kakao
 * @version 1.0.0
 *
 * 참고:
 * - KakaoPay는 공식 npm SDK가 없으며 REST API + 리다이렉트 방식으로 동작합니다
 * - 결제 준비(ready)와 승인(approve)은 백엔드에서 secret key로 호출해야 합니다
 *   (CORS 정책으로 브라우저 직접 호출 불가)
 *
 * 운영 환경 백엔드 엔드포인트:
 * - POST /api/payments/kakao/ready    → KakaoPay /v1/payment/ready 프록시
 * - POST /api/payments/kakao/approve  → KakaoPay /v1/payment/approve 프록시
 *
 * 데모 모드:
 * - 백엔드 없이 카카오페이 테스트 가맹점(TC0ONETIME) 흐름을 시뮬레이션
 * - 실제 결제는 발생하지 않으며 mock URL로 리다이렉트
 */

import type { PaymentRequest } from './types';

interface KakaoReadyResponse {
  tid: string;                    // 결제 고유 번호
  next_redirect_pc_url: string;   // PC용 리다이렉트
  next_redirect_mobile_url: string;
  next_redirect_app_url: string;
  android_app_scheme: string;
  ios_app_scheme: string;
  created_at: string;
}

interface KakaoApproveResponse {
  aid: string;          // 요청 고유 번호
  tid: string;          // 결제 고유 번호
  cid: string;          // 가맹점 코드
  partner_order_id: string;
  partner_user_id: string;
  payment_method_type: 'CARD' | 'MONEY';
  amount: { total: number; tax_free: number; vat: number; point: number; discount: number };
  item_name: string;
  quantity: number;
  created_at: string;
  approved_at: string;
}

/**
 * 카카오페이 결제 준비
 *
 * 데모: 백엔드 없이 시뮬레이션 (실제 결제 X)
 * 운영: /api/payments/kakao/ready 백엔드 엔드포인트 호출
 */
export async function readyKakaoPayment(
  req: PaymentRequest,
): Promise<KakaoReadyResponse> {
  // 운영 환경: 실제 백엔드 호출
  // const response = await fetch('/api/payments/kakao/ready', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     cid: 'TC0ONETIME',
  //     partner_order_id: req.orderId,
  //     partner_user_id: req.customerEmail,
  //     item_name: req.orderName,
  //     quantity: 1,
  //     total_amount: req.amount,
  //     tax_free_amount: 0,
  //     approval_url: req.successUrl,
  //     fail_url: req.failUrl,
  //     cancel_url: req.failUrl + '?canceled=true',
  //   }),
  // });
  // if (!response.ok) throw new Error('카카오페이 결제 준비 실패');
  // return await response.json();

  // 데모 모드: 시뮬레이션 응답 생성
  console.info('[KakaoPay] 결제 준비 시뮬레이션:', req);
  await new Promise(resolve => setTimeout(resolve, 600));

  const tid = `T${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const mockTid = encodeURIComponent(tid);
  const mockOrderId = encodeURIComponent(req.orderId);
  const mockAmount = req.amount;

  // 데모 모드에서는 successUrl로 직접 이동하면서 KakaoPay 파라미터를 시뮬레이션
  const demoRedirectUrl = `${req.successUrl}?tid=${mockTid}&pg_token=DEMO_${mockTid}&orderId=${mockOrderId}&amount=${mockAmount}&provider=kakao`;

  return {
    tid,
    next_redirect_pc_url: demoRedirectUrl,
    next_redirect_mobile_url: demoRedirectUrl,
    next_redirect_app_url: demoRedirectUrl,
    android_app_scheme: '',
    ios_app_scheme: '',
    created_at: new Date().toISOString(),
  };
}

/**
 * 카카오페이 결제 승인
 *
 * 사용자가 카카오 결제를 완료한 후, 콜백 URL로 돌아왔을 때 호출
 * 운영: 백엔드에서 KakaoPay /v1/payment/approve 호출 필수
 */
export async function approveKakaoPayment(
  tid: string,
  pgToken: string,
  partnerOrderId: string,
  partnerUserId: string,
): Promise<KakaoApproveResponse> {
  // 운영 환경: 실제 백엔드 호출
  // const response = await fetch('/api/payments/kakao/approve', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     cid: 'TC0ONETIME',
  //     tid,
  //     partner_order_id: partnerOrderId,
  //     partner_user_id: partnerUserId,
  //     pg_token: pgToken,
  //   }),
  // });
  // if (!response.ok) throw new Error('카카오페이 결제 승인 실패');
  // return await response.json();

  // 데모 시뮬레이션
  console.info('[KakaoPay] 결제 승인 시뮬레이션:', { tid, pgToken });
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    aid: `A${Date.now()}`,
    tid,
    cid: 'TC0ONETIME',
    partner_order_id: partnerOrderId,
    partner_user_id: partnerUserId,
    payment_method_type: 'CARD',
    amount: { total: 0, tax_free: 0, vat: 0, point: 0, discount: 0 },
    item_name: '오픈한글 AI 구독',
    quantity: 1,
    created_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
  };
}

/**
 * 카카오페이 결제 시작 (사용자를 결제 페이지로 리다이렉트)
 */
export async function requestKakaoPayment(req: PaymentRequest): Promise<void> {
  const ready = await readyKakaoPayment(req);

  // 모바일/PC 자동 감지
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const redirectUrl = isMobile ? ready.next_redirect_mobile_url : ready.next_redirect_pc_url;

  // tid를 sessionStorage에 저장 (콜백 시 approve 호출용)
  sessionStorage.setItem('kakao_pending_tid', ready.tid);
  sessionStorage.setItem('kakao_pending_order', req.orderId);
  sessionStorage.setItem('kakao_pending_user', req.customerEmail);

  window.location.href = redirectUrl;
}

export default {
  readyKakaoPayment,
  approveKakaoPayment,
  requestKakaoPayment,
};
