# Points join report

`project_points` became the join between `projects` and a new `points` table: one row per physical
location. Derived by the loader from `points_load.csv`; no new input file, and no existing column changed.

436 located join rows sit at **273 distinct coordinates**, and **104** of those are shared by two or more
projects, covering **267** join rows. So a coordinate correction now reaches every project at that spot
instead of one.

Grouping is by **exact coordinate, never by name**. That is safe here and was verified, not assumed: the
closest two distinct coordinates in the data are **137.3 m** apart, and **no** pair is within 100 m.
Grouping by name would have been wrong — see §4.

## 1. Counts

| Check | Expected | Actual |
|---|---|---|
| `points` rows | 273 | 273 |
| Located join rows with `point_id` / unlocated with NULL | 436 / 9 | 436 / 9 |
| Points used by 2+ projects / join rows they cover | 104 / 267 | 104 / 267 |
| Points whose rows disagree on `confidence` | 26 | 26 |
| Points whose rows have different printed names | 17 | 17 |
| Points used twice within one project | 4 | 4 |
| Same printed name at different coordinates | 4 | 4 |
| Cross-utility points (a GPC and a DESC project at one coordinate) | — | **0** |

**No cross-utility shared points exist — confirmed on the loaded database, not just the CSV.** Every shared coordinate is shared within one utility. The
"shared assets" bonus therefore cannot be argued from an identical coordinate; the closest thing in the
data is the 2.33 mi `GPC:16007` / `DESC:6810 O` pair, whose endpoints are near but not equal. Nothing was
built for that bonus, by instruction; `point_usage.utilities` is where the signal would show up if a
future correction ever made two utilities meet at one coordinate.

## 2. Confidence resolved to the strongest (26 points)

A coordinate proven for one project is proven for every project at that exact spot, so the point takes
the strongest level and the provenance of the row that supplied it. Every one of these resolves to
`verified`.

| Point | Rows (project/seq → confidence) | Resolved |
|---|---|---|
| `32.10772,-81.226912` | GPC:20783/1 verified, GPC:20784/1 low | verified |
| `32.155282,-81.368377` | GPC:20784/2 low, GPC:20796/1 verified | verified |
| `32.562253,-83.73881` | GPC:13787/1 low, GPC:17706/1 verified, GPC:19997/1 verified | verified |
| `32.564795,-83.600023` | GPC:13787/2 low, GPC:18153/1 verified, GPC:20873/1 verified, GPC:21140/1 verified | verified |
| `32.882471,-83.316914` | GPC:19618/1 verified, GPC:20002/1 low, GPC:20428/1 low | verified |
| `32.998477,-82.801938` | GPC:19248/1 verified, GPC:20002/2 low, GPC:20428/2 low | verified |
| `33.032069,-84.201258` | GPC:08458/1 verified, GPC:20874/1 low, GPC:20874/2 low, GPC:21112/1 verified | verified |
| `33.094506,-82.981585` | GPC:21077/2 low, GPC:21094/1 verified | verified |
| `33.351115,-84.905954` | GPC:19598/1 verified, GPC:19950/1 low, GPC:20273/1 verified, GPC:20668/1 verified | verified |
| `33.410956,-85.030769` | GPC:21062/2 low, GPC:21123/2 verified | verified |
| `33.453955,-82.414219` | GPC:14222/1 verified, GPC:17993/2 low | verified |
| `33.461641,-84.904198` | GPC:15879/2 verified, GPC:19601/2 low | verified |
| `33.468258,-82.819772` | GPC:20264/1 verified, GPC:20270/1 verified, GPC:20271/1 low | verified |
| `33.543994,-82.168648` | GPC:17993/1 low, GPC:20793/1 low, GPC:20794/1 verified | verified |
| `33.605931,-84.333462` | GPC:19363/1 verified, GPC:19601/1 low, GPC:20300/1 verified, GPC:21139/2 verified | verified |
| `33.619414,-83.814895` | GPC:13753/2 low, GPC:19606/1 verified | verified |
| `33.661157,-82.197727` | GPC:20793/2 low, GPC:20794/2 verified | verified |
| `33.706504,-82.753196` | GPC:20010/2 low, GPC:20270/2 verified, GPC:20271/2 low | verified |
| `33.825476,-84.471421` | GPC:20761/1 verified, GPC:20764/1 low | verified |
| `33.886495,-80.640356` | DESC:6808 J/1 verified, DESC:6846 A/1 low | verified |
| `33.897661,-80.323976` | DESC:6809 M/2 verified, DESC:6846 A/2 low | verified |
| `33.985981,-84.000799` | GPC:10143/1 low, GPC:10481/1 verified | verified |
| `33.995459,-83.753131` | GPC:10143/2 low, GPC:10481/2 verified, GPC:20759/1 verified, GPC:20773/2 verified, GPC:20778/2 verified, GPC:20789/2 verified | verified |
| `34.001832,-82.636279` | GPC:20010/1 low, GPC:20326/1 verified | verified |
| `34.174192,-84.283406` | GPC:19632/2 low, GPC:20760/1 verified | verified |
| `34.295984,-81.314549` | DESC:06810 F/1 verified, DESC:6808 N,O/1 low | verified |

