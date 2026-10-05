# Rules conversion guide (for cloud sessions)

This is how to convert hard-coded, compendium-id-keyed item behaviour into data rules (`system.rules`,
run by `module/rules/`). The design is `docs/RULES_ENGINE_PLAN.md` (§0a is the current status and the
known-issues list). Below the "Working notes" line is the brief local conversion agents used, with every
engine feature added so far - read it all before deciding anything.

## How a cloud session works on this (overrides the working notes where they differ)

- **Edit the repo directly** on your own branch. Ignore every instruction below about ROOT being read-only,
  scratchpad folders, `proposals-*.json`, `*-build.cjs` builders, TREE copies or `apply-edits-v2.cjs` -
  those were the local agents' plumbing. What still applies: which items to look at, the exactness rule,
  what to remove alongside a conversion, test style, and every engine feature.
- **Branch:** start from `Rules-Engine-Phase-1`; push a new branch named `rules/<batch>` (e.g.
  `rules/regA`). Never push to `Rules-Engine-Phase-1`, `master`, `Beta-v6.0` or any existing branch.
- **Pack rules:** add a `"rules": [ ... ]` array as the first key of `"system"` in
  `packs/<pack>/_source/<Item>.json`, one rule object per line, keeping the file's own line endings. Never
  parse-and-reserialize a pack file or `lang/en.json` (it reorders and reformats them) - insert text.
  Don't touch compiled pack databases (anything outside `_source/`); packs are rebuilt locally.
- **Line endings:** keep each file's existing EOL. `eslint --fix` turns files into LF - don't use it.
- **No rulebook text** in rule labels, descriptions or comments. Labels are short names,
  e.g. "Related to language (Universal Translator: ↑3)".
- **Behaviour must match the current code exactly**, alone and in ordinary combinations. If it can't, skip
  the item (or convert only the part that can) and say why in your summary, naming the missing engine piece.
- **Verify before pushing** (all must pass):
  - `node node_modules/eslint/bin/eslint.js module/ --ext .js,.mjs --rule 'linebreak-style: off'`
  - `node scripts/check-rules.mjs`
  - `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`
  ESLint here has no `no-undef`: a missing import passes lint, so jest must exercise what you touch, and
  remove imports that become unused. New files under `module/helpers`, `module/rules`, `module/documents`
  etc. need tests (CI has a coverage floor).
- **Finish** with a summary in the PR/branch description: counts per verdict (convert / partial / skip),
  every behaviour difference, and the engine features the skips would need.

---

## Working notes (the local conversion brief, as of 2026-10-03)

# Conversion proposal brief (READ-ONLY on the repo)

System: `E:\Foundry Virtual Tabletop\foundrydata\Data\systems\essence20` (ROOT). Do NOT edit anything under ROOT.
Write your output only to the file named in your task, in
(the local scratchpad folder - not used in the cloud).

