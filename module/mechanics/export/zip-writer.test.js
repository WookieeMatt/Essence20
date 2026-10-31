import { crc32, zipFiles } from './zip-writer.mjs';

const decoder = new TextDecoder();

/** Read a stored zip back through its central directory. */
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054B50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = [];
  for (let n = 0; n < count; n++) {
    expect(view.getUint32(at, true)).toBe(0x02014B50);
    expect(view.getUint16(at + 8, true)).toBe(0x0800);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.slice(at + 46, at + 46 + nameLength));

    expect(view.getUint32(offset, true)).toBe(0x04034B50);
    expect(view.getUint16(offset + 8, true)).toBe(0);
    const localName = view.getUint16(offset + 26, true);
    const data = bytes.slice(offset + 30 + localName, offset + 30 + localName + size);
    expect(crc32(data)).toBe(crc);
    files.push({ name, data, time: view.getUint16(at + 12, true), date: view.getUint16(at + 14, true) });
    at += 46 + nameLength;
  }

  return files;
}

test('CRC-32 matches the standard check value', () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
});

test('files go in stored, under their paths, text as UTF-8', () => {
  const zip = zipFiles([
    { path: 'my-mod/module.json', data: '{"id":"my-mod"}' },
    { path: 'my-mod/assets/Bild über.png', data: Uint8Array.of(137, 80, 78, 71) },
    { path: 'my-mod/empty.txt', data: '' },
  ], new Date(2026, 9, 30, 13, 45, 10));
  const files = readZip(zip);
  expect(files.map(file => file.name)).toEqual(['my-mod/module.json', 'my-mod/assets/Bild über.png', 'my-mod/empty.txt']);
  expect(decoder.decode(files[0].data)).toBe('{"id":"my-mod"}');
  expect([...files[1].data]).toEqual([137, 80, 78, 71]);
  expect(files[2].data.length).toBe(0);
  expect(files[0].time).toBe((13 << 11) | (45 << 5) | 5);
  expect(files[0].date).toBe(((2026 - 1980) << 9) | (10 << 5) | 30);
});

test('an empty zip is just the end record', () => {
  expect(zipFiles([]).length).toBe(22);
});

test('too many files for a plain zip is refused', () => {
  expect(() => zipFiles(new Array(0xFFFF).fill({ path: 'a', data: '' }))).toThrow(/too many/);
});
