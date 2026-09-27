# Coordination-savings estimate (DESC × GPC)

Estimated dollars saved when a Dominion Energy South Carolina (DESC) project and a
Georgia Power (GPC) project that overlap in space and time are built in coordination
instead of independently. One row per overlap pair, computed as a low / mid / high band.

Regenerate from tracked inputs (nothing reads the gitignored `context-files/`):

```
cd backend
bun run build-savings            # writes the three CSVs below
bun test test/savings.test.ts    # parity vs the committed golden fixture, within $1
```

## Files

| File | Role |
|---|---|
| `../overlaps.csv` | The 77 DESC × GPC pairs under 25 mi (input). |
| `overlap_projects.csv` | The 31 projects in those pairs (input). 9 DESC have a published cost; 22 GPC are redacted in the IRP and estimated. |
| `desc_cost_reference.csv` | 44 DESC projects with cost, the only price source (input). |
| `unit_rates.csv` | Step-1 rate table (output). |
| `project_costs.csv` | Every project's cost low/mid/high with `cost_source` and `cost_method` (output). |
| `savings_by_pair.csv` | Per-pair savings, T, D, S%, components, and the headline flag (output). |

## Formula

For each pair:

```
savings = S% × min(cost_DESC, cost_GPC) × T × D
```

computed as low / mid / high. The `min()` is deliberate: only the smaller job's
duplicated overhead can be shared away, so it caps the saving. DESC costs are published;
GPC costs are estimated from DESC unit rates (below).

## Unit rates (Step 1)

Derived from `desc_cost_reference.csv`: per-mile rates group DESC rows by voltage plus
work type and take min / median / max; per-station rates likewise.

