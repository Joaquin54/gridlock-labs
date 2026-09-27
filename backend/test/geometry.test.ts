import { describe, expect, test } from 'bun:test'
import { buildGeometry, type Coordinate } from '../src/lib/geometry'

const one: Coordinate[] = [[-82.16, 33.64]]
const two: Coordinate[] = [
  [-82.16, 33.64],
  [-82.19, 33.66],
]
const three: Coordinate[] = [...two, [-82.21, 33.68]]

describe('buildGeometry', () => {
  test('0 located points: null for every project type', () => {
    for (const type of ['line', 'station', 'multi_station', 'non_geographic', null] as const) {
      expect(buildGeometry(type, [])).toBeNull()
    }
  })

  test('1 located point: Point', () => {
    expect(buildGeometry('line', one)).toEqual({ type: 'Point', coordinates: [-82.16, 33.64] })
    expect(buildGeometry('multi_station', one)).toEqual({ type: 'Point', coordinates: [-82.16, 33.64] })
    expect(buildGeometry(null, one)).toEqual({ type: 'Point', coordinates: [-82.16, 33.64] })
  })

  test('>= 2 located points on a line: LineString in seq order', () => {
    expect(buildGeometry('line', three)).toEqual({ type: 'LineString', coordinates: three })
  })

  test('>= 2 located points on a multi_station: MultiPoint', () => {
    expect(buildGeometry('multi_station', two)).toEqual({ type: 'MultiPoint', coordinates: two })
  })

  test('station: Point, even when extra points slipped in', () => {
    expect(buildGeometry('station', one)).toEqual({ type: 'Point', coordinates: [-82.16, 33.64] })
    expect(buildGeometry('station', two)).toEqual({ type: 'Point', coordinates: [-82.16, 33.64] })
  })

  test('non_geographic: null even with located points', () => {
    expect(buildGeometry('non_geographic', two)).toBeNull()
  })

  test('coordinates stay [lon, lat]', () => {
    const geometry = buildGeometry('line', two)
    expect(geometry).not.toBeNull()
    const [lon, lat] = (geometry as { coordinates: Coordinate[] }).coordinates[0] as Coordinate
    expect(lon).toBeLessThan(0)
    expect(lat).toBeGreaterThan(0)
  })
})
