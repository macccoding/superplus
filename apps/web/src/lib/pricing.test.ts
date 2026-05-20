import assert from 'node:assert/strict';
import { calculateGrossProfit, calculateMarkupPercent, calculateRetailPrice, getMarginWarning, roundRetailPrice } from './pricing';

assert.equal(calculateRetailPrice(100, 30), 130);
assert.equal(calculateRetailPrice(0, 30), 0);
assert.equal(calculateMarkupPercent(100, 130), 30);
assert.equal(calculateMarkupPercent(0, 130), 0);
assert.equal(calculateGrossProfit(100, 130), 30);

assert.equal(roundRetailPrice(130.126, 'cents'), 130.13);
assert.equal(roundRetailPrice(130.49, 'nearest-dollar'), 130);
assert.equal(roundRetailPrice(130.01, 'charm'), 130.99);

assert.equal(getMarginWarning(0, 10), 'zero-cost');
assert.equal(getMarginWarning(100, 90), 'negative');
assert.equal(getMarginWarning(100, 105), 'low');
assert.equal(getMarginWarning(100, 130), 'none');

console.log('Pricing tests passed');
