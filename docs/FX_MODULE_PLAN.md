# Essence20 FX — sound and animation module (plan)

A companion module that plays animations and sounds for what happens in an Essence20 game: a hit, a Critical, damage
by type, a Ranger morphing, a Cybertronian transforming, a Zord arriving, a Megazord forming. It is a separate
module, not part of the system, so the system stays free of extra dependencies and tables that don't want effects
never load them.

Status: plan, 2026-10-12. Nothing built yet. Open questions answered 2026-10-12 (§11): name `essence20-fx`;
both JB2A packs; Dice So Nice presets as an optional extra (§12); ambient effects in (§4); user-imported faction
emblems (§13).

---

## 1. Goals and non-goals

**Goals**
- Effects for the moments players notice: attacks and their results, damage, Defeat, and each game line's signature
  moments.
- Works out of the box with free assets, and lets a GM swap any effect or sound for their own.
- Plays for everyone at the table, once, in sync.
- Never gets in the way: one switch turns it off; per-client volume and a reduced-motion option; no effect blocks a roll
  or a turn.

**Non-goals**
- No changes to rules or numbers. The module only listens.
- No copyrighted brand assets (theme songs, the Transformers transform sound, show footage). See §8.
- No dice styling as a requirement — Dice So Nice presets load only when Dice So Nice is installed (§12).

---

## 2. How it hears what happens (the system side)

The system already routes almost every game event through one dispatcher, `fireTriggers(actor, event, …)` in
`module/rules/triggers.mjs` (about 60 call sites: rolls, hits, Criticals, damage dealt and taken, Defeat, Conditions,
Powers, Story Points, turn and round starts, Megaform combining). Morph / Unmorph / Transform / Untransform are fired
from the same file's actor-update hook (triggers.mjs:733-737).

Today it announces only one event to other modules (`essence20.storyPointNarrative`). So **Phase 0 is a small system
change**, made once and useful to any module:

1. **One public hook in the dispatcher.** At the top of `fireTriggers`, before the rule loop:
   `Hooks.callAll('essence20.event', { actor, event, roll, outcome, facts, damage, targets, vars })`.
   Read-only data; listeners can't change the game. Every event in `TRIGGER_EVENTS` and every extension event becomes
   visible at once.
2. **Explicit hooks for moments that don't go through the dispatcher**, each a one-liner where it already happens:
   - `essence20.zordArrived` (zord-arrival.mjs, announceArrivals), `essence20.zordBoarded` / `essence20.zordDisembarked`
     (boardZord / disembarkZord), `essence20.zordRecalled` (zord-recall.mjs);
   - `essence20.megaformSplit` (combiner-merge.mjs break-apart; combining is already `megaformCombined`);
   - `essence20.rollResolved` from the roll pipeline with `{ attacker, item, targets, outcome: hit|miss|critical|fumble,
     damageType }` — the one event an FX module needs most, with everything in one place.
3. **Document them** in `docs/ARCHITECTURE.md` under "Hooks for modules", with the payload of each, as a stable API
   (the same promise as `game.essence20`).

