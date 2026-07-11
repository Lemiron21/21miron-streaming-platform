import { useEffect, useMemo, useState } from 'react'
import WebRtcPlayer from './components/WebRtcPlayer.jsx'
import { departments, serverStats } from './data/mockData.js'

const ROLE_CONFIG = {
  admin: {
    label: 'Администратор',
    group: 'video-admins',
    canView: true,
    canBroadcast: true,
    canAdmin: true,
  },
  operator: {
    label: 'Транслирующий',
    group: 'video-operator',
    canView: false,
    canBroadcast: true,
    canAdmin: false,
  },
  viewer: {
    label: 'Просматривающий',
    group: 'video-viewer',
    canView: true,
    canBroadcast: false,
    canAdmin: false,
  },
}

const CURRENT_USER = {
  login: serverStats.user,
  role: 'admin',
}

const GRID_OPTIONS = [
  { id: 'grid-2', label: '2×2' },
  { id: 'grid-3', label: '3×3' },
  { id: 'grid-4', label: '4×4' },
  { id: 'grid-auto', label: 'Авто' },
]

const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'access', label: 'Доступ' },
  { id: 'transmitters', label: 'Транслирующие' },
  { id: 'viewers', label: 'Просматривающие' },
  { id: 'system', label: 'Система' },
]

function streamProfile(stream, index) {
  const number = Number(String(stream.id).match(/\d+$/)?.[0] ?? index)
  const sources = ['DJI Agras T50', 'DJI Agras T40', 'DJI Mavic 3 Enterprise', 'Камера оператора']

  return {
    operator: `Оператор ${number}`,
    source: sources[(number - 1) % sources.length],
    viewers: Math.max(1, number % 6),
    quality: number % 3 === 0 ? 'Good' : 'Excellent',
    battery: 70 + (number % 24),
  }
}

function fullscreenStream(streamId) {
  const target = document.querySelector(`[data-stream-video="${streamId}"]`)
  target?.requestFullscreen?.()
}

