/**
 * Login Page
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import PublicHeader from '../components/public/PublicHeader';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/editor';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) navigate(from, { replace: true });
  };

  const useDemoAccount = () => {
    setEmail('demo@hanview.ai');
    setPassword('demo1234');
    setShowDemo(false);
  };

  return (
    <div className="auth-page">
      <PublicHeader />

      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">로그인</h1>
          <p className="auth-subtitle">오픈한글 AI에 다시 오신 것을 환영합니다</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">
                비밀번호
                <a href="#forgot" className="forgot-link">비밀번호를 잊으셨나요?</a>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <button onClick={() => setShowDemo(!showDemo)} className="demo-toggle">
            데모 계정 보기 ▾
          </button>
          {showDemo && (
            <div className="demo-info">
              <p><strong>데모 계정으로 빠르게 체험해보세요</strong></p>
              <code>demo@hanview.ai / demo1234</code>
              <button onClick={useDemoAccount} className="demo-fill">데모 계정으로 입력</button>
            </div>
          )}

          <div className="auth-divider">
            <span>또는</span>
          </div>

          <p className="auth-footer">
            아직 계정이 없으신가요? <Link to="/signup">무료로 가입하기</Link>
          </p>
        </div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
        }
        .auth-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }
        .auth-card {
          background: #fff;
          border-radius: 16px;
          padding: 48px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
        }
        .auth-title {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 8px;
          color: #111;
          letter-spacing: -0.5px;
        }
        .auth-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 32px;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-field label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .forgot-link {
          font-size: 12px;
          color: #2b579a;
          text-decoration: none;
          font-weight: 500;
        }
        .forgot-link:hover { text-decoration: underline; }
        .form-field input {
          padding: 12px 14px;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.15s;
          font-family: inherit;
        }
        .form-field input:focus {
          outline: none;
          border-color: #2b579a;
          box-shadow: 0 0 0 3px rgba(43, 87, 154, 0.1);
        }
        .auth-error {
          background: #fef2f2;
          color: #b91c1c;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          border: 1px solid #fecaca;
        }
        .auth-submit {
          background: #2b579a;
          color: #fff;
          border: none;
          padding: 13px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          margin-top: 8px;
        }
        .auth-submit:hover:not(:disabled) {
          background: #1e3f73;
          transform: translateY(-1px);
        }
        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .demo-toggle {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 12px;
          cursor: pointer;
          margin-top: 16px;
          padding: 4px;
        }
        .demo-toggle:hover { color: #2b579a; }
        .demo-info {
          background: #f9fafb;
          border: 1px dashed #d1d5db;
          padding: 12px 14px;
          border-radius: 8px;
          margin-top: 8px;
          font-size: 12px;
          color: #4b5563;
        }
        .demo-info p { margin: 0 0 6px; font-size: 12px; }
        .demo-info code {
          display: block;
          background: #fff;
          padding: 6px 8px;
          border-radius: 4px;
          font-family: 'SF Mono', 'Consolas', monospace;
          font-size: 11px;
          color: #2b579a;
          margin-bottom: 8px;
        }
        .demo-fill {
          background: #2b579a;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0;
          color: #9ca3af;
          font-size: 12px;
        }
        .auth-divider::before, .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }
        .auth-footer {
          text-align: center;
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }
        .auth-footer a {
          color: #2b579a;
          font-weight: 600;
          text-decoration: none;
        }
        .auth-footer a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

export default LoginPage;
