# Grant Assistant for Ukrainian NGOs
## Master Product Brief & Pitch Deck

**Working title:** Grant Assistant  
**Market:** Ukraine  
**Target users:** Ukrainian NGOs / CSOs  
**Product type:** AI-powered SaaS / Grant Management & Application Intelligence Platform  
**Business model:** Freemium + Pro subscription  
**Primary AI capability:** Agent-assisted grant discovery, eligibility analysis, application drafting and application review

---

# 1. Executive Summary

## The Idea

**Grant Assistant** is an AI-powered web application designed specifically for Ukrainian non-governmental and civil society organizations.

The platform helps an NGO move through the entire grant lifecycle:

> **Organization Profile → Grant Discovery → Eligibility Check → Opportunity Matching → Concept Development → Application Draft → Application Review → Submission**

Instead of forcing organizations to manually monitor dozens of websites, read long grant guidelines, determine whether they are eligible, and repeatedly rewrite similar application materials, Grant Assistant creates a persistent organizational profile and uses AI agents to continuously identify and analyze relevant funding opportunities.

The platform does not simply provide a list of grants.

It answers:

> **"Which grants are actually relevant to my organization, why am I eligible, what are the risks, and how can I prepare a strong application?"**

---

# 2. The Problem

Ukrainian NGOs face several recurring problems when searching for funding.

## 2.1 Fragmented Grant Information

Funding opportunities are distributed across:

- donor websites;
- Ukrainian grant aggregators;
- foundations;
- cultural institutions;
- international organizations;
- government and municipal platforms;
- newsletters;
- social media;
- individual program websites.

There is no single reliable source containing all relevant opportunities.

## 2.2 Information Overload

An NGO may encounter dozens of potentially interesting opportunities but only a small percentage are genuinely applicable.

The organization must manually determine:

- whether it is eligible;
- whether its legal status qualifies;
- whether its geography qualifies;
- whether its field of activity matches;
- whether its project type is eligible;
- whether the required organizational experience exists;
- whether the funding amount is appropriate;
- whether co-financing is required;
- whether the deadline is realistic.

## 2.3 Repetitive Work

Organizations repeatedly provide similar information:

- organizational history;
- mission;
- previous projects;
- team information;
- geographic focus;
- target audiences;
- previous donors;
- financial information;
- project experience.

This information should be reusable.

## 2.4 Difficult Application Writing

Grant applications often require structured thinking rather than simply "good writing."

An application may fail because:

- objectives are vague;
- indicators are not measurable;
- activities do not logically lead to outcomes;
- the problem is poorly defined;
- the target audience is unclear;
- the methodology does not match the objectives;
- the budget does not correspond to the activities;
- donor priorities are not addressed;
- required information is missing.

## 2.5 Lack of Continuous Grant Intelligence

Most organizations search for grants reactively.

The desired model is:

> **The grant opportunities come to the organization.**

---

# 3. The Product Vision

## Vision

> **Make professional grant intelligence and application development accessible to every Ukrainian NGO.**

## Mission

Grant Assistant reduces the administrative and intellectual workload associated with fundraising so that NGOs can spend more time creating social impact and less time searching, filtering and rewriting documents.

## Long-Term Vision

Grant Assistant should evolve from a grant-search tool into an:

> **AI Grant Operating System for NGOs.**

The platform should eventually understand:

1. the organization;
2. its history;
3. its capabilities;
4. its strategic priorities;
5. available funding opportunities;
6. donor requirements;
7. the organization's previous applications;
8. the organization's projects;
9. application quality;
10. potential funding strategy.

---

# 4. Core Value Proposition

## For NGOs

### Before

> Search → Read → Filter → Check eligibility → Interpret requirements → Write → Rewrite → Submit

### With Grant Assistant

> **Profile → Receive relevant opportunities → Understand eligibility → Generate concept → Draft → Review → Improve → Submit**

---

# 5. Target Users

## Primary Persona

### Ukrainian NGO / CSO

Typical characteristics:

- small or medium-sized organization;
- limited fundraising staff;
- project-based funding;
- limited time;
- multiple areas of activity;
- relies heavily on grants;
- frequently applies to different donors.

## Secondary Personas

### 1. NGO Founder / Director

Needs:

- strategic funding opportunities;
- quick eligibility assessment;
- overview of upcoming deadlines.

### 2. Grant Manager

Needs:

