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
  { id: 'transmitters', label: 'Транслирующие' },
  { id: 'viewers', label: 'Просматривающие' },
  { id: 'integrations', label: 'Интеграции' },
]

const roleModel = {
  admin: {
    label: 'Администратор',
    group: 'video-admins',
    canView: true,
    canAdmin: true,
    canBroadcast: true,
  },
  operator: {
    label: 'Транслирующий',
    group: 'video-operator',
    canView: false,
    canAdmin: false,
    canBroadcast: true,
  },
  viewer: {
    label: 'Просматривающий',
    group: 'video-viewer',
    canView: true,
    canAdmin: false,
    canBroadcast: false,
  },
}

const currentUser = {
  login: serverStats.user,
  role: 'admin',
  groups: ['video-admins'],
}

function getOperatorProfile(stream, index) {
  const number = Number(String(stream.id).match(/\d+$/)?.[0] ?? index)
  const drones = ['DJI Agras T50', 'DJI Agras T40', 'DJI Mavic 3 Enterprise', 'DJI Matrice 350 RTK']
  const tasks = ['Полив поля', 'Осмотр посевов', 'Контроль маршрута', 'Подготовка задания']

  return {
    operator: `Оператор ${number}`,
    drone: drones[(number - 1) % drones.length],
    field: `Поле №${number}`,
    task: tasks[(number - 1) % tasks.length],
    battery: 72 + (number % 18),
    viewers: Math.max(1, number % 7),
  }
}

function App() {
  const userRole = roleModel[currentUser.role]
  const initialView = userRole.canView ? 'monitoring' : 'broadcast'
  const [activeDepartment, setActiveDepartment] = useState('all')
  const [gridMode, setGridMode] = useState('grid-2')
  const [selectedStreams, setSelectedStreams] = useState([])
  const [streams, setStreams] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [viewMode, setViewMode] = useState(initialView)
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

  const selectAllVisible = () => setSelectedStreams(visibleStreams.map((stream) => stream.id))
  const clearSelection = () => setSelectedStreams([])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-eyebrow">Аграрная видеоплатформа</div>
          <div className="brand-title">21miron</div>
        </div>

        <nav className="department-nav">
          {userRole.canView && (
            <button className={`department-button ${viewMode === 'monitoring' ? 'active' : ''}`} onClick={() => setViewMode('monitoring')}>
              <span>▣</span>
              Мониторинг работ
            </button>
          )}
          {userRole.canBroadcast && (
            <button className={`department-button ${viewMode === 'broadcast' ? 'active' : ''}`} onClick={() => setViewMode('broadcast')}>
              <span>📡</span>
              Начать трансляцию
            </button>
          )}
          {userRole.canAdmin && (
            <button className={`department-button ${viewMode === 'admin' ? 'active' : ''}`} onClick={() => setViewMode('admin')}>
              <span>⚙</span>
              Администрирование
            </button>
          )}
        </nav>

        {viewMode === 'monitoring' && userRole.canView && (
          <nav className="department-nav secondary-nav">
            {departments.map((department) => (
              <button
                key={department.id}
                className={`department-button ${activeDepartment === department.id ? 'active' : ''}`}
                onClick={() => setActiveDepartment(department.id)}
              >
                <span>{department.id === 'all' ? '●' : '🌾'}</span>
                {department.name}
              </button>
            ))}
          </nav>
        )}

        {viewMode === 'admin' && userRole.canAdmin && (
          <nav className="department-nav secondary-nav">
            {adminSections.map((section) => (
              <button
                key={section.id}
                className={`department-button ${adminSection === section.id ? 'active' : ''}`}
                onClick={() => setAdminSection(section.id)}
              >
                <span>{section.id === 'access' ? '🔐' : section.id === 'transmitters' ? '📡' : section.id === 'viewers' ? '👁' : section.id === 'integrations' ? '🔌' : '📊'}</span>
                {section.label}
              </button>
            ))}
          </nav>
        )}

        <div className="sidebar-status">
          <div className="status-line">
            <span className={apiError ? 'pulse error' : 'pulse'} />
            API: <b>{apiError ? 'ошибка' : 'онлайн'}</b>
          </div>
          <div>Роль: {userRole.label}</div>
          <div>Группа: {userRole.group}</div>
          <div>Транслирующих: {streams.length}</div>
          <div>Engine: OvenMediaEngine</div>
        </div>
      </aside>

      {viewMode === 'broadcast' && <BroadcastPanel userRole={userRole} />}

      {viewMode === 'admin' && userRole.canAdmin && (
        <AdminPanel activeSection={adminSection} setActiveSection={setAdminSection} streams={streams} apiError={apiError} setViewMode={setViewMode} />
      )}

      {viewMode === 'monitoring' && userRole.canView && (
        <MonitoringDashboard
          streams={streams}
          visibleStreams={visibleStreams}
          isLoading={isLoading}
          apiError={apiError}
          gridMode={gridMode}
          setGridMode={setGridMode}
          selectedStreams={selectedStreams}
          toggleStream={toggleStream}
          selectAllVisible={selectAllVisible}
          clearSelection={clearSelection}
          activeDepartmentName={activeDepartmentName}
        />
      )}
    </div>
  )
}

