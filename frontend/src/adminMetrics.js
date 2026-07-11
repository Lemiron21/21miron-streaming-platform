import './adminMetrics.css'

const METRICS_ENDPOINT = '/api/system/metrics'
const REFRESH_INTERVAL_MS = 3000

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—'
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  let value = Math.max(0, bytes)
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = unitIndex >= 3 ? 1 : 0
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function formatRate(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/с`
}

function formatUptime(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return '—'
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) return `${days} д ${hours} ч`
  if (hours > 0) return `${hours} ч ${minutes} мин`
  return `${minutes} мин`
}

function metricRow(label, value, percent = null) {
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null
  return `
    <div class="server-metric-row">
      <div class="server-metric-heading">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
      ${safePercent === null ? '' : `
        <div class="server-metric-track" aria-hidden="true">
          <span style="width:${safePercent}%"></span>
        </div>
      `}
    </div>
  `
}

function renderMetrics(container, metrics) {
  const memoryText = `${formatBytes(metrics.memoryUsedBytes)} / ${formatBytes(metrics.memoryTotalBytes)}`
  const diskText = `${formatBytes(metrics.diskUsedBytes)} / ${formatBytes(metrics.diskTotalBytes)}`
  const temperature = metrics.temperatureC == null ? '' : ` · ${metrics.temperatureC} °C`
  const load = Array.isArray(metrics.loadAverage) ? metrics.loadAverage.join(' · ') : '—'

  container.innerHTML = `
    <div class="section-heading">Производительность</div>
    ${metricRow('CPU', `${metrics.cpuPercent}%${temperature}`, metrics.cpuPercent)}
    ${metricRow('RAM', `${metrics.memoryPercent}% · ${memoryText}`, metrics.memoryPercent)}
    ${metricRow('Диск', `${metrics.diskPercent}% · ${diskText}`, metrics.diskPercent)}
    <div class="server-metric-pair">
      <div><span>Входящий трафик</span><strong>↓ ${formatRate(metrics.networkDownloadBytesPerSecond)}</strong></div>
      <div><span>Исходящий трафик</span><strong>↑ ${formatRate(metrics.networkUploadBytesPerSecond)}</strong></div>
    </div>
    <div class="server-metric-pair compact">
      <div><span>Uptime</span><strong>${formatUptime(metrics.uptimeSeconds)}</strong></div>
      <div><span>Load average</span><strong>${load}</strong></div>
    </div>
  `
}

function ensurePerformanceCard() {
  const systemCard = document.querySelector('.admin-health-card')
  if (!systemCard) return null

  let card = document.querySelector('[data-admin-performance]')
  if (card) return card

  card = document.createElement('section')
  card.className = 'admin-performance-card'
  card.dataset.adminPerformance = 'true'
  card.innerHTML = '<div class="section-heading">Производительность</div><p class="metrics-loading">Загрузка показателей…</p>'
  systemCard.before(card)
  return card
}

async function refreshMetrics() {
  const card = ensurePerformanceCard()
  if (!card) return

  try {
    const response = await fetch(METRICS_ENDPOINT, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    renderMetrics(card, await response.json())
  } catch (error) {
    card.innerHTML = `
      <div class="section-heading">Производительность</div>
      <p class="metrics-error">Не удалось получить показатели сервера: ${error.message}</p>
    `
  }
}

const observer = new MutationObserver(() => {
  if (ensurePerformanceCard()) refreshMetrics()
})

window.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, { childList: true, subtree: true })
  refreshMetrics()
  window.setInterval(refreshMetrics, REFRESH_INTERVAL_MS)
})
