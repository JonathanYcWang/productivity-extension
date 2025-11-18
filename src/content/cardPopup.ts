// Content script to inject card popup on pages
import { runtime } from "../lib/browser-api";

const POPUP_ID = 'productivity-blocker-card-popup';

export function showCardPopup() {
  // Remove existing popup if present
  const existing = document.getElementById(POPUP_ID);
  if (existing) {
    existing.remove();
  }

  // Create popup container
  const popup = document.createElement('div');
  popup.id = POPUP_ID;
  popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  `;

  // Create iframe for the popup content
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    width: 90%;
    max-width: 800px;
    height: 90%;
    max-height: 600px;
    border: none;
    border-radius: 12px;
    background: white;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;
  
  // Get the extension URL for the popup HTML
  const popupUrl = runtime.getURL('cardPopup/index.html');
  iframe.src = popupUrl;
  
  popup.appendChild(iframe);

  // Close on background click
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.remove();
    }
  });

  // Add to page
  document.body.appendChild(popup);

  // Listen for close messages from iframe
  window.addEventListener('message', (event) => {
    const extensionOrigin = runtime.getURL('').slice(0, -1);
    if (event.data === 'closeCardPopup' && event.origin === extensionOrigin) {
      popup.remove();
    }
  });
}

// Listen for messages from background script
if (runtime.onMessage) {
  runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (message.action === 'showCardPopup') {
      showCardPopup();
      sendResponse({ success: true });
    }
    return true;
  });
}

