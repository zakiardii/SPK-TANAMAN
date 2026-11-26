export function calculateSAW(alternatives, criteria) {
  if (alternatives.length < 4) throw new RangeError('SAW memerlukan minimal 4 alternatif.')
  if (criteria.length < 5) throw new RangeError('SAW memerlukan minimal 5 kriteria.')
  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0)
  if (criteria.some((criterion) => !Number.isFinite(Number(criterion.weight)) || Number(criterion.weight) < 0 || Number(criterion.weight) > 1) || Math.abs(totalWeight - 1) >= 0.00001) {
    throw new RangeError('Total bobot kriteria harus tepat 100%.')
  }
  const normalized = {}
  const weighted = {}
  const extrema = {}
  for (const criterion of criteria) {
    if (!['benefit', 'cost'].includes(criterion.type)) throw new TypeError(`Atribut ${criterion.id} harus berupa Benefit atau Cost.`)
    const values = alternatives.map((alternative) => Number(alternative.values?.[criterion.id]))
    if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new TypeError(`Nilai ${criterion.id} harus berupa angka nol atau lebih.`)
    if (criterion.type === 'cost' && values.some((value) => value === 0)) throw new RangeError(`Nilai Cost pada ${criterion.id} tidak boleh nol karena terjadi pembagian dengan nol.`)
    const target = criterion.type === 'benefit' ? Math.max(...values) : Math.min(...values)
    if (criterion.type === 'benefit' && target === 0) throw new RangeError(`Nilai maksimum Benefit pada ${criterion.id} tidak boleh nol.`)
    extrema[criterion.id] = { min: Math.min(...values), max: Math.max(...values), reference: target }
    for (const alternative of alternatives) {
      const value = Number(alternative.values?.[criterion.id])
      normalized[alternative.id] ??= {}
      weighted[alternative.id] ??= {}
      // SAW: benefit dibanding maksimum, cost dibanding minimum.
      const normalizedValue = criterion.type === 'benefit' ? value / target : target / value
      normalized[alternative.id][criterion.id] = normalizedValue
      weighted[alternative.id][criterion.id] = Number(criterion.weight) * normalizedValue
    }
  }
  const rows = alternatives.map((alternative) => ({
    alternativeId: alternative.id,
    score: criteria.reduce((sum, criterion) => sum + weighted[alternative.id][criterion.id], 0),
  })).sort((a, b) => b.score - a.score)
  let currentRank = 0
  let priorScore = null
  const rankedRows = rows.map((row, index) => {
    if (priorScore === null || Math.abs(row.score - priorScore) > 1e-10) currentRank = index + 1
    priorScore = row.score
    return { ...row, rank: currentRank }
  })
  return { normalized, weighted, extrema, rows: rankedRows }
}
