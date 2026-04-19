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
const filesToCopy = [
    'open-hangul-ai.es.js',
    'open-hangul-ai.umd.js',
    'open-hangul-ai.css',
];

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
    fs.copyFileSync(
        path.join(distDir, file),
        path.join(packageDir, file)
    );
    console.log(`  ✓ ${file}`);
    copiedCount++;
}

// 4. package.json 복사 및 수정
const distPackageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'dist-package.json'), 'utf-8')
);
fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
);
console.log('  ✓ package.json');

// 5. README 생성
const readme = `# HAN-View React

> Professional HWPX (Hancom Word Processor XML) Viewer & AI Document Editor for React

## 📦 설치

\`\`\`bash
npm install hanview-react
\`\`\`

## 🚀 빠른 시작

\`\`\`tsx
import { HWPXViewer } from 'hanview-react';
import 'hanview-react/styles';

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
        onDocumentLoad={(viewer) => console.log('문서 로드 완료!')}
      />
    </div>
  );
}
\`\`\`

## ✨ 주요 기능

- 📄 HWPX 파일 파싱 및 렌더링
- ✏️ 인라인 편집 (테이블 셀, 텍스트)
- 🤖 AI 문서 편집 (GPT-4 연동)
- 💾 HWPX 저장 / PDF 내보내기
- 🔍 검색 기능 (Ctrl+F)
- ⏪ 실행취소/다시실행 (Ctrl+Z/Y)
- 🎨 다크/라이트 테마

## ⌨️ 단축키

| 단축키 | 기능 |
|--------|------|
| Ctrl+O | 파일 열기 |
| Ctrl+S | 저장 |
| Ctrl+P | 인쇄 |
| Ctrl+F | 검색 |
| Ctrl+Z | 실행취소 |
| Ctrl+Y | 다시실행 |

## 📋 Props

| Prop | 타입 | 설명 |
|------|------|------|
| file | File \\| null | 열 HWPX 파일 |
| enableAI | boolean | AI 기능 활성화 (기본: true) |
| onDocumentLoad | (viewer) => void | 문서 로드 완료 콜백 |
| onError | (error) => void | 에러 콜백 |
| className | string | 추가 CSS 클래스 |

## 📄 라이선스

**상업용 라이센스 (Commercial License)**

본 소프트웨어는 상업용 라이센스로 제공됩니다.  
사용을 위해서는 라이센스 구매가 필요합니다.

### 라이센스 종류
- **개인/소규모**: 1개 프로젝트, 최대 5명 개발자
- **기업**: 무제한 프로젝트, 무제한 개발자, 우선 지원

### 라이센스 구매 문의
- 📧 Email: license@ism-team.com
- 🌐 Website: https://ism-team.com
- 📞 전화: 지원 센터 문의

---

© ${new Date().getFullYear()} ISM Team. All Rights Reserved.
`;

fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
console.log('  ✓ README.md');

// 6. LICENSE 생성 (상업용 라이센스)
const commercialLicense = `HAN-View React - 상업용 라이센스
Copyright (c) ${new Date().getFullYear()} ISM Team
All Rights Reserved.

본 소프트웨어는 상업용 라이센스로 제공됩니다.

1. 라이센스 부여
   본 소프트웨어 및 관련 문서 파일("소프트웨어")는 ISM Team의 독점 재산입니다.
   정당한 라이센스를 구매한 개인 또는 조직에게만 사용 권한이 부여됩니다.

2. 사용 권한
   - 라이센스를 구매한 경우, 본인 또는 본인의 조직 내에서 소프트웨어를 사용할 수 있습니다.
   - 라이센스는 상업적 목적을 포함한 모든 용도로 사용 가능합니다.
   - 최종 제품에 통합하여 배포할 수 있습니다.

3. 제한 사항
   - 소프트웨어의 소스 코드를 재배포할 수 없습니다.
   - 소프트웨어를 단독 제품으로 재판매할 수 없습니다.
   - 라이센스는 양도할 수 없습니다.
   - 리버스 엔지니어링, 디컴파일, 디스어셈블을 금지합니다.

4. 라이센스 종류
   a) 개인/소규모 라이센스
      - 1개 프로젝트 또는 제품에 사용
      - 개발자 최대 5명까지
      
   b) 기업 라이센스
      - 무제한 프로젝트 및 제품
      - 개발자 무제한
      - 우선 기술 지원

5. 지원 및 업데이트
   - 1년간 무료 업데이트 제공
   - 라이센스 구매자에게 기술 지원 제공
   - 주요 버전 업그레이드는 별도 비용 발생 가능

6. 보증 부인
   본 소프트웨어는 "있는 그대로" 제공되며, 명시적이든 묵시적이든 어떠한 종류의 
   보증도 제공하지 않습니다. 상품성, 특정 목적에의 적합성 및 비침해에 대한 
   묵시적 보증을 포함하되 이에 국한되지 않습니다.

7. 책임의 제한
   ISM Team은 계약, 불법 행위 또는 기타 어떠한 경우에도 본 소프트웨어의 사용 또는 
   사용 불능으로 인해 발생하는 직접적, 간접적, 우발적, 특수, 징벌적 또는 결과적 
   손해에 대해 책임을 지지 않습니다.

8. 라이센스 위반
   본 라이센스 조항을 위반할 경우, 모든 권한이 즉시 종료되며 법적 조치를 
   취할 수 있습니다.

9. 연락처
   라이센스 구매 및 문의:
   - 이메일: license@ism-team.com
   - 웹사이트: https://ism-team.com
   - 전화: 지원 센터 문의

본 라이센스는 대한민국 법률에 따라 규율되고 해석됩니다.

라이센스 구매 없이 본 소프트웨어를 사용하는 것은 불법입니다.
정당한 라이센스 구매를 위해 위의 연락처로 문의하시기 바랍니다.
`;
    fs.writeFileSync(path.join(packageDir, 'LICENSE'), commercialLicense);
    console.log('  ✓ LICENSE (상업용)');

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

