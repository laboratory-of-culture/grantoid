"""Produces a MatchResult for one organization/grant pair.

The model call itself lives in `llm.py`. This module owns the two things that
are specific to matching: how a grant and a profile are rendered into a prompt,
and what a failed assessment looks like to the caller.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Optional

from .llm import LLMResult, complete
from .prompts import SYSTEM_PROMPT, USER_TEMPLATE
from .schemas import Grant, MatchResult, OrganizationProfile


@dataclass
class MatchRun:
    """One matcher call: the verdict plus what it cost to get it."""

    result: Optional[MatchResult]
    model: str
    num_ctx: int
    seed: int
    prompt_tokens: int
    output_tokens: int
    latency_s: float
    error: Optional[str] = None

    @classmethod
    def from_llm(cls, llm: LLMResult) -> "MatchRun":
        result = llm.parsed if isinstance(llm.parsed, MatchResult) else None
        return cls(
            result=result,
            model=llm.model,
            num_ctx=llm.num_ctx,
            seed=llm.seed,
            prompt_tokens=llm.prompt_tokens,
            output_tokens=llm.output_tokens,
            latency_s=llm.latency_s,
            error=llm.error,
        )


def _render(model: Any) -> str:
    """Serialize a fixture for the prompt, dropping unset and empty fields.

    Empty collections are pruned deliberately. A profile field rendered as ``[]``
    reads like a confirmed "none", which is exactly the confusion
    ``unknown_fields`` exists to prevent — see the eligibility-contract skill.
    """
    data = model.model_dump(exclude_none=True)
    pruned = {k: v for k, v in data.items() if v not in ([], {}, "")}
    return json.dumps(pruned, ensure_ascii=False, indent=2, sort_keys=True)


def render_prompt(organization: OrganizationProfile, grant: Grant) -> str:
    """The exact user turn that would be sent. Used by `run.py --dry-run`."""
    return USER_TEMPLATE.format(grant=_render(grant), organization=_render(organization))


def match(organization: OrganizationProfile, grant: Grant, **kwargs: Any) -> MatchRun:
    """Assess one organization against one grant.

    Extra keyword arguments (``model``, ``num_ctx``, ``seed``) pass through to
    the runtime, which is how the eval harness sweeps models.
    """
    llm = complete(
        system=SYSTEM_PROMPT,
        user=render_prompt(organization, grant),
        schema=MatchResult,
        **kwargs,
    )
    return MatchRun.from_llm(llm)
