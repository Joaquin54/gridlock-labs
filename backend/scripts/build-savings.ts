/**
 * Builds the coordination-savings deliverable from committed, tracked inputs.
 *
 *   bun scripts/build-savings.ts
 *
 * Reads the tracked overlap set (docs/deliverable/overlaps.csv) plus the project and
 * DESC price references (docs/deliverable/savings/) via loadSavingsInputs, applies the
 * pure method in src/lib/savings.ts, and writes three CSVs to docs/deliverable/savings/:
 *   - unit_rates.csv     the Step-1 rate table
 *   - project_costs.csv  all 31 projects with cost low/mid/high, cost_source, cost_method
 *   - savings_by_pair.csv  per-pair savings, low/mid/high, and the headline flag
 *
 * Nothing is read from the gitignored context-files/ at runtime, so any teammate can
 * regenerate the deliverable from a clean checkout. See docs/deliverable/savings/README.md.
 */
import { toCsv } from '../src/lib/csv'
import { computeSavings, roundHalfEven } from '../src/lib/savings'
import { loadSavingsInputs } from './savings-io'

/** The committed CSVs are LF; toCsv emits RFC 4180 CRLF for the export routes. */
function toLf(text: string): string {
  return text.replaceAll('\r\n', '\n')
}

async function main(): Promise<void> {
  const { pairs, projects, reference } = await loadSavingsInputs()
  const report = computeSavings(pairs, projects, reference)
  const outDir = new URL('../../docs/deliverable/savings/', import.meta.url)

  const rateRows = report.unitRates.table.map((entry) => [
    entry.rate,
    roundHalfEven(entry.triple[0]),
    roundHalfEven(entry.triple[1]),
    roundHalfEven(entry.triple[2]),
    entry.rule,
    entry.projectIds.join(', '),
  ])
  await Bun.write(
    new URL('unit_rates.csv', outDir),
    toLf(toCsv(['rate', 'low', 'mid', 'high', 'rule', 'projects'], rateRows)),
  )

  // Every project carries cost_source (published vs estimated) and cost_method.
  const costRows = projects.map((p) => {
    const cost = report.costs.get(p.projectId)
    if (!cost) throw new Error(`no cost for ${p.projectId}`)
    return [
      p.projectId,
      p.utility,
      roundHalfEven(cost.cost[0]),
      roundHalfEven(cost.cost[1]),
      roundHalfEven(cost.cost[2]),
      cost.source,
      cost.method,
    ]
  })
  await Bun.write(
    new URL('project_costs.csv', outDir),
    toLf(
      toCsv(['project_id', 'utility', 'cost_low', 'cost_mid', 'cost_high', 'cost_source', 'cost_method'], costRows),
    ),
  )

  const savingsRows = report.rows.map((row) => [
    row.overlapId,
    row.descId,
    row.gpcId,
    row.distanceMi,
    row.gapDays,
    row.costDesc,
    row.costGpc[0],
    row.costGpc[1],
    row.costGpc[2],
    row.costMethod,
    row.t,
    row.d,
    row.components,
    row.sPct[0],
    row.sPct[1],
    row.sPct[2],
    row.savings[0],
    row.savings[1],
    row.savings[2],
    row.inRealisticHeadline,
  ])
  await Bun.write(
    new URL('savings_by_pair.csv', outDir),
    toLf(
      toCsv(
        [
          'overlap_id',
          'project_id_desc',
          'project_id_gpc',
          'distance_mi',
          'gap_days',
          'cost_desc',
          'cost_gpc_low',
          'cost_gpc_mid',
          'cost_gpc_high',
          'cost_method',
          'T',
          'D',
          'components',
          'S_pct_low',
          'S_pct_mid',
          'S_pct_high',
          'savings_low',
          'savings_mid',
          'savings_high',
          'in_realistic_headline',
        ],
        savingsRows,
      ),
    ),
  )

  const money = (n: number): string => `$${(n / 1_000_000).toFixed(2)}M`
  const { headline, upperBound } = report.totals
  console.log(`wrote docs/deliverable/savings/ (${report.rows.length} pairs)`)
  console.log(
    `realistic headline: ${money(headline.low)} / ${money(headline.mid)} / ${money(headline.high)} ` +
      `(${report.rows.filter((r) => r.inRealisticHeadline).length} pairs)`,
  )
  console.log(`upper bound:        ${money(upperBound.low)} / ${money(upperBound.mid)} / ${money(upperBound.high)}`)
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(`build-savings failed: ${(error as Error).message}`)
    process.exit(1)
  })
}
