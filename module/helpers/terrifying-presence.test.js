import { jest } from '@jest/globals';
import { pickTerrifyingPresenceRider, TERRIFYING_PRESENCE_ID, TF_TERRIFYING_PRESENCE_ID } from './terrifying-presence.mjs';

function makeActor({ hasPerk = true } = {}) {
  return {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: TERRIFYING_PRESENCE_ID } } }] : [],
  };
}

describe("pickTerrifyingPresenceRider", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("never prompts without the Perk", async () => {
    const result = await pickTerrifyingPresenceRider(makeActor({ hasPerk: false }), 'intimidation', 'willpower');
    expect(result).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("never prompts for a non-Intimidation skill, even with the Perk", async () => {
    const result = await pickTerrifyingPresenceRider(makeActor(), 'persuasion', 'willpower');
    expect(result).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("never prompts against a Defense other than Willpower", async () => {
    const result = await pickTerrifyingPresenceRider(makeActor(), 'intimidation', 'cleverness');
    expect(result).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("returns the chosen rider on confirm", async () => {
    waitMock.mockResolvedValue('stun');
    expect(await pickTerrifyingPresenceRider(makeActor(), 'intimidation', 'willpower')).toBe('stun');
  });

  test("returns null when the player explicitly picks none", async () => {
    waitMock.mockResolvedValue('none');
    expect(await pickTerrifyingPresenceRider(makeActor(), 'intimidation', 'willpower')).toBeNull();
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickTerrifyingPresenceRider(makeActor(), 'intimidation', 'willpower')).toBeNull();
  });

  test("the GI Joe printing offers the Stunned Condition", async () => {
    waitMock.mockResolvedValue('none');
    await pickTerrifyingPresenceRider(makeActor(), 'intimidation', 'willpower');
    const content = waitMock.mock.calls[0][0].content;
    expect(content).toContain('value="stun"');
    expect(content).not.toContain('value="stunDamage"');
  });
});

describe("pickTerrifyingPresenceRider (Transformers CRB printing)", () => {
  let waitMock;
  const tfActor = () => ({ items: [{ type: 'perk', flags: { core: { sourceId: TF_TERRIFYING_PRESENCE_ID } } }] });

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("prompts for its holder too, offering 1 Stun damage instead of the Stunned Condition", async () => {
    waitMock.mockResolvedValue('stunDamage');
    expect(await pickTerrifyingPresenceRider(tfActor(), 'intimidation', 'willpower')).toBe('stunDamage');
    const content = waitMock.mock.calls[0][0].content;
    expect(content).toContain('value="stunDamage"');
    expect(content).not.toContain('value="stun"');
  });

  test("still only for Intimidation against Willpower", async () => {
    expect(await pickTerrifyingPresenceRider(tfActor(), 'intimidation', 'cleverness')).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });
});
