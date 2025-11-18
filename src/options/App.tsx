import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/common.css";
import "../styles/Options.css";
import { DEFAULT_SETTINGS, Settings } from "../types";
import { CardGamble } from "../components/CardGamble";
import { BlockedSitesSection } from "../components/BlockedSitesSection";
import { TimeWindowsSection } from "../components/TimeWindowsSection";
import { MasterSwitchSection } from "../components/MasterSwitchSection";
import { ResetSection } from "../components/ResetSection";
import { FocusTimerSection } from "../components/FocusTimerSection";
import { storage, runtime } from "../lib/browser-api";

const STORAGE_KEY = "settings";

function Options() {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [cardGambleResetKey, setCardGambleResetKey] = React.useState(0);

  React.useEffect(() => {
    const loadSettings = async () => {
      const { [STORAGE_KEY]: s } = await storage.sync.get(STORAGE_KEY);
      setSettings({ ...DEFAULT_SETTINGS, ...(s || {}) });
    };
    
    loadSettings();
    
    // Listen for storage changes (e.g., when CardGamble pauses focus timer)
    if (storage.onChanged) {
      const listener = (changes: any, area: string) => {
        if (area === "sync" && changes[STORAGE_KEY]) {
          const newSettings = changes[STORAGE_KEY].newValue;
          if (newSettings) {
            setSettings({ ...DEFAULT_SETTINGS, ...newSettings });
          }
        }
      };
      
      storage.onChanged.addListener(listener);
      return () => {
        if (storage.onChanged && 'removeListener' in storage.onChanged) {
          (storage.onChanged as any).removeListener(listener);
        }
      };
    }
  }, []);

  const save = async (next: Settings) => {
    setSettings(next);
    await storage.sync.set({ [STORAGE_KEY]: next });
  };

  const resetToDefaults = async () => {
    setSettings(DEFAULT_SETTINGS);
    // Trigger CardGamble reset by incrementing the key
    setCardGambleResetKey(prev => prev + 1);
    // Clear all temporary unblocks
    try {
      await runtime.sendMessage({ action: 'clearTemporaryUnblocks' });
    } catch (error) {
      console.error('Error clearing temporary unblocks:', error);
    }
  };

  return (
    <div className="p">
      <FocusTimerSection settings={settings} onSave={save} />
      <h1>Blocker Options</h1>

      {settings.blockedHosts.length > 0 && (
        <section>
          <CardGamble 
            domains={settings.blockedHosts} 
            domainDurations={settings.domainDurations || {}}
            resetKey={cardGambleResetKey}
          />
        </section>
      )}

      <BlockedSitesSection settings={settings} onSave={save} />

      <TimeWindowsSection settings={settings} onSave={save} />

      <MasterSwitchSection settings={settings} onSave={save} />

      <ResetSection onReset={resetToDefaults} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Options />);
