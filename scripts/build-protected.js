#!/usr/bin/env node
/**
 * 보호된 모듈 빌드 스크립트
 * AEGIS/TruthAnchor 코드를 바이너리로 변환하여 보호
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BUILD_MODES = {
  OPENSOURCE: 'opensource',    // 인터페이스만 포함
  PRODUCTION: 'production',    // 바이너리 모듈 포함
  DEVELOPMENT: 'development'   // 소스코드 직접 사용
};

async function buildProtectedModules(mode = BUILD_MODES.OPENSOURCE) {
  console.log(`🔨 Building in ${mode} mode...`);

  switch (mode) {
    case BUILD_MODES.OPENSOURCE:
      await buildOpenSourceVersion();
      break;
    case BUILD_MODES.PRODUCTION:
      await buildProductionVersion();
      break;
    case BUILD_MODES.DEVELOPMENT:
      await buildDevelopmentVersion();
      break;
  }
}

async function buildOpenSourceVersion() {
  console.log('📦 Building Open Source version (interfaces only)...');

  // 1. 인터페이스와 로더만 포함
  const sourceDirs = [
    'src/lib/ai/protected/interfaces.ts',
    'src/lib/ai/protected/loader.ts'
  ];

  // 2. AEGIS SDK 제외
  await excludeDirectories([
    'packages-aegis/',
    'TruthAnchor-core/'
  ]);

  // 3. Mock 구현체 생성 (테스트/개발용)
  await generateMockModules();

  // 4. 오픈소스 README 생성
  await generateOpenSourceReadme();

  console.log('✅ Open Source build complete');
}

async function buildProductionVersion() {
  console.log('🏭 Building Production version (with binaries)...');

  // 1. AEGIS SDK → WASM 컴파일
  await compileAEGISToWASM();

  // 2. TruthAnchor → WASM 컴파일
  await compileTruthAnchorToWASM();

  // 3. 바이너리들을 lib/ 폴더에 배치
  await copyBinariesToLib();

  // 4. 소스코드 제거 (바이너리만 유지)
  await removeSourceCode();

  console.log('✅ Production build complete');
}

async function buildDevelopmentVersion() {
  console.log('🔧 Building Development version...');

  // 개발 모드에서는 소스코드 직접 사용
  // 단지 인터페이스 통일만 수행
  console.log('✅ Development build complete');
}

async function compileAEGISToWASM() {
  console.log('🔄 Compiling AEGIS to WebAssembly...');

  try {
    // Method 1: TypeScript → JavaScript → WASM (Emscripten 사용)
    execSync('npx tsc packages-aegis/aegis-sdk/src/index.ts --outDir temp/aegis-js');
    execSync('emcc temp/aegis-js/index.js -o dist/lib/aegis.wasm -s WASM=1 -s EXPORTED_FUNCTIONS="[\'_scan\', \'_configure\']"');

    // Method 2: 또는 AssemblyScript 사용
    // execSync('npx asc packages-aegis/aegis-sdk/src/index.ts -o dist/lib/aegis.wasm');

    console.log('✅ AEGIS compiled to WASM');
  } catch (error) {
    console.warn('⚠️ WASM compilation failed, using obfuscated JS fallback');
    await obfuscateJavaScript('packages-aegis/', 'dist/lib/aegis-obfuscated.js');
  }
}

async function compileTruthAnchorToWASM() {
  console.log('🔄 Compiling TruthAnchor to WebAssembly...');

  try {
    // Python → WASM (Pyodide 또는 직접 변환)
    execSync('python scripts/compile-truthanchor-to-wasm.py');
    console.log('✅ TruthAnchor compiled to WASM');
  } catch (error) {
    console.warn('⚠️ TruthAnchor WASM compilation failed, using API fallback');
  }
}

async function obfuscateJavaScript(sourceDir, outputFile) {
  console.log(`🔐 Obfuscating ${sourceDir}...`);

  // JavaScript Obfuscator 사용
  execSync(`npx javascript-obfuscator ${sourceDir} --output ${outputFile} --compact true --control-flow-flattening true --dead-code-injection true --debug-protection true --string-array true`);
}

async function excludeDirectories(dirs) {
  console.log('🚫 Excluding protected directories...');

  // .gitignore 업데이트 또는 별도 빌드 디렉토리 생성
  const gitignoreContent = `
# Protected modules (not included in open source)
${dirs.join('\n')}

# Binary modules
lib/*.wasm
lib/*.node
*.dll
*.so
*.dylib
`;

  await fs.promises.writeFile('.gitignore-opensource', gitignoreContent);
}

async function generateMockModules() {
  console.log('🎭 Generating mock modules for testing...');

  const mockAEGIS = `
/**
 * Mock AEGIS implementation for open source development
 * Real implementation available with commercial license
 */
export class MockAEGIS {
  async scan(input) {
    console.warn('Using mock AEGIS - install commercial module for full protection');
    return {
      allowed: true,
      score: 0,
      reason: 'Mock implementation',
      categories: [],
      blocked: false
    };
  }

  configure(config) {
    console.log('Mock AEGIS configured:', config);
  }
}
`;

  await fs.promises.writeFile('src/lib/ai/protected/mocks.ts', mockAEGIS);
}

async function generateOpenSourceReadme() {
  const readme = `
# HanView - Open Source Document Viewer

## 🚀 Features

### Open Source Features
- ✅ Multi-format document viewing (HWPX, DOCX, PDF, etc.)
- ✅ Universal LLM integration (OpenAI, Claude, Gemini, etc.)
- ✅ Document editing and annotation
- ✅ Export capabilities
- ✅ Plugin system

### Enterprise Features (Commercial License)
- 🔒 **AEGIS Security Module** - Advanced content filtering and PII protection
- 🔒 **TruthAnchor** - AI-powered fact verification and source validation
- 🔒 **Advanced Analytics** - Usage metrics and compliance reporting
- 🔒 **Priority Support** - Enterprise SLA and custom integrations

## 📦 Installation

### Community Edition (Free)
\`\`\`bash
npm install hanview-opensource
\`\`\`

### Enterprise Edition
Contact sales@hanview.ai for commercial licensing.

## 🔧 Usage

### Basic Usage
\`\`\`typescript
import { HanViewEditor } from 'hanview-opensource';

const editor = new HanViewEditor({
  container: '#editor',
  features: {
    llm: true,           // ✅ Available
    security: false,     // 🔒 Enterprise only
    factCheck: false     // 🔒 Enterprise only
  }
});
\`\`\`

### With Enterprise Modules
\`\`\`typescript
import { HanViewEditor } from 'hanview-enterprise';

const editor = new HanViewEditor({
  container: '#editor',
  features: {
    llm: true,           // ✅ Available
    security: true,      // ✅ AEGIS protection
    factCheck: true      // ✅ TruthAnchor verification
  },
  license: 'your-enterprise-license-key'
});
\`\`\`

## 🤝 Contributing

We welcome contributions to the open source components! Please see CONTRIBUTING.md for guidelines.

## 📄 License

- **Open Source Components**: MIT License
- **Enterprise Modules**: Commercial License Required

## 💬 Support

- **Community Support**: GitHub Issues
- **Enterprise Support**: support@hanview.ai
`;

  await fs.promises.writeFile('README-opensource.md', readme);
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || BUILD_MODES.OPENSOURCE;
  buildProtectedModules(mode).catch(console.error);
}

export { buildProtectedModules, BUILD_MODES };