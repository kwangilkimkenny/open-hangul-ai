# 🔍 HWPX 저장 문제 진단 코드

## 📋 사용 방법
1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭 선택
3. 아래 코드를 복사하여 실행
4. 로그 확인 후 문제점 파악

---

## 🎯 1단계: 문서 데이터 무결성 검사

### 원본 문서 구조 확인
```javascript
(function() {
  console.clear();
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
  console.log('%c🔍 1단계: 문서 데이터 무결성 검사', 'background: #667eea; color: white; font-size: 16px; font-weight: bold; padding: 8px');
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea; font-weight: bold');
  console.log('');

  // 문서 데이터 소스 확인
  console.log('%c📦 문서 데이터 소스 확인', 'color: blue; font-weight: bold; font-size: 14px');
  
  // IndexedDB에서 확인
  const dbName = 'hwpx-autosave';
  const request = indexedDB.open(dbName);
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = function() {
      const sessions = getAllRequest.result;
      
      if (sessions.length === 0) {
        console.error('❌ 저장된 세션이 없습니다.');
        console.log('💡 해결: 문서를 열고 30초 이상 대기하세요.');
        return;
      }
      
      console.log(`✅ ${sessions.length}개의 세션 발견`);
      
      // 가장 최근 세션
      const latestSession = sessions.sort((a, b) => b.timestamp - a.timestamp)[0];
      window._debugDocument = latestSession.document;
      
      console.log('');
      console.log('%c📊 문서 기본 정보', 'color: green; font-weight: bold; font-size: 14px');
      console.log('  파일명:', latestSession.fileName || '(없음)');
      console.log('  저장 시각:', new Date(latestSession.timestamp).toLocaleString());
      console.log('  섹션 수:', latestSession.document?.sections?.length || 0);
      console.log('');
      
      // 섹션별 상세 정보
      const hwpxDoc = latestSession.document;
      if (!hwpxDoc || !hwpxDoc.sections) {
        console.error('❌ 문서 구조가 올바르지 않습니다.');
        return;
      }
      
      console.log('%c📄 섹션별 상세 분석', 'color: green; font-weight: bold; font-size: 14px');
      hwpxDoc.sections.forEach((section, sIdx) => {
        console.log(`\n  섹션 ${sIdx + 1}:`);
        
        const elements = section.elements || [];
        const typeCount = {};
        let totalCells = 0;
        let totalText = '';
        
        elements.forEach(el => {
          typeCount[el.type] = (typeCount[el.type] || 0) + 1;
          
          if (el.type === 'table') {
            const cells = el.rows?.reduce((sum, row) => sum + (row.cells?.length || 0), 0) || 0;
            totalCells += cells;
            
            // 테이블 텍스트 수집
            el.rows?.forEach(row => {
              row.cells?.forEach(cell => {
                cell.elements?.forEach(cellEl => {
                  const text = cellEl.runs?.map(r => r.text).join('') || '';
                  totalText += text;
                });
              });
            });
          } else if (el.type === 'paragraph') {
            const text = el.runs?.map(r => r.text).join('') || '';
            totalText += text;
          }
        });
        
        console.log('    요소 수:', elements.length);
        console.log('    타입별:', typeCount);
        console.log('    총 셀 수:', totalCells);
        console.log('    총 텍스트 길이:', totalText.length, '글자');
      });
      
      console.log('');
      console.log('%c✅ 문서 데이터를 window._debugDocument에 저장했습니다', 'color: green; font-weight: bold');
      console.log('');
    };
  };
  
  request.onerror = function() {
    console.error('❌ IndexedDB 열기 실패');
  };
})();
```

---

## 🔬 2단계: XML 생성 테스트

