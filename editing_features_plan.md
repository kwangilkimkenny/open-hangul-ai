# HWPX 뷰어 편집기능 개발 계획 (업그레이드)

## 사용자 조사 기반 우선순위

한글 문서 사용자들이 가장 많이 사용하는 기능을 조사하여 우선순위를 재정립했습니다.

---

## 📊 사용 빈도 기반 기능 분류

### 🔴 Tier 1: 필수 기능 (매우 높은 사용 빈도)
| 기능 | 단축키 | 현재 상태 | 중요도 |
|------|--------|----------|--------|
| 실행취소/다시실행 | Ctrl+Z / Ctrl+Y | ✅ 완료 | ⭐⭐⭐⭐⭐ |
| 복사/붙여넣기/잘라내기 | Ctrl+C/V/X | ⚠️ Plain Text만 지원 | ⭐⭐⭐⭐⭐ |
| 글꼴 서식 (굵게/기울임/밑줄) | Ctrl+B/I/U | ❌ 미구현 | ⭐⭐⭐⭐⭐ |
| 표 만들기 및 편집 | Ctrl+N,T / Tab 이동 | ✅ 완료 | ⭐⭐⭐⭐⭐ |
| 저장 | Ctrl+S | ⚠️ 자동저장만 | ⭐⭐⭐⭐⭐ |

### 🟠 Tier 2: 주요 기능 (높은 사용 빈도)
| 기능 | 단축키 | 현재 상태 | 중요도 |
|------|--------|----------|--------|
| 서식 복사 | Alt+C | ❌ 미구현 | ⭐⭐⭐⭐ |
| 찾기/바꾸기 | Ctrl+F / Ctrl+H | ⚠️ 찾기만 지원 | ⭐⭐⭐⭐ |
| 문단 정렬 (좌/중/우) | - | ❌ 미구현 | ⭐⭐⭐⭐ |
| 특수문자 삽입 | Ctrl+F10 | ❌ 미구현 | ⭐⭐⭐⭐ |
| 글꼴 크기/색상 변경 | - | ❌ 미구현 | ⭐⭐⭐⭐ |

### 🟡 Tier 3: 보조 기능 (중간 사용 빈도)
| 기능 | 단축키 | 현재 상태 | 중요도 |
|------|--------|----------|--------|
| 쪽 나누기 | Ctrl+Enter | ❌ 미구현 | ⭐⭐⭐ |
| 편집 용지 설정 | F7 | ❌ 미구현 | ⭐⭐⭐ |
| 머리말/꼬리말 | - | ❌ 미구현 | ⭐⭐⭐ |
| 그림 삽입 | - | ✅ 완료 | ⭐⭐⭐ |

---

## 🎯 개발 Phase 계획 (우선순위 재배치)

### Phase 1: 핵심 서식 기능 (Tier 1)
**목표**: 가장 많이 사용하는 텍스트 서식 기능 구현

#### 구현 항목
1. **굵게 (Bold)** - Ctrl+B
2. **기울임 (Italic)** - Ctrl+I  
3. **밑줄 (Underline)** - Ctrl+U

#### 기술 구현
```javascript
// 새 파일: text-formatter.js
class TextFormatter {
    constructor(viewer) {
        this.viewer = viewer;
    }
    
    // 선택 영역에 서식 토글
    toggleFormat(formatType) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        // 1. 선택 텍스트의 현재 CharShape 확인
        // 2. CharShape.bold/italic/underline 토글
        // 3. DOM 및 Data Model 동기화
        // 4. HistoryManager에 기록 (Undo 지원)
    }
}
```

#### 수정 파일
- [NEW] `src/lib/vanilla/features/text-formatter.js`
- [MODIFY] `src/lib/vanilla/features/inline-editor.js` (단축키 연동)
- [MODIFY] `src/lib/vanilla/export/json-to-xml.js` (CharShape 속성 반영)

---

### Phase 2: 클립보드 서식 지원 (Tier 1)
**목표**: 서식을 유지한 복사/붙여넣기

#### 구현 항목
1. **서식 포함 복사** - Ctrl+C
2. **서식 포함 붙여넣기** - Ctrl+V
3. **서식 복사 (Format Painter)** - Alt+C ★ 한글 고유 기능

