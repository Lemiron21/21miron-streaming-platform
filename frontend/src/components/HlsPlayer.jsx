import { useEffect, useRef, useState } from 'react'

function HlsPlayer({ src, title }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const retryRef = useRef(null)
  const [statusText, setStatusText] = useState('Подключение к видеопотоку...')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return undefined

    let stopped = false
    let retryCount = 0

    const clearPlayer = () => {
      window.clearTimeout(retryRef.current)

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      video.pause()
      video.removeAttribute('src')
      video.load()
    }

    const markReady = () => {
      if (stopped) return
      setIsReady(true)
      setStatusText('')
      video.muted = true
      video.play().catch(() => {})
    }

    const reconnect = (delay = 1500) => {
      if (stopped) return
      setIsReady(false)
      setStatusText('Переподключение к видеопотоку...')
      window.clearTimeout(retryRef.current)
      retryRef.current = window.setTimeout(() => {
        retryCount += 1
        start()
      }, delay)
    }

    const start = async () => {
      if (stopped) return

      clearPlayer()
      setIsReady(false)
      setStatusText(retryCount > 0 ? 'Переподключение к видеопотоку...' : 'Подключение к видеопотоку...')

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        video.addEventListener('canplay', markReady, { once: true })
        video.play().catch(() => {})
        return
      }

      const { default: Hls } = await import('hls.js')

      if (!Hls.isSupported()) {
        setStatusText('Этот браузер не поддерживает HLS-воспроизведение')
        return
      }

      const hls = new Hls({
        lowLatencyMode: false,
        backBufferLength: 10,
        maxBufferLength: 20,
      })

      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, markReady)
      hls.on(Hls.Events.LEVEL_LOADED, markReady)
      hls.on(Hls.Events.FRAG_LOADED, markReady)

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (stopped) return
        if (!data?.fatal) return

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          reconnect(1500)
          return
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }

        reconnect(2500)
      })
    }

    start().catch(() => reconnect(2000))

    return () => {
      stopped = true
      clearPlayer()
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

      {!isReady && statusText && (
        <div className="player-state">{statusText}</div>
      )}
    </div>
  )
}

export default HlsPlayer
