'use strict';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createOrderPoints(options = {}) {
  const max = Number.isInteger(options.max) && options.max >= 0 ? options.max : 5;
  const current = Number.isInteger(options.current) && options.current >= 0 ? clamp(options.current, 0, max) : 0;
  return Object.freeze({ format: 'rpchess-order-points', current, max });
}

function gainOrderPoints(pool, amount, reason = 'unspecified') {
  if (!pool || pool.format !== 'rpchess-order-points') throw new TypeError('invalid order point pool');
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError('order point gain must be a non-negative integer');
  const next = createOrderPoints({ current: pool.current + amount, max: pool.max });
  return Object.freeze({
    pool: next,
    changedBy: next.current - pool.current,
    reason
  });
}

function spendOrderPoints(pool, amount, reason = 'unspecified') {
  if (!pool || pool.format !== 'rpchess-order-points') throw new TypeError('invalid order point pool');
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError('order point cost must be a non-negative integer');
  if (pool.current < amount) throw new Error(`not enough order points: ${pool.current}/${amount}`);
  const next = createOrderPoints({ current: pool.current - amount, max: pool.max });
  return Object.freeze({ pool: next, changedBy: -amount, reason });
}

function resetOrderPoints(pool, current = 0) {
  if (!pool || pool.format !== 'rpchess-order-points') throw new TypeError('invalid order point pool');
  return createOrderPoints({ current, max: pool.max });
}

module.exports = { createOrderPoints, gainOrderPoints, spendOrderPoints, resetOrderPoints };
