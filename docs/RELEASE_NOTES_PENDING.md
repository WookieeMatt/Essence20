# Pending release notes

Player- and GM-facing changes waiting for the next release. Copy these into the GitHub release
description when tagging, then clear this file.

## Action needed by GMs

- **A world migration runs on first load.** It moves every Perk's old pick onto the new rules
  pick, clears item fields the rules replaced (they stay in the data until 6.1), and repoints copies
  of items that moved to another compendium. When it finishes, the GM gets a chat summary. Any
  Perk listed there as "nothing picked yet" still needs its pick: open the character's **Rules**
  tab and choose it there.
- **Renamed items.** Generic weapons now carry their book names: Close Combat Bludgeon, Close
  Combat Heavy Bludgeon, Short Bludgeon, Thrown Bludgeon and Long Bludgeon (was "...Bludgeoning"),
  and in Power Rangers: Grenade, Martial Arts Long/Medium Blade, Martial Arts Long Bludgeon and Zeo
  Laser Pistols. Power Rangers "Brawling" is now **Unarmed Combat**, and the 1st-printing "Strike"
  is gone. Copies already on characters keep their old names until replaced.
- **Moved items.** The 7 Spectrum Modification Perks now live in A Jump Through Time. The Pre Gen
  weapons (Power Crossbow, Hammer, Spear, Tetsubo) have their own **Power Rangers Pre Gen
  Characters** compendium. Existing copies still find their automation.
- **Equipped armor now counts toward Defenses automatically.** A Player Character's equipped
  Armor items (and armor Upgrades attached to them) now add their Toughness/Evasion bonus to the
  character's Defenses. Previously this bonus was never applied, so some tables typed the armor
  bonus into the Armor field on the character's Defenses by hand. **If you did that, clear the
  hand-typed Armor value** — otherwise the bonus is now counted twice. The system can't tell a
  hand-typed armor workaround from a deliberate manual bonus, so it doesn't clear it for you.
  NPCs, companions, vehicles and Zords are unchanged: their Armor stays a hand-entered value.
- **Power Rangers:** Morphed Toughness works exactly as before — it comes from the Morphed armor
  type set on the character sheet, and worn armor doesn't add to it. The Power Armor items (Mighty
  Morphin, Zeo, Turbo, In Space and Metallic Body Armor, Power Rangers Core Rulebook Table 8-5)
  represent that Morphed suit, so marking one "equipped" never adds a separate armor bonus.

## The rules engine

Item automation is now data on the item, in a **Rules** tab, instead of hard-coded per
compendium item. That means a copy of a book item, or a homebrew item built in the sheet, works
the same as the original.

- **Every item's Rules tab** lists what it does in plain English, with an editor for building
  your own. Active Effects show there too, as "always on" entries.
- **The character sheet's Rules tab** lists every rule affecting that character. Each line can
  open the item it comes from or post the rule to chat.
- **Picks are asked once, when the item is added.** This covers Expertise, Cutie Mark Perk and
  any Perk with a choice: one dialog per character. Long lists get a search box. If you cancel a
  pick on an item you dropped, the item isn't added. A pick that comes with a Role must be made.
  You can change a pick later from the Rules tab.
- **Level-ups ask for your General Perk and Grid Power picks** at the levels your
  Role's own table gives them. General Perks come from every enabled book. Sub-Perks show under
  their parent Perk.
- **Prerequisites** are checked when an item is added. A world setting chooses Off, Warn
  (default) or Strict. Strict asks the GM to confirm a drop that doesn't qualify. Warn and Strict
  both tell the GM when a character takes something they don't qualify for. Items a Role grants
  are never blocked.
- **Weapons the book prints with two Skills** ("Finesse or Might", "Athletics or Targeting" and
  so on) roll whichever Skill is better. This includes every line's Unarmed Combat / Unarmed
  Strike, Pillage, Power Fist, Natural Weapons, Psycho Strike and the TF/G.I. JOE melee weapons.
  Power Rangers Martial Arts Long Bludgeon is Might only, as printed.
