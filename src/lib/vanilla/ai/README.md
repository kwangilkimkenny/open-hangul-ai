# AI Module - HWPX Viewer

**버전**: v2.1.0  
**목적**: OpenAI GPT API를 통한 문서 구조 보존 콘텐츠 변경

---

## 📦 모듈 구성

### 1. structure-extractor.js
**역할**: 파싱된 HWPX 문서에서 구조와 텍스트 분리

**주요 기능**:
- 섹션별 구조 추출
- 텍스트 슬롯 ID 생성 (UUID)
- 레이아웃 정보 보존
- 표 구조 매핑

**입력**:
```javascript
{
  sections: [...],
  images: Map,
  metadata: {...}
}
```

**출력**:
```javascript
{
  structure: {
    sections: [{
      pageSettings: {...},
      elements: [{
        type: 'paragraph',
        id: 'uuid-xxx',
        style: {...},
        textSlots: [{
          slotId: 'slot-uuid-xxx',
          originalText: '...',
          style: {...}
        }]
      }]
    }]
  },
  textSlots: Map<slotId, {text, path}>,
  metadata: {...}
}
```

---

### 2. gpt-content-generator.js
**역할**: OpenAI GPT-4 API 통신 및 콘텐츠 생성

**주요 기능**:
- API 클라이언트 (fetch 기반)
- 프롬프트 빌드
- 응답 파싱 및 검증
- 에러 처리 및 재시도

**API 설정**:
- Model: gpt-4-turbo-preview
- Temperature: 0.7
- Max Tokens: 4000
- Response Format: JSON

**프롬프트 구조**:
```
System: 당신은 문서 구조를 정확히 유지하면서 내용만 변경하는 전문가입니다.
        각 textSlot의 ID를 반드시 유지하고, 표의 행/열 구조를 절대 변경하지 마세요.

User: [구조 JSON]
      사용자 요청: "초등학생이 이해할 수 있게 쉽게 바꿔주세요"
```

**응답 형식**:
```json
{
  "updatedSlots": [
    {
      "slotId": "slot-uuid-xxx",
      "newText": "변경된 내용"
    }
  ],
  "metadata": {
    "model": "gpt-4-turbo-preview",
    "tokensUsed": 1234,
    "processingTime": "3.2s"
  }
}
```

---

### 3. content-merger.js
**역할**: 생성된 콘텐츠를 원본 문서 구조에 병합

**주요 기능**:
- 슬롯 ID 기반 매핑
- 깊은 복사 및 텍스트 교체
- 구조 무결성 검증
- 변경 이력 관리

**검증 규칙**:
- ✅ 섹션 수 동일
- ✅ 표 행/열 수 동일
- ✅ 요소 순서 동일
- ✅ 스타일 보존
- ✅ 이미지 위치 유지

**병합 알고리즘**:
1. 원본 문서 깊은 복사
2. 슬롯 ID → 문서 경로 매핑
3. 각 슬롯에 대해 텍스트 교체
4. 구조 검증
5. 변경 사항 반환

---

### 4. ai-controller.js
**역할**: 모든 AI 모듈 통합 및 상태 관리

**주요 기능**:
- Viewer 인스턴스 연동
- 사용자 요청 처리
- 로딩/에러 상태 관리
- 변경 이력 관리
- UI 업데이트

**상태 객체**:
```javascript
{
  isProcessing: false,
  currentRequest: null,
  originalDocument: null,
  updatedDocument: null,
  history: [],
  error: null
}
```

**메서드**:
- `handleUserRequest(message)`: 사용자 요청 처리
- `previewChanges()`: 변경 미리보기
- `applyChanges()`: 변경 적용
- `revertChanges()`: 변경 취소
- `getHistory()`: 변경 이력 조회

---

### 5. prompt-builder.js
**역할**: GPT 프롬프트 생성 및 최적화

**주요 기능**:
- System message 생성
- User message 구성
- 구조 정보 직렬화
- 프롬프트 최적화 (토큰 절약)

