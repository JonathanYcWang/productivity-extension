import React from "react";
import { Settings } from "../types";

interface MasterSwitchSectionProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
}

export function MasterSwitchSection({ settings, onSave }: MasterSwitchSectionProps) {
  return (
    <section>
      <h2>Master switch</h2>
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={e => onSave({ ...settings, enabled: e.target.checked })}
        />
        Enabled
      </label>
    </section>
  );
}

