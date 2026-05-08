import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + 'M' : Number(n).toLocaleString()

const SVC_COLORS = { A: '#00c4ff', B: '#a855f7', C: '#f5a623' }

const MOCK_LOGS = [
  { timestamp: '09:00:00', service: 'A', event: 'user.login', status: 'ok' },
  { timestamp: '09:00:01', service: 'B', event: 'session.init', status: 'ok' },
  {
    timestamp: '09:00:02',
    service: 'A',
    event: 'auth.token_issued',
    status: 'ok',
  },
  {
    timestamp: '09:00:03',
    service: 'C',
    event: 'db.query_start',
    status: 'ok',
  },
//   { timestamp: '09:00:04', service: 'A', event: 'user.login', status: 'dup' },
//   { timestamp: '09:00:05', service: 'B', event: 'cache.miss', status: 'ok' },
//   { timestamp: '09:00:06', service: 'C', event: 'db.query_end', status: 'ok' },
//   { timestamp: '09:00:07', service: 'A', event: 'api.request', status: 'ok' },
//   { timestamp: '09:00:08', service: 'B', event: 'queue.push', status: 'ok' },
//   { timestamp: '09:00:09', service: 'C', event: 'db.connect', status: 'miss' },
//   {
//     timestamp: '09:00:10',
//     service: 'A',
//     event: 'api.response_200',
//     status: 'ok',
//   },
//   { timestamp: '09:00:11', service: 'B', event: 'queue.pop', status: 'ok' },
]

const LIVE_EVENTS = [
  'api.call',
  'cache.hit',
  'db.write',
  'auth.check',
  'queue.msg',
  'health.ping',
]
const LIVE_STATUSES = ['ok', 'ok', 'ok', 'ok', 'dup', 'miss']

const RATE_DATA = [
  890000, 950000, 1020000, 1100000, 1080000, 1150000, 1200000, 1240000,
]

// ── styles (injected once) ────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600&display=swap');

.ls-root *,
.ls-root *::before,
.ls-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

