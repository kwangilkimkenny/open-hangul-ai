/**
 * Vite Config - HanView Enterprise Edition
 * Copyright (c) 2026 HanView Team
 * Commercial License Only
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.*', 'packages-aegis/**/*', 'TruthAnchor-core/**/*']
    }),
  ],

  define: {
    __HANVIEW_EDITION__: JSON.stringify('enterprise'),
    __HANVIEW_VERSION__: JSON.stringify('5.0.0'),
    __AEGIS_AVAILABLE__: true,
    __TRUTHANCHOR_AVAILABLE__: true,
    __ANALYTICS_ENABLED__: true,
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },

  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/lib/enterprise-index.ts'),
        react: resolve(__dirname, 'src/components/enterprise-react.tsx'),
      },
      name: 'HanViewEnterprise',
      fileName: (format, entryName) => `hanview-enterprise${entryName === 'index' ? '' : `.${entryName}`}.${format}.js`,
      formats: ['es', 'umd']
    },

    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@hanview/aegis-binary',
        '@hanview/truthanchor-binary'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          '@hanview/aegis-binary': 'AegisBinary',
          '@hanview/truthanchor-binary': 'TruthAnchorBinary'
        },
        // 라이센스 헤더 추가
        banner: `/**
 * HanView Enterprise Edition v5.0.0
 * Copyright (c) 2026 HanView Team
 *
 * Commercial License - Authorized Use Only
 * This software contains proprietary security and verification modules.
 *
 * Support: enterprise@hanview.ai
 * License: license@hanview.ai
 */`,
      },
    },

    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      format: {
        comments: false,
        // 라이센스 정보는 유지
        preserve_annotations: true
      }
    }
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@hanview/community': resolve(__dirname, 'src')
    }
  },

  server: {
    port: 3001,
    cors: true
  },

  preview: {
    port: 4174
  }
});