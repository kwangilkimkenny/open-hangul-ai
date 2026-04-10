/**
 * Payment Types
 * 결제 시스템 공통 타입
 */

export type PaymentProvider = 'toss' | 'kakao';
export type PaymentStatus = 'ready' | 'pending' | 'success' | 'failed' | 'canceled';
export type PaymentMethod = 'card' | 'transfer' | 'virtualAccount' | 'phone' | 'kakao';

export interface PaymentRequest {
  /** 주문 ID (가맹점 발급, 고유) */
  orderId: string;
  /** 주문명 (예: "Personal 플랜 (월간)") */
  orderName: string;
  /** 결제 금액 (KRW) */
  amount: number;
  /** 고객 이름 */
  customerName: string;
  /** 고객 이메일 */
  customerEmail: string;
  /** 결제 후 리다이렉트 — 성공 */
  successUrl: string;
  /** 결제 후 리다이렉트 — 실패 */
  failUrl: string;
  /** 플랜 메타데이터 */
  metadata?: {
    planId?: string;
    planName?: string;
    period?: 'monthly' | 'yearly';
  };
}

export interface PaymentResult {
  status: PaymentStatus;
  provider: PaymentProvider;
  orderId: string;
  paymentKey?: string;       // Toss
  tid?: string;              // KakaoPay
  amount: number;
  approvedAt?: string;
  receiptUrl?: string;
  errorMessage?: string;
}

/**
 * 주문 ID 생성 (가맹점 형식)
 * 형식: HV-YYYYMMDD-RANDOM6
 */
export function generateOrderId(): string {
  const now = new Date();
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `HV-${date}-${rand}`;
}
