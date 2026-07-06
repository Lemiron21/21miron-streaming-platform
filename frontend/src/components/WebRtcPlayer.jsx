function WebRtcPlayer({ streamId, title }) {
  const src = `/webrtc/${encodeURIComponent(streamId)}`

  return (
    <div className="player-frame">
      <iframe
        className="stream-video webrtc-frame"
        src={src}
        title={title}
        allow="autoplay; fullscreen; microphone; camera"
        allowFullScreen
      />
      <div className="player-state webrtc-state">WebRTC</div>
    </div>
  )
}

export default WebRtcPlayer