- opportunity discovery;
- application preparation;
- donor requirement analysis;
- application review.

### 3. Project Manager

Needs:

- concept development;
- objectives;
- activities;
- indicators;
- logical framework.

### 4. Fundraising Consultant

Potential future power user.

Needs:

- multiple organizations;
- multiple application pipelines;
- centralized grant intelligence.

---

# 6. Core Product Modules

The product should initially consist of five major modules.

---

## Module A — Organization Profile

The organization creates a persistent profile.

### Basic information

- Organization name
- Registration date
- Registration location
- Legal status
- Non-profit status
- Website
- Social media
- Contact information

### Organizational profile

- Mission
- Vision
- Areas of activity
- Geographic coverage
- Target audiences
- Main beneficiaries
- Organizational capacities
- Previous projects
- Previous donors
- Previous grants
- Team
- Partnerships
- International experience

### Documents

Users can upload:

- Statutes;
- registration documents;
- organizational descriptions;
- previous applications;
- annual reports;
- project descriptions;
- strategic plans;
- other relevant documents.

The system converts these documents into a structured organizational knowledge base.

---

# 7. Organizational Knowledge Base

The organization should have a persistent AI-readable knowledge base.

Conceptually:

```text
Organization
│
├── Identity
├── Legal status
├── Mission
├── Activities
├── Geography
├── Target groups
├── Team
├── Projects
├── Donors
├── Partnerships
├── Documents
├── Previous applications
└── Strategic priorities
```

This becomes the foundation for all AI functionality.

The user should not need to repeatedly explain the organization to the AI.

---

# 8. Module B — Grant Intelligence Engine

The system continuously monitors relevant public sources.

Potential sources include:

- Ukrainian grant aggregators;
- donor websites;
- international organizations;
- cultural institutions;
- foundations;
- public funding portals;
- NGO networks;
- specialized funding platforms.

For example, **House of Europe** publishes multiple grant programs with specific eligibility requirements, funding ranges and application conditions. Its current programs demonstrate why simply matching keywords is insufficient: some opportunities are restricted to particular organizational types, sectors, geography or cooperation models.

The platform should therefore ingest both:

> **the opportunity**

and

> **the detailed eligibility rules behind the opportunity.**

---

# 9. Grant Discovery Pipeline

```text
Web Sources
     ↓
Crawler / Scraper
     ↓
Document Extraction
     ↓
Grant Normalization
     ↓
Requirement Extraction
     ↓
Grant Database
     ↓
Organization Matching Engine
     ↓
Personalized Opportunities
```

---

# 10. Grant Data Model

Every grant opportunity should be converted into a structured representation.

Example:

```yaml
grant:
  title:
  donor:
  source_url:
  application_url:

  status:
    open: true
    deadline:

  funding:
    min:
    max:
    currency:

  applicant:
    organization_types:
    legal_requirements:
    registration_requirements:
    geographic_requirements:

  project:
    sectors:
    themes:
    target_groups:
    geographic_scope:

  eligibility:
    mandatory:
    preferred:
    excluded:

  requirements:
    documents:
    partnerships:
    co_financing:
    previous_experience:

  application:
    language:
    format:
    questions:
    attachments:

  evaluation:
    criteria:

  confidence:
    extraction_confidence:
```

---

# 11. Module C — AI Grant Matching

This is one of the core differentiators.

The system compares:

> **Organization Profile × Grant Requirements**

and calculates a structured match.

Example:

### Grant Match — 86%

| Criterion | Status |
|---|---|
| Legal status | ✅ Match |
| Geography | ✅ Match |
| Sector | ✅ Match |
| Target group | ✅ Match |
| Organizational experience | ⚠️ Uncertain |
| International partner | ❌ Missing |
| Co-financing | ⚠️ Required |
| Project scale | ✅ Match |

---

# 12. Explainable Eligibility

The platform should never simply say:

> "You are eligible."

Instead:

> **"Why do I match this grant?"**

Each recommendation should contain:

### Matched

- Legal status
- Geographic scope
- Sector
- Target audience
- Organizational experience

### Potential problem

- Required partnership not confirmed
- Minimum organizational experience unclear

### Not matched

- Applicant must be a registered cultural institution
- International partner required

### Unknown

Information is not available in the organization's profile.

This distinction is critical.

The AI must differentiate between:

> **No**

and

> **We don't know.**

---

# 13. Confidence-Based Matching

Every eligibility criterion should have a confidence state:

