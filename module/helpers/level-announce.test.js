import { announceLevelChange, levelChangeContent, levelSnapshot, summarizeLevelChange } from "./level-announce.mjs";

/** A stand-in character with the fields a level change moves. */
function makeActor({ level = 1, essences = {}, health = 10, power = 0, perks = [] } = {}) {
  const base = { strength: 3, speed: 3, smarts: 3, social: 3, ...essences };
  return {
    name: 'Tess',
    system: {
      level,
      essences: Object.fromEntries(Object.entries(base).map(([essence, max]) => [essence, { max }])),
      health: { max: health },
      powers: { personal: { max: power } },
    },
    items: [
      ...perks.map(([id, name]) => ({ id, name, type: 'perk' })),
      { id: 'w1', name: 'Blaster', type: 'weapon' },
    ],
  };
}

describe("summarizeLevelChange", () => {
  test("lists the Essences, Health and Power that moved, and the Perks gained", () => {
    const before = levelSnapshot(makeActor({ level: 4, perks: [['p1', 'Iron Hands']] }));
    const after = levelSnapshot(makeActor({
      level: 5, essences: { speed: 4 }, health: 12, power: 3, perks: [['p1', 'Iron Hands'], ['p2', 'Quick Draw']],
    }));

    expect(summarizeLevelChange(before, after)).toEqual({
      changes: [
        { label: CONFIG.E20.essences.speed, from: 3, to: 4 },
        { label: 'E20.ActorHealth', from: 10, to: 12 },
        { label: 'E20.LevelChangePersonalPower', from: 0, to: 3 },
      ],
      gained: ['Quick Draw'],
      lost: [],
    });
  });

  test("a level down lists what was taken away", () => {
    const before = levelSnapshot(makeActor({ level: 5, perks: [['p1', 'Iron Hands'], ['p2', 'Quick Draw']] }));
    const after = levelSnapshot(makeActor({ level: 4, perks: [['p1', 'Iron Hands']] }));
    expect(summarizeLevelChange(before, after).lost).toEqual(['Quick Draw']);
  });

  test("only Perks count as gained, not other items", () => {
    const before = levelSnapshot(makeActor());
    const after = levelSnapshot(makeActor());
    expect(summarizeLevelChange(before, after)).toEqual({ changes: [], gained: [], lost: [] });
  });
});

describe("levelChangeContent", () => {
  test("heads the card with the new level and lists the changes", () => {
    const before = levelSnapshot(makeActor({ level: 1 }));
    const after = levelSnapshot(makeActor({ level: 2, health: 11, perks: [['p9', 'Steady']] }));
    const html = levelChangeContent(makeActor(), before, after);
    expect(html).toContain('E20.LevelChangeUp');
    expect(html).toContain('E20.ActorHealth: 10 &rarr; 11');
    expect(html).toContain('E20.LevelChangeGained');
    expect(html).not.toContain('E20.LevelChangeChoicePending');
  });

  test("says when a Perk choice is still open", () => {
    const before = levelSnapshot(makeActor({ level: 2 }));
    const after = levelSnapshot(makeActor({ level: 1 }));
    const html = levelChangeContent(makeActor(), before, after, true);
    expect(html).toContain('E20.LevelChangeDown');
    expect(html).toContain('E20.LevelChangeChoicePending');
  });
});

describe("announceLevelChange", () => {
  test("posts a notification and a chat card when the level moved", async () => {
    ChatMessage.create.mockClear();
    ui.notifications.info.mockClear();
    const actor = makeActor({ level: 3 });
    await announceLevelChange(actor, levelSnapshot(makeActor({ level: 2 })), levelSnapshot(actor));
    expect(ui.notifications.info).toHaveBeenCalledWith('E20.LevelChangeUp');
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });

  test("says nothing when the level did not change", async () => {
    ChatMessage.create.mockClear();
    const actor = makeActor();
    await announceLevelChange(actor, levelSnapshot(actor), levelSnapshot(actor));
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});
