import { useMemo, useState } from 'react'
import { departments, serverStats, streams } from './data/mockData.js'

const gridOptions = [
  { id: 'grid-2', label: '2×2' },
  { id: 'grid-3', label: '3×3' },
  { id: 'grid-4', label: '4×4' },
  { id: 'grid-5', label: '5×5' },
  { id: 'grid-auto', label: 'Все' },
]

function App() {
  const [activeDepartment, setActiveDepartment] = useState('all')
  const [gridMode, setGridMode] = useState('grid-2')
  const [selectedStreams, setSelectedStreams] = useState([])

  const visibleStreams = useMemo(() => {
    if (activeDepartment === 'all') return streams
    return streams.filter((stream) => stream.departmentId === activeDepartment)
  }, [activeDepartment])

  const activeDepartmentName = departments.find((item) => item.id === activeDepartment)?.name ?? 'Все трансляции'

  const toggleStream = (streamId) => {
    setSelectedStreams((current) => {
      if (current.includes(streamId)) return current.filter((id) => id !== streamId)
      return [...current, streamId]
    })
  }

  const selectAllVisible = () => {
    setSelectedStreams(visibleStreams.map((stream) => stream.id))
  }

  const clearSelection = () => setSelectedStreams([])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-eyebrow">Сервер трансляций</div>
          <div className="brand-title">21miron</div>
        </div>

        <nav className="department-nav">
          {departments.map((department) => (
            <button
              key={department.id}
              className={`department-button ${activeDepartment === department.id ? 'active' : ''}`}
              onClick={() => setActiveDepartment(department.id)}
            >
              <span>{department.id === 'all' ? '▣' : '📁'}</span>
              {department.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <div className="status-line">
            <span className="pulse" />
            Состояние сервера: <b>онлайн</b>
          </div>
          <div>Активные потоки: {serverStats.activeStreams} / {serverStats.maxStreams}</div>
          <div>VPN IP: {serverStats.serverIp}</div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{activeDepartmentName}</h1>
            <p>Выберите раскладку и набор трансляций для просмотра</p>
          </div>

          <div className="topbar-card">
            <span className="connection-dot" />
            Средний пинг: <b>{serverStats.avgPing} мс</b>
          </div>
        </header>

        <section className="toolbar">
          <div className="layout-switcher">
            {gridOptions.map((option) => (
              <button
                key={option.id}
                className={`layout-button ${gridMode === option.id ? 'active' : ''}`}
                onClick={() => setGridMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="selection-actions">
            <button onClick={selectAllVisible}>Выбрать видимые</button>
            <button className="danger" onClick={clearSelection}>Снять выбор</button>
          </div>
        </section>

        <section className={`stream-grid ${gridMode}`}>
          {visibleStreams.map((stream) => {
            const selected = selectedStreams.includes(stream.id)
            return (
              <article key={stream.id} className={`stream-card ${selected ? 'selected' : ''}`}>
                <div className="stream-card-header">
                  <div>
                    <h3>{stream.name}</h3>
                    <span>{stream.departmentName}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleStream(stream.id)}
                    aria-label={`Выбрать ${stream.name}`}
                  />
                </div>

                <div className="video-placeholder">
                  <div className="video-grid-lines" />
                  <div className={`live-badge ${stream.status === 'offline' ? 'offline' : ''}`}>
                    {stream.status === 'offline' ? 'OFFLINE' : '● LIVE'}
                  </div>
                  <div className="latency-badge">
                    {stream.latency ? `${stream.latency} мс` : 'нет сигнала'}
                  </div>
                </div>

                <div className="stream-actions">
                  <button>Открыть</button>
                  <button className="secondary">Во весь экран</button>
                </div>
              </article>
            )
          })}
        </section>
      </main>

      <aside className="info-panel">
        <section className="user-card">
          <div className="avatar">👤</div>
          <div>
            <div className="muted">Логин пользователя</div>
            <strong>{serverStats.user}</strong>
          </div>
        </section>

        <section className="metrics-card">
          <h2>Задержки каналов</h2>
          <p>Средние значения от клиента до сервера</p>

          <Metric label="До сервера трансляций" value={`${serverStats.avgPing} мс`} hint={`21miron (${serverStats.serverIp})`} />
          <Metric label="До MediaMTX RTMP" value={`${serverStats.mediamtxRtmpPing} мс`} hint={`${serverStats.serverIp}:1935`} />
          <Metric label="До HLS HTTP" value={`${serverStats.hlsPing} мс`} hint={`${serverStats.serverIp}:8888`} />
          <Metric label="До PostgreSQL" value={`${serverStats.databasePing} мс`} hint={`${serverStats.serverIp}:5432`} />
        </section>

        <section className="metrics-card compact">
          <h2>v0.1</h2>
          <p>React-интерфейс, отделы, сетки 2×2 / 3×3 / 4×4 / 5×5 и основа под API.</p>
        </section>
      </aside>
    </div>
  )
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric-row">
      <div>
        <span>{label}</span>
        <small>{hint}</small>
      </div>
      <b>{value}</b>
    </div>
  )
}

export default App
