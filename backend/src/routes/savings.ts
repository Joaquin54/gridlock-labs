import { Hono } from 'hono'
import { loadSavingsInputs } from '../../scripts/savings-io'
import { computeSavings, type SavingsRow } from '../lib/savings'

const savings = new Hono()

type ApiSavingsRow = {
  overlap_id: string
  desc_id: string
  gpc_id: string
  distance_mi: number
  window_gap_days: number
  cost_desc: number
  cost_gpc_low: number
  cost_gpc_mid: number
  cost_gpc_high: number
  cost_method: string
  t: number
  d: number
  components: string
  s_pct_low: number
  s_pct_mid: number
  s_pct_high: number
  savings_low: number
  savings_mid: number
  savings_high: number
  in_realistic_headline: boolean
}

function rowToApi(row: SavingsRow): ApiSavingsRow {
  return {
    overlap_id: row.overlapId,
    desc_id: row.descId,
    gpc_id: row.gpcId,
    distance_mi: row.distanceMi,
    window_gap_days: row.gapDays,
    cost_desc: row.costDesc,
    cost_gpc_low: row.costGpc[0],
    cost_gpc_mid: row.costGpc[1],
    cost_gpc_high: row.costGpc[2],
    cost_method: row.costMethod,
    t: row.t,
    d: row.d,
    components: row.components,
    s_pct_low: row.sPct[0],
    s_pct_mid: row.sPct[1],
    s_pct_high: row.sPct[2],
    savings_low: row.savings[0],
    savings_mid: row.savings[1],
    savings_high: row.savings[2],
    in_realistic_headline: row.inRealisticHeadline,
  }
}

savings.get('/savings', async (c) => {
  const { pairs, projects, reference } = await loadSavingsInputs()
  const report = computeSavings(pairs, projects, reference)
  return c.json({
    rows: report.rows.map(rowToApi),
    totals: {
      headline: report.totals.headline,
      upper_bound: report.totals.upperBound,
    },
  })
})

export default savings
