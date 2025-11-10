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

const STORAGE_KEY = "settings";

function Options() {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [cardGambleResetKey, setCardGambleResetKey] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      const { [STORAGE_KEY]: s } = await chrome.storage.sync.get(STORAGE_KEY);
      setSettings({ ...DEFAULT_SETTINGS, ...(s || {}) });
    })();
  }, []);

  const save = async (next: Settings) => {
    setSettings(next);
    await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  };

  const resetToDefaults = async () => {
    setSettings(DEFAULT_SETTINGS);
    // Trigger CardGamble reset by incrementing the key
    setCardGambleResetKey(prev => prev + 1);
    // Clear all temporary unblocks
    try {
      await chrome.runtime.sendMessage({ action: 'clearTemporaryUnblocks' });
    } catch (error) {
      console.error('Error clearing temporary unblocks:', error);
    }
  };

  return (
    <div className="p">
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
