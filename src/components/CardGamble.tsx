import React from "react";
import "../styles/CardGamble.css";
import { TemporaryUnblock } from "../types";

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
  lastCardGeneration: number; // timestamp when cards were last generated
  cards: CardOption[]; // Current cards displayed
  selectedCard: number | null; // Which card is selected
  cardsLocked: boolean; // Whether cards are locked
  showCards: boolean; // Whether cards are showing
  animationKey: number; // Animation key for card animations
  selectedCardExpiresAt: number | null; // When the selected domain card expires
}

const DEFAULT_REROLL_RESET_MINUTES = 60;
const INITIAL_REROLLS = 3; // Starting number of rerolls

export function CardGamble({ domains, domainDurations = {}, resetKey }: CardGambleProps) {
  const [cards, setCards] = React.useState<CardOption[]>([]);
  const [showCards, setShowCards] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const [animationKey, setAnimationKey] = React.useState(0);
  const [availableRerolls, setAvailableRerolls] = React.useState(INITIAL_REROLLS);
  const [rerollResetTime, setRerollResetTime] = React.useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = React.useState<number>(0);
  const [isLoadingState, setIsLoadingState] = React.useState(true);
  const [cardsLocked, setCardsLocked] = React.useState(false);
  const [selectedCardExpiresAt, setSelectedCardExpiresAt] = React.useState<number | null>(null);
  const [unblockTimeRemaining, setUnblockTimeRemaining] = React.useState<number>(0);
  const [canceledCardIndex, setCanceledCardIndex] = React.useState<number | null>(null);
  const [cardAnimationKeys, setCardAnimationKeys] = React.useState<number[]>([0, 0, 0]); // Per-card animation keys

  // Load persisted reroll state
  React.useEffect(() => {
    const loadRerollState = async () => {
      try {
        const { [REROLL_STATE_KEY]: state } = await chrome.storage.local.get(REROLL_STATE_KEY);
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
            await chrome.storage.local.remove(REROLL_STATE_KEY);
            // Cards will be regenerated by the initialization effect
          } else {
            // Load persisted state
            setAvailableRerolls(rerollState.availableRerolls ?? INITIAL_REROLLS);
            setRerollResetTime(rerollState.rerollResetTime);
            
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
                    const response = await chrome.runtime.sendMessage({ action: 'getActiveUnblocks' });
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
                chrome.runtime.sendMessage({
                  action: 'scheduleRerollReset',
                  resetTime: rerollState.rerollResetTime
                });
              } catch (error) {
                console.error('Error scheduling reroll reset:', error);
              }
            }
          }
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
          lastCardGeneration: Date.now(),
          cards,
          selectedCard,
          cardsLocked,
          showCards,
          animationKey,
          selectedCardExpiresAt
        };
        await chrome.storage.local.set({ [REROLL_STATE_KEY]: state });
      } catch (error) {
        console.error('Error saving reroll state:', error);
      }
    };
    
    saveRerollState();
  }, [availableRerolls, rerollResetTime, cards, selectedCard, cardsLocked, showCards, animationKey, selectedCardExpiresAt, isLoadingState]);

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
      
      // Clear persisted state
      await chrome.storage.local.remove(REROLL_STATE_KEY);
      
      // Cancel any scheduled alarms
      try {
        chrome.runtime.sendMessage({
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

  // Initialize cards when component mounts or domains change (only if no persisted cards exist)
  React.useEffect(() => {
    if (domains.length > 0 && !isLoadingState && cards.length === 0) {
      const initialCards = Array.from({ length: 3 }, () => 
        generateRandomOption(domains, domainDurations)
      );
      setCards(initialCards);
      setCardAnimationKeys([0, 0, 0]); // Initialize per-card animation keys
      setSelectedCard(null);
      // Cards lock state is managed separately - don't change it here
      // Cards will be locked if a card was selected and timer is running
      setShowCards(false);
      // Trigger animation by resetting key and showing cards
      setAnimationKey(prev => prev + 1);
      // Small delay to ensure DOM is ready for animation
      setTimeout(() => {
        setShowCards(true);
      }, 50);
    }
  }, [domains, domainDurations, isLoadingState, cards.length]);

  // Timer countdown effect
  React.useEffect(() => {
    if (!rerollResetTime) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, rerollResetTime - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Reset re-rolls when timer expires
        setAvailableRerolls(INITIAL_REROLLS);
        setRerollResetTime(null);
        setCardsLocked(false); // Unlock cards when timer resets
        setSelectedCard(null); // Clear selection - reset all cards
        setSelectedCardExpiresAt(null);
        setCanceledCardIndex(null);
        // Regenerate cards for new round
        if (domains.length > 0) {
          const newCards = Array.from({ length: 3 }, () => 
            generateRandomOption(domains, domainDurations)
          );
          setCards(newCards);
          setAnimationKey(prev => prev + 1);
          setShowCards(false);
          setTimeout(() => {
            setShowCards(true);
          }, 50);
        }
        // Clear persisted state
        chrome.storage.local.remove(REROLL_STATE_KEY).catch(console.error);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [rerollResetTime, availableRerolls, domains, domainDurations]);

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
    
    // For domain cards, lock cards, reset rerolls, and start timer
    setSelectedCard(cardIndex);
    setCardsLocked(true); // Lock all cards after selection
    setAvailableRerolls(0); // Lose all rerolls when a domain card is selected
    
    // Start timer when a domain card is selected (full duration)
    if (!rerollResetTime) {
      const resetTime = Date.now() + DEFAULT_REROLL_RESET_MINUTES * 60 * 1000;
      setRerollResetTime(resetTime);
      
      // Notify background script to schedule the alarm
      try {
        chrome.runtime.sendMessage({
          action: 'scheduleRerollReset',
          resetTime: resetTime
        });
      } catch (error) {
        console.error('Error scheduling reroll reset:', error);
      }
    }
    
    if (card.type === 'domain' && card.domain && card.durationMinutes) {
      // Domain card - unblock the domain
      const expiresAt = Date.now() + (card.durationMinutes * 60 * 1000);
      setSelectedCardExpiresAt(expiresAt);
      
      // Send message to background script to temporarily unblock this domain
      try {
        await chrome.runtime.sendMessage({
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
        setCardsLocked(false); // Unlock cards so user can select again
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

  // Handle canceling the selected card's unblock
  const handleCancelUnblock = async () => {
    if (selectedCard === null) return;
    
    const card = cards[selectedCard];
    if (!card || card.type !== 'domain' || !card.domain) return;

    try {
      // Cancel the temporary unblock
      await chrome.runtime.sendMessage({ 
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
      // Keep cards locked so all cards remain disabled (like when a card is selected)
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
        {availableRerolls > 0 && (
          <div className="reroll-counter">
            <span className="reroll-counter-label">Re-roll{availableRerolls !== 1 ? 's' : ''} available:</span>
            <span className="reroll-counter-value">{availableRerolls}</span>
          </div>
        )}
        {availableRerolls === 0 && timeRemaining > 0 && (
          <div className="reroll-timer">
            Next selection in: <span className="timer-value">{formatTimeRemaining(timeRemaining)}</span>
          </div>
        )}
      </div>

      <div className="cards-wrapper">
        {cards.map((card, index) => (
          <div key={`card-wrapper-${animationKey}-${index}`} className="card-wrapper">
            <div
              key={`${animationKey}-${index}-${cardAnimationKeys[index] || 0}`}
              className={`gamble-card ${showCards || cardAnimationKeys[index] > 0 ? 'card-drop' : ''} ${selectedCard === index && canceledCardIndex !== index ? 'card-clicked' : ''} ${canceledCardIndex === index || (selectedCard !== index && (cardsLocked || canceledCardIndex !== null)) ? 'card-disabled' : ''} ${selectedCard === null && !cardsLocked && canceledCardIndex === null ? 'card-clickable' : ''}`}
              style={{ animationDelay: `${index * 0.2}s` }}
              onClick={() => selectedCard === null && !cardsLocked && canceledCardIndex === null && selectCard(index)}
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

