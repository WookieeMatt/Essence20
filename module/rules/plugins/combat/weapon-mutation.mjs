// Round 15 (items1): steps mutateWeapon and grantAttacks - weapons changed for a while. Explosive Ammo, Firestorm, Utility
// Loaders, Backblast, Airburst, Knuckle Up.
import { registerUntil } from "../../expiry.mjs";
import { interpolate } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";

/**
 * Duration `untilUsed` - it never runs out by itself: what carries it goes when it is used. fitUpgrade {until: untilUsed} -
 * the upgrade goes after its weapon's next attack (items/attacks/weapon-perk-uses.mjs#spendUntilUsed - Traps and Obstacles'
 * Proximity Bomb).
 */
registerUntil('untilUsed', { stamp: () => ({}), expired: () => false });

/**
 * `mutateWeapon {onto: "choice:<key>", set?: {key: value}, toggle?: <key>}` - change the owned weapon a pick stored: its
 * mutation (`flags.essence20.mutation`, merged into what it holds), which items/attacks/weapon-upgrades.mjs#applyToEffect
 * folds into the weapon's attacks and items/attacks/weapon-perk-uses.mjs#resolveWeaponChangesAfterAttack spends after an
 * attack. The keys it reads:
 *   blastSet N (a ranged attack with no blast gets one of N ft), blastAdd N (a blast grows N ft), tripleNext (the next
 *   attack's blast x3, then off), airburstNext (+10 ft, Prone / Impaired riders on the next attack, then off), backblast
 *   (half range; 1 Fire damage to everyone within 5 ft - the attacker on a Fumble), damageType <type>, addTraits [...],
 *   stunInstead (Stun equal to the damage), untilFumble (a Fumble with the weapon ends the whole mutation).
 * `set` values: true / false / numbers as they are; text fills {choice.x} / {var.x} (a text that is only one placeholder
 * takes its value as it is, null when unset); a list keeps its filled, non-empty entries. `toggle` flips that key.
 * No such weapon: a chat line, the run stops.
 */
function fill(value, ctx) {
  if (Array.isArray(value)) {
    return value.map(entry => fill(entry, ctx)).filter(entry => entry !== null && entry !== undefined && entry !== '');
  }

  if (typeof value != 'string') {
    return value;
  }

  const whole = /^\{(var|choice)\.([\w-]+)\}$/.exec(value);
  if (whole) {
    const found = whole[1] == 'var' ? ctx.vars?.[whole[2]] : ctx.item?.flags?.essence20?.rules?.choices?.[whole[2]];
    return found === undefined || found === '' ? null : found;
  }

  return (interpolate(value, ctx.item) ?? value).replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
}

const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

function pickedWeapon(step, ctx) {
  const key = /^choice:([\w-]+)$/.exec(String(step.onto ?? ''))?.[1];
  const id = key ? ctx.item?.flags?.essence20?.rules?.choices?.[key] : null;
  return id ? listOf(ctx.actor?.items).find(item => item.id == id || item.uuid == id) ?? null : null;
}

async function write(doc, update) {
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  return needsGmRelay(doc) ? relayToGm(doc, 'update', [update]) : doc.update(update);
}

registerStep('mutateWeapon', async (step, ctx) => {
  const weapon = pickedWeapon(step, ctx);
  if (!weapon) {
    ctx.chat.push(globalThis.game?.i18n?.format?.('E20.Rules.Step.NoSuchItem', { name: ctx.actor?.name ?? '' }) ?? 'NoSuchItem');
    return false;
  }

  const current = weapon.flags?.essence20?.mutation ?? {};
  const changes = Object.fromEntries(Object.entries(step.set ?? {}).map(([key, value]) => [key, fill(value, ctx)]));
  if (step.toggle) {
    changes[step.toggle] = !current[step.toggle];
  }

  const next = { ...current, ...changes };
  await write(weapon, { 'flags.essence20.mutation': next });
  globalThis.foundry?.utils?.setProperty?.(weapon, 'flags.essence20.mutation', next);
}, {
  errors: (step, where) => [
    ...(/^choice:[\w-]+$/.test(String(step.onto ?? '')) ? [] : [`${where}: mutateWeapon needs onto: choice:<key>`]),
    ...(step.set === undefined && !step.toggle ? [`${where}: mutateWeapon needs set or toggle`] : []),
  ],
});

/**
 * `grantAttacks {uuid, until: endOfTurn | scene}` - the attacks of a compendium weapon (`{var.picked}` after a pickEntry)
 * made on the actor as loose (weaponless, so unarmed) attacks named "<attack> (<this item>)", for a while: the
 * temporary stamp items/attacks/weapon-perk-uses.mjs#sweepTemporary removes at the end of the turn / scene. Knuckle Up.
 */
const UNTIL = { endOfTurn: 'turn', scene: 'scene' };

registerStep('grantAttacks', async (step, ctx) => {
  const uuid = String(step.uuid ?? '').replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
  const weapon = uuid ? await globalThis.fromUuid?.(uuid) : null;
  if (!weapon) {
    return false;
  }

  const { temporaryStamp } = await import("../../../items/attacks/weapon-perk-uses.mjs");
  const made = [];
  for (const entry of Object.values(weapon.system?.items ?? {}).filter(one => one?.type == 'weaponEffect')) {
    const effect = entry.uuid ? await globalThis.fromUuid?.(entry.uuid) : null;
    if (!effect) {
      continue;
    }

    const data = effect.toObject();
    delete data._id;
    data.name = `${effect.name} (${ctx.item?.name ?? ''})`;
    globalThis.foundry.utils.setProperty(data, 'flags.essence20.parentId', null);
    globalThis.foundry.utils.setProperty(data, 'flags.essence20.temporary', temporaryStamp({ kind: UNTIL[step.until] ?? 'turn', source: ctx.item?.name ?? '' }));
    made.push(data);
  }

  if (made.length) {
    await ctx.actor.createEmbeddedDocuments('Item', made);
  }

  ctx.vars.granted = made.length;
}, {
  errors: (step, where) => [
    ...(step.uuid ? [] : [`${where}: grantAttacks needs a uuid`]),
    ...(step.until && !UNTIL[step.until] ? [`${where}: grantAttacks until must be endOfTurn or scene`] : []),
  ],
});
