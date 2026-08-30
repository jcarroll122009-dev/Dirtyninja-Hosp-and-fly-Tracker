// ==UserScript==
// @name         DirtyNinja War Tracker
// @namespace    local.torn.wartracker
// @version      1.1.6
// @description  Tracks hospital and flight time remaining for an enemy faction.
// @author       jcarroll122009-dev
// @homepageURL  https://github.com/jcarroll122009-dev/Dirtyninja-Hosp-and-fly-Tracker
// @supportURL   https://github.com/jcarroll122009-dev/Dirtyninja-Hosp-and-fly-Tracker/issues
// @updateURL    https://raw.githubusercontent.com/jcarroll122009-dev/Dirtyninja-Hosp-and-fly-Tracker/main/torn-war-tracker.user.js
// @downloadURL  https://raw.githubusercontent.com/jcarroll122009-dev/Dirtyninja-Hosp-and-fly-Tracker/main/torn-war-tracker.user.js
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const API_ROOT = 'https://api.torn.com/v2';
  const REFRESH_MS = 30_000;
  const STORAGE = {
    key: 'twt_api_key',
    faction: 'twt_enemy_faction_id',
    collapsed: 'twt_collapsed',
    flights: 'twt_flight_estimates'
  };
  const STANDARD_FLIGHT_MINUTES = {
    mexico: 24, 'cayman islands': 33, cayman: 33, canada: 39, hawaii: 127,
    'united kingdom': 151, london: 151, argentina: 158, switzerland: 166,
    japan: 213, china: 229, 'united arab emirates': 257, dubai: 257,
    'south africa': 281
  };

  let members = [];
  let refreshTimer;
  const flightStatusCache = new Map();

  const css = `
    #twt-panel{position:fixed;right:18px;top:90px;width:450px;max-width:calc(100vw - 36px);max-height:75vh;z-index:999999;
      background:#171717;color:#ddd;border:1px solid #555;border-radius:8px;box-shadow:0 5px 22px #000b;
      font:13px Arial,sans-serif;overflow:hidden}
    #twt-head{display:flex;align-items:center;gap:8px;padding:10px;background:#252525;cursor:move}
    #twt-title{font-weight:bold;flex:1;color:#eee}.twt-btn{border:1px solid #666;border-radius:4px;background:#333;
      color:#eee;padding:4px 7px;cursor:pointer}.twt-btn:hover{background:#444}
    #twt-status{padding:7px 10px;color:#aaa;border-bottom:1px solid #333}
    #twt-body{overflow:auto;max-height:calc(75vh - 76px)}
    .twt-row{display:grid;grid-template-columns:minmax(0,1fr) 62px 82px 96px;align-items:center;gap:6px;padding:8px 10px;
      border-bottom:1px solid #303030}.twt-row:hover{background:#222}
    .twt-name{color:#ddd;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .twt-name:hover{color:#fff;text-decoration:underline}.twt-state{text-align:center;font-weight:bold}
    .twt-time{text-align:right;font-variant-numeric:tabular-nums}.twt-hospital{color:#ef6666}.twt-traveling{color:#62aef7}
    .twt-abroad{color:#d0a1ff}.twt-okay{color:#66d17a}.twt-other{color:#bbb}
    .twt-presence{text-align:center;font-size:12px}.twt-presence::before{content:'';display:inline-block;width:7px;height:7px;
      margin-right:4px;border-radius:50%;vertical-align:1px;background:#777}.twt-online{color:#66d17a}.twt-online::before{background:#4dcc68}
    .twt-idle{color:#e4b95f}.twt-idle::before{background:#d9a93d}.twt-offline{color:#999}.twt-offline::before{background:#777}
    #twt-empty{padding:18px;text-align:center;color:#999}#twt-panel.twt-collapsed #twt-status,
    #twt-panel.twt-collapsed #twt-body{display:none}
    #twt-modal{position:fixed;inset:0;z-index:1000000;background:#0009;display:grid;place-items:center}
    #twt-card{width:min(430px,90vw);background:#222;color:#ddd;border:1px solid #666;border-radius:8px;padding:18px}
    #twt-card h3{margin:0 0 14px}#twt-card label{display:block;margin:10px 0 4px}
    #twt-card input{box-sizing:border-box;width:100%;padding:8px;background:#111;color:#eee;border:1px solid #555;border-radius:4px}
    #twt-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.twt-note{color:#aaa;font-size:12px;line-height:1.4}
  `;

  document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
  const panel = document.createElement('section');
  panel.id = 'twt-panel';
  if (GM_getValue(STORAGE.collapsed, false)) panel.classList.add('twt-collapsed');
  panel.innerHTML = `
    <div id="twt-head"><span id="twt-title">DirtyNinja War Tracker</span>
      <button class="twt-btn" id="twt-refresh" title="Refresh now">↻</button>
      <button class="twt-btn" id="twt-settings" title="Settings">⚙</button>
      <button class="twt-btn" id="twt-collapse" title="Collapse">—</button></div>
    <div id="twt-status">Starting…</div><div id="twt-body"></div>`;
  document.body.append(panel);

  const body = panel.querySelector('#twt-body');
  const statusLine = panel.querySelector('#twt-status');
  panel.querySelector('#twt-refresh').onclick = loadMembers;
  panel.querySelector('#twt-settings').onclick = showSettings;
  panel.querySelector('#twt-collapse').onclick = () => {
    panel.classList.toggle('twt-collapsed');
    GM_setValue(STORAGE.collapsed, panel.classList.contains('twt-collapsed'));
  };

  makeDraggable(panel, panel.querySelector('#twt-head'));

  function showSettings() {
    const modal = document.createElement('div');
    modal.id = 'twt-modal';
    modal.innerHTML = `<div id="twt-card"><h3>DirtyNinja War Tracker Settings</h3>
      <label for="twt-key">Torn API key</label>
      <input id="twt-key" type="password" autocomplete="off" value="${escapeAttr(GM_getValue(STORAGE.key, ''))}">
      <label for="twt-faction">Enemy faction ID</label>
      <input id="twt-faction" inputmode="numeric" value="${escapeAttr(GM_getValue(STORAGE.faction, ''))}">
      <p class="twt-note">Each user must enter their own Public-access Torn API key. It is stored only in that user's userscript-manager storage and sent only to api.torn.com.</p>
      <div id="twt-actions"><button class="twt-btn" id="twt-clear">Clear saved settings</button><button class="twt-btn" id="twt-cancel">Cancel</button><button class="twt-btn" id="twt-save">Save</button></div></div>`;
    document.body.append(modal);
    modal.querySelector('#twt-cancel').onclick = () => modal.remove();
    modal.querySelector('#twt-clear').onclick = () => {
      GM_setValue(STORAGE.key, '');
      GM_setValue(STORAGE.faction, '');
      GM_setValue(STORAGE.flights, {});
      members = [];
      modal.remove();
      loadMembers();
    };
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.querySelector('#twt-save').onclick = () => {
      const key = modal.querySelector('#twt-key').value.trim();
      const faction = modal.querySelector('#twt-faction').value.trim();
      if (!key || !/^\d+$/.test(faction)) return alert('Enter an API key and a numeric faction ID.');
      GM_setValue(STORAGE.key, key);
      GM_setValue(STORAGE.faction, faction);
      modal.remove();
      loadMembers();
    };
  }

  function loadMembers() {
    clearTimeout(refreshTimer);
    const key = GM_getValue(STORAGE.key, '');
    const faction = GM_getValue(STORAGE.faction, '');
    if (!key || !faction) {
      statusLine.textContent = 'Not configured — click ⚙ to add your API key and enemy faction ID.';
      body.innerHTML = '<div id="twt-empty">Settings will stay saved after you enter them.</div>';
      return;
    }
    statusLine.textContent = 'Refreshing…';
    GM_xmlhttpRequest({
      method: 'GET',
      url: `${API_ROOT}/faction/${encodeURIComponent(faction)}/members?striptags=true&comment=war_tracker`,
      headers: { Authorization: `ApiKey ${key}` },
      timeout: 15_000,
      onload: response => {
        try {
          const data = JSON.parse(response.responseText);
          if (response.status < 200 || response.status >= 300 || data.error) {
            throw new Error(data.error?.error || data.error?.message || `HTTP ${response.status}`);
          }
          members = Array.isArray(data.members) ? data.members : Object.values(data.members || {});
          applyFlightEstimates();
          statusLine.textContent = `${members.length} members • refreshed ${new Date().toLocaleTimeString()}`;
          render();
          enrichMissingFlightTimes(key);
        } catch (error) {
          statusLine.textContent = `API error: ${error.message}`;
        }
        refreshTimer = setTimeout(loadMembers, REFRESH_MS);
      },
      onerror: () => {
        statusLine.textContent = 'Network error contacting Torn API.';
        refreshTimer = setTimeout(loadMembers, REFRESH_MS);
      },
      ontimeout: () => {
        statusLine.textContent = 'Torn API request timed out.';
        refreshTimer = setTimeout(loadMembers, REFRESH_MS);
      }
    });
  }

  function render() {
    const now = Math.floor(Date.now() / 1000);
    const ranked = [...members].sort((a, b) => {
      const priority = { Hospital: 0, Traveling: 1, Abroad: 2, Okay: 3 };
      const ap = priority[a.status?.state] ?? 4;
      const bp = priority[b.status?.state] ?? 4;
      return ap - bp || Number(a.status?.until || 0) - Number(b.status?.until || 0) || a.name.localeCompare(b.name);
    });
    body.innerHTML = ranked.length ? ranked.map(member => {
      const state = member.status?.state || 'Unknown';
      const presence = member.last_action?.status || 'Offline';
      const exactUntil = Number(member.status?.until || 0);
      const estimatedUntil = Number(member._estimatedUntil || 0);
      const until = exactUntil > now ? exactUntil : estimatedUntil;
      const isEstimate = exactUntil <= now && estimatedUntil > now;
      const remaining = until > now
        ? `${isEstimate ? '~' : ''}${formatDuration(until - now)}`
        : state === 'Hospital'
          ? 'any moment'
          : state === 'Traveling'
            ? 'time unavailable'
            : '—';
      const label = state === 'Hospital' ? 'Hospital' : state === 'Traveling' ? 'Flying' : state;
      const details = member.status?.details || member.status?.description || '';
      return `<div class="twt-row" data-until="${until}" data-estimate="${isEstimate ? '1' : '0'}" data-state="${escapeAttr(state)}" title="${escapeAttr(details)}${isEstimate ? ' (estimated landing time)' : ''}">
        <a class="twt-name" href="https://www.torn.com/profiles.php?XID=${Number(member.id)}" target="_blank">${escapeHtml(member.name)} [${Number(member.id)}]</a>
        <span class="twt-presence twt-${presence.toLowerCase().replace(/[^a-z]/g, '') || 'offline'}" title="Last action: ${escapeAttr(member.last_action?.relative || presence)}">${escapeHtml(presence)}</span>
        <span class="twt-state twt-${state.toLowerCase().replace(/[^a-z]/g, '') || 'other'}">${escapeHtml(label)}</span>
        <span class="twt-time">${remaining}</span></div>`;
    }).join('') : '<div id="twt-empty">No members returned.</div>';
  }

  function updateCountdowns() {
    const now = Math.floor(Date.now() / 1000);
    body.querySelectorAll('.twt-row').forEach(row => {
      const until = Number(row.dataset.until);
      const timed = row.dataset.state === 'Hospital' || row.dataset.state === 'Traveling';
      row.querySelector('.twt-time').textContent = until > now
        ? `${row.dataset.estimate === '1' ? '~' : ''}${formatDuration(until - now)}`
        : row.dataset.state === 'Hospital'
          ? 'any moment'
          : row.dataset.state === 'Traveling'
            ? 'time unavailable'
            : '—';
    });
  }

  function applyFlightEstimates() {
    const saved = GM_getValue(STORAGE.flights, {});
    const activeIds = new Set();
    const nowMs = Date.now();

    members.forEach(member => {
      if (member.status?.state !== 'Traveling') return;
      const id = String(member.id);
      activeIds.add(id);
      if (Number(member.status?.until || 0) > Math.floor(nowMs / 1000)) {
        delete saved[id];
        return;
      }

      const statusText = `${member.status?.description || ''} ${member.status?.details || ''}`.toLowerCase();
      const destination = Object.keys(STANDARD_FLIGHT_MINUTES)
        .sort((a, b) => b.length - a.length)
        .find(place => statusText.includes(place));
      if (!destination) return;

      const plane = String(member.status?.plane_image_type || '').toLowerCase();
      const multiplier = plane.includes('business') ? 0.30
        : plane.includes('private') || plane.includes('wlt') ? 0.50
          : plane.includes('standard') ? 1.00
            : 0.70;
      const fingerprint = `${destination}|${plane}|${statusText}`;
      if (!saved[id] || saved[id].fingerprint !== fingerprint || nowMs - saved[id].firstSeen > 12 * 3600_000) {
        saved[id] = { firstSeen: nowMs, fingerprint };
      }
      const durationMs = STANDARD_FLIGHT_MINUTES[destination] * multiplier * 60_000;
      member._estimatedUntil = Math.floor((saved[id].firstSeen + durationMs) / 1000);
    });

    Object.keys(saved).forEach(id => { if (!activeIds.has(id)) delete saved[id]; });
    GM_setValue(STORAGE.flights, saved);
  }

  async function enrichMissingFlightTimes(key) {
    const now = Math.floor(Date.now() / 1000);
    const missing = members.filter(member =>
      member.status?.state === 'Traveling' && Number(member.status?.until || 0) <= now
    );
    if (!missing.length) return;

    statusLine.textContent += ` • checking ${missing.length} flight time${missing.length === 1 ? '' : 's'}…`;
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(3, missing.length) }, async () => {
      while (nextIndex < missing.length) {
        const member = missing[nextIndex++];
        const cached = flightStatusCache.get(member.id);
        if (cached && Date.now() - cached.checkedAt < 60_000) {
          if (cached.status) member.status = { ...member.status, ...cached.status };
          continue;
        }
        try {
          const status = await requestUserStatus(member.id, key);
          flightStatusCache.set(member.id, { checkedAt: Date.now(), status });
          if (status) member.status = { ...member.status, ...status };
        } catch (error) {
          flightStatusCache.set(member.id, { checkedAt: Date.now(), status: null });
        }
      }
    });
    await Promise.all(workers);
    applyFlightEstimates();
    statusLine.textContent = `${members.length} members • refreshed ${new Date().toLocaleTimeString()}`;
    render();
  }

  function requestUserStatus(userId, key) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${API_ROOT}/user/${encodeURIComponent(userId)}/basic?striptags=true&comment=war_tracker_flight`,
        headers: { Authorization: `ApiKey ${key}` },
        timeout: 12_000,
        onload: response => {
          try {
            const data = JSON.parse(response.responseText);
            if (response.status < 200 || response.status >= 300 || data.error) {
              throw new Error(data.error?.error || data.error?.message || `HTTP ${response.status}`);
            }
            resolve(data.status || data.user?.status || null);
          } catch (error) { reject(error); }
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out'))
      });
    });
  }

  function formatDuration(total) {
    total = Math.max(0, Math.floor(total));
    const h = Math.floor(total / 3600);
    const m = Math.floor(total % 3600 / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function makeDraggable(element, handle) {
    let startX, startY, startLeft, startTop;
    handle.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      const rect = element.getBoundingClientRect();
      [startX, startY, startLeft, startTop] = [e.clientX, e.clientY, rect.left, rect.top];
      const move = ev => {
        element.style.left = `${Math.max(0, startLeft + ev.clientX - startX)}px`;
        element.style.top = `${Math.max(0, startTop + ev.clientY - startY)}px`;
        element.style.right = 'auto';
      };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(value) { return escapeHtml(value); }

  setInterval(updateCountdowns, 1000);
  loadMembers();
})();
