import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';

/**
 * Provider abstraction for Chart planning.
 *
 * Chart business logic only ever sees `ChartModelProvider`. Swapping or
 * reordering models is configuration: the primary is OpenAI when a key is
 * present, the fallback is the Gemini text model the backend already uses,
 * and the deterministic template path sits behind both (see ChartPlannerService).
 */

export type ChartProviderName = 'openai' | 'gemini';

export type ChartModelRequest = {
  /** Stable name for the structured-output schema (provider-side identifier). */
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  system: string;
  user: string;
  timeoutMs: number;
  temperature?: number;
};

export interface ChartModelProvider {
  readonly name: ChartProviderName;
  readonly model: string;
  /** Resolves to parsed JSON. Throws ChartProviderError on any failure. */
  generateJson(request: ChartModelRequest): Promise<unknown>;
}

export type ChartProviderFailure =
  | 'timeout'
  | 'rate_limited'
  | 'unavailable'
  | 'auth'
  | 'request'
  | 'safety_blocked'
  | 'empty'
  | 'malformed_json';

export class ChartProviderError extends Error {
  constructor(
    readonly failure: ChartProviderFailure,
    readonly provider: ChartProviderName
  ) {
    super(`chart_provider_${failure}`);
    this.name = 'ChartProviderError';
  }

  /** Only fast, transient failures are worth one retry inside a user action. */
  get retryable(): boolean {
    return this.failure === 'rate_limited' || this.failure === 'unavailable';
  }
}

function classifyStatus(status: number | undefined): ChartProviderFailure {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth';
  if (status !== undefined && status >= 500) return 'unavailable';
  return 'request';
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError' || /aborted|timeout/i.test(error.message))
  );
}

function parseJson(text: string | null | undefined, provider: ChartProviderName): unknown {
  if (!text || !text.trim()) throw new ChartProviderError('empty', provider);
  try {
    return JSON.parse(text);
  } catch {
    throw new ChartProviderError('malformed_json', provider);
  }
}

/**
 * OpenAI's strict structured outputs reject `type: [...]` on objects, so the
 * nullable-object form is rewritten as anyOf. Primitive nullables are allowed.
 */
export function toOpenAiStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toOpenAiStrictSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const node = { ...(schema as Record<string, unknown>) };
  for (const key of Object.keys(node)) node[key] = toOpenAiStrictSchema(node[key]);
  const type = node.type;
  if (Array.isArray(type) && type.includes('object') && type.includes('null')) {
    const { type: _omit, ...objectSchema } = node;
    return { anyOf: [{ ...objectSchema, type: 'object' }, { type: 'null' }] };
  }
  return node;
}

export class OpenAiChartProvider implements ChartModelProvider {
  readonly name = 'openai' as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl = 'https://api.openai.com/v1'
  ) {}

  async generateJson(request: ChartModelRequest): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(request.timeoutMs),
        body: JSON.stringify({
          model: this.model,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: request.schemaName,
              strict: true,
              schema: toOpenAiStrictSchema(request.jsonSchema),
            },
          },
        }),
      });
    } catch (error) {
      throw new ChartProviderError(isAbort(error) ? 'timeout' : 'unavailable', this.name);
    }
    if (!response.ok) throw new ChartProviderError(classifyStatus(response.status), this.name);
    let body: {
      choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }>;
    };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new ChartProviderError('malformed_json', this.name);
    }
    const choice = body.choices?.[0];
    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
      throw new ChartProviderError('safety_blocked', this.name);
    }
    return parseJson(choice?.message?.content, this.name);
  }
}

export class GeminiChartProvider implements ChartModelProvider {
  readonly name = 'gemini' as const;
  private readonly client: GoogleGenAI;

  constructor(apiKey: string, readonly model: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateJson(request: ChartModelRequest): Promise<unknown> {
    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: request.user }] }],
        config: {
          systemInstruction: request.system,
          temperature: request.temperature ?? 0.4,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
          abortSignal: AbortSignal.timeout(request.timeoutMs),
        },
      });
      if (response.promptFeedback?.blockReason) {
        throw new ChartProviderError('safety_blocked', this.name);
      }
      text = response.text;
    } catch (error) {
      if (error instanceof ChartProviderError) throw error;
      if (isAbort(error)) throw new ChartProviderError('timeout', this.name);
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
      throw new ChartProviderError(
        Number.isFinite(status) ? classifyStatus(status) : 'unavailable',
        this.name
      );
    }
    return parseJson(text, this.name);
  }
}

export const DEFAULT_CHART_OPENAI_MODEL = 'gpt-4.1-mini';
export const DEFAULT_CHART_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export type ChartPlannerConfig = {
  providers: ChartModelProvider[];
  primaryTimeoutMs: number;
  fallbackTimeoutMs: number;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

/**
 * Provider order is resolved from configuration, never hardcoded into Chart
 * logic. Reports model names only (never keys) so it is safe to log.
 */
export function resolveChartPlannerConfig(source: NodeJS.ProcessEnv = process.env): ChartPlannerConfig {
  const providers: ChartModelProvider[] = [];
  const openAiKey = source.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    providers.push(
      new OpenAiChartProvider(openAiKey, source.CHART_OPENAI_MODEL?.trim() || DEFAULT_CHART_OPENAI_MODEL)
    );
  }
  const googleKey = env.GOOGLE_API_KEY?.trim();
  if (googleKey) {
    providers.push(
      new GeminiChartProvider(
        googleKey,
        source.CHART_GEMINI_MODEL?.trim() || source.GOOGLE_SCENE_MODEL?.trim() || DEFAULT_CHART_GEMINI_MODEL
      )
    );
  }
  return {
    providers,
    primaryTimeoutMs: positiveInt(source.CHART_AI_PRIMARY_TIMEOUT_MS, 20_000),
    fallbackTimeoutMs: positiveInt(source.CHART_AI_FALLBACK_TIMEOUT_MS, 15_000),
  };
}
