/**
 * HAN-View React Application Entry Point
 *
 * @version 1.0.0
 */

import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  // StrictMode는 개발 모드에서 컴포넌트를 2번 렌더링합니다
  // Vanilla Viewer와 함께 사용 시 불필요한 초기화가 발생하므로 비활성화
  <App />
);
