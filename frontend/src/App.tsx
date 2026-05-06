import { useState } from 'react'
import { useLiveKit } from './hooks/useLiveKit'
import LandingScreen from './components/LandingScreen'
import CallScreen from './components/CallScreen'
import SummaryModal from './components/SummaryModal'

export default function App() {
  const [showSummary, setShowSummary] = useState(false)
  const livekit = useLiveKit()
  const { state, callSummary, connect, disconnect } = livekit

  const handleStart = async () => {
    await connect()
  }

  const handleEnd = () => {
    disconnect()
  }

  const handleNewCall = () => {
    setShowSummary(false)
    disconnect()
  }

  const isInCall = state !== 'idle' && state !== 'connecting'
  const isConnecting = state === 'connecting'

  return (
    <div className="h-full bg-bg dot-grid">
      {/* Ambient gradient */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(20,184,166,0.07) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 h-full">
        {!isInCall && !isConnecting ? (
          <LandingScreen onStart={handleStart} error={livekit.error} />
        ) : (
          <CallScreen
            state={state}
            transcript={livekit.transcript}
            toolEvents={livekit.toolEvents}
            volumeRef={livekit.volumeRef}
            onEnd={handleEnd}
            onShowSummary={() => setShowSummary(true)}
            hasSummary={!!callSummary}
          />
        )}
      </div>

      {showSummary && callSummary && (
        <SummaryModal
          summary={callSummary}
          onClose={() => setShowSummary(false)}
          onNewCall={handleNewCall}
        />
      )}

      {/* Auto-show summary modal when call ends */}
      {state === 'ended' && callSummary && !showSummary && (
        <SummaryModal
          summary={callSummary}
          onClose={() => setShowSummary(false)}
          onNewCall={handleNewCall}
        />
      )}
    </div>
  )
}
