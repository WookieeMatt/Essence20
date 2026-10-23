import { jest } from '@jest/globals';
import { addStatBlockControl, canCopyStatBlock, copyText, statBlockText } from './stat-block-share.mjs';
import { parseStatBlock } from '../../importers/stat-block-parser.mjs';

/** Copy Stat Block (stat-block-share.mjs): the ⋮ menu entry, and text another table's importer reads back. */

describe('the sheet menu entry', () => {
  test('on NPCs, Zords and vehicles the user owns; not on characters', () => {
    const controls = [];
    const npc = { type: 'npc', isOwner: true, name: 'Goldar' };
    addStatBlockControl({ document: npc }, controls);
    expect(controls).toEqual([expect.objectContaining({ label: 'E20.StatBlockCopy', action: 'essence20CopyStatBlock' })]);
    expect(controls[0].visible()).toBe(true);
    npc.isOwner = false;
    expect(controls[0].visible()).toBe(false);

    const none = [];
    addStatBlockControl({ document: { type: 'playerCharacter' } }, none);
    addStatBlockControl({}, none);
    expect(none).toEqual([]);
    expect(['npc', 'zord', 'vehicle', 'companion', 'megaform'].map(type => canCopyStatBlock({ type }))).toEqual([true, true, true, false, false]);
  });
});

describe('the text', () => {
  test("a Threat Builder state: the Builder's IR, printed - and the importer reads it back", async () => {
    const ir = {
      name: 'Squatt', threatLevel: 2, size: 'common', health: 3, conditioning: 0,
      essences: { strength: 3, speed: 2, smarts: 1, social: 1 }, defenses: { toughness: 13, evasion: 12, willpower: 11, cleverness: 11 },
      movement: { ground: 30 }, languages: [], skills: [], perks: [], powers: [], hangUps: [], attacks: [], equipment: [],
    };
    const text = await statBlockText({ name: 'Squatt' }, { threatIr: () => ir });
    expect(text).toContain('Squatt');
    const back = parseStatBlock(text);
    expect(back.ir ?? back).toEqual(expect.objectContaining({ name: 'Squatt' }));
  });

  test('an unnamed Builder state gets a placeholder name; nothing gives no text', async () => {
    const text = await statBlockText({}, { threatIr: () => ({ name: '', essences: {}, defenses: {}, movement: {}, skills: [], perks: [], powers: [], hangUps: [], attacks: [], equipment: [], languages: [] }) });
    expect(text).toContain('Threat');
    expect(await statBlockText(null)).toBe('');
  });

  // The clipboard is handed in: Node's own `navigator` differs by version (none before 21), so the global isn't patched.
  test('copying: true when the clipboard takes it, false when the browser refuses or there is no clipboard', async () => {
    const writeText = jest.fn(async () => {});
    expect(await copyText('x', { writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith('x');
    const refuse = async () => {
      throw new Error('no');
    };

    expect(await copyText('x', { writeText: jest.fn(refuse) })).toBe(false);
    expect(await copyText('x', {})).toBe(false);
    expect(await copyText('x', null)).toBe(false);
  });
});
