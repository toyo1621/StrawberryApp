# Deployment

## Cloudflare Rankings API

The app stores rankings in Cloudflare D1 through a Worker API.

1. Log in to Cloudflare with Wrangler.

```bash
npx wrangler login
```

2. Create the D1 database.

```bash
npx wrangler d1 create strawberry-rankings
```

3. Copy the generated `database_id` into `worker/wrangler.toml`.

4. Apply the schema.

```bash
npm run d1:apply-schema
```

5. Deploy the Worker.

```bash
npm run worker:deploy
```

6. Set the web app environment variable.

```bash
EXPO_PUBLIC_RANKINGS_API_URL=https://strawberry-rankings-api.toyo1621.workers.dev
```

## Migrating Existing Supabase Rankings

Export from Supabase without committing secrets:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_ANON_KEY=your-key \
npm run export:supabase
```

Create the D1 import SQL:

```bash
npm run write:d1-import
```

Import into remote D1:

```bash
npm run d1:import
```

The generated files `rankings-export.json` and `rankings-import.sql` are ignored by git.

## GitHub Pages

GitHub Pages is deployed from GitHub Actions. Set the repository variable or secret
`EXPO_PUBLIC_RANKINGS_API_URL` to the Worker URL before deploying.

The public URL is:

```text
https://toyo1621.github.io/StrawberryApp/
```
