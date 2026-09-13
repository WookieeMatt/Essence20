import { jest } from '@jest/globals';
import { applyAngryHangUp, pickAngryHangUpSkill } from './angry.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

const HANGUP_ID = "Compendium.essence20.cobra_codex.Item.wGMyGbySdNSgPs8B";

function makeActor({ hasHangUp = true, skills = {} } = {}) {
  const items = hasHangUp
    ? [{ type: 'hangUp', flags: { core: { sourceId: HANGUP_ID } } }]
    : [];
  return {
    items,
    system: { skills },
    setFlag: jest.fn(),
  };
}

describe("pickAngryHangUpSkill", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns null when no Smarts/Social skill has been trained", async () => {
    const actor = makeActor({ skills: { alertness: { shift: 'd20' }, deception: { shift: 'd20' } } });
    expect(await pickAngryHangUpSkill(actor)).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("prompts and returns the chosen skill when at least one is trained", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('deception');
    const actor = makeActor({ skills: { alertness: { shift: 'd20' }, deception: { shift: 'd6' } } });

    expect(await pickAngryHangUpSkill(actor)).toBe('deception');
    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ skills: { deception: { shift: 'd6' } } });
    expect(await pickAngryHangUpSkill(actor)).toBeNull();
  });

  test("excludes an untrained (Strength/Speed) skill even if present", async () => {
    const actor = makeActor({ skills: { brawn: { shift: 'd8' }, deception: { shift: 'd20' } } });
    expect(await pickAngryHangUpSkill(actor)).toBeNull();
  });
});

describe("applyAngryHangUp", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("does nothing if the actor has no Angry Hang-Up item", async () => {
    const actor = makeActor({ hasHangUp: false, skills: { deception: { shift: 'd6' } } });
    await applyAngryHangUp(actor, HANGUP_ID);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing if there's no eligible skill", async () => {
    const actor = makeActor({ skills: { deception: { shift: 'd20' } } });
    await applyAngryHangUp(actor, HANGUP_ID);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("banks the Snag on the chosen skill", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('deception');
    const actor = makeActor({ skills: { deception: { shift: 'd6' } } });

    await applyAngryHangUp(actor, HANGUP_ID);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingAngrySnag',
      expect.objectContaining({ skill: 'deception' }));
  });
});
