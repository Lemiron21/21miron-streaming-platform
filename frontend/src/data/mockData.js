export const departments = [
  { id: 'all', name: 'Все трансляции' },
  { id: 'department-1', name: 'Отдел 1' },
  { id: 'department-2', name: 'Отдел 2' },
  { id: 'department-3', name: 'Отдел 3' },
]

export const streams = [
  { id: 1, name: 'Камера 1 — Вход', departmentId: 'department-1', departmentName: 'Отдел 1', status: 'online', latency: 21 },
  { id: 2, name: 'Камера 2 — Офис', departmentId: 'department-1', departmentName: 'Отдел 1', status: 'online', latency: 24 },
  { id: 3, name: 'Камера 3 — Коридор', departmentId: 'department-2', departmentName: 'Отдел 2', status: 'online', latency: 19 },
  { id: 4, name: 'Камера 4 — Склад', departmentId: 'department-2', departmentName: 'Отдел 2', status: 'online', latency: 22 },
  { id: 5, name: 'Камера 5 — КПП', departmentId: 'department-3', departmentName: 'Отдел 3', status: 'offline', latency: null },
  { id: 6, name: 'Камера 6 — Серверная', departmentId: 'department-3', departmentName: 'Отдел 3', status: 'online', latency: 18 },
]

export const serverStats = {
  serverIp: '10.77.77.1',
  user: 'admin',
  avgPing: 21,
  mediamtxRtmpPing: 19,
  hlsPing: 22,
  databasePing: 18,
  activeStreams: 5,
  maxStreams: 100,
  version: '0.1.0',
}