function App() {
  const role = ROLE_CONFIG[CURRENT_USER.role]
  const [viewMode, setViewMode] = useState(role.canView ? 'monitoring' : 'broadcast')
  const [activeDepartment, setActiveDepartment] = useState('all')
  const [gridMode, setGridMode] = useState('grid-2')
  const [selectedStreams, setSelectedStreams] = useState([])
  const [streams, setStreams] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [adminSection, setAdminSection] = useState('overview')

  useEffect(() => {
    let disposed = false

    const loadStreams = async () => {
      try {
        const response = await fetch('/api/streams', { cache: 'no-store' })
        if (!response.ok) throw new Error(`API error: ${response.status}`)
        const data = await response.json()

        if (!disposed) {
          setStreams(Array.isArray(data.streams) ? data.streams : [])
          setApiError(null)
        }
      } catch (error) {
        if (!disposed) {
          setStreams([])
          setApiError(error?.message || 'API unavailable')
        }
      } finally {
        if (!disposed) setIsLoading(false)
      }
    }

    loadStreams()
    const timer = window.setInterval(loadStreams, 2000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  const visibleStreams = useMemo(() => {
    if (activeDepartment === 'all') return streams
    return streams.filter((stream) => stream.departmentId === activeDepartment)
  }, [activeDepartment, streams])

  const activeDepartmentName = departments.find((item) => item.id === activeDepartment)?.name ?? 'Все трансляции'

  const toggleStream = (streamId) => {
    setSelectedStreams((current) => current.includes(streamId)
      ? current.filter((id) => id !== streamId)
      : [...current, streamId])
  }

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeDepartment={activeDepartment}
        setActiveDepartment={setActiveDepartment}
        adminSection={adminSection}
        setAdminSection={setAdminSection}
        streams={streams}
        apiError={apiError}
      />

      {viewMode === 'monitoring' && role.canView && (
        <MonitoringDashboard
          streams={streams}
          visibleStreams={visibleStreams}
          activeDepartmentName={activeDepartmentName}
          gridMode={gridMode}
          setGridMode={setGridMode}
          selectedStreams={selectedStreams}
          toggleStream={toggleStream}
          setSelectedStreams={setSelectedStreams}
          isLoading={isLoading}
          apiError={apiError}
          role={role}
        />
      )}

      {viewMode === 'broadcast' && role.canBroadcast && <BroadcastPanel role={role} />}

      {viewMode === 'admin' && role.canAdmin && (
        <AdminPanel
          section={adminSection}
          setSection={setAdminSection}
          streams={streams}
          apiError={apiError}
          setViewMode={setViewMode}
        />
      )}
    </div>
  )
}

function Sidebar({ role, viewMode, setViewMode, activeDepartment, setActiveDepartment, adminSection, setAdminSection, streams, apiError }) {
  return (
    <aside className="sidebar">
      <div className="brand">21miron</div>

      <nav className="main-nav" aria-label="Основная навигация">
        {role.canView && (
          <NavButton active={viewMode === 'monitoring'} icon="▣" onClick={() => setViewMode('monitoring')}>
            Мониторинг
          </NavButton>
        )}
        {role.canBroadcast && (
          <NavButton active={viewMode === 'broadcast'} icon="◉" onClick={() => setViewMode('broadcast')}>
            Начать трансляцию
          </NavButton>
        )}
        {role.canAdmin && (
          <NavButton active={viewMode === 'admin'} icon="⚙" onClick={() => setViewMode('admin')}>
            Администрирование
          </NavButton>
        )}
      </nav>

      {viewMode === 'monitoring' && role.canView && (
        <nav className="sub-nav" aria-label="Отделы">
          {departments.map((department) => (
            <NavButton
              key={department.id}
              active={activeDepartment === department.id}
              icon={department.id === 'all' ? '●' : '▦'}
              onClick={() => setActiveDepartment(department.id)}
            >
              {department.name}
            </NavButton>
          ))}
        </nav>
      )}

      {viewMode === 'admin' && role.canAdmin && (
        <nav className="sub-nav" aria-label="Разделы администратора">
          {ADMIN_SECTIONS.map((section) => (
            <NavButton
              key={section.id}
              active={adminSection === section.id}
              icon="·"
              onClick={() => setAdminSection(section.id)}
            >
              {section.label}
            </NavButton>
          ))}
        </nav>
      )}

      <div className="sidebar-footer">
        <div className="status-title">
          <StatusDot online={!apiError} />
          API {apiError ? 'недоступен' : 'онлайн'}
        </div>
        <span>{role.label}</span>
        <span>{role.group}</span>
        <span>Активных потоков: {streams.length}</span>
      </div>
    </aside>
  )
}

function NavButton({ active, icon, children, onClick }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{children}</span>
    </button>
  )
}

function MonitoringDashboard({ streams, visibleStreams, activeDepartmentName, gridMode, setGridMode, selectedStreams, toggleStream, setSelectedStreams, isLoading, apiError, role }) {
  const totalViewers = streams.reduce((total, stream, index) => total + streamProfile(stream, index + 1).viewers, 0)

  return (
    <>
      <main className="workspace">
        <header className="page-header">
          <div>
            <span className="eyebrow">Центр трансляций</span>
            <h1>{activeDepartmentName}</h1>
            <p>Активные операторы, дроны, камеры и экранные трансляции.</p>
          </div>
          <ServerBadge online={!apiError} />
        </header>

        <section className="control-row">
          <div className="segmented-control">
            {GRID_OPTIONS.map((option) => (
              <button key={option.id} className={gridMode === option.id ? 'active' : ''} onClick={() => setGridMode(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="compact-actions">
            <button disabled={!visibleStreams.length} onClick={() => setSelectedStreams(visibleStreams.map((stream) => stream.id))}>Выбрать</button>
            <button onClick={() => setSelectedStreams([])}>Сбросить</button>
          </div>
        </section>

        {isLoading ? (
          <EmptyState title="Загрузка трансляций" text="Проверяем активные источники." />
        ) : visibleStreams.length === 0 ? (
          <EmptyState title="Нет активных трансляций" text={apiError ? `Ошибка API: ${apiError}` : 'Новый поток появится автоматически после подключения источника.'} />
        ) : (
          <section className={`stream-grid ${gridMode}`}>
            {visibleStreams.map((stream, index) => {
              const profile = streamProfile(stream, index + 1)
              const selected = selectedStreams.includes(stream.id)

              return (
                <article key={stream.id} className={`stream-card ${selected ? 'selected' : ''}`}>
                  <header className="stream-header">
                    <div>
                      <div className="stream-title-row">
                        <StatusDot online />
                        <h2>{profile.operator}</h2>
                      </div>
                      <span>{profile.source}</span>
                    </div>
                    <input type="checkbox" checked={selected} onChange={() => toggleStream(stream.id)} aria-label={`Выбрать ${profile.operator}`} />
                  </header>

                  <div className="video-shell" data-stream-video={stream.id}>
                    <WebRtcPlayer streamId={stream.id} title={profile.operator} />
                    <span className="live-pill">LIVE</span>
                    <span className="quality-pill">{profile.quality}</span>
                  </div>

                  <div className="stream-facts">
                    <Fact label="Поток" value={stream.id} />
                    <Fact label="Зрители" value={profile.viewers} />
                    <Fact label="Батарея" value={`${profile.battery}%`} />
                    <Fact label="Качество" value="HD" />
                  </div>

                  <footer className="stream-footer">
                    <button className="primary" onClick={() => fullscreenStream(stream.id)}>Открыть</button>
                    <button onClick={() => fullscreenStream(stream.id)}>Во весь экран</button>
                  </footer>
                </article>
              )
            })}
          </section>
        )}
      </main>

      <aside className="right-panel">
        <section className="profile-card">
          <div className="avatar">{CURRENT_USER.login.slice(0, 1).toUpperCase()}</div>
          <div>
            <span>Пользователь</span>
            <strong>{CURRENT_USER.login}</strong>
          </div>
        </section>

        <section className="summary-card">
          <div className="section-heading">
            <span>Оперативная сводка</span>
            <StatusDot online={!apiError} />
          </div>
          <SummaryRow label="Транслирующие" value={streams.length} hint="активные источники" />
          <SummaryRow label="Просматривающие" value={totalViewers} hint="активные пользователи" />
          <SummaryRow label="Сервер" value={apiError ? 'offline' : 'online'} hint="FastAPI · OvenMediaEngine" status />
        </section>

        {role.canAdmin && (
          <section className="admin-health-card">
            <div className="section-heading">Система</div>
            <HealthRow label="Backend" value={apiError ? 'Ошибка' : 'Работает'} online={!apiError} />
            <HealthRow label="Streaming Engine" value="OvenMediaEngine" online />
            <HealthRow label="Авторизация" value="FreeIPA planned" online={false} />
          </section>
        )}
      </aside>
    </>
  )
}

function BroadcastPanel({ role }) {
  const [previewStream, setPreviewStream] = useState(null)
  const [status, setStatus] = useState('Выберите экран или окно для предварительного просмотра.')

  const chooseSource = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      setPreviewStream(mediaStream)
      setStatus('Источник выбран. Публикацию в OvenMediaEngine подключим следующим этапом.')
    } catch (error) {
      setStatus(error?.message || 'Не удалось выбрать источник.')
    }
  }

  return (
    <main className="single-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Режим оператора</span>
          <h1>Начать трансляцию</h1>
          <p>Оператор может только выбрать источник и запустить собственную трансляцию.</p>
        </div>
        <div className="role-badge">{role.group}</div>
      </header>

      <section className="broadcast-layout">
        <div className="broadcast-main-card">
          <div className="broadcast-card-header">
            <div>
              <h2>Источник трансляции</h2>
              <p>Выберите весь экран или отдельное окно приложения.</p>
            </div>
            <button className="primary-button" onClick={chooseSource}>Выбрать источник</button>
          </div>

          <div className="broadcast-preview">
            {previewStream ? <VideoPreview stream={previewStream} /> : <div className="preview-placeholder">{status}</div>}
          </div>
        </div>

        <aside className="broadcast-side-card">
          <h3>Статус</h3>
          <HealthRow label="Источник" value={previewStream ? 'Выбран' : 'Не выбран'} online={Boolean(previewStream)} />
          <HealthRow label="Публикация" value="Не запущена" online={false} />
          <p>{status}</p>
        </aside>
      </section>
    </main>
  )
}

function VideoPreview({ stream }) {
  return <video className="preview-video" autoPlay muted playsInline ref={(video) => { if (video && video.srcObject !== stream) video.srcObject = stream }} />
}

function AdminPanel({ section, setSection, streams, apiError, setViewMode }) {
  return (
    <main className="single-workspace">
      <header className="page-header">
        <div>
          <span className="eyebrow">Управление платформой</span>
          <h1>Администрирование</h1>
          <p>Пользователи и права будут назначаться группами FreeIPA.</p>
        </div>
        <ServerBadge online={!apiError} />
      </header>

      <div className="admin-tabs">
        {ADMIN_SECTIONS.map((item) => (
          <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>{item.label}</button>
        ))}
      </div>

      {section === 'overview' && (
        <section className="admin-grid">
          <AdminCard title="Транслирующие" value={streams.length} text="Активные источники в OvenMediaEngine." />
          <AdminCard title="Просматривающие" value="—" text="Реальные сессии появятся после WebSocket." />
          <AdminCard title="FreeIPA" value="planned" text="video-admins, video-operator, video-viewer." />
          <AdminCard title="Состояние" value={apiError ? 'Ошибка' : 'Онлайн'} text="FastAPI и потоковый сервер." />
          <div className="admin-wide-card">
            <h2>Быстрые действия</h2>
            <div className="compact-actions">
              <button onClick={() => setViewMode('monitoring')}>Открыть мониторинг</button>
              <button onClick={() => setViewMode('broadcast')}>Тест трансляции</button>
              <button onClick={() => navigator.clipboard?.writeText('rtmp://10.77.77.1:1935/app')}>Копировать RTMP URL</button>
            </div>
          </div>
        </section>
      )}

      {section === 'access' && (
        <section className="admin-wide-card">
          <h2>Роли FreeIPA</h2>
          <RoleRow group="video-admins" rights="Мониторинг, администрирование и диагностика." />
          <RoleRow group="video-operator" rights="Только запуск собственной трансляции." />
          <RoleRow group="video-viewer" rights="Только просмотр разрешённых трансляций." />
        </section>
      )}

      {section === 'transmitters' && <StreamList streams={streams} />}

      {section === 'viewers' && (
        <section className="admin-wide-card">
          <h2>Просматривающие</h2>
          <p>После подключения FreeIPA и WebSocket здесь появятся реальные пользователи и открытые ими трансляции.</p>
        </section>
      )}

      {section === 'system' && (
        <section className="admin-grid">
          <AdminCard title="Backend" value={apiError ? 'Ошибка' : 'Онлайн'} text="FastAPI API." />
          <AdminCard title="Streaming Engine" value="OME" text="RTMP ingest и WebRTC playback." />
          <AdminCard title="WebSocket" value="next" text="Заменит polling /streams." />
          <AdminCard title="FreeIPA" value="next" text="Единая авторизация и роли." />
        </section>
      )}
    </main>
  )
}

function StreamList({ streams }) {
  return (
    <section className="admin-wide-card">
      <h2>Транслирующие онлайн</h2>
      <div className="stream-list">
        {streams.length === 0 ? <p>Активных источников нет.</p> : streams.map((stream, index) => {
          const profile = streamProfile(stream, index + 1)
          return (
            <div className="stream-list-row" key={stream.id}>
              <div><strong>{profile.operator}</strong><span>{profile.source}</span></div>
              <code>{stream.id}</code>
              <button onClick={() => navigator.clipboard?.writeText(stream.webrtcUrl)}>Копировать URL</button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function StatusDot({ online }) {
  return <span className={`status-dot ${online ? 'online' : 'offline'}`} />
}

function ServerBadge({ online }) {
  return (
    <div className="server-badge">
      <StatusDot online={online} />
      <span>Сервер</span>
      <strong>{online ? 'online' : 'offline'}</strong>
    </div>
  )
}

function Fact({ label, value }) {
  return <div className="fact"><span>{label}</span><strong>{value}</strong></div>
}

function SummaryRow({ label, value, hint, status }) {
  return (
    <div className="summary-row">
      <div><span>{label}</span><small>{hint}</small></div>
      <strong className={status ? String(value).toLowerCase() : ''}>{value}</strong>
    </div>
  )
}

function HealthRow({ label, value, online }) {
  return (
    <div className="health-row">
      <div><StatusDot online={online} /><span>{label}</span></div>
      <strong>{value}</strong>
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <section className="empty-state">
      <div className="empty-mark">◉</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  )
}

function AdminCard({ title, value, text }) {
  return (
    <article className="admin-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{text}</p>
    </article>
  )
}

function RoleRow({ group, rights }) {
  return <div className="role-row"><code>{group}</code><span>{rights}</span></div>
}

export default App
