import { recipients, registerStep } from "../../steps.mjs";
import { escape, listOf, T, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Lent Alterations (round 10, group D) - steps over the other1 slice's lending ledger
 * (mechanics/characters/alteration-adjustments.mjs: a lend adjusts Essences, Skills and Movement in derived data and runs
 * out by itself).
 *
 *  - `pickAlteration {var, from: own | compendium, tier?, keep?, prompt?}` - choose an Alteration: one of the actor's
 *    own (kept as its id), or a compendium one of `tier` (standard, limited, restricted - {var.x} filled), asking the
 *    choices its drop would (which Skill rises, which Essence and Skill pay). `keep: "<flag path on the rule's item>"`
 *    remembers the compendium pick there and reuses it. The pick is kept in @var.<var> for lendAlteration.
 *  - `lendAlteration {from, to, part: benefit | cost | both, expire: lenderTurn | theirNextTurnEnd | scene | minute}` -
 *    the recipient gets that part of the picked Alteration until it runs out.
 */

const EXPIRES = ['lenderTurn', 'theirNextTurnEnd', 'scene', 'minute'];
const PARTS = ['benefit', 'cost', 'both'];

const ledger = () => import("../../../mechanics/characters/alteration-adjustments.mjs");

registerStep('pickAlteration', async (step, ctx) => {
  const key = step.var || 'alteration';
  const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
  if ((step.from ?? 'own') == 'own') {
    const owned = listOf(ctx.actor?.items).filter(item => item.type == 'alteration');
    const id = await chooseSelect(ctx.item?.name ?? '', escape(step.prompt ?? T('PickAlteration')), owned.map(item => ({ value: item.id, label: item.name })));
    const alteration = owned.find(item => item.id == id);
    if (!alteration) {
      return false;
    }

    ctx.vars[key] = JSON.stringify({ own: alteration.id, name: alteration.name });
    return;
  }

  const alt = await ledger();
  const keepPath = step.keep ? String(step.keep) : null;
  let uuid = keepPath ? keepPath.split('.').reduce((at, part) => at?.[part], ctx.item) : null;
  if (!uuid) {
    const tier = String(step.tier ?? 'standard').replace(/\{var\.([\w-]+)\}/g, (m, name) => String(ctx.vars?.[name] ?? ''));
    // A number names the tier: 1 standard, 2 limited, 3 restricted.
    const tierName = ['standard', 'limited', 'restricted'][Number(tier) - 1] ?? tier;
    uuid = await alt.pickCompendiumAlteration(ctx.item?.name ?? '', [tierName]);
    if (!uuid) {
      return false;
    }

    if (keepPath && ctx.item) {
      await write(ctx.item, 'update', [{ [keepPath]: uuid }]);
    }
  }

  const picked = await alt.shapeFromCompendium(uuid);
  if (!picked) {
    return false;
  }

  ctx.vars[key] = JSON.stringify({ name: picked.source.name, shape: picked.shape });
}, {
  errors: (step, where) => [
    ...(step.from && !['own', 'compendium'].includes(step.from) ? [`${where}: from must be own or compendium`] : []),
    ...(step.var && !/^[\w-]+$/.test(step.var) ? [`${where}: var must be a plain name`] : []),
  ],
});

registerStep('lendAlteration', async (step, ctx) => {
  let picked = null;
  try {
    picked = JSON.parse(String(ctx.vars?.[step.from || 'alteration'] ?? ''));
  } catch (error) {
    picked = null;
  }

  if (!picked) {
    return false;
  }

  const alt = await ledger();
  const part = step.part ?? 'both';
  let shape = picked.shape ?? null;
  let alteration = null;
  if (picked.own) {
    alteration = ctx.actor?.items?.get?.(picked.own) ?? listOf(ctx.actor?.items).find(item => item.id == picked.own) ?? null;
    if (!alteration) {
      return false;
    }

    const benefit = alt.benefitOf(alteration);
    const cost = alt.costOf(alteration);
    shape = part == 'benefit' ? benefit : part == 'cost' ? cost : {
      essences: { ...benefit.essences }, skills: { ...benefit.skills }, movement: { ...benefit.movement },
    };
    if (part == 'both') {
      for (const kind of ['essences', 'skills', 'movement']) {
        for (const [name, value] of Object.entries(cost[kind] ?? {})) {
          shape[kind][name] = (shape[kind][name] ?? 0) + value;
        }
      }
    }
  }

  const expire = {
    lenderTurn: () => alt.untilLenderTurn(ctx.actor), theirNextTurnEnd: () => alt.untilTheirNextTurnEnds(),
    scene: () => ({ kind: 'scene', ...alt.sceneStamp() }), minute: () => alt.forAMinute(),
  }[step.expire ?? 'lenderTurn']();
  for (const actor of recipients(step, ctx)) {
    await alt.addLend(actor, { label: `${ctx.item?.name ?? ''}: ${picked.name}`, ...shape, expire });
    const text = alteration && part != 'both' ? alt.describeText(alteration, part) : '';
    ctx.chat.push(`${escape(T(part == 'cost' ? 'AlterationForced' : 'AlterationLent', { name: ctx.actor?.name ?? '', target: actor.name, alteration: picked.name }))}${text ? ` ${escape(text)}` : ''}`);
  }
}, {
  errors: (step, where) => [
    ...(step.part && !PARTS.includes(step.part) ? [`${where}: part must be ${PARTS.join(', ')}`] : []),
    ...(step.expire && !EXPIRES.includes(step.expire) ? [`${where}: expire must be ${EXPIRES.join(', ')}`] : []),
  ],
});
