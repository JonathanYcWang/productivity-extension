import React from "react";
import "../styles/CardGamble.css";
import { TemporaryUnblock, Settings } from "../types";
import { storage, runtime } from "../lib/browser-api";

interface CardGambleProps {
  domains: string[];
  domainDurations?: Record<string, number[]>; // durations in minutes for each domain
  resetKey?: number; // When this changes, reset all state
}

interface CardOption {
  type: 'domain' | 'bonusRerolls';
  domain?: string;
  durationMinutes?: number;
  bonusRerolls?: number; // 1, 2, or 3
}

// Extract just the hostname from a domain string
function extractHostname(domain: string): string {
  try {
    // Remove protocol if present
    let hostname = domain.replace(/^https?:\/\//i, '');
    // Remove path, query strings, and fragments
    hostname = hostname.split('/')[0].split('?')[0].split('#')[0];
    // Remove port if present
    hostname = hostname.split(':')[0];
    // Remove www. prefix
    hostname = hostname.replace(/^www\./i, '');
    // Trim whitespace
    hostname = hostname.trim();
    return hostname;
  } catch {
    // If parsing fails, just clean up the string
    return domain
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '')
      .replace(/:.*$/, '')
      .replace(/^www\./i, '')
      .trim();
  }
}

// Generate a random option - domain or bonus reroll card
// Bonus rerolls have 10% chance, domains have 90% chance (distributed equally)
function generateRandomOption(
  domains: string[],
  domainDurations: Record<string, number[]>
): CardOption {
  if (domains.length === 0) {
    // If no domains, return bonus reroll
    return { type: 'bonusRerolls', bonusRerolls: 1 };
  }

  // 10% chance for bonus reroll, 90% chance for domain
  const random = Math.random();
  if (random < 0.1) {
    // Generate a bonus reroll card (always 1 reroll)
    return {
      type: 'bonusRerolls',
      bonusRerolls: 1
    };
  } else {
    // Generate a domain card (90% chance, distributed equally among domains)
    const randomIndex = Math.floor(Math.random() * domains.length);
    const randomDomain = domains[randomIndex];
    const customDurations = domainDurations[randomDomain] || [];
    
    let unblockMinutes: number;
    if (customDurations.length > 0) {
      const durationIndex = Math.floor(Math.random() * customDurations.length);
      unblockMinutes = customDurations[durationIndex];
    } else {
      // Default: random duration between 5 minutes and 2 hours
      const minMinutes = 5;
      const maxMinutes = 120;
      unblockMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    }

    return {
      type: 'domain',
      domain: randomDomain,
      durationMinutes: unblockMinutes
    };
  }
}

const REROLL_STATE_KEY = "cardGambleRerollState";

interface RerollState {
  availableRerolls: number; // Track available rerolls directly (can exceed initial)
  rerollResetTime: number | null;
  rerollResetTimePaused: number | null; // Remaining time when paused
  lastCardGeneration: number; // timestamp when cards were last generated
  cards: CardOption[]; // Current cards displayed
  selectedCard: number | null; // Which card is selected
  cardsLocked: boolean; // Whether cards are locked
  showCards: boolean; // Whether cards are showing
  animationKey: number; // Animation key for card animations
  selectedCardExpiresAt: number | null; // When the selected domain card expires
}

const MIN_REROLL_RESET_MINUTES = 30;
const MAX_REROLL_RESET_MINUTES = 60;
const INITIAL_REROLLS = 3; // Starting number of rerolls

// Generate random reset time between MIN and MAX minutes
function generateRandomResetTime(): number {
  const minutes = Math.floor(Math.random() * (MAX_REROLL_RESET_MINUTES - MIN_REROLL_RESET_MINUTES + 1)) + MIN_REROLL_RESET_MINUTES;
  return Date.now() + (minutes * 60 * 1000);
}

