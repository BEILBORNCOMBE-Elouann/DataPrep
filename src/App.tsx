import { useMemo, useState } from 'react'
import './App.css'
import {
  analyzeNumericColumns,
  buildDuplicateGroups,
  detectOutliers,
  estimateLabelImpact,
  findMissingRowsByHeaders,
  parseCsvText,
  splitRows,
  transformValue,
  type CsvRow,
  type TransformMethod,
} from './analysis'

type Ratios = [number, number, number]

function clampNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function escapeCsvCell(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function buildCsv(headers: string[], rows: CsvRow[]) {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const lines = rows.map((row) => headers.map((header) => escapeCsvCell(row[header] ?? '')).join(','))
  return [headerLine, ...lines].join('\n')
}

function downloadTextFile(fileName: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatCompactNumber(value: number) {
  if (Number.isNaN(value)) {
    return '0'
  }

  const rounded = Number(value.toFixed(6))
  return String(rounded)
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5zm16.7-9.8c.4-.4.4-1 0-1.4L18.7 3.3c-.4-.4-1-.4-1.4 0l-1.6 1.6 3.4 3.4 1.6-1.6z" fill="currentColor" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 7h12v2H6V7zm2 3h8v10H8V10zm2-6h4l1 1h4v2H5V5h4l1-1z" fill="currentColor" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 16.2l-3.5-3.5L4 14.2 9 19l12-12-1.5-1.5z" fill="currentColor" />
    </svg>
  )
}

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" fill="currentColor" />
    </svg>
  )
}

function ApplyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2 3 7v5c0 5.1 3.8 9.9 9 11 5.2-1.1 9-5.9 9-11V7l-9-5zm-1.1 14.2L7.7 13l1.4-1.4 1.8 1.8 4.1-4.1 1.4 1.4-5.5 5.5z" fill="currentColor" />
    </svg>
  )
}

function RevertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6c-2.8 0-5.2-1.9-5.8-4.5H4.2C4.9 18.3 8.1 21 12 21c4.4 0 8-3.6 8-8s-3.6-8-8-8z" fill="currentColor" />
    </svg>
  )
}

