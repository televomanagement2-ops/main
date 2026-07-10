# Tools

This project uses the **Supabase CLI** for database migrations, type generation
and Edge Function deploys. The CLI binary is **not** bundled with the template —
install it yourself:

- **Recommended (already in `devDependencies`):**

  ```bash
  npm install        # installs the `supabase` dev dependency
  npx supabase --version
  ```

- **Or install globally** following the official guide:
  <https://supabase.com/docs/guides/cli>

  - macOS/Linux: `brew install supabase/tap/supabase`
  - Windows: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`

## Common commands

```bash
npx supabase login                     # authenticate the CLI
npx supabase link --project-ref <ref>  # link this repo to your project
npx supabase db push                   # apply supabase/migrations/*
npx supabase functions deploy          # deploy all Edge Functions
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

See `supabase/SETUP_CHECKLIST.md` and `docs/03_supabase_setup.md` for the full
setup walkthrough.
