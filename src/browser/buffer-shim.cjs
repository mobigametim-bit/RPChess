'use strict';

if (!globalThis.Buffer) {
  globalThis.Buffer = Object.freeze({
    from(value) {
      if (typeof value === 'string') return new TextEncoder().encode(value);
      if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
      return Uint8Array.from(value || []);
    },
    isBuffer(value) {
      return value instanceof Uint8Array;
    }
  });
}

module.exports = globalThis.Buffer;
