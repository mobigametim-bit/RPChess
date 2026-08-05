'use strict';

class MemoryKeyValueStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial).map(([key, value]) => [String(key), String(value)]));
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  getItem(key) {
    const value = this.values.get(String(key));
    return value === undefined ? null : value;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }

  clear() {
    this.values.clear();
  }

  snapshot() {
    return Object.freeze(Object.fromEntries(this.values));
  }
}

function assertStorageAdapter(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new Error('storage adapter must implement getItem, setItem and removeItem');
  }
  return storage;
}

module.exports = {
  MemoryKeyValueStorage,
  assertStorageAdapter
};