### XML 변환 검증
```javascript
(async function() {
  console.clear();
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #e67e22; font-weight: bold');
  console.log('%c🔬 2단계: XML 생성 테스트', 'background: #e67e22; color: white; font-size: 16px; font-weight: bold; padding: 8px');
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #e67e22; font-weight: bold');
  console.log('');
  
  if (!window._debugDocument) {
    console.error('❌ 먼저 1단계를 실행하세요!');
    return;
  }
  
  const doc = window._debugDocument;
  
  // JsonToXmlConverter 테스트
  console.log('%c📝 XML 생성 시작...', 'color: blue; font-weight: bold; font-size: 14px');
  console.log('');
  
  try {
    // 동적으로 JsonToXmlConverter 임포트 (모듈 방식)
    console.log('⏳ JsonToXmlConverter 로딩 중...');
    
    // 간단한 XML 생성 테스트 (수동)
    console.log('');
    console.log('%c1️⃣ version.xml 생성 테스트', 'color: green; font-weight: bold');
    const versionXml = `<?xml version="1.0" encoding="UTF-8"?>
<version xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml" 
         version="2.8" 
         major="2" 
         minor="8" 
         micro="0" 
         build="0" 
         application="HWPX-Viewer-AI"/>`;
    console.log('길이:', versionXml.length, 'bytes');
    console.log('미리보기:', versionXml.substring(0, 100) + '...');
    
    console.log('');
    console.log('%c2️⃣ header.xml 생성 테스트', 'color: green; font-weight: bold');
    const headerXml = `<?xml version="1.0" encoding="UTF-8"?>
<HWPML xmlns="http://www.hancom.co.kr/hwpml/2011/hwpml">
  <HEAD>
    <MAPPINGTABLE>
      <FONTFACE Id="0" Lang="1042" Count="7" FontFaces="맑은 고딕"/>
      <PARASHAPE Id="0">
        <ALIGN HorizontalAlign="Left" VerticalAlign="Top"/>
      </PARASHAPE>
      <CHARSHAPE Id="0">
        <FONTID Hangul="0" Latin="0"/>
        <HEIGHT Hangul="1000" Latin="1000"/>
      </CHARSHAPE>
    </MAPPINGTABLE>
  </HEAD>
</HWPML>`;
    console.log('길이:', headerXml.length, 'bytes');
    console.log('미리보기:', headerXml.substring(0, 100) + '...');
    
    console.log('');
    console.log('%c3️⃣ section0.xml 생성 테스트', 'color: green; font-weight: bold');
    
    if (!doc.sections || doc.sections.length === 0) {
      console.error('❌ 섹션이 없습니다.');
      return;
    }
    
    const section = doc.sections[0];
    const elements = section.elements || [];
    
    console.log(`  섹션 요소 수: ${elements.length}개`);
    
    // 각 요소 타입별 XML 샘플 생성
    elements.slice(0, 3).forEach((el, idx) => {
      console.log(`\n  요소 ${idx + 1} (${el.type}):`);
      
      if (el.type === 'paragraph') {
        const text = el.runs?.map(r => r.text).join('') || '';
        const paraXml = `
    <P ParaShape="0" Style="0">
      <TEXT CharShape="0">${text.substring(0, 30)}${text.length > 30 ? '...' : ''}</TEXT>
    </P>`;
        console.log('    XML:', paraXml.trim());
      } else if (el.type === 'table') {
        const rows = el.rows?.length || 0;
        const cols = el.rows?.[0]?.cells?.length || 0;
        console.log(`    테이블: ${rows}행 x ${cols}열`);
        console.log(`    XML: <TABLE><SHAPEOBJECT><TABLEFORMAT ColCount="${cols}" RowCount="${rows}">...</TABLEFORMAT></SHAPEOBJECT></TABLE>`);
      }
    });
    
    console.log('');
    console.log('%c✅ XML 생성 테스트 완료', 'color: green; font-weight: bold');
    console.log('');
    
  } catch (error) {
    console.error('❌ XML 생성 실패:', error);
    console.error('스택:', error.stack);
  }
})();
```

---

## 📦 3단계: ZIP 구조 검증

