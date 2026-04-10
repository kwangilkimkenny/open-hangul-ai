/**
 * Payment Method Modal
 * 결제 수단 선택 모달 (Toss/KakaoPay)
 */
import { useState } from 'react';
import { generateOrderId } from '../lib/payments/types';
import type { PaymentRequest } from '../lib/payments/types';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  amount: number;
  period: 'monthly' | 'yearly';
}

type Provider = 'toss-card' | 'toss-transfer' | 'toss-virtual' | 'kakao';

export function PaymentMethodModal({
  isOpen, onClose, planId, planName, amount, period,
}: PaymentMethodModalProps) {
  const { user } = useAuthStore();
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected] = useState<Provider>('toss-card');

  if (!isOpen) return null;

  const handlePay = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다');
      return;
    }
    setProcessing(true);

    const orderId = generateOrderId();
    const orderName = `${planName} 플랜 (${period === 'monthly' ? '월간' : '연간'})`;
    const baseUrl = window.location.origin;

    // 결제 메타데이터를 sessionStorage에 임시 저장 (success 페이지에서 플랜 업데이트)
    sessionStorage.setItem('payment_meta', JSON.stringify({
      planId, planName, period, amount, orderId,
    }));

    const req: PaymentRequest = {
      orderId,
      orderName,
      amount,
      customerName: user.name,
      customerEmail: user.email,
      successUrl: `${baseUrl}/payment/success`,
      failUrl: `${baseUrl}/payment/fail`,
      metadata: { planId, planName, period },
    };

    try {
      if (selected.startsWith('toss-')) {
        const toss = await import('../lib/payments/toss');
        if (selected === 'toss-card') await toss.requestTossCardPayment(req);
        else if (selected === 'toss-transfer') await toss.requestTossTransferPayment(req);
        else if (selected === 'toss-virtual') await toss.requestTossVirtualAccountPayment(req);
      } else if (selected === 'kakao') {
        const kakao = await import('../lib/payments/kakao');
        await kakao.requestKakaoPayment(req);
      }
    } catch (err: any) {
      setProcessing(false);
      // 사용자가 결제창을 닫은 경우
      if (err?.code === 'USER_CANCEL') {
        toast('결제가 취소되었습니다');
      } else {
        toast.error(`결제 요청 실패: ${err?.message || '알 수 없는 오류'}`);
      }
    }
  };

  const methods: Array<{ id: Provider; label: string; sub: string; icon: string; color: string }> = [
    { id: 'toss-card', label: '카드 결제', sub: '신용/체크카드 (토스페이먼츠)', icon: '💳', color: '#0064ff' },
    { id: 'toss-transfer', label: '계좌이체', sub: '실시간 계좌이체 (토스페이먼츠)', icon: '🏦', color: '#0064ff' },
    { id: 'toss-virtual', label: '가상계좌', sub: '입금 후 결제 완료 (토스페이먼츠)', icon: '🧾', color: '#0064ff' },
    { id: 'kakao', label: '카카오페이', sub: '카카오톡으로 간편 결제', icon: 'K', color: '#fee500' },
  ];

  return (
    <div className="payment-modal-backdrop" onClick={onClose}>
      <div className="payment-modal" onClick={e => e.stopPropagation()}>
        <div className="payment-modal-header">
          <div>
            <h2>결제 수단 선택</h2>
            <p className="modal-sub">{planName} 플랜 ({period === 'monthly' ? '월간' : '연간'})</p>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="닫기">×</button>
        </div>

        <div className="payment-amount">
          <span>결제 금액</span>
          <strong>₩{amount.toLocaleString()}</strong>
        </div>

        <div className="payment-methods">
          {methods.map(m => (
            <label
              key={m.id}
              className={`payment-method ${selected === m.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="payment-method"
                value={m.id}
                checked={selected === m.id}
                onChange={() => setSelected(m.id)}
              />
              <span className="method-icon" style={{ background: m.color, color: m.id === 'kakao' ? '#3c1e1e' : '#fff' }}>
                {m.icon}
              </span>
              <div className="method-info">
                <strong>{m.label}</strong>
                <span>{m.sub}</span>
              </div>
              <span className="method-radio" />
            </label>
          ))}
        </div>

        <div className="payment-notice">
          <strong>⚠ 데모 모드 안내</strong>
          <p>현재 테스트 모드입니다. 실제 결제는 발생하지 않으며, 운영 환경에서는 백엔드 결제 검증 API 연동이 필요합니다.</p>
        </div>

        <button
          onClick={handlePay}
          disabled={processing}
          className="pay-button"
        >
          {processing ? '결제 진행 중...' : `₩${amount.toLocaleString()} 결제하기`}
        </button>

        <button onClick={onClose} className="cancel-link">취소</button>
      </div>

      <style>{`
        .payment-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(17, 24, 39, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          backdrop-filter: blur(4px);
        }
        .payment-modal {
          background: #fff;
          border-radius: 16px;
          padding: 32px;
          width: 100%;
          max-width: 460px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 80px rgba(0,0,0,0.3);
        }
        .payment-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .payment-modal-header h2 {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 4px;
          color: #111;
        }
        .modal-sub {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 28px;
          color: #9ca3af;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
        }
        .close-btn:hover { color: #111; }
        .payment-amount {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f0f7ff;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1.5px solid #dbeafe;
        }
        .payment-amount span {
          font-size: 13px;
          color: #2b579a;
          font-weight: 600;
        }
        .payment-amount strong {
          font-size: 22px;
          font-weight: 800;
          color: #1e3f73;
          letter-spacing: -0.5px;
        }
        .payment-methods {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }
        .payment-method {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
        }
        .payment-method:hover { border-color: #93bbfb; background: #fafbff; }
        .payment-method.selected {
          border-color: #2b579a;
          background: #f0f7ff;
        }
        .payment-method input[type="radio"] {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }
        .method-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .method-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .method-info strong {
          font-size: 14px;
          font-weight: 700;
          color: #111;
        }
        .method-info span {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }
        .method-radio {
          width: 20px;
          height: 20px;
          border: 2px solid #d1d5db;
          border-radius: 50%;
          flex-shrink: 0;
          position: relative;
        }
        .payment-method.selected .method-radio {
          border-color: #2b579a;
          background: #2b579a;
        }
        .payment-method.selected .method-radio::after {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          background: #fff;
        }
        .payment-notice {
          padding: 12px 14px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .payment-notice strong {
          font-size: 12px;
          color: #c2410c;
          display: block;
          margin-bottom: 4px;
        }
        .payment-notice p {
          font-size: 11px;
          color: #9a3412;
          margin: 0;
          line-height: 1.5;
        }
        .pay-button {
          width: 100%;
          padding: 14px;
          background: #2b579a;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pay-button:hover:not(:disabled) {
          background: #1e3f73;
          transform: translateY(-1px);
        }
        .pay-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .cancel-link {
          width: 100%;
          background: none;
          border: none;
          color: #6b7280;
          font-size: 13px;
          cursor: pointer;
          padding: 12px;
          margin-top: 4px;
        }
        .cancel-link:hover { color: #111; }
      `}</style>
    </div>
  );
}

export default PaymentMethodModal;
