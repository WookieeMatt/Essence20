/**
 * A brand-new LevelDB database as plain files, for a compendium pack built in the browser (Export Homebrew,
 * apps/homebrew-export.mjs). Foundry stores every pack as LevelDB and a system can't run its database code, so this
 * writes what LevelDB itself writes for a new database holding one write batch:
 * - CURRENT, naming the manifest;
 * - MANIFEST-000002, one version edit (the bytewise comparator, log 0, next file 4, last sequence 0);
 * - 000003.log, the write log holding every key. LevelDB replays it into tables the first time Foundry opens the pack.
 *
 * Formats: leveldb's doc/log_format.md (32 KiB blocks of checksummed records) and db/write_batch.cc, version_edit.cc.
 * Import-free: jest runs it as is.
 */

const BLOCK_SIZE = 32768;
const HEADER_SIZE = 7;
const FULL = 1;
const FIRST = 2;
const MIDDLE = 3;
const LAST = 4;

const MANIFEST = 'MANIFEST-000002';
const LOG = '000003.log';

const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0x82F63B78 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

/**
 * CRC-32C (Castagnoli), as LevelDB checksums its records.
 * @param {Uint8Array} bytes
 * @returns {Number}
 */
export function crc32c(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc = CRC32C_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** LevelDB stores a record's CRC masked, so a CRC of data holding CRCs isn't mistaken for one. */
export const maskCrc = crc => ((((crc >>> 15) | (crc << 17)) >>> 0) + 0xA282EAD8) >>> 0;

/** A growable byte buffer. */
class Bytes {
  constructor() {
    this.parts = [];
    this.length = 0;
  }

  push(bytes) {
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  byte(value) {
    this.push(Uint8Array.of(value & 0xFF));
  }

  /** Unsigned varint, as LevelDB's PutVarint32/64 (safe to 2^53). */
  varint(value) {
    const out = [];
    let v = value;
    while (v >= 0x80) {
      out.push((v % 0x80) | 0x80);
      v = Math.floor(v / 0x80);
    }

    out.push(v);
    this.push(Uint8Array.from(out));
  }

  fixed32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0, true);
    this.push(out);
  }

  fixed64(value) {
    const out = new Uint8Array(8);
    const view = new DataView(out.buffer);
    view.setUint32(0, value % 0x100000000, true);
    view.setUint32(4, Math.floor(value / 0x100000000), true);
    this.push(out);
  }

  /** A varint length, then the bytes. */
  slice(bytes) {
    this.varint(bytes.length);
    this.push(bytes);
  }

  toUint8Array() {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const part of this.parts) {
      out.set(part, at);
      at += part.length;
    }

    return out;
  }
}

// Made when used: settings.js loads this, and jsdom test environments have no TextEncoder.
const utf8 = value => (value instanceof Uint8Array ? value : new TextEncoder().encode(String(value)));

/**
 * Records in LevelDB's log format: each split across 32 KiB blocks, a block's tail too short for a header zero-filled.
 * @param {Array<Uint8Array>} records
 * @returns {Uint8Array}
 */
export function logFile(records) {
  const out = new Bytes();
  let offset = 0;
  for (const record of records) {
    let at = 0;
    let left = record.length;
    let begin = true;
    do {
      const leftover = BLOCK_SIZE - offset;
      if (leftover < HEADER_SIZE) {
        if (leftover > 0) {
          out.push(new Uint8Array(leftover));
        }

        offset = 0;
      }

      const available = BLOCK_SIZE - offset - HEADER_SIZE;
      const length = Math.min(left, available);
      const end = length == left;
      const type = begin && end ? FULL : begin ? FIRST : end ? LAST : MIDDLE;
      const fragment = record.subarray(at, at + length);

      const checked = new Uint8Array(length + 1);
      checked[0] = type;
      checked.set(fragment, 1);
      out.fixed32(maskCrc(crc32c(checked)));
      out.byte(length & 0xFF);
      out.byte(length >>> 8);
      out.byte(type);
      out.push(fragment);

      offset += HEADER_SIZE + length;
      at += length;
      left -= length;
      begin = false;
    } while (left > 0);
  }

  return out.toUint8Array();
}

/**
 * One write batch putting every entry, from sequence 1.
 * @param {Array<[String|Uint8Array, String|Uint8Array]>} entries   [key, value] pairs.
 * @returns {Uint8Array}
 */
export function writeBatch(entries) {
  const out = new Bytes();
  out.fixed64(1);
  out.fixed32(entries.length);
  for (const [key, value] of entries) {
    out.byte(1); // kTypeValue
    out.slice(utf8(key));
    out.slice(utf8(value));
  }

  return out.toUint8Array();
}

/** The version edit a new database starts from. */
export function newDatabaseEdit() {
  const out = new Bytes();
  out.varint(1); // kComparator
  out.slice(utf8('leveldb.BytewiseComparator'));
  out.varint(2); // kLogNumber
  out.varint(0);
  out.varint(9); // kPrevLogNumber
  out.varint(0);
  out.varint(3); // kNextFileNumber
  out.varint(4);
  out.varint(4); // kLastSequence
  out.varint(0);
  return out.toUint8Array();
}

/**
 * The files of a new LevelDB database holding these entries, by file name.
 * @param {Array<[String, String]>} entries   [key, value] pairs; values already serialised (Foundry stores JSON).
 * @returns {Object<String, Uint8Array>}
 */
export function levelDbFiles(entries) {
  return {
    CURRENT: utf8(`${MANIFEST}\n`),
    [MANIFEST]: logFile([newDatabaseEdit()]),
    [LOG]: logFile(entries.length ? [writeBatch(entries)] : []),
  };
}