| Rate | low | mid | high | basis |
|---|--:|--:|--:|---|
| 46 kV rebuild / mi | 602,041 | 629,648 | 666,667 | n=4, min/median/max |
| 115 kV rebuild / mi | 648,148 | 1,150,000 | 1,401,600 | n=6, min/median/max |
| 230 kV rebuild / mi | 750,000 | 1,669,231 | 1,930,000 | n=3, min/median/max |
| 115 kV new / mi | 2,007,682 | 7,803,571 | 8,181,818 | n=3, min/median/max (short taps, don't apply to long lines) |
| **230 kV new / mi** | **1,829,802** | **3,659,604** | **5,489,406** | **n=1 → low/high = mid ±50%** (see weak estimates) |
| station equipment / station | 3,982,052 | 9,898,924 | 10,833,462 | min/median/max of 3 station rows |
| new substation / station | 5,300,000 | 11,116,933 | 23,685,000 | guide values; Dawson (DESC_6859, $93.5M) excluded as an outlier |

GPC costs (Step 2) are `Σ(miles × per-mile rate) + Σ(stations × per-station rate)`;
each project's exact composition is in `project_costs.csv` under `cost_method`.

## S%: the shareable-overhead fraction

S% is the sum of the components that apply to a pair:

| Component | low / mid / high | Applies when | Source |
|---|--:|---|---|
| Mobilization, staging | 2 / 4 / 6 % | T > 0 | MISO MTEP19/20 |
| Construction mgmt, inspection, traffic control | 3 / 5 / 8 % | T > 0 | MISO MTEP19/20 |
| Bulk materials | 1 / 2 / 3 % | Both descriptions name the same conductor (e.g. 1272 ACSR, 1351 ACSS) | Assumption, not sourced |
| Outages, permits, right-of-way | 1 / 2 / 4 % | Shared substation or corridor | Assumption, not sourced |

Bulk materials applies to 0 pairs in the current data: the DESC projects specify
1272 ACSR and the GPC projects 1351 ACSS, so no pair names the same conductor.

So every pair with overlapping schedules starts from a base **S% = 5 / 9 / 14 %**
(mobilization plus construction management). The other two components only stack on top
when their condition is met.

**Source for the 9% mid.** The MISO MTEP19/20 *Transmission Cost Estimation Guide* puts
project management including mobilization at ≈5.5% of project cost and
engineering/testing at ≈3.0% (≈8.5% combined). The mid components, mobilization 4% plus
construction management 5% = 9%, are anchored to those figures, with the 5% low / 14%
high band bracketing them. Bulk materials and outages/permits/ROW are not sourced; they
are labelled assumptions above and need a citation before the pitch or must stay flagged
as assumptions.

## T and D

**D (distance).** From `distance_mi`: `D = 1` if ≤ 5 mi, else `(25 − distance_mi) / 20`.
All pairs are under 25 mi, so D is always > 0.

**T (time)** is a window gap, *not* the in-service difference. It is computed from each
project's construction **window** (`start_date` → `in_service_date`):

```
gap = max(0, later start_date − earlier in_service_date)
T   = 1   if gap = 0    (the two build windows overlap)
      0.5 if gap ≤ 365 days
      0   otherwise
```

This is distinct from the `time_gap (day)` column in `overlaps.csv`, which is the
absolute difference between the two **in-service dates** and is only the screening
metric used to pair projects. The two disagree whenever build windows overlap even
though completion dates differ. For example, **OVL_1** has an in-service `time_gap` of
578 days but a construction-window gap of 214 (so T = 0.5). Savings uses the window gap,
because coordination savings depend on the crews being on site at the same time, not on
when the lines energize.

## Totals: headline vs upper bound

A project can only save its overhead **once**, but a single project can appear in many
pairs (the Riverport Tap is the DESC side of 16). Summing all 77 rows therefore
double-counts. Two totals are reported:

| Total | low | mid | high | Definition |
|---|--:|--:|--:|---|
| **Realistic headline** (7 pairs) | **$1,076,358** | **$3,295,189** | **$5,721,952** | Greedy: sort by `savings_mid` desc, take a pair only if neither project is already used. The pitch number. |
| Upper bound (77 pairs) | $4,379,178 | $14,626,004 | $26,146,284 | Sum of every pair; treats each project as reusable. |

Headline pairs: **OVL_4, OVL_13, OVL_15, OVL_26, OVL_33, OVL_34, OVL_60**.

## Flagged weak estimates

1. **230 kV new-build rate rests on one project.** The 230 kV new per-mile rate
   ($1.83M / $3.66M / $5.49M) is derived from a single DESC line (DESC_06367 D - G,
   Jasper–Okatie 230 kV #2); its low/high are just mid ±50%, not an observed range. It
   drives the two largest GPC estimates, GPC_21116 (Goshen, $27.8M / $56.1M / $91.2M) and
   GPC_19523 (Hyundai, $55.5M / $120.7M / $187.0M), so those bands are soft. Both are
   large enough that they are rarely the binding `min()`, which limits the effect on
   savings.

2. **Big Ogeechee has no comparable.** GPC_19966 (OVL_67) is a new 500/230 kV substation,
   and the DESC reference has no 500 kV project to price it against. Its mid is set to the
   new-substation *high* ($23.69M) with ±50% (low $11.84M / high $35.53M) and flagged
   "no comparable; likely low."

3. **Riverport placeholder.** This is a location, not a cost. Riverport's new
   distribution substation is not mapped in OpenStreetMap, so its coordinate is a
   placeholder at RiverPort Commerce Park (32.21132, -81.07584). That point decides
   **OVL_77** (Riverport × Hyundai) at 24.93 mi, just under the 25 mi cutoff. With
   D = 0.0035 that pair is worth only about $11K at mid, so the placeholder affects the
   overlap *count* far more than the dollars. Treat OVL_77 as borderline. Secondarily,
   the Riverport Tap's published $34,877,427 has no stated miles, so it can't be
   decomposed or checked against the per-mile rates.

4. **OVL_4 shared-site sensitivity (+≈$200K).** OVL_4 (Jasper–Okatie 230 kV #2 ×
   McIntosh–Purrysburg 230 kV reactors, 4.23 mi apart) is the top headline pair at
   **$202,853 / $905,926 / $1,543,705** on the base 5 / 9 / 14 % S%. It is **not**
   currently treated as shared-site. If the two do share the corridor/substation, adding
   the outages/permits/ROW component (1 / 2 / 4 %) lifts the mid S% from 9% to 11%, about
   **+$201K at mid** (0.02 × $10.07M min cost). Treated as upside pending confirmation of
   the shared corridor.
