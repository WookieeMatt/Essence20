// Weapon Bays (Transformers One Sourcebook p.17). Registered on import; see module/rules/plugins/index.mjs.
import { registerStep } from "../../steps.mjs";
import { escape, itemsOf, localize } from "../shared/copy-and-data-helpers.mjs";
import { rememberChoice, write } from "../shared/zord-crew-lookups.mjs";

/**
 * Weapon Bays: when gained, an Alt Mode permanently gives up Crew - and as many Firepoints - to hold weapons in extra
 * Integrated Hardpoints. A Sidearm takes the room of 1 Crew, a Medium weapon 2, a Long or Heavy one 3, and making it a
 * Reinforced Hardpoint 1 more. Only a weapon the character is Trained or Qualified in can go in.
 *
 * - Step `weaponBays`: asks which Alt Mode (when more than one has Crew), then which weapons go in and which are
 *   Reinforced, the room they take shown against the Alt Mode's Crew. The Alt Mode loses that Crew and Firepoints, the
 *   weapons become Integrated (Reinforced where picked), and the rule's item keeps what was done under its rules
 *   choices: weaponBayCount (the weapons in - the Perk's own Hardpoints rule adds that many Integrated Hardpoints) and
 *   weaponBay (the Alt Mode, the room, the Firepoints taken, and each weapon's Hardpoint before). Stops when nothing
 *   is picked.
 * - Step `weaponBaysUndo` (the Perk removed): the Crew and Firepoints come back and each weapon's Hardpoint is what it
 *   was.
 *
 * "Trained or Qualified": a weapon whose prerequisites the character doesn't meet (rules/prerequisites.mjs) can't be
 * picked. One whose prerequisites need the GM's word is offered, marked.
 */

/** The room a weapon takes, in Crew (Sidearm 1, Medium 2, Long / Heavy 3), one more Reinforced. Exported for tests. */
export function bayRoom(weapon, reinforced = false) {
  const size = weapon?.system?.classification?.size;
  const room = ['long', 'heavy'].includes(size) ? 3 : size == 'medium' ? 2 : 1;
  return room + (reinforced ? 1 : 0);
}

/** The helpers the steps read (tests set them). */
export const weaponBayHelpers = {
  choose: async (title, prompt, options) => (await import("../../../mechanics/resources/grants.mjs")).chooseSelect(title, prompt, options),
  pick: (title, rows, room) => askWeapons(title, rows, room),
  prerequisites: async (actor, weapon) => (await import("../../prerequisites.mjs")).checkPrerequisites(actor, weapon),
};

const crewOf = altMode => Math.max(0, Number(altMode?.system?.altModeCrew) || 0);

/**
 * The weapons that could go in: [{id, name, room, reinforcedRoom, blocked, asks}], blocked when the character
 * doesn't meet the weapon's prerequisites. Exported for tests.
 */
