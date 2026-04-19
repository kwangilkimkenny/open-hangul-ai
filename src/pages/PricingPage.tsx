/**
 * Pricing Page
 * 한컴 스타일 요금제 페이지
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import PaymentMethodModal from '../components/PaymentMethodModal';
import toast from 'react-hot-toast';

type Period = 'monthly' | 'yearly';

interface Plan {
  id: 'free' | 'personal' | 'business' | 'enterprise';
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: { documents: string; storage: string; aiCredits: string };
  highlighted?: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: '개인 사용자를 위한 무료 플랜',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'HWPX/DOCX/PDF 열기 및 편집',
      '기본 AI 어시스턴트 5종',
      '문서당 최대 50페이지',
      'PDF 내보내기',
      '커뮤니티 지원',
    ],
    limits: { documents: '월 10개', storage: '500MB', aiCredits: '월 50회' },
    cta: '무료로 시작',
  },
  {
    id: 'personal',
    name: 'Personal',
    tagline: '프리랜서·학생을 위한 표준 플랜',
    monthlyPrice: 9900,
    yearlyPrice: 99000,
    features: [
      '모든 9개 포맷 지원',
      'AI 어시스턴트 15종 전체',
      '변경 추적 & 댓글',
      'OCR (이미지→텍스트)',
      'AI 컴플라이언스 리포트',
      '문서당 최대 500페이지',
      '이메일 지원',
    ],
    limits: { documents: '무제한', storage: '20GB', aiCredits: '월 1,000회' },
    highlighted: true,
    cta: '지금 시작',
  },
  {
    id: 'business',
    name: 'Business',
    tagline: '팀과 기업을 위한 협업 플랜',
    monthlyPrice: 29900,
    yearlyPrice: 299000,
    features: [
      'Personal 플랜 모든 기능',
      '실시간 협업 (5명까지)',
      '클라우드 동기화 (Google Drive)',
      '팀 워크스페이스',
      '관리자 대시보드',
      'AEGIS 보안 게이트웨이',
      'TruthAnchor 할루시네이션 검증',
      '우선 지원 (24시간)',
    ],
    limits: { documents: '무제한', storage: '500GB', aiCredits: '월 10,000회' },
    cta: '팀 시작하기',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: '대규모 조직을 위한 맞춤 플랜',
    monthlyPrice: -1, // 문의
    yearlyPrice: -1,
    features: [
      'Business 플랜 모든 기능',
      '온프레미스 배포 옵션',
      'SSO/SAML 인증',
      '커스텀 LLM 연동',
      'mTLS 상호 인증',
      '감사 로그 & 컴플라이언스 인증서',
      '전담 매니저 + SLA 99.9%',
      '커스텀 통합 (API)',
      '전문가 교육',
    ],
    limits: { documents: '무제한', storage: '무제한', aiCredits: '무제한' },
    cta: '영업팀 문의',
  },
];

export function PricingPage() {
  const [period, setPeriod] = useState<Period>('yearly');
  const navigate = useNavigate();
  const { user, isAuthenticated, updatePlan } = useAuthStore();
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    plan?: Plan;
  }>({ open: false });

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === 'enterprise') {
      toast.success('영업팀에 문의 요청이 전달되었습니다');
      return;
    }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/pricing' } } });
      return;
    }
    if (user?.plan === plan.id) {
      toast('이미 사용 중인 플랜입니다', { icon: 'ℹ️' });
      return;
    }
    if (plan.id === 'free') {
      // Free 플랜은 결제 없이 즉시 변경
      updatePlan(plan.id);
      toast.success('Free 플랜으로 변경되었습니다');
      return;
    }
    // 유료 플랜: 결제 모달 표시
    setPaymentModal({ open: true, plan });
  };

  const getPlanAmount = (plan: Plan) => {
    return period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  };

  const formatPrice = (plan: Plan) => {
    if (plan.monthlyPrice === -1) return '문의';
    if (plan.monthlyPrice === 0) return '₩0';
    const price = period === 'monthly' ? plan.monthlyPrice : Math.floor(plan.yearlyPrice / 12);
    return `₩${price.toLocaleString()}`;
  };

  return (
    <div className="pricing-page">
      <PublicHeader />

      <section className="pricing-hero">
        <div className="pricing-hero-inner">
          <span className="pricing-eyebrow">요금제</span>
          <h1>당신에게 맞는 플랜을 선택하세요</h1>
          <p>모든 플랜에 14일 무료 체험이 포함됩니다. 언제든지 취소 가능합니다.</p>

          <div className="period-toggle">
            <button
              className={period === 'monthly' ? 'active' : ''}
              onClick={() => setPeriod('monthly')}
            >월간</button>
            <button
              className={period === 'yearly' ? 'active' : ''}
              onClick={() => setPeriod('yearly')}
            >
              연간 <span className="discount-badge">17% 할인</span>
            </button>
          </div>
        </div>
      </section>

      <section className="pricing-grid-section">
        <div className="pricing-grid">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`pricing-card ${plan.highlighted ? 'highlighted' : ''} ${user?.plan === plan.id ? 'current' : ''}`}
            >
              {plan.highlighted && <div className="popular-badge">가장 인기</div>}
              {user?.plan === plan.id && <div className="current-badge">현재 플랜</div>}

              <div className="plan-header">
                <h3>{plan.name}</h3>
                <p className="plan-tagline">{plan.tagline}</p>
              </div>

              <div className="plan-price">
                <span className="price-amount">{formatPrice(plan)}</span>
                {plan.monthlyPrice > 0 && (
                  <span className="price-period">/월</span>
                )}
              </div>
              {period === 'yearly' && plan.yearlyPrice > 0 && (
                <p className="yearly-note">연 ₩{plan.yearlyPrice.toLocaleString()} 청구</p>
              )}

              <button
                className={`plan-cta ${plan.highlighted ? 'primary' : ''}`}
                onClick={() => handleSelectPlan(plan)}
              >
                {plan.cta}
              </button>

              <div className="plan-limits">
                <div><strong>{plan.limits.documents}</strong><span>문서</span></div>
                <div><strong>{plan.limits.storage}</strong><span>저장공간</span></div>
                <div><strong>{plan.limits.aiCredits}</strong><span>AI 크레딧</span></div>
              </div>

              <ul className="plan-features">
                {plan.features.map((feat, i) => (
                  <li key={i}>
                    <span className="check">✓</span> {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="comparison-section">
        <div className="section-inner">
          <h2>플랜 비교</h2>
          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Free</th>
                  <th className="highlight">Personal</th>
                  <th>Business</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(row => (
                  <tr key={row.label}>
                    <td className="row-label">{row.label}</td>
                    {row.values.map((val, i) => (
                      <td key={i} className={i === 1 ? 'highlight' : ''}>
                        {val === true ? '✓' : val === false ? '–' : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="section-inner">
          <h2>자주 묻는 질문</h2>
          <div className="faq-grid">
            {faqs.map((faq, i) => (
              <div key={i} className="faq-item">
                <h4>{faq.q}</h4>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />

      {/* 결제 수단 선택 모달 */}
      {paymentModal.open && paymentModal.plan && (
        <PaymentMethodModal
          isOpen={paymentModal.open}
          onClose={() => setPaymentModal({ open: false })}
          planId={paymentModal.plan.id}
          planName={paymentModal.plan.name}
          amount={getPlanAmount(paymentModal.plan)}
          period={period}
        />
      )}

      <style>{`
        .pricing-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
          background: #fff;
          min-height: 100vh;
        }
        .pricing-hero {
          background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
          padding: 60px 0 40px;
          text-align: center;
        }
        .pricing-hero-inner {
          max-width: 720px;
          margin: 0 auto;
          padding: 0 32px;
        }
        .pricing-eyebrow {
          display: inline-block;
          padding: 6px 14px;
          background: #dbeafe;
          color: #1e40af;
          font-size: 12px;
          font-weight: 700;
          border-radius: 100px;
          letter-spacing: 0.5px;
          margin-bottom: 20px;
        }
        .pricing-hero h1 {
          font-size: 44px;
          font-weight: 800;
          margin: 0 0 16px;
          letter-spacing: -1px;
        }
        .pricing-hero p {
          font-size: 16px;
          color: #6b7280;
          margin: 0 0 32px;
        }
        .period-toggle {
          display: inline-flex;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 100px;
          padding: 4px;
          gap: 4px;
        }
        .period-toggle button {
          padding: 10px 24px;
          background: none;
          border: none;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          border-radius: 100px;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .period-toggle button.active {
          background: #2b579a;
          color: #fff;
        }
        .discount-badge {
          background: #10b981;
          color: #fff;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
        }
        .period-toggle button:not(.active) .discount-badge {
          background: #fef3c7;
          color: #92400e;
        }

        .pricing-grid-section {
          padding: 40px 32px 80px;
        }
        .pricing-grid {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .pricing-card {
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 32px 28px;
          position: relative;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }
        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.08);
        }
        .pricing-card.highlighted {
          border: 2px solid #2b579a;
          box-shadow: 0 12px 32px rgba(43, 87, 154, 0.15);
        }
        .pricing-card.current {
          background: linear-gradient(180deg, #f0f7ff 0%, #fff 100%);
        }
        .popular-badge, .current-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 5px 16px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .popular-badge {
          background: #2b579a;
          color: #fff;
        }
        .current-badge {
          background: #10b981;
          color: #fff;
        }
        .plan-header h3 {
          font-size: 22px;
          font-weight: 800;
          margin: 0 0 6px;
          color: #111;
        }
        .plan-tagline {
          font-size: 12px;
          color: #6b7280;
          margin: 0 0 24px;
          min-height: 32px;
        }
        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 4px;
        }
        .price-amount {
          font-size: 36px;
          font-weight: 800;
          color: #111;
          letter-spacing: -1px;
        }
        .price-period {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }
        .yearly-note {
          font-size: 11px;
          color: #9ca3af;
          margin: 0 0 20px;
        }
        .plan-cta {
          width: 100%;
          padding: 12px;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          color: #2b579a;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          margin: 16px 0 24px;
        }
        .plan-cta:hover {
          border-color: #2b579a;
          background: #f0f7ff;
        }
        .plan-cta.primary {
          background: #2b579a;
          color: #fff;
          border-color: #2b579a;
        }
        .plan-cta.primary:hover {
          background: #1e3f73;
          transform: translateY(-1px);
        }
        .plan-limits {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 16px 0;
          border-top: 1px solid #f3f4f6;
          border-bottom: 1px solid #f3f4f6;
          margin-bottom: 20px;
        }
        .plan-limits > div {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .plan-limits strong {
          font-size: 13px;
          color: #2b579a;
          font-weight: 700;
        }
        .plan-limits span {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 2px;
        }
        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0;
          flex: 1;
        }
        .plan-features li {
          font-size: 13px;
          color: #4b5563;
          padding: 7px 0;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.5;
        }
        .check {
          color: #10b981;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* Comparison */
        .comparison-section {
          background: #f9fafb;
        }
        .section-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 80px 32px;
        }
        .section-inner h2 {
          font-size: 32px;
          font-weight: 800;
          text-align: center;
          margin: 0 0 40px;
        }
        .comparison-table-wrapper {
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.04);
        }
        .comparison-table {
          width: 100%;
          border-collapse: collapse;
        }
        .comparison-table th, .comparison-table td {
          padding: 14px 20px;
          text-align: center;
          font-size: 13px;
        }
        .comparison-table th {
          background: #f3f4f6;
          font-weight: 700;
          color: #111;
        }
        .comparison-table th.highlight {
          background: #2b579a;
          color: #fff;
        }
        .comparison-table td.highlight {
          background: #f0f7ff;
          font-weight: 600;
          color: #2b579a;
        }
        .comparison-table tbody tr {
          border-top: 1px solid #f3f4f6;
        }
        .row-label {
          text-align: left !important;
          font-weight: 600;
          color: #374151;
        }

        /* FAQ */
        .faq-section { background: #fff; }
        .faq-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }
        .faq-item {
          padding: 24px;
          background: #f9fafb;
          border-radius: 12px;
        }
        .faq-item h4 {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 8px;
          color: #111;
        }
        .faq-item p {
          font-size: 13px;
          line-height: 1.6;
          color: #6b7280;
          margin: 0;
        }

        @media (max-width: 1080px) {
          .pricing-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .pricing-grid { grid-template-columns: 1fr; }
          .faq-grid { grid-template-columns: 1fr; }
          .pricing-hero h1 { font-size: 32px; }
          .comparison-table { font-size: 11px; }
          .comparison-table th, .comparison-table td { padding: 10px 8px; }
        }
      `}</style>
    </div>
  );
}

