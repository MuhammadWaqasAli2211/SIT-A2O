> **Branch:** `development` — last updated 2026-08-19

# Project Summary

## What this is

An automation platform for Saylani Mass IT Training's bootcamp recruitment
pipeline, replacing a manual process (phone calls, Excel sheets, hand-written
emails) with a role-based, deadline-driven workflow that runs from application
submission through to Agilytic onboarding.

## The problem

Recruiting a bootcamp intake currently means:

- collecting applications by hand and re-keying them into spreadsheets
- calling candidates individually to schedule interviews
- tracking who passed which stage across disconnected documents
- emailing each cohort manually at every step

This does not scale past a few hundred applicants, and it loses candidates
between stages because no single record follows a person end to end.

## The approach

One record per application, carrying a stable candidate code (`B07-001`) from
first submission through to onboarding. Four gated phases, each opened and
closed by an admin, each with a deadline the server enforces. Every stage change
is logged.

## Who uses it

| Role | Scope | Does |
|------|-------|------|
| `SUPER_ADMIN` | Everything | Monitors all bootcamps and admins, global analytics, provisions admins |
| `ADMIN` | One bootcamp | Opens/closes registration, sets deadlines, batches interviews, selects candidates, triggers emails |
| `CANDIDATE` | Own application | Applies, tracks status, receives links, fills forms |

## Status

Phase 1 — authentication and the application shell — is built and tested. The
recruitment pipeline itself is not yet implemented. See `project-status.md`.
