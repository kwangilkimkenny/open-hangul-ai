# Changelog

오픈한글AI(`open-hangul-ai`) 프로젝트의 모든 주요 변경사항이 이 파일에 문서화됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 기반으로 하며, [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

## [Unreleased]

### Added (canvas-editor 통합)
- 신규 의존성 `@hufe921/canvas-editor` (^0.9.131) — MIT, runtime Vue 의존성 없음 검증 완료
- `hwpxToCanvasEditor()` / `canvasEditorToHwpx()` — HWPX ↔ canvas-editor IEditorData 양방향 변환기
- `CanvasEditorAdapter` — canvas-editor 인스턴스 lifecycle 래퍼 (lazy import, contentChange debounce)
- React 컴포넌트 `CanvasEditorPanel` — 전체 문서 캔버스 편집 surface
- `HWPXViewerWrapper` 에 `editorType?: 'inline' | 'canvas'` prop 추가 (기본값 `'inline'`, 기존 동작 유지)
- `HWPXViewer.mountCanvasEditor(container, options)` — 현재 문서를 canvas-editor 로 마운트
- 라운드트립 단위 테스트 5개 (`hwpx-canvas-editor.test.js`) 추가

### Removed (오픈소스 정리)
- 비공개 모듈 `packages-aegis/`, `TruthAnchor-core/` 를 git history 포함 완전 제거
- 상업용 라이선스 자산 (`LICENSE-COMMERCIAL`, `LICENSE-OPENSOURCE`, `.gitignore-opensource`) 삭제
- 보호 빌드 스크립트(`scripts/build-protected.js`) 및 npm 스크립트 4개 (`build:opensource`, `build:production`, `build:enterprise`, `package:opensource`) 삭제
- 사용되지 않는 `src/lib/vanilla/ui/chat-panel-legacy.js` (3,369줄) 삭제
- `docs-backup/`, `memo.md` 등 개발 과정 산출물 정리

### Changed (오픈소스 정리)
- `LICENSE` 본문을 MIT 텍스트로 교체 (`package.json` 의 `"license": "MIT"` 선언과 일치)
- mock 모듈 `aegis-enterprise.ts` → `aegis-noop.ts` 로 이름 변경, 안내 문구를 단순 no-op 로 정리
- GitHub 저장소 URL 을 `kwangilkimkenny/open-hangul-ai` 로 통일 (10개 파일)
- 라이브러리 코드(`ai-config.js`)에서 `import.meta.env.VITE_OPENAI_API_KEY` 직접 참조 제거 (빌드 시 키 인라인 위험 차단)
- 웹사이트 footer 에 운영 주체(YATAV) 사업자 정보 추가

### 계획된 기능
- 실시간 협업 편집 지원
- 더 많은 AI 프로바이더 통합 (Anthropic Claude, Google Gemini)
- 플러그인 시스템 개발
- 모바일 최적화
- CI/CD 파이프라인 구축
- 자동화된 테스팅 환경

---

## [5.0.1] - 2026-04-19

### 🎉 첫 번째 npm 패키지 릴리스

이 버전은 오픈한글AI의 첫 번째 공개 npm 패키지입니다.

### Added
- **React 컴포넌트**: `HanViewApp`, `HWPXViewer`, `HanViewProvider` 추가
- **TypeScript 지원**: 완전한 타입 정의 제공
- **문서 뷰어 기능**:
  - HWPX 파일 뷰어
  - PDF, DOCX, XLSX, PPTX 지원
  - 확대/축소, 페이지 네비게이션
  - 텍스트 선택 및 검색
- **AI 통합 모듈**:
  - Vertex AI 클라이언트
  - 문서 분석 및 요약
  - AI 문서 생성 (Draft Generator)
  - 토큰 사용량 관리
- **React 훅스**:
  - `useHanView`: 메인 상태 관리
  - `useHanViewConfig`: 설정 관리
  - `useHanViewTheme`: 테마 관리
  - `useHanViewToolbar`: 툴바 제어
  - `useHanViewAIPanel`: AI 패널 관리
  - `useHotkeys`: 키보드 단축키
  - `useDraftStream`: AI 스트리밍
- **유틸리티 함수**:
  - 문서 파서 (`SimpleHWPXParser`)
  - 문서 렌더러 (`DocumentRenderer`)
  - 로거 시스템
  - 에러 처리 (`HWPXError`)
- **보안 기능**:
  - 디지털 워터마크 (embed/extract)
  - OCR 서비스 (Tesseract.js)
  - 문서 비교 (diff)
- **커스터마이징**:
  - 테마 시스템 (라이트/다크 모드)
  - 툴바 커스터마이징
  - AI 패널 설정
  - Context 메뉴

### Technical
- **빌드 시스템**: Vite 기반 라이브러리 빌드
- **패키지 형식**: ES Module + UMD 지원
- **CSS**: 94KB 스타일시트 포함
- **번들 크기**: 1.8MB (압축), 5.8MB (압축해제)
- **의존성**: React 18+ 필요, 최소한의 외부 의존성
- **브라우저 지원**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### Documentation
- 완전한 README.md (설치법, 사용법, 예제)
- 상세 사용 가이드 (`docs/USAGE_GUIDE.md`)
- 완전한 API 문서 (`docs/API.md`)
- TypeScript 타입 정의 파일

### Infrastructure
- npm 패키지 등록 및 발행
- MIT 라이센스 적용
- GitHub 저장소 설정
- 자동 빌드 파이프라인

---

## [5.0.0] - 2026-04-19

### Note
이 버전은 초기 발행 중 문제로 인해 즉시 5.0.1로 업데이트되었습니다.

---

## [2.1.0] - 2025-01-12

### 🎉 Major Release: Phase 2-5 Complete - Production-Ready

This release includes **massive performance and stability improvements** across the entire application with **43 automated tests (100% passing)**.

### Added - Phase 2: Undo/Redo System Redesign

#### Phase 2 P0: Command Pattern (cf76d58)
- ✅ Function-based command pattern with execute + undo functions
- ✅ Both execute and undo stored for efficient redo
- ✅ `isExecuting` flag prevents nested command execution
- ✅ 6 comprehensive test scenarios
- ⚡ **PERFORMANCE:** <1ms per undo/redo operation

#### Phase 2 P1: WeakMap Memory Optimization (4bb81d2)
- ✅ WeakMap-based element state tracking
- ✅ Automatic garbage collection when elements are removed
- ✅ Memory leak prevention for long editing sessions
- ✅ 6 memory management test scenarios
- ⚡ **PERFORMANCE:** 90% memory reduction vs snapshot approach

#### Phase 2 P2: Batch Undo/Redo (84e6611)
- ✅ `undoMultiple(count)` and `redoMultiple(count)` methods
- ✅ Batch mode with single UI update
- ✅ 6 batch operation test scenarios
- ⚡ **PERFORMANCE:** 90% faster bulk operations

#### Phase 2 P3: React Context Integration (fa3d459)
- ✅ `HistoryContext.tsx` with Provider and Hook
- ✅ `useHistory()` hook for React components
- ✅ `UndoRedoButtons.tsx` example components
- ✅ `onStateChange` callback in HistoryManagerV2
- ✅ 6 React integration test scenarios
- 🎨 Buttons automatically update disabled state
- 🎨 Tooltips show action names

### Added - Phase 3: Page Splitting & Auto-pagination (3170513)

- ✅ Recursion depth limiting (MAX_RECURSION = 10)
- ✅ `_getElementTotalHeight()` with margin collapse calculation
- ✅ `_splitLargeTable()` for row-based table splitting
- ✅ Table header repetition on each page
- ✅ Oversized element detection and handling
- ✅ 6 pagination test scenarios
- 🔧 ALLOWED_OVERFLOW increased from 20px to 50px
- 🐛 **FIXED:** Infinite recursion in pagination
- 🐛 **FIXED:** Incorrect margin collapse calculation
- 🐛 **FIXED:** Tables not splitting across pages
- ⚡ **PERFORMANCE:** Saves 10-20px per element, fewer splits

### Added - Phase 4: Dynamic Pagination Performance (106083e)

- ✅ `isPaginating` semaphore lock
- ✅ `paginationQueue` FIFO queue (10ms delays)
- ✅ `checkPaginationDebounced(delay)` with 500ms default
- ✅ `dirtyPages` Set to track edited pages
- ✅ `markPageDirty()`, `clearPageDirty()`, `isPageDirty()`
- ✅ `checkAllDirtyPages()` for batch processing
- ✅ `enablePaginationDebug()` visual overlay mode
- ✅ 6 performance test scenarios
- ⚡ **PERFORMANCE:** 10x UI responsiveness improvement
- ⚡ **PERFORMANCE:** 90% pagination overhead reduction
- ⚡ **PERFORMANCE:** >30 FPS during typing
- ⚡ **PERFORMANCE:** 100+ concurrent requests supported

### Added - Phase 5: Integration & QA (eccb932)

#### Error Handling
- ✅ `error-boundary.js` utility module
- ✅ `withErrorBoundary()` and `withAsyncErrorBoundary()`
- ✅ `safeDOMOperation()` for safe DOM manipulation
- ✅ `setupGlobalErrorHandler()` for unhandled errors
- ✅ `CircuitBreaker` class for cascading failure prevention
- ✅ `retryWithBackoff()` for resilient retry logic
- ✅ Critical methods wrapped with error boundaries
- 🛡️ All errors caught gracefully, no crashes

#### Logging & Validation
- ✅ `logging-validator.js` utility module
- ✅ `validateLogging()` production readiness check
- ✅ `createProductionLogger()` auto-strips debug logs
- ✅ `createLoggingMonitor()` performance tracking
- ✅ `analyzeLoggingPatterns()` hotspot identification
- ✅ `checkLoggingAntiPatterns()` best practices
- ✅ `generateLoggingReport()` QA checklist
- 📝 Debug logs automatically removed in production

#### Testing & Documentation
- ✅ **43 automated tests, 100% passing**
  - test-phase2-p0.js: 6 tests (Command Pattern)
  - test-phase2-p1.js: 6 tests (WeakMap)
  - test-phase2-p2.js: 6 tests (Batch Operations)
  - test-phase2-p3.js: 6 tests (React Context)
  - test-phase3.js: 6 tests (Pagination)
  - test-phase4.js: 6 tests (Performance)
  - test-phase5.js: 7 tests (Integration)
- ✅ Integration test suite (Undo+Pagination cascade)
- ✅ WeakMap memory management verification
- ✅ Performance benchmarks (1000 operations <1ms)
- ✅ Queue stress test (100+ requests)
- ✅ Error recovery validation
- ✅ Feature integration matrix
- ✅ Edge case handling (7 scenarios)

### Documentation (2b0c4bf)

- ✅ `DEPLOYMENT_GUIDE.md` - Complete production deployment guide
- ✅ `CHANGELOG.md` - This file with v2.1.0 details
- ✅ `BROWSER_TEST_CHECKLIST.md` - Comprehensive browser testing guide
- ✅ `test-live-features.md` - Manual testing procedures
- ✅ `verify-implementation.sh` - File verification script
- ✅ `smoke-test.js` - Quick verification script
- ✅ README.md updated with v2.1.0 features
- ✅ Performance benchmarks table
- ✅ Phase 2-5 detailed documentation sections

### Changed

- 🔄 HistoryManager → HistoryManagerV2 (v2.3.0)
- 🔄 Undo/Redo uses command pattern instead of state snapshots
- 🔄 Pagination uses queue system instead of immediate execution
- 🔄 Element state uses WeakMap instead of regular Map
- 🔄 Undo/Redo buttons use React Context instead of direct DOM
- 🔄 Error handling uses boundaries instead of scattered try-catch
- 🔄 Logging uses validator instead of hardcoded levels

### Fixed

- 🐛 Memory leaks during long editing sessions (Phase 2 P1)
- 🐛 Infinite recursion in pagination (Phase 3)
- 🐛 Incorrect margin collapse calculation (Phase 3)
- 🐛 Tables not splitting across pages (Phase 3)
- 🐛 Pagination triggering on every keystroke (Phase 4)
- 🐛 Concurrent pagination race conditions (Phase 4)
- 🐛 Unhandled errors causing crashes (Phase 5)
- 🐛 Debug logs in production builds (Phase 5)

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Undo/Redo Speed** | ~10-50ms | <1ms | **10-50x faster** |
| **UI Response** | ~300ms | <30ms | **10x faster** |
| **Memory Usage** | Grows | Stable | **90% reduction** |
| **Pagination Overhead** | High | Minimal | **90% reduction** |
| **Typing FPS** | 15-20 | >30 | **2x smoother** |
| **Batch Operations** | N*10ms | 10ms | **90% faster** |

### Migration Guide: v2.0.0 → v2.1.0

**✅ No breaking changes!** All improvements are backward compatible.

#### Optional: Use React Context (Recommended)

```tsx
// Old (still works)
<UndoRedoButtons viewer={viewer} />

// New (recommended - auto-updating)
import { HistoryProvider } from './contexts/HistoryContext';

<HistoryProvider viewer={viewer}>
  <UndoRedoButtons viewer={viewer} />
</HistoryProvider>
```

#### Optional: Use Batch Operations

```javascript
// Old (still works)
for (let i = 0; i < 10; i++) {
    viewer.historyManager.undo();
}

// New (90% faster)
viewer.historyManager.undoMultiple(10);
```

#### Optional: Enable Debug Mode

```javascript
// New in Phase 4
viewer.renderer.enablePaginationDebug();
```

### Upgrade Instructions

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Verify with tests
npm run test  # All 43 tests should pass

# Build for production
npm run build
```

**No database migrations needed!**
**No configuration changes required!**

---

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
