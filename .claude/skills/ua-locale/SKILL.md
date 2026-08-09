---
name: ua-locale
description: Ukrainian-first UI and content — the NGO terminology glossary, legal forms, plurals, date and currency formats, and the EN/UA parity rule for donor-facing output. Use when writing any user-facing string, label, error, notification, or when modelling a field a Ukrainian NGO fills in.
---

# Ukrainian locale

The UI is Ukrainian-first. English is a secondary locale for donor-facing output
only — never the source language the interface is translated from.

The failure this prevents is specific: a Ukrainian grant manager opens the
product, sees «організація» where the sector says «ГО», sees a date as
`08/10/2026`, and concludes it was built for someone else. That judgement is made
in about four seconds and it is not recoverable by good matching.

## Glossary — use these exact terms

| Concept | Ukrainian | Never |
|---|---|---|
| NGO, legal form | громадська організація (ГО) | «неурядова організація» |
| Charitable foundation | благодійна організація (БО) | «благодійність» as a form |
| Non-profit status | неприбутковий статус | «безприбутковий» |
| Registry code | ЄДРПОУ | «податковий номер» |
| Co-financing | співфінансування | «власний внесок» alone |
| Application | заявка | «аплікація», «апплікейшн» |
| Concept note | концепція проєкту | «концепт-нота» |
| Call for proposals | конкурс, відкритий конкурс | «кол» |
| Deadline | кінцевий термін подання, дедлайн | «дата закриття» |
| Grantee / recipient | грантоотримувач | «бенефіціар» for the applicant |
| Beneficiaries | цільова аудиторія, бенефіціари | — |
| Reporting | звітність | «репортинг» |
| Logical framework | логічна рамка | «логфрейм» |

Note the spelling **проєкт** (not «проект») — 2019 orthography, and a signal
Ukrainian readers notice.

## Legal form is an enum

`LegalForm` in `packages/schemas/organization.ts`, not free text. Ukrainian NGOs
register under a fixed set of forms, and donors' eligibility rules are written
against those forms — a free-text field turns a determinable eligibility check
into an `UNCERTAIN`.

`ЄДРПОУ` is exactly 8 digits, validated in the schema. It is the identifier a
Ukrainian NGO recognizes itself by; ask for it in onboarding rather than
inventing an internal reference.

## Plurals

Ukrainian has three plural forms. Never build a count string by concatenation.

| Count | Form | Example |
|---|---|---|
| 1, 21, 31 … | one | 1 грант, 21 грант |
| 2–4, 22–24 … | few | 3 гранти |
| 0, 5–20, 25–30 … | many | 5 грантів, 12 грантів |

Use `Intl.PluralRules("uk")` and a three-branch message, always. «Знайдено 5
грант(ів)» is the tell that nobody did this.

## Dates, numbers, currency

- Dates: `Intl.DateTimeFormat("uk-UA")` → `10 серпня 2026`. Never `08/10/2026`,
  which is ambiguous between two conventions the audience uses.
- Deadlines: show the date **and** the remaining time («18 днів»), pluralized.
- Numbers: space as thousands separator, comma as decimal — `50 000`, `12,5`.
- Currency: keep the donor's currency and symbol (`50 000 EUR`). Do not convert
  to hryvnia — the applicant budgets in the call's currency, and a converted
  figure at today's rate is misleading by the time they apply.

## Tone

Second person plural, neutral-professional. Not the formal-bureaucratic register
of the donor documents themselves — the product's job is to make those legible,
not to imitate them.

Errors say what happened and what to do, without apology:

- Good: «Не вдалося прочитати файл. Завантажте PDF або DOCX до 20 МБ.»
- Bad: «Вибачте, сталася помилка.»

Empty states are an invitation to act: «Ще немає збережених можливостей. Заповніть
профіль, щоб отримати перші рекомендації.»

## Verdict vocabulary is fixed

`VERDICT_LABEL_UK` and `BUCKET_LABEL_UK` in `packages/schemas/verdict.ts`. Do not
paraphrase per screen: a user learns these five words once, and «імовірно
відповідає» must mean the same thing in the feed, the breakdown and the email.

Confidence language never inflates the rung. `LIKELY_MATCH` is never written as
«відповідає».

## EN/UA parity for donor-facing output

Concept notes, application drafts and exported documents are often written in
English for the donor while the interface stays Ukrainian. Two rules:

- Content is generated in the target language, not translated from Ukrainian
  output. A translated grant application reads as translated.
- Terms of art follow the donor's own vocabulary from the call text — if the call
  says "civil society organisation", the draft says that, not "NGO".

Check parity on anything user-visible in both languages: a field labelled
«співфінансування» and `own contribution` in the export is a mismatch a reviewer
will notice.
