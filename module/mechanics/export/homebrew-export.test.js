import {
  assetPlan, assetRefs, isLocalAsset, moduleFiles, moduleHouseRule, moduleIdFrom, moduleManifest, packEntries, packFoldersFor,
  repointAssets, validVersion,
} from './homebrew-export.mjs';

const parsed = entries => Object.fromEntries(entries.map(([key, json]) => [key, JSON.parse(json)]));

test('a module id comes from its name; versions are digits and dots', () => {
  expect(moduleIdFrom('M.A.S.K. Homebrew!')).toBe('mask-homebrew');
  expect(moduleIdFrom('  ThunderCats  HO ')).toBe('thundercats-ho');
  expect(validVersion('1.0.0')).toBe(true);
  expect(validVersion('2')).toBe(true);
  expect(validVersion('1.0-beta')).toBe(false);
  expect(validVersion('')).toBe(false);
});

test('items and their effects are keyed as the Foundry CLI keys them', () => {
  const entries = parsed(packEntries('items', [
    { _id: 'i1', name: 'Mask', folder: 'f1', effects: [{ _id: 'e1', name: 'Glow' }] },
    { _id: 'i2', name: 'Loose', folder: 'gone' },
  ], [{ _id: 'f1', name: 'Masks', folder: 'outside', type: 'Item' }]));
  expect(Object.keys(entries)).toEqual(['!folders!f1', '!items.effects!i1.e1', '!items!i1', '!items!i2']);
  expect(entries['!items!i1']).toEqual({ _id: 'i1', name: 'Mask', folder: 'f1', effects: ['e1'] });
  expect(entries['!items!i2']).toMatchObject({ folder: null, effects: [] });
  expect(entries['!folders!f1'].folder).toBeNull();
  expect(entries['!items.effects!i1.e1']).toEqual({ _id: 'e1', name: 'Glow' });
});

test('nested collections and a single embedded document go a level deeper', () => {
  const entries = parsed(packEntries('scenes', [{
    _id: 's1', tokens: [{ _id: 't1', delta: { _id: 'd1', items: [{ _id: 'x1', effects: [] }] } }, { _id: 't2' }],
  }]));
  expect(entries['!scenes!s1'].tokens).toEqual(['t1', 't2']);
  expect(entries['!scenes.tokens!s1.t1'].delta).toBe('d1');
  expect(entries['!scenes.tokens!s1.t2'].delta).toBeNull();
  expect(entries['!scenes.tokens.delta!s1.t1.d1'].items).toEqual(['x1']);
  expect(entries['!scenes.tokens.delta.items!s1.t1.d1.x1']).toEqual({ _id: 'x1', effects: [] });
});

test('a hierarchy can be given (the running Foundry\'s)', () => {
  const entries = parsed(packEntries('scenes', [{ _id: 's1', regions: [{ _id: 'r1', behaviors: [{ _id: 'b1' }] }] }], [], {
    scenes: { regions: [] }, regions: { behaviors: [] },
  }));
  expect(entries['!scenes!s1'].regions).toEqual(['r1']);
  expect(entries['!scenes.regions.behaviors!s1.r1.b1']).toEqual({ _id: 'b1' });
});

test('pack folders nest as in the world, at most three deep, colours only when set', () => {
  const a = { id: 'a', name: 'M.A.S.K.', color: '#cc0000', sorting: 'm' };
  const b = { id: 'b', name: 'Agents' };
  expect(packFoldersFor([
    { name: 'perks', folders: [a] },
    { name: 'agents', folders: [a, b] },
    { name: 'deep', folders: [a, b, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }] },
    { name: 'top', folders: [] },
  ])).toEqual([{
    name: 'M.A.S.K.', sorting: 'm', color: '#cc0000', packs: ['perks'], folders: [{
      name: 'Agents', sorting: 'a', packs: ['agents'], folders: [{ name: 'C', sorting: 'a', packs: ['deep'], folders: [] }],
    }],
  }]);
});

test('only the world\'s own media files count as assets', () => {
  expect(isLocalAsset('worlds/dev/art/rhino.webp')).toBe(true);
  expect(isLocalAsset('art/Matt%20Trakker.png?v=2')).toBe(true);
  expect(isLocalAsset('/assets/theme.ogg')).toBe(true);
  for (const value of ['systems/essence20/assets/x.png', 'icons/svg/mystery-man.svg', 'modules/other/a.png', 'https://x.org/a.png',
    'data:image/png;base64,AAA', 'notes.txt', '', null, 42, 'a <b>.png']) {
    expect(isLocalAsset(value)).toBe(false);
  }
});

