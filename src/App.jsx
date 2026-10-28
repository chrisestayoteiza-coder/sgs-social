import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from './supabase'
import './styles.css'

const pad = n => String(n).padStart(2, '0')
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = () => iso(new Date())
const fd = s => (s ? s.split('-').reverse().join('-') : '')
const addD = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }
const opts = a => a.map(x => [x, x])
const fileOut = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href) }

const T = {
  personas: { n: 'persona', req: ['nombre'], f: [
    { k: 'nombre', l: 'Nombre completo *' }, { k: 'rut', l: 'RUT / documento' },
    { k: 'nacimiento', l: 'Fecha de nacimiento', t: 'date' }, { k: 'telefono', l: 'Teléfono con código de país (ej. 56912345678)' },
    { k: 'direccion', l: 'Dirección' }, { k: 'familia_id', l: 'Familia', t: 'rel', r: 'familias' },
    { k: 'sexo', l: 'Sexo (genograma)', t: 'sel', o: opts(['F', 'M', 'Otro']) },
    { k: 'generacion', l: 'Generación (1 abuelos, 2 padres, 3 hijos)', t: 'sel', o: opts(['1', '2', '3']) },
    { k: 'pareja', l: 'Código de pareja (mismo código = pareja)' },
    { k: 'consentimiento', l: 'Consentimiento informado firmado', t: 'sel', o: opts(['Sí', 'No']) },
    { k: 'consentimiento_fecha', l: 'Fecha del consentimiento', t: 'date' },
    { k: 'notas', l: 'Antecedentes / notas', t: 'area' }] },
  familias: { n: 'familia', req: ['nombre'], f: [
    { k: 'nombre', l: 'Nombre del grupo familiar *' }, { k: 'direccion', l: 'Dirección' },
    { k: 'telefono', l: 'Teléfono' }, { k: 'notas', l: 'Observaciones', t: 'area' }] },
  casos: { n: 'caso', req: ['persona_id', 'titulo'], f: [
    { k: 'persona_id', l: 'Persona *', t: 'rel', r: 'personas' }, { k: 'titulo', l: 'Título del caso *' },
    { k: 'estado', l: 'Estado', t: 'sel', o: opts(['Activo', 'En pausa', 'Cerrado']) },
    { k: 'prioridad', l: 'Prioridad', t: 'sel', o: opts(['Baja', 'Media', 'Alta']) },
    { k: 'fecha', l: 'Fecha de apertura', t: 'date' }, { k: 'descripcion', l: 'Descripción', t: 'area' }] },
  intervenciones: { n: 'intervención', req: ['persona_id', 'fecha'], f: [
    { k: 'persona_id', l: 'Persona *', t: 'rel', r: 'personas' }, { k: 'caso_id', l: 'Caso', t: 'rel', r: 'casos' },
    { k: 'fecha', l: 'Fecha *', t: 'date' }, { k: 'duracion', l: 'Duración (min)', t: 'number' },
    { k: 'resumen', l: 'Resumen', t: 'area' }, { k: 'acuerdos', l: 'Acuerdos / próximos pasos', t: 'area' }] },
  seguimientos: { n: 'seguimiento', req: ['persona_id', 'fecha'], f: [
    { k: 'persona_id', l: 'Persona *', t: 'rel', r: 'personas' },
    { k: 'tipo', l: 'Tipo', t: 'sel', o: opts(['Llamada', 'Visita', 'Entrevista', 'Coordinación', 'Otro']) },
    { k: 'fecha', l: 'Fecha *', t: 'date' }, { k: 'hora', l: 'Hora', t: 'time' }, { k: 'nota', l: 'Nota', t: 'area' },
    { k: 'rep', l: 'Repetir cada semana (veces adicionales)', t: 'number', nw: true }] },
  objetivos: { n: 'objetivo', req: ['persona_id', 'objetivo'], f: [
    { k: 'persona_id', l: 'Persona *', t: 'rel', r: 'personas' }, { k: 'caso_id', l: 'Caso', t: 'rel', r: 'casos' },
    { k: 'objetivo', l: 'Objetivo *' },
    { k: 'area', l: 'Área', t: 'sel', o: opts(['Vivienda', 'Salud', 'Educación', 'Laboral', 'Familiar', 'Económica', 'Otra']) },
    { k: 'plazo', l: 'Plazo', t: 'date' }, { k: 'avance', l: 'Avance (0-100 %)', t: 'number' }, { k: 'notas', l: 'Estrategias / notas', t: 'area' }] },
  derivaciones: { n: 'derivación', req: ['persona_id', 'institucion'], f: [
    { k: 'persona_id', l: 'Persona *', t: 'rel', r: 'personas' }, { k: 'institucion', l: 'Institución / red *' },
    { k: 'fecha', l: 'Fecha', t: 'date' }, { k: 'motivo', l: 'Motivo', t: 'area' },
    { k: 'estado', l: 'Estado', t: 'sel', o: opts(['Pendiente', 'En trámite', 'Concluida']) },
    { k: 'vinculo', l: 'Calidad del vínculo (ecomapa)', t: 'sel', o: opts(['Fuerte', 'Débil', 'Conflictivo']) }] },
  documentos: { n: 'documento', req: [], f: [] },
}
const KEYS = Object.keys(T)
const DEF = {
  personas: { sexo: 'F', generacion: '2', consentimiento: 'No' }, casos: { estado: 'Activo', prioridad: 'Baja', fecha: today() },
  intervenciones: { fecha: today() }, seguimientos: { tipo: 'Llamada', fecha: today() },
  objetivos: { area: 'Familiar', avance: 0 }, derivaciones: { estado: 'Pendiente', vinculo: 'Fuerte', fecha: today() },
}
const TABS = [['home', 'Panel principal'], ['personas', 'Personas'], ['familias', 'Familias'], ['casos', 'Casos'],
  ['intervenciones', 'Intervenciones'], ['objetivos', 'Plan de intervención'], ['seguimientos', 'Seguimientos'],
  ['derivaciones', 'Derivaciones y redes'], ['cal', 'Calendario'], ['documentos', 'Documentos'],
  ['stats', 'Estadísticas'], ['inf', 'Informes'], ['seg', 'Seguridad y papelera']]
