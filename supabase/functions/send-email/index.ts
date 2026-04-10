/**
 * Send Email Edge Function
 * Resend API 기반 트랜잭션 이메일 발송
 *
 * 환경변수:
 *   RESEND_API_KEY  - Resend API 키
 *   EMAIL_FROM      - 발신자 (예: noreply@hanview.ai)
 *
 * 지원 템플릿:
 *   - welcome           회원가입 환영
 *   - email_verification 이메일 인증 (Supabase Auth가 기본 발송하므로 보충용)
 *   - password_reset    비밀번호 재설정
 *   - payment_receipt   결제 영수증
 *   - plan_changed      플랜 변경 알림
 *   - subscription_renewal 정기결제 갱신 알림
 *   - subscription_canceled 구독 해지
 */

import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'OpenHangul AI <noreply@hanview.ai>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type TemplateName =
  | 'welcome'
  | 'password_reset'
  | 'payment_receipt'
  | 'plan_changed'
  | 'subscription_renewal'
  | 'subscription_canceled';

interface SendEmailRequest {
  template: TemplateName;
  to: string;
  data: Record<string, any>;
}

serve(async req => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 인증: 본인 또는 service_role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: '인증 필요' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: '세션 무효' }, 401);

    const { template, to, data } = (await req.json()) as SendEmailRequest;

    if (!template || !to || !data) {
      return jsonResponse({ error: '필수 파라미터 누락' }, 400);
    }

    // 사용자는 자신의 이메일 주소로만 발송 가능
    if (user.email !== to) {
      return jsonResponse({ error: '권한 없음' }, 403);
    }

    const { subject, html } = renderTemplate(template, data);

    // Resend API 호출
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.json();
      console.error('Resend error:', err);
      return jsonResponse({ error: '이메일 발송 실패' }, 500);
    }

    const result = await resendResponse.json();
    return jsonResponse({ success: true, id: result.id });
  } catch (err) {
    console.error('send-email error:', err);
    return jsonResponse({ error: '서버 오류' }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 이메일 템플릿
// ============================================================

function renderTemplate(name: TemplateName, data: Record<string, any>): { subject: string; html: string } {
  switch (name) {
    case 'welcome':
      return {
        subject: '오픈한글 AI에 오신 것을 환영합니다',
        html: baseTemplate(`
          <h1 style="color:#111;font-size:24px;">${escapeHtml(data.name || '회원')}님, 환영합니다 🎉</h1>
          <p>오픈한글 AI에 가입해주셔서 감사합니다. 이제 9개 포맷의 문서를 하나의 편집기에서 다룰 수 있습니다.</p>
          <a href="${escapeHtml(data.editorUrl || 'https://hanview.ai/editor')}" class="btn">편집기 시작하기</a>
          <p style="color:#6b7280;font-size:13px;">데모 계정으로 빠르게 체험하시려면 demo@hanview.ai / demo1234 를 사용하세요.</p>
        `),
      };

    case 'password_reset':
      return {
        subject: '[오픈한글 AI] 비밀번호 재설정',
        html: baseTemplate(`
          <h1 style="color:#111;font-size:24px;">비밀번호 재설정</h1>
          <p>비밀번호 재설정 요청을 받았습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.</p>
          <a href="${escapeHtml(data.resetUrl)}" class="btn">비밀번호 재설정</a>
          <p style="color:#6b7280;font-size:13px;">본인이 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다. 링크는 24시간 후 만료됩니다.</p>
        `),
      };

    case 'payment_receipt':
      return {
        subject: `[오픈한글 AI] 결제 영수증 — ${data.planName}`,
        html: baseTemplate(`
          <h1 style="color:#111;font-size:24px;">결제가 완료되었습니다</h1>
          <p>${escapeHtml(data.name || '고객')}님의 결제 내역입니다.</p>
          <table class="receipt-table">
            <tr><td>주문번호</td><td><strong>${escapeHtml(data.orderId)}</strong></td></tr>
            <tr><td>상품명</td><td><strong>${escapeHtml(data.planName)} (${data.period === 'monthly' ? '월간' : '연간'})</strong></td></tr>
            <tr><td>결제 금액</td><td><strong>₩${Number(data.amount).toLocaleString()}</strong></td></tr>
            <tr><td>결제 수단</td><td><strong>${escapeHtml(data.method || '카드')}</strong></td></tr>
            <tr><td>결제 일시</td><td><strong>${escapeHtml(data.paidAt || new Date().toLocaleString('ko-KR'))}</strong></td></tr>
          </table>
          ${data.receiptUrl ? `<a href="${escapeHtml(data.receiptUrl)}" class="btn">영수증 보기</a>` : ''}
          <p style="color:#6b7280;font-size:13px;">환불 문의: <a href="mailto:support@hanview.ai">support@hanview.ai</a></p>
        `),
      };

    case 'plan_changed':
      return {
        subject: `[오픈한글 AI] ${data.newPlan} 플랜으로 변경되었습니다`,
        html: baseTemplate(`
          <h1 style="color:#111;font-size:24px;">플랜이 변경되었습니다</h1>
          <p>${escapeHtml(data.name || '고객')}님의 플랜이 <strong>${escapeHtml(data.oldPlan)}</strong>에서 <strong>${escapeHtml(data.newPlan)}</strong>(으)로 변경되었습니다.</p>
          <a href="https://hanview.ai/editor" class="btn">편집기 사용하기</a>
        `),
      };

    case 'subscription_renewal':
      return {
        subject: '[오픈한글 AI] 구독이 갱신되었습니다',
        html: baseTemplate(`
          <h1 style="color:#111;font-size:24px;">구독이 자동 갱신되었습니다</h1>
          <p>${escapeHtml(data.name || '고객')}님의 ${escapeHtml(data.planName)} 플랜이 갱신되었습니다.</p>
          <p>다음 결제 예정일: <strong>${escapeHtml(data.nextBillingDate)}</strong></p>
          <p>결제 금액: <strong>₩${Number(data.amount).toLocaleString()}</strong></p>
        `),
      };

    case 'subscription_canceled':
      return {
        subject: '[오픈한글 AI] 구독이 해지되었습니다',
        html: baseTemplate(`
          <h1 style="color:#111;font-size:24px;">구독 해지 완료</h1>
          <p>${escapeHtml(data.name || '고객')}님의 구독이 해지되었습니다.</p>
          <p>${escapeHtml(data.expiresAt)}까지는 계속 서비스를 이용하실 수 있습니다.</p>
          <p style="color:#6b7280;font-size:13px;">언제든지 다시 가입하실 수 있습니다. 더 나은 서비스로 보답하겠습니다.</p>
        `),
      };

    default:
      return { subject: '오픈한글 AI', html: baseTemplate('<p>알림 메시지</p>') };
  }
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif; background:#f9fafb; margin:0; padding:40px 20px; color:#374151; }
    .container { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .logo { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 32px; }
    .logo-mark { width: 36px; height: 36px; background: linear-gradient(135deg,#2b579a 0%, #1e3f73 100%); color: #fff; border-radius: 8px; display:inline-flex; align-items:center; justify-content:center; font-weight: 800; font-size: 18px; }
    .logo-text { font-size: 16px; font-weight: 700; color: #111; }
    h1 { margin: 0 0 16px; }
    p { line-height: 1.7; font-size: 14px; }
    .btn { display: inline-block; padding: 12px 28px; background: #2b579a; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .receipt-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .receipt-table td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .receipt-table td:first-child { color: #6b7280; }
    .receipt-table td:last-child { text-align: right; }
    .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #9ca3af; text-align: center; }
    a { color: #2b579a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span class="logo-mark">한</span>
      <span class="logo-text">오픈한글 AI</span>
    </div>
    ${content}
    <div class="footer">
      © 2026 OpenHangul AI · <a href="https://hanview.ai">hanview.ai</a><br>
      이 이메일은 자동 발송되었습니다. 회신하지 마세요.<br>
      <a href="https://hanview.ai/legal/privacy">개인정보처리방침</a> · <a href="https://hanview.ai/legal/terms">이용약관</a>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
