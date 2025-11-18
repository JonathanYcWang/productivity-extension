export type BlockWindow = {
  // 0 = Sunday .. 6 = Saturday
  day: number;
  start: string; // "HH:MM" 24h local time
  end: string;   // "HH:MM"
};

export type Settings = {
  blockedHosts: string[];     // e.g., ["twitter.com", "youtube.com"]
  windows: BlockWindow[];     // one or more daily windows
  enabled: boolean;           // global toggle
  domainDurations?: Record<string, number[]>; // durations in minutes for each domain
  rerollResetMinutes?: number; // minutes until re-rolls reset (default: 60)
  mode?: 'scheduled' | 'focus'; // 'scheduled' for working hours, 'focus' for focus timer
  focusTimeHours?: number;     // hours for focus timer
  focusTimeEnd?: number;       // timestamp when focus time ends (milliseconds)
  focusTimePaused?: number;    // remaining milliseconds when paused (for card timer)
};

export type TemporaryUnblock = {
  domain: string;
  expiresAt: number; // timestamp in milliseconds
};

export const DEFAULT_SETTINGS: Settings = {
  blockedHosts: [
    "tiktok.com",
    "netflix.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "twitter.com",
    "primevideo.com"
  ],
  windows: [
    { day: 1, start: "09:00", end: "17:00" }, // Monday
    { day: 2, start: "09:00", end: "17:00" }, // Tuesday
    { day: 3, start: "09:00", end: "17:00" }, // Wednesday
    { day: 4, start: "09:00", end: "17:00" }, // Thursday
    { day: 5, start: "09:00", end: "17:00" }, // Friday
  ],
  enabled: true,
  domainDurations: {
    "tiktok.com": [10, 15, 20, 25, 30],
    "netflix.com": [10, 15, 20, 25, 30],
    "facebook.com": [10, 15, 20, 25, 30],
    "instagram.com": [10, 15, 20, 25, 30],
    "youtube.com": [10, 15, 20, 25, 30],
    "twitter.com": [10, 15, 20, 25, 30],
    "primevideo.com": [10, 15, 20, 25, 30]
  },
  rerollResetMinutes: 60,
  mode: 'focus',
  focusTimeHours: 2
};
