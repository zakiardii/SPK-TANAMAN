import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDown, ArrowRight, BarChart3, Check, ChevronDown, CircleHelp, ClipboardList,
  Download, FileSpreadsheet, FlaskConical, Gauge, Leaf, Menu, Plus, Printer, RotateCcw,
  Search, Sprout, Target, Trash2, TrendingUp, Trophy, Wheat, X, Pencil,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calculateSAW } from './utils/saw.js'
import { loadState, resetState, saveState } from './utils/storage.js'
import './App.css'
import './brand.css'
import './saw.css'
import './decision-matrix.css'
import './validation.css'
import './requirements.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge, group: 'MENU UTAMA' },
  { id: 'alternatives', label: 'Alternatif Tanaman', icon: Sprout },
  { id: 'criteria', label: 'Data Kriteria', icon: Target },
  { id: 'ratings', label: 'Matriks Keputusan', icon: ClipboardList },
  { id: 'method', label: 'Perhitungan SAW', icon: Activity, group: 'ANALISIS' },
  { id: 'results', label: 'Hasil Perangkingan', icon: BarChart3 },
  { id: 'visualization', label: 'Grafik Visualisasi', icon: TrendingUp },
  { id: 'report', label: 'Laporan', icon: FileSpreadsheet },
]
const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(({ id, label }) => [id, label]))
const WEIGHT_PALETTE = ['#14532d', '#16a34a', '#10b981', '#84cc16', '#fbbf24', '#0f766e']

