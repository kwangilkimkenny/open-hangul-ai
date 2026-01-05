# Changelog

All notable changes to the HAN-View React project will be documented in this file.

## [2.0.0-commercial] - 2025-12-10

### ⚖️ 라이센스 변경 (BREAKING CHANGE)

#### 상업용 라이센스 적용
- **변경**: MIT License → Commercial License (상업용 독점 라이센스)
- **이유**: 소프트웨어의 상업적 가치 보호 및 지속 가능한 개발 지원
- **영향**: 
  - 라이센스 구매 필요
  - 상업적 사용 가능
  - 소스 코드 재배포 금지
  - 리버스 엔지니어링 금지

#### LICENSE 파일
- 상업용 라이센스 전문 추가 (2.57 KB)
- 라이센스 종류 명시:
  - 개인/소규모 라이센스
  - 기업 라이센스
- 사용 권한 및 제한 사항 상세 기술
- 연락처 정보 포함

#### package.json 업데이트
- `license`: "MIT" → "SEE LICENSE IN LICENSE"
- `description`: 상업용 라이센스 명시
- `author`: 연락처 추가 (license@ism-team.com)
- `keywords`: "commercial", "enterprise" 추가
- `homepage`: ISM Team 공식 웹사이트
- `bugs.email`: 지원 이메일 추가

#### README 업데이트
- 라이센스 구매 안내 섹션 추가
- 라이센스 종류 및 가격 정보
- 연락처 정보 (이메일, 웹사이트, 전화)
- 저작권 표시 강화

### 🎉 주요 기능 (v2.0.0 기반)

#### ✅ 편집 모드 기본 활성화
- **변경**: `EditModeManager`의 `isGlobalEditMode` 기본값을 `true`로 변경
- **효과**: 애플리케이션 시작 시 자동으로 편집 모드가 활성화되어 즉시 편집 가능
- **관련 파일**: `src/lib/vanilla/features/edit-mode-manager.js`

#### 🧹 셀 내용 비우기 기능 수정
- **수정**: 우클릭 컨텍스트 메뉴의 "내용 비우기" 기능 안정성 개선
- **추가**: 상세한 디버깅 로그 및 에러 핸들링
- **개선**: 
  - Try-catch 블록으로 에러 처리
  - Elements가 없는 경우 안전하게 처리
  - 각 단계마다 로그 출력으로 디버깅 용이
- **관련 파일**: `src/lib/vanilla/viewer.js`

### 🔧 기술적 개선

#### 초기화 개선
- 편집 모드 UI가 활성화 상태로 표시됨
- 편집 가능한 요소들이 자동으로 강조 표시됨
- 편집 가이드가 자동으로 표시됨
- `global-edit-mode` 클래스가 body에 자동 추가됨

#### 에러 핸들링
- 셀 데이터가 없는 경우 안전하게 처리
- 에러 발생 시에도 최소한 UI는 업데이트되도록 보장
- 상세한 로그로 문제 진단 용이

### 📝 로그 개선

#### 새로운 로그 메시지
- `🧹 셀 내용 비우기 시작` - 작업 시작
- `📝 셀에 _cellData가 없음` - 데이터 없음 경고
- `📦 셀 데이터 확인` - 데이터 구조 확인
- `💾 자동 저장 트리거됨` - 저장 트리거 확인
- `✅ 셀 내용 비우기 완료` - 성공
- `❌ 셀 내용 비우기 실패` - 실패 (에러 정보 포함)

### 🎯 사용자 경험 개선

#### 즉시 사용 가능
- 별도의 편집 모드 활성화 없이 바로 편집 가능
- 우클릭 컨텍스트 메뉴가 즉시 작동
- Delete 키로 셀 내용 비우기 즉시 가능

#### 시각적 피드백
- 편집 가능한 요소 자동 강조
- 활성화된 편집 모드 버튼 표시
- 편집 단축키 가이드 자동 표시

### 🐛 버그 수정

- **수정**: 편집 모드가 기본으로 비활성화되어 있어 컨텍스트 메뉴가 작동하지 않던 문제
- **수정**: 셀 내용 비우기 시 에러 발생 가능성 제거
- **수정**: 편집 가능 여부 체크 로직 개선

### 📦 패키징

- 빌드 크기 최적화
  - ES 모듈: 429.62 KB (gzip: 122.31 KB)
  - UMD 모듈: 428.10 KB (gzip: 122.09 KB)
  - CSS: 83.32 KB (gzip: 14.98 KB)
- **상업용 라이센스** 파일 포함 (2.57 KB)
- 타입 정의 파일 포함
- README with 라이센스 구매 안내

### 🔄 마이그레이션 가이드

#### v1.x → v2.0.0-commercial

**라이센스 변경 (중요!)**
- MIT License에서 Commercial License로 변경
- 기존 사용자: 라이센스 구매 필요
- 연락처: license@ism-team.com

**코드 변경 사항 없음** - 기존 코드 그대로 사용 가능

```tsx
// 기존 코드 (그대로 사용)
<HanViewApp
  onDocumentLoad={handleViewerReady}
  onFileSelect={handleFileSelect}
  onError={handleError}
  enableAI={true}
  initialSidebarOpen={true}
/>
```

**주요 차이점:**
- 이전: 앱 시작 후 "편집 모드" 버튼 클릭 필요
- 현재: 앱 시작과 동시에 편집 가능

### 📞 지원 및 문의

#### 라이센스 구매
- 📧 Email: license@ism-team.com
- 🌐 Website: https://ism-team.com
- 📞 전화: 지원 센터 문의

#### 기술 지원
- 📧 Email: support@ism-team.com
- 🐛 버그 리포트: GitHub Issues
- 💬 기능 요청: support@ism-team.com

---

## [2.0.0] - 2025-12-09

### 주요 기능
- HWPX 파일 파싱 및 렌더링
- 인라인 편집 기능
- AI 문서 편집 기능
- 테이블 편집 기능
- 검색 기능
- 히스토리 관리 (실행취소/다시실행)
- 테마 관리 (라이트/다크)
- 컨텍스트 메뉴
- 자동 저장

---

**© 2025 ISM Team. All Rights Reserved.**

본 소프트웨어는 상업용 라이센스로 보호됩니다.
