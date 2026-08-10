/**
 * Prisma rows → the Zod records the agents are written against.
 *
 * The seam exists because `grant-schema` says every component validates against
 * the schema module rather than redeclaring fields, and because the agents were
 * built and evaluated against fixtures loaded from YAML. If the database took a
 * different path into the agent than the eval harness does, the eval would stop
 * predicting production — which is the failure that makes an eval suite worse
 * than none, since it keeps reporting green.
 *
 * So both roads end here, and anything the schemas reject never reaches a model.
 */

import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { Grant } from "../schemas/grant";
import { OrganizationProfile } from "../schemas/organization";

export type GrantRow = Prisma.GrantGetPayload<{
  include: { rules: { include: { citations: true } } };
}>;

export type OrganizationRow = Prisma.OrganizationGetPayload<{
  include: { facts: { include: { citations: true } } };
}>;

/** Prisma returns Decimal for money columns; the schemas want a plain number. */
function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function isoDate(value: Date | null): string | null {
  return value === null ? null : (value.toISOString().slice(0, 10) as string);
}

export function toGrant(row: GrantRow): Grant {
  return Grant.parse({
    id: row.id,
    sourceId: row.sourceId,
    externalKey: row.externalKey,

    title: row.title,
    titleUk: row.titleUk,
    donorName: row.donorName,
    sourceUrl: row.sourceUrl || null,
    applicationUrl: row.applicationUrl,

    status: row.status,
    deadline: isoDate(row.deadline),
    deadlineIsKnown: row.deadlineIsKnown,

    funding: {
      min: toNumber(row.fundingMin),
      max: toNumber(row.fundingMax),
      currency: row.currency,
      cofinancingRequired: row.cofinancingRequired,
      maxSharePct: toNumber(row.maxSharePct),
    },

    applicantTypes: row.applicantTypes,
    applicantGeography: row.applicantGeography,
    sectors: row.sectors,
    themes: row.themes,
    targetGroups: row.targetGroups,
    applicationLanguage: row.applicationLanguage,

    eligibility: [...row.rules]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((rule) => ({
        key: rule.key,
        text: rule.text,
        textUk: rule.textUk,
        kind: rule.kind,
        orderIndex: rule.orderIndex,
        resolvingFactKey: rule.resolvingFactKey,
        citation: rule.citations[0]
          ? {
              quote: rule.citations[0].quote,
              url: rule.citations[0].url,
              page: rule.citations[0].page,
              retrievedAt: rule.citations[0].retrievedAt.toISOString(),
            }
          : null,
      })),

    extractionConfidence: row.extractionConfidence,
    extractionNotes: row.extractionNotes,
    synthetic: row.synthetic,
    retrievedAt: row.retrievedAt.toISOString(),
  });
}

/**
 * A stored fact's single value column, split back into the typed slots the
 * schema uses.
 *
 * The database keeps one text column plus optional JSON; the schema keeps four
 * typed nullables so an agent reading `valueBoolean` cannot be handed the string
 * "ні". Getting this wrong in the direction of a truthy string is how a negative
 * fact becomes a positive one.
 */
export function splitFactValue(
  key: string,
  valueText: string | null,
  valueJson: Prisma.JsonValue,
): {
  valueText: string | null;
  valueList: string[] | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
} {
  const empty = { valueText: null, valueList: null, valueNumber: null, valueBoolean: null };
  if (valueText === null && valueJson === null) return empty;

  if (Array.isArray(valueJson)) {
    return { ...empty, valueList: valueJson.map(String) };
  }

  const text = valueText?.trim() ?? "";
  if (text.length === 0) return empty;

  const lowered = text.toLowerCase();
  if (lowered === "так" || lowered === "yes" || lowered === "true") {
    return { ...empty, valueBoolean: true };
  }
  if (lowered === "ні" || lowered === "no" || lowered === "false") {
    return { ...empty, valueBoolean: false };
  }

  if (/^-?\d+(?:[.,]\d+)?$/.test(text)) {
    return { ...empty, valueNumber: Number(text.replace(",", ".")) };
  }

  // A semicolon-separated list is how the profile form stores multi-value
  // answers. Split only on that, never on commas: "Чернівці, Буковина" is one
  // answer a person typed, and guessing at its structure loses the distinction.
  if (text.includes(";")) {
    const parts = text
      .split(";")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length > 1) return { ...empty, valueList: parts };
  }

  return { ...empty, valueText: text };
}

export function toProfile(row: OrganizationRow): OrganizationProfile {
  return OrganizationProfile.parse({
    id: row.id,
    name: row.name,
    nameEn: row.nameEn,
    edrpou: row.edrpou,
    legalForm: row.legalForm,
    oblast: row.oblast,
    city: row.city,
    websiteUrl: row.websiteUrl,
    mission: null,

    facts: row.facts.map((fact) => ({
      key: fact.key,
      state: fact.state,
      ...splitFactValue(fact.key, fact.valueText, fact.valueJson),
      confidence: fact.confidence,
      confirmedAt: fact.confirmedAt?.toISOString() ?? null,
      citations: fact.citations.map((c) => ({
        quote: c.quote,
        url: c.url,
        page: c.page,
        retrievedAt: c.retrievedAt.toISOString(),
      })),
    })),

    synthetic: false,
  });
}

/**
 * A hash of everything the verdict depended on, on the profile side.
 *
 * `Match` is keyed on this together with the grant's content hash and the
 * prompt fingerprint, so a cached verdict cannot outlive its inputs. Only the
 * fields an agent actually reads go in — a `updatedAt` bump that changed nothing
 * an agent saw would otherwise invalidate every match the organization has.
 */
export function profileVersionHash(profile: OrganizationProfile): string {
  const material = JSON.stringify({
    legalForm: profile.legalForm,
    oblast: profile.oblast,
    edrpou: profile.edrpou,
    facts: [...profile.facts]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((f) => [f.key, f.state, f.valueText, f.valueList, f.valueNumber, f.valueBoolean]),
  });

  return createHash("sha256").update(material).digest("hex");
}
