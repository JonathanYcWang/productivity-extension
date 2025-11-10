import React from "react";
import { Settings } from "../types";

interface BlockedSitesSectionProps {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
}

// Normalize domain for duplicate checking (case-insensitive, remove www)
function normalizeDomainForCheck(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .trim();
}

export function BlockedSitesSection({ settings, onSave }: BlockedSitesSectionProps) {
  const [host, setHost] = React.useState("");

  const addHost = async () => {
    const h = host.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!h) return;
    
    // Normalize the input domain for comparison
    const normalizedInput = normalizeDomainForCheck(h);
    
    // Check for duplicates using normalized comparison
    const isDuplicate = settings.blockedHosts.some(existingHost => 
      normalizeDomainForCheck(existingHost) === normalizedInput
    );
    
    if (isDuplicate) return;
    
    // Automatically add 10 minute duration for new domains
    const newDurations = { ...(settings.domainDurations || {}) };
    if (!newDurations[h]) {
      newDurations[h] = [];
    }
    // Add default duration (10 min) if it doesn't already exist
    if (!newDurations[h].includes(10)) {
      newDurations[h].push(10);
    }
    // Sort durations for better UX
    newDurations[h].sort((a, b) => a - b);
    
    await onSave({ 
      ...settings, 
      blockedHosts: [...settings.blockedHosts, h],
      domainDurations: newDurations
    });
    setHost("");
  };

  const removeHost = async (h: string) => {
    const newDurations = { ...(settings.domainDurations || {}) };
    delete newDurations[h];
    await onSave({
      ...settings,
      blockedHosts: settings.blockedHosts.filter(x => x !== h),
      domainDurations: newDurations
    });
  };

  return (
    <section>
      <h2>Blocked sites</h2>
      <div className="row">
        <input
          placeholder="e.g. twitter.com"
          value={host}
          onChange={e => setHost(e.target.value)}
        />
        <button onClick={addHost}>Add</button>
      </div>
      <ul className="host-list">
        {settings.blockedHosts.map(h => {
          const durations = (settings.domainDurations || {})[h] || [];
          return (
            <li key={h} className="host-item">
              <div className="host-header">
                <span className="host-name">{h}</span>
                <button onClick={() => removeHost(h)}>remove</button>
              </div>
              <div className="durations-section">
                <label className="durations-label">Unblock durations (minutes):</label>
                <div className="durations-list">
                  {durations.map((dur, idx) => (
                    <span key={idx} className="duration-tag">
                      {dur} min
                      <button
                        className="duration-remove"
                        onClick={async () => {
                          const newDurations = { ...(settings.domainDurations || {}) };
                          newDurations[h] = durations.filter((_, i) => i !== idx);
                          if (newDurations[h].length === 0) {
                            delete newDurations[h];
                          }
                          await onSave({ ...settings, domainDurations: newDurations });
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="number"
                    min="1"
                    placeholder="Add duration"
                    className="duration-input"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget;
                        const value = parseInt(input.value);
                        if (value > 0) {
                          const newDurations = { ...(settings.domainDurations || {}) };
                          if (!newDurations[h]) {
                            newDurations[h] = [];
                          }
                          // Check if duration already exists - don't add duplicates
                          if (!newDurations[h].includes(value)) {
                            newDurations[h] = [...newDurations[h], value];
                            // Sort durations for better UX
                            newDurations[h].sort((a, b) => a - b);
                            await onSave({ ...settings, domainDurations: newDurations });
                          }
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

