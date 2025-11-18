import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/common.css";
import { Settings } from "../types";
import { storage, runtime } from "../lib/browser-api";

const STORAGE_KEY = "settings";

function Popup() {
  const [settings, setSettings] = React.useState<Settings | null>(null);

  React.useEffect(() => {
    storage.sync.get(STORAGE_KEY).then(res => {
      setSettings(res[STORAGE_KEY]);
    });
  }, []);

  const toggle = async () => {
    if (!settings) return;
    const next = { ...settings, enabled: !settings.enabled };
    await storage.sync.set({ [STORAGE_KEY]: next });
    setSettings(next);
  };

  if (!settings) return <div className="p">Loading…</div>;

  return (
    <div className="p">
      <h1>Productivity Blocker</h1>
      <p>Status: <b>{settings.enabled ? "On" : "Off"}</b></p>
      <button onClick={toggle}>
        {settings.enabled ? "Pause blocking" : "Resume blocking"}
      </button>
      <p style={{ marginTop: 12 }}>
        Configure sites & times in{" "}
        <a href="#" onClick={() => runtime.openOptionsPage()}>Options</a>.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Popup />);
