import { jest } from '@jest/globals';
import { getModeAttachmentDif, MODE_ATTACHMENT_ID, pickModeAttachmentChoice, triggerModeAttachmentCheck } from './mode-attachment.mjs';

global.game = { i18n: { localize: (key) => key } };

function makeActor({ level = 10, choice = null, altModes = [], hasHangUp = true } = {}) {
  const items = hasHangUp
    ? [{ type: 'hangUp', flags: { core: { sourceId: MODE_ATTACHMENT_ID } }, system: { choice } }]
    : [];
  items.documentsByType = { altMode: altModes };

  return {
    system: { level },
    items,
    _dice: { rollSkill: jest.fn() },
  };
}

describe("getModeAttachmentDif", () => {
  test("10 + half level, rounded up", () => {
    expect(getModeAttachmentDif({ system: { level: 10 } })).toBe(15);
    expect(getModeAttachmentDif({ system: { level: 9 } })).toBe(15); // ceil(4.5) = 5
    expect(getModeAttachmentDif({ system: { level: 0 } })).toBe(10);
  });
});

describe("pickModeAttachmentChoice", () => {
  let originalFoundry;
  beforeEach(() => {
    originalFoundry = global.foundry;
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
  });
  afterEach(() => {
    global.foundry = originalFoundry;
  });

  test("returns the chosen value", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('botMode');
    const actor = makeActor({ altModes: [{ id: 'alt1', name: 'Car Mode' }] });

    expect(await pickModeAttachmentChoice(actor)).toBe('botMode');
  });

  test("returns null when cancelled", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    expect(await pickModeAttachmentChoice(actor)).toBeNull();
  });
});

describe("triggerModeAttachmentCheck", () => {
  test("rolls Technology against the right DIF when entering the attached Bot Mode", async () => {
    const actor = makeActor({ level: 10, choice: 'botMode' });

    await triggerModeAttachmentCheck(actor, true);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', dif: '15', isModeAttachmentAttempt: true }), actor,
    );
  });

  test("rolls when entering the attached Alt Mode", async () => {
    const actor = makeActor({ level: 0, choice: 'alt1' });

    await triggerModeAttachmentCheck(actor, false, 'alt1');

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', dif: '10' }), actor,
    );
  });

  test("does nothing entering Bot Mode when the Alt Mode is the attached one", async () => {
    const actor = makeActor({ choice: 'alt1' });

    await triggerModeAttachmentCheck(actor, true);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does nothing entering an unattached Alt Mode", async () => {
    const actor = makeActor({ choice: 'alt1' });

    await triggerModeAttachmentCheck(actor, false, 'alt2');

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does nothing without the Hang-Up", async () => {
    const actor = makeActor({ hasHangUp: false });

    await triggerModeAttachmentCheck(actor, true);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does nothing when no mode has been configured yet", async () => {
    const actor = makeActor({ choice: null });

    await triggerModeAttachmentCheck(actor, true);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
