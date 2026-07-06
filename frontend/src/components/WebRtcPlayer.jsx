import { useEffect, useRef, useState } from 'react'

function waitForIceGatheringComplete(peerConnection) {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const checkState = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        peerConnection.removeEventListener('icegatheringstatechange', checkState)
        resolve()
      }
    }

    peerConnection.addEventListener('icegatheringstatechange', checkState)
  })
}

function WebRtcPlayer({ streamId, title }) {
  const videoRef = useRef(null)
  const peerRef = useRef(null)
  const retryRef = useRef(null)
  const [status, setStatus] = useState('Подключение WebRTC...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamId) return undefined

    let closed = false
    const whepUrl = `/webrtc/${encodeURIComponent(streamId)}/whep`

    const cleanup = () => {
      window.clearTimeout(retryRef.current)

      if (peerRef.current) {
        peerRef.current.close()
        peerRef.current = null
      }

      video.srcObject = null
    }

    const reconnect = (message = 'Переподключение WebRTC...') => {
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
      setStatus('Подключение WebRTC...')

      try {
        const peerConnection = new RTCPeerConnection({
          iceServers: [],
        })

        peerRef.current = peerConnection

        peerConnection.addTransceiver('video', { direction: 'recvonly' })
        peerConnection.addTransceiver('audio', { direction: 'recvonly' })

        peerConnection.ontrack = (event) => {
          if (closed || !event.streams?.[0]) return
          video.srcObject = event.streams[0]
          video.muted = true
          video.play().catch(() => {})
          setReady(true)
          setStatus('')
        }

        peerConnection.onconnectionstatechange = () => {
          if (closed) return

          if (peerConnection.connectionState === 'connected') {
            setReady(true)
            setStatus('')
            return
          }

          if (['failed', 'closed', 'disconnected'].includes(peerConnection.connectionState)) {
            reconnect('WebRTC-соединение потеряно. Переподключение...')
          }
        }

        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        await waitForIceGatheringComplete(peerConnection)

        const response = await fetch(whepUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp',
          },
          body: peerConnection.localDescription.sdp,
        })

        if (!response.ok) {
          throw new Error(`WHEP error ${response.status}`)
        }

        const answer = await response.text()
        await peerConnection.setRemoteDescription({
          type: 'answer',
          sdp: answer,
        })
      } catch (error) {
        reconnect(error?.message ? `WebRTC ошибка: ${error.message}` : 'WebRTC ошибка. Переподключение...')
      }
    }

    connect()

    return () => {
      closed = true
      cleanup()
    }
  }, [streamId])

  return (
    <div className="player-frame">
      <video
        ref={videoRef}
        className="stream-video"
        autoPlay
        muted
        playsInline
        controls
        title={title}
      />

      {!ready && <div className="player-state">{status}</div>}
    </div>
  )
}

export default WebRtcPlayer
