/**
 * HAN-View React App
 * 라우팅 기반 멀티페이지 구조
 *
 * @version 4.0.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import CookieConsent from './components/CookieConsent';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PricingPage from './pages/PricingPage';
import EditorPage from './pages/EditorPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentFailPage from './pages/PaymentFailPage';
import LegalPage from './pages/LegalPages';
import AdminDashboard from './pages/AdminDashboard';

// Styles
import './App.css';
import './styles/hangul-toolbar.css';

/**
 * 라우트 변경 시 body 클래스 자동 정리 (안전망)
 * EditorPage cleanup이 누락되더라도 다른 페이지로 이동하면 editor-mode 해제
 */
function RouteCleanup() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/editor') {
      document.body.classList.remove('editor-mode');
    }
  }, [location.pathname]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <RouteCleanup />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: '#363636', color: '#fff' },
            success: { duration: 2000, iconTheme: { primary: '#4ade80', secondary: '#fff' } },
            error: { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/fail" element={<PaymentFailPage />} />
          <Route path="/legal/:type" element={<LegalPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/editor" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CookieConsent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
