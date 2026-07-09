import { useEffect, useMemo, useState } from 'react'
import WebRtcPlayer from './components/WebRtcPlayer.jsx'
import { departments, serverStats } from './data/mockData.js'

const gridOptions = [
  { id: 'grid-2', label: '2×2' },
  { id: 'grid-3', label: '3×3' },
  { id: 'grid-4', label: '4×4' },
  { id: 'grid-5', label: '5×5' },
  { id: 'grid-auto', label: 'Все' },
]

const adminSections = [
  { id: 'overview', label: 'Обзор' },
  { id: 'access', label: 'FreeIPA и права' },
  { id: 'streams', label: 'Потоки' },
  { id: 'integrations', label: 'Интеграции' },
]

function App() {
  const [activeDepartment, setActiveDepartment] = useState('all')
  const [gridMode, setGridMode] = useState('grid-2')
  const [selectedStreams, setSelectedStreams] = useState([])
  const [streams, setStreams] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [viewMode, setViewMode] = useState('dashboard')
  const [adminSection, setAdminSection] = useState('overview')

  useEffect(() => {
    let ignore = false

    const loadStreams = async () => {
      try {
        const response = await fetch('/api/streams', { cache: 'no-store' })
        if (!response.ok) throw new Error(`API error: ${response.status}`)

        const data = await response.json()
        if (!ignore) {
          setStreams(Array.isArray(data.streams) ? data.streams : [])
          setApiError(null)
        }
      } catch (error) {
        if (!ignore) {
          setStreams([])
          setApiError(error.message)
        }
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    loadStreams()
    const timer = setInterval(loadStreams, 2000)

    return () => {
      ignore = true
      clearInterval(timer)
    }
  }, [])

  const visibleStreams = useMemo(() => {
    if (activeDepartment === 'all') return streams
    return streams.filter((stream) => stream.departmentId === activeDepartment)
  }, [activeDepartment, streams])

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
          <button
            className={`department-button ${viewMode === 'dashboard' ? 'active' : ''}`}
            onClick={() => setViewMode('dashboard')}
          >
            <span>▣</span>
            Мониторинг
          </button>
          <button
            className={`department-button ${viewMode === 'admin' ? 'active' : ''}`}
            onClick={() => setViewMode('admin')}
          >
            <span>⚙</span>
            Панель администратора
          </button>
        </nav>

        {viewMode === 'dashboard' && (
          <nav className="department-nav secondary-nav">
            {departments.map((department) => (
              <button
                key={department.id}
                className={`department-button ${activeDepartment === department.id ? 'active' : ''}`}
                onClick={() => setActiveDepartment(department.id)}
              >
                <span>{department.id === 'all' ? '●' : '🏢'}</span>
                {department.name}
              </button>
            ))}
          </nav>
        )}

        {viewMode === 'admin' && (
          <nav className="department-nav secondary-nav">
            {adminSections.map((section) => (
              <button
                key={section.id}
                className={`department-button ${adminSection === section.id ? 'active' : ''}`}
                onClick={() => setAdminSection(section.id)}
              >
                <span>{section.id === 'access' ? '🔐' : section.id === 'streams' ? '🎥' : section.id === 'integrations' ? '🔌' : '📊'}</span>
                {section.label}
              </button>
            ))}
          </nav>
        )}

        <div className="sidebar-status">
          <div className="status-line">
            <span className={apiError ? 'pulse error' : 'pulse'} />
            Состояние API: <b>{apiError ? 'ошибка' : 'онлайн'}</b>
          </div>
          <div>Активные потоки: {streams.length} / {serverStats.maxStreams}</div>
          <div>Engine: OvenMediaEngine</div>
          <div>VPN IP: {serverStats.serverIp}</div>
        </div>
      </aside>

      {viewMode === 'admin' ? (
        <AdminPanel
          activeSection={adminSection}
          setActiveSection={setAdminSection}
          streams={streams}
          apiError={apiError}
          setViewMode={setViewMode}
        />
      ) : (
        <>
          <main className="workspace">
            <header className="topbar">
              <div>
                <h1>{activeDepartmentName}</h1>
                <p>Основной режим просмотра: OvenMediaEngine WebRTC. Список обновляется каждые 2 секунды.</p>
              </div>

              <div className="topbar-card">
                <span className="connection-dot" />
                Активные потоки: <b>{streams.length}</b>
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
                <button onClick={selectAllVisible} disabled={!visibleStreams.length}>Выбрать видимые</button>
                <button className="danger" onClick={clearSelection}>Снять выбор</button>
              </div>
            </section>

            {isLoading ? (
              <LoadingState />
            ) : visibleStreams.length === 0 ? (
              <EmptyBroadcastState error={apiError} />
            ) : (
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
                        <WebRtcPlayer streamId={stream.id} title={stream.name} />
                        <div className="live-badge">● LIVE</div>
                        <div className="latency-badge">OME WebRTC</div>
                      </div>

                      <div className="stream-actions">
                        <button onClick={() => window.open(stream.webrtcUrl || `ws://${serverStats.serverIp}:3333/app/${stream.id}`, '_blank')}>Открыть</button>
                        <button className="secondary" onClick={() => document.documentElement.requestFullscreen?.()}>Во весь экран</button>
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
          </main>

          <aside className="info-panel">
            <section className="user-card">
              <div className="avatar">👤</div>
              <div>
                <div className="muted">Пользователь</div>
                <strong>{serverStats.user}</strong>
              </div>
            </section>

            <section className="metrics-card">
              <h2>Состояние платформы</h2>
              <p>Ключевые компоненты сервера трансляций</p>

              <Metric label="OvenMediaEngine" value="online" hint={`${serverStats.serverIp}:1935 / :3333`} />
              <Metric label="FastAPI Backend" value={apiError ? 'ошибка' : 'online'} hint="127.0.0.1:8000" />
              <Metric label="PostgreSQL" value="online" hint={`${serverStats.serverIp}:5432`} />
              <Metric label="Активные потоки" value={`${streams.length}`} hint="автообнаружение OBS-потоков" />
            </section>

            <section className="metrics-card compact">
              <h2>v0.6 preview</h2>
              <p>Платформа переведена на OvenMediaEngine. Авторизация и права будут назначаться через FreeIPA.</p>
            </section>
          </aside>
        </>
      )}
    </div>
  )
}

function AdminPanel({ activeSection, setActiveSection, streams, apiError, setViewMode }) {
  return (
    <main className="workspace admin-workspace">
      <header className="topbar admin-topbar">
        <div>
          <h1>Панель администратора</h1>
          <p>Управление платформой без локального управления пользователями: аккаунты и права задаются в FreeIPA.</p>
        </div>
        <div className="topbar-card">
          <span className={apiError ? 'pulse error' : 'connection-dot'} />
          Backend: <b>{apiError ? 'ошибка' : 'online'}</b>
        </div>
      </header>

      <section className="admin-tabs">
        {adminSections.map((section) => (
          <button
            key={section.id}
            className={`layout-button ${activeSection === section.id ? 'active' : ''}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </section>

      {activeSection === 'overview' && <AdminOverview streams={streams} setViewMode={setViewMode} />}
      {activeSection === 'access' && <AdminAccess />}
      {activeSection === 'streams' && <AdminStreams streams={streams} />}
      {activeSection === 'integrations' && <AdminIntegrations />}
    </main>
  )
}

function AdminOverview({ streams, setViewMode }) {
  return (
    <section className="admin-grid">
      <AdminCard title="OvenMediaEngine" status="online" text="RTMP ingest, WebRTC playback, LL-HLS reserve." />
      <AdminCard title="Активные потоки" status={`${streams.length} online`} text="Потоки обнаруживаются автоматически по ключам test1–test200." />
      <AdminCard title="FreeIPA" status="planned" text="Источник пользователей, групп и ролей. Локальные аккаунты в панели не создаём." />
      <AdminCard title="Dashboard" status="active" text="Мониторинг камер и администрирование находятся в одном интерфейсе." />
      <div className="admin-wide-card">
        <h2>Быстрые действия</h2>
        <div className="admin-actions">
          <button onClick={() => setViewMode('dashboard')}>Вернуться к камерам</button>
          <button onClick={() => navigator.clipboard?.writeText('rtmp://10.77.77.1:1935/app')}>Скопировать RTMP URL</button>
          <button onClick={() => navigator.clipboard?.writeText('test1')}>Скопировать пример ключа</button>
        </div>
      </div>
    </section>
  )
}

function AdminAccess() {
  return (
    <section className="admin-grid">
      <div className="admin-wide-card">
        <h2>Модель доступа через FreeIPA</h2>
        <p>В этой панели не будет создания пользователей и ручного назначения паролей. Пользователь входит через FreeIPA, а приложение читает его группы и включает нужные разделы.</p>
        <div className="role-table">
          <RoleRow group="video-admins" rights="Полный доступ: Dashboard, настройки, потоки, интеграции." />
          <RoleRow group="video-operators" rights="Просмотр камер, fullscreen, снимки, базовая диагностика." />
          <RoleRow group="video-viewers" rights="Только просмотр разрешённых отделов и камер." />
          <RoleRow group="video-auditors" rights="Журнал событий, просмотры, отчёты без изменения настроек." />
        </div>
      </div>
      <AdminCard title="SSO" status="FreeIPA" text="Позже подключим Kerberos/LDAP/OIDC через nginx или backend." />
      <AdminCard title="Права" status="группы" text="Роли будут строиться от FreeIPA-групп, а не от локальной таблицы users." />
      <AdminCard title="Отделы" status="ACL" text="Доступ к отделам можно связать с группами вида video-dept-1." />
    </section>
  )
}

function AdminStreams({ streams }) {
  return (
    <section className="admin-grid">
      <div className="admin-wide-card">
        <h2>Онлайн-потоки</h2>
        <p>Backend автоматически обнаруживает активные OBS-потоки в OvenMediaEngine.</p>
        <div className="stream-admin-list">
          {streams.length === 0 ? (
            <div className="muted">Сейчас активных потоков нет.</div>
          ) : (
            streams.map((stream) => (
              <div className="stream-admin-row" key={stream.id}>
                <div>
                  <strong>{stream.name}</strong>
                  <small>{stream.departmentName}</small>
                </div>
                <span>WebRTC</span>
                <button onClick={() => navigator.clipboard?.writeText(stream.webrtcUrl)}>Копировать URL</button>
              </div>
            ))
          )}
        </div>
      </div>
      <AdminCard title="Диапазон" status="test1–test200" text="Любой новый ключ OBS из этого диапазона появляется на сайте автоматически." />
      <AdminCard title="RTMP ingest" status="1935/tcp" text="OBS: rtmp://10.77.77.1:1935/app, ключ: testN." />
      <AdminCard title="WebRTC" status="3333/tcp + UDP" text="Основной режим просмотра для минимальной задержки." />
    </section>
  )
}

function AdminIntegrations() {
  return (
    <section className="admin-grid">
      <AdminCard title="FreeIPA" status="next" text="Подключить группы и SSO вместо локальных пользователей." />
      <AdminCard title="Grafana" status="planned" text="Метрики CPU, RAM, сеть, зрители, потоки и задержки." />
      <AdminCard title="Zabbix" status="planned" text="Алерты по падению OME, backend, nginx и PostgreSQL." />
      <AdminCard title="BookStack" status="planned" text="Автогенерация инструкций и шаблонов конфигурации." />
      <div className="admin-wide-card">
        <h2>Следующий технический шаг</h2>
        <p>Подключить backend к FreeIPA и заменить локальную таблицу пользователей на группы: video-admins, video-operators, video-viewers.</p>
      </div>
    </section>
  )
}

function AdminCard({ title, status, text }) {
  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <h2>{title}</h2>
        <span>{status}</span>
      </div>
      <p>{text}</p>
    </div>
  )
}

function RoleRow({ group, rights }) {
  return (
    <div className="role-row">
      <strong>{group}</strong>
      <span>{rights}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <section className="empty-broadcast">
      <div className="empty-icon">⏳</div>
      <h2>Загрузка списка трансляций</h2>
      <p>Проверяем состояние OvenMediaEngine и активных OBS-потоков.</p>
    </section>
  )
}

function EmptyBroadcastState({ error }) {
  return (
    <section className="empty-broadcast">
      <div className="empty-icon">🎥</div>
      <h2>Извините, в данный момент видеотрансляции не ведутся</h2>
      <p>{error ? `Ошибка API: ${error}` : 'Сервер ожидает подключения новых потоков. Как только OBS Studio начнёт трансляцию, видеоканал появится здесь автоматически.'}</p>
      <div className="empty-details">
        <span>Ожидание RTMP-потока</span>
        <b>10.77.77.1:1935/app · test1</b>
      </div>
    </section>
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
