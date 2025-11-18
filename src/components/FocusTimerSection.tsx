import React from "react";
import { Settings } from "../types";

interface FocusTimerSectionProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
}

export function FocusTimerSection({ settings, onSave }: FocusTimerSectionProps) {
  const [hours, setHours] = React.useState(settings.focusTimeHours || 2);
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(null);
  const isPausedRef = React.useRef(false);

  const mode = settings.mode || 'scheduled';

  // Update hours when settings change
  React.useEffect(() => {
    if (settings.focusTimeHours) {
      setHours(settings.focusTimeHours);
    }
  }, [settings.focusTimeHours]);

  // Calculate time remaining if focus time is active
  React.useEffect(() => {
    let interval: number | null = null;
    
    if (mode === 'focus') {
      // Update ref to track paused state
      isPausedRef.current = !!(settings.focusTimePaused && settings.focusTimePaused > 0);
      
      // Check paused state first - if paused, show static time and don't start interval
      if (settings.focusTimePaused && settings.focusTimePaused > 0) {
        setTimeRemaining(settings.focusTimePaused);
        // No interval when paused - timer is frozen
        return () => {
          if (interval) clearInterval(interval);
        };
      } 
      // If not paused and has end time, start countdown
      else if (settings.focusTimeEnd && !settings.focusTimePaused) {
        const updateTimer = () => {
          // Check ref to see if we're paused (handles async updates)
          if (isPausedRef.current) {
            if (interval) clearInterval(interval);
            return;
          }
          
          const now = Date.now();
          const remaining = Math.max(0, settings.focusTimeEnd! - now);
          setTimeRemaining(remaining);
          
          if (remaining === 0) {
            // Focus time ended, switch back to scheduled mode
            onSave({ ...settings, mode: 'scheduled', focusTimeEnd: undefined });
          }
        };

        updateTimer();
        interval = setInterval(updateTimer, 1000);
        return () => {
          if (interval) clearInterval(interval);
        };
      } else {
        setTimeRemaining(null);
      }
    } else {
      isPausedRef.current = false;
      setTimeRemaining(null);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, settings.focusTimeEnd, settings.focusTimePaused, settings, onSave]);

  const startFocusTime = async () => {
    const now = Date.now();
    const hoursInMs = hours * 60 * 60 * 1000;
    const endTime = now + hoursInMs;
    
    await onSave({
      ...settings,
      mode: 'focus',
      focusTimeHours: hours,
      focusTimeEnd: endTime
    });
  };

  const stopFocusTime = async () => {
    await onSave({
      ...settings,
      mode: 'scheduled',
      focusTimeEnd: undefined
    });
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isFocusTimeActive = mode === 'focus' && (settings.focusTimeEnd || settings.focusTimePaused) && timeRemaining !== null && timeRemaining > 0;
  const isPaused = mode === 'focus' && settings.focusTimePaused && !settings.focusTimeEnd;

  return (
    <section>
      <h2>Focus Timer</h2>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <input
            type="radio"
            name="mode"
            checked={mode === 'focus'}
            onChange={() => onSave({ ...settings, mode: 'focus' })}
          />
          <span>Use Focus Timer</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="radio"
            name="mode"
            checked={mode === 'scheduled'}
            onChange={() => onSave({ ...settings, mode: 'scheduled', focusTimeEnd: undefined })}
          />
          <span>Use Scheduled Working Hours</span>
        </label>
      </div>

      {mode === 'focus' && (
        <div className="card" style={{ gridTemplateColumns: '1fr', padding: '16px' }}>
          {!isFocusTimeActive ? (
            <>
              <label>
                Hours to focus:
                <input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(parseFloat(e.target.value) || 2)}
                  style={{ width: '100px', marginLeft: '8px' }}
                />
              </label>
              <button onClick={startFocusTime} style={{ marginTop: '8px' }}>
                Start Focus Time
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '12px' }}>
                {formatTime(timeRemaining!)}
              </div>
              <div style={{ textAlign: 'center', color: '#666', marginBottom: '12px' }}>
                {isPaused ? (
                  <>Focus time paused - card timer is active</>
                ) : (
                  <>Focus time active - blocked sites are being blocked</>
                )}
              </div>
              {!isPaused && (
                <button onClick={stopFocusTime} style={{ backgroundColor: '#ff4444', color: 'white' }}>
                  Stop Focus Time
                </button>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'scheduled' && (
        <div style={{ padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '8px', color: '#666' }}>
          Focus timer is disabled. Using scheduled working hours instead.
        </div>
      )}
    </section>
  );
}