```text
MATCH
LIKELY MATCH
UNCERTAIN
LIKELY NOT ELIGIBLE
NOT ELIGIBLE
```

This prevents hallucinated eligibility.

---

# 14. Personalized Grant Feed

Each organization receives its own grant feed.

Example:

```text
TODAY

3 Highly Relevant Grants

1. Cultural Innovation Grant
   Match: 94%
   Deadline: 18 days
   Funding: €10,000–€20,000

2. Youth Development Program
   Match: 87%
   Deadline: 31 days
   Funding: €5,000–€15,000

3. Digital Transformation Grant
   Match: 78%
   Deadline: 42 days
   Funding: €20,000
```

The platform should prioritize:

> **relevance over volume.**

The goal is not to show 100 grants.

The goal is to show the **5–10 grants worth considering**.

---

# 15. Personalized Notifications

Users can receive:

- daily digest;
- weekly digest;
- urgent deadline alerts;
- newly discovered high-match opportunities;
- changes to previously tracked opportunities.

Example:

> **New grant matched your organization — 91%**

> Your organization appears eligible based on sector, geography and legal status. The only unresolved requirement is previous international cooperation experience.

---

# 16. Module D — AI Grant Concept Generator

For every relevant opportunity:

> **Generate Project Concept**

The agent uses:

1. organization profile;
2. organizational knowledge base;
3. grant requirements;
4. donor priorities;
5. previous successful projects;
6. user's selected project idea.

Output:

```text
Project Title

Problem

Target Groups

Overall Objective

Specific Objectives

Activities

Expected Outputs

Expected Outcomes

Impact

Indicators

Timeline

Partnerships

Preliminary Budget

Risk Management
```

The result is a **concept note**, not yet a final application.

---

# 17. AI Application Drafting Agent

The next stage:

> **Generate Application Draft**

The agent maps the concept to the donor's actual application structure.

Example:

```text
DONOR QUESTION

"Describe the problem your project addresses."

        ↓

AI

Organization Knowledge Base
+
Project Concept
+
Donor Guidelines
+
Previous Materials

        ↓

Draft Answer
```

The agent should preserve factual information and clearly identify assumptions.

---

# 18. Application Workspace

The platform should provide a large document editor.

Conceptually:

> **Google Docs + Grammarly + AI Grant Consultant**

The user writes or uploads an application.

The AI analyzes it continuously.

---

# 19. Grant Application AI Reviewer

The reviewer evaluates the application against multiple frameworks.

## SMART

Checks whether objectives are:

- Specific
- Measurable
- Achievable
- Relevant
- Time-bound

Example:

> ⚠️ **Objective may not be measurable.**

Suggested improvement:

> Define the number of participants, activities or measurable outputs.

---

## Logical Consistency

The system checks:

```text
Problem
   ↓
Objective
   ↓
Activities
   ↓
Outputs
   ↓
Outcomes
   ↓
Impact
```

If the chain is broken, the AI highlights it.

---

# 20. Donor Requirement Checker

The user uploads:

- call guidelines;
- application template;
- evaluation criteria;
- donor handbook;
- budget requirements.

The system creates a **Grant Requirement Map**.

Example:

```text
Requirement                    Status

Project duration ≤ 12 months   ✅
Applicant eligibility          ✅
Budget template                ⚠️
International partner          ❌
Gender dimension               ⚠️
Sustainability section         ❌
Risk management               ⚠️
Evaluation indicators         ✅
```

This becomes a final pre-submission checklist.

---

# 21. Application Quality Score

The platform may generate an overall score:

```text
APPLICATION READINESS

82 / 100

Eligibility       95%
Completeness      78%
Clarity           86%
SMART objectives  72%
Methodology       88%
Impact            79%
Donor alignment   84%
Budget logic      74%
```

Important:

This should be presented as an **AI quality assessment**, not a prediction of whether the donor will fund the project.

---

# 22. AI Writing Assistant

The application editor should provide contextual suggestions.

Examples:

- "Make this objective measurable."
- "This paragraph does not explain the beneficiary."
- "This activity does not clearly contribute to Objective 2."
- "The donor emphasizes regional impact, but this is not addressed."
- "You mention sustainability but do not provide a concrete mechanism."

Possible actions:

```text
Improve
Shorten
Make measurable
Make donor-aligned
Add evidence
Clarify
Rewrite professionally
Translate
```

---

# 23. Core AI Agent Architecture

