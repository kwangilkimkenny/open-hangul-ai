/**
 * Cookie Consent Banner
 * GDPR/PIPA 준수 — 필수/분석/마케팅 쿠키 분리 동의
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface ConsentState {
  necessary: true;       // 항상 true (변경 불가)
  analytics: boolean;
  marketing: boolean;
  consentedAt: string;
}

const STORAGE_KEY = 'hanview-cookie-consent';

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setShow(true);
    }
  }, []);

  const save = (state: Omit<ConsentState, 'consentedAt'>) => {
    const consent: ConsentState = { ...state, consentedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    setShow(false);
  };

  const acceptAll = () => save({ necessary: true, analytics: true, marketing: true });
  const acceptNecessary = () => save({ necessary: true, analytics: false, marketing: false });
  const acceptCustom = () => save({ necessary: true, analytics, marketing });

  if (!show) return null;

  return (
    <div className="cookie-consent">
      <div className="consent-inner">
        {!showDetails ? (
          <>
            <div className="consent-content">
              <strong>🍪 쿠키 사용 안내</strong>
              <p>
                저희는 서비스 개선과 사용자 경험 향상을 위해 쿠키를 사용합니다.
                <Link to="/legal/privacy"> 개인정보처리방침</Link>을 확인해 주세요.
              </p>
            </div>
            <div className="consent-actions">
              <button onClick={() => setShowDetails(true)} className="btn-text">설정</button>
              <button onClick={acceptNecessary} className="btn-secondary">필수만</button>
              <button onClick={acceptAll} className="btn-primary">모두 동의</button>
            </div>
          </>
        ) : (
          <div className="consent-details">
            <strong>쿠키 설정</strong>
            <div className="cookie-options">
              <label className="cookie-option disabled">
                <input type="checkbox" checked disabled />
                <div>
                  <strong>필수 쿠키</strong>
                  <span>로그인, 보안 등 서비스 운영에 반드시 필요한 쿠키 (변경 불가)</span>
                </div>
              </label>
              <label className="cookie-option">
                <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} />
                <div>
                  <strong>분석 쿠키</strong>
                  <span>방문자 통계, 사용 패턴 분석 (Google Analytics 등)</span>
                </div>
              </label>
              <label className="cookie-option">
                <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
                <div>
                  <strong>마케팅 쿠키</strong>
                  <span>맞춤형 광고, 리타게팅</span>
                </div>
              </label>
            </div>
            <div className="consent-actions">
              <button onClick={() => setShowDetails(false)} className="btn-text">취소</button>
              <button onClick={acceptCustom} className="btn-primary">선택 저장</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .cookie-consent {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: #fff;
          border-top: 1px solid #e5e7eb;
          box-shadow: 0 -10px 30px rgba(0,0,0,0.08);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .consent-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 20px 32px;
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .consent-content { flex: 1; min-width: 300px; }
        .consent-content strong {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #111;
          margin-bottom: 4px;
        }
        .consent-content p {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
          line-height: 1.5;
        }
        .consent-content a {
          color: #2b579a;
          text-decoration: none;
          font-weight: 600;
        }
        .consent-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .btn-text {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 13px;
          cursor: pointer;
          padding: 8px 14px;
        }
        .btn-text:hover { color: #111; }
        .btn-secondary {
          background: #fff;
          border: 1px solid #d1d5db;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-secondary:hover { border-color: #2b579a; color: #2b579a; }
        .btn-primary {
          background: #2b579a;
          border: none;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          padding: 9px 18px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-primary:hover { background: #1e3f73; }

        .consent-details { width: 100%; }
        .consent-details > strong {
          display: block;
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .cookie-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }
        .cookie-option {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
          cursor: pointer;
        }
        .cookie-option.disabled { opacity: 0.7; cursor: not-allowed; }
        .cookie-option input { margin-top: 2px; }
        .cookie-option strong {
          display: block;
          font-size: 13px;
          color: #111;
          margin-bottom: 2px;
        }
        .cookie-option span {
          font-size: 11px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}

export default CookieConsent;
