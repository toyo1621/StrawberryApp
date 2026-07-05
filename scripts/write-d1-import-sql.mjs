import { readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const inputPath = process.argv[2] || 'rankings-export.json';
const outputPath = process.argv[3] || 'rankings-import.sql';
const rows = JSON.parse(await readFile(inputPath, 'utf8'));

const escapeSql = (value) => String(value).replaceAll("'", "''");
const toInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const statements = [
  'BEGIN TRANSACTION;',
];

for (const row of rows) {
  const id = row.id || crypto.randomUUID();
  const playerName = String(row.player_name || '').trim();
  const gameType = row.game_type || 'strawberry_rush';
  const createdAt = row.created_at || new Date().toISOString();

  if (!playerName) {
    continue;
  }

  statements.push(
    [
      'INSERT OR IGNORE INTO rankings (id, player_name, score, game_type, created_at) VALUES (',
      `'${escapeSql(id)}', `,
      `'${escapeSql(playerName)}', `,
      `${toInteger(row.score)}, `,
      `'${escapeSql(gameType)}', `,
      `'${escapeSql(createdAt)}'`,
      ');',
    ].join(''),
  );
}

statements.push('COMMIT;');

await writeFile(outputPath, `${statements.join('\n')}\n`);
console.log(`Wrote ${Math.max(statements.length - 2, 0)} D1 import statements to ${outputPath}`);
