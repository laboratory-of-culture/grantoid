/**
 * Loads the golden set and validates it against the Zod schemas.
 *
 * Organization fixtures are stored sparse — only the facts somebody has actually
 * answered — and expanded here against FACT_REGISTRY. Two reasons:
 *
 *   Adding a key to the registry must not require editing every fixture. If it
 *   did, the registry would stop growing.
 *
 *   An omitted key means UNKNOWN, which is a real state and not a hole in the
 *   file. Writing eighteen explicit UNKNOWN blocks per fixture would bury the
 *   handful of facts that carry the test.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";

import { Grant } from "../packages/schemas/grant";
import {
  OrganizationProfile,
  emptyFacts,
  type OrganizationFact,
} from "../packages/schemas/organization";
import { UncertaintyReason, Verdict } from "../packages/schemas/verdict";
import { z } from "zod";

const FIXTURES = path.join(process.cwd(), "evals", "fixtures");

/** One answered fact, as written in a fixture file. */
const SparseFact = z.object({
  state: z.enum(["UNKNOWN", "SELF_REPORTED", "CONFIRMED", "EXPLICIT_NEGATIVE"]),
  valueText: z.string().optional(),
  valueList: z.array(z.string()).optional(),
  valueNumber: z.number().optional(),
  valueBoolean: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  confirmedAt: z.string().optional(),
});

const OrgFixture = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string().optional(),
  synthetic: z.boolean().optional(),
  edrpou: z.string().optional(),
  legalForm: z.string().optional(),
  oblast: z.string().optional(),
  city: z.string().optional(),
  websiteUrl: z.string().optional(),
  mission: z.string().optional(),
  facts: z.record(z.string(), SparseFact).default({}),
});

function yamlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f))
    .sort();
}

function readYaml(file: string): unknown {
  return parse(readFileSync(file, "utf8"));
}

/** Merge the answered facts over a complete set of UNKNOWN rows. */
function expandFacts(
  sparse: Record<string, z.infer<typeof SparseFact>>,
): OrganizationFact[] {
  const base = new Map(emptyFacts().map((f) => [f.key, f]));

  for (const [key, given] of Object.entries(sparse)) {
    const row = base.get(key);
    if (!row) {
      throw new Error(
        `fact key "${key}" is not in FACT_REGISTRY — add it to the registry ` +
          `first, together with the backfill migration`,
      );
    }
    base.set(key, {
      ...row,
      state: given.state,
      valueText: given.valueText ?? null,
      valueList: given.valueList ?? null,
      valueNumber: given.valueNumber ?? null,
      valueBoolean: given.valueBoolean ?? null,
      confidence: given.confidence ?? null,
      confirmedAt: given.confirmedAt ?? null,
    });
  }

  return [...base.values()];
}

export function loadGrants(): Grant[] {
  return yamlFiles(path.join(FIXTURES, "grants")).map((file) => {
    const parsed = Grant.safeParse(readYaml(file));
    if (!parsed.success) {
      throw new Error(
        `${path.basename(file)} is not a valid Grant:\n` +
          parsed.error.issues
            .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("\n"),
      );
    }
    return parsed.data;
  });
}

export function loadOrganizations(): OrganizationProfile[] {
  return yamlFiles(path.join(FIXTURES, "orgs")).map((file) => {
    const fixture = OrgFixture.parse(readYaml(file));
    const candidate = {
      ...fixture,
      synthetic: fixture.synthetic ?? true,
      facts: expandFacts(fixture.facts),
    };

    const parsed = OrganizationProfile.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(
        `${path.basename(file)} is not a valid OrganizationProfile:\n` +
          parsed.error.issues
            .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("\n"),
      );
    }
    return parsed.data;
  });
}

/**
 * Hand-assigned expected results.
 *
 * `criteria` is deliberately partial: only the rules that discriminate between
 * models are labelled. Labelling every rule would make the file expensive to
 * maintain and would drown the three or four rows that actually carry the
 * product's claim.
 */
export const PairLabel = z.object({
  org: z.string(),
  grant: z.string(),
  overall: Verdict,
  recommend: z.boolean(),
  /** Why a human assigned this. Read it before disputing a low eval score. */
  note: z.string(),
  criteria: z
    .record(
      z.string(),
      z.object({
        verdict: Verdict,
        uncertaintyReason: UncertaintyReason.optional(),
      }),
    )
    .default({}),
});
export type PairLabel = z.infer<typeof PairLabel>;

const Labels = z.object({ pairs: z.array(PairLabel) });

export function loadLabels(): PairLabel[] {
  return Labels.parse(readYaml(path.join(FIXTURES, "labels.yaml"))).pairs;
}

export function loadAll() {
  const grants = loadGrants();
  const organizations = loadOrganizations();
  const labels = loadLabels();

  // A label pointing at a fixture that does not exist is a silent hole in the
  // golden set — the pair simply never runs, and coverage looks fine.
  const grantIds = new Set(grants.map((g) => g.id));
  const orgIds = new Set(organizations.map((o) => o.id));
  for (const label of labels) {
    if (!grantIds.has(label.grant)) {
      throw new Error(`label references unknown grant "${label.grant}"`);
    }
    if (!orgIds.has(label.org)) {
      throw new Error(`label references unknown organization "${label.org}"`);
    }
    const grant = grants.find((g) => g.id === label.grant)!;
    const ruleKeys = new Set(grant.eligibility.map((r) => r.key));
    for (const key of Object.keys(label.criteria)) {
      if (!ruleKeys.has(key)) {
        throw new Error(
          `label ${label.org} x ${label.grant} references unknown rule "${key}"`,
        );
      }
    }
  }

  return { grants, organizations, labels };
}
