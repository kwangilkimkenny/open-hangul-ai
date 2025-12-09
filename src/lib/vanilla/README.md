# HWPX Viewer - 소스 코드 구조

**버전**: v2.0.0-alpha  
**마지막 업데이트**: 2024-11-18

---

## 📁 디렉토리 구조

```
src/
├── core/               # 핵심 모듈
│   ├── constants.js    # 상수 정의 (DPI, 단위 변환 등)
│   ├── parser.js       # SimpleHWPXParser 클래스
│   └── renderer.js     # 렌더링 엔진 (통합)
│
├── renderers/          # 개별 렌더러
│   ├── paragraph.js    # 단락 렌더링
│   ├── table.js        # 테이블 렌더링
│   ├── shape.js        # 도형 렌더링
│   ├── image.js        # 이미지 렌더링
│   └── container.js    # 컨테이너 렌더링
│
├── utils/              # 유틸리티
│   ├── logger.js       # Logger 클래스
│   ├── error.js        # 에러 처리
│   ├── ui.js           # UI 헬퍼 (toast, loading 등)
│   └── format.js       # 포맷 함수 (파일 크기 등)
│
├── styles/             # 스타일시트
│   └── viewer.css      # 뷰어 CSS
│
└── viewer.js           # 메인 진입점 (HWPXViewer)
```

---

## 📦 모듈 의존성

```
viewer.js
  ├─ core/constants.js
  ├─ core/parser.js
  │   └─ utils/logger.js
  │   └─ core/constants.js
  ├─ core/renderer.js
  │   ├─ renderers/paragraph.js
  │   ├─ renderers/table.js
  │   ├─ renderers/shape.js
  │   ├─ renderers/image.js
  │   └─ renderers/container.js
  └─ utils/
      ├─ logger.js
      ├─ error.js
      ├─ ui.js
      └─ format.js
```

---

## 🔧 모듈 설명

### core/constants.js
전역 상수 및 단위 변환 함수
- DPI 상수
- 페이지 크기
- 단위 변환 (pt↔px, HWPU↔px, mm↔px)

### core/parser.js
HWPX 파일 파싱
- ZIP 압축 해제
- XML 파싱
- 이미지/스타일 로드

### core/renderer.js
렌더링 엔진 통합
- 개별 렌더러 조합
- 페이지 레이아웃
- 섹션 렌더링

### renderers/*.js
개별 요소 렌더러
- 각 요소별 HTML 생성
- 스타일 적용
- 이벤트 처리

### utils/logger.js
로깅 시스템
- 로그 레벨 관리
- 조건부 로깅
- 성능 측정

### utils/error.js
에러 처리
- 에러 래핑
- 사용자 메시지 생성
- 전역 에러 핸들러

### utils/ui.js
UI 유틸리티
- Toast 알림
- 로딩 오버레이
- 상태 업데이트

### utils/format.js
포맷 함수
- 파일 크기
- 날짜/시간
- 기타 포맷

### viewer.js
메인 진입점
- 모든 모듈 통합
- 공개 API 제공
- 이벤트 관리

---

## 🚀 빌드 프로세스

```bash
# 개발 모드
npm run dev
# → Webpack Dev Server
# → 소스맵, 핫 리로드

# 프로덕션 빌드
npm run build
# → 최적화, 압축
# → dist/hwpx-viewer.bundle.js
```

---

## 📝 코딩 컨벤션

### 1. ES6 모듈
```javascript
// export
export class MyClass { }
export function myFunction() { }
export const MY_CONSTANT = 42;

// import
import { MyClass, myFunction } from './module.js';
```

### 2. 네이밍
- **클래스**: PascalCase (`SimpleHWPXParser`)
- **함수**: camelCase (`renderParagraph`)
- **상수**: UPPER_SNAKE_CASE (`DPI_STANDARD`)
- **파일**: kebab-case (`error-handler.js`)

### 3. JSDoc
모든 공개 함수/클래스에 JSDoc 추가
```javascript
/**
 * 단락 렌더링 함수
 * @param {Object} para - 단락 객체
 * @returns {HTMLElement} 렌더링된 요소
 */
export function renderParagraph(para) { }
```

### 4. 에러 처리
모든 비동기 함수에 try-catch
```javascript
async function loadFile() {
    try {
        // ...
    } catch (error) {
        logger.error('Failed to load file:', error);
        throw error;
    }
}
```

---

## 🧪 테스트

각 모듈은 대응하는 테스트 파일 필요
```
src/core/parser.js
→ src/core/parser.test.js
```

---

**작성자**: AI Assistant

