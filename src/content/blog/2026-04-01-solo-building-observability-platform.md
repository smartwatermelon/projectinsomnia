---
title: "I Solo-Built a Production Observability Platform. Then I Got Laid Off by Email."
date: 2026-04-01
description: "How one sentence of requirements became a full-stack data platform — Python, FastAPI, Streamlit, SQLite, Kubernetes — built solo over 5 months at Oracle Health. Then 30,000 of us got the same email."
tags: ["pinned", "python", "kubernetes", "sqlite", "fastapi", "streamlit", "oracle"]
---

Last week I was part of Oracle's widely-reported reduction of approximately 30,000 positions. I got the news the same way everyone else did: by email. This is a project I built during my time there — a [Principal SRE](https://www.linkedin.com/in/andrewrich/) working solo on something that started with a single sentence and grew into a production platform processing over 11 million records.

I'm writing this partly because it's technically interesting, and partly because the project will never ship its next sprint.

---

## The Brief

"It would be nice for leadership to get pageout metrics."

That was the entire spec. No design doc. No team. No budget for additional tooling. The organization ran an on-call communication platform comparable to PagerDuty — it handled scheduling, escalation policies, and page delivery across voice, SMS, email, and push. Thousands of pages per day, hundreds of teams. But there was no way to answer basic questions: How are our communications performing? What's the average acknowledgement time? Which teams get paged most? Are people actually accepting their pages?

The platform had an API with data export capabilities, but no built-in analytics. The data lived behind an authenticated API that returned CSV reports — sometimes hundreds of megabytes — that nobody was looking at.

I spent the next five months turning that sentence into a production observability platform: two data pipelines, a REST API, an interactive analytics dashboard, automated CI/CD, and infrastructure across three Kubernetes environments.

---

## Architecture Decisions

### SQLite Over PostgreSQL

The first counterintuitive choice. SQLite for production?

**Zero operational overhead.** No database pod to manage, no connection pooling, no credential rotation, no backup jobs. The entire database is a single file on shared NFS storage. For a solo maintainer, this matters enormously.

**Read patterns favor it.** The write workload is batch-only — CronJobs running once or twice daily. All other access is read-only. SQLite handles concurrent reads well and serves queries in single-digit milliseconds with proper indexing.

**The cost was real**, and I'll get into it. NFS file locking and SQLite are not friends.

### Streamlit Over Grafana

The original plan was Grafana with a custom JSON datasource. I built the Grafana integration first — a 7-panel dashboard with time series, gauges, pie charts, and tables. It worked beautifully in local testing.

Then I discovered the required Grafana plugin wasn't available on the corporate-managed instance, and installing it required a change request through a different team with an unknown timeline.

I rebuilt the entire dashboard in Streamlit in one day. What emerged was actually better: interactive cascading filters across seven levels of org hierarchy, URL-persistent state, per-person analytics with escalation history, and data export. None of which Grafana's plugin model could have matched.

I kept the Grafana-compatible REST API anyway. It cost nothing to maintain and gave teams running self-hosted Grafana an integration path.

### Separate Pipelines, Separate Databases

The system consumes two different data exports:

1. **Pageout data** (~34,000 records, 30-day retention): who was paged, when, via what channel, did they respond
2. **Notification data** (~11.3 million records, 395-day retention): the full escalation chain — every notification sent during an incident, including purpose, provider, and response

Separate databases to avoid write contention. The pageout DB is small and fast; the notification DB is large and append-heavy. Different retention, different refresh frequencies, different query patterns.

---

## What I Built

**Data collection**: A reporter service that authenticates via JWT, requests data exports, polls for completion, and streams multi-hundred-megabyte CSVs directly to disk. A user lookup system that enriches ~167,000 user records with a 7-day cache. A team membership mapper that queries over 6,500 teams, filters to the ~200 relevant operational groups, and builds login-to-team mappings with deterministic conflict resolution.

**Dual ETL pipelines**: Each goes through nine stages — CSV parsing, derived metric calculation (response time, acknowledgement time), user name enrichment, team assignment, on-call group membership, manager chain resolution via live API, SQLite deduplication, data retention pruning, and schema migration. The notification pipeline processes ~58,000 aggregated rows per day from ~467,000 raw records.

**REST API**: FastAPI implementing the Grafana JSON datasource protocol. Nine metric types. Separate lightweight health endpoint for Kubernetes probes — no database access, because NFS can stall and you don't want your liveness probe timing out on a file lock.

**Interactive dashboard**: A 2,800-line Streamlit application with seven-level cascading org hierarchy filters, four independent navigation entry points (presets, top-down, bottom-up search, team roster), bidirectional hierarchy population, URL persistence with validation and DoS prevention, and a unified escalation history view across both databases.

**Infrastructure**: Six containers across three environments, all non-root with dropped capabilities. Two Helm charts. Pull-based deployment via CronJobs polling the Docker registry every two minutes — because Jenkins build agents couldn't reach the Kubernetes API server. A CI/CD pipeline with build, promote-to-cert, and promote-to-prod stages.

**A resumable backfill engine** with JSON manifest tracking, adaptive chunk sizing, parallel workers, and NFS-safe staging: isolated database for large backfills, merged into production in 50,000-row batches on completion. This successfully backfilled six months of historical data.

---

## The Hard Problems

### SQLite on NFS: A Five-Act Tragedy

