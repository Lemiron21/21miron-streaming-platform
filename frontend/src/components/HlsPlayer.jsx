import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

function HlsPlayer({ src, title }) {
  const videoRef = useRef(null)
  const [state, setState] = useState('connecting')

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return undefined

    let hls
    setState('connecting')

    const onReady = () => setState('ready')
    const onError = () => setState('error')

    if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
      })

      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, onReady)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) {
          setState('error')
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.addEventListener('loadedmetadata', onReady)
      video.addEventListener('error', onError)
    } else {
      setState('error')
    }

    return () => {
      if (hls) hls.destroy()
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('error', onError)
    }
  }, [src])

  return (
    <div className="player-frame">
      <video
        ref={videoRef}
        controls
        muted
        playsInline
        autoPlay
        title={title}
      />

      {state === 'connecting' && (
        <div className="player-state">Подключение к видеопотоку...</div>
      )}

      {state === 'error' && (
        <div className="player-state error">Поток недоступен. Ожидание переподключения...</div>
      )}
    </div>
  )
}

export default HlsPlayer
