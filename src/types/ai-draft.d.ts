/**
 * AI Draft — Vertex AI / Gemini 기반 장문 초안 생성 타입
 */

import type { HWPXDocument } from './hwpx';

export type VertexModel =
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

export interface ReferenceDoc {
  fileId: string;
  fileName: string;
  mimeType: string;
  tokenCount: number;
  text: string;
  uploadedAt: string;
}

export interface DraftRequest {
  prompt: string;
  references: ReferenceDoc[];
  templateId?: string;
  model?: VertexModel;
  temperature?: number;
  maxOutputTokens?: number;
}

export type DraftStreamEvent =
  | { type: 'start'; requestId: string; model: VertexModel; budget: TokenBudget }
  | { type: 'delta'; text: string }
  | { type: 'section'; section: unknown }
  | { type: 'usage'; promptTokens: number; outputTokens: number }
  | { type: 'done'; document: HWPXDocument; tokensUsed: number }
  | { type: 'error'; code: string; message: string };

export interface TokenBudget {
  model: VertexModel;
  contextLimit: number;
  promptTokens: number;
  referenceTokens: number;
  reservedForOutput: number;
  remaining: number;
  overflow: boolean;
}

export type DraftStatus = 'idle' | 'preparing' | 'generating' | 'completed' | 'cancelled' | 'failed';

export interface DraftVersion {
  id: string;
  createdAt: string;
  document: HWPXDocument;
  tokensUsed: number;
  model: VertexModel;
  prompt: string;
  parentVersionId?: string;
}

export interface DraftSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  references: ReferenceDoc[];
  versions: DraftVersion[];
  status: DraftStatus;
  error?: string;
}