The product should not rely on one giant AI prompt.

Use specialized agents.

```text
                    Grant Assistant
                          │
             ┌────────────┼────────────┐
             │            │            │
       Discovery Agent  Profile Agent  Application Agent
             │            │            │
       Scraping Agent   Knowledge      Review Agent
             │          Extraction       │
             │            │            │
             └────────────┼────────────┘
                          │
                    Orchestrator
                          │
                   Knowledge Layer
```

---

# 24. Proposed Agents

## 1. Grant Discovery Agent

Finds new opportunities.

## 2. Grant Extraction Agent

Converts websites and documents into structured grant records.

## 3. Eligibility Agent

Determines eligibility against organizational information.

## 4. Matching Agent

Ranks opportunities.

## 5. Concept Agent

Creates project concepts.

## 6. Application Agent

Drafts application responses.

## 7. Review Agent

Reviews applications.

## 8. Compliance Agent

Checks donor requirements.

## 9. Research Agent

Finds supporting evidence, statistics and relevant sources.

## 10. Organization Knowledge Agent

Maintains the organization's knowledge base.

---

# 25. Human-in-the-Loop Principle

AI should not autonomously submit applications.

The system should operate as:

> **AI prepares → Human verifies → Human approves → Human submits**

This is particularly important because grant applications contain legal, financial and organizational claims.

---

# 26. Technology Architecture

## Frontend

Potential stack:

- Next.js
- React
- TypeScript
- Tailwind CSS
- rich text editor

Potential editor:

- TipTap
- Lexical

---

## Backend

Potential stack:

- Python
- FastAPI
- PostgreSQL
- Redis
- background workers

---

## AI Layer

Potential components:

- LLM API
- embeddings
- RAG
- structured output
- agent orchestration
- document extraction
- evaluation pipeline

Potential orchestration:

```text
LangGraph
     or
custom agent orchestration
```

---

# 27. Knowledge Architecture

Use a hybrid architecture.

### PostgreSQL

Structured data:

- users;
- organizations;
- grants;
- donors;
- deadlines;
- requirements;
- applications.

### Object Storage

Documents:

- PDFs;
- DOCX;
- XLSX;
- statutes;
- grant guidelines.

### Vector Database

Semantic retrieval:

- organizational knowledge;
- donor guidelines;
- previous applications;
- grant documents.

Potential options:

- pgvector;
- Qdrant;
- Pinecone.

For an MVP, **PostgreSQL + pgvector** may be preferable because it reduces infrastructure complexity.

---

# 28. Web Intelligence Layer

The crawler should support:

```text
Website
 ↓
Page discovery
 ↓
Content extraction
 ↓
PDF/document detection
 ↓
Document parsing
 ↓
Requirement extraction
 ↓
Validation
 ↓
Grant record
```

Important requirement:

**Every extracted grant fact must retain its source URL and ideally the source document/page reference.**

Example:

```yaml
eligibility:
  value: "Ukrainian non-profit organizations"
  source:
    url:
    document:
    page:
```

This creates traceability.

---

# 29. Grant Information Reliability

Grant information changes.

Therefore every grant should have:

```text
Last checked
Last updated
Source
Source status
Extraction confidence
```

The system should detect:

- changed deadlines;
- updated requirements;
- closed calls;
- new application forms;
- changed funding amounts.

---

# 30. Obsidian as Project Knowledge Layer

The project should maintain an Obsidian vault.

Suggested structure:

```text
GrantAssistant/
│
├── 00_Project/
│   ├── Vision.md
│   ├── Product_Brief.md
│   ├── Roadmap.md
│   └── Decisions.md
│
├── 01_Product/
│   ├── Personas.md
│   ├── User_Flows.md
│   ├── Features.md
│   └── Requirements.md
│
├── 02_Research/
│   ├── Market.md
│   ├── Competitors.md
│   ├── Donors.md
│   └── User_Interviews.md
│
├── 03_Architecture/
│   ├── System_Architecture.md
│   ├── Database.md
│   ├── AI_Architecture.md
│   └── Security.md
│
├── 04_Agents/
│   ├── Discovery_Agent.md
│   ├── Matching_Agent.md
│   ├── Concept_Agent.md
│   └── Review_Agent.md
│
├── 05_Development/
│   ├── Frontend.md
│   ├── Backend.md
│   ├── Infrastructure.md
│   └── Testing.md
│
├── 06_Finance/
│   ├── Business_Model.md
│   ├── Pricing.md
│   ├── Unit_Economics.md
│   └── Financial_Model.md
│
└── 07_Pitch/
    ├── Pitch_Deck.md
    ├── Investor_Story.md
    └── Grant_Proposal.md
```

