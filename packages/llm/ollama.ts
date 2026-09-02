/**
 * The only module that knows we are talking to Ollama (DECISIONS.md D1).
 *
 * Two Ollama behaviours this exists to contain:
 *
 *   `num_ctx` defaults low. When the prompt exceeds it, Ollama truncates from
 *   the *start* and reports nothing — so the system prompt is what disappears,
 *   and the symptom is a model that appears to ignore its instructions.
 *   `complete()` compares the reported prompt token count against the window and
 *   throws rather than returning a quietly degraded answer.
 *
 *   `format` takes a JSON Schema and constrains decoding to it. That guarantees
 *   the shape and nothing about the content, so every response is validated by
 *   Zod afterwards.
 */

import { Ollama } from "ollama";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const MODEL = process.env.GRANT_AI_MODEL ?? "qwen3:4b";
export const NUM_CTX = Number(process.env.GRANT_AI_NUM_CTX ?? 16384);
export const SEED = Number(process.env.GRANT_AI_SEED ?? 7);
const HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

export class RuntimeUnavailable extends Error {}
export class ContextOverflow extends Error {}

export type Usage = {
  model: string;
  numCtx: number;
  seed: number;
  think: boolean;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type Completion<T> = {
  parsed: T | null;
  raw: string;
  usage: Usage;
  error: string | null;
};

const client = new Ollama({ host: HOST });

/** Fail early and legibly if Ollama is down or the model is not pulled. */
export async function checkRuntime(model: string = MODEL): Promise<void> {
  let available: string[];
  try {
    const list = await client.list();
    available = list.models.map((m) => m.name);
  } catch (err) {
    throw new RuntimeUnavailable(
      `Cannot reach Ollama at ${HOST}. Start it, then retry. (${String(err)})`,
    );
  }

  const wanted = model.includes(":") ? model : `${model}:latest`;
  if (!available.includes(wanted)) {
    throw new RuntimeUnavailable(
      `Model "${model}" is not pulled. Run:  ollama pull ${model}\n` +
        `Available: ${available.join(", ") || "(none)"}`,
    );
  }
}

export type CompleteOptions = {
  model?: string;
  numCtx?: number;
  seed?: number;
  temperature?: number;
  /**
   * Qwen3 reasons before answering when this is on. It costs time and tokens —
   * material on a 4GB card — but the eligibility judgement is exactly the kind
   * of task where it may pay for itself. Recorded in the usage so a score can be
   * attributed to it.
   */
  think?: boolean;
};

/**
 * One schema-constrained completion.
 *
 * `temperature` is 0 and `seed` fixed by default: a verdict is not a creative
 * task, and a score that moves between identical runs cannot be attributed to
 * anything.
 */
export async function complete<S extends z.ZodTypeAny>(
  system: string,
  user: string,
  schema: S,
  opts: CompleteOptions = {},
): Promise<Completion<z.infer<S>>> {
  const model = opts.model ?? MODEL;
  const numCtx = opts.numCtx ?? NUM_CTX;
  const seed = opts.seed ?? SEED;
  const think = opts.think ?? false;
  const started = Date.now();

  const request = () =>
    client.chat({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      format: zodToJsonSchema(schema, { target: "openApi3" }) as object,
      think,
      options: {
        num_ctx: numCtx,
        temperature: opts.temperature ?? 0,
        seed,
      },
    });

  // `TypeError: fetch failed` under load — Ollama serves one request at a time,
  // and the nightly chain and the editor can arrive at once. The call is not
  // cheap to lose: a dropped eligibility pair is a grant silently unassessed
  // until someone notices the count. So a transient connection error is retried
  // with a short backoff; a real error (bad request, model missing) is not,
  // because retrying it just wastes the window.
  let response;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await request();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt === 3 || !isTransient(err)) break;
      await sleep(attempt * 2000);
    }
  }

  if (!response) {
    return {
      parsed: null,
      raw: "",
      usage: {
        model,
        numCtx,
        seed,
        think,
        promptTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - started,
      },
      error: `ollama: ${String(lastErr)}`,
    };
  }

  const usage: Usage = {
    model,
    numCtx,
    seed,
    think,
    promptTokens: response.prompt_eval_count ?? 0,
    outputTokens: response.eval_count ?? 0,
    latencyMs: Date.now() - started,
  };

  // Truncation is silent on Ollama's side, so a prompt that filled the window is
  // a hard failure rather than a degraded answer to be used anyway.
  if (usage.promptTokens >= numCtx) {
    throw new ContextOverflow(
      `Prompt used ${usage.promptTokens} tokens against num_ctx=${numCtx}. ` +
        `Ollama truncates from the start of the prompt, so the system prompt was ` +
        `cut. Raise GRANT_AI_NUM_CTX or shorten the input.`,
    );
  }

  const raw = response.message.content ?? "";
  const result = schema.safeParse(safeJson(raw));

  return {
    parsed: result.success ? result.data : null,
    raw,
    usage,
    error: result.success
      ? null
      : `schema validation failed: ${result.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")}`,
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A connection-level failure worth retrying, not a rejected request.
 *
 * `fetch failed` and the socket errors under it (`ECONNRESET`, `ECONNREFUSED`,
 * `UND_ERR_*`) mean the model was busy or restarting. A 4xx-shaped error from
 * Ollama — a missing model, a malformed request — will fail again the same way.
 */
function isTransient(err: unknown): boolean {
  const s = String(
    err instanceof Error ? `${err.message} ${(err as { cause?: unknown }).cause ?? ""}` : err,
  ).toLowerCase();
  return (
    s.includes("fetch failed") ||
    s.includes("econnreset") ||
    s.includes("econnrefused") ||
    s.includes("und_err") ||
    s.includes("socket") ||
    s.includes("timeout") ||
    s.includes("network")
  );
}
