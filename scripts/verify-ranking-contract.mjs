import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  API_GAME_TYPES,
  ISLAND_REGIONS,
  RANKING_PERIODS,
} from './generated/rankingContract.mjs';

const root = resolve(import.meta.dirname, '..');
const expectedRegions = [...ISLAND_REGIONS].sort();
const requireValue = (condition, message) => {
  if (!condition) {
    throw new Error(`Ranking contract verification failed: ${message}`);
  }
};

const extractCheckSets = (sql, column) => {
  const expression = new RegExp(`CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)\\s*\\)`, 'gi');
  return [...sql.matchAll(expression)].map((match) => (
    [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]).sort()
  ));
};

const verifyRegionChecks = (path, minimumChecks) => {
  const checks = extractCheckSets(readFileSync(path, 'utf8'), 'island_region');
  requireValue(checks.length >= minimumChecks, `${path} has too few island_region constraints.`);
  checks.forEach((values) => {
    requireValue(
      JSON.stringify(values) === JSON.stringify(expectedRegions),
      `${path} island regions differ from contracts/rankings.json.`,
    );
  });
};

verifyRegionChecks(resolve(root, 'worker/schema.sql'), 2);
const migrationsDirectory = resolve(root, 'worker/migrations');
const migrations = readdirSync(migrationsDirectory)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
requireValue(migrations.length > 0, 'No D1 migrations were found.');
const regionMigration = [...migrations].reverse().find((migration) => (
  extractCheckSets(readFileSync(resolve(migrationsDirectory, migration), 'utf8'), 'island_region').length >= 2
));
requireValue(regionMigration, 'No migration defines the current island region constraints.');
verifyRegionChecks(resolve(migrationsDirectory, regionMigration), 2);
requireValue(API_GAME_TYPES.length === 4, 'All four game types must remain explicit.');
requireValue(RANKING_PERIODS[0] === 'all', 'The all-time period must remain the default.');

console.log(
  `Ranking contract verified: ${API_GAME_TYPES.length} game types, `
  + `${ISLAND_REGIONS.length} regions, ${RANKING_PERIODS.length} periods, latest ${migrations.at(-1)}.`,
);
