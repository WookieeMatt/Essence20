/**
 * Why one of the zord2 slice's weapons can't attack right now, or null. Called from
 * helpers/target-riders.mjs#weaponUnusable (patched in by the orchestrator - see
 * SCRATCH/integration/zord2-patch.cjs), which documents/item.mjs#roll already consults before any
 * attack. Kept import-light: target-riders.mjs imports this at top level.
 *
 * - A Deflecting Weapon or the Rotary Blade in its shield mode "cannot attack when used as a
 *   shield" (Quartermaster's Guide to Gear p.36; Technorganic Secrets p.48-49). A Deflecting Weapon's
 *   mode is its rules' shieldMode toggle (a copy switched before that keeps the old flag until switched
 *   again); the Rotary Blade's is ./gear-modes.mjs's flag.
 * - A Megaform's Enhanced Melee/Ranged Attack "may only be used once per scene" (PR CRB p.140) -
 *   ./megaform-attacks.mjs.
 */
import { getUses } from "../../scene-clock.mjs";

export function zord2WeaponUnusable(weapon) {
  const flags = weapon?.flags?.essence20 ?? {};
  if (flags.rules?.toggles?.shieldMode ?? flags.zord2ShieldMode) {
    return game.i18n.format('E20.Zord2WeaponInShieldMode', { name: weapon.name });
  }

  const max = flags.zord2PerScene;
  if (max) {
    const key = `zord2Use_${String(flags.zord2Gen ?? weapon.id ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    if (getUses(weapon.parent, key, 'scene') >= max) {
      return game.i18n.format('E20.Zord2UsedThisScene', { name: weapon.name });
    }
  }

  return null;
}