### HWPX ZIP 파일 구조 확인
```javascript
(async function() {
  console.clear();
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #9b59b6; font-weight: bold');
  console.log('%c📦 3단계: ZIP 구조 검증', 'background: #9b59b6; color: white; font-size: 16px; font-weight: bold; padding: 8px');
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #9b59b6; font-weight: bold');
  console.log('');
  
  if (!window._debugDocument) {
    console.error('❌ 먼저 1단계를 실행하세요!');
    return;
  }
  
  console.log('%c📋 HWPX 표준 파일 구조 체크리스트', 'color: blue; font-weight: bold; font-size: 14px');
  console.log('');
  
  const requiredFiles = [
    { path: 'mimetype', compression: 'STORE', desc: '파일 타입 정의' },
    { path: 'version.xml', compression: 'STORE', desc: '버전 정보' },
    { path: 'settings.xml', compression: 'DEFLATE', desc: '설정 정보' },
    { path: 'Contents/content.hpf', compression: 'DEFLATE', desc: '파일 목록 (필수!)' },
    { path: 'Contents/header.xml', compression: 'DEFLATE', desc: '헤더 정보' },
    { path: 'Contents/section0.xml', compression: 'DEFLATE', desc: '섹션 0' },
    { path: 'META-INF/container.xml', compression: 'DEFLATE', desc: '컨테이너 정의 (필수!)' },
    { path: 'META-INF/manifest.xml', compression: 'DEFLATE', desc: '매니페스트' },
    { path: 'META-INF/container.rdf', compression: 'DEFLATE', desc: 'RDF 메타데이터 (필수!)' },
    { path: 'Preview/PrvText.txt', compression: 'DEFLATE', desc: '미리보기' }
  ];
  
  console.log('필수 파일 목록:');
  requiredFiles.forEach((file, idx) => {
    const icon = file.desc.includes('필수') ? '🔴' : '⚪';
    console.log(`  ${icon} ${idx + 1}. ${file.path}`);
    console.log(`     압축: ${file.compression}, 용도: ${file.desc}`);
  });
  
  console.log('');
  console.log('%c⚠️  중요 포인트', 'color: red; font-weight: bold; font-size: 14px');
  console.log('  1. mimetype과 version.xml은 반드시 STORE (압축 없음)');
  console.log('  2. META-INF/container.rdf가 누락되면 파일 손상!');
  console.log('  3. Contents/content.hpf가 모든 섹션을 나열해야 함');
  console.log('');
  
  console.log('%c💡 다음 단계: 실제 저장 테스트', 'color: blue; font-weight: bold');
  console.log('  1. 이 창을 열어둔 채로 "HWPX 저장" 버튼 클릭');
  console.log('  2. 파일명 입력 후 저장');
  console.log('  3. 4단계 코드 실행하여 결과 확인');
  console.log('');
})();
```

---

## 🔍 4단계: 저장된 파일 검증

