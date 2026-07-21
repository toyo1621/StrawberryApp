import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustDeadlineByTicks, remainingTicksAt } from '../src/domain/gameTimer';

test('remainingTicksAt derives tenths from an absolute deadline', () => {
  assert.equal(remainingTicksAt(31_000, 1_000), 300);
  assert.equal(remainingTicksAt(1_099, 1_000), 1);
  assert.equal(remainingTicksAt(1_000, 1_000), 0);
  assert.equal(remainingTicksAt(900, 1_000), 0);
});

test('remainingTicksAt catches up after a delayed interval', () => {
  const deadline = 30_000;
  assert.equal(remainingTicksAt(deadline, 10_450), 196);
  assert.equal(remainingTicksAt(deadline, 35_000), 0);
});

test('adjustDeadlineByTicks applies bonuses and penalties exactly', () => {
  assert.equal(adjustDeadlineByTicks(10_000, 10), 11_000);
  assert.equal(adjustDeadlineByTicks(10_000, -30), 7_000);
  assert.equal(adjustDeadlineByTicks(10_000, 2.9), 10_200);
});
