/**
 * Group Skill Tests (GI JOE CRB p.125, PR CRB p.90, TF CRB p.105, MLP CRB p.114, WTNV p.16):
 * "everyone in the group attempts the Skill Test ... against the same DIF. If half or more PCs
 * succeed, the group succeeds."
 *
 * - Started from the Party sheet (or game.essence20.groupSkillTest()): a Skill, a DIF, a leader and
 *   who takes part. It posts one card with a Roll button per participant and a Resolve button.
 * - Each participant's result is kept on their own actor (flags.essence20.groupTest), so no one
 *   writes to another player's actor or to the card; the card reads them when it's drawn.
 * - The Perks that change one: GroupTestBonus rules (Caretaker's Edge, Pay It Forward's ↑1, Bowling Team: the
 *   leader's participants ↑1), Community Spirit (an ally's Edge, then your ↑1), Prior Experience (1 Power turns
 *   a failure into a success) and Create Chaos (fail, roll another Skill, Edge for everyone).
 */

import { addGroupTestBonuses } from "../../rules/plugins/rolls/group-test-bonus.mjs";

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const GROUP = {
  communitySpirit: uuid('wtnv_citizens_guide', 'jUROXHqur5Sta05C'),
  priorExperience: uuid('beneath_the_helmet', 'xDoJhX0WmrbFdKhm'),
  createChaos: uuid('cobra_codex', '1Yho7fqBC8IfqHfN'),
};

const RESULT_FLAG = 'groupTest';
const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function has(actor, id) {
  const items = actor?.items;
  const list = Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
  return list.some(item => sourceOf(item) == id);
}

function resolve(id) {
  try {
    return id ? globalThis.fromUuidSync?.(id) ?? null : null;
  } catch (error) {
    return null;
  }
}

/* -------------------------------------------- */
/*  Starting one                                 */
/* -------------------------------------------- */

/**
 * Ask for the test and post its card.
 * @param {Array<Actor>} candidates   Who might take part - the Party's members, or the selected tokens.
 * @returns {Promise<ChatMessage|null>}
 */
