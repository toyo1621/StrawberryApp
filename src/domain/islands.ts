import { ISLANDS } from '../data/islands';
import { Island, IslandRegion } from '../types';

export type IslandRegionOption = {
  value: IslandRegion;
  label: string;
};

export const ISLAND_REGION_OPTIONS: readonly IslandRegionOption[] = [
  { value: IslandRegion.ALL, label: '日本全国' },
  { value: IslandRegion.HOKKAIDO_TOHOKU, label: '北海道・東北' },
  { value: IslandRegion.KANTO, label: '関東' },
  { value: IslandRegion.CHUBU_KINKI, label: '中部・近畿' },
  { value: IslandRegion.CHUGOKU, label: '中国' },
  { value: IslandRegion.SHIKOKU, label: '四国' },
  { value: IslandRegion.KYUSHU_NORTH, label: '九州北部' },
  { value: IslandRegion.KYUSHU_SOUTH, label: '九州南部' },
  { value: IslandRegion.OKINAWA, label: '沖縄' },
];

export const getIslandsForRegion = (region: IslandRegion): readonly Island[] => (
  region === IslandRegion.ALL
    ? ISLANDS
    : region === IslandRegion.KYUSHU
      ? ISLANDS.filter((island) => (
          island.region === IslandRegion.KYUSHU_NORTH
          || island.region === IslandRegion.KYUSHU_SOUTH
        ))
    : ISLANDS.filter((island) => island.region === region)
);

export const getIslandRegionLabel = (region: IslandRegion): string => (
  region === IslandRegion.KYUSHU
    ? '旧九州'
    : ISLAND_REGION_OPTIONS.find((option) => option.value === region)?.label ?? '日本全国'
);

export type IslandRound = {
  choices: [Island, Island];
  correctIndex: 0 | 1;
  targetIsland: Island;
};

const randomIndex = (length: number, random: () => number): number => (
  Math.min(length - 1, Math.floor(random() * length))
);

export const createIslandRound = (
  pool: readonly Island[],
  random: () => number = Math.random,
): IslandRound => {
  if (pool.length < 2) {
    throw new Error('Island mode requires at least two islands.');
  }

  const firstIndex = randomIndex(pool.length, random);
  const secondOffset = randomIndex(pool.length - 1, random);
  const secondIndex = secondOffset >= firstIndex ? secondOffset + 1 : secondOffset;
  const choices: [Island, Island] = [pool[firstIndex], pool[secondIndex]];
  const correctIndex = randomIndex(2, random) as 0 | 1;

  return {
    choices,
    correctIndex,
    targetIsland: choices[correctIndex],
  };
};
