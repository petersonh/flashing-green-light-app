import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Power, Settings, Zap, Info, ShieldAlert } from 'lucide-react';

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [flashSpeed, setFlashSpeed] = useState(500); // ms
  const [showSettings, setShowSettings] = useState(false);
  const [isGreen, setIsGreen] = useState(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Wake Lock logic to keep screen on
  const requestWakeLock = async () => {
    setWakeLockError(null);
    
    // 1. Try Native Wake Lock API
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Native Wake Lock is active');
        return;
      } catch (err) {
        const error = err as Error;
        console.warn(`Native Wake Lock failed: ${error.name}, ${error.message}`);
        // If it's a permission policy error, we'll try the video fallback
        if (error.name === 'NotAllowedError') {
          setWakeLockError('Permissions policy blocks native Wake Lock in this view.');
        }
      }
    }

  // 2. Fallback: Canvas Stream Loop
    // This is a reliable hack to keep the screen awake when the Wake Lock API is blocked.
    // We create a tiny canvas, capture its stream, and play it in a hidden video element.
    if (videoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(0,0,0,0)';
          ctx.fillRect(0, 0, 1, 1);
        }
        
        // Capture stream from canvas (supported in most modern browsers)
        const stream = (canvas as any).captureStream ? (canvas as any).captureStream(1) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(1) : null;
        
        if (stream) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log('Canvas stream fallback active');
        } else {
          throw new Error('Stream capture not supported');
        }
      } catch (err) {
        console.error('Wake Lock fallback failed:', err);
        setWakeLockError('Screen wake features are blocked. Try opening in a new tab.');
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    console.log('Wake Lock / Fallback released');
  };

  const toggleSiren = useCallback(() => {
    if (!isActive) {
      setIsActive(true);
      requestWakeLock();
    } else {
      setIsActive(false);
      setIsGreen(false);
      releaseWakeLock();
    }
  }, [isActive]);

  // Flashing interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setIsGreen((prev) => !prev);
      }, flashSpeed);
    }
    return () => clearInterval(interval);
  }, [isActive, flashSpeed]);

  // Handle visibility change to re-request wake lock
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-overflow-hidden">
      {/* Flashing Overlay */}
      <AnimatePresence>
        {isActive && isGreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
            className="fixed inset-0 bg-green-500 z-0"
          />
        )}
      </AnimatePresence>

      {/* Hidden Video for Wake Lock Fallback */}
      <video
        ref={videoRef}
        className="hidden"
        loop
        muted
        playsInline
      />

      {/* Main UI */}
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center justify-between p-8">
        <header className="w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-green-500" size={24} />
            <h1 className="text-lg font-bold tracking-tight uppercase">Siren Flasher</h1>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            id="settings-button"
          >
            <Settings size={20} />
          </button>
        </header>

        <main className="flex flex-col items-center gap-12">
          <div className="relative">
            <motion.div
              animate={isActive ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`w-64 h-64 rounded-full flex items-center justify-center border-4 transition-colors duration-300 ${
                isActive ? 'border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.3)]' : 'border-white/20'
              }`}
            >
              <button
                onClick={toggleSiren}
                className={`w-56 h-56 rounded-full flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
                  isActive 
                    ? 'bg-green-500 text-black scale-95 shadow-inner' 
                    : 'bg-white/5 text-white hover:bg-white/10'
                }`}
                id="power-button"
              >
                <Power size={64} strokeWidth={2.5} />
                <span className="font-black text-xl uppercase tracking-widest">
                  {isActive ? 'Active' : 'Start'}
                </span>
              </button>
            </motion.div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-white/50 uppercase tracking-widest font-medium">
              Volunteer Forest Fire Fighters
            </p>
            {wakeLockError && (
              <p className="text-[10px] text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">
                Wake Lock: {wakeLockError}
              </p>
            )}
            <p className="text-xs text-white/30 italic">
              Keep screen visible for emergency signaling
            </p>
          </div>
        </main>

        <footer className="w-full">
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/90 backdrop-blur-xl p-6 rounded-3xl border border-white/10 space-y-6 mb-8"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Zap size={16} className="text-yellow-500" />
                    Flash Speed
                  </label>
                  <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded">
                    {flashSpeed}ms
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={flashSpeed}
                  onChange={(e) => setFlashSpeed(Number(e.target.value))}
                  className="w-full accent-green-500"
                />
                <div className="flex justify-between text-[10px] text-white/40 uppercase font-bold">
                  <span>Fast</span>
                  <span>Slow</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-start gap-3 text-white/60">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  The Wake Lock API is used to prevent your screen from dimming or locking while the siren is active.
                </p>
              </div>
            </motion.div>
          )}

          <div className="flex justify-center gap-8 text-white/20">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-tighter">PWA Ready</span>
              <div className="w-1 h-1 rounded-full bg-green-500" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-tighter">Wake Lock</span>
              <div className="w-1 h-1 rounded-full bg-green-500" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
