# "Finesse or Might" (and other two-Skill) weapons - 2026-10-06/07

User request: "The unarmed combat equipment from several books should have the same rule to use finesse or might
whichever is higher." Extended to every weapon whose book classifies it with two Skills, since the book is the source
of truth.

## The rule

Each attack effect gets two `SkillSubstitution` rules, `scope: item`, `mode: bestOf`, one each way:

```json
{"type":"SkillSubstitution","scope":"item","label":"Finesse or Might: rolls the better of the two","from":"finesse","to":"might","mode":"bestOf"}
{"type":"SkillSubstitution","scope":"item","label":"Finesse or Might: rolls the better of the two","from":"might","to":"finesse","mode":"bestOf"}
```

`rules/adapter.mjs#applySkillSubstitution` (the pre-roll hook) swaps to the other Skill only when it is the better die.
Live-checked 2026-10-07 on a Finesse d4 / Might d10 actor: TF Unarmed Combat, TF Long Bludgeon, Pillage and Power
Fist's bludgeon all roll Might; PR Martial Arts Long Bludgeon (Might only) stays Might; TF Grappler with Athletics
d12 rolls Athletics.

## How it was found

The sweep was a scratchpad script: for every weapon with a Skill-rolled effect, it read the weapon's own book page
and classified it. It used the `Classification:` field where the book has one (TF, EoC, WTNV, Technorganic Secrets),
and otherwise the table row or stat block. Each case was compared with the effects' rules.

## Unarmed weapons (the request)

| Line | Item | Book | Before | Now |
|---|---|---|---|---|
| G.I. JOE | Unarmed Combat | CRB | had it | unchanged |
| Night Vale | Unarmed Strike | Citizens' Guide | had it | unchanged |
| Power Rangers | Unarmed Combat (ex-Brawling) | CRB 2nd printing p.110 | added earlier this session | unchanged |
| Transformers | Unarmed Combat | CRB 2nd printing p.122 | **missing** | added (all 3 effects) |
| G.I. JOE | Pillage (Freebooter) | Quartermaster's Guide p.27 | missing | added (both effects) |
| G.I. JOE | Power Fist | Quartermaster's Guide p.93 | granted the *heavy* bludgeon | now grants Close Combat Bludgeon, which the book names (Finesse or Might) |
| Power Rangers | Psycho Strike | Finster's p.304 | missing | added (3 effects) |
| Transformers | Blaster Knuckles | Enigma of Combination | missing | added (3 effects) |
| Transformers | Natural Weapon / (Flora) | Technorganic Secrets | missing | added |

## Other weapons the books print as two-Skill

- **Finesse or Might:**
  - Battle Fire Saber, Golden Sword (Across the Stars p.87)
  - Dino Saber, Power Melee Weapon, Thundermax Blade Form (Beneath the Helmet p.68)
  - Cybertronian Glaive, Energized Cybertronian Glaive, Energon Claymore, Primeon Blade, Titansword, Trident Blade (Enigma of Combination)
  - Z-Staff Strike (Finster's)
  - Power Tool, Close Combat Heavy Bludgeon (G.I. JOE CRB p.141)
  - Combat Nunchaku, Excalibur (Quartermaster's Guide p.38)
  - Rotary Blade (Technorganic Secrets)
  - every TF CRB melee weapon copy (see below)
- **Athletics or Finesse:** TF Grappler, WTNV Grappling Hook.
- **Athletics or Targeting:** WTNV Pepper Spray, WTNV Slingshot, Vine Bombs (Technorganic Secrets).
- **Finesse or Targeting:** WTNV Throwing Star.
- **Athletics or Might:** Dino Spike's melee attack (Beneath the Helmet p.68). Its thrown attack stays Athletics.

## Corrected the other way

- PR CRB **Martial Arts Long Bludgeon** Alternate Effect 2 carried the rules. The 2nd printing p.114 prints it as Might
  long melee, so they were removed. Martial Arts long/medium *blade* are "Finesse or Might" and keep them.

## Transformers CRB weapons pointed at other books' effects

19 TF CRB weapons listed their effects by `gi_joe_crb` / `pr_crb` uuids, though `tfcrbitems` holds its own copies with
the same `_id`s. A TF weapon dropped on a sheet therefore got the G.I. JOE effects, and TF Long Bludgeon got the
**Power Rangers "Martial Arts" effect**. All 32 links now point at `tf_crb`, and the TF copies got the best-of rules
the TF book prints. Guarded by `module/data/item/pack-child-links.test.js`. Existing world copies keep the effects
they already copied.

## Names

The remaining "Bludgeoning" items now carry the printed name "Bludgeon": Close Combat Heavy Bludgeon, Short
Bludgeon and Thrown Bludgeon (G.I. JOE CRB, TF CRB, Quartermaster's Guide, Cobra Codex). The change covers names,
effect names, Grant labels and notes, with `_id`s and file names kept.

## Automation notes

50 effects' notes said a single Skill ("a Might melee attack", "rolls Finesse ... Change its Skill to Might on the
sheet"). They now say "rolling the better of X and Y". The edits were text-only, in place, and each one was verified to
change only the notes string.

## Tests

- `module/items/shared/unarmed-attacks.test.js`: every printed unarmed weapon's effects carry both rules.
- `module/data/item/pack-child-links.test.js`: no child link crosses packs when the pack has its own copy.
- `module/rules/conv14-other.test.js`: Power Fist grants Close Combat Bludgeon.
