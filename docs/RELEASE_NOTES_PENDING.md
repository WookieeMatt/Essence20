# Pending release notes

Player- and GM-facing changes waiting for the next release. Copy these into the GitHub release
description when tagging, then clear this file.

## Action needed by GMs

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