const empty = () => Object.fromEntries(KEYS.map(k => [k, []]))

export default function App() {
  const [ses, setSes] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSes(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSes(s))
    return () => subscription.unsubscribe()
  }, [])
  if (ses === undefined) return <p className="load">Cargando…</p>
  return ses ? <Workspace user={ses.user} /> : <Login />
}

function Login() {
  const [err, setErr] = useState('')
  const go = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setErr(error.message)
  }
  return (
    <div className="login"><div className="box" style={{ maxWidth: 380 }}>
      <h2>🤝 SGS Social</h2>
      <p className="mu">Ingresa para ver tus personas, casos y seguimientos. Cada cuenta ve solo su propia información.</p>
      <button className="btn" onClick={go}>Continuar con Google</button>
      {err && <p style={{ color: 'var(--dg)' }}>{err}</p>}
    </div></div>
  )
}

function Form({ k, v, D, uid, onSave, onClose, onDelete }) {
  const [s, setS] = useState(v)
  const set = key => e => setS({ ...s, [key]: e.target.value })
  const ro = v.user_id && v.user_id !== uid
  const lab = (t, r) => (t === 'casos' ? r.titulo : r.nombre)
  return (
    <div className="box">
      <h3>{ro ? 'Ver' : v.id ? 'Editar' : 'Nueva'} {T[k].n}</h3>
      {ro && <p className="mu">Compartido contigo en solo lectura.</p>}
      <fieldset disabled={ro}>
        {T[k].f.filter(f => !(f.nw && v.id)).map(f => (
          <label key={f.k}>{f.l}
            {f.t === 'area' ? <textarea rows="3" value={s[f.k] || ''} onChange={set(f.k)} />
              : f.t === 'sel' ? <select value={s[f.k] || ''} onChange={set(f.k)}>{f.o.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
              : f.t === 'rel' ? <select value={s[f.k] || ''} onChange={set(f.k)}><option value="">— Seleccione —</option>{D[f.r].map(r => <option key={r.id} value={r.id}>{lab(f.r, r)}</option>)}</select>
              : <input type={f.t || 'text'} value={s[f.k] ?? ''} onChange={set(f.k)} />}
          </label>
        ))}
      </fieldset>
      <div className="row">
        {!ro && <button className="btn" onClick={() => onSave(s)}>Guardar</button>}
        <button className="btn g" onClick={onClose}>Cancelar</button>
        {v.id && !ro && <button className="btn dg" onClick={onDelete}>Mover a la papelera</button>}
      </div>
    </div>
  )
}

function Geno({ mem }) {
  const pos = {}, g3 = p => +(p.generacion || 2)
  ;[1, 2, 3].forEach(g => { const m = mem.filter(p => g3(p) === g); m.forEach((p, i) => { pos[p.id] = { x: ((i + 1) * 600) / (m.length + 1), y: 35 + (g - 1) * 95, p } }) })
  const P = Object.values(pos), ln = []
  const mid = g => { const r = P.filter(q => g3(q.p) === g); return r.length ? { x: r.reduce((a, q) => a + q.x, 0) / r.length, y: r[0].y } : null }
  P.forEach(a => P.forEach(b => { if (a.p.id < b.p.id && a.p.pareja && a.p.pareja === b.p.pareja && a.y === b.y) ln.push(<line key={a.p.id + b.p.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth="2" />) }))
  ;[1, 2].forEach(g => { const m = mid(g); if (m) P.filter(q => g3(q.p) === g + 1).forEach(q => ln.push(<line key={'c' + q.p.id} x1={m.x} y1={m.y} x2={q.x} y2={q.y - 18} stroke="currentColor" />)) })
  return (
    <svg viewBox="0 0 600 300">{ln}{P.map(({ x, y, p }) => (
      <g key={p.id}>
        {p.sexo === 'M' ? <rect x={x - 16} y={y - 16} width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" />
          : p.sexo === 'Otro' ? <polygon points={`${x},${y - 19} ${x + 19},${y} ${x},${y + 19} ${x - 19},${y}`} fill="none" stroke="currentColor" strokeWidth="2" />
          : <circle cx={x} cy={y} r="17" fill="none" stroke="currentColor" strokeWidth="2" />}
        <text x={x} y={y + 34} textAnchor="middle" fontSize="11" fill="currentColor">{p.nombre.split(' ')[0]}</text>
      </g>))}</svg>
  )
}
function Eco({ fam, refs }) {
  const by = {}; refs.forEach(r => { by[r.institucion] = r.vinculo || 'Fuerte' }); const ks = Object.keys(by)
  if (!ks.length) return <p className="mu">Registra derivaciones para ver el ecomapa.</p>
  return (
    <svg viewBox="0 0 600 320"><circle cx="300" cy="160" r="45" fill="none" stroke="currentColor" strokeWidth="2" /><text x="300" y="164" textAnchor="middle" fontSize="12" fill="currentColor">{fam.nombre}</text>
      {ks.map((k, i) => { const a = (i / ks.length) * 6.283, x = 300 + Math.cos(a) * 220, y = 160 + Math.sin(a) * 125, c = by[k]; return (
        <g key={k}><line x1="300" y1="160" x2={x} y2={y} stroke={c === 'Conflictivo' ? '#c0392b' : 'currentColor'} strokeWidth={c === 'Fuerte' ? 3 : 1.5} strokeDasharray={c === 'Débil' ? '5 4' : c === 'Conflictivo' ? '2 3' : undefined} />
          <ellipse cx={x} cy={y} rx="52" ry="20" fill="var(--sf)" stroke="currentColor" /><text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="currentColor">{k.slice(0, 18)}</text></g>) })}</svg>
  )
}
const Bars = ({ items }) => { const mx = Math.max(1, ...items.map(i => i[1])); return items.map(([l, v]) => <div key={l}><div className="mu">{l}: <b>{v}</b></div><div className="pb"><i style={{ width: (v / mx) * 100 + '%' }} /></div></div>) }

function Workspace({ user }) {
  const uid = user.id
  const [D, setD] = useState(empty()), [Tr, setTr] = useState(empty()), [ready, setReady] = useState(false)
  const [tab, setTab] = useState('home'), [q, setQ] = useState(''), [m, setM] = useState(null), [rp, setRp] = useState('')
  const [dp, setDp] = useState(''), [dt, setDt] = useState('Consentimiento'), [mail, setMail] = useState(''), [acc, setAcc] = useState([]), [aud, setAud] = useState([])
  const n = new Date(), [cal, setCal] = useState({ y: n.getFullYear(), m: n.getMonth(), sel: today() })
  const [pf, setPf] = useState(() => { try { return JSON.parse(localStorage.getItem('sgs_perfil_' + user.id) || '{}') } catch (e) { return {} } })
  useEffect(() => { try { localStorage.setItem('sgs_perfil_' + user.id, JSON.stringify(pf)) } catch (e) { /* sin espacio */ } }, [pf])

  async function load() {
    const rs = await Promise.all(KEYS.map(k => supabase.from(k).select('*').order('created_at')))
    const e = rs.find(r => r.error)
    if (e) return alert('No se pudieron cargar los datos. ¿Ejecutaste schema_v2.sql? ' + e.error.message)
    const live = {}, tr = {}
    KEYS.forEach((k, i) => { live[k] = rs[i].data.filter(r => !r.deleted_at); tr[k] = rs[i].data.filter(r => r.deleted_at) })
    const ids = new Set(live.personas.map(p => p.id))
    KEYS.forEach(k => { if (k !== 'personas' && k !== 'familias') live[k] = live[k].filter(r => ids.has(r.persona_id)) })
    setD(live); setTr(tr); setReady(true)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (tab !== 'seg') return
    supabase.from('accesos').select('*').eq('owner_id', uid).order('created_at').then(r => setAcc(r.data || []))
    supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(40).then(r => setAud(r.data || []))
  }, [tab])

  const pn = id => D.personas.find(p => p.id === id)?.nombre || '(eliminada)'
  const fn = id => D.familias.find(f => f.id === id)?.nombre || ''
  const ok = s => !q || s.toLowerCase().includes(q.toLowerCase())
  const mine = r => !r.user_id || r.user_id === uid
  const openNew = (k, pre) => setM({ k, v: { ...DEF[k], ...pre } })
  const lab = (k, r) => ({ personas: r.nombre, familias: r.nombre, casos: r.titulo, intervenciones: fd(r.fecha) + ' ' + pn(r.persona_id), seguimientos: r.tipo + ' ' + fd(r.fecha), objetivos: r.objetivo, derivaciones: r.institucion, documentos: r.nombre }[k])

  async function save(k, o) {
    if (T[k].req.some(r => !o[r])) return alert('Completa los campos obligatorios (*)')
    const { id, created_at, user_id, deleted_at, rep, ...body } = o
    Object.keys(body).forEach(c => { if (body[c] === '') body[c] = null })
    const rows = [body]
    if (k === 'seguimientos' && !id) for (let i = 1; i <= (+rep || 0); i++) rows.push({ ...body, fecha: addD(body.fecha, 7 * i) })
    const { data, error } = await (id ? supabase.from(k).update(body).eq('id', id) : supabase.from(k).insert(rows)).select()
    if (error) return alert(error.message)
    setD(d => ({ ...d, [k]: id ? d[k].map(x => (x.id === id ? data[0] : x)) : [...d[k], ...data] })); setM(null)
  }
  async function trash(k, id) {
    if (!confirm('¿Mover a la papelera? Podrás restaurarlo después.')) return
    const { data, error } = await supabase.from(k).update({ deleted_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return alert(error.message)
    setD(d => { const o = { ...d, [k]: d[k].filter(x => x.id !== id) }; if (k === 'personas') KEYS.forEach(c => { if (c !== 'personas' && c !== 'familias') o[c] = d[c].filter(x => x.persona_id !== id) }); return o })
    setTr(t => ({ ...t, [k]: [...t[k], data] })); setM(null)
  }
  async function restore(k, id) { const { error } = await supabase.from(k).update({ deleted_at: null }).eq('id', id); if (error) return alert(error.message); load() }
  async function purge(k, id) {
    if (!confirm('Eliminar definitivamente. No se puede deshacer.')) return
    const { error } = await supabase.from(k).delete().eq('id', id); if (error) return alert(error.message)
    setTr(t => ({ ...t, [k]: t[k].filter(x => x.id !== id) }))
  }
  const toggle = async s => {
    const { data, error } = await supabase.from('seguimientos').update({ hecho: !s.hecho }).eq('id', s.id).select().single()
    if (!error) setD(d => ({ ...d, seguimientos: d.seguimientos.map(x => (x.id === s.id ? data : x)) }))
  }
  async function upload(e) {
    const f = e.target.files[0]; e.target.value=''; if (!f) return
    if (!dp) return alert('Selecciona primero la persona'); if (f.size > 10e6) return alert('Máximo 10 MB por archivo')
    const ruta = `${uid}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, '_')}`
    const up = await supabase.storage.from('documentos').upload(ruta, f); if (up.error) return alert(up.error.message)
    const { data, error } = await supabase.from('documentos').insert({ persona_id: dp, nombre: f.name, tipo: dt, ruta }).select().single()
    if (error) return alert(error.message); setD(d => ({ ...d, documentos: [...d.documentos, data] }))
  }
  async function openDoc(r) { const { data, error } = await supabase.storage.from('documentos').createSignedUrl(r.ruta, 60); if (error) return alert(error.message); window.open(data.signedUrl, '_blank') }
  async function invite() {
    if (!mail.includes('@')) return alert('Escribe un correo válido')
    const { data, error } = await supabase.from('accesos').insert({ email: mail.trim().toLowerCase() }).select().single()
    if (error) return alert(error.message); setAcc(a => [...a, data]); setMail('')
  }
  async function revoke(id) { const { error } = await supabase.from('accesos').delete().eq('id', id); if (!error) setAcc(a => a.filter(x => x.id !== id)) }

  function onFirma(e) {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    if (f.size > 200000) return alert('La imagen pesa más de 200 KB')
    const r = new FileReader()
    r.onload = () => { const im = new Image(); im.onload = () => setPf(p => ({ ...p, firma: { data: r.result, ratio: im.width / im.height, fmt: f.type === 'image/png' ? 'PNG' : 'JPEG' } })); im.src = r.result }
    r.readAsDataURL(f)
  }
  // Documento con membrete: ondas de color arriba y abajo, datos de la institución a la derecha y bloque de firma
  function doc(titulo) {
    const d = new jsPDF(), W = 210, H = 297, PG = 245
    const hx = /^#[0-9a-f]{6}$/i.test(pf.color || '') ? pf.color : '#8a7bb0'
    const c = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16)), lt = c.map(v => Math.round(v + (255 - v) * 0.45)), dk = c.map(v => Math.round(v * 0.6))
    const shape = (cmds, rgb, flip) => {
      const P = (x, y) => (flip ? [W - x, H - y] : [x, y])
      let cx = 0, cy = 0, start = [0, 0]; const segs = []
      cmds.forEach(k => {
        if (k[0] === 'M') { start = P(k[1], k[2]); cx = start[0]; cy = start[1] }
        else if (k[0] === 'L') { const e = P(k[1], k[2]); segs.push([e[0] - cx, e[1] - cy]); cx = e[0]; cy = e[1] }
        else { const a = P(k[1], k[2]), b = P(k[3], k[4]), e = P(k[5], k[6]); segs.push([a[0] - cx, a[1] - cy, b[0] - cx, b[1] - cy, e[0] - cx, e[1] - cy]); cx = e[0]; cy = e[1] }
      })
      d.setFillColor(rgb[0], rgb[1], rgb[2]); d.lines(segs, start[0], start[1], [1, 1], 'F', true)
    }
    const deco = () => [false, true].forEach(fl => {
      shape([['M', 0, 0], ['L', 210, 0], ['L', 210, 24], ['C', 165, 28, 125, 14, 92, 19], ['C', 55, 24, 26, 38, 0, 52]], lt, fl)
      shape([['M', 0, 0], ['L', 210, 0], ['L', 210, 13], ['C', 172, 15, 148, 7, 118, 10], ['C', 80, 14, 40, 26, 0, 38]], c, fl)
      shape([['M', 0, 40], ['C', 40, 28, 82, 15, 120, 12], ['L', 120, 12.8], ['C', 82, 15.8, 40, 28.8, 0, 41]], [255, 255, 255], fl)
    })
    let y = 50
    deco()
    const fecha = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    ;[[pf.institucion || 'Institución', true], [pf.ciudad, false], [fecha, false]].forEach(([t, b]) => {
      if (!t) return
      d.setFont('helvetica', b ? 'bold' : 'normal'); d.setFontSize(10); d.setTextColor(40, 40, 55)
      d.text(b ? t.toUpperCase() : t, W - 25, y, { align: 'right' }); y += 5
    })
    y = 80
    d.setFont('helvetica', 'bold'); d.setFontSize(16); d.setTextColor(dk[0], dk[1], dk[2]); d.text(titulo, 25, y); y += 10
    const w = (t, x = 15, b = false, sz = 10) => {
      d.setFont('helvetica', b ? 'bold' : 'normal'); d.setFontSize(sz)
      if (b && sz >= 12) d.setTextColor(dk[0], dk[1], dk[2]); else d.setTextColor(60, 60, 75)
      d.splitTextToSize(String(t || ''), 160 - (x - 15)).forEach(l => { if (y > PG) { d.addPage(); deco(); y = 54; d.setFont('helvetica', b ? 'bold' : 'normal'); d.setFontSize(sz) } d.text(l, x + 10, y); y += sz * 0.5 + 0.8 })
    }
    const fin = () => {
      y += 10; if (y > PG - 40) { d.addPage(); deco(); y = 60 }
      const fx = W - 25, f = pf.firma
      if (f) { let ww = 16 * f.ratio, hh = 16; if (ww > 50) { ww = 50; hh = ww / f.ratio } d.addImage(f.data, f.fmt, fx - ww, y, ww, hh); y += hh + 3 }
      else { y += 12; d.setDrawColor(120, 120, 130); d.line(fx - 60, y, fx, y); y += 5 }
      ;[[pf.profesional || 'Profesional responsable', 'bold', true], [pf.cargo, 'normal', true], [pf.institucion, 'bold', false]].forEach(([t, st, up]) => {
        if (!t) return; d.setFont('helvetica', st); d.setFontSize(9); d.setTextColor(40, 40, 55); d.text(up ? t.toUpperCase() : t, fx, y, { align: 'right' }); y += 4.5
      })
    }
    return { d, w, gap: g => { y += g }, fin }
  }
  function informe(id) {
    const p = D.personas.find(x => x.id === id); if (!p) return alert('Selecciona una persona')
    const { d, w, gap, fin } = doc('Informe social'), by = k => D[k].filter(x => x.persona_id === id)
    w('1. Datos de la persona', 15, true, 12); w(`${p.nombre} · ${p.rut || 's/d'} · Nac. ${fd(p.nacimiento) || 's/d'}`)
    w(`Tel.: ${p.telefono || 's/d'} · Dirección: ${p.direccion || 's/d'}`)
    w(`Consentimiento informado: ${p.consentimiento || 'No'}${p.consentimiento_fecha ? ' (' + fd(p.consentimiento_fecha) + ')' : ''}`); if (p.notas) w('Antecedentes: ' + p.notas); gap(3)
    w('2. Grupo familiar', 15, true, 12)
    if (p.familia_id) { w('Familia ' + fn(p.familia_id)); D.personas.filter(x => x.familia_id === p.familia_id).forEach(x => w('- ' + x.nombre, 20)) } else w('Sin grupo familiar vinculado'); gap(3)
    w('3. Casos', 15, true, 12); by('casos').forEach(c => { w(`${c.titulo} [${c.estado} · prioridad ${c.prioridad}]`, 20, true); w(c.descripcion, 25) }); gap(3)
    w('4. Plan de intervención', 15, true, 12); by('objetivos').forEach(o => w(`- [${o.area}] ${o.objetivo} · avance ${o.avance || 0}%${o.plazo ? ' · plazo ' + fd(o.plazo) : ''}`, 20)); gap(3)
    w('5. Intervenciones', 15, true, 12); by('intervenciones').forEach(x => { w(fd(x.fecha) + (x.duracion ? ` (${x.duracion} min)` : ''), 20, true); w(x.resumen, 25); if (x.acuerdos) w('Acuerdos: ' + x.acuerdos, 25) }); gap(3)
    w('6. Seguimientos', 15, true, 12); by('seguimientos').forEach(x => w(`- ${fd(x.fecha)} ${x.tipo}${x.hecho ? ' (realizado)' : ''}: ${x.nota || ''}`, 20)); gap(3)
    w('7. Derivaciones y redes', 15, true, 12); by('derivaciones').forEach(x => w(`- ${x.institucion} (${x.estado}) ${fd(x.fecha)}: ${x.motivo || ''}`, 20))
    fin()
    d.save('informe-social-' + p.nombre.replace(/\s+/g, '_') + '.pdf')
  }
  function listado(id) {
    const L = D.casos.filter(c => !id || c.persona_id === id); if (!L.length) return alert('No hay casos para exportar')
    const { d, w, gap, fin } = doc('Listado de casos')
    L.forEach(c => { w(`${fd(c.fecha)} · ${c.titulo} [${c.estado} · ${c.prioridad}]`, 15, true); if (!id) w('Persona: ' + pn(c.persona_id), 20); w(c.descripcion, 20); gap(3) })
    fin()
    d.save('casos-' + today() + '.pdf')
  }
  function csv(k) {
    const L = D[k]; if (!L.length) return alert('No hay datos para exportar')
    const cols = Object.keys(L[0]).filter(c => !['user_id', 'deleted_at'].includes(c)), e = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    fileOut(`${k}-${today()}.csv`, new Blob(['\ufeff' + [cols.join(','), ...L.map(r => cols.map(c => e(r[c])).join(','))].join('\n')], { type: 'text/csv;charset=utf-8' }))
  }
  const wa = s => { const p = D.personas.find(x => x.id === s.persona_id) || {}; return 'https://wa.me/' + (p.telefono || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(`Hola ${p.nombre || ''}, le recordamos su ${s.tipo.toLowerCase()} el ${fd(s.fecha)}${s.hora ? ' a las ' + s.hora.slice(0, 5) : ''}. ¡Saludos!`) }

  if (!ready) return <p className="load">Cargando tu espacio…</p>
  const t = today(), cut = addD(t, -30)
  const pend = D.seguimientos.filter(s => !s.hecho).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
  const lastInt = pid => D.intervenciones.filter(i => i.persona_id === pid).map(i => i.fecha).sort().pop()
  const alerts = [
    ...pend.filter(s => s.fecha < t).map(s => ({ r: 1, t: `Seguimiento atrasado: ${s.tipo} con ${pn(s.persona_id)} (${fd(s.fecha)})`, k: 'seguimientos', v: s })),
    ...D.casos.filter(c => c.estado === 'Activo' && (lastInt(c.persona_id) || c.fecha || c.created_at.slice(0, 10)) < cut).map(c => ({ t: `Caso sin movimiento hace más de 30 días: ${c.titulo} (${pn(c.persona_id)})`, k: 'casos', v: c })),
    ...D.objetivos.filter(o => o.plazo && o.plazo < t && (o.avance || 0) < 100).map(o => ({ r: 1, t: `Objetivo vencido: ${o.objetivo} (${pn(o.persona_id)})`, k: 'objetivos', v: o })),
    ...D.personas.filter(p => p.consentimiento !== 'Sí' && mine(p)).map(p => ({ t: `Sin consentimiento informado: ${p.nombre}`, k: 'personas', v: p })),
  ]
  const Bar = ({ k }) => <div className="bar"><input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} /><button className="btn" onClick={() => openNew(k)}>+ Nueva {T[k].n}</button></div>
  const Empty = ({ a }) => (a.length ? null : <p className="mu">Aún no hay registros. Crea el primero con el botón de arriba.</p>)
  const SegCard = ({ s }) => (
    <div className="card">
      <div className="it" onClick={() => setM({ k: 'seguimientos', v: s })}>
        <b className={s.hecho ? 'done' : ''}>{s.tipo}</b>
        <span className="mu">{pn(s.persona_id)} · {fd(s.fecha)} {s.hora?.slice(0, 5)} {s.nota} {!mine(s) && '· Compartido'}</span>
      </div>
      {mine(s) && <div className="row"><button className="btn g sm" onClick={() => toggle(s)}>{s.hecho ? 'Reabrir' : 'Marcar realizado'}</button><a className="btn g sm" href={wa(s)} target="_blank" rel="noreferrer">Recordar por WhatsApp</a></div>}
    </div>
  )
  const rows = {
    personas: p => ({ t: p.nombre, s: `${p.rut || ''} ${p.familia_id ? '· Familia ' + fn(p.familia_id) : ''}`, k: p.nombre + (p.rut || ''), open: () => setM({ ficha: p.id }) }),
    familias: f => ({ t: 'Familia ' + f.nombre, s: D.personas.filter(p => p.familia_id === f.id).map(p => p.nombre).join(', '), k: f.nombre, open: () => setM({ fam: f.id }) }),
    casos: c => ({ t: c.titulo, s: `${pn(c.persona_id)} · ${c.estado} · ${fd(c.fecha)}`, tag: c.prioridad, k: c.titulo + pn(c.persona_id) }),
    intervenciones: i => ({ t: `${fd(i.fecha)} · ${pn(i.persona_id)}`, s: (i.resumen || '').slice(0, 150), k: pn(i.persona_id) + (i.resumen || '') }),
    objetivos: o => ({ t: o.objetivo, s: `${pn(o.persona_id)} · ${o.area}${o.plazo ? ' · plazo ' + fd(o.plazo) : ''} · ${o.avance || 0}%`, bar: o.avance, k: o.objetivo + pn(o.persona_id) }),
    derivaciones: d => ({ t: d.institucion, s: `${pn(d.persona_id)} · ${fd(d.fecha)} · ${d.motivo || ''}`, tag: d.estado, k: d.institucion + pn(d.persona_id) }),
  }

  let view
  if (tab === 'home') view = (<>
    <div className="hero"><div><h1>Panel principal</h1><span className="mu">Información de atenciones y seguimientos</span></div><button className="btn" onClick={() => openNew('personas')}>+ Nueva persona</button></div>
    <div className="grid">{[['Personas registradas', D.personas.length, '#1c7c93'], ['Grupos familiares', D.familias.length, '#8e6bbf'],
      ['Casos activos', D.casos.filter(c => c.estado === 'Activo').length, '#e0963a'], ['Seguimientos pendientes', pend.length, '#3f9b6e']]
      .map(x => <div key={x[0]} className="stat" style={{ '--c': x[2] }}><b>{x[1]}</b><span className="mu">{x[0]}</span></div>)}</div>
    <div className="card"><h3>Alertas ({alerts.length})</h3>{alerts.slice(0, 8).map((a, i) => <div key={i} className={'card it al' + (a.r ? ' r' : '')} onClick={() => setM({ k: a.k, v: a.v })}>{a.t}</div>)}{!alerts.length && <p className="mu">Todo al día.</p>}</div>
    <div className="card"><div className="bar"><h3 style={{ flex: 1, margin: 0 }}>Próximos seguimientos</h3><a href="#" onClick={e => { e.preventDefault(); setTab('seguimientos') }}>Ver todos</a></div>
      {pend.slice(0, 5).map(s => <SegCard key={s.id} s={s} />)}<Empty a={pend} /></div></>)
  else if (rows[tab]) {
    const L = D[tab].filter(r => ok(rows[tab](r).k)).reverse()
    view = (<><Bar k={tab} />{L.map(r => { const x = rows[tab](r); return (
      <div key={r.id} className="card it" onClick={x.open || (() => setM({ k: tab, v: r }))}>{x.tag && <span className={'tag ' + x.tag}>{x.tag}</span>}{!mine(r) && <span className="tag">Compartido</span>}<b>{x.t}</b><span className="mu">{x.s}</span>{x.bar !== undefined && <div className="pb"><i style={{ width: Math.min(100, x.bar || 0) + '%' }} /></div>}</div>) })}<Empty a={L} /></>)
  } else if (tab === 'seguimientos') {
    const L = D.seguimientos.filter(s => ok(pn(s.persona_id) + s.tipo + (s.nota || ''))).sort((a, b) => a.fecha.localeCompare(b.fecha))
    view = (<><Bar k="seguimientos" />{L.map(s => <SegCard key={s.id} s={s} />)}<Empty a={L} /></>)
  } else if (tab === 'cal') {
    const off = (new Date(cal.y, cal.m, 1).getDay() + 6) % 7, days = new Date(cal.y, cal.m + 1, 0).getDate(), cells = []
    for (let i = 0; i < off; i++) cells.push(<div key={'o' + i} />)
    for (let d = 1; d <= days; d++) { const s = `${cal.y}-${pad(cal.m + 1)}-${pad(d)}`
      cells.push(<div key={s} className={'d' + (s === t ? ' t' : '') + (s === cal.sel ? ' s' : '')} onClick={() => setCal({ ...cal, sel: s })}>{d}{D.seguimientos.some(a => a.fecha === s && !a.hecho) && <i />}</div>) }
    const mv = k => { let mm = cal.m + k, y = cal.y; if (mm < 0) { mm = 11; y-- } if (mm > 11) { mm = 0; y++ } setCal({ ...cal, m: mm, y }) }
    const day = D.seguimientos.filter(a => a.fecha === cal.sel)
    view = (<>
      <div className="bar"><button className="btn g sm" onClick={() => mv(-1)}>‹</button><b style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{new Date(cal.y, cal.m).toLocaleDateString('es', { month: 'long', year: 'numeric' })}</b><button className="btn g sm" onClick={() => mv(1)}>›</button></div>
      <div className="cal">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => <div key={x} className="h">{x}</div>)}{cells}</div>
      <div className="bar"><b style={{ flex: 1 }}>{fd(cal.sel)}</b><button className="btn" onClick={() => openNew('seguimientos', { fecha: cal.sel })}>+ Seguimiento</button></div>
      {day.map(s => <SegCard key={s.id} s={s} />)}<Empty a={day} /></>)
  } else if (tab === 'documentos') {
    const L = D.documentos.filter(r => ok(r.nombre + pn(r.persona_id)))
    view = (<><div className="card"><h3>Subir documento</h3><div className="bar"><select value={dp} onChange={e => setDp(e.target.value)}><option value="">Persona…</option>{D.personas.filter(mine).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      <select value={dt} onChange={e => setDt(e.target.value)}>{['Consentimiento', 'Informe', 'Certificado', 'Otro'].map(x => <option key={x}>{x}</option>)}</select>
      <label className="btn" style={{ margin: 0, color: '#fff' }}>Elegir archivo<input type="file" hidden onChange={upload} /></label></div><span className="mu">Se guardan en un almacenamiento privado, visible solo para ti. Máximo 10 MB.</span></div>
      <div className="bar"><input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {L.map(r => <div key={r.id} className="card"><span className="tag">{r.tipo}</span><b>{r.nombre}</b><span className="mu">{pn(r.persona_id)} · {fd(r.created_at.slice(0, 10))}</span>
        <div className="row"><button className="btn g sm" onClick={() => openDoc(r)}>Abrir</button>{mine(r) && <button className="btn g sm" onClick={() => trash('documentos', r.id)}>A la papelera</button>}</div></div>)}<Empty a={L} /></>)
  } else if (tab === 'stats') {
    const months = [...Array(6)].map((_, i) => { const d = new Date(n.getFullYear(), n.getMonth() - 5 + i, 1); return [iso(d).slice(0, 7), d.toLocaleDateString('es', { month: 'short' })] })
    const by = (k, f) => Object.entries(D[k].reduce((a, r) => { const v = r[f] || 'Sin dato'; a[v] = (a[v] || 0) + 1; return a }, {}))
    const av = D.objetivos.length ? Math.round(D.objetivos.reduce((a, o) => a + (+o.avance || 0), 0) / D.objetivos.length) : 0
    view = (<><div className="card"><h3>Intervenciones por mes</h3><Bars items={months.map(([k, l]) => [l, D.intervenciones.filter(i => i.fecha.startsWith(k)).length])} /></div>
      <div className="grid"><div className="card"><h3>Casos por estado</h3><Bars items={by('casos', 'estado')} /></div><div className="card"><h3>Casos por prioridad</h3><Bars items={by('casos', 'prioridad')} /></div>
      <div className="card"><h3>Derivaciones</h3><Bars items={by('derivaciones', 'estado')} /></div><div className="card"><h3>Avance promedio del plan</h3><b style={{ fontSize: 30 }}>{av}%</b><div className="pb"><i style={{ width: av + '%' }} /></div></div></div></>)
  } else if (tab === 'seg') {
    const nTr = KEYS.reduce((a, k) => a + Tr[k].length, 0)
    view = (<>
      <div className="card"><h3>Compartir en solo lectura</h3><p className="mu">La persona invitada verá tus registros, sin poder editarlos, al entrar con ese correo de Google.</p>
        <div className="bar"><input placeholder="correo@ejemplo.com" value={mail} onChange={e => setMail(e.target.value)} /><button className="btn" onClick={invite}>Invitar</button></div>
        {acc.map(a => <div key={a.id} className="bar"><span style={{ flex: 1 }}>{a.email}</span><button className="btn g sm" onClick={() => revoke(a.id)}>Quitar acceso</button></div>)}{!acc.length && <p className="mu">No has compartido tu espacio con nadie.</p>}</div>
      <div className="card"><h3>Papelera ({nTr})</h3>{KEYS.flatMap(k => Tr[k].map(r => <div key={k + r.id} className="bar"><span style={{ flex: 1 }}><span className="tag">{T[k].n}</span>{lab(k, r)}</span>
        <button className="btn g sm" onClick={() => restore(k, r.id)}>Restaurar</button><button className="btn dg sm" onClick={() => purge(k, r.id)}>Eliminar definitivo</button></div>))}{!nTr && <p className="mu">La papelera está vacía.</p>}</div>
      <div className="card"><h3>Registro de actividad (últimos 40)</h3>{aud.map(a => <div key={a.id} className="mu">{new Date(a.fecha).toLocaleString('es')} · {{ INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó' }[a.accion]} en {a.tabla}</div>)}{!aud.length && <p className="mu">Sin actividad registrada.</p>}</div></>)
  } else view = (<>
    <div className="card"><h3>Informes en PDF</h3>
      <label>Persona<select value={rp} onChange={e => setRp(e.target.value)}><option value="">— Todas / seleccione —</option>{D.personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <div className="row"><button className="btn" onClick={() => informe(rp)}>⬇ Informe social completo</button><button className="btn g" onClick={() => listado(rp)}>⬇ Listado de casos {rp ? 'de la persona' : '(todos)'}</button></div></div>
    <div className="card"><h3>Membrete y firma de los informes</h3><p className="mu">Estos datos aparecen en el encabezado y en la firma de cada PDF. Se guardan en este navegador.</p>
      {[['institucion', 'Institución / organización'], ['ciudad', 'Ciudad y país'], ['profesional', 'Nombre del profesional'], ['cargo', 'Cargo']].map(([k, l]) => <label key={k}>{l}<input value={pf[k] || ''} onChange={e => setPf({ ...pf, [k]: e.target.value })} /></label>)}
      <label>Color del membrete<input type="color" value={pf.color || '#8a7bb0'} onChange={e => setPf({ ...pf, color: e.target.value })} style={{ height: 40, padding: 2 }} /></label>
      <label>Firma (PNG o JPG, máx. 200 KB)<input type="file" accept="image/png,image/jpeg" onChange={onFirma} /></label>
      {pf.firma && <div className="row" style={{ alignItems: 'center' }}><img src={pf.firma.data} alt="Firma" style={{ height: 50, background: '#fff', borderRadius: 6, padding: 4 }} /><button className="btn g sm" onClick={() => setPf({ ...pf, firma: null })}>Quitar firma</button></div>}</div>
    <div className="card"><h3>Exportar a Excel (CSV)</h3><div className="row">{['personas', 'familias', 'casos', 'intervenciones', 'objetivos', 'seguimientos', 'derivaciones'].map(k => <button key={k} className="btn g sm" onClick={() => csv(k)}>{k}</button>)}</div></div></>)

  let modal = null
  if (m?.k) modal = <Form key={m.k + (m.v.id || 'n')} k={m.k} v={m.v} D={D} uid={uid} onSave={o => save(m.k, o)} onClose={() => setM(null)} onDelete={() => trash(m.k, m.v.id)} />
  else if (m?.ficha) {
    const p = D.personas.find(x => x.id === m.ficha)
    if (p) {
      const my = k => D[k].filter(x => x.persona_id === p.id), fam = p.familia_id ? D.personas.filter(x => x.familia_id === p.familia_id && x.id !== p.id) : []
      const tl = [...my('casos').map(x => ({ d: x.fecha || x.created_at.slice(0, 10), i: '📁', t: 'Caso: ' + x.titulo, k: 'casos', r: x })),
        ...my('intervenciones').map(x => ({ d: x.fecha, i: '🗒️', t: 'Intervención: ' + (x.resumen || '').slice(0, 70), k: 'intervenciones', r: x })),
        ...my('seguimientos').map(x => ({ d: x.fecha, i: '📞', t: `${x.tipo}${x.hecho ? ' (realizado)' : ''}: ${x.nota || ''}`, k: 'seguimientos', r: x })),
        ...my('derivaciones').map(x => ({ d: x.fecha || x.created_at.slice(0, 10), i: '🔀', t: 'Derivación: ' + x.institucion, k: 'derivaciones', r: x }))].sort((a, b) => b.d.localeCompare(a.d))
      const B = (k, l) => <button className="btn sm" onClick={() => openNew(k, { persona_id: p.id })}>{l}</button>
      modal = (<div className="box"><h3>{p.nombre}</h3>
        <p className="mu">{p.rut} {p.nacimiento && '· Nac. ' + fd(p.nacimiento)}<br />{p.telefono} {p.direccion}</p>
        <span className="tag">Consentimiento: {p.consentimiento || 'No'}{p.consentimiento_fecha && ' (' + fd(p.consentimiento_fecha) + ')'}</span>
        {p.familia_id && <span className="tag">Familia {fn(p.familia_id)}</span>}{fam.map(x => <span key={x.id} className="tag" style={{ cursor: 'pointer' }} onClick={() => setM({ ficha: x.id })}>{x.nombre}</span>)}{p.notas && <p>{p.notas}</p>}
        {mine(p) && <div className="row">{B('casos', '+ Caso')}{B('intervenciones', '+ Intervención')}{B('seguimientos', '+ Seguimiento')}{B('objetivos', '+ Objetivo')}{B('derivaciones', '+ Derivación')}</div>}
        <div className="row"><button className="btn g sm" onClick={() => informe(p.id)}>⬇ Informe social</button></div>
        <h4>Línea de tiempo</h4>{tl.map(x => <div key={x.k + x.r.id} className="card it" onClick={() => setM({ k: x.k, v: x.r })}><span className="mu">{fd(x.d)}</span><b>{x.i} {x.t}</b></div>)}{!tl.length && <p className="mu">Sin actividad todavía.</p>}
        <div className="row"><button className="btn g" onClick={() => setM({ k: 'personas', v: p })}>Editar</button><button className="btn g" onClick={() => setM(null)}>Cerrar</button></div></div>)
    }
  } else if (m?.fam) {
    const f = D.familias.find(x => x.id === m.fam)
    if (f) { const mem = D.personas.filter(p => p.familia_id === f.id)
      modal = (<div className="box"><h3>Familia {f.nombre}</h3><p className="mu">{f.direccion} {f.telefono}</p>{f.notas && <p>{f.notas}</p>}
        <h4>Genograma</h4>{mem.length ? <Geno mem={mem} /> : <p className="mu">Vincula personas a esta familia desde su ficha.</p>}
        <h4>Ecomapa</h4><Eco fam={f} refs={D.derivaciones.filter(r => mem.some(p => p.id === r.persona_id))} />
        <div className="row"><button className="btn g" onClick={() => setM({ k: 'familias', v: f })}>Editar</button><button className="btn g" onClick={() => setM(null)}>Cerrar</button></div></div>) }
  }

  return (
    <div className="app">
      <aside><h2>🤝 SGS Social</h2>
        {TABS.map(x => <button key={x[0]} className={x[0] === tab ? 'on' : ''} onClick={() => { setTab(x[0]); setQ('') }}>{x[1]}</button>)}
        <div className="me">{user.email}<button className="btn g sm" style={{ color: '#fff', borderColor: '#ffffff66' }} onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div></aside>
      <div className="main"><div className="top"><div><b>SGS · Gestión Social</b><span className="mu">Espacio de trabajo privado</span></div><span className="pill">{user.user_metadata?.full_name || 'Profesional responsable'}</span></div>
        <div className="wrap">{view}</div></div>
      {modal && <div className="ov" onClick={e => { if (e.target === e.currentTarget) setM(null) }}>{modal}</div>}
    </div>
  )
}
