#!/usr/bin/env npx tsx
/**
 * Build a specialized brain from a public dataset — SEC EDGAR financials.
 *
 * This is the universal "turn a public corpus into a sellable, consumable
 * brain" recipe, end to end against the public MemMesh API. A brain is just
 * metadata over a project's memory, so building one is four moves:
 *
 *   1. FETCH    pull records from a public source (here: SEC EDGAR XBRL facts)
 *   2. SHAPE    map each record to a memory item (one grounded fact each)
 *   3. INGEST   POST the items to your project in batches
 *               (POST /api/v1/projects/:id/memory/bulk)
 *   4. PUBLISH  register a brain with a provenance + license Brain Card and
 *               flip it to PUBLISHED + PUBLIC so it lists in the catalog and is
 *               consumable over MCP  (tf.brains.create → tf.brains.update)
 *
 * The exact same shape built the SEC finance brain that matches GPT-4o on the
 * public benchmark at ~2.6x lower cost. Swap the FETCH+SHAPE adapter for your
 * own domain (drug labels, case law, product catalogs, internal runbooks) and
 * steps 3 and 4 are unchanged.
 *
 * Reference financial figures extracted from SEC filings. NOT investment advice.
 *
 * ── Run it ──────────────────────────────────────────────────────────────
 *   export MEMMESH_API_KEY=sk-...          # key with WRITE_MEMORY + WRITE_BRAIN
 *   export MEMMESH_PROJECT_ID=proj_...
 *   export SEC_USER_AGENT="Your Name your@email.com"   # SEC fair-access (required)
 *   npm install && npm start -- --limit=25
 *
 * Flags:
 *   --limit=<n>   companies to cover (default 25). Each yields several facts × years.
 *   --years=<n>   years of annual history per concept (default 5).
 *   --dry-run     fetch + shape + print a sample and the would-be card; write nothing.
 *                 (Needs SEC_USER_AGENT, but no API key — great for a first look.)
 */

import { ThinkFleetMemory } from '@thinkfleet/memory-sdk'

// ─── Config ──────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2))
const DRY_RUN = args.has('dry-run')
const LIMIT = Math.max(1, Number(args.get('limit') ?? 25))
const YEARS = Math.max(1, Number(args.get('years') ?? 5))

const API_KEY = process.env.MEMMESH_API_KEY ?? ''
const PROJECT_ID = process.env.MEMMESH_PROJECT_ID ?? ''
const BASE_URL = (process.env.MEMMESH_BASE_URL ?? 'https://app.memmesh.ai').replace(/\/+$/, '')
// SEC fair-access requires every automated client to send a descriptive
// User-Agent identifying who is making the request (else data.sec.gov 403s).
const SEC_UA = process.env.SEC_USER_AGENT ?? ''

const DISCLAIMER = 'Reference financial figures extracted from SEC filings. NOT investment advice.'

if (!SEC_UA) {
    fail('SEC_USER_AGENT is required (SEC fair-access). e.g. export SEC_USER_AGENT="Your Name your@email.com"')
}
if (!DRY_RUN && (!API_KEY || !PROJECT_ID)) {
    fail('MEMMESH_API_KEY and MEMMESH_PROJECT_ID are required (or pass --dry-run to fetch without writing).')
}

// The brain we will register once its facts are ingested.
const BRAIN = {
    externalId: 'sec-financial-facts',
    name: 'SEC Financial Facts',
    domain: 'finance',
    version: '1.0.0',
} as const

const PROVENANCE = {
    source: 'SEC EDGAR — XBRL company facts (data.sec.gov)',
    // SEC EDGAR data is a U.S. Government work and is not copyrighted — the
    // cleanest possible license for a public, sellable brain.
    license: 'Public domain (U.S. Government work; SEC EDGAR data is not copyrighted)',
    url: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
} as const

// ─── The dataset adapter: SEC EDGAR XBRL company facts ─────────────────────
//
// SEC's XBRL "company facts" API gives structured, dated financial figures per
// company — ideal as retrievable facts. We take a headline set of concepts and,
// for each, the first candidate us-gaap tag that has data (filers use different
// tags across eras and industries), newest annual (10-K) values first.

type Unit = 'money' | 'perShare' | 'shares'