## 3. One coordinate, several printed names (17 points)

The point keeps the most common name; every variant is kept in `aliases`. Most are harmless
abbreviations. Two are not, and are flagged in §5.

| Point | Names |
|---|---|
| `32.399132,-80.571127` | Frogmore, Frogmore Distribution |
| `32.564795,-83.600023` | Bonaire Pri, Bonaire Primary |
| `32.808561,-82.397465` | Wadley, Wadley Pri |
| `33.024106,-85.01568` | Lagrange, Lagrange Primary |
| `33.032069,-84.201258` | Barnesville, Barnesville #1, Barnesville Primary |
| `33.380501,-82.687296` | Warrenton, Warrenton Primary |
| `33.457634,-84.896958` | Plant Yates, Yates |
| `33.563666,-80.708996` | Cameron, Cameron Jct |
| `33.706504,-82.753196` | Washington, Washington #3 |
| `33.706671,-84.950508` | Garrett Rd, Garrett Road, Hickory Level |
| `33.741022,-84.854865` | V. Rica, Villa Rica |
| `33.792015,-84.629635` | Thornton Rd, Thornton Road |
| `33.995459,-83.753131` | Winder, Winder Primary |
| `34.086791,-84.718832` | Grassy Hollow, Hill View |
| `34.252051,-83.671813` | Lawrence Smith, Pond Fork |
| `34.263022,-83.809673` | Gainesville #1, Gainesville #2 |
| `34.295984,-81.314549` | VCS1, VCS2 |

## 4. One name, different coordinates (4 names) — why grouping is by coordinate

Each of these is a name used for two genuinely different places. Merging by name would have fused them.

| Name | Coordinate | Projects |
|---|---|---|
| Farley | `30.751338,-84.533827` | GPC:20223 |
| Farley | `31.222476,-85.112119` | GPC:21063 |
| Goshen | `32.248701,-81.209472` | GPC:20065, GPC:20785 |
| Goshen | `33.31976,-81.995312` | GPC:21116 |
| Northwest | `33.802344,-84.478472` | GPC:20761 |
| Northwest | `33.821755,-84.484305` | GPC:18889, GPC:20777 |
| Rockville | `33.321,-83.255` | GPC:21077 |
| Rockville | `33.327636,-83.218768` | GPC:21094 |

McIntosh is no longer on this list: after the correction, `GPC:20277` seq 1 and `GPC:20065` seq 2 share
the verified McIntosh substation at `32.35212,-81.17511`.

## 5. Data-quality findings — reported, not fixed (4 points used twice in one project)

A line whose two ends resolve to the *same* coordinate has one end in the wrong place. These are the
four, and they are worth a look on the data side:

| Point | Project | Rows at this coordinate |
|---|---|---|
| `33.032069,-84.201258` | GPC:20874 | Barnesville Primary (seq 1), Barnesville #1 (seq 2) |
| `33.563666,-80.708996` | DESC:6810 T | Cameron Jct (seq 1), Cameron (seq 2) |
| `34.086791,-84.718832` | GPC:20150 | Hill View (seq 1), Grassy Hollow (seq 2) |
| `34.252051,-83.671813` | GPC:21130 | Lawrence Smith (seq 2), Pond Fork (seq 3) |

The clearest one is `GPC:20150`: **Hill View** (seq 1) and **Grassy Hollow** (seq 2) resolve to the same
coordinate, so one of that line's two ends is wrong. `GPC:21130` has three rows at one coordinate
(Pond Fork twice plus Lawrence Smith), and `GPC:20874` has Barnesville, Barnesville Primary and
Barnesville #1 collapsing together. `DESC:6810 T` (Cameron / Cameron Jct) is the mildest — plausibly the
same substation printed two ways.

None of this is fixed here. The join tolerates it: such a project simply links the same point twice at
different `seq`, and `point_usage.n_projects` counts distinct projects, so it is not double-counted.
