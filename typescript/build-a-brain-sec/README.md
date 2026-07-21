# Build a brain from a public dataset — SEC EDGAR

The universal recipe for turning a **public corpus into a specialized brain** that
any agent can consume over MCP — and that you can list in the MemMesh catalog.

This is exactly how the **SEC finance brain** was built: the one that **matches
GPT-4o on the public benchmark at ~2.6x lower cost**. Swap the dataset adapter
for your domain and the rest is unchanged.

> Reference financial figures extracted from SEC filings. **NOT investment advice.**

---

## The pattern (5 steps)

Every "specialized brain from public knowledge" build is the same shape. A brain
is just *metadata over a project's memory*, so building one is:

| # | Step | In this example | The call |
| - | ---- | --------------- | -------- |
| 1 | **Fetch public data** | SEC EDGAR XBRL company facts | `GET data.sec.gov/api/xbrl/companyfacts/CIK…` |
| 2 | **Shape into memories** | one grounded fact per (company × concept × fiscal year) | build `{ type, content, metadata, … }` items |
| 3 | **Bulk-ingest** | POST facts to your project in batches of 200 | `POST /api/v1/projects/:id/memory/bulk` |
| 4 | **Register + publish a brain** | provenance + license + computed coverage on a Brain Card, flipped `PUBLISHED` + `PUBLIC` | `tf.brains.create` → `tf.brains.update` |
| 5 | **Consume it** | over the hosted MCP endpoint / the federation router | MCP connection (not a REST call) |

**To build a brain for *your* domain, replace step 1–2** (the `fetchSecFacts`
adapter) with your source — drug labels, case law, a product catalog, internal
runbooks — and steps 3–5 don't change.

---

## Run it

Prereqs:

- A MemMesh **API key with `WRITE_MEMORY` + `WRITE_BRAIN`** (Platform Admin → API Keys).
- A **project id** to hold the brain's memory.
- A **`SEC_USER_AGENT`** — SEC fair-access requires every automated client to
  identify itself, or `data.sec.gov` returns 403.

```bash
export MEMMESH_API_KEY=sk-...
export MEMMESH_PROJECT_ID=proj_...
export SEC_USER_AGENT="Your Name your@email.com"

npm install
npm start -- --limit=25          # cover the top 25 companies
```

Flags:

| Flag | Default | Meaning |
| ---- | ------- | ------- |
| `--limit=<n>` | `25` | companies to cover (each yields several facts × years) |
| `--years=<n>` | `5` | years of annual (10-K) history per concept |
| `--dry-run` | off | fetch + shape + print a sample and the would-be card; **write nothing** |

Try it with **no keys** first — `--dry-run` needs only `SEC_USER_AGENT`:

```bash
SEC_USER_AGENT="Your Name your@email.com" npm start -- --dry-run --limit=3 --years=2
```

You'll see real facts shaped straight out of EDGAR, e.g.
`NVIDIA CORP (NVDA) — Revenue, FY2022: $26.91B [10-K]`, and the exact Brain Card
the publish step would submit.

---

## What each step looks like in `index.ts`

**Shape (step 2)** — one memory item per grounded, dated figure, so multi-year
and trend questions resolve to a specific, cited number:

```ts
{
  type: 'fact',
  source: 'admin_created',          // lands CONFIRMED — searchable immediately
  scope: 'project',
  content: 'NVIDIA CORP (NVDA) — Revenue, FY2022: $26.91B [10-K]',
  validFrom: '2022-01-30T00:00:00.000Z',
  metadata: { subject: { kind: 'company', externalId: 'NVDA' }, concept: 'Revenue',
              fiscalYear: 2022, source: 'SEC EDGAR', license: 'public-domain', … },
}
```

**Bulk-ingest (step 3)** — the one call the SDK doesn't cover, so it's a plain
authenticated `fetch`. `/bulk` reports partial success, so one bad record never
sinks a batch:

```ts
await fetch(`${BASE_URL}/api/v1/projects/${PROJECT_ID}/memory/bulk`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ items }),           // up to 1000 per request
})
```

**Register + publish (step 4)** — via the SDK. A Brain Card must declare a
`domain` and at least one licensed provenance source to be listed publicly;
coverage is computed from what you actually ingested (never fabricated):

```ts
const brain = await tf.brains.create({
  externalId: 'sec-financial-facts',
  name: 'SEC Financial Facts',
  domain: 'finance',
  version: '1.0.0',
  visibility: 'PUBLIC',
  card: {
    provenance: [{ source: 'SEC EDGAR — XBRL company facts', license: 'Public domain (U.S. Government work)' }],
    coverage: { subjects, facts, reasoning: { total: 0 }, freshness: 'T-0' },
    disclaimer: 'Reference financial figures extracted from SEC filings. NOT investment advice.',
  },
})
await tf.brains.update(brain.id, { status: 'PUBLISHED' })
```

**Consume (step 5)** — once `PUBLISHED` + `PUBLIC`, the brain is addressable by
its `externalId` over the hosted MCP endpoint
(`…/brains/{brainId}/mcp-server/http`) and through the federation router. That's
a live MCP connection any agent can point at — not a REST call.

---

## Why a brain beats a raw dataset (and the next step)

This example ingests **facts only** — that's a strong retrieval brain, and it's
what already matches GPT-4o at a fraction of the cost. The card honestly reports
`reasoning.total: 0`.

The moat is the optional next layer: **induce reasoning on top** — the
*procedures*, *checklists*, and *decomposition templates* that turn a pile of
facts into "how an analyst actually reads these filings." That's a separate
consolidation pass over the same project memory; when you run it, the card's
`reasoning` coverage climbs from 0 and the brain advertises the difference. This
example stops at facts on purpose, so the pattern stays clear.

---

## Benchmark

The cost/quality claim is reproducible, not marketing:

- **[github.com/ThinkfleetAI/memmesh-benchmarks](https://github.com/ThinkfleetAI/memmesh-benchmarks)** →
  `SPECIALIZED-BRAINS.md` for the SEC finance brain vs GPT-4o methodology and numbers.

---

Apache-2.0 · [memmesh.ai](https://memmesh.ai) · [docs](https://docs.memmesh.ai)