---

# 31. Development Philosophy

The project should be designed as an **AI-native development project**.

Different tools can operate against the same structured project knowledge.

Potential workflow:

```text
Obsidian
   ↓
Product Knowledge
   ↓
Cloud Design
   ↓
Architecture / UX
   ↓
Cloud Code
   ↓
Implementation
   ↓
Tests
   ↓
Documentation
```

The Markdown repository becomes the project's **source of truth**.

---

# 32. MVP

The first version should NOT attempt to build the entire vision.

## MVP Goal

Prove one critical hypothesis:

> **Can an AI system reliably identify relevant grants for a specific Ukrainian NGO and explain why they are relevant?**

### MVP features

1. NGO registration
2. Organization profile
3. Document upload
4. Organizational knowledge extraction
5. Grant source ingestion
6. Grant database
7. Eligibility extraction
8. AI matching
9. Personalized grant feed
10. Explainable match
11. Email notifications

---

# 33. MVP Phase 2

After matching is validated:

- concept note generator;
- donor requirement parser;
- application workspace;
- AI reviewer;
- SMART analysis;
- completeness checker.

---

# 34. MVP Phase 3

Advanced functionality:

- autonomous grant monitoring;
- application drafting agent;
- previous application learning;
- budget analysis;
- donor-specific writing styles;
- collaborative workspaces;
- grant pipeline;
- fundraising analytics.

---

# 35. Business Model

## Freemium

### Free

Possible limits:

- organization profile;
- limited grant recommendations;
- weekly digest;
- limited AI analysis;
- limited application reviews.

### Pro

Potential features:

- continuous grant monitoring;
- unlimited/high-volume matching;
- AI concept generation;
- application drafting;
- donor requirement analysis;
- advanced application reviewer;
- multiple projects;
- document knowledge base;
- priority notifications.

---

# 36. Potential Pricing

Initial hypothesis:

### Free

€0

### Pro

€10–20/month

### Professional / Fundraising Team

€30–60/month

### Organization / Agency

€100+/month

Pricing must ultimately be validated through interviews and willingness-to-pay experiments.

The key question is not:

> "How much does AI cost?"

It is:

> **"How much economic value does winning one additional grant create for the organization?"**

---

# 37. Revenue Model

Primary:

> SaaS subscriptions

Secondary future opportunities:

- NGO team plans;
- fundraising consultants;
- NGO networks;
- accelerators;
- incubators;
- donor-sponsored access;
- white-label deployments;
- institutional licenses;
- premium application review;
- analytics.

---

# 38. Unit Economics

Important metrics:

```text
CAC
LTV
ARPU
Conversion Free → Pro
Monthly Churn
AI Cost / User
AI Cost / Application
Infrastructure Cost / User
Gross Margin
```

The main technical financial risk is uncontrolled AI usage.

Therefore:

> **AI usage must be metered and economically controlled.**

---

# 39. Business KPIs

## Acquisition

- registered organizations;
- activation rate;
- profile completion rate.

## Product

- grants discovered;
- grants matched;
- match click-through rate;
- saved grants;
- applications started.

## AI

- generated concepts;
- generated drafts;
- application reviews;
- user acceptance rate;
- correction rate.

## Business

- Free → Pro conversion;
- MRR;
- churn;
- ARPU;
- CAC;
- LTV.

## Impact

Most important long-term metric:

> **Funding opportunities converted into submitted applications and successful grants.**

---

# 40. Key Product Metrics

A particularly important metric should be:

### Relevant Grant Rate

```text
Relevant recommendations
──────────────────────────
Total recommendations
```

The platform should optimize for precision.

Bad:

> 50 grants found.

Good:

> 5 grants found — 4 are genuinely relevant.

---

# 41. Competitive Positioning

The product should not position itself as:

> "another grant database."

Instead:

> **AI-powered grant intelligence and application copilot for Ukrainian NGOs.**

The difference:

| Traditional Grant Aggregator | Grant Assistant |
|---|---|
| Lists opportunities | Matches opportunities |
| Generic search | Personal organization profile |
| Manual eligibility check | AI eligibility analysis |
| User reads guidelines | AI extracts requirements |
| User writes application | AI creates draft |
| Static information | Continuous monitoring |
| Generic notifications | Personalized alerts |
| Search tool | Grant operating system |

