import React from "react";
import { DEFAULT_SETTINGS } from "../types";

interface ResetSectionProps {
  onReset: () => Promise<void>;
}

export function ResetSection({ onReset }: ResetSectionProps) {
  const resetToDefaults = async () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      await chrome.storage.sync.remove("settings");
      await onReset();
    }
  };

  return (
    <section>
      <h2>Reset</h2>
      <button onClick={resetToDefaults} className="reset-button">
        Reset to Defaults
      </button>
      <p className="reset-description">
        This will clear all saved settings and restore defaults.
      </p>
    </section>
  );
}

