import { jest } from '@jest/globals';

const createActorFromStatBlock = jest.fn();
// A real stat block's IR (the parser's own), so the Grow maths runs for real.
const { parseStatBlock } = await import('../../importers/stat-block-parser.mjs');
const SPIKEBALL = parseStatBlock(['Spikeball', 'THREAT LEVEL: 6', 'SIZE: COMMON | HEALTH: 6', 'GROUND MOVEMENT: 40ft',
  'STRENGTH: 5 | SPEED: 4', 'SMARTS: 2 | SOCIAL: 1', 'TOUGHNESS: 15 | EVASION: 14', 'WILLPOWER: 12 | CLEVERNESS: 11',
  'SKILLS', 'Initiative +d4', 'Might +d6', 'ATTACKS', 'Spines (Might): +d6, Reach (2 Sharp damage)'].join('\n'));
const actorToIr = jest.fn(() => JSON.parse(JSON.stringify(SPIKEBALL)));
jest.unstable_mockModule('./settings.js', () => ({ getGameLine: () => 'powerRangers' }));
jest.unstable_mockModule('./importers/stat-block-import.mjs', () => ({ actorToIr, createActorFromStatBlock }));
const { THREAT_API_VERSION, auditActor, createThreat, growThreat, linkedForm, newThreatState, partyLevels, threatApi } = await import('./threat-api.mjs');

/** A stand-in Actor: flags, update, and a sheet whose drop handler records what was dropped. */
function makeActor(id, { flags = {}, type = 'npc', folder = null } = {}) {
  const actor = {
    id, type, folder, flags: { essence20: { ...flags } }, dropped: [],
    getFlag: (scope, key) => actor.flags[scope]?.[key],
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags[scope][key] = value; 
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags[scope][key]; 
    }),
    update: jest.fn(async () => actor),
    sheet: { _onDropItem: jest.fn(async (event, document) => actor.dropped.push(document.name)) },
    system: { threatLevel: 6, health: { max: 6 } },
    items: [],
  };
  return actor;
}

beforeEach(() => {
  createActorFromStatBlock.mockReset();
  global.game = { i18n: { localize: key => key, format: key => key }, actors: { get: () => null, party: null } };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), escapeHTML: text => text.replace(/</g, '&lt;') } };
  global.DragEvent = class {
    constructor(type) {
      this.type = type; 
    } 
  };
  global.fromUuid = jest.fn(async uuid => ({ name: `doc:${uuid}` }));
});