**프롬프트 전략**:
```javascript
// System Message
const SYSTEM_MESSAGE = `
당신은 한글 문서 전문가입니다.

역할:
- 문서의 레이아웃과 구조를 정확히 유지
- 각 textSlot의 ID를 반드시 보존
- 표의 행/열 구조를 절대 변경하지 않음
- 오직 텍스트 내용만 변경

규칙:
1. updatedSlots 배열에 변경된 슬롯만 포함
2. 각 슬롯은 {slotId, newText} 형식
3. 변경하지 않는 슬롯은 포함하지 않음
4. 표 구조 (행/열 수)는 절대 변경 금지
`;

// User Message Template
const USER_MESSAGE_TEMPLATE = `
문서 구조:
{STRUCTURE_JSON}

사용자 요청:
{USER_REQUEST}

위 구조를 정확히 유지하면서, 사용자 요청에 따라 텍스트만 변경하세요.
`;
```

---

### 6. validation.js
**역할**: 문서 구조 검증 및 무결성 체크

**검증 함수**:

```javascript
// 구조 무결성 검증
export function validateStructure(original, updated) {
  const errors = [];
  
  // 섹션 수 체크
  if (original.sections.length !== updated.sections.length) {
    errors.push('섹션 수가 일치하지 않습니다');
  }
  
  // 요소 수 체크
  original.sections.forEach((section, idx) => {
    const updatedSection = updated.sections[idx];
    if (section.elements.length !== updatedSection.elements.length) {
      errors.push(`섹션 ${idx}: 요소 수가 일치하지 않습니다`);
    }
  });
  
  // 표 구조 체크
  validateTableStructures(original, updated, errors);
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 표 구조 검증
function validateTableStructures(original, updated, errors) {
  // 표의 행/열 수가 동일한지 체크
}

// GPT 응답 검증
export function validateGPTResponse(response) {
  const errors = [];
  
  if (!response.updatedSlots || !Array.isArray(response.updatedSlots)) {
    errors.push('updatedSlots가 배열이 아닙니다');
  }
  
  response.updatedSlots.forEach((slot, idx) => {
    if (!slot.slotId) {
      errors.push(`슬롯 ${idx}: slotId가 없습니다`);
    }
    if (typeof slot.newText !== 'string') {
      errors.push(`슬롯 ${idx}: newText가 문자열이 아닙니다`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

---

## 🔄 데이터 플로우

```
User Input (Chat)
    ↓
AI Controller
    ↓
Structure Extractor ←─── Parsed Document
    ↓
    {structure, textSlots}
    ↓
Prompt Builder
    ↓
    "System + User Message"
    ↓
GPT Content Generator ←─── API Key
    ↓
    {updatedSlots}
    ↓
Validation
    ↓
Content Merger
    ↓
    Updated Document
    ↓
Renderer (Re-render)
    ↓
HTML DOM Update
```

---

## 🧪 테스트 전략

### 단위 테스트
각 모듈은 독립적으로 테스트:

```javascript
// structure-extractor.test.js
describe('DocumentStructureExtractor', () => {
  test('단순 단락 문서 추출', () => {
    const doc = { sections: [...] };
    const extractor = new DocumentStructureExtractor();
    const result = extractor.extractStructure(doc);
    
    assert(result.textSlots.size > 0);
    assert(result.structure.sections.length === doc.sections.length);
  });
  
  test('표가 포함된 문서 추출', () => {
    // ...
  });
});
```

### Mock 데이터
```javascript
// test/fixtures/sample-documents.js
export const SIMPLE_DOCUMENT = {
  sections: [{
    elements: [{
      type: 'paragraph',
      runs: [{ text: 'Hello World' }]
    }]
  }]
};

