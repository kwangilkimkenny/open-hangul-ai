# HWPX 문서 편집 가이드

## 개요

이 모듈은 HWPX 파일을 읽고, 편집하고, 저장하는 기능을 제공합니다. 특히 AI 문서 편집 후 변경사항을 반영하는 데 유용합니다.

## 주요 클래스

### HWPXSerializer

HWPX 파일의 읽기/쓰기를 담당하는 핵심 클래스입니다.

```typescript
import { HWPXSerializer } from './HWPXSerializer';

const serializer = new HWPXSerializer();

// 파일 열기
await serializer.open('path/to/file.hwpx');

// 섹션 업데이트
serializer.setSection(0, updatedSection0);
serializer.setSection(1, updatedSection1);

// 또는 모든 섹션 교체
serializer.setSections([section0, section1, section2]);

// 헤더 업데이트
serializer.setHead(updatedHeader);

// 파일 저장
await serializer.save(); // 원본 경로에 저장
await serializer.save('path/to/newfile.hwpx'); // 새 경로에 저장
```

### HWPXDocumentHelper

AI 편집 후 문서 업데이트를 쉽게 할 수 있도록 도와주는 헬퍼 클래스입니다.

```typescript
import { HWPXDocumentHelper } from './HWPXDocumentHelper';

const helper = new HWPXDocumentHelper();

// 파일 열기
await helper.openFile('document.hwpx');

// AI 편집 후 섹션 XML 업데이트
helper.updateSectionXML(0, '<section>...</section>');
helper.updateSectionXML(1, '<section>...</section>');

// 또는 여러 섹션을 한 번에 업데이트
const sectionsMap = new Map<number, string>();
sectionsMap.set(0, '<section>...</section>');
sectionsMap.set(1, '<section>...</section>');
helper.updateSectionsXML(sectionsMap);

// 헤더 업데이트 (선택사항)
helper.updateHeaderXML('<head>...</head>');

// 변경사항 저장
await helper.saveChanges();
```

## AI 편집 통합 예제

### 예제 1: 간단한 사용

```typescript
import { applyAIEditsToHWPX } from './HWPXDocumentHelper';

// AI 편집 결과
const updatedSections = new Map<number, string>();
updatedSections.set(0, '<section>업데이트된 내용</section>');

// 적용 및 저장
await applyAIEditsToHWPX('document.hwpx', updatedSections);
```

### 예제 2: 헤더와 섹션 모두 업데이트

```typescript
import { HWPXDocumentHelper } from './HWPXDocumentHelper';

const helper = new HWPXDocumentHelper();
await helper.openFile('document.hwpx');

// AI 편집 결과
const updatedHeader = '<head>...</head>';
const updatedSections = new Map<number, string>();
updatedSections.set(0, '<section>섹션 0</section>');
updatedSections.set(1, '<section>섹션 1</section>');

// 업데이트
helper.updateHeaderXML(updatedHeader);
helper.updateSectionsXML(updatedSections);

// 저장
await helper.saveChanges();
```

### 예제 3: 특정 섹션만 업데이트

```typescript
import { HWPXDocumentHelper } from './HWPXDocumentHelper';

const helper = new HWPXDocumentHelper();
await helper.openFile('document.hwpx');

// 첫 번째 섹션만 업데이트
helper.updateSectionXML(0, '<section>새로운 내용</section>');

// 저장
await helper.saveChanges();
```

## 주의사항

1. **파일 열기**: `openFile()` 또는 `serializer.open()`을 먼저 호출해야 합니다.
2. **XML 형식**: 섹션과 헤더는 유효한 XML 문자열이어야 합니다.
3. **인덱스**: 섹션 인덱스는 0부터 시작합니다.
4. **저장**: 변경사항을 반영하려면 반드시 `saveChanges()` 또는 `serializer.save()`를 호출해야 합니다.

## 문제 해결

### 문서에 변경사항이 반영되지 않는 경우

1. **저장 호출 확인**: `saveChanges()` 또는 `serializer.save()`가 호출되었는지 확인하세요.
2. **파일 경로 확인**: 저장 경로가 올바른지 확인하세요.
3. **콘솔 로그 확인**: "Header XML written" 또는 "Section X XML written" 로그가 출력되는지 확인하세요.
4. **XML 형식 확인**: 업데이트하는 XML이 유효한 형식인지 확인하세요.

### 디버깅

```typescript
const helper = new HWPXDocumentHelper();
await helper.openFile('document.hwpx');

// 현재 섹션 개수 확인
console.log('Section count:', helper.getSectionCount());

// 특정 섹션 XML 확인
console.log('Section 0:', helper.getSectionXML(0));

// 헤더 XML 확인
console.log('Header:', helper.getHeaderXML());
```