export async function startGroupTest(candidates = null) {
  const pool = (candidates ?? canvas?.tokens?.controlled?.map(t => t.actor) ?? []).filter(Boolean);
  if (!pool.length) {
    ui.notifications.warn(T('E20.GroupTestNoOne'));
    return null;
  }

  const skillOptions = Object.entries(CONFIG.E20.skills).map(([key, label]) => `<option value="${key}">${T(label)}</option>`).join('');
  const people = pool.map(a => `<label class="flexrow"><input type="checkbox" name="who" value="${a.uuid}" checked /> ${foundry.utils.escapeHTML(a.name)}</label>`).join('');
  const leaders = pool.map(a => `<option value="${a.uuid}">${foundry.utils.escapeHTML(a.name)}</option>`).join('');
  const answer = await foundry.applications.api.DialogV2.wait({
    window: { title: T('E20.GroupTestTitle') },
    classes: ["window-app", "e20-window"],
    content: `
      <div class="form-group"><label>${T('E20.GroupTestSkill')}</label><select name="skill">${skillOptions}</select></div>
      <div class="form-group"><label>${T('E20.GroupTestDif')}</label><input type="number" name="dif" value="12" min="0" /></div>
      <div class="form-group"><label>${T('E20.GroupTestLeader')}</label><select name="leader">${leaders}</select></div>
      <p>${T('E20.GroupTestWho')}</p>${people}`,
    buttons: [
      { action: 'ok', label: T('E20.DialogConfirmButton'), default: true, callback: (event, button) => ({
        skill: button.form.elements.skill.value, dif: Number(button.form.elements.dif.value) || 0, leader: button.form.elements.leader.value,
        who: [...button.form.querySelectorAll('input[name="who"]:checked')].map(input => input.value),
      }) },
      { action: 'cancel', label: T('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!answer || answer == 'cancel' || !answer.who.length) {
    return null;
  }

  const test = { id: foundry.utils.randomID(), skill: answer.skill, dif: answer.dif, leader: answer.leader, participants: answer.who };
  return ChatMessage.create({
    content: renderCard(test),
    flags: { essence20: { groupTest: test } },
  });
}

/* -------------------------------------------- */
/*  The card                                     */
/* -------------------------------------------- */

function resultOf(actor, test) {
  const record = actor?.flags?.essence20?.[RESULT_FLAG];
  return record?.id == test.id ? record : null;
}

/** Whether a Prior Experience holder turned this participant's failure into a success. */
function rescued(test, uuidOf) {
  return test.participants.some(id => {
    const record = resolve(id)?.flags?.essence20?.priorExperience;
    return record?.id == test.id && record.target == uuidOf;
  });
}

/**
 * Tally the test: who succeeded, and whether the group did.
 * @param {Object} test
 * @returns {{rows: Array<Object>, successes: Number, rolled: Number, done: Boolean, success: Boolean}}
 */
export function tally(test) {
  const rows = test.participants.map(id => {
    const actor = resolve(id);
    const record = resultOf(actor, test);
    const success = !!record && (record.success || rescued(test, id)) && !record.chaos;
    return { id, name: actor?.name ?? '?', rolled: !!record, success, chaos: !!record?.chaos };
  });
  const successes = rows.filter(r => r.success).length;
  const rolled = rows.filter(r => r.rolled).length;
  return { rows, successes, rolled, done: rolled == rows.length, success: successes * 2 >= rows.length };
}

export function renderCard(test) {
  const { rows, done, success, successes } = tally(test);
  const skill = T(CONFIG.E20.skills[test.skill] ?? test.skill);
  const list = rows.map(row => `<li class="e20-group-test-row"><span class="e20-group-test-name">${foundry.utils.escapeHTML(row.name)}</span>${
    row.rolled ? `<span class="e20-group-test-result">${T(row.chaos ? 'E20.GroupTestChaos' : (row.success ? 'E20.GroupTestSucceeded' : 'E20.GroupTestFailed'))}</span>`
      : `<button type="button" class="e20-chat-action-button" data-e20-social="groupRoll" data-actor="${row.id}">${T('E20.GroupTestRoll')}</button>`
  }</li>`).join('');
  const extras = [
    `<button type="button" class="e20-chat-action-button" data-e20-social="groupPerk" data-perk="communitySpirit">${T('E20.CommunitySpirit')}</button>`,
    `<button type="button" class="e20-chat-action-button" data-e20-social="groupPerk" data-perk="createChaos">${T('E20.CreateChaos')}</button>`,
    `<button type="button" class="e20-chat-action-button" data-e20-social="groupPerk" data-perk="priorExperience">${T('E20.PriorExperience')}</button>`,
  ].join('');
  return `<div class="e20-group-test"><h3>${T('E20.GroupTestHeader', { skill, dif: test.dif })}</h3><ul>${list}</ul>
    <p>${done ? T(success ? 'E20.GroupTestGroupSucceeded' : 'E20.GroupTestGroupFailed', { successes, total: rows.length }) : T('E20.GroupTestPending', { successes, total: rows.length })}</p>
    <div class="e20-chat-action-buttons">${extras}</div></div>`;
}

async function refresh(message) {
  const test = message?.flags?.essence20?.groupTest;
  if (!test) {
    return;
  }

  if (message.isOwner) {
    await message.update({ content: renderCard(test) });
  } else {
    globalThis.ui?.chat?.updateMessage?.(message);
  }
}

/* -------------------------------------------- */
/*  Rolling                                      */
/* -------------------------------------------- */

/**
 * The bonuses a participant rolls with.
 * @param {Actor} actor
 * @param {Object} test
 * @returns {{shiftUp: Number, edge: Boolean, labels: Array<String>}}
 */
export function groupBonuses(actor, test) {
  const out = { shiftUp: 0, edge: false, labels: [] };
  // GroupTestBonus rules - the roller's own (Caretaker's Edge, Pay It Forward's ↑1), and the leader's for everyone
  // they lead (Bowling Team's ↑1) - rules/plugins/rolls/group-test-bonus.mjs.
  addGroupTestBonuses(actor, resolve(test.leader), out);

  for (const id of test.participants) {
    const other = resolve(id);
    // Community Spirit (WTNV p.30): "one ally of your choosing gains an Edge on the associated Skill
    // Test. If that character succeeds, you gain ↑1 on your Skill Test."
    const spirit = other?.flags?.essence20?.communitySpirit;
    if (spirit?.id == test.id && spirit.ally == actor.uuid) {
      out.edge = true;
      out.labels.push(T('E20.CommunitySpirit'));
    }

    if (other?.uuid == actor.uuid && spirit?.id == test.id && resultOf(resolve(spirit.ally), test)?.success) {
      out.shiftUp += 1;
      out.labels.push(T('E20.CommunitySpirit'));
    }

    // Create Chaos (Cobra Codex, General Perk): "If your chosen Skill Test beats the DIF ..., all your
    // allies in the scene gain Edge on their Skill Test."
    const chaos = resultOf(other, test);
    if (other?.uuid != actor.uuid && chaos?.chaos && chaos.chaosSuccess) {
      out.edge = true;
      out.labels.push(T('E20.CreateChaos'));
    }
  }

  return out;
}

async function rollFor(actor, test, skill = test.skill) {
  const bonus = groupBonuses(actor, test);
  const essence = CONFIG.E20.skillToEssence?.[skill] ?? 'smarts';
  const result = await actor._dice?.rollSkill({ skill, essence, shiftUp: bonus.shiftUp, shiftDown: 0, dif: String(test.dif), edge: bonus.edge }, actor);
  return result && !result.cancelled ? !!result.success : null;
}

/**
 * The card's buttons.
 * @param {ChatMessage} message
 * @param {HTMLElement} button
 */
export async function onGroupButton(message, button) {
  const test = message?.flags?.essence20?.groupTest;
  if (!test) {
    return;
  }

  if (button.dataset.e20Social == 'groupRoll') {
    const actor = await fromUuid(button.dataset.actor);
    if (!actor?.isOwner) {
      ui.notifications.warn(T('E20.GroupTestNotYours'));
      return;
    }

    // A rule's test (rules/plugins/rolls/group-test-steps.mjs - Guardian Blast) may cost each participant but the
    // leader an action to roll, in combat.
    if (test.cost && game.combat && actor.uuid != test.leader) {
      const { spend } = await import("../actions/action-economy.mjs");
      if ((await spend(actor, test.cost, { source: T('E20.GroupTestTitle') }))?.blocked) {
        return;
      }
    }

    const success = await rollFor(actor, test);
    if (success !== null) {
      await actor.setFlag('essence20', RESULT_FLAG, { id: test.id, success });
    }

    return refresh(message);
  }

  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
  const perk = button.dataset.perk;
  if (!actor?.isOwner || !test.participants.includes(actor.uuid) || !has(actor, GROUP[perk])) {
    ui.notifications.warn(T('E20.GroupTestNeedPerk', { perk: T(`E20.${perk.capitalize()}`) }));
    return;
  }

  const { chooseSelect } = await import("../resources/grants.mjs");
  const others = test.participants.filter(id => id != actor.uuid).map(id => ({ value: id, label: resolve(id)?.name ?? id }));
  if (perk == 'communitySpirit') {
    const ally = await chooseSelect(T('E20.CommunitySpirit'), T('E20.CommunitySpiritPrompt'), others);
    if (ally) {
      await actor.setFlag('essence20', 'communitySpirit', { id: test.id, ally });
    }
  } else if (perk == 'priorExperience') {
    // Prior Experience (Beneath the Helmet, Grid Power, p.57): "By spending 1 Power, you can turn one
    // failure in a Group Skill Test into a success."
    const failed = tally(test).rows.filter(r => r.rolled && !r.success && !r.chaos).map(r => ({ value: r.id, label: r.name }));
    const target = await chooseSelect(T('E20.PriorExperience'), T('E20.PriorExperiencePrompt'), failed);
    const power = actor.system?.powers?.personal;
    if (target && power && (power.value ?? 0) >= 1) {
      await actor.update({ 'system.powers.personal.value': power.value - 1 });
      await actor.setFlag('essence20', 'priorExperience', { id: test.id, target });
    } else if (target) {
      ui.notifications.warn(T('E20.NoPower', { name: actor.name }));
    }
  } else if (perk == 'createChaos') {
    // "you can choose to fail the test and instead roll a skill of your choice."
    const skill = await chooseSelect(T('E20.CreateChaos'), T('E20.CreateChaosPrompt'),
      Object.entries(CONFIG.E20.skills).map(([value, label]) => ({ value, label: T(label) })));
    if (skill) {
      const success = await rollFor(actor, test, skill);
      await actor.setFlag('essence20', RESULT_FLAG, { id: test.id, success: false, chaos: true, chaosSuccess: !!success });
    }
  }

  return refresh(message);
}