export const TABLE_DOCUMENT = {
  sections: [{
    elements: [{
      type: 'table',
      rows: [
        { cells: [{ text: 'A1' }, { text: 'B1' }] },
        { cells: [{ text: 'A2' }, { text: 'B2' }] }
      ]
    }]
  }]
};
```

### 통합 테스트
전체 플로우 테스트:

```javascript
// ai-integration.test.js
describe('AI Integration', () => {
  test('End-to-end: 텍스트 변경', async () => {
    const controller = new AIDocumentController(viewer);
    const result = await controller.handleUserRequest('쉽게 바꿔줘');
    
    assert(result.success === true);
    assert(result.updatedDocument !== null);
  });
});
```

---

## 🔐 보안 고려사항

### API 키 보호
```javascript
// ❌ 나쁜 예: 하드코딩
const API_KEY = 'sk-xxxxx';

// ✅ 좋은 예: 환경변수 또는 사용자 입력
const API_KEY = process.env.OPENAI_API_KEY || 
                window.localStorage.getItem('openai_api_key');
```

### 입력 검증
```javascript
// 사용자 입력 검증
function validateUserInput(input) {
  if (typeof input !== 'string') {
    throw new Error('입력이 문자열이 아닙니다');
  }
  
  if (input.length > 1000) {
    throw new Error('입력이 너무 깁니다 (최대 1000자)');
  }
  
  // XSS 방지
  const sanitized = input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return sanitized;
}
```

---

## 📊 성능 최적화

### 1. 구조 추출 캐싱
```javascript
class DocumentStructureExtractor {
  constructor() {
    this.cache = new Map();
  }
  
  extractStructure(doc) {
    const cacheKey = this.generateCacheKey(doc);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const result = this.doExtract(doc);
    this.cache.set(cacheKey, result);
    return result;
  }
}
```

### 2. 프롬프트 토큰 최적화
```javascript
// 불필요한 정보 제거
function optimizeStructure(structure) {
  return {
    ...structure,
    // 스타일 정보는 간략하게
    elements: structure.elements.map(el => ({
      id: el.id,
      type: el.type,
      textSlots: el.textSlots.map(slot => ({
        slotId: slot.slotId,
        text: slot.originalText
        // style은 제외 (변경하지 않으므로)
      }))
    }))
  };
}
```

### 3. 병렬 처리
```javascript
// 여러 섹션 동시 처리 (가능한 경우)
async function extractMultipleSections(sections) {
  return await Promise.all(
    sections.map(section => extractSection(section))
  );
}
```

---

## 🐛 디버깅 가이드

### 로그 레벨 설정
```javascript
// 개발 모드
window.HWPX_VIEWER_CONFIG = {
  effectiveLogLevel: 'DEBUG',
  ai: {
    logRequests: true,
    logResponses: true
  }
};
```

### 구조 추출 디버깅
```javascript
// 추출된 구조를 콘솔에 출력
logger.debug('Extracted structure:', JSON.stringify(structure, null, 2));

// 텍스트 슬롯 확인
logger.debug(`Total text slots: ${textSlots.size}`);
textSlots.forEach((value, key) => {
  logger.debug(`  ${key}: "${value.text.substring(0, 50)}..."`);
});
```

### GPT 요청/응답 디버깅
```javascript
// 요청 로깅
logger.debug('GPT Request:', {
  prompt: prompt.substring(0, 500) + '...',
  tokensEstimate: estimateTokens(prompt)
});

// 응답 로깅
logger.debug('GPT Response:', {
  slotsUpdated: response.updatedSlots.length,
  tokensUsed: response.metadata.tokensUsed
});
```

---

## 📚 참고 자료

### OpenAI API
- [Chat Completions](https://platform.openai.com/docs/guides/chat-completions)
- [JSON Mode](https://platform.openai.com/docs/guides/json-mode)
- [Best Practices](https://platform.openai.com/docs/guides/production-best-practices)

### 문서 구조 분석
- [HWPX Format Specification](https://github.com/hancom-io/hwpx-format-spec)
- [DOM Traversal](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Traversal)

---

**작성자**: AI Assistant  
**최종 수정**: 2024-11-23

