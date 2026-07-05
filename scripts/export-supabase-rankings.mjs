import { writeFile } from 'node:fs/promises';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const outputPath = process.argv[2] || 'rankings-export.json';

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY are required.');
  process.exit(1);
}

const endpoint = new URL('/rest/v1/rankings', supabaseUrl);
endpoint.searchParams.set('select', 'id,player_name,score,game_type,created_at');
endpoint.searchParams.set('order', 'created_at.asc');

const rows = [];
const pageSize = 1000;

for (let offset = 0; ; offset += pageSize) {
  const response = await fetch(endpoint, {
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
      range: `${offset}-${offset + pageSize - 1}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase export failed: ${response.status} ${body}`);
  }

  const page = await response.json();
  rows.push(...page);

  if (page.length < pageSize) {
    break;
  }
}

await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`Exported ${rows.length} ranking rows to ${outputPath}`);
