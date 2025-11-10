const r="productivity-blocker-card-popup";function s(){const o=document.getElementById(r);o&&o.remove();const e=document.createElement("div");e.id=r,e.style.cssText=`
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
  `;const t=document.createElement("iframe");t.style.cssText=`
    width: 90%;
    max-width: 800px;
    height: 90%;
    max-height: 600px;
    border: none;
    border-radius: 12px;
    background: white;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;const n=chrome.runtime.getURL("cardPopup/index.html");t.src=n,e.appendChild(t),e.addEventListener("click",i=>{i.target===e&&e.remove()}),document.body.appendChild(e),window.addEventListener("message",i=>{i.data==="closeCardPopup"&&i.origin===chrome.runtime.getURL("").slice(0,-1)&&e.remove()})}chrome.runtime.onMessage.addListener((o,e,t)=>(o.action==="showCardPopup"&&(s(),t({success:!0})),!0));
//# sourceMappingURL=contentCardPopup.js.map
