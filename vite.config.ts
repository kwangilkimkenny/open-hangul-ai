/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'OPENAI_']);
  const openaiApiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@aegis-sdk': path.resolve(__dirname, 'src/lib/mocks/aegis-enterprise.ts'),
        '@hanview/aegis-enterprise': path.resolve(__dirname, 'src/lib/mocks/aegis-enterprise.ts'),
      },
    },
    server: {
      port: 5090, // 고정 포트
      strictPort: true, // 포트 사용 중이면 에러 발생 (자동 변경 안 함)
      headers: {
        // HTTP 헤더로만 유효한 보안 헤더 (meta 태그로는 무시됨)
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'no-referrer-when-downgrade',
        'Permissions-Policy':
          'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
      },
      proxy: {
        // HWPX Generator 프록시 — Python zipfile로 한글 호환 ZIP 생성
        '/api/generate-hwpx': {
          target: 'http://localhost:8300',
          changeOrigin: true,
        },
        // TruthAnchor (HalluGuard) 프록시 - 할루시네이션 검증 서버
        '/api/v2': {
          target: 'http://localhost:8200',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:8200',
          changeOrigin: true,
        },
        // OpenAI API 프록시 - CORS 우회 + API 키 서버사이드 관리
        '/api/ai/chat': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: () => '/v1/chat/completions',
          configure: proxy => {
            proxy.on('proxyReq', proxyReq => {
              if (openaiApiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${openaiApiKey}`);
              }
            });
          },
        },
      },
    },
    preview: {
      port: 5090, // 빌드 미리보기도 동일 포트
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'no-referrer-when-downgrade',
        'Permissions-Policy':
          'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net blob:; worker-src 'self' blob:; child-src 'self' blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' https://api.openai.com https://cdn.jsdelivr.net; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
      },
    },
    build: {
      // 번들 크기 최적화 설정
      chunkSizeWarningLimit: 500, // 500KB 경고 threshold
      rollupOptions: {
        output: {
          // Manual chunks로 번들 분리 (v4.0 최적화)
          manualChunks: id => {
            // node_modules 의존성 분리
            if (id.includes('node_modules')) {
              // === 무거운 단일 라이브러리 (lazy loaded 권장) ===
              if (id.includes('jszip')) return 'lib-jszip';
              if (id.includes('pdfjs-dist')) return 'lib-pdfjs';
              if (id.includes('tesseract.js')) return 'lib-tesseract';
              if (id.includes('html2canvas')) return 'lib-html2canvas';
              if (id.includes('jspdf')) return 'lib-jspdf';
              if (id.includes('katex')) return 'lib-katex';
              if (id.includes('@tosspayments')) return 'lib-toss';

              // === 문서 변환 라이브러리 (분리) ===
              if (id.includes('node_modules/docx/')) return 'lib-docx';
              if (id.includes('exceljs')) return 'lib-exceljs';
              if (id.includes('node_modules/xlsx/')) return 'lib-xlsx';

              // === Supabase (lazy loaded — 듀얼 모드) ===
              if (
                id.includes('@supabase/supabase-js') ||
                id.includes('@supabase/auth') ||
                id.includes('@supabase/postgrest') ||
                id.includes('@supabase/storage') ||
                id.includes('@supabase/realtime') ||
                id.includes('@supabase/functions')
              ) {
                return 'lib-supabase';
              }

              // === React 코어 ===
              if (
                id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('scheduler')
              ) {
                return 'vendor-react';
              }

              // === React Router (별도 분리) ===
              if (id.includes('react-router')) return 'vendor-router';

              // === UI 라이브러리 ===
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('react-hot-toast') || id.includes('zustand')) return 'vendor-ui';

              // === 기타 ===
              return 'vendor';
            }

            // AI 보안 모듈 (별도 청크)
            if (
              id.includes('/lib/vanilla/ai/security-gateway') ||
              id.includes('/lib/vanilla/ai/truthanchor-client')
            ) {
              return 'feature-security';
            }

            // AI 기능 (선택적 기능)
            if (id.includes('/lib/vanilla/ai/')) {
              return 'feature-ai';
            }

            // Export 기능
            if (id.includes('/lib/vanilla/export/')) {
              return 'feature-export';
            }

            // UI Editors (lazy loaded)
            if (
              id.includes('/lib/vanilla/features/image-editor.js') ||
              id.includes('/lib/vanilla/features/shape-editor.js')
            ) {
              return 'feature-ui-editors';
            }

            // Vanilla JS 코어 (viewer, renderer, parser)
            if (
              id.includes('/lib/vanilla/core/') ||
              id.includes('/lib/vanilla/viewer.js') ||
              id.includes('/lib/vanilla/features/')
            ) {
              return 'core-viewer';
            }

            // Vanilla JS 유틸리티
            if (id.includes('/lib/vanilla/utils/')) {
              return 'core-utils';
            }

            // Vanilla JS UI
            if (id.includes('/lib/vanilla/ui/')) {
              return 'feature-ui';
            }
          },

          // 더 작은 chunks로 분리
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },

      // Minification 최적화
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // console.log 제거 (프로덕션)
          drop_debugger: true, // debugger 제거
          pure_funcs: ['console.log', 'console.info', 'console.debug'], // 특정 함수 제거
          passes: 2, // 최적화 패스 2회 실행
        },
        format: {
          comments: false, // 주석 제거
        },
        mangle: {
          safari10: true, // Safari 10 호환성
        },
      },

      // 소스맵 (프로덕션에서는 hidden)
      sourcemap: false, // 프로덕션에서 소스맵 비활성화로 크기 절감
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'src/lib/**/*.js',
          'src/lib/**/*.ts',
          'src/hooks/**/*.ts',
          'src/components/**/*.tsx',
          'src/stores/**/*.ts',
        ],
      },
    },
  };
});
