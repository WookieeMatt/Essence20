import { registerRef } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { crewing } from "../shared/zord-crew-lookups.mjs";

/**
 * Round 15 (dice part): numbers and comparisons dice.mjs's hand-written Perks read off a Role Points item or the Skills.
 *
 *   @sneakAttack                    the actor's Sneak Attack damage (mechanics/combat/sneak-attack.mjs#getSneakAttackDamage;
 *                                   0 without Sneak Attack Damage Role Points - Sabotage)
 *   @hardenedArmor                  its Hardened Armor bonus (items/defenses/splinter-defense.mjs#getHardenedArmorBonus -
 *                                   Splinter Defense)
 *   @volleyShots                    its Volley Shots (items/attacks/volley.mjs#getVolleyShots - Penetrating Shot)
 *   @vehicle.size / @vehicle.<path>  the vehicle / Zord the actor crews (any seat): its size place (small 0 ... titanic 10)
 *                                   or a stored number; 0 when not crewing (Rolling Thunder)
 *   self:uuidIsVar:<key>            the run's @var.<key> is this actor's uuid (Misled - rollSeen's @var.assistedBy)
 *   roll:skillNoBetterThan:<skill>  the rolled Skill's die is no better than this actor's <skill> die (both sheet dice;
 *                                   E20.skillShiftList order - Different Perspective's Culture)
 *
 * The helpers are loaded at `setup` (tests fill `diceRefHelpers`); until then the refs are 0.
 */

export const diceRefHelpers = {
  getSneakAttackDamage: null,
  getHardenedArmorBonus: null,
  getVolleyShots: null,
};

globalThis.Hooks?.once?.('setup', async () => {
  try {
    const [sneak, splinter, volley] = await Promise.all([
      import("../../../mechanics/combat/sneak-attack.mjs"),
      import("../../../items/defenses/splinter-defense.mjs"),
      import("../../../items/attacks/volley.mjs"),
    ]);
    diceRefHelpers.getSneakAttackDamage = sneak.getSneakAttackDamage;
    diceRefHelpers.getHardenedArmorBonus = splinter.getHardenedArmorBonus;
    diceRefHelpers.getVolleyShots = volley.getVolleyShots;
  } catch (error) {
    console.error('Essence20 | round 15 dice refs failed to load', error);
  }
});

const number = (fn, actor) => (fn && actor ? Number(fn(actor)) || 0 : 0);
registerRef('sneakAttack', (key, scope) => number(diceRefHelpers.getSneakAttackDamage, scope.actor));
registerRef('hardenedArmor', (key, scope) => number(diceRefHelpers.getHardenedArmorBonus, scope.actor));
registerRef('volleyShots', (key, scope) => number(diceRefHelpers.getVolleyShots, scope.actor));

const SIZE_ORDER = ['small', 'common', 'large', 'long', 'huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'];
registerRef('vehicle', (key, scope, parts) => {
  const vehicle = scope.actor ? crewing(scope.actor)?.vehicle ?? null : null;
  if (!vehicle) {
    return 0;
  }

  if (key == 'size') {
    return Math.max(0, SIZE_ORDER.indexOf(vehicle.system?.size ?? 'common'));
  }

  return Number((parts ?? []).reduce((at, part) => (at === null || at === undefined ? at : at[part]), vehicle)) || 0;
});

const SHIFTS = () => globalThis.CONFIG?.E20?.skillShiftList ?? ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'];

registerTag('roll:skillNoBetterThan', (rest, ctx) => {
  const skills = ctx.self?.system?.skills;
  if (!ctx.rolledSkill || !skills) {
    return null;
  }

  const list = SHIFTS();
  const other = list.indexOf(skills[rest]?.shift);
  const rolled = list.indexOf(skills[ctx.rolledSkill]?.shift);
  return other != -1 && rolled != -1 && other <= rolled;
}, { phrase: (arg, w) => [`your ${w.skillName(arg)} is no better than the rolled Skill`, `your ${w.skillName(arg)} is better than the rolled Skill`] });

// self:uuidIsVar:<key> - the run's @var.<key> is this actor's uuid (rollSeen's @var.assistedBy - Misled: "the roll I
// assisted").
registerTag('self:uuidIsVar', (rest, ctx) => !!ctx.self?.uuid && String(ctx.vars?.[rest] ?? '') == ctx.self.uuid, { phrase: ['{who} {is} the one stored as {arg}', '{who} {isnt} the one stored as {arg}'] });
