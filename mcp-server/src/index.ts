#!/usr/bin/env node
/**
 * HanView Project Knowledge MCP Server
 *
 * 프로젝트 문서, 아키텍처, 구현 가이드를 AI에게 제공하는 MCP 서버
 *
 * @version 1.0.0
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 프로젝트 루트 경로 (dist에서 2단계 상위가 프로젝트 루트)
const PROJECT_ROOT = path.resolve(__dirname, "../..");

/**
 * MCP Server 초기화
 */
const server = new Server(
  {
    name: "hanview-project-knowledge",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * 프로젝트 문서 리스트
 */
const PROJECT_DOCS = [
  {
    uri: "project://readme",
    name: "README",
    path: "README.md",
    description: "프로젝트 개요 및 시작 가이드",
  },
  {
    uri: "project://architecture",
    name: "Architecture",
    path: "ARCHITECTURE.md",
    description: "프로젝트 아키텍처 문서",
  },
  {
    uri: "project://deployment",
    name: "Deployment Status",
    path: "DEPLOYMENT_STATUS.md",
    description: "현재 배포 상태 및 가이드",
  },
  {
    uri: "project://docker-guide",
    name: "Docker Deployment Guide",
    path: "DOCKER_DEPLOYMENT_INSTRUCTIONS.md",
    description: "Docker 배포 가이드",
  },
  {
    uri: "project://test-guide",
    name: "Browser Test Guide",
    path: "QUICK_BROWSER_TEST.md",
    description: "브라우저 테스트 가이드",
  },
  {
    uri: "project://phase1",
    name: "Phase 1: Advanced Text Input",
    path: "Phase_1_Advanced_Text_Input.md",
    description: "Phase 1 구현: 고급 텍스트 입력",
  },
  {
    uri: "project://phase2",
    name: "Phase 2: Undo/Redo System",
    path: "Phase_2_Undo_Redo_System.md",
    description: "Phase 2 구현: Undo/Redo 시스템",
  },
  {
    uri: "project://phase3",
    name: "Phase 3: File Compatibility",
    path: "Phase_3_File_Compatibility.md",
    description: "Phase 3 구현: 파일 호환성",
  },
  {
    uri: "project://phase4",
    name: "Phase 4: Auto Pagination",
    path: "Phase_4_Auto_Pagination.md",
    description: "Phase 4 구현: 자동 페이지네이션",
  },
  {
    uri: "project://phase5",
    name: "Phase 5: Integration & QA",
    path: "Phase_5_Integration_QA.md",
    description: "Phase 5 구현: 통합 및 QA",
  },
  {
    uri: "project://production-test",
    name: "Production Test Report",
    path: "PRODUCTION_TEST_REPORT.md",
    description: "프로덕션 빌드 테스트 결과",
  },
  {
    uri: "project://production-fix",
    name: "Production Fix Report",
    path: "PRODUCTION_FIX_REPORT.md",
    description: "프로덕션 빌드 수정 리포트",
  },
  {
    uri: "project://final-test",
    name: "Final Test Confirmation",
    path: "FINAL_TEST_CONFIRMATION.md",
    description: "최종 테스트 확인서",
  },
];

/**
 * Resources 목록 반환
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: PROJECT_DOCS.map((doc) => ({
      uri: doc.uri,
      name: doc.name,
      description: doc.description,
      mimeType: "text/markdown",
    })),
  };
});

/**
 * Resource 읽기
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const doc = PROJECT_DOCS.find((d) => d.uri === uri);

  if (!doc) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  try {
    const filePath = path.join(PROJECT_ROOT, doc.path);
    const content = await fs.readFile(filePath, "utf-8");

    return {
      contents: [
        {
          uri: uri,
          mimeType: "text/markdown",
          text: content,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to read ${doc.path}: ${error}`);
  }
});

/**
 * Tools 목록 반환
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_project_docs",
        description:
          "프로젝트 문서에서 키워드를 검색합니다. 대소문자 구분 없이 검색합니다.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "검색할 키워드",
            },
          },
          required: ["keyword"],
        },
      },
      {
        name: "list_project_files",
        description:
          "프로젝트 내 특정 디렉토리의 파일 목록을 반환합니다.",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description:
                "검색할 디렉토리 (예: 'src/lib', 'src/components')",
              default: ".",
            },
            pattern: {
              type: "string",
              description: "파일 패턴 (예: '*.ts', '*.tsx')",
              default: "*",
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "get_project_structure",
        description: "프로젝트의 디렉토리 구조를 트리 형태로 반환합니다.",
        inputSchema: {
          type: "object",
          properties: {
            maxDepth: {
              type: "number",
              description: "표시할 최대 깊이 (기본값: 3)",
              default: 3,
            },
          },
        },
      },
    ],
  };
});

/**
 * Tool 실행
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_project_docs") {
    const keyword = ((args?.keyword as string) || "").toLowerCase();
    const results: string[] = [];

    for (const doc of PROJECT_DOCS) {
      try {
        const filePath = path.join(PROJECT_ROOT, doc.path);
        const content = await fs.readFile(filePath, "utf-8");

        if (content.toLowerCase().includes(keyword)) {
          // 키워드가 포함된 라인 찾기
          const lines = content.split("\n");
          const matchingLines = lines
            .map((line, idx) => ({ line, idx }))
            .filter(({ line }) => line.toLowerCase().includes(keyword))
            .slice(0, 3); // 각 파일당 최대 3개 라인

          results.push(`\n**${doc.name}** (${doc.path}):`);
          matchingLines.forEach(({ line, idx }) => {
            results.push(`  Line ${idx + 1}: ${line.trim()}`);
          });
        }
      } catch (error) {
        // 파일 읽기 실패 시 무시
      }
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `"${keyword}" 키워드가 프로젝트 문서에서 발견되지 않았습니다.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `"${keyword}" 검색 결과:\n${results.join("\n")}`,
        },
      ],
    };
  }

  if (name === "list_project_files") {
    const directory = (args?.directory as string) || ".";
    const pattern = (args?.pattern as string) || "*";

    try {
      const dirPath = path.join(PROJECT_ROOT, directory);
      const files = await fs.readdir(dirPath);

      // 패턴 매칭 (간단한 구현)
      const matchedFiles = files.filter((file) => {
        if (pattern === "*") return true;
        if (pattern.startsWith("*.")) {
          const ext = pattern.slice(1);
          return file.endsWith(ext);
        }
        return file.includes(pattern);
      });

      return {
        content: [
          {
            type: "text",
            text: `${directory} 디렉토리의 파일 목록:\n${matchedFiles.map((f) => `  - ${f}`).join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `디렉토리를 읽을 수 없습니다: ${error}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "get_project_structure") {
    const maxDepth = (args?.maxDepth as number) || 3;

    const buildTree = async (
      dir: string,
      prefix: string = "",
      depth: number = 0
    ): Promise<string[]> => {
      if (depth >= maxDepth) return [];

      const lines: string[] = [];
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        // node_modules, dist, .git 제외
        const filtered = entries.filter(
          (entry) =>
            !["node_modules", "dist", ".git", ".vite"].includes(entry.name)
        );

        for (let i = 0; i < filtered.length; i++) {
          const entry = filtered[i];
          const isLast = i === filtered.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const extension = isLast ? "    " : "│   ";

          lines.push(`${prefix}${connector}${entry.name}`);

          if (entry.isDirectory()) {
            const subLines = await buildTree(
              path.join(dir, entry.name),
              prefix + extension,
              depth + 1
            );
            lines.push(...subLines);
          }
        }
      } catch (error) {
        // 디렉토리 읽기 실패 시 무시
      }

      return lines;
    };

    const tree = await buildTree(PROJECT_ROOT);
    return {
      content: [
        {
          type: "text",
          text: `프로젝트 구조 (최대 깊이: ${maxDepth}):\n.\n${tree.join("\n")}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

/**
 * Prompts 목록 반환
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "analyze-architecture",
        description: "프로젝트 아키텍처를 분석하고 설명합니다",
      },
      {
        name: "review-phase",
        description: "특정 Phase의 구현 내용을 리뷰합니다",
        arguments: [
          {
            name: "phase",
            description: "리뷰할 Phase 번호 (1-5)",
            required: true,
          },
        ],
      },
      {
        name: "debug-production",
        description: "프로덕션 이슈 디버깅을 가이드합니다",
      },
      {
        name: "add-new-feature",
        description: "새로운 기능 추가 가이드를 제공합니다",
        arguments: [
          {
            name: "feature_name",
            description: "추가할 기능 이름",
            required: true,
          },
        ],
      },
    ],
  };
});

/**
 * Prompt 반환
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "analyze-architecture") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `프로젝트의 아키텍처를 분석해주세요. 다음 리소스를 참조하세요:
- @hanview-project-knowledge:project://architecture
- @hanview-project-knowledge:project://readme

다음 내용을 포함해주세요:
1. 전체 시스템 구조
2. 주요 모듈과 역할
3. 데이터 흐름
4. 설계 결정사항`,
          },
        },
      ],
    };
  }

  if (name === "review-phase") {
    const phase = args?.phase || "1";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Phase ${phase}의 구현 내용을 리뷰해주세요. 다음 리소스를 참조하세요:
- @hanview-project-knowledge:project://phase${phase}

다음 내용을 포함해주세요:
1. 구현된 기능 목록
2. 핵심 기술적 결정사항
3. 테스트 결과
4. 개선 가능한 부분`,
          },
        },
      ],
    };
  }

  if (name === "debug-production") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `프로덕션 이슈를 디버깅하기 위해 다음 리소스를 참조하세요:
- @hanview-project-knowledge:project://production-fix
- @hanview-project-knowledge:project://production-test
- @hanview-project-knowledge:project://deployment

이전에 발생했던 이슈와 해결 방법을 확인하고, 현재 이슈와 유사한 패턴이 있는지 분석해주세요.`,
          },
        },
      ],
    };
  }

  if (name === "add-new-feature") {
    const featureName = args?.feature_name || "새 기능";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `"${featureName}" 기능을 추가하려고 합니다. 다음 리소스를 참조해서 가이드해주세요:
- @hanview-project-knowledge:project://architecture
- @hanview-project-knowledge:project://phase1
- @hanview-project-knowledge:project://phase2

다음 내용을 포함해주세요:
1. 추가할 위치 (어느 모듈/컴포넌트)
2. 기존 패턴 준수 방법
3. 필요한 파일 목록
4. 테스트 계획`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

/**
 * 서버 시작
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 에러 핸들링
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
