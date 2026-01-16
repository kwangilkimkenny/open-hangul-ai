# HanView Project Knowledge MCP Server

이 프로젝트의 문서, 아키텍처, 구현 가이드를 AI에게 제공하는 MCP 서버입니다.

## 기능

### Resources (리소스)
- `project://readme` - 프로젝트 README
- `project://architecture` - 아키텍처 문서
- `project://deployment` - 배포 상태 및 가이드
- `project://phase1~5` - Phase별 구현 문서
- `project://production-*` - 프로덕션 테스트 및 수정 리포트

### Tools (도구)
- `search_project_docs` - 프로젝트 문서 키워드 검색
- `list_project_files` - 프로젝트 파일 목록 조회
- `get_project_structure` - 프로젝트 구조 트리 조회

### Prompts (프롬프트)
- `analyze-architecture` - 프로젝트 아키텍처 분석
- `review-phase` - 특정 Phase 리뷰
- `debug-production` - 프로덕션 이슈 디버깅
- `add-new-feature` - 새 기능 추가 가이드

## 설치

```bash
cd mcp-server
npm install
npm run build
```

## 사용 방법

### Claude Code에 추가

```bash
cd ~/Documents/project_03/hanview-react-app-v3
claude mcp add --scope project --transport stdio hanview-knowledge \
  -- node ./mcp-server/dist/index.js
```

또는 `.mcp.json`에 수동으로 추가:

```json
{
  "mcpServers": {
    "hanview-knowledge": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"]
    }
  }
}
```

### Claude Code에서 사용

**리소스 참조:**
```
> @hanview-knowledge:project://architecture를 참조해서 설명해줘
```

**도구 실행:**
```
> 프로젝트 문서에서 "pagination" 키워드를 검색해줘
```

**프롬프트 실행:**
```
> /mcp__hanview-knowledge__analyze-architecture
> /mcp__hanview-knowledge__review-phase 2
> /mcp__hanview-knowledge__add-new-feature "PDF 내보내기"
```

## 개발

```bash
# TypeScript 컴파일
npm run build

# 개발 모드 (컴파일 후 실행)
npm run dev

# 직접 실행
npm start
```

## 디버깅

```bash
# MCP 서버 목록 확인
claude mcp list

# 서버 상태 확인
claude mcp get hanview-knowledge

# 로그 확인 (Claude Code 내에서)
/mcp
```

## 확장

새로운 리소스, 도구, 프롬프트를 추가하려면 `src/index.ts`를 수정하고 다시 빌드하세요.

### 새 리소스 추가 예시

```typescript
const PROJECT_DOCS = [
  // ... 기존 문서들
  {
    uri: "project://my-new-doc",
    name: "My New Document",
    path: "docs/my-new-doc.md",
    description: "새로운 문서",
  },
];
```

### 새 도구 추가 예시

```typescript
{
  name: "my_new_tool",
  description: "새로운 도구",
  inputSchema: {
    type: "object",
    properties: {
      param: {
        type: "string",
        description: "파라미터"
      }
    },
    required: ["param"]
  }
}
```

## 문제 해결

### MCP 서버가 시작되지 않는 경우

1. TypeScript 컴파일 확인:
   ```bash
   npm run build
   ```

2. Node.js 경로 확인:
   ```bash
   which node
   ```

3. 의존성 재설치:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Claude Code에서 서버를 찾지 못하는 경우

1. 서버 등록 확인:
   ```bash
   claude mcp list
   ```

2. 서버 제거 후 재등록:
   ```bash
   claude mcp remove hanview-knowledge
   claude mcp add --scope project --transport stdio hanview-knowledge \
     -- node ./mcp-server/dist/index.js
   ```

3. Claude Code 재시작

## 라이선스

MIT
