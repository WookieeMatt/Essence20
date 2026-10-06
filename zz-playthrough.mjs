// TEMPORARY live play-through harness (2026-10-07). Not part of the system - delete after the run.
import { runUse, fireTriggers, useRulesOf } from "./module/rules/triggers.mjs";
import { lineOf } from "./module/mechanics/resources/game-lines.mjs";

const S = window._pt = window._pt ?? {};

/* ---------- dialogs: answer anything that pops up ---------- */
function autoAnswer() {
  for (const app of foundry.applications.instances.values()) {
    const el = app.element;
    if (!app.rendered || !el || (S.answeredAt.get(app) ?? 0) > Date.now() - 1500) continue;
    const isDialog = el.classList.contains('dialog') || app.constructor.name.includes('Dialog');
    if (isDialog) {
      const buttons = [...el.querySelectorAll('footer button, .form-footer button, .dialog-buttons button, button[data-action], button[type=submit]')]
        .filter(b => !b.classList.contains('header-control'));
      const pick = buttons.find(b => b.type == 'submit')
        ?? buttons.find(b => ['yes', 'ok', 'confirm', 'submit', 'roll', 'apply'].includes(b.dataset.action))
        ?? buttons.find(b => b.classList.contains('default') || b.autofocus)
        ?? buttons.find(b => !['cancel', 'no', 'close'].includes(b.dataset.action));
      // A list of choices (choose / pick steps): take the first one.
      const choice = el.querySelector('[data-kind], [data-choice], [data-option], li button');
      S.answeredAt.set(app, Date.now());
      setTimeout(() => {
        try {
          if (choice && !pick) choice.click();
          else pick?.click();
        } catch (error) { /* closed meanwhile */ }
      }, 30);
    } else if (!S.keepApps.has(app)) {
      // A chooser / sheet the harness didn't open itself: close it so nothing waits on it forever.
      S.answeredAt.set(app, Date.now());
      setTimeout(() => app.close?.().catch?.(() => null), 400);
    }
  }
}

/* ---------- errors ---------- */
function hookErrors() {
  if (S.errHooked) return;
  S.errHooked = true;
  const original = console.error.bind(console);
  console.error = (...args) => {
    if (S.current) S.errors.push({ item: S.current, kind: 'console', text: args.map(a => (a?.stack ?? a?.message ?? String(a))).join(' ').slice(0, 600) });
    return original(...args);
  };
  window.addEventListener('error', e => S.current && S.errors.push({ item: S.current, kind: 'window', text: String(e.error?.stack ?? e.message).slice(0, 600) }));
  window.addEventListener('unhandledrejection', e => S.current && S.errors.push({ item: S.current, kind: 'rejection', text: String(e.reason?.stack ?? e.reason).slice(0, 600) }));
  const notifyError = ui.notifications.error.bind(ui.notifications);
  ui.notifications.error = (message, options) => {
    if (S.current) S.errors.push({ item: S.current, kind: 'notify', text: String(message).slice(0, 300) });
    return notifyError(message, options);
  };
}

const timeout = (promise, ms, label) => Promise.race([promise, new Promise((resolve, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms))]);

/* ---------- the stage ---------- */
export async function setup() {
  hookErrors();
  S.answeredAt = new Map();
  S.keepApps = new Set();
  S.errors = [];
  S.done = 0;
  S.started = Date.now();
  S.party = game.actors.filter(a => a.type == 'party').map(a => ({ id: a.id, system: a.toObject().system }));
  S.worldTime = game.time.worldTime;
  S.messagesBefore = new Set(game.messages.map(m => m.id));
  S.scene = await Scene.create({ name: 'ZZ Playthrough', width: 3000, height: 2000, grid: { size: 100, distance: 5 } });
  await S.scene.view();
  await new Promise(r => setTimeout(r, 1500));
  S.ally = await Actor.create({ name: 'ZZ Ally', type: 'playerCharacter', prototypeToken: { disposition: 1, actorLink: true } });
  S.foe = await Actor.create({ name: 'ZZ Foe', type: 'npc', prototypeToken: { disposition: -1, actorLink: true }, system: { health: { max: 20, value: 20 } } });
  const [allyTok, foeTok] = await S.scene.createEmbeddedDocuments('Token', [
    (await S.ally.getTokenDocument({ x: 500, y: 500 })).toObject(),
    (await S.foe.getTokenDocument({ x: 800, y: 500 })).toObject(),
  ]);
  S.combat = await Combat.create({ scene: S.scene.id, active: true });
  await S.combat.createEmbeddedDocuments('Combatant', [
    { tokenId: allyTok.id, sceneId: S.scene.id, actorId: S.ally.id, initiative: 15 },
    { tokenId: foeTok.id, sceneId: S.scene.id, actorId: S.foe.id, initiative: 10 },
  ]);
  await S.combat.startCombat();
  S.timer = setInterval(autoAnswer, 120);
  return 'ready';
}

/** (Re)start the dialog answerer from this copy of the module. */
export function arm() {
  clearInterval(S.timer);
  S.answeredAt = new Map();
  S.timer = setInterval(autoAnswer, 120);
}

