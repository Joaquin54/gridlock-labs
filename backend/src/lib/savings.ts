/**
 * Coordination-savings estimate for DESC x GPC overlap pairs.
 *
 * Method (see docs/deliverable/savings/): for each pair,
 *   savings = S% x min(cost_DESC, cost_GPC) x T x D
 * computed as low/mid/high. Only the smaller job's duplicated overhead can be
 * shared, hence the smaller cost. DESC costs are published; GPC costs are redacted
 * in the IRP and estimated from DESC unit rates (the only price source).
 *
 * Pure and framework-free so the offline build script and (later) findOverlaps can
 * both call it. T reuses `windowGapDays` from ./windows so the schedule logic has a
 * single definition.
 *
 * S% component sources: MISO MTEP19/20 Transmission Cost Estimation Guide puts
 * project management incl. mobilization at ~5.5% and engineering/testing at ~3.0%
 * of project cost — the basis for the mobilization + construction-management mid.
 * Bulk materials and outages/permits/ROW are assumptions, labelled as such.
 */
import { windowGapDays } from './windows'

/** [low, mid, high]. */
export type Triple = readonly [number, number, number]

/** One DESC x GPC pair to price. `descId`/`gpcId` are `project_id_a`/`_b`. */
export type OverlapPair = {
  overlapId: string
  descId: string
  gpcId: string
  distanceMi: number
}

/** A project in the overlap set, from `overlap_projects.csv`. */
export type SavingsProject = {
  projectId: string
  utility: 'DESC' | 'GPC'
  voltageKv: number | null
  workType: string
  statedMiles: number | null
  startDate: string | null
  inServiceDate: string
  costUsd: number | null
  description: string
}

/** A DESC price reference row, from `desc_cost_reference.csv`. */
export type RateRow = {
  projectId: string
  voltageKv: number | null
  workType: string
  projectType: string
  costUsd: number | null
  costPerMileUsd: number | null
}

/** One row of the rate table, for the `unit_rates.csv` hand-back. */
export type RateEntry = {
  rate: string
  triple: Triple
  rule: string
  projectIds: readonly string[]
}

export type UnitRates = {
  /** keyed by `${voltageKv}|${workType}`. */
  perMile: Map<string, Triple>
  stationEquipment: Triple
  newSubstation: Triple
  table: RateEntry[]
}

export type ProjectCost = {
  cost: Triple
  source: 'published' | 'estimated'
  method: string
}

export type SavingsRow = {
  overlapId: string
  descId: string
  gpcId: string
  distanceMi: number
  gapDays: number
  costDesc: number
  costGpc: Triple
  costMethod: string
  t: number
  d: number
  components: string
  sPct: Triple
  savings: Triple
  inRealisticHeadline: boolean
}

export type Totals = { low: number; mid: number; high: number }

export type SavingsReport = {
  rows: SavingsRow[]
  unitRates: UnitRates
  costs: Map<string, ProjectCost>
  totals: { upperBound: Totals; headline: Totals }
}

// Step-3 S% components as fractions [low, mid, high].
const MOBILIZATION: Triple = [0.02, 0.04, 0.06]
const CONSTRUCTION_MGMT: Triple = [0.03, 0.05, 0.08]
const BULK_MATERIALS: Triple = [0.01, 0.02, 0.03]
const SHARED_SITE: Triple = [0.01, 0.02, 0.04]

// Pairs with a shared substation or corridor (guide example: Thurmond). Both have
// T = 0 in the current data, so shared-site never actually contributes today.
const SHARED_SITE_PAIRS = new Set<string>(['DESC_6810 A|GPC_20793', 'DESC_6810 A|GPC_20794'])

// New-substation rate is a guide value; Dawson (DESC_6859, $93.5M) is excluded as an
// outlier. Not derived by min/median/max like the other rates.
const NEW_SUBSTATION_RATE: Triple = [5_300_000, 11_116_933, 23_685_000]
const NEW_SUBSTATION_RULE = 'guide values; Dawson (DESC_6859, $93.5M) excluded as outlier'

const CONDUCTOR_RE = /(\d{3,4}(?:\.\d)?)\s*(?:C7\s*)?(ACSR|ACSS|ACCR|ACCS|ACAR|AAC)/gi

/** Round half to even (Python 3 `round`), so per-row values and totals match the reference. */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value)
  const frac = value - floor
  if (frac < 0.5) return floor
  if (frac > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

/** Round to `decimals` places, half to even, for the display columns. */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return roundHalfEven(value * factor) / factor
}