---

# 42. Defensibility

The biggest long-term asset is not the UI.

It is the accumulated **grant + organization + application knowledge graph**.

Potential moat:

```text
Organizations
      +
Grant Opportunities
      +
Donor Requirements
      +
Application Templates
      +
Previous Applications
      +
User Feedback
      +
Outcome Data
      ↓
Grant Intelligence Dataset
```

Over time this could improve matching and application assistance.

---

# 43. Critical Risks

## Risk 1 — Scraping Reliability

Websites change.

Mitigation:

- modular connectors;
- source monitoring;
- extraction validation;
- human review for critical sources.

## Risk 2 — AI Hallucination

Mitigation:

- source citations;
- structured extraction;
- confidence levels;
- retrieval-first architecture;
- no unsupported claims.

## Risk 3 — Incorrect Eligibility

This is potentially more damaging than missing a grant.

Therefore:

> **Unknown ≠ Eligible.**

## Risk 4 — Low Willingness to Pay

Many Ukrainian NGOs have limited budgets.

Mitigation:

- freemium;
- low-cost Pro;
- institutional sponsorship;
- donor partnerships.

## Risk 5 — Product Becomes "AI Writer"

This is a major strategic risk.

Many generic AI tools can already write text.

The differentiation must remain:

> **grant intelligence + organizational knowledge + donor requirements + application workflow.**

---

# 44. Security & Privacy

The platform may process sensitive organizational information.

Requirements:

- encryption;
- secure document storage;
- role-based access;
- organization-level data isolation;
- audit logs;
- deletion mechanisms;
- explicit AI data-processing policy;
- no training on customer documents without explicit consent.

---

# 45. Ethical Principles

The platform should follow:

### Transparency

Explain where information comes from.

### Human Control

AI assists; humans approve.

### Traceability

Important claims should be traceable to source documents.

### No False Certainty

The system should explicitly communicate uncertainty.

### Equal Access

The platform should reduce—not increase—the advantage of organizations with large fundraising departments.

---

# 46. Future Expansion

After Ukraine:

```text
Ukraine
   ↓
Eastern Europe
   ↓
European NGOs
   ↓
International NGO funding ecosystem
```

Potential future verticals:

- NGOs;
- cultural organizations;
- educational institutions;
- social enterprises;
- research organizations;
- municipalities.

---

# 47. Long-Term Product Vision

The ultimate product could become:

## NGO AI Operating System

Not just:

> "Find me a grant."

But:

> "Understand my organization, identify funding opportunities, develop project concepts, prepare applications, track deadlines, analyze donor requirements, maintain institutional knowledge and continuously improve our fundraising strategy."

---

# 48. One-Sentence Pitch

> **Grant Assistant is an AI-powered fundraising copilot that continuously finds the most relevant funding opportunities for Ukrainian NGOs, explains their eligibility, and helps turn those opportunities into high-quality grant applications.**

---

# 49. Elevator Pitch

> Ukrainian NGOs spend enormous amounts of time searching for grants, interpreting eligibility requirements and rewriting similar application materials. Grant Assistant creates a persistent AI profile of each organization, monitors grant opportunities across multiple sources, identifies the opportunities that actually fit, explains why they fit, and helps the organization develop and review applications. It combines grant intelligence, organizational knowledge and AI-assisted application development in one platform.

---

# 50. Pitch Deck Structure

The future investor / donor / accelerator deck should contain approximately 12 slides.

### Slide 1 — The Problem

**NGOs are drowning in grant information but still struggle to find the right funding.**

### Slide 2 — Current Workflow

```text
Search
→ Read
→ Filter
→ Check
→ Write
→ Rewrite
→ Submit
```

### Slide 3 — The Solution

**An AI Grant Operating System for NGOs.**

### Slide 4 — How It Works

```text
Your Organization
       ↓
AI Profile
       ↓
Grant Intelligence
       ↓
Matching
       ↓
Concept
       ↓
Application
       ↓
AI Review
```

### Slide 5 — Product

Show the dashboard.

### Slide 6 — Personalized Grant Matching

Show:

> **94% Match**

with an eligibility breakdown.

### Slide 7 — AI Application Workspace

Show the Grammarly-like editor.

### Slide 8 — Technology

