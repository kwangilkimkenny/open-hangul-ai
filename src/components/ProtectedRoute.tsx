/**
 * Protected Route
 * 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // 로그인 후 원래 가려던 경로로 돌아갈 수 있도록 state로 전달
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
