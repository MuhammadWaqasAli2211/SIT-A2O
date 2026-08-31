/**
 * Client-side CSV download. Extracted from the candidates page, which had
 * this as a private helper before the Completed Interviews screen needed the
 * same download-a-Blob pattern for a second table.
 *
 * Always exports whatever rows the caller currently has on screen — a
 * search/filtered view included — matching the "export what I'm looking at"
 * behaviour the candidates page already established, not a separate
 * unfiltered fetch.
 */
export function downloadCsv(header: string[], rows: string[][], filename: string) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [header, ...rows].map((row) => row.map(escape).join(','))

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
