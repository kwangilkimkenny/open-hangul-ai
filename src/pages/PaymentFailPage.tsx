/**
 * Payment Fail Page
 * 결제 실패 콜백 페이지
 */
import { Link, useSearchParams } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader';

const ERROR_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '사용자가 결제를 취소했습니다',
  PAY_PROCESS_ABORTED: '결제 진행 중 오류가 발생했습니다',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다',
  INVALID_CARD_NUMBER: '카드 번호가 잘못되었습니다',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '일일 결제 한도를 초과했습니다',
  NOT_ENOUGH_BALANCE: '잔액이 부족합니다',
  EXPIRED_CARD: '만료된 카드입니다',
};

export function PaymentFailPage() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const message =
    params.get('message') || ERROR_MESSAGES[code] || '결제 처리 중 오류가 발생했습니다';

  // 결제 메타 정리
  sessionStorage.removeItem('payment_meta');
  sessionStorage.removeItem('kakao_pending_tid');
  sessionStorage.removeItem('kakao_pending_order');
  sessionStorage.removeItem('kakao_pending_user');

  return (
    <div className="payment-fail-page">
      <PublicHeader />

      <div className="fail-container">
        <div className="fail-card">
          <div className="fail-icon">!</div>
          <h1>결제에 실패했습니다</h1>
          <p className="fail-message">{message}</p>
          {code && <p className="fail-code">오류 코드: {code}</p>}

          <div className="fail-actions">
            <Link to="/pricing" className="btn-primary">
              요금제 다시 보기
            </Link>
            <Link to="/" className="btn-secondary">
              홈으로 이동
            </Link>
          </div>

          <div className="help-text">
            계속 문제가 발생하면 <a href="mailto:yatav@yatavent.com">yatav@yatavent.com</a>로
            문의해주세요
          </div>
        </div>
      </div>

      <style>{`
        .payment-fail-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
        }
        .fail-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }
        .fail-card {
          background: #fff;
          border-radius: 16px;
          padding: 48px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 20px 60px rgba(239, 68, 68, 0.1);
          text-align: center;
        }
        .fail-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
          color: #fff;
          font-size: 40px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        .fail-card h1 {
          font-size: 24px;
          font-weight: 800;
          margin: 0 0 12px;
          color: #111;
          letter-spacing: -0.5px;
        }
        .fail-message {
          font-size: 14px;
          color: #4b5563;
          margin: 0 0 8px;
          line-height: 1.6;
        }
        .fail-code {
          font-size: 11px;
          color: #9ca3af;
          margin: 0 0 28px;
          font-family: 'SF Mono', 'Consolas', monospace;
        }
        .fail-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }
        .btn-primary, .btn-secondary {
          padding: 13px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          text-align: center;
          transition: all 0.15s;
        }
        .btn-primary {
          background: #2b579a;
          color: #fff;
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
        .help-text {
          font-size: 12px;
          color: #9ca3af;
          padding-top: 20px;
          border-top: 1px solid #f3f4f6;
        }
        .help-text a {
          color: #2b579a;
          text-decoration: none;
          font-weight: 600;
        }
        .help-text a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

export default PaymentFailPage;
