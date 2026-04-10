/**
 * Public Footer
 * 랜딩/요금제 페이지 공통 푸터
 */
import { Link } from 'react-router-dom';

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <span className="footer-logo">한</span>
              <strong>오픈한글 AI</strong>
            </div>
            <p className="footer-tagline">AI 기반 멀티포맷 문서 편집 플랫폼</p>
            <p className="footer-version">v4.0.0</p>
          </div>

          <div>
            <h4>제품</h4>
            <Link to="/features">기능 소개</Link>
            <Link to="/pricing">요금제</Link>
            <Link to="/editor">편집기 시작</Link>
          </div>

          <div>
            <h4>지원</h4>
            <a href="#docs">도움말</a>
            <a href="#contact">문의하기</a>
            <a href="#status">서비스 상태</a>
          </div>

          <div>
            <h4>회사</h4>
            <a href="#about">소개</a>
            <a href="#privacy">개인정보처리방침</a>
            <a href="#terms">이용약관</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 OpenHangul AI. All rights reserved.</span>
          <span className="footer-badges">
            <span className="badge">EU AI Act 준수</span>
            <span className="badge">K-AI Act 준수</span>
            <span className="badge">NIST AI RMF</span>
          </span>
        </div>
      </div>

      <style>{`
        .public-footer {
          background: #111827;
          color: #9ca3af;
          margin-top: 80px;
        }
        .public-footer-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 56px 32px 32px;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 40px;
        }
        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .footer-brand strong {
          color: #fff;
          font-size: 16px;
        }
        .footer-logo {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #2b579a 0%, #1e3f73 100%);
          color: #fff;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }
        .footer-tagline {
          font-size: 13px;
          line-height: 1.6;
          margin: 0 0 8px;
        }
        .footer-version {
          font-size: 11px;
          color: #6b7280;
          margin: 0;
        }
        .footer-grid h4 {
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          margin: 0 0 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .footer-grid a {
          display: block;
          color: #9ca3af;
          text-decoration: none;
          font-size: 13px;
          padding: 5px 0;
          transition: color 0.15s;
        }
        .footer-grid a:hover { color: #fff; }
        .footer-bottom {
          border-top: 1px solid #1f2937;
          padding-top: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #6b7280;
        }
        .footer-badges {
          display: flex;
          gap: 8px;
        }
        .badge {
          padding: 3px 8px;
          background: #1f2937;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr;
            gap: 32px;
          }
          .footer-bottom {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}

export default PublicFooter;
