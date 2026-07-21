import { GameMode } from './types';

const SECOND_IN_TICKS = 10;

const BASE_RULES = {
  initialTimeTicks: 30 * SECOND_IN_TICKS,
  dangerThresholdTicks: 10 * SECOND_IN_TICKS,
  penaltyTicks: 3 * SECOND_IN_TICKS,
  regularPoints: 1,
} as const;

export const GAMEPLAY_RULES = {
  [GameMode.STRAWBERRY]: {
    ...BASE_RULES,
    regularTimeBonusTicks: 0,
    streak: { startsAt: 2, timeBonusTicks: 5 },
    fever: { thresholdTicks: BASE_RULES.dangerThresholdTicks, specialChanceMultiplier: 10 },
    shortCake: { chance: 0.03, points: 3, timeBonusTicks: 2 * SECOND_IN_TICKS },
    wholeCake: { chance: 0.01, points: 5, timeBonusTicks: 5 * SECOND_IN_TICKS },
  },
  [GameMode.ISLAND]: {
    ...BASE_RULES,
    regularTimeBonusTicks: 3,
    golden: { chance: 0.03, points: 3, timeBonusTicks: 1 * SECOND_IN_TICKS },
  },
  [GameMode.FLAG]: {
    ...BASE_RULES,
    regularTimeBonusTicks: 1 * SECOND_IN_TICKS,
  },
  [GameMode.COLOR]: {
    ...BASE_RULES,
    regularTimeBonusTicks: 1 * SECOND_IN_TICKS,
  },
} as const;

export const ticksToSeconds = (ticks: number): number => ticks / SECOND_IN_TICKS;