function formatNumber(value, decimals = 2) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: decimals }).format(Number(value) || 0)
}
function formatWeight(value) { return `${formatNumber(Number(value) * 100, 1)}%` }
function getNextId(items, prefix) {
  const max = items.reduce((largest, item) => Math.max(largest, Number(item.id.replace(prefix, '')) || 0), 0)
  return `${prefix}${max + 1}`
}
function getValidationPage(issue) {
  if (/nilai|angka|normalisasi/i.test(issue ?? '')) return 'ratings'
  if (/bobot|kriteria/i.test(issue ?? '')) return 'criteria'
  return 'alternatives'
}
function getCalculationIssue(alternatives, criteria) {
  if (alternatives.length < 4) return 'Minimal 4 alternatif harus tersedia sebelum perhitungan SAW.'
  if (criteria.length < 5) return 'Minimal 5 kriteria harus tersedia sebelum perhitungan SAW.'
  if (criteria.some((criterion) => !['cost', 'benefit'].includes(criterion.type))) return 'Jenis kriteria harus berupa Cost atau Benefit.'
  const total = criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0)
  if (criteria.some((criterion) => !Number.isFinite(Number(criterion.weight)) || Number(criterion.weight) < 0 || Number(criterion.weight) > 1) || Math.abs(total - 1) >= 0.00001) {
    return `Total bobot saat ini ${formatWeight(total)}. Sesuaikan hingga tepat 100%.`
  }
  for (const alternative of alternatives) {
    for (const criterion of criteria) {
      const rawValue = alternative.values?.[criterion.id]
      const value = Number(rawValue)
      if (rawValue === '' || rawValue === null || rawValue === undefined || !Number.isFinite(value) || value < 0) {
        return `Nilai ${criterion.id} untuk ${alternative.name || alternative.id} wajib diisi dengan angka nol atau lebih.`
      }
    }
  }
  for (const criterion of criteria) {
    const values = alternatives.map((alternative) => Number(alternative.values[criterion.id]))
    if (criterion.type === 'benefit' && Math.max(...values) === 0) return `${criterion.id} (${criterion.name}) memiliki nilai maksimum 0, sehingga normalisasi Benefit tidak dapat dihitung.`
    if (criterion.type === 'cost' && values.some((value) => value === 0)) return `${criterion.id} (${criterion.name}) tidak boleh bernilai 0 untuk atribut Cost karena rumus SAW membagi dengan nilai tersebut.`
  }
  return ''
}
function App() {
  const [data, setData] = useState(loadState)
  const [page, setPage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => { saveState(data) }, [data])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const calculationIssue = useMemo(() => getCalculationIssue(data.alternatives, data.criteria), [data.alternatives, data.criteria])
  const results = useMemo(() => calculationIssue ? null : { ...calculateSAW(data.alternatives, data.criteria), method: 'SAW' }, [calculationIssue, data.alternatives, data.criteria])
  const sortedResults = results?.rows ?? []
  const winner = sortedResults.length ? data.alternatives.find((item) => item.id === sortedResults[0].alternativeId) : null
  const weightTotal = data.criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0)
  const weightsValid = data.criteria.every((criterion) => Number.isFinite(Number(criterion.weight)) && Number(criterion.weight) >= 0 && Number(criterion.weight) <= 1) && Math.abs(weightTotal - 1) < 0.00001

  function updateData(patch) {
    setData((current) => ({ ...current, ...patch, results: null, lastCalculated: null }))
  }
  function updateRatings(alternativeId, criterionId, value) {
    setData((current) => ({
      ...current,
      alternatives: current.alternatives.map((alternative) => alternative.id === alternativeId
        ? { ...alternative, values: { ...alternative.values, [criterionId]: value } }
        : alternative),
      results: null,
      lastCalculated: null,
    }))
  }
  function notify(message) { setToast(message) }
  function navigate(id) { setPage(id); setMobileOpen(false); setQuery('') }

  function saveAlternative(form) {
    const editing = modal?.type === 'alternative' && modal.editing
    const duplicate = data.alternatives.some((item) => item.id !== (editing ? modal.item.id : '') && item.name.trim().toLocaleLowerCase('id') === form.name.trim().toLocaleLowerCase('id'))
    if (duplicate) return notify('Nama tanaman sudah digunakan. Gunakan nama alternatif yang berbeda.')
    for (const criterion of data.criteria) {
      if (criterion.type === 'cost' && Number(form.values?.[criterion.id]) <= 0) {
        return notify(`${criterion.id} (${criterion.name}) harus lebih besar dari 0 karena digunakan sebagai pembagi SAW.`)
      }
    }
    setData((current) => {
      const id = editing ? modal.item.id : getNextId(current.alternatives, 'A')
      const alternative = {
        id,
        name: form.name.trim(),
        description: form.description.trim(),
        values: Object.fromEntries(current.criteria.map((criterion) => [criterion.id, Number(form.values?.[criterion.id] ?? modal.item?.values?.[criterion.id] ?? '')])),
      }
      return {
        ...current,
        alternatives: editing
          ? current.alternatives.map((item) => item.id === id ? alternative : item)
          : [...current.alternatives, alternative],
        results: null,
        lastCalculated: null,
      }
    })
    setModal(null)
    notify(editing ? 'Data alternatif berhasil diperbarui.' : 'Alternatif tanaman berhasil ditambahkan.')
  }
  function deleteAlternative(item) {
    if (!window.confirm(`Hapus alternatif ${item.name}? Data penilaiannya juga akan dihapus.`)) return
    setData((current) => ({ ...current, alternatives: current.alternatives.filter((entry) => entry.id !== item.id), results: null, lastCalculated: null }))
    notify('Alternatif berhasil dihapus.')
  }
  function saveCriterion(form) {
    const editing = modal?.type === 'criterion' && modal.editing
    const id = editing ? modal.item.id : getNextId(data.criteria, 'C')
    const requiredTypes = { C1: 'cost', C2: 'benefit', C3: 'benefit', C4: 'cost', C5: 'cost' }
    const criterion = { id, name: form.name.trim(), unit: id === 'C5' ? 'Liter (L)' : form.unit.trim(), ...(id === 'C5' ? { basis: 'per ha/musim' } : {}), weight: Number(form.weight), type: requiredTypes[id] ?? form.type }
    if (editing) updateData({ criteria: data.criteria.map((item) => item.id === id ? criterion : item) })
    else {
      setData((current) => ({
        ...current,
        criteria: [...current.criteria, criterion],
        alternatives: current.alternatives.map((alternative) => ({ ...alternative, values: { ...alternative.values, [id]: '' } })),
        results: null,
        lastCalculated: null,
      }))
    }
    setModal(null)
    notify(editing ? 'Kriteria berhasil diperbarui.' : 'Kriteria berhasil ditambahkan. Periksa kembali total bobot.')
  }
  function deleteCriterion(item) {
    if (['C1', 'C2', 'C3', 'C4', 'C5'].includes(item.id)) return notify('Lima kriteria utama TANAMORA tidak dapat dihapus.')
    if (data.criteria.length <= 5) return notify('Minimal harus tersedia 5 kriteria.')
    if (!window.confirm(`Hapus kriteria ${item.name}?`)) return
    setData((current) => ({
      ...current,
      criteria: current.criteria.filter((criterion) => criterion.id !== item.id),
      alternatives: current.alternatives.map((alternative) => {
        const values = { ...alternative.values }
        delete values[item.id]
        return { ...alternative, values }
      }),
      results: null, lastCalculated: null,
    }))
    notify('Kriteria berhasil dihapus.')
  }
  function calculate() {
    if (calculationIssue) return notify(calculationIssue)
    setPage('results')
    notify('Menampilkan hasil SAW terbaru yang dihitung otomatis.')
  }
  function resetSimulation() {
    if (!window.confirm('Reset seluruh data ke data simulasi awal? Perubahan Anda akan dihapus.')) return
    setData(resetState())
    setPage('dashboard')
    notify('Data simulasi berhasil dipulihkan.')
  }
  function exportCSV() {
    const rows = [
      ['TANAMORA - LAPORAN SPK PEMILIHAN JENIS TANAMAN'],
      ['Metode', 'SAW (Simple Additive Weighting)'],
      [],
      ['Kriteria', 'Satuan', 'Basis pengukuran', 'Bobot', 'Atribut'],
      ...data.criteria.map((criterion) => [criterion.name, criterion.unit, criterion.basis ?? '', criterion.weight, criterion.type]),
      [],
      ['Kode', 'Alternatif', ...data.criteria.map((criterion) => `${criterion.id} (${criterion.unit}${criterion.basis ? `, ${criterion.basis}` : ''})`), 'Nilai Akhir SAW', 'Peringkat'],
      ...data.alternatives.map((alternative) => {
        const ranking = sortedResults.findIndex((row) => row.alternativeId === alternative.id)
        const row = sortedResults[ranking]
        return [alternative.id, alternative.name, ...data.criteria.map((criterion) => alternative.values?.[criterion.id] ?? ''), row?.score ?? '', row ? row.rank : 'Belum dihitung']
      }),
    ]
    if (results) {
      rows.push([], ['MATRIKS NORMALISASI SAW'], ['Kode', 'Alternatif', ...data.criteria.map((criterion) => criterion.id)])
      for (const alternative of data.alternatives) {
        rows.push([alternative.id, alternative.name, ...data.criteria.map((criterion) => results.normalized[alternative.id][criterion.id])])
      }
      rows.push([], ['MATRIKS NORMALISASI BERBOBOT'], ['Kode', 'Alternatif', ...data.criteria.map((criterion) => `${criterion.id} × ${criterion.weight}`)])
      for (const alternative of data.alternatives) {
        rows.push([alternative.id, alternative.name, ...data.criteria.map((criterion) => results.weighted[alternative.id][criterion.id])])
      }
    }
    const content = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'laporan-spk-tanaman.csv'; link.click(); URL.revokeObjectURL(url)
    notify('File CSV berhasil diekspor.')
  }

  const chartData = sortedResults.map((row) => ({
    name: data.alternatives.find((alternative) => alternative.id === row.alternativeId)?.name ?? row.alternativeId,
    score: Number(row.score.toFixed(4)),
    rank: row.rank,
  }))
  const pageProps = { data, results, sortedResults, winner, weightTotal, weightsValid, calculationIssue, query, setQuery, setModal, notify, updateData, updateRatings, deleteAlternative, deleteCriterion, calculate, chartData, exportCSV, resetSimulation, navigate }

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Leaf size={22} fill="currentColor" /></div><div className="brand-copy"><strong>TANAMORA</strong><small>Tanaman Modern Recommendation &amp; Analysis</small></div><button className="sidebar-close icon-button" aria-label="Tutup menu" onClick={() => setMobileOpen(false)}><X size={19} /></button></div>
        <div className="project-chip"><div className="project-icon"><Wheat size={18} /></div><div><small>SMART AGRICULTURE</small><strong>Tanamora</strong></div><ChevronDown size={15} /></div>
        <nav className="side-nav" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item, index) => <div key={item.id}>
            {item.group && <div className={`nav-group ${index ? 'nav-group-later' : ''}`}>{item.group}</div>}
            <button className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{item.id === 'results' && winner && <span className="nav-dot" />}</button>
          </div>)}
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><strong>Butuh panduan?</strong><p>Pelajari cara menggunakan sistem SPK ini.</p><button onClick={() => navigate('method')}>Lihat panduan <ArrowRight size={14} /></button></div><div className="sidebar-version"><span className="online-dot" /> Sistem aktif <span>v1.0</span></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Buka navigasi" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="breadcrumb"><strong>TANAMORA</strong><span>/</span><strong>{PAGE_TITLES[page]}</strong></div></div><div className="topbar-actions"><div className="system-status"><span className="online-dot" /> Semua data tersimpan</div><div className="avatar" title="TANAMORA">TM</div></div></header>
        <div className="content-wrap">
          {page === 'dashboard' && <DashboardPage {...pageProps} />}
          {page === 'alternatives' && <AlternativesPage {...pageProps} />}
          {page === 'criteria' && <CriteriaPage {...pageProps} />}
          {page === 'ratings' && <RatingsPage {...pageProps} />}
          {page === 'method' && <MethodPage {...pageProps} />}
          {page === 'results' && <ResultsPage {...pageProps} />}
          {page === 'visualization' && <VisualizationPage {...pageProps} />}
          {page === 'report' && <ReportPage {...pageProps} />}
          <footer className="app-footer"><span>© 2026 TANAMORA · Smart Agriculture Decision Support System</span><span>Smart Decision for Better Farming.</span></footer>
        </div>
      </main>
      {toast && <div className="toast"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Tutup notifikasi" onClick={() => setToast('')}><X size={15} /></button></div>}
      {modal && <EntityModal modal={modal} criteria={data.criteria} alternatives={data.alternatives} nextAlternativeId={getNextId(data.alternatives, 'A')} onClose={() => setModal(null)} onSaveAlternative={saveAlternative} onSaveCriterion={saveCriterion} />}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>
}
function SectionTitle({ title, description, action }) { return <div className="section-title"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div> }
function Button({ children, variant = 'primary', icon: Icon, ...props }) { return <button className={`button button-${variant}`} {...props}>{Icon && <Icon size={16} />}{children}</button> }
function EmptyState({ title, text, action }) { return <div className="empty-state"><div className="empty-icon"><Sprout size={24} /></div><strong>{title}</strong><p>{text}</p>{action}</div> }

