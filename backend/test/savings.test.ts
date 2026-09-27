import { parse } from 'csv-parse/sync'
import { describe, expect, test } from 'bun:test'
import { computeSavings, computeUnitRates } from '../src/lib/savings'
import { loadSavingsInputs } from '../scripts/savings-io'

const { pairs, projects, reference } = await loadSavingsInputs()

// The trusted Python output (context-files/savings/savings_estimate.py), committed as
// an independent parity reference. Every numeric value must reproduce within $1.
const golden = parse(
  await Bun.file(new URL('fixtures/savings_by_pair.golden.csv', import.meta.url)).text(),
  { columns: true, bom: true },
) as Record<string, string>[]

const report = computeSavings(pairs, projects, reference)
const byId = new Map(report.rows.map((row) => [row.overlapId, row]))

describe('computeUnitRates', () => {
  const rates = computeUnitRates(reference)
  test('per-mile rates match the reference table', () => {
    expect(rates.perMile.get('46|rebuild')).toEqual([602041, 629647.5, 666667])
    expect(rates.perMile.get('115|rebuild')).toEqual([648148, 1150000, 1401600])
    expect(rates.perMile.get('230|rebuild')).toEqual([750000, 1669231, 1930000])
    expect(rates.perMile.get('115|new_build')).toEqual([2007682, 7803571, 8181818])
    expect(rates.perMile.get('230|new_build')).toEqual([1829802, 3659604, 5489406])
  })
  test('station equipment is min/median/max of the three station rows', () => {
    expect(rates.stationEquipment).toEqual([3982052, 9898924, 10833462])
  })
})

describe('computeSavings parity with the reference', () => {
  test('prices all 77 pairs', () => {
    expect(report.rows.length).toBe(77)
    expect(golden.length).toBe(77)
  })

  test('every numeric value matches within $1', () => {
    for (const g of golden) {
      const row = byId.get(g['overlap_id'])
      expect(row).toBeDefined()
      if (!row) continue
      expect(row.t).toBe(Number(g['T']))
      expect(Math.abs(row.d - Number(g['D']))).toBeLessThanOrEqual(1e-4)
      expect(Math.abs(row.sPct[0] - Number(g['S_pct_low']))).toBeLessThanOrEqual(0.05)
      expect(Math.abs(row.sPct[1] - Number(g['S_pct_mid']))).toBeLessThanOrEqual(0.05)
      expect(Math.abs(row.sPct[2] - Number(g['S_pct_high']))).toBeLessThanOrEqual(0.05)
      expect(Math.abs(row.costDesc - Number(g['cost_desc']))).toBeLessThanOrEqual(1)
      expect(Math.abs(row.costGpc[0] - Number(g['cost_gpc_low']))).toBeLessThanOrEqual(1)
      expect(Math.abs(row.costGpc[1] - Number(g['cost_gpc_mid']))).toBeLessThanOrEqual(1)
      expect(Math.abs(row.costGpc[2] - Number(g['cost_gpc_high']))).toBeLessThanOrEqual(1)
      expect(Math.abs(row.savings[0] - Number(g['savings_low']))).toBeLessThanOrEqual(1)
      expect(Math.abs(row.savings[1] - Number(g['savings_mid']))).toBeLessThanOrEqual(1)
      expect(Math.abs(row.savings[2] - Number(g['savings_high']))).toBeLessThanOrEqual(1)
      expect(row.inRealisticHeadline).toBe(g['in_realistic_headline'] === 'True')
    }
  })

  test('OVL_4 is the top pair (Jasper-Okatie x McIntosh-Purrysburg)', () => {
    const ovl4 = byId.get('OVL_4')
    expect(ovl4?.t).toBe(1)
    expect(ovl4?.d).toBe(1)
    expect(ovl4?.savings).toEqual([202853, 905926, 1543705])
    expect(ovl4?.inRealisticHeadline).toBe(true)
  })

  test('realistic headline is the expected 7 pairs', () => {
    const headline = report.rows.filter((r) => r.inRealisticHeadline).map((r) => r.overlapId).sort()
    expect(headline).toEqual(['OVL_13', 'OVL_15', 'OVL_26', 'OVL_33', 'OVL_34', 'OVL_4', 'OVL_60'])
  })

  test('both totals match the reference within $1', () => {
    const goldenTotal = (col: string): number => golden.reduce((acc, g) => acc + Number(g[col]), 0)
    expect(Math.abs(report.totals.upperBound.low - goldenTotal('savings_low'))).toBeLessThanOrEqual(1)
    expect(Math.abs(report.totals.upperBound.mid - goldenTotal('savings_mid'))).toBeLessThanOrEqual(1)
    expect(Math.abs(report.totals.upperBound.high - goldenTotal('savings_high'))).toBeLessThanOrEqual(1)

    // Headline totals: the pitch number.
    expect(report.totals.headline).toEqual({ low: 1076358, mid: 3295189, high: 5721952 })
  })
})