function median(sorted: readonly number[]): number {
  const n = sorted.length
  const mid = Math.floor(n / 2)
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Group summary: n>=3 -> min/median/max; n<3 -> mid=median, low/high = mid -/+50%. */
function rng(values: readonly number[]): { triple: Triple; rule: string } {
  const sorted = [...values].sort((a, b) => a - b)
  const med = median(sorted)
  if (sorted.length < 3) {
    return { triple: [med * 0.5, med, med * 1.5], rule: `n=${sorted.length} (<3): low/high = mid -/+50%` }
  }
  return { triple: [sorted[0], med, sorted[sorted.length - 1]], rule: `n=${sorted.length}: min/median/max` }
}

const rateKey = (voltageKv: number, workType: string): string => `${voltageKv}|${workType}`
const addTriples = (...triples: Triple[]): Triple => {
  const out: [number, number, number] = [0, 0, 0]
  for (const t of triples) for (let i = 0; i < 3; i++) out[i] += t[i]
  return out
}
const scaleTriple = (t: Triple, factor: number): Triple => [t[0] * factor, t[1] * factor, t[2] * factor]

/** Step 1: unit rates from the DESC price reference. */
export function computeUnitRates(reference: readonly RateRow[]): UnitRates {
  const groups = new Map<string, RateRow[]>()
  for (const row of reference) {
    if (row.costPerMileUsd === null || row.voltageKv === null) continue
    const key = rateKey(row.voltageKv, row.workType)
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  const perMile = new Map<string, Triple>()
  const table: RateEntry[] = []
  for (const [key, group] of groups) {
    const [voltageKv, workType] = key.split('|')
    const { triple, rule } = rng(group.map((r) => r.costPerMileUsd as number))
    perMile.set(key, triple)
    table.push({ rate: `${voltageKv} kV ${workType} per mile`, triple, rule, projectIds: group.map((r) => r.projectId) })
  }

  const equipment = reference.filter((r) => r.workType === 'station_equipment' && r.costUsd !== null)
  const stationEquipment = rng(equipment.map((r) => r.costUsd as number)).triple
  table.push({
    rate: 'station equipment per station',
    triple: stationEquipment,
    rule: 'min/median/max',
    projectIds: equipment.map((r) => r.projectId),
  })

  const newSubstationRows = reference.filter(
    (r) => r.workType === 'new_build' && r.projectType === 'station' && r.projectId !== 'DESC_6859',
  )
  table.push({
    rate: 'new substation per station',
    triple: NEW_SUBSTATION_RATE,
    rule: NEW_SUBSTATION_RULE,
    projectIds: newSubstationRows.map((r) => r.projectId),
  })

  return { perMile, stationEquipment, newSubstation: NEW_SUBSTATION_RATE, table }
}

/** Step 2: estimate one GPC project's cost from the unit rates. */
export function estimateGpcCost(project: SavingsProject, rates: UnitRates): { cost: Triple; method: string } {
  const eq = rates.stationEquipment
  const ns = rates.newSubstation
  const perMile = (voltageKv: number, workType: string): Triple => {
    const rate = rates.perMile.get(rateKey(voltageKv, workType))
    if (!rate) throw new Error(`no unit rate for ${voltageKv} kV ${workType}`)
    return rate
  }

  switch (project.projectId) {
    case 'GPC_19523':
      return {
        cost: addTriples(scaleTriple(ns, 2), scaleTriple(perMile(230, 'new_build'), 22), scaleTriple(perMile(115, 'new_build'), 2.3)),
        method: '2 new substations + 22 mi new 230 kV + 2.3 mi new 115 kV (230 kV new rate n=1)',
      }
    case 'GPC_21116':
      return {
        cost: addTriples(ns, scaleTriple(perMile(230, 'new_build'), 12.3)),
        method: '1 new switching station + 12.3 mi new 230 kV (230 kV new rate n=1)',
      }
    case 'GPC_19966': {
      const mid = ns[2]
      return {
        cost: [mid * 0.5, mid, mid * 1.5],
        method: 'NO COMPARABLE: new 500/230 kV sub; mid = new-substation high, -/+50%; likely low',
      }
    }
    case 'GPC_20277':
      return {
        cost: addTriples(eq, scaleTriple(perMile(230, 'rebuild'), 0.1)),
        method: 'station equipment + 0.1 mi x 230 kV rebuild rate',
      }
  }

  if (project.workType === 'station_equipment') return { cost: eq, method: 'station equipment range (no miles)' }
  if (project.statedMiles === null || project.voltageKv === null) {
    throw new Error(`cannot estimate ${project.projectId}: missing miles or voltage`)
  }
  return {
    cost: scaleTriple(perMile(project.voltageKv, project.workType), project.statedMiles),
    method: `${project.statedMiles} mi x ${project.voltageKv} kV ${project.workType} rate (minor terminal work not priced)`,
  }
}

/** Cost per project: DESC published, GPC estimated. */
export function computeProjectCosts(projects: readonly SavingsProject[], rates: UnitRates): Map<string, ProjectCost> {
  const costs = new Map<string, ProjectCost>()
  for (const project of projects) {
    if (project.utility === 'DESC') {
      if (project.costUsd === null) throw new Error(`DESC project ${project.projectId} has no published cost`)
      const v = project.costUsd
      costs.set(project.projectId, { cost: [v, v, v], source: 'published', method: 'published' })
      continue
    }
    const { cost, method } = estimateGpcCost(project, rates)
    costs.set(project.projectId, { cost, source: 'estimated', method })
  }
  return costs
}

function conductors(text: string): Set<string> {
  const out = new Set<string>()
  for (const match of text.matchAll(CONDUCTOR_RE)) out.add(`${match[1]} ${match[2].toUpperCase()}`)
  return out
}

/** Full report: rows, rates, costs, and the two totals. */
export function computeSavings(
  pairs: readonly OverlapPair[],
  projects: readonly SavingsProject[],
  reference: readonly RateRow[],
): SavingsReport {
  const unitRates = computeUnitRates(reference)
  const costs = computeProjectCosts(projects, unitRates)
  const byId = new Map(projects.map((p) => [p.projectId, p]))

  const rows: SavingsRow[] = pairs.map((pair) => {
    const desc = byId.get(pair.descId)
    const gpc = byId.get(pair.gpcId)
    if (!desc || !gpc) throw new Error(`overlap ${pair.overlapId} references an unknown project`)
    const descCost = costs.get(pair.descId)
    const gpcCost = costs.get(pair.gpcId)
    if (!descCost || !gpcCost) throw new Error(`overlap ${pair.overlapId} references a project with no cost`)

    const gap = windowGapDays(
      { start: desc.startDate, inService: desc.inServiceDate },
      { start: gpc.startDate, inService: gpc.inServiceDate },
    )
    if (gap === null) throw new Error(`overlap ${pair.overlapId} has a project with no start date`)
    const t = gap === 0 ? 1 : gap <= 365 ? 0.5 : 0
    const d = pair.distanceMi <= 5 ? 1 : (25 - pair.distanceMi) / 20

    const components: string[] = []
    let pct: Triple = [0, 0, 0]
    if (t > 0) {
      components.push('mobilization', 'construction_mgmt')
      pct = addTriples(pct, MOBILIZATION, CONSTRUCTION_MGMT)
      const shared = [...conductors(desc.description)].filter((c) => conductors(gpc.description).has(c)).sort()
      if (shared.length > 0) {
        components.push(`bulk_materials(${shared.join('/')})`)
        pct = addTriples(pct, BULK_MATERIALS)
      }
      if (SHARED_SITE_PAIRS.has(`${pair.descId}|${pair.gpcId}`)) {
        components.push('shared_site')
        pct = addTriples(pct, SHARED_SITE)
      }
    }

    const savings: Triple = [0, 1, 2].map((i) =>
      roundHalfEven(pct[i] * Math.min(descCost.cost[i], gpcCost.cost[i]) * t * d),
    ) as unknown as Triple

    return {
      overlapId: pair.overlapId,
      descId: pair.descId,
      gpcId: pair.gpcId,
      distanceMi: pair.distanceMi,
      gapDays: gap,
      costDesc: roundHalfEven(descCost.cost[1]),
      costGpc: gpcCost.cost.map(roundHalfEven) as unknown as Triple,
      costMethod: gpcCost.method,
      t,
      d: roundTo(d, 4),
      components: components.length > 0 ? components.join('; ') : 'none (T = 0)',
      sPct: pct.map((p) => roundTo(p * 100, 1)) as unknown as Triple,
      savings,
      inRealisticHeadline: false,
    }
  })

  // Step 4 realistic headline: highest savings_mid first, each project used once. A
  // stable sort keeps input order for equal mids, matching the reference selection.
  const used = new Set<string>()
  for (const row of [...rows].sort((a, b) => b.savings[1] - a.savings[1])) {
    if (row.savings[1] <= 0 || used.has(row.descId) || used.has(row.gpcId)) continue
    used.add(row.descId)
    used.add(row.gpcId)
    row.inRealisticHeadline = true
  }

  const sum = (predicate: (row: SavingsRow) => boolean): Totals => {
    const picked = rows.filter(predicate)
    return {
      low: picked.reduce((acc, r) => acc + r.savings[0], 0),
      mid: picked.reduce((acc, r) => acc + r.savings[1], 0),
      high: picked.reduce((acc, r) => acc + r.savings[2], 0),
    }
  }

  return {
    rows,
    unitRates,
    costs,
    totals: { upperBound: sum(() => true), headline: sum((r) => r.inRealisticHeadline) },
  }
}
