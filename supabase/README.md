# Database migrations

Schema is managed with the Supabase CLI. The SQL files here are the source of
truth; the SQLAlchemy models in `backend/app/models/` mirror them by hand and
must be updated alongside any change.

```bash
supabase link --project-ref cfffgnynzqmdzcgljuhx
supabase db push          # apply pending migrations
supabase migration new <name>
```
