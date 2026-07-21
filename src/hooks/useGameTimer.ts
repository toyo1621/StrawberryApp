import { useCallback, useEffect, useRef, useState } from 'react';
import { adjustDeadlineByTicks, GAME_TICK_MS, remainingTicksAt } from '../domain/gameTimer';

type GameTimerOptions = {
  initialTicks: number;
  maximumDurationTicks: number;
  onExpire: () => void;
};

type GameTimer = {
  adjustTime: (deltaTicks: number) => void;
  gameEnded: boolean;
  gameEndedRef: React.MutableRefObject<boolean>;
  timeLeft: number;
};

export const useGameTimer = ({ initialTicks, maximumDurationTicks, onExpire }: GameTimerOptions): GameTimer => {
  const [timeLeft, setTimeLeft] = useState(initialTicks);
  const [gameEnded, setGameEnded] = useState(false);
  const deadlineRef = useRef(0);
  const hardDeadlineRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameEndedRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (gameEndedRef.current) {
      return;
    }

    gameEndedRef.current = true;
    setGameEnded(true);
    setTimeLeft(0);
    stopInterval();
    onExpireRef.current();
  }, [stopInterval]);

  const updateTime = useCallback(() => {
    const remaining = remainingTicksAt(Math.min(deadlineRef.current, hardDeadlineRef.current), Date.now());
    setTimeLeft((current) => current === remaining ? current : remaining);
    if (remaining === 0) {
      finish();
    }
  }, [finish]);

  useEffect(() => {
    const startedAt = Date.now();
    deadlineRef.current = startedAt + initialTicks * GAME_TICK_MS;
    hardDeadlineRef.current = startedAt + maximumDurationTicks * GAME_TICK_MS;
    intervalRef.current = setInterval(updateTime, GAME_TICK_MS);

    return stopInterval;
  }, [initialTicks, maximumDurationTicks, stopInterval, updateTime]);

  const adjustTime = useCallback((deltaTicks: number) => {
    if (gameEndedRef.current || !Number.isFinite(deltaTicks)) {
      return;
    }

    deadlineRef.current = Math.min(
      adjustDeadlineByTicks(deadlineRef.current, deltaTicks),
      hardDeadlineRef.current,
    );
    updateTime();
  }, [updateTime]);

  return { adjustTime, gameEnded, gameEndedRef, timeLeft };
};
