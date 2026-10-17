import { jest } from '@jest/globals';
import { RETIRED_ITEM_TYPES, bondsField, bondsHtml, isWorthKeeping, retireActorBonds, retireBondsPlan, retireWorldBonds } from './retire-bonds.mjs';

const bond = (id, name, text = '') => ({ _id: id, name, type: 'bond', system: { description: text } });
const perk = (id, name) => ({ _id: id, name, type: 'perk', system: {} });

/** An actor stand-in: its raw source (Bonds included, as invalid documents are), update and delete. */
function makeActor(name, source) {
  return { name, _source: source, update: jest.fn(async () => true), deleteEmbeddedDocuments: jest.fn(async () => true) };
}

describe('Bonds out of the item list (6.0.5)', () => {
  test('Bond is the retired type', () => {
    expect(RETIRED_ITEM_TYPES).toEqual(['bond']);
  });

  test('a loose Bond is kept when it has text or a name of its own', () => {
    expect(isWorthKeeping({ name: 'Bond', system: { description: '<p> </p>' } })).toBe(false);
    expect(isWorthKeeping({ name: 'Bond', system: { description: '<p>Old feud.</p>' } })).toBe(true);
    expect(isWorthKeeping({ name: 'Sworn friends', system: {} })).toBe(true);
    expect(isWorthKeeping(null)).toBe(false);
  });

  test("Bonds become a heading and a list in the character's own text, each marked so a re-run doesn't repeat it", () => {
    const html = bondsHtml([bond('b1', 'Loyal', '<p>Never leaves a friend.</p>'), bond('b2', '<Rival>')], '<p>Bio.</p>');
    expect(html).toBe('<p>Bio.</p><h3>Bonds</h3><ul><li data-e20-bond="b1"><strong>Loyal</strong> <p>Never leaves a friend.</p></li>'
      + '<li data-e20-bond="b2"><strong>&lt;Rival&gt;</strong></li></ul>');
    expect(bondsHtml([bond('b1', 'Loyal')], html)).toBeNull();
    expect(bondsHtml([bond('b1', 'Loyal'), bond('b3', 'New')], html)).toContain('data-e20-bond="b3"');
  });

  test('characters keep them in their Biography, everyone else in Notes', () => {
    expect(bondsField({ biography: { bio: '' } })).toBe('system.biography.bonds');
    expect(bondsField({ notes: '' })).toBe('system.notes');
    expect(bondsField(undefined)).toBe('system.notes');
    // The type's own schema decides when there is one: a Party has a Biography, but no Bonds box.
    const saved = global.CONFIG;
    global.CONFIG = { Actor: { dataModels: {
      party: { schema: { getField: path => (path == 'biography.bonds' ? null : {}) } },
      npc: { schema: { getField: () => ({}) } },
    } } };
    expect(bondsField({ biography: {} }, 'party')).toBe('system.notes');
    expect(bondsField({ biography: {} }, 'npc')).toBe('system.biography.bonds');
    global.CONFIG = saved;
  });

  test('the plan, from source data: the text to add and the Bonds to delete; nothing for an actor without one', () => {
    const plan = retireBondsPlan({ system: { biography: { bio: '<p>Bio.</p>', bonds: '<p>Mine.</p>' } }, items: [perk('p1', 'Tough'), bond('b1', 'Loyal')] });
    expect(plan.ids).toEqual(['b1']);
    // Into the Bonds box, after what's there, with no heading of its own; the Bio is left alone.
    expect(plan.update).toEqual({ 'system.biography.bonds': '<p>Mine.</p><ul><li data-e20-bond="b1"><strong>Loyal</strong></li></ul>' });
    expect(retireBondsPlan({ system: { notes: '' }, items: [bond('b2', 'X')] }).update['system.notes']).toContain('<h3>Bonds</h3>');
    expect(retireBondsPlan({ system: {}, items: [perk('p1', 'Tough')] })).toBeNull();
    expect(retireBondsPlan(undefined)).toBeNull();
  });

  test('an actor: the text first, then the Bonds deleted; one already moved only deletes', async () => {
    const actor = makeActor('Red', { system: { notes: '' }, items: [bond('b1', 'Owes the mob', 'Fridays.')] });
    expect(await retireActorBonds(actor)).toBe(1);
    expect(actor.update).toHaveBeenCalledWith({ 'system.notes': expect.stringContaining('Owes the mob') });
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['b1']);

    const moved = makeActor('Blue', { system: { notes: '<li data-e20-bond="b1">x</li>' }, items: [bond('b1', 'Owes the mob')] });
    expect(await retireActorBonds(moved)).toBe(1);
    expect(moved.update).not.toHaveBeenCalled();
    expect(moved.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['b1']);
    expect(await retireActorBonds(makeActor('None', { system: {}, items: [] }))).toBe(0);
  });

  test('the world: actors, unlinked tokens, loose Bonds, and Essence20 world / module compendiums - one failure stops nothing', async () => {
    const pc = makeActor('PC', { system: { biography: { bio: '' } }, items: [bond('b1', 'A'), bond('b2', 'B')] });
    const broken = makeActor('Broken', { system: { notes: '' }, items: [bond('b3', 'C')] });
    broken.update.mockRejectedValue(new Error('nope'));
    // An unlinked token: its own Bond on its delta, written there.
    const delta = { _source: { system: {}, items: [bond('b4', 'D')] } };
    delta.update = jest.fn(async data => {
      delta._source.system.notes = data['system.notes']; 
    });
    delta.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
      delta._source.items = delta._source.items.filter(i => !ids.includes(i._id)); 
    });
    const token = { actorLink: false, delta, actor: { _source: { system: { notes: '<p>Base.</p>' } } } };
    // A world actor whose write lands, but whose dependent token then fails to rebuild: still done.
    const rebuildFails = makeActor('Rebuild', { system: { notes: '' }, items: [bond('b6', 'F')] });
    rebuildFails.update.mockImplementation(async data => {
      rebuildFails._source.system.notes = data['system.notes'];
      throw new Error('token rebuild failed');
    });
    rebuildFails.deleteEmbeddedDocuments.mockImplementation(async (type, ids) => {
      rebuildFails._source.items = rebuildFails._source.items.filter(i => !ids.includes(i._id));
      throw new Error('token rebuild failed');
    });
    const packActor = makeActor('Packed', { system: { notes: '' }, items: [bond('b5', 'E')] });
    const itemPack = {
      collection: 'world.items', documentName: 'Item', locked: true, metadata: { packageType: 'world', system: 'essence20' },
      getIndex: jest.fn(async () => [{ _id: 'i1', type: 'bond', name: 'Packed rivalry', system: { description: '<p>Old feud.</p>' } }, { _id: 'i2', type: 'perk' }]), configure: jest.fn(async () => true),
    };
    const actorPack = {
      collection: 'world.actors', documentName: 'Actor', locked: false, metadata: { packageType: 'world', system: 'essence20' },
      getIndex: jest.fn(async () => [{ _id: 'a1', items: [{ type: 'bond' }] }, { _id: 'a2', items: [{ type: 'perk' }] }]),
      getDocument: jest.fn(async () => packActor), configure: jest.fn(),
    };
    const systemPack = { documentName: 'Item', metadata: { packageType: 'system' }, getIndex: jest.fn() };
    const otherSystem = { documentName: 'Item', metadata: { packageType: 'module', system: 'dnd5e' }, getIndex: jest.fn() };
    global.Item = { deleteDocuments: jest.fn(async () => true) };
    const page = { text: { content: '' }, update: jest.fn(async data => {
      page.text.content = data['text.content']; 
    }) };
    let journal = null;
    global.JournalEntry = { create: jest.fn(async () => {
      journal = { pages: { contents: [] }, createEmbeddedDocuments: jest.fn(async (type, [data]) => {
        page.text.content = data.text.content; journal.pages.contents.push(page); 
      }) };
      return journal;
    }) };
    global.ui = { notifications: { info: jest.fn() } };
    global.game = {
      ...global.game,
      i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}` },
      actors: [pc, broken, rebuildFails],
      scenes: [{ tokens: [token, { actorLink: true, actor: pc }] }],
      data: { items: [{ _id: 'loose', type: 'bond', name: 'Bond', system: { description: '' } }, { _id: 'named', type: 'bond', name: 'Sworn friends', system: {} }, { _id: 'kept', type: 'gear' }] },
      journal: { getName: () => journal },
      packs: [itemPack, actorPack, systemPack, otherSystem],
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const tally = await retireWorldBonds();
    spy.mockRestore();
    expect(tally).toEqual({ actors: 4, bonds: 5, items: 3, failed: 1 });
    expect(delta._source.system.notes).toContain('<p>Base.</p><h3>E20.BondsHeading</h3>');
    expect(delta._source.items).toEqual([]);
    expect(rebuildFails._source.items).toEqual([]);
    expect(rebuildFails._source.system.notes).toContain('data-e20-bond="b6"');
    expect(Item.deleteDocuments).toHaveBeenCalledWith(['loose', 'named']);
    // The loose Bonds with something in them are kept in one Journal Entry; an empty default "Bond" isn't.
    expect(JournalEntry.create).toHaveBeenCalledTimes(1);
    expect(page.text.content).toContain('Sworn friends');
    expect(page.text.content).toContain('Packed rivalry');
    expect(page.text.content).not.toContain('data-e20-bond="loose"');
    expect(Item.deleteDocuments).toHaveBeenCalledWith(['i1'], { pack: 'world.items' });
    expect(itemPack.configure.mock.calls).toEqual([[{ locked: false }], [{ locked: true }]]);
    expect(actorPack.getDocument).toHaveBeenCalledTimes(1);
    expect(actorPack.configure).not.toHaveBeenCalled();
    expect(systemPack.getIndex).not.toHaveBeenCalled();
    expect(otherSystem.getIndex).not.toHaveBeenCalled();
    expect(ui.notifications.info).toHaveBeenCalledWith(expect.stringContaining('E20.BondsRetired'), { permanent: true });
  });
});