Show:

> Agents + RAG + Web Intelligence + Knowledge Graph + Document Intelligence

### Slide 9 — Market

Ukraine first → regional expansion.

### Slide 10 — Business Model

Freemium → Pro → Teams → Institutions.

### Slide 11 — Roadmap

```text
2026
MVP

2027
AI Application Copilot

2028
NGO AI Operating System
```

### Slide 12 — Vision

> **Give every NGO an AI fundraising team.**

---

# 51. Initial Product Hypotheses

Before significant development, validate these hypotheses.

### H1

NGOs have a real problem finding relevant grants.

### H2

Organizations are willing to create a persistent profile.

### H3

Personalized recommendations are significantly more valuable than generic grant listings.

### H4

Organizations trust AI-generated eligibility explanations if sources are provided.

### H5

Organizations want AI assistance with application preparation.

### H6

Some organizations are willing to pay for this functionality.

### H7

The cost of continuously monitoring and processing grant sources can be economically viable.

---

# 52. Validation Strategy

Before building a large platform:

## Step 1

Interview 15–30 Ukrainian NGOs.

## Step 2

Collect real applications and grant-search workflows.

## Step 3

Manually test matching on historical grant opportunities.

## Step 4

Build a lightweight prototype.

## Step 5

Measure:

> How many recommendations are actually considered useful?

## Step 6

Introduce paid Pro access.

---

# 53. North Star Metric

The product should ultimately optimize for:

> **Qualified Grant Opportunities → Applications → Successful Funding**

Not:

> AI generations.

Not:

> number of grants scraped.

Not:

> number of users.

The real value is:

> **additional funding successfully obtained by organizations.**

---

# 54. Product Principle

The central principle of the project:

> **Don't build an AI that writes more grant applications. Build an AI that helps NGOs apply to the right grants.**

This distinction should guide the entire product.

---

# 55. Initial Technical Backlog

## P0 — Foundation

- [ ] Repository
- [ ] Project documentation
- [ ] Database schema
- [ ] Authentication
- [ ] Organization model
- [ ] Organization profile
- [ ] Document upload
- [ ] Document processing

## P1 — Grant Intelligence

- [ ] Source registry
- [ ] Web crawler
- [ ] Content extraction
- [ ] Grant parser
- [ ] Grant schema
- [ ] Eligibility schema
- [ ] Grant database
- [ ] Matching engine

## P2 — User Experience

- [ ] Grant dashboard
- [ ] Match score
- [ ] Eligibility checklist
- [ ] Saved grants
- [ ] Notifications

## P3 — AI Application

- [ ] Concept generator
- [ ] Requirement parser
- [ ] Application workspace
- [ ] SMART checker
- [ ] Application reviewer
- [ ] Draft generator

## P4 — Business

- [ ] Subscription
- [ ] Usage limits
- [ ] Billing
- [ ] Analytics
- [ ] Admin dashboard

---

# 56. Recommended Repository Structure

```text
grant-assistant/
│
├── README.md
├── PROJECT_BRIEF.md
├── PRODUCT_REQUIREMENTS.md
├── ROADMAP.md
├── DECISIONS.md
│
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── agents/
│   ├── research/
│   ├── finance/
│   └── pitch/
│
├── apps/
│   ├── web/
│   └── api/
│
├── agents/
│   ├── discovery/
│   ├── extraction/
│   ├── matching/
│   ├── concept/
│   ├── drafting/
│   └── review/
│
├── packages/
│   ├── schemas/
│   ├── prompts/
│   └── evaluation/
│
├── infrastructure/
│
└── tests/
```

---

# 57. Definition of Done — MVP

The MVP is successful when a real Ukrainian NGO can:

1. create an account;
2. describe its organization;
3. upload relevant documents;
4. receive a structured organization profile;
5. see relevant grant opportunities;
6. understand why each opportunity matches;
7. see missing or uncertain eligibility criteria;
8. receive notifications about new relevant opportunities;
9. save an opportunity;
10. start preparing an application.

The first MVP does **not** need to autonomously submit applications.

---

# 58. Final Product Statement

## Grant Assistant

**An AI-powered grant intelligence and application platform built for Ukrainian NGOs.**

It transforms fundraising from:

> **manual grant hunting**

into:

> **continuous, personalized, AI-assisted funding intelligence.**

And eventually from:

> **grant search**

into:

> **an AI fundraising operating system for civil society organizations.**