/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'OPENAI_'])
  const openaiApiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY

  return {
  plugins: [react()],
  resolve: {
    alias: {
      'hwplib-js': path.resolve(__dirname, 'hwpTohwpx/hpw2hwpx_converter/hwplib-js/dist/index.esm.js'),
      '@hwp2hwpx': path.resolve(__dirname, 'hwpTohwpx/hpw2hwpx_converter/hwp2hwpx-js/src'),
    },
  },
  server: {
    port: 5090,        // 고정 포트
    strictPort: true,  // 포트 사용 중이면 에러 발생 (자동 변경 안 함)
    proxy: {
      // OpenAI API 프록시 - CORS 우회 + API 키 서버사이드 관리
      '/api/ai/chat': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => '/v1/chat/completions',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (openaiApiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${openaiApiKey}`);
            }
          });
        },
      },
    },
  },
  preview: {
    port: 5090,        // 빌드 미리보기도 동일 포트
  },
  build: {
    // 번들 크기 최적화 설정
    chunkSizeWarningLimit: 500, // 500KB 경고 threshold
    rollupOptions: {
      output: {
        // Manual chunks로 번들 분리
        manualChunks: (id) => {
          // node_modules 의존성 분리
          if (id.includes('node_modules')) {
            // JSZip 우선 처리 (크기가 크므로 별도 분리)
            if (id.includes('jszip')) {
              return 'lib-jszip';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react-hot-toast') || id.includes('zustand')) {
              return 'vendor-ui';
            }
            // 기타 node_modules는 vendor로
            return 'vendor';
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
        drop_console: true,        // console.log 제거 (프로덕션)
        drop_debugger: true,        // debugger 제거
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // 특정 함수 제거
        passes: 2,                  // 최적화 패스 2회 실행
      },
      format: {
        comments: false,            // 주석 제거
      },
      mangle: {
        safari10: true,             // Safari 10 호환성
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
      include: ['src/lib/**/*.js', 'src/lib/**/*.ts', 'src/hooks/**/*.ts', 'src/components/**/*.tsx', 'src/stores/**/*.ts'],
    },
  },
  }
})
