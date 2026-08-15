var background=(function(){function e(e){return e==null||typeof e==`function`?{main:e}:e}async function t(e){return(await chrome.storage.local.get(e))[e]}async function n(e,t){await chrome.storage.local.set({[e]:t})}async function r(){return await t(`pinnedTabs`)??{}}async function i(e,t){let i=await r();t?i[e]=!0:delete i[e],await n(`pinnedTabs`,i)}var a=`https://api.heynotai.com`,o=1e6,s=1500,c=30,l=120,u=e(()=>{let e={authentic:{text:`✓`,color:`#16a34a`},suspicious:{text:`?`,color:`#d97706`},"ai-generated":{text:`!`,color:`#dc2626`}},t=new Map,n=new Map,u=new Map,f=new Map,p=[`·`,`··`,`···`],m={human:{text:`✓`,color:`#16a34a`},ai:{text:`!`,color:`#dc2626`},mixed:{text:`~`,color:`#d97706`}};function h(e){g(e),chrome.action.setBadgeBackgroundColor({color:`#5b5cff`,tabId:e}),chrome.action.setBadgeTextColor({color:`#ffffff`,tabId:e});let t=0;chrome.action.setBadgeText({text:p[0],tabId:e});let n=setInterval(()=>{t=(t+1)%p.length,chrome.action.setBadgeText({text:p[t],tabId:e})},450);f.set(e,n)}function g(e){let t=f.get(e);t!=null&&(clearInterval(t),f.delete(e))}function _(e,t){g(e);let n=m[t]??m.mixed;chrome.action.setBadgeText({text:n.text,tabId:e}),chrome.action.setBadgeBackgroundColor({color:n.color,tabId:e}),chrome.action.setBadgeTextColor({color:`#ffffff`,tabId:e})}function v(e){g(e),chrome.action.setBadgeText({text:``,tabId:e})}function y(e){return e?!(e.startsWith(`chrome://`)||e.startsWith(`chrome-extension://`)||e.startsWith(`edge://`)||e.startsWith(`about:`)):!1}function b(e){return e?/^https?:\/\/([^/]+\.)?youtube\.com\/(watch|shorts\/)/.test(e)||/^https?:\/\/([^/]+\.)?instagram\.com\/(p|reel|reels)\//.test(e)||/^https?:\/\/([^/]+\.)?facebook\.com\/(reel|reels|posts|permalink|photo)\//.test(e)||/^https?:\/\/([^/]+\.)?facebook\.com\/[^/]+\/posts\//.test(e):!1}function x(){chrome.contextMenus.removeAll(()=>{chrome.contextMenus.create({id:`hn-yt-video`,title:`Check this video with heynotai`,contexts:[`page`,`video`,`frame`],documentUrlPatterns:[`*://*.youtube.com/watch*`]}),chrome.contextMenus.create({id:`hn-yt-short`,title:`Check this Short with heynotai`,contexts:[`page`,`video`,`frame`],documentUrlPatterns:[`*://*.youtube.com/shorts/*`]}),chrome.contextMenus.create({id:`hn-ig-post`,title:`Check this post with heynotai`,contexts:[`page`,`image`,`video`],documentUrlPatterns:[`*://*.instagram.com/p/*`]}),chrome.contextMenus.create({id:`hn-ig-reel`,title:`Check this reel with heynotai`,contexts:[`page`,`video`],documentUrlPatterns:[`*://*.instagram.com/reel/*`,`*://*.instagram.com/reels/*`]}),chrome.contextMenus.create({id:`hn-fb-post`,title:`Check this post with heynotai`,contexts:[`page`,`image`,`video`],documentUrlPatterns:[`*://*.facebook.com/*/posts/*`,`*://*.facebook.com/permalink*`,`*://*.facebook.com/photo*`,`*://*.facebook.com/posts/*`]}),chrome.contextMenus.create({id:`hn-fb-reel`,title:`Check this reel with heynotai`,contexts:[`page`,`video`],documentUrlPatterns:[`*://*.facebook.com/reel/*`,`*://*.facebook.com/reels/*`]}),chrome.contextMenus.create({id:`hn-text-selection`,title:`AI check this text with heynotai`,contexts:[`selection`]})})}chrome.runtime.onInstalled.addListener(x),x(),chrome.contextMenus.onClicked.addListener((e,t)=>{if(t?.id!=null){if(e.menuItemId===`hn-text-selection`){let r=n.get(t.id);n.delete(t.id);let i=r??e.selectionText??``;S(t.id,i).catch(()=>{});return}chrome.tabs.sendMessage(t.id,{type:`MANUAL_SCAN`}).catch(()=>{})}});async function S(e,n){let r=n.trim();if(!r)return;let i=r.length>o?r.slice(0,o):r;t.get(e)?.abort();let a=new AbortController;t.set(e,a);let s=await w();if(!s){N(e,{type:`TEXT_AI_CHECK_AUTH_REQUIRED`}),t.delete(e);return}N(e,{type:`TEXT_SCAN_STARTED`}),h(e);try{let t=await E((await T(i,s.token,a.signal)).id,s.token,a.signal);t.status===`failed`?(N(e,{type:`TEXT_SCAN_FAILED`,error:`detection_failed`}),v(e)):(N(e,{type:`TEXT_SCAN_COMPLETE`,scan:t}),_(e,t.verdict))}catch(t){if(a.signal.aborted)return;let n=t instanceof Error?t.message:`unknown_error`;if(n===`auth_required`){N(e,{type:`TEXT_AI_CHECK_AUTH_REQUIRED`}),v(e);return}N(e,{type:`TEXT_SCAN_FAILED`,error:n}),v(e)}finally{t.get(e)===a&&t.delete(e)}}async function C(e,n,r,i){let a=n.trim().slice(0,o);if(!a){chrome.runtime.sendMessage({type:`SCAN_FAILED`,error:`no_readable_text`}).catch(()=>{});return}let s=await w();if(!s){chrome.runtime.sendMessage({type:`SCAN_FAILED`,error:`auth_required`}).catch(()=>{});return}t.get(e)?.abort();let c=new AbortController;t.set(e,c);try{let e=await E((await T(a,s.token,c.signal,r)).id,s.token,c.signal);if(e.status===`failed`){chrome.runtime.sendMessage({type:`SCAN_FAILED`,error:`detection_failed`}).catch(()=>{});return}chrome.runtime.sendMessage({type:`SCAN_COMPLETE`,payload:{videoId:e.id,title:e.title||r,result:e.verdict===`ai`?`ai-generated`:e.verdict===`human`?`authentic`:`suspicious`,trustScore:100-(e.aiPct??0),timestamp:Date.now(),url:i}}).catch(()=>{})}catch(e){if(!c.signal.aborted){let t=e instanceof Error?e.message:`page_scan_failed`;chrome.runtime.sendMessage({type:`SCAN_FAILED`,error:t}).catch(()=>{})}}finally{t.get(e)===c&&t.delete(e)}}async function w(){let e=(await chrome.storage.local.get(`heynotai_auth`)).heynotai_auth;return!e||typeof e.token!=`string`||e.token.length===0?null:{token:e.token,userId:e.userId??``,plan:e.plan??`check`}}async function T(e,t,n,r){let i=new FormData;i.set(`type`,`txt`),i.set(`origin`,`ext`),i.set(`content`,e),r?.trim()&&i.set(`title`,r.trim());let o=await fetch(`${a}/scans`,{method:`POST`,headers:{Authorization:`Bearer ${t}`},body:i,signal:n});if(!o.ok){if(o.status===401)throw await M(),Error(`auth_required`);let e=await j(o);throw Error(`scans_create_${o.status}_${e}`)}return await o.json()}async function E(e,t,n,r=c){for(let i=0;i<r;i++){await A(s,n);let o=await fetch(`${a}/scans/${encodeURIComponent(e)}`,{headers:{Authorization:`Bearer ${t}`},signal:n});if(!o.ok){if(o.status===401)throw await M(),Error(`auth_required`);if(i===r-1)throw Error(`scans_get_${o.status}`);continue}let c=await o.json();if(c.status===`done`||c.status===`failed`)return c}throw Error(`scans_timeout`)}async function D(e,t,n,r){console.info(`[heynotai/sw] runYouTubeScan starting`,{tabId:e,url:t,mediaId:n}),u.get(e)?.abort();let i=new AbortController;u.set(e,i);let a=await w();if(!a){console.warn(`[heynotai/sw] no auth — telling content script`,{tabId:e,mediaId:n}),N(e,{type:`YT_SCAN_AUTH_REQUIRED`,mediaId:n}),u.delete(e);return}try{let o=await O(t,a.token,i.signal),s;if(o){if(console.info(`[heynotai/sw] cache hit`,{scanId:o.id,status:o.status}),o.status===`done`){N(e,{type:`YT_SCAN_COMPLETE`,scan:o,mediaId:n});return}s=o.id}else{console.info(`[heynotai/sw] no cache — POST /scans`,{url:t,mediaId:n});let e=await k(t,r,a.token,i.signal);console.info(`[heynotai/sw] /scans created`,{scanId:e.id}),s=e.id}let c=await E(s,a.token,i.signal,l);console.info(`[heynotai/sw] poll finished`,{tabId:e,scanId:c.id,status:c.status,verdict:c.verdict}),c.status===`failed`?N(e,{type:`YT_SCAN_FAILED`,error:`detection_failed`,mediaId:n}):N(e,{type:`YT_SCAN_COMPLETE`,scan:c,mediaId:n})}catch(t){if(i.signal.aborted)return;let r=t instanceof Error?t.message:`unknown_error`;if(r===`auth_required`){N(e,{type:`YT_SCAN_AUTH_REQUIRED`,mediaId:n});return}N(e,{type:`YT_SCAN_FAILED`,error:r,mediaId:n})}finally{u.get(e)===i&&u.delete(e)}}async function O(e,t,n){let r=`sourceUrl="${e.replace(/"/g,`\\"`)}" && status!="failed"`,i=new URLSearchParams({filter:r,sort:`-created`,perPage:`1`});try{let e=await fetch(`${a}/data/scans?${i.toString()}`,{headers:{Authorization:`Bearer ${t}`},signal:n});return e.ok?(await e.json()).items?.[0]??null:null}catch{return null}}async function k(e,t,n,r){let i=new FormData;i.set(`type`,`vid`),i.set(`subtype`,`yt-vid`),i.set(`origin`,`ext`),i.set(`sourceUrl`,e),t&&t.trim()&&i.set(`title`,t.trim());let o=await fetch(`${a}/scans`,{method:`POST`,headers:{Authorization:`Bearer ${n}`},body:i,signal:r});if(!o.ok){if(o.status===401)throw await M(),Error(`auth_required`);let e=await j(o);throw Error(`scans_create_${o.status}_${e}`)}return await o.json()}function A(e,t){return new Promise((n,r)=>{if(t.aborted)return r(Error(`aborted`));let i=setTimeout(()=>{t.removeEventListener(`abort`,a),n()},e),a=()=>{clearTimeout(i),r(Error(`aborted`))};t.addEventListener(`abort`,a,{once:!0})})}async function j(e){try{let t=await e.json();if(t&&typeof t.error==`string`)return t.error}catch{}return`unknown`}async function M(){await chrome.storage.local.remove([`heynotai_auth`,`heynotai_backend_auth`])}function N(e,t){chrome.tabs.sendMessage(e,t).then(()=>{console.info(`[heynotai/sw] sendTabMessage delivered`,{tabId:e,type:t.type})},async n=>{let r=n instanceof Error?n.message:String(n);if(console.warn(`[heynotai/sw] sendTabMessage failed`,{tabId:e,type:t.type,err:r}),t.type===`YT_SCAN_COMPLETE`||t.type===`YT_SCAN_FAILED`||t.type===`YT_SCAN_AUTH_REQUIRED`)try{await chrome.scripting.executeScript({target:{tabId:e},files:[`content-scripts/content.js`]}),await new Promise(e=>setTimeout(e,700)),await chrome.tabs.sendMessage(e,t),console.info(`[heynotai/sw] sendTabMessage delivered (after inject)`,{tabId:e,type:t.type})}catch(n){console.warn(`[heynotai/sw] verdict redelivery failed`,{tabId:e,type:t.type,err:n instanceof Error?n.message:String(n)}),t.type===`YT_SCAN_COMPLETE`?chrome.runtime.sendMessage({type:`SCAN_COMPLETE`,payload:{videoId:t.scan.id,title:t.scan.title??``,result:t.scan.verdict===`ai`?`ai-generated`:t.scan.verdict===`human`?`authentic`:`suspicious`,trustScore:100-(t.scan.aiPct??0),timestamp:Date.now(),url:t.scan.sourceUrl??``}}).catch(()=>{}):t.type===`YT_SCAN_FAILED`&&chrome.runtime.sendMessage({type:`SCAN_FAILED`,error:t.error}).catch(()=>{})}})}async function P(e){try{await chrome.tabs.sendMessage(e,{type:`MANUAL_SCAN`}),console.info(`[heynotai/sw] MANUAL_SCAN delivered (no inject)`,{tabId:e});return}catch(t){console.info(`[heynotai/sw] direct delivery failed — will inject`,{tabId:e,err:t instanceof Error?t.message:String(t)})}try{let t=await chrome.scripting.executeScript({target:{tabId:e},files:[`content-scripts/content.js`]});console.info(`[heynotai/sw] content.js injected`,{tabId:e,frames:t?.length??0}),await new Promise(e=>setTimeout(e,700)),await chrome.tabs.sendMessage(e,{type:`MANUAL_SCAN`}),console.info(`[heynotai/sw] MANUAL_SCAN delivered (after inject)`,{tabId:e})}catch(t){console.warn(`[heynotai/sw] inject + retry failed`,{tabId:e,err:t instanceof Error?t.message:String(t)}),chrome.runtime.sendMessage({type:`SCAN_FAILED`,error:`content_script_missing`}).catch(()=>{})}}async function F(e,t){let n=chrome.runtime.getURL(`drawer.html`),i=(await r())[e]===!0,{appliedTheme:a}=await chrome.storage.local.get(`appliedTheme`),o=a===`dark`?`dark`:`light`;try{await chrome.scripting.executeScript({target:{tabId:e},args:[n,e,i,t,o],func:d})}catch{}}chrome.action.onClicked.addListener(async e=>{!e.id||!y(e.url)||F(e.id,!1)}),console.info(`[heynotai/sw] booted`,{version:chrome.runtime.getManifest().version}),chrome.runtime.onMessage.addListener((t,r)=>{if(console.info(`[heynotai/sw] message`,{type:t?.type,fromTab:r.tab?.id??null}),t.type===`SCAN_COMPLETE`&&r.tab?.id!=null){let n=e[t.payload.result]??e.authentic,i=r.tab.id;chrome.action.setBadgeText({text:n.text,tabId:i}),chrome.action.setBadgeBackgroundColor({color:n.color,tabId:i}),chrome.action.setBadgeTextColor({color:`#ffffff`,tabId:i})}if(t.type===`PIN_STATE`&&i(t.tabId,t.pinned),t.type===`TEXT_SELECTION_PRIMED`&&r.tab?.id!=null&&n.set(r.tab.id,t.text),t.type===`OPEN_DRAWER`&&r.tab?.id!=null&&y(r.tab.url)&&F(r.tab.id,!1),t.type===`TRIGGER_MANUAL_SCAN`){console.info(`[heynotai/sw] TRIGGER_MANUAL_SCAN`,{tabId:t.tabId}),P(t.tabId);return}if(t.type===`PAGE_TEXT_SCAN_REQUEST`&&r.tab?.id!=null){C(r.tab.id,t.text,t.title,t.url);return}t.type===`YT_SCAN_REQUEST`&&r.tab?.id!=null&&(console.info(`[heynotai/sw] YT_SCAN_REQUEST received`,{tabId:r.tab.id,url:t.url,mediaId:t.mediaId}),D(r.tab.id,t.url,t.mediaId,t.title).catch(e=>{console.warn(`[heynotai/sw] runYouTubeScan threw`,e)}))}),chrome.tabs.onUpdated.addListener(async(e,t,n)=>{t.url&&!b(t.url)&&chrome.action.setBadgeText({text:``,tabId:e}),t.status===`complete`&&y(n.url)&&(await r())[e]&&F(e,!0)}),chrome.tabs.onRemoved.addListener(e=>{i(e,!1),t.get(e)?.abort(),t.delete(e),u.get(e)?.abort(),u.delete(e),n.delete(e),g(e)})});function d(e,t,n,r,i){let a=`heynotai-drawer-root`,o=`heynotai-drawer-style`,s=document.getElementById(a),c=e=>{let t=e.dataset.side===`left`?`left`:`right`;e.style.setProperty(`--hn-x`,t===`right`?`100vw`:`-100%`),e.style.opacity=`0`,setTimeout(()=>e.remove(),500)};if(s){if(r)return;c(s);return}let l=document.body??document.documentElement;if(!document.getElementById(o)){let e=document.createElement(`style`);e.id=o,e.textContent=`
      #${a} {
        position: fixed;
        top: 0;
        left: 0;
        width: min(440px, 92vw);
        height: 100vh;
        z-index: 2147483647;
        background: #f3f0e8;
        opacity: 0;
        --hn-x: 100vw;
        transform: translateX(var(--hn-x));
        transition:
          transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
          opacity   0.4s ease;
        will-change: transform, opacity;
        /* Defensive: some hosts (YouTube watch pages, FB feed) ship
           rules like \`iframe, [role="dialog"] { pointer-events: none }\`
           that win specificity against an injected element. Force
           interactivity so clicks always land on our drawer instead
           of falling through to the page underneath. */
        pointer-events: auto !important;
      }
      #${a}[data-theme="dark"] { background: #0f1013; }
      #${a}[data-side="right"] {
        border-left: 1px solid rgba(0,0,0,0.12);
        box-shadow: -24px 0 60px rgba(0,0,0,0.32),
                    -6px 0 14px rgba(0,0,0,0.18);
      }
      #${a}[data-side="left"] {
        border-right: 1px solid rgba(0,0,0,0.12);
        box-shadow: 24px 0 60px rgba(0,0,0,0.32),
                    6px 0 14px rgba(0,0,0,0.18);
      }
      #${a} > iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: transparent;
        pointer-events: auto !important;
      }

      /* Vertical control rail — matches the extension's .icon-btn design
         language (warm neutrals, 28×28 buttons, 7px radius, 14px icons). */
      #${a} .hn-rail {
        position: absolute;
        top: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 36px;
        padding: 4px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow:
          0 20px 60px rgba(20,18,10,0.18),
          0 2px 6px rgba(20,18,10,0.06),
          0 0 0 1px rgba(26,25,22,0.09);
        z-index: 1;
        pointer-events: auto !important;
      }
      #${a} .hn-rail button { pointer-events: auto !important; }
      #${a}[data-side="right"] .hn-rail { left: -44px; }
      #${a}[data-side="left"]  .hn-rail { right: -44px; }

      #${a} .hn-rail button {
        appearance: none;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 0;
        border-radius: 7px;
        color: #5b5749;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        padding: 0;
      }
      #${a} .hn-rail button:hover,
      #${a} .hn-rail button.is-active {
        background: #f1ede4;
        color: #1a1916;
      }
      #${a} .hn-rail svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: transform 0.18s ease;
      }
      #${a} .hn-rail button[data-action="pin"].is-active svg {
        transform: rotate(-20deg);
        fill: currentColor;
        stroke: none;
      }

      #${a}[data-theme="dark"] .hn-rail {
        background: #17191e;
        box-shadow:
          0 20px 60px rgba(0,0,0,0.55),
          0 0 0 1px rgba(255,255,255,0.07);
      }
      #${a}[data-theme="dark"] .hn-rail button { color: #a5a39a; }
      #${a}[data-theme="dark"] .hn-rail button:hover,
      #${a}[data-theme="dark"] .hn-rail button.is-active {
        background: #0b0c0f;
        color: #ecebe5;
      }

      @media (prefers-reduced-motion: reduce) {
        #${a} { transition-duration: 0.01ms !important; }
      }
    `,l.appendChild(e)}let u=document.createElement(`div`);u.id=a,u.dataset.side=`right`,u.dataset.theme=i,u.style.setProperty(`--hn-x`,`100vw`);let d=document.createElement(`iframe`);d.src=`${e}?tabId=${t}&url=${encodeURIComponent(window.location.href)}`,d.setAttribute(`allow`,`clipboard-write`),u.appendChild(d);let f=document.createElement(`div`);f.className=`hn-rail`,f.innerHTML=`
    <button type="button" data-action="close" title="Close" aria-label="Close">
      <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <button type="button" data-action="pin" title="Pin" aria-label="Pin">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 17v5"/>
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
      </svg>
    </button>
    <button type="button" data-action="refresh" title="Refresh" aria-label="Refresh">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M21 3v5h-5"/>
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        <path d="M3 21v-5h5"/>
      </svg>
    </button>
    <button type="button" data-action="dock" title="Dock to other side" aria-label="Dock to other side">
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <path d="M14 4v16"/>
      </svg>
    </button>
  `,u.appendChild(f),n&&(u.toggleAttribute(`data-pinned`,!0),f.querySelector(`button[data-action="pin"]`)?.classList.add(`is-active`)),u.style.setProperty(`pointer-events`,`auto`,`important`),d.style.setProperty(`pointer-events`,`auto`,`important`),f.style.setProperty(`pointer-events`,`auto`,`important`),f.querySelectorAll(`button`).forEach(e=>{e.style.setProperty(`pointer-events`,`auto`,`important`)}),l.appendChild(u),requestAnimationFrame(()=>{u.style.setProperty(`--hn-x`,`calc(100vw - 100%)`),u.style.opacity=`1`});let p=e=>{try{chrome.runtime.sendMessage({type:`PIN_STATE`,tabId:t,pinned:e})}catch{}};f.addEventListener(`click`,e=>{let t=e.target.closest(`button[data-action]`);if(!t)return;let n=t.dataset.action;if(n===`close`){p(!1),c(u),h();return}if(n===`pin`){let e=!u.hasAttribute(`data-pinned`);t.classList.toggle(`is-active`,e),u.toggleAttribute(`data-pinned`,e),p(e);return}if(n===`refresh`){d.src=d.src,t.classList.add(`is-active`),setTimeout(()=>t.classList.remove(`is-active`),350);return}if(n===`dock`){let e=u.dataset.side===`right`?`left`:`right`;u.dataset.side=e,u.style.setProperty(`--hn-x`,e===`right`?`calc(100vw - 100%)`:`0px`),t.classList.toggle(`is-active`,e===`left`);return}});let m=e=>{if(e.data===`heynotai:close-drawer`){let e=document.getElementById(a);e&&c(e),p(!1),h();return}if(e.data&&typeof e.data==`object`&&e.data.type===`heynotai:theme`){let t=e.data.theme===`dark`?`dark`:`light`;u.dataset.theme=t}},h=()=>window.removeEventListener(`message`,m);window.addEventListener(`message`,m)}globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;var f=class{constructor(e){if(e===`<all_urls>`)this.isAllUrls=!0,this.protocolMatches=[...f.PROTOCOLS],this.hostnameMatch=`*`,this.pathnameMatch=`*`;else{let t=/(.*):\/\/(.*?)(\/.*)/.exec(e);if(t==null)throw new m(e,`Incorrect format`);let[n,r,i,a]=t;h(e,r),g(e,i),this.protocolMatches=r===`*`?[`http`,`https`]:[r],this.hostnameMatch=i,this.pathnameMatch=a}}includes(e){if(this.isAllUrls)return!0;let t=typeof e==`string`?new URL(e):e instanceof Location?new URL(e.href):e;return!!this.protocolMatches.find(e=>{if(e===`http`)return this.isHttpMatch(t);if(e===`https`)return this.isHttpsMatch(t);if(e===`file`)return this.isFileMatch(t);if(e===`ftp`)return this.isFtpMatch(t);if(e===`urn`)return this.isUrnMatch(t)})}isHttpMatch(e){return e.protocol===`http:`&&this.isHostPathMatch(e)}isHttpsMatch(e){return e.protocol===`https:`&&this.isHostPathMatch(e)}isHostPathMatch(e){if(!this.hostnameMatch||!this.pathnameMatch)return!1;let t=[this.convertPatternToRegex(this.hostnameMatch),this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./,``))],n=this.convertPatternToRegex(this.pathnameMatch);return!!t.find(t=>t.test(e.hostname))&&n.test(e.pathname)}isFileMatch(e){throw Error(`Not implemented: file:// pattern matching. Open a PR to add support`)}isFtpMatch(e){throw Error(`Not implemented: ftp:// pattern matching. Open a PR to add support`)}isUrnMatch(e){throw Error(`Not implemented: urn:// pattern matching. Open a PR to add support`)}convertPatternToRegex(e){let t=this.escapeForRegex(e).replace(/\\\*/g,`.*`);return RegExp(`^${t}$`)}escapeForRegex(e){return e.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`)}},p=f;p.PROTOCOLS=[`http`,`https`,`file`,`ftp`,`urn`];var m=class extends Error{constructor(e,t){super(`Invalid match pattern "${e}": ${t}`)}};function h(e,t){if(!p.PROTOCOLS.includes(t)&&t!==`*`)throw new m(e,`${t} not a valid protocol (${p.PROTOCOLS.join(`, `)})`)}function g(e,t){if(t.includes(`:`))throw new m(e,`Hostname cannot include a port`);if(t.includes(`*`)&&t.length>1&&!t.startsWith(`*.`))throw new m(e,`If using a wildcard (*), it must go at the start of the hostname`)}var _={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)},v;try{v=u.main(),v instanceof Promise&&console.warn(`The background's main() function return a promise, but it must be synchronous`)}catch(e){throw _.error(`The background crashed on startup!`),e}return v})();