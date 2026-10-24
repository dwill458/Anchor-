import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';

/**
 * Provider abstraction for Chart planning.
 *
 * Chart business logic only ever sees `ChartModelProvider`. Swapping or
 * reordering models is configuration: the primary is OpenAI when a key is
 * present, the fallback is the Gemini text model the backend already uses,
 * and failed plans surface through the existing retry/error path (see ChartPlannerService).
 */

export type ChartProviderName = 'openai' | 'gemini';

/** An image the model should look at. Bytes are held in memory for one request only. */
export type ChartModelImage = { mimeType: string; base64: string };

export type ChartModelTurn = { role: 'user' | 'assistant'; text: string };

export type ChartModelRequest = {
  /** Stable name for the structured-output schema (provider-side identifier). */
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  system: string;
  user: string;
  /** Optional reference photos sent alongside `user` (text-only requests omit this). */
  images?: ChartModelImage[];
  /** Earlier turns of a conversation, oldest first. `user` is always the newest turn. */
  history?: ChartModelTurn[];
  timeoutMs: number;
  temperature?: number;
};

export interface ChartModelProvider {
  readonly name: ChartProviderName;
  readonly model: string;
  /** Resolves to parsed JSON. Throws ChartProviderError on any failure. */
  generateJson(request: ChartModelRequest): Promise<unknown>;
  /**
   * Same contract as generateJson, but reports the raw JSON text accumulated so far through `onText`
   * while the model is still writing. Resolves to the parsed final object.
   */
  streamJson?(request: ChartModelRequest, onText: (accumulated: string) => void): Promise<unknown>;
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
    (error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      /aborted|timeout/i.test(error.message))
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

/** gpt-5 and o-series models only accept the default temperature; sending one is a 400. */
export function openAiTemperature(
  model: string,
  temperature: number | undefined
): { temperature?: number } {
  return temperature === undefined || /^(gpt-5|o\d)/.test(model) ? {} : { temperature };
}

/** Chat messages for OpenAI: system, earlier turns, then the newest user turn (with any images). */
export function toOpenAiMessages(request: ChartModelRequest): Array<Record<string, unknown>> {
  return [
    { role: 'system', content: request.system },
    ...(request.history ?? []).map(turn => ({ role: turn.role, content: turn.text })),
    {
      role: 'user',
      content: request.images?.length
        ? [
            { type: 'text', text: request.user },
            ...request.images.map(image => ({
              type: 'image_url',
              image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: 'low' },
            })),
          ]
        : request.user,
    },
  ];
}

/** Calls `onData` with the payload of every `data:` line of a server-sent-event body, however the chunks split. */
export async function readSseData(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let newline = pending.indexOf('\n');
    while (newline >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, '');
      pending = pending.slice(newline + 1);
      if (line.startsWith('data:')) onData(line.slice(5).trim());
      newline = pending.indexOf('\n');
    }
  }
  const last = pending.trim();
  if (last.startsWith('data:')) onData(last.slice(5).trim());
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
          ...openAiTemperature(this.model, request.temperature),
          messages: toOpenAiMessages(request),
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
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string | null; refusal?: string | null };
      }>;
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

  streamJson(request: ChartModelRequest, onText: (accumulated: string) => void): Promise<unknown> {
    return streamOpenAiJson(this, this.apiKey, this.baseUrl, request, onText);
  }
}

/** OpenAI streaming for the same structured request. Kept beside generateJson so both share one body shape. */
async function streamOpenAiJson(
  provider: OpenAiChartProvider,
  apiKey: string,
  baseUrl: string,
  request: ChartModelRequest,
  onText: (accumulated: string) => void
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(request.timeoutMs),
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        ...openAiTemperature(provider.model, request.temperature),
        messages: toOpenAiMessages(request),
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
    throw new ChartProviderError(isAbort(error) ? 'timeout' : 'unavailable', provider.name);
  }
  if (!response.ok) throw new ChartProviderError(classifyStatus(response.status), provider.name);
  if (!response.body) throw new ChartProviderError('empty', provider.name);
  let accumulated = '';
  let blocked = false;
  try {
    await readSseData(response.body, data => {
      if (!data || data === '[DONE]') return;
      let event: {
        choices?: Array<{
          finish_reason?: string;
          delta?: { content?: string | null; refusal?: string | null };
        }>;
      };
      try {
        event = JSON.parse(data);
      } catch {
        return;
      }
      const choice = event.choices?.[0];
      if (choice?.delta?.refusal || choice?.finish_reason === 'content_filter') blocked = true;
      const piece = choice?.delta?.content;
      if (piece) {
        accumulated += piece;
        onText(accumulated);
      }
    });
  } catch (error) {
    throw new ChartProviderError(isAbort(error) ? 'timeout' : 'unavailable', provider.name);
  }
  if (blocked) throw new ChartProviderError('safety_blocked', provider.name);
  return parseJson(accumulated, provider.name);
}

/** Gemini contents: earlier turns, then the newest user turn carrying any images. */
export function toGeminiContents(request: ChartModelRequest) {
  return [
    ...(request.history ?? []).map(turn => ({
      role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user' as const,
      parts: [
        { text: request.user },
        ...(request.images ?? []).map(image => ({
          inlineData: { mimeType: image.mimeType, data: image.base64 },
        })),
      ],
    },
  ];
}

export class GeminiChartProvider implements ChartModelProvider {
  readonly name = 'gemini' as const;
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateJson(request: ChartModelRequest): Promise<unknown> {
    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: toGeminiContents(request),
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

  async streamJson(
    request: ChartModelRequest,
    onText: (accumulated: string) => void
  ): Promise<unknown> {
    let accumulated = '';
    try {
      const stream = await this.client.models.generateContentStream({
        model: this.model,
        contents: toGeminiContents(request),
        config: {
          systemInstruction: request.system,
          temperature: request.temperature ?? 0.4,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
          abortSignal: AbortSignal.timeout(request.timeoutMs),
        },
      });
      for await (const chunk of stream) {
        if (chunk.promptFeedback?.blockReason)
          throw new ChartProviderError('safety_blocked', this.name);
        const piece = chunk.text;
        if (piece) {
          accumulated += piece;
          onText(accumulated);
        }
      }
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
    return parseJson(accumulated, this.name);
  }
}

// The route evaluation keeps 3/4/5+ distinct states with the planning summary;
// gpt-4.1-mini repeatedly compressed complex destinations or invented baselines.
export const DEFAULT_CHART_OPENAI_MODEL = 'gpt-5.4-mini';
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
export function resolveChartPlannerConfig(
  source: NodeJS.ProcessEnv = process.env
): ChartPlannerConfig {
  const providers: ChartModelProvider[] = [];
  const openAiKey = source.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    providers.push(
      new OpenAiChartProvider(
        openAiKey,
        source.CHART_OPENAI_MODEL?.trim() || DEFAULT_CHART_OPENAI_MODEL
      )
    );
  }
  const googleKey =
    source.GOOGLE_API_KEY?.trim() || source.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim();
  if (googleKey) {
    providers.push(
      new GeminiChartProvider(
        googleKey,
        source.CHART_GEMINI_MODEL?.trim() ||
          source.GOOGLE_SCENE_MODEL?.trim() ||
          DEFAULT_CHART_GEMINI_MODEL
      )
    );
  }
  return {
    providers,
    primaryTimeoutMs: positiveInt(source.CHART_AI_PRIMARY_TIMEOUT_MS, 20_000),
    fallbackTimeoutMs: positiveInt(source.CHART_AI_FALLBACK_TIMEOUT_MS, 15_000),
  };
}

/**
 * Chosen from scripts/evaluate-ask-chart.ts (2026-10-21, 8 models, 11 scripted turns each): gpt-5.4-mini gave specific,
 * well-paced coaching at ~2.3 s a turn and streams token by token; gpt-5.5 and the larger Gemini models read slightly
 * deeper but took 5 to 12 s a turn, too slow for chat. gemini-3.5-flash is the fallback (the flash-lite model was
 * fastest but offered a route before asking anything and claimed to have built one).
 */
export const DEFAULT_ASK_OPENAI_MODEL = 'gpt-5.4-mini';
export const DEFAULT_ASK_GEMINI_MODEL = 'gemini-3.5-flash';

export type AskChartConfig = {
  providers: ChartModelProvider[];
  primaryTimeoutMs: number;
  fallbackTimeoutMs: number;
};

/**
 * Conversation turns use their own model settings so they can be tuned (or upgraded) without touching route
 * generation. Defaults are the evaluated choices below.
 *   CHART_ASK_OPENAI_MODEL, CHART_ASK_GEMINI_MODEL, CHART_ASK_PROVIDER_ORDER ("openai,gemini" | "gemini,openai"),
 *   CHART_ASK_PRIMARY_TIMEOUT_MS, CHART_ASK_FALLBACK_TIMEOUT_MS
 */
export function resolveAskChartConfig(source: NodeJS.ProcessEnv = process.env): AskChartConfig {
  const byName = new Map<ChartProviderName, ChartModelProvider>();
  const openAiKey = source.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    byName.set(
      'openai',
      new OpenAiChartProvider(
        openAiKey,
        source.CHART_ASK_OPENAI_MODEL?.trim() || DEFAULT_ASK_OPENAI_MODEL
      )
    );
  }
  const googleKey = env.GOOGLE_API_KEY?.trim();
  if (googleKey) {
    byName.set(
      'gemini',
      new GeminiChartProvider(
        googleKey,
        source.CHART_ASK_GEMINI_MODEL?.trim() || DEFAULT_ASK_GEMINI_MODEL
      )
    );
  }
  const order = (source.CHART_ASK_PROVIDER_ORDER?.split(',') ?? ['openai', 'gemini'])
    .map(name => name.trim() as ChartProviderName)
    .filter(name => name === 'openai' || name === 'gemini');
  const providers = [...new Set(order)].flatMap(name =>
    byName.has(name) ? [byName.get(name)!] : []
  );
  return {
    providers,
    primaryTimeoutMs: positiveInt(source.CHART_ASK_PRIMARY_TIMEOUT_MS, 25_000),
    fallbackTimeoutMs: positiveInt(source.CHART_ASK_FALLBACK_TIMEOUT_MS, 20_000),
  };
}