function App() {
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<CsvRow[]>([])
  const [rowsPerPage, setRowsPerPage] = useState<20 | 50>(20)
  const [page, setPage] = useState(1)

  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState<CsvRow | null>(null)

  const [labelColumn, setLabelColumn] = useState('')
  const [transformMethod, setTransformMethod] = useState<TransformMethod>('minmax')
  const [selectedTransformColumns, setSelectedTransformColumns] = useState<string[]>([])
  const [selectedOutlierColumns, setSelectedOutlierColumns] = useState<string[]>([])
  const [enablePartition, setEnablePartition] = useState(false)
  const [ratios, setRatios] = useState<Ratios>([70, 15, 15])
  const [filters, setFilters] = useState({ duplicate: false, missing: false, outlier: false })
  const [rowsBeforeLastTransform, setRowsBeforeLastTransform] = useState<CsvRow[] | null>(null)

  const duplicateGroups = useMemo(() => buildDuplicateGroups(headers, rows), [headers, rows])
  const missingRows = useMemo(() => findMissingRowsByHeaders(headers, rows), [headers, rows])
  const numericColumns = useMemo(() => analyzeNumericColumns(headers, rows), [headers, rows])
  const availableOutlierColumns = useMemo(() => numericColumns.map((item) => item.column), [numericColumns])
  const effectiveOutlierColumns = useMemo(() => {
    const filtered = selectedOutlierColumns.filter((column) => availableOutlierColumns.includes(column))
    return filtered.length > 0 ? filtered : [...availableOutlierColumns]
  }, [selectedOutlierColumns, availableOutlierColumns])
  const outlierRows = useMemo(() => detectOutliers(rows, effectiveOutlierColumns), [rows, effectiveOutlierColumns])
  const featureImpact = useMemo(() => estimateLabelImpact(headers, rows, labelColumn), [headers, rows, labelColumn])
  const availableTransformColumns = useMemo(() => numericColumns.map((item) => item.column), [numericColumns])
  const effectiveTransformColumns = useMemo(() => {
    const filtered = selectedTransformColumns.filter((column) => availableTransformColumns.includes(column))
    return filtered.length > 0 ? filtered : [...availableTransformColumns]
  }, [selectedTransformColumns, availableTransformColumns])

  const duplicateRowSet = useMemo(() => {
    const set = new Set<number>()
    duplicateGroups.forEach((group) => group.rowIndexes.forEach((index) => set.add(index)))
    return set
  }, [duplicateGroups])

  const duplicatePartnersMap = useMemo(() => {
    const map = new Map<number, number[]>()

    duplicateGroups.forEach((group) => {
      group.rowIndexes.forEach((index) => {
        const partners = group.rowIndexes.filter((otherIndex) => otherIndex !== index)
        map.set(index, partners)
      })
    })

    return map
  }, [duplicateGroups])

  const missingByRow = useMemo(() => {
    const map = new Map<number, Set<string>>()
    missingRows.forEach((item) => {
      map.set(item.index, new Set(item.missingColumns))
    })
    return map
  }, [missingRows])

  const outlierRowSet = useMemo(() => new Set(outlierRows.map((item) => item.index)), [outlierRows])
  const outlierByRow = useMemo(() => {
    const map = new Map<number, Set<string>>()

    outlierRows.forEach((item) => {
      map.set(item.index, new Set(item.reasons.map((reason) => reason.column)))
    })

    return map
  }, [outlierRows])

  const filteredRows = useMemo(() => {
    const noFilter = !filters.duplicate && !filters.missing && !filters.outlier

    if (noFilter) {
      return rows.map((row, index) => ({ row, index }))
    }

    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ index }) => {
        const matchesDuplicate = filters.duplicate && duplicateRowSet.has(index)
        const matchesMissing = filters.missing && missingByRow.has(index)
        const matchesOutlier = filters.outlier && outlierRowSet.has(index)
        return matchesDuplicate || matchesMissing || matchesOutlier
      })
  }, [rows, filters, duplicateRowSet, missingByRow, outlierRowSet])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * rowsPerPage
  const pageRows = filteredRows.slice(pageStart, pageStart + rowsPerPage)

  const splitPreview = useMemo(() => splitRows(rows, ratios), [rows, ratios])

  const topFeatures = featureImpact.slice(0, 5)
  const lowFeatures = featureImpact.length > 5 ? [...featureImpact].slice(-5).reverse() : []

  const transformedPreview = useMemo(() => {
    if (rows.length === 0 || numericColumns.length === 0) {
      return [] as Array<{ column: string; before: string; after: string }>
    }

    const sampleRow = rows[0]

    return numericColumns
      .filter((columnStats) => effectiveTransformColumns.includes(columnStats.column))
      .slice(0, 6)
      .map((columnStats) => {
      const before = sampleRow[columnStats.column] ?? ''
      const afterNumber = transformValue(before, transformMethod, columnStats)

      return {
        column: columnStats.column,
        before,
        after: afterNumber === null ? '' : formatCompactNumber(afterNumber),
      }
      })
  }, [rows, numericColumns, transformMethod, effectiveTransformColumns])

  function onUpload(file: File | null) {
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsvText(String(reader.result ?? ''))
      const parsedNumericColumns = analyzeNumericColumns(parsed.headers, parsed.rows).map((item) => item.column)
      setFileName(file.name)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setRowsBeforeLastTransform(null)
      setPage(1)
      setEditingRowIndex(null)
      setEditingDraft(null)
      setSelectedTransformColumns(parsedNumericColumns)
      setSelectedOutlierColumns(parsedNumericColumns)
      setLabelColumn((current) => (parsed.headers.includes(current) ? current : parsed.headers.at(-1) ?? ''))
    }
    reader.readAsText(file)
  }

  function deleteRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
    setEditingRowIndex((current) => {
      if (current === null) {
        return null
      }

      if (current === index) {
        return null
      }

      return current > index ? current - 1 : current
    })
    setEditingDraft((current) => (editingRowIndex === index ? null : current))
  }

  function startEdit(index: number) {
    setEditingRowIndex(index)
    setEditingDraft({ ...(rows[index] ?? {}) })
  }

  function cancelEdit() {
    setEditingRowIndex(null)
    setEditingDraft(null)
  }

  function saveEdit() {
    if (editingRowIndex === null || editingDraft === null) {
      return
    }

    setRows((current) => current.map((row, index) => (index === editingRowIndex ? { ...editingDraft } : row)))
    cancelEdit()
  }

  function updateDraftCell(header: string, value: string) {
    setEditingDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [header]: value,
      }
    })
  }

  function deleteColumn(headerToDelete: string) {
    if (headers.length <= 1) {
      return
    }

    setHeaders((current) => current.filter((header) => header !== headerToDelete))
    setRows((current) => current.map((row) => {
      const next = { ...row }
      delete next[headerToDelete]
      return next
    }))
    setEditingDraft((current) => {
      if (!current) {
        return current
      }

      const next = { ...current }
      delete next[headerToDelete]
      return next
    })
    setLabelColumn((current) => (current === headerToDelete ? '' : current))
    setSelectedTransformColumns((current) => current.filter((column) => column !== headerToDelete))
  }

  function toggleTransformColumn(column: string) {
    setSelectedTransformColumns((current) => {
      const filtered = current.filter((item) => availableTransformColumns.includes(item))
      const base = filtered.length > 0 ? filtered : [...availableTransformColumns]

      if (base.includes(column)) {
        return base.filter((item) => item !== column)
      }

      return [...base, column]
    })
  }

  function toggleOutlierColumn(column: string) {
    setSelectedOutlierColumns((current) => {
      const filtered = current.filter((item) => availableOutlierColumns.includes(item))
      const base = filtered.length > 0 ? filtered : [...availableOutlierColumns]

      if (base.includes(column)) {
        return base.filter((item) => item !== column)
      }

      return [...base, column]
    })
  }

  function downloadModifiedCsv() {
    if (headers.length === 0) {
      return
    }

    const csv = buildCsv(headers, rows)
    const outputName = fileName ? `${fileName.replace(/\.csv$/i, '')}_cleaned.csv` : 'cleaned.csv'
    downloadTextFile(outputName, csv)
  }

  function applyNumericTransformations() {
    if (headers.length === 0 || effectiveTransformColumns.length === 0) {
      return
    }

    const numericMap = new Map(numericColumns.map((item) => [item.column, item]))

    setRows((current) => {
      setRowsBeforeLastTransform(current.map((row) => ({ ...row })))

      return current.map((row) => {
      const next: CsvRow = { ...row }

      effectiveTransformColumns.forEach((header) => {
        const stats = numericMap.get(header)

        if (!stats) {
          return
        }

        const transformed = transformValue(row[header], transformMethod, stats)
        if (transformed !== null) {
          next[header] = formatCompactNumber(transformed)
        }
      })

      return next
      })
    })
  }

  function revertLastTransformation() {
    if (!rowsBeforeLastTransform) {
      return
    }

    setRows(rowsBeforeLastTransform.map((row) => ({ ...row })))
    setRowsBeforeLastTransform(null)
  }

  function downloadSplitPart(part: 0 | 1 | 2) {
    if (headers.length === 0) {
      return
    }

    const suffix = part + 1
    const outputName = fileName ? `${fileName.replace(/\.csv$/i, '')}_part_${suffix}.csv` : `part_${suffix}.csv`
    downloadTextFile(outputName, buildCsv(headers, splitPreview[part]))
  }

  function toggleFilter(filter: 'duplicate' | 'missing' | 'outlier') {
    setFilters((current) => ({ ...current, [filter]: !current[filter] }))
    setPage(1)
  }

  return (
    <main className="simple-shell">
      <header className="import-bar">
        <label className="import-button">
          Importer un CSV
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Importer un fichier CSV"
            onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
          />
        </label>
        <h1>DataPrep</h1>
        <div className="file-meta">
          <span>{fileName || 'Aucun fichier chargé'}</span>
          <span>{rows.length} lignes</span>
        </div>
      </header>

      <section className="table-panel">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <label htmlFor="rows-per-page">Lignes par page</label>
            <select
              id="rows-per-page"
              value={rowsPerPage}
              onChange={(event) => {
                setRowsPerPage(Number(event.target.value) as 20 | 50)
                setPage(1)
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="toolbar-group page-controls">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
              Précédent
            </button>
            <span>Page {currentPage} / {totalPages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>
              Suivant
            </button>
          </div>

          <div className="legend">
            <button
              type="button"
              className={`legend-item duplicate ${filters.duplicate ? 'active' : ''}`}
              onClick={() => toggleFilter('duplicate')}
            >
              Dupliqué(s)
            </button>
            <button
              type="button"
              className={`legend-item missing ${filters.missing ? 'active' : ''}`}
              onClick={() => toggleFilter('missing')}
            >
              Manquant(s)
            </button>
            <button
              type="button"
              className={`legend-item outlier ${filters.outlier ? 'active' : ''}`}
              onClick={() => toggleFilter('outlier')}
            >
              Outlier(s)
            </button>
          </div>
        </div>

        <div className="outlier-column-picker">
          <span>Colonnes analysées pour outliers:</span>
          <div className="outlier-column-list">
            {availableOutlierColumns.length === 0 ? (
              <span className="muted">Aucune colonne numérique</span>
            ) : (
              availableOutlierColumns.map((column) => (
                <label key={`outlier-${column}`} className="column-check compact">
                  <input
                    type="checkbox"
                    checked={effectiveOutlierColumns.includes(column)}
                    onChange={() => toggleOutlierColumn(column)}
                  />
                  {column}
                </label>
              ))
            )}
          </div>
        </div>

        {headers.length === 0 ? (
          <div className="empty-box">Importé un fichier pour afficher l'aperçu paginé et éditable.</div>
        ) : (
          <div className="table-wrap">
            <table className="csv-table">
              <thead>
                <tr>
                  <th>#</th>
                  {headers.map((header) => (
                    <th key={header}>
                      <div className="column-head">
                        <span>{header}</span>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => deleteColumn(header)}
                          disabled={headers.length <= 1}
                          title={`Supprimer la colonne ${header}`}
                          aria-label={`Supprimer la colonne ${header}`}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ row, index: absoluteIndex }) => {
                  const missingColumns = missingByRow.get(absoluteIndex) ?? new Set<string>()
                  const outlierColumns = outlierByRow.get(absoluteIndex) ?? new Set<string>()
                  const isDuplicate = duplicateRowSet.has(absoluteIndex)
                  const duplicatePartners = duplicatePartnersMap.get(absoluteIndex) ?? []
                  const isOutlier = outlierRowSet.has(absoluteIndex)
                  const isEditing = editingRowIndex === absoluteIndex

                  return (
                    <tr
                      key={`row-${absoluteIndex}`}
                      className={`${isDuplicate ? 'row-duplicate' : ''} ${isOutlier ? 'row-outlier' : ''}`.trim()}
                    >
                      <td>{absoluteIndex + 1}</td>
                      {headers.map((header) => (
                        <td
                          key={`${absoluteIndex}-${header}`}
                          className={`${missingColumns.has(header) ? 'cell-missing' : ''} ${outlierColumns.has(header) ? 'cell-outlier' : ''}`.trim()}
                        >
                          {isEditing ? (
                            <input
                              value={editingDraft?.[header] ?? ''}
                              onChange={(event) => updateDraftCell(header, event.target.value)}
                              aria-label={`Edition ${header} ligne ${absoluteIndex + 1}`}
                            />
                          ) : (
                            row[header] ?? ''
                          )}
                        </td>
                      ))}
                      <td className="row-actions">
                        {isEditing ? (
                          <>
                            <button type="button" className="icon-button success" onClick={saveEdit} title="Sauver" aria-label="Sauver">
                              <SaveIcon />
                            </button>
                            <button type="button" className="icon-button" onClick={cancelEdit} title="Annuler" aria-label="Annuler">
                              <CancelIcon />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => startEdit(absoluteIndex)}
                              title="Modifier la ligne"
                              aria-label="Modifier la ligne"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => deleteRow(absoluteIndex)}
                              title="Supprimer la ligne"
                              aria-label="Supprimer la ligne"
                            >
                              <DeleteIcon />
                            </button>
                          </>
                        )}
                        {duplicatePartners.length > 0 && (
                          <span className="duplicate-links" title="Autres lignes liees a ce doublon">
                            Dup: {duplicatePartners.map((index) => index + 1).join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h2>Impact des features</h2>
          <div className="inline-controls">
            <label htmlFor="label-column">Label</label>
            <select id="label-column" value={labelColumn} onChange={(event) => setLabelColumn(event.target.value)}>
              <option value="">Selectionner</option>
              {headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>

          <div className="feature-lists">
            <div>
              <h3>Plus impactantes</h3>
              {topFeatures.length === 0 ? <p className="muted">Pas assez de donnees</p> : (
                <ul>
                  {topFeatures.map((item) => (
                    <li key={`top-${item.column}`}>{item.column} ({item.score.toFixed(3)})</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Moins impactantes</h3>
              {lowFeatures.length === 0 ? <p className="muted">Pas assez de donnees</p> : (
                <ul>
                  {lowFeatures.map((item) => (
                    <li key={`low-${item.column}`}>{item.column} ({item.score.toFixed(3)})</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Transformations numeriques flottantes</h2>
          <div className="inline-controls">
            <label htmlFor="transform-method">Methode</label>
            <select
              id="transform-method"
              value={transformMethod}
              onChange={(event) => setTransformMethod(event.target.value as TransformMethod)}
            >
              <option value="identity">Identite</option>
              <option value="minmax">Min-max</option>
              <option value="zscore">Z-score</option>
              <option value="robust">Robuste (mediane)</option>
              <option value="decimal">Decimal scaling</option>
            </select>
            <button
              type="button"
              className="icon-button success"
              onClick={applyNumericTransformations}
              disabled={rows.length === 0 || effectiveTransformColumns.length === 0}
              title="Appliquer au fichier"
              aria-label="Appliquer au fichier"
            >
              <ApplyIcon />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={revertLastTransformation}
              disabled={rowsBeforeLastTransform === null}
              title="Revert transformation"
              aria-label="Revert transformation"
            >
              <RevertIcon />
            </button>
          </div>

          <div className="column-picker">
            {availableTransformColumns.length === 0 ? (
              <p className="muted">Aucune colonne numérique détectée.</p>
            ) : (
              availableTransformColumns.map((column) => (
                <label key={`transform-${column}`} className="column-check">
                  <input
                    type="checkbox"
                    checked={effectiveTransformColumns.includes(column)}
                    onChange={() => toggleTransformColumn(column)}
                  />
                  {column}
                </label>
              ))
            )}
          </div>

          <div className="preview-list">
            {transformedPreview.length === 0 ? (
              <p className="muted"></p>
            ) : (
              transformedPreview.map((item) => (
                <div key={item.column} className="preview-item">
                  <strong>{item.column}</strong>
                  <span>{item.before || 'vide'} {' -> '} {item.after || 'vide'}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <h2>Partition et téléchargement</h2>
          <div className="inline-controls">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={enablePartition}
                onChange={(event) => setEnablePartition(event.target.checked)}
              />
              Activer la partition en 3 fichiers
            </label>
          </div>

          {enablePartition && (
            <div className="ratio-grid">
              {ratios.map((ratio, index) => (
                <label key={`ratio-${index}`}>
                  Groupe {index + 1}
                  <input
                    type="number"
                    min={0}
                    value={ratio}
                    onChange={(event) => {
                      const value = clampNonNegative(Number(event.target.value))
                      setRatios((current) => {
                        const next = [...current] as Ratios
                        next[index] = value
                        return next
                      })
                    }}
                  />
                </label>
              ))}
              <div className="split-counts">
                <span>G1: {splitPreview[0].length}</span>
                <span>G2: {splitPreview[1].length}</span>
                <span>G3: {splitPreview[2].length}</span>
              </div>
            </div>
          )}

          <div className="download-actions">
            <button type="button" onClick={downloadModifiedCsv} disabled={rows.length === 0}>Telecharger CSV modifie</button>
            {enablePartition && (
              <>
                <button type="button" onClick={() => downloadSplitPart(0)} disabled={rows.length === 0}>Telecharger groupe 1</button>
                <button type="button" onClick={() => downloadSplitPart(1)} disabled={rows.length === 0}>Telecharger groupe 2</button>
                <button type="button" onClick={() => downloadSplitPart(2)} disabled={rows.length === 0}>Telecharger groupe 3</button>
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
