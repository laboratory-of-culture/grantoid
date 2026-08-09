"""The only module that knows we are talking to Ollama.

Everything upstream asks for "a structured answer to this prompt" and gets a
validated Pydantic object back. Swapping the runtime later — a bigger local
model, a hosted API for the eligibility step — is a change here and nowhere else.

Two Ollama behaviours this module exists to contain:

*   ``num_ctx`` defaults low. When the prompt exceeds it, Ollama truncates from
    the *start* of the prompt and reports nothing. The system prompt is what
    disappears first, so the symptom is a model that seems to ignore its
    instructions. ``complete()`` compares the reported prompt token count against
    the window and raises instead of returning a quietly degraded answer.
*   ``format`` takes a JSON Schema and constrains decoding to it. That guarantees
    the shape, not the content, so every response is still validated by Pydantic.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Optional, Type, TypeVar

import ollama
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

# qwen3:4b is the default because it fits a 4GB card with room for a real context
# window and handles Ukrainian noticeably better than the Llama 3 8B generation.
# Override for a sweep: set GRANT_AI_MODEL.
MODEL = os.environ.get("GRANT_AI_MODEL", "qwen3:4b")
NUM_CTX = int(os.environ.get("GRANT_AI_NUM_CTX", "16384"))
SEED = int(os.environ.get("GRANT_AI_SEED", "7"))
HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")


class RuntimeUnavailable(RuntimeError):
    """Ollama is not reachable, or the requested model is not pulled."""


class ContextOverflow(RuntimeError):
    """The prompt did not fit the context window and was silently truncated."""


@dataclass
class LLMResult:
    """A parsed answer plus everything needed to attribute it later."""

    parsed: Optional[BaseModel]
    model: str
    num_ctx: int
    seed: int
    prompt_tokens: int
    output_tokens: int
    latency_s: float
    raw: str
    error: Optional[str] = None


def _client() -> ollama.Client:
    return ollama.Client(host=HOST)


def check_runtime(model: str = MODEL) -> None:
    """Fail early and legibly if Ollama is down or the model is not pulled."""
    try:
        available = {m.model for m in _client().list().models}
    except Exception as exc:  # noqa: BLE001 — surface anything as one clear message
        raise RuntimeUnavailable(
            f"Cannot reach Ollama at {HOST}. Start it, then retry. ({exc})"
        ) from exc

    # Ollama reports tags as "name:tag"; accept a bare name as its :latest tag.
    wanted = model if ":" in model else f"{model}:latest"
    if wanted not in available:
        raise RuntimeUnavailable(
            f"Model {model!r} is not pulled. Run:  ollama pull {model}\n"
            f"Currently available: {', '.join(sorted(available)) or '(none)'}"
        )


def complete(
    system: str,
    user: str,
    schema: Type[T],
    *,
    model: str = MODEL,
    num_ctx: int = NUM_CTX,
    seed: int = SEED,
    temperature: float = 0.0,
) -> LLMResult:
    """Ask for one schema-constrained answer.

    ``temperature`` is 0 and ``seed`` is fixed by default: verdict assessment is
    not a creative task, and a score that moves between identical runs cannot be
    attributed to anything.
    """
    started = time.monotonic()
    try:
        response = _client().chat(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            format=schema.model_json_schema(),
            options={"num_ctx": num_ctx, "temperature": temperature, "seed": seed},
        )
    except ollama.ResponseError as exc:
        return LLMResult(
            parsed=None,
            model=model,
            num_ctx=num_ctx,
            seed=seed,
            prompt_tokens=0,
            output_tokens=0,
            latency_s=time.monotonic() - started,
            raw="",
            error=f"ollama: {exc}",
        )

    latency = time.monotonic() - started
    prompt_tokens = response.prompt_eval_count or 0
    output_tokens = response.eval_count or 0
    raw = response.message.content or ""

    # Truncation is silent on Ollama's side, so treat a prompt that filled the
    # window as a hard failure rather than trusting whatever came back.
    if prompt_tokens >= num_ctx:
        raise ContextOverflow(
            f"Prompt used {prompt_tokens} tokens against num_ctx={num_ctx}. "
            "Ollama truncates from the start of the prompt, so the system prompt "
            "was cut. Raise GRANT_AI_NUM_CTX or shorten the input."
        )

    try:
        parsed: Optional[BaseModel] = schema.model_validate_json(raw)
        error = None
    except ValidationError as exc:
        parsed = None
        error = f"schema validation failed: {exc.error_count()} error(s)"

    return LLMResult(
        parsed=parsed,
        model=model,
        num_ctx=num_ctx,
        seed=seed,
        prompt_tokens=prompt_tokens,
        output_tokens=output_tokens,
        latency_s=latency,
        raw=raw,
        error=error,
    )
