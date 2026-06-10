export type CsvRow = Record<string, string>

export type TransformMethod = 'identity' | 'minmax' | 'zscore' | 'robust' | 'decimal'

export interface ParsedCsv {
  headers: string[]
  rows: CsvRow[]
}

export interface DuplicateGroup {
  key: string
  signature: string
  rowIndexes: number[]
  row: CsvRow
}

export interface MissingRow {
  index: number
  missingColumns: string[]
  row: CsvRow
}

export interface OutlierReason {
  column: string
  value: number
  median: number
  mad: number
  modifiedZ: number
}

export interface OutlierRow {
  index: number
  score: number
  reasons: OutlierReason[]
  row: CsvRow
}

export interface NumericColumnStats {
  column: string
  min: number
  max: number
  mean: number
  stdDev: number
  median: number
  mad: number
}

export interface FeatureImpactItem {
  column: string
  score: number
  labelBreakdown: Array<{
    label: string
    count: number
    mean: number
  }>
}

const MISSING_MARKERS = new Set(['', 'na', 'n/a', 'null', 'undefined', 'nan', '-'])

function normalizeHeader(value: string, index: number) {
  const header = value.trim()
  return header || `column_${index + 1}`
}

export function normalizeCell(value: string | undefined) {
  return (value ?? '').trim()
}

export function isMissingCell(value: string | undefined) {
  return MISSING_MARKERS.has(normalizeCell(value).toLowerCase())
}

export function parseFlexibleNumber(value: string | undefined) {
  const normalized = normalizeCell(value)

  if (!normalized) {
    return Number.NaN
  }

  const compact = normalized.replace(/\s+/g, '')
  const candidate = compact.includes(',') && !compact.includes('.') && compact.split(',').length === 2
    ? compact.replace(',', '.')
    : compact.replace(/,/g, '')

  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += character
  }

  cells.push(current)
  return cells
}

export function parseCsvText(text: string): ParsedCsv {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const matrix = lines.map((line) => parseCsvLine(line))
  const headers = matrix[0].map((header, index) => normalizeHeader(header, index))

  return {
    headers,
    rows: matrix.slice(1).map((row) => {
      const record: CsvRow = {}

      headers.forEach((header, index) => {
        record[header] = normalizeCell(row[index])
      })

      return record
    }),
  }
}

export function buildRowSignature(row: CsvRow, headers: string[]) {
  return headers.map((header) => normalizeCell(row[header])).join('\u241f')
}

function isIdentifierHeader(header: string) {
  const normalized = header.trim().toLowerCase()
  return normalized === 'id' || normalized.endsWith('_id') || normalized === 'uuid' || normalized === 'vin'
}

function getDuplicateComparableHeaders(headers: string[]) {
  const comparable = headers.filter((header) => !isIdentifierHeader(header))
  return comparable.length > 0 ? comparable : headers
}

export function detectDuplicateRows(rows: CsvRow[], headers: string[]) {
  const groups = new Map<string, number[]>()
  const comparableHeaders = getDuplicateComparableHeaders(headers)

  rows.forEach((row, index) => {
    const signature = buildRowSignature(row, comparableHeaders)
    const matches = groups.get(signature) ?? []
    matches.push(index)
    groups.set(signature, matches)
  })

  return Array.from(groups.entries())
    .filter(([, rowIndexes]) => rowIndexes.length > 1)
    .map(([signature, rowIndexes]) => ({
      key: signature,
      signature,
      rowIndexes,
      row: rows[rowIndexes[0]] ?? {},
    }))
}

export function buildDuplicateGroups(headers: string[], rows: CsvRow[]) {
  return detectDuplicateRows(rows, headers)
}

export function findMissingRows(rows: CsvRow[], headers: string[]) {
  return rows
    .map<MissingRow | null>((row, index) => {
      const missingColumns = headers.filter((header) => isMissingCell(row[header]))

      if (missingColumns.length === 0) {
        return null
      }

      return { index, missingColumns, row }
    })
    .filter((row): row is MissingRow => row !== null)
}

export function findMissingRowsByHeaders(headers: string[], rows: CsvRow[]) {
  return findMissingRows(rows, headers)
}

