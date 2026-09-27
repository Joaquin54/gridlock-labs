import { describe, expect, test } from 'bun:test'
import { csvField, toCsv } from '../src/lib/csv'

describe('csvField', () => {
  test('leaves plain values alone', () => {
    expect(csvField('DESC')).toBe('DESC')
    expect(csvField('6810 A')).toBe('6810 A')
    expect(csvField(115)).toBe('115')
    expect(csvField(true)).toBe('true')
  })

  test('renders null and undefined as blank', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })

  test('quotes ids containing commas', () => {
    expect(csvField('DESC:6808 N,O')).toBe('"DESC:6808 N,O"')
    expect(csvField('DESC:1060A, I, L')).toBe('"DESC:1060A, I, L"')
  })

  test('doubles inner quotes', () => {
    expect(csvField('a "quoted" name')).toBe('"a ""quoted"" name"')
    expect(csvField('"')).toBe('""""')
  })

  test('quotes newlines and carriage returns', () => {
    expect(csvField('line one\nline two')).toBe('"line one\nline two"')
    expect(csvField('a\r\nb')).toBe('"a\r\nb"')
  })
})

describe('toCsv', () => {
  test('writes a header row and CRLF line endings', () => {
    expect(toCsv(['a', 'b'], [[1, 2]])).toBe('a,b\r\n1,2\r\n')
  })

  test('is header-only when there are no rows', () => {
    expect(toCsv(['utility', 'project_key'], [])).toBe('utility,project_key\r\n')
  })

  test('round-trips a comma-bearing id as a single field', () => {
    const csv = toCsv(['id', 'utility'], [['DESC:6808 N,O', 'DESC']])
    expect(csv).toBe('id,utility\r\n"DESC:6808 N,O",DESC\r\n')
    // The quoted id is one field, so the row has two commas but three parts only
    // when naively split - which is exactly what the quoting prevents.
    expect(csv.split(CRLF_SPLIT)[1]).toBe('"DESC:6808 N,O",DESC')
  })
})

const CRLF_SPLIT = '\r\n'
