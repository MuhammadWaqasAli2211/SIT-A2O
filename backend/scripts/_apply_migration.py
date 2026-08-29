"""One-off: apply a migration directly over the pooler connection.

The Supabase CLI is not linked in this environment (see
docs/development-logs.md, 2026-08-19), so migrations are applied this way and
recorded in the ledger so a future `supabase db push` will not re-run them.

Usage: python -m scripts._apply_migration <version> <name>
"""

import pathlib
import sys

from sqlalchemy import text

from app.db.session import get_engine

version, name = sys.argv[1], sys.argv[2]
path = next(
    (pathlib.Path(__file__).resolve().parents[2] / "supabase" / "migrations").glob(f"{version}*.sql")
)
sql = path.read_text(encoding="utf-8")
print("applying:", path.name)

engine = get_engine()
with engine.begin() as conn:
    conn.execute(text(sql))
    conn.execute(
        text(
            "insert into supabase_migrations.schema_migrations (version, name) "
            "values (:version, :name) on conflict (version) do nothing"
        ),
        {"version": version, "name": name},
    )
    print("applied and recorded")
