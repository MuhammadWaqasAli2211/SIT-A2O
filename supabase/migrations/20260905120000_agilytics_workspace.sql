-- The Agilytics workspace an intake was provisioned into.
--
-- Agilytics is the post-onboarding system: once a candidate's paperwork is
-- done they become a member of a workspace there, and their learning
-- progress lives on that side. Provisioning is one call that creates the
-- workspace, its tracks and its members together, and it answers with a
-- `workspaceId` we have no other way of recovering — their API offers no
-- lookup by name. Both of the remaining endpoints (onboarding-status,
-- bulk-invite) are addressed by that id, so an id we failed to keep is an
-- intake that can never be read or invited again.
--
-- Nullable, and null is meaningful: it is exactly "this intake has not been
-- provisioned yet", which is what the HR Assessment screen shows and what
-- stops a second provisioning call from silently creating a duplicate
-- workspace. Their provisioning endpoint is not idempotent — calling it
-- twice makes two workspaces — so this column is the guard.
--
-- Text rather than uuid: it is an opaque identifier minted by another system.
-- Their examples are UUID-shaped today, but nothing in their contract
-- promises that, and a type error on a value we only ever echo back to them
-- would be a self-inflicted outage.
alter table public.bootcamps
    add column if not exists agilytics_workspace_id text;

comment on column public.bootcamps.agilytics_workspace_id is
    'Workspace id returned by Agilytics POST /api/v1/external/workspaces. '
    'Null means this intake has not been provisioned. Opaque to us: stored '
    'only to address their onboarding-status and bulk-invite endpoints.';
