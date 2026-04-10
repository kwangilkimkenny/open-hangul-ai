/**
 * Payment Success Page
 * 결제 성공 콜백 페이지 (Toss/KakaoPay 공통)
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import PublicHeader from '../components/public/PublicHeader';

interface PaymentMeta {
  planId: 'free' | 'personal' | 'business' | 'enterprise';
  planName: string;
  period: 'monthly' | 'yearly';
  amount: number;
  orderId: string;
}

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { updatePlan } = useAuthStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [meta, setMeta] = useState<PaymentMeta | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const verifyPayment = async () => {
      const provider = params.get('provider');
      const paymentKey = params.get('paymentKey'); // Toss
      const tid = params.get('tid');               // Kakao
      const pgToken = params.get('pg_token');      // Kakao
      const orderId = params.get('orderId');
      const amount = params.get('amount');

      const metaJson = sessionStorage.getItem('payment_meta');
      if (!metaJson) {
        setStatus('failed');
        setErrorMsg('결제 메타데이터를 찾을 수 없습니다');
        return;
      }
      const parsedMeta: PaymentMeta = JSON.parse(metaJson);
      setMeta(parsedMeta);

      try {
        // Toss 결제 승인
        if (paymentKey && orderId && amount) {
          const { confirmTossPayment } = await import('../lib/payments/toss');
          const result = await confirmTossPayment(paymentKey, orderId, parseInt(amount, 10));
          if (!result.success) {
            setStatus('failed');
            setErrorMsg(result.message);
            return;
          }
        }
        // KakaoPay 결제 승인
        else if (provider === 'kakao' && tid && pgToken) {
          const pendingTid = sessionStorage.getItem('kakao_pending_tid');
          const pendingOrder = sessionStorage.getItem('kakao_pending_order');
          const pendingUser = sessionStorage.getItem('kakao_pending_user');
          if (!pendingTid || pendingTid !== tid) {
            setStatus('failed');
            setErrorMsg('카카오페이 세션 정보가 일치하지 않습니다');
            return;
          }
          const { approveKakaoPayment } = await import('../lib/payments/kakao');
          await approveKakaoPayment(tid, pgToken, pendingOrder || '', pendingUser || '');
          sessionStorage.removeItem('kakao_pending_tid');
          sessionStorage.removeItem('kakao_pending_order');
          sessionStorage.removeItem('kakao_pending_user');
        } else {
          setStatus('failed');
          setErrorMsg('결제 정보가 부족합니다');
          return;
        }

        // 플랜 업데이트
        updatePlan(parsedMeta.planId);
        sessionStorage.removeItem('payment_meta');
        setStatus('success');
      } catch (err: any) {
        setStatus('failed');
        setErrorMsg(err?.message || '결제 검증에 실패했습니다');
      }
    };

    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="payment-result-page">
      <PublicHeader />

      <div className="payment-result-container">
        {status === 'verifying' && (
          <div className="result-card">
            <div className="spinner" />
            <h1>결제를 확인하고 있습니다...</h1>
            <p>잠시만 기다려주세요</p>
          </div>
        )}

        {status === 'success' && meta && (
          <div className="result-card success">
            <div className="result-icon success-icon">✓</div>
            <h1>결제가 완료되었습니다</h1>
            <p className="result-sub">{meta.planName} 플랜이 활성화되었습니다</p>

            <div className="receipt">
              <div className="receipt-row">
                <span>주문번호</span>
                <strong>{meta.orderId}</strong>
              </div>
              <div className="receipt-row">
                <span>플랜</span>
                <strong>{meta.planName} ({meta.period === 'monthly' ? '월간' : '연간'})</strong>
              </div>
              <div className="receipt-row">
                <span>결제 금액</span>
                <strong>₩{meta.amount.toLocaleString()}</strong>
              </div>
              <div className="receipt-row">
                <span>결제 일시</span>
                <strong>{new Date().toLocaleString('ko-KR')}</strong>
              </div>
            </div>

            <div className="result-actions">
              <button onClick={() => navigate('/editor')} className="btn-primary">
                편집기 시작하기
              </button>
              <Link to="/" className="btn-secondary">홈으로 이동</Link>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="result-card failed">
            <div className="result-icon fail-icon">✕</div>
            <h1>결제 처리 실패</h1>
            <p className="result-sub">{errorMsg}</p>
            <div className="result-actions">
              <button onClick={() => navigate('/pricing')} className="btn-primary">
                요금제 다시 보기
              </button>
              <Link to="/" className="btn-secondary">홈으로 이동</Link>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .payment-result-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
        }
        .payment-result-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }
        .result-card {
          background: #fff;
          border-radius: 16px;
          padding: 48px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.08);
          text-align: center;
        }
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e5e7eb;
          border-top-color: #2b579a;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 24px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .result-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 800;
          margin: 0 auto 24px;
          color: #fff;
        }
        .success-icon { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .fail-icon { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .result-card h1 {
          font-size: 24px;
          font-weight: 800;
          margin: 0 0 8px;
          color: #111;
          letter-spacing: -0.5px;
        }
        .result-sub {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 28px;
        }
        .receipt {
          background: #f9fafb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          text-align: left;
        }
        .receipt-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px solid #f3f4f6;
        }
        .receipt-row:last-child { border-bottom: none; }
        .receipt-row span { color: #6b7280; }
        .receipt-row strong { color: #111; font-weight: 600; }
        .result-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .btn-primary, .btn-secondary {
          padding: 13px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
          transition: all 0.15s;
        }
        .btn-primary {
          background: #2b579a;
          color: #fff;
          border: none;
        }
        .btn-primary:hover {
          background: #1e3f73;
          transform: translateY(-1px);
        }
        .btn-secondary {
          background: #fff;
          color: #2b579a;
          border: 1.5px solid #d1d5db;
        }
        .btn-secondary:hover {
          border-color: #2b579a;
          background: #f0f7ff;
        }
      `}</style>
    </div>
  );
}

export default PaymentSuccessPage;