- **Focus Skill increases.** When a Focus raises an Essence (1st and 10th level), the sheet asks which of the Focus's
  Skills gets the point: train one a step, or take a Specialization in it where the book allows. Levelling back down,
  or deleting the Focus, takes that rank or Specialization back off. Characters made before this keep what they placed
  by hand in the Skill Picker; a + on the Focus row lets them place it, or mark it "Already placed by hand". Deleting
  a Focus any way (sheet, macro or API) takes its Essence and Skill point back off.
- **Weapon Brawn requirements apply.** A weapon you lack the Brawn for gives ↓1 per die short on its attacks, as a
  line in the Roll Options Dialog (G.I. JOE p.117, Transformers p.97, Power Rangers p.81). "Brawn d4/Huge" weapons
  waive it for a big enough character; a Transformer's Integrated Hardpoint lowers it one die; The Heavy, Pack Mule,
  Over Brawn and now Ordnance Expert (↑4 for weapons) all count.
- **Weapon requirements are prerequisites.** The free-text requirements on about 100 weapons (Skill ranks, sizes,
  Origins and Perks, Psycho Ranger or Path weapons) are checked like any other prerequisite when the weapon is added.
- **Power Rangers:** the Grid Relic Weapon asks for its 2 Relic Weapon Traits; five of them are
  automated. The Power Rangers Expertise offers only Skills at d4 or better.

## Megazords and Combiners

- **Who can join which Megaform.** A Megazord takes Zords and, per Field Guide to Action and Adventure p.134, a
  Cybertronian joining them as a plain component (a chat line notes the Story Point and Energon/Personal Power cost,
  and the form is one Size Class above its largest part). A Zord can't join a Transformers Combiner: a Zord and
  Cybertronian mix uses the Megazord rules. Anything that can't count is now refused with the reason, instead of being
  linked and silently ignored.
- **Megazords:**
  - Use every participant's weapons and attacks, rolled with the Megazord's own skill.
  - Are Towering by default; set Titanic on the sheet if that's the size you chose.
  - Take the highest Strength and Speed from their Crew as well as their Zords.
  - Fall apart when more than half the Zords are down, each falling Prone.
  - A Zord at 0 Health stops adding its stats, traits and attacks.
- **Core Body, Layered Systems, Tenacious Bonds and Roller Drum now really add Health.** Damage to the Megaform uses
  that extra Health up first, and a damaged Core Body Zord no longer shows every point lost twice.
- **Join timer:** counts from when each Zord entered the fight (its Call to Action arrival), only rolls for newly added
  Zords, and no longer runs for Transformers Combiners.
