import { registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { escape, T, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * The bonus-die bank (round 10, group D - docs/rules-batches/slD10.md): the bankDie step, the pre-roll hook that moves a
 * banked die into the More Heads bonus-die slot (and back), and the rule:bankedDie tag.
 */

const DICE_FLAG = 'ruleBonusDice';
const HEADS_FLAG = 'pendingMoreHeads';

export const bankedDice = actor => (Array.isArray(actor?.flags?.essence20?.[DICE_FLAG]) ? actor.flags.essence20[DICE_FLAG] : []);

// bankDie {die, appliesWhen, to}: a bonus die kept for the next roll matching appliesWhen (the More Heads bonus-die
// slot, read before the Roll Options Dialog); any other roll first leaves it banked.
registerStep('bankDie', async (step, ctx) => {
  const die = String(step.die ?? '');
  if (!/^\d*d\d+$/.test(die)) {
    return false;
  }

  for (const actor of recipients(step, ctx)) {
    const entry = { id: globalThis.foundry?.utils?.randomID?.() ?? String(Date.now()), die, when: step.appliesWhen ?? [], source: ctx.item?.id ?? null, label: ctx.item?.name ?? '' };
    await write(actor, 'update', [{ [`flags.essence20.${DICE_FLAG}`]: [...bankedDice(actor), entry] }]);
    ctx.chat.push(escape(T('DieBanked', { name: actor.name, die })));
  }
}, { errors: (step, where) => (/^\d*d\d+$/.test(String(step.die ?? '')) ? [] : [`${where}: bankDie needs a die (1d4, 1d8...)`]) });

/**
 * Before a roll: a banked die whose condition this roll meets moves into the More Heads bonus-die slot (the dice.mjs
 * pendingMoreHeads flag); a die that moved there for an earlier roll that never happened goes back to the bank.
 */
export async function bonusDicePreRoll(actor, dataset, item) {
  const heads = actor?.flags?.essence20?.[HEADS_FLAG];
  const list = bankedDice(actor);
  // A legacy Prospector Toolkit die (pr1ProspectorDie) joins the bank as a Wealth die.
  const legacy = actor?.flags?.essence20?.pr1ProspectorDie;
  const all = legacy ? [...list, { id: 'legacy', die: legacy, when: ['skill:wealth'], source: null, label: '' }] : list;
  const match = all.find(entry => evaluate(entry.when, contextFor({ self: actor, item, rolledSkill: dataset?.skill, dataset })) === true);
  if (!match) {
    if (heads?.ruleBonusDie) {
      await actor.update({
        [`flags.essence20.${DICE_FLAG}`]: [...list, heads.ruleBonusDie],
        [`flags.essence20.${HEADS_FLAG}`]: heads.rulePrevious ?? null,
      });
    }

    return;
  }

  if (heads?.ruleBonusDie) {
    return;
  }

  const update = {
    [`flags.essence20.${DICE_FLAG}`]: list.filter(entry => entry.id != match.id),
    [`flags.essence20.${HEADS_FLAG}`]: {
      bonusDie: heads?.bonusDie ? `${heads.bonusDie} + ${match.die}` : match.die,
      combatId: globalThis.game?.combat?.id ?? null, round: globalThis.game?.combat?.round ?? null,
      ruleBonusDie: { ...match, id: match.id == 'legacy' ? 'legacy-moved' : match.id }, rulePrevious: heads ?? null,
    },
  };
  if (legacy) {
    update['flags.essence20.-=pr1ProspectorDie'] = null;
  }

  await actor.update(update);
}

registerPreRoll(bonusDicePreRoll);

// rule:bankedDie - a die this rule's item banked is still waiting (or moved into the bonus-die slot for a roll).
registerTag('rule:bankedDie', (rest, ctx) => {
  const actor = ctx.self;
  const id = ctx.ruleItem?.id;
  return bankedDice(actor).some(entry => entry.source == id) || actor?.flags?.essence20?.[HEADS_FLAG]?.ruleBonusDie?.source == id
    || !!actor?.flags?.essence20?.pr1ProspectorDie;
}, { phrase: ['a die this item banked is still waiting', 'no die this item banked is waiting'] });
