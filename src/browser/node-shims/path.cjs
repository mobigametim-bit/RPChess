'use strict';

function normalizeParts(values) {
  const parts = [];
  for (const value of values) {
    for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
  }
  return parts;
}

function join(...values) {
  return normalizeParts(values).join('/');
}

function resolve(...values) {
  return `/${join(...values)}`;
}

function basename(value) {
  const parts = normalizeParts([value]);
  return parts.at(-1) || '';
}

module.exports = Object.freeze({
  sep: '/',
  join,
  resolve,
  basename,
  posix: Object.freeze({ join, resolve, basename })
});