- **Megaform immunities** (Grounding's Electromagnetic immunity) protect the whole form. Damage from rules,
  hazards and ongoing effects now reaches a Megaform's participants instead of disappearing.
- **Combiners:**
  - A duo or trio is now one real Size Class up (two Large members make a Huge form, not "Long").
  - Damage to the whole form is split as evenly as the total allows, with leftover points going to random members.
  - Commander raises the Essences that are the holder's own two highest.
  - The Energon pool fills with what was spent to merge.
  - Invigorating Connection heals once per combination.
  - Additional Movement grants its Movement Type.
  - A Movement Type only some members have no longer becomes the form's.
  - A member at 0 Health adds no attacks.
- **Zord armor:** Hardened Chassis, Rescue Upgrade, S.W.A.T. Armor Up, Elemental Stone, Assault Shell and External Tech
  Upgrade now give Armor (plating) to Toughness, so Ignores Armor attacks strip them as the books say.
- **Breaker-Bar's** +1 damage now applies only against Transformers Combiner forms.
- **Changing a Megaform between Megazord and Combiner** is refused while someone in it wouldn't count under the new
  type (a mixed Megazord's Zords, or a Combiner's characters who can't transform), naming who has to leave first. A
  change that goes through clears the old type's timers.
- **Starting Zord Features:** linking a new Zord to a Ranger asks for its team. It then adds the team's Automatic Zord
  Features and the Spectrum-Based one (taken from the Role's colour), from all five books. Mixed teams pick two;
  Advanced Spectrum picks any. A **Features** button on the Zords tab offers it again until it's done.
- **Strength with its Skill Ranks:** Auxiliary Zord, Carrier and Warzord ask where their Skill Ranks go.
- **Warzord** spends its Ranger's Story Points (one per Zord combining with it) when it combines, instead of posting a
  reminder.
- **Zero-G's** ranged ↑1 no longer needs a driver; the book doesn't ask for one.
- **Weapon size is measured against every Mode** (Bot Mode and each Alt Mode), and Combiner movement reads members'
  Bot Modes.
- **Zord growth:** at the Ranger's 5th, 10th, 15th and 20th level each linked Zord gets a choice. The options are +1
  Health, +1 plating, +10 ft movement, pilot ↑1 on Driving or Initiative, and +1 damage to one attack (Core Rulebook
  p.134), or Accurate (1) on one attack, or exchanging a Zord Feature (A Jump Through Time p.83). It's offered on
  level-up, and from a **Growth** button on the Ranger's Zords tab while any is owed. Each choice is a feature on the
  Zord.
- **Recall for Repairs:** the feature's Use button sends the Zord to its lair. It leaves the map and any Megazord, can't
  be called again this scene, and comes back at full Health with no Conditions the next time it's summoned.
- **Summoning a Zord** spends the Ranger's Standard action.
- **Zord and Vehicle Defeat** now triggers from every damage path, so a Zord inside a Megazord goes dormant too.
- **Gaining Combiner** asks which Megaform Trait the Zord contributes and adds it. Detachable and Core Body can't be on
  the same Zord.
- **Increase (Essence)** and every other Zord or Vehicle Essence now stop at 15.
- **Megazord Willpower and Cleverness** use the best of its Crew, and its Smarts and Social show the Crew's best.
- **Combiners (Enigma of Combination):**
  - **Hardpoints:** two External, plus one Integrated per member, shown on the form. A weapon's prerequisites are met
    when any active member meets them at the weapon's normal size.
  - **Upscaled weapons (Table 3-1):** a weapon dropped on a Gigantic or larger actor offers its upscaled version
    (availability, requirement, range, damage, area, Trip, and Titan-Class and Wrecker at Titanic).
  - **Hands by size:** a weapon three or more Size Classes smaller takes 1 hand or Hardpoint, three larger takes 2,
    and four or more larger can't be wielded.
  - **Titan-Class** weapons cost 1 Energon a round to attack with.
  - **Mode Lock** stops merging.
  - **Other Cybertronians:** a PC without a Combiner Perk dropped on a Combiner form joins for the scene for a Story
    Point plus the Energon. Only one at a time, and they leave when the scene ends.
  - **Holding together:** a Defeated Combiner can spend 1 Energon per member to postpone breaking apart for 1d2 turns.
  - **Better as One** lets the holder pay the form's Energon bonus at any time; you're asked who pays.

## Other changes

- **Power Shield** follows the book now:
  - Using it puts the shield on the summoner as +2 armor to Toughness, which counts whether they're Morphed or not.
  - The chat card's **Hand the Power Shield** button passes it to the character you target, or one you pick from the
    scene, and takes it from whoever had it.
  - It lasts until the summoner un-Morphs, wherever it is (no more 10-round timer).
- **Defensive Shields** is automated: taking it asks which teammate (or yourself) gets +1 Morphed Toughness. That
  becomes an effect on their sheet, and removing the Perk takes it back.
- **The "Power Ranger Core Rulebook - Applied Effects" compendium is gone.** Foundry can't show Active Effects in a
  compendium, so it was always empty. Its five effects are all handled by their items now.

- **NPC and Companion Essences have a base.** Each Essence shows current / score, with an always-editable Base
  underneath. The Base is the printed score; effects and rules raise the score on top of it instead of overwriting
  it, and the score itself is locked. The current amount Essence damage spends keeps its damage when the score
  changes. Existing NPCs take their current score as their base automatically. The stat-block importer and Threat
  Builder fill in the base.
- **Vehicles show their Essences** on the Main tab, laid out like a Zord's (score with its Base underneath).
- **Zords, Vehicles and Megaforms take Essence damage, temporarily.** The books don't cover it; the ruling is that
  the damage comes off what is left (current / score) and never lowers the score or the Base. Type the current amount
  to adjust it, and the **Repair** button that appears beside the Essences clears it all.
- **Rules reading `@essence`** now use the Essence score, not what is left after Essence damage
  (`@essence.<x>.current` gives the remainder).
- **Fixed a "Maximum call stack size exceeded" error** when loading a scene with unlinked tokens.
- **New setting: Morphed / Alt Mode token icons.** Options are Show, Hide when the token art
  changes (default), or Never. The status itself always stays, for the Combat Tracker and macros.
- **Guided tours** cover the new Rules tabs, Perk picks and level-up picks.
- **Ram and Flyby** use no hands and no hardpoint.
- **Vehicle crew:** closing the "Swap Driver and Passenger?" dialog now cancels instead of swapping, and a swap updates both seats together.
- **Older copies of Perks that pick sub-Perks** (e.g. a Grid Relic Weapon taken before this release) can now make their
  picks from the Rules tab: they use the compendium's list when their own is empty.
- **Clearer form errors:** refusing a bad Essence Progression, Vehicle role or Essence pick no longer shows an
  "Error:" prefix, and the Essence Progression message says what to fix.
- **Essence Alterations** (Absolute Yield and the other Cobra Codex ones) finish again: after the bonus Skill pick the
  window for the Essence that pays the cost used to vanish, and the Alteration was never added.
- **Transformers:** deleting the Alt Mode a character is currently in returns them to Bot Mode (they used to stay transformed into the deleted mode).
- **Shields with a Brawn requirement** give the same ↓ shortfall as armor.
- **The Specialization item's Details tab** can be edited again (Skill, die, Specialized).
- **Transformers core weapons** now use their own book's effects. They used to pull in the
  G.I. JOE and Power Rangers copies, so Long Bludgeon came with a Power Rangers "Martial Arts"
  attack.

## Changes you'll notice at the table

- **Reload:** a weapon with the Reload trait needs a Move action to reload after it fires before it
  can shoot again.
- **Consumable:** using a Consumable weapon or item reduces its quantity.
- **Stunned, Unconscious, Asleep and Surprised characters have no actions** on their turn (a few
  Perks, such as Security and Unsurprising, are exceptions). The action-economy setting decides
  whether this is only tracked, warned about, or enforced.
- **Situational bonuses and penalties** — including most Hang-Up penalties — appear as per-roll
  checkboxes in the Roll Options Dialog instead of always applying. A Hang-Up penalty that always
  applies is simply on; one that depends on the situation is a checkbox you tick when it does.
- **Frightened** applies its ↓2 by default; untick it in the Roll Options Dialog when the source of
  fear isn't in sight.
- **Timed buffs and Conditions expire on their own** at the end of their scene, encounter or number
  of rounds.
- **Weapons can deal two damage types in one hit** (e.g. Blunt and Stun); Apply Damage applies both.
- **Actions tab:** the display-in-chat button is a chat bubble; dice appear only on items that roll.

## Now working

- **Imperial Machine Mantle** (Adventures in Angel Grove, p.90): while intact, adds extra Toughness
  equal to half the wearer's current armor bonus (rounded up), Morphed or not. It breaks when the
  wearer is hit by a Critical Success; a GM can clear the broken flag on the Item to repair it.

## Rules changes

- **Sorcerous Power points (Finster's Monster-Matic Cookbook, "Building Sorcerous Powers," p.274)
  are now a one-time build budget, not a spendable pool.** Sorcerous Powers used to deduct their
  own point cost from `Sorcerous Power` every time they were activated; the book spends that cost
  only once, when the Power is built (taking the Sorcery Perk, or gaining a new level's points),
  after which the Power can be used as often as its own text allows. A Sorcerous Power no longer
  costs anything to activate. The character sheet's `Sorcerous Power`
  field now shows points **committed** (the total build cost of every Sorcerous Power the
  character owns) against the points **available**, and only turns amber as a warning if committed
  exceeds available — it never blocks activation. Any previously "spent" value stored in that field
  is no longer read by anything and can be ignored; no one is locked out of using their Powers by
  it. Grid (Personal) Powers are unaffected and still spend Personal Power normally.