const SEC_CONCEPTS: Array<{ title: string, tags: string[], importance: number, unit?: Unit }> = [
    // Income statement
    { title: 'Revenue', tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'], importance: 8 },
    { title: 'Cost of Revenue', tags: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'], importance: 5 },
    { title: 'Gross Profit', tags: ['GrossProfit'], importance: 6 },
    { title: 'Operating Income', tags: ['OperatingIncomeLoss'], importance: 7 },
    { title: 'Net Income', tags: ['NetIncomeLoss'], importance: 8 },
    { title: 'SG&A Expense', tags: ['SellingGeneralAndAdministrativeExpense'], importance: 4 },
    { title: 'R&D Expense', tags: ['ResearchAndDevelopmentExpense'], importance: 5 },
    { title: 'Diluted EPS', tags: ['EarningsPerShareDiluted'], importance: 7, unit: 'perShare' },
    { title: 'Basic EPS', tags: ['EarningsPerShareBasic'], importance: 5, unit: 'perShare' },
    { title: 'Diluted Shares Outstanding', tags: ['WeightedAverageNumberOfDilutedSharesOutstanding'], importance: 4, unit: 'shares' },
    // Balance sheet
    { title: 'Total Assets', tags: ['Assets'], importance: 7 },
    { title: 'Current Assets', tags: ['AssetsCurrent'], importance: 5 },
    { title: 'Total Liabilities', tags: ['Liabilities'], importance: 6 },
    { title: 'Current Liabilities', tags: ['LiabilitiesCurrent'], importance: 5 },
    { title: "Stockholders' Equity", tags: ['StockholdersEquity'], importance: 6 },
    { title: 'Cash & Equivalents', tags: ['CashAndCashEquivalentsAtCarryingValue'], importance: 6 },
    { title: 'Inventory', tags: ['InventoryNet'], importance: 4 },
    { title: 'Long-Term Debt', tags: ['LongTermDebtNoncurrent', 'LongTermDebt'], importance: 5 },
    // Cash flow
    { title: 'Operating Cash Flow', tags: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'], importance: 6 },
    { title: 'Capital Expenditures', tags: ['PaymentsToAcquirePropertyPlantAndEquipment'], importance: 5 },
    { title: 'Dividends Paid', tags: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'], importance: 4 },
]

// XBRL unit bucket for each logical unit: EPS is 'USD/shares', a share count is
// 'shares', everything else is a plain 'USD' figure.
const UNIT_BUCKET: Record<Unit, string> = { money: 'USD', perShare: 'USD/shares', shares: 'shares' }

type SecUnitEntry = { start?: string, end?: string, val?: number, fy?: number, fp?: string, form?: string, filed?: string }
type SecCompanyFacts = { entityName?: string, facts?: { 'us-gaap'?: Record<string, { units?: Record<string, SecUnitEntry[]> }> } }
type SecTicker = { cik_str: number, ticker: string, title: string }

/** One memory item in the shape POST /memory/bulk expects. */
type SeedItem = {
    type: 'fact'
    content: string
    category: string
    importance: number
    source: 'admin_created'
    scope: 'project'
    validFrom?: string
    metadata: Record<string, unknown>
}

/**
 * FETCH + SHAPE. Yields grounded memory items for the top-`limit` companies,
 * fail-soft on any company with no XBRL facts (funds, shells, brand-new filers).
 */
async function* fetchSecFacts(limit: number, years: number): AsyncGenerator<SeedItem> {
    const tickersRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
        headers: { 'User-Agent': SEC_UA },
    })
    if (!tickersRes.ok) throw new Error(`SEC tickers ${tickersRes.status}: ${await tickersRes.text()}`)
    const tickerMap = (await tickersRes.json()) as Record<string, SecTicker>
    const companies = Object.values(tickerMap).slice(0, limit)
    log(`  covering ${companies.length} companies × ${SEC_CONCEPTS.length} concepts × up to ${years}y`)

    let processed = 0
    let emitted = 0
    for (const c of companies) {
        processed++
        const cik10 = String(c.cik_str).padStart(10, '0')
        const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`
        const res = await fetch(url, { headers: { 'User-Agent': SEC_UA } })
        if (!res.ok) {
            // Many CIKs have no XBRL facts — skip, don't fail the run.
            if (res.status === 404) { await sleep(120); continue }
            // Transient rate-limit / 5xx: back off and skip rather than abort.
            if (res.status === 429 || res.status >= 500) { log(`  SEC ${res.status} for ${c.ticker} — backing off`); await sleep(1000); continue }
            throw new Error(`SEC companyfacts ${res.status} for ${c.ticker}: ${await res.text()}`)
        }
        const facts = (await res.json()) as SecCompanyFacts
        const gaap = facts.facts?.['us-gaap']
        const name = facts.entityName ?? c.title
        if (gaap) {
            for (const concept of SEC_CONCEPTS) {
                const unit: Unit = concept.unit ?? 'money'
                // One item per (company × concept × fiscal year) so multi-year and
                // trend questions resolve to a specific, dated, cited figure.
                for (const e of annualHistory(gaap, concept.tags, unit, years)) {
                    if (typeof e.val !== 'number') continue
                    emitted++
                    yield {
                        type: 'fact',
                        // admin_created lands CONFIRMED (confidence 1.0) so it is
                        // searchable in the brain immediately, no review step.
                        source: 'admin_created',
                        scope: 'project',
                        importance: concept.importance,
                        category: 'sec-financials',
                        content: `${name} (${c.ticker}) — ${concept.title}, FY${e.fy}: ${formatValue(e.val, unit)} [${e.form}]`,
                        validFrom: e.end ? `${e.end}T00:00:00.000Z` : undefined,
                        metadata: {
                            subject: { kind: 'company', externalId: c.ticker },
                            company: name, ticker: c.ticker, cik: cik10,
                            concept: concept.title, fiscalYear: e.fy, fiscalPeriod: e.fp,
                            periodEnd: e.end, form: e.form, filed: e.filed,
                            unit, value: e.val,
                            source: 'SEC EDGAR', license: 'public-domain', sourceUrl: url,
                        },
                    }
                }
            }
        }
        if (processed % 10 === 0) log(`  ${processed}/${companies.length} companies, ${emitted} facts…`)
        await sleep(130) // SEC fair-access: comfortably under 10 req/s
    }
    log(`  fetched ${processed} companies, shaped ${emitted} facts`)
}

/**
 * Up to `years` of annual (10-K) values for the first candidate tag that has
 * data, newest first. Dedupes by fiscal-period end (companyfacts repeats a year
 * as a comparative in later filings); for a restated end date keep latest-filed.
 */
function annualHistory(
    gaap: Record<string, { units?: Record<string, SecUnitEntry[]> }>,
    tags: string[], unit: Unit, years: number,
): SecUnitEntry[] {
    for (const tag of tags) {
        const bucket = gaap[tag]?.units?.[UNIT_BUCKET[unit]]
        if (!bucket?.length) continue
        const annual = bucket.filter(
            (e) => (e.form ?? '').startsWith('10-K') && typeof e.val === 'number' && !!e.fy && !!e.end
                // Annual periods only. Balance-sheet items are instants (no start);
                // income/cash-flow items span ~a year — keep the ~12-month span so
                // embedded quarters are dropped.
                && (!e.start || spansAboutOneYear(e.start, e.end)),
        )
        const byEnd = new Map<string, SecUnitEntry>()
        for (const e of annual) {
            const prev = byEnd.get(e.end!)
            if (!prev || (e.filed ?? '') > (prev.filed ?? '')) byEnd.set(e.end!, e)
        }
        const hist = [...byEnd.values()].sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''))
        if (hist.length) return hist.slice(0, years)
    }
    return []
}

/** True if [start,end] is roughly a fiscal year (300–400 days) — filters quarters. */
function spansAboutOneYear(start: string, end: string): boolean {
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000
    return days >= 300 && days <= 400
}

// ─── Value formatting ──────────────────────────────────────────────────────

function formatValue(v: number, unit: Unit): string {
    if (unit === 'perShare') return `$${v.toFixed(2)} per share`
    if (unit === 'shares') return `${compact(v)} shares`
    const abs = Math.abs(v)
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
    return `$${v.toFixed(0)}`
}

function compact(v: number): string {
    const abs = Math.abs(v)
    if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`
    return `${v.toFixed(0)}`
}

// ─── Runner ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    log(`\nBuild-a-brain: SEC Financial Facts`)
    log(`brain:      ${BRAIN.externalId} ("${BRAIN.name}") domain=${BRAIN.domain} v${BRAIN.version}`)
    log(`provenance: ${PROVENANCE.source}`)
    log(`license:    ${PROVENANCE.license}`)
    log(`disclaimer: ${DISCLAIMER}`)
    log(`target:     ${BASE_URL}/api/v1/projects/${PROJECT_ID || '<dry-run>'}`)
    log(DRY_RUN ? 'mode:       DRY RUN (fetch + shape only, no writes)\n' : '')

    // Optional client — only constructed when we are actually going to write.
    const tf = DRY_RUN ? null : new ThinkFleetMemory({ apiKey: API_KEY, projectId: PROJECT_ID, baseUrl: BASE_URL })

    // 1+2. FETCH + SHAPE, streamed. 3. INGEST in batches so memory stays flat
    //      regardless of corpus size. Track distinct subjects for coverage.
    log('STEP 1-3  fetch → shape → bulk-ingest')
    const subjects = new Set<string>()
    let batch: SeedItem[] = []
    let saved = 0
    let failed = 0
    let sampled = false

    const flush = async (): Promise<void> => {
        if (batch.length === 0) return
        if (DRY_RUN) {
            if (!sampled) { log(`  sample item:\n${indent(JSON.stringify(batch[0], null, 2))}`); sampled = true }
            saved += batch.length
            batch = []
            return
        }
        const report = await bulkIngest(batch)
        saved += report.saved
        failed += report.failed
        if (report.failed > 0) log(`  batch: ${report.failed} failed (e.g. ${report.errors[0]?.message ?? '?'})`)
        log(`  ingested ${saved} items (${subjects.size} subjects)…`)
        batch = []
    }

    for await (const item of fetchSecFacts(LIMIT, YEARS)) {
        const subj = (item.metadata.subject as { externalId?: string } | undefined)?.externalId
        if (subj) subjects.add(subj)
        batch.push(item)
        // /bulk accepts up to 1000 items per request; 200 keeps each round-trip small.
        if (batch.length >= 200) await flush()
    }
    await flush()

    log(`\nINGEST DONE: ${saved} facts, ${failed} failed, ${subjects.size} subjects.`)
    if (saved === 0) fail('no facts produced — refusing to publish an empty brain.')

    // The Brain Card: provenance + license (the publish gate) and honest,
    // computed coverage. reasoning is 0 — seeding only ingests facts; inducing a
    // reasoning layer on top is a deliberate later step (see the README).
    const card = {
        provenance: [PROVENANCE],
        coverage: {
            subjects: subjects.size,
            facts: saved,
            reasoning: { procedures: 0, checklists: 0, decompositions: 0, total: 0 },
            freshness: 'T-0',
        },
        predictEnabled: false, // a static public-knowledge brain is retrieval, not behavior
        disclaimer: DISCLAIMER,
    }

    if (DRY_RUN) {
        log(`\nSTEP 4  would create + publish brain with card:`)
        log(indent(JSON.stringify(card, null, 2)))
        log(`\nDRY RUN complete. ${DISCLAIMER}`)
        return
    }

    // 4. PUBLISH — register the brain (idempotent) and flip it PUBLISHED.
    log('\nSTEP 4  register + publish brain')
    const brainId = await ensureBrain(tf!, card)
    await tf!.brains.update(brainId, { status: 'PUBLISHED' })
    log(`\nPUBLISHED  ${BRAIN.externalId} (${brainId})`)
    log(`  → listed in the public catalog, consumable over MCP`)
    log(`  → MCP endpoint: ${BASE_URL}/api/v1/projects/${PROJECT_ID}/brains/${brainId}/mcp-server/http`)
    log(`\n${DISCLAIMER}`)
}

/** Create the brain; if the slug already exists, patch it in place (idempotent). */
async function ensureBrain(tf: ThinkFleetMemory, card: unknown): Promise<string> {
    const body = {
        externalId: BRAIN.externalId,
        name: BRAIN.name,
        domain: BRAIN.domain,
        version: BRAIN.version,
        visibility: 'PUBLIC' as const,
        card: card as never,
    }
    try {
        const created = await tf.brains.create(body)
        log(`  created brain ${created.id}`)
        return created.id
    }
    catch (err) {
        // Slug already exists (a re-run) — find it and update in place.
        log(`  brain slug exists (or create failed: ${errMsg(err)}) — updating in place`)
        const page = await tf.brains.list({ limit: 100 })
        const found = page.data.find((b) => b.externalId === BRAIN.externalId)
        if (!found) throw err
        await tf.brains.update(found.id, {
            name: BRAIN.name, domain: BRAIN.domain, version: BRAIN.version,
            visibility: 'PUBLIC', card: card as never,
        })
        log(`  updated brain ${found.id}`)
        return found.id
    }
}

// ─── Bulk ingest (raw REST — the SDK has no bulk method) ────────────────────

type BulkReport = { requested: number, saved: number, failed: number, errors: Array<{ index: number, message: string }> }

/**
 * POST a batch to the project's bulk-ingest endpoint. The SDK covers single-item
 * writes and the brain registry, but not bulk ingest, so this one call is a
 * plain authenticated fetch against the public REST API.
 */
async function bulkIngest(items: SeedItem[]): Promise<BulkReport> {
    const res = await fetch(`${BASE_URL}/api/v1/projects/${PROJECT_ID}/memory/bulk`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`bulk ingest ${res.status}: ${text.slice(0, 400)}`)
    return JSON.parse(text) as BulkReport
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Map<string, string> {
    const map = new Map<string, string>()
    for (const arg of argv) {
        const m = arg.match(/^--([^=]+)=(.*)$/) ?? arg.match(/^--([^=]+)$/)
        if (m) map.set(m[1], m[2] ?? 'true')
    }
    return map
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const indent = (s: string): string => s.split('\n').map((l) => `    ${l}`).join('\n')
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 200)

function log(m: string): void {
    // eslint-disable-next-line no-console
    console.log(m)
}

function fail(m: string): never {
    // eslint-disable-next-line no-console
    console.error(`build-a-brain-sec: ${m}`)
    process.exit(1)
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.stack ?? err.message : err)
    process.exit(1)
})