#### 기술 구현
```javascript
// 새 파일: clipboard-manager.js
class ClipboardManager {
    copy() {
        // 선택 텍스트 + CharShape + ParaShape 저장
        this.clipboard = {
            text: selectedText,
            charShape: { bold, italic, underline, fontSize, color },
            paraShape: { align, indent, lineSpacing }
        };
    }
    
    paste() {
        // 저장된 서식과 함께 삽입
    }
    
    copyFormat() {
        // 서식만 저장 (Alt+C)
        this.formatClipboard = currentCharShape;
    }
    
    pasteFormat() {
        // 저장된 서식을 선택 영역에 적용
    }
}
```

---

### Phase 3: 찾기/바꾸기 (Tier 2)
**목표**: 문서 전체 검색 및 일괄 치환

#### 구현 항목
1. **찾기** - Ctrl+F (기존 확장)
2. **바꾸기** - Ctrl+H
3. **모두 바꾸기**

#### 수정 파일
- [MODIFY] `src/lib/vanilla/features/search-manager.js`
- [MODIFY] `src/lib/vanilla/features/text-replacer.js`

---

### Phase 4: 문단 서식 (Tier 2)
**목표**: 문단 정렬 및 들여쓰기

#### 구현 항목
1. **왼쪽 정렬**
2. **가운데 정렬**
3. **오른쪽 정렬**
4. **들여쓰기/내어쓰기**

---

### Phase 5: 특수문자 및 고급 기능 (Tier 2-3)
**목표**: 특수문자 입력 지원

#### 구현 항목
1. **특수문자 삽입 UI** - Ctrl+F10
2. **쪽 나누기** - Ctrl+Enter
3. **수동 저장** - Ctrl+S

---

## 📅 일정 (예상)

| Phase | 기능 | 예상 공수 | 우선순위 |
|-------|------|----------|----------|
| Phase 1 | Bold/Italic/Underline | 2일 | 🔴 Tier 1 |
| Phase 2 | 서식 복사/붙여넣기 + Alt+C | 3일 | 🔴 Tier 1 |
| Phase 3 | 찾기/바꾸기 | 2일 | 🟠 Tier 2 |
| Phase 4 | 문단 정렬/들여쓰기 | 2일 | 🟠 Tier 2 |
| Phase 5 | 특수문자/쪽 나누기 | 2일 | 🟡 Tier 3 |
| QA | 통합 테스트 | 1일 | - |
| **합계** | | **12일** | |

---

## 📋 검증 계획

### 단계별 테스트 시나리오

| Phase | 테스트 케이스 | 예상 결과 |
|-------|--------------|----------|
| 1 | 텍스트 선택 → Ctrl+B | 선택 텍스트 굵게 적용 |
| 1 | 굵은 텍스트 → Ctrl+B | 굵게 해제 (토글) |
| 2 | 서식 텍스트 복사 → 붙여넣기 | 서식 유지됨 |
| 2 | Alt+C → 다른 텍스트 선택 → Alt+V | 서식만 적용 |
| 3 | Ctrl+H → "놀이"→"활동" → 모두 바꾸기 | 전체 치환 |
| 4 | 셀 선택 → 가운데 정렬 | 텍스트 중앙 정렬 |
| 5 | Ctrl+F10 | 특수문자표 팝업 |

### HWPX 호환성 테스트
- 편집 후 내보내기 → 한글 2018에서 열기 → 서식 유지 확인

---

## 🔧 기술 고려사항

### CharShape 구조 (HWPX 스펙)
```xml
<CHARSHAPE Id="0">
    <FONTID Hangul="0" Latin="0" ... />
    <HEIGHT Hangul="1000" ... />
    <BOLD Hangul="1" Latin="1" ... />      <!-- ✅ 굵게 -->
    <ITALIC Hangul="0" Latin="0" ... />    <!-- ✅ 기울임 -->
    <UNDERLINE Type="Bottom" ... />        <!-- ✅ 밑줄 -->
    <TEXTCOLOR Red="0" Green="0" Blue="0"/>
</CHARSHAPE>
```

### 구현 시 주의사항
1. **CharShape 분리**: 부분 선택 시 기존 Run을 분리하여 새 CharShapeId 할당
2. **History 연동**: 모든 서식 변경은 Undo/Redo 지원 필수
3. **DOM 동기화**: Data Model 변경 후 즉시 화면 반영