NFS advisory locks are not reliable. This is documented, widely known, and something I learned through pain anyway.

The symptom: `database is locked` errors crashing CronJobs at unpredictable intervals. File locking that works perfectly on local disk fails silently on NFS, corrupting concurrent writes or surfacing stale lock state.

The solution evolved through five iterations over multiple months:

**Act 1: Timeouts.** Set `timeout=30` on connections. Bought time but didn't solve the underlying problem — NFS advisory locks could hold indefinitely.

**Act 2: Local copies.** Copy the database to `/tmp`, read from the local copy. This fixed reads but didn't help writes. And stale copies are their own category of bug.

**Act 3: Immutable mode.** Open read-only connections with `immutable=1` URI parameter. This eliminates all lock operations for readers — SQLite doesn't even attempt advisory locks. The dashboard and API switched to this immediately.

**Act 4: `unix-none` VFS.** For write connections, bypass POSIX locking entirely using SQLite's `unix-none` VFS. This is safe *only* because Kubernetes `concurrencyPolicy: Forbid` guarantees a single writer at any time. If you're reaching for this solution, you need iron-clad single-writer guarantees or you will corrupt your database.

**Act 5: Never replace.** Learned during the notification data backfill: never replace a database file on NFS. Don't write to a staging file and rename it over the production file. NFS rename semantics are not what you think. Always merge data into the existing file. Always.

The final architecture: writers use `unix-none` VFS, readers use `immutable=1`, and the file itself is never replaced — only written into. It's been stable in production since deployment.

### The Download Button Saga

Streamlit's `st.download_button` generates blob URLs stored in the pod's in-memory `MediaFileManager`. In a multi-pod Kubernetes deployment, the download request may hit a different pod than the one that generated the blob.

This problem consumed 15 commits over several weeks (related: [streamlit/streamlit#8932](https://github.com/streamlit/streamlit/issues/8932)). Approaches that didn't work: session state caching, forced reruns, `@st.fragment` decorators, dynamic keys, data hash keys, two separate Streamlit version upgrades, and multiple download patterns.

The solution: encode the data as base64 and embed it directly in the HTML response, bypassing MediaFileManager entirely. Zero server-side state. The two-stage UX (Prepare, then Download) is slightly clunky but works reliably regardless of which pod serves the request.

The lesson is general: any Streamlit feature that stores state in process memory will break under horizontal scaling. If you're deploying Streamlit behind a load balancer, audit every widget for server-side state assumptions.

### Memory Management at Scale

Notification CSVs can exceed 2 GB. Containers have 512 MiB to 1 GiB memory limits. You cannot load these into memory.

The solution is a cascade of constraints, each independently necessary:

- **Stream HTTP responses to disk** — never buffer the full CSV in memory
- **Chunked CSV reading** via pandas `chunksize` (100,000 rows per chunk)
- **Explicit `gc.collect()`** between chunks — CPython's garbage collector doesn't always keep up with rapid allocation/deallocation of large DataFrames
- **Aggregate during read** — compute summary statistics per chunk, never accumulate raw data
- **HEAD request before download** to estimate response size and skip reports that won't fit
- **20 GB database size safety limit** with 75% early warning

The backfill engine adds another layer: an isolated staging database on local storage (not NFS) for large imports, merged into the production database in 50,000-row batches after completion. This avoids both the memory problem and the NFS locking problem simultaneously.

---

## By the Numbers

| Metric | Value |
|--------|-------|
| Duration | 5 months (Oct 2025 – Mar 2026) |
| Git commits | 351 |
| Pull requests | 114 |
| Python production code | ~8,000 lines |
| Test code | ~6,300 lines (80%+ coverage) |
| Implementation specs | 15 |
| Containers in production | 6 |
| Environments | 3 (dev, cert, prod) |
| Pageout records | ~34,000 |
| Notification records | ~11.3 million |

---

## What I'd Do Differently

**Start with the notification data.** Pageout data tells you *what happened*. Notification data tells you *the full story* — every escalation step, every delivery attempt, every response. I built the pageout pipeline first because it was simpler, but the notification data is where the real insights live. I should have tackled it earlier.

**Accept SQLite's limitations sooner.** I spent weeks fighting NFS locking before arriving at the `unix-none` VFS + `immutable` reader pattern. The right answer was always "avoid file locking entirely." I just took too long to accept that NFS advisory locks were fundamentally broken for this use case.

**Design for filter complexity.** The seven-level cascading org hierarchy filter system works, but it's a 2,800-line monolith. A tab-based decomposition was designed in the final week but never implemented. Interactive filtering is harder than visualization. Budget more time for it.

**Push back on the solo model.** I'm proud of what one person can build in five months. I'm also aware that a bus factor of one is not a compliment. The system was production-ready and actively used. There was no succession plan, no runbook handoff, no second pair of eyes on any of the 114 PRs. When the layoff email arrived, the system's institutional knowledge walked out with me.

---

## What's Next

The final commit landed March 29 at 10:57 PM — PR #114, adaptive parallel backfill. The dashboard redesign spec was written. The next sprint was planned. The system was running in production.

Two days later, I was reading the same email as 30,000 other people.

I'm currently exploring what's next. If you're working on observability, data platforms, or infrastructure and want to talk, I'm at [andrew@projectinsomnia.com](mailto:andrew@projectinsomnia.com) or on [LinkedIn](https://www.linkedin.com/in/andrewrich/).
