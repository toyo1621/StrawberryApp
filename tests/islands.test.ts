import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ISLANDS } from '../src/data/islands';
import {
  createIslandRound,
  getIslandRegionLabel,
  getIslandsForRegion,
  ISLAND_REGION_OPTIONS,
} from '../src/domain/islands';
import { IslandRegion } from '../src/types';

const EXPECTED_REGION_COUNTS: Record<IslandRegion, number> = {
  [IslandRegion.ALL]: 415,
  [IslandRegion.HOKKAIDO_TOHOKU]: 18,
  [IslandRegion.KANTO]: 16,
  [IslandRegion.CHUBU_KINKI]: 25,
  [IslandRegion.CHUGOKU]: 89,
  [IslandRegion.SHIKOKU]: 72,
  [IslandRegion.KYUSHU_NORTH]: 90,
  [IslandRegion.KYUSHU_SOUTH]: 59,
  [IslandRegion.KYUSHU]: 149,
  [IslandRegion.OKINAWA]: 46,
};
const EXPECTED_DATASET_SHA256 = '3b8e1692f78551782767d19e344a7d639bd7e9d7e33860737dc3d9072155a8fa';

test('the island catalog contains all 415 normalized records and SVGs', () => {
  assert.equal(ISLANDS.length, 415);
  assert.equal(new Set(ISLANDS.map((island) => island.id)).size, 415);
  assert.equal(new Set(ISLANDS.map((island) => island.file)).size, 415);
  assert.equal(
    new Set(ISLANDS.map((island) => `${island.prefecture}/${island.name}`)).size,
    415,
  );

  const islandAssetDirectory = path.resolve('src/assets/islands');
  const allSvgAssets = readdirSync(islandAssetDirectory)
    .filter((file) => file.endsWith('.svg'))
    .sort();
  const importedAssets = allSvgAssets
    .filter((file) => /^island-\d{3}\.svg$/.test(file));
  assert.equal(importedAssets.length, 415);
  assert.deepEqual(allSvgAssets, importedAssets, 'Only normalized island SVGs may remain.');

  for (const island of ISLANDS) {
    assert.ok(island.name);
    assert.ok(island.prefecture);
    assert.ok(island.municipality);
    assert.ok(!['奈川県', '歌山県', '児島県'].includes(island.prefecture));

    const assetPath = path.join(islandAssetDirectory, island.file);
    assert.equal(existsSync(assetPath), true, `${island.file} must exist`);
    const svg = readFileSync(assetPath, 'utf8');
    assert.match(svg, /^<svg[^>]+viewBox=['"]0 0 1024 1024['"][^>]*>/);
    assert.match(svg, /<path[^>]+d=['"][^'"]+['"][^>]*\/>/);
  }
});

test('the normalized island catalog and SVG collection match the reviewed dataset fingerprint', () => {
  const hash = createHash('sha256');
  for (const island of ISLANDS) {
    hash.update(JSON.stringify(island));
    hash.update('\n');
    hash.update(readFileSync(path.resolve('src/assets/islands', island.file)));
  }
  assert.equal(hash.digest('hex'), EXPECTED_DATASET_SHA256);
});

test('island regions use the requested order and contain only their own records', () => {
  assert.deepEqual(
    ISLAND_REGION_OPTIONS.map((option) => option.label),
    ['日本全国', '北海道・東北', '関東', '中部・近畿', '中国', '四国', '九州北部', '九州南部', '沖縄'],
  );

  for (const option of ISLAND_REGION_OPTIONS) {
    const pool = getIslandsForRegion(option.value);
    assert.equal(pool.length, EXPECTED_REGION_COUNTS[option.value]);
    assert.ok(pool.length >= 2);
    if (option.value !== IslandRegion.ALL) {
      assert.ok(pool.every((island) => island.region === option.value));
    }
  }
});

test('Kyushu is split by prefecture while preserving the legacy 149-island pool', () => {
  const north = getIslandsForRegion(IslandRegion.KYUSHU_NORTH);
  const south = getIslandsForRegion(IslandRegion.KYUSHU_SOUTH);
  const legacy = getIslandsForRegion(IslandRegion.KYUSHU);

  assert.deepEqual(
    [...new Set(north.map((island) => island.prefecture))],
    ['福岡県', '佐賀県', '長崎県'],
  );
  assert.deepEqual(
    [...new Set(south.map((island) => island.prefecture))],
    ['熊本県', '大分県', '宮崎県', '鹿児島県'],
  );
  assert.deepEqual(
    legacy.map((island) => island.id),
    [...north, ...south].map((island) => island.id),
  );
  assert.equal(getIslandRegionLabel(IslandRegion.KYUSHU), '旧九州');
});

test('island rounds always contain two different choices and target one of them', () => {
  const pool = getIslandsForRegion(IslandRegion.KANTO);
  const randomValues = [0, 0, 0.99];
  let randomIndex = 0;
  const round = createIslandRound(pool, () => randomValues[randomIndex++]);

  assert.notEqual(round.choices[0].id, round.choices[1].id);
  assert.equal(round.correctIndex, 1);
  assert.equal(round.targetIsland, round.choices[1]);
});

test('island round generation rejects an unusable pool', () => {
  assert.throws(
    () => createIslandRound(ISLANDS.slice(0, 1)),
    /requires at least two islands/,
  );
});
