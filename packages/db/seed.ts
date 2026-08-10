/**
 * Loads the fixture organizations and grants into the dev database.
 *
 *   npx tsx packages/db/seed.ts
 *
 * Uses the unscoped client deliberately — a seed creates the organizations that
 * the scoped client would otherwise need to already exist.
 */

import { loadGrants, loadOrganizations } from "../../evals/load";
import { LEGAL_FORM_LABEL_UK, type LegalForm } from "../schemas/organization";
import { prisma } from "./tenancy";

/** Fixtures store the Ukrainian label; the column stores the enum. */
function toLegalForm(value: string | null): LegalForm | null {
  if (!value) return null;
  const entry = Object.entries(LEGAL_FORM_LABEL_UK).find(
    ([key]) => key === value,
  );
  return (entry?.[0] as LegalForm | undefined) ?? null;
}

async function main(): Promise<void> {
  const organizations = loadOrganizations();
  const grants = loadGrants();

  for (const org of organizations) {
    await prisma.organization.upsert({
      where: { id: org.id },
      create: {
        id: org.id,
        name: org.name,
        nameEn: org.nameEn,
        legalForm: toLegalForm(org.legalForm),
        oblast: org.oblast,
        city: org.city,
        websiteUrl: org.websiteUrl,
        nonProfitStatus: org.facts.find((f) => f.key === "non_profit_status")?.valueBoolean ?? null,
        profileCompleteness:
          org.facts.filter((f) => f.state !== "UNKNOWN").length / org.facts.length,
      },
      update: {},
    });

    // Replace the fact set wholesale — a partially updated profile is harder to
    // reason about than a rebuilt one, and this is a seed.
    await prisma.organizationFact.deleteMany({ where: { organizationId: org.id } });
    await prisma.organizationFact.createMany({
      data: org.facts.map((f) => ({
        organizationId: org.id,
        key: f.key,
        state: f.state,
        valueText:
          f.valueText ??
          (f.valueList ? f.valueList.join("; ") : null) ??
          (f.valueNumber !== null ? String(f.valueNumber) : null) ??
          (f.valueBoolean !== null ? (f.valueBoolean ? "так" : "ні") : null),
        valueJson: f.valueList ? f.valueList : undefined,
        confidence: f.confidence,
        confirmedAt: f.confirmedAt ? new Date(f.confirmedAt) : null,
      })),
    });

    console.log(`org   ${org.id}  ${org.facts.filter((f) => f.state !== "UNKNOWN").length}/${org.facts.length} answered`);
  }

  const source = await prisma.source.upsert({
    where: { homepageUrl: "https://houseofeurope.org.ua" },
    create: {
      name: "House of Europe",
      homepageUrl: "https://houseofeurope.org.ua",
      kind: "DONOR",
      enabled: false,
      robotsCheckedAt: null,
      tosReviewedAt: null,
    },
    update: {},
  });

  for (const grant of grants) {
    await prisma.grant.upsert({
      where: { sourceId_externalKey: { sourceId: source.id, externalKey: grant.externalKey } },
      create: {
        id: grant.id,
        sourceId: source.id,
        externalKey: grant.externalKey,
        title: grant.title,
        titleUk: grant.titleUk,
        donorName: grant.donorName,
        sourceUrl: grant.sourceUrl ?? "",
        status: grant.status,
        deadline: grant.deadline ? new Date(grant.deadline) : null,
        deadlineIsKnown: grant.deadlineIsKnown,
        fundingMin: grant.funding.min,
        fundingMax: grant.funding.max,
        currency: grant.funding.currency,
        cofinancingRequired: grant.funding.cofinancingRequired,
        maxSharePct: grant.funding.maxSharePct,
        applicantTypes: grant.applicantTypes,
        applicantGeography: grant.applicantGeography,
        sectors: grant.sectors,
        themes: grant.themes,
        targetGroups: grant.targetGroups,
        applicationLanguage: grant.applicationLanguage,
        extractionConfidence: grant.extractionConfidence,
        extractionNotes: grant.extractionNotes,
        synthetic: grant.synthetic,
        contentHash: grant.id,
        retrievedAt: new Date(grant.retrievedAt),
        lastCheckedAt: new Date(grant.retrievedAt),
        rules: {
          create: grant.eligibility.map((r) => ({
            key: r.key,
            text: r.text,
            textUk: r.textUk,
            kind: r.kind,
            orderIndex: r.orderIndex,
            resolvingFactKey: r.resolvingFactKey,
            citations: r.citation
              ? {
                  create: [
                    {
                      quote: r.citation.quote,
                      url: r.citation.url,
                      page: r.citation.page,
                      retrievedAt: new Date(r.citation.retrievedAt),
                    },
                  ],
                }
              : undefined,
          })),
        },
      },
      update: {},
    });
    console.log(`grant ${grant.id}  ${grant.eligibility.length} rules`);
  }

  console.log("\nseeded");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