const HERO_TYPE = item => ({ feature: 'zord', megaformTrait: 'zord', altMode: 'playerCharacter' })[item.type] ?? 'playerCharacter';

/** One item: add it, use each Use, fire each Trigger's event, render the Rules tab, clean up. */
async function playItem(entry) {
  const label = `${entry.line} | ${entry.pack} | ${entry.name}`;
  S.current = label;
  let hero = null;
  try {
    const source = await fromUuid(entry.uuid);
    hero = await Actor.create({
      name: 'ZZ Hero', type: HERO_TYPE(source), prototypeToken: { disposition: 1, actorLink: true },
      system: { level: 10, health: { max: 20, value: 20 }, powers: { personal: { max: 6, value: 6 } } },
    });
    const [token] = await S.scene.createEmbeddedDocuments('Token', [(await hero.getTokenDocument({ x: 600, y: 500 })).toObject()]);
    const [combatant] = await S.combat.createEmbeddedDocuments('Combatant', [{ tokenId: token.id, sceneId: S.scene.id, actorId: hero.id, initiative: 20 }]);
    const data = game.items.fromCompendium(source);
    const [item] = await timeout(hero.createEmbeddedDocuments('Item', [data], { e20SkipPrerequisites: true }), 8000, 'add');
    await new Promise(r => setTimeout(r, 150));

    // Every Use rule, one at a time.
    const uses = item ? useRulesOf(item) : [];
    for (const use of uses) {
      const live = hero.items.get(item.id);
      if (!live) break;
      await timeout(runUse(live, async () => true, { pick: (it, available) => available.find(a => a.index == use.index) ?? null, ask: async () => true }), 8000, `use #${use.index}`)
        .catch(error => S.errors.push({ item: label, kind: 'use', text: String(error?.stack ?? error).slice(0, 600) }));
    }

    // Every Trigger's event, with a generic payload.
    const events = [...new Set((item?.system?.rules ?? []).filter(r => r.type == 'Trigger' && r.event).map(r => r.event))];
    for (const event of events) {
      await timeout(fireTriggers(hero, event, {
        targets: [S.foe], outcome: 'success', damage: { amount: 2, type: 'blunt' }, roll: { isAttack: true },
        prompt: async () => true, ask: async () => true,
      }), 8000, `event ${event}`).catch(error => S.errors.push({ item: label, kind: `event ${event}`, text: String(error?.stack ?? error).slice(0, 600) }));
    }

    // The sheet's Rules tab renders.
    await timeout(hero.sheet.render({ force: true }), 8000, 'sheet').catch(error => S.errors.push({ item: label, kind: 'sheet', text: String(error?.stack ?? error).slice(0, 600) }));
    await hero.sheet.close().catch(() => null);
    await combatant?.delete().catch(() => null);
    await token?.delete().catch(() => null);
  } catch (error) {
    S.errors.push({ item: label, kind: 'item', text: String(error?.stack ?? error).slice(0, 600) });
  } finally {
    if (hero) await hero.delete().catch(() => null);
    for (const app of [...foundry.applications.instances.values()]) {
      if (app.rendered && (app.document?.name?.startsWith?.('ZZ') || app.document?.parent?.name?.startsWith?.('ZZ'))) await app.close().catch(() => null);
    }
    S.current = null;
    S.done++;
  }
}

/** The list of rule items per line. */
export async function inventory() {
  const list = [];
  for (const pack of game.packs.filter(p => p.documentName == 'Item')) {
    const index = await pack.getIndex({ fields: ['system.rules'] });
    for (const entry of index) {
      if (!entry.system?.rules?.length) continue;
      list.push({ uuid: entry.uuid, name: entry.name, pack: pack.metadata.name, line: lineOf(entry.uuid) });
    }
  }

  S.list = list;
  return list.reduce((counts, e) => ({ ...counts, [e.line]: (counts[e.line] ?? 0) + 1 }), {});
}

/** Runs the list in the background; poll window._pt.done / .errors. */
export function start(filter = () => true) {
  S.queue = S.list.filter(filter);
  S.total = S.queue.length;
  S.running = (async () => {
    for (const entry of S.queue) {
      if (S.stop) break;
      await playItem(entry);
    }
    S.finished = Date.now();
  })();
  return S.total;
}

/** Undo the stage and everything the run left behind. */
export async function teardown() {
  clearInterval(S.timer);
  for (const actor of game.actors.filter(a => a.name.startsWith('ZZ '))) await actor.delete().catch(() => null);
  await S.combat?.delete().catch(() => null);
  for (const combat of game.combats.filter(c => c.scene?.id == S.scene?.id)) await combat.delete().catch(() => null);
  await S.scene?.delete().catch(() => null);
  const fresh = game.messages.filter(m => !S.messagesBefore.has(m.id)).map(m => m.id);
  for (let i = 0; i < fresh.length; i += 100) await ChatMessage.deleteDocuments(fresh.slice(i, i + 100));
  for (const { id, system } of S.party ?? []) await game.actors.get(id)?.update({ system }, { diff: false, recursive: false }).catch(() => null);
  if (game.time.worldTime != S.worldTime) await game.time.advance(S.worldTime - game.time.worldTime);
  return { messagesDeleted: fresh.length };
}
