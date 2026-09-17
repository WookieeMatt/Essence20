import { jest } from '@jest/globals';
import { applyMegaformDamage } from './megaform-damage.mjs';

// Augments (not replaces) jest.setup.js's own global.foundry - applyDamage() (called internally)
// relies on the rest of that shared stub (foundry.utils, etc.), so only DialogV2 needs adding.
global.foundry.applications.api.DialogV2 = { wait: jest.fn() };

function makeParticipant({ name, health, healthMax = 10, megaformTraitTypes = [], type = 'zord' }) {
  const participant = {
    uuid: `Actor.${name}`,
    name,
    type,
    items: megaformTraitTypes.map(traitType => ({ type: 'megaformTrait', system: { type: traitType } })),
    system: { health: { value: health, max: healthMax }, immunities: {}, resistances: {} },
  };
  participant.update = jest.fn(async (data) => {
    if (data['system.health.value'] !== undefined) {
      participant.system.health.value = data['system.health.value'];
    }
  });

  return participant;
}

function makeMegaformActor(participants, { subtype = ['megaformZord'] } = {}) {
  const actorsMap = {};
  participants.forEach((participant, i) => {
    actorsMap[`p${i}`] = { uuid: participant.uuid };
  });
  global.fromUuidSync.mockImplementation(
    uuid => participants.find(participant => participant.uuid == uuid),
  );

  return { name: 'Test Megazord', system: { actors: actorsMap, subtype } };
}

