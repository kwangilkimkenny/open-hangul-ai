/**
 * Vite Library Build Configuration
 * NPM 패키지 배포용 빌드 설정
 * 
 * 사용법: npm run build:lib
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react({
      // JSX runtime을 automatic으로 사용
      jsxRuntime: 'automatic',
    }),
    // TypeScript 타입 정의 파일 생성
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/lib/**/*', 'src/components/**/*', 'src/types/**/*', 'src/contexts/**/*'],
      copyDtsFiles: true,
      staticImport: true,
      aliasesExclude: [/^@\//],
    }),
  ],
  
  build: {
    // 라이브러리 모드
    lib: {
      entry: resolve(__dirname, 'src/lib/index.ts'),
      name: 'HanViewReact',
      formats: ['es', 'umd'],
      fileName: (format) => `hanview-react.${format}.js`,
    },
    
    // 외부 의존성 (번들에 포함하지 않음)
    rollupOptions: {
      external: (id) => {
        // React 관련 모든 모듈을 외부로 처리
        if (id === 'react' || id === 'react-dom' || id.startsWith('react/') || id.startsWith('react-dom/')) {
          return true;
        }
        if (id === 'react-hot-toast') {
          return true;
        }
        return false;
      },
      output: {
        // 글로벌 변수 매핑 (UMD 빌드용)
        globals: {
          'react': 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'React',
          'react/jsx-dev-runtime': 'React',
          'react-hot-toast': 'toast',
        },
        // CSS 별도 파일로 추출
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'hanview-react.css';
          }
          return assetInfo.name || 'assets/[name]-[hash][extname]';
        },
      },
    },
    
    // 출력 디렉토리
    outDir: 'dist',
    
    // 소스맵 (디버깅용, 배포 시 제거 가능)
    sourcemap: false,
    
    // 미니파이 설정 (난독화)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,     // 디버깅을 위해 console 유지
        drop_debugger: true,     // debugger 제거
        pure_funcs: [],          // 디버깅을 위해 비활성화
      },
      mangle: {
        toplevel: true,          // 최상위 변수명 난독화
        properties: {
          regex: /^_/,           // _ 로 시작하는 프로퍼티만 난독화
        },
      },
      format: {
        comments: false,         // 주석 제거
      },
    },
    
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 2000,
    
    // CSS 코드 분할 비활성화 (단일 파일로)
    cssCodeSplit: false,
  },
  
  // CSS 설정
  css: {
    // CSS 모듈 설정
    modules: {
      localsConvention: 'camelCase',
    },
  },
  
  // 리졸브 설정
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

