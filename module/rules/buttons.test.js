import { jest } from '@jest/globals';
import { canPress, decorateRuleButtonCard, pressRuleButton } from './buttons.mjs';
import { runSteps, stepContext, stepErrors } from './steps.mjs';

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let docs;
let created;

function makeActor(name, owners = []) {
  const actor = {
    name, uuid: `Actor.${name}`, flags: { essence20: {} }, system: { health: { value: 5, max: 10 } },
    testUserPermission: user => owners.includes(user.id),
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
  };
  docs.set(actor.uuid, actor);
  return actor;
}

function messageFrom(data) {
  return {
    flags: { essence20: { ruleButton: data } },
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

beforeEach(() => {
  docs = new Map();
  created = [];
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.ChatMessage = { create: jest.fn(async data => created.push(data)), getSpeaker: ({ actor }) => ({ alias: actor?.name }) };
  global.game = { user: { id: 'player', isGM: false }, users: { activeGM: null }, i18n: { localize: k => k, format: k => k } };
});

afterEach(() => {
  delete global.fromUuidSync;
  delete global.ChatMessage;
});

test('the button step posts a card carrying its steps, actor, item and targets', async () => {
  const actor = makeActor('Leader', ['player']);
  const foe = makeActor('Foe');
  const item = { uuid: 'Item.follow', name: 'Follow Me!' };
  const ctx = stepContext({ actor, item, targets: [foe] });
  await runSteps([{ do: 'button', label: 'Join the charge', who: 'others', runAs: 'clicker', steps: [{ do: 'mark', key: 'charging' }] }], ctx);
  expect(created).toHaveLength(1);
  expect(created[0].content).toContain('data-e20-rule-button');
  expect(created[0].flags.essence20.ruleButton).toMatchObject({
    actorUuid: 'Actor.Leader', itemUuid: 'Item.follow', targets: ['Actor.Foe'], who: 'others', runAs: 'clicker', once: true, used: false,
  });
  expect(stepErrors([{ do: 'button', steps: [] }])).toContain('steps[0]: button needs steps');
  expect(stepErrors([{ do: 'button', who: 'everyone', steps: [{ do: 'chat' }] }])).toHaveLength(1);
  expect(stepErrors([{ do: 'button', steps: [{ do: 'nope' }] }])).toHaveLength(1);
});

test('who may press: owner, gm, anyone, targets, others; a used one-shot card nobody', () => {
  makeActor('Leader', ['player']);
  makeActor('Foe', ['enemyPlayer']);
  const player = { id: 'player', isGM: false, character: docs.get('Actor.Leader') };
  const other = { id: 'other', isGM: false, character: makeActor('Other', ['other']) };
  const gm = { id: 'gm', isGM: true };
  const card = who => ({ actorUuid: 'Actor.Leader', targets: ['Actor.Foe'], who, steps: [] });
  expect([player, other, gm].map(u => canPress(card('owner'), u))).toEqual([true, false, true]);
  expect([player, other, gm].map(u => canPress(card('gm'), u))).toEqual([false, false, true]);
  expect([player, other].map(u => canPress(card('anyone'), u))).toEqual([true, true]);
  expect(canPress(card('targets'), { id: 'enemyPlayer', isGM: false })).toBe(true);
  expect(canPress(card('targets'), other)).toBe(false);
  expect([player, other].map(u => canPress(card('others'), u))).toEqual([false, true]);
  expect(canPress({ ...card('anyone'), used: true }, player)).toBe(false);
  expect(canPress({ ...card('anyone'), used: true, once: false }, player)).toBe(true);
});

test('pressing runs the steps as the right actor, posts the result and marks a one-shot card used', async () => {
  const leader = makeActor('Leader', ['player']);
  const other = makeActor('Other', ['other']);
  const otherUser = { id: 'other', isGM: false, character: other };
  const message = messageFrom({ actorUuid: leader.uuid, targets: [], who: 'others', runAs: 'clicker', once: true, label: 'Join', steps: [{ do: 'mark', key: 'joined' }, { do: 'chat', text: 'Charging!' }] });
  expect(await pressRuleButton(message, otherUser)).toBe(true);
  expect(other.flags.essence20.ruleMarks.joined).toBeTruthy();
  expect(leader.flags.essence20.ruleMarks?.joined).toBeUndefined();
  expect(message.flags.essence20.ruleButton.used).toBe(true);
  expect(created.at(-1).content).toContain('<strong>Join</strong>');
  // Once used, it doesn't run again.
  expect(await pressRuleButton(message, otherUser)).toBe(false);

  // Run as the holder, against the stored target.
  const foe = makeActor('Foe');
  const gmMessage = messageFrom({ actorUuid: leader.uuid, targets: [foe.uuid], who: 'gm', once: false, steps: [{ do: 'mark', key: 'hit', to: 'target' }] });
  expect(await pressRuleButton(gmMessage, { id: 'gm', isGM: true })).toBe(true);
  expect(foe.flags.essence20.ruleMarks.hit).toBeTruthy();
  expect(gmMessage.flags.essence20.ruleButton.used).toBeFalsy();
});

test('the card decorator enables the button for whoever may press it and runs it on click', async () => {
  const leader = makeActor('Leader', ['player']);
  const message = messageFrom({ actorUuid: leader.uuid, targets: [], who: 'owner', once: true, steps: [{ do: 'mark', key: 'clicked' }] });
  let onClick = null;
  const button = { disabled: true, addEventListener: (type, fn) => (onClick = fn) };
  decorateRuleButtonCard(message, { querySelector: () => button });
  expect(button.disabled).toBe(false);
  await onClick({ preventDefault: () => {} });
  expect(leader.flags.essence20.ruleMarks.clicked).toBeTruthy();
  expect(button.disabled).toBe(true);
  // Cards without a rule button are left alone.
  expect(() => decorateRuleButtonCard({ flags: {} }, { querySelector: () => null })).not.toThrow();
});

test('a button limit counts on whoever presses it (runAs clicker), across cards', async () => {
  const leader = makeActor('Leader', ['player']);
  const other = makeActor('Other', ['other']);
  other.setFlag = async function (scope, key, value) {
    setPath(this.flags, `${scope}.${key}`, value);
  };

  other.getFlag = function (scope, key) {
    return key.split('.').reduce((at, k) => at?.[k], this.flags?.[scope]);
  };

  global.game.combat = { id: 'c', started: true, round: 1, turn: 0 };
  const otherUser = { id: 'other', isGM: false, character: other };
  const data = { actorUuid: leader.uuid, itemUuid: 'Item.f', label: 'Join', targets: [], who: 'others', runAs: 'clicker', once: false, limit: { per: 'round', max: 1 }, steps: [{ do: 'mark', key: 'joined' }] };
  expect(await pressRuleButton(messageFrom({ ...data }), otherUser)).toBe(true);
  // A second card from the same rule, same round: the limit holds.
  expect(await pressRuleButton(messageFrom({ ...data }), otherUser)).toBe(false);
  global.game.combat = { id: 'c', started: true, round: 2, turn: 0 };
  expect(await pressRuleButton(messageFrom({ ...data }), otherUser)).toBe(true);
  expect(stepErrors([{ do: 'button', limit: { per: 'fortnight' }, steps: [{ do: 'chat' }] }])).toHaveLength(1);
  delete global.game.combat;
});