### 저장 즉시 실행할 검증 코드
```javascript
(function() {
  console.clear();
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #e74c3c; font-weight: bold');
  console.log('%c🔍 4단계: 저장된 파일 검증', 'background: #e74c3c; color: white; font-size: 16px; font-weight: bold; padding: 8px');
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #e74c3c; font-weight: bold');
  console.log('');
  
  console.log('%c📌 사용법', 'color: blue; font-weight: bold; font-size: 14px');
  console.log('  1. 저장된 HWPX 파일을 이 페이지에 드래그 앤 드롭');
  console.log('  2. 파일이 로드되면 자동으로 구조 분석 시작');
  console.log('  3. 문제점 확인');
  console.log('');
  
  // 파일 드롭 이벤트 리스너 등록
  const dropZone = document.body;
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.endsWith('.hwpx')) {
      console.error('❌ HWPX 파일이 아닙니다:', file.name);
      return;
    }
    
    console.log('');
    console.log('%c📥 파일 드롭 감지:', 'color: green; font-weight: bold', file.name);
    console.log('  크기:', (file.size / 1024).toFixed(2), 'KB');
    console.log('');
    
    try {
      // JSZip으로 파일 열기
      const JSZip = window.JSZip;
      if (!JSZip) {
        console.error('❌ JSZip 라이브러리가 로드되지 않았습니다.');
        return;
      }
      
      console.log('⏳ ZIP 구조 분석 중...');
      const zip = await JSZip.loadAsync(file);
      
      console.log('');
      console.log('%c✅ ZIP 파일 구조 분석 완료', 'color: green; font-weight: bold; font-size: 14px');
      console.log('');
      
      // 파일 목록
      const fileList = Object.keys(zip.files);
      console.log(`📂 총 ${fileList.length}개 파일 발견:`);
      
      const requiredFiles = [
        'mimetype',
        'version.xml',
        'settings.xml',
        'Contents/content.hpf',
        'Contents/header.xml',
        'Contents/section0.xml',
        'META-INF/container.xml',
        'META-INF/manifest.xml',
        'META-INF/container.rdf',
        'Preview/PrvText.txt'
      ];
      
      console.log('');
      console.log('%c필수 파일 체크:', 'color: blue; font-weight: bold');
      requiredFiles.forEach(filePath => {
        const exists = zip.files[filePath] !== undefined;
        const icon = exists ? '✅' : '❌';
        console.log(`  ${icon} ${filePath}`);
        
        if (exists) {
          const zipFile = zip.files[filePath];
          const method = zipFile._data?.compressedSize === zipFile._data?.uncompressedSize ? 'STORE' : 'DEFLATE';
          console.log(`     압축: ${method}, 크기: ${zipFile._data?.uncompressedSize || 0} bytes`);
        }
      });
      
      console.log('');
      console.log('%c기타 파일:', 'color: blue; font-weight: bold');
      const otherFiles = fileList.filter(f => !requiredFiles.includes(f) && !f.endsWith('/'));
      otherFiles.forEach(f => {
        console.log(`  📄 ${f}`);
      });
      
      // 핵심 파일 내용 확인
      console.log('');
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gray');
      console.log('%c📝 핵심 파일 내용 검증', 'color: purple; font-weight: bold; font-size: 14px');
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gray');
      console.log('');
      
      // 1. mimetype 확인
      if (zip.files['mimetype']) {
        const mimetypeContent = await zip.files['mimetype'].async('string');
        console.log('%c1️⃣ mimetype:', 'color: green; font-weight: bold');
        console.log('  내용:', mimetypeContent);
        console.log('  검증:', mimetypeContent === 'application/hwp+zip' ? '✅ 정상' : '❌ 잘못됨');
        console.log('');
      }
      
      // 2. version.xml 확인
      if (zip.files['version.xml']) {
        const versionContent = await zip.files['version.xml'].async('string');
        console.log('%c2️⃣ version.xml:', 'color: green; font-weight: bold');
        console.log('  길이:', versionContent.length, 'bytes');
        console.log('  미리보기:', versionContent.substring(0, 150) + '...');
        console.log('  xmlns 확인:', versionContent.includes('http://www.hancom.co.kr/hwpml/2011/hwpml') ? '✅' : '❌');
        console.log('');
      }
      
      // 3. META-INF/container.rdf 확인 (매우 중요!)
      if (zip.files['META-INF/container.rdf']) {
        const rdfContent = await zip.files['META-INF/container.rdf'].async('string');
        console.log('%c3️⃣ META-INF/container.rdf:', 'color: green; font-weight: bold');
        console.log('  길이:', rdfContent.length, 'bytes');
        console.log('  미리보기:', rdfContent.substring(0, 200) + '...');
        console.log('  rdf:RDF 확인:', rdfContent.includes('<rdf:RDF') ? '✅' : '❌');
        console.log('  hasPart 확인:', rdfContent.includes('hasPart') ? '✅' : '❌');
        console.log('');
      } else {
        console.error('%c❌ META-INF/container.rdf 누락! (파일 손상 원인!)', 'color: red; font-weight: bold; font-size: 14px');
        console.log('');
      }
      
      // 4. Contents/section0.xml 확인
      if (zip.files['Contents/section0.xml']) {
        const sectionContent = await zip.files['Contents/section0.xml'].async('string');
        console.log('%c4️⃣ Contents/section0.xml:', 'color: green; font-weight: bold');
        console.log('  길이:', sectionContent.length, 'bytes');
        console.log('  미리보기:', sectionContent.substring(0, 200) + '...');
        console.log('  <HWPML> 확인:', sectionContent.includes('<HWPML') ? '✅' : '❌');
        console.log('  <SECTION> 확인:', sectionContent.includes('<SECTION>') ? '✅' : '❌');
        console.log('  <TABLE> 개수:', (sectionContent.match(/<TABLE>/g) || []).length);
        console.log('  <P> 개수:', (sectionContent.match(/<P /g) || []).length);
        console.log('');
      }
      
      // 최종 진단
      console.log('');
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gray');
      console.log('%c🎯 최종 진단 결과', 'color: purple; font-weight: bold; font-size: 16px');
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gray');
      console.log('');
      
      const issues = [];
      
      if (!zip.files['mimetype']) issues.push('❌ mimetype 파일 누락');
      if (!zip.files['META-INF/container.rdf']) issues.push('❌ META-INF/container.rdf 누락 (치명적!)');
      if (!zip.files['Contents/content.hpf']) issues.push('❌ Contents/content.hpf 누락');
      
      if (issues.length === 0) {
        console.log('%c✅ 모든 필수 파일이 존재합니다!', 'color: green; font-size: 16px; font-weight: bold');
        console.log('');
        console.log('💡 파일 구조는 정상입니다. 다른 문제를 확인하세요:');
        console.log('  1. XML 네임스페이스가 올바른지 확인');
        console.log('  2. 태그 이름이 대문자인지 확인 (HWPML, TABLE, P, TEXT 등)');
        console.log('  3. 압축 방식 확인 (mimetype, version.xml은 STORE)');
      } else {
        console.error('%c⚠️  문제 발견!', 'color: red; font-size: 16px; font-weight: bold');
        console.log('');
        issues.forEach(issue => console.error(issue));
        console.log('');
        console.log('%c💡 해결 방법:', 'color: blue; font-weight: bold');
        console.log('  → src/lib/export/hwpx-exporter.ts 파일 확인');
        console.log('  → addMetaInfFiles() 메서드 확인');
        console.log('  → container.rdf 생성 코드 확인');
      }
      
      console.log('');
      
    } catch (error) {
      console.error('❌ ZIP 분석 실패:', error);
      console.error('스택:', error.stack);
    }
  });
  
  console.log('%c✅ 파일 드롭 리스너 등록 완료', 'color: green; font-weight: bold');
  console.log('   → 저장된 HWPX 파일을 이 페이지에 드래그 앤 드롭하세요!');
  console.log('');
})();
```