const comparisonRows = [
  { label: '지원 포맷', values: ['3종', '9종', '9종', '9종 + 커스텀'] },
  { label: 'AI 어시스턴트', values: ['5종', '15종', '15종', '15종 + 커스텀'] },
  { label: '변경 추적', values: [false, true, true, true] },
  { label: '댓글 협업', values: [false, true, true, true] },
  { label: 'OCR', values: [false, true, true, true] },
  { label: '실시간 협업', values: [false, false, '5명', '무제한'] },
  { label: '클라우드 동기화', values: [false, false, true, true] },
  { label: 'AEGIS 보안', values: [false, false, true, true] },
  { label: 'TruthAnchor 검증', values: [false, false, true, true] },
  { label: 'SSO/SAML', values: [false, false, false, true] },
  { label: '온프레미스 배포', values: [false, false, false, true] },
  { label: '고객 지원', values: ['커뮤니티', '이메일', '24시간', '전담 매니저'] },
];

const faqs = [
  { q: '무료 체험 기간이 있나요?', a: '모든 유료 플랜은 14일 무료 체험을 제공합니다. 신용카드 등록 없이 시작할 수 있으며 언제든지 취소 가능합니다.' },
  { q: '플랜을 언제든 변경할 수 있나요?', a: '네, 언제든지 업그레이드 또는 다운그레이드가 가능합니다. 차액은 일할 계산되어 청구됩니다.' },
  { q: '데이터는 어떻게 보호되나요?', a: 'AEGIS 보안 게이트웨이가 PII 자동 마스킹과 프롬프트 인젝션 방어를 수행합니다. 모든 통신은 TLS 1.3으로 암호화되며, Enterprise 플랜은 mTLS를 지원합니다.' },
  { q: 'AI 크레딧이란 무엇인가요?', a: 'AI 크레딧은 GPT 호출 횟수를 의미합니다. 한 번의 요약/번역/편집 작업은 1 크레딧을 사용하며, 매월 1일 자동 갱신됩니다.' },
  { q: '환불 정책이 어떻게 되나요?', a: '구매 후 7일 이내에는 100% 환불됩니다. 연간 결제 시 사용하지 않은 월에 대해 일할 환불을 제공합니다.' },
  { q: '교육·비영리 할인이 있나요?', a: '교육기관 50%, 비영리단체 30% 할인을 제공합니다. 영업팀(ray.kim@yatavent.com)으로 문의해주세요.' },
];

export default PricingPage;