describe("applyMegaformDamage", () => {
  beforeEach(() => {
    global.fromUuidSync.mockReset();
    global.foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns 0 and touches nothing when every participant is already at 0 Health", async () => {
    const defeated = makeParticipant({ name: 'A', health: 0 });
    const actor = makeMegaformActor([defeated]);

    const applied = await applyMegaformDamage(actor, 6, 'sharp');

    expect(applied).toBe(0);
    expect(defeated.update).not.toHaveBeenCalled();
  });

  test("applies the full amount directly to a single active participant, without prompting", async () => {
    const solo = makeParticipant({ name: 'A', health: 10 });
    const actor = makeMegaformActor([solo]);

    const applied = await applyMegaformDamage(actor, 6, 'sharp');

    expect(applied).toBe(6);
    expect(solo.system.health.value).toBe(4);
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("splits evenly (rounding up, minimum 1) across active participants, skipping a defeated one", async () => {
    const a = makeParticipant({ name: 'A', health: 10 });
    const b = makeParticipant({ name: 'B', health: 10 });
    const defeated = makeParticipant({ name: 'C', health: 0 });
    const actor = makeMegaformActor([a, b, defeated]);
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('split');

    // 7 damage / 2 active participants = 3.5, rounds up to 4 each.
    const applied = await applyMegaformDamage(actor, 7, 'sharp');

    expect(a.system.health.value).toBe(6);
    expect(b.system.health.value).toBe(6);
    expect(defeated.update).not.toHaveBeenCalled();
    expect(applied).toBe(8); // 4 + 4, per RAW's literal "rounding up" (can exceed the raw total)
  });

  test("a 1-point hit still deals at least 1 to every active participant", async () => {
    const a = makeParticipant({ name: 'A', health: 10 });
    const b = makeParticipant({ name: 'B', health: 10 });
    const actor = makeMegaformActor([a, b]);
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('split');

    await applyMegaformDamage(actor, 1, 'sharp');

    expect(a.system.health.value).toBe(9);
    expect(b.system.health.value).toBe(9);
  });

  test("Grounding reduces Electric damage by 1 (minimum 1) before it's split", async () => {
    const grounded = makeParticipant({ name: 'A', health: 10, megaformTraitTypes: ['grounding'] });
    const other = makeParticipant({ name: 'B', health: 10 });
    const actor = makeMegaformActor([grounded, other]);
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('split');

    // 5 - 1 (Grounding) = 4, split across 2 = 2 each.
    await applyMegaformDamage(actor, 5, 'electric');

    expect(grounded.system.health.value).toBe(8);
    expect(other.system.health.value).toBe(8);
  });

  test("Grounding never reduces Electric damage below 1 total", async () => {
    const grounded = makeParticipant({ name: 'A', health: 10, megaformTraitTypes: ['grounding'] });
    const actor = makeMegaformActor([grounded]);

    await applyMegaformDamage(actor, 1, 'electric');

    expect(grounded.system.health.value).toBe(9);
  });

  test("Grounding doesn't affect other damage types", async () => {
    const grounded = makeParticipant({ name: 'A', health: 10, megaformTraitTypes: ['grounding'] });
    const actor = makeMegaformActor([grounded]);

    await applyMegaformDamage(actor, 5, 'fire');

    expect(grounded.system.health.value).toBe(5);
  });

  test("focusing on a chosen participant applies the full amount only to them", async () => {
    const a = makeParticipant({ name: 'A', health: 10 });
    const b = makeParticipant({ name: 'B', health: 10 });
    const actor = makeMegaformActor([a, b]);
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue(a.uuid);

    const applied = await applyMegaformDamage(actor, 6, 'sharp');

    expect(a.system.health.value).toBe(4);
    expect(b.system.health.value).toBe(10);
    expect(applied).toBe(6);
  });

  test("Compensation moves damage from another participant onto the holder when confirmed", async () => {
    const holder = makeParticipant({ name: 'A', health: 10, megaformTraitTypes: ['compensation'] });
    const other = makeParticipant({ name: 'B', health: 10 });
    const actor = makeMegaformActor([holder, other]);
    global.foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('split') // the distribution choice
      .mockResolvedValueOnce('yes'); // the Compensation follow-up

    // 4 damage / 2 = 2 each, then Compensation moves 2 from B back onto A.
    await applyMegaformDamage(actor, 4, 'sharp');

    expect(holder.system.health.value).toBe(6); // 8 (after split) - 2 (moved onto it)
    expect(other.system.health.value).toBe(10); // 8 (after split) + 2 (moved off it) = healed back
  });

  test("Compensation is capped by how much damage the other participant actually has to give", async () => {
    const holder = makeParticipant({ name: 'A', health: 10, megaformTraitTypes: ['compensation'] });
    const other = makeParticipant({ name: 'B', health: 10 });
    const actor = makeMegaformActor([holder, other]);
    global.foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('split')
      .mockResolvedValueOnce('yes');

    // 2 damage / 2 = 1 each - other only has 1 damage on it to move, not the full 2.
    await applyMegaformDamage(actor, 2, 'sharp');

    expect(holder.system.health.value).toBe(8); // 9 (after split) - 1 (only that much was available)
    expect(other.system.health.value).toBe(10); // fully healed back, its only 1 point moved off
  });

  test("declining the Compensation prompt leaves the split damage as-is", async () => {
    const holder = makeParticipant({ name: 'A', health: 10, megaformTraitTypes: ['compensation'] });
    const other = makeParticipant({ name: 'B', health: 10 });
    const actor = makeMegaformActor([holder, other]);
    global.foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('split')
      .mockResolvedValueOnce('no');

    await applyMegaformDamage(actor, 4, 'sharp');

    expect(holder.system.health.value).toBe(8);
    expect(other.system.health.value).toBe(8);
  });

  test("doesn't prompt for Compensation at all with only one participant (nothing to move from)", async () => {
    const holder = makeParticipant({ name: 'A', health: 10, megaformTraitTypes: ['compensation'] });
    const actor = makeMegaformActor([holder]);

    await applyMegaformDamage(actor, 4, 'sharp');

    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(holder.system.health.value).toBe(6);
  });

  test("Combiner subtype filters participants by non-Zord/Vehicle/Megaform actor type", async () => {
    const component = makeParticipant({ name: 'A', health: 10, type: 'playerCharacter' });
    const zordActor = makeParticipant({ name: 'B', health: 10, type: 'zord' });
    const actor = makeMegaformActor([component, zordActor], { subtype: ['megaformCombiner'] });

    const applied = await applyMegaformDamage(actor, 6, 'sharp');

    // Only the non-Zord component counts as a Combiner participant, so it takes the full hit.
    expect(component.system.health.value).toBe(4);
    expect(zordActor.system.health.value).toBe(10);
    expect(applied).toBe(6);
  });
});