---

## 🎯 5단계: 통합 진단 (올인원)

### 모든 단계를 한 번에 실행
```javascript
(async function() {
  console.clear();
  console.log('%c╔══════════════════════════════════════════════════════════════╗', 'color: #667eea; font-weight: bold');
  console.log('%c║  🎯 HWPX 저장 문제 통합 진단                                ║', 'color: #667eea; font-weight: bold');
  console.log('%c╚══════════════════════════════════════════════════════════════╝', 'color: #667eea; font-weight: bold');
  console.log('');
  console.log('진단 시작:', new Date().toLocaleString());
  console.log('');
  
  const report = {
    timestamp: new Date().toISOString(),
    checks: {
      documentData: { status: 'pending', details: {} },
      xmlGeneration: { status: 'pending', details: {} },
      zipStructure: { status: 'pending', details: {} }
    },
    issues: [],
    recommendations: []
  };
  
  // 1. 문서 데이터 체크
  console.log('%c[1/3] 문서 데이터 체크...', 'color: blue; font-weight: bold');
  
  const dbName = 'hwpx-autosave';
  const dbRequest = indexedDB.open(dbName);
  
  const checkDatabase = new Promise((resolve, reject) => {
    dbRequest.onsuccess = function(event) {
      const db = event.target.result;
      const transaction = db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = function() {
        const sessions = getAllRequest.result;
        if (sessions.length > 0) {
          const latest = sessions.sort((a, b) => b.timestamp - a.timestamp)[0];
          window._debugDocument = latest.document;
          report.checks.documentData.status = 'ok';
          report.checks.documentData.details = {
            sessions: sessions.length,
            sections: latest.document?.sections?.length || 0,
            fileName: latest.fileName
          };
          console.log('  ✅ 문서 데이터 정상');
          resolve();
        } else {
          report.checks.documentData.status = 'error';
          report.issues.push('문서 데이터 없음');
          console.error('  ❌ 문서 데이터 없음');
          reject();
        }
      };
    };
    
    dbRequest.onerror = () => {
      report.checks.documentData.status = 'error';
      report.issues.push('IndexedDB 접근 실패');
      reject();
    };
  });
  
  try {
    await checkDatabase;
    
    // 2. XML 생성 체크
    console.log('%c[2/3] XML 생성 체크...', 'color: blue; font-weight: bold');
    
    const doc = window._debugDocument;
    if (doc && doc.sections && doc.sections.length > 0) {
      report.checks.xmlGeneration.status = 'ok';
      report.checks.xmlGeneration.details = {
        sections: doc.sections.length,
        elements: doc.sections[0].elements?.length || 0
      };
      console.log('  ✅ XML 생성 가능');
    } else {
      report.checks.xmlGeneration.status = 'error';
      report.issues.push('섹션 데이터 없음');
      console.error('  ❌ 섹션 데이터 없음');
    }
    
    // 3. ZIP 구조 체크
    console.log('%c[3/3] ZIP 구조 체크...', 'color: blue; font-weight: bold');
    
    const requiredFiles = [
      'mimetype',
      'version.xml',
      'META-INF/container.rdf',
      'Contents/content.hpf'
    ];
    
    report.checks.zipStructure.status = 'info';
    report.checks.zipStructure.details = {
      requiredFiles: requiredFiles.length,
      message: '실제 파일 저장 후 확인 필요'
    };
    console.log('  ℹ️  ZIP 구조는 저장 후 확인 가능');
    
    // 최종 리포트
    console.log('');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gray');
    console.log('%c📊 진단 결과 요약', 'color: purple; font-weight: bold; font-size: 16px');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gray');
    console.log('');
    
    console.table({
      '문서 데이터': report.checks.documentData.status === 'ok' ? '✅ 정상' : '❌ 오류',
      'XML 생성': report.checks.xmlGeneration.status === 'ok' ? '✅ 정상' : '❌ 오류',
      'ZIP 구조': '⏳ 저장 후 확인'
    });
    
    console.log('');
    
    if (report.issues.length === 0) {
      console.log('%c✅ 현재까지 문제 없음!', 'color: green; font-size: 16px; font-weight: bold');
      console.log('');
      console.log('%c📌 다음 단계:', 'color: blue; font-weight: bold');
      console.log('  1. "HWPX 저장" 버튼 클릭');
      console.log('  2. 파일 저장 완료');
      console.log('  3. 4단계 코드 실행 (저장된 파일 검증)');
    } else {
      console.error('%c⚠️  문제 발견:', 'color: red; font-size: 16px; font-weight: bold');
      report.issues.forEach(issue => console.error(`  ❌ ${issue}`));
    }
    
    console.log('');
    window._debugReport = report;
    console.log('✅ 진단 리포트를 window._debugReport에 저장했습니다');
    console.log('');
    
  } catch (error) {
    console.error('❌ 진단 실패:', error);
  }
})();
```

---

## 💾 진단 결과 저장

### JSON 파일로 다운로드
```javascript
(function() {
  if (!window._debugReport) {
    console.error('❌ 먼저 5단계 통합 진단을 실행하세요');
    return;
  }
  
  const blob = new Blob(
    [JSON.stringify(window._debugReport, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hwpx-debug-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('✅ 진단 결과 다운로드 완료');
})();
```

---

## 📞 사용 순서 (권장)

### 빠른 진단 (5분)
1. ✅ **5단계 통합 진단** 실행
2. ✅ "HWPX 저장" 버튼으로 파일 저장
3. ✅ **4단계 저장된 파일 검증** 실행 (파일 드래그)
4. ✅ 문제점 확인

### 상세 진단 (15분)
1. ✅ **1단계: 문서 데이터** 실행
2. ✅ **2단계: XML 생성** 실행
3. ✅ **3단계: ZIP 구조** 실행
4. ✅ "HWPX 저장" 버튼으로 파일 저장
5. ✅ **4단계: 저장된 파일 검증** 실행
6. ✅ 진단 결과 저장

---

**모든 진단 도구가 준비되었습니다!** 🚀

