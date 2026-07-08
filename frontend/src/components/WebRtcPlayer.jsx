import { useEffect, useId, useRef, useState } from 'react'

let ovenPlayerLoader = null

function loadOvenPlayer() {
  if (!ovenPlayerLoader) {
    ovenPlayerLoader = import('ovenplayer').then((module) => module.default ?? module)
  }

  return ovenPlayerLoader
}

function getOmeWebRtcUrl(streamId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  return `${protocol}//${host}:3333/app/${encodeURIComponent(streamId)}`
}

function destroyPlayer(player) {
  if (!player) return

  try {
    if (typeof player.remove === 'function') {
      player.remove()
      return
    }

    if (typeof player.destroy === 'function') {
      player.destroy()
      return
    }

    if (typeof player.close === 'function') {
      player.close()
    }
  } catch {
    // ignore cleanup errors
  }
}

function WebRtcPlayer({ streamId, title }) {
  const rawId = useId()
  const playerId = `ome-player-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const playerRef = useRef(null)
  const retryRef = useRef(null)
  const [status, setStatus] = useState('Подключение к OvenMediaEngine...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!streamId) return undefined

    let closed = false

    const cleanup = () => {
      window.clearTimeout(retryRef.current)
      destroyPlayer(playerRef.current)
      playerRef.current = null
    }

    const reconnect = (message = 'Переподключение к видеопотоку...') => {
      if (closed) return
      setReady(false)
      setStatus(message)
      cleanup()
      retryRef.current = window.setTimeout(connect, 2000)
    }

    const connect = async () => {
      if (closed) return

      cleanup()
      setReady(false)
      setStatus('Подключение к OvenMediaEngine...')

      try {
        const playerElement = document.getElementById(playerId)
        if (!playerElement) {
          reconnect('Контейнер плеера ещё не готов. Повторное подключение...')
          return
        }

        const OvenPlayer = await loadOvenPlayer()
        if (closed) return

        const createPlayer = OvenPlayer?.create ?? window.OvenPlayer?.create
        if (typeof createPlayer !== 'function') {
          reconnect('OvenPlayer не загрузился. Повторное подключение...')
          return
        }

        const player = createPlayer(playerId, {
          autoStart: true,
          autoFallback: false,
          mute: true,
          controls: true,
          sources: [
            {
              label: 'WebRTC',
              type: 'webrtc',
              file: getOmeWebRtcUrl(streamId),
            },
          ],
        })

        playerRef.current = player

        player.on('ready', () => {
          if (closed) return
          setReady(true)
          setStatus('')
        })

        player.on('play', () => {
          if (closed) return
          setReady(true)
          setStatus('')
        })

        player.on('stateChanged', (state) => {
          if (closed) return
          if (state?.newstate === 'playing') {
            setReady(true)
            setStatus('')
          }
        })

        player.on('error', (error) => {
          if (closed) return
          const errorText = error?.message || error?.code || 'ошибка воспроизведения'
          reconnect(`OvenMediaEngine: ${errorText}. Переподключение...`)
        })
      } catch (error) {
        reconnect(error?.message ? `OvenPlayer ошибка: ${error.message}` : 'OvenPlayer ошибка. Переподключение...')
      }
    }

    connect()

    return () => {
      closed = true
      cleanup()
    }
  }, [playerId, streamId])

  return (
    <div className="player-frame">
      <div id={playerId} className="stream-video" title={title} />
      {!ready && <div className="player-state">{status}</div>}
    </div>
  )
}

export default WebRtcPlayer
