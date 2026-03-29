// ============================================================
// AEGIS Express Middleware — input/output guard for LLM proxies
// ============================================================

import type { AegisConfig } from '../core/config';
import { AegisClient, type JudgeResponse } from './aegis-client';

export interface AegisMiddlewareOptions extends AegisConfig {
  /** Enable input (pre-LLM) check. Default: true */
  inputCheck?: boolean;
  /** Enable output (post-LLM) check. Default: true */
  outputCheck?: boolean;
  /** Enable PII scanning. Default: true */
  piiScan?: boolean;
  /** Scenario identifier. Default: 'document_editor' */
  scenario?: string;
}

// Minimal Express-compatible types to avoid requiring @types/express
interface Request {
  body?: Record<string, unknown>;
  method?: string;
  path?: string;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
  locals?: Record<string, unknown>;
  headersSent?: boolean;
  // For response interception
  write?(chunk: unknown, encoding?: string, callback?: () => void): boolean;
  end?(chunk?: unknown, encoding?: string, callback?: () => void): void;
}

type NextFunction = (err?: unknown) => void;

/**
 * Extract the user prompt from common request body formats.
 */
function extractPrompt(body: Record<string, unknown> | undefined): string | null {
  if (!body) return null;

  // Direct prompt field
  if (typeof body.prompt === 'string') return body.prompt;

  // OpenAI-style messages array
  if (Array.isArray(body.messages)) {
    const messages = body.messages as Array<Record<string, unknown>>;
    // Get the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && typeof messages[i].content === 'string') {
        return messages[i].content as string;
      }
    }
  }

  // Content field
  if (typeof body.content === 'string') return body.content;

  // Input field
  if (typeof body.input === 'string') return body.input;

  // Query field
  if (typeof body.query === 'string') return body.query;

  return null;
}

/**
 * Full AEGIS middleware: pre-check input, pass through, post-check output.
 *
 * Usage:
 *   app.use('/api/ai/chat', aegisMiddleware({ apiKey: 'aegis_sk_...', serverUrl: '...' }));
 *
 * Behavior:
 * 1. Pre-check: POST /v1/judge with user's prompt. BLOCK returns 422.
 * 2. Pass-through: calls next() to let the actual handler run.
 * 3. Post-check: if outputCheck is enabled, intercepts the response body,
 *    checks it, and filters if needed.
 * 4. Attaches aegis metadata to res.locals.aegis.
 */
