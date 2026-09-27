/** RFC 4180 record separator. */
const CRLF = '\r\n'

/**
 * One CSV field. Quotes anything containing a comma, a double quote or a line
 * break, and doubles inner quotes. Project ids contain commas, so this matters.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

/** A CSV document, header row first. Header-only when there are no rows. */
export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  const lines = [headers.map(csvField).join(',')]
  for (const row of rows) lines.push(row.map(csvField).join(','))
  return `${lines.join(CRLF)}${CRLF}`
}
