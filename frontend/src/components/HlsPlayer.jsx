import { useEffect, useRef, useState } from 'react'

function HlsPlayer({ src, title }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const retryRef = useRef(null)
  const [state, setState] = useState('connecting')

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return undefined

    let destroyed = false
    let retryCount = 0

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }

    const scheduleReconnect = (delay = 1500) => {
      if (destroyed) return
      window.clearTimeout(retryRef.current)
      retryRef.current = window.setTimeout(() => {
        retryCount += 1
        connect()
      }, delay)
    }

    const connect = async () => {
      if (destroyed) return

      cleanupHls()
      setState(retryCount > 0 ? 'reconnecting' : 'connecting')

      try {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src
          video.muted = true
          video.play().catch(() => {})
          return
        }

        const { default: Hls } = await import('hls.js')

        if (!Hls.isSupported()) {
          setState('error')
          return
        }

        const hls = new Hls({
          lowLatencyMode: true,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 6,
          backBufferLength: 15,
          maxBufferLength: 10,
          maxLiveSyncPlaybackRate: 1.5,
        })

        hlsRef.current = hls
        hls.attachMedia(video)

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(src)
        })

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (destroyed) return
          setState('ready')
          video.muted = true
          video.play().catch(() => {})
        })

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (destroyed) return

          if (!data?.fatal) return

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad()
            scheduleReconnect(1200)
            return
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
            return
          }

          setState('reconnecting')
          scheduleReconnect(2000)
        })
      } catch (_error) {
        setState('reconnecting')
        scheduleReconnect(2000)
      }
    }

    connect()

    return () => {
      destroyed = true
      window.clearTimeout(retryRef.current)
      cleanupHls()
      video.removeAttribute('src')
      video.load()
    }
  }, [src])

  return (
    <div className="player-frame">
      <video
        ref={videoRef}
        className="stream-video"
        controls
        muted
        playsInline
        autoPlay
        preload="auto"
        title={title}
      />

      {state !== 'ready' && (
        <div className="player-state">
          {state === 'reconnecting' ? 'Переподключение к видеопотоку...' : 'Подключение к видеопотоку...'}
        </div>
      )}
    </div>
  )
}

export default HlsPlayer
