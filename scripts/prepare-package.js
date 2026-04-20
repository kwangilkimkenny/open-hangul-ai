#!/usr/bin/env node

/**
 * 패키지 배포 준비 스크립트
 * 빌드된 파일을 배포용 폴더로 복사하고 package.json 생성
 *
 * 사용법: npm run package
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 배포 폴더
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(rootDir, 'hanview-react-dist');

console.log('📦 HAN-View React 패키지 준비 시작...\n');

// 1. 배포 폴더 생성
if (fs.existsSync(packageDir)) {
  fs.rmSync(packageDir, { recursive: true });
}
fs.mkdirSync(packageDir, { recursive: true });

console.log('✅ 배포 폴더 생성: hanview-react-dist/');

// 2. 빌드 파일 복사
const filesToCopy = ['open-hangul-ai.es.js', 'open-hangul-ai.umd.js', 'open-hangul-ai.css'];

let copiedCount = 0;
for (const file of filesToCopy) {
  const src = path.join(distDir, file);
  const dest = path.join(packageDir, file);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const size = (fs.statSync(dest).size / 1024).toFixed(2);
    console.log(`  ✓ ${file} (${size} KB)`);
    copiedCount++;
  } else {
    console.log(`  ⚠ ${file} 없음 (빌드 확인 필요)`);
  }
}

// 3. TypeScript 타입 정의 파일 복사
const dtsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.d.ts'));
for (const file of dtsFiles) {
  fs.copyFileSync(path.join(distDir, file), path.join(packageDir, file));
  console.log(`  ✓ ${file}`);
  copiedCount++;
}

// 4. package.json 생성 (배포용 메타데이터)
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const distPackageJson = {
  name: rootPkg.name,
  version: rootPkg.version,
  description: '오픈한글AI - Professional HWPX Viewer & AI Document Editor for React',
  author: rootPkg.author,
  license: rootPkg.license,
  private: false,
  keywords: rootPkg.keywords,
  homepage: rootPkg.homepage,
  repository: rootPkg.repository,
  bugs: {
    url: `${rootPkg.repository.url.replace(/\.git$/, '')}/issues`,
    email: 'ray.kim@yatavent.com',
  },
  main: './open-hangul-ai.umd.js',
  module: './open-hangul-ai.es.js',
  types: './open-hangul-ai.es.d.ts',
  exports: {
    '.': {
      import: './open-hangul-ai.es.js',
      require: './open-hangul-ai.umd.js',
      types: './open-hangul-ai.es.d.ts',
    },
    './styles': './open-hangul-ai.css',
    './css': './open-hangul-ai.css',
  },
  files: [
    'open-hangul-ai.es.js',
    'open-hangul-ai.umd.js',
    'open-hangul-ai.css',
    'open-hangul-ai.es.d.ts',
    '*.d.ts',
  ],
  sideEffects: ['*.css'],
  peerDependencies: { react: '>=18.0.0', 'react-dom': '>=18.0.0' },
  peerDependenciesMeta: { 'react-hot-toast': { optional: true } },
  engines: { node: '>=16.0.0' },
};
fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(distPackageJson, null, 2));
console.log('  ✓ package.json');

// 5. README 생성
const readme = `# Open Hangul AI

Professional HWPX (Hancom Word Processor XML) Viewer & AI Document Editor for React

## Installation

\`\`\`bash
npm install open-hangul-ai
\`\`\`

## Quick Start

\`\`\`tsx
import { HWPXViewer } from 'open-hangul-ai';
import 'open-hangul-ai/css';

function App() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
  };

  return (
    <div style={{ height: '100vh' }}>
      <input type="file" accept=".hwpx" onChange={handleFileSelect} />
      <HWPXViewer
        file={file}
        enableAI={true}
        onDocumentLoad={(viewer) => console.log('Document loaded!')}
      />
    </div>
  );
}
\`\`\`

## Features

- HWPX file parsing and rendering
- Inline editing (table cells, text)
- AI document editing (GPT-4 integration)
- HWPX save / PDF export
- Search functionality (Ctrl+F)
- Undo/Redo (Ctrl+Z/Y)
- Dark/Light theme

## Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| Ctrl+O | Open file |
| Ctrl+S | Save |
| Ctrl+P | Print |
| Ctrl+F | Search |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |

## Props

| Prop | Type | Description |
|------|------|-------------|
| file | File \\| null | HWPX file to open |
| enableAI | boolean | Enable AI features (default: true) |
| onDocumentLoad | (viewer) => void | Document load complete callback |
| onError | (error) => void | Error callback |
| className | string | Additional CSS class |

## License

MIT License

This package is available under the MIT license for open source use.

## Support

- **Documentation**: [Official Documentation](https://kwangilkimkenny.github.io/open-hangul-ai/)
- **Issues**: [GitHub Issues](https://github.com/kwangilkimkenny/open-hangul-ai/issues)
- **Email**: yatav@yatavent.com

---

Copyright (c) ${new Date().getFullYear()} YATAV Team.
`;

fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
console.log('  ✓ README.md');

// 6. LICENSE 복사 (MIT)
const rootLicensePath = path.join(rootDir, 'LICENSE');
if (fs.existsSync(rootLicensePath)) {
  fs.copyFileSync(rootLicensePath, path.join(packageDir, 'LICENSE'));
  console.log('  ✓ LICENSE (MIT)');
} else {
  console.log('  ⚠ LICENSE 없음 (루트 LICENSE 파일을 확인하세요)');
}

// 7. 결과 출력
console.log('\n' + '='.repeat(50));
console.log('✅ 패키지 준비 완료!');
console.log('='.repeat(50));
console.log(`\n📁 위치: ${packageDir}`);

// 폴더 내용 출력
const files = fs.readdirSync(packageDir);
console.log('\n📄 포함된 파일:');
files.forEach(file => {
  const stats = fs.statSync(path.join(packageDir, file));
  const size = (stats.size / 1024).toFixed(2);
  console.log(`   ${file} (${size} KB)`);
});

console.log('\n🚀 배포 명령:');
console.log('   cd hanview-react-dist');
console.log('   npm publish');
console.log('   # 또는 비공개: npm publish --access restricted');

console.log('\n📦 로컬 테스트:');
console.log('   cd hanview-react-dist');
console.log('   npm link');
console.log('   # 다른 프로젝트에서:');
console.log('   npm link hanview-react');
console.log('');