export function aegisMiddleware(options: AegisMiddlewareOptions): any {
  const client = new AegisClient({
    serverUrl: options.serverUrl,
    apiKey: options.apiKey,
    timeout: options.timeout ?? 3000,
    failPolicy: options.failPolicy ?? 'close',
  });

  const inputCheckEnabled = options.inputCheck !== false;
  const outputCheckEnabled = options.outputCheck !== false;
  const piiScanEnabled = options.piiScan !== false;
  const scenario = options.scenario ?? 'document_editor';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Initialize aegis metadata on response
    if (!res.locals) res.locals = {};
    res.locals.aegis = {
      inputCheck: null as JudgeResponse | null,
      outputCheck: null as JudgeResponse | null,
      blocked: false,
    };

    // --- Step 1: Input check ---
    if (inputCheckEnabled) {
      const prompt = extractPrompt(req.body);

      if (prompt) {
        try {
          const result = await client.checkInput(prompt, {
            scenario,
            enablePiiScan: piiScanEnabled,
            enableInjectionDetect: true,
            provider: options.provider,
          });

          (res.locals.aegis as Record<string, unknown>).inputCheck = result;

          if (result.decision === 'BLOCK') {
            (res.locals.aegis as Record<string, unknown>).blocked = true;
            res.status(422).json({
              error: 'AEGIS_BLOCKED',
              message: 'Content blocked by AEGIS safety check',
              decision: result.decision,
              risks: result.risks,
              confidence: result.confidence,
            });
            return;
          }

          // If MODIFY, replace the prompt in the request body
          if (result.decision === 'MODIFY' && result.modifiedContent && req.body) {
            if (typeof req.body.prompt === 'string') {
              req.body.prompt = result.modifiedContent;
            } else if (Array.isArray(req.body.messages)) {
              const messages = req.body.messages as Array<Record<string, unknown>>;
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                  messages[i].content = result.modifiedContent;
                  break;
                }
              }
            }
          }
        } catch (err: unknown) {
          // On error, respect fail policy
          if ((options.failPolicy ?? 'close') === 'close') {
            res.status(503).json({
              error: 'AEGIS_SERVICE_ERROR',
              message: 'AEGIS safety check unavailable, blocking by policy',
            });
            return;
          }
          // fail-open: continue without check
        }
      }
    }

    // --- Step 2: Pass through to next handler ---
    if (!outputCheckEnabled) {
      next();
      return;
    }

    // --- Step 3: Intercept response for output check ---
    const originalJson = res.json.bind(res);
    let intercepted = false;

    res.json = ((body: unknown): void => {
      if (intercepted || res.headersSent) {
        originalJson(body);
        return;
      }
      intercepted = true;

      // Extract output content from response body
      const output = extractOutputContent(body);

      if (!output) {
        originalJson(body);
        return;
      }

      const prompt = extractPrompt(req.body) ?? undefined;

      client
        .checkOutput(output, prompt)
        .then((result) => {
          (res.locals!.aegis as Record<string, unknown>).outputCheck = result;

          if (result.decision === 'BLOCK') {
            (res.locals!.aegis as Record<string, unknown>).blocked = true;
            originalJson({
              ...(typeof body === 'object' && body !== null ? body : {}),
              _aegis: {
                decision: result.decision,
                filtered: true,
                risks: result.risks,
              },
              content: '[Content filtered by AEGIS safety system]',
            });
          } else if (result.decision === 'MODIFY' && result.modifiedContent) {
            const modified =
              typeof body === 'object' && body !== null
                ? { ...body, content: result.modifiedContent }
                : { content: result.modifiedContent };
            (modified as Record<string, unknown>)._aegis = {
              decision: result.decision,
              modified: true,
            };
            originalJson(modified);
          } else {
            // APPROVE or other — pass through with metadata
            const enriched =
              typeof body === 'object' && body !== null
                ? { ...body }
                : { content: body };
            (enriched as Record<string, unknown>)._aegis = {
              decision: result.decision,
              confidence: result.confidence,
            };
            originalJson(enriched);
          }
        })
        .catch(() => {
          // Output check failed — apply fail policy
          if ((options.failPolicy ?? 'close') === 'close') {
            originalJson({
              content: '[Content filtered by AEGIS safety system — service error]',
              _aegis: { error: true, failPolicy: 'close' },
            });
          } else {
            originalJson(body);
          }
        });
    }) as any;

    next();
  };
}

/**
 * Standalone input check middleware.
 * Only performs pre-LLM input validation, then calls next().
 */
export function checkInputMiddleware(options: AegisMiddlewareOptions): any {
  return aegisMiddleware({
    ...options,
    inputCheck: true,
    outputCheck: false,
  });
}

/**
 * Standalone output check middleware.
 * Only performs post-LLM output validation.
 */
export function checkOutputMiddleware(options: AegisMiddlewareOptions): any {
  return aegisMiddleware({
    ...options,
    inputCheck: false,
    outputCheck: true,
  });
}

/**
 * Extract text content from various LLM response body formats.
 */
function extractOutputContent(body: unknown): string | null {
  if (typeof body === 'string') return body;
  if (!body || typeof body !== 'object') return null;

  const obj = body as Record<string, unknown>;

  // Direct content field
  if (typeof obj.content === 'string') return obj.content;

  // OpenAI-style: choices[0].message.content
  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const choice = obj.choices[0] as Record<string, unknown>;
    if (choice.message && typeof (choice.message as Record<string, unknown>).content === 'string') {
      return (choice.message as Record<string, unknown>).content as string;
    }
    if (typeof choice.text === 'string') return choice.text;
  }

  // Response field
  if (typeof obj.response === 'string') return obj.response;

  // Output field
  if (typeof obj.output === 'string') return obj.output;

  // Text field
  if (typeof obj.text === 'string') return obj.text;

  return null;
}
