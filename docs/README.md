# Essence20 Documentation

Developer documentation for the Essence20 system. **User-facing documentation lives on the
[wiki](https://github.com/WookieeMatt/Essence20/wiki)** — this folder is for people working on the
code and the content.

---

## Start here

New to the system? Read these three, in this order.

| | | |
| --- | --- | --- |
| 1 | **[DEVELOPER_BIBLE.md](DEVELOPER_BIBLE.md)** | Onboarding, front to back: day-one setup, the mental model, architecture, the six common changes, conventions, traps, shipping. Read §10 (Conventions) before you write anything. |
| 2 | **[ARCHITECTURE.md](ARCHITECTURE.md)** | The lookup reference: every layer, every file's job, the hooks, the settings, the extension points. |
| 3 | **[ROLL_PIPELINE.md](ROLL_PIPELINE.md)** | Deep dive on `dice.mjs` — ~13,800 lines in one class, and the file you are most likely to have to change. |

Together they cover the system top to bottom. The bible is narrative and meant to be read; the
other two are meant to be searched.

---

## Process documents

| | |
| --- | --- |
| **[QA_PLAN.md](QA_PLAN.md)** | The testing strategy, layer by layer, and why each layer is tested the way it is — including why `sheet-handlers/` is deliberately not unit-tested. |
| **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** | The manual regression pass to work through before tagging a release. Thirteen sections. |

---

## Design plans

These were written **before** their features and kept afterwards as the record of what was
considered, chosen and rejected. Read the relevant one before changing a feature it covers — it
will usually answer "why is it like this?" and stop you from "fixing" a deliberate decision.

| Plan | Covers | Status |
| --- | --- | --- |
| [ACTIVE_EFFECTS_UI_PLAN.md](ACTIVE_EFFECTS_UI_PLAN.md) | The Effect Wizard and the effect catalog | Built — `apps/effect-wizard.mjs` |
| [TOURS_PLAN.md](TOURS_PLAN.md) | The guided tour suite | Built — `tours/`, `module/tours/` |
| [STAT_BLOCK_IMPORTER_PLAN.md](STAT_BLOCK_IMPORTER_PLAN.md) | The stat block importer and "Make My Monster Grow" | Built — `apps/stat-block-importer.mjs`, `apps/monster-grow-dialog.mjs`. **The plan's own header still says "design only, nothing implemented" — that line is stale.** |
| [SPELL_POWER_AOE_PLAN.md](SPELL_POWER_AOE_PLAN.md) | Areas of effect for spells and Powers | Built — `helpers/aoe-targeting.mjs`, `helpers/aoe-expiry.mjs`, `data/aoe-schema.mjs` |

> A plan's status line reflects the day it was written. Trust the code, not the header. If you
> finish something a plan describes, update its status — or move the plan's conclusions into
> `ARCHITECTURE.md` and let the plan stand as history.

---

## What is documented where

| Question | Look |
| --- | --- |
| How do I set up and build? | [Bible §2](DEVELOPER_BIBLE.md#2-day-one) |
| What does this directory do? | [ARCHITECTURE §1](ARCHITECTURE.md#1-directory-map) |
| Where does my change go? | [Bible §4](DEVELOPER_BIBLE.md#4-architecture), [ARCHITECTURE §13](ARCHITECTURE.md#13-extension-points) |
| How do I add an actor or item type? | [Bible §5.3](DEVELOPER_BIBLE.md#5-the-six-common-changes) and the wiki |
| How do I automate a Perk? | [Bible §9](DEVELOPER_BIBLE.md#9-automating-an-ability) |
| How do I add a roll modifier? | [ROLL_PIPELINE §7](ROLL_PIPELINE.md#7-where-to-put-a-new-rule) |
| Why isn't my Active Effect applying? | [Bible §7](DEVELOPER_BIBLE.md#7-active-effects) and [§11](DEVELOPER_BIBLE.md#11-traps) |
| What hooks does the system use? | [ARCHITECTURE §11](ARCHITECTURE.md#11-hooks-reference) |
| What settings exist? | [ARCHITECTURE §12](ARCHITECTURE.md#12-settings-reference) |
| How do I edit compendium content? | [Bible §8](DEVELOPER_BIBLE.md#8-compendium-content) and the wiki's Compendium Workflow |
| What's likely to bite me? | [Bible §11](DEVELOPER_BIBLE.md#11-traps) |
| How do I test and ship? | [Bible §12](DEVELOPER_BIBLE.md#12-shipping), [QA_PLAN.md](QA_PLAN.md) |

---

## Relationship to the wiki

| | |
| --- | --- |
| **This folder** | How the system is built. Ships with the source, reviewed in PRs, versioned with the code. |
| **[The wiki](https://github.com/WookieeMatt/Essence20/wiki)** | How the system is used. Players, GMs, plus a contributor track that summarises what is here. |

The wiki's contributor pages are the short form; these documents are the long form. Where they
overlap, the wiki links here.

> Note: `docs/` is **not** included in the released package. The release zip ships `system.json`,
> `template.json`, `assets/`, `lang/`, `module/`, `packs/`, `css/` and `templates/` only. These
> documents are for people with the repository.

---

## Keeping this honest

Documentation drifts. The things most likely to go stale, and what invalidates them:

| Document | Goes stale when you change |
| --- | --- |
| `ARCHITECTURE.md` §3–§8 | a file's responsibility, or add/remove a module |
| `ARCHITECTURE.md` §11 | a hook registration in `essence20.mjs` |
| `ARCHITECTURE.md` §12 | `settings.js` |
| `ROLL_PIPELINE.md` | the phase structure of `dice.mjs` (line landmarks drift constantly — that is expected and noted in the document) |
| `DEVELOPER_BIBLE.md` §11 | a trap gets fixed for good, or a new one is found |
| Any of them | the build commands in `package.json` |

The wiki has the same table for its own pages, under
[Contributing → Keeping this wiki honest](https://github.com/WookieeMatt/Essence20/wiki/Contributing).