function MonitoringDashboard({ streams, visibleStreams, isLoading, apiError, gridMode, setGridMode, selectedStreams, toggleStream, selectAllVisible, clearSelection, activeDepartmentName }) {
  const totalViewers = streams.reduce((sum, stream, index) => sum + getOperatorProfile(stream, index + 1).viewers, 0)

  return (
    <>
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{activeDepartmentName}</h1>
            <p>Мониторинг транслирующих операторов, дронов, полей и текущих сельхозработ.</p>
          </div>

          <div className="topbar-card">
            <span className="connection-dot" />
            Транслируют: <b>{streams.length}</b>
          </div>
        </header>

        <section className="agro-summary">
          <SummaryCard label="Транслирующие" value={streams.length} hint="операторы онлайн" />
          <SummaryCard label="Просматривающие" value={totalViewers} hint="диспетчеры и руководители" />
          <SummaryCard label="Поля в работе" value={streams.length} hint="активные задания" />
          <SummaryCard label="Режим" value="WebRTC" hint="OvenMediaEngine" />
        </section>

        <section className="toolbar">
          <div className="layout-switcher">
            {gridOptions.map((option) => (
              <button key={option.id} className={`layout-button ${gridMode === option.id ? 'active' : ''}`} onClick={() => setGridMode(option.id)}>
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
            {visibleStreams.map((stream, index) => {
              const selected = selectedStreams.includes(stream.id)
              const profile = getOperatorProfile(stream, index + 1)
              return (
                <article key={stream.id} className={`stream-card ${selected ? 'selected' : ''}`}>
                  <div className="stream-card-header">
                    <div>
                      <h3>🚁 {profile.operator}</h3>
                      <span>{profile.drone} · {profile.field}</span>
                    </div>
                    <input type="checkbox" checked={selected} onChange={() => toggleStream(stream.id)} aria-label={`Выбрать ${profile.operator}`} />
                  </div>

                  <div className="video-placeholder">
                    <WebRtcPlayer streamId={stream.id} title={profile.operator} />
                    <div className="live-badge">● LIVE</div>
                    <div className="latency-badge">{profile.task}</div>
                  </div>

                  <div className="stream-meta-grid">
                    <span>🔋 {profile.battery}%</span>
                    <span>🌾 {profile.field}</span>
                    <span>👁 {profile.viewers}</span>
                    <span>📡 {stream.id}</span>
                  </div>

                  <div className="stream-actions">
                    <button onClick={() => document.querySelector(`[data-stream-card="${stream.id}"]`)?.requestFullscreen?.()}>Открыть</button>
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
          <h2>Работа предприятия</h2>
          <p>Оперативная сводка по дронам и просмотрам</p>
          <Metric label="Транслирующие" value={`${streams.length}`} hint="операторы в поле" />
          <Metric label="Просматривающие" value={`${totalViewers}`} hint="диспетчеры, агрономы, руководство" />
          <Metric label="OvenMediaEngine" value="online" hint={`${serverStats.serverIp}:1935 / :3333`} />
          <Metric label="FreeIPA" value="planned" hint="video-admins / video-operator / video-viewer" />
        </section>
      </aside>
    </>
  )
}

function BroadcastPanel({ userRole }) {
  const [captureStatus, setCaptureStatus] = useState('Готово к выбору источника')
  const [previewStream, setPreviewStream] = useState(null)

  const startPreview = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      setPreviewStream(mediaStream)
      setCaptureStatus('Источник выбран. Следующий этап — публикация WebRTC/WHIP в OvenMediaEngine.')
    } catch (error) {
      setCaptureStatus(error?.message || 'Не удалось выбрать экран или окно')
    }
  }

  return (
    <main className="workspace admin-workspace">
      <header className="topbar">
        <div>
          <h1>Начать трансляцию</h1>
          <p>Этот раздел предназначен только для группы FreeIPA <b>video-operator</b>. Оператор не получает доступ к просмотру чужих трансляций.</p>
        </div>
        <div className="topbar-card">
          Роль: <b>{userRole.label}</b>
        </div>
      </header>

      <section className="admin-grid">
        <div className="admin-wide-card broadcast-card">
          <h2>Трансляция через сайт</h2>
          <p>Сейчас добавлен первый этап: выбор захвата экрана или окна. После этого подключим публикацию в OvenMediaEngine через WebRTC/WHIP или отдельный backend-publisher.</p>
          <div className="admin-actions">
            <button onClick={startPreview}>Выбрать экран или окно</button>
            <button onClick={() => navigator.clipboard?.writeText('video-operator')}>Скопировать группу FreeIPA</button>
          </div>
          <div className="broadcast-preview">
            {previewStream ? <VideoPreview stream={previewStream} /> : <div className="player-state">{captureStatus}</div>}
          </div>
        </div>
        <AdminCard title="Права оператора" status="video-operator" text="Оператор видит только вкладку начала трансляции и не имеет доступа к просмотру." />
        <AdminCard title="Источник" status="Screen Capture" text="Оператор выбирает захват экрана или конкретного окна прямо в браузере." />
        <AdminCard title="Следующий этап" status="WHIP/WebRTC" text="Нужно подключить публикацию браузерного потока в OvenMediaEngine." />
      </section>
    </main>
  )
}

function VideoPreview({ stream }) {
  return <video className="preview-video" autoPlay muted playsInline ref={(video) => { if (video && video.srcObject !== stream) video.srcObject = stream }} />
}

function AdminPanel({ activeSection, setActiveSection, streams, apiError, setViewMode }) {
  return (
    <main className="workspace admin-workspace">
      <header className="topbar admin-topbar">
        <div>
          <h1>Администрирование</h1>
          <p>Пользователи и права назначаются во FreeIPA. Интерфейс только применяет группы и показывает нужные разделы.</p>
        </div>
        <div className="topbar-card">
          <span className={apiError ? 'pulse error' : 'connection-dot'} />
          Backend: <b>{apiError ? 'ошибка' : 'online'}</b>
        </div>
      </header>

      <section className="admin-tabs">
        {adminSections.map((section) => (
          <button key={section.id} className={`layout-button ${activeSection === section.id ? 'active' : ''}`} onClick={() => setActiveSection(section.id)}>
            {section.label}
          </button>
        ))}
      </section>

      {activeSection === 'overview' && <AdminOverview streams={streams} setViewMode={setViewMode} />}
      {activeSection === 'access' && <AdminAccess />}
      {activeSection === 'transmitters' && <AdminTransmitters streams={streams} />}
      {activeSection === 'viewers' && <AdminViewers streams={streams} />}
      {activeSection === 'integrations' && <AdminIntegrations />}
    </main>
  )
}

function AdminOverview({ streams, setViewMode }) {
  return (
    <section className="admin-grid">
      <AdminCard title="Транслирующие" status={`${streams.length} online`} text="Операторы, дроны и экранные трансляции в поле." />
      <AdminCard title="Просматривающие" status="роль viewer" text="Диспетчеры, агрономы и руководство с правом просмотра." />
      <AdminCard title="FreeIPA" status="source of truth" text="Группы video-admins, video-operator и video-viewer управляют доступом." />
      <AdminCard title="Сайт-трансляция" status="этап 1" text="Добавлен интерфейс выбора окна или экрана для оператора." />
      <div className="admin-wide-card">
        <h2>Быстрые действия</h2>
        <div className="admin-actions">
          <button onClick={() => setViewMode('monitoring')}>Открыть мониторинг</button>
          <button onClick={() => setViewMode('broadcast')}>Открыть трансляцию через сайт</button>
          <button onClick={() => navigator.clipboard?.writeText('rtmp://10.77.77.1:1935/app')}>Скопировать RTMP URL для OBS</button>
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
        <p>Локально пользователей не создаём. FreeIPA назначает группу, а приложение показывает только разрешённые разделы.</p>
        <div className="role-table">
          <RoleRow group="video-admins" rights="Администратор: мониторинг, администрирование, интеграции, просмотр, запуск тестовой трансляции." />
          <RoleRow group="video-operator" rights="Транслирующий: только вкладка Начать трансляцию. Просмотр чужих потоков запрещён." />
          <RoleRow group="video-viewer" rights="Просматривающий: только мониторинг и просмотр разрешённых трансляций." />
        </div>
      </div>
      <AdminCard title="Администраторы" status="video-admins" text="Настройки платформы, связка с FreeIPA, потоки, интеграции." />
      <AdminCard title="Транслирующие" status="video-operator" text="Запуск OBS или браузерной трансляции без доступа к просмотру." />
      <AdminCard title="Просматривающие" status="video-viewer" text="Просмотр трансляций дронов и состояния работ." />
    </section>
  )
}

function AdminTransmitters({ streams }) {
  return (
    <section className="admin-grid">
      <div className="admin-wide-card">
        <h2>Транслирующие онлайн</h2>
        <p>Это операторы или дроны, которые сейчас публикуют поток в OvenMediaEngine.</p>
        <div className="stream-admin-list">
          {streams.length === 0 ? <div className="muted">Сейчас активных транслирующих нет.</div> : streams.map((stream, index) => {
            const profile = getOperatorProfile(stream, index + 1)
            return (
              <div className="stream-admin-row" key={stream.id}>
                <div>
                  <strong>{profile.operator}</strong>
                  <small>{profile.drone} · {profile.field} · {profile.task}</small>
                </div>
                <span>{stream.id}</span>
                <button onClick={() => navigator.clipboard?.writeText(stream.webrtcUrl)}>Копировать WebRTC</button>
              </div>
            )
          })}
        </div>
      </div>
      <AdminCard title="OBS" status="работает" text="rtmp://10.77.77.1:1935/app, ключ testN." />
      <AdminCard title="Через сайт" status="следующий этап" text="Браузерный захват экрана/окна с публикацией в OME." />
      <AdminCard title="Поля" status="planned" text="Свяжем поток с полем, дроном и заданием полива." />
    </section>
  )
}

function AdminViewers({ streams }) {
  const totalViewers = streams.reduce((sum, stream, index) => sum + getOperatorProfile(stream, index + 1).viewers, 0)
  return (
    <section className="admin-grid">
      <AdminCard title="Просматривающие" status={`${totalViewers} active`} text="Пока расчет демонстрационный. После FreeIPA и WebSocket будем считать реальные сессии." />
      <AdminCard title="Роль" status="video-viewer" text="Пользователь может только смотреть разрешённые трансляции." />
      <AdminCard title="Операторы" status="no view" text="video-operator не получает доступ к странице мониторинга." />
      <div className="admin-wide-card">
        <h2>Будущая модель просмотра</h2>
        <p>Backend будет хранить, кто смотрит какой поток: диспетчер, агроном, инженер или руководитель. Эти данные отдадим в интерфейс через WebSocket.</p>
      </div>
    </section>
  )
}

function AdminIntegrations() {
  return (
    <section className="admin-grid">
      <AdminCard title="FreeIPA" status="next" text="Подключить группы video-admins, video-operator, video-viewer." />
      <AdminCard title="WebSocket" status="next" text="Заменить polling на живые события: появился поток, пропал поток, подключился зритель." />
      <AdminCard title="OvenMediaEngine" status="active" text="RTMP ingest, WebRTC playback, будущая browser publishing интеграция." />
      <AdminCard title="Grafana/Zabbix" status="planned" text="Мониторинг нагрузки, потоков, зрителей и ошибок." />
    </section>
  )
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
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
      <p>Проверяем состояние OvenMediaEngine и активных операторов.</p>
    </section>
  )
}

function EmptyBroadcastState({ error }) {
  return (
    <section className="empty-broadcast">
      <div className="empty-icon">🚁</div>
      <h2>Сейчас нет активных трансляций</h2>
      <p>{error ? `Ошибка API: ${error}` : 'Когда оператор или дрон начнёт трансляцию, карточка автоматически появится в мониторинге.'}</p>
      <div className="empty-details">
        <span>OBS ingest</span>
        <b>10.77.77.1:1935/app · testN</b>
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