export function inferNumericColumns(rows: CsvRow[], headers: string[]) {
  return headers.filter((header) => {
    const observed = rows.map((row) => row[header]).filter((value) => !isMissingCell(value))

    if (observed.length < 2) {
      return false
    }

    const numericCount = observed.filter((value) => !Number.isNaN(parseFlexibleNumber(value))).length
    return numericCount / observed.length >= 0.6
  })
}

export function analyzeNumericColumns(headers: string[], rows: CsvRow[]) {
  const columns = inferNumericColumns(rows, headers)
  return columns.map((column) => {
    const numericValues = rows
      .map((row) => parseFlexibleNumber(row[column]))
      .filter((value): value is number => Number.isFinite(value))

    const average = mean(numericValues)
    const center = median(numericValues)

    return {
      column,
      min: numericValues.length ? Math.min(...numericValues) : 0,
      max: numericValues.length ? Math.max(...numericValues) : 0,
      mean: average,
      median: center,
      stdDev: standardDeviation(numericValues, average),
      mad: mad(numericValues, center),
    } satisfies NumericColumnStats
  })
}

export function median(values: number[]) {
  if (values.length === 0) {
    return Number.NaN
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function mean(values: number[]) {
  if (values.length === 0) {
    return Number.NaN
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[], average: number) {
  if (values.length < 2) {
    return 0
  }

  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function mad(values: number[], center: number) {
  return median(values.map((value) => Math.abs(value - center)))
}

function quantile(values: number[], ratio: number) {
  if (values.length === 0) {
    return Number.NaN
  }

  const sorted = [...values].sort((left, right) => left - right)
  const clamped = Math.min(1, Math.max(0, ratio))
  const position = (sorted.length - 1) * clamped
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex]
  }

  const weight = position - lowerIndex
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight
}

export function getNumericColumnStats(rows: CsvRow[], columns: string[]) {
  return Object.fromEntries(
    columns.map((column) => {
      const numericValues = rows
        .map((row) => parseFlexibleNumber(row[column]))
        .filter((value): value is number => Number.isFinite(value))

      if (numericValues.length === 0) {
        return [column, null]
      }

      const average = mean(numericValues)
      const center = median(numericValues)

      return [column, {
        column,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        mean: average,
        stdDev: standardDeviation(numericValues, average),
        median: center,
        mad: mad(numericValues, center),
      } satisfies NumericColumnStats]
    }),
  ) as Record<string, NumericColumnStats | null>
}

export function detectOutliers(rows: CsvRow[], columns: string[]) {
  const outliers = new Map<number, OutlierRow>()

  columns.forEach((column) => {
    const numericValues = rows
      .map((row) => parseFlexibleNumber(row[column]))
      .filter((value): value is number => Number.isFinite(value))

    if (numericValues.length < 3) {
      return
    }

    const center = median(numericValues)
    const scale = mad(numericValues, center)
    const lowTail = quantile(numericValues, 0.05)
    const highTail = quantile(numericValues, 0.95)

    rows.forEach((row, index) => {
      const value = parseFlexibleNumber(row[column])

      if (Number.isNaN(value)) {
        return
      }

      const modifiedZ = scale === 0 ? 0 : 0.6745 * ((value - center) / scale)
      const isTailOutlier = value <= lowTail || value >= highTail
      const isMadOutlier = scale !== 0 && Math.abs(modifiedZ) > 3.5

      if (!isTailOutlier && !isMadOutlier) {
        return
      }

      const existing = outliers.get(index)
      const reason = {
        column,
        value,
        median: center,
        mad: scale,
        modifiedZ,
      }

      if (existing) {
        existing.reasons.push(reason)
        existing.score = Math.max(existing.score, Math.abs(modifiedZ))
        return
      }

      outliers.set(index, {
        index,
        score: Math.abs(modifiedZ),
        reasons: [reason],
        row,
      })
    })
  })

  return Array.from(outliers.values()).sort((left, right) => right.score - left.score)
}

export function findOutliers(headers: string[], rows: CsvRow[]) {
  return detectOutliers(rows, inferNumericColumns(rows, headers))
}

export function shuffleRows(rows: CsvRow[]) {
  const shuffled = [...rows]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] ?? {}, shuffled[index] ?? {}]
  }

  return shuffled
}

