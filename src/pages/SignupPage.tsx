/**
 * Signup Page
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import PublicHeader from '../components/public/PublicHeader';

export function SignupPage() {
  const navigate = useNavigate();
  const { signup, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', agree: false });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/editor', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (form.password !== form.confirmPassword) {
      setLocalError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (!form.agree) {
      setLocalError('이용약관 및 개인정보처리방침에 동의해주세요');
      return;
    }

    const success = await signup(form.email, form.password, form.name);
    if (success) navigate('/editor', { replace: true });
  };

  return (
    <div className="auth-page">
      <PublicHeader />

      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">무료로 시작하기</h1>
          <p className="auth-subtitle">14일 PRO 무료 체험과 함께 가입하세요</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label htmlFor="name">이름</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="홍길동"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="최소 8자 이상"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">비밀번호 확인</label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="비밀번호를 다시 입력하세요"
                required
                autoComplete="new-password"
              />
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={e => setForm({ ...form, agree: e.target.checked })}
              />
              <span>
                <a href="#terms">이용약관</a> 및 <a href="#privacy">개인정보처리방침</a>에 동의합니다
              </span>
            </label>

            {(error || localError) && <div className="auth-error">{error || localError}</div>}

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? '가입 중...' : '계정 만들기'}
            </button>
          </form>

          <div className="auth-divider"><span>또는</span></div>

          <p className="auth-footer">
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
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
          max-width: 480px;
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
          gap: 16px;
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
        }
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
        .checkbox-field {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12px;
          color: #6b7280;
          padding: 4px 0;
        }
        .checkbox-field input { margin-top: 2px; }
        .checkbox-field a { color: #2b579a; text-decoration: none; font-weight: 500; }
        .checkbox-field a:hover { text-decoration: underline; }
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
        .auth-submit:hover:not(:disabled) { background: #1e3f73; transform: translateY(-1px); }
        .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }
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

export default SignupPage;