We are moving items from hand-written code (keyed by compendium id) to data rules in `system.rules`,
run by the engine in `ROOT/module/rules/`. Read these first, briefly:
- `ROOT/docs/RULES_ENGINE_PLAN.md` §0a (what's built)
- `ROOT/module/rules/types.mjs` (rule types and their params; `validateRule`)
- `ROOT/module/rules/predicate.mjs` (the `when` tag language - `evaluateTag`)
- `ROOT/module/rules/steps.mjs` (Use/Trigger steps), `ROOT/module/rules/triggers.mjs` (Trigger events)
- Examples already converted: `ROOT/module/rules/conversions.test.js`, `conversions-uses.test.js`, and the pack files they load.

For each item in your list:
1. Find every place its id (or the constant holding it) is used in `ROOT/module` (grep).
2. Decide if its behaviour can be expressed EXACTLY with the existing rule types/tags/steps.
   Behaviour must match the current code, including when it applies and its numbers. Notes on
   equivalences: Edge+Snag cancel at roll time, so `edge: true` is the same as the old
   "if snag, clear it, else edge"; a banked bonus consumed on the next roll = a Use rule with a
   `bank` step; once-per-scene/encounter = `limit: {per: "encounter"}` when the old code used
   hasUsedThisEncounter/scene-clock 'encounter', `"scene"` when it used the 'scene' window.
3. If yes, write the proposal. If only part converts, propose that part and say what stays code.
   If no, say why in one line (what's missing).

Output JSON array, one object per item:
```json
{
  "name": "...", "id": "...", "packFile": "packs/x/_source/Y.json",
  "verdict": "convert | partial | skip",
  "why": "one line",
  "rules": [ ...rule objects exactly as they'd go in system.rules ... ],
  "removeCode": [ { "file": "module/...", "startsWith": "exact first line text of the block", "endsWith": "exact last line text", "note": "what it is" } ],
  "keepCode": "what stays code, if partial",
  "oldTests": [ { "file": "module/...test.js", "startsWith": "exact describe(/test( line" } ],
  "newTest": "a jest test body (plain JS) using the helpers in module/rules/conversions.test.js (holder, switchNames, tick) or conversions-uses.test.js (holder, runUse, ...) that asserts what the old test asserted",
  "strings": ["i18n keys that become unused"]
}
```
Labels: short, in the style of the existing ones ("Related to language (Universal Translator: ↑3)").
Never put rulebook text in a label. Keep labels under ~70 characters.
Reply with a short summary: counts per verdict.

## Lessons from earlier rounds (follow these)
- removeCode `startsWith`/`endsWith` are matched against whole lines INCLUDING indentation (trailing
  whitespace ignored). `endsWith` is the first line at/after the start that matches exactly - so give
  the closing line with its real indentation (e.g. `  },` not `}`).
- When removing an entry from an array/object of `{ ... }` entries, `startsWith` must be the entry's own
  opening `  {` line... which is ambiguous - so instead start at the first line INSIDE the entry, and
  add a separate EDIT note saying the `  {` line above must go too. Never leave a bare `  {` behind.
- Every removeCode entry must be one real contiguous block. No prose "remove these several things"
  entries - list each block separately.
- Lines shared by several items (a `||` condition, a summed expression, a key list) are EDITs: put
  "EDIT" first in `note` and give the exact replacement line.
- Tests shared with items that stay code are EDITs too (say exactly what to change), not deletes.
- Don't convert an item if the rule would change behaviour noticeably (e.g. two switches where the old
  UI made them mutually exclusive) - mark it skip and say why.

## Engine features added since the first round
RollModifier `limit` (+ specialize), `ignoreDownshift`, `immune`, `stack`; bank `specialize`; `until:
'encounter'`; scopes crew/pilot/vehicle/companion/owner (rules/links.mjs); ActionCost type
(rules/actions.mjs - named actions sprint/hide/lendAssistance/drawWeapon/commandPet/defend/... and kinds
attack/item/conversion/shieldToggle); Trigger events hit/miss (with the hit target as `to: target`),
added, conditionGained; tags terrain:/environment:/vehicle:crew|driving/ally|enemy:within:N/scene:name~/
item:element|damageType/attack:unarmed/roll:shove|downshifted/self|target:name~.
`ruleSpecializes` now sees rolledEssence, so `essence:` tags work with `specialize`.
Also: limits accept `per: 'session'` (the Story Points New Session counter); tag `self:canTransform`.

## Output format v2 (USE THIS - supersedes removeCode/oldTests above)
Write TWO files: `proposals-<name>.json` (the per-item array above, but removeCode/oldTests may be
omitted) AND `proposals-<name>-edits.json`:
{
  "edits": [ { "file": "module/...", "find": "exact current text (\r\n line endings as in the file)", "replace": "...", "why": "item: what" } ],
  "packRules": [ { "packFile": "packs/.../_source/X.json", "rules": [ ... ] } ],
  "newTests": { "conversions.test.js": "appended text, CRLF, led by a comment naming the batch", "conversions-uses.test.js": "..." },
  "conversionsImports": ["extra names needed in conversions.test.js's './adapter.mjs' import, beyond applyRuleSwitches, ruleDialogSwitches, ruleRollSources and any already present - check the file"],
  "strings": ["i18n keys that become unused"]
}
Only include items with verdict convert/partial. Edits are applied IN ORDER; each `find` must occur
exactly once in the file at the moment it is applied. Cover ALL code changes: block removals, shared
lines, now-unused imports/constants/table entries, test deletions and shared-test edits. Deleting a
whole block takes one adjacent blank line too (no double blanks left). Pack files must NOT be edited
via edits (packRules only - they get inserted as text).
VERIFY before replying: copy ROOT/module, ROOT/lang and the relevant ROOT/packs/*/_source to a temp
folder under the scratchpad (e.g. scratchpad/rules/tree-<name>), apply edits in order with a script
(checking uniqueness), insert packRules, append tests, then run there: `node --check` on edited
.mjs, eslint (ROOT's config, `--rule 'linebreak-style: off'`), and jest on the affected slice tests
+ module/rules tests (run from the temp tree with ROOT's jest config/node_modules). Report results.
Another agent is working on other slices at the same time; only touch your slice's files plus the
conversion test files. Other batches may append to conversions*.test.js later - fine.

## Engine features added 2026-10-02 (round 3)
- Generic data tags: `self:data:<path>` (truthy) or `self:data:<path><op><value>` (op >= <= > < = !=),
  same for `target:data:...` and `item:data:...` (the rolled/attacking item). E.g.
  `self:data:system.energon.dark.value>0`, `self:data:flags.essence20.someFlag`, `item:data:system.isPoison`.
- `attack:ram` (weaponEffect system.isRam); `attack:unarmed`.
- Marks: step `{do:'mark', key, to:'target'|'targets'|'self', until?}` / `{do:'unmark', key, to}`;
  tags `target:marked:<key>`, `self:marked:<key>`.
- Formula refs: `@skill.<key>.rank` (d20=0 ... d12=6), `@spent` (amount the last spend step took),
  `@var.<key>`, `@count.allies.<ft>` / `@count.enemies.<ft>`.
- `spend` step amount may be `{min, max}` (player picks; sets @spent).
- DialogSwitch / RollModifier `stack: "<group>"`: ticked switches in one group are alternatives - only
  the biggest applies (use for old mutually-exclusive selects).
- Use/Trigger `limit.onlyOnSuccess: true`: the limit is only used up if the run's last roll step succeeded.
- ChoiceSet `from: 'text'` (player types it); labels may contain `{choice.<key>}` and `{item.choice}`;
  tags may contain `{item.choice}` (the item's own system.choice).
- Hang-Ups flagged maturedIgnored are inactive for rules (like holding()).

## Engine features added 2026-10-02 (round 4)
New rule types (see module/rules/types.mjs + adapter.mjs):
- `SurpriseExemption` {mode: 'normal'|'move'|'speedAsLevel'} - acting while Surprised. Tag `self:recklessAbandon`.
- `Sense` {mode?: darkvision|monochromatic|lightAmplification, range} - darkvision grant (best range wins with items' visionGrant).
- `MovementAction` {ignoreRoughTerrain?, pushFeet?, pushUnlimited?} - read by rough-terrain.mjs / token-movement.mjs.
- `ItemModifier` {items: [item: tags], path: 'system.x', op, value} - numbers on the actor's OTHER items.
- `Qualification` {items: [item: tags], access: 'qualified'|'trained'} - widens Requisition access.
- New scopes `party` (everyone else on a Party roster with the holder) and `aura` (+ `radius` feet,
  `affects`: allies|enemies|all) on roll modifiers/switches, Defense, DerivedStat, damage, Sense, etc.
- Trigger events `lendAssistance` (on the helper, `to: target` = the ally) and `assisted` (on the ally,
  target = helper); tag `assist:skill` / `assist:attack`.
- Tag `item:name~<text>`.

## Engine features added 2026-10-02 (round 5)
- Data tags can compare with another stored value on the same document: `self:data:system.power.value<$system.power.max`.
- `weapon:<item tag>` asks the weapon a rolled weaponEffect belongs to: `weapon:data:system.isPoison`, `weapon:name~rifle`, `weapon:trait:x`.
- A RollModifier that has to ask (an `ask:` tag) may say `default: true` so its switch starts ticked.
- Prerequisite tags (usable anywhere): `self:skill:<key>>=<die>`, `self:essence:<key>>=N`, `self:size>=<size>`, `self:has:<name>`, `self:count:<type>>=N`, `self:trained:<group>.<key>`.

## Engine features added 2026-10-02 (round 6)
- dice.mjs early return fixed: non-attack rolls WITH a target now get rule sources, incoming rules, banked bonuses and limits.
- Tags `self:wearing:<class>` / `self:wearing>=<class>` / `self:wearing<=<class>` (equipped armor; classes non light medium heavy ultraHeavy).
- Tag `rule:data:<path><op><value>` reads the rule's own item (e.g. `rule:data:system.choice=akimbo`).

## Engine features added 2026-10-02 (round 7)
- Tags `item:isHost` / `item:onHost` (seen from an upgrade's rule: the item it's attached to / another item on that same host,
  e.g. the host weapon's weaponEffects) - use with ItemModifier `items: ["item:type:weaponEffect","item:onHost"]`.
- Formula refs `@actor.<path>` and `@item.<path>` (any stored number).
- Resource `{rolePoints: true}` (the actor's base Role Points: Cheer, Terror...) for spend/gainResource/cost.
- roll step `difDefense: toughness|evasion|willpower|cleverness` - DIF is the first target's Defense.
- Step recipients `to: "allies:<ft>" | "enemies:<ft>" | "allies+self:<ft>"`.
- Grant rule / grant step `uuid` may be `{choice.<key>}` (pick with a list ChoiceSet of uuids).
- Trigger events `combatStart`, `combatEnd`, `initiativeRolled`, `storyPointSpent`.
- Step `askNumber` {var, min, max, prompt} -> `@var.<var>`.
- Tags `roll:untrained`, `vehicle:moves:<aerial|ground|swim>`; RollModifier `immune: ["untrainedSnag"]` lifts only the
  automatic untrained Snag (read by helpers/roll-dialog.mjs#_isUntrainedSnag).

## Engine features added 2026-10-02 (round 8)
- Rule type `ConditionImmunity` {conditions: [status ids]} - read by helpers/condition-immunity.mjs#isImmuneToCondition; any scope incl. aura/party.
- Step `pickGrant` {from: {type, availabilities?: [...], tags?: [item: tags tested on each compendium entry]}, integrated?, until?, to?, title?}
  - uses helpers/grants.mjs findItems/pickOne/grantCopy; the picked uuid is @var.picked. (No role-perk/origin pickers, no quantity/rename overrides.)

## IMPORTANT lint note (2026-10-02)
Lint with `node node_modules/eslint/bin/eslint.js <paths> --ext .js,.mjs --rule 'linebreak-style: off'`. Without `--ext`, a
directory argument only lints .js files and skips every .mjs. ROOT is fully lint-clean with --ext as of now.
Also: some pack sources are LF (e.g. packs/iafav2items) - match each file's own line endings when inserting rules.

## Engine features added 2026-10-02 (round 9)
- Rule type `AttackCount` {count | additional, when} - attacks per Attack action, read by helpers/action-perks.mjs#getAttacksPerAction;
  the rule's `when` (attack tags) also filters the chained attacks.
- Step `bonusAttack` {count?, cost: none|free|move|standard, when?: attack tags the bonus attack must match, psychicOnMiss?, to?}
  - wraps helpers/action-economy.mjs#grantBonusAttack; fails (stops the run) outside combat.
- `weapon:` tags work on items whose owner is `item.actor` too.
- A Use that stops with nothing in chat posts no card.

## Engine features added 2026-10-02 (round 10)
- Tag `vehicle:type:<zord|vehicle>` (what the actor is crewing).
- Rule type `WeaponTrait` {traits: [...], items?: [item: tags, tested on each weapon with its traits so far]} - read by weapon-traits.mjs#perkGrantedTraits.
- Rule type `Hardpoints` {external?, integrated?, nonWeapon?, perWeapon?, reinforced?, items?} - read by hardpointBonus / integratedHardpointsPerWeapon / firesAsReinforced.

## Engine features added 2026-10-02 (round 11)
- Rule type `CriticalOption` {damageValue?, damageType? | essence? | status? | effect?: bonusAttack|blazingStrikes|nextAttackSnag, improve?, stack?} - read by target-riders.mjs#critRiders.
- Tags `item:own` (the roll is made with the rule's own item or one of its weapon effects) and `target:within:<ft>`.

## Engine features added 2026-10-02 (round 12)
- `takesDamage` Triggers fire on Stun hits too; their condition can read the hit: tags `damage:<type>`, `damage>=N` (also <=, >, <, =).

## Engine features added 2026-10-02 (round 13)
- `wouldBeDefeated` Triggers now fire inside combat.mjs#applyDamage at the head of the Defeat-save chain (after immunity
  and every reduction), not as a damage modifier. Steps `leaveAt {value}` / `negateDamage`. Tag `damage:crit` (the hit was a crit).
- Step `setForm` {form: morphed|transformed, value: true|false, to?} - Morph / Alt Mode on or off.
- Step `save` {to, skills: [...], dif (formula), status?, rounds?, damage?: {value, type}, damageAlways?, removeOnSuccess?, title?}
  - posts helpers/save-riders.mjs#postSaveCard; everyone reached rolls one of the skills, failure applies status/damage.
- Recipient `all:<ft>` - every other token's actor in range, either side (= allies.mjs#getAllNearbyTokens).
- Trigger `outcome: success` now also matches a Critical Success; `failure` also a Fumble.
- afterRoll Triggers see the rolled item (spells too: riderContext.itemUuid), so a spell's own effect is
  {type: Trigger, event: afterRoll, outcome: success, when: ["item:own"], steps: [...]}. afterRoll gets no targets; use a
  `{do: "target", min: 0}` step first (it collects the user's targeted tokens) and then `to: "targets"`.
- Already converted this round (don't redo): Avoid The Inevitable, Do Not Go Quietly, Renegade Commander, Rise Again
  (Defeat half), It's Morphin Time!, Let's Go Psycho!, Power Quake, Sorcerous Tremors.
- Recipient `targetOrSelf` - the first targeted actor, or the actor itself when nothing is targeted
  (the "game.user.targets.first()?.actor ?? actor" idiom). In an afterRoll Trigger put `{do: "target", min: 0}` first.
- `hit` / `miss` Triggers now also fire for a spell (or magicBauble) cast against a Defense, once per targeted
  creature, that creature as `target` (`to: "target"`). Use `when: ["item:own"]` on the spell's own rule.
- Rule type `Assist` {side: give|receive, effect: refuse|anyRank} - who may Lend Assistance (lend-assistance.mjs#canAssistWithSkill).
  `when` sees the other party as `target:`, the Skill as `skill:`, its Essence as `essence:`. Tag `roll:outranks` (if present):
  more ranks than the other party in the Skill.
- Linked Triggers: a Trigger with scope aura/party/vehicle/crew/pilot/driven/companion/owner fires for the actor it
  reaches (steps act on them), its limit counted on the holder. New scope `driven`: a rule on a vehicle's driver that changes the vehicle.
- Spells already converted (don't redo): Healing Bandages, Bellowbreath, Big Honking Boom, Lullaby, Flower Power.
- Tag family `holder:<actor tag>` - the actor whose item the rule is on (differs from self only for a linked
  Trigger); `holder:protects` - this actor is the holder's Protected Target. Defender's Oath converted this way.
- Assist effect `boost` {atLeast?, extra?, edge?} (getAssistShiftUp / getAssistEdge); tag `roll:outranks`.
- Rule type `AlternateEffect` {key, name ({primary}, {E20.Key}), changes: {path: value}, formulas: {path: formula with
  @base.<path>}, items?: weapon tags (self scope), baseTypes?, unlessType?}, scope host (an upgrade's weapon) or self
  (a Perk: every weapon `items` matches) - weapon-upgrades.mjs#desiredGeneratedEffects. Converted: Nonlethal, Strobe,
  Covering, Heavy Hitting, Folding Stock, Manipulative, Tracer Rounds, Big Swing. Formula ref `@base.<path>` added.
- Step `pickAlly` {within?: formula ft (default anywhere), filter?: [target: tags on each ally], max?} - the targeted ally/allies
  (1..max), else a picker over helpers/allies.mjs#getNearbyAllyTokens (Frenemy, Ally Awareness, Betrayal). Sets the
  targets, so following steps use `to: "target"` / `"targets"` (bank, heal...). (= banked-buffs pickAllyTargets.)
- Use `cost.resource` may be `{rolePoints: true}`.
- `bank` may carry a Defense bonus instead: {defense: toughness|evasion|willpower|cleverness|any, defenseBonus: formula,
  persist?, until?, uses?, appliesWhen? (target: = the attacker)} - added when the actor is attacked against that Defense
  (dice.mjs, beside riderDefenseAdjust), used up by that attack unless persist (then it lasts until `until`).
- Tag `rule:banked` - a bonus this rule's item banked on the actor is still unspent (gate a Use with `not:rule:banked`).
- Qualification may carry `upgrades: [item: tags]` (items optional then): Qualified in those upgrades - qualify1/qualify2
  isQualifiedUpgrade also ask rules/adapter.mjs#ruleQualifiedUpgrade, so the effective Availability leaves them out.
  A weapon's attached-upgrade entry is probed as {name, uuid, type: upgrade, flags.core.sourceId: uuid, system.availability}.
- Tags `item:availability<=tier` (>=, <, >, =, !=; tiers automatic < standard < limited < restricted < prototype < unique <
  theoretical) - in a Qualification's items, the EFFECTIVE tier (requisitionTier: totalAvailability lowered by every
  essence20.requisitionAvailability listener = what qualify1/qualify2 effectiveAvailability give), elsewhere totalAvailability.
  `item:id:<16-char _id>` - any printing of that compendium entry.
- Step `pickPerk` {from: role|focus|branch, line?: same|gij|pr|tf|mlp|wtnv, notOwn?, ofOwnRole?, minLevel?, maxLevel? (formulas),
  notOwnPerkNames?, excludeName? (regex), subtype? ('role' default for role/branch, any for focus)} = helpers/grants.mjs#pickPerkFrom
  over pickRolePerk (grantPerkOutright + grantedBy flag). Fails (stops) on cancel. Chat "Granted".
- `until: "nextTurn"` (bank, mark, setToggle, grant): ends when the rule actor's next turn starts.
- `pickAlly` {includeSelf: true} offers the actor too. `bank.defense` may be a list ["toughness","evasion"] (one entry,
  used up together by the first attack against any of them).
- A Use whose steps start with `pickAlly` runs it BEFORE paying its action/resource cost (a cancelled pick costs nothing). `target` steps keep the old order.
- `heal` {temporary: true} adds to system.health.bonus (temporary Health, You Got This! / Boosted Vigor idiom) instead of the value.
- `roll` step {edge: true} or {edgeWhen: [tags; target: = the first target]} rolls with an Edge (no bank left behind).
- Tag `rule:altMode` - the rule's item is the Alt Mode the actor is converted into now (Bestial Articulation: a DialogSwitch
  {downshift: 1, when: ["rule:altMode"]} on each Monstrosity Alt Mode).
- Resource `{rolePoints: "Moxie"}` - the Role Points item of that name (else `true` = the base Role's).
- `pickAlly {all: true}` - every ally in range (with filter/within/includeSelf), no picker.
- Rule type `AimBonus` {atLeast?, extra?, limit?, clearToggle?} raises/adds to the Aiming switch amount on a ranged attack (rules/adapter.mjs#ruleAimBonus, read in dice.mjs aimBonus); its limit is spent and clearToggle switched off only when the shot is fired aimed. Tag `roll:aimed` (Aim action taken for this ranged attack, or ctx.aimed). Taking the Aim action now pre-ticks the dialog switch (the old automatic +1 source is gone).
- DialogSwitch {replacesAim: true} - ticked, the Aiming switch's bonus isn't added ("instead of the normal benefits of Aim").
- DialogSwitch {cost: {resource, amount}} - offered only when affordable, never remembered as on, paid when the roll is made ticked.
- RollModifier immune: ["longRangeSnag"] - read by dice.mjs's long-range Snag (adapter#ruleNoLongRangeSnag; Nowhere to Run still sees it).
- Rule type `CritOnD2` {} + `when` - the roll may crit on the d2 (dice.mjs canCritD2; adapter#ruleCritD2). Tag `roll:edge`
  (the roll's resolved Edge, ctx.edge). Other canCritD2 grants in dice.mjs (Let Cool Heads Prevail, Miracle Worker, Eureka...) can use it.
- Converted 2026-10-02 (aim batch): Distance Vision, Dig In (aim half), Calculated Attack, In My Sights (GI Joe, aim-edge half),
  Unshakeable Aim, Long Shot, Sharpshooter's Grace x3, Piercing Shot x2.
- Tag `skill:choiceOf:<uuid>` - the rolled Skill is the one chosen (system.choice) on the actor's copy of that item (e.g. the Field Perk).
- d2 batch converted: Assault Precision, Coin Toss, Ripple Effect, Forward Observation (TF), Let Cool Heads Prevail, Miracle Worker,
  Technical Mastery (direct half), Perimeter Defender x2 (+ Specialized), Fancy Flier, Eureka, Competitive Strength (Brawn half).
  Still code: Energy Connection (Energy Affinity helper), Trade School's granter half.
- Grants now bring a weapon's / armor's / shield's own attached items (weaponEffects, upgrades) - the Grant rule, the
  `grant` step and pickGrant (grantCopy) all do, the same as dropping it on the sheet (lifecycle#attachGrantedChildren).
- `grant` and `pickGrant` take `flags: {key: value}` (written under flags.essence20) and `system: {path: value}` overrides
  for the granted copy (alterationWorn, droneWeapon, quantity...). (JSON editor only.)
- pickPerk {notAdvanced: true} leaves out Advanced Roles (system.isAdvanced, now in the index fields).
- I Got You's ↑1 now banks through the rules bank (banked-buffs entry ruleBank: true) - it never applied before.
- `until: "endOfNextRound"`; tags `markedBy:<key>` (this actor carries mark <key>, set by the other party) and `markedByMe:<key>` (the other party carries it, set by this actor).
- Actor tag `specializedIn:<skill>` (self:/target:) - holds a Specialization item in that Skill.
- Step `fitAttack` {damage?, types?: ["blunt","sharp"], skills?: ["finesse","might"]} after a `grant` of a weapon: sets the
  granted weapon's Blunt hit damage and asks the offered damage type / Skill (helpers/weapon-fit.mjs). `grant` sets ctx.vars.granted.
- Specialization fix: `specializedIn:<skill>` reads system.skills.<skill>.specializations (falls back to items).
- FIXED: Exploit Trust / Hard Hitter's Edge now set before _getFormula (it never applied before).

## Engine features added 2026-10-03 (round 14)
- DamageModifier {direction: "dealt", scaled: true} - joins the attack's own damage bonus (dice.mjs damageBonusValue, via
  adapter#ruleScaledDamage), decided when the attack is rolled. It is therefore multiplied by Degrees of Success, doubled by
  Quiet as the Grave, and listed in the card's damage-bonus sources by its label - EXACTLY like the hand-written
  xxxDamageBonus terms summed into damageBonusValue. `when` is evaluated at roll time with {item, rolledSkill, rolledEssence,
  edge (resolved, after the dialog), dataset, isAttack, isMelee} and other = the first target. The attack's damage type is
  item.system.damageType. Use this for any "+N damage" currently folded into damageBonusValue. A plain (unscaled) dealt
  DamageModifier is still the post-hit flat note.
- Removing a term from the damageBonusValue sum is an EDIT (give the exact replacement line).
- DialogSwitch {damage: <formula>} - ticked, adds that much to the attack's own damage bonus (options.ruleDamage, summed into
  damageBonusValue, label added to the damage-bonus sources). Combine with `cost` for "spend X for +N damage" checkboxes, with
  `when` for when it's offered, with `limit` for once-per-X. A damage-only switch is valid (no shift needed).
- Trigger events hit / miss now fire for ANY roll made against a target's Defense (Intimidation vs Willpower, a Power...),
  not only weapon attacks and spells. `attack` tags stay weapon-only; narrow with `skill:`, `item:own`, etc.
- A `roll` step's roll carries the Use's item (dataset.itemUuid -> riderContext.itemUuid), so afterRoll Triggers can use `item:own`.
- Trigger outcome `double` (afterRoll / hit): a success by at least double the DIF (Degrees of Success x2+, the system's
  "Critical Success" for plain Skill Tests, computeMultiplier >= 2) - a natural crit counts too. `success` still matches it.
- INITIATIVE now reads item rules (dice.mjs#prepareInitiativeRoll): RollModifiers whose `when` holds (use tag
  `roll:initiative`; the rolled skill is actor.system.initiative.skill) add shifts/Edge/Snag as switch-off-able sources;
  DialogSwitches are offered (extDialogToggles) and applied (runApplyDialog) - limits/banks consumed the same way.
- DialogSwitch {useSkill: "<skill>"} - ticked, the roll uses that Skill's die instead (the shift-position difference between
  the rolled Skill and that Skill, added as shiftUp/shiftDown - EXACTLY the delta code in prepareInitiativeRoll for Ever
  Vigilant, Nose for Trouble, Spoof, Cobra Battle Cry...). Offered only when the actor has that Skill and isn't already rolling it.
  Works on ordinary rolls too (delta against the rolled Skill's shift).
- Tags `self:sizeDiff>=N` (this actor's size index minus the other party's, in SIZES order small..titanic - the same raw
  Object.keys(E20.actorSizes).indexOf compare the hand-written Perks use) and `target:sizeDiff>=N` (the target's minus this
  actor's); ops >= <= > < =, N may be negative; null when either size is unknown or there's no other party.
  Formula ref `@size` - the actor's size index (small 0, common 1, large 2, long 3, huge 4 ... titanic 10).
- `ally:within:N` (and pickAlly / @count.allies) now count allies via helpers/allies.mjs#getNearbyAllyTokens (Frenemy,
  Betrayal, Ally Awareness x5) - so it IS exact for code that used getNearbyAllyTokens (On My Own, Deafening Silence...).
- Edits may carry `"all": true` - replace EVERY occurrence of `find` (at least one). Use it for a line repeated in several
  identical expected-dataset literals in dice.test.js (e.g. `      cubePlayerAvailable: false,\n`), which earlier rounds
  skipped as un-editable. Your builder must also handle it (count >= 1 instead of == 1, split/join replace).
- Optional die substitution checkboxes ("may use the X die instead", shift-position delta) = DialogSwitch {useSkill: "x", when,
  limit?}. Exact when the old code added the delta between the rolled Skill's shift and X's shift as shiftUp/shiftDown.
- NOT a gap any more: "_getAutomaticCombatModifiers returns before rollRiderSources for a non-attack roll with a target" -
  the `if (!isAttack) return finish();` path runs finish(), which reads rule sources. RollModifiers apply to targeted
  plain Skill Tests (Pressure Cooker, Who Dares Wins, Community Helper are convertible).

## Engine features added 2026-10-03 (round 15)
- Rule type `Cover` {mode: ignore|reduce|grant|base|add, amount?, against?} (dice.mjs Cover block, adapter#ruleCover).
  The holder's own ranged attacks: `ignore` (no Cover penalty - Penetrating Rounds/Kentucky Windage style, narrow with
  item:trait: / weapon: tags), `reduce` N (the BIGGEST reduction among the hand-written ones and the rules counts, never
  below 0 - What Cover?, Lay of the Land, Nowhere's Safe x2). Attacks against the holder (against: true): `grant` (counts
  as in Cover - Now You Don't with self:transformed), `base` N (Cover is N instead of 2 - Maximize Cover / Hard Target TF:
  base 3), `add` N (on top, after reductions - Dig In while dug in). `when` sees the roll; other = the other party.
- Rule type `Movement` {movement: ground|aerial|climb|swim|burrow|all, op: set|multiply|add|max|min, value, stage?}
  (documents/actor.mjs#_prepareMovement). Stages: `base` (movement.base, right after parseInt - Air Born / Static
  Electricity overrides sit just before), `total` (right after innate+bonus+morphed and Fast's -10, before movementTotal
  and the climb/swim half-ground derive), `adjust` (right after the Natural Movement half-ground line, where Prowl / Wire
  Work / Amphibious Assault / I Can Dig It begin), `final` (end of the loop, after Evasive Maneuvers' halving, before
  _applyGravityMovement). Within a stage: set, then multiply, then add, then max/min. Read other speeds with
  @actor.system.movement.<type>.total / .base. A rule replacing a hand-written line in the MIDDLE of the loop is exact
  only if moving it to the nearest stage changes nothing for that Perk on its own - say so in `why`.
- SAFETY (2026-10-03): apply-edits-v2.cjs now needs TREE=<your copy dir> (or --root, which agents must NEVER pass). To verify
  your batch, copy the files you touch into your own tree folder and run with TREE set. Never write under ROOT.
- DialogSwitch {forget: true} - always starts at its default (not the remembered last state); a switch with a `limit`
  forgets automatically. Use forget: true whenever the old checkbox always started unticked (most one-roll checkboxes).
- Scaled DamageModifier `when` now also gets `holder` (holder: tags - the actor whose item it is, e.g. the pilot).
- `bank` step {damage: N} - a banked "+N damage" for the next roll matching appliesWhen (e.g. ["attack"]): added to that
  attack's own damage bonus (damageBonusValue, multiplied by Degrees of Success), listed by label, used up by the roll.
  Any roll source carrying `damage` works the same way (dice.mjs sums combatModifierSources' damage unless unticked).
- Tags `roll:dataset:<key>` (the roll's dataset flag is set; `roll:dataset:<key>=<value>` compares, case-insensitive),
  `roll:specialization~<text>` (rolled with a Specialization whose name contains it), `combat:first` (this actor is first in
  the started combat's Initiative order).
- Initiative also reads RollModifier `specialize` (Springy).
- DialogSwitch {spend: {resource, max?}} - a number box in the dialog, 0 up to min(max, what the resource holds); the
  amount chosen is paid when the roll is made and is `@spent` in the switch's upshift/downshift/damage formulas (e.g.
  {spend: {resource: {path: "system.energon.normal.value"}}, damage: "@spent"}). Never remembered. Not with `cost`.
- A ticked DialogSwitch with a `limit` now uses it up (before, the limit was checked but never spent).
- Scaled DamageModifier `when` now also sees `defenseType` (the Defense the dialog settled on: `defense:cleverness` -
  Station Management, Razor Tongue x2, The Weather) and `snag` (tag `roll:snag`, the resolved Snag - Raw Ferocity).
- Tag family `check:<name>[:<option>]` (also `self:check:`, `target:check:`) - a NAMED test the system's own helper answers,
  for state that lives in code rather than data (rules/predicate.mjs#CHECK_NAMES, registered in essence20.mjs):
  environmentalExpertise (hasActiveEnvironmentalExpertise), cannoneerDugIn, bulwark (isBulwarkActive), rushTheLine,
  sprinterBoost, skiing, nearbyDefeatedAlly (Field Aid), frictionlessMovement, gravityOptional, wisdomOfTheElders:<option>,
  monsterForm, warriorMode, powerAdaptation:<option>, highGear, theToughGetGoing, energyAffinityAttack (the rolled
  weaponEffect is of the Energy Affinity Element / altered style - Energy Connection, Flux Additives, Energy Mastery).
  The helper names the state, NOT a compendium id - exactly what Phase 5 wants. These replace `actorHasPerk(X) && isXActive()`
  pairs: the rule sits on item X, so ownership is implicit. Need another one? Say which helper in `why`.
- Formula refs `@target.size` (the roll target's size index), `@target.level`, `@target.<path>` - 0 with no target. Resolved
  for RollModifier / DialogSwitch shifts (other = the roll's target). E.g. upshift "max(0, @target.size - @size)".
- check `equippedFireWeapon` (an equipped weapon with the Fire trait). Wildfire is converted (final stage; its +10 now lands
  after Quantum Master / Lightning Speed doublings when combined - cross-line, accepted).
- gainResource on a `.value` path now stops at the sibling `.max` (never removing what's already above it) - e.g.
  system.powers.personal.value / .max (Cruel Warlord's Psychic regen).
- DialogSwitch {spend: {max: N}} with no resource - a plain 0..N number box, nothing paid; @spent as usual (Demolition Driver).
- DialogSwitch {clearSnag: true} - ticked, any Snag is removed (the old "edge = true; snag = false" checkbox shape), so its
  Edge isn't cancelled by a Snag. (Pressure Cooker, Eureka/Eltarian Tech/Always Ready/Dependable Tanker style checkboxes.)
- DialogSwitch now accepts `limit` in validation (misc7).

## Round 16 (2026-10-03) - dice.mjs region sweep
Batches applied so far: dmgA/B/C, init, subst, cover, move, misc6, misc7. Their proposals files hold every skip reason -
check them before re-deciding an item. ~250 actorHasPerk/findPerk checks remain in dice.mjs.

## Engine features added 2026-10-03 (after the regA/regB/regC cloud round)

Built for the skip lists in `docs/rules-batches/reg*.md` - re-check those skips against these first.

- **Trigger outcomes that read the results themselves** (`afterRoll` / `hit`): `x2` (some result succeeded by
  double the DIF - Degrees of Success only, a crit or not), `anyFailed`, `allFailed` (whatever the dice
  showed), `fumbled` (a Fumble even if it also crit). The old six (`success`, `failure`, `double`, `crit`,
  `fumble`, `any`) are unchanged.
- **Turn order and level tags:** `self:notActed` / `target:notActed` (that actor's turn comes later this round
  than the current one - First Strike's / Oorah!'s check, in any combat); `combat:aheadOfTarget` (my
  Initiative is higher than the target's, both rolled); `combat:highestInitiative` (no combatant rolled
  higher - ties count, unstarted combats too - Goin' Heels); `self:levelDiff>=N` / `target:levelDiff>=N`
  (Level, or Threat Level for an NPC, minus the other party's).
- **`DieSubstitution`** {mode: use|best|floor, skills, die, specialize, clearSnag, limit}: the die the roll
  STARTS from (dice.mjs initialShift, before the dialog), the rolled Skill unchanged. `use` that Skill's die
  (Jacket Wrestler); `best` of the current and these Skills' dice (Aerial Acrobat, Circuit Breaker, Cultural
  Connection, Brutal Verbalities, Agency with skills ["choice"]); `floor` at least this die ("A" for Effort!,
  Basic Intelligence - with clearSnag). It applies when it changes the die (a floor: when the die is at or
  below it); only then do specialize / clearSnag / the limit happen. Runs after the hand-written substitutions.
- **`RollDice`** {d20Floor: 10, thirdD20, maxDie, stepUp}: once the final die is known - Silver Tongue,
  Kill Shot / Precision is Perfection (with `roll:edge`), a die cap, Super Specialized's step (with
  `roll:specialized`). Its `when` sees the settled Edge/Snag and `dataset.isSpecialized`.
- **Defense modes (per attack):** `mode: best` with `from: ["willpower"]` (use the better of the current
  Defense and those - Psychological Warfare, Evasive, Split-Second Reaction...), `halve` (Unseen Strike,
  Augmented), `fail` (the roll can't succeed - Just the Facts, Trustworthy). `outgoing: true` puts the rule on
  the ATTACKER and changes the target's Defense (Shatter Resolve). `limit` works (Scapegoat once per scene).
  A Defense rule with any of these is decided per attack, never added to the sheet. best runs before halve.
- **`late: true` on a RollModifier:** decided after the Roll Options Dialog, with `defense:` reading the Defense
  the dialog settled on (Silver / Graphite / Orange Ranger Prime's Snag, scope incoming). Not a dialog
  source or switch.
- **Ally auras** (`scope: aura`, affects allies) count allies the system way (getNearbyAllyTokens: Frenemy,
  Betrayal, Ally Awareness); `stacks: false` makes one book item's aura count once however many allies in
  reach hold it (Pay It Forward). **Cover** rules take the `aura` scope too (Two Steps to the Right, Bulwark).
- **DialogSwitch `key` and `steps`:** ticked, the roll carries the key - hit / miss / afterRoll Triggers ask
  `roll:switch:<key>` (Hobble, Crippling Blow, Get A Grip, Cryogenic Touch, Guardian Strikes... "declare it,
  then something happens on a hit"); `steps` run as the roll is made (Angry's Hang-Up, Caution To The Wind's
  bank). A switch with only `clearSnag` is valid (Solo Shot).
- **`DamageType`** {to: "sharp" | "choice"}: the attack deals this damage type instead (after the hand-written
  overrides in dice.mjs); `when` sees switch keys (Saber-Toothed), `self:transformed` (Tooth And Claw)...
- **Scaled DamageModifier `limit` and `steps`** (Force: once per encounter, banks a ↓1 when applied).
- **Step `loseHealth`** {amount, to}: Health lost outright - no resistance, no Defeat-save chain (Cost of
  Sorcery).
- **More `check:` names:** `defeatedAllyInReach` (Not On My Watch), `decepticonNemesis` (against the other
  party), `nemesisInScene`, `multipleTargetsWeapon`, `favoriteWeaponEquipped`, `favoriteWeaponRolled`
  (Down the Barrel, Ricochet), `zordHasDriver` (Martial Zord, Zero-G, Zord Sentience), `personalShield`
  (Impenetrable Shield).
- **`roll:specialization=<name>`** - exact name (ignoring case); `~` is "contains". Prefer `=`.

## Engine features added 2026-10-04 (after the slice round)

- **SkillSubstitution `scope: "item"`** - the rule sits on the rolled item itself (a weapon effect) and applies to
  whoever rolls it: its owner, or a crew member / pilot firing a vehicle's or Zord's weapon. All 66 "Finesse or Might"
  weapon effects now carry `{from: finesse, to: might, mode: bestOf}` and the reverse this way; `data21/weapons.mjs`'s
  pre-roll swap is gone.
- **DialogSwitch `defaultWhen: [tags]`** - starts ticked when those tags are known true (otherwise its `default`).
  Pair it with a `when` that answers "unknown" when the fact isn't set: City Slicker is
  `when: ["skill:infiltration", "terrain:urban"], defaultWhen: ["terrain:urban"]` - offered in an urban or untagged
  scene, pre-ticked only when urban (its slice toggle is gone).
- **More `check:` names:** `computerizedGear` (robot / part Perks / worn computerized gear - Machinesmith, Dielectric,
  Insulator), `outsideEnvironmentOfExpertise` (Stalk), `nonMystical` (Mystic), `medicineKit` (carries a Science
  (Medicine) kit - Proper Protection), `shapeShifted` (an MLP changed shape this scene) and `disguised` (Identity
  Crisis), `grappleEscape` (the rolled Skill is one of this actor's grapple-escape Skills - Experiment),
  `infiltrating` (the Infiltrating toggle - Shadow, Silent Strider).
- Bookworm's rule skips Initiative (`not:roll:initiative`): `situational2/initiative.mjs` still adds its Initiative ↓1.