export function CardGamble({ domains, domainDurations = {}, resetKey }: CardGambleProps) {
  const [cards, setCards] = React.useState<CardOption[]>([]);
  const [showCards, setShowCards] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const [animationKey, setAnimationKey] = React.useState(0);
  const [availableRerolls, setAvailableRerolls] = React.useState(INITIAL_REROLLS);
  const [rerollResetTime, setRerollResetTime] = React.useState<number | null>(null);
  const [rerollResetTimePaused, setRerollResetTimePaused] = React.useState<number | null>(null); // Remaining time when paused
  const [timeRemaining, setTimeRemaining] = React.useState<number>(0);
  const [isLoadingState, setIsLoadingState] = React.useState(true);
  const [cardsLocked, setCardsLocked] = React.useState(false);
  const [selectedCardExpiresAt, setSelectedCardExpiresAt] = React.useState<number | null>(null);
  const [unblockTimeRemaining, setUnblockTimeRemaining] = React.useState<number>(0);
  const [canceledCardIndex, setCanceledCardIndex] = React.useState<number | null>(null);
  const [cardAnimationKeys, setCardAnimationKeys] = React.useState<number[]>([0, 0, 0]); // Per-card animation keys
  const [isFocusTimeActive, setIsFocusTimeActive] = React.useState(false);

  // Check focus time status
  React.useEffect(() => {
    const checkFocusTime = async () => {
      try {
        const { settings } = await storage.sync.get('settings');
        if (settings) {
          const mode = settings.mode || 'scheduled';
          // Focus time is active if mode is 'focus' and either:
          // - focusTimeEnd is set (timer is running)
          // - focusTimePaused is set (timer is paused but was active)
          const isActive = mode === 'focus' && 
            (settings.focusTimeEnd || (settings.focusTimePaused && settings.focusTimePaused > 0));
          setIsFocusTimeActive(isActive);
        }
      } catch (error) {
        console.error('Error checking focus time:', error);
      }
    };
    
    checkFocusTime();
    
    // Listen for storage changes to detect focus time start
    if (storage.onChanged) {
      const listener = (changes: any, area: string) => {
        if (area === "sync" && changes.settings) {
          const newSettings = changes.settings.newValue;
          if (newSettings) {
            const mode = newSettings.mode || 'scheduled';
            // Focus time is active if mode is 'focus' and either:
            // - focusTimeEnd is set (timer is running)
            // - focusTimePaused is set (timer is paused but was active)
            const isActive = mode === 'focus' && 
              (newSettings.focusTimeEnd || (newSettings.focusTimePaused && newSettings.focusTimePaused > 0));
            setIsFocusTimeActive(isActive);
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

  // Load persisted reroll state
  React.useEffect(() => {
    const loadRerollState = async () => {
      try {
        const { [REROLL_STATE_KEY]: state } = await storage.local.get(REROLL_STATE_KEY);
        if (state) {
          const rerollState: RerollState = state;
          const now = Date.now();
          
          // Check if timer has expired
          if (rerollState.rerollResetTime && rerollState.rerollResetTime <= now) {
            // Timer expired, reset rerolls
            setAvailableRerolls(INITIAL_REROLLS);
            setRerollResetTime(null);
            setCardsLocked(false); // Unlock cards
            setSelectedCard(null); // Clear selection
            await storage.local.remove(REROLL_STATE_KEY);
            // Cards will be regenerated by the initialization effect
          } else {
            // Load persisted state
            setAvailableRerolls(rerollState.availableRerolls ?? INITIAL_REROLLS);
            setRerollResetTime(rerollState.rerollResetTime);
            setRerollResetTimePaused(rerollState.rerollResetTimePaused ?? null);
            
            // Load card state if it exists
            if (rerollState.cards && rerollState.cards.length > 0) {
              setCards(rerollState.cards);
              setSelectedCard(rerollState.selectedCard ?? null);
              setCardsLocked(rerollState.cardsLocked ?? false);
              setShowCards(rerollState.showCards ?? true);
              setAnimationKey(rerollState.animationKey ?? 0);
              
              // Try to restore expiration time from persisted state or active unblocks
              if (rerollState.selectedCardExpiresAt) {
                setSelectedCardExpiresAt(rerollState.selectedCardExpiresAt);
              } else if (rerollState.selectedCard !== null && rerollState.selectedCard !== undefined) {
                // If we have a selected card but no expiration time, try to get it from active unblocks
                const selectedCardData = rerollState.cards[rerollState.selectedCard];
                if (selectedCardData && selectedCardData.type === 'domain' && selectedCardData.domain) {
                  try {
                    const response = await runtime.sendMessage({ action: 'getActiveUnblocks' });
                    if (response && response.success && response.unblocks) {
                      const normalizedDomain = extractHostname(selectedCardData.domain).toLowerCase();
                      const matchingUnblock = response.unblocks.find((u: TemporaryUnblock) => 
                        extractHostname(u.domain).toLowerCase() === normalizedDomain
                      );
                      if (matchingUnblock) {
                        setSelectedCardExpiresAt(matchingUnblock.expiresAt);
                      }
                    }
                  } catch (error) {
                    console.error('Error fetching active unblocks on load:', error);
                  }
                }
              }
            }
            
            // If timer is running, cards should be locked
            // (a card was selected and we're waiting for timer to reset)
            if (rerollState.rerollResetTime && rerollState.rerollResetTime > now) {
              setCardsLocked(true);
            }
            
            // If timer is still active, notify background script
            if (rerollState.rerollResetTime && rerollState.rerollResetTime > now) {
              try {
                runtime.sendMessage({
                  action: 'scheduleRerollReset',
                  resetTime: rerollState.rerollResetTime
                });
              } catch (error) {
                console.error('Error scheduling reroll reset:', error);
              }
            }
          }
        } else {
          // No persisted state - check if focus time is active before initializing timer
          const checkAndInitialize = async () => {
            try {
              const { settings } = await storage.sync.get('settings');
              const mode = settings?.mode || 'scheduled';
              // Focus time is active if mode is 'focus' and either:
              // - focusTimeEnd is set (timer is running)
              // - focusTimePaused is set (timer is paused but was active)
              const focusActive = mode === 'focus' && 
                (settings?.focusTimeEnd || (settings?.focusTimePaused && settings.focusTimePaused > 0));
              
              if (focusActive) {
                // Focus time is active - start timer
                const initialResetTime = generateRandomResetTime();
                setRerollResetTime(initialResetTime);
                setAvailableRerolls(INITIAL_REROLLS);
                setCardsLocked(true); // Lock cards until timer expires
                setShowCards(false); // Don't show cards initially
                
                // Notify background script to schedule the alarm
                try {
                  await runtime.sendMessage({
                    action: 'scheduleRerollReset',
                    resetTime: initialResetTime
                  });
                } catch (error) {
                  console.error('Error scheduling initial reroll reset:', error);
                }
              } else {
                // Focus time not active - keep cards locked, no timer
                setAvailableRerolls(INITIAL_REROLLS);
                setCardsLocked(true);
                setShowCards(false);
                setRerollResetTime(null);
              }
            } catch (error) {
              console.error('Error checking focus time for initialization:', error);
            }
          };
          
          checkAndInitialize();
        }
      } catch (error) {
        console.error('Error loading reroll state:', error);
      } finally {
        setIsLoadingState(false);
      }
    };
    
    loadRerollState();
  }, []);

  // Save reroll state whenever it changes
  React.useEffect(() => {
    if (isLoadingState) return; // Don't save during initial load
    
    const saveRerollState = async () => {
      try {
        const state: RerollState = {
          availableRerolls,
          rerollResetTime,
          rerollResetTimePaused,
          lastCardGeneration: Date.now(),
          cards,
          selectedCard,
          cardsLocked,
          showCards,
          animationKey,
          selectedCardExpiresAt
        };
        await storage.local.set({ [REROLL_STATE_KEY]: state });
      } catch (error) {
        console.error('Error saving reroll state:', error);
      }
    };
    
    saveRerollState();
  }, [availableRerolls, rerollResetTime, rerollResetTimePaused, cards, selectedCard, cardsLocked, showCards, animationKey, selectedCardExpiresAt, isLoadingState]);

  // Reset all state when resetKey changes
  React.useEffect(() => {
    if (resetKey === undefined) return; // Don't reset on initial mount
    
    const resetAll = async () => {
      // Reset all state
      setAvailableRerolls(INITIAL_REROLLS);
      setRerollResetTime(null);
      setCardsLocked(false);
      setSelectedCard(null);
      setTimeRemaining(0);
      setSelectedCardExpiresAt(null);
      setCanceledCardIndex(null);
      setRerollResetTimePaused(null);
      
      // Clear persisted state
      await storage.local.remove(REROLL_STATE_KEY);
      
      // Cancel any scheduled alarms
      try {
        runtime.sendMessage({
          action: 'cancelRerollReset'
        });
      } catch (error) {
        console.error('Error canceling reroll reset:', error);
      }
      
      // Regenerate cards
      if (domains.length > 0) {
        const newCards = Array.from({ length: 3 }, () => 
          generateRandomOption(domains, domainDurations)
        );
        setCards(newCards);
        setCardAnimationKeys([0, 0, 0]); // Reset per-card animation keys
        setAnimationKey(prev => prev + 1);
        setShowCards(false);
        setTimeout(() => {
          setShowCards(true);
        }, 50);
      }
    };
    
    resetAll();
  }, [resetKey]); // Only reset when resetKey changes, not when domains change

  // Note: Cards are now generated in the timer countdown effect when timer expires
  // This effect is kept for backward compatibility but cards should be generated by timer expiration

  // Start timer when focus time becomes active (only on initial start)
  // Timer also starts when card expires/cancels (handled by resumeRerollTimer)
  React.useEffect(() => {
    if (isFocusTimeActive && !rerollResetTime && !selectedCardExpiresAt && !isLoadingState) {
      // Start timer on initial focus time start
      // Only skip if timer just expired (cards exist and are unlocked - waiting for selection)
      // Check if cards exist and are unlocked - clear sign timer just expired
      const timerJustExpired = !cardsLocked && cards.length > 0;
      if (!timerJustExpired) {
        // Focus time just started - start the initial timer
        const initialResetTime = generateRandomResetTime();
        setRerollResetTime(initialResetTime);
        setCardsLocked(true); // Lock cards until timer expires
        setShowCards(false);
        setCards([]); // Clear any existing cards
        setAvailableRerolls(INITIAL_REROLLS);
        
        // Notify background script to schedule the alarm
        runtime.sendMessage({
          action: 'scheduleRerollReset',
          resetTime: initialResetTime
        }).catch(error => {
          console.error('Error scheduling reroll reset:', error);
        });
      }
      // If cards exist and are unlocked (timer just expired), don't start timer - wait for selection
    } else if (!isFocusTimeActive) {
      // Focus time stopped - clear timer and lock cards
      if (rerollResetTime && !selectedCardExpiresAt) {
        setRerollResetTime(null);
        setRerollResetTimePaused(null);
        
        // Cancel the scheduled alarm
        runtime.sendMessage({
          action: 'cancelRerollReset'
        }).catch(error => {
          console.error('Error canceling reroll reset:', error);
        });
      }
      // Always lock cards and clear them when focus time is not active (unless a card is selected)
      if (selectedCard === null) {
        setCardsLocked(true);
        setShowCards(false);
        setCards([]);
        setTimeRemaining(0);
      }
    }
  }, [isFocusTimeActive, rerollResetTime, selectedCardExpiresAt, isLoadingState, cardsLocked, cards.length, selectedCard]);

  // Timer countdown effect
  React.useEffect(() => {
    // Don't run timer if focus time is not active
    if (!isFocusTimeActive) {
      setTimeRemaining(0);
      // Keep cards locked if focus time is not active
      if (!rerollResetTime) {
        setCardsLocked(true);
      }
      return;
    }
    
    // If a card is selected and timer is active, pause the re-roll timer
    if (selectedCardExpiresAt && selectedCard !== null) {
      // Timer is paused - don't show timer while card is active
      setTimeRemaining(0);
      return; // Don't run countdown while card timer is active
    }

    // If no timer is running and cards are unlocked, stop the timer display
    if (!rerollResetTime) {
      setTimeRemaining(0);
      // Only lock cards if they're not already unlocked (i.e., waiting for initial timer to start)
      // Don't lock cards if timer expired and cards should be selectable
      if (cardsLocked && cards.length === 0) {
        // Waiting for initial timer to start
        setCardsLocked(true);
      }
      return;
    }

    // Timer is active - keep cards locked while timer is running
    setCardsLocked(true);

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, rerollResetTime - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Timer expired - unlock cards and generate them, stop the timer
        setAvailableRerolls(INITIAL_REROLLS);
        setRerollResetTime(null);
        setRerollResetTimePaused(null);
        setTimeRemaining(0); // Explicitly set to 0 to stop timer display
        setCardsLocked(false); // Unlock cards when timer expires
        setSelectedCard(null); // Clear selection - reset all cards
        setSelectedCardExpiresAt(null);
        setCanceledCardIndex(null);
        
        // Pause focus timer when cards become selectable
        const pauseFocusTimerForCardSelection = async () => {
          try {
            const { settings } = await storage.sync.get('settings');
            if (settings && settings.mode === 'focus' && settings.focusTimeEnd) {
              const now = Date.now();
              const remaining = Math.max(0, settings.focusTimeEnd - now);
              if (remaining > 0) {
                // Pause focus timer by storing remaining time
                await storage.sync.set({
                  settings: {
                    ...settings,
                    focusTimePaused: remaining,
                    focusTimeEnd: undefined // Clear end time to pause
                  }
                });
              }
            }
          } catch (error) {
            console.error('Error pausing focus timer for card selection:', error);
          }
        };
        pauseFocusTimerForCardSelection();
        
        // Switch to options page when cards become selectable
        runtime.openOptionsPage().catch(error => {
          console.error('Error opening options page:', error);
        });
        
        // Generate cards for new round (or initial cards if none exist)
        if (domains.length > 0) {
          const newCards = Array.from({ length: 3 }, () => 
            generateRandomOption(domains, domainDurations)
          );
          setCards(newCards);
          setCardAnimationKeys([0, 0, 0]); // Reset per-card animation keys
          setAnimationKey(prev => prev + 1);
          setShowCards(false);
          setTimeout(() => {
            setShowCards(true);
          }, 50);
        }
        // Clear persisted state
        storage.local.remove(REROLL_STATE_KEY).catch(console.error);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isFocusTimeActive, rerollResetTime, rerollResetTimePaused, selectedCardExpiresAt, selectedCard, availableRerolls, domains, domainDurations, cardsLocked, cards.length]);

  const rerollCard = (cardIndex: number) => {
    // Check if user has any available rerolls
    if (availableRerolls <= 0) return;

    // Trigger animation by incrementing the animation key for this specific card
    setCardAnimationKeys(prev => {
      const newKeys = [...prev];
      newKeys[cardIndex] = (newKeys[cardIndex] || 0) + 1;
      return newKeys;
    });

    // Small delay to allow animation to start, then update the card
    setTimeout(() => {
      setCards(prevCards => {
        const newCards = [...prevCards];
        newCards[cardIndex] = generateRandomOption(domains, domainDurations);
        return newCards;
      });
    }, 50);

    setAvailableRerolls(prev => prev - 1);
    // Timer is started when a card is selected, not when rerolls are used
  };

  const selectCard = async (cardIndex: number) => {
    if (selectedCard !== null || cardsLocked) return; // Already selected or cards are locked
    
    const card = cards[cardIndex];
    if (!card) return;

    if (card.type === 'bonusRerolls' && card.bonusRerolls) {
      // Bonus reroll card - add rerolls to the pool and replace this card
      setAvailableRerolls(prev => prev + card.bonusRerolls!);
      
      // Replace only this card with a new random card, keep others unchanged
      setCards(prevCards => {
        const newCards = [...prevCards];
        newCards[cardIndex] = generateRandomOption(domains, domainDurations);
        return newCards;
      });
      
      // Don't lock cards or start timer for bonus reroll cards
      return;
    }
    
    // For domain cards, lock cards, reset rerolls, and pause/clear any existing timer
    setSelectedCard(cardIndex);
    setCardsLocked(true); // Lock all cards after selection
    setAvailableRerolls(0); // Lose all rerolls when a domain card is selected
    
    // Pause re-roll timer if it's running - don't start a new one
    // Timer will only start after the selected card's timer finishes
    if (rerollResetTime) {
      const now = Date.now();
      const remaining = Math.max(0, rerollResetTime - now);
      if (remaining > 0) {
        setRerollResetTimePaused(remaining);
        setRerollResetTime(null); // Clear active timer to pause it
        
        // Cancel the scheduled alarm
        try {
          await runtime.sendMessage({
            action: 'cancelRerollReset'
          });
        } catch (error) {
          console.error('Error canceling reroll reset:', error);
        }
      }
    } else {
      // Clear any paused timer - timer will start fresh after card expires
      setRerollResetTimePaused(null);
    }
    
    if (card.type === 'domain' && card.domain && card.durationMinutes) {
      // Domain card - unblock the domain
      const expiresAt = Date.now() + (card.durationMinutes * 60 * 1000);
      setSelectedCardExpiresAt(expiresAt);
      
      // Pause focus timer if it's active
      try {
        const { settings } = await storage.sync.get('settings');
        if (settings && settings.mode === 'focus' && settings.focusTimeEnd) {
          const now = Date.now();
          const remaining = Math.max(0, settings.focusTimeEnd - now);
          if (remaining > 0) {
            // Pause focus timer by storing remaining time
            await storage.sync.set({
              settings: {
                ...settings,
                focusTimePaused: remaining,
                focusTimeEnd: undefined // Clear end time to pause
              }
            });
          }
        }
      } catch (error) {
        console.error('Error pausing focus timer:', error);
      }
      
      // Send message to background script to temporarily unblock this domain
      try {
        await runtime.sendMessage({
          action: 'temporaryUnblock',
          domain: card.domain,
          expiresAt: expiresAt,
          durationMinutes: card.durationMinutes
        });
        
        // Timer and cards remain locked until timer resets - don't clear selectedCard or cardsLocked
      } catch (error) {
        console.error('Error sending unblock message:', error);
      }
    }
  };

  // Update unblock countdown for selected card
  React.useEffect(() => {
    if (!selectedCardExpiresAt) {
      setUnblockTimeRemaining(0);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, selectedCardExpiresAt - now);
      setUnblockTimeRemaining(remaining);
      
      // If expired, automatically disable the card
      if (remaining === 0 && selectedCard !== null) {
        const canceledIndex = selectedCard;
        setCanceledCardIndex(canceledIndex);
        setSelectedCard(null);
        setSelectedCardExpiresAt(null);
        
        // Resume focus timer if it was paused
        resumeFocusTimer();
        // Start new next selection timer (this will lock cards, clear them, and start countdown)
        resumeRerollTimer();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [selectedCardExpiresAt, selectedCard]);

  // Format time remaining as MM:SS
  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format unblock time remaining in a readable format
  const formatUnblockCountdown = (ms: number): string => {
    if (ms <= 0) return 'Expired';
    
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Resume focus timer if it was paused
  const resumeFocusTimer = async () => {
    try {
      const { settings } = await storage.sync.get('settings');
      if (settings && settings.mode === 'focus' && settings.focusTimePaused) {
        const now = Date.now();
        const newEndTime = now + settings.focusTimePaused;
        await storage.sync.set({
          settings: {
            ...settings,
            focusTimeEnd: newEndTime,
            focusTimePaused: undefined // Clear paused state
          }
        });
      }
    } catch (error) {
      console.error('Error resuming focus timer:', error);
    }
  };

  // Resume re-roll timer if it was paused, or start a new one if no timer was paused
  // This locks cards, clears them, and starts the next selection timer
  const resumeRerollTimer = () => {
    // Lock cards and clear them - new timer is starting
    setCardsLocked(true);
    setShowCards(false);
    setCards([]);
    setAvailableRerolls(INITIAL_REROLLS);
    setCanceledCardIndex(null);
    
    if (rerollResetTimePaused !== null && rerollResetTimePaused > 0) {
      // Resume the paused timer
      const now = Date.now();
      const newResetTime = now + rerollResetTimePaused;
      setRerollResetTime(newResetTime);
      setRerollResetTimePaused(null);
      
      // Notify background script to schedule the alarm
      runtime.sendMessage({
        action: 'scheduleRerollReset',
        resetTime: newResetTime
      }).catch(error => {
        console.error('Error scheduling reroll reset:', error);
      });
    } else {
      // No paused timer - start a new one after card expires
      const newResetTime = generateRandomResetTime();
      setRerollResetTime(newResetTime);
      setRerollResetTimePaused(null);
      
      // Notify background script to schedule the alarm
      runtime.sendMessage({
        action: 'scheduleRerollReset',
        resetTime: newResetTime
      }).catch(error => {
        console.error('Error scheduling reroll reset:', error);
      });
    }
  };

  // Handle canceling the selected card's unblock
  const handleCancelUnblock = async () => {
    if (selectedCard === null) return;
    
    const card = cards[selectedCard];
    if (!card || card.type !== 'domain' || !card.domain) return;

    try {
      // Cancel the temporary unblock
      await runtime.sendMessage({ 
        action: 'cancelTemporaryUnblock', 
        domain: card.domain 
      });
      
      // Set timer to zero immediately
      setUnblockTimeRemaining(0);
      
      // Change card from selected to disabled state
      const canceledIndex = selectedCard;
      setCanceledCardIndex(canceledIndex);
      setSelectedCard(null);
      setSelectedCardExpiresAt(null);
      
      // Resume focus timer if it was paused
      resumeFocusTimer();
      // Start new next selection timer (this will lock cards, clear them, and start countdown)
      resumeRerollTimer();
    } catch (error) {
      console.error('Error canceling unblock:', error);
    }
  };


  if (domains.length === 0) return null;

  const canReroll = availableRerolls > 0;

  return (
    <div className="card-gamble-container">
      <h2>Gamble for Unblock Time</h2>
      <p className="card-gamble-description">
        Three cards will drop down. Each card can show either a domain with unblock duration or 
        bonus re-roll. Bonus re-roll cards have a 10% chance to appear. 
        You start with {INITIAL_REROLLS} re-roll{INITIAL_REROLLS > 1 ? 's' : ''} and can earn more by selecting bonus re-roll cards. Then select one card.
      </p>
      
      <div className="reroll-counter-container">
        {availableRerolls > 0 && !cardsLocked && (
          <div className="reroll-counter">
            <span className="reroll-counter-label">Re-roll{availableRerolls !== 1 ? 's' : ''} available:</span>
            <span className="reroll-counter-value">{availableRerolls}</span>
          </div>
        )}
        {(timeRemaining > 0 && (cardsLocked || cards.length === 0)) && (
          <div className="reroll-timer">
            Next selection in: <span className="timer-value">{formatTimeRemaining(timeRemaining)}</span>
          </div>
        )}
      </div>

      <div className={`cards-wrapper ${(cardsLocked && selectedCard === null) || !isFocusTimeActive ? 'disabled' : ''} ${cards.length > 0 ? 'has-cards' : ''} ${selectedCard !== null ? 'card-selected' : ''}`}>
        {cards.length === 0 && cardsLocked && !isFocusTimeActive && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666', width: '100%' }}>
            <p>No selection available</p>
            <p>Start focus time to begin</p>
          </div>
        )}
        {/* Only show "No selection available" when next selection timer is running (no card selected) */}
        {cards.length === 0 && cardsLocked && isFocusTimeActive && timeRemaining > 0 && selectedCard === null && !selectedCardExpiresAt && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666', width: '100%' }}>
            <p>No selection available</p>
            <p>Next selection in: <strong>{formatTimeRemaining(timeRemaining)}</strong></p>
          </div>
        )}
        {cards.map((card, index) => (
          <div key={`card-wrapper-${animationKey}-${index}`} className="card-wrapper">
            <div
              key={`${animationKey}-${index}-${cardAnimationKeys[index] || 0}`}
              className={`gamble-card ${showCards || cardAnimationKeys[index] > 0 ? 'card-drop' : ''} ${selectedCard === index && canceledCardIndex !== index ? 'card-clicked' : ''} ${canceledCardIndex === index || (selectedCard !== index && (cardsLocked || canceledCardIndex !== null || !isFocusTimeActive)) ? 'card-disabled' : ''} ${selectedCard === null && !cardsLocked && canceledCardIndex === null && isFocusTimeActive ? 'card-clickable' : ''}`}
              style={{ animationDelay: `${index * 0.2}s` }}
              onClick={() => selectedCard === null && !cardsLocked && canceledCardIndex === null && isFocusTimeActive && selectCard(index)}
            >
              {selectedCard === index && canceledCardIndex !== index && (
                <div className="card-selected-banner">
                  SELECTED
                </div>
              )}
              <div className="card-content">
                <div className="card-header">
                  <div className="card-domain">
                    {card.type === 'domain' && card.domain 
                      ? extractHostname(card.domain)
                      : card.type === 'bonusRerolls'
                      ? 'BONUS RE-ROLL'
                      : ''}
                  </div>
                </div>
                
                <div className="card-symbol">
                  {card.type === 'domain' ? '⏱️' : '🎁'}
                </div>
                
                <div className="card-body">
                  {card.type === 'domain' && card.durationMinutes ? (
                    <div className="card-duration">
                      {card.durationMinutes} {card.durationMinutes === 1 ? 'minute' : 'minutes'}
                    </div>
                  ) : card.type === 'bonusRerolls' && card.bonusRerolls ? (
                    <div className="card-bonus-rerolls">
                      +1 re-roll
                    </div>
                  ) : null}
                  
                  {selectedCard === index && canceledCardIndex !== index && (
                    <div className="card-selected-message">
                      {card.type === 'domain' && card.durationMinutes ? (
                        <div className="card-selected-content">
                          <div className="card-selected-text">
                            ✓ Selected! Unblocked for: <span className="card-countdown">{formatUnblockCountdown(unblockTimeRemaining)}</span>
                          </div>
                          <button 
                            className="cancel-unblock-card-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelUnblock();
                            }}
                            title="Cancel this unblock"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : card.type === 'bonusRerolls' && card.bonusRerolls ? (
                        <>✓ Bonus applied! You gained 1 re-roll!</>
                      ) : null}
                    </div>
                  )}
                  
                  {selectedCard === null && (
                    <div className="card-actions">
                      <div className="card-click-hint">
                        {cardsLocked 
                          ? 'Waiting for timer to reset...'
                          : 'Click card to select'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {selectedCard === null && (
              <div className="card-reroll-section">
                <button
                  onClick={() => rerollCard(index)}
                  disabled={!canReroll}
                  className="reroll-button"
                  title={!canReroll 
                    ? `No re-roll${availableRerolls !== 1 ? 's' : ''} left. Next selection in ${formatTimeRemaining(timeRemaining)}` 
                    : `${availableRerolls} re-roll${availableRerolls !== 1 ? 's' : ''} left`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <path d="M3 21v-5h5"></path>
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

