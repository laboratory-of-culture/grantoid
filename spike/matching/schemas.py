"""Data model for the matching spike.

Three families of types live here:

*   ``Grant`` / ``OrganizationProfile`` — the *inputs*. Loaded from hand-authored
    YAML fixtures for now; in the real product they come from the extraction
    pipeline and the org profile UI respectively.
*   ``MatchResult`` — the *output*, and the schema the model is constrained to.
    This is the contract the whole product rests on, so it is deliberately
    verbose: a verdict without evidence is not a verdict.
*   ``Verdict`` — the confidence ladder from the product brief (section 13).

Design rules, per the brief:

*   Every extracted grant fact carries a ``Source`` (section 28). Retrofitting
    provenance later is painful, so it is mandatory from the first fixture.
*   ``UNCERTAIN`` is a first-class outcome distinct from ``NOT_ELIGIBLE``
    (sections 12 and 43). "Unknown" must never silently become "no" — or,
    far worse, "yes".

JSON-schema note: the Claude structured-outputs schema compiler does not accept
numeric or string constraints (``ge``/``le``/``min_length``), so bounds are
described in prose and validated after parsing instead.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Confidence ladder
# --------------------------------------------------------------------------


class Verdict(str, Enum):
    """Ordered confidence states for a single criterion or an overall match.

    The ordering matters: ``distance()`` uses it to score how badly a
    prediction missed, and the overall verdict is the *floor* of the mandatory
    criteria rather than an average.
    """

    MATCH = "MATCH"
    LIKELY_MATCH = "LIKELY_MATCH"
    UNCERTAIN = "UNCERTAIN"
    LIKELY_NOT_ELIGIBLE = "LIKELY_NOT_ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"


_LADDER = [
    Verdict.MATCH,
    Verdict.LIKELY_MATCH,
    Verdict.UNCERTAIN,
    Verdict.LIKELY_NOT_ELIGIBLE,
    Verdict.NOT_ELIGIBLE,
]

POSITIVE = {Verdict.MATCH, Verdict.LIKELY_MATCH}
NEGATIVE = {Verdict.LIKELY_NOT_ELIGIBLE, Verdict.NOT_ELIGIBLE}


def distance(a: Verdict, b: Verdict) -> int:
    """Rungs between two verdicts on the ladder. 0 means exact agreement."""
    return abs(_LADDER.index(a) - _LADDER.index(b))


# --------------------------------------------------------------------------
# Inputs: grants
# --------------------------------------------------------------------------


class Source(BaseModel):
    """Where a single extracted fact came from.

    ``quote`` is the verbatim snippet the fact was read off. Keeping it lets the
    reviewer check an extraction without re-opening the donor's PDF, and lets the
    eval harness verify the model is quoting rather than paraphrasing.
    """

    url: Optional[str] = None
    document: Optional[str] = None
    page: Optional[int] = None
    quote: Optional[str] = None


class EligibilityRule(BaseModel):
    """One requirement the applicant is judged against.

    ``kind`` separates the three cases the brief calls out (section 10):
    ``mandatory`` rules gate eligibility, ``preferred`` rules only affect
    ranking, and ``excluded`` rules describe who is ruled out.
    """

    id: str
    text: str
    kind: str = Field(description="mandatory | preferred | excluded")
    source: Source = Field(default_factory=Source)


class Funding(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    currency: Optional[str] = None
    cofinancing_required: Optional[bool] = Field(
        default=None,
        description="None means the call does not say — which is not the same as False.",
    )
    max_share_pct: Optional[float] = Field(
        default=None, description="Largest share of project cost the grant will cover."
    )


class Grant(BaseModel):
    """A normalized funding opportunity.

    ``synthetic`` marks fixtures that were written for testing and describe no
    real funding programme. Nothing in the harness treats them differently; the
    flag exists so a reader can never mistake one for a live call.
    """

    id: str
    title: str
    donor: str
    source_url: Optional[str] = None
    retrieved_at: Optional[str] = None
    synthetic: bool = False

    open: Optional[bool] = None
    deadline: Optional[str] = None

    funding: Funding = Field(default_factory=Funding)

    applicant_types: list[str] = Field(default_factory=list)
    applicant_geography: list[str] = Field(default_factory=list)
    sectors: list[str] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    target_groups: list[str] = Field(default_factory=list)

    eligibility: list[EligibilityRule] = Field(default_factory=list)

    required_documents: list[str] = Field(default_factory=list)
    application_language: Optional[str] = None
    evaluation_criteria: list[str] = Field(default_factory=list)

    extraction_confidence: Optional[float] = None
    extraction_notes: Optional[str] = None


# --------------------------------------------------------------------------
# Inputs: organizations
# --------------------------------------------------------------------------


class OrganizationProfile(BaseModel):
    """What the platform knows about one NGO.

    ``unknown_fields`` is the load-bearing part. An org profile is always
    incomplete, and the matcher's job is to distinguish "the profile says no"
    from "the profile is silent". Listing the silences explicitly means the
    model does not have to infer them from absence, and the eval harness can
    check that it respected them.
    """

    id: str
    name: str
    synthetic: bool = False

    legal_status: Optional[str] = None
    non_profit: Optional[bool] = None
    registration_country: Optional[str] = None
    registration_date: Optional[str] = None
    based_in: Optional[str] = None

    mission: Optional[str] = None
    activity_areas: list[str] = Field(default_factory=list)
    geographic_coverage: list[str] = Field(default_factory=list)
    target_audiences: list[str] = Field(default_factory=list)

    team_size: Optional[int] = None
    annual_budget_eur: Optional[float] = None
    previous_grants: list[str] = Field(default_factory=list)
    previous_donors: list[str] = Field(default_factory=list)
    international_partners: list[str] = Field(default_factory=list)

    capabilities: list[str] = Field(default_factory=list)
    explicit_negatives: list[str] = Field(
        default_factory=list,
        description="Things the organization has confirmed it does NOT do or have.",
    )
    unknown_fields: list[str] = Field(
        default_factory=list,
        description="Profile fields the organization has not answered yet.",
    )


# --------------------------------------------------------------------------
# Output: the model's structured verdict
# --------------------------------------------------------------------------


class CriterionAssessment(BaseModel):
    """The model's judgement on one eligibility rule."""

    criterion_id: str = Field(description="The id of the grant eligibility rule assessed.")
    criterion: str = Field(description="The requirement, restated in one plain sentence.")
    verdict: Verdict
    rationale: str = Field(description="Two sentences at most. Say why, not what.")
    grant_evidence: str = Field(
        description="Verbatim text from the grant that establishes this requirement."
    )
    profile_evidence: Optional[str] = Field(
        default=None,
        description=(
            "Verbatim text from the organization profile that settles the requirement. "
            "Null when the profile does not address it."
        ),
    )
    missing_information: Optional[str] = Field(
        default=None,
        description=(
            "What the organization would need to supply to resolve this criterion. "
            "Required whenever the verdict is UNCERTAIN; null otherwise."
        ),
    )


class MatchResult(BaseModel):
    """A complete, explainable eligibility assessment for one org/grant pair."""

    grant_id: str
    organization_id: str

    overall: Verdict = Field(
        description=(
            "The floor of the mandatory criteria: the worst mandatory verdict, not an average. "
            "One NOT_ELIGIBLE mandatory criterion makes the whole match NOT_ELIGIBLE."
        )
    )
    match_score: int = Field(
        description="0-100. How well the organization fits, ignoring hard blockers."
    )
    recommend: bool = Field(
        description=(
            "Whether this belongs in the organization's feed. True for a plausible fit "
            "even when open questions remain; false when a hard blocker is established."
        )
    )

    summary: str = Field(description="Two or three sentences a grant manager can act on.")
    blockers: list[str] = Field(
        description="Established hard disqualifiers. Empty when there are none."
    )
    open_questions: list[str] = Field(
        description="Unresolved requirements, phrased as questions for the organization."
    )

    criteria: list[CriterionAssessment] = Field(
        description="One entry per mandatory and excluded rule in the grant."
    )
