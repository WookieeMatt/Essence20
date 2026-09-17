import { jest } from '@jest/globals';
import {
  consumeMegaWeaponAttack, getMegaWeaponAttacksRemaining, isMegaWeaponActive, summonMegaWeapon,
} from './zord-mega-weapon.mjs';

const MEGA_WEAPON_ID = "Compendium.essence20.pr_crb.Item.Wc1FJ5YDeTQS6XoE";

let rollTotal = 3;
let originalRoll;
beforeEach(() => {
  originalRoll = global.Roll;
  global.Roll = class {
    async evaluate() {
      this.total = rollTotal;
      return this;
    }
  };
  ChatMessage.create.mockClear();
  global.fromUuidSync.mockReset();
});
afterEach(() => {
  global.Roll = originalRoll;
});

function makeCrewMember(name, personal) {
  const member = {
    name,
    system: { powers: { personal: { value: personal } } },
  };
  member.update = jest.fn(async (data) => {
    member.system.powers.personal.value = data['system.powers.personal.value'];
  });

  return member;
}

function makeZord({ hasFeature = true, crew = [], remaining = null } = {}) {
  const flags = remaining === null ? {} : { megaWeaponAttacksRemaining: remaining };
  const actors = {};
  crew.forEach((member, i) => {
    actors[`c${i}`] = { uuid: `Actor.${member.name}` };
  });

  global.fromUuidSync.mockImplementation(uuid => crew.find(c => `Actor.${c.name}` === uuid) ?? null);

  return {
    type: 'zord',
    system: { actors },
    items: hasFeature
      ? [{ type: 'feature', flags: { core: { sourceId: MEGA_WEAPON_ID } } }]
      : [],
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
  };
}

describe("summonMegaWeapon", () => {
  test("pools the 5 Personal Power cost across the crew and rolls its lifespan", async () => {
    const duke = makeCrewMember('Duke', 3);
    const flint = makeCrewMember('Flint', 4);
    const zord = makeZord({ crew: [duke, flint] });
    rollTotal = 3;

    expect(await summonMegaWeapon(zord)).toBe(true);

    // Drawn in crew order: Duke's 3 first, then the remaining 2 from Flint.
    expect(duke.system.powers.personal.value).toBe(0);
    expect(flint.system.powers.personal.value).toBe(2);
    expect(zord.setFlag).toHaveBeenCalledWith('essence20', 'megaWeaponAttacksRemaining', 3);
  });

  test("refuses, spending nothing, when the crew can't cover the cost between them", async () => {
    const duke = makeCrewMember('Duke', 2);
    const zord = makeZord({ crew: [duke] });

    expect(await summonMegaWeapon(zord)).toBe(false);
    expect(duke.update).not.toHaveBeenCalled();
    expect(zord.setFlag).not.toHaveBeenCalled();
  });

  test("refuses while one is already summoned", async () => {
    const duke = makeCrewMember('Duke', 9);
    const zord = makeZord({ crew: [duke], remaining: 2 });

    expect(await summonMegaWeapon(zord)).toBe(false);
    expect(duke.update).not.toHaveBeenCalled();
  });

  test("does nothing on a Zord that doesn't hold the Feature", async () => {
    const zord = makeZord({ hasFeature: false, crew: [makeCrewMember('Duke', 9)] });
    expect(await summonMegaWeapon(zord)).toBe(false);
  });
});

describe("consumeMegaWeaponAttack", () => {
  function makeMegaWeaponEffect(isMega = true) {
    return { getFlag: jest.fn((scope, key) => (key === 'isMegaWeapon' ? isMega : undefined)) };
  }

  test("spends one attack per roll", async () => {
    const zord = makeZord({ remaining: 3 });
    await consumeMegaWeaponAttack(zord, makeMegaWeaponEffect());
    expect(zord.setFlag).toHaveBeenCalledWith('essence20', 'megaWeaponAttacksRemaining', 2);
  });

  test("clears the weapon once its last attack is spent", async () => {
    const zord = makeZord({ remaining: 1 });
    await consumeMegaWeaponAttack(zord, makeMegaWeaponEffect());

    expect(zord.unsetFlag).toHaveBeenCalledWith('essence20', 'megaWeaponAttacksRemaining');
    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'E20.MegaWeaponExpended' }),
    );
  });

  test("ignores an ordinary attack that isn't the Mega-Weapon", async () => {
    const zord = makeZord({ remaining: 3 });
    await consumeMegaWeaponAttack(zord, makeMegaWeaponEffect(false));
    expect(zord.setFlag).not.toHaveBeenCalled();
  });

  test("ignores a Mega-Weapon roll while none is summoned", async () => {
    const zord = makeZord({ remaining: null });
    await consumeMegaWeaponAttack(zord, makeMegaWeaponEffect());
    expect(zord.setFlag).not.toHaveBeenCalled();
  });
});

describe("isMegaWeaponActive / getMegaWeaponAttacksRemaining", () => {
  test("reports the remaining count, and 0 when not summoned", () => {
    expect(getMegaWeaponAttacksRemaining(makeZord({ remaining: 2 }))).toBe(2);
    expect(isMegaWeaponActive(makeZord({ remaining: 2 }))).toBe(true);
    expect(getMegaWeaponAttacksRemaining(makeZord({ remaining: null }))).toBe(0);
    expect(isMegaWeaponActive(makeZord({ remaining: null }))).toBe(false);
  });
});