export function splitRows(rows: CsvRow[], ratios: [number, number, number]) {
  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0)

  if (totalRatio <= 0) {
    return [[], [], []] as [CsvRow[], CsvRow[], CsvRow[]]
  }

  const normalized = ratios.map((ratio) => ratio / totalRatio)
  const firstCount = Math.round(rows.length * normalized[0])
  const secondCount = Math.round(rows.length * normalized[1])
  const first = rows.slice(0, firstCount)
  const second = rows.slice(firstCount, firstCount + secondCount)
  const third = rows.slice(firstCount + secondCount)

  return [first, second, third] as [CsvRow[], CsvRow[], CsvRow[]]
}

export function summarizeLabels(rows: CsvRow[], labelColumn: string) {
  if (!labelColumn) {
    return []
  }

  const counts = new Map<string, number>()

  rows.forEach((row) => {
    const label = normalizeCell(row[labelColumn]) || '(missing)'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
}

export function estimateLabelImpact(headers: string[], rows: CsvRow[], labelColumn: string) {
  return rankFeatureImpact(rows, labelColumn, inferNumericColumns(rows, headers.filter((header) => header !== labelColumn)))
}

export function rankFeatureImpact(rows: CsvRow[], labelColumn: string, columns: string[]) {
  if (!labelColumn) {
    return []
  }

  const labels = Array.from(new Set(rows.map((row) => normalizeCell(row[labelColumn]) || '(missing)')))
  const totalRows = rows.length

  return columns
    .map<FeatureImpactItem | null>((column) => {
      const numericValues = rows.map((row) => parseFlexibleNumber(row[column]))
      if (numericValues.every((value) => Number.isNaN(value))) {
        return null
      }

      const validPairs = rows
        .map((row, index) => ({
          label: normalizeCell(row[labelColumn]) || '(missing)',
          value: numericValues[index],
        }))
        .filter((pair) => Number.isFinite(pair.value))

      if (validPairs.length < 3) {
        return null
      }

      const overallMean = mean(validPairs.map((pair) => pair.value))
      let betweenGroupVariance = 0

      const breakdown = labels.map((label) => {
        const labelValues = validPairs.filter((pair) => pair.label === label).map((pair) => pair.value)
        const labelMean = labelValues.length > 0 ? mean(labelValues) : 0
        const count = labelValues.length

        if (count > 0) {
          betweenGroupVariance += (count / totalRows) * (labelMean - overallMean) ** 2
        }

        return { label, count, mean: labelMean }
      })

      const totalVariance = standardDeviation(validPairs.map((pair) => pair.value), overallMean) ** 2 || 1

      return {
        column,
        score: betweenGroupVariance / totalVariance,
        labelBreakdown: breakdown,
      }
    })
    .filter((item): item is FeatureImpactItem => item !== null)
    .sort((left, right) => right.score - left.score)
}

export function transformNumericValue(
  value: string | undefined,
  method: TransformMethod,
  stats: NumericColumnStats | null | undefined,
) {
  const numericValue = parseFlexibleNumber(value)

  if (Number.isNaN(numericValue) || !stats) {
    return null
  }

  switch (method) {
    case 'identity':
      return numericValue
    case 'minmax': {
      const range = stats.max - stats.min
      return range === 0 ? 0 : (numericValue - stats.min) / range
    }
    case 'zscore': {
      return stats.stdDev === 0 ? 0 : (numericValue - stats.mean) / stats.stdDev
    }
    case 'robust': {
      return stats.mad === 0 ? 0 : (numericValue - stats.median) / stats.mad
    }
    case 'decimal': {
      const magnitude = Math.max(1, Math.ceil(Math.log10(Math.max(1, Math.abs(stats.max), Math.abs(stats.min)))))
      return numericValue / 10 ** magnitude
    }
    default:
      return numericValue
  }
}

export function transformValue(
  value: string | undefined,
  method: TransformMethod,
  stats: NumericColumnStats | null | undefined,
) {
  return transformNumericValue(value, method, stats)
}