describe('game.essence20.threats', () => {
  test('partyLevels: the Party members\' levels, rounded average, level 1 for an empty party', () => {
    expect(partyLevels({ name: 'Rangers', members: [{ system: { level: 3 } }, { system: { level: 4 } }] })).toMatchObject({ name: 'Rangers', levels: [3, 4], average: 4, count: 2 });
    expect(partyLevels(null)).toMatchObject({ levels: [], average: 1, count: 0, appropriate: null });
  });

  test('newState: pitched at the party for its role, overrides kept', () => {
    const rival = newThreatState({}, { gameLine: 'powerRangers', partyLevel: 5 });
    expect([rival.role, rival.tl, rival.ruleset, rival.type]).toEqual(['leader', 5, 'fieldGuide', 'typical']);
    const mastermind = newThreatState({ role: 'mastermind', ruleset: 'finster', name: 'Goldar' }, { gameLine: 'powerRangers', partyLevel: 5 });
    expect([mastermind.tl, mastermind.ruleset, mastermind.name]).toEqual([7, 'finster', 'Goldar']);
    expect(newThreatState({ role: 'lackey', tl: 9 }, { partyLevel: 5 }).tl).toBe(9);
    expect(newThreatState({}, { gameLine: 'myLittlePony', partyLevel: 1 }).ruleset).toBe('canterlot');
  });

  test('create: the importer makes it, the build is remembered, the concept is its bio, drops go through the sheet', async () => {
    const made = makeActor('m1');
    createActorFromStatBlock.mockResolvedValue(made);
    const state = newThreatState({ name: 'Spikeball', concept: 'A <sea-urchin> bruiser', ruleset: 'finster', type: 'resilient', tl: 6,
      quickPerks: [{ key: 'health' }], dropped: [{ uuid: 'Compendium.x.Item.a', name: 'Club' }] }, { partyLevel: 6 });
    const actor = await createThreat(state, { folder: 'f1' });
    expect(actor).toBe(made);
    const [ir, options] = createActorFromStatBlock.mock.calls[0];
    expect(options).toEqual({ type: 'npc', folder: 'f1' });
    expect(ir.name).toBe('Spikeball');
    expect(made.update).toHaveBeenCalledWith({
      'flags.essence20.threatBuild': { ruleset: 'finster', type: 'resilient', social: false, advanced: 0, animal: false, vehicleAi: false, healthPerks: 1 },
      'system.biography.bio': '<p>A &lt;sea-urchin> bruiser</p>',
    });
    expect(made.dropped).toEqual(['doc:Compendium.x.Item.a']);
  });

  test('create: a vehicle rule set makes a vehicle; no name is refused; a failed import is null', async () => {
    createActorFromStatBlock.mockResolvedValue(makeActor('v1', { type: 'vehicle' }));
    await createThreat({ name: 'Tank', ruleset: 'vehicle', tl: 4 });
    expect(createActorFromStatBlock.mock.calls[0][1].type).toBe('vehicle');
    await expect(createThreat({ name: ' ' })).rejects.toThrow(/needs a name/);
    createActorFromStatBlock.mockResolvedValue(null);
    expect(await createThreat({ name: 'Nobody', tl: 1 })).toBeNull();
  });

  test('grow: makes the Grown form in the same folder and links the pair', async () => {
    const normal = makeActor('n1', { folder: { id: 'f2' } });
    const grown = makeActor('g1');
    createActorFromStatBlock.mockResolvedValue(grown);
    expect(await growThreat(normal, { tlIncrease: 4, newSize: 'titanic' })).toBe(grown);
    const [ir, options] = createActorFromStatBlock.mock.calls[0];
    expect(options).toEqual({ type: 'npc', folder: 'f2' });
    expect([ir.threatLevel, ir.size]).toEqual([10, 'titanic']);
    expect([normal.flags.essence20.grownFormId, grown.flags.essence20.normalFormId]).toEqual(['g1', 'n1']);
  });

  test('grow: refused while the actor has a living other form; a stale link does not block it', async () => {
    const partner = makeActor('g0');
    global.game.actors.get = id => (id == 'g0' ? partner : null);
    const normal = makeActor('n1', { flags: { grownFormId: 'g0' } });
    expect(linkedForm(normal)).toBe(partner);
    expect(await growThreat(normal)).toBeNull();
    expect(createActorFromStatBlock).not.toHaveBeenCalled();

    global.game.actors.get = () => null;
    expect(linkedForm(normal)).toBeNull();
    createActorFromStatBlock.mockResolvedValue(makeActor('g1'));
    expect((await growThreat(normal))?.id).toBe('g1');
    expect(await growThreat(null)).toBeNull();
  });

  test('audit: the Threat Builder\'s findings for an actor', () => {
    const findings = auditActor(makeActor('a1'), { ruleset: 'finster' });
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.every(finding => typeof finding.key == 'string' && finding.level)).toBe(true);
  });

  test('the API object: versioned, frozen, the builder passed in as open, the pure rules alongside', () => {
    const open = jest.fn();
    const api = threatApi(open);
    expect(api.version).toBe(THREAT_API_VERSION);
    expect(Object.isFrozen(api)).toBe(true);
    api.open('x');
    expect(open).toHaveBeenCalledWith('x');
    expect(Object.keys(api.rules.RULESETS)).toEqual(expect.arrayContaining(['fieldGuide', 'finster', 'canterlot', 'vehicle']));
    expect(api.rules.threatLevelForRole('lieutenant', 4)).toBe(5);
  });
});
