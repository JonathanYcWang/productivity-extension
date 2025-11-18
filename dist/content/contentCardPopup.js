import{r as n}from"../assets/browser-api.js";const s="productivity-blocker-card-popup";function a(){const o=document.getElementById(s);o&&o.remove();const e=document.createElement("div");e.id=s,e.style.cssText=`
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
  `;const r=n.getURL("cardPopup/index.html");t.src=r,e.appendChild(t),e.addEventListener("click",i=>{i.target===e&&e.remove()}),document.body.appendChild(e),window.addEventListener("message",i=>{const d=n.getURL("").slice(0,-1);i.data==="closeCardPopup"&&i.origin===d&&e.remove()})}n.onMessage&&n.onMessage.addListener((o,e,t)=>(o.action==="showCardPopup"&&(a(),t({success:!0})),!0));
//# sourceMappingURL=contentCardPopup.js.map
