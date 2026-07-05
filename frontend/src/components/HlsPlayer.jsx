import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

function HlsPlayer({ src, title }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const retryRef = useRef(null)
  const [status, setStatus] = useState('Подключение к видеопотоку...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return undefined

    let closed = false

    const destroy = () => {
      window.clearTimeout(retryRef.current)

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }

    const showVideo = () => {
      if (closed) return
      setReady(true)
      setStatus('')
      video.muted = true
      video.play().catch(() => {})
    }

    const reconnect = () => {
      if (closed) return
      setReady(false)
      setStatus('Ожидание видеопотока...')
      destroy()
      retryRef.current = window.setTimeout(connect, 2000)
    }

    const connect = () => {
      if (closed) return

      destroy()
      setReady(false)
      setStatus('Подключение к видеопотоку...')

      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: false,
          enableWorker: true,
          backBufferLength: 10,
          maxBufferLength: 20,
          fragLoadingTimeOut: 20000,
          manifestLoadingTimeOut: 20000,
        })

        hlsRef.current = hls

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(src)
        })

        hls.on(Hls.Events.MANIFEST_PARSED, showVideo)
        hls.on(Hls.Events.LEVEL_LOADED, showVideo)
        hls.on(Hls.Events.FRAG_LOADED, showVideo)

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (closed || !data?.fatal) return

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
            return
          }

          reconnect()
        })

        hls.attachMedia(video)
        return
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        video.addEventListener('loadedmetadata', showVideo, { once: true })
        video.addEventListener('canplay', showVideo, { once: true })
        video.addEventListener('error', reconnect, { once: true })
        video.play().catch(() => {})
        return
      }

      setStatus('Браузер не поддерживает HLS-воспроизведение')
    }

    connect()

    return () => {
      closed = true
      destroy()
      video.pause()
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

      {!ready && <div className="player-state">{status}</div>}
    </div>
  )
}

export default HlsPlayer
