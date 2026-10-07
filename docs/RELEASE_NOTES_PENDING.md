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

## Other changes

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