export async function bayCandidates(actor) {
  const rows = [];
  // Not an Alt Mode's Ram / Flyby: its own Special Attack, which takes no Hardpoint (documents/actor.mjs#_isAltModeAttack).
  const altModeAttack = weapon => actor?._isAltModeAttack?.(weapon) ?? false;
  for (const weapon of itemsOf(actor).filter(item => item.type == 'weapon' && !item.flags?.essence20?.weaponBay && !altModeAttack(item))) {
    const check = await weaponBayHelpers.prerequisites(actor, weapon) ?? { met: true, unmet: [], asks: [] };
    rows.push({
      id: weapon.id, name: weapon.name, room: bayRoom(weapon), reinforcedRoom: bayRoom(weapon, true),
      blocked: (check.unmet ?? []).length > 0, asks: (check.asks ?? []).length > 0,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** The picks, checked: [{id, reinforced}] that fit the room - else null. Exported for tests. */
export function checkPicks(rows, picks, room) {
  const chosen = (picks ?? []).map(pick => ({ pick, row: rows.find(row => row.id == pick.id) }))
    .filter(({ row }) => row && !row.blocked);
  if (!chosen.length) {
    return null;
  }

  const used = chosen.reduce((sum, { pick, row }) => sum + (pick.reinforced ? row.reinforcedRoom : row.room), 0);
  return used <= room ? { picks: chosen.map(({ pick }) => ({ id: pick.id, reinforced: !!pick.reinforced })), used } : null;
}

registerStep('weaponBays', async (step, ctx) => {
  const actor = ctx.actor;
  const title = ctx.item?.name ?? '';
  const modes = itemsOf(actor).filter(item => item.type == 'altMode' && crewOf(item) > 0);
  if (!modes.length) {
    globalThis.ui?.notifications?.warn?.(localize('E20.WeaponBaysNoCrew'));
    return false;
  }

  const modeId = modes.length > 1
    ? await weaponBayHelpers.choose(title, escape(localize('E20.WeaponBaysWhichAltMode')), modes.map(mode => ({ value: mode.id, label: `${mode.name} (${crewOf(mode)})` })))
    : modes[0].id;
  const altMode = modes.find(mode => mode.id == modeId);
  if (!altMode) {
    return false;
  }

  const rows = await bayCandidates(actor);
  const room = crewOf(altMode);
  const checked = checkPicks(rows, await weaponBayHelpers.pick(title, rows, room), room);
  if (!checked) {
    return false;
  }

  const weapons = itemsOf(actor);
  const before = Object.fromEntries(checked.picks.map(({ id }) => {
    const weapon = weapons.find(item => item.id == id);
    return [id, { type: weapon?.system?.hardpoint?.type ?? 'external', reinforced: !!weapon?.system?.hardpoint?.reinforced }];
  }));
  const firepoints = Math.min(checked.used, Math.max(0, Number(altMode.system?.altModeFirepoints) || 0));
  await write(altMode, 'update', [{ 'system.altModeCrew': room - checked.used, 'system.altModeFirepoints': (Number(altMode.system?.altModeFirepoints) || 0) - firepoints }]);
  await write(actor, 'updateEmbeddedDocuments', ['Item', checked.picks.map(({ id, reinforced }) => ({
    _id: id, 'system.hardpoint.type': 'integrated', 'system.hardpoint.reinforced': reinforced || before[id].reinforced,
    'flags.essence20.weaponBay': ctx.item?.id ?? true,
  }))]);
  if (ctx.item) {
    await rememberChoice(ctx.item, 'weaponBay', { altModeId: altMode.id, room: checked.used, firepoints, weapons: before });
    await rememberChoice(ctx.item, 'weaponBayCount', checked.picks.length);
  }

  const names = checked.picks.map(({ id }) => weapons.find(item => item.id == id)?.name).filter(Boolean).join(', ');
  ctx.chat?.push?.(localize('E20.WeaponBaysDone', { altMode: altMode.name, room: checked.used, weapons: names }));
});

registerStep('weaponBaysUndo', async (step, ctx) => {
  const done = ctx.item?.flags?.essence20?.rules?.choices?.weaponBay;
  const actor = ctx.actor;
  if (!done?.altModeId || !actor) {
    return;
  }

  const items = itemsOf(actor);
  const altMode = items.find(item => item.id == done.altModeId);
  if (altMode) {
    await write(altMode, 'update', [{
      'system.altModeCrew': crewOf(altMode) + (Number(done.room) || 0),
      'system.altModeFirepoints': (Number(altMode.system?.altModeFirepoints) || 0) + (Number(done.firepoints) || 0),
    }]);
  }

  const restored = Object.entries(done.weapons ?? {}).filter(([id]) => items.some(item => item.id == id))
    .map(([id, was]) => ({ _id: id, 'system.hardpoint.type': was.type, 'system.hardpoint.reinforced': !!was.reinforced, 'flags.essence20.-=weaponBay': null }));
  if (restored.length) {
    await write(actor, 'updateEmbeddedDocuments', ['Item', restored]);
  }
});

/** The weapons dialog: a checkbox to install each, one to Reinforce it, and the room used against the room there is. */
async function askWeapons(title, rows, room) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2 || !rows.length) {
    if (!rows.length) {
      globalThis.ui?.notifications?.warn?.(localize('E20.WeaponBaysNoWeapons'));
    }

    return null;
  }

  const line = row => `<tr data-id="${row.id}" data-room="${row.room}" data-reinforced-room="${row.reinforcedRoom}">
    <td><input type="checkbox" name="in-${row.id}" ${row.blocked ? 'disabled' : ''}></td>
    <td>${escape(row.name)}${row.blocked ? ` <em>(${escape(localize('E20.WeaponBaysNotQualified'))})</em>` : row.asks ? ` <em>(${escape(localize('E20.WeaponBaysAsk'))})</em>` : ''}</td>
    <td>${row.room}</td>
    <td><input type="checkbox" name="reinforced-${row.id}" ${row.blocked ? 'disabled' : ''}></td></tr>`;
  const content = `<p>${escape(localize('E20.WeaponBaysPrompt', { room }))}</p>
    <table class="e20-weapon-bays"><thead><tr><th></th><th>${escape(localize('E20.WeaponBaysWeapon'))}</th>
    <th>${escape(localize('E20.WeaponBaysRoom'))}</th><th>${escape(localize('E20.WeaponBaysReinforced'))}</th></tr></thead>
    <tbody>${rows.map(line).join('')}</tbody></table>
    <p class="e20-weapon-bays__used">${escape(localize('E20.WeaponBaysUsed'))} <span data-used>0</span> / ${room}</p>`;
  const readPicks = form => rows.map(row => ({
    id: row.id, in: form.querySelector(`[name="in-${row.id}"]`)?.checked, reinforced: form.querySelector(`[name="reinforced-${row.id}"]`)?.checked,
  })).filter(pick => pick.in);
  return DialogV2.prompt({
    window: { title },
    content,
    ok: { label: localize('E20.AcceptButton'), callback: (event, button) => readPicks(button.form) },
    render: (event, dialog) => {
      const form = dialog.element.querySelector('form') ?? dialog.element;
      const ok = dialog.element.querySelector('button[data-action="ok"]');
      const update = () => {
        const used = readPicks(form).reduce((sum, pick) => sum + rows.find(row => row.id == pick.id)[pick.reinforced ? 'reinforcedRoom' : 'room'], 0);
        form.querySelector('[data-used]').textContent = used;
        if (ok) {
          ok.disabled = !used || used > room;
        }
      };

      form.addEventListener('change', update);
      update();
    },
    rejectClose: false,
  });
}
