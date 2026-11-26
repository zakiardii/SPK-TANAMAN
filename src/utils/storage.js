const STORAGE_KEY = 'spk-tanaman-v1'
export const WATER_UNIT = 'Liter (L)'
export const WATER_BASIS = 'per ha/musim'
const LITERS_PER_HECTARE_PER_MM = 10000

export const initialCriteria = [
  { id: 'C1', name: 'Biaya Produksi', unit: 'Juta/ha', weight: 0.25, type: 'cost' },
  { id: 'C2', name: 'Hasil Panen', unit: 'Ton/ha', weight: 0.25, type: 'benefit' },
  { id: 'C3', name: 'Harga Jual', unit: 'Rp/kg', weight: 0.20, type: 'benefit' },
  { id: 'C4', name: 'Umur Panen', unit: 'Hari', weight: 0.15, type: 'cost' },
  { id: 'C5', name: 'Kebutuhan Air', unit: WATER_UNIT, basis: WATER_BASIS, weight: 0.15, type: 'cost' },
]

export const initialAlternatives = [
  { id: 'A1', name: 'Cabai Merah', description: 'Komoditas hortikultura bernilai jual tinggi, cocok untuk lahan berdrainase baik.', values: { C1: 42, C2: 12, C3: 32000, C4: 90, C5: 6500000 } },
  { id: 'A2', name: 'Jagung Manis', description: 'Tanaman pangan berumur pendek dengan permintaan pasar yang stabil.', values: { C1: 18, C2: 8, C3: 7500, C4: 75, C5: 5000000 } },
  { id: 'A3', name: 'Tomat', description: 'Tanaman sayuran produktif yang tumbuh optimal pada iklim sejuk.', values: { C1: 30, C2: 25, C3: 9000, C4: 85, C5: 7000000 } },
  { id: 'A4', name: 'Kacang Tanah', description: 'Legum yang relatif hemat air dan membantu memperbaiki kesuburan tanah.', values: { C1: 14, C2: 2.5, C3: 18000, C4: 100, C5: 3500000 } },
  { id: 'A5', name: 'Padi', description: 'Tanaman pangan pokok yang sesuai untuk lahan sawah dengan irigasi memadai.', values: { C1: 22, C2: 6, C3: 6500, C4: 115, C5: 12000000 } },
]

export const initialState = {
  alternatives: initialAlternatives,
  criteria: initialCriteria,
  results: null,
  lastCalculated: null,
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialState
    const parsed = JSON.parse(stored)
    const usesMillimeters = parsed.criteria?.some((criterion) => criterion.id === 'C5' && /mm\s*\/\s*musim/i.test(criterion.unit ?? ''))
    const fixedTypes = { C1: 'cost', C2: 'benefit', C3: 'benefit', C4: 'cost', C5: 'cost' }
    const criteria = (parsed.criteria ?? initialCriteria).map((criterion) => criterion.id === 'C5'
      ? { ...criterion, name: 'Kebutuhan Air', unit: WATER_UNIT, basis: WATER_BASIS, type: 'cost' }
      : { ...criterion, ...(fixedTypes[criterion.id] ? { type: fixedTypes[criterion.id] } : {}) })
    const alternatives = (parsed.alternatives ?? initialAlternatives).map((alternative) => {
      const oldValues = parsed.ratings?.[alternative.id] ?? {}
      const values = { ...oldValues, ...(alternative.values ?? {}) }
      if (usesMillimeters && Number.isFinite(Number(values.C5))) values.C5 = Number(values.C5) * LITERS_PER_HECTARE_PER_MM
      for (const criterion of criteria) {
        if (!(criterion.id in values)) values[criterion.id] = ''
      }
      return { id: alternative.id, name: alternative.name ?? '', description: alternative.description ?? '', values }
    })
    const restoredState = {
      ...initialState,
      ...parsed,
      alternatives,
      criteria,
      results: null,
      lastCalculated: null,
    }
    delete restoredState.ratings
    delete restoredState.method
    return restoredState
  } catch {
    return initialState
  }
}

export function saveState(state) {
  try {
    const stateWithoutLegacyFields = { ...state }
    delete stateWithoutLegacyFields.method
    delete stateWithoutLegacyFields.ratings
    delete stateWithoutLegacyFields.results
    delete stateWithoutLegacyFields.lastCalculated
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithoutLegacyFields))
  } catch (error) {
    console.error('Gagal menyimpan data ke LocalStorage:', error)
  }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY)
  return initialState
}

