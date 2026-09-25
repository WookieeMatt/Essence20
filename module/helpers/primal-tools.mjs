import { setEntryAndAddItem } from "../sheet-handlers/attachment-handler.mjs";

/**
 * Primal Tools (Decepticon Directive, Shredder Focus, 1st level, p.58): "Your unarmed combat
 * attack inflicts either Stun 1 or 1 Sharp damage. Additionally, it gains the alternate effect:
 * Multiple (2) Targets (↓1)."
 *
 * Structurally identical to the GI Joe CRB's own base "Unarmed Combat" attack, which already
 * ships as a Stun-only base weaponEffect ("Unarmed Combat Effect") plus a second weaponEffect
 * offering an alternate damage type ("Unarmed Combat Alternate Effect 1" - Blunt, documents/
 * item.mjs's own Beastly comment) - the player picks which one to roll for a given attack. Primal
 * Tools grants that exact SAME two-effect shape as its own fresh, integrated weapon (there is no
 * base compendium item combining Stun/Sharp with Multiple(2), so this builds one from scratch, the
 * same "create fresh items, nothing existed to grant" idiom helpers/unique-strike.mjs's own
 * grantUniqueStrike already establishes) rather than mutating the actor's real Unarmed Combat item
 * (which may not even be on the sheet yet, and is a shared GI Joe CRB compendium item other Perks
 * like Beastly key off directly by id).
 *
 * "Multiple (2) Targets (↓1)" is unique-strike.mjs's own applyAlternateEffect('multipleAttacks')
 * shape (numTargets: 2, shiftDown: 1) - baked into both granted effects unconditionally, since
 * RAW applies it to the attack as a whole, not as a separate optional alternate effect on top of
 * the Stun/Sharp choice.
 */
export const PRIMAL_TOOLS_ID = "Compendium.essence20.decepticon_directive.Item.xfi9WkEAJXYs86Bd";

const PRIMAL_TOOLS_FLAG = 'isPrimalTools';

/**
 * Grants Primal Tools - an integrated unarmed weapon carrying two weaponEffects (Stun 1 / Sharp
 * 1), both with the Multiple (2) Targets (↓1) alternate effect baked in. A no-op if the actor
 * already has one (matching grantIntegratedItem's own idempotency elsewhere in this project).
 * @param {Actor} actor
 */
export async function grantPrimalTools(actor) {
  const alreadyGranted = actor.items.some(item => item.type == 'weapon' && item.flags?.essence20?.[PRIMAL_TOOLS_FLAG]);
  if (alreadyGranted) {
    return;
  }

  const weaponItem = await Item.create({
    name: 'Primal Tools',
    type: 'weapon',
    img: 'systems/essence20/assets/icons/weapons/punch.svg',
    system: {
      classification: { size: 'integrated' },
      equipped: true,
      items: {},
      requirements: { custom: '', skill: null, shift: null },
      traits: [],
    },
    flags: { essence20: { [PRIMAL_TOOLS_FLAG]: true } },
  }, { parent: actor });

  const baseEffectSystem = {
    classification: { skill: 'might', style: 'melee' },
    damageValue: 1,
    numHands: 0,
    numTargets: 2,
    radius: 0,
    range: { min: null, reachMultiplier: 1, long: null, value: null },
    shiftDown: 1,
  };

  for (const [name, damageType] of [['Primal Tools (Stun)', 'stun'], ['Primal Tools (Sharp)', 'sharp']]) {
    const weaponEffectItem = await Item.create({
      name,
      type: 'weaponEffect',
      img: 'systems/essence20/assets/icons/items/weapon_effect.svg',
      system: { ...baseEffectSystem, damageType },
      flags: { essence20: { [PRIMAL_TOOLS_FLAG]: true } },
    }, { parent: actor });

    const key = await setEntryAndAddItem(weaponEffectItem, weaponItem);
    await weaponEffectItem.setFlag('essence20', 'collectionId', key);
    await weaponEffectItem.setFlag('essence20', 'parentId', weaponItem._id);
  }
}