test('assets are found in fields and inside HTML, once each, and repointed into the module', () => {
  const docs = [
    { img: 'worlds/dev/art/rhino.webp', system: { description: '<p><img src="worlds/dev/art/rhino.webp"> <a href="maps/map%201.jpg">map</a> <img src="icons/svg/d20.svg"></p>' } },
    { img: 'systems/essence20/x.png', prototypeToken: { texture: { src: 'tokens/rhino.webp' } }, list: ['worlds/old/art/rhino.webp'] },
  ];
  const refs = assetRefs(docs);
  expect(refs).toEqual(['worlds/dev/art/rhino.webp', 'maps/map%201.jpg', 'tokens/rhino.webp', 'worlds/old/art/rhino.webp']);

  const plan = assetPlan(refs, 'my-mod');
  expect(plan.get('worlds/dev/art/rhino.webp')).toEqual({ ref: 'modules/my-mod/assets/art/rhino.webp', zipPath: 'my-mod/assets/art/rhino.webp' });
  expect(plan.get('maps/map%201.jpg')).toEqual({ ref: 'modules/my-mod/assets/maps/map%201.jpg', zipPath: 'my-mod/assets/maps/map 1.jpg' });
  // Same path from another world: numbered.
  expect(plan.get('worlds/old/art/rhino.webp')).toEqual({ ref: 'modules/my-mod/assets/art/rhino-2.webp', zipPath: 'my-mod/assets/art/rhino-2.webp' });

  const moved = repointAssets(docs, plan);
  expect(moved[0].img).toBe('modules/my-mod/assets/art/rhino.webp');
  expect(moved[0].system.description).toBe('<p><img src="modules/my-mod/assets/art/rhino.webp"> <a href="modules/my-mod/assets/maps/map%201.jpg">map</a> <img src="icons/svg/d20.svg"></p>');
  expect(moved[1]).toEqual({ img: 'systems/essence20/x.png', prototypeToken: { texture: { src: 'modules/my-mod/assets/tokens/rhino.webp' } }, list: ['modules/my-mod/assets/art/rhino-2.webp'] });
  expect(docs[0].img).toBe('worlds/dev/art/rhino.webp');
  expect(repointAssets(7, plan)).toBe(7);
});

test('a bad path escape is kept as written', () => {
  expect(assetPlan(['art/100%.png'], 'm').get('art/100%.png').zipPath).toBe('m/assets/art/100%.png');
  expect(assetPlan(['worlds/dev/assets/scenes/a.webp'], 'm').get('worlds/dev/assets/scenes/a.webp').ref).toBe('modules/m/assets/scenes/a.webp');
});

test('the manifest needs the system, lists the packs and carries lines, house rules and settings as flags', () => {
  const manifest = moduleManifest({
    id: 'mask', title: 'M.A.S.K.', version: '1.2.0', author: 'GM', description: '<p>Hi</p>',
    core: { generation: 14, version: '14.368' }, systemVersion: '6.1.0',
    packs: [{ name: 'perks', label: 'Perks', type: 'Item' }, { name: 'tables', label: 'Tables', type: 'RollTable' }],
    packFolders: [{ name: 'M.A.S.K.', sorting: 'a', packs: ['perks'], folders: [] }],
    gameLines: [{ id: 'mask', label: 'M.A.S.K.', family: 'giJoe' }],
    houseRules: [moduleHouseRule({ id: 'hr1', label: 'Fast', rules: [{ type: 'RollModifier' }], world: true, extra: 1 })],
    settings: { episodeTools: true },
  });
  expect(manifest).toMatchObject({
    id: 'mask', title: 'M.A.S.K.', version: '1.2.0', authors: [{ name: 'GM' }],
    compatibility: { minimum: '14', verified: '14.368' },
    relationships: { systems: [{ id: 'essence20', type: 'system', compatibility: { minimum: '6.1.0' } }] },
    packFolders: [{ name: 'M.A.S.K.' }],
    flags: { essence20: { gameLines: [{ id: 'mask' }], houseRules: [{ id: 'hr1', label: 'Fast', hint: '', rules: [{ type: 'RollModifier' }] }], settings: { episodeTools: true } } },
  });
  expect(manifest.flags.essence20.houseRules[0]).not.toHaveProperty('world');
  expect(manifest.packs).toEqual([
    { name: 'perks', label: 'Perks', path: 'packs/perks', type: 'Item', system: 'essence20', ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' } },
    { name: 'tables', label: 'Tables', path: 'packs/tables', type: 'RollTable', ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' } },
  ]);

  const bare = moduleManifest({ id: 'x', title: 'X', version: '1', core: { generation: 14, version: '14.1' }, systemVersion: '6', packs: [] });
  expect(bare).not.toHaveProperty('flags');
  expect(bare).not.toHaveProperty('packFolders');
  expect(bare.authors).toEqual([]);
  // A development checkout's placeholder version isn't a requirement.
  expect(moduleManifest({ id: 'x', title: 'X', version: '1', core: { generation: 14, version: '14.1' }, systemVersion: 'This is auto replaced', packs: [] })
    .relationships.systems[0]).toEqual({ id: 'essence20', type: 'system' });
});

test('the module\'s files: manifest, readme, a database per pack, and the copied assets', () => {
  const manifest = { id: 'mask' };
  const plan = assetPlan(['art/a.png'], 'mask');
  const files = moduleFiles(manifest, [{ name: 'perks', collection: 'items', documents: [{ _id: 'i1', img: 'art/a.png' }], folders: [] }], {
    plan, assets: [{ zipPath: 'mask/assets/art/a.png', data: Uint8Array.of(1) }], readme: '# M',
  });
  expect(files.map(file => file.path)).toEqual([
    'mask/module.json', 'mask/README.md', 'mask/packs/perks/CURRENT', 'mask/packs/perks/MANIFEST-000002', 'mask/packs/perks/000003.log',
    'mask/assets/art/a.png',
  ]);
  expect(JSON.parse(files[0].data)).toEqual({ id: 'mask' });
  const log = new TextDecoder().decode(files[4].data);
  expect(log).toContain('modules/mask/assets/art/a.png');
  expect(log).not.toContain('"art/a.png"');
  expect(moduleFiles(manifest, []).map(file => file.path)).toEqual(['mask/module.json']);
});