function DashboardPage({ data, results, sortedResults, winner, weightTotal, weightsValid, calculationIssue, chartData, navigate, resetSimulation, setModal, deleteAlternative }) {
  const weightData = data.criteria.map((criterion) => ({ name: criterion.id, fullName: criterion.name, value: Number(criterion.weight) * 100 }))
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const topThree = sortedResults.slice(0, 3)
  return <>
    <PageHeading eyebrow={today} title="Dashboard" description="Ringkasan keputusan dan data budidaya Anda." action={<Button onClick={() => setModal({ type: 'alternative', editing: false })} icon={Plus}>Tambah tanaman</Button>} />
    <section className="welcome-banner"><div className="welcome-copy"><div className="welcome-label"><span className="live-dot" /> TANAMAN MODERN RECOMMENDATION &amp; ANALYSIS</div><h1><span className="dashboard-brand">TANAMORA</span><br />Temukan tanaman<br />terbaik untuk <em>lahannya.</em></h1><p>Tanaman Modern Recommendation &amp; Analysis · Smart Decision for Better Farming.</p><p className="welcome-description">Analisis potensi pertanian dengan data dan metode yang tepat. Ambil keputusan budidaya dengan lebih terarah.</p><div className="welcome-buttons"><Button onClick={() => navigate('method')} icon={TrendingUp}>Mulai analisis <ArrowRight size={16} /></Button><Button variant="ghost-light" onClick={() => navigate('alternatives')}>Kelola data</Button></div><div className="banner-footnote"><span><FlaskConical size={14} /> Data simulasi untuk edukasi</span><span className="banner-separator" /><span>Analisis pertanian berbasis data</span></div></div><div className="welcome-art"><div className="sun-glow" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-plant plant-a"><Sprout size={88} strokeWidth={1.2} /></div><div className="art-plant plant-b"><Wheat size={70} strokeWidth={1.25} /></div><div className="art-ground" /><div className="art-tag"><div><span className="tag-icon"><Leaf size={16} /></span><span><small>REKOMENDASI CERDAS</small><strong>Berbasis kriteria</strong></span></div><span className="tag-spark">✦</span></div><span className="art-sparkle sparkle-a">✳</span><span className="art-sparkle sparkle-b">✦</span></div></section>
    <div className="stats-grid"><StatCard label="Alternatif Tanaman" value={data.alternatives.length} note="Pilihan komoditas" icon={Sprout} tone="green" /><StatCard label="Kriteria Penilaian" value={data.criteria.length} note="Parameter keputusan" icon={Target} tone="mint" /><StatCard label="Metode SPK" value="SAW" note="Simple Additive Weighting" icon={Activity} tone="orange" /><StatCard label="Rekomendasi Terbaik" value={winner?.name ?? 'Belum tersedia'} note={winner ? `Preferensi ${formatNumber(sortedScore(results), 4)}` : 'Lengkapi data untuk menghitung'} icon={Trophy} tone={winner ? 'green' : 'slate'} compact /></div>
    <div className="dashboard-grid"><section className="card chart-card"><SectionTitle title="Hasil analisis" description={results ? 'Perbandingan nilai preferensi · SAW' : 'Hasil SAW diperbarui otomatis saat data valid'} action={<button className="text-action" onClick={() => navigate('results')}>Lihat hasil <ArrowRight size={14} /></button>} />{results ? <div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1ee" /><XAxis dataKey="name" tickFormatter={(name) => name.length > 9 ? `${name.slice(0, 8)}…` : name} axisLine={false} tickLine={false} tick={{ fill: '#7b877d', fontSize: 11 }} interval={0} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa39c', fontSize: 11 }} /><Tooltip formatter={(value) => [formatNumber(value, 4), 'Nilai preferensi']} cursor={{ fill: '#f5f8f5' }} /><Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={45}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.rank === 1 ? '#15803d' : '#a7d8b5'} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="chart-empty"><div className="chart-empty-icon"><BarChart3 size={24} /></div><strong>Hasil belum tersedia</strong><span>{calculationIssue || 'Hasil SAW akan dihitung otomatis saat data valid.'}</span><Button onClick={() => navigate(getValidationPage(calculationIssue))} icon={TrendingUp}>Periksa data</Button></div>}</section>
      <section className="card weights-card"><SectionTitle title="Bobot kriteria" description="Distribusi prioritas penilaian" action={<button className="icon-button subtle" aria-label="Kelola kriteria" onClick={() => navigate('criteria')}><ArrowRight size={17} /></button>} />{data.criteria.length ? <><div className="weight-chart-wrap"><div className="weight-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={weightData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none">{weightData.map((item, index) => <Cell key={item.name} fill={WEIGHT_PALETTE[index % WEIGHT_PALETTE.length]} />)}</Pie><Tooltip formatter={(value) => [`${formatNumber(value, 1)}%`, 'Bobot']} /></PieChart></ResponsiveContainer><div className="pie-center"><strong>{formatNumber(weightTotal * 100, 0)}%</strong><span>Total bobot</span></div></div></div><div className="weight-legend">{data.criteria.slice(0, 5).map((criterion, index) => <div className="weight-row" key={criterion.id}><span className="legend-dot" style={{ background: WEIGHT_PALETTE[index % WEIGHT_PALETTE.length] }} /><span className="weight-name">{criterion.name}{criterion.id === 'C5' ? ' · Liter (L)' : ''}</span><strong>{formatWeight(criterion.weight)}</strong></div>)}</div>{!weightsValid && <div className="inline-warning"><CircleHelp size={14} /> Total bobot perlu disesuaikan menjadi 100%.</div>}</> : <EmptyState title="Belum ada kriteria" text="Tambahkan kriteria untuk memulai analisis." />}</section></div>
    <section className="card recommendation-card"><div className="recommendation-icon"><Trophy size={22} /></div><div className="recommendation-main"><span className="eyebrow">REKOMENDASI SAW OTOMATIS</span><h2>{winner ? winner.name : 'Belum tersedia'}</h2><p>{winner ? `Diperbarui otomatis dari ${data.alternatives.length} alternatif dan ${data.criteria.length} kriteria.` : calculationIssue || 'Hasil SAW akan tersedia otomatis saat data valid.'}</p></div>{winner ? <div className="recommendation-score"><strong>{formatNumber(sortedScore(results), 4)}</strong><span>Nilai preferensi</span></div> : <Button variant="outline" onClick={() => navigate(getValidationPage(calculationIssue))}>Periksa data <ArrowRight size={15} /></Button>}</section>
    {data.alternatives.length < 4 && <div className="info-banner"><div className="info-icon"><CircleHelp size={17} /></div><div><strong>Belum memenuhi syarat perhitungan</strong><span>Tambahkan {4 - data.alternatives.length} alternatif lagi. SAW memerlukan minimal empat tanaman.</span></div></div>}
    <section className="card table-card dashboard-table-card w-full min-w-0"><div className="table-toolbar"><div><strong>Data alternatif tanaman</strong><span>Nilai C1–C5 tersimpan bersama setiap alternatif</span></div><Button variant="outline" onClick={() => navigate('alternatives')}>Kelola data <ArrowRight size={14} /></Button></div><div className="table-scroll"><table className="dashboard-plant-table"><thead><tr><th>NO.</th><th>NAMA TANAMAN</th>{data.criteria.map((criterion) => <th key={criterion.id}>{criterion.id} · {criterion.name}<small>{criterion.unit}</small></th>)}<th className="align-right">AKSI</th></tr></thead><tbody>{data.alternatives.map((alternative, index) => <tr key={alternative.id}><td>{index + 1}</td><td><div className="crop-cell"><span className="alternative-icon"><Sprout size={16} /></span><strong>{alternative.name}</strong></div></td>{data.criteria.map((criterion) => <td key={criterion.id}>{formatNumber(alternative.values?.[criterion.id], 2)}</td>)}<td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${alternative.name}`} onClick={() => setModal({ type: 'alternative', editing: true, item: alternative })}><Pencil size={15} /></button><button className="icon-button danger-hover" aria-label={`Hapus ${alternative.name}`} onClick={() => deleteAlternative(alternative)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></section>
    <section className="card dashboard-top-card"><SectionTitle title="Ringkasan hasil SAW" description="Tiga tanaman dengan nilai preferensi tertinggi." action={<button className="text-action" onClick={() => navigate('results')}>Lihat perankingan <ArrowRight size={14} /></button>} />{topThree.length ? <div className="dashboard-top-list">{topThree.map((row) => { const crop = data.alternatives.find((alternative) => alternative.id === row.alternativeId); return <div className={`dashboard-top-row ${row.rank === 1 ? 'is-top' : ''}`} key={row.alternativeId}><span className="dashboard-top-rank">{String(row.rank).padStart(2, '0')}</span><span className="dashboard-top-name">{crop?.name ?? row.alternativeId}</span><span className="dashboard-top-score">{formatNumber(row.score, 4)}</span></div> })}</div> : <div className="dashboard-top-empty">{calculationIssue || 'Hasil rekomendasi akan tampil otomatis setelah data valid.'}</div>}</section>
    <div className="bottom-actions"><span>Data tersimpan otomatis di perangkat ini.</span><button onClick={resetSimulation}><RotateCcw size={14} /> Reset data simulasi</button></div>
  </>
}
function sortedScore(results) { return results?.rows?.[0]?.score ?? 0 }
function StatCard({ label, value, note, icon: Icon, tone, compact }) { return <div className="stat-card"><div className={`stat-icon stat-${tone}`}><Icon size={19} /></div><span className="stat-label">{label}</span><strong className={compact ? 'stat-text-value' : ''}>{value}</strong><small>{note}</small></div> }

function AlternativesPage(props) {
  const { data, query, setQuery, setModal, deleteAlternative, navigate } = props
  const filtered = data.alternatives.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading eyebrow="DATA MASTER" title="Alternatif tanaman" description="Kelola pilihan tanaman yang akan dibandingkan dalam perhitungan SAW." action={<Button onClick={() => setModal({ type: 'alternative', editing: false })} icon={Plus}>Tambah tanaman</Button>} />
    <section className="card table-card"><div className="table-toolbar"><div><strong>Daftar alternatif</strong><span>{data.alternatives.length} tanaman terdaftar</span></div><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari tanaman..." /></label></div>
      {filtered.length ? <div className="table-scroll"><table className="alternative-table"><thead><tr><th>KODE</th><th>NAMA TANAMAN</th><th>DESKRIPSI</th><th className="align-right">AKSI</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><span className="alternative-code">{item.id}</span></td><td><div className="crop-cell"><span className="alternative-icon"><Sprout size={17} /></span><strong>{item.name}</strong></div></td><td className="alternative-description">{item.description || <span className="muted-description">Belum ada deskripsi</span>}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${item.name}`} onClick={() => setModal({ type: 'alternative', editing: true, item })}><Pencil size={15} /></button><button className="icon-button danger-hover" aria-label={`Hapus ${item.name}`} onClick={() => deleteAlternative(item)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Tanaman tidak ditemukan" text="Coba kata kunci lain atau tambahkan alternatif baru." />}
      <div className="table-foot"><span>Menampilkan {filtered.length} dari {data.alternatives.length} alternatif</span><span>Nilai C1–C5 dikelola langsung di <button onClick={() => navigate('ratings')}>Matriks Keputusan <ArrowRight size={12} /></button></span></div></section>
    <div className="helper-note"><CircleHelp size={15} /><span>Alternatif digunakan sebagai pilihan yang akan diberi nilai dan dibandingkan berdasarkan kriteria.</span></div></>
}

function CriteriaPage({ data, weightTotal, weightsValid, setModal, deleteCriterion, updateData }) {
  return <><PageHeading eyebrow="PENGATURAN PENILAIAN" title="Data kriteria" description="Atur parameter, bobot prioritas, dan atribut untuk pengambilan keputusan." action={<Button onClick={() => setModal({ type: 'criterion', editing: false })} icon={Plus}>Tambah kriteria</Button>} />
    <div className={`weight-summary ${weightsValid ? 'valid' : 'invalid'}`}><div className="weight-summary-icon">{weightsValid ? <Check size={19} /> : <CircleHelp size={19} />}</div><div><strong>Total bobot kriteria</strong><span>{weightsValid ? 'Bobot sudah seimbang dan siap digunakan.' : `Bobot saat ini ${formatWeight(weightTotal)}. Sesuaikan total hingga tepat 100% sebelum menghitung.`}</span></div><div className="weight-total-number">{formatWeight(weightTotal)}<small>/ 100%</small></div></div>
    <section className="card table-card"><div className="table-toolbar"><div><strong>Daftar kriteria</strong><span>{data.criteria.length} parameter penilaian</span></div><div className="simulation-note"><span className="online-dot" /> Bobot bisa diubah langsung</div></div>
      <div className="criteria-list">{data.criteria.map((criterion) => <div className="criterion-row" key={criterion.id}><div className="criterion-id">{criterion.id}</div><div className="criterion-name"><strong>{criterion.name}</strong><span>{criterion.unit}{criterion.basis ? ` · ${criterion.basis}` : ''}</span></div><div className="criterion-weight"><div className="weight-control"><button aria-label={`Kurangi bobot ${criterion.name}`} onClick={() => updateData({ criteria: data.criteria.map((item) => item.id === criterion.id ? { ...item, weight: Math.max(0, Number((Number(item.weight) - 0.01).toFixed(2))) } : item) })}><ArrowDown size={13} /></button><input aria-label={`Bobot ${criterion.name}`} type="number" min="0" max="1" step="0.01" value={criterion.weight} onChange={(event) => updateData({ criteria: data.criteria.map((item) => item.id === criterion.id ? { ...item, weight: event.target.value === '' ? 0 : Number(event.target.value) } : item) })} /><button aria-label={`Tambah bobot ${criterion.name}`} className="up-control" onClick={() => updateData({ criteria: data.criteria.map((item) => item.id === criterion.id ? { ...item, weight: Number((Number(item.weight) + 0.01).toFixed(2)) } : item) })}><Plus size={13} /></button></div><span>{formatWeight(criterion.weight)}</span></div><span className={`type-badge ${criterion.type}`}>{criterion.type === 'benefit' ? <TrendingUp size={12} /> : <ArrowDown size={12} />}{criterion.type === 'benefit' ? 'Benefit' : 'Cost'}</span><div className="row-actions"><button className="icon-button" aria-label={`Edit ${criterion.name}`} disabled={['C1', 'C2', 'C3', 'C4', 'C5'].includes(criterion.id)} onClick={() => setModal({ type: 'criterion', editing: true, item: criterion })}><Pencil size={15} /></button><button className="icon-button danger-hover" aria-label={`Hapus ${criterion.name}`} disabled={['C1', 'C2', 'C3', 'C4', 'C5'].includes(criterion.id)} onClick={() => deleteCriterion(criterion)}><Trash2 size={15} /></button></div></div>)}</div>
      <div className="criteria-footer"><span><strong>Minimal 5 kriteria.</strong> Total bobot wajib 100% untuk perhitungan.</span><span>{weightsValid ? <><Check size={14} /> Siap untuk analisis</> : <><CircleHelp size={14} /> Bobot belum seimbang</>}</span></div></section>
    <div className="helper-note"><CircleHelp size={15} /><span><strong>Benefit</strong> berarti nilai lebih tinggi lebih baik. <strong>Cost</strong> berarti nilai lebih rendah lebih baik.</span></div></>
}

function RatingsPage({ data, updateRatings, navigate }) {
  const complete = data.criteria.every((criterion) => data.alternatives.every((alternative) => alternative.values?.[criterion.id] !== '' && Number.isFinite(Number(alternative.values?.[criterion.id])) && Number(alternative.values?.[criterion.id]) >= 0))
  return <><PageHeading eyebrow="MATRIKS KEPUTUSAN" title="Matriks keputusan" description="Lihat atau ubah nilai C1–C5. Semua nilai terhubung langsung dengan form alternatif dan tersimpan otomatis." />
    <div className="info-banner"><div className="info-icon"><FlaskConical size={17} /></div><div><strong>DATA SIMULASI</strong><span>Nilai air menggunakan basis Liter (L) per hektare per musim (L/ha/musim); seluruh alternatif memakai basis yang sama.</span></div></div>
    {!data.alternatives.length || !data.criteria.length ? <section className="card"><EmptyState title="Data belum lengkap" text="Tambahkan alternatif dan kriteria sebelum melihat matriks keputusan." action={<Button onClick={() => navigate('alternatives')}>Kelola alternatif</Button>} /></section> : <section className="card table-card matrix-card"><div className="table-toolbar"><div><strong>Matriks keputusan · Sumber nilai alternatif</strong><span>Nilai dari form alternatif; perubahan di matriks langsung tersimpan pada alternatif tersebut.</span></div><span className={`matrix-status ${complete ? 'complete' : ''}`}><span className="online-dot" /> {complete ? 'Semua nilai terisi' : 'Ada nilai belum diisi'}</span></div><div className="table-scroll"><table className="matrix-table"><thead><tr><th>ALTERNATIF</th>{data.criteria.map((criterion) => <th key={criterion.id}><span>{criterion.id} · {criterion.name}</span><small>{criterion.unit}{criterion.basis ? ` · ${criterion.basis}` : ''}</small><em className={`mini-attribute ${criterion.type}`}>{criterion.type === 'benefit' ? 'Benefit' : 'Cost'}</em></th>)}</tr></thead><tbody>{data.alternatives.map((alternative) => <tr key={alternative.id}><td><div className="matrix-crop"><Sprout size={17} /><div><strong>{alternative.name}</strong><small>{alternative.id}</small></div></div></td>{data.criteria.map((criterion) => <td key={criterion.id}><label className="matrix-input-wrap"><input type="number" min="0" step="any" aria-label={`${alternative.name} - ${criterion.name} (${criterion.unit}${criterion.basis ? ` ${criterion.basis}` : ''})`} value={alternative.values?.[criterion.id] ?? ''} onChange={(event) => updateRatings(alternative.id, criterion.id, event.target.value === '' ? '' : Number(event.target.value))} /><span>{criterion.unit}{criterion.basis ? ` · ${criterion.basis}` : ''}</span></label></td>)}</tr>)}</tbody></table></div><div className="matrix-foot"><span><span className="status-dot" /> {data.alternatives.length} alternatif × {data.criteria.length} kriteria</span><span>Nilai disimpan bersama data alternatif</span></div></section>}
    <div className="matrix-tip"><div className="tip-icon"><CircleHelp size={16} /></div><p>Pastikan nilai diisi dengan angka positif. Gunakan satuan yang tertera di atas setiap kolom agar perbandingan tetap konsisten.</p></div></>
}

function MethodPage({ data, results, sortedResults, winner, calculate, weightsValid, weightTotal, navigate, calculationIssue }) {
  return <><PageHeading eyebrow="METODE ANALISIS" title="Perhitungan SAW" description="TANAMORA menggunakan Simple Additive Weighting untuk menentukan rekomendasi tanaman." />
    <section className="card saw-method-card"><div className="saw-method-heading"><div className="method-icon"><Activity size={21} /></div><div><span className="method-code">METODE UTAMA</span><h2>SAW · Simple Additive Weighting</h2><p>Nilai setiap kriteria dinormalisasi sesuai atribut Benefit atau Cost, kemudian dijumlahkan setelah dikalikan bobotnya.</p></div></div><div className="saw-formulas"><div><small>NORMALISASI BENEFIT</small><strong>Rij = Xij / Max Xj</strong></div><div><small>NORMALISASI COST</small><strong>Rij = Min Xj / Xij</strong></div><div><small>NILAI PREFERENSI</small><strong>Vi = Σ (Wj × Rij)</strong></div></div><p className="saw-note">Metode SAW adalah satu-satunya metode aktif. Ranking dan hasil akan diperbarui secara otomatis setiap kali nilai alternatif, kriteria, atau bobot berubah.</p></section>
    <section className="card calculate-card"><div className="calculate-icon"><BarChart3 size={21} /></div><div className="calculate-copy"><strong>Hasil SAW diperbarui otomatis</strong><span>{data.alternatives.length} alternatif · {data.criteria.length} kriteria · Metode SAW</span>{!weightsValid && <small className="calc-warning">Bobot saat ini {formatWeight(weightTotal)}. Total wajib 100%.</small>}</div><div className="calculate-actions"><Button variant="outline" onClick={() => navigate('ratings')}>Periksa penilaian</Button><Button onClick={calculate} disabled={Boolean(calculationIssue)} icon={TrendingUp}>Lihat hasil</Button></div>{calculationIssue && <div className="calculation-issue">{calculationIssue}</div>}</section>
    {results ? <>
      <ResultMatrix title="1. Matriks keputusan (X)" description="Data mentah alternatif yang digunakan pada perhitungan." data={data} results={results} values="decision" />
      <ExtremaMatrix data={data} results={results} />
      <ResultMatrix title="3. Matriks normalisasi (R)" description="Benefit: Xij / nilai maksimum. Cost: nilai minimum / Xij." data={data} results={results} values="normalized" />
      <ResultMatrix title="4. Matriks normalisasi berbobot (R × W)" description="Setiap nilai normalisasi dikalikan bobot kriteria." data={data} results={results} values="weighted" />
      <PreferenceTable data={data} sortedResults={sortedResults} />
      {winner && <div className="calculation-conclusion">Nilai preferensi tertinggi: <strong>{winner.name}</strong> dengan Vi = {formatNumber(sortedResults[0]?.score, 5)}.</div>}
    </> : <section className="card"><EmptyState title="Perhitungan belum tersedia" text={calculationIssue || 'Lengkapi minimal empat alternatif, lima kriteria, dan total bobot 100%.'} action={<Button onClick={() => navigate(getValidationPage(calculationIssue))}>Periksa data</Button>} /></section>}
    <div className="helper-note"><CircleHelp size={15} /><span>Seluruh nilai di atas dihitung dari data saat ini tanpa pembulatan antara. Tampilan matriks dibulatkan agar mudah dibaca.</span></div></>
}

function ExtremaMatrix({ data, results }) {
  return <section className="card table-card result-matrix-card"><div className="table-toolbar"><div><strong>2. Nilai acuan normalisasi</strong><span>Nilai minimum dan maksimum pada tiap kriteria, sebelum normalisasi.</span></div></div><div className="table-scroll"><table className="report-table"><thead><tr><th>KODE</th><th>KRITERIA</th><th>ATRIBUT</th><th>MINIMUM</th><th>MAKSIMUM</th><th>NILAI ACUAN</th><th>BOBOT</th></tr></thead><tbody>{data.criteria.map((criterion) => { const range = results.extrema[criterion.id]; return <tr key={criterion.id}><td>{criterion.id}</td><td>{criterion.name} · {criterion.unit}</td><td>{criterion.type === 'benefit' ? 'Benefit' : 'Cost'}</td><td>{formatNumber(range.min, 4)}</td><td>{formatNumber(range.max, 4)}</td><td>{formatNumber(range.reference, 4)}</td><td>{formatWeight(criterion.weight)}</td></tr> })}</tbody></table></div></section>
}

function PreferenceTable({ data, sortedResults }) {
  return <section className="card table-card result-matrix-card"><div className="table-toolbar"><div><strong>5. Nilai preferensi akhir (Vi)</strong><span>Jumlah nilai normalisasi berbobot tiap tanaman, diurutkan dari tertinggi.</span></div></div><div className="table-scroll"><table className="report-table"><thead><tr><th>ALTERNATIF</th><th>NILAI PREFERENSI</th><th>PERINGKAT</th></tr></thead><tbody>{sortedResults.map((row) => <tr key={row.alternativeId}><td>{data.alternatives.find((item) => item.id === row.alternativeId)?.name ?? row.alternativeId}</td><td>{formatNumber(row.score, 6)}</td><td>{row.rank}</td></tr>)}</tbody></table></div></section>
}

function ResultMatrix({ title, description, data, results, values }) {
  return <section className="card table-card result-matrix-card"><div className="table-toolbar"><div><strong>{title}</strong><span>{description}</span></div></div><div className="table-scroll"><table className="report-table"><thead><tr><th>ALTERNATIF</th>{data.criteria.map((criterion) => <th key={criterion.id}>{criterion.id}{values === 'decision' ? ` · ${criterion.unit}${criterion.basis ? ` (${criterion.basis})` : ''}` : ''}</th>)}</tr></thead><tbody>{data.alternatives.map((alternative) => <tr key={alternative.id}><td>{alternative.id} · {alternative.name}</td>{data.criteria.map((criterion) => <td key={criterion.id}>{values === 'decision' ? formatNumber(alternative.values?.[criterion.id], 3) : formatNumber(results?.[values]?.[alternative.id]?.[criterion.id], 5)}</td>)}</tr>)}</tbody></table></div></section>
}

function ResultsPage({ data, results, sortedResults, winner, chartData, navigate, calculationIssue }) {
  if (!results) return <><PageHeading eyebrow="HASIL ANALISIS · SAW" title="Hasil perangkingan" description="Ranking SAW diperbarui otomatis saat data alternatif atau bobot berubah." /><section className="card"><EmptyState title="Hasil belum tersedia" text={calculationIssue || 'Hasil SAW akan dihitung otomatis saat data valid.'} action={<Button onClick={() => navigate(getValidationPage(calculationIssue))} icon={TrendingUp}>Periksa data</Button>} /></section></>
  const tiedWinners = sortedResults.filter((row) => row.rank === 1)
  return <><PageHeading eyebrow="HASIL ANALISIS · SAW" title="Hasil perangkingan" description="Peringkat tanaman menggunakan metode SAW (Simple Additive Weighting)." action={<Button variant="outline" onClick={() => navigate('method')} icon={Activity}>Lihat proses SAW</Button>} />
    <section className="ranking-podium">{sortedResults.slice(0, 3).map((row, index) => { const crop = data.alternatives.find((item) => item.id === row.alternativeId); return <div className={`podium-card podium-${index + 1}`} key={row.alternativeId}><span>{row.rank === 1 ? 'BEST RECOMMENDATION' : row.rank === 2 ? 'RUNNER UP' : 'THIRD PLACE'}</span><strong>{crop?.name ?? row.alternativeId}</strong><small>Vi {formatNumber(row.score, 4)}</small></div> })}</section>
    <ResultMatrix title="Matriks keputusan (X)" description="Nilai kriteria berasal dari form alternatif dan tersimpan bersama setiap tanaman." data={data} results={results} values="decision" />
    <section className="card table-card result-matrix-card"><div className="table-toolbar"><div><strong>Bobot kriteria</strong><span>Jumlah bobot: {formatWeight(data.criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0))}</span></div></div><div className="table-scroll"><table className="report-table"><thead><tr><th>KODE</th><th>KRITERIA</th><th>ATRIBUT</th><th>BOBOT Wj</th></tr></thead><tbody>{data.criteria.map((criterion) => <tr key={criterion.id}><td>{criterion.id}</td><td>{criterion.name} · {criterion.unit}{criterion.basis ? ` (${criterion.basis})` : ''}</td><td>{criterion.type === 'benefit' ? 'Benefit' : 'Cost'}</td><td>{formatNumber(criterion.weight, 2)}</td></tr>)}</tbody></table></div></section>
    <ResultMatrix title="Matriks normalisasi (R)" description="Rij = Xij / Max Xj untuk Benefit; Rij = Min Xj / Xij untuk Cost." data={data} results={results} values="normalized" />
    <ResultMatrix title="Matriks normalisasi berbobot (R × W)" description="Setiap nilai normalisasi dikalikan bobot kriteria terkait." data={data} results={results} values="weighted" />
    {winner && <section className="winner-banner"><div className="winner-medal"><Trophy size={27} /></div><div className="winner-label">{tiedWinners.length > 1 ? 'REKOMENDASI TERBAIK · NILAI SERI' : 'REKOMENDASI TANAMAN TERBAIK'}</div><h2>{winner.name}</h2><p>{winner.description || 'Alternatif dengan nilai preferensi terbaik pada perhitungan saat ini.'}</p><div className="winner-score"><strong>{formatNumber(sortedResults[0].score, 4)}</strong><span>Nilai preferensi</span></div><div className="winner-confetti confetti-one">✦</div><div className="winner-confetti confetti-two">✳</div></section>}
    <section className="card result-chart-card"><SectionTitle title="Perbandingan nilai akhir · SAW" description="Nilai preferensi hasil normalisasi dan bobot kriteria." /><div className="result-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 15, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1ed" /><XAxis dataKey="name" tickFormatter={(name) => name.length > 9 ? `${name.slice(0, 8)}…` : name} axisLine={false} tickLine={false} tick={{ fill: '#66736a', fontSize: 12 }} interval={0} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#909b92', fontSize: 11 }} /><Tooltip formatter={(value) => [formatNumber(value, 4), 'Nilai preferensi SAW']} cursor={{ fill: '#f5f8f5' }} /><Bar dataKey="score" radius={[7, 7, 0, 0]} maxBarSize={62}>{chartData.map((row) => <Cell key={row.name} fill={row.rank === 1 ? '#15803d' : '#9dd2ae'} />)}</Bar></BarChart></ResponsiveContainer></div></section>
    <section className="card table-card ranking-card"><div className="table-toolbar"><div><strong>Urutan rekomendasi SAW</strong><span>{sortedResults.length} alternatif dianalisis</span></div><span className="method-pill">SAW</span></div><div className="table-scroll"><table><thead><tr><th>PERINGKAT</th><th>ALTERNATIF</th><th>NILAI PREFERENSI</th><th>STATUS</th></tr></thead><tbody>{sortedResults.map((row) => { const alternative = data.alternatives.find((item) => item.id === row.alternativeId); return <tr key={row.alternativeId} className={row.rank === 1 ? 'winner-row' : ''}><td><span className={`rank-number ${row.rank === 1 ? 'rank-first' : ''}`}>{String(row.rank).padStart(2, '0')}</span></td><td><div className="crop-cell"><div className="alternative-icon"><Sprout size={17} /></div><div><strong>{alternative?.name ?? row.alternativeId}</strong><small>{row.alternativeId}</small></div></div></td><td><strong className="result-score">{formatNumber(row.score, 4)}</strong></td><td>{row.rank === 1 ? <span className="recommend-badge"><Trophy size={12} /> Rekomendasi terbaik</span> : <span className="alternative-badge">Alternatif {row.rank}</span>}</td></tr> })}</tbody></table></div></section>
    <div className="result-explanation"><div className="explanation-icon"><CircleHelp size={17} /></div><div><strong>Mengapa {winner?.name} menjadi rekomendasi?</strong><p>Tanaman ini memperoleh nilai preferensi SAW tertinggi ({formatNumber(sortedResults[0]?.score, 4)}) dari seluruh alternatif menggunakan bobot {data.criteria.length} kriteria. Hasil berasal dari data simulasi dan bobot yang Anda masukkan.</p>{tiedWinners.length > 1 && <p>{winner.name} memiliki nilai tertinggi yang seri dengan {tiedWinners.slice(1).map((row) => `${data.alternatives.find((item) => item.id === row.alternativeId)?.name}`).join(', ')}.</p>}</div></div>
    <section className="decision-statement">Berdasarkan hasil perhitungan menggunakan metode Simple Additive Weighting (SAW), tanaman <strong>{winner?.name}</strong> memperoleh nilai preferensi tertinggi sebesar <strong>{formatNumber(sortedResults[0]?.score, 5)}</strong>. Dengan demikian, tanaman tersebut menjadi alternatif terbaik berdasarkan bobot dan kriteria yang telah ditentukan.</section>
  </>
}

function VisualizationPage({ data, results, chartData, calculationIssue }) {
  const [selectedCriterion, setSelectedCriterion] = useState(data.criteria[0]?.id ?? '')
  const activeCriterion = data.criteria.find((criterion) => criterion.id === selectedCriterion) ?? data.criteria[0]
  const activeValues = activeCriterion ? data.alternatives.map((alternative) => ({
    name: alternative.name,
    value: Number(alternative.values?.[activeCriterion.id]) || 0,
  })) : []
  const radarData = results ? data.criteria.map((criterion) => ({
    criterion: `${criterion.id} · ${criterion.name}`,
    ...Object.fromEntries(data.alternatives.map((alternative) => [alternative.id, results.normalized[alternative.id][criterion.id]])),
  })) : []
  return <><PageHeading eyebrow="VISUALISASI DATA" title="Grafik visualisasi" description="Bandingkan nilai preferensi dan kriteria dari seluruh alternatif." />
    {results ? <>
      <section className="card visualization-card"><SectionTitle title="Perbandingan nilai preferensi SAW" description="Skor tertinggi menunjukkan alternatif terbaik; peringkat pertama diberi warna emerald." /><div className="visualization-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 15, right: 18, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1ed" /><XAxis dataKey="name" tickFormatter={(name) => name.length > 9 ? `${name.slice(0, 8)}…` : name} axisLine={false} tickLine={false} tick={{ fill: '#66736a', fontSize: 11 }} interval={0} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#909b92', fontSize: 10 }} /><Tooltip formatter={(value) => [formatNumber(value, 5), 'Nilai preferensi']} cursor={{ fill: '#f5f8f5' }} /><Bar dataKey="score" name="Nilai preferensi" radius={[7, 7, 0, 0]} maxBarSize={58} label={{ position: 'top', formatter: (value) => formatNumber(value, 3), fill: '#607365', fontSize: 10 }}>{chartData.map((row) => <Cell key={row.name} fill={row.rank === 1 ? '#10b981' : '#a8d7b4'} />)}</Bar></BarChart></ResponsiveContainer></div></section>
      <section className="card visualization-card"><SectionTitle title="Perbandingan nilai kriteria" description="Radar menggunakan nilai normalisasi 0–1 agar kriteria dengan satuan berbeda dapat dibandingkan." /><div className="visualization-chart radar-chart"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="76%"><PolarGrid stroke="#e8eee8" /><PolarAngleAxis dataKey="criterion" tick={{ fill: '#607365', fontSize: 10 }} /><PolarRadiusAxis domain={[0, 1]} tick={{ fill: '#95a198', fontSize: 9 }} axisLine={false} /><Tooltip formatter={(value, name) => [formatNumber(value, 4), data.alternatives.find((alternative) => alternative.id === name)?.name ?? name]} /><Legend formatter={(value) => data.alternatives.find((alternative) => alternative.id === value)?.name ?? value} />{data.alternatives.map((alternative, index) => <Radar key={alternative.id} name={alternative.id} dataKey={alternative.id} stroke={WEIGHT_PALETTE[index % WEIGHT_PALETTE.length]} fill={WEIGHT_PALETTE[index % WEIGHT_PALETTE.length]} fillOpacity={index === 0 ? 0.14 : 0.06} />)}</RadarChart></ResponsiveContainer></div></section>
    </> : <section className="card"><EmptyState title="Grafik SAW belum tersedia" text={calculationIssue || 'Lengkapi data untuk menampilkan visualisasi hasil.'} /></section>}
    <section className="card visualization-card"><div className="criterion-chart-heading"><SectionTitle title="Nilai aktual per kriteria" description="Pilih satu kriteria untuk membandingkan nilai asli pada setiap tanaman." /><label className="criterion-select-label">Kriteria<select value={activeCriterion?.id ?? ''} onChange={(event) => setSelectedCriterion(event.target.value)}>{data.criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.id} · {criterion.name}</option>)}</select></label></div>{activeCriterion ? <div className="visualization-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={activeValues} margin={{ top: 18, right: 18, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1ed" /><XAxis dataKey="name" tickFormatter={(name) => name.length > 9 ? `${name.slice(0, 8)}…` : name} axisLine={false} tickLine={false} tick={{ fill: '#66736a', fontSize: 11 }} interval={0} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#909b92', fontSize: 10 }} /><Tooltip formatter={(value) => [`${formatNumber(value, 3)} ${activeCriterion.unit}`, activeCriterion.name]} cursor={{ fill: '#f5f8f5' }} /><Bar dataKey="value" name={activeCriterion.name} fill="#10b981" radius={[7, 7, 0, 0]} maxBarSize={58} label={{ position: 'top', formatter: (value) => formatNumber(value, 2), fill: '#607365', fontSize: 10 }} /></BarChart></ResponsiveContainer></div> : <EmptyState title="Belum ada kriteria" text="Tambahkan data kriteria untuk melihat grafik." />}</section>
    <div className="helper-note"><CircleHelp size={15} /><span>Grafik menampilkan data alternatif, bobot, dan hasil SAW yang tersimpan pada browser ini.</span></div>
  </>
}

function ReportVisualizations({ data, results, sortedResults }) {
  const topScore = Math.max(...sortedResults.map((row) => row.score), Number.EPSILON)
  return <div className="report-visuals"><div><strong>Nilai preferensi SAW</strong><div className="report-score-bars">{sortedResults.map((row) => {
    const crop = data.alternatives.find((alternative) => alternative.id === row.alternativeId)
    return <div className="report-score-row" key={row.alternativeId}><span className="report-score-name">{crop?.name ?? row.alternativeId}</span><span className="report-score-track"><span className="report-score-fill" style={{ width: `${(row.score / topScore) * 100}%` }} /></span><span className="report-score-value">{formatNumber(row.score, 3)}</span></div>
  })}</div></div><div><strong>Nilai normalisasi tiap kriteria (0–1)</strong><div className="report-heatmap">{data.alternatives.map((alternative) => <div className="report-heat-row" key={alternative.id}><span className="report-heat-name">{alternative.name}</span>{data.criteria.map((criterion) => {
    const value = results.normalized[alternative.id][criterion.id]
    return <span className="report-heat-cell" key={criterion.id} style={{ '--shade': value }} title={`${criterion.id}: ${formatNumber(value, 5)}`}><small>{criterion.id}</small><strong>{formatNumber(value, 3)}</strong></span>
  })}</div>)}</div></div></div>
}

function ReportPage({ data, results, sortedResults, winner, exportCSV }) {
  return <><PageHeading eyebrow="DOKUMENTASI KEPUTUSAN" title="Laporan analisis" description="Ringkasan lengkap data, metode, dan hasil SPK untuk dokumentasi proyek." action={<div className="report-actions"><Button variant="outline" onClick={exportCSV} icon={Download}>Export CSV</Button><Button variant="outline" onClick={() => window.print()} icon={Printer}>Cetak Laporan</Button><Button onClick={() => window.print()} icon={Download}>Simpan sebagai PDF</Button></div>} />
    <article className="report-document"><div className="report-cover"><div className="report-brand"><span className="report-logo"><Leaf size={19} /></span><span>TANAMORA<small>Tanaman Modern Recommendation &amp; Analysis</small><em>Smart Decision for Better Farming.</em></span></div><span className="report-group">SMART AGRICULTURE</span><h2>SISTEM PENDUKUNG KEPUTUSAN<br />PEMILIHAN JENIS TANAMAN<br /><em>BERDASARKAN KRITERIA PERTANIAN</em></h2><p className="report-purpose">Tujuan sistem: membantu memilih alternatif tanaman melalui perbandingan lima kriteria pertanian dengan metode SAW.</p><div className="report-cover-bottom"><span>Laporan TANAMORA</span><span>{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</span></div></div>
      <div className="report-body"><div className="report-section"><h3><span>01</span> Ringkasan keputusan</h3><div className="report-summary-grid"><div><small>Metode SPK</small><strong>SAW — Simple Additive Weighting</strong></div><div><small>Jumlah alternatif</small><strong>{data.alternatives.length} tanaman</strong></div><div><small>Jumlah kriteria</small><strong>{data.criteria.length} kriteria</strong></div><div><small>Status analisis</small><strong>{results ? 'Perhitungan selesai' : 'Belum dihitung'}</strong></div></div>{winner ? <div className="report-conclusion"><Trophy size={19} /><div><small>REKOMENDASI TANAMAN TERBAIK</small><strong>{winner.name}</strong><span>Nilai preferensi SAW {formatNumber(sortedResults[0]?.score, 4)}</span></div></div> : <div className="report-empty"><CircleHelp size={16} /> Belum ada hasil. Data harus lengkap, total bobot 100%, dan nilai kriteria valid sebelum hasil muncul.</div>}</div>
      <div className="report-section"><h3><span>02</span> Kriteria dan bobot</h3><div className="table-scroll"><table className="report-table"><thead><tr><th>KODE</th><th>KRITERIA</th><th>SATUAN / BASIS</th><th>ATRIBUT</th><th>BOBOT</th></tr></thead><tbody>{data.criteria.map((criterion) => <tr key={criterion.id}><td>{criterion.id}</td><td>{criterion.name}</td><td>{criterion.unit}{criterion.basis ? ` · ${criterion.basis}` : ''}</td><td>{criterion.type === 'benefit' ? 'Benefit' : 'Cost'}</td><td>{formatWeight(criterion.weight)}</td></tr>)}</tbody><tfoot><tr><td colSpan="4">Total bobot</td><td>{formatWeight(data.criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0))}</td></tr></tfoot></table></div></div>
      <div className="report-section"><h3><span>03</span> Matriks keputusan <small>SAW · NILAI ALTERNATIF</small></h3><div className="table-scroll"><table className="report-table"><thead><tr><th>ALTERNATIF</th>{data.criteria.map((criterion) => <th key={criterion.id}>{criterion.id} · {criterion.unit}{criterion.basis ? ` (${criterion.basis})` : ''}</th>)}</tr></thead><tbody>{data.alternatives.map((alternative) => <tr key={alternative.id}><td>{alternative.id} · {alternative.name}</td>{data.criteria.map((criterion) => <td key={criterion.id}>{formatNumber(alternative.values?.[criterion.id], 3)}</td>)}</tr>)}</tbody></table></div></div>
      <div className="report-section"><h3><span>04</span> Hasil perangkingan</h3>{results ? <div className="table-scroll"><table className="report-table"><thead><tr><th>RANK</th><th>ALTERNATIF</th><th>NILAI PREFERENSI</th><th>STATUS</th></tr></thead><tbody>{sortedResults.map((row) => <tr key={row.alternativeId}><td>{row.rank}</td><td>{row.alternativeId} · {data.alternatives.find((alternative) => alternative.id === row.alternativeId)?.name}</td><td>{formatNumber(row.score, 5)}</td><td>{row.rank === 1 ? 'Rekomendasi terbaik' : 'Alternatif'}</td></tr>)}</tbody></table></div> : <p className="report-pending">Hasil perangkingan akan tampil setelah data lengkap, total bobot 100%, dan nilai kriteria valid.</p>}</div>
      {results && <div className="report-section"><h3><span>05</span> Hasil normalisasi SAW</h3><div className="table-scroll"><table className="report-table"><thead><tr><th>ALTERNATIF</th>{data.criteria.map((criterion) => <th key={criterion.id}>{criterion.id}</th>)}</tr></thead><tbody>{data.alternatives.map((alternative) => <tr key={alternative.id}><td>{alternative.id} · {alternative.name}</td>{data.criteria.map((criterion) => <td key={criterion.id}>{formatNumber(results.normalized?.[alternative.id]?.[criterion.id], 5)}</td>)}</tr>)}</tbody></table></div></div>}
      {results && <div className="report-section"><h3><span>06</span> Normalisasi × bobot</h3><div className="table-scroll"><table className="report-table"><thead><tr><th>ALTERNATIF</th>{data.criteria.map((criterion) => <th key={criterion.id}>{criterion.id} × {formatWeight(criterion.weight)}</th>)}</tr></thead><tbody>{data.alternatives.map((alternative) => <tr key={alternative.id}><td>{alternative.id} · {alternative.name}</td>{data.criteria.map((criterion) => <td key={criterion.id}>{formatNumber(results.weighted?.[alternative.id]?.[criterion.id], 5)}</td>)}</tr>)}</tbody></table></div></div>}
      {results && <div className="report-section report-final-conclusion"><h3><span>07</span> Kesimpulan</h3><p>Berdasarkan analisis metode SAW, <strong>{winner?.name}</strong> menempati peringkat pertama dengan nilai preferensi {formatNumber(sortedResults[0]?.score, 5)}. Rekomendasi ini dihasilkan dari data simulasi dan bobot kriteria yang dimasukkan, sehingga perlu disesuaikan dengan kondisi lapangan sebelum digunakan sebagai keputusan budidaya aktual.</p></div>}
      <div className="report-disclaimer"><FlaskConical size={15} /> Data yang digunakan dalam laporan ini adalah data simulasi untuk kebutuhan edukasi. Hasil bukan saran agronomi aktual.</div></div></article>
    <article className="report-document report-addendum"><div className="report-body">{results && <section className="report-section"><h3><span>08</span> Grafik visualisasi</h3><ReportVisualizations data={data} results={results} sortedResults={sortedResults} /></section>}</div></article>
    <div className="helper-note"><CircleHelp size={15} /><span>Gunakan Cetak Laporan atau Simpan sebagai PDF untuk membuka dialog cetak browser. Pada dialog tersebut, pilih printer atau tujuan penyimpanan PDF.</span></div></>
}

function EntityModal({ modal, criteria, alternatives, nextAlternativeId, onClose, onSaveAlternative, onSaveCriterion }) {
  const isAlternative = modal.type === 'alternative'
  const item = modal.item || {}
  const [form, setForm] = useState(isAlternative ? {
    name: item.name ?? '', description: item.description ?? '',
    values: Object.fromEntries(criteria.map((criterion) => [criterion.id, item.values?.[criterion.id] ?? ''])),
  } : { name: item.name ?? '', unit: item.unit ?? '', weight: item.weight ?? '0.00', type: item.type ?? 'benefit' })
  const [error, setError] = useState('')
  function change(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  function changeValue(criterionId, value) {
    setForm((current) => ({ ...current, values: { ...current.values, [criterionId]: value } }))
  }
  function submit(event) {
    event.preventDefault()
    const required = isAlternative ? ['name'] : ['name', 'unit', 'weight']
    if (required.some((key) => String(form[key]).trim() === '')) return setError('Lengkapi semua kolom yang wajib diisi.')
    if (isAlternative) {
      const duplicate = alternatives.some((alternative) => alternative.id !== item.id && alternative.name.trim().toLocaleLowerCase('id') === form.name.trim().toLocaleLowerCase('id'))
      if (duplicate) return setError('Nama tanaman sudah digunakan. Gunakan nama yang berbeda.')
      for (const criterion of criteria) {
        const rawValue = form.values?.[criterion.id] ?? item.values?.[criterion.id] ?? ''
        const value = Number(rawValue)
        if (rawValue === '' || rawValue === null || rawValue === undefined || !Number.isFinite(value) || value < 0) return setError(`Nilai ${criterion.id} — ${criterion.name} wajib berupa angka valid dan tidak negatif.`)
        if (criterion.type === 'cost' && value === 0) return setError(`Nilai ${criterion.id} (${criterion.name}) harus lebih besar dari 0 untuk perhitungan Cost.`)
      }
    }
    if (!isAlternative && (!Number.isFinite(Number(form.weight)) || Number(form.weight) < 0 || Number(form.weight) > 1)) return setError('Bobot harus berada di antara 0 dan 1.')
    setError('')
    isAlternative ? onSaveAlternative(form) : onSaveCriterion(form)
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="entity-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="eyebrow">{modal.editing ? 'PERBARUI DATA' : 'DATA MASTER'}</span><h2 id="modal-title">{modal.editing ? 'Edit' : 'Tambah'} {isAlternative ? 'alternatif tanaman' : 'kriteria'}</h2></div><button className="icon-button" aria-label="Tutup" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><div className="modal-content">{isAlternative ? <><div className="identity-fields"><div className="alternative-code">{modal.editing ? item.id : nextAlternativeId}</div><span>Kode alternatif dibuat otomatis</span></div><label>Nama tanaman <input autoFocus value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Contoh: Bawang Merah" /></label><label>Deskripsi singkat <textarea rows="2" value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="Opsional — deskripsi tanaman..." /></label><div className="form-divider">NILAI KRITERIA · WAJIB DIISI</div><div className="criteria-value-grid">{criteria.map((criterion) => <label key={criterion.id}>{criterion.id} · {criterion.name}<small>{criterion.unit}{criterion.basis ? ` · ${criterion.basis}` : ''} · {criterion.type === 'benefit' ? 'Benefit' : 'Cost'}</small><input type="number" min="0" step="any" required aria-label={`${criterion.id} ${criterion.name}`} value={form.values?.[criterion.id] ?? item.values?.[criterion.id] ?? ''} onChange={(event) => changeValue(criterion.id, event.target.value)} placeholder="Masukkan nilai" /></label>)}</div><div className="modal-hint"><CircleHelp size={15} /> Nilai Cost harus lebih besar dari 0. Nilai Benefit boleh 0 selama nilai maksimum kriterianya lebih dari 0.</div></> : <><label>Nama kriteria <input autoFocus value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Contoh: Ketahanan Hama" /></label><div className="form-two"><label>Satuan <input value={form.unit} onChange={(event) => change('unit', event.target.value)} placeholder="Contoh: Skala 1–5" /></label><label>Bobot (0–1) <input type="number" min="0" max="1" step="0.01" value={form.weight} onChange={(event) => change('weight', event.target.value)} placeholder="0.00" /></label></div><label>Atribut penilaian <select value={form.type} onChange={(event) => change('type', event.target.value)}><option value="benefit">Benefit — nilai lebih tinggi lebih baik</option><option value="cost">Cost — nilai lebih rendah lebih baik</option></select></label><div className="modal-hint"><CircleHelp size={15} /> Total seluruh bobot kriteria harus berjumlah 1 atau 100%.</div></>}{error && <div className="form-error">{error}</div>}</div><div className="modal-footer"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" icon={Check}>{modal.editing ? 'Simpan perubahan' : 'Tambah data'}</Button></div></form></section></div>
}

export default App