.ls-root {
  font-family: 'Space Grotesk', sans-serif;
  background: #0b0e14;
  color: #c9d1e0;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.ls-scanline {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,120,0.012) 2px, rgba(0,255,120,0.012) 4px);
  z-index: 0;
  border-radius: 12px;
}
.ls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 12px;
  border-bottom: 1px solid rgba(0,255,120,0.12);
  background: rgba(11,14,20,0.95);
  position: relative;
  z-index: 2;
}
.ls-logo { display: flex; align-items: center; gap: 10px; }
.ls-logo-icon {
  width: 28px; height: 28px;
  background: linear-gradient(135deg,#00ff78,#00c4ff);
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.ls-brand { font-size: 13px; font-weight: 600; color: #e8edf5; letter-spacing: 0.04em; }
.ls-subtitle { font-size: 10px; color: #5a6a80; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px; }
.ls-status-pill {
  display: flex; align-items: center; gap: 6px;
  background: rgba(0,255,120,0.08);
  border: 1px solid rgba(0,255,120,0.2);
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 11px; color: #00e870; font-family: 'JetBrains Mono', monospace;
}
.ls-pulse {
  width: 6px; height: 6px; border-radius: 50%; background: #00e870;
  animation: lsPulse 1.4s ease-in-out infinite;
}
@keyframes lsPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }

.ls-nav { display: flex; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(11,14,20,0.9); position: relative; z-index: 2; }
.ls-nav-item { padding: 8px 16px; font-size: 12px; color: #5a6a80; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; letter-spacing: 0.02em; }
.ls-nav-item:hover { color: #c9d1e0; }
.ls-nav-item.active { color: #00e870; border-bottom-color: #00e870; }

.ls-body { padding: 16px 20px; position: relative; z-index: 1; }

.ls-metrics-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 14px; }
.ls-metric {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 12px 14px;
  position: relative; overflow: hidden; transition: border-color 0.2s;
}
.ls-metric:hover { border-color: rgba(0,255,120,0.2); }
.ls-metric-accent { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
.ls-metric-label { font-size: 9px; color: #4a5a70; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px; }
.ls-metric-value { font-size: 22px; font-weight: 600; color: #e8edf5; font-family: 'JetBrains Mono', monospace; line-height: 1; margin-bottom: 5px; }
.ls-metric-delta { font-size: 10px; font-family: 'JetBrains Mono', monospace; }
.delta-up   { color: #00e870; }
.delta-down { color: #ff4e4e; }
.delta-warn { color: #f5a623; }

.ls-main-row { display: grid; grid-template-columns: 1fr 260px; gap: 12px; margin-bottom: 12px; }

.ls-panel { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden; }
.ls-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.ls-panel-title { font-size: 11px; font-weight: 500; color: #8899aa; letter-spacing: 0.06em; text-transform: uppercase; }
.ls-badge { font-size: 9px; font-family: 'JetBrains Mono', monospace; padding: 2px 7px; border-radius: 4px; background: rgba(0,255,120,0.1); color: #00e870; border: 1px solid rgba(0,255,120,0.2); }
.ls-badge-warn { background: rgba(245,166,35,0.1); color: #f5a623; border-color: rgba(245,166,35,0.2); }

.ls-upload-zone {
  margin: 14px;
  border: 1.5px dashed rgba(0,255,120,0.2);
  border-radius: 8px; padding: 20px 16px; text-align: center;
  cursor: pointer; transition: all 0.2s; position: relative;
}
.ls-upload-zone:hover, .ls-upload-zone.drag-over { border-color: rgba(0,255,120,0.5); background: rgba(0,255,120,0.03); }
.ls-upload-text { font-size: 12px; color: #8899aa; margin-bottom: 4px; }
.ls-upload-sub  { font-size: 10px; color: #4a5a70; }
.ls-upload-btn {
  margin-top: 10px; display: inline-block;
  background: rgba(0,255,120,0.1); border: 1px solid rgba(0,255,120,0.3);
  color: #00e870; font-size: 11px; font-family: 'JetBrains Mono', monospace;
  padding: 5px 16px; border-radius: 5px; cursor: pointer; transition: all 0.15s;
}
.ls-upload-btn:hover { background: rgba(0,255,120,0.2); }
.ls-upload-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ls-progress-wrap { margin: 0 14px 12px; }
.ls-progress-track { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
.ls-progress-fill { height: 100%; background: linear-gradient(90deg,#00e870,#00c4ff); border-radius: 2px; transition: width 0.4s ease; }
.ls-progress-label { font-size: 10px; color: #4a5a70; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px; }

.ls-service-bars { padding: 10px 14px 14px; }
.ls-service-row { margin-bottom: 10px; }
.ls-service-info { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
.ls-service-name { color: #8899aa; font-family: 'JetBrains Mono', monospace; }
.ls-service-count { color: #c9d1e0; font-family: 'JetBrains Mono', monospace; }
.ls-bar-track { height: 5px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.ls-bar-fill { height: 100%; border-radius: 3px; transition: width 1.2s cubic-bezier(.16,1,.3,1); }

.ls-confidence-body { padding: 14px; display: flex; flex-direction: column; align-items: center; }
.ls-ring-wrap { position: relative; width: 110px; height: 110px; margin-bottom: 10px; }
.ls-ring-svg { width: 110px; height: 110px; }
.ls-ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ls-ring-pct { font-size: 22px; font-weight: 600; color: #e8edf5; font-family: 'JetBrains Mono', monospace; line-height: 1; }
.ls-ring-sub { font-size: 9px; color: #4a5a70; text-transform: uppercase; letter-spacing: 0.08em; }
.ls-conf-label { font-size: 11px; font-weight: 500; color: #8899aa; text-align: center; margin-bottom: 4px; }
.ls-conf-desc  { font-size: 10px; color: #4a5a70; text-align: center; line-height: 1.5; }

.ls-breakdown-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 11px; }
.ls-breakdown-label { color: #5a6a80; }
.ls-breakdown-val { font-family: 'JetBrains Mono', monospace; }
.c-green  { color: #00e870; }
.c-red    { color: #ff4e4e; }
.c-yellow { color: #f5a623; }

.ls-timeline-panel { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden; }
.ls-timeline-head { display: grid; grid-template-columns: 130px 90px 1fr 70px; gap: 6px; padding: 5px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.ls-th { font-size: 9px; color: #4a5a70; letter-spacing: 0.08em; }
.ls-th:last-child { text-align: right; }
.ls-timeline-scroll { max-height: 170px; overflow-y: auto; }
.ls-timeline-scroll::-webkit-scrollbar { width: 3px; }
.ls-timeline-scroll::-webkit-scrollbar-thumb { background: rgba(0,255,120,0.15); border-radius: 2px; }

.ls-log-row { display: grid; grid-template-columns: 130px 90px 1fr 70px; gap: 6px; align-items: center; padding: 5px 14px; font-size: 10px; font-family: 'JetBrains Mono', monospace; border-bottom: 1px solid rgba(255,255,255,0.025); animation: lsSlideIn 0.3s ease-out both; }
@keyframes lsSlideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
.ls-log-row:hover { background: rgba(0,255,120,0.03); }
.ls-ts { color: #4a5a70; }
.ls-svc-tag { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9px; }
.svc-a { background: rgba(0,196,255,0.1);  color: #00c4ff; }
.svc-b { background: rgba(168,85,247,0.15); color: #a855f7; }
.svc-c { background: rgba(245,166,35,0.12); color: #f5a623; }
.ls-event-text { color: #8899aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ls-log-status { text-align: right; }
.status-ok   { color: #00e870; }
.status-dup  { color: #f5a623; }
.status-miss { color: #ff4e4e; }

.ls-error { margin: 0 14px 12px; padding: 8px 12px; background: rgba(255,78,78,0.08); border: 1px solid rgba(255,78,78,0.2); border-radius: 6px; font-size: 11px; color: #ff4e4e; font-family: 'JetBrains Mono', monospace; }

.ls-processing-tag { display: flex; align-items: center; gap: 5px; font-size: 10px; color: #00c4ff; font-family: 'JetBrains Mono', monospace; }
.ls-processing-dot { width: 8px; height: 8px; border-radius: 50%; background: #00c4ff; animation: lsPulse 1.4s ease-in-out infinite; }

@media (max-width: 700px) {
  .ls-metrics-grid { grid-template-columns: repeat(2,1fr); }
  .ls-main-row { grid-template-columns: 1fr; }
}
`

// ── sub-components ────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, delta, deltaClass, accentColor }) => (
  <div className='ls-metric'>
    <div
      className='ls-metric-accent'
      style={{
        background: `linear-gradient(90deg,${accentColor},transparent)`,
      }}
    />
    <div className='ls-metric-label'>{label}</div>
    <div className='ls-metric-value'>{value}</div>
    <div className={`ls-metric-delta ${deltaClass}`}>{delta}</div>
  </div>
)

const ServiceBar = ({ name, count, pct, color }) => (
  <div className='ls-service-row'>
    <div className='ls-service-info'>
      <span className='ls-service-name'>{name}</span>
      <span className='ls-service-count'>{count}</span>
    </div>
    <div className='ls-bar-track'>
      <div
        className='ls-bar-fill'
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  </div>
)

const ConfidenceRing = ({ pct }) => {
  const R = 46
  const circ = 2 * Math.PI * R
  const offset = circ * (1 - pct / 100)
  return (
    <div className='ls-ring-wrap'>
      <svg
        className='ls-ring-svg'
        viewBox='0 0 110 110'
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx='55'
          cy='55'
          r={R}
          fill='none'
          stroke='rgba(255,255,255,0.06)'
          strokeWidth='8'
        />
        <circle
          cx='55'
          cy='55'
          r={R}
          fill='none'
          stroke='url(#ringGrad)'
          strokeWidth='8'
          strokeLinecap='round'
          strokeDasharray={circ.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          style={{
            transition: 'stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1)',
          }}
        />
        <defs>
          <linearGradient id='ringGrad' x1='0%' y1='0%' x2='100%' y2='0%'>
            <stop offset='0%' stopColor='#00e870' />
            <stop offset='100%' stopColor='#00c4ff' />
          </linearGradient>
        </defs>
      </svg>
      <div className='ls-ring-label'>
        <div className='ls-ring-pct'>{pct}%</div>
        <div className='ls-ring-sub'>Confidence</div>
      </div>
    </div>
  )
}

const LogRow = ({ ts, service, event, status, delay = 0 }) => {
  const svcClass = `svc-${service.toLowerCase()}`
  const statusClass = `status-${status}`
  const statusLabel =
    status === 'ok' ? '● OK' : status === 'dup' ? '⚠ DUP' : '✕ MISS'
  return (
    <div className='ls-log-row' style={{ animationDelay: `${delay}ms` }}>
      <span className='ls-ts'>{ts}</span>
      <span>
        <span className={`ls-svc-tag ${svcClass}`}>SVC-{service}</span>
      </span>
      <span className='ls-event-text'>{event}</span>
      <span className={`ls-log-status ${statusClass}`}>{statusLabel}</span>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
const Upload = () => {
  const [files, setFiles] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [logs, setLogs] = useState(MOCK_LOGS)
  const [activeNav, setActiveNav] = useState('Dashboard')
  const tickRef = useRef(0)
  const fileInputRef = useRef(null)

  // inject CSS once
  useEffect(() => {
    if (!document.getElementById('ls-styles')) {
      const s = document.createElement('style')
      s.id = 'ls-styles'
      s.textContent = CSS
      document.head.appendChild(s)
    }
  }, [])

  // live feed ticker
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++
      const svc = ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
      const ev = LIVE_EVENTS[Math.floor(Math.random() * LIVE_EVENTS.length)]
      const st = LIVE_STATUSES[Math.floor(Math.random() * LIVE_STATUSES.length)]
      const ts = new Date().toTimeString().slice(0, 8)
      setLogs((prev) =>
        [{ timestamp: ts, service: svc, event: ev, status: st }, ...prev].slice(
          0,
          14,
        ),
      )
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files))
    setError(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith('.json'),
    )
    setFiles(dropped)
    setError(null)
  }

  const uploadFiles = async () => {
    if (!files.length) return
    setLoading(true)
    setError(null)
    setProgress(10)

    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))

    try {
      const res = await axios.post(
        'http://localhost:8000/api/logs/upload',
        formData,
        {
          onUploadProgress: (e) => {
            setProgress(Math.round((e.loaded / e.total) * 70))
          },
        },
      )
      setProgress(100)
      setData(res.data)

      // populate timeline from real response
      if (res.data.timeline?.length) {
        setLogs(
          res.data.timeline.slice(0, 20).map((l) => ({
            timestamp: String(l.timestamp).slice(11, 19) || l.timestamp,
            service: (l.service || 'A').slice(-1).toUpperCase(),
            event: l.event || 'log.entry',
            status: 'ok',
          })),
        )
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  // derived metrics
  const totalLogs = data?.totalLogs ?? 1_240_000
  const duplicates = data?.duplicates ?? 6420
  const missing = data?.missing ?? 312
  const confidence = data?.confidence ?? 89

  // service breakdown (real if available, else mock)
  const svcCounts = data?.serviceBreakdown ?? { A: 421, B: 330, C: 178 }
  const svcMax = Math.max(...Object.values(svcCounts))

  // chart config
  const chartData = {
    labels: ['C-8', 'C-7', 'C-6', 'C-5', 'C-4', 'C-3', 'C-2', 'NOW'],
    datasets: [
      {
        data: RATE_DATA,
        backgroundColor: RATE_DATA.map((_, i) =>
          i === RATE_DATA.length - 1
            ? 'rgba(0,232,112,0.35)'
            : 'rgba(0,196,255,0.15)',
        ),
        borderColor: RATE_DATA.map((_, i) =>
          i === RATE_DATA.length - 1
            ? 'rgba(0,232,112,0.8)'
            : 'rgba(0,196,255,0.3)',
        ),
        borderWidth: 1,
        borderRadius: 2,
      },
    ],
  }
  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(11,14,20,0.95)',
        borderColor: 'rgba(0,255,120,0.2)',
        borderWidth: 1,
        titleColor: '#8899aa',
        bodyColor: '#00e870',
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        callbacks: { label: (c) => (c.raw / 1_000_000).toFixed(2) + 'M logs' },
      },
    },
    scales: { x: { display: false }, y: { display: false, min: 700_000 } },
    animation: { duration: 1200, easing: 'easeOutQuart' },
  }

  return (
    <div className='ls-root'>
      <div className='ls-scanline' />

      {/* header */}
      <div className='ls-header'>
        <div className='ls-logo'>
          <div className='ls-logo-icon'>
            <svg viewBox='0 0 16 16' width='16' height='16' fill='none'>
              <rect x='1' y='3' width='14' height='2' rx='1' fill='#0b0e14' />
              <rect x='1' y='7' width='10' height='2' rx='1' fill='#0b0e14' />
              <rect x='1' y='11' width='12' height='2' rx='1' fill='#0b0e14' />
            </svg>
          </div>
          <div>
            <div className='ls-brand'>LogStream Core</div>
            <div className='ls-subtitle'>Distributed Log Reconciliation</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className='ls-processing-tag'>
            <div className='ls-processing-dot' />4 tasks active
          </div>
          <div className='ls-status-pill'>
            <div className='ls-pulse' />
            LIVE
          </div>
        </div>
      </div>

      {/* nav */}
      <div className='ls-nav'>
        {['Dashboard', 'Logs', 'Timeline', 'Settings'].map((n) => (
          <div
            key={n}
            className={`ls-nav-item${activeNav === n ? ' active' : ''}`}
            onClick={() => setActiveNav(n)}
          >
            {n}
          </div>
        ))}
      </div>

      <div className='ls-body'>
        {/* metrics row */}
        <div className='ls-metrics-grid'>
          <MetricCard
            label='Total Logs Ingested'
            value={fmtNum(totalLogs)}
            delta='↑ 8.4% vs last cycle'
            deltaClass='delta-up'
            accentColor='#00c4ff'
          />
          <MetricCard
            label='Duplicate Logs Detected'
            value={fmtNum(duplicates)}
            delta='↓ 2.2% vs last cycle'
            deltaClass='delta-down'
            accentColor='#f5a623'
          />
          <MetricCard
            label='Missing Logs'
            value={fmtNum(missing)}
            delta='↑ 1.8% vs last cycle'
            deltaClass='delta-warn'
            accentColor='#ff4e4e'
          />
          <MetricCard
            label='Processing Status'
            value={
              <span style={{ fontSize: 16, paddingTop: 3, color: '#00e870' }}>
                LIVE
              </span>
            }
            delta='4 tasks active'
            deltaClass=''
            accentColor='#a855f7'
          />
        </div>

        {/* main row */}
        <div className='ls-main-row'>
          <div>
            {/* upload panel */}
            <div className='ls-panel' style={{ marginBottom: 12 }}>
              <div className='ls-panel-header'>
                <span className='ls-panel-title'>Log Ingestion</span>
                <span className='ls-badge'>ACTIVE</span>
              </div>

              {/* drop zone */}
              <div
                className={`ls-upload-zone${dragging ? ' drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>⬆</div>
                <div className='ls-upload-text'>
                  {files.length
                    ? `${files.length} file(s) selected`
                    : 'Drop log files here'}
                </div>
                <div className='ls-upload-sub'>
                  Supports JSON from Service A, B, and C
                </div>
                <input
                  ref={fileInputRef}
                  type='file'
                  multiple
                  accept='.json'
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className='ls-upload-btn'
                  disabled={loading || !files.length}
                  onClick={(e) => {
                    e.stopPropagation()
                    uploadFiles()
                    console.log(files)
                  }}
                >
                  {loading ? 'Processing…' : 'Upload Files'}
                </button>
              </div>

              {/* progress bar */}
              {loading && (
                <div className='ls-progress-wrap'>
                  <div className='ls-progress-label'>
                    Processing logs… {progress}%
                  </div>
                  <div className='ls-progress-track'>
                    <div
                      className='ls-progress-fill'
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* error */}
              {error && <div className='ls-error'>✕ {error}</div>}

              {/* service bars */}
              <div className='ls-service-bars'>
                {Object.entries(svcCounts).map(([svc, count]) => (
                  <ServiceBar
                    key={svc}
                    name={`service-${svc.toLowerCase()}`}
                    count={count}
                    pct={Math.round((count / svcMax) * 100)}
                    color={SVC_COLORS[svc]}
                  />
                ))}
              </div>
            </div>

            {/* chart panel */}
            <div className='ls-panel'>
              <div className='ls-panel-header'>
                <span className='ls-panel-title'>
                  Ingestion Rate (last 8 cycles)
                </span>
              </div>
              <div style={{ padding: '8px 14px 4px' }}>
                <div style={{ position: 'relative', height: 100 }}>
                  <Bar data={chartData} options={chartOpts} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 9,
                    color: '#4a5a70',
                    fontFamily: "'JetBrains Mono', monospace",
                    paddingTop: 4,
                  }}
                >
                  {chartData.labels.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* confidence ring */}
          <div className='ls-panel ls-confidence-body'>
            <ConfidenceRing pct={confidence} />
            <div className='ls-conf-label'>Timeline Confidence</div>
            <div className='ls-conf-desc'>
              Accuracy estimated by reconciliation heuristics and duplicate
              detection
            </div>
            <div style={{ marginTop: 10, width: '100%' }}>
              {[
                { label: 'Dedup accuracy', val: '94%', cls: 'c-green' },
                { label: 'Sort fidelity', val: '98%', cls: 'c-green' },
                { label: 'Gap coverage', val: '74%', cls: 'c-yellow' },
              ].map((r) => (
                <div key={r.label} className='ls-breakdown-row'>
                  <span className='ls-breakdown-label'>{r.label}</span>
                  <span className={`ls-breakdown-val ${r.cls}`}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* timeline */}
        <div className='ls-timeline-panel'>
          <div className='ls-panel-header'>
            <span className='ls-panel-title'>Reconstructed Timeline</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className='ls-badge'>LIVE FEED</span>
              <span className='ls-badge ls-badge-warn'>
                2 conflicts detected
              </span>
            </div>
          </div>
          <div className='ls-timeline-head'>
            {['TIMESTAMP', 'SERVICE', 'EVENT', 'STATUS'].map((h) => (
              <span
                key={h}
                className='ls-th'
                style={h === 'STATUS' ? { textAlign: 'right' } : {}}
              >
                {h}
              </span>
            ))}
          </div>
          <div className='ls-timeline-scroll'>
            {logs.map((log, i) => (
              <LogRow
                key={i}
                ts={log.timestamp}
                service={log.service}
                event={log.event}
                status={log.status}
                delay={i * 40}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Upload