Which client fires: the dispatcher runs on the client that acted (the attacker's), and round-start work runs on the
active GM. That is the right shape for effects: **the client that fires the hook plays the effect, and Sequencer
broadcasts it to everyone** — so each effect plays once, not once per connected client. The module must not replay an
effect it receives over the socket.

Cost: about 30 lines in the system, plus tests that each hook fires with its payload.

**Done 2026-10-12.** Built as `announce()` in `module/mechanics/world/public-hooks.mjs` (tests beside it). The roll hook
became `essence20.rollResolved` — every roll, with `isAttack` / `isMelee` / `damageType` / `isCrit` / `isFumble` and
per-target `{ actor, hit, damage }` — and the Zord set grew `zordSummoned`, `zordPlaced`, `zordRepaired` and
`combinerMerged`. The full list with payloads is in `docs/ARCHITECTURE.md`, "Hooks for modules".

---

## 3. Module shape

```
essence20-fx/
  module.json              requires: essence20 (system), sequencer
                           recommends: jb2a_patreon or JB2A_DnD5e (free), dice-so-nice
  scripts/
    init.mjs               settings, hook listeners, the "is Sequencer here?" guard
    events.mjs             essence20 hook payload -> an FX "moment" key (attack.hit.fire, morph, zord.arrive …)
    presets/               one file per game line + a generic one: moment -> { animation, sound, options }
    play.mjs               builds and plays the Sequencer sequence for a moment (token positions, rotation, scale)
    config-app.mjs         the GM's FX configuration window (§6)
    ambient.mjs            persistent token effects (§4 Ambient)
    dice.mjs               Dice So Nice colorsets and faces, only when Dice So Nice is active (§12)
    emblems.mjs            faction emblem slots and lookup (§13)
  sounds/                  CC0 sounds only (§8)
  languages/en.json
  tests/                   jest: mapping and preset resolution (no Foundry needed)
```

Dependencies:
- **Sequencer** (required) — plays animations and sounds, broadcasts to all clients, handles timing.
- **JB2A** (recommended) — both packs supported. Presets name the free pack's database paths; when the Patreon pack
  (`jb2a_patreon`) is active, `presets/jb2a-patreon.mjs` swaps in its richer variants (more colours, more
  damage-type versions) moment by moment, and anything it doesn't override stays on the free path. If neither is installed, sounds still play and animations are skipped, with one GM
  notice.

---

## 4. Moments and default effects

Each moment has an animation and a sound, both optional and both replaceable. Defaults use JB2A free + CC0 sounds.

**Combat (every game line)**

| Moment | Fired by | Default animation | Default sound |
|---|---|---|---|
| Attack — ranged | rollResolved | projectile from attacker to target, by damage type | shot / zap by type |
| Attack — melee | rollResolved | slash/impact on the target | swing |
| Miss | rollResolved (miss) | projectile veers off / "whiff" | ricochet / whoosh |
| Critical Success | rollResolved (critical), criticallyHit | brighter impact + screen flash on the target | heavy hit |
| Fumble | rollResolved (fumble) | small spark/puff on the attacker | clatter |
| Damage taken | takesDamage | hit flash on the token, tinted by damage type | — |
| Defeated / Dropped to 0 | defeated, droppedToZero | knockdown burst | low thud |
| Condition gained | conditionGained | small icon pulse (Stunned stars, Frightened shiver…) | short cue |
| Area attack | rollResolved with a shape | template-shaped burst (cone, line, radius) | explosion |

Damage-type tint/variant (the system's own types): fire, cold, electric, acid, laser, sonic, poison, psychic, emp, void,
element (the issued Element), blunt, sharp, stun. Non-damage "types" in that list (grapple, maneuver, knockProne,
frightened…) map to their Condition cue instead.

**Game-line signature moments**

| Line | Moment | Default |
|---|---|---|
| Power Rangers | Morph / Unmorph | colour flash in the Ranger's own colour (`system.color`) rising up the token, then the art swap |
| Power Rangers | Zord summoned / arrives | dust and shockwave at the map edge where it's placed (the arrival card's Place) |
| Power Rangers | Megazord forms / splits | light pillar over the Megaform token; reverse on split |
| Power Rangers | Zord recalled for repairs | teleport streak upward |
| Transformers | Transform / Bot Mode | mechanical shuffle + a short whirr (CC0 — not the show's sound) |
| Transformers | Combiner merges / breaks apart | parts converge / scatter |
| Transformers | Energon spent | blue glint |
| GI Joe | Requisition / gear delivered | supply crate drop |
| GI Joe | Explosives | larger explosion variant |
| My Little Pony | Magic / Spellcasting | sparkle burst in the caster's colour |
| My Little Pony | Friendship / Cheer / Bond | hearts / confetti |
| Night Vale | Weird | static/glitch overlay, radio crackle |
| All | Story Point spent | small star rising over the token |
| All | Turn start | optional ring on the active token (off by default) |

Which line's presets apply follows the system's own game-line setting; "All" loads every line's presets.

**Ambient (persistent while a state lasts; each toggleable, all off with reduced motion)**

Played with Sequencer `.persist()` and a name per token, so they end cleanly when the state ends or the token goes.

| State | Default |
|---|---|
| Active combatant | soft ring under the token (off by default) |
| Morphed Ranger | faint aura in the Ranger's colour |
| Zord in play | slow ground-dust under the Zord token |
| Megaform | low light pillar / glow under the Megaform |
| Conditions (Stunned, Frightened, Burning, Poisoned…) | looping marker while the Condition is on |
| Defeated / at 0 Health | dimmed, slow smoke wisp |
| Hidden / in cover | subtle shimmer for the owner and GM only |
| Faction | emblem under the token (§13) |
| Scene (optional, GM-placed) | Night Vale static drift, Cybertron energon motes, sparkles — a scene-level loop the GM turns on per scene |

---

## 5. Who sees and hears what

- Played by the client that fired the event, broadcast by Sequencer to everyone who can see the token.
- Hidden tokens: no effect unless the viewer can see the token (GMs always see).
- Whispered/blind rolls: no attack effect until the result is public.
- Per-client: mute, volume, reduced motion (static icon instead of animation), and "only effects on my own
  characters".
- World (GM): on/off per moment category (Combat, Conditions, Signature moments, Ambient), effect size, and
  "skip effects for NPC-vs-NPC" for busy fights.

---

## 6. GM configuration

A "Configure FX" window (module settings menu), one row per moment:
- animation: JB2A database path, a Sequencer database entry, or a file (FilePicker);
- sound: file + volume;
- preview button (plays it on the selected token, locally only);
- reset to default.

Per-actor overrides, from a small tab or header button on the actor sheet (via a sheet hook, not a system change):
a Ranger's own morph animation and colour, a Transformer's own transform sound, a Zord's own arrival effect. Stored as
`flags.essence20-fx.*` on the actor, so they travel with exported actors.

Export / import of the whole configuration as JSON, so tables can share presets.

---

## 7. Phases

| Phase | What | Done when |
|---|---|---|
| 0 | System hooks (§2) + their tests + ARCHITECTURE.md section | Every listed hook fires once with its payload, on the acting client |
| 1 | Module skeleton: manifest, settings, Sequencer/JB2A detection, one hard-coded hit effect | A hit plays a JB2A impact for everyone, once |
| 2 | Combat moments (§4 table 1), damage-type variants, area shapes | All combat moments play; reduced motion and mute work |
| 3 | Signature moments for Power Rangers and Transformers | Morph, transform, Zord arrival, Megaform merge/split play |
| 4 | GI Joe, MLP, Night Vale moments | Each line has its signature moments |
| 5 | Configure FX window, per-actor overrides, preset export/import | A GM can replace any effect without code |
| 5b | Ambient effects, Dice So Nice presets (§12), faction emblems (§13) | Each plays/loads only when its toggle and (for dice) Dice So Nice are on |
| 6 | QA and release | Live run per game line in Dev v14; performance check (see §9); README with asset credits |

Phases 1–3 are the useful core; 4–5 can follow.

**Phase 1 done 2026-10-12** (module 0.1.0, live-tested). **Phase 2 done 2026-10-12** (module 0.2.0): every damage
type's look for ranged and melee, areas (circle / emanation / cone / line from the new `essence20.areaPlaced` hook),
damage-taken flash, Defeated, Conditions (`conditionGained` now carries `vars.statuses`), Reduced motion as a user
flag so the acting client leaves those users out of the animations, burst limit. Live-tested in Dev v14 including a
real weapon attack end to end and a real emanation placement; sounds can't be heard in the automated pane.

**Phase 3 done 2026-10-12** (module 0.3.0): Morph / Unmorph recoloured to the Ranger's `system.color` (a Foundry
Color - passed to Sequencer as its hex string; greys desaturated), Transform / Bot Mode, Energon spent, Zord summoned /
arrived (sound only) / placed / boarded / disembarked / recalled (played where the departing token stood), Megaform
formed (roster grew to 2+, beams from each part on the map) and split. Live-tested through the system's own functions
(morph, transform, onSummonZord, placeZord, boardZord, disembarkZord, recallZord, breakApart).

**Phase 4 done 2026-10-12** (module 0.4.0). The game line comes from each actor's Role (`system.version`) - the
system has no world-wide line setting. System additions: `style` on `rollResolved` (the weapon's style), the
`essence20.requisitionGranted` hook, and `rollResolved` from untargeted rolls too (`fireOpenRoll`) - a plain
Spellcasting or Weird test never reached it before. Module: weapon styles (projectile bullets under the damage type's
look, explosives over it), Story Point / Spellcasting (recoloured, per-art base hue) / Weird / assist / reroll /
Requisition moments, MLP and Night Vale looks; a new "extras" setting. Live-tested with real Spellcasting and Weird rolls.

**Phase 5 done 2026-10-12** (module 0.5.0): Configure FX (ApplicationV2, settings menu, GM only) - 48 moments in 6
groups, each with on/off, animation (replaces the preset's main part: first of projectile / swing / area / overlay /
impact / ring / beam), sound (file or "none"), volume, Preview (`.locally()`, unsaved values), Reset; Export / Import
JSON (`cleanImport` keeps only known keys and fields). Per-actor: the sheet header menu's "Effects" (owners), stored as
a JSON-text flag so a save replaces rather than merges, plus an effect colour flag. Overrides apply world then actor,
after the damage-type / style / line layers. The release zip now includes styles/ and templates/. The new styles entry
in module.json needs a world restart to load. Live-tested: save, playback, actor layering, preview, reset.

**Phase 5b done 2026-10-12** (module 0.6.0). Ambient effects are played `.locally().persist()` by each client (never
saved to the scene), so each viewer's Reduced motion and sight of hidden tokens apply and no GM write is needed;
re-synced on canvasReady / token / actor / effect / faction-item / combat / setting changes. Faction emblems: the GM's
own images (none shipped), matched by Faction item, then folder, then an actor's own pick; under tokens, a flash on
Morph / Transform / Megaform forming, Dice So Nice d20s. Dice So Nice: 21 colour sets, per-client auto colour via
die.options.appearance in diceSoNiceRollStart. The config stylesheet is also attached from init.mjs (a module.json
styles change needs a world restart, and without it the window couldn't scroll); row buttons moved to the right.
Not built: the GM-placed scene ambience loops and the chat-card emblem.

**Phase 6 done 2026-10-12** (module 1.0.0, ready to tag). QA: every hook the module plays from was checked to fire on
one client only (updateActor / createActiveEffect / updateCombatant guard on userId, the reroll card on its author, round
start on the active GM). Found and fixed: one-off effects read a Token's x / y, which stay 0 until Foundry draws the
token in place - effects started in the scene's top-left corner (the "stretch over 0" warning, and the Phase 3 stray
beam); they now use the token's document-based centre. Also: a character with no Role falls back to the system's world
`gameLine` setting. Stress: a 40-target attack plays 8 effects (17 ms); a 20-hit burst lets 12 through; 40 Stunned
tokens give exactly 40 lasting effects, resync in 15 ms with no duplicates, all cleared after. The master switch clears
and restores lasting effects. Release: a release test checks everything loaded is in the zip; zip 1.95 MB / 127 files;
module.json requires Essence20 6.0.5 (the first system version with the hooks - the system must be released first).
Not verified: sound playback (the automated pane can't play audio) and a two-client session.

**Scene ambience and chat-card emblem built 2026-10-12** (in 1.0.0). Scene ambience: `flags.essence20-fx.ambience` on
the Scene, picked in Scene Configuration's Environment tab (v14's name for the old Ambience tab); 7 looks, each layers of
a looping JB2A effect scattered across the scene at spots seeded from the scene's id (same for every client), count by
area, capped at 30 a layer; played locally by each client (Reduced motion respected). Chat-card emblem: the speaker's
faction emblem beside their name on roll cards (renderChatMessageHTML, images only). Live-tested in Dev v14.

**Automated Animations bridge built 2026-10-12** (in 1.0.0). theripper93's fork (id `autoanimations`, 7.1.7, v14-only)
installed in Dev v14. It has no Essence20 handler (its generic chat-message fallback finds no item id in our cards, so
it never fires on its own). On essence20.rollResolved the bridge calls `AutomatedAnimations.playAnimation(token, item,
{ targets, hitTargets, playOnMiss: true, extraNames: [weapon name] })` and skips Essence20 FX's attack moments; GM
setting attackAnimator = fx / aa / aaFirst (default). aaFirst mirrors its lookup (scripts/aa-match.mjs): item flags
(killAnim / isEnabled false -> no, isCustomized -> yes), else Autorec menus (exact label, else longest contained label
minus excluded terms) over the effect's name then its weapon's. Areas and fumbles stay with Essence20 FX. Live: its item
header button opens the A-A Item Menu on our sheets; Autorec matched "ZZ Crossbow" through the weapon and played its
bolt (hit and miss); an unmatched blaster fell back to Essence20 FX. Its own effects read Token x / y, so it shows the
"stretch over 0" warning for tokens not yet drawn - not ours to fix.

**Automated Animations entries built 2026-10-12.** scripts/aa-autorec.mjs: 56 Automatic Recognition entries for the
words in the system's 475 weapon / 828 weapon-effect names, each a clone of AA 7.1.7's own default range / melee entry
(captured live) with label, catalogue animation and a module CC0 sound; "Ray" carries excludedTerms (array, spray...).
Merged through AutorecManager.mergeMenus (adds only labels not already present); offered once to the active GM, and a
settings menu. 340 of 475 compendium weapons recognised. Live: merged in Dev v14 (melee 12->35, range 10->43), re-merge
adds 0; Blade Blaster -> red lasershot + laser sound, Close Combat Bludgeon -> club + punch, Cycler Warhead Array not
taken as "Ray" and fell back to Essence20 FX.

**Emblems reworked 2026-10-12.** The emblem under the token is gone. Each faction slot now has img (emblem: a corner badge
- Sequencer attachTo align top-left edge inner, scaleToObject 0.35 - plus the flash, roll cards, dice) and marker
(Foundry v14's per-token turnMarker: mode CUSTOM + src, written by the active GM only to tokens whose marker is DEFAULT
or the one we set - flag essence20-fx.marker - so hand-picked markers are never replaced; reverts to DEFAULT when the
image goes). v14 draws a turn marker square at externalRadius*3 (1.5x the token), under it, spinning; Foundry's own are
512 x 512 WebP - hence the marker spec (512, 256-1024, design in the outer band) and badge spec (128-256). Faction
Emblems previews both and reports size/squareness/JPEG on pick (emblem-images.mjs#imageAdvice). Found while testing: the
"Add Essence20 weapons" menu type was a plain class, which made the module's init hook throw and skip the Faction
Emblems menu - now an ApplicationV2, with a release test that every menu type extends one.

---

## 8. Assets and licensing

- **Never bundled:** theme music, show sound effects (the Transformers transform sound, the Power Rangers morph
  call), logos, show footage. All Hasbro IP licensed to Renegade, not to us.
- **Sounds bundled:** a starter set, CC0 only, so the module isn't silent out of the box. Sources:
  - **Kenney audio packs** (kenney.nl, all CC0): *Impact Sounds* (hits, thuds), *Sci-fi Sounds* (lasers, zaps,
    energy — Transformers, Power Rangers), *RPG Audio* (swings, armour, coins), *Interface Sounds* (Story Point,
    UI cues), *Digital Audio* (Night Vale glitches). These alone cover most of §4.
  - **Freesound** filtered to the CC0 licence, for what Kenney lacks (explosions, radio static, transform-style
    servo whirrs, crowd cheer). Each file checked individually; CC-BY files are skipped, not credited-and-shipped.
  - **OpenGameArt** CC0 collections as a fallback.
  - Each file listed in `sounds/CREDITS.md` with its source URL, even though CC0 doesn't require it.
  - Target size: under 5 MB total, OGG, trimmed and loudness-matched.
  - Foundry's own core sounds (`sounds/*.wav`) may be referenced by path, never copied.
- **Not used:** Sonniss GDC bundles and other "royalty-free" packs whose licence forbids redistributing the raw
  files — a module is redistribution.
- **Animations:** depend on JB2A, never copy its files. The free pack's licence allows use, not redistribution.
- A GM can point any moment at their own files, including ones they own — that stays in their world.

---

## 9. Performance and safety

- Effects are fire-and-forget: never awaited by the roll pipeline, never able to stop a roll or a turn.
- Every listener is wrapped in try/catch; an FX error logs once and disables that moment for the session.
- Burst limit: at most N effects per second (default 6); multi-target attacks play one projectile per target up to
  a cap, then one area effect.
- No canvas, no effect: skipped when the scene isn't drawn (and for clients with "Disable canvas").

---

## 10. Testing

- Jest (pure parts): hook payload -> moment key; moment + game line + overrides -> resolved preset; damage-type map;
  burst limiter.
- System side: a test per new hook (fires once, right payload, on the acting client only).
- Live (Dev v14, "Claude" user, throwaway actors): one scripted pass per game line playing every moment;
  two-client check that each effect plays once per client, not twice.

---

## 11. Open questions

Answered 2026-10-12:
1. Module id and name: **`essence20-fx` / "Essence20 FX"**.
2. JB2A: **both** — free pack by default, Patreon variants when that pack is active (§3).
3. Sounds: **bundle a CC0 starter set** (§8); downloading the packs needs the user's go-ahead first.
4. Dice So Nice: **a series of presets in this module, optional** — loaded only when Dice So Nice is active (§12).
5. Ambient effects: **in** (§4 Ambient), plus user-imported faction emblems (§13).

Still open:
- Which Kenney / Freesound files make the starter set (picked during Phase 2 and listed in CREDITS.md).
- Whether the emblem also goes on dice (§12) by default or only when the GM ticks it.

---

## 12. Dice So Nice presets (optional)

Loaded only when Dice So Nice is active: `Hooks.once('diceSoNiceReady', dice3d => …)`. Listed under
`relationships.recommends` in module.json, never `requires`, so nothing breaks without it.

- **Colorsets** (`dice3d.addColorset`), one per look, all in the player's own Dice So Nice picker:
  - Power Rangers — one per Ranger colour (Red, Blue, Yellow, Black, Pink, Green, White, Gold, Silver, Purple,
    Orange), plus "My Ranger colour" which reads `system.color` of the roller's character;
  - Transformers — Autobot (red/silver), Decepticon (purple/gunmetal), Energon (glowing cyan, translucent);
  - GI Joe — Joe (olive drab/khaki), Cobra (blue/red), Dreadnok (rust/black);
  - My Little Pony — pastel rainbow, Harmony (gold/white sparkle);
  - Night Vale — void purple with a faint glow, "static" grey.
- **Dice system** (`dice3d.addSystem({ id: 'essence20', name: 'Essence20' })`) covering d2, d4, d6, d8, d10, d12,
  d20 — the dice Essence20 actually rolls — with generic E20 face styling.
- **Auto colour by character** (per-client setting, default off): a roll from a character uses its faction or
  Ranger colour's colorset, via Dice So Nice's per-roll appearance option.
- **Emblem faces** (opt-in): when a faction emblem has been imported (§13), the d20's 20 face (and the d2's 2) can
  show it, via `addDicePreset` with an image label. Uses only images the GM supplied.

---

## 13. Faction emblems (user-imported)

The Autobot, Decepticon, GI Joe and Cobra symbols are Hasbro trademarks, so the module ships **none** of them — but
a GM who has their own copies can plug them in, and they then stay in that GM's world.

- **Emblem slots**, one per faction: a "Faction Emblems" settings menu with a FilePicker per slot (image or
  webm), a tint colour, and a preview. Default slots: Autobot, Decepticon, GI Joe, Cobra, plus "Add faction"
  for any other (Dreadnoks, Iron Grenadiers, Mini-Cons…). Stored as a world setting holding file paths only.
- **Bulk import**: "Import folder…" picks a folder and matches files by name (`autobot.webp`, `cobra.png`…) to
  slots, the same way the system's art-folder matching works.
- **Who gets which emblem**, in order:
  1. the actor's own override (`flags.essence20-fx.faction`);
  2. the actor's Faction item (characters already carry one — the system's `faction` item type), matched to a
     slot by name;
  3. the actor's folder name, if it matches a slot (handy for NPC folders like "Cobra");
  4. none.
- **Where it shows** (each a toggle): ambient emblem under the token; a brief emblem flash on Morph / Transform /
  Combiner merge; on dice faces (§12); on the attack chat card's header.
- With no images imported, every emblem feature quietly does nothing.
