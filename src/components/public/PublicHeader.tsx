/**
 * Public Header
 * 랜딩/요금제/로그인 페이지 공통 헤더
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function PublicHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link to="/" className="public-logo">
          <span className="logo-mark">한</span>
          <span className="logo-text">오픈한글 AI</span>
        </Link>

        <nav className="public-nav">
          <Link to="/" className={isActive('/') ? 'active' : ''}>홈</Link>
          <Link to="/features" className={isActive('/features') ? 'active' : ''}>제품</Link>
          <Link to="/pricing" className={isActive('/pricing') ? 'active' : ''}>요금제</Link>
          <Link to="/editor" className={isActive('/editor') ? 'active' : ''}>편집기</Link>
        </nav>

        <div className="public-actions">
          {isAuthenticated && user ? (
            <>
              <span className="user-greeting">
                <span className="user-avatar">{user.name.charAt(0)}</span>
                {user.name}님
              </span>
              <span className="user-plan-badge">{planLabel(user.plan)}</span>
              <button onClick={handleLogout} className="btn-text">로그아웃</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-text">로그인</Link>
              <Link to="/signup" className="btn-primary">무료로 시작하기</Link>
            </>
          )}
        </div>
      </div>

      <style>{`
        .public-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #e5e7eb;
        }
        .public-header-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }
        .public-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #111;
          font-weight: 700;
          font-size: 18px;
        }
        .logo-mark {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #2b579a 0%, #1e3f73 100%);
          color: #fff;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
        }
        .public-nav {
          display: flex;
          gap: 28px;
          flex: 1;
          margin-left: 32px;
        }
        .public-nav a {
          text-decoration: none;
          color: #444;
          font-size: 14px;
          font-weight: 500;
          padding: 6px 0;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .public-nav a:hover { color: #2b579a; }
        .public-nav a.active {
          color: #2b579a;
          border-bottom-color: #2b579a;
        }
        .public-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-greeting {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #444;
        }
        .user-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #2b579a;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        .user-plan-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          background: #fff3cd;
          color: #856404;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .btn-text {
          background: none;
          border: none;
          color: #444;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 16px;
          text-decoration: none;
        }
        .btn-text:hover { color: #2b579a; }
        .btn-primary {
          background: #2b579a;
          color: #fff;
          padding: 9px 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-primary:hover { background: #1e3f73; }

        @media (max-width: 768px) {
          .public-nav { display: none; }
          .public-header-inner { padding: 14px 20px; }
        }
      `}</style>
    </header>
  );
}

function planLabel(plan: string): string {
  return { free: 'FREE', personal: 'PERSONAL', business: 'BUSINESS', enterprise: 'ENTERPRISE' }[plan] || plan;
}

export default PublicHeader;
