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
  automatic untrained Snag (read by mechanics/rolls/roll-dialog.mjs#_isUntrainedSnag).

## Engine features added 2026-10-02 (round 8)
- Rule type `ConditionImmunity` {conditions: [status ids]} - read by mechanics/combat/condition-immunity.mjs#isImmuneToCondition; any scope incl. aura/party.
- Step `pickGrant` {from: {type, availabilities?: [...], tags?: [item: tags tested on each compendium entry]}, integrated?, until?, to?, title?}
  - uses mechanics/resources/grants.mjs findItems/pickOne/grantCopy; the picked uuid is @var.picked. (No role-perk/origin pickers, no quantity/rename overrides.)

## IMPORTANT lint note (2026-10-02)
Lint with `node node_modules/eslint/bin/eslint.js <paths> --ext .js,.mjs --rule 'linebreak-style: off'`. Without `--ext`, a
directory argument only lints .js files and skips every .mjs. ROOT is fully lint-clean with --ext as of now.
Also: some pack sources are LF (e.g. packs/iafav2items) - match each file's own line endings when inserting rules.

## Engine features added 2026-10-02 (round 9)
- Rule type `AttackCount` {count | additional, when} - attacks per Attack action, read by mechanics/actions/action-perks.mjs#getAttacksPerAction;
  the rule's `when` (attack tags) also filters the chained attacks.
- Step `bonusAttack` {count?, cost: none|free|move|standard, when?: attack tags the bonus attack must match, psychicOnMiss?, to?}
  - wraps mechanics/actions/action-economy.mjs#grantBonusAttack; fails (stops the run) outside combat.
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
  - posts mechanics/combat/save-riders.mjs#postSaveCard; everyone reached rolls one of the skills, failure applies status/damage.
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
  (1..max), else a picker over mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens (Frenemy, Ally Awareness, Betrayal). Sets the
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
  notOwnPerkNames?, excludeName? (regex), subtype? ('role' default for role/branch, any for focus)} = mechanics/resources/grants.mjs#pickPerkFrom
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
  granted weapon's Blunt hit damage and asks the offered damage type / Skill (mechanics/resources/weapon-fit.mjs). `grant` sets ctx.vars.granted.
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
- `ally:within:N` (and pickAlly / @count.allies) now count allies via mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens (Frenemy,
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

## Engine features added 2026-10-04 (the bigger pieces)

- **Trigger events on other actors' doings:**
  - `targeted` - fires on each defender a roll was made against. `outcome` is from the attacker's side
    (`success` = it hit you, `failure` = it missed, `x2`/`crit`/... as usual); the Trigger's target (`to: target`)
    is the attacker; `@var.margin` is the roll total minus the Defense (negative on a miss). Counterstrike, Sidestep-
    style "when an attack against you misses" Perks.
  - `dealtDamage` - fires on whoever's chat-card damage landed (target = who took it; the damage is `damage:` tags).
  - `defeatedEnemy` - fires on whoever's damage Defeated someone (target = the Defeated).
  - `takesDamage` now gets the damage dealer as its target when known.
- **Item steps** (`item` picks which: `self`, `granted` (items this rule's item granted), `source:<uuid>`,
  `name~<text>`, `type:<type>`, `choice:<key>`; first match, or every match with `all: true`; `to` as usual):
  - `createItem {data: {name, type, system...}, until?}` - an item from inline data, like a grant.
  - `deleteItem {item, all?, required?}` - remove items (a target's too).
  - `updateItem {item, set: {path: value|formula}, add: {path: formula}}` - change numbers or values.
  - `spendQuantity {item, amount, deleteAtZero?}` - use up quantity; stops the run if there isn't enough.
- **`pick {key, from, ...}`** - choose and remember on the rule's item (`flags.essence20.rules.choices.<key>`):
  `from` skill | essence | damageType | ownedItem (`itemType`, `equipped`) | ally / enemy (`within`) | target | list
  (`options`). `ifUnset` keeps an earlier pick. Read back with `{choice.<key>}` in tags (`skill:{choice.skill}`),
  `item:picked:<key>` (the rolled item or its weapon is the picked one), `self:` / `target:picked:<key>`, and the
  item steps' `choice:<key>`. `@var.picked` is the value.
- **`button {label, intro?, steps, who?, runAs?, once?}`** - posts a chat card whose button runs `steps` when pressed
  (rules/buttons.mjs). `who`: owner (default - its owners and the GM) | gm | anyone | targets | others; `runAs`:
  holder (default) | clicker (the presser's own character - "Follow Me!"); `once` (default true) marks it used. The
  current targets go with it. Use it for hit follow-ups, GM damage buttons and offers to the rest of the party.

## Engine features added 2026-10-05 (after slice round 2)

- **Durations** (`until` on mark / bank / grant / createItem / pickGrant / setToggle), rules/expiry.mjs:
  - `endOfNextTurn` - through the end of the next turn (the current one doesn't count).
  - `turnOrScene` / `roundOrScene` - the turn / round in a running combat, else the scene.
  - `rounds:N` - N rounds on (the same point in the turn order), else the scene. The editor offers 1, 2, 3, 5, 10;
    any N works in JSON.
  - **`untilOf: "recipient"`** - count the turns of whoever the step lands on, not the holder's: "until the end of the
    marked creature's next turn" is `{do: mark, to: target, until: endOfNextTurn, untilOf: recipient}`.
- **Watch Triggers** - `watch: ally | enemy | any` on a Trigger makes it fire when its event happens to SOMEONE ELSE
  on the canvas (optional `within` feet): an ally's hit, an enemy's Fumble, an ally Defeated, another creature's turn
  ending. Steps act as the holder; `target` is the one it happened to, or with `watchTarget: theirTarget` the one
  they rolled against / who hit them. `self:` tags read the holder, `target:` the other; roll tags read their roll.
  The holder's own events don't fire a watch Trigger. Not offered for `wouldBeDefeated`.
- **Reaction rules** (rules/reactions.mjs) - a button on a posted check card for whoever may answer it:
  `{type: Reaction, label, who, within?, per?, outcome?, attackOnly?, minMargin?, maxMargin?, cost?, limit?, steps}`.
  `who`: target (default) | attacker | allyOfTarget | allyOfAttacker | enemyOfAttacker; `per`: row (default, a
  button per target row) | card; `outcome`: any | hit | miss (that row's result; a card: some row's); the margin
  is the card total minus the row's DIF. Pressing pays the resource cost, runs the steps, counts the limit and
  claims the button. Steps see `@var.total`, `@var.dif`, `@var.margin`, `@var.damage`; `target` is the other side
  (the attacker for the defender's side). Card-only steps (refused outside a Reaction):
  - `negateHit {rows?}` - the hit on that row has no effect (its damage / crit / rider buttons are spent).
  - `lowerTotal {amount, rows?}` - lower the card's total; rows that drop below their DIF miss.
  - `lateSnag {rows?}` - roll another d20 and keep the lower, then as lowerTotal.
  - `convertRows {crit?, rows?}` - turn failed rows into successes (crit: Critical Successes), with Apply buttons.
  `rows: all` acts on every row of the card instead of the button's own.
- **`button` limits** - `limit: {per, max, key?}` on a button step counts when it's pressed, on whoever the steps
  act as (each presser's own with `runAs: clicker`), across every card the rule posts.
- **Dice in formulas** - `1d2`, `2d4 + 1`, `d6` anywhere a formula goes. Step amounts tell the roll in the run's chat
  and keep it as `@var.rolled`. Step formulas also read **`@target.<path>`** now (the run's first target).
- **Old picks** - `legacy: "flags.essence20.<oldFlag>"` (or `"actor.flags..."`) on a `pick` step or ChoiceSet rule:
  the GM's linking pass moves the old value into `rules.choices.<key>` (never over a newer pick), and `pick` with
  `ifUnset` reads it before asking. Lets a pick replace a hand-written picker without losing existing characters'
  choices (pr1DinoGem, pr1LightspeedBoost, gij2ExpertSkill, gij2Mentor, ...).
- **Granted items** - `rule:granted` (something the rule's item gave the actor is still there), `rule:granted:<item
  tag>` (`rule:granted:type:weapon`), and `item:granted` (the rolled item, or its weapon, was given by the rule's
  item - Rotor Blades' ↑1 with its own blades). **`createItem` `children: [item data]`** makes a weapon's attacks /
  an armor's upgrades with it, attached the way a compendium weapon's are (parentId, the host's system.items), with
  the host's grant and expiry flags. `{choice.<key>}` works in created names.

## Engine features added 2026-10-05 (round 4, after the local round-3 conversions)

- **Tags:**
  - `self:wielding` / `target:wielding` - one of the actor's attacks belongs to an equipped weapon (unarmed attacks
    don't count). `self:wielding:<any tag>` narrows it, asked of that attack: `self:wielding:weapon:trait:ballistic`,
    `self:wielding:item:data:system.classification.skill=finesse`, `self:wielding:attack:melee`.
  - `combat:exists` - a combat is set up, started or not (bare `combat` still needs it started).
- **`until: combat`** - lasts while the combat it started in exists (started or not); with no combat, until something
  else ends it.
- **Mark counters** - `mark {count, add?}` keeps a number on the mark: `@mark.<key>` (the actor's own) and
  `@target.mark.<key>` read it (0 when unmarked or run out). `add: true` adds to a running mark (the duration restarts).
- **Steps:**
  - `essenceDamage {essence, amount, to}` - `essence`: strength | speed | smarts | social | `{choice.<key>}` | `choose`
    (asks). Never below 0; Immortal Rebel Soul still applies (mechanics/world/environment-hazards.mjs).
  - `healEssence {essence?, amount, to}` - one Essence up to its maximum, or with none named the most-damaged first.
  - `extendCondition {condition, rounds, to}` - a timed Condition lasts `rounds` longer (an untimed one is left alone).
  - `rerollCard {target?, mode?, keepBetter?, rows?}` (Reaction only) - rerolls the card's roll through
    mechanics/rolls/reroll.mjs (target d20 by default) and posts it; rows the new total no longer reaches miss
    (`negateHit`), rows it now reaches become hits (`convertRows`).
  - `roll` gains `snag: true` and `open: true` (an ordinary roll with no DIF, against whoever is targeted; its `then`
    steps run after, with `@var.rollTotal`; a cancelled roll stops the run).
  - `grant` gains `name` (`{choice.<key>}` works), `integrated: true` and `systemFormulas: {path: formula | [tags]}`
    (a tag list sets true/false - `equipped: ["self:data:system.isTransformed"]`).
- **Every step** takes `filter: [tags]` - only recipients meeting them (asked as the target: `target:type:npc`).
- **Trigger `outcome` may be a list** - every one must hold (`["fumbled", "allFailed"]`); new outcome `plainSuccess` (a
  success that isn't a Critical Success or double the DIF). afterRoll Triggers get `@var.total`.
- **Toggle `legacy`** - like a pick's: the GM's linking pass moves an old on/off flag into `rules.toggles.<key>`.
- **Granted attachments** - a granted weapon / armor's attached attacks and upgrades now carry the host's `grantedBy` and
  expiry, so they go with it (and count for `rule:granted`).

## Engine features added 2026-10-05 (round 5, after the local round-4 conversions)

- **Tags:**
  - `target:ally` / `target:enemy` - the other party is on this actor's side (token disposition; off the canvas, PC or
    not). Good in a step `filter` (Watchful Eyes' "enemies you target").
  - `var:<key>[op value]` - a value stored in this run (`var:margin<=-5`, `var:rolled>=4`, `var:picked=red`). Step
    conditions, Trigger / Reaction `when` and `require` all see the run's vars (`@var.margin`, `@var.total`...).
  - `vehicle:data:<path>[op value]`, `vehicle:name~<text>` - the vehicle being crewed.
  - `terrain:set` (some terrain is set - pair with a terrain tag so an unset scene answers "no", not "ask");
    `environment:outside:<x>` (not counting a vessel interior).
  - New `check:` names: `inWater` (underwater or swimming), `onLand`, `seaOrWetlands`, `aboardAquaticVessel`,
    `completeDarkness` (unknown below full scene darkness).
- **Formulas:** `@host.<path>` - the item the rule's item is attached to. Text fields (`chat`, `require`'s message,
  `table` rows, `updateActor` text values, `damage`'s `damageType`) fill `{choice.<key>}`, `{var.<key>}` and
  `{@<formula>}` (`{@mark.questions}`).
- **Durations:** `endOfNextTurn` / `nextTurn` set in a combat that exists but hasn't started count from its first round.
- **Recipients:** `to: party` / `party+others` (the actor's Party roster; the primary Party first) and `team` /
  `team+others` (every Player Character).
- **Steps:**
  - `updateActor {to, set: {path: value | formula | true/false | text}, add: {path: formula}, min?, max?}`.
  - `require {check: [tags], message?}` - stop unless the tags hold. **`beforeCost: true`** on any leading step of a
    Use runs it before the cost is paid (a `require` gate, a `target`, an `askNumber`); a stopped run still posts what
    it said.
  - `setTargets {to}` - make the recipients the user's targets (a counter-attack at the attacker).
  - `writeInitiative {to, value}` - set Initiative in the running combat.
  - `table {formula, rows: [{min, max, text, steps}]}` - roll and use the row it lands in (`@var.rolled`).
  - `item: "wielded"` / `"wielded:<tag>"` on item steps (the weapons being wielded); `roll {skill: "wielded[:<tag>]"}`
    rolls that attack's own Skill (the run stops when nothing is wielded).
  - `gainResource {overMax: true}`; `bonusAttack {optional: true}` (no combat doesn't stop the run); `bank {replace:
    true}` (one banked bonus per item); `pick {from: ownedItem, filter: [item tags], auto: true}` (a lone option is
    taken without asking).
  - `button` cards carry the run's vars (`@var.damage`, `@var.margin`...) to the pressed steps.
  - The `open` roll passes the Skill's own sheet shifts and reads the total of a roll with nothing to compare against.
- **Rules:**
  - DerivedStat paths may read a pick (`system.skills.{choice.skill}.edge`; no pick, no change) and `value` may be
    `true` / `false` (set as it is).
  - RollModifier `consumeMark: <key>` (`consumeFrom: self | target`) - the roll it applies to uses up that mark.
  - Movement `stage: afterGravity` - after Low Gravity / Zero-G.
- **Trigger events:** `equipped` / `unequipped` (the item's own rules fire even as unequipping switches them off),
  `resourceSpent` (`@var.spent`, `@var.resource` = power | energon | darkEnergon | health), `essenceChanged`
  (`@var.essence`, `@var.change`). **Outcomes:** `plainFailure` (failed, not Fumbled), `anySucceeded` (some row beat
  its DIF - pairs with `fumble` / `crit` in a list).
- **Clean-up:** deleting an item also removes what's attached to the items it granted (a granted weapon's attacks made
  before attachments carried `grantedBy`).

## Engine features added 2026-10-06 (round 6, after the local round-5 conversions)

- **Tags:**
  - `target:self` - the other party is this actor itself (keep a step from aiming at its own holder).
  - `self:status:<id>:timed` / `target:status:<id>:timed` - the Condition is on and runs out after some rounds.
  - `wielding:<tag>&<tag>...` - several tags that must all hold on the same wielded attack (`self:wielding:weapon:trait:
    ballistic&not:attack:melee`); the `item: "wielded:..."` selector and `roll {skill: "wielded:..."}` take it too.
  - `item:trait:` now reads traits that attached upgrades add (`itemAndUpgradeTraits`, on the item and its weapon).
  - `item:hasUpgrade:<uuid | name~text>` - an upgrade attached to the item (or its weapon).
  - `rule:hostEquipped` - the item the rule's item is attached to is equipped.
  - `combat:enemyStatus:<id>` / `combat:allyStatus:<id>` - a combatant on the other / this side has that Condition.
  - `roll:fumble` - in a Reaction's `when`, the card's roll is a Fumble. Reactions also see the row's damage type
    (`damage:<type>`) and `@var.damageType`.
- **Formulas:** `@recipient.<path>` - the actor a step is acting on (in `updateActor`, each recipient's own values;
  `min` / `max` may be formulas read that way: `max: "@recipient.system.powers.personal.max"`).
- **Durations:** `nextTurnOrScene` (nextTurn in combat, else the scene); `worldTime:<seconds>` (game-world time -
  `worldTime:604800` is a week).
- **Recipients:** `combatAllies` / `combatAllies+self` (the running combat's combatants on the actor's side);
  `alliesOfTarget:<ft>` / `enemiesOfTarget:<ft>` (around the first target: its allies, or its enemies, within range of
  it).
- **Steps:** `mark {exclusive: true}` - the actor's mark under that key moves (it comes off anyone else it was on: "last
  hit by"). `applyCondition` through the GM now keeps its `rounds`. `table` row `text` may be an i18n key.
- **Rules:** a `team` scope (every other Player Character in the world) wherever `party` is allowed. Movement `stage:
  afterDerived` (after every derived adjustment, the hand-written ones too) and `round: nearest | floor | ceil`.
- **Triggers:** afterRoll gets `@var.dif`. A roll with nothing to compare against (no target, no DIF) now reaches
  afterRoll Triggers that say `outcome: "any"` in so many words (with `@var.total` and the rolled Skill) - Triggers
  with no outcome set still ignore those rolls. New outcome `notDouble` (no row reached double its DIF, no Critical
  Success - with `fumble` and `anySucceeded` in a list: a Fumble that still succeeded, not by double).

## Engine features added 2026-10-06 (round 7, after the local round-6 conversions)

- **Tags:**
  - `self:onCanvas` - the actor has a token in the scene being viewed.
  - `self:itemCount:<type>[:equipped]<op><n>` - `self:itemCount:weapon:equipped>=2` (Good with Both).
  - `self:actionUsed:<standard | move | free>` - spent that kind of action this turn (the action-economy ledger).
  - `self:wearingItem:<item tags joined by &>` - equipped armor / shield / gear meeting them (`item:hasUpgrade:` too).
  - `self:hasItem:name~<text>` / `target:hasItem:name~<text>` - an item whose name contains the text.
  - `item:word:<text>` - the item's name holds that whole word.
  - `item:hasAttack:<tags joined by &>` - one of the weapon's attacks (owned attack items, else the stored entries)
    meets them: `item:hasAttack:item:data:system.classification.style=melee`, `...system.numHands=2`.
  - `roll:targets<op><n>` - how many targets the roll had (afterRoll / hit Triggers also get `@var.targets`).
  - `host:<item tag>` now works at roll time too (the item the rule's item is attached to - Gunport).
  - `combat:enemy:<tags joined by &>` / `combat:ally:<...>` - some combatant on that side meets them, asked as the
    target (`combat:enemy:target:name~librarian`).
- **Formulas:** `dice(count, faces)` - dice whose count is a formula (`dice(@var.spent, 4)`); `@count.items.<type>` /
  `@count.equipped.<type>`.
- **Durations:** `endOfNextTurnOrScene` (endOfNextTurn in combat, also ending with the scene; the scene out of combat),
  `turnOrUntilCombat` (this turn in combat; out of combat until a combat starts).
- **Recipients:** `to: partyActor` - the Party document itself (the primary Party first).
- **Steps:**
  - `choose` options may carry their own `when` (only offered while it holds); `auto` runs a lone remaining option.
  - `pick from: skill` takes `essence` (that Essence's Skills) and `specializedOnly` (Skills the actor is Specialized
    in - all when none is); `pick from: team` (every Player Character in the world; `notSelf`); `auto` on any pick.
  - `pickGrant` takes `from.fields` (index fields its tags read, e.g. `system.tier`) and `replace` (what this item
    granted before goes - only once a new pick is made).
  - `roll {difDefenseSelf: true}` - with no target, the actor's own Defense.
  - `button {whisper: "owners", usedWhenDone: true}` - only the actor's owners and the GM see the card; the card is
    used up only when its steps finish (a cancelled choice leaves it pressable). A clicker's button acts for the
    token they have selected first, then their character.
- **Triggers:** `sessionStart` (the Story Points app's New Session). `resourceSpent` ignores writes flagged
  `essence20Loss` / `essence20Refund` / `essence20Rest` / `isRest`. Timed items (`worldTime:N`) are swept when game
  time moves on.

## Engine features added 2026-10-06 (round 8, after the local round-7 conversions)

- **Marks per setter:** `mark {perSetter: true}` (and `unmark {perSetter: true}`) - each setter keeps its own mark
  under the key, so two holders working on one creature don't share a count. `marked:<key>` sees any setter's;
  `markedByMe:<key>` and `@target.myMark.<key>` (the count on the mark this actor set) read the actor's own;
  `consumeMark` takes every setter's copy.
- **Formulas:** `@sum.items.<type>.<path>` / `@sum.equipped.<type>.<path>` (a number added up over those items -
  `@sum.equipped.armor.system.totalBonusToughness`); `@count.named.<text>` (items whose name contains the text; `_`
  for a space); `atLeast(count, faces, min)` (roll the dice, count those showing min or more - Fuel Efficient).
- **Durations:** `until: mission` (ends when the mission advances).
- **Tags:** `self:combatant` (in the current combat, started or not); `scene:token:<tags joined by &>` (some other token
  in the viewed scene meets them, asked as the target).
- **Steps:** `pick from: actors` with `actorType` (every world actor of that type - a Zord to mount); `setVar {key,
  value}` (a formula, or text with `{var}`/`{choice}`) - in a Trigger, a changed event value (`@var.spent`) is what the
  next Trigger on the same event sees; `updateActor {ladder: {path: steps}}` moves a Skill die along d20, d2 ... 3d6.
- **Trigger events:** `itemAdded` (another item arrives on the actor - the new item is the roll item, so `item:` tags
  read it); `movedOnTurn` (the actor's token moved on its own turn in a running combat).
- **Fixes:** WeaponTrait rules see the weapon's own id (`item:picked:` works there); a button's `limit` counts only a
  run that finished; the Rest update is flagged so `resourceSpent` skips it; `sessionStart` and the world-time sweep
  run on one GM's client.

## Engine features added 2026-10-06 (round 9, after the local round-8 conversions)

- **Recipients:** `to: picked:<key>` - the actor a pick step stored under that key (`pick from: actors | team | ally |
  enemy | target`).
- **Steps:**
  - `rollVsEach {skill, defense, to?, onHit, onMiss}` - one Skill Test against each recipient's own Defense (`to`
    defaults to `targets`), on one card; `onHit` / `onMiss` steps run once per recipient with it as the target;
    `@var.hits` counts the hits. `skill: "wielded[:<tags>]"` works.
  - `disarm {to?, maxHands?, optional?, required?}` - each recipient drops a held weapon (they pick it back up by
    equipping it); `@var.disarmed`.
  - `takeItem {item}` - `item: choice:<key>` (a `pick from: targetItem`) or an item selector asked of the first target:
    the actor gets a copy, the target loses it.
  - `spendAction {action: free | move | standard}` - a Trigger's own action cost; stops when it can't be paid.
  - `pick from: targetItem` (`itemType`, `equipped`, `filter`) - one of the first target's items, stored as its uuid;
    `pick from: skill` takes `minShift` / `maxShift` (Skills whose die is at least / at most that).
  - `pickGrant {record: true, key, max?}` - keeps the pick on the rule's item (a list: several picks build it up, `max`
    keeps the newest) instead of granting a copy. A Qualification reads it with **`item:pickedSource:<key>`** (the
    item's book source, or the same name for another printing).
  - `heal {temporary: true, tracked: true, untilDamage?}` - temporary Health through the resource slice's ledger
    (raises the bonus and the value; taken back at the scene's end, or by damage with `untilDamage`).
  - `grant {appendTraits: [...]}` - traits the copy gains.
  - `updateActor {ladder, ladderMax?, ladderMin?}` - cap / floor the Skill die.
  - Any step: `quiet: true` - its dice aren't told in chat.
- **Formulas:** `@sum.equippedTrait.<trait>.<type>.<path>` - equipped items of the type that carry the trait.
- **Trigger events:** `removed` (the item's own rules, as it's deleted - an undo); `droppedToZero` (Health or Personal
  Power reached 0 from above by any write; `@var.resource`). afterRoll gets `@var.skill`.

## Engine plug-in points (round 10, 2026-10-06)

Engine pieces can live in their own files instead of growing the core engine. A plug-in file under
`module/rules/ext/` (imported by `ext/index.mjs`, which `essence20.mjs` and `scripts/check-rules.mjs` import) calls:

- `registerStep(name, handler, {errors, branches})`, `registerRecipient(nameOrRegExp, fn(match, ctx, step))`,
  `registerPickSource(name, fn(step, ctx))` - `rules/steps.mjs`. A registered recipient passes the `to:` validator.
- `registerTag(name, fn(rest, ctx), meta)` - `rules/predicate.mjs`. `name` is a new family or a family plus its first
  word (`item:weaponType`). Answering `undefined` hands the tag on to the core reading, so a plug-in never shadows
  a core tag of the same name.
- `registerRef(head, fn(key, scope, parts))` - `rules/formula.mjs`.
- `registerEvent(name)`, `registerRuleType(name, {params, scopes, validate})` - `rules/types.mjs`. The editor's event
  list reads the live list.
- `STEP_FORMS` / `RULE_FORMS` (`rules/editor-spec.mjs`) take editor forms for them.

Plug-in files load under plain Node (heavy helpers imported lazily). Tests that validate pack rules using them load
them with `await import('./ext/index.mjs')` after any `jest.unstable_mockModule` calls.

## Engine features added 2026-10-06 (round 10, group A)

Everything below is registered on import of `module/rules/ext/a.mjs` (loaded first by `module/rules/plugins/index.mjs`).
Strings are under `E20.RulesExtA.*`.

### Linked scopes

- **`registerLinkScope(name, holdersOf)`** (new in `rules/links.mjs`): a plug-in scope. `holdersOf(actor)` names the
  actors whose rules of that scope reach `actor`; `linkedEntries` walks them after the built-in scopes, and a rule with
  `stacks: false` counts once per book item however many holders carry it. The scope is also added to `LINK_SCOPES`
  and (through the new `addLinkedScope` in `rules/index.mjs`) to the index's linked list, so holders are tracked.
- **`scope: megaform`** - on a participant's item: reaches every Megaform the participant is part of (Accurate
  Combiner, Assault Weapon, Roller Drum, Warzord's reminder, Restraining Gear's Megaform half).
- **`scope: ownZord`** - on a character's item: reaches every Zord listed on their sheet (Terrorzord Nature, Megaform
  Expeditor).
- **`scope: zordOwner`** - on a Zord's item: reaches the characters listing that Zord (Power Matrix's refill on rest).
- All three are accepted by every rule type that already takes `vehicle`.
- **The rule holder in roll contexts:** `rollRules` (rules/adapter.mjs) now passes `holder: entry.holder`, so a linked
  RollModifier / DialogSwitch can ask about the actor holding it (`megaform:holderAttack`, `holder:...`).

### Tags

| Tag | True when |
|---|---|
| `megaform:in[:zord\|:combiner]` | this actor is part of a Megaform (a Megazord / a Combiner form) |
| `megaform:is[:zord\|:combiner]` | this actor is a Megaform (of that kind) |
| `megaform:participantAttack` | the Megaform's rolled attack is one of its participants' attacks |
| `megaform:holderAttack` | ...the rule holder's own attack |
| `megaform:generated` | the rolled attack (or its weapon) was generated on the Megaform |
| `self:megaformTrait:<type>` / `target:megaformTrait:<type>` | holds a Megaform Trait of that type (`defender`, `coreBody`...) |
| `item:attachedAttack` | the item is a weapon's own attack |
| `target:combinerForm` | the other party is a Combiner form |
| `vehicle:ownZord` | crewing a Zord that is theirs (listed on the sheet, or linked as its owner) |
| `self:ownedByHolder` | this Zord is the rule holder's own |
| `self:ownsZordOnCanvas` | a Zord on this sheet has a token in the viewed scene |
| `self:advancedRole` | the actor's Role is an Advanced one |
| `self:commanded` / `target:commanded` / `holder:commanded` | Commanded this round (companions.mjs's `petCommand` stamp) |
| `companion:uncommanded[:<type>]` | one of this actor's companions (of that companion type) wasn't Commanded this round |
| `item:heldBy:picked:<key>` | the item / compendium entry asked about is already on the actor a pick stored under `key` |
| `target:userOwns` | this user may act for the other party (GM, or its owner) |
| `self:hasDriver`, `self:drivenByHolder` | the vehicle has a driver / its driver is the rule holder |
| `self:markedByHolder:<key>`, `vehicle:markedByMe:<key>` | carries mark `key` set by the holder / the crewed vehicle carries mark `key` set by me |
| `self:specializedAtLeast:<skill>:<die>` | a Specialization of that Skill at that die or better |
| `movement:<type>` / `movement:has` | in a Movement rule: the type being worked out / it already has speed |
| `form:active` / `form:any` | the rule's item is the active Form / some Form is active |
| `target:notBeyond:<ft>` | the other party is no farther away (off the canvas counts as near enough) |
| `team:holds:<uuid>` | another Player Character holds that compendium item |
| `scene:tokenWithin:<ft>:<tag>&<tag>` | another token within that range meets the tags (asked as the target) |
| `self:clockActive:<flag>` | a Scene Clock window flag is live this scene or mission |

### Recipients, pick sources, refs

- **Recipients:** `megaform` (the Megaforms the actor is in), `participants` (a Megaform's roster), `ownZords`,
  `holder` (the actor holding the rule's item - group D registers the same name with the same meaning), `driver`,
  `drivenVehicle`, `combinerTop` (the first target's active Combiner components with the most Health, ties all count).
- **Pick sources:** `ownedZords` (value: uuid), `crew {filter?}` (a vehicle's seated crew, `filter` tags asked as the
  target), `remaining {options, exclude: [keys]}` (a list less what the item's other picks hold), `noted {list,
  listLegacy?}` (the uuids `noteEntries` kept on the item; labels from the documents).
- **Ref `@sourced.<16-char id>.<path>`** - a number on the actor's copy of that compendium item (0 when none).

### Steps

- `megaformSync` - every Megaform the actor is in mirrors its MegaformMirror items again; `@var.megaforms`,
  `@var.megaformCount`.
- `shiftSize {steps, ladder?: full|class, min?, max?, record?}` - moves each recipient's stored size; `record` keeps
  the size before on the rule's item (once). `restoreSize {record, legacy?}` puts it back and forgets it (skips the
  write when the item is already gone, as in a `removed` Trigger).
- `askChoiceText {key, prompt?}` - a typed text kept as `{choice.<key>}` and `@var.<key>`; empty / cancelled stops the run.
  (Named so because group D's `askText` exists.)
- `spendFrom {to, resource, amount}` - each recipient pays from its own resource; stops (with a chat line) when one
  can't; `@var.paidBy`.
- `formStart` / `formEnd` - activate the rule item's Form / end the active one (items/forms/ranger-form-perks.mjs).
- `rollAs {to, skill, dif, snag?, onSuccess?, onFail?}` - each recipient rolls; its branch runs with it as the target.
- `transformInto {item}` - convert into the Alt Mode the item selector finds (`choice:<key>` after a pick); `@var.mode`.
- `noteEntries {key, count, from: {type}, title?, legacy?}` - choose up to `count` different compendium entries one
  at a time and note them on the rule's item (a uuid list), leaving out what the actor's other copies noted. Stopping
  part way keeps those chosen; stopping at the first keeps the old list and stops the run. Read back with
  `pick {from: noted, list: <key>}`.

### Rule types

- **`Size {steps?, set?, atLeast?, atMost?, ladder?, min?, max?}`** - the actor's derived `system.size`, after the
  hand-written size code: `steps` (each clamped to its own min / max, never back across a limit), then `set`, then
  `atLeast` / `atMost`. `ladder: class` walks small, common, large, huge, gigantic, towering, titanic (an
  extended / long size counts as the class below it).
- **`ArmorAccommodation {level: limited|restricted}`** - putting on armor without that Alteration Accommodation
  upgrade is refused (Restricted also covers Limited).
- **`SizeMatrixCancel`** (on a driver) - an attacker smaller than the vehicle loses the Size Class matrix upshift while
  `when` holds (`defense:` the attacked Defense, `target:` the attacker); a labelled ↓ source on the attack.
- **`MegaformHealth {amount}`** (scope megaform) - the holder's row of the Megaform's Health and the combined Health.
- **`MegaformMirror {items: [item tags]}`** - the participant's matching items are mirrored onto every Megaform it is in
  (kept in step on roster changes and by `megaformSync`).
- **`SummonLimit`** - only one of the holder's Zords per scene (refused in preUpdateActor as zord-summon.mjs summons).
- **`JoinTime {amount, min?}`** (self / ownZord) - the Zord is ready to combine sooner (combiner-timer.mjs).
- **`SummonTime {mode: halve|subtract, amount?, min?}`** - summoner's rules then the Zord's (zord-summon.mjs).
- **`AutoDisembark {who?: driver|pilots}`** - passes the emergency disembark outright (vehicle-defeat.mjs).
- **`KnownOptions {key, count, options, labels?, title?, prompt?, legacy?}`** - the options a helper may offer are only
  those noted, topped up by asking (emotional-mastery.mjs reads `ensureKnownOptions`).
- **`Form {cost?, swaps?: [{replaces, uuids|pick, when?}], grants?, element?}`** - what activating a Form Perk does;
  zord1/forms.mjs reads `ruleFormSpec` / `ruleFormUuids`.

### Events and the Movement stage

- **`beforeRoll`** - fired from the extensions' preRoll (before the dialog) on an actor holding such Triggers; the
  rolled item is the roll item (`item:own`), `roll:dataset:` reads the dataset.
- **`groupTestResult`** - once a Group Test card has every result, on each participant: `@var.success` (1/0),
  `@var.successes`, `@var.participants`.
- **`megaformCombined`** - a Megaform's roster changed (on the client that changed it): `@var.participants`,
  `@var.zords`; participants reach it with `scope: megaform`.
- **Movement `stage: derivedHook`** - applied where a slice calls `applyDerivedHookMovement` among the derived hooks
  (`module/rules/plugins/effects/derived-hook-movement.mjs`, import-free so a slice can load it early; pr2/team.mjs registers it).
  A `ready` hook re-prepares the Player Characters when one holds team-scoped Movement / DerivedStat / Defense rules.

### Helper hooks

- `mechanics/resources/grants.mjs#pickPerkFrom` takes `pack` (only that compendium's Roles / Focuses) - the `pickPerk` step passes it.

Tests: `module/rules/engine10-a.test.js` (32 tests).

## Engine features added 2026-10-06 (round 10, group B)

- **`HitRider` rule type** (`ext/b/hit-rider.mjs`) - what a landed hit does on the check card. Read on each hit of a weapon
  attack that has damage (target-riders.mjs#attackRiders through `registerHitRider`), or with **`on: "cast"`** on each
  successful row with damage of a spell / power cast (`registerPostRoll`). Params:
  - `note: <formula>` - an unscaled "+N damage" note on the hit (like an unscaled dealt DamageModifier, but able to read the
    roll's switches); `negate: true` takes all the hit's damage off.
  - `damageType: <type | {choice.key}>` / `damageTypeFrom: <path on the holder>` - the hit deals that type instead ("Apply as
    X"); `retypeFrom: <type>` only when it deals that type now; `retypeCrit: true` retypes the Critical "double" option too.
  - `option: {damage, damageType, label?, key?, ignoreImmunity?}` - an extra Apply button (a rider option). Formulas read
    `@var.damage` (the hit's damage) and `@var.base` (the rolled attack's own damage value).
  - `siblings: {label?, fallback?}` - every other attack of the rolled weapon as an option (its damage and type; `{effect}` in
    the label is its name); with none, the `fallback` option.
  - `watch: "ally"` - the rule acts on hits by OTHER actors on the holder's side (token disposition, else prototype), the holder
    anywhere in the world (game.actors); one book item counts once however many hold it.
  - `marked: <key>` - the rule acts on hits by whoever carries that mark set by the holder (the "mark carries a rule" shape for
    hits: Softenblows).
  - `when` sees the hit: `item:` (the rolled attack), `weapon:`, `skill:`, `attack:melee`, `roll:switch:<key>`,
    `roll:dataset:<key>`, `item:damageType:<type>` (the attack's own type, else the hit's); `self:` is the one who hit,
    `holder:` the rule's holder, `target:` the one hit. Scope `self` or `host` (an upgrade: only its weapon's attacks).
- **The roll's dataset reaches hit / miss / afterRoll Triggers** - target-riders.mjs#buildRiderContext keeps the dataset's
  plain values (`rider.dataset`) and rules/triggers.mjs passes it on, so `roll:dataset:<key>` works there (Takedown Expert's
  `roll:dataset:isTakedown`). hit / miss Triggers also get **`@var.rolledItem`** (the rolled attack's uuid).
- **`defeated` Triggers get the damage's source as their target** (applyDamage's `source`, the card's speaker) - "the creature
  that Defeated you".
- **`Veto` rule type** (`ext/b/veto.mjs`) - refuses a change to its actor: `on: "create"` / `"equip"` with `items: [item tags]`
  (asked of the new / equipped item), or `on: "update"` with `path`, `change: up | down | any` and `clamp: true` (put the old
  value back and let the rest of the update through; else the whole update is refused). `message` ({name} = the actor) is a
  warning toast. **`marked: <key>`** - the veto lands on whoever carries that mark set by the holder ("while cuffed...", "can't
  regain Health until treated"); it lasts while the mark does and the setter still holds the rule.
- **`ArmorPair` rule type** {items, other} - two sets of armor matching these tags may be worn together without the "two
  armors" warning (other2/gij.mjs asks `ruleAllowsArmorPair`).
- **Defense `mode: "ignoreArmor"`** (outgoing only) with **`armor: "defense" | "worn"`** (`ext/b/armor.mjs`) - the attack
  ignores armor: the attacked Defense's armor value (its Morphed value while Morphed; nothing on an Armor Stripped target), or
  for `worn` Toughness' armor value plus every equipped armor's Toughness bonus. Added beside the other per-attack Defense
  changes (registerDefenseAdjust), the same plain subtraction the hand-written code made.
- **Armor shred** - step **`shredArmor {amount, to, until?}`** leaves a counted `armorShred` mark (default until the scene ends;
  repeated, it adds up); while it lasts the carrier's Toughness loses that much, never more than its armor share (Morphed
  Toughness while Morphed, else Toughness' armor value plus equipped armor) - derived data, noted on the Toughness breakdown.
- **Steps** (`ext/b/steps.mjs`, `ext/b/attack.mjs`):
  - `push {feet, to?, from?}` - the recipients (default the actor) pushed `feet` away from the run's first target (`from: self`:
    away from the actor) - forced-movement.mjs#pushActor; `@var.pushed` counts who moved.
  - `actAs {to, steps}` - run steps as each recipient (their rolls; `to: self` is them). Chat and vars shared.
  - `healAction {amount, to}` - Health restored the way the Heal action restores it (other2/medic.mjs#restoreHealth: the
    healer's I've Got You applies, a Defeated creature gets back up).
  - `actWhileDefeated {}` - the actor may act this turn as though not Defeated (the action economy's stamp, no Story Point).
  - `collect {to, filter?, without: "targets"?, required?}` - the run's targets become the recipients, without touching the
    user's own targets; `without: targets` leaves out who was targeted; `required` stops when none.
  - `rollFormulaVsEach {formula, defense, to?, onHit?, onMiss?}` - a flat-dice roll (any Foundry formula, `2d20kh + 1d8`)
    against each recipient's Defense (a list: the best of them), one roll per recipient; `@var.hits`.
  - `rollFlat {skill, dif, onSuccess?, onFail?}` - a Skill Test against a flat DIF formula (`@target.<path>` reads the run's
    first target) with the user's targets cleared first (react/core.mjs#rollVs); a cancelled roll stops the run.
  - `attack {item, to?, dataset?}` - roll an attack the ordinary way (its dialog, card, damage) at the recipients (default the
    first target), who become the user's targets. `item: "rolled"` is `@var.rolledItem`; else an item selector. `dataset`:
    flags the roll carries (`roll:dataset:<key>` in its own Triggers - a follow-up that mustn't offer itself again).
  - `attackEach {item, filter?, action?, pay?, dataset?, message?}` - one roll of the attack against every creature within its
    range (its Range, else 5 ft per Reach multiplier) meeting `filter` (asked as the target); none - stop with `message`. Then
    `action` (free, move, standard, fullAction, standardAndMove, wholeTurn) is spent and the `pay` steps run, before the roll;
    `@var.attacked`.
- **Recipient `markedByMe:<key>`** - every actor (world, and unlinked tokens on the canvas) carrying that mark set by the run's
  actor (perSetter marks too).
- **Tags:** `self:limitUsed:<key>[:<per>]` (a limit counted under that key - a button's `limit.key` - was used in its window,
  turn by default); `damage:attack` / `damage:melee` (the damage a takesDamage Trigger answers came off an attack - a melee one -
  card the GM applied to this actor, react/core.mjs#lastApplyContext); `self:canSpendStoryPoints` (the Story Point gate).
- **Event `patchedUp`** - a successful Patch Up / Repair test (patch-up.mjs): `@var.amount` (the Health it restores),
  `skill:` the Skill, the patched creature as target.
- **Rule types read by hand-written code** (`ext/b/readers.mjs`): `MissImmunity {}` (a miss against the holder has no effect -
  `when` sees `defense:`; gij3/dice-hooks.mjs#ignoresMissEffects), `SneakAttackImmunity {}` (sneak-attack.mjs),
  `CrashProtection {}` (the vehicle the holder pilots protects its crew while Defeated - gij2/vehicles.mjs),
  `HideBonus {amount}` (a roll declared as the Hide action adds `amount` - other3/hide.mjs).

## Engine features added 2026-10-06 (round 10, group C)

### Marks that carry rules (`ext/c/marks.mjs`)

- **`scope: "marked"` + `mark: "<key>"`** (RollModifier, DialogSwitch, Defense, DamageModifier, Trigger, Reaction,
  ItemModifier, ... - every type that already carries over a link): the rule doesn't act for its holder, it acts for every
  creature carrying the holder's mark `<key>` (any side, any actor type) while the mark lasts. The setter's item is read
  equipped or not (a Cage on the shelf still holds its prisoner). The setter never gets it from its own mark.
- **`scope: "markedTarget"` + `mark`** (RollModifier only): on rolls *against* the marked creature by anyone but the
  creature itself (Laser Designator). `consumeMark: "<key>"` uses the mark up on the roll; `consumeFrom: "roller"` uses
  up the roller's own mark (a `marked` rule).
- **Tags** `target:ruleHolder` (the other party holds this rule's item), `self:allyOfHolder` (same token side as the
  rule's holder, not the holder), `self:marking:<key>` (this actor has set `<key>` on someone), `self:movedSince:<key><op><ft>`
  (feet from where `markHere` stored the token: `self:movedSince:spot>=10`). **Ref** `@marking.<key>` (how many creatures
  carry this actor's mark).
- **Steps** `pickMarked {key, prompt}` (pick one creature carrying your mark; it becomes the step's targets) and
  `markHere {key, until}` (stores the token's position for `movedSince`).
- **DamageModifier `negate: true`** (dealt only): the hit's damage is taken back to 0 (built for Softenblows, now unused).
- **Step `holderRoll {skill, dif, downshift, edgeWhen, onSuccess, onFail}`** (`ext/c/holder.mjs`): in a carried rule, the
  setter rolls (Ignite: the igniter rolls Science against the burning creature's Evasion). `spendActionOf {action, to}`:
  the recipients pay the action (in a combat only).

### Dialog pieces (`ext/c/dialog.mjs`)

- **`DialogSwitch scope: "incoming"`**: shown on the *roller's* dialog when they target a creature holding the rule, once
  per targeted holder, never remembered; `{holder}` in the label is the holder's name, `defaultWhen` works as usual. A
  `key` reaches the holder's own rules as tag `roll:incoming:<key>` (a Defense that only counts while the switch is on).
- **`DialogSelect {options: [{label, upshift, downshift, edge, snag, key, steps}], default}`** (scopes self / incoming): a
  select of alternatives; the chosen option applies. Option labels are localised when they're `E20.` keys.
- **DialogSwitch extras**: `ignoreDownshift: n` (takes back up to n of the roll's downshifts), `specializeWhen: [tags]`
  (the roll counts as Specialized while on), `bonusDie: "d4"` or `{dice: [...], index: formula}` (a bonus pool die).
- **RollModifier extras**: `bonus: n` (a flat, non-shift bonus to the total) and `forget: true` (a switch built from it is
  never remembered).
- **`SkillSubstitution mode: "ask"` + `options` + `prompt`**: before the dialog, the roller picks the rolled Skill or one of
  the options.
- **`BeforeRoll {steps, cancel, message}`** (scopes self / item): steps before the dialog (a cost, a warning), or
  `cancel: true` refuses the roll with the message. Steps **`warn {text, stop}`** and **`clearTargets`**; tag
  **`roll:plainReach`** (a melee attack at the roller's plain size Reach, no Reach multiplier).

### Defenses (`ext/c/defense.mjs`)

- **Defense `mode: "addAfter"`**: a roll-time addition after the best-of / halving is worked out; rules sharing a `stack`
  count once (the biggest). **`mode: "instead"` + `from: [<defense>]`**: use the other Defense's total instead. Both work
  with `outgoing: true` and `limit`, and never touch the sheet.
- **Step `grantNextTurn {free, move, standard, to}`**: extra actions on the recipients' next turn.

### Tags, checks and refs (`ext/c/tags.mjs`, `ext/c/picked.mjs`)

- Checks `check:angrySnag` (the rolled Skill is the stored Angry Skill), `check:contingencyLikely` (the actor's last
  logged action this round was a Contingency, or it's rolling off its turn), `check:survivalSpecialization` (a Survival
  Specialization's keywords match the scene's terrain / environment; null when there's neither).
- Tags `roll:save`, `roll:poisonSave`, `skill:of:<essence>`, `roll:anyTarget:<tags joined by &>`,
  `target:creature:<word|word>`, `target:tagStarts:<prefix>`, `target:threatVsLevel:<op><n>` (Threat Level minus this
  actor's level), `item:weaponType:<type>` / `item:weaponType:flagOf:<_id>` (the type stored on the owned item with that
  source id), `rule:pickedItem:<key>:<tags>`.
- Refs `@rolled.<path>` (the rolled item), `@other.<path>` (the item an ItemModifier is changing, per item),
  `@reach.size | melee | attack | <size>`, `@altMode.<path>` (the current Alt Mode item, 0 when not transformed),
  `@owned.<_id>` (1 when an item with that source id is owned), `@availDif.<key>` (Requisition DIF of the picked item).

### Equipment, actions, steps, events

- **`ItemLadder {items, path, by, from, floor}`** (`ext/c/equipment.mjs`): moves an item value along the weapon
  requirement ladder (none, d2 ... 3d6), with a floor.
- **`BrawnRequirement {amount, ignore, carrying, stack}`** (`ext/c/brawn.mjs`): Brawn offset for equipment requirements
  (and for carrying when `carrying: true`); `ignore` beats every amount.
- **`ActionSkills {action: "heal", skills, limit}`** (`ext/c/actions.mjs`): more Skills for the heal action while `when`
  holds and the limit lasts.
- **RollModifier `immune: ["lendAssistance"]`** (`ext/c/assist.mjs`): banked Lend Assistance is set aside for the roll and
  put back after.
- **Steps `blindRoll {formula, flavor, rows: [{min, text}]}`** (a GM-only roll with the band its total reaches; `@rolled`
  afterwards) and **`endExpiring {offer, to}`** (`ext/c/steps.mjs`: ends whatever runs out at the end of this turn, or
  offers it on a chat button).
- **Event `enemyEnteredReach`** (`ext/c/reach.mjs`): fires for a holder when an enemy's move ends inside its melee Reach.
  Tag **`target:inRange:<attack|melee>`**.

## Engine features added 2026-10-06 (round 10, group D)

- **CardOffer rules** (rules/plugins/cards/card-offer.mjs) - a button on posted roll cards, offered by an item to its holder or to
  others: `{type: CardOffer, label, whose: self | party | side | any, pressedBy: roller | holderOwner | gm, when?,
  pool?: {mark: key}, limit?, counter?: {per}, cost?: {resource, amount}, reroll?: {target: d20 | allDice | anyDie (the presser picks one die, before anything is paid) | formula,
  keep: new | choose}, addDie?: {faces}, steps?}`.
  - `whose`: the holder's own cards; `party` - the holder's and the primary Party roster's; `side` - another actor of
    the holder's kind (player-like or not); `any`.
  - `pressedBy`: `roller` (the GM, the roller's owners, the card's author), `holderOwner` (the holder's owners and the GM),
    `gm`.
  - `when` sees `self:` = the holder, `target:` = the roller and the **`card:` tags**: `card:failed`, `card:fumble`,
    `card:d20:<n>` (the d20 shows n), `card:hasD20`, `card:checks` (compared with a DIF / Defense), `card:skill`,
    `card:rerolled` (it is itself a reroll), `card:marked:<key>` (a `markCard` step set it), `card:holderPresent` (the
    holder has a token on the viewed scene, or the scene has none), `card:involves:<path>` (the creature whose uuid the
    holder keeps at that path is a row's target, or on the canvas).
  - `pool: {mark}` - each press takes one from the holder's mark count (offered while some is left; label `{count}`).
    `limit` counts presses; `counter: {per}` only counts them (`@var.used` in the cost formula - a rising cost).
  - `cost` is paid by the holder; `{gmStoryPoints: true}` spends the GM's pool; Role Points honour
    `useUnlimitedResource`. Labels fill `{count}`, `{cost}`, `{die}`, `{holder}`.
  - `reroll`: `d20` / `allDice` post a fresh check card (mechanics/rolls/reroll.mjs, marked as a reroll); `formula` rolls the
    whole formula again (`keep: choose` lists both totals against every DIF for the player to choose). `addDie {faces}`
    rolls 1d<faces> onto the card's total and rescored rows, with damage buttons for targets now hit (or hit harder).
  - `steps` run after, as the holder, the roller as target, `@var.used`, `@var.total`. Card-only step
    **`markCard {key}`** marks the card (`card:marked:<key>`).
  - **Trigger event `rerolled`** - a Story Point reroll card this user posted (chat.mjs rerollMessage): `@var.source`
    (storyPoint...), `@var.total`, `@var.failed` (1 when the new total reaches none of the original DIFs), the original
    card's Skill as `skill:`.
- **Personal Story Points** (rules/plugins/resources/personal-story-points.mjs) - the Ruthless Point ledger is engine data now
  (`flags.essence20.personalPoints`; mechanics/resources/story-points.mjs spends them first). Step **`givePersonalPoints {to, count,
  shared?, max?, ownTurn?}`** (shared: one point every recipient shares; max: the first N recipients). Trigger events
  **`personalPointUnspent`** (an actor ended its turn holding points - fired on every actor listening, that actor as
  target, before they tick down) and **`storyPointNarrative`** (the tracker's narrative spend, `@var.kind`). Tag
  **`target:sameType`**.
- **SpellCost rules** (rules/plugins/resources/spell-cost.mjs) - `{type: SpellCost, label, op: set | add | multiply | spend, value?,
  spend?: {resource, max?}, note?, quiet?, steps?, when?}`: every SpellCost rule of the caster whose `when` holds
  (`item:` = the spell; `item:own` for a spell's own option) is a row in ONE dialog before the cast; ticked rows apply set,
  then add, then multiply, then spend (a number box, paid, taken off the Cost, never below 0), post their `note` and
  run their `steps`. Cancelling cancels the cast. Step **`recastFree {item}`** casts a spell again at no cost (dataset
  `freeCast`). afterRoll Triggers get **`@var.itemUuid`** (the rolled item).
- **Initiative** (rules/plugins/rolls/initiative.mjs) - rule type **`InitiativeReroll {atMost}`** (the Initiative formula rerolls
  Skill dice showing atMost or less, once); Trigger event **`initiativeRolling`** (from the roll itself, before the
  formula - dice.mjs INITIATIVE_EXTENSIONS); steps **`rollInitiative {to}`**, **`swapInitiative {requireLower?}`** (with
  the first target), **`distribute {to, total, prompt?, steps}`** (share up to `total` points among the recipients - each
  one's steps run with it as target and its share as `@var.share`); ref **`@initiative`** (`.target`, `.recipient`);
  tags **`self:initiative`** / **`target:initiative`** (rolled in the running combat); recipients **`protectedTarget`**
  and **`markers:<key>`** (actors who set that per-setter mark on this actor). `ruleConditionImmune` now passes
  `holder` (aura ConditionImmunity with `holder:protects`).
- **Contested rolls and item states** (rules/plugins/rolls/contest.mjs, items.mjs) - step **`contest {skill | skills, edge?,
  plain?, against: {skill | skills}, to?, onWin?, onLose?}`** (the actor's Skill against the recipient's own roll, a tie to
  the resisting side; `plain`: both roll their best listed Skill die as 1d20 + the die; when this user can't roll for the
  other side, its owner rolls from a card - `contestAnswer`). Steps **`markItem {item, key, effects: {blockRolls?,
  noArmorDefense?}, to?}`** / **`unmarkItem`** (a marked item can't be rolled, its attacks neither; marked armor adds no
  Toughness or Evasion), tag **`item:marked:<key>`**, recipient **`operator`** (a vehicle's / Zord's driver, else the
  target), step **`rollPlain {skill, to, var}`**, step **`spendActionFor {action, to}`**, ref
  **`@availabilityDif.<choiceKey>`**, tag **`target:withinOrUnknown:<ft>`**.
- **Canvas points, zones, delayed cards, blasts** (rules/plugins/combat/canvas-points.mjs, blast.mjs) - step **`pickPoint {prompt?,
  at?: targetOrSelf | actorOrKept, actor?}`** (`@var.pointX/pointY`, `{var.pointScene}`); recipient **`around:<ft>`**;
  step **`placeZone {key, label?, half?, until?, modifier: {when, upshift?, downshift?, edge?, snag?}}`** (anyone rolling
  from inside a live zone gets its modifier as a roll source); step **`scheduleCard {turnEnds? | rounds?, steps}`**
  (later in a combat - after this actor's turn ends N times, or when a round comes; now out of combat); steps **`rig`**
  / **`requireRig`** / **`endRig`** (a live rig two cards share); **`blast {radius, skill, defense, damage,
  damageType, title}`** (a Skill Test against everyone around the point, Apply Damage buttons x Degrees of Success;
  `defense: ask` or a number 1-4); **`explosion {radius, formula, saveSkills, saveDif, damageType, title}`** (damage
  rolled once, a plain save each for half); **`damageCard {actor, amount, damageType, title}`**; **`explodeVehicle
  {actor}`**.
- **Banks and team grants** (rules/plugins/rolls/bonus-dice-bank.mjs, resources/temp-resource-step.mjs, tags/team-combatants.mjs and the
  other group D step / tag files rules/plugins/index.mjs lists in their place; alteration.mjs) - step **`bankDie {die, appliesWhen}`** (a bonus die
  for the next matching roll, moved into the More Heads slot before the dialog and back if another roll comes first; tag
  **`rule:bankedDie`**); step **`tempResource {kind: health | energon, amount, to, untilDamage?}`** (tracked temporary
  Health / Energon - amount worked out per recipient); recipient / ref **`teamCombatants`** (teammates in the running
  combat); tag **`combat:roundIs:<n>`**; steps **`checkAllies {within, prompt}`** (tick allies in range - they become the
  targets) and **`lendAssistEdge {to, against, actionEach?}`** (Lend Assistance's Edge banked against a creature);
  step **`claimCard`** (a button's presser answers that card once - buttons.mjs hands the card to the steps); step
  **`askText {var, prompt, firstWord?}`**; step **`queueTurnStart {to, spendAction?, whisper?}`** (at each recipient's next
  turn start: spend that action, whisper its owners); steps **`spendActions {action, count}`**, **`spendFor {resource:
  {path}, amount, to}`**, **`captureRoll {var}`** / **`retryRoll {var, downEach}`** (retry the last Skill Test with a
  cumulative ↓), **`countTargets`**, **`countRecipients`**, **`targetRecipients`**, **`targetSelf`**, **`clearMarks`**,
  **`rememberTarget`**; tags **`target:uuid:<uuid>`**, **`allOf:<tag>&<tag>`**, **`attackHands:<n>`**; ref
  **`@targetKeyed.<path>`**; pick source **`sideActors`**; recipient **`driverOrSelf`**; rule types **`HardpointUse
  {items, slots}`** and **`StanceSwitch {stance: allOutAttack | evasiveFighting, max}`** (a number box in the dialog -
  that many ↓, the rider stance, All Out Attack's extra damage); steps **`pickAlteration {var, from: own | compendium,
  tier?, keep?}`** and **`lendAlteration {from, to, part, expire: lenderTurn | theirNextTurnEnd | scene | minute}`** over
  the other1 slice's Alteration lending ledger. The `bank` step fills `{var.x}` in `appliesWhen`; the `roll` step keeps
  `@var.rollTotal`.

## Engine features added 2026-10-06 (round 10, group E)

- **Steps** (rules/plugins/picks/pick-and-loop-steps.mjs):
  - `pickEntry {from: {type, availabilities?, tags?, fields?} | children: {of: <var>, type}, var?, title?, prompt?, auto?, record?,
    key?, max?, until?, legacy?}` - choose a compendium entry WITHOUT granting it. The run keeps `@var.<var>` (default `picked`, its
    uuid) and `<var>Name`, `<var>Availability`, `<var>Dif` (its Availability DIF, CONFIG.E20.availabilityDifficulties),
    `<var>DifHarder` (one step harder - Scavenger), `<var>Skill` (the Requisition Skill of a weapon / armor) and `<var>Traits`
    (comma-joined). `from.tags` see the run's vars (`var:includes:<var>Traits:martialArts` - one pick narrowing the next).
    `children` offers the entries a picked entry carries (an Origin's Alt Modes; `auto` takes a lone one). `record: true` also keeps
    it on the rule's item like pickGrant's record (`item:pickedSource:<key>`), with `until`. A cancelled pick stops the run. Grant it
    later with `grant {uuid: "{var.picked}"}` (twice in `onCrit` for "an extra copy on a Critical Success"), roll against it with
    `roll {dif: "@var.pickedDif"}` / `roll {skill: "{var.pickedSkill}"}`.
  - `pickActorItem {actor: picked:<key> | target | self, itemType?, vehicles?, key, record: true, max?, until?, legacy?}` - one of
    another actor's items (or, `vehicles`, a vehicle / Zord they crew), recorded on the rule's item as {kind, uuid (its book source),
    name, ally, until}. Read by `item:recorded:<key>` / `self:crewsRecorded:<key>` (Training Evolution).
  - `pickMany {key, from, count (formula), ...that source's options}` - up to `count` of anything a `pick` offers (a checkbox
    list), kept as a list. None is a valid answer; closing stops the run.
  - `repeat {steps, max?, var?}` - run the steps until one stops (a cancelled pick); `@var.repeats` counts finished rounds.
  - `forEach {to, steps}` - the steps once per recipient, it as the target; one recipient's stop doesn't stop the rest (a `choose`
    asked per member - Camper).
  - `focus {to}` - the recipients become the run's targets (no change to the user's targeting); stops when there are none.
  - `setEffects {effects: [{name?, changeKey?, on: tags | true | false}]}` - switch the rule item's own Active Effects; each
    effect takes the first entry it matches (name contains / first change key contains / an entry with neither = any).
  - `unbank` - take back what this rule's item banked on the recipients.
  - `appendToName {text}` - rename the rule's own item "<name> (<text>)" (text may be an i18n key).
  - `recordScene {path}` - write {sceneId, terrain} of the actor's scene at a `flags.` path on the actor (stops with no scene).
  - `grantTopRolePerks {notRole?, notRoleName?, excludeName?}` - the actor's Role's highest-level Role Perks, not already owned.
  - `fitUpgrade {uuid, onto: choice:<key>, flags?}` - a compendium upgrade attached to an owned item a pick stored, the way
    dropping it on the item does (no grantedBy - it stays when the rule's item goes).
  - `giveCopy {uuid, to?, flags?}` - a compendium item (no attachments) copied onto each recipient through the GM relay.
- **Recipients:** `allParties` (the actor and everyone on any Party roster with it), `targetOrCombatant` (the first target, else
  whoever's turn it is).
- **Pick sources:** `skills` {essence?, minShift?, maxShift?, exclude?, also? (count whatever their Essence), sameEssenceAs: <key>,
  differentEssenceFrom: <key>, notChoice: <key>, partner: {same spec; sameEssence: true = the candidate's Essence}} - "has a
  partner" filtering; `defense` {exclude?, notChoices: [keys]}; `partyMates` {orTargets?}; `ownedItems` {itemType, prefer: [item
  tags]} (the preferred ones when any, else all).
- **Tags:** `self:inTeamOf:holder[:others]` (on the holder's team - the primary Party roster, else every player-owned PC; for a
  clicker's button run, self is the presser) and `self:hasTeammates`; `item:recorded:<key>` / `self:crewsRecorded:<key>` (a
  recorded pick that hasn't run out; an old `{mission}` stamp counts only in its mission); `var:includes:<key>:<text>`;
  `self:` / `target:healthDamaged`, `self:` / `target:essenceDamaged`; `target:ownTurn`; `roll:damaging` (the hit / targeted row
  came with damage); `self:` / `holder:onRecordedScene:<path>`; `self:itemEffect:<uuid>:<change key>` (that book item's copy has an
  enabled effect changing the key).
- **Formula ref** `@alliesWearing.<compendium id>.<ft>` - allies within range (the system's ally count) wearing that upgrade.
- **Rule types** read by the hand-written registries (rules/plugins/combat/hazard-terrain-targets.mjs, joined at `setup`;
  KitPrerequisite is rules/plugins/resources/kit-prerequisite.mjs):
  - `HazardProtection {categories?, environments?}` - environment-hazards.mjs ENVIRONMENT_PROTECTORS; `{choice.x}` in
    environments reads a pick (an unmade pick covers nothing); labelled with the item's name.
  - `RoughTerrainImposer {}` - rough-terrain.mjs ROUGH_TERRAIN_IMPOSERS; `when` is asked with self = the holder and target = the
    creature moving (`target:marked:misguided`, `target:ownTurn`).
  - `MultipleTargets {}` (scopes self, driven) - multiple-targets.mjs MULTIPLE_TARGETS_GRANTS; `when` sees the attack (`attack:ram`).
  - `KitPrerequisite {mode: lower | waive, tiers?, skipEssenceKits?}` - the essence20.kitPrerequisite hook (one Rank lower, never
    past d2 / no prerequisite).
- **Scope** `alliesAnywhere` (RollModifier) - every other actor on the holder's side, anywhere (token dispositions, else PC or
  not - react/core.mjs#areAllies).
- **Trigger event** `equipmentBroke` - a weapon / armor / shield flagged broken, or a vehicle / Zord / Megaform brought to 0
  Health, fired for every world actor that has such a Trigger (on the client that made the change).
- **Stages:** DerivedStat `stage: "early"` (before the poison training is worked out - documents/actor.mjs); Movement
  `stage: "derived"` (inside the extensions' derived pass, before `afterDerived`). Actors holding a Movement rule that reads the
  combat (`combat:`, `actionUsed`, `ownTurn`) are re-prepared on combat / combatant updates.
- **Legacy marks:** a `mark` step with `perSetter` may carry `legacy: "flags.essence20.<old list>"` (+ `legacyScene: true`); once, at
  start-up on the active GM, the creatures in that old holder-side list (or map) get the holder's mark (never over one there).
- **Engine edits:** a `roll` step's `skill` fills `{var.x}`; `updateActor` ladder paths fill `{choice.x}` (no pick, no change);
  `pickGrant {appendTraits}`; a `choose` prompt fills `{target}`, `{name}`, `{choice.x}`, `{var.x}`; the linking pass moves the
  `legacy` of any `record: true` step; SurpriseExemption rules see `holder:` tags; Trigger `when` lists see the roll's rows
  (`roll:damaging`).

## Engine features added 2026-10-06 (round 11, group F)

Everything below is registered on import of `module/rules/ext/f.mjs` (loaded by `module/rules/plugins/index.mjs` after e).
Strings are under `E20.RulesExtF.*`.

### Window counters shared by flag name (`ext/f/window.mjs`)

A rule `limit` keeps its own record (`ruleUses.<key>`); these name a Scene Clock flag outright - the `{epoch, window,
count}` records `mechanics/resources/scene-clock.mjs#markUsed` writes - so a count hand-written code (or another item) already keeps
carries on unchanged.

- **Tags** `self:windowUsed:<flag>:<window>[:<n>]`, `target:windowUsed:...`, `holder:windowUsed:...` - the actor's count
  under `flags.essence20.<flag>` in the current `scene` / `encounter` / `mission` is at least n (default 1). No other
  party: false.
- **Step `markWindow {flag, window, to?, clear?}`** - one more use on each recipient (a new window starts at 1);
  `clear: true` forgets the record.

### Events heard anywhere in the world (`ext/f/watch.mjs`)

A Trigger's `watch` reaches tokens in the viewed scene; these reach every world actor holding a Trigger for the event, and
the actor it happened to (token actor or not). Steps act as the holder; `target` is the actor it happened to
(`target:self` - the holder itself).

- **`rollSeen`** - a check was rolled (any actor, the extensions' postRoll on the roller's client): `@var.crit`,
  `@var.fumble` (1 / 0), `@var.failed` (it had rows and all failed), `@var.upshifted` (the dialog closed with a net ↑1+,
  rule switches included), `@var.assisted` (a Lend Assistance Edge / ↑ was waiting for the roll), `@var.total`. The two
  dialog facts are noted by an applyDialog hook and used up by the roll.
- **`conditionSeen`** - an Active Effect with status ids landed on an actor (this user's change): `@var.statuses`
  (comma-joined - `var:includes:statuses:<id>`), `@var.condition` (1 when one is a listed Condition).
- **`rollMessage`** - this user posted a chat message whose first roll has a d20: on the speaker's world actor only,
  `@var.total`.
- **Tags** `target:sideAlly` / `target:sideEnemy` - same / opposite non-neutral side by disposition (the active token's,
  else the prototype token's), never itself; works off the canvas. `self:emotion[:<option>]` - that Emotional Mastery
  option is active for the actor (its own, or one Team Spirit lent while the lender still has it; bare: any).
- **Pick source** `activeEmotions` - the actor's active options, labelled `E20.EmotionalMastery<Option>`.

### Hit multipliers and the finishing-move pieces (`ext/f/finisher.mjs`)

- **`HitMultiplier {multiply, damageType?, choiceFrom?}`** (scopes `self`, `megaform`) - a landed weapon hit deals
  `multiply` times its damage (a note "+N (label)", N = damage × (multiply - 1)) and, with `damageType` (a type or
  `{choice.<key>}`), that type instead. `choiceFrom: <16-char id>` - a `{choice.*}` the rule's item hasn't made is read
  from its holder's copy of that book item. `when` sees the hit like a HitRider (`roll:switch:<key>`, `item:`,
  `attack:melee`, `target:`; self = the one who hit, holder = the rule's holder). One book item counts once per hit.
  Registered with `registerHitRider(fn, {before: ruleDamageDealt})`: after the slices' own riders, ahead of the rules'
  flat bonuses (so a +1 DamageModifier isn't multiplied - where the hand-written finisher sat).
- **Tags** `item:styleChoice:<key>[:<id>]` - the rolled attack's style (melee, anything else counts as ranged) is the
  one picked under `<key>` on the rule's item, else on its holder's copy of book item `<id>`; no pick - any.
  `target:resistsChoice:<key>[:<id>]` - the other party has Resistance to the type picked (same lookup), else to the
  rolled attack's own type; no other party - false.
- **Step `rollEach {to, skills, dif, prompt?, onAllSucceeded?, onAnyFailed?}`** - each recipient picks one of the Skills
  (a cancelled pick fails) and rolls it against the DIF (grants.mjs#rollTest); then one branch. `@var.failures`,
  `{var.failedNames}`. `prompt` may be an `E20.` key (formatted with `{name}`, the roller).
- **Recipient `participantPilots`** - the first target's (a Megaform's) Zord participants: each one's driver, else the
  Zord.

### Standing Skill dice (`ext/f/skill-die.mjs`)

- **`SkillDie {skill, edge?, bestOf?: "participants"}`** (scopes `self`, `megaform`) - derived data among the extensions'
  derived hooks: `edge` sets the Skill's own standing Edge (`system.skills.<skill>.edge`, not an untickable roll source);
  `bestOf: participants` (scope megaform) raises the Megaform's Skill die to the best its Zord participants have in their
  own such Skill. `skill: "initiative"` = the Skill the actor rolls Initiative with (`system.initiative.skill`).

### Reaction answerers found by lookup (`rules/reactions.mjs`, `ext/f/reactors.mjs`)

- **`registerReactorLookup(who, find)`** (rules/reactions.mjs) - a `who` whose answerers aren't canvas tokens holding the
  rule. `find(info, row)` (row null for a card-wide rule) returns `[{actor, item, rule, index, holder?}]`; those offers go
  through the same outcome / margin / `when` / limit / cost checks (no side check), `holder:` tags read the holder, and
  canvas actors' own rules with that `who` are skipped. The name joins `REACTION_WHO`.
- **`who: "megaformPilot"`** - on a Megaform participant's item: when the row's target is a Megaform it is part of, the
  Player Characters listing that participant on their sheet answer (one button each). A Megaform Trait with no rules of
  its own (homebrew) answers with the book Trait of the same `system.type` (`TRAIT_TWINS`: defender). The plug-in loads
  rules/reactions.mjs lazily (`lookupReady`), so tests that mock the react slice's core still load ext/index.

### Helper hooks

- `mechanics/item-hooks.mjs#registerHitRider(fn, {before})` - insert ahead of an already-registered rider.

Tests: `module/rules/engine11-f.test.js` (18 tests).

## Engine features added 2026-10-06 (round 11, group G)

- **DialogSelect extras** (`ext/g/select.mjs`, params in `ext/g/select-rule.mjs`; group C's `ext/c/dialog.mjs` asks them):
  - `options[i].when: [tags]` - the option is offered only while the tags hold (asked as the select itself is: `self:` the
    roller, `holder:`, `item:` the rolled item, `target:`).
  - `options[i].pay: [steps]` - run as the holder when the option is chosen, before it applies; a stopped run (an action
    that can't be spent) means the option doesn't apply at all.
  - `optionsFrom: {picked, legacy?, copies?, labels?: "damageType", label?, key?, pay?, steps?}` - one more option per value
    a pick stored on the rule's item under `picked` (a list - `pickEach` / `pickMany` - or one value); `legacy` - where an
    older version kept it; `copies: true` - the values the actor's other copies of the same book item hold too; `labels:
    damageType` labels them from CONFIG.E20.damageTypes; `label` / `key` fill `{value}` and `{label}` (`key: "ammo:{value}"`).
    With optionsFrom, one authored option (the default, "keep it as it is") is enough.
  - A select left with fewer than two options isn't shown. Values are stable: an authored option is its index, a generated
    one `v:<value>`.
- **HitRider `option.damageType: "{switch.<prefix>}"`** - the rest of the first ticked switch key `<prefix>:<value>` (a
  generated DialogSelect option's key); none ticked - no option.
- **Step `pickEach {key, count, from, only?, excludeCopies?, prompt?, legacy?}`** (`ext/g/picks.mjs`) - choose `count`
  different values one at a time (a select each time; `prompt` fills `{n}` and may be an E20. key), kept as a list on the
  rule's item. Each pick leaves out the earlier ones; `excludeCopies` also leaves out what the actor's other copies of the
  same book item hold under the key; `only` narrows the source. Running out ends early and keeps what was chosen; a
  cancelled pick stops the run and keeps nothing. `@var.picked` (the list), `@var.pickedLabels` (", "-joined). Give it
  `record: true` with `legacy` so the start-up linking pass moves an old pick.
- **Tag `rule:firstCopy`** - the rule's item is the first copy of its book item on the actor (a rule read once per actor
  when the copies' picks differ, so collectRules keeps both).
- **The Hidden state** (`ext/g/hidden.mjs`) - `flags.essence20.o3Hidden {epoch, at}`, live for the scene it was set in
  (the generic Hide action in other3/hide.mjs sets it). Tags **`self:hidden`** / **`target:hidden`**; step **`hide {to?,
  value?}`** (`value: false` ends it); event **`brokeHiding`** - the actor attacked while Hidden (hide.mjs ends Hidden first,
  then fires it): the attack's targets (once each) are the Trigger's targets, `@var.targets` how many.
- **Cards other items add buttons to** (`ext/g/cards.mjs`):
  - Step **`postCard {key, text?}`** - a chat card for the actor with `text` (`{name}`, `{target}`, `{var.x}`; an E20. key is
    localised) and a button for each `CardButtons` rule the actor holds for that `key` whose `when` holds.
  - Rule **`CardButtons {card, label, steps, each?: "target", who?}`** - the buttons an item adds to cards posted under
    `card`: one, or (`each: target`) one per target of the card, that target its own (`{target}` in the label). Pressed,
    the steps run as the card's actor with the button's targets; `who` as the `button` step's (owner by default); a button
    can be pressed again and again.
  - Step **`buttonCount {key, add?, max?, check?, message?}`** - in a button's steps (these cards', or a `button` step's): a
    counter kept on the pressed button (each button its own), read as `@var.<key>` after it. `check: true` only checks; at
    `max` or more it stops with `message` (an E20. key is localised) as a warning. Otherwise it adds `add` (default 1).
- **Step `rollVsAll {skill, defense, to?, onSuccess?, onFail?, cancelFails?}`** (`ext/g/rolls.mjs`) - ONE ordinary Skill
  Test (the Skill's own shifts / Specialization, no DIF), its total compared with each recipient's (default: the targets)
  Defense - a list: the best of them. A success only when it meets every one; the branch runs with the recipients as
  targets. `@var.rollTotal`, `@var.beaten`. No recipients - a chat line, stop; a cancelled roll stops (`cancelFails`: the
  onFail branch).
- **Rule `OnlyBest {defense, items, path?, key?}`** (`ext/g/best.mjs`) - of the actor's items matching `items` (item tags),
  only the biggest bonus (the number at `path`, default `system.armorBonus.value`) counts toward that Defense: a derived
  pass takes every other one off the total, noted "- N (label)". `when` sees the actor. Rules sharing a `key` apply once per
  actor, so each of a family of items can carry the same rule.

## Engine features added 2026-10-06 (round 12, group H)

Everything below is registered on import of `module/rules/ext/h.mjs` (loaded by `module/rules/plugins/index.mjs` after g).
Strings are under `E20.RulesExtH.*`.

### Copies and formula comparisons (`ext/h/copies.mjs`)

- **Tags** `rule:copy:data:<path>[<op><value>]` - some copy of the rule's item on the actor (matched by book source, itself
  included) has that data ("any of my Hybridizations is Hold That Shape"); `rule:otherCopy:data:...` - another copy, not
  itself ("an earlier pick locks the direction"). The data test reads like the core `data:` tags (`=`, `!=`, `>=`, `<=`, `>`,
  `<`, or bare = set). No rule item - false.
- **Tag** `calc:<formula><op><number>` - a formula (any rule formula: `@level`, `@actor.<path>`, refs, min / max...) compared
  with a number, asked with self = the actor and item = the rule's item (`calc:@level - @actor.flags.essence20.used > 0`).
- **Refs** `@copiesWith.<path>.<value>` - how many copies of the rule's item (itself included) hold `<value>` at `<path>`
  (`@copiesWith.flags.essence20.zord2Hybrid.extraShift`); `@most.items.<type>.<path>` - the biggest number at `<path>` on the
  actor's items of that type (0 when none - "the best Alt Mode Movement").

### Active Effects and kept values (`ext/h/effects.mjs`)

- **Step `addEffect {changes: [{key, value, mode?}], name?, img?, on?: item | actor, to?, flags?}`** - an Active Effect with
  those changes, on the rule's own item (`on: item`, the default - it transfers to the actor and goes with the item) or on each
  recipient (`on: actor`). `value` is a formula stored as its number (`0 - @var.penalty`); `mode` defaults to 2 (add). A key
  holding `{movement}` is repeated for every Movement type the actor has a base speed in; keys and the name fill
  `{choice.x}` / `{var.x}`, and the name may be an `E20.` key. `flags` go under `flags.essence20` on the effect.
- **Step `removeEffects {flag, to?}`** - the recipients' Active Effects carrying `flags.essence20.<flag>` are deleted (an
  older version's effects too, when they carry the same flag).
- **Step `keepValue {path, at}`** - the actor's value at `path` (`{choice.x}`, `{var.x}`, `{item.<path>}` filled) copied onto
  the rule's item at `at` (a `flags.` path) - the Skill die before a step moves it. A path left with a hole (no pick) stops.
- **Step `restoreValue {path, from}`** - the value the rule's item keeps at `from` written back to the actor's `path` (same
  filling); skipped when the item keeps none or the actor has nothing at the path's parent. Works in a `removed` Trigger.

### Rule types read by hand-written hooks, and an event (`ext/h/drawback.mjs`, `ext/h/types.mjs`)

- **`IgnoreDrawback {drawbacks: [limitedArticulation]}`** - while `when` holds the holder ignores those drawbacks:
  `limitedArticulation` - its Alt Mode's Limited Articulation no longer refuses those Skill Tests (dice.mjs asks
  `ruleIgnoresDrawback`; the file is import-light, dice.mjs loads it directly).
- **`InitiativeEdge {}`** - Edge on an Initiative roll, after the dialog (dice.mjs `INITIATIVE_EXTENSIONS`). Scope `self`: the
  holder's own; scope `sceneAllies`: every OTHER actor on the holder's side (same disposition - the active token's, else the
  prototype's) while the holder has a token on the viewed scene. `when` sees self = the roller, holder = the rule's holder.
  Read only at roll time - never in derived data (other tokens' actors aren't touched while one prepares).
- **`GrantDouble {grants: [upshift | actions], prompt?, damage?: {amount, type}}`** - when the holder grants another actor
  upshifts on a banked bonus (`mechanics/characters/perks.mjs#bankPendingBonus`) or extra actions this turn
  (`mechanics/actions/action-economy.mjs#grantActionsThisTurn`), the holder is asked (a confirm titled with the item's name; `prompt`, an
  `E20.` key or text, fills `{granter}`, `{ally}`, `{what}`); yes doubles the grant and deals `damage` to the one receiving it.
  `when`: self = the granter, target = the ally. Never for a grant to oneself. `perks.mjs#offerGrantDouble` is the hook.
- **`DamageReduction {amount, damageTypes?, limit?, message?}`** - damage about to land on the holder (an extensions damage
  modifier) of one of those types is lowered by `amount` (a formula - `1d2` rolls), never below 0; `limit` {per: turn | round
  | scene | encounter | mission} counts uses (a round / turn limit never runs out outside a combat, as the combat-stamped
  helpers read it); `message` (an `E20.` key or text with `{name}`, `{n}`) is posted. `when` sees the holder.
- **Trigger event `massShiftUsed`** - the Mass Shift Role Perk was used (`items/forms/mass-shift.mjs#activateMassShift`, right after
  it marks its scene use).

Tests: `module/rules/engine12-h.test.js` (13 tests).

## Engine features added 2026-10-06 (round 12, group I)

Everything below is registered on import of `module/rules/ext/i.mjs` (loaded last by `module/rules/plugins/index.mjs`). No new
strings (`E20.RulesExtI` is empty).

- **Refs** (`ext/i/values.mjs`): `@rolePoints` - what the actor's base Role Points item holds (Mystical Points, Cheer...);
  `@rolePoints.<name>` the Role Points item of that name (`_` for a space); 0 with none. `@flagList.<flag>` - how many
  entries the list at `flags.essence20.<flag>` on the actor holds; `@flagList.<flag>.<value>` - how many equal that value.
- **Step `flagList {flag, add? | clear?, to?}`** - append a text (`{choice.x}` / `{var.x}` filled) to that actor flag list on
  each recipient, or empty it (no write when it's already empty). For state an older version of an item kept in a flag
  list, so old characters carry on (Essential Research's `essentialResearch`).
- **Pick source `config {path}`** - the entries of `CONFIG.E20.<path>` (`weaponTypes`, `damageTypes`...), labelled by their
  localised names.
- **Tag `holder:asOther:<self tag>`** - a `self:` tag asked of the rule's holder, with the actor the rule reached (the one
  rolling) as the other party: `holder:asOther:sizeDiff>=0` - the holder is no smaller than them.
- **DialogSwitch `scope: "alliesAnywhere"`** (`ext/i/scopes.mjs`) - group E's scope (every other actor on the holder's side,
  anywhere: token dispositions, else Player Character or not) on dialog switches too: the switch is offered on those
  allies' rolls. **`{holder}`** in a switch label is the holder's name (rules/adapter.mjs#ruleDialogSwitches). One switch
  per holder - give them a `stack` group so two ticked count once.
- **Reroll `scope: "picked"` + `picked: <key>`** - the reroll reaches every actor whose uuid is in the list a pick
  (`pickMany`, `pickEach`) stored on the rule's item under that key (an unlinked token's actor counts as its world actor);
  `includeHolder: true` adds the holder. `skills` may hold `{choice.<key>}`; while the list or a skill pick is missing,
  nobody gets it. Read through `registerRerollGrant` (mechanics/rolls/reroll.mjs#getRerollConfigs), so it is offered like any
  item reroll. **`legacyEffects: "<flag>"`** - Active Effects an older version handed out for the grant (flagged
  `flags.essence20.<flag>` = the holder's uuid) are deleted once at start-up by the active GM.
- **Rule `RequisitionDif {amount, items?, min?}`** (`ext/i/requisition.mjs`) - the holder's Requisition Test DIF changes by
  `amount` (a formula) for items matching `items` (item tags; `item:availability` reads the tier the DIF comes from - after
  the Qualified-upgrade listeners), never below `min` (default 0). Read by mechanics/resources/requisition.mjs#requisitionDif; several
  rules apply in turn, each floored. `when` sees the actor.
- **`castHitDamage(caster, spell, damage, damageType)`** (`ext/i/cast.mjs`) - a spell's later damage (a storm's strike)
  counted as one of its cast hits: the caster's `on: "cast"` HitRider rules whose `when` holds for that spell change it the
  way they change a successful cast row. For hand-written spell code (other2/magic.mjs's Temper Tempest).
- **Engine edits:**
  - `updateActor`'s `set` / `add` paths fill `{choice.x}` (`system.essences.{choice.essence}.max`); no pick - left alone.
  - `pickGrant`'s text `flags` fill `{choice.x}` / `{var.x}` (`flags: {q2WeaponType: "{choice.type}"}`).
  - `ActionCost` takes `limit.per: "day"` (counted on the actor until a Rest - action-perks.mjs's daily counter) and
    **`limit.key`** - the counter's name (`actionPerkDailyUses.<key>` for a day; shared with whatever else reads it).
  - HitRider's cast reader (`ext/b/hit-rider.mjs#hitRiderOnCast`) takes the spell itself as `rider.item`.

Tests: `module/rules/engine12-i.test.js` (12 tests).

## Engine features added 2026-10-06 (round 13, group J)

- **World sweeps reach unlinked tokens' actors** (`rules/triggers.mjs#sweepActors`, exported). Every world-wide sweep now
  walks the world's actors **plus the synthetic actors of unlinked tokens on the viewed scene (`canvas.scene`, and the
  canvas placeables) and the active scene (`game.scenes.active`)** - each actor once (deduplicated by object and by uuid;
  a linked token's actor is its world actor, so it never counts twice; a token with no actor is skipped). It is used by:
  - the `sceneStart`, `missionStart` and `sessionStart` Triggers (`worldActors()` in triggers.mjs);
  - the timed-item sweep (`sweepWorld` - items a step gave `until` a time, run at turn start, scene start and world-time
    changes);
  - the scene / mission **Pool** resets (`rules/adapter.mjs#resetAllPools`, a lazy import of triggers.mjs).
  All of these already run on the active GM only (the `essence20.sceneAdvanced` / `missionAdvanced` hooks call the
  extensions on `game.users.activeGM?.isSelf`; the session hook and world-time sweep check `isActiveGM`), so each fires
  once per actor per event. `turnStart` / `turnEnd` / `roundStart` were already per combatant - `combatant.actor`, which
  for an unlinked token IS its synthetic actor - and are unchanged.
- **Tag `roll:skillSpecialized`** (`rules/plugins/tags/skill-specialized-tag.mjs`) - the rolled Skill is itself Specialized on the roller
  (`system.skills.<skill>.isSpecialized`, the Skill's own flag - not a Specialization being rolled, which is
  `roll:specialized`). Unknown (null) with no roller or no rolled Skill.

Tests: `module/rules/engine13-j.test.js` (10 tests).

## Engine features added 2026-10-06 (round 14, banked)

- **`rollVsEach` / `roll` `essence`** (`rules/steps.mjs`): roll the Skill with that Essence instead of its own (the old Uses
  rolled Intimidation as Social). `mechanics/combat/reaction-engine.mjs#rollVsMany` takes an optional 5th `essenceOverride`;
  the argument is only passed when the step sets it, so existing callers and their tests are unchanged.
- **`writeInitiative` `exact: true`**: writes the formula's value as-is (no rounding), evaluated per recipient.
- **`setForm` `silent: true`**: updates with `{essence20: {silentState: true}}` (no morph chat line / badge), the way It's Time
  did. The options object is only passed when `silent` is set.
- **Recipient `nearbyEnemies:<ft>`** (`rules/plugins/combat/nearby-enemies-recipient.mjs`, imported last by
  `rules/plugins/index.mjs`): every token in range whose disposition differs from the actor's, NEUTRAL ones included - the
  `getNearbyEnemyTokens` set the old area Perks used. `enemies:<ft>` leaves neutral tokens out. Each actor once; the range may
  be a formula.
- **`pick` from `skills` with `notShift: [...]`** (`rules/plugins/tags/actor-state-tags.mjs`): leaves out Skills at those
  shifts (Fast Learner's decrease can't pick a d2 Skill).

## Engine features added 2026-10-06 (round 14, dice)

- **DialogSwitch `noDamage: true`** (`rules/types.mjs`, `rules/adapter.mjs#applyRuleSwitches` -> `options.ruleNoDamage`):
  ticked, the attack forgoes its damage - dice.mjs's `ruleForgoDamage` zeroes `checkContext.damageValue` and drops the
  secondary damage, so the card has no damage, no Critical damage options (the old "forgo damage to ..." checkboxes:
  Guardian Strikes, Stick In The Spokes, Interdiction). A switch with only `noDamage` is valid.
- **A spending switch's `steps` see `@spent`** (`adapter.mjs#applyRuleSwitches` puts the amount in the steps' vars) -
  Caution To The Wind banks `0 - @spent` on its Defenses.
- **Post-roll Trigger facts** (`rules/triggers.mjs` registerPostRoll): the roll context of afterRoll / hit / miss /
  targeted Triggers now carries `defenseType` (checkContext.defenseType - the Defense the roll was compared against, the
  first target's resolved one; `defense:` tags read it) and `rollDamageType` (checkContext.damageType - the card's damage
  type after every override, a spell's or synthetic test's too).
  **Tag `roll:damageType:<type>`** (`rules/plugins/tags/roll-damage-type-tag.mjs`) reads it; null outside a posted roll.
  (No existing rule used `defense:` in those events, so nothing else changed.)
- **Tag `roll:autoDownshift`** (`rules/plugins/tags/roll-auto-downshift-tag.mjs`): the system's automatic modifiers put a
  ↓ on this roll - dice.mjs hands `autoShiftDown: combatModifiers.shiftDown` to `extDialogToggles` and `runApplyDialog`
  (so a switch gated on it is both offered and applied). Null where nobody said.
- **Recipient `crewedVehicle`** (`rules/plugins/zords/crewed-vehicle-recipient.mjs`): the vehicle / Zord the actor crews,
  any seat (zord-crew-lookups#crewing - the world scan `_getPilotedVehicle(actor)` made with no role).
- **HitMultiplier `stage: "card"`** (`rules/plugins/combat/card-hit-multiplier.mjs#applyCardHitMultipliers`, called by
  dice.mjs `_rollSkillHelper` right after `_applyImmovableObjectImmunity`): the row's damage is multiplied (no note) while
  the card is built - before the post-pass flat adds and every hit rider, where the hand-written "double / triple damage
  against X" Perks multiplied. `when` sees the roll's item, Skill, melee / ranged, switches and damage type, self = the
  roller, target = the row's target; one book item's rule once per row. `megaform-finisher.mjs#hitMultiplierOnAttack`
  skips `stage: card` rules.

Tests: in `module/rules/conv14-dice.test.js` (the tag, recipient, multiplier and switch tests).

## Engine features added 2026-10-06 (round 14, items1)

- **BeforeRoll `early: true`** (`rules/plugins/rolls/early-before-roll.mjs`, imported last by `rules/plugins/index.mjs`): a
  `{cancel: true, early: true}` BeforeRoll is checked when the item is used - `documents/item.mjs#roll`, before its Area of Effect
  is placed or a pre-roll picker opens - and a refused use gets its action back (`refund` of the action-economy spend), with the
  rule's `message` as a warning. Without `early`, a cancel happens inside the roll (the extensions' preRoll), after the action is
  spent and the template placed, and nothing is refunded. The same rule is asked again there, so a roll that doesn't come through
  `item.roll` (an `attack` step) is still refused. `earlyRollRefusal(actor, item, dataset)` returns the refusal's message, or
  null. Used by the once-per-encounter weapon effects (the old `limited-weapon-effects.mjs` check sat at that same point).

Also used, from the round-14 dice part (in progress beside this batch): tag **`roll:damageType:<type>`** (the card's damage type
after every override - `rules/plugins/tags/roll-damage-type-tag.mjs`) for Painmonger, and the hit / targeted Triggers' `defense:`
fact (`checkContext.defenseType`, rules/triggers.mjs) for Clever Mind. **If that part's triggers.mjs change is dropped, Painmonger
and Clever Mind need it back.**

## Engine features added 2026-10-06 (round 14, items2)

- **Tag `self:holdsActive:<uuid>`** (`rules/plugins/tags/active-item-and-own-zord.mjs`) - the actor holds a copy of that
  book item which counts for rules (`rules/index.mjs#isItemActive`: a Hang-Up a Matured Perk ignores doesn't). The
  hand-written `actorHasHangUp` reading; `self:hasItem:<uuid>` counts any copy. (Laypony Terms on Reverse Engineer.)
- **Tag `self:ownsZord`** - the actor lists a Zord on its sheet. **Recipient `ownZord`** - the first Zord listed there
  (`combat.mjs#getOwnedZord`'s "your Zord"); `ownZords` still reaches every one. (Zord Alterations.)
- **`bank {grantDouble: true}`** (rules/steps.mjs) - upshifts banked on another actor first offer the granter's
  GrantDouble rules (`plugins/resources/grant-double.mjs#offerGrantDouble`), the same hook the hand-written
  `perks.mjs#bankPendingBonus({granter})` calls; yes doubles the ↑. Opt-in, so earlier bank conversions are unchanged.
- **`roll {open: true, sheetShifts: false}`** - the open roll without the Skill's standing shifts / Specialized flag, for
  a hand-written `rollSkill({skill, shiftUp: 0, shiftDown: 0})` Use (On Target).
- **SkillSubstitution `carryShifts: true`** (`plugins/dialog/dialog-select.mjs`, mode ask) - when the player picks
  another Skill, its own sheet shifts (`system.skills.<skill>.shiftUp / shiftDown`) are added to the roll's - for a roll
  made without them (a Requisition Test re-pointed at Wealth).
- **Validator fix** (rules/steps.mjs#stepErrors): a `setVar` text value (the handler's own test: no leading digit / `@` /
  `(` / `-`, no call) and `shiftSize`'s `min` / `max` (sizes such as `"huge"`) are no longer read as formulas. This also
  clears the two check-rules errors Mind Over Matter's pack rules had.

## Engine features added 2026-10-06 (round 14, systems)

- **Pick source `ownedActors {actorType?}`** (`rules/plugins/picks/owned-actors.mjs`, imported last by
  `rules/plugins/index.mjs`): every world actor this user may act for (its owner, or the GM), of that actor type; the
  value is its uuid, so `to: picked:<key>` reaches it. Organic Zord's "your or another Ranger's Zord" (the old list was
  the world Zords the user owns - `pick from: actors` lists everyone's).

## Engine features added 2026-10-06 (round 14, uses)

- **`KitPrerequisite {mode: waive, all: true}`** (`rules/plugins/resources/kit-prerequisite.mjs`, new export
  `ruleWaivesAllKitPrerequisites(actor, info)`): every kit's prerequisite is waived, a Skill Kit's "No Ranks" too -
  `kits.mjs#meetsKitPrerequisite` asks it before anything else (where the hand-written Kitbasher check sat). Plain
  `waive` still only drops the Skill die through the `essence20.kitPrerequisite` hook. `tiers` / `skipEssenceKits` narrow
  it as before.
- **`pickEntry {kitTier: true}`** (`rules/plugins/picks/pick-and-loop-steps.mjs`): a compendium entry with no Availability
  (gear) takes its tier from its name - "Limited Burglary Kit" is Limited (`grants.mjs#kitAvailability`) - for
  `@var.pickedDif` / `pickedAvailability`. Opt-in: other `pickEntry` steps (Scavenger's gear) are unchanged.
- **`grant {name}`** fills `{var.<key>}` and `{@formula}` too (it used `{choice.<key>}` only) - `"{var.pickedName}
  (Energon)"` after a `pickEntry`.
- **Item steps' `item: "choice:<key>"`** reads a list as well (a `pickMany`'s): every item in it, with `all: true`.

## Engine features added 2026-10-07 (round 15, banked)

### Rolling against creatures
- **`rollVsEach` `damage`, `dataset` and `onDouble`** (`rules/steps.mjs`):
  - `damage {value, type}` puts Apply Damage buttons on the card, multiplied by Degrees of Success. It travels as
    `dataset.stepDamage`, one generic key in dice.mjs's synthetic-damage chain.
  - `dataset {key: value}` adds flags to the roll, which Triggers read as `roll:dataset:<key>`. For example, Outwit's
    `isOutwit` is read by Deceptive Warfare and Inundation.
  - `onDouble` runs instead of `onHit` on a success of x2 Degrees or better.
  - `mechanics/combat/reaction-engine.mjs#rollVsMany` takes an optional 6th `extra` dataset, and its rows now carry
    `multiplier`. The extra arguments are passed only when a step sets them, so existing callers are unchanged.
- **`skill: "actor:<path>"`** rolls the Skill named at that path on the actor. Menace and Distracting Offer use
  `actor:system.originSkillsIncrease`. **`skill: "choiceOf:<uuid>"`** rolls the Skill picked on the actor's copy of that
  item (Tender reads the Empathy pick). With no such Skill the run stops before rolling.
- **`roll` `dataset`**: the same flag object, added to a plain `roll` step. Rouse uses `isRouseAttempt`, which Brutal
  Verbalities reads.
- **Tag `self:choiceOf:<uuid>`** (also `target:`; `plugins/tags/choice-of-tag.mjs`): true when the actor holds that item
  with a pick made on it.
- **Ref `@skillDie.<skill>`** (`plugins/rolls/skill-die-ref.mjs`): rolls the Skill's own die (d2 up to 3d6, d20 when
  untrained), with no shifts. Like other formula dice, the roll is shown in the step's chat and uses `scope.random` in
  tests. Hard Target and Resilience use it as `bank {defenseBonus: "@skillDie.acrobatics"}`; Surface Read uses it too.
- **Rule type `SnagImmunity {}`** with `when` (`plugins/rolls/snag-immunity.mjs`): the roll can't suffer a Snag. It is
  checked after the Roll Options Dialog and after every Snag the system adds, at the point where Time Traveler's code used
  to clear it. This is later than RollModifier `immune: ["snag"]`. dice.mjs calls `ruleSnagImmune`.

### Picking and reporting
- **`pick from: conditions {of?: self | target, exclude?: [ids], all?: true}`** (`plugins/picks/condition-pick.mjs`) offers
  the Conditions the actor (or the first target) has on now. They come in `CONFIG.E20.statusEffects` order; `all` offers
  every status. Follow it with `removeCondition {condition: "{choice.<key>}"}`. `removeCondition` now fills
  `{choice.x}` and `{var.x}`.
- **Step `targetFacts {of?}`** (`plugins/shared/target-facts-step.mjs`) puts facts about the first target (or the actor)
  into the run's vars:
  - `{var.name}`, `{var.health}`, `{var.healthMax}`;
  - `{var.hangUps}`, `{var.perks}`, `{var.powers}` (item names, comma-joined, or "none");
  - `{var.resistances}` (immunities marked as immune);
  - `{var.defenses}` and `{var.lowestDefense}`.

  With no target, the run stops with a "needs a target" line. Studious Measures, Breaking Point and Study Weaknesses use it.
- **Ref `@effectiveLevel.self | target`**: an NPC's or vehicle's Threat Level, otherwise the level.
- **Step `keepTargets {max}`** (`plugins/picks/keep-targets-step.mjs`): the run's targets are cut to the first `max` (a
  formula) - "the first N enemies in range". Below 1 the run stops. Bumper Crop and Entropic Sponge use it.
- **Step `lendAssistance`** (`plugins/rolls/lend-assistance-step.mjs`) runs `activateLendAssistance` and puts its report in
  chat. A cancelled assist stops the run (I Got You).

### Who it acts on
- **Recipient `pilotedVehicleOrTarget`** (`plugins/zords/piloted-vehicle-or-target.mjs`): the vehicle or Zord the actor
  crews, else the first target if it is a vehicle. Use it with `focus`. Engine Override, Jury Rig and Improvise Armor use it.
- **Tag `self:holdsItem:<item tags joined by &>`** (also `target:`; `plugins/picks/owned-item-steps.mjs`): the actor owns an
  item that meets every one of those item tags.
- **Step `flagItem {item, flag, exclusive?: [item tags], loneEffect?}`** sets `flags.essence20.<flag>` on the picked item.
  - `exclusive` first takes the flag off the actor's other items that match those tags.
  - `loneEffect` switches the item's single Active Effect off, and back on when the flag comes off.

  Matured uses `maturedIgnored`, which the rules index and `findHangUp` already skip.
- **`updateItem` `multiply`, `parent` and `appendTraits`**:
  - `multiply {path: factor}` multiplies the number at that path and rounds down; empty values stay empty.
  - `parent: true` acts on the picked weaponEffect's weapon.
  - `appendTraits` adds traits, each one once.

  Weapon Conversion uses all three.

### Turn order and combat stamps
- **Tags `self:stamped:<flag>[:round | :turn]`** (also `target:`; `plugins/tags/combat-stamps.mjs`): `flags.essence20.<flag>`
  holds a `{combatId, round, turn}` stamp from the running combat, this round or this turn. The Quiet One uses
  `combat:ally:target:stamped:quietOneNoisyActionThisRound`.
- **Step `stamp {flag, to?}`** writes that stamp, with nulls out of combat. Stand Behind Me! uses it for the taunt flag its
  reader keys on.
- **Tag `target:turnNeighbour:up | down`** (also `self:`) is true when a combatant with rolled Initiative sits directly
  above or below. **Ref `@turnOrder.up | down`** gives that combatant's Initiative. It is read for the step's recipient,
  else the first target, else the actor. Work the Numbers uses
  `writeInitiative {value: "@turnOrder.up + 0.01", exact: true}`.
- **Ref `@combat.round` / `@combat.turn`** (`plugins/effects/round-durations.mjs`): 0 with no combat.

### Durations (`plugins/effects/round-durations.mjs`)
- **`until: "thisRound"`** lasts while the combat round stays the one it started in. Out of combat, it lasts until a combat
  round is running (Engine Override).
- **`until: "throughNextRound"`** lasts through the round after the one it started in, and never runs out out of combat
  (Hup!, Jury Rig's Free mode).
- **`until: "mapScene"`** lasts while the viewed scene (`game.scenes.current`) is the one it started on. Distracting Offer
  uses it because the old code keyed on the map, not the Scene Clock.

### Banks and marks
- **`bank` `defenseMultiply`**: that Defense is multiplied against the next matching attack instead of added to. Read it with
  `rules/bank.mjs#bankedDefenseMultiplier`; dice.mjs applies it where Roll With The Punches used to double the Defense.
- **`bank` `key` and `stackMax`**:
  - `replace: true, key: k` replaces only this item's banks under `k`, so one item can keep two kinds of bank (Grid
    Surge's Edge and its Toughness Boost).
  - `stackMax: N` adds the replaced bank's Defense bonus to the new one, up to N ("stacking to +3").
  - Entries keep their `key`.
- **Steps `splitBank` and `scaleBank`, tag `self:bankedFrom:<uuid>`** (`plugins/resources/bank-steps.mjs`):
  - `splitBank` is a button step. It moves part of the ↑ this item banked on the first target to another ally the presser
    picks (Plan of Action's Split).
  - `scaleBank {from: <uuid>, multiply}` multiplies the live banks made by that book item (Stand Firm doubles Stalwart
    Defense).
  - `self:bankedFrom:<uuid>` is true while such a bank is live.
- **`mark` `keep: N`** (a formula): the setter's mark under that key stays on the newest N creatures only. Mark Target uses
  `keep: "1 + 4 * @owned.<Additional Marks id>"`. Order stamps always increase, so marks set in the same millisecond still
  have an order.
- **`DieSubstitution` `from: [dice]` and `consumeMark`** (`rules/adapter.mjs#ruleDieSubstitution`):
  - `from` applies only when the roll starts at one of those dice.
  - `consumeMark` means the roll uses up the roller's mark.

  Ageless Knowledge uses `{mode: floor, die: d4, from: [d2], consumeMark}`.
- **`HitRider` `consumeMark: <key>`** (`plugins/combat/hit-rider.mjs`): the first hit the rule acts on uses up the hitter's
  own mark. This gives a one-shot "+1 damage on your next damaging hit" (Smashmouth Offense). `hitRiderOnAttack` returns
  the write only when a mark was used.

### Costs and movement
- **Use `cost.kind`** (a name, only with `cost.action`): `pay()` receives `{kind}` so the action economy's cost changers can
  read it. Rouse's `kind: "rouse"` gets Rousing Presence's discount. See `rules/triggers.mjs` and
  `mechanics/actions/action-perks.mjs`.
- **Movement `@recipient`**: a Movement rule's value can read the actor whose movement it is. Hup! uses
  `@recipient.flags.essence20.ruleMarks.hupHup.count` on a marked rule.

## Engine features added 2026-10-07 (round 15, dice)

Story Points and Skills
- **Step `grantStoryPoint {count?, pool?, optional?}`** (`rules/plugins/resources/grant-story-point.mjs`): adds `count`
  (default 1) Story Points through `mechanics/resources/story-points.mjs#requestStoryPointGrant` (the owner writes, anyone
  else relays to the GM). `pool`: `story` (default, the team's), `gm`, or `actor` (the actor's own - the GM's for a
  Threat). With nobody able to write the pool the run stops quietly (so a limit isn't spent) unless `optional: true`.
- **Rule type `FumbleStoryPoints {amount}`** (same file): dice.mjs's core "a Fumble adds a Story Point" adds `amount`
  instead of 1 while `when` holds (the biggest amount wins).
- **Rule type `SkillEssence {essence}`** (`rules/plugins/rolls/skill-essence.mjs`): the rolled Skill counts as that
  Essence's for the roll (dice.mjs's rolledEssence).
- **Rule type `EdgeOrShift {upshift}`** (`rules/plugins/rolls/edge-or-shift.mjs`): an Edge - or, when the roll already has
  an Edge from elsewhere, `upshift` ↑ instead (Expert in Your Field).
- **Rule type `EnergonSpendBonus {upshift, limit?}`** (`rules/plugins/rolls/energon-spend-bonus.mjs`): the dialog's "spend
  1 Energon for ↑1" gives `upshift` more; the limit is spent only when it applies. **Trigger event `rollEnergonSpent`**
  (same file): after that spend is paid from the actor's own pool; `@var.before` is the pool before it.
- **`initiativeRolling` sees the Initiative roll's switches** (`rules/plugins/rolls/initiative.mjs`): the ticked switch
  keys reach `roll:switch:<key>` there ("Friendly" Fire after Spoof).

Attacks: bare hands, ranges, targets
- **Tags `attack:barehanded`, `self:holdingWeapon` / `target:holdingWeapon`, `roll:dealsDamage`**
  (`rules/plugins/tags/barehanded-tags.mjs`; `UNARMED_WEAPON_IDS` lives here now, dice.mjs imports it).
- **Range facts** (`rules/plugins/tags/range-facts.mjs`): `roll:rangeBand:normal|long`, `roll:longRangeSnagIgnored`,
  `roll:elevationAbove:<op>N` (dice.mjs's ranged block puts them on the dataset); **rule type `WeaponRange {add}`**.
- **Checks `inAppraisedArea`, `attackedByAlly`** (`rules/plugins/tags/dice-checks.mjs`, helpers loaded at setup).
- **Target tags** (`rules/plugins/tags/dice-target-tags.mjs`): `target:statusFrom:<id>` (a Condition this actor applied),
  `target:resistsRolled`, `target:immuneRolled`, `target:nearby:<ft>:<tags&tags>`, `target:mostConditions`,
  `skill:roleSkill`, `holder:versusTarget:<self tag>`; **recipient `to: nearestEnemies:<n>`** - the n enemy tokens
  nearest the actor, any range, nearest first (Beam Volley's `PreCast` `setTargets`).
- **Refs** (`rules/plugins/tags/dice-refs.mjs`): `@sneakAttack`, `@hardenedArmor`, `@volleyShots`, `@vehicle.size` /
  `@vehicle.<path>` (the crewed vehicle); tags `roll:skillNoBetterThan:<skill>`, `self:uuidIsVar:<key>` (the run's
  `@var.<key>` is this actor's uuid). **rollSeen's `@var.assistedBy`** (`rules/plugins/tags/world-watch.mjs`): the uuid
  of the assister whose Lend Assistance ↑ the seen roll used (Misled).
- **Tags `item:healthDamage` / `weapon:primariesNoDamage`** (`rules/plugins/tags/violent-tags.mjs`, which holds
  `NON_DAMAGE_EFFECT_TYPES`): the rolled effect deals Health damage; its weapon's no-↓ effects deal none (Violent).
- **Rule type `SizeMatrix {attackerSteps}`** (`rules/plugins/combat/size-matrix-steps.mjs`): the attacker counts N steps
  bigger for the Size Class shift only. **Rule type `DataBridgeBonus {max}`** (`rules/plugins/combat/data-bridge-bonus.mjs`).

The Skill die
- **Die facts** (`rules/plugins/rolls/die-facts.mjs`): tags `roll:baseDie:<die>` and `roll:finalDie:<op><die>` (`<=d4`,
  `>=d8`, `=d6` - by quality); DialogSwitch `noCrit: true` and `capDie: "d12"`; rule types `FumbleRange {upTo}`,
  `DownshiftCap {max}`, `BonusPoolDie {skill}` (a Skill's die joins the kept-highest pool).
- **Rule type `DownshiftCancel {amount, stack?, limit?}`** (`rules/plugins/rolls/downshift-cancel.mjs`): ↓ off the stacked
  total before the dialog.
- **Rule type `Multiplier {doubleMargin | critMultiplier | promote, limit?}`** (`rules/plugins/rolls/degree-multiplier.mjs`):
  the rows' Degrees of Success.
- **Rule type `CritDowngrade {prompt, steps?}`** (`rules/plugins/rolls/crit-downgrade.mjs`): when the dice show a Critical
  Success the roller is asked `prompt`; yes, and the roll is a plain success (every row capped at x1), and `steps` run
  once the card is done (Consistent: bank ↑1).

Roll Options Dialog
- **DialogSwitch `syntheticDamage {value, type}`** (`rules/plugins/dialog/switch-synthetic-damage.mjs`): a Skill Test
  against a Defense carries that damage on its card.
- **DialogSwitch `sneakAttackMultiplier`** and tags `self:activeRolePoints:<tags&>`, `roll:rolePointsDamage[:own]`
  (`rules/plugins/rolls/role-points-damage.mjs`).
- **DialogSwitch `tradeUpshifts: N`** with `spend: {max}` (`rules/plugins/rolls/upshift-trade.mjs`): the ↑ entered are
  traded off the roll's settled ↑ total late in rollSkill (never more than it has) for 1 damage per N.
- **DialogSwitch `clearPenalties: true`** (`rules/plugins/dialog/switch-clear-penalties.mjs`): the roll ends with no Snag
  and no ↓, decided at the very end of the post-dialog chain (read by its ticked box).
- **Switch / DialogSelect option keys dice.mjs understands** - `ignoreArmor` (every per-attack Defense value without its
  armor bonus) and `rerollSkillDice` (the Skill dice rerolled once rolled). Driving Strike's DialogSelect uses them.

Defenses
- **Defense `early: true`** (+ `plus`, `key`) (`rules/plugins/combat/early-defense.mjs`): "use the better Defense" and early
  adds, against the other Defense's per-attack value; a limit is spent only when it changed the number.
- **Rule type `DefenseSwap {from, to}`** (`rules/plugins/combat/defense-swap.mjs`, on the attacker): a target that would use
  `from` (`any` for every Defense) uses `to` - after TargetedDefense, before Superstructure. Immunity kinds
  **`evasiveManeuvers`** (the target's Fly In The Future doesn't turn the attack onto Evasion) and **`voidArmorIgnore`**
  (scope incoming: the Void trait doesn't ignore this actor's armor).
- **Defense `ignoreArmor` + `points: N`** (`rules/plugins/combat/ignore-armor.mjs`): only N points of the armor share.
- **Rule type `CritImmune`** (`rules/plugins/combat/crit-immune.mjs`; scope self or `aura`): the target's rows lose their
  Critical options. **Tag `holder:check:<name>`**: a registered check asked of the holder.
- **Rule type `SnagOrMiss {limit?}`** (`rules/plugins/combat/snag-or-miss.mjs`, on a defender): a roll against the holder
  gets a Snag, or misses when it already has one; one use for both branches, spent once the roll goes ahead.
- **RollModifier immunity kinds** (`rules/plugins/rolls/immunity-kinds.mjs` + `registerImmunityKind`): `reachDownshift`,
  `grappleSizeDownshift`, `resistanceSnag`, `longRangeSnagForEdge`.

Damage
- **CardDamage {add}** (`rules/plugins/combat/card-hit-multiplier.mjs`): a flat add to the row right after the stage-card
  multipliers. **HitMultiplier `stage: "late"`** (same file): every damaging row multiplied at the end of the card (where
  Empty the Mag doubled); `megaform-finisher.mjs` skips stage late as it skips stage card.
- **DamageModifier `exceptTypes`** (`rules/plugins/combat/damage-except-types.mjs`).
- **Rule type `DamageFloor {floor}`** (`rules/plugins/combat/damage-floor.mjs`): the attack's own damageValue is at least
  `floor` (not a listed bonus - Titan Body).
- **Step `cureAll {to}`** (`rules/plugins/effects/cure-all.mjs`): full Health, every status off (Defeated too).
- **Duration `until: "throughRoundPlus2"`** (`rules/plugins/effects/round-window.mjs`): rounds r..r+2 of the combat it
  started in (a 3-round spell); never outside combat.

## Engine features added 2026-10-07 (round 15, items1)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 15 (items1)" block.

### Rule types

- **`FanningShots {extraShots, firstShotUpshift}`** (`combat/fanning-shots.mjs`) - adds Fanning shots and ↑ on the first fanned shot.
  It is read by `items/attacks/fanning.mjs` (`getFanningMaxShots`, `getFanningFirstShotUpshift`). Storm of Lead.
- **`TraitIgnore {traits: [mounted], items?}`** (`combat/trait-ignore.mjs`) - a weapon trait's drawback doesn't apply. `items` is
  a list of item tags for the weapon. `ruleIgnoresTrait(actor, weapon, trait)` is read by `mounted-weapons.mjs`. Ordnance Expert.
- **`SuccessToCrit {when, steps?}`** (`rolls/success-to-crit.mjs`) - a plain success against a target that meets `when` becomes a
  Critical Success. This happens at dice.mjs's Unconscious bump. `steps` run once afterwards. No Factor.
- **`PoisonCoating {cost: move | free, keepVialOnFumble}`** (`resources/poison-coating-rule.mjs`) - Poisonous, Intoxicate, Poison
  Tipped.
- **`HealBonus {amount, steps?}`** (`resources/heal-bonus.mjs`) - extra Health when the holder heals the way the Heal action does
  (`heal-action.mjs#restoreHealth`). `when` sees `target:` as the one healed. I've Got You, Up And At 'Em.
- **`TargetedDefense {defense}`** (`combat/targeted-defense.mjs`) - attacks against the holder use that Defense. Scramble.
- **RollModifier `scope: "incomingAura"` + `radius`** (same file) - applies to rolls made against an ally near the holder. Shield
  Modulation with Shield Upgrade.
- **`ShapeOption {kind: skill | size, key?, label}`** (`effects/shape-change.mjs`) - a pick the shared Change Shape dialog offers.
  - `skill`: a Skill kept in the shape under `key`.
  - `size`: one size step per rule. Use `stacks: true` so each Perk copy counts.
- **`AttackChoice {title, prompt, none, options: [{label, shiftUp | damage | armorPiercing | radiusMultiplier}]}`**
  (`combat/attack-choice.mjs`) - one pick, asked as an attack is used, before its area template is placed (`documents/item.mjs`).
  The pick reaches the template radius and dice.mjs's `attackChoiceShiftUp` / `attackChoiceDamage` / `attackChoiceArmorPiercing`.
  `when` sees the rolled attack. Bring It All Down.
- **`DefenseAura {defenses, radius, bonus: rolePoints | amount}`** (`combat/defense-aura.mjs`) - a bonus the holder lends to allies
  in range. It goes inside every per-attack Defense value dice.mjs computes: the compared Defense, Over the Candlestick's swap,
  and the early Defense rules' `valueOf`.
  - `bonus: rolePoints`: the holder's base Role Points defense bonus for that Defense.
  - With several holders in range, the best one counts.
  - Shield Upgrade, with `check:personalShield`.

### Trigger events

- **`defeatedEnemyStun`** (`combat/stun-defeat-event.mjs`) - a Stun hit auto-Defeated someone. CBRN Defender.
- **`allyTargeted` / `allyDefended`** (`combat/ally-reactions.mjs`):
  - `allyTargeted` asks the target's allies before the roll. Trigger `promptText`; step `boostDefense {amount}`.
  - `allyDefended` fires afterwards with `@var.outcome` set to hit / turned / missed. The attacker is its target.
  - Defender Step, Retribution.
- **`transforming`** (`@var.mode`) and **`rolePointsActivating`** (a stopped run cancels the activation)
  (`effects/state-changes.mjs`) - Mode Attachment, Shield Modulation.
- **`applyingDamage`** (`combat/applying-damage.mjs`) - damage about to land, in `chat.mjs#onApplyDamage`:
  - `redirect: true, within, priority, limit` - an ally holding it may take the hit. Only the first by priority is asked.
  - Plain Triggers on whoever it lands on can `setVar damage`, with `prompt` / `promptText` (`{name}`, `{amount}`, `{@formula}`).
  - The `stage` Triggers on this event are rest-other's `applying-damage-stages.mjs`.
  - Interpose, Body Shield, Heroic Sacrifice, Golden Guardian, Stand By Me, Fe-BURN!.
- **`damageLanding`** (same file) - fires on the GM's client, as a damage modifier. Cyborg.
- **`criticallyHit`** (`combat/critically-hit-event.mjs`) - a Critical Success's damage lands on the holder. It fires after the
  reductions, whatever damage is left; the attacker is the target. Imperial Machine Mantle.

### Steps

- **`targetCircle {radius}`**, **`setDataset {key, data}`** (`rolls/before-roll-rolled-item.mjs`) - for BeforeRoll rules. BeforeRoll
  steps also see the rolled item as `{rolled.<path>}`, `@rolled...` and `@var.rolledItem`.
- **`mutateWeapon {onto: choice:<key>, set, toggle}`** and **`grantAttacks {uuid, until}`**, plus until **`untilUsed`**
  (`combat/weapon-mutation.mjs`) - Explosive Ammo, Firestorm, Utility Loaders, Backblast, Airburst, Knuckle Up.
- **`lendItem {item, to, onto, lasts}`** (`picks/lend-item.mjs`) - Support, Tech Support.
- **`pickGeneralPerk`** (`picks/general-perk-step.mjs`) - Why Do I Know That?.
- **`fireEvent {event}`**, **`grantResistance {damageType?, morphedOnly}`**, **`hideTokens {hidden}`** (`effects/state-changes.mjs`).
- **`takeAsEssence {prompt}`**, **`unmorph`** (`combat/applying-damage.mjs`) - Cyborg, Fe-BURN!.
- **`linkToHost {name?, warn?}`** (`effects/linked-host.mjs`) - the item a pickGrant just gave is linked to the rule item's host
  weapon (`flags.essence20.linkedHost`).
  - It is equipped exactly while the host is.
  - An active shield going down is lowered and its Defense bonus cleared.
  - It is deleted with the host.
  - `warn` is shown before the host is rolled while the linked item is active.
  - Deflecting Weapons.
- **`changeShape {title?, prompt?}`** (`effects/shape-change.mjs`) - if shaped this scene, it changes back (and restores the
  size). Otherwise it opens one dialog over every ShapeOption the actor has. The state stays `flags.essence20.mlpShape`, which
  `check:shapeShifted` and the shape spells read.

### Tags, refs and selectors

- **`roll:firstRow:success|failure`** - Terrifying Presence.
- **`self:` / `target:markText:<key>=<text|$item.path>`** and mark `text` (`marks/mark-value.mjs`) - Instill Weakness.
- **`damage:resisted`** - the damage type is one the holder already resists.
- **`shape:skill:<key>`** - the rolled Skill is the one the shape keeps under that key.
- **`itemVar:<key>:<item tag>`** and item selector **`var:<key>`** (`gear/item-disruption.mjs`) - the item whose uuid
  `@var.<key>` holds.
- **`item:pack:<pack>|<pack>`** (`tags/item-pack-tag.mjs`) - the entry's system pack. Multimorph's MLP Origins:
  `item:line:mlp` doesn't count Dark Skies over Equestria.
- **`{sourced.<16-char id>.<path>}`** in rule text and tags (`predicate.mjs#interpolate`) - a value on the actor's copy of that
  book item. Self-Preservation reads Energy Affinity's choice.
- **`@actor.system.defenses.<d>.armorShare`** - the armor / Morphed share `_prepareDefenses` just added. Imperial Machine Mantle.

### Mark effects on items

Item mark effects (`markItem effects`, read by `gear/item-disruption.mjs`):
- **`rollSnag`, `rollShiftDown`, `rollLabel`** - roll sources on rolls with the marked item (an attack's weapon counts) and on a
  roll whose dataset names it as `markedItemUuid`.
- **`inoperable`** - a warning before its attack is rolled.

Technical Glitch, Some Assembly Required, Complete System Failure.

### Core options

- `recipients()` **`first`** (a formula, applied after `filter`).
- **`fillData`**: createItem data and children, and `roll` step **`dataset`** values. A lone `{var.x}` / `{choice.x}` keeps its
  value, so a number stays a number.
- afterRoll Trigger **`@var.crit`**.
- `mark` **`text`**.
- DamageReduction **`consumeMark`**.
- pickEntry **`from.types`**.
- pickGrant **`viaDrop: true`** - through the type's drop handler, registered with `registerDropGrant(type, fn)`. The
  `alteration` handler is `picks/drop-grant.mjs`, which uses `onAlterationDrop`. If nothing is made, the run stops.
- pickGrant **`from.byOriginalId`** - an owned item's `system.originalId` counts as holding that entry.
- `pickChildEntry` keeps **`@var.<var>Parent`**, so a second pick can be made from another parent (`not:item:isVar:<var>Parent`).

## Engine features added 2026-10-07 (round 15, items2)

Each entry below says what it does, where it lives and the item that needed it. The new plug-in files are imported at
the end of `rules/plugins/index.mjs`, inside the "Round 15 (items2)" block.

### Events

- **`storyPointsPaid`** (`plugins/resources/story-points-paid-event.mjs`). Fired on the spending actor once the shared
  pool has really gone down (story-points.mjs `spend()`). It sets `@var.amount` and `@var.pool`. Used by Battle Hardened.
- **`rolePointsActivated` / `rolePointsDeactivated`** (`plugins/resources/role-points-events.mjs`). Fired when a Role
  Points item's `system.isActive` turns on or off. The same file adds the tag `self:enemiesStanding` and a
  `wouldBeDefeated` stage `aegis` (before `last`). Used by Reckless Abandon and Aegis.
- **`skillTestPosted`** (`plugins/rolls/recent-rolls.mjs`). Fired on the active GM for every posted Skill Test card.
  The card joins the recent-roll memory after its Triggers have run. Used by Competitive.
- **`converted`** (`plugins/zords/converted-event-and-seen.mjs`). The actor now stands in an Alt Mode: it Converted, or
  it changed Alt Mode while converted. It sets `@var.altMode`. Used by Unexpected Alternative.
- **`hit`, `afterRoll` and `targeted` Triggers now see `roll:edge`**: whether the roll had Edge (dice.mjs
  `checkContext.wasEdge`). Used by Terror.

### Durations

- **`registerUntil(name, {stamp, expired})`** (`expiry.mjs`). Plug-in durations for marks, banks and grants. Its first
  use is `until: "calendarDay"` (`plugins/effects/calendar-day-duration.mjs`), which ends when the real-world date
  changes. Used by Preventative Measures.
- **`until: "endOfNextRoundOrScene"`** (`plugins/picks/cross-item-picks.mjs`). Used by Leave It To Me.
- **Mark / bank `untilOf: "target"`**. The duration counts the target's turns, not the holder's.

### Rule types

- **NaturalTwenty** (`plugins/rolls/natural-twenty.mjs`). A kept natural 20 succeeds, and a success becomes a
  Critical Success. dice.mjs reads it. Used by Better than the Best.
- **NoFumbleStoryPoint** (`plugins/rolls/no-fumble-story-point.mjs`). A Fumble in that Skill gives no Story Point.
  Used by Agency's Hang-Up.
- **EnvironmentalExpertise {shareEnvironments?, scope: self | companion | driven}**
  (`plugins/effects/environmental-expertise-rule.mjs`). "Has Environmental Expertise" is now this rule. dice.mjs,
  environmental-expertise.mjs, rerolls and environment-gated effects all read it. The same file adds the tags
  `self:inExpertiseTerrain` and `self:onHolderExpertiseTerrain`.
- **DriverlessEssence {essence}** (`plugins/zords/driverless-essence.mjs`). A Zord or vehicle with no driver counts this
  Essence for its driver-borrowed Defenses (combat.mjs `getDefenseValue`). Used by Relic Key.
- **EvasiveManeuvers {}**, scope `vehicle` (`plugins/combat/evasive-maneuvers-rule.mjs`). An Aerial vehicle halves its
  Aerial speed, and Toughness attacks against it target Evasion. documents/actor.mjs and dice.mjs read it. The vehicle's
  old `evasiveManeuversActive` flag (Evasive Handling) still counts. The same file adds the tag `self:crewsAerial`.
  Used by Fly In The Future.
- **MovementAction `countSinceTypeChange: true`** (`plugins/combat/since-type-change.mjs`). Only the distance moved since
  the last change of movement type counts against the speed. It listens on `essence20.movementUsed`. Used by Third
  Dimension.
- **CardOffer** (`plugins/cards/card-offer.mjs`):
  - `when` sees the card's Skill (`skill:`), and its steps get `@var.skill` / `{var.skill}`.
  - `addDie {skillDie: true}` rolls the holder's own Skill Die for the card's Skill. It is offered only when the holder
    has one.
  - `once: true` lets each holder answer a card once.
  - Used by One-Upping, Not Like That Like This! and Secret Helper.
- **Assist `effect: pay`** (`plugins/picks/cross-item-picks.mjs`). Used by BFF.
  - It has `cost`, `prompt` and `message`, and `payForAssist` spends the cost (Story Points quietly).
  - A refusing Assist rule's `message` reaches `ruleAssist` (adapter.mjs), and Lend Assistance leaves that ally out of
    its list. Used by Fun Exhaustion.
- **Veto `on: "kitUse"`** (`plugins/effects/veto.mjs`, kits.mjs `kitUseVetoed`). Used by Reckless Abandon.

### Steps

- **`listNames {to, filter, var, none}`** and **`whisper {text, to: user | owners}`**
  (`plugins/cards/names-and-whisper.mjs`). Also in that file:
  - the ref `@versus.<level|toughness|evasion|willpower|cleverness>`;
  - the text refs `{markSkill.<key>}` and `{actor.<path>}`.
- **`damageShield {amount, damageTypes, to, until}`** (`plugins/combat/damage-shield.mjs`). combat.mjs uses it up on
  the next matching damage. Used by Elemental Shield.
- **`spendPooled {to, path, amount, message}`** (`plugins/resources/spend-pooled.mjs`). One cost drawn from several
  creatures in turn. It sets `@var.contributors`. Used by Zord Mega-Weapon System.
- **`refundUse {to, prompt, message}`** (`plugins/resources/refund-use.mjs`). Gives back one of the recipient's spent
  uses. That can be a Scene Clock count, a turn stamp or a rule limit. Used by Delegate.
- **`recordSeen {flag, entry}`** (`plugins/zords/converted-event-and-seen.mjs`). A per-creature memory with
  `@var.seenCount`, `seenNew` and `seenSwitched`.
- **`undoEffect {flag, to, linkedItem, prompt}`** (`plugins/effects/flagged-effects.mjs`). Removes one flagged Active
  Effect and its linked item. The same file adds the tags `self:hasEffectFlag:<flag>` and `target:hasEffectFlag:<flag>`.
  Used by They Called It A Glitch!.
- **`pickChassis {mode: origin | mimicry, flag}`** (`plugins/picks/chassis-picks.mjs`). Picks a Transformers chassis
  by its Origin. The same file adds the text ref `{ruleItem.<path>}`. Used by Alt Mode Mimicry and Drone.
- **`bestItem {type, where, by, keep, message}`** (`plugins/picks/best-item.mjs`). Copies values from the actor's
  strongest matching item. The same file adds the tag `roll:crit`. Used by Elemental Fury.
- **`groupTest {skill, dif, cost}`** and **`groupTally`** (`plugins/rolls/group-test-steps.mjs`). Group-tests.mjs uses a
  test's `cost` for each participant other than the leader. The same file adds the recipient `varActor:<var>`. Used by
  Guardian Blast.
- **`windowCount {flag, window, var}`** (`plugins/resources/vehicle-budget-pieces.mjs`). The same file adds:
  - the pick source `ownedVehicles`;
  - the tag `item:upgradeCostAtMost:<formula>`.
  Used by Motor Pool Connections.

### Recipients, pick sources and tags

- **Recipients**:
  - `aroundSelf:<formula>` (`plugins/picks/around-self-recipient.mjs`);
  - `crew` (`plugins/zords/crew-recipient.mjs`);
  - `varActor:<var>` (in group-test-steps.mjs).
- **Pick source `recipients {of}`** (`plugins/picks/recipient-pick-source.mjs`). Used by Queen's Gambit.
- **Tags**:
  - Turn order: `combat:lowestInitiative`, `combat:currentRolled`.
  - Cross-item picks: `picked:<id>:<key>`, `target:pickedBy:<id>:<key>`, `target:skillDieAtLeast:<die>`,
    `self:costRuleUsed:<id>`.
  - Recent rolls: `recent:sideHigher:<min>`, `recent:selfLower:<min>`, `recent:hostile:<skill>`, and the ref
    `@recent.lowestHostile.<skill>`.
  - Terrain and choices: `terrain:picked:<key>`, `holder:choiceOf:<uuid>`.
  - Sides: `self:sameSideAsHolder`, `target:sameSideAsHolder`.
  - Position: `self:pointWithin:<ft>`, `zone:self:<key>`, `zone:target:<key>` (zones are a roll-time family, so a
    Defense rule reading them is worked out per attack).
  - Other parties: `target:keyedOnMe:<path><op><n>`, `target:immune:<condition>`, `self:immune:<condition>`,
    `self:ownerSpectrum:<colour | none>`.
- **Ref `@initiative.afterCurrent`** (rolls/initiative.mjs).

### New options on existing steps

- **`roll`**: `@var.multiplier`, and `sheetShifts: true`.
- **`rollSeen`**: `@var.skill`.
- **`markText`**: `$skill`.
- **`moveTo`**: `snap: true`.
- **`askNumber`**: `value`, a formula for the starting number.
- **`grant`**:
  - `flags` text is filled;
  - it sets `@var.grantedId`.
- **`addEffect`**: `flags` text is filled.
- **`damage`**:
  - `asCastHit: true` (through `cast-hit-damage.mjs`);
  - it sets `@var.damage`.
- **`damageCard`**: `to`, for one card with a button per recipient.
- **`blast`**:
  - `packets` and `missPackets`;
  - `at: targets`;
  - `excludeTargets`.
- **`scheduleCard`**: `turnStarts`.
- **`placeZone`**:
  - `halfFeet`;
  - `replace`;
  - a zone with no modifier no longer adds an empty roll source.
- **`markWindow`**:
  - `count`;
  - a filled flag (`windowFlag`).
- **`setEffects`**: `items: <selector>`.
- **`recordScene`**: `quiet`.
- **`lendAssistance`**: `skillOnly` and `radius`.
- **`spendAction`**: now allows `fullAction`.

## Engine features added 2026-10-07 (round 15, rest-other)

### Action economy
- **ActionCost kinds `reload` and `morph`** (`plugins/resources/action-kinds.mjs`, new `rules/actions.mjs#registerActionKind(name)`
  - adds a cost kind to `KINDS` and the ActionCost `action` options). documents/item.mjs passes `{kind: 'reload', item: <the
  weapon>}` to the reload spend and morph-state.mjs#payForMorph `{kind: 'morph'}`, so `item:` tags read the weapon
  (`item:isHost` - an upgrade's own weapon; the limit counts per rule item, so per weapon). Rapid Reload `{action: reload,
  to: free}`, Ammo Belt `{..., when: [item:isHost], limit: {per: scene}, stacks: true}`, Rev Morpher `{action: morph, to: move}`.
- **`ActionCount {action: free, essence? | add?}`** (`plugins/resources/action-count.mjs`) - action-counts.mjs#getNumActions:
  Free actions from another Essence (an `essence` rule wins - the old else-if) or Speed + the summed `add`s.

### Reloads, Sneak Attack, drawbacks, untrained Snag
- **`ReloadSkip {limit, combatOnly?, message?}`** (`plugins/combat/reload-skip.mjs`) - reload-trait.mjs#requireReload skips a
  required reload while the limit lasts; `when` sees the weapon as `item:`; `priority` orders several; `message` (E20. key,
  {name} {weapon}) is an info toast.
- **`SneakAttackGrant {items?, qualifies?, range?, anyCircumstance?, cost?, limit?}`** (`plugins/combat/sneak-attack-grant.mjs`) -
  sneak-attack.mjs: `qualifies` (default true) a non-Silent weapon qualifies (`items` narrows, `weapon:` reads its weapon);
  `range` ft | `weapon` | `unlimited` (the widest wins); `anyCircumstance` + `cost {storyPoints}` + `limit` - offered whatever
  the circumstances, paid (sneak-attack.mjs#paySneakAttackGrant, from dice.mjs) only when the ordinary checks would have
  failed. In My Sights would be `{items: [weapon:trait:sniper], range: weapon}`, Ballistic Advantage `range: unlimited`.
- **IgnoreDrawback `temperamentalFumble`** (+ `limit`, `message`; `plugins/rolls/ignore-drawback.mjs#useIgnoredDrawback`) - a
  Temperamental weapon's Fumble is only a failure; dice.mjs posts the rule's `message`.
- **`UntrainedSnagImmunity {limit, freeOutOfCombat?}`** (`plugins/rolls/untrained-snag-immunity.mjs`) - a LIMITED lift of the
  untrained Snag, asked last in roll-dialog.mjs#_isUntrainedSnag (after every unlimited lift), so its use is spent only when
  it is what lifted the Snag. `freeOutOfCombat`: no combat - always, uncounted. (An unlimited lift stays RollModifier
  `immune: [untrainedSnag]`.)

### The Defeat-save chain and Essence to 0
- **wouldBeDefeated `stage`** (`plugins/combat/defeat-stage.mjs` + `triggers.mjs#wouldBeDefeated {stage}`): `first` (default),
  `beforeAegis` (where Immortal Rebel Soul, Life Supporting, Not Done Yet sat), `last` (after Aegis - We Are The Coinless).
  combat.mjs#applyDamage calls the chain at each place. Each Trigger now runs only while the hit still would Defeat
  (`fireTriggers {only}` - a new caller filter).
- **Scope `renegadeVehicle`** (every rule type taking `vehicle`) - on a Renegade Perk: reaches the vehicle its holder drives while
  Racer Abandon moves the Perk onto it (summons.mjs#renegadeHolderFor, handed in with `registerRenegadeLookup`). Tag
  **`self:ownRenegade`** - the actor's own Renegade Perks protect it (not while Racer Abandon moved them, unless Rigged Rider).
- **Event `essenceWouldEmpty`** (`@var.essence`) - environment-hazards.mjs#applyEssenceDamage is about to take an Essence to 0;
  `negateDamage` keeps the point (Immortal Rebel Soul shares its Health half's limit through `limit.key`).

### The chat card's Apply Damage
- **applyingDamage `stage`** (`plugins/combat/applying-damage-stages.mjs#applyingDamageStage`; items1's unstaged applyingDamage
  pass skips staged Triggers): `attacker` - on the attacker's items before anything else, the one hit as `target:`, the card's
  facts as `roll:dataset:<key>`, `@var.handled` 1 = the hit is dealt with, no damage (Sudden Death); `reductions` - right
  after the unstaged pass (Fortitude, Extra Plates, Didn't Even Feel It); `lateReductions` - after Hard Corps (Invincibility
  Through Invisibility, Just a Graze). `priority` orders a stage; each runs while damage is left; `@var.damage` /
  `@var.dropSecondary` as items1's; `prompt` + `promptText` ({name} = the one hit, {amount}); linked scopes reach (limit
  on the holder - `renegadeVehicle`).

### Casting, assisting, items and actors
- **`SpellCostDefer {}`** (`plugins/resources/spell-cost-defer.mjs`) - the spell's Casting Cost lands after its Skill Test.
- **`PreCast {steps}`** on a spell (`plugins/picks/pre-cast.mjs#runPreCast`, item.mjs's cast before the roll): a stopped run cancels
  the cast (no roll, no cost). Step **`grantSpecialization {skill, name, to, until: scene}`** - a scene-long Specialization
  (listed in flags.essence20.bestowedExpertise, swept by bestow-expertise-scene-expiry.mjs).
- **Assist effects `persist` and `rollFor`** (+ `limit`; `plugins/rolls/assist-extras.mjs`) - lend-assistance.mjs: a lent Skill
  assist lasts (persistent bank) while the limit lasts; a helper may roll the holder's test for them (`rollFor`, side
  receive; its limit counted on the helper per holder).
- **`AvailabilityShift {steps, items?}`** (`plugins/resources/availability-shift.mjs`) - owned items' totalAvailability, read off
  the items themselves in item prepare (a new rule counts at once).
- **`SenseMultiplier {multiply}`** (`plugins/effects/sense-multiplier.mjs`) - another darkvision source's best range multiplied;
  the rule item's own visionGrant isn't that other source.
- **`AreaRadius {add, items?}`** (`plugins/combat/area-radius.mjs`) - feet on the PLACED area radius (aoe-targeting.mjs), before
  multipliers; the stored system.radius is untouched.
- **`AllyFilter {anyDisposition: true}`** (`plugins/combat/ally-filter.mjs`) - nearby-allies.mjs#getNearbyAllyTokens counts every
  token as the holder's ally.
- **`AttackTraits {traits: [armorPiercing | antiTank]}`** (`plugins/combat/attack-traits.mjs`) - attacks matching `when` (weaponless
  ones too) count as having those traits where dice.mjs reads them.
- **`RequisitionShift {upshift, items?}`** (`plugins/resources/requisition-shift.mjs`) - the Requisition Test's own starting ↑.
- **`GroupTestBonus {upshift?, edge?, who: self | led}`** (`plugins/rolls/group-test-bonus.mjs`) - group-tests.mjs#groupBonuses.
- **`JoinDie {steps}`** (`plugins/zords/join-die.mjs`; `stacks: true` per copy) - the Combiner join die steps down (d6, d4, d2, 1).
- **`VehicleDefeat {brawnDif}`** (`plugins/zords/vehicle-defeat-dif.mjs`) - the explosion Brawn DIF (the lowest).
- **`SummonTimeBonus {amount, sceneAllies?}`** (`plugins/zords/summon-time-bonus.mjs`) - rounds off the rolled Zord arrival time
  before SummonTime; `sceneAllies` - held by any same-Disposition token on the scene; the biggest only.
- **Tags `self:inRoughTerrain` / `target:inRoughTerrain`** (`plugins/tags/rough-terrain-tag.mjs`; the lookup loads at `setup`).
- **Event `posted`** (an item posted to chat from its sheet - item.mjs's gear branch, the item's own rules) and step
  **`placeRoughTerrain {prompt?, chat?}`** (`plugins/effects/rough-terrain-space.mjs`; rough-terrain.mjs#placeRoughTerrainSpace).
- **Bonded partners** (`plugins/picks/bond-link.mjs`): scopes **`bondPartner`** (the bond holder's rule reaches the partner) and
  **`bondHolder`** (the partner's rule reaches the holder); tags `self:bondLinked`, `self:bondHolder`,
  `roll:bondAllySpecialized`, `roll:bondPairTrained`.
- **Drop-time configurator** (`plugins/zords/drop-configure.mjs`): Trigger **`removeOnStop: true`** on an `added` Trigger - a
  stopped run deletes the item again (triggers.mjs#fireItemAdded); step **`adjustItem {item, onParent?, add?, multiply?,
  atLeast?, set?, defaults?, addTraits?, required?, message?}`** - change the found items (`choice:<key>`) from their own
  values (`{var.adjustedName}` / `{var.adjustedItemName}` after); step **`notify {text, data?, level?, stop?}`** - a toast
  (E20. key formatted with filled data); tag **`self:hasItemWhere:<item tags joined by &>`**.

## Engine features added 2026-10-07 (round 15, systems)

All plug-ins are imported at the end of `rules/plugins/index.mjs`, in the "Round 15 (systems)" block.

### Powers

- **Trigger event `powerUsed`** (`resources/power-used.mjs`). It fires when a Power is used:
  `mechanics/characters/power-use.mjs#onPowerUse` calls `firePowerUsed(actor, power, spent)` before its own
  hand-written branches run.
  - The roll's item is the Power, so `item:own` keeps a Trigger to its own Power.
  - `@var.spent` is the Personal Power spent.
  - The targets are the user's targets.
  - A Power held by nanomite gear (not owned by the actor) runs only its own `powerUsed` Triggers, for the holder.
- **Rule type `FreeUse {when}`** (same file). Switching off a Power that matches costs no daily use;
  `mechanics/resources/nanomite-uses.mjs` asks `ruleUseIsFree(actor, power)`. Used for Protection, Reactive and
  Augmented Combat while they are switched on.

### Rolls and damage

- **Step `rollCheck {skill, essence?, shiftUp?, shiftDown?, defense?, dif?, edge?, damage?, dataset?, onSuccess?, onFail?}`**
  (`combat/roll-card-damage.mjs`). It runs a Skill Test through the sheet's own roll (`actor._dice.rollSkill`).
  - `damage: {value, type}` puts Apply Damage buttons on the card, multiplied by Degrees of Success (dice.mjs reads
    `dataset.stepDamage`).
  - `dataset` holds plain flags for the roll.
  - Then `onSuccess` or `onFail` runs.
  - Used by Power Blast, Morphblast, Electric Discharge, Disintegrate, Lucky Charm and Regeneration's Skill Test.
- **Defense `mode: noArmor`** (`combat/no-armor-defense.mjs`; needs `outgoing: true`). The attacked Defense is worked out
  again without armor (Penetrating Strikes). dice.mjs asks `ruleNoArmor` where the old check was.
- **CriticalOption `defense: <defense>`** (`combat/crit-defense-option.mjs`). One damage to that Defense, offered among
  the crit options (Bewildering, Traumatic, Maiming, Surgical). `target-riders.mjs#critRiders` labels it.
- **Cover `mode: giveBack`** (`combat/cover-give-back.mjs`, plus a case in `adapter.mjs#ruleCover`). The weapon's scope
  gives back the Cover it took away (Smart / Thermal Scope).
- **Tags `damage:style:<style>` and `damage:elementOrEnergy`** (`tags/damage-source.mjs`). They describe the attack card
  the GM is applying damage from: its `attackStyle`, and whether its damage type or traits are Element / Energy. They are
  meant for DamageReduction and takesDamage rules (the vehicle armors).

### Items that change their weapon

- **ItemModifier `stage: item`** (`effects/item-modifier-stage.mjs`). The rule runs inside the changed item's own
  `prepareDerivedData` (`items/attacks/weapon-upgrades.mjs` calls `applyItemStage`), so derived fields such as hands,
  reach and range are right before anything reads them.
  - `slot` is `start`, `element` or `end`.
  - The ops are `set` (a number, formula, text, bool or object; `{choice.x}` reads a pick), `add`, `multiply`, `max`,
    `min`, and `step` with `ladder: weaponSize`. `step` moves the size and works the hands out again.
  - Copies of the same upgrade stack (each copy is its own rule). The actor-level ItemModifier pass skips stage-item
    rules.
- **Rule key `always: true`** (`types.mjs` COMMON, `rules/index.mjs#collectRules`). A switched-off item (a stowed weapon
  and its upgrades) keeps its `always` rules (Sling, Integrated Bipod). Every other upgrade rule on a stowed weapon is now
  off.
- **Rule type `BraceUntilMoved {when}`** (`combat/brace-until-moved.mjs`). Brace lasts until the actor moves
  (Integrated Bipod). `named-actions.mjs` asks `ruleBraceUntilMoved`.

### Action costs

- **ActionCost `action: any` / `to: downgrade` / `limit.freeIsUnlimited` / scope `marked` + `mark`**
  (`resources/action-cost-any.mjs`, plus `rules/actions.mjs#costRuleFor`).
  - `downgrade` makes the action one step cheaper (standard to move, move to free).
  - `freeIsUnlimited` takes the cap off its Free half (the Talents).
  - A `marked` rule reaches whoever carries the setter's mark.
  - Action kinds `personalShield`, `rouse`, `analyzeTarget` and `vehicleRepair` are added through
    `registerActionKind`.
  - New duration `roundsThrough:<1-10>`. Out of combat it lasts the scene.
- **grantNextTurn `block: [kinds]` / `prespend: {free: n}`** (edit to `combat/defense-modes.mjs`). The recipient's next
  turn can't take those actions, or starts with some already spent.
- **Tag `self:actionLog:<named key | flag:key>[:standard|move|free]<op><n>` and ref `@ledger.<path>`**
  (`tags/action-ledger.mjs`). They read the turn's action ledger (Here To Help, Desperate Times, Snap Shots, New Plan).
- **Ref `@rangedWeapons`** (`combat/ranged-weapons-ref.mjs`). The number of ranged weapons the actor wields (Barrage
  Attack).
- **Assist `effect: nextTurnGrant {free?, move?, standard?}`** (`rolls/assist-next-turn.mjs`). Lend Assistance offers
  these next-turn grants (Here, Let Me; No, I Insist). `lend-assistance.mjs` asks `ruleAssistGrantModes`.

### Picks, steps and tags

- **Step `askValue {var, prompt?}`** (`dialog/ask-value-step.mjs`). Asks for any number, decimals included.
- **Tags `target:sameDisposition` and `self:roleName:<text>`** (`tags/same-disposition.mjs`).
- **Step `healShared {formula, to, filter}`** (`resources/heal-shared-step.mjs`). One roll is shared evenly among the
  recipients, at least 1 each; it sets `@var.healed` (Repair Zord).
- **pickGrant `from.notOwned` / `from.selectionLimit`** (edit to `rules/steps.mjs`). These leave out entries the first
  recipient already holds, or holds `selectionLimit` copies of (the Nano Infusions, Torozord Feature).
- **bonusAttack `only: <filter key>`** (edit to `rules/steps.mjs`).
- **Steps `morph {free?}` and `refreshMorphedToughness`** (`zords/morph-step.mjs`).
  - `morph` runs the sheet's own Morph flow and stops when already Morphed (Rapid Morph).
  - `refreshMorphedToughness` re-prepares the actor and works its Morphed Toughness bonus out again from the Armor
    Training it has now (the Armor Shells, on `added` and `removed`).
- **deleteItem `keepGrants: true`** (edit to `rules/steps.mjs`). What the removed items granted stays, unlinked first.
- **grantPerk `runPicker: true`** (edit to `plugins/picks/entry-grants.mjs`). A newly granted Perk's own drop-time
  picker (`setPerkValues`) runs (Metamorphosis).
- **Rule types `UniqueChoice {}` and `AnyGeneralPerkChoice {}`** (`picks/unique-choice.mjs`). Both are read from the Perk
  being set up.
  - `UniqueChoice`: copies can't pick a Skill another copy already has (Expertise).
  - `AnyGeneralPerkChoice`: its picker offers any General Perk from every enabled book (Nobody Like Me).
- **Rule type `ChoiceCount {items, add}`** (`picks/choice-count.mjs`). The listed Perks' drop-time pickers offer more
  picks (Grid Tap).
- **Check `check:vehicleInRoughTerrain`** (`tags/vehicle-checks.mjs`). The token of the vehicle the actor crews (or is)
  stands in Rough Terrain.
- **Recipient `personalVehicle:<key>` and tag `self:personalVehicle:<key>`** (`picks/personal-vehicle.mjs`). The actor's
  personal vehicle of that kind (Crashing From The Skies' Jet Pack).

### Vehicles and Zords

- **RollModifier scope `crewIncoming` and DieSubstitution scope `crew`** (`combat/crew-incoming.mjs`).
  - `crewIncoming` is a vehicle's rule on rolls made against someone aboard it (Tinted Canopy).
  - `crew` on a DieSubstitution reaches the rolls of the vehicle's crew (Kill Counter).
- **Rule type `SummonOption {rounds, power?, action?}`** (`zords/summon-option.mjs`). A faster Zord arrival, offered in
  `zord-summon.mjs#rollSummonTimer` instead of the 3d2 and paid when picked. It can sit on the summoner's item or on the
  Zord's.
- **Rule type `ExplosionStep {steps}`** (`zords/explosion-step.mjs`). A Defeated vehicle's explosion die is that many steps
  bigger. With several rules, the biggest wins.
- **Step `reduceTimer {by}`** (`zords/reduce-timer.mjs`). The actor picks a running Zord-summon or Megaform-combine timer,
  and it comes `by` rounds sooner, never before the current round. With nothing running, it warns and the Use's limit is
  not spent.

## Engine features added 2026-10-07 (round 15, uses)

All in their own plug-in files, imported in `rules/plugins/index.mjs`'s "Round 15 (uses)" block.

### Steps

- **`tokenLight {bright, dim, angle}`** (`effects/token-light.mjs`) - switches the carrier's token light on and off. The item
  keeps `lit` and the light it replaced (`previousLight`), so turning it off restores that. Chat: `E20.LightOn` / `E20.LightOff`.
- **`moveTo {to?, maxRange?, forced?, animate?, snap?}`** (`combat/move-to.mjs`) - each recipient's token goes to the point a
  `pickPoint` step kept.
  - `forced` (the default): through `forced-movement.mjs#placeActorAt` (Immovable Object, the GM relay).
  - `forced: false`: the actor moves itself.
  - `maxRange` (ft): a farther point is refused with a warning.
  - `animate: false`: the token jumps.
  - `snap` was added by items2.
- **`refreshMorphedToughness`**, **`itemEffects {item, disabled}`** (`resources/uses-grant-pieces.mjs`) - re-work the Morphed
  Toughness bonus; switch an item's Active Effects off or on (Multifaceted's set-aside Perk).
- **`kitBoost {essence|skill, spec?, mode, kind, rounds?, times?}`** (`resources/uses-kit-pieces.mjs`) - the lasting roll bonus a
  used-up kit leaves (`kits.mjs#addKitBoost`, now exported).
- **`lendAssist {skill?, shiftUp?}`** - with `skill`: a banked Lend Assistance upshift for that Skill on each recipient. Without
  `skill`: the usual Lend Assistance dialog.
- **`recordTurnWeapon {flag}`** (`combat/turn-weapons.mjs`) - remembers this turn's weapons (Flurry of Attacks).
- **`pickChildEntry`, `grantPerk {uuid, link}`, `grantEntries {of, childType, notOwned, until, to}`, `factionDrop`**
  (`picks/entry-grants.mjs`) - grant compendium entries the way the sheet's drop handlers do (Perk / Origin / Faction drops).
  `grantEntries` runs the grant with each recipient as the actor.
- **`sprint`, `shove {bowlOver?}`, `slow {feet, to}`** (`combat/sprint-shove-slow.mjs`) - start a Sprint; the Maneuver shove
  (Bowl-Over: push and Prone both); slow the recipients' next turn.
- **`createCompanion {name, system?}`** + recipient **`created`** (`picks/create-companion.mjs`) - a new companion made by
  `companions.mjs#createCompanion`: the owner's ownership, linked, through the GM. Later steps grant onto it with
  `to: created` (Primary / Secondary Tech's drone).
- **`addToSceneList {flag, entry}`** (`picks/canvas-items.mjs`) - keeps a pick on the actor for this scene, labelled as it
  was offered (I Can Do That's `copiedAbilities`).

### Recipients, selectors, pick sources and text

- **Companion recipients** (`picks/companions.mjs`): `companions[:<type>]`, `firstCompanion:<type>`,
  `selfOrCompanion:<type>`, `companionOwner`, `flagActor:<flag>`.
- **Item selectors** - a new `steps.mjs#registerItemSelector(prefix, fn)` registry (the validator accepts registered
  prefixes). In `picks/item-where.mjs`:
  - `where:<tags&...>`
  - `withAttached:<tags>`, `firstWithAttached:<tags>`
  - `justGranted`
  - `host`
  - ref `@flagged.<flag>`
- **Pick sources:**
  - `specializations {skill}` (`uses-kit-pieces.mjs`)
  - `canvasItems {filter?, anyOf?, self?}` - other tokens' items, one per book source, labelled "<actor>: <item>"
  - `sceneList {flag}` (`canvas-items.mjs`)
- **Text placeholders** - a new `steps.mjs#registerTextRef(head, fn)` registry, used by `fillText`.
  `{sourced.<id>.<path>|default}` (`uses-grant-pieces.mjs`) reads a value on the actor's copy of a book item. It works
  together with items1's no-default `{sourced...}` in `predicate.mjs#interpolate`.
- **Refs:** `@takeMine` (`kits.mjs#takeMineMultiplier`), `@turnWeapons.<flag>`.

### Tags

- **`link:` family** (family "roll", in `picks/companions.mjs`):
  - `hasCompanion`, `pair`, `ownCompanion`
  - `rolledAgainst:partner|owner[:attack]`
  - `deployedThisRound[:<type>]`, `holderDeployed`
  - `targetAdjacentToHolder`, `selfAdjacentToHolder`
- **Item tags:**
  - `item:heldBySelf`, `item:entryOfOwned:<type>`
  - `item:firstAttack:<tags&>`, `item:primaryAttack`
  - `item:line:<line>`, `item:folderName:<name>`, `item:nameOfOwned:<type>`, `item:isVar:<key>`
- **Actor and roll tags:**
  - `check:markTarget`
  - `self:` / `target:status:any[:except=a|b]`
  - `roll:entry:<key>` - in a `targeted` Trigger, the defender's check entry. `triggers.mjs` now hands it over.
  - `self:specializationNamed:<skill>:<text>`, `self:sprinting`
  - `self:` / `target:hasArmorUpgrade:<defense>`
  - `self:sourced:<id>:<path>=<value>` / `!=<value>` - a missing value makes `=` false and `!=` true, unlike a
    `{sourced}` in the tag text.

### Rule types

| Rule type | What it does | Read by |
|---|---|---|
| `EssenceRedirect {from, to, roleName}` | Sends a Role's Essence increase to another Essence (Cordial, Rough and Takes No Guff) | `grants.mjs#essenceRedirect` |
| `CarryExemption {items, max}` | Hands of gear carried outside the hands | `kits.mjs#extraCarriedHands` |
| `KitModifier {scroungeDif, upgradeRoll, keepRoll, respecialize}` | Changes kit scrounging and use | `kits.mjs` (scroungeDif, consumeKit, useKit) |
| `AllyRangeMultiplier {multiply}` | Multiplies ally range | `nearby-allies.mjs` |
| `ShiftCap {maxDown}` | Caps the net downshift (Fanatic) | `dice.mjs` |
| `PetCommand {difTier}` | Pet command difficulty tier | `companions.mjs#commandDif` |
| `PartyRequisition {perMember}` | Requisition per party member | `actor.mjs` (Base Tech) |
| `ArmorUpgradePenalty {mark, amount}` | Lowers the Armor Upgrades of a creature with the holder's mark: Toughness first, never below +0 (Make an Opening) | Plug-in's own `registerDefenseAdjust` |
| `ManeuverOption {option: disarm \| dismantle}` | `disarm` adds Disarm to the Maneuver choice; `dismantle` lets a disarmed weapon matching `when` be pulled apart | `dice.mjs`; `target-riders.mjs#disarm` |
| `ConditionDuration {condition, rounds}` | An attack's own on-hit Condition length; dice are rolled each hit | `target-riders.mjs#conditionRiders` |
| `BeforeArea {options?, dataset?, exclude?}` | Before the template: bigger / smaller / shape / single (single sets a dataset key). After it: untick up to `exclude` (`skillDie` or a formula) caught tokens | `documents/item.mjs` |
| `SwapShrug {from, to}` | A hit resisted with `to` instead of `from` drops its secondary damage and Conditions (Unstoppable Force) | `target-riders.mjs#attackRiders` |

### Parameters on existing types and scopes

- `DialogSwitch`: `clearSnagCost` (`dialog/clear-snag-cost.mjs`, via `registerApplyDialog`) and `ignoreArmorUpgrades`
  (with `spend: {max}`, Pinpoint).
- `HitRider`: scope `companion` and scope `markedTarget` + `mark` (`marks/marked-target-hits.mjs`). `Assist`: scope
  `companion`. `hit-rider.mjs` gained `HIT_RIDER_SOURCES` and `hitRiderEntries(attacker, target)`, and its own entries
  are now limited to the self / host scopes.

### Engine edits to existing steps

- `grant`: `removeTraits`, and `unlinked` (no `grantedBy` - the copy outlives the granting item: Poison Prodigy).
- `pickGrant`: `optional` (a cancelled pick skips only that grant: Primary Tech's "can choose" upgrades).
- `disarm`: `payFree` (a Free action per hand, paid as it's used).
- `fitUpgrade` (`pick-and-loop-steps.mjs`): `onto: granted`, `uuid` with `{var.x}`, and `until`
  (endOfTurn / endOfNextTurn / scene / untilUsed / rounds:N, mapped to `attachTemporaryUpgrade`'s kinds). Plus a validator.
- `BrawnRequirement`: `carryingOnly`.
- `DamageReduction`: `minDamage`, `counter {path, max}`, `quiet`.
- New `mechanics/resources/game-lines.mjs#lineOf(uuid)`, moved out of `grants.mjs`, which imports it.

## Engine features added 2026-10-07 (round 16, part a)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 16 (part a)" block.

### Flat d20 boxes

- **Rule type `FlatD20`** (`rolls/flat-d20.mjs`) - "treat a d20 result as N without rolling it", as Roll Options Dialog
  boxes decided after the dialog, once the Edge / Snag is settled. dice.mjs builds the d20 operand from
  `ruleFlatD20(actor, options, roll)` (`_getd20Operand`'s flatD20Value / flatBothD20s).
  - A box: `{key, label, value, priority?, limit?, cost?: {resource, amount}, costLabel?, lateWhen?, both?: {label, uses? |
    cost?}}`. Offered while `when` holds, a use is left and the cost can be paid. `both` is a second box: with an Edge or a
    Snag (not both), both d20s count as the value, using `uses` of the limit or paying `cost` more.
  - A change from another item: `{of: <key>, addUses?, lateWhen?, upgrade?: {label, value, cost?, limit?}}`. `addUses`
    widens the limit; its `lateWhen` must hold too (a Hang-Up's "only with an Edge"); `upgrade` is one more box (its value
    instead, for `cost` more, while its own limit lasts).
  - `lateWhen` is asked after the dialog (`roll:edge`, `roll:snag`). A box that can't apply then, or can't be paid in full,
    does nothing and costs nothing, and the next ticked box (by `priority`) is tried. Cost and uses are spent only when a
    box applies. Never on an Initiative roll. Labels may be E20. keys; a cost adds "(N <costLabel>)", "+N" on the extra
    boxes.
  - Dependable, its Hang-Up, Old Reliable, Legendary Dependability.

### Dialog switches

- **DialogSwitch `action` (+ `actionKind`), `baseDamageMultiply`, `backfireOn`** (`dialog/switch-action-cost.mjs`). dice.mjs
  calls `applySwitchActions` where the old Surging / Analyze Target checkboxes spent their actions.
  - `action: free | move | standard`: ticked, the action is spent as the roll is made; when the action economy refuses
    it, the roll is cancelled. `actionKind` names it for the cost changers (`analyzeTarget` - Quick / Swift Study).
  - `baseDamageMultiply: N`: the attack's own damage value (not its damage bonus) is multiplied.
  - `backfireOn: N`: when any d20 of the roll shows N, the roller takes the roll's damage (dice.mjs, with the
    E20.SurgingBackfire line).
  - Analyze Target, Surging.

### Roll facts and hit Triggers

- **RollModifier `key`** (`rolls/once-per-roll.mjs`): whenever the modifier is listed on a roll (even switched off in the
  dialog, as the old "this bonus was on the roll" check read it), the roll carries the key, so hit / miss / afterRoll
  Triggers can ask `roll:switch:<key>`. adapter#ruleRollSources puts it on the source; dice.mjs merges the listed sources'
  keys into the roll's ruleKeys. Growl's ↑, read by Get The Horns.
- **RollModifier `consumeOwn`** (with `consumeMark`): the roll uses up only the copy of a perSetter mark that the
  modifier's holder set (consumer `rulesMarkOwn`, spent before the roll like the other rule marks).
- **Trigger `oncePerRoll: true`** (hit only): the Trigger runs for the first hit of a roll that meets its `when` and limit,
  not for every target hit. `fireTriggers` takes a `once` set; triggers.mjs's hit loop hands one in per roll.
- **hit / miss Triggers get `@var.row`**: the target's row on the card, 0 for the first (`var:row=0` - "the first row").
- **Trigger steps see the roll's rows** (`ctx.facts`), and afterRoll facts carry the check `entries`.
- **Step `targetRowsBeating {defense, required?}`** (`combat/rows-beating.mjs`): in an afterRoll Trigger, the run's targets
  become the creatures rolled against whose plain `defense` (getDefenseValue) the total also meets. A miss on a creature
  whose misses have no effect (MissImmunity) is left out. With none left, the run stops. Explosive Aftershock.

### Timed size changes

- **Step `sizeChange {key, steps? | set?, until? | rounds?, to?}`** (`effects/timed-size.mjs`): the stored size is written
  (the token follows it) and the size before is kept at `flags.essence20.ruleSizeChanges.<key>`.
  - One change per key: while one is live the step leaves it alone; one that ran out is put back first.
  - `until` takes any rule duration. `rounds: N` counts combat rounds (to the same point in the turn order) and ends with
    the combat; out of combat it lasts the encounter.
  - The active GM puts expired changes back when a combat's turn or round changes, when a combat ends and when a new scene
    starts (every world actor and every scene's unlinked token actors).
  - **Tags `self:sizeChanged:<key>` / `target:sizeChanged:<key>`**: the change is live (read-time, so rules stop at once).
  - Scarefying Appearance (`rounds: 10`), Massive Mug of Mammoth Measurements / Petite Pony's Shrink Drink (`set`, shared
    key, `until: scene`).
- **Tag `rule:choiceHas:<key>:<value>`** (`tags/rule-choice-has.mjs`): the rule item's pick under `key` (a list from
  pickMany / pickEach, or one value) holds the value. Scarefying Appearance's benefits.

### Defenses and resistance

- **Defense `{mode: noArmor, outgoing: true, scope: markedTarget, mark}`** (`combat/marked-no-armor.mjs`): on the setter's
  item. An attack on a creature carrying the setter's mark meets its Defense without armor. `when` is asked with self =
  the attacker, holder = the setter, target = the marked creature (`self:sameSideAsHolder` - "you and your teammates").
  dice.mjs asks `ruleMarkedNoArmor` where Exploit Weakness's recompute was. no-armor-defense.mjs leaves markedTarget rules
  out of the attacker's own reading.
- **Tag `card:flag:<key>`** (a CardOffer's card carries that flag) and **recipient `cardTarget`** (in a CardOffer's steps,
  the card's `flags.essence20.targetUuid`). Exploit Weakness.
- **Rule type `AttackResistance {damageTypes}`** (`combat/attack-resistance.mjs`): counts as Resistance for the attacker's
  Resistance Snag only (and `roll:dataset:targetResists`), not as a `system.resistances` entry. Dispersion, with
  `rule:data:system.active`.

### Rerolls, counters, actions

- **Steps `bankReroll {to?, upTo? | values?}` and `rerollLimit {reset?, max?, spend?}`** (`rolls/reroll-bank.mjs`):
  - `bankReroll` writes the banked reroll charge dice.mjs reads (`flags.essence20.bankedReroll`: the next attack rerolls
    those Skill dice faces; used up when an attack succeeds).
  - `rerollLimit` checks, or with `spend` counts, the rule item's own reroll grant's use count (`item:<the item's uuid>`
    in mechanics/rolls/reroll.mjs). So a Use and the item's reactive reroll button share "once per scene".
  - Power Infusion.
- **Step `keyedCount {flag, to?}`** (`resources/keyed-count.mjs`): one more on `flags.essence20.<flag>.<recipient uuid,
  dots as dashes>` on the actor, the counter `@targetKeyed` / `target:keyedOnMe:` read. Analyze Target.
- **`spendActions {atomic: true}`** (edit to `combat/spend-actions-and-turn-queue.mjs`): all or nothing - the actions
  already spent are refunded when one is blocked. Get A Grip.
- **`pick from: skills` `essences: [..]`** (edit to `tags/actor-state-tags.mjs#skillsFor`): Skills of any of those
  Essences. Angry.

### Combat end, Megaforms

- **combatEnd Triggers get `@var.combatId`**, **markText `$var.<key>`** (edit to `marks/mark-value.mjs`) and **text
  `{combat.id}`** (`shared/combat-id-text.mjs`): a mark that keeps the combat it was set in, settled when that combat
  ends (`self:markText:<key>=$var.combatId`). Hard Corps.
- **Megaform contributions** (`zords/megaform-contributions.mjs`), read by documents/actor.mjs and dice.mjs:
  - `MegaformArmor {toughness?, evasion?, form?: megazord | combiner, replacesTrait?}`: a participant adds to the ARMOR
    part of its Megaform's Defenses. `replacesTrait` stops a Megaform Trait's own type from adding anything by itself.
    Formulas read the rule's item. Hardened Chassis, Armored Defense.
  - `MegaformHold {}`: a Combiner form doesn't fall apart while the holder has Health. Keep IT Together!.
  - `MegaformSpecializations {}`: the holder's Specializations merge into the Combiner form's Skills. Better As One.
  - `EnergonDonor {}`: the holder pays the dialog's Energon ↑1 when the form has none (`energonDonor` /
    `payEnergonDonor`). Better As One.

## Engine features added 2026-10-07 (round 16, b)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 16 (part b)" block. Strings are under
`E20.RulesExtLeftB16.*`.

### Durations (`plugins/effects/combat-round-durations.mjs`)

- **`until: "combatRound"`** - while the combat the effect started in is the current one and its round is the same. Set
  out of combat, it never counts. Ground Suppression's -5 ("until the start of your next turn", read at round
  granularity).
- **`until: "combatThroughNextRound"`** - the same combat, through the round after the one it started in. Tech Specs.

### Banks, borrowed Specializations, Conditions (`plugins/resources/bank-keys-and-borrowing.mjs`)

- **Pick source `allySpecializations`** - every Skill Specialization an ally on the scene holds (the system's ally count,
  any range): value the Skill, label "<Specialization> (<Skill>) - <ally>". **`perAlly: true`** - one option per ally
  (allies of the same name count as one), value every Skill they're Specialized in joined by "|". Data Bridge, Think Tank.
- **Tags** `self:allySpecializations`; `skill:in:<a|b>` (the rolled Skill is one of them - `skill:in:{var.picked}` in a
  bank's appliesWhen); `self:bankKey:<key>` / `target:bankKey:<key>` (a live bank under that `key`);
  `self:sideBankKey:<key>` and `self:sideStatus:<a|b>` (the actor - with a token - or an ally on the scene).
- **`hasBankKey(actor, key)` / `bankKeySideCount(actor, key)`** for hand-written readers: dice.mjs's DataBridgeBonus
  (Tactical Triangulation) now asks for `key: dataBridge`.
- **Step `moveCondition {conditions, from?, to?, toFilter?, title?, fromLabel?, toLabel?}`** - one dialog: which
  (creature, Condition) pair among `from` (default the actor with a token and its allies) loses its Condition, and which
  of `to` (narrowed by `toFilter`, asked as the target) gains it. Nothing to choose, a cancel or the same creature twice
  stops the run. Misery Loves Company: `toFilter: ["target:bankKey:dataBridge"]`.

### Defenses and targets (`plugins/combat/defense-facts.mjs`)

- **Step `defenseFacts {of?}`** - the first target's (or the actor's) Defenses as an attack meets them
  (combat.mjs#getDefenseValue): `{var.highestDefense}` (ties to the first in Toughness, Evasion, Willpower, Cleverness),
  `{var.defenseValues}` ("Toughness 12, ..."), `{var.hangUpNames}` (or "none known"). No target: stops.
- **`rollVsEach` `defense` fills `{var.x}` / `{choice.x}`** (rules/steps.mjs) - `defense: "{var.highestDefense}"`.
- **Tag `target:amongUserTargets:<formula>`** - the other party is one of the first N of this user's targets. Danger
  Close: `filter: ["not:target:amongUserTargets:@actor.system.essences.smarts.value * @owned.<Danger Close id>"]`.

### Marks (`plugins/marks/counted-marks.mjs`, `plugins/rolls/marked-row-outcome.mjs`)

- **RollModifier `consumeCount: true`** (with `consumeMark`) - the roll takes ONE off the mark's count; the mark goes when
  it runs out. The consume (`rulesMarkOne`) is spent at roll time with the other rule consumes (dice.mjs,
  target-riders.mjs). Eye For Appraisal's "next 2d2 ranged attacks".
- **`inMarkedArea(attacker, target, token, key)`** - the mark keeps a point (`mark {text: "{var.pointX},{var.pointY},
  {var.pointScene}"}`) and the attacker stands in the 20 x 20 ft square around it. `check:inAppraisedArea` reads it.
- **`pickPoint {optional: true}`** - no point picked, the run goes on (empty point vars).
- **Rule type `MarkedRowOutcome {promote?, consume: promoted | x2}`** (scope `marked` + `mark`) - on the carrier's own rows
  (dice.mjs#_rollSkillHelper, after the Multiplier rules' early stage): `promote` turns a plain success into a Critical
  Success; `consume` uses the carrier's mark up once a row was promoted / reached x2. Powerful Suggestion.

### Picks, items, cards

- **Recipient `companionFlagged:<flag>`**, tags **`self:companionFlagged:<flag>`** and **`item:mentions:<a|b>`** (name or
  `system.prerequisite` contains one, hyphens counting as spaces) - `plugins/picks/flagged-companion-and-mentions.mjs`.
  Rally Guardians Features.
- **`createItem`** (rules/steps.mjs): `unlinked: true` (no grantedBy - it stays when the rule's item goes);
  `knownTraits: true` (system.traits keeps only CONFIG.E20.weaponTraits keys); a name that is an `E20.` key is localized,
  and `nameData: {key: text}` formats it (children too). Additional Attack Type.
- **`choose`**: option labels and the prompt that are `E20.` keys are localized; **`pick`**: an `E20.` prompt is localized
  and **`optional: true`** (nothing to pick or a cancel: the choice stays unmade, the run goes on);
  **`pickGeneralPerk {optional: true}`**. A Hint of Independence.
- **`roll {downshift}`** - ↓ on the roll, a formula (`@target.myMark.dominated`). **Tag `target:exists`**
  (`plugins/tags/target-exists-tag.mjs`). Dominate.
- **Step `placeBeside {to?}`** (`plugins/combat/place-beside.mjs`) - the recipients' tokens go just right of the actor's.
  **`contest`**: `best: true` on a side rolls its best listed Skill (a tie to the first listed); `tieWins: true` gives a tie
  to this actor. Try Me.

### Turn-start schedule (`plugins/combat/next-round-schedule.mjs`)

- **Step `scheduleNextRound {steps, replace?}`** - the steps run at the first turn start a round later at or past this
  point in the turn order (or any turn of the round after), in the combat the run happened in; never when set out of
  combat. `replace` - one per item. `{var.actorUuid}` when they run. `runScheduledNextRound(combat)` is called from
  documents/combat.mjs#_onStartTurn (the active GM). Self-Destruct.

### Hits, Powers, minions (`plugins/combat/incoming-hits-and-minions.mjs`)

- **HitRider `scope: "incoming"`** - acts on hits landing on its holder (self: = the one who hit, holder: = the holder).
- **Tags `self:minion` / `target:minion`** - not a Player Character and tagged minion / minions / foot soldier /
  footsoldier / foot-soldier / mook / grunt, or a Putty or Tenga.
- **Step `activatePower`** - the rule's own Power activated the sheet's way (power-handler.mjs#powerCost); the run then
  stops quietly. Metallic Armor Power Up's Use (switch on, or end).

### Kits (`plugins/resources/kit-options.mjs`, read by mechanics/resources/kits.mjs)

- **`KitOption {label, cost?, steps}`** - another choice in the kit's own Use list, first, while `when` holds; the action is
  paid, the steps run, their chat lines are the kit's message. WTNV Medicine Kit's heal.
- **`KitSkill {skill, spec?}`** - the kit's Skill / Specialization where its name doesn't say (kitInfo).

### Bonded partners (`plugins/combat/bond-partner-guard.mjs`)

- **RollModifier `scope: "bondPartnerIncoming"`** - on the bond holder's item: rolls against its bonded partner by anyone
  but the holder.
- **Defense `mode: "holderBest"`** (scope `bondPartner`) - per attack, the partner meets the better of its own and the
  holder's Defense.
- **Tags `target:inHolderReach`** (5 ft per holder token width), **`self:nearHolder:<ft>`**. Hit Someone Your Own Size!

### Engine edits

- `rules/adapter.mjs#ruleDerived`: a linked always-on Defense rule's `when` now sees its `holder` (In The Right Hands'
  `holder:transformed` on the wearer's sheet).
- `rules/adapter.mjs` consumeMark: `consumeCount` -> `rulesMarkOne`.
