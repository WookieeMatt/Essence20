import { crc32c, levelDbFiles, logFile, maskCrc, newDatabaseEdit, writeBatch } from './leveldb-writer.mjs';

const decoder = new TextDecoder();

/** Read a log file back: checks every record's checksum and joins fragments. */
function readLog(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = [];
  const types = [];
  let pending = [];
  let at = 0;
  while (at + 7 <= bytes.length) {
    const blockLeft = 32768 - (at % 32768);
    if (blockLeft < 7) {
      at += blockLeft;
      continue;
    }

    const crc = view.getUint32(at, true);
    const length = bytes[at + 4] | (bytes[at + 5] << 8);
    const type = bytes[at + 6];
    const checked = bytes.slice(at + 6, at + 7 + length);
    expect(crc).toBe(maskCrc(crc32c(checked)));
    types.push(type);
    pending.push(bytes.slice(at + 7, at + 7 + length));
    if (type == 1 || type == 4) {
      const total = pending.reduce((sum, part) => sum + part.length, 0);
      const out = new Uint8Array(total);
      let o = 0;
      for (const part of pending) {
        out.set(part, o);
        o += part.length;
      }

      records.push(out);
      pending = [];
    }

    at += 7 + length;
  }

  return { records, types };
}

function readVarint(bytes, at) {
  let value = 0;
  let scale = 1;
  let i = at;
  for (;;) {
    const byte = bytes[i++];
    value += (byte & 0x7F) * scale;
    if (byte < 0x80) {
      return [value, i];
    }

    scale *= 0x80;
  }
}

/** A write batch's sequence, count and [key, value] strings. */
function readBatch(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sequence = view.getUint32(0, true) + view.getUint32(4, true) * 0x100000000;
  const count = view.getUint32(8, true);
  const entries = [];
  let at = 12;
  for (let n = 0; n < count; n++) {
    expect(bytes[at]).toBe(1);
    let length;
    [length, at] = readVarint(bytes, at + 1);
    const key = decoder.decode(bytes.slice(at, at + length));
    at += length;
    [length, at] = readVarint(bytes, at);
    entries.push([key, decoder.decode(bytes.slice(at, at + length))]);
    at += length;
  }

  expect(at).toBe(bytes.length);
  return { sequence, count, entries };
}

test('CRC-32C matches the standard check value', () => {
  expect(crc32c(new TextEncoder().encode('123456789'))).toBe(0xE3069283);
  expect(crc32c(new Uint8Array())).toBe(0);
});

test('masking is LevelDB\'s rotate-and-add', () => {
  expect(maskCrc(0)).toBe(0xA282EAD8);
  expect(maskCrc(0xFFFFFFFF)).toBe((0xFFFFFFFF + 0xA282EAD8) >>> 0);
});

test('a small record is one FULL record', () => {
  const { records, types } = readLog(logFile([Uint8Array.of(1, 2, 3)]));
  expect(types).toEqual([1]);
  expect([...records[0]]).toEqual([1, 2, 3]);
});

test('a record longer than a block is split FIRST / MIDDLE / LAST across blocks', () => {
  const big = new Uint8Array(80000).map((_, i) => i % 251);
  const bytes = logFile([big]);
  const { records, types } = readLog(bytes);
  expect(types).toEqual([2, 3, 4]);
  expect(records[0]).toEqual(big);
});

test('a block tail too short for a header is zero-filled and the next record starts a new block', () => {
  // 32768 - 7 - 32755 leaves 6 bytes.
  const bytes = logFile([new Uint8Array(32755), Uint8Array.of(9)]);
  expect([...bytes.slice(32762, 32768)]).toEqual([0, 0, 0, 0, 0, 0]);
  expect(bytes[32768 + 6]).toBe(1);
  expect(readLog(bytes).records.map(record => record.length)).toEqual([32755, 1]);
});

test('the write batch puts every entry from sequence 1, keys and values as UTF-8', () => {
  const batch = readBatch(writeBatch([['!items!a', '{"name":"Ü"}'], ['!items.effects!a.b', 'x'.repeat(300)]]));
  expect(batch).toMatchObject({ sequence: 1, count: 2 });
  expect(batch.entries).toEqual([['!items!a', '{"name":"Ü"}'], ['!items.effects!a.b', 'x'.repeat(300)]]);
});

test('the version edit names the bytewise comparator, log 0, next file 4 and last sequence 0', () => {
  const edit = newDatabaseEdit();
  expect(edit[0]).toBe(1);
  expect(decoder.decode(edit.slice(2, 2 + edit[1]))).toBe('leveldb.BytewiseComparator');
  expect([...edit.slice(2 + edit[1])]).toEqual([2, 0, 9, 0, 3, 4, 4, 0]);
});

test('a database is CURRENT, its manifest and the log holding one batch', () => {
  const files = levelDbFiles([['!items!a', '{}']]);
  expect(Object.keys(files).sort()).toEqual(['000003.log', 'CURRENT', 'MANIFEST-000002']);
  expect(decoder.decode(files.CURRENT)).toBe('MANIFEST-000002\n');
  expect(readLog(files['MANIFEST-000002']).records[0]).toEqual(newDatabaseEdit());
  expect(readBatch(readLog(files['000003.log']).records[0]).entries).toEqual([['!items!a', '{}']]);
  expect(levelDbFiles([])['000003.log'].length).toBe(0);
});

test('large varints and sequences encode past 32 bits', () => {
  const big = 'k'.repeat(20000);
  const batch = readBatch(writeBatch([[big, big]]));
  expect(batch.entries[0][0].length).toBe(20000);
});
