export const GAME_TICK_MS = 100;

export const remainingTicksAt = (
  deadlineMs: number,
  nowMs: number,
  tickMs: number = GAME_TICK_MS,
): number => {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs) || tickMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.ceil((deadlineMs - nowMs) / tickMs));
};

export const adjustDeadlineByTicks = (
  deadlineMs: number,
  deltaTicks: number,
  tickMs: number = GAME_TICK_MS,
): number => {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(deltaTicks) || tickMs <= 0) {
    return deadlineMs;
  }

  return deadlineMs + Math.trunc(deltaTicks) * tickMs;
};
