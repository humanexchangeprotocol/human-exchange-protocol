// ============================================================
// APPLICATION LAYER v2.39.7
// ============================================================
const App=(()=>{
const PROTOCOL_NAME = 'Human Exchange Protocol';
const PROTOCOL_SHORT = 'HEP';
const PAIR_CODE_LENGTH = 4;
  'use strict';

  // --- Labels (single source for all user-facing text) ---
  const L = {
    exchange: 'Exchange',
    confirm: 'Confirm',
    settings: 'Settings',
    exchangeTitle: 'Exchange',
    confirmTitle: 'Confirm',
    shareChain: 'Share My Thread',
    providing: "I'm providing",
    receiving: "I'm receiving",
    description: 'Description',
    value: 'Declared Value',
    category: 'Category',
    duration: 'Duration (optional)',
    city: 'City (optional)',
    state: 'State (optional)',
    generateBtn: 'Generate Handshake',
  };

  // --- Sensor Capture Module ---
  // Captures physical reality data for chain records and PoH snapshots.
  // Initializes listeners at boot, provides captureSensor() for on-demand snapshots.
  var _sensor = { accel: null, gyro: null, light: null, pressure: null, battery: null, network: null, geo: null };
  var _sensorReady = false;

  function initSensors() {
    // Accelerometer -- on iOS 13+, requires requestPermission() first
    if (state.settings.sensorMotionGranted || !needsMotionPermission()) {
      attachMotionListeners();
    }
    // Battery
    if ('getBattery' in navigator) {
      navigator.getBattery().then(function(bat) {
        var update = function() { _sensor.battery = { level: bat.level, charging: bat.charging }; };
        update();
        bat.addEventListener('levelchange', update);
        bat.addEventListener('chargingchange', update);
      }).catch(function() {});
    }
    // Network
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      var netUpdate = function() {
        _sensor.network = { type: conn.type, effectiveType: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt };
      };
      netUpdate();
      conn.addEventListener('change', netUpdate);
    }
    // Ambient light
    if ('AmbientLightSensor' in window) {
      try {
        var ls = new AmbientLightSensor();
        ls.addEventListener('reading', function() { _sensor.light = ls.illuminance; });
        ls.start();
      } catch(e) {}
    }
    // Pressure
    if ('PressureSensor' in window) {
      try {
        var ps = new PressureSensor();
        ps.addEventListener('reading', function() { _sensor.pressure = ps.pressure; });
        ps.start();
      } catch(e) {}
    } else if ('Barometer' in window) {
      try {
        var bs = new Barometer();
        bs.addEventListener('reading', function() { _sensor.pressure = bs.pressure; });
        bs.start();
      } catch(e) {}
    }
    _sensorReady = true;
  }

  function attachMotionListeners() {
    window.addEventListener('devicemotion', function(e) {
      var a = e.accelerationIncludingGravity;
      if (a && (a.x !== null || a.y !== null || a.z !== null)) {
        _sensor.accel = { x: a.x, y: a.y, z: a.z };
      }
    });
    window.addEventListener('deviceorientation', function(e) {
      if (e.alpha !== null || e.beta !== null || e.gamma !== null) {
        _sensor.gyro = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
      }
    });
  }

  function needsMotionPermission() {
    return typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  }

  async function requestMotionPermission() {
    // iOS 13+ requires explicit permission for motion sensors
    if (!needsMotionPermission()) {
      // Android or older iOS -- just attach listeners, no permission needed
      attachMotionListeners();
      state.settings.sensorMotion = true;
      state.settings.sensorMotionGranted = true;
      save();
      return true;
    }
    try {
      var motionResult = await DeviceMotionEvent.requestPermission();
      var orientResult = await DeviceOrientationEvent.requestPermission();
      if (motionResult === 'granted' || orientResult === 'granted') {
        attachMotionListeners();
        state.settings.sensorMotion = true;
        state.settings.sensorMotionGranted = true;
        save();
        return true;
      }
      return false;
    } catch(e) {
      console.log('[sensor] Motion permission request failed:', e.message);
      return false;
    }
  }

  function getWebGLRenderer() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return null;
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch(e) { return null; }
  }

  function getCanvasFingerprint() {
    try {
      var c = document.createElement('canvas');
      c.width = 200; c.height = 50;
      var ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('HEP-fingerprint-2026', 2, 2);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('HEP-fingerprint-2026', 4, 4);
      return c.toDataURL();
    } catch(e) { return null; }
  }

  async function sensorSha256(str) {
    var buf = new TextEncoder().encode(str);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function quickDeviceHash() {
    // Fast hash of current sensor + device state — no GPS wait
    // Used for cross-device comparison during exchange handshake
    var data = JSON.stringify({
      accel: _sensor.accel, gyro: _sensor.gyro, light: _sensor.light,
      pressure: _sensor.pressure, battery: _sensor.battery, network: _sensor.network,
      platform: navigator.platform, screen: screen.width + 'x' + screen.height,
      dpr: window.devicePixelRatio, touchPoints: navigator.maxTouchPoints,
      cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory,
      ts: Date.now()
    });
    return await sensorSha256(data);
  }

  async function captureSensor() {
    var geo = null;
    try {
      if ('geolocation' in navigator) {
        geo = await new Promise(function(resolve) {
          navigator.geolocation.getCurrentPosition(
            function(pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, alt: pos.coords.altitude }); },
            function() { resolve(null); },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
          );
        });
      }
    } catch(e) {}

    var webgl = getWebGLRenderer();
    var canvas = getCanvasFingerprint();

    var sensorStr = JSON.stringify({ accel: _sensor.accel, gyro: _sensor.gyro, light: _sensor.light, pressure: _sensor.pressure, battery: _sensor.battery });
    var signalStr = JSON.stringify({ network: _sensor.network, geo: geo ? { lat: geo.lat, lng: geo.lng, alt: geo.alt } : null });
    var networkStr = JSON.stringify({ type: (_sensor.network || {}).type, effectiveType: (_sensor.network || {}).effectiveType, downlink: (_sensor.network || {}).downlink, rtt: (_sensor.network || {}).rtt });
    var deviceStr = JSON.stringify({ platform: navigator.platform, screen: screen.width + 'x' + screen.height, dpr: window.devicePixelRatio, touchPoints: navigator.maxTouchPoints, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, webgl: webgl });

    var sensorHash = await sensorSha256(sensorStr);
    var signalHash = await sensorSha256(signalStr);
    var networkHash = await sensorSha256(networkStr);
    var webglHash = webgl ? await sensorSha256(webgl) : null;
    var canvasHash = canvas ? await sensorSha256(canvas) : null;

    var capMask = 0;
    if (geo) capMask |= 1;
    if (_sensor.accel) capMask |= 2;
    if (_sensor.gyro) capMask |= 4;
    if (_sensor.battery) capMask |= 8;
    if (_sensor.network) capMask |= 16;
    if (_sensor.light !== null) capMask |= 32;
    if (_sensor.pressure !== null) capMask |= 64;

    return {
      geo: geo, device: deviceStr, sensorHash: sensorHash, signalHash: signalHash,
      networkHash: networkHash, webglHash: webglHash, canvasHash: canvasHash,
      batteryState: _sensor.battery, capabilityMask: capMask, timestamp: new Date().toISOString()
    };
  }

  // --- State ---
  let state = {
    initialized: false,
    chain: [],
    publicKey: null, privateKey: null,
    publicKeyJwk: null, privateKeyJwk: null,
    fingerprint: '',
    pin: '',
    declarations: { name: '', about: '', photo: null, photoDate: null, skills: [] },
    settings: { locationAuto: false, hideNames: true, hideLocations: true, witnessUrl: DEFAULT_WITNESS_URL, sensorMotion: false, sensorMotionGranted: false },
    direction: 'provided',
    pendingHandshake: null,
    proposalPath: 'inperson',
    settlementPayload: null,
    doneSummary: '',
    doneDetails: null,
  };

  const SK = 'hcp_data';

  // --- Storage ---
  function save() {
    localStorage.setItem(SK, JSON.stringify({
      chain: state.chain, fingerprint: state.fingerprint,
      declarations: state.declarations, settings: state.settings,
    }));
  }
  async function saveKeys(pin) {
    localStorage.setItem(SK + '_keys', JSON.stringify(
      await HCP.encryptWithPIN({ publicKey: state.publicKeyJwk, privateKey: state.privateKeyJwk }, pin)
    ));
  }
  function load() {
    const raw = localStorage.getItem(SK);
    if (!raw) return false;
    const d = JSON.parse(raw);
    state.chain = d.chain || [];
    state.fingerprint = d.fingerprint || '';
    state.declarations = Object.assign({ name: '', about: '', photo: null, photoDate: null, skills: [], rangeSimpleVal: 0, rangeComplexVal: 0, rangeDailyVal: 0, valTagsSimple: [], valTagsComplex: [], valTagsDaily: [] }, d.declarations || {});
    if (!Array.isArray(state.declarations.skills)) state.declarations.skills = [];
    if (!state.declarations.skills) state.declarations.skills = [];
    state.settings = Object.assign({ locationAuto: false, hideNames: true, hideLocations: true, witnessUrl: DEFAULT_WITNESS_URL, sensorMotion: false, sensorMotionGranted: false }, d.settings || {});
    if (!state.settings.witnessUrl) state.settings.witnessUrl = DEFAULT_WITNESS_URL;
    return true;
  }
  async function loadKeys(pin) {
    const raw = localStorage.getItem(SK + '_keys');
    if (!raw) throw new Error('No keys');
    const keys = await HCP.decryptWithPIN(JSON.parse(raw), pin);
    state.publicKeyJwk = keys.publicKey;
    state.privateKeyJwk = keys.privateKey;
    const pair = await HCP.importKeyPair(keys.publicKey, keys.privateKey);
    state.publicKey = pair.publicKey;
    state.privateKey = pair.privateKey;
  }

  // --- Chain append (handles genesis protocol commitment) ---
  async function appendRecord(record) {
    // Duplicate guard: reject if last record matches counterparty + value + timestamp within 30s
    if (state.chain.length > 0) {
      const last = state.chain[state.chain.length - 1];
      if (last.counterparty === record.counterparty && last.value === record.value && last.energyState === record.energyState) {
        const timeDiff = Math.abs(new Date(record.timestamp).getTime() - new Date(last.timestamp).getTime());
        if (timeDiff < 30000) {
          console.log('[chain] Duplicate record blocked:', record.counterparty, record.value, timeDiff + 'ms');
          return;
        }
      }
    }
    if (state.chain.length === 0 && !record.protocolCommitment) {
      record.protocolCommitment = HCP.bufToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(HCP.COMMITMENT_TEXT)));
    }
    await HCP.appendToChain(state.chain, record, state.privateKey);
  }

  // --- Screens ---
  function showScreen(id) { document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; }); const el = document.getElementById(id); el.classList.add('active'); el.style.display = 'flex'; }
  var _returnToWallet = false;
  function showModal(id) {
    if (fabOpen) toggleFab();
    const el = document.getElementById(id + '-overlay');
    el.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('active')));
  }
  function closeModal(id) {
    const el = document.getElementById(id + '-overlay');
    el.classList.remove('active');
    setTimeout(() => { if (!el.classList.contains('active')) el.style.display = 'none'; }, 320);
    // Return to wallet if this was a child modal
    if (_returnToWallet && (id === 'chain')) {
      _returnToWallet = false;
      setTimeout(() => openWallet(), 340);
    }
    // Refresh active tab after modal closes (e.g., exchange completed)
    if (activeTab) setTimeout(function() { switchTab(activeTab); }, 350);
  }

  // --- Toast ---
  function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(el._tid); el._tid = setTimeout(() => el.classList.remove('show'), 2000); }

  // --- Utilities ---
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function openCamera() {
    toast('Open your camera app \u2014 point at the QR code');
  }

  // --- PIN ---
  function buildNumpad(cid, did, len, cb) {
    const container = document.getElementById(cid), display = document.getElementById(did);
    let val = '';
    display.innerHTML = '';
    for (let i = 0; i < len; i++) { const d = document.createElement('div'); d.className = 'pin-dot'; display.appendChild(d); }
    container.innerHTML = '';
    ['1','2','3','4','5','6','7','8','9','','0','\u232b'].forEach(k => {
      const b = document.createElement('button');
      if (k === '') b.className = 'empty';
      else if (k === '\u232b') { b.className = 'del'; b.textContent = '\u232b'; }
      else b.textContent = k;
      b.addEventListener('click', () => {
        if (!k) return;
        if (k === '\u232b') val = val.slice(0, -1);
        else if (val.length < len) val += k;
        const dots = display.querySelectorAll('.pin-dot');
        dots.forEach((d, i) => { d.classList.toggle('filled', i < val.length); d.classList.remove('error'); });
        if (val.length === len) setTimeout(() => cb(val, () => { val = ''; dots.forEach(d => d.classList.remove('filled')); }, () => { dots.forEach(d => d.classList.add('error')); setTimeout(() => { val = ''; dots.forEach(d => { d.classList.remove('filled', 'error'); }); }, 500); }), 150);
      });
      container.appendChild(b);
    });
  }

  // --- Setup ---
  let setupPIN = '';

  function setupStep(step) {
    document.querySelectorAll('#setup .step').forEach(s => s.classList.remove('active'));
    document.getElementById('setup-' + step).classList.add('active');
    // Scroll to top of setup screen
    document.getElementById('setup').scrollTop = 0;
    if (step === 'pin') buildNumpad('setup-numpad', 'setup-pin-display', 4, (pin, reset) => { setupPIN = pin; reset(); setupStep('confirm'); });
    else if (step === 'confirm') buildNumpad('setup-confirm-numpad', 'setup-confirm-display', 4, async (pin, reset, shake) => { if (pin === setupPIN) { state.pin = pin; setupStep('photo'); } else shake(); });
    else if (step === 'range') { rangeStep = 0; document.querySelectorAll('#setup-range .range-substep').forEach(s => s.classList.remove('active')); document.querySelector('#setup-range .range-substep[data-rs="0"]').classList.add('active'); document.querySelectorAll('#range-progress .rp-dot').forEach((d,i) => { d.className = 'rp-dot' + (i === 0 ? ' current' : ''); }); }
  }

  function capturePhoto() { document.getElementById('photo-capture-input').click(); }
  function uploadPhoto() { document.getElementById('photo-file-input').click(); }
  function handlePhotoFile(event) {
    const file = event.target.files[0]; if (!file) return;
    const isCamera = event.target.hasAttribute('capture');
    const reader = new FileReader();
    reader.onload = e => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const max = 400; let w = img.width, h = img.height; if (w > h) { if (w > max) { h = h * max / w; w = max; } } else { if (h > max) { w = w * max / h; h = max; } } c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); const du = c.toDataURL('image/jpeg', 0.8); state.declarations.photo = du; state.declarations.photoDate = new Date().toISOString(); state.declarations.photoSource = isCamera ? 'camera' : 'file'; const p = document.getElementById('setup-photo-preview'); p.innerHTML = '<img src="' + du + '">'; p.classList.add('has-photo'); }; img.src = e.target.result; };
    reader.readAsDataURL(file); event.target.value = '';
  }
  function submitDeclarations() {
    state.declarations.about = document.getElementById('setup-about').value.trim();
    // Save name from the name step
    state.declarations.name = (document.getElementById('setup-name-input').value || '').trim();
    // Skip range exercise (now available in Learn tab as "Find Your Unit")
    setupStep('sensors');
  }
  function skipDeclarations() {
    // Save name from the name step
    state.declarations.name = (document.getElementById('setup-name-input').value || '').trim();
    setupStep('sensors');
  }

  // --- Range sub-step navigation ---
  let rangeStep = 0;

  function rangeNav(step) {
    // Validate before advancing
    if (step > rangeStep) {
      if (rangeStep === 1) {
        const cv = parseFloat(document.getElementById('range-cancer-val').value);
        if (!cv || cv <= 0) { toast('Give it a value before continuing'); return; }
      } else if (rangeStep === 2) {
        const sv = parseFloat(document.getElementById('range-simple-val').value);
        if (!sv || sv <= 0) { toast('Give the small favor a number before continuing'); return; }
      } else if (rangeStep === 3) {
        const dv = parseFloat(document.getElementById('range-daily-val').value);
        if (!dv || dv <= 0) { toast('Give a full day of work a number before continuing'); return; }
      } else if (rangeStep === 4) {
        const cv = parseFloat(document.getElementById('range-complex-val').value);
        const sv = parseFloat(document.getElementById('range-simple-val').value);
        if (!cv || cv <= 0) { toast('Give your best work a number before continuing'); return; }
        if (cv <= sv) { toast('This should be higher than your small favor'); return; }
      }
    }

    rangeStep = step;
    document.querySelectorAll('#setup-range .range-substep').forEach(s => s.classList.remove('active'));
    const target = document.querySelector('#setup-range .range-substep[data-rs="' + step + '"]');
    if (target) target.classList.add('active');

    // Update progress dots
    document.querySelectorAll('#range-progress .rp-dot').forEach((d, i) => {
      d.className = 'rp-dot' + (i < step ? ' done' : i === step ? ' current' : '');
    });

    // Populate dynamic references
    if (step === 3) {
      const sv = document.getElementById('range-simple-val').value;
      const ref = document.getElementById('range-ref-daily');
      if (sv) { ref.textContent = 'You valued a small favor at ' + sv + '. Now think about a full day.'; ref.style.display = 'block'; }
      else { ref.style.display = 'none'; }
    } else if (step === 4) {
      const sv = document.getElementById('range-simple-val').value;
      const dvl = document.getElementById('range-daily-val').value;
      const ref = document.getElementById('range-ref-complex');
      if (sv && dvl) { ref.textContent = 'You valued a small favor at ' + sv + ' and a full day at ' + dvl + '. Now think about the best you are capable of.'; ref.style.display = 'block'; }
      else { ref.style.display = 'none'; }
    } else if (step === 5) {
      buildRangeResult();
    }

    document.getElementById('setup').scrollTop = 0;
  }

  function toggleValTag(el) { el.classList.toggle('selected'); }

  function getValTags(containerId) {
    const tags = [];
    document.querySelectorAll('#' + containerId + ' .val-tag.selected').forEach(t => tags.push(t.textContent));
    return tags;
  }

  function buildRangeResult() {
    const sv = parseFloat(document.getElementById('range-simple-val').value) || 0;
    const cv = parseFloat(document.getElementById('range-complex-val').value) || 0;
    const dv = parseFloat(document.getElementById('range-daily-val').value) || 0;
    const sd = 'A small favor';
    const cd = 'Your best work';
    const dd = 'A full day of work';

    const container = document.getElementById('range-result-viz');
    if (!sv || !cv || cv <= sv) { container.innerHTML = '<p style="color:var(--text-faint);">Complete all steps to see your values.</p>'; return; }

    const SCALE_MAX = 1000000;
    function fmt(n) { return n.toLocaleString(); }

    // Calculate the true linear percentage for the highest user value
    var maxUserVal = Math.max(sv, cv, dv);
    var pctOfScale = Math.round((maxUserVal / SCALE_MAX) * 100);
    var barPct = Math.max(5, Math.min(pctOfScale, 95)); // visual width of green zone, at least 5%

    var html = '';

    // Full scale bar
    html += '<div style="margin-top:8px;">';
    html += '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-faint); margin-bottom:4px;"><span>0</span><span>1,000,000</span></div>';
    html += '<div style="position:relative; height:16px; background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">';
    html += '<div style="position:absolute; left:0; top:0; bottom:0; width:' + barPct + '%; background:rgba(43,140,62,0.3); border-radius:8px 0 0 8px;"></div>';
    html += '<div style="position:absolute; right:0; top:0; bottom:0; width:3px; background:var(--red); border-radius:0 8px 8px 0;"></div>';
    html += '</div>';

    // Labels row
    html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:6px;">';
    html += '<div style="font-size:11px; color:var(--green); font-weight:500;">&#9660; you are here</div>';
    html += '<div style="font-size:11px; color:var(--text-dim); text-align:right;">';
    html += '<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--red); vertical-align:middle; margin-right:3px;"></span>';
    html += '1,000,000 — Curing cancer</div>';
    html += '</div>';

    // Callout box
    html += '<div style="margin-top:12px; border-left:2px solid var(--green); padding:14px 0 14px 14px; background:var(--bg-raised); border-radius:0 var(--radius) var(--radius) 0;">';
    html += '<div style="font-size:12px; color:var(--text-faint); margin-bottom:12px;">Your values on the shared scale:</div>';

    // Simple
    html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
    html += '<div style="width:10px; height:10px; border-radius:50%; background:var(--green); flex-shrink:0;"></div>';
    html += '<div style="font-size:14px;"><span style="font-weight:500; color:var(--accent); margin-right:6px;">' + fmt(sv) + '</span><span style="color:var(--text-dim);">' + sd + '</span></div>';
    html += '</div>';
    var stags = getValTags('vt-simple');
    if (stags.length) html += '<div style="font-size:11px; color:var(--text-faint); margin:-6px 0 10px 18px;">' + stags.join(' · ') + '</div>';

    // Daily
    if (dv > 0) {
      html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
      html += '<div style="width:10px; height:10px; border-radius:50%; background:var(--blue, #6ba3d6); flex-shrink:0;"></div>';
      html += '<div style="font-size:14px;"><span style="font-weight:500; color:var(--accent); margin-right:6px;">' + fmt(dv) + '</span><span style="color:var(--text-dim);">' + dd + '</span></div>';
      html += '</div>';
      var dtags = getValTags('vt-daily');
      if (dtags.length) html += '<div style="font-size:11px; color:var(--text-faint); margin:-6px 0 10px 18px;">' + dtags.join(' · ') + '</div>';
    }

    // Complex / Personal ceiling
    html += '<div style="display:flex; align-items:center; gap:8px;">';
    html += '<div style="width:10px; height:10px; border-radius:50%; background:var(--red, #d66b6b); flex-shrink:0;"></div>';
    html += '<div style="font-size:14px;"><span style="font-weight:500; color:var(--accent); margin-right:6px;">' + fmt(cv) + '</span><span style="color:var(--text-dim);">' + cd + '</span></div>';
    html += '</div>';
    var ctags = getValTags('vt-complex');
    if (ctags.length) html += '<div style="font-size:11px; color:var(--text-faint); margin:4px 0 0 18px;">' + ctags.join(' · ') + '</div>';

    html += '</div>'; // close callout

    // Context message
    html += '<div style="font-size:13px; color:var(--text-dim); margin-top:14px; line-height:1.6;">';
    html += 'Almost everything you will ever exchange fits in a small portion of the full scale. That is completely normal. The range exists so that when something truly extraordinary happens, the scale can hold it. You and every other person share this same ruler.';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function rangeUpdate() {
    // Legacy compatibility — no longer drives live updates, result is built on step 5
  }

  function submitRange() {
    const sv = parseFloat(document.getElementById('range-simple-val').value);
    const cv = parseFloat(document.getElementById('range-complex-val').value);
    if (!sv || !cv || sv <= 0 || cv <= 0) {
      toast('Please fill in at least your simple and best work values');
      return;
    }
    if (cv <= sv) {
      toast('Your best work value should be higher than your small favor value');
      return;
    }
    // Save name from the name step
    state.declarations.name = (document.getElementById('setup-name-input').value || '').trim();
    // Save range exercise values — calibration, not permanent declaration
    state.declarations.rangeSimpleVal = sv;
    state.declarations.rangeComplexVal = cv;
    state.declarations.rangeDailyVal = parseFloat(document.getElementById('range-daily-val').value) || 0;
    state.declarations.rangeDeclaredAt = new Date().toISOString();
    state.declarations.scaleMax = 1000000; // Universal scale constant
    // Save valuation tags
    state.declarations.valTagsSimple = getValTags('vt-simple');
    state.declarations.valTagsDaily = getValTags('vt-daily');
    state.declarations.valTagsComplex = getValTags('vt-complex');
    setupStep('sensors');
  }

  function skipRange() {
    // Save name from the name step
    state.declarations.name = (document.getElementById('setup-name-input').value || '').trim();
    // Range stays at 0/empty — pending state
    setupStep('sensors');
  }

  // --- Onboarding sensor toggles ---
  function setupToggleLocation() {
    var sw = document.getElementById('setup-switch-location');
    if (state.settings.locationAuto) {
      state.settings.locationAuto = false;
      sw.classList.remove('on');
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function() { state.settings.locationAuto = true; sw.classList.add('on'); save(); toast('Location enabled'); },
          function() { state.settings.locationAuto = false; sw.classList.remove('on'); save(); toast('Location denied by browser'); },
          { timeout: 10000 }
        );
      } else {
        toast('Location not available on this device');
      }
    }
    save();
  }

  function setupToggleMotion() {
    var sw = document.getElementById('setup-switch-motion');
    if (state.settings.sensorMotion) {
      state.settings.sensorMotion = false;
      sw.classList.remove('on');
      save();
      return;
    }
    // iOS requires explicit permission request behind user gesture
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(function(result) {
        if (result === 'granted') {
          state.settings.sensorMotion = true;
          state.settings.sensorMotionGranted = true;
          sw.classList.add('on');
          save();
          toast('Motion sensors enabled');
        } else {
          toast('Motion permission denied');
        }
      }).catch(function() { toast('Motion permission failed'); });
    } else {
      // Android/desktop — no permission needed
      state.settings.sensorMotion = true;
      state.settings.sensorMotionGranted = true;
      sw.classList.add('on');
      save();
      toast('Motion sensors enabled');
    }
  }

  function submitSensors() {
    // Save name from the name step (safety — may already be saved)
    state.declarations.name = (document.getElementById('setup-name-input').value || '').trim();
    setupStep('generating');
    generateIdentity(state.pin);
  }

  // --- Skills ---
  function addSkill(prefix) {
    const input = document.getElementById(prefix + '-skill-input');
    const raw = input.value.trim();
    if (!raw) return;
    if (!Array.isArray(state.declarations.skills)) state.declarations.skills = [];
    const items = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
    let added = 0;
    items.forEach(val => {
      if (!state.declarations.skills.includes(val)) {
        state.declarations.skills.push(val);
        added++;
      }
    });
    if (added === 0 && items.length > 0) { toast('Already added'); return; }
    input.value = '';
    renderSkillsList(prefix);
    if (prefix === 'edit') save();
  }

  function removeSkill(prefix, idx) {
    if (!Array.isArray(state.declarations.skills)) state.declarations.skills = [];
    state.declarations.skills.splice(idx, 1);
    renderSkillsList(prefix);
    if (prefix === 'edit') save();
  }

  function renderSkillsList(prefix) {
    const container = document.getElementById(prefix + '-skills-list');
    container.innerHTML = '';
    state.declarations.skills.forEach((skill, i) => {
      const chip = document.createElement('div');
      chip.className = 'skill-chip';
      chip.innerHTML = esc(skill) + '<span class="skill-remove" onclick="App.removeSkill(\'' + prefix + '\',' + i + ')">\u00d7</span>';
      container.appendChild(chip);
    });
  }

  function toggleSkillPicker() {
    const picker = document.getElementById('ex-skill-picker');
    const visible = picker.style.display !== 'none';
    picker.style.display = visible ? 'none' : 'block';
    document.getElementById('ex-skill-toggle').textContent = visible ? 'Attach skills' : 'Hide skills';
  }

  function renderSkillPicker() {
    const skills = state.declarations.skills;
    const btn = document.getElementById('ex-skill-toggle');
    if (!skills.length) { btn.style.display = 'none'; document.getElementById('ex-skill-picker').style.display = 'none'; return; }
    btn.style.display = 'block';
    const container = document.getElementById('ex-skill-chips');
    container.innerHTML = '';
    skills.forEach(skill => {
      const chip = document.createElement('button');
      chip.className = 'skill-pick';
      chip.textContent = skill;
      chip.addEventListener('click', () => { chip.classList.toggle('selected'); });
      container.appendChild(chip);
    });
  }

  function getSelectedSkills() {
    const chips = document.querySelectorAll('#ex-skill-chips .skill-pick.selected');
    return Array.from(chips).map(c => c.textContent);
  }

  async function generateIdentity(pin) {
    const pair = await HCP.generateKeyPair();
    state.publicKey = pair.publicKey; state.privateKey = pair.privateKey;
    state.publicKeyJwk = await HCP.exportKey(pair.publicKey); state.privateKeyJwk = await HCP.exportKey(pair.privateKey);
    state.fingerprint = await HCP.keyFingerprint(state.publicKeyJwk);
    state.chain = HCP.createChain(); state.initialized = true;

    // Create genesis record with photoHash and sensor snapshot
    try {
      const genesisFields = {};
      // Hash the photo if present
      if (state.declarations.photo) {
        const photoBytes = new TextEncoder().encode(state.declarations.photo);
        const photoHash = HCP.bufToHex(await crypto.subtle.digest('SHA-256', photoBytes));
        genesisFields.photoHash = photoHash;
        if (photoBytes.byteLength > MAX_PHOTO_BYTES) {
          console.warn('Photo exceeds MAX_PHOTO_BYTES (' + photoBytes.byteLength + '/' + MAX_PHOTO_BYTES + '), storing hash only');
          toast('Photo too large for on-chain storage. Hash recorded.');
        } else {
          genesisFields.photoData = state.declarations.photo;
        }
      }
      // Capture sensor data
      try {
        var snap = await captureSensor();
        if (snap.geo) genesisFields.geo = snap.geo;
        if (snap.device) genesisFields.device = snap.device;
        if (snap.sensorHash) genesisFields.sensorHash = snap.sensorHash;
        genesisFields.pohSnapshot = {
          signalHash: snap.signalHash,
          networkHash: snap.networkHash,
          webglHash: snap.webglHash,
          canvasHash: snap.canvasHash,
          batteryState: snap.batteryState,
          capabilityMask: snap.capabilityMask,
          capturedAt: snap.timestamp
        };
      } catch(se) { console.log('[genesis] Sensor capture failed:', se.message); }

      genesisFields.connectivityAvailable = navigator.onLine;
      const genesisRecord = await HCP.createGenesis(genesisFields);
      await HCP.appendToChain(state.chain, genesisRecord, state.privateKey);
      console.log('[genesis] Record created with photoHash:', genesisFields.photoHash ? 'yes' : 'no');
    } catch(ge) { console.log('[genesis] Creation failed:', ge.message); }

    await saveKeys(pin); save();
    document.getElementById('setup-fp').textContent = state.fingerprint;
    setupStep('done');
  }
  function completeSetup() { showScreen('home'); refreshHome(); showPendingUpdateBanner(); checkPingOnOpen(); }

  // --- Lock ---
  // --- PIN attempt tracking ---
  var _pinAttempts = 0;
  var _pinFirstAttemptTime = 0;
  var _pinCooldownActive = false;
  var PIN_MAX_FREE = 5;
  var PIN_COOLDOWN_SECS = 10;
  var PIN_RESET_MS = 15 * 60 * 1000; // 15 minutes

  function updatePinAttemptUI() {
    var bar = document.getElementById('pin-attempts-bar');
    var hint = document.getElementById('pin-hint');
    var attemptsEl = document.getElementById('pin-attempts');
    if (!bar || !hint) return;

    // Check for auto-reset (15 min window)
    if (_pinFirstAttemptTime && (Date.now() - _pinFirstAttemptTime > PIN_RESET_MS)) {
      _pinAttempts = 0;
      _pinFirstAttemptTime = 0;
    }

    // Show attempt bar only after first failure
    attemptsEl.style.display = _pinAttempts > 0 ? 'block' : 'none';

    var dots = bar.querySelectorAll('.pa-dot');
    var remaining = Math.max(0, PIN_MAX_FREE - _pinAttempts);
    for (var i = 0; i < dots.length; i++) {
      if (i < remaining) { dots[i].className = 'pa-dot on'; }
      else { dots[i].className = 'pa-dot'; }
    }

    if (_pinAttempts >= 3 && _pinAttempts < PIN_MAX_FREE) {
      hint.textContent = 'Did you write your PIN somewhere safe?';
    } else if (_pinAttempts >= PIN_MAX_FREE) {
      hint.textContent = '';
    } else {
      hint.textContent = '';
    }
  }

  function startPinCooldown(cb) {
    _pinCooldownActive = true;
    var coolEl = document.getElementById('pin-cooldown');
    var secsEl = document.getElementById('pin-cooldown-secs');
    var fillEl = document.getElementById('pin-cooldown-fill');
    var numpad = document.getElementById('lock-numpad');
    if (numpad) numpad.style.opacity = '0.3';
    if (numpad) numpad.style.pointerEvents = 'none';
    coolEl.style.display = 'block';
    var remaining = PIN_COOLDOWN_SECS;
    secsEl.textContent = remaining;
    fillEl.style.width = '100%';

    var iv = setInterval(function() {
      remaining--;
      if (remaining <= 0) {
        clearInterval(iv);
        coolEl.style.display = 'none';
        if (numpad) numpad.style.opacity = '1';
        if (numpad) numpad.style.pointerEvents = 'auto';
        _pinCooldownActive = false;
        // Reset attempts after cooldown so dots refill
        _pinAttempts = 0;
        _pinFirstAttemptTime = 0;
        updatePinAttemptUI();
        if (cb) cb();
        return;
      }
      secsEl.textContent = remaining;
      fillEl.style.width = ((remaining / PIN_COOLDOWN_SECS) * 100) + '%';
    }, 1000);
  }

  function showLockScreen() {
    document.getElementById('lock-fp').textContent = state.fingerprint;
    showScreen('lock');
    // Reset UI on show (but keep attempt count -- it persists in memory)
    updatePinAttemptUI();
    document.getElementById('pin-cooldown').style.display = 'none';

    buildNumpad('lock-numpad', 'lock-pin-display', 4, async (pin, reset, shake) => {
      if (_pinCooldownActive) return;

      try {
        await loadKeys(pin);
        // Success -- reset attempts
        _pinAttempts = 0;
        _pinFirstAttemptTime = 0;
        state.pin = pin;
        state.initialized = true;
        showScreen('home');
        refreshHome();
        showPendingUpdateBanner();
        checkForUpdates();
        handleIncomingPayload();
        resumePendingPair();
        checkPingOnOpen();
        checkPhotoNudge();
      } catch (e) {
        // Failed attempt
        if (!_pinFirstAttemptTime) _pinFirstAttemptTime = Date.now();
        _pinAttempts++;
        updatePinAttemptUI();
        shake();

        if (_pinAttempts >= PIN_MAX_FREE) {
          startPinCooldown(function() { reset(); });
        }
      }
    });
  }

  // --- Home ---
  function openWallet() {
    const bal = HCP.walletBalance(state.chain);
    const el = document.getElementById('wallet-amount');
    el.textContent = (bal >= 0 ? '+' : '') + bal.toFixed(0);
    el.className = 'wallet-amount ' + (bal > 0 ? 'surplus' : bal < 0 ? 'deficit' : 'zero');
    document.getElementById('wallet-position').textContent = bal > 0 ? 'provided more than received' : bal < 0 ? 'received more than provided' : 'balanced';
    let totalP = 0, totalR = 0, actsP = 0, actsR = 0;
    state.chain.forEach(r => { if (r.energyState === 'provided') { totalP += r.value; actsP++; } else if (r.energyState === 'received') { totalR += r.value; actsR++; } });
    document.getElementById('wallet-provided').textContent = '+' + totalP.toFixed(0);
    document.getElementById('wallet-received').textContent = '\u2212' + totalR.toFixed(0);
    document.getElementById('wallet-acts').textContent = state.chain.filter(HCP.isAct).length;
    // Render participation ratio
    var ratioBar = document.getElementById('wallet-ratio-bar');
    var ratioText = document.getElementById('wallet-ratio-text');
    var total = actsP + actsR;
    if (total > 0) {
      var pPct = Math.round((actsP / total) * 100);
      var rPct = 100 - pPct;
      var ratioStr = actsR > 0 ? Math.round(actsP / actsR * 10) / 10 + ' : 1' : actsP + ' : 0';
      if (ratioText) ratioText.textContent = ratioStr;
      if (ratioBar) {
        ratioBar.innerHTML = '<div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-faint); margin-bottom:4px;"><span>provided ' + actsP + '</span><span>received ' + actsR + '</span></div>' +
          '<div style="height:14px; border-radius:7px; overflow:hidden; display:flex; background:var(--bg-input);">' +
          (pPct > 0 ? '<div style="width:' + pPct + '%; background:var(--accent); border-radius:7px 0 0 7px;"></div>' : '') +
          (rPct > 0 ? '<div style="width:' + rPct + '%; background:var(--blue); border-radius:0 7px 7px 0;"></div>' : '') +
          '</div>';
      }
    } else {
      if (ratioText) ratioText.textContent = '\u2014';
      if (ratioBar) ratioBar.innerHTML = '';
    }

    // Standing content (identity panel, POH verdict, categories, etc.)
    // was moved from the removed Standing tab into this wallet modal
    // in v2.58.0. Render it into the wallet-standing-content div
    // appended to the wallet body.
    try { renderStandingTab(); } catch(e) { console.log('[wallet] Standing render failed:', e.message); }

    showModal('wallet');
  }

  function openMyTextureFromWallet() { closeModal('wallet'); _returnToWallet = true; openMyTexture(); }
  function openMyPricingFromWallet() { closeModal('wallet'); _returnToWallet = true; openMyPricing(); }
  function openChainViewerFromWallet() { closeModal('wallet'); _returnToWallet = true; openChainViewer(); }

  function showMyPhotos() {
    var genesis = null;
    for (var i = 0; i < state.chain.length; i++) {
      if (state.chain[i].type === HCP.RECORD_TYPE_GENESIS && state.chain[i].photoHash) {
        genesis = state.chain[i];
        break;
      }
    }

    var current = state.declarations.photo;
    var currentDate = state.declarations.photoDate;

    var html = '<div style="position:fixed; inset:0; background:var(--bg); z-index:9999; padding:20px; padding-top:calc(20px + var(--safe-top)); overflow-y:auto; display:flex; flex-direction:column; align-items:center;">';
    html += '<div style="width:100%; max-width:400px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">';
    html += '<h2 style="font-size:18px; color:var(--text); margin:0;">My Photos</h2>';
    html += '<button onclick="this.closest(\'div[style*=fixed]\').remove();" style="background:none; border:none; color:var(--text-dim); font-size:24px; cursor:pointer;">&#10005;</button>';
    html += '</div>';
    html += '<p style="font-size:13px; color:var(--text-dim); margin-bottom:20px; line-height:1.5;">Show this screen to the person you are exchanging with. They can compare your genesis photo with how you look now.</p>';

    // Genesis photo
    html += '<div style="margin-bottom:20px;">';
    html += '<div style="font-size:13px; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Genesis photo</div>';
    if (genesis && genesis.photoHash) {
      html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:8px; text-align:center;">';
      if (genesis.photoData) {
        html += '<img src="' + genesis.photoData + '" style="max-width:100%; max-height:300px; border-radius:8px;">';
      }
      html += '<div style="font-size:13px; color:var(--text-dim); margin-top:8px;">Hash: ' + genesis.photoHash.substring(0, 16) + '...</div>';
      html += '<div style="font-size:12px; color:var(--text-faint); margin-top:4px;">' + new Date(genesis.timestamp).toLocaleDateString() + '</div>';
      html += '</div>';
    } else {
      html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; text-align:center; color:var(--text-faint); font-size:14px;">No genesis photo recorded</div>';
    }
    html += '</div>';

    // Current photo
    html += '<div style="margin-bottom:20px;">';
    html += '<div style="font-size:13px; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Current photo</div>';
    if (current) {
      html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:8px; text-align:center;">';
      html += '<img src="' + current + '" style="max-width:100%; max-height:300px; border-radius:8px;">';
      if (currentDate) html += '<div style="font-size:12px; color:var(--text-faint); margin-top:8px;">' + new Date(currentDate).toLocaleDateString() + '</div>';
      if (state.declarations.photoSource) html += '<div style="font-size:11px; color:var(--text-faint);">Source: ' + state.declarations.photoSource + '</div>';
      html += '</div>';
    } else {
      html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; text-align:center; color:var(--text-faint); font-size:14px;">No photo set. Add one in your declarations.</div>';
    }
    html += '</div>';

    html += '</div></div>';

    var overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay.firstChild);
  }

  function openRecentActs() {
    document.getElementById('recent-search').value = '';
    renderRecentActs('');
    showModal('recent');
  }

  function renderRecentActs(query) {
    const body = document.getElementById('recent-body');
    const exchanges = state.chain.filter(HCP.isAct);
    if (!exchanges.length) { body.innerHTML = '<div class="empty-state">No acts recorded yet.<br>Tap Cooperate to start.</div>'; return; }
    const q = query.toLowerCase();
    const filtered = q ? exchanges.filter(r => {
      const desc = (r.description || '').toLowerCase();
      const cat = (r.category || '').toLowerCase();
      const name = (r.counterpartyName || '').toLowerCase();
      return desc.includes(q) || cat.includes(q) || name.includes(q);
    }) : exchanges;
    if (!filtered.length) { body.innerHTML = '<div class="empty-state">No matching acts found.</div>'; return; }
    body.innerHTML = '';
    filtered.slice().reverse().forEach(r => {
      const card = document.createElement('div');
      card.className = 'reuse-card';
      const desc = r.description || r.category || r.type;
      const name = r.counterpartyName || r.counterparty.substring(0, 8) + '\u2026';
      const ds = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' \u00b7 ' + new Date(r.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const dir = r.energyState === 'provided' ? 'Provided' : 'Received';
      card.innerHTML = `<div class="rc-desc">${esc(desc)}</div><div class="rc-meta">${dir} \u00b7 ${esc(name)} \u00b7 ${ds}${r.duration ? ' \u00b7 ' + formatDuration(r.duration) : ''}${r.category ? ' \u00b7 ' + esc(r.category) : ''}</div><div class="rc-val">${r.value} units</div>`;
      card.addEventListener('click', () => reuseAct(r));
      body.appendChild(card);
    });
  }

  function filterRecentActs() {
    renderRecentActs(document.getElementById('recent-search').value.trim());
  }

  function reuseAct(record) {
    closeModal('recent');
    openExchange();
    setDirection(record.energyState);
    document.getElementById('ex-desc').value = record.description || '';
    document.getElementById('ex-value').value = record.value || '';
    document.getElementById('ex-category').value = record.category || '';
    if (record.duration) {
      const hrs = Math.floor(record.duration / 60);
      const mins = record.duration % 60;
      document.getElementById('ex-hours').value = hrs || '';
      document.getElementById('ex-minutes').value = mins || '';
    }
    if (record.city) document.getElementById('ex-city').value = record.city;
    if (record.state) document.getElementById('ex-state').value = record.state;
    showPrefillBar(record.description || record.category || 'Previous act');
  }

  function togglePasteMode(prefix) {
    const section = document.getElementById(prefix + '-paste-section');
    section.classList.toggle('visible');
  }

  function inviteViaText() {
    const url = getAppBase();
    const msg = 'Try the Human Exchange Protocol \u2014 record your cooperative acts. ' + url;
    if (navigator.share) { navigator.share({ title: 'Human Exchange Protocol', text: msg }).catch(() => {}); }
    else { navigator.clipboard.writeText(msg).then(() => toast('Link copied \u2014 paste in a message')).catch(() => toast('Could not copy')); }
  }

  function inviteViaQR() { openShare(); }

  // --- Pending Transactions ---
  const PENDING_KEY = 'hcp_pending_items';

  function loadPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch(e) { return []; }
  }

  function savePending(items) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  }

  function addPendingItem(item) {
    const items = loadPending();
    items.push(Object.assign({ id: Date.now().toString(36), created: Date.now() }, item));
    savePending(items);
    renderPendingBar();
  }

  function deletePendingItem(id) {
    const items = loadPending().filter(p => p.id !== id);
    savePending(items);
    renderPendingBar();
    renderPendingList();
    if (!items.length) closeModal('pending');
    // Kill any orphaned polls
    stopRelayPoll();
    stopPairPoll();
    stopSessionPoll();
    if (state.relayPollInterval) { clearInterval(state.relayPollInterval); state.relayPollInterval = null; }
    toast('Removed');
  }

  function deleteAllPending() {
    savePending([]);
    renderPendingBar();
    renderPendingList();
    closeModal('pending');
    // Kill all polls
    stopRelayPoll();
    stopPairPoll();
    stopSessionPoll();
    if (state.relayPollInterval) { clearInterval(state.relayPollInterval); state.relayPollInterval = null; }
    // Clear pending pair data
    state.pendingPair = null;
    localStorage.removeItem('hcp_pending_pair');
    toast('All pending cleared');
  }

  function renderPendingBar() {
    var items = loadPending();
    // Remove any session-tagged items (session flow no longer uses pending)
    var cleaned = items.filter(function(p) { return p.transport !== 'session'; });
    if (cleaned.length !== items.length) savePending(cleaned);
    items = cleaned;
    const bar = document.getElementById('pending-bar');
    if (!items.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    document.getElementById('pending-count').textContent = items.length;
    document.querySelector('.pending-text').textContent = items.length === 1 ? 'pending exchange' : 'pending exchanges';
  }

  function openPending() {
    showModal('pending');
    renderPendingList();
  }

  function renderPendingList() {
    const body = document.getElementById('pending-body');
    const items = loadPending();
    if (!items.length) { body.innerHTML = '<div class="empty-state">No pending exchanges.</div>'; return; }
    body.innerHTML = '<div style="text-align:right; margin-bottom:12px;"><button style="font-size:13px; color:var(--red); background:none; text-decoration:underline;" onclick="App.deleteAllPending()">Delete all</button></div>';
    items.forEach(p => {
      const card = document.createElement('div');
      card.className = 'pending-card';
      const age = Date.now() - p.created;
      const ageText = age < 3600000 ? Math.ceil(age / 60000) + 'm ago' : age < 86400000 ? Math.ceil(age / 3600000) + 'h ago' : Math.ceil(age / 86400000) + 'd ago';
      const isStale = age > 24 * 3600000; // 24 hours

      // Honest status language
      let statusText;
      if (p.transport === 'pair') {
        statusText = p.status === 'provisional' ? 'Paired \u00b7 Waiting for server to resolve' : 'Paired \u00b7 Waiting for their half';
      } else if (p.status === 'provisional') {
        statusText = 'Confirmed on your side \u00b7 Waiting for settlement';
      } else if (p.role === 'initiator') {
        statusText = 'Proposed by you \u00b7 Waiting for their confirmation';
      } else {
        statusText = 'Received from them \u00b7 Waiting for you to confirm';
      }
      if (isStale && p.status !== 'provisional') {
        statusText = 'Stale \u00b7 No response in ' + Math.ceil(age / 86400000) + ' day' + (Math.ceil(age / 86400000) > 1 ? 's' : '');
      }

      const dir = p.direction === 'provided' ? 'Providing' : 'Receiving';
      let pairInfo = '';
      if (p.transport === 'pair' && p.pairCode) {
        pairInfo = '<div style="margin-top:8px;padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);text-align:center;">' +
          '<div style="font-size: 13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Your code</div>' +
          '<div style="font-family:var(--font-mono);font-size:22px;font-weight:600;color:var(--accent);letter-spacing:6px;">' + esc(p.pairCode) + '</div>' +
          '</div>';
      }

      card.innerHTML = '<div class="pc-status"' + (isStale ? ' style="color:var(--text-faint);"' : '') + '>' + esc(statusText) + '</div>' +
        '<div class="pc-desc">' + esc(p.description || 'Exchange') + '</div>' +
        '<div class="pc-meta">' + dir + ' \u00b7 ' + (p.value || 0) + ' units' + (p.category ? ' \u00b7 ' + esc(p.category) : '') + '</div>' +
        '<div class="pc-expires">' + ageText + '</div>' +
        pairInfo +
        '<div class="pc-actions">' +
          (p.role === 'confirmer' && p.status !== 'provisional' ? '<button class="pc-action pc-action-resume" onclick="App.resumePending(\'' + p.id + '\')">Confirm now</button>' : '') +
          '<button class="pc-action pc-action-delete" onclick="App.deletePendingItem(\'' + p.id + '\')">Delete</button>' +
        '</div>';
      body.appendChild(card);
    });
  }

  function resumePending(id) {
    const items = loadPending();
    const item = items.find(p => p.id === id);
    if (!item || !item.payload) { toast('Cannot resume'); return; }
    closeModal('pending');
    try {
      const parsed = HCP.parseHandshakePayload(item.payload);
      openConfirm();
      setTimeout(() => showCfReview(parsed), 300);
    } catch(e) { toast('Invalid pending data'); }
  }

  // --- Pre-fill indicator ---
  let prefillSource = null;

  function showPrefillBar(desc) {
    prefillSource = desc;
    document.getElementById('ex-prefill-desc').textContent = desc;
    document.getElementById('ex-prefill-bar').style.display = 'flex';
  }

  function clearPrefill() {
    prefillSource = null;
    document.getElementById('ex-prefill-bar').style.display = 'none';
    ['ex-desc','ex-value','ex-category','ex-duration','ex-hours','ex-minutes','ex-city','ex-state'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    setDirection('provided');
    exRenderCategoryPills('');
    var ctx = document.getElementById('ex-pricing-context');
    if (ctx) ctx.innerHTML = '';
    toast('Cleared');
  }

  function refreshHome() {
    const name = state.declarations.name || '';
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('home-greeting').textContent = name ? greeting + ', ' + name : 'Your Thread';
    // Re-render Home tab (primary landing) so totals + recent list reflect
    // the latest chain state after any change. renderStandingTab still
    // gets called here so an open wallet modal also refreshes in place.
    renderHomeTab();
    renderStandingTab();
  }

  function makeCard(r) {
    const card = document.createElement('div'); card.className = 'record-card ' + (r.energyState === 'provided' ? 'provided-card' : 'received-card');
    const icon = r.energyState === 'provided' ? '\u2191' : '\u2193';
    const desc = r.description || r.category || r.type;
    const name = r.counterpartyName || r.counterparty.substring(0, 8) + '\u2026';
    const ds = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' \u00b7 ' + new Date(r.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    let cpDescHtml = '';
    // Build expanded detail
    let detailHtml = '<div class="record-detail">';
    detailHtml += '<div class="rd-row"><span class="rd-label">Description</span><span class="rd-val">' + esc(desc) + '</span></div>';
    detailHtml += '<div class="rd-row"><span class="rd-label">Value</span><span class="rd-val">' + r.value + ' units</span></div>';
    detailHtml += '<div class="rd-row"><span class="rd-label">Direction</span><span class="rd-val">' + (r.energyState === 'provided' ? 'Provided' : 'Received') + '</span></div>';
    if (r.category) detailHtml += '<div class="rd-row"><span class="rd-label">Category</span><span class="rd-val">' + esc(r.category) + '</span></div>';
    if (r.duration) detailHtml += '<div class="rd-row"><span class="rd-label">Duration</span><span class="rd-val">' + formatDuration(r.duration) + '</span></div>';
    detailHtml += '<div class="rd-row"><span class="rd-label">Counterparty</span><span class="rd-val">' + esc(name) + '</span></div>';
    detailHtml += '<div class="rd-row"><span class="rd-label">Fingerprint</span><span class="rd-val" style="font-family:var(--font-mono);font-size: 13px;">' + esc(r.counterparty) + '</span></div>';
    if (r.city || r.state) detailHtml += '<div class="rd-row"><span class="rd-label">Location</span><span class="rd-val">' + esc([r.city, r.state].filter(Boolean).join(', ')) + '</span></div>';
    detailHtml += '<div class="rd-row"><span class="rd-label">Timestamp</span><span class="rd-val">' + new Date(r.timestamp).toLocaleString() + '</span></div>';
    detailHtml += '<div class="rd-row"><span class="rd-label">Sequence</span><span class="rd-val">#' + r.seq + '</span></div>';
    if (r.witnessAttestation) detailHtml += '<div class="rd-row"><span class="rd-label">Witnessed</span><span class="rd-val" style="color:var(--green);">\u2713 Server attested</span></div>';
    detailHtml += '</div>';

    card.innerHTML = `<div class="dir ${r.energyState}">${icon}</div><div class="info"><div class="desc">${esc(desc)}</div>${cpDescHtml}<div class="meta">${esc(name)} \u00b7 ${ds}${r.duration ? ' \u00b7 ' + formatDuration(r.duration) : ''}</div>${detailHtml}</div><div class="val ${r.energyState}">${r.energyState === 'received' ? '\u2212' : '+'}${r.value}</div>`;
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const detail = card.querySelector('.record-detail');
      if (detail) detail.classList.toggle('expanded');
    });
    return card;
  }

  function formatDuration(mins) {
    if (mins < 60) return mins + 'm';
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
  }

  // --- Fullscreen QR ---
  function showFullQR(id) {
    const data = QR._data[id];
    if (!data) return;
    const overlay = document.getElementById('qr-fullscreen');
    const canvas = document.getElementById('qr-full-canvas');
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.85;
    QR.render(data, canvas, Math.floor(size));
    overlay.style.display = 'flex';
  }

  function closeFullQR() {
    document.getElementById('qr-fullscreen').style.display = 'none';
  }

  // --- Exchange (Initiator Side) ---
  function showExStep(step) {
    document.querySelectorAll('#exchange-body .hs-step').forEach(s => s.classList.remove('active'));
    document.getElementById('ex-step-' + step).classList.add('active');
    // Sync 4-step indicator
    var metaStep = 1;
    if (step === 'connect') metaStep = 1;
    else if (step === 'verify' || step === 'texture' || step === 'role') metaStep = 2;
    else if (step === 'done') metaStep = 4;
    else metaStep = 3; // form, receiver-wait, transport, pair, session, proposal, waiting, settle
    var indicator = document.getElementById('ex4-indicator');
    if (indicator) {
      indicator.querySelectorAll('.ex4-step').forEach(function(el) {
        var s = parseInt(el.getAttribute('data-step'));
        var numEl = el.querySelector('.ex4-num');
        el.classList.remove('active', 'done');
        if (s < metaStep) {
          el.classList.add('done');
          numEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        } else {
          el.classList.toggle('active', s === metaStep);
          numEl.textContent = s;
        }
      });
      indicator.querySelectorAll('.ex4-line').forEach(function(el, i) {
        el.classList.toggle('done', i + 1 < metaStep);
      });
    }
  }

  // --- Cooperate Flow (v2.13.0) ---
  function openCooperate() {
    const body = document.getElementById('cooperate-body');
    body.innerHTML = '';
    const hasRange = state.declarations.rangeSimpleVal > 0 && state.declarations.rangeComplexVal > 0;

    if (!state.chain.length) {
      let html = '';
      if (!hasRange) {
        // Strong pre-exchange prompt for undone scale exercise
        html += '<div style="padding:16px; background:rgba(42,90,143,0.08); border:1px solid var(--accent-dim); border-radius:var(--radius); margin-bottom:16px; line-height:1.6;">';
        html += '<div style="font-size:16px; font-weight:500; color:var(--text); margin-bottom:10px;">Before your first exchange</div>';
        html += '<div style="font-size:15px; color:var(--text-dim); margin-bottom:10px;">It is really worth taking the time to think about how you value things. It may take you one minute, it might take five, but it matters. It helps you understand your own effort and helps the other person understand you.</div>';
        html += '<div style="font-size:15px; color:var(--text-dim); margin-bottom:14px;">If you want to cooperate well, this is how you start.</div>';
        html += '<button class="btn btn-primary" style="width:100%; margin-bottom:8px;" onclick="App.closeModal(\'cooperate\'); App.openDeclareRange();">Take a few minutes to do the scale exercise</button>';
        html += '<button class="btn btn-secondary" style="width:100%; font-size:14px;" onclick="App.dismissRangePrompt()">Continue without it</button>';
        html += '</div>';
      }
      html += '<div class="coop-empty">';
      html += '<p>As you cooperate with people, your acts will appear here. Each one can be reused with a single tap.</p>';
      html += '<button class="btn btn-primary" onclick="App.coopNewAct()">Start your first act</button>';
      html += '<button class="coop-receive-btn" style="margin-top:12px;" onclick="App.coopReceiveProposal()">Receive a proposal</button>';
      html += '</div>';
      body.innerHTML = html;
      showModal('cooperate');
      return;
    }

    // Subtle nudge for experienced users who still haven't declared
    let rangeNudge = '';
    if (!hasRange) {
      rangeNudge = '<div style="padding:12px 14px; background:rgba(42,90,143,0.08); border:1px solid var(--accent-dim); border-radius:var(--radius); margin-bottom:14px; font-size:14px; color:var(--text-dim); line-height:1.5;">' +
      'You have not done the scale exercise yet. It helps you think about how you value your effort before exchanging. ' +
      '<button style="background:none; border:none; color:var(--accent); font-size:14px; font-weight:500; text-decoration:underline; cursor:pointer; padding:0; margin-top:4px; display:block;" onclick="App.closeModal(\'cooperate\'); App.openDeclareRange();">Do the scale exercise</button>' +
      '</div>';
    }

    // Build reusable acts grouped by description, sorted by frequency
    const actMap = {};
    state.chain.forEach(r => {
      const key = (r.description || '').trim().toLowerCase();
      if (!key) return;
      if (!actMap[key]) {
        actMap[key] = {
          description: r.description,
          category: r.category,
          value: r.value,
          energyState: r.energyState,
          duration: r.duration,
          city: r.city,
          state_field: r.state,
          counterpartyName: r.counterpartyName,
          counterparty: r.counterparty,
          count: 0,
          lastUsed: r.timestamp
        };
      }
      actMap[key].count++;
      // Keep the most recent version's details
      if (r.timestamp > actMap[key].lastUsed) {
        actMap[key].value = r.value;
        actMap[key].energyState = r.energyState;
        actMap[key].category = r.category;
        actMap[key].duration = r.duration;
        actMap[key].counterpartyName = r.counterpartyName;
        actMap[key].counterparty = r.counterparty;
        actMap[key].lastUsed = r.timestamp;
      }
    });

    const acts = Object.values(actMap).sort((a, b) => b.count - a.count);

    // New act button — primary action at top
    if (rangeNudge) { body.innerHTML = rangeNudge; }
    const newBtn = document.createElement('button');
    newBtn.className = 'coop-new-btn';
    newBtn.style.marginTop = '0';
    newBtn.style.marginBottom = '12px';
    newBtn.textContent = '+ Something new';
    newBtn.addEventListener('click', () => coopNewAct());
    body.appendChild(newBtn);

    // Receive a proposal button
    const receiveBtn = document.createElement('button');
    receiveBtn.className = 'coop-receive-btn';
    receiveBtn.textContent = 'Receive a proposal';
    receiveBtn.addEventListener('click', () => coopReceiveProposal());
    body.appendChild(receiveBtn);

    // Reusable acts below
    const hdr = document.createElement('div');
    hdr.className = 'coop-section-hdr';
    hdr.textContent = 'Or repeat a previous act';
    body.appendChild(hdr);

    acts.forEach(act => {
      const card = document.createElement('div');
      card.className = 'coop-act';
      const dir = act.energyState === 'provided' ? '\u2191' : '\u2193';
      const dirColor = act.energyState === 'provided' ? 'rgba(43,140,62,0.15)' : 'rgba(204,68,68,0.15)';
      const dirTextColor = act.energyState === 'provided' ? 'var(--green)' : 'var(--red)';
      const name = act.counterpartyName || '';
      const meta = [];
      if (name) meta.push(esc(name));
      if (act.category) meta.push(esc(act.category));
      if (act.count > 1) meta.push(act.count + ' times');
      card.innerHTML =
        '<div class="coop-act-icon" style="background:' + dirColor + '; color:' + dirTextColor + ';">' + dir + '</div>' +
        '<div class="coop-act-info">' +
          '<div class="coop-act-desc">' + esc(act.description) + '</div>' +
          (meta.length ? '<div class="coop-act-meta">' + meta.join(' \u00b7 ') + '</div>' : '') +
        '</div>' +
        '<div class="coop-act-val">' + act.value + '</div>' +
        '<div class="coop-act-arrow">\u203A</div>';
      card.addEventListener('click', () => coopReuseAct(act));
      body.appendChild(card);
    });

    showModal('cooperate');
  }

  function coopNewAct() {
    closeModal('cooperate');
    openExchange();
    // Clear all fields for fresh entry
    document.getElementById('ex-desc').value = '';
    document.getElementById('ex-value').value = '';
    document.getElementById('ex-category').value = '';
    document.getElementById('ex-hours').value = '';
    document.getElementById('ex-minutes').value = '';
    document.getElementById('ex-city').value = '';
    document.getElementById('ex-state').value = '';
  }

  function coopReuseAct(act) {
    closeModal('cooperate');
    openExchange();
    setDirection(act.energyState);
    document.getElementById('ex-desc').value = act.description || '';
    document.getElementById('ex-value').value = act.value || '';
    document.getElementById('ex-category').value = act.category || '';
    if (act.duration) {
      const hrs = Math.floor(act.duration / 60);
      const mins = act.duration % 60;
      document.getElementById('ex-hours').value = hrs || '';
      document.getElementById('ex-minutes').value = mins || '';
    }
    if (act.city) document.getElementById('ex-city').value = act.city;
    if (act.state_field) document.getElementById('ex-state').value = act.state_field;
    showPrefillBar(act.description || act.category || 'Previous act');
  }

  function openExchange() {
    showModal('exchange');
    showExStep('form');
    setDirection('provided');
    state.pendingProposal = null;
    state.proposalPath = 'inperson';
    prefillSource = null;
    document.getElementById('ex-prefill-bar').style.display = 'none';
    renderSkillPicker();
  }

  function closeExchange() {
    var wasDone = _sessionWritten || (state.doneSummary && state.doneSummary.length > 0);
    state.pendingProposal = null;
    localStorage.removeItem('hcp_pending_proposal');
    exStopConnectPoll();
    exFlowActive = false;
    cleanupSession();
    closeModal('exchange');
    // Collapse cooperate toggle
    var subOpts = document.getElementById('coop-sub-opts');
    var chevron = document.getElementById('coop-chevron');
    if (subOpts) subOpts.classList.remove('open');
    if (chevron) chevron.classList.remove('open');
    refreshHome();
    if (wasDone) toast('Exchange complete');
  }

  // === Exchange form v2 ===
  var EX_CATEGORIES = ['Skilled work', 'Teaching', 'Transport', 'Food & meals', 'Care & support', 'Physical help', 'Repair', 'Creative work'];

  function exRenderCategoryPills(selected) {
    var container = document.getElementById('ex-cat-pills');
    if (!container) return;
    container.innerHTML = '';
    EX_CATEGORIES.forEach(function(cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exf-pill' + (selected === cat ? ' sel' : '');
      btn.textContent = cat;
      btn.addEventListener('click', function() {
        document.getElementById('ex-category').value = cat;
        exRenderCategoryPills(cat);
        exRenderPricingContext(cat);
      });
      container.appendChild(btn);
    });
  }

  function exRenderPricingContext(cat) {
    var ctx = document.getElementById('ex-pricing-context');
    if (!ctx) return;
    ctx.innerHTML = '';
    if (!cat) return;

    // Partner's pricing for this category
    var partnerSnap = null;
    if (sessionPartner && sessionPartner.thread_snapshot) {
      partnerSnap = typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot;
    }
    var partnerName = (partnerSnap && partnerSnap._name) || 'Partner';
    var partnerSvc = null;
    if (partnerSnap && partnerSnap._services) {
      // Find matching category across services
      var catLow = cat.toLowerCase();
      Object.keys(partnerSnap._services).forEach(function(key) {
        var s = partnerSnap._services[key];
        if (s.cat && s.cat.toLowerCase() === catLow && (!partnerSvc || s.n > partnerSvc.n)) {
          partnerSvc = s;
        }
      });
    }

    // My own history for this category
    var myVals = [];
    state.chain.forEach(function(r) {
      if (r.category && r.category.toLowerCase() === cat.toLowerCase()) {
        myVals.push(r.value);
      }
    });
    var myAvg = myVals.length ? Math.round(myVals.reduce(function(a,b){return a+b;},0) / myVals.length) : null;

    if (!partnerSvc && !myVals.length) return;

    var html = '<div class="exf-pricing-ctx">';
    if (partnerSvc && partnerSvc.n > 0 && partnerSvc.low != null) {
      html += '<div class="exf-pricing-label">' + esc(partnerName) + '\'s ' + cat.toLowerCase() + ' range</div>';
      html += exRenderRangeBar(partnerSvc.low, partnerSvc.high, partnerSvc.avg, null);
    }
    if (myAvg != null) {
      html += '<div class="exf-pricing-yours">Your past ' + cat.toLowerCase() + ': avg ' + myAvg.toLocaleString() + ' across ' + myVals.length + ' exchange' + (myVals.length > 1 ? 's' : '') + '</div>';
    }
    html += '</div>';
    ctx.innerHTML = html;
  }

  function exParseDuration(text) {
    if (!text || !text.trim()) return 0;
    text = text.trim().toLowerCase();
    // Try patterns: "2 hours", "2h", "2.5 hours", "30 min", "30m", "1h 30m", "90"
    var totalMins = 0;
    var hMatch = text.match(/([\d.]+)\s*h/);
    var mMatch = text.match(/([\d.]+)\s*m/);
    if (hMatch) totalMins += Math.round(parseFloat(hMatch[1]) * 60);
    if (mMatch) totalMins += Math.round(parseFloat(mMatch[1]));
    if (!hMatch && !mMatch) {
      // Plain number -- if > 10 assume minutes, otherwise hours
      var n = parseFloat(text);
      if (!isNaN(n)) totalMins = n > 10 ? Math.round(n) : Math.round(n * 60);
    }
    return totalMins;
  }

  function setDirection(dir) {
    state.direction = dir;
    var prov = document.getElementById('dir-providing');
    var recv = document.getElementById('dir-receiving');
    if (prov) { prov.className = 'exf-seg-btn' + (dir === 'provided' ? ' active' : ''); }
    if (recv) { recv.className = 'exf-seg-btn' + (dir === 'received' ? ' active' : ''); }
  }

  async function generateProposal() {
    const val = parseFloat(document.getElementById('ex-value').value);
    if (isNaN(val) || val < 0) { toast('Enter a valid value'); return; }
    const desc = document.getElementById('ex-desc').value.trim();
    if (!desc) { toast('Enter a description'); return; }

    const fullDesc = desc;

    var durEl = document.getElementById('ex-duration');
    const totalMins = durEl ? exParseDuration(durEl.value) : 0;

    const details = {
      type: 'exchange',
      value: val,
      energyState: state.direction,
      description: fullDesc,
      category: document.getElementById('ex-category').value.trim() || undefined,
      duration: totalMins > 0 ? totalMins : undefined,
    };

    // Store proposal context (NOT writing to chain yet)
    state.pendingProposal = {
      details: details,
      city: document.getElementById('ex-city').value.trim() || undefined,
      state_field: document.getElementById('ex-state').value.trim() || undefined,
    };

    const knownWitnesses = getWitnessUrl() ? [getWitnessUrl()] : [];
    const payload = await HCP.generateHandshakePayload(state.publicKeyJwk, state.chain, details, state.privateKey, knownWitnesses, _cachedDeviceHash);
    state.pendingProposal.payload = payload;

    // Persist so it survives page reload (URL-based confirmation flow)
    localStorage.setItem('hcp_pending_proposal', JSON.stringify(state.pendingProposal));

    const qrUrl = getAppBase() + '?hs=' + b64Encode(payload);
    document.getElementById('proposal-payload').value = payload;
    try { QR.generate(qrUrl, document.getElementById('proposal-qr'), 300); } catch(e) { console.error('QR gen failed', e); }

    // Track as pending — only for non-session (offline) flows
    if (!exFlowActive) {
      var pendingData = { role: 'initiator', direction: details.energyState, description: details.description, value: details.value, category: details.category };
      addPendingItem(pendingData);
    }

    // New flow: already connected via session — send proposal directly
    if (exFlowActive && sessionPartner && sessionCode) {
      sendSessionProposal();
      showExStep('session');
      document.getElementById('session-code-input').style.display = 'none';
      document.getElementById('session-connect-btn').style.display = 'none';
      document.getElementById('session-status-line').textContent = 'Proposal sent — waiting for their review';
      document.getElementById('session-content').style.display = 'block';
      document.getElementById('session-content').innerHTML =
        '<div class="pair-status resolving" style="margin-top:16px;">' +
        '<div class="ps-icon">&#128230;</div>' +
        '<div class="ps-text">Your proposal is with them. You\'ll see their response here.</div></div>';
      startSessionPoll();
      return;
    }

    showExStep('transport');
  }

  function selectTransport(method) {
    state.proposalPath = method;
    if (method === 'pair') {
      // If server is available, use session flow (single-sided proposal)
      // If no server, fall back to dual-entry pair codes
      const witnessUrl = getWitnessUrl();
      if (witnessUrl) {
        startSessionAsProposer();
      } else {
        generatePairCode();
        showExStep('pair');
      }
      return;
    }
    // Show appropriate view in the proposal step
    document.getElementById('pv-inperson').style.display = method === 'inperson' ? 'block' : 'none';
    document.getElementById('pv-message').style.display = method === 'message' ? 'block' : 'none';
    document.getElementById('ex-proposal-status').textContent = method === 'inperson' ? 'Show this to the other person' : 'Send to the other person';
    showExStep('proposal');
  }

  function switchTransport() {
    const newMethod = state.proposalPath === 'inperson' ? 'message' : 'inperson';
    state.proposalPath = newMethod;
    document.getElementById('pv-inperson').style.display = newMethod === 'inperson' ? 'block' : 'none';
    document.getElementById('pv-message').style.display = newMethod === 'message' ? 'block' : 'none';
    document.getElementById('ex-proposal-status').textContent = newMethod === 'inperson' ? 'Show this to the other person' : 'Send to the other person';
  }

  // === PAIRING CODE EXCHANGE ===
  // The absolute floor of the protocol: both people fill out their own side,
  // exchange short codes verbally, and the server matches them later.
  // No data transfer between phones. No QR, no camera, no Bluetooth.

  const PAIR_CHARS = 'ACDEFGHJKMNPQRTUVWXYZ'; // letters only, no O/I/L/S/B — language-proof
  let pairPollTimer = null;

  function generatePairCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(bytes).map(b => PAIR_CHARS[b % PAIR_CHARS.length]).join('');
    state.pairCode = code;
    document.getElementById('pair-my-code').textContent = code;
    document.getElementById('pair-their-code').value = '';
    document.getElementById('pair-status').style.display = 'none';
  }

  function pairCodeInput(el) {
    // Only accept characters from the generation alphabet — reject 0, O, 1, I, L, 5, S, 8, B
    el.value = el.value.toUpperCase().replace(/[^ACDEFGHJKMNPQRTUVWXYZ]/g, '').substring(0, 4);
  }

  async function submitPairCode() {
    const theirCode = (document.getElementById('pair-their-code').value || '').trim().toUpperCase();
    if (!theirCode || theirCode.length !== 4) {
      toast('Enter their 4-character code');
      return;
    }
    if (theirCode === state.pairCode) {
      toast('That\'s your own code');
      return;
    }

    const pp = state.pendingProposal;
    if (!pp) { toast('No pending proposal'); return; }

    // Build pair half
    const pairHalf = {
      my_code: state.pairCode,
      their_code: theirCode,
      value: pp.details.value,
      direction: pp.details.energyState,
      description: pp.details.description,
      category: pp.details.category || '',
      duration: pp.details.duration || 0,
      public_key: state.publicKeyJwk,
      fingerprint: state.fingerprint,
      timestamp: new Date().toISOString(),
      city: pp.city || '',
      state_field: pp.state_field || '',
      device_ts: Date.now(),
      device_hash: _cachedDeviceHash,
    };

    // Store locally for persistence
    state.pendingPair = pairHalf;
    localStorage.setItem('hcp_pending_pair', JSON.stringify(pairHalf));

    // Update pending item
    const pending = loadPending();
    const matchIdx = pending.findIndex(p => p.role === 'initiator' && p.description === pp.details.description);
    if (matchIdx >= 0) {
      pending[matchIdx].pairCode = state.pairCode;
      pending[matchIdx].transport = 'pair';
      savePending(pending);
    }

    // Show resolving status
    const statusEl = document.getElementById('pair-status');
    statusEl.style.display = 'block';
    statusEl.className = 'pair-status resolving';
    document.getElementById('pair-status-icon').innerHTML = '&#9203;';

    // Try to upload to server
    const uploaded = await uploadPairHalf(pairHalf);
    if (uploaded) {
      document.getElementById('pair-status-text').textContent =
        'Your half is submitted. Waiting for theirs to arrive. You can close this — it will resolve in the background.';
      startPairPoll();
    } else {
      document.getElementById('pair-status-text').textContent =
        'No server available right now. Your half is saved. When your phone connects to a server, it will be uploaded and matched automatically.';
    }

    toast('Paired — codes exchanged');
  }

  async function uploadPairHalf(half) {
    const url = getWitnessUrl();
    if (!url) return false;
    try {
      const resp = await serverFetch(url + '/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(half),
      });
      return resp.ok;
    } catch(e) {
      return false;
    }
  }

  function startPairPoll() {
    stopPairPoll();
    if (!getWitnessUrl() || !state.pendingPair) return;
    const myCode = state.pendingPair.my_code;

    let attempts = 0;
    pairPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 240) { // Stop after ~60 minutes (15s intervals)
        stopPairPoll();
        return;
      }
      const result = await checkPairResolution(myCode);
      if (result) {
        stopPairPoll();
        completePairExchange(result);
      }
    }, 15000); // Every 15 seconds

    // Immediate first check
    setTimeout(async () => {
      const result = await checkPairResolution(myCode);
      if (result) { stopPairPoll(); completePairExchange(result); }
    }, 3000);
  }

  function stopPairPoll() {
    if (pairPollTimer) { clearInterval(pairPollTimer); pairPollTimer = null; }
  }

  async function checkPairResolution(myCode) {
    const url = getWitnessUrl();
    if (!url) return null;
    try {
      const resp = await serverFetch(url + '/pair/check/' + myCode);
      if (resp.status === 404) return null; // Not yet matched
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.resolved) return data;
      return null;
    } catch(e) {
      return null;
    }
  }

  async function completePairExchange(resolution) {
    // Server matched both halves -- resolution contains the other party's public key
    const half = state.pendingPair;
    if (!half) return;

    const counterpartyPub = resolution.counterparty_key;
    const counterpartyFp = resolution.counterparty_fp;

    if (resolution.status === 'mismatch') {
      // Values didn't match or directions weren't complementary
      const statusEl = document.getElementById('pair-status');
      if (statusEl) {
        statusEl.className = 'pair-status mismatch';
        document.getElementById('pair-status-icon').innerHTML = '&#9888;';
        document.getElementById('pair-status-text').textContent =
          'The other person\'s values didn\'t match yours. The exchange is unresolved. You may want to discuss and try again.';
      }
      toast('Values didn\'t match');
      return;
    }

    // Build record
    const record = HCP.createRecord({
      type: 'exchange',
      value: half.value,
      energyState: half.direction,
      counterparty: counterpartyFp,
      description: half.description,
      category: half.category || undefined,
      duration: half.duration || undefined,
      city: half.city || undefined,
      state: half.state_field || undefined,
      counterpartyDeviceHash: resolution.counterparty_device_hash || undefined,
    });

    // Capture sensor data
    try {
      var snap = await captureSensor();
      if (snap.geo) record.geo = snap.geo;
      if (snap.device) record.device = snap.device;
      if (snap.sensorHash) record.sensorHash = snap.sensorHash;
      record.pohSnapshot = {
        signalHash: snap.signalHash,
        networkHash: snap.networkHash,
        webglHash: snap.webglHash,
        canvasHash: snap.canvasHash,
        batteryState: snap.batteryState,
        capabilityMask: snap.capabilityMask,
        capturedAt: snap.timestamp
      };
    } catch(sensorErr) {
      console.log('[sensor] Capture failed:', sensorErr.message);
    }

    // --- Integrity fields ---
    record.exchangePath = HCP.EXCHANGE_PATHS.QR;
    record.connectivityAvailable = navigator.onLine;

    try {
      var ep = await HCP.chainEntropyPrev(state.chain);
      if (ep) record.entropyPrev = ep;
    } catch(epErr) {}

    // Clock skew from counterparty's device_ts (when server passes it through)
    if (typeof resolution.counterparty_device_ts === 'number') {
      record.clockSkew = Date.now() - resolution.counterparty_device_ts;
    }

    try {
      var mr = await HCP.chainMerkleRoot(state.chain);
      if (mr) record.chainMerkleRoot = mr;
    } catch(mrErr) {}

    // Write to chain
    await appendRecord(record);
    save();

    // Witness attestation
    submitWitness(record, counterpartyPub);

    // Clean up
    state.pendingPair = null;
    localStorage.removeItem('hcp_pending_pair');

    // Remove from pending list
    const pending = loadPending();
    const idx = pending.findIndex(p => p.transport === 'pair' && p.pairCode === half.my_code);
    if (idx >= 0) { pending.splice(idx, 1); savePending(pending); }

    // Show success
    const statusEl = document.getElementById('pair-status');
    if (statusEl) {
      statusEl.className = 'pair-status resolved';
      document.getElementById('pair-status-icon').innerHTML = '&#10003;';
      document.getElementById('pair-status-text').textContent =
        'Exchange resolved. Both threads are written.';
    }

    // If we're still on the pair step, show done
    state.doneDetails = {
      partner: '',
      direction: half.direction === 'provided' ? 'You provided' : 'You received',
      description: half.description || '',
      category: half.category || '',
      value: half.value,
      witnessed: true
    };
    state.doneSummary = (half.direction === 'provided' ? 'Provided' : 'Received') + ': ' + half.description + ' -- ' + half.value + ' units';
    exRenderDoneCard();
    showExStep('done');

    refreshHome();
    toast('Exchange complete');
  }

  // On app init, check for pending pair uploads
  function resumePendingPair() {
    const saved = localStorage.getItem('hcp_pending_pair');
    if (!saved) return;
    try {
      state.pendingPair = JSON.parse(saved);
      // Try upload if we have a server
      if (getWitnessUrl()) {
        uploadPairHalf(state.pendingPair).then(ok => {
          if (ok) {
            startPairPoll();
          }
        });
      }
    } catch(e) { localStorage.removeItem('hcp_pending_pair'); }
  }


  // === SESSION EXCHANGE ===
  // An ephemeral pipe between two phones, opened by pairing codes.
  // Carries: thread snapshots, proposals, confirmations.
  // The server is just a relay — it never interprets the data.

  let sessionPollTimer = null;
  let sessionRole = null; // 'proposer' or 'confirmer'
  let _pollBusy = false; // re-entry guard for async poll callback
  let _sessionWritten = false; // write-once guard per session exchange
  let sessionCode = null;
  let sessionTheirCode = null;
  let sessionPartner = null;
  let sessionProposal = null;
  let sessionActiveTab = 'texture';
  let sessionSharedKey = null; // ECDH-derived AES key for encrypted relay
  let sessionSASHash = null; // 16-byte SAS hash for automatic collision detection
  let _snapshotPollTimer = null;

  // === LAYER 2: Protocol State Machine ===
  // Enforces expected message sequence, type, and size on session data.
  // Any violation triggers silent session drop.
  let sessionExpectedState = null; // null | 'awaiting_connection' | 'connected' | 'awaiting_proposal' | 'awaiting_confirmation' | 'done'
  const SESSION_MAX_RESPONSE_SIZE = 500000; // 500KB max for any poll response
  const SESSION_MAX_PROPOSAL_SIZE = 100000; // 100KB max for proposal data
  const SESSION_MAX_SNAPSHOT_SIZE = 100000; // 100KB max for thread snapshot

  // === LAYER 3: Nonce-Bound Integrity Hash ===
  // Random nonce bound to proposal payload, retained on device, verified on return.
  let sessionProposalNonce = null; // hex string of random nonce sent with proposal
  let sessionProposalIntegrityHash = null; // hash(nonce + payload fields)

  function sessionSetState(newState) {
    console.log('[state-machine] ' + (sessionExpectedState || 'null') + ' -> ' + newState);
    sessionExpectedState = newState;
  }

  function sessionValidateResponse(data, rawSize) {
    // Size check on raw response
    if (rawSize > SESSION_MAX_RESPONSE_SIZE) {
      console.warn('[state-machine] Response too large: ' + rawSize + ' bytes');
      return { valid: false, reason: 'response_too_large' };
    }

    // State-specific validation
    if (sessionExpectedState === 'awaiting_connection') {
      // Should only see connection status, no proposal
      if (data.proposal && data.proposal.status) {
        console.warn('[state-machine] Unexpected proposal in awaiting_connection state');
        return { valid: false, reason: 'unexpected_proposal' };
      }
      return { valid: true };
    }

    if (sessionExpectedState === 'connected' || sessionExpectedState === 'awaiting_proposal') {
      // Proposal allowed only with status 'pending' for confirmer
      if (data.proposal) {
        var propSize = JSON.stringify(data.proposal).length;
        if (propSize > SESSION_MAX_PROPOSAL_SIZE) {
          console.warn('[state-machine] Proposal too large: ' + propSize + ' bytes');
          return { valid: false, reason: 'proposal_too_large' };
        }
        if (data.proposal.status && data.proposal.status !== 'pending' && data.proposal.status !== 'confirmed' && data.proposal.status !== 'rejected') {
          console.warn('[state-machine] Invalid proposal status: ' + data.proposal.status);
          return { valid: false, reason: 'invalid_proposal_status' };
        }
      }
      return { valid: true };
    }

    if (sessionExpectedState === 'awaiting_confirmation') {
      // Only expect proposal with status confirmed or rejected
      if (data.proposal && data.proposal.status) {
        if (data.proposal.status !== 'pending' && data.proposal.status !== 'confirmed' && data.proposal.status !== 'rejected') {
          console.warn('[state-machine] Invalid proposal status: ' + data.proposal.status);
          return { valid: false, reason: 'invalid_proposal_status' };
        }
      }
      return { valid: true };
    }

    if (sessionExpectedState === 'done') {
      // No further messages expected
      return { valid: true };
    }

    // Default: allow (state machine not yet active for this session)
    return { valid: true };
  }

  function sessionViolation(reason) {
    console.error('[state-machine] VIOLATION: ' + reason + ' -- dropping session');
    // Layer 4: Record failure against current server
    var url = getWitnessUrl();
    if (url) recordServerFailure(url, reason);
    toast('Connection issue -- please try again');
    cleanupSession();
    exFlowActive = false;
    closeModal('exchange');
  }

  // === OPTION B: Encrypted thread snapshot helpers ===

  // Build thread snapshot for sharing (used by both session and ex-flow)
  function buildSnapshotForSharing(extras) {
    var threadSnap = null;
    try {
      if (state.chain.length > 0) {
        threadSnap = HCP.chainSnapshot(state.chain);
      } else {
        threadSnap = { n: 0, d: 0, g: 0, r: 0, cats: {}, words: {}, time: {}, stab: {}, t0: null, t1: null };
      }
    } catch(snapErr) {
      console.error('[session] Thread snapshot build failed:', snapErr);
      try {
        var fbDensity = 0;
        try { fbDensity = +HCP.chainDensity(state.chain).toFixed(1); } catch(de) {}
        var fbEx = state.chain.filter(HCP.isAct);
        threadSnap = {
          n: fbEx.length,
          g: fbEx.filter(function(r){ return r.energyState === 'provided'; }).length,
          r: fbEx.filter(function(r){ return r.energyState === 'received'; }).length,
          d: fbDensity,
          cats: {}, words: {}, time: {}, stab: {},
          t0: state.chain[0] ? state.chain[0].timestamp : null,
          t1: state.chain[state.chain.length-1] ? state.chain[state.chain.length-1].timestamp : null
        };
      } catch(e2) {}
    }
    if (threadSnap && state.declarations) {
      threadSnap.range = {
        simpleVal: state.declarations.rangeSimpleVal || 0,
        complexVal: state.declarations.rangeComplexVal || 0,
        dailyVal: state.declarations.rangeDailyVal || 0,
        valTags: {
          simple: state.declarations.valTagsSimple || [],
          complex: state.declarations.valTagsComplex || [],
          daily: state.declarations.valTagsDaily || []
        }
      };
      threadSnap._name = state.declarations.name || '';
      var genesisRec = state.chain.find(function(r) { return r.type === HCP.RECORD_TYPE_GENESIS && r.photoData; });
      if (genesisRec) threadSnap._genesisPhoto = genesisRec.photoData;
    }
    if (extras && threadSnap) {
      Object.keys(extras).forEach(function(k) { threadSnap[k] = extras[k]; });
    }
    // Attach counterparty-visible POH verdict. Computed on this device using
    // this device's capabilities and this chain's records — the same POH.rollup
    // the Standing tab renders for the owner. Broadcast-safe (no raw capture
    // data, no function refs). Receiver renders through renderPOHVerdict with
    // the verdict inlined, looks up copy/visualize from their own registry.
    try {
      if (state.chain && state.chain.length > 0 && typeof POH !== 'undefined' && POH.rollupForBroadcast) {
        var caps = null;
        try { caps = pohDeviceCapabilities(); } catch(ce) {}
        var broadcastVerdict = POH.rollupForBroadcast({
          chain: state.chain,
          deviceCapabilities: caps
        });
        if (broadcastVerdict) threadSnap.pohVerdict = broadcastVerdict;
      }
    } catch(pe) {
      console.log('[session] POH verdict build for broadcast failed:', pe.message);
    }
    return threadSnap;
  }

  // Encrypt and send snapshot via POST /session/:code/thread
  async function sendEncryptedSnapshot(extras) {
    if (!sessionSharedKey || !sessionCode) return;
    var url = getWitnessUrl();
    if (!url) return;
    var snap = buildSnapshotForSharing(extras);
    if (!snap) return;
    try {
      var encrypted = await HCP.encryptRelayPayload(snap, sessionSharedKey);
      await serverFetch(url + '/session/' + sessionCode + '/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_snapshot: encrypted })
      });
      console.log('[session] Encrypted snapshot sent');
    } catch(e) {
      console.error('[session] Failed to send encrypted snapshot:', e);
    }
  }

  // Poll for partner's encrypted snapshot, decrypt when found
  function startSnapshotPoll(onReceived) {
    stopSnapshotPoll();
    var url = getWitnessUrl();
    if (!url || !sessionCode) return;
    var attempts = 0;
    function doCheck() {
      if (!sessionSharedKey) return;
      serverFetch(url + '/session/' + sessionCode).then(function(resp) {
        if (!resp.ok) return;
        return resp.json();
      }).then(function(data) {
        if (!data || !data.partner) return;
        if (data.partner.encrypted_snapshot && sessionSharedKey) {
          stopSnapshotPoll();
          HCP.decryptRelayPayload(data.partner.encrypted_snapshot, sessionSharedKey).then(function(decrypted) {
            sessionPartner.thread_snapshot = decrypted;
            sessionPartner._snapshotDecrypted = true;
            console.log('[session] Partner snapshot decrypted');
            if (onReceived) onReceived(decrypted);
          }).catch(function(de) {
            console.error('[session] Decrypt partner snapshot failed:', de);
          });
        } else if (data.partner.thread_snapshot && !sessionPartner.thread_snapshot) {
          // Backward compat: partner sent plaintext snapshot (old client)
          stopSnapshotPoll();
          sessionPartner.thread_snapshot = data.partner.thread_snapshot;
          sessionPartner._snapshotDecrypted = true;
          console.log('[session] Partner snapshot received (plaintext fallback)');
          if (onReceived) onReceived(data.partner.thread_snapshot);
        }
      }).catch(function(e) {});
    }
    _snapshotPollTimer = setInterval(function() {
      attempts++;
      if (attempts > 40) { stopSnapshotPoll(); return; } // 2 min at 3s
      doCheck();
    }, 3000);
    setTimeout(doCheck, 1000); // immediate first check
  }

  function stopSnapshotPoll() {
    if (_snapshotPollTimer) { clearInterval(_snapshotPollTimer); _snapshotPollTimer = null; }
  }

  // Re-render session connected view when snapshot arrives
  function refreshSessionThreadView() {
    var ts = sessionPartner ? sessionPartner.thread_snapshot : null;
    var content = document.getElementById('session-content');
    if (!content) return;
    var tabBody = document.getElementById('sess-tab-body');
    // If tab body exists, just update tab content
    if (tabBody) {
      tabBody.innerHTML = renderSessionTabContent(sessionActiveTab);
      return;
    }
    // Otherwise re-render connected view
    if (sessionPartner) onSessionConnected();
  }

  function coopReceiveProposal() {
    closeModal('cooperate');
    openExchange();
    document.getElementById('exchange-header').textContent = 'Receive a Proposal';
    sessionRole = 'confirmer';
    generateSessionCode();
    showExStep('session');
    document.getElementById('session-status-line').textContent = 'Exchange codes to connect';
    document.getElementById('session-code-input').style.display = '';
    const btn = document.getElementById('session-connect-btn');
    btn.style.display = '';
    btn.textContent = 'Connect';
    btn.disabled = false;
    document.getElementById('session-content').style.display = 'none';
    document.getElementById('session-content').innerHTML = '';
  }

  function startSessionAsProposer() {
    sessionRole = 'proposer';
    generateSessionCode();
    showExStep('session');
    document.getElementById('session-status-line').textContent = 'Exchange codes to connect';
    document.getElementById('session-code-input').style.display = '';
    const btn = document.getElementById('session-connect-btn');
    btn.style.display = '';
    btn.textContent = 'Connect';
    btn.disabled = false;
    document.getElementById('session-content').style.display = 'none';
    document.getElementById('session-content').innerHTML = '';
  }

  function generateSessionCode() {
    _sessionWritten = false; // reset for new session
    _pollBusy = false;
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    sessionCode = Array.from(bytes).map(b => PAIR_CHARS[b % PAIR_CHARS.length]).join('');
    document.getElementById('session-my-code').textContent = sessionCode;
    document.getElementById('session-their-code').value = '';
  }

  function sessionCodeInput(el) {
    el.value = el.value.toUpperCase().replace(/[^ACDEFGHJKMNPQRTUVWXYZ]/g, '').substring(0, 4);
  }

  async function sessionConnect() {
    // Immediate visual feedback
    const btn = document.getElementById('session-connect-btn');
    if (btn) { btn.textContent = 'Connecting...'; btn.disabled = true; }

    try {
      const rawVal = document.getElementById('session-their-code').value;
      const theirCode = (rawVal || '').trim().toUpperCase();
      document.getElementById('session-status-line').textContent = 'Connecting...';

      if (!theirCode || theirCode.length !== 4) {
        toast('Enter their 4-character code (got ' + theirCode.length + ')');
        if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
        return;
      }
      if (theirCode === sessionCode) {
        toast("That's your own code");
        if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
        return;
      }

      const url = getWitnessUrl();
      if (!url) {
        toast('No server available');
        if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
        return;
      }

      sessionTheirCode = theirCode;

      // Hide input, show connecting
      document.getElementById('session-code-input').style.display = 'none';
      document.getElementById('session-status-line').textContent = 'Connecting to server...';


      const resp = await serverFetch(url + '/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          my_code: sessionCode,
          their_code: sessionTheirCode,
          fingerprint: state.fingerprint,
          public_key: state.publicKeyJwk,
        }),
      });


      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        toast('Server error — try again');
        document.getElementById('session-code-input').style.display = '';
        if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
        document.getElementById('session-status-line').textContent = 'Server error — try again';
        return;
      }

      const data = await resp.json();

      if (data.connected) {
        sessionPartner = data.partner;
        await onSessionConnected();
      } else {
        document.getElementById('session-status-line').textContent = 'Waiting for them to connect...';
        document.getElementById('session-content').style.display = 'block';
        document.getElementById('session-content').innerHTML =
          '<div class="pair-status resolving" style="margin-top:16px;">' +
          '<div class="ps-icon">&#9203;</div>' +
          '<div class="ps-text">Your code is submitted. Once they enter their code and connect, you\'ll see each other here.</div>' +
          '</div>';
        startSessionPoll();
      }
    } catch(e) {
      console.error('[session] Connect error:', e);
      document.getElementById('session-status-line').textContent = 'Error: ' + e.message;
      toast('Error: ' + e.message);
      try {
        document.getElementById('session-code-input').style.display = '';
        if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
      } catch(domErr) {}
    }
  }

  function renderThreadSnapshot(ts) {
    if (!ts) return '<div class="session-thread"><div class="st-title">Their thread</div><div class="st-row"><span class="st-label">No thread data shared</span></div></div>';
    let html = '<div class="session-thread">' +
      '<div class="st-title">Their thread</div>' +
      '<div class="st-row"><span class="st-label">Acts recorded</span><span class="st-val">' + (ts.n || 0) + '</span></div>' +
      '<div class="st-row"><span class="st-label">Provided</span><span class="st-val">' + (ts.g || 0) + '</span></div>' +
      '<div class="st-row"><span class="st-label">Received</span><span class="st-val">' + (ts.r || 0) + '</span></div>' +
      '<div class="st-row"><span class="st-label">Position</span><span class="st-val">' + (ts.d || 0) + '</span></div>';
    if (ts.t0) {
      html += '<div class="st-row"><span class="st-label">Active since</span><span class="st-val">' + new Date(ts.t0).toLocaleDateString() + '</span></div>';
    }
    html += '</div>';
    return html;
  }

  // === SESSION THREAD VIEWER (interactive tabs) ===

  function buildSessionTabBar() {
    return '<div class="sess-tabs">' +
      '<button class="sess-tab' + (sessionActiveTab === 'texture' ? ' active' : '') + '" onclick="App.sessionThreadTab(\'texture\')">Texture</button>' +
      '<button class="sess-tab' + (sessionActiveTab === 'words' ? ' active' : '') + '" onclick="App.sessionThreadTab(\'words\')">Words</button>' +
      '<button class="sess-tab' + (sessionActiveTab === 'ratio' ? ' active' : '') + '" onclick="App.sessionThreadTab(\'ratio\')">Rate</button>' +
      '<button class="sess-tab' + (sessionActiveTab === 'time' ? ' active' : '') + '" onclick="App.sessionThreadTab(\'time\')">Time</button>' +
      '<button class="sess-tab' + (sessionActiveTab === 'stability' ? ' active' : '') + '" onclick="App.sessionThreadTab(\'stability\')">Stability</button>' +
      '</div>';
  }

  function sessionThreadTab(tab) {
    sessionActiveTab = tab;
    // Update tab bar active state
    const tabs = document.querySelectorAll('#session-content .sess-tab');
    tabs.forEach(function(t) {
      t.classList.toggle('active', t.textContent.toLowerCase() === tab || (tab === 'ratio' && t.textContent === 'Rate') || (tab === 'texture' && t.textContent === 'Texture') || (tab === 'stability' && t.textContent === 'Stability'));
    });
    // Actually just re-toggle properly
    tabs.forEach(function(t) {
      const tabMap = { 'Texture': 'texture', 'Words': 'words', 'Rate': 'ratio', 'Time': 'time', 'Stability': 'stability' };
      t.classList.toggle('active', tabMap[t.textContent] === tab);
    });
    // Re-render tab content only
    const contentEl = document.getElementById('sess-tab-body');
    if (contentEl) {
      contentEl.innerHTML = renderSessionTabContent(tab);
    }
  }

  function renderSessionTabContent(tab) {
    const ts = sessionPartner ? sessionPartner.thread_snapshot : null;
    if (!ts || !ts.n) return '<div class="empty-state">No thread data shared.</div>';

    if (tab === 'texture') {
      let h = '<div class="review-panel">';
      h += '<div class="review-row"><span class="rlbl">Total Acts</span><span class="rval">' + ts.n + '</span></div>';
      h += '<div class="review-row"><span class="rlbl">Density</span><span class="rval">' + ts.d + ' u/act</span></div>';
      h += '<div class="review-row"><span class="rlbl">Give / Receive</span><span class="rval">' + ts.g + ' / ' + ts.r + '</span></div>';
      h += '<div class="review-row"><span class="rlbl">Thread Age</span><span class="rval">' + (ts.t0 ? new Date(ts.t0).toLocaleDateString() + ' \u2014 ' + (ts.t1 ? new Date(ts.t1).toLocaleDateString() : 'now') : '\u2014') + '</span></div>';
      h += '</div>';
      // Integrity signals
      var ig = ts.integrity;
      if (ig) {
        h += '<h3 style="margin:14px 0 8px;font-size:13px;color:var(--text-dim);">Reality signals</h3>';
        h += '<div class="review-panel">';
        h += '<div class="review-row"><span class="rlbl">Genesis photo anchored</span><span class="rval">' + (ig.genesisPhoto ? '\u2713 Yes' + (ig.genesisPhotoSource ? ' (' + ig.genesisPhotoSource + ')' : '') : '\u2014 No') + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Sensor coverage</span><span class="rval">' + ig.sensorCoverage + '%</span></div>';
        h += '<div class="review-row"><span class="rlbl">Platforms</span><span class="rval">' + (ig.platforms && ig.platforms.length ? ig.platforms.join(', ') : '\u2014') + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Distinct devices</span><span class="rval">' + ig.distinctDevices + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Distinct counterparties</span><span class="rval">' + ig.distinctCounterparties + '</span></div>';
        if (ig.distinctCounterpartyDevices > 0) {
          var cpRatio = ig.distinctCounterparties > 0 ? (ig.distinctCounterparties / ig.distinctCounterpartyDevices) : 0;
          var cpDevWarn = cpRatio > 2 ? ' style="color:var(--warning,#e67e22)"' : '';
          h += '<div class="review-row"><span class="rlbl">Counterparty devices</span><span class="rval"' + cpDevWarn + '>' + ig.distinctCounterpartyDevices + '</span></div>';
        }
        h += '<div class="review-row"><span class="rlbl">Pings</span><span class="rval">' + (ts.pings || 0) + '</span></div>';
        if (ig.avgPingGapDays != null) {
          h += '<div class="review-row"><span class="rlbl">Avg ping gap</span><span class="rval">' + ig.avgPingGapDays + ' days</span></div>';
        }
        var ps = ig.photoSources || {};
        if (ps.camera || ps.file) {
          h += '<div class="review-row"><span class="rlbl">Photo sources</span><span class="rval">' + (ps.camera || 0) + ' camera, ' + (ps.file || 0) + ' uploaded</span></div>';
        }
        h += '</div>';
      }
      const cats = ts.cats || {};
      if (Object.keys(cats).length) {
        h += '<h3 style="margin:14px 0 8px;font-size:13px;color:var(--text-dim);">Categories</h3>';
        h += '<div class="review-panel">';
        Object.entries(cats).sort(function(a,b){return b[1].n - a[1].n;}).forEach(function(e) {
          var k = e[0], v = e[1];
          var pct = Math.round(v.n / ts.n * 100);
          h += '<div style="margin-bottom:12px;">';
          h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:14px;font-weight:500;">' + esc(k) + '</span><span style="font-size:13px;color:var(--text-dim);">' + v.n + ' acts \u00b7 ' + pct + '%</span></div>';
          h += '<div style="height:14px;background:var(--bg-input);border-radius:7px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:3px;"></div></div>';
          h += '<div style="font-size: 13px;color:var(--text-faint);margin-top:3px;">avg ' + v.avg + ' units \u00b7 provided ' + v.g + ' \u00b7 received ' + v.r + '</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      return h;
    }

    if (tab === 'words') {
      var words = ts.words || {};
      var entries = Object.entries(words).sort(function(a,b){return b[1]-a[1];});
      if (!entries.length) return '<div class="empty-state">No description data available.</div>';
      var maxCount = entries[0][1];
      var h = '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0;">';
      entries.forEach(function(e) {
        var word = e[0], count = e[1];
        var size = Math.max(13, Math.min(28, 13 + (count / maxCount) * 15));
        var opacity = 0.5 + (count / maxCount) * 0.5;
        h += '<span style="font-size:' + size + 'px;opacity:' + opacity + ';color:var(--accent);font-weight:500;padding:4px 8px;background:rgba(42,90,143,0.08);border-radius:6px;">' + esc(word) + '<sub style="font-size: 13px;color:var(--text-faint);margin-left:2px;">' + count + '</sub></span>';
      });
      h += '</div>';
      h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;">Words from their exchange descriptions. Larger words appear more often.</p>';
      return h;
    }

    if (tab === 'ratio') {
      return renderSessionExchangeRate(ts);
    }

    if (tab === 'time') {
      var timeData = ts.time || {};
      var months = Object.keys(timeData).sort();
      if (!months.length) return '<div class="empty-state">No time data available.</div>';
      var maxActs = Math.max.apply(null, Object.values(timeData));
      var h = '<div style="padding:4px 0;">';
      months.forEach(function(m) {
        var count = timeData[m];
        var pct = Math.round(count / maxActs * 100);
        var parts = m.split('-');
        var label = parts.length === 1 ? m : new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
        h += '<span style="font-size: 13px;color:var(--text-dim);min-width:70px;">' + label + '</span>';
        h += '<div style="flex:1;height:14px;background:var(--bg-input);border-radius:7px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:4px;"></div></div>';
        h += '<span style="font-size: 13px;font-weight:500;min-width:28px;text-align:right;">' + count + '</span>';
        h += '</div>';
      });
      h += '</div>';
      if (months.length > 1) {
        var gaps = [];
        for (var i = 1; i < months.length; i++) {
          if (months[i].length < 5 || months[i-1].length < 5) continue;
          var prev = months[i-1].split('-').map(Number);
          var curr = months[i].split('-').map(Number);
          var diff = (curr[0] - prev[0]) * 12 + (curr[1] - prev[1]);
          if (diff > 1) gaps.push(diff + ' month gap before ' + months[i]);
        }
        if (gaps.length) {
          h += '<div style="margin-top:12px;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm);font-size: 13px;color:var(--text-dim);line-height:1.5;">Gaps: ' + gaps.join(', ') + '</div>';
        }
      }
      h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;">Activity pattern over time. Consistent activity suggests a stable, active participant.</p>';
      return h;
    }

    if (tab === 'stability') {
      var stab = ts.stab || {};
      var stabCats = Object.keys(stab);
      if (!stabCats.length) return '<div class="empty-state">No stability data available.</div>';
      var h = '';
      stabCats.sort(function(a,b){return (ts.cats[b]||{n:0}).n - (ts.cats[a]||{n:0}).n;}).forEach(function(cat) {
        var d = stab[cat];
        var cv = d[2] > 0 ? (d[3] / d[2] * 100).toFixed(0) : 0;
        h += '<div class="review-panel" style="margin-bottom:10px;">';
        h += '<div style="font-size:14px;font-weight:500;margin-bottom:8px;">' + esc(cat) + '</div>';
        h += '<div class="review-row"><span class="rlbl">Average</span><span class="rval">' + d[2] + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Range</span><span class="rval">' + d[0] + ' \u2014 ' + d[1] + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Std Dev</span><span class="rval">' + d[3] + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Variation</span><span class="rval">' + cv + '%</span></div>';
        h += '<div style="margin-top:8px;position:relative;height:24px;background:var(--bg-input);border-radius:4px;">';
        var maxVal = d[1] * 1.2 || 100;
        var minPct = d[0] / maxVal * 100;
        var maxPct = d[1] / maxVal * 100;
        var avgPct = d[2] / maxVal * 100;
        h += '<div style="position:absolute;left:' + minPct + '%;width:' + (maxPct - minPct) + '%;top:4px;height:16px;background:rgba(42,90,143,0.2);border-radius:3px;"></div>';
        h += '<div style="position:absolute;left:' + avgPct + '%;top:2px;width:2px;height:20px;background:var(--accent);border-radius:1px;"></div>';
        h += '</div></div>';
      });
      h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;line-height:1.5;">Low variation indicates consistent pricing. High variation may reflect different scopes of work within a category.</p>';
      return h;
    }

    return '';
  }

  function renderSessionExchangeRate(ts) {
    // Cross-thread exchange rate calculation
    var mySnap = state.chain.length > 0 ? HCP.chainSnapshot(state.chain) : null;
    var myDensity = mySnap ? mySnap.d : 0;
    var theirDensity = ts.d || 1;

    if (!mySnap || myDensity === 0) {
      return '<div class="empty-state">You need at least one act in your thread to calculate exchange rates.</div>' +
        '<p style="font-size: 13px;color:var(--text-faint);margin-top:8px;line-height:1.5;">Their density: ' + theirDensity + ' u/act. Once you have exchange history, you\'ll see how your valuations compare.</p>';
    }

    var overallRatio = myDensity / theirDensity;
    var isParity = Math.abs(overallRatio - 1) < 0.15;
    var ratioStr = isParity ? '1 : 1' : (overallRatio >= 1 ? '1 : ' + overallRatio.toFixed(2) : (1/overallRatio).toFixed(2) + ' : 1');

    var h = '';

    // Overall exchange rate hero
    h += '<div class="sess-rate-hero ' + (isParity ? 'parity' : 'cross') + '">';
    h += '<div style="font-size: 13px;color:var(--text-dim);margin-bottom:4px;">Overall Exchange Rate</div>';
    h += '<div class="sess-rate-val" style="color:' + (isParity ? 'var(--green)' : 'var(--blue)') + ';">' + ratioStr + '</div>';
    h += '<div class="sess-rate-sub">You: ' + myDensity.toFixed(1) + ' u/act \u00b7 Them: ' + theirDensity + ' u/act</div>';
    h += '</div>';

    // Category-specific rates — find matching categories
    var myCats = mySnap.cats || {};
    var theirCats = ts.cats || {};
    var matchingCats = [];
    var proposalCat = state.pendingProposal ? (state.pendingProposal.details.category || '') : '';

    Object.keys(theirCats).forEach(function(cat) {
      var theirCat = theirCats[cat];
      var myCat = myCats[cat];
      if (myCat && theirCat) {
        var catRatio = myCat.avg / theirCat.avg;
        matchingCats.push({ name: cat, myAvg: myCat.avg, theirAvg: theirCat.avg, ratio: catRatio, isProposal: cat === proposalCat });
      }
    });

    if (matchingCats.length > 0) {
      h += '<h3 style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">Category-Specific Rates</h3>';
      h += '<p style="font-size: 13px;color:var(--text-faint);margin-bottom:10px;line-height:1.5;">When you both have history in the same category, the rate for that specific work is more precise than the overall.</p>';

      matchingCats.sort(function(a,b) { return a.isProposal ? -1 : (b.isProposal ? 1 : 0); }).forEach(function(mc) {
        var catParity = Math.abs(mc.ratio - 1) < 0.15;
        var catRatioStr = catParity ? '1 : 1' : (mc.ratio >= 1 ? '1 : ' + mc.ratio.toFixed(2) : (1/mc.ratio).toFixed(2) + ' : 1');
        h += '<div class="sess-cat-rate"' + (mc.isProposal ? ' style="border-color:var(--accent);"' : '') + '>';
        if (mc.isProposal) {
          h += '<div style="font-size: 13px;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">This exchange\'s category</div>';
        }
        h += '<div class="sess-cat-rate-row"><span class="cl">' + esc(mc.name) + '</span><span class="cv" style="color:' + (catParity ? 'var(--green)' : 'var(--blue)') + ';">' + catRatioStr + '</span></div>';
        h += '<div class="sess-cat-rate-row"><span class="cl" style="font-size: 13px;">You avg ' + mc.myAvg + ' \u00b7 They avg ' + mc.theirAvg + '</span></div>';
        h += '</div>';
      });
    }

    // What their prices mean in your units
    h += '<div class="review-panel" style="margin-top:14px;">';
    h += '<div style="font-size:13px;color:var(--text-dim);margin-bottom:10px;">What their prices mean in your units</div>';
    [50, 100, 200, 500].forEach(function(val) {
      var inYours = Math.round(val * overallRatio);
      var actsEquiv = myDensity > 0 ? (inYours / myDensity).toFixed(1) : '\u2014';
      h += '<div class="review-row"><span class="rlbl">' + val + ' of theirs</span><span class="rval">' + inYours + ' of yours \u00b7 ~' + actsEquiv + ' avg acts</span></div>';
    });
    h += '</div>';

    // Proposal-specific conversion if we have one
    if (proposalCat && state.pendingProposal) {
      var propVal = state.pendingProposal.details.value;
      var catMatch = matchingCats.find(function(mc) { return mc.name === proposalCat; });
      var conversionRatio = catMatch ? catMatch.ratio : overallRatio;
      var converted = Math.round(propVal * conversionRatio);
      var rateLabel = catMatch ? 'category-specific' : 'overall';
      h += '<div style="margin-top:14px;padding:12px;background:rgba(42,90,143,0.08);border:1px solid var(--accent-dim);border-radius:var(--radius-sm);text-align:center;">';
      h += '<div style="font-size: 13px;color:var(--text-dim);margin-bottom:4px;">Your proposal: ' + propVal + ' units (' + esc(proposalCat) + ')</div>';
      h += '<div style="font-size:20px;font-weight:500;color:var(--accent);">\u2248 ' + converted + ' in their units</div>';
      h += '<div style="font-size: 13px;color:var(--text-faint);margin-top:4px;">Using ' + rateLabel + ' rate</div>';
      h += '</div>';
    }

    h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:14px;line-height:1.5;">' + (isParity ? 'Near parity. Your unit scales are roughly equivalent.' : 'Different densities. The ratio adjusts so both sides are honestly represented. Neither unit is worth more \u2014 they measure at different scales.') + '</p>';
    return h;
  }

  async function onSessionConnected() {
    document.getElementById('session-status-line').textContent = 'Connected';
    const content = document.getElementById('session-content');
    content.style.display = 'block';
    sessionActiveTab = 'texture';

    // Derive ECDH shared key for encrypted relay
    try {
      if (sessionPartner && sessionPartner.public_key && state.privateKeyJwk) {
        sessionSharedKey = await HCP.deriveSharedKey(state.privateKeyJwk, sessionPartner.public_key);
      }
    } catch(ek) { console.log('[session] ECDH key derivation failed:', ek.message); sessionSharedKey = null; }

    // Send our encrypted snapshot (only once)
    if (!sessionPartner._ourSnapshotSent && sessionSharedKey) {
      sessionPartner._ourSnapshotSent = true;
      sendEncryptedSnapshot();
    }

    // Partner info
    let html = '<div class="session-partner">' +
      '<div class="sp-label">Connected to</div>' +
      '<div class="sp-fp">' + esc((sessionPartner.fingerprint || '').substring(0, 16) + '...') + '</div>' +
      '</div>';

    // Counterparty context block — chain shape + proof-of-human verdict.
    // Visible to BOTH sides from the moment the session connects, so the
    // proposer sees the same "about them" surface the confirmer will see
    // during proposal review. Only renders if their snapshot has arrived.
    try {
      if (sessionPartner.thread_snapshot && sessionPartner.thread_snapshot.n) {
        html += renderCounterpartyContextBlock(sessionPartner.thread_snapshot);
      }
    } catch(cpe) {
      console.log('[session] Counterparty context render failed on connect:', cpe.message);
    }

    // Interactive thread viewer tabs
    const ts = sessionPartner.thread_snapshot;
    if (ts && ts.n) {
      html += '<div style="margin-bottom:16px;">';
      html += buildSessionTabBar();
      html += '<div class="sess-tab-content" id="sess-tab-body">' + renderSessionTabContent('texture') + '</div>';
      html += '</div>';
    } else if (!sessionPartner._snapshotDecrypted) {
      // Snapshot not yet received -- show loading state
      html += '<div class="session-thread"><div class="st-title">Their thread</div><div class="st-row"><span class="st-label">Loading encrypted thread data...</span></div></div>';
    } else {
      html += '<div class="session-thread"><div class="st-title">Their thread</div><div class="st-row"><span class="st-label">No thread data shared</span></div></div>';
    }

    if (sessionRole === 'proposer') {
      const pp = state.pendingProposal;
      if (pp) {
        html += '<div style="padding:14px; background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius);">' +
          '<div style="font-size:13px; color:var(--text-dim); margin-bottom:8px;">Your proposal</div>' +
          '<div style="font-size:15px; font-weight:500; color:var(--text);">' + esc(pp.details.description) + '</div>' +
          '<div style="font-size:13px; color:var(--text-dim); margin-top:4px;">' +
          (pp.details.energyState === 'provided' ? 'Providing' : 'Receiving') + ' \u00b7 ' + pp.details.value + ' units' +
          (pp.details.category ? ' \u00b7 ' + esc(pp.details.category) : '') +
          '</div></div>';
      }
      if (ts && ts.n) {
        html += '<button class="btn btn-primary" style="margin-top:16px;" onclick="App.sendSessionProposal()">Send proposal</button>';
      } else if (!sessionPartner._snapshotDecrypted) {
        html += '<div style="margin-top:16px;color:var(--text-dim);font-size:13px;">Waiting for their thread data before you can send...</div>';
      } else {
        html += '<button class="btn btn-primary" style="margin-top:16px;" onclick="App.sendSessionProposal()">Send proposal</button>';
      }
      content.innerHTML = html;
    } else {
      html += '<div class="pair-status resolving" style="margin-top:16px;" id="session-waiting-proposal">' +
        '<div class="ps-icon">&#9203;</div>' +
        '<div class="ps-text">Exploring their thread. Their proposal will appear here when they send it.</div></div>';
      content.innerHTML = html;
      startSessionPoll();
    }

    // Poll for partner's encrypted snapshot if not yet received
    if (!sessionPartner._snapshotDecrypted && sessionSharedKey) {
      startSnapshotPoll(function() {
        // Re-render the connected view now that we have the snapshot
        onSessionConnected();
      });
    }
  }

  function sendSessionProposal() {
    submitSessionProposal();
    // Update UI to show sending state
    const content = document.getElementById('session-content');
    const btn = content.querySelector('.btn-primary');
    if (btn) {
      btn.textContent = 'Sending...';
      btn.disabled = true;
    }
  }

  async function submitSessionProposal() {
    const url = getWitnessUrl();
    if (!url || !state.pendingProposal) return;

    const pp = state.pendingProposal;
    try {
      var proposePhotoHash = '';
      try { if (state.declarations.photo) proposePhotoHash = await sensorSha256(state.declarations.photo); } catch(ph) {}

      // Exchange content to encrypt
      const exchangeContent = {
        value: pp.details.value,
        direction: pp.details.energyState,
        description: pp.details.description,
        category: pp.details.category || '',
        duration: pp.details.duration || 0,
        photo: state.declarations.photo || ''
      };

      // Layer 3: Bind random nonce to payload for integrity verification
      var nonceBytes = crypto.getRandomValues(new Uint8Array(16));
      var nonceHex = Array.from(nonceBytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      exchangeContent._nonce = nonceHex;
      sessionProposalNonce = nonceHex;
      // Compute integrity hash: nonce + canonical payload fields
      var integrityInput = nonceHex + '|' + exchangeContent.value + '|' + exchangeContent.direction + '|' + (exchangeContent.description || '') + '|' + (exchangeContent.category || '') + '|' + (exchangeContent.duration || 0);
      var integrityBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(integrityInput));
      sessionProposalIntegrityHash = Array.from(new Uint8Array(integrityBuf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      console.log('[nonce] Bound nonce to proposal, hash:', sessionProposalIntegrityHash.substring(0, 16) + '...');

      // Build request body: attestation metadata always plaintext, exchange content encrypted if possible
      const body = {
        device_ts: Date.now(),
        sensor_hash: _cachedDeviceHash,
        platform: navigator.platform,
        geo: _cachedGeo ? JSON.stringify(_cachedGeo) : '',
        device_hash: _cachedDeviceHash,
        photo_hash: proposePhotoHash,
      };

      if (sessionSharedKey) {
        // Encrypted path: server carries opaque blob
        body.encrypted_exchange = await HCP.encryptRelayPayload(exchangeContent, sessionSharedKey);
        // Placeholder values so server schema doesn't break
        body.value = 0;
        body.direction = '';
        body.description = '';
        body.category = '';
        body.duration = 0;
        body.photo = '';
      } else {
        // Fallback: plaintext (pre-encryption clients or key derivation failure)
        body.value = exchangeContent.value;
        body.direction = exchangeContent.direction;
        body.description = exchangeContent.description;
        body.category = exchangeContent.category;
        body.duration = exchangeContent.duration;
        body.photo = exchangeContent.photo;
      }

      const resp = await serverFetch(url + '/session/' + sessionCode + '/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        toast('Failed to send proposal');
        return;
      }

      document.getElementById('session-status-line').textContent = 'Proposal sent — waiting for their review';

      // Update the status in session content
      const content = document.getElementById('session-content');
      const statusDiv = content.querySelector('.pair-status');
      if (statusDiv) {
        statusDiv.innerHTML = '<div class="ps-icon">&#128230;</div>' +
          '<div class="ps-text">Your proposal is with them. You\'ll see their response here.</div>';
      }

      // Poll for confirmation
      sessionSetState('awaiting_confirmation');
      startSessionPoll();
    } catch(e) {
      console.log('[session] Propose failed:', e.message);
      toast('Failed to send proposal');
    }
  }

  function startSessionPoll() {
    stopSessionPoll();
    _pollBusy = false;
    const url = getWitnessUrl();
    if (!url || !sessionCode) return;

    let attempts = 0;
    sessionPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 240) {
        stopSessionPoll();
        return;
      }
      if (_pollBusy) return; // skip if previous callback still running
      _pollBusy = true;
      try { await checkSessionState(); } finally { _pollBusy = false; }
    }, 5000);

    // Immediate first check after 2 seconds
    setTimeout(async () => {
      if (_pollBusy) return;
      _pollBusy = true;
      try { await checkSessionState(); } finally { _pollBusy = false; }
    }, 2000);
  }

  function stopSessionPoll() {
    if (sessionPollTimer) { clearInterval(sessionPollTimer); sessionPollTimer = null; }
  }

  async function checkSessionState() {
    if (_sessionWritten) return; // already wrote a record for this session
    const url = getWitnessUrl();
    if (!url || !sessionCode) return;

    try {
      const resp = await serverFetch(url + '/session/' + sessionCode);
      if (!resp.ok) return;
      const rawText = await resp.text();

      // Layer 2: Validate response size and state
      var data;
      try { data = JSON.parse(rawText); } catch(pe) { sessionViolation('invalid_json'); return; }
      var validation = sessionValidateResponse(data, rawText.length);
      if (!validation.valid) { sessionViolation(validation.reason); return; }

      // First: check for connection if not yet connected
      if (!sessionPartner && data.connected) {
        sessionPartner = data.partner;
        stopSessionPoll();
        await onSessionConnected();
        return;
      }

      // Check for proposal (confirmer path)
      if (sessionRole === 'confirmer' && data.proposal && data.proposal.status === 'pending') {
        stopSessionPoll();
        sessionProposal = data.proposal;
        // Decrypt exchange content if encrypted
        if (sessionProposal.encrypted_exchange && sessionSharedKey) {
          try {
            const dec = await HCP.decryptRelayPayload(sessionProposal.encrypted_exchange, sessionSharedKey);
            sessionProposal.value = dec.value;
            sessionProposal.direction = dec.direction;
            sessionProposal.description = dec.description;
            sessionProposal.category = dec.category;
            sessionProposal.duration = dec.duration;
            sessionProposal.proposer_photo = dec.photo;
          } catch(de) { console.log('[session] Decrypt failed:', de.message); }
        }
        if (exFlowActive) {
          // Don't auto-render — show a button so receiver can finish browsing
          exShowProposalReady();
        } else {
          renderProposalReview();
        }
        return;
      }

      // Check for confirmation (proposer path)
      if (sessionRole === 'proposer' && data.proposal && data.proposal.status === 'confirmed') {
        _sessionWritten = true; // prevent duplicate writes
        stopSessionPoll();
        completeSessionExchange(data);
        return;
      }

      // Check for rejection
      if (data.proposal && data.proposal.status === 'rejected') {
        stopSessionPoll();
        document.getElementById('session-status-line').textContent = 'Proposal rejected';
        const content = document.getElementById('session-content');
        const statusDiv = content.querySelector('.pair-status');
        if (statusDiv) {
          statusDiv.className = 'pair-status mismatch';
          statusDiv.innerHTML = '<div class="ps-icon">&#9888;</div>' +
            '<div class="ps-text">They didn\'t agree to the proposal. You may want to discuss and try again.</div>';
        }
        toast('Proposal rejected');
      }
    } catch(e) {
    }
  }

  function renderProposalReview() {
    if (!sessionProposal) return;

    document.getElementById('session-status-line').textContent = 'Proposal received \u2014 review it';

    const p = sessionProposal;
    const myDirection = p.direction === 'provided' ? 'received' : 'provided';
    const dirLabel = myDirection === 'received' ? 'You received' : 'You provided';
    const dirColor = myDirection === 'provided' ? 'var(--green)' : 'var(--accent)';

    let html = '';
    if (sessionPartner) {
      html += '<div class="session-partner">' +
        '<div class="sp-label">From</div>' +
        '<div class="sp-fp">' + esc((sessionPartner.fingerprint || '').substring(0, 16) + '...') + '</div>';
      var hasGenesis = sessionPartner && sessionPartner.thread_snapshot && sessionPartner.thread_snapshot._genesisPhoto;
      var hasCurrent = p.proposer_photo;
      if (hasGenesis || hasCurrent) {
        var gp = hasGenesis ? sessionPartner.thread_snapshot._genesisPhoto : null;
        html += '<div style="display:flex; justify-content:center; align-items:flex-end; gap:16px; margin-top:10px;">';
        if (gp) {
          html += '<div style="text-align:center;">' +
            '<img src="' + gp + '" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:2px solid var(--border);">' +
            '<div style="font-size:11px; color:var(--text-faint); margin-top:4px;">Genesis</div></div>';
        }
        if (hasCurrent) {
          html += '<div style="text-align:center;">' +
            '<img src="' + p.proposer_photo + '" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:2px solid var(--accent-dim);">' +
            '<div style="font-size:11px; color:var(--text-faint); margin-top:4px;">Current</div></div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    html += '<div class="session-proposal-review">' +
      '<div class="spr-title">Their proposal</div>' +
      '<div class="spr-row"><span class="spr-label">Description</span><span class="spr-val">' + esc(p.description || '') + '</span></div>' +
      '<div class="spr-row"><span class="spr-label">Your role</span><span class="spr-val" style="color:' + dirColor + ';">' + dirLabel + '</span></div>' +
      '<div class="spr-row"><span class="spr-label">Declared value</span><span class="spr-val">' + p.value + '</span></div>';
    if (p.category) {
      html += '<div class="spr-row"><span class="spr-label">Category</span><span class="spr-val">' + esc(p.category) + '</span></div>';
    }
    if (p.duration) {
      const hrs = Math.floor(p.duration / 60);
      const mins = p.duration % 60;
      const durStr = hrs > 0 ? hrs + 'h ' + (mins > 0 ? mins + 'm' : '') : mins + 'm';
      html += '<div class="spr-row"><span class="spr-label">Duration</span><span class="spr-val">' + durStr + '</span></div>';
    }

    // Inline exchange rate conversion for this proposal
    if (state.chain.length > 0 && sessionPartner && sessionPartner.thread_snapshot && sessionPartner.thread_snapshot.n) {
      var ts = sessionPartner.thread_snapshot;
      var mySnap = HCP.chainSnapshot(state.chain);
      var myDensity = mySnap.d || 1;
      var theirDensity = ts.d || 1;
      var cat = p.category || '';
      var myCats = mySnap.cats || {};
      var theirCats = ts.cats || {};
      var catMatch = cat && myCats[cat] && theirCats[cat];
      var convRatio = catMatch ? (myCats[cat].avg / theirCats[cat].avg) : (myDensity / theirDensity);
      var converted = Math.round(p.value * convRatio);
      var rateLabel = catMatch ? esc(cat) + ' rate' : 'overall rate';
      html += '<div class="spr-row" style="border-top:1px solid var(--bg-input); padding-top:8px; margin-top:4px;">' +
        '<span class="spr-label">In your units</span>' +
        '<span class="spr-val" style="color:var(--accent); font-size:16px;">\u2248 ' + converted + '</span></div>';
      html += '<div style="font-size: 13px; color:var(--text-faint); text-align:right; margin-top:2px;">Using ' + rateLabel + ' (' + convRatio.toFixed(2) + ':1)</div>';
    }
    html += '</div>';

    // Counterparty context block — chain shape + proof-of-human verdict.
    // Shared helper used on both the connected screen and this proposal
    // review screen so the surfaces are consistent regardless of role.
    try {
      if (sessionPartner && sessionPartner.thread_snapshot) {
        html += renderCounterpartyContextBlock(sessionPartner.thread_snapshot);
      }
    } catch(cpe) {
      console.log('[session] Counterparty context render failed:', cpe.message);
    }

    // Pricing context chart — time-scatter showing my + their + shared
    // history in this category, with today's proposed value pinned.
    // Locked to the proposal's category. Only shown when we have a
    // category on the proposal and either side has any history in it.
    try {
      if (sessionPartner && sessionPartner.thread_snapshot) {
        html += renderPricingContextChart(
          sessionPartner.thread_snapshot,
          p,
          sessionPartner.fingerprint
        );
      }
    } catch(pce) {
      console.log('[session] Pricing context render failed:', pce.message);
    }

    // Confirm / reject buttons
    html += '<div class="session-actions">' +
      '<button class="btn btn-secondary" onclick="App.sessionReject()">Not right</button>' +
      '<button class="btn btn-primary" onclick="App.sessionConfirm()">Confirm</button>' +
      '</div>';

    // Full interactive thread viewer below for exploration
    if (sessionPartner && sessionPartner.thread_snapshot && sessionPartner.thread_snapshot.n) {
      html += '<div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">';
      html += '<div style="font-size:13px; color:var(--text-dim); margin-bottom:8px;">Explore their thread</div>';
      html += buildSessionTabBar();
      html += '<div class="sess-tab-content" id="sess-tab-body">' + renderSessionTabContent(sessionActiveTab) + '</div>';
      html += '</div>';
    }

    document.getElementById('session-content').innerHTML = html;
  }

  async function sessionConfirm() {
    if (_sessionWritten) return; // prevent duplicate writes
    const url = getWitnessUrl();
    if (!url || !sessionCode) return;

    // Disable button and show spinner
    var acceptBtn = document.getElementById('btn-session-accept');
    if (acceptBtn) { acceptBtn.disabled = true; acceptBtn.textContent = 'Recording...'; acceptBtn.style.opacity = '0.6'; }

    _sessionWritten = true; // set immediately before any async work

    try {
        var confirmPhotoHash = '';
        try { if (state.declarations.photo) confirmPhotoHash = await sensorSha256(state.declarations.photo); } catch(ph) {}
        const resp = await serverFetch(url + '/session/' + sessionCode + '/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true, device_ts: Date.now(), sensor_hash: _cachedDeviceHash, platform: navigator.platform, geo: _cachedGeo ? JSON.stringify(_cachedGeo) : '', device_hash: _cachedDeviceHash, photo: state.declarations.photo || '', photo_hash: confirmPhotoHash }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast(err.error || 'Confirmation failed');
        _sessionWritten = false;
        if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = 'Accept'; acceptBtn.style.opacity = '1'; }
        return;
      }

      const data = await resp.json();
      if (data.confirmed) {
        // Write confirmer's chain
        await writeSessionRecord('confirmer', data);
      }
    } catch(e) {
      console.log('[session] Confirm failed:', e.message);
      toast('Confirmation failed -- try again');
      _sessionWritten = false;
      var acceptBtn2 = document.getElementById('btn-session-accept');
      if (acceptBtn2) { acceptBtn2.disabled = false; acceptBtn2.textContent = 'Accept'; acceptBtn2.style.opacity = '1'; }
    }
  }

  async function sessionReject() {
    const url = getWitnessUrl();
    if (!url || !sessionCode) return;

    try {
      await serverFetch(url + '/session/' + sessionCode + '/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: false }),
      });
      toast('Proposal rejected');
      document.getElementById('session-status-line').textContent = 'Rejected';
      document.getElementById('session-content').innerHTML =
        '<div class="pair-status mismatch">' +
        '<div class="ps-icon">&#10005;</div>' +
        '<div class="ps-text">You rejected this proposal. You can discuss with the other person and try again.</div>' +
        '</div>';
    } catch(e) {
      console.log('[session] Reject failed:', e.message);
      toast('Failed to send rejection');
    }
  }

  async function completeSessionExchange(data) {
    // Proposer: the confirmer has confirmed. Write proposer's chain.
    if (!data.proposal || !sessionPartner) return;
    // Decrypt exchange content if encrypted
    if (data.proposal.encrypted_exchange && sessionSharedKey) {
      try {
        const dec = await HCP.decryptRelayPayload(data.proposal.encrypted_exchange, sessionSharedKey);

        // Layer 3: Verify nonce-bound integrity hash
        if (sessionProposalNonce && sessionProposalIntegrityHash) {
          if (!dec._nonce || dec._nonce !== sessionProposalNonce) {
            console.error('[nonce] VIOLATION: nonce mismatch or missing. Expected:', sessionProposalNonce, 'Got:', dec._nonce);
            sessionViolation('nonce_mismatch');
            return;
          }
          // Recompute integrity hash and verify
          var verifyInput = dec._nonce + '|' + dec.value + '|' + dec.direction + '|' + (dec.description || '') + '|' + (dec.category || '') + '|' + (dec.duration || 0);
          var verifyBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifyInput));
          var verifyHash = Array.from(new Uint8Array(verifyBuf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
          if (verifyHash !== sessionProposalIntegrityHash) {
            console.error('[nonce] VIOLATION: integrity hash mismatch. Expected:', sessionProposalIntegrityHash.substring(0, 16), 'Got:', verifyHash.substring(0, 16));
            sessionViolation('integrity_hash_mismatch');
            return;
          }
          console.log('[nonce] Integrity verified successfully');
        }

        data.proposal.value = dec.value;
        data.proposal.direction = dec.direction;
        data.proposal.description = dec.description;
        data.proposal.category = dec.category;
        data.proposal.duration = dec.duration;
        data.proposal.proposer_photo = dec.photo;
      } catch(de) {
        // Fallback: use local pending proposal values
        if (state.pendingProposal) {
          data.proposal.value = state.pendingProposal.details.value;
          data.proposal.direction = state.pendingProposal.details.energyState;
          data.proposal.description = state.pendingProposal.details.description;
          data.proposal.category = state.pendingProposal.details.category;
          data.proposal.duration = state.pendingProposal.details.duration;
        }
      }
    }
    sessionSetState('done');
    await writeSessionRecord('proposer', data, '');
  }

  async function writeSessionRecord(role, data) {
    const p = data.proposal || sessionProposal;
    if (!p) return;

    // Determine direction and counterparty based on role
    let myDirection, counterpartyFp, counterpartyKey;

    if (role === 'confirmer') {
      // Confirmer: flip the proposer's direction
      myDirection = p.direction === 'provided' ? 'received' : 'provided';
      counterpartyFp = data.proposer ? data.proposer.fingerprint : sessionPartner.fingerprint;
      counterpartyKey = data.proposer ? data.proposer.public_key : sessionPartner.public_key;
    } else {
      // Proposer: use the direction as stated
      myDirection = p.direction;
      counterpartyFp = sessionPartner.fingerprint;
      counterpartyKey = sessionPartner.public_key;
    }

    // Extract counterparty device hash based on role
    var cpDeviceHash;
    if (role === 'confirmer') {
      cpDeviceHash = (data.proposer && data.proposer.device_hash) || undefined;
    } else {
      cpDeviceHash = (data.proposal && data.proposal.confirmer_device_hash) || undefined;
    }

    const record = HCP.createRecord({
      type: 'exchange',
      value: p.value,
      energyState: myDirection,
      counterparty: counterpartyFp,
      description: p.description,
      category: p.category || undefined,
      duration: p.duration || undefined,
      counterpartyDeviceHash: cpDeviceHash,
    });

    // Capture sensor data and attach to record
    try {
      var snap = await captureSensor();
      if (snap.geo) record.geo = snap.geo;
      if (snap.device) record.device = snap.device;
      if (snap.sensorHash) record.sensorHash = snap.sensorHash;
      record.pohSnapshot = {
        signalHash: snap.signalHash,
        networkHash: snap.networkHash,
        webglHash: snap.webglHash,
        canvasHash: snap.canvasHash,
        batteryState: snap.batteryState,
        capabilityMask: snap.capabilityMask,
        capturedAt: snap.timestamp
      };
      // Refresh cached geo and device hash for cross-device exchange on next transaction
      if (snap.geo) _cachedGeo = snap.geo;
      try { _cachedDeviceHash = await quickDeviceHash(); } catch(e) {}
    } catch(sensorErr) {
      console.log('[sensor] Capture failed:', sensorErr.message);
    }

    // --- Integrity fields ---
    // 1. Exchange path: how this exchange was initiated
    record.exchangePath = HCP.EXCHANGE_PATHS.SESSION;
    record.connectivityAvailable = navigator.onLine;

    // 2. Entropy chaining: hash of previous record's sensor data
    try {
      var ep = await HCP.chainEntropyPrev(state.chain);
      if (ep) record.entropyPrev = ep;
    } catch(epErr) {
      console.log('[integrity] entropyPrev failed:', epErr.message);
    }

    // 3. Clock skew: delta between counterparty's fresh device_ts and ours.
    // IMPORTANT: we only write clockSkew on the PROPOSER side. The confirmer's
    // view of the proposer's device_ts is polluted by review time — the
    // proposer sent their proposal up to minutes earlier, and at confirmation
    // write time Date.now() - proposer_device_ts = clock_drift + review_time.
    // Writing that would corrupt the chain-wide clock-agreement signal with
    // fake drift any time someone takes a moment to read a proposal.
    //
    // The proposer's side, by contrast, receives the confirmer's device_ts in
    // the confirmation payload with millisecond freshness — that's real clock
    // drift, not elapsed time. So clockSkew is only written on proposer
    // records, and the aggregate still has plenty of samples across a chain
    // of exchanges (each exchange has one proposer).
    try {
      if (role === 'proposer') {
        var counterpartyTs = (data.proposal && data.proposal.confirmer_device_ts) || p.confirmer_device_ts;
        if (typeof counterpartyTs === 'number') {
          record.clockSkew = Date.now() - counterpartyTs;
        }
      }
      // Confirmer: intentionally skipped — see comment above.
    } catch(csErr) {
      console.log('[integrity] clockSkew failed:', csErr.message);
    }

    // 4. Chain Merkle root: snapshot of full chain state at exchange time
    try {
      var mr = await HCP.chainMerkleRoot(state.chain);
      if (mr) record.chainMerkleRoot = mr;
    } catch(mrErr) {
      console.log('[integrity] merkleRoot failed:', mrErr.message);
    }

    // 5. Cross-device sensor hash, platform, and geo (non-serialized metadata)
    try {
      if (role === 'confirmer') {
        var cpSensor = p.sensor_hash || (data.proposal && data.proposal.sensor_hash);
        var cpPlatform = p.platform || (data.proposal && data.proposal.platform);
        var cpGeoRaw = p.geo || (data.proposal && data.proposal.geo);
        if (cpSensor) record.counterpartySensorHash = cpSensor;
        if (cpPlatform) record.counterpartyPlatform = cpPlatform;
        if (cpGeoRaw) { try { record.counterpartyGeo = typeof cpGeoRaw === 'string' ? JSON.parse(cpGeoRaw) : cpGeoRaw; } catch(e) {} }
      } else {
        var cpSensor2 = (data.proposal && data.proposal.confirmer_sensor_hash) || p.confirmer_sensor_hash;
        var cpPlatform2 = (data.proposal && data.proposal.confirmer_platform) || p.confirmer_platform;
        var cpGeoRaw2 = (data.proposal && data.proposal.confirmer_geo) || p.confirmer_geo;
        if (cpSensor2) record.counterpartySensorHash = cpSensor2;
        if (cpPlatform2) record.counterpartyPlatform = cpPlatform2;
        if (cpGeoRaw2) { try { record.counterpartyGeo = typeof cpGeoRaw2 === 'string' ? JSON.parse(cpGeoRaw2) : cpGeoRaw2; } catch(e) {} }
      }
    } catch(xdErr) {}

    await appendRecord(record);
    save();

    // Witness attestation
    if (counterpartyKey) {
      submitWitness(record, counterpartyKey);
    }

    // Clean up session state
    stopSessionPoll();
    sessionPartner = null;
    sessionProposal = null;

    // Remove from pending — save code before clearing
    const codeForCleanup = sessionCode;
    const pending = loadPending();
    const idx = pending.findIndex(pi => pi.transport === 'session' && pi.sessionCode === codeForCleanup);
    if (idx >= 0) {
      pending.splice(idx, 1);
      savePending(pending);
    } else {
      // Broader cleanup — remove any session pending items that look stale
      const beforeLen = pending.length;
      const cleaned = pending.filter(pi => pi.transport !== 'session');
      if (cleaned.length < beforeLen) {
        savePending(cleaned);
      }
    }

    sessionCode = null;
    sessionTheirCode = null;
    sessionRole = null;

    // Layer 4: Record success for server reputation
    var witnessUrl = getWitnessUrl();
    if (witnessUrl) recordServerSuccess(witnessUrl);

    // Show done
    var _cfPartnerName = '';
    if (sessionPartner && sessionPartner.thread_snapshot) {
      var _cpts = typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot;
      _cfPartnerName = (_cpts && _cpts._name) || '';
    }
    state.doneDetails = {
      partner: _cfPartnerName,
      direction: myDirection === 'provided' ? 'You provided' : 'You received',
      description: p.description || '',
      category: p.category || '',
      value: p.value,
      witnessed: !!(getWitnessUrl())
    };
    state.doneSummary = (myDirection === 'provided' ? 'Provided' : 'Received') + ': ' + (p.description || '') + ' -- ' + p.value + ' units';
    exRenderDoneCard();
    showExStep('done');

    refreshHome();
    toast('Exchange complete');
  }

  function cleanupSession() {
    stopSessionPoll();
    stopSnapshotPoll();
    sessionCode = null;
    sessionTheirCode = null;
    sessionPartner = null;
    sessionProposal = null;
    sessionRole = null;
    sessionSharedKey = null;
    sessionSASHash = null;
    sessionExpectedState = null;
    sessionProposalNonce = null;
    sessionProposalIntegrityHash = null;
    sessionActiveTab = 'texture';
    _sessionWritten = false;
    _pollBusy = false;
  }


  function initiatorConfirmScan() {
    // User confirms the other person has scanned their QR
    showExStep('waiting');
    document.getElementById('ex-waiting-status').textContent = "They're reviewing your proposal...";
    document.getElementById('ex-waiting-title').textContent = 'Waiting for their response';
    document.getElementById('ex-waiting-desc').textContent = 'Once they confirm, they\'ll show you a return code to scan.';
    document.getElementById('ex-waiting-scan').style.display = 'block';
    document.getElementById('ex-waiting-paste').style.display = 'none';
    // Start relay polling if server available
    startRelayPolling();
  }

  function initiatorConfirmSent() {
    // User confirms they've sent the proposal by message
    showExStep('waiting');
    document.getElementById('ex-waiting-status').textContent = "They're reviewing your proposal...";
    document.getElementById('ex-waiting-title').textContent = 'Waiting for their reply';
    document.getElementById('ex-waiting-desc').textContent = 'When they confirm, they\'ll send you a reply. Paste it below.';
    document.getElementById('ex-waiting-scan').style.display = 'none';
    document.getElementById('ex-waiting-paste').style.display = 'block';
    // Start relay polling if server available
    startRelayPolling();
  }

  function initiatorReadyScan() {
    // The other person is showing a return QR — open camera via URL scheme
    const pp = state.pendingProposal;
    if (!pp) { toast('No pending proposal found'); return; }
    // For now, show paste option as well
    document.getElementById('ex-waiting-title').textContent = 'Scan their code';
    document.getElementById('ex-waiting-desc').textContent = 'Open your phone\'s camera and point it at their QR code.';
    document.getElementById('ex-waiting-status').textContent = 'Ready to scan...';
    // Show paste as fallback
    document.getElementById('ex-waiting-paste').style.display = 'block';
    document.getElementById('ex-waiting-scan').innerHTML = '<button class="btn btn-secondary" style="margin-top:8px;" onclick="App.initiatorGoBack()">Back — they\'re not ready yet</button>';
  }

  function initiatorGoBack() {
    // Go back to waiting state
    if (state.proposalPath === 'inperson') {
      initiatorConfirmScan();
    } else {
      initiatorConfirmSent();
    }
  }

  function startRelayPolling() {
    // Check if relay is available and start polling for settlement
    if (!state.pendingProposal || !state.witnessServers || !state.witnessServers.length) return;
    const pp = state.pendingProposal;
    if (!pp.handshakeId) return;
    // Poll relay for settlement
    if (state.relayPollInterval) clearInterval(state.relayPollInterval);
    state.relayPollInterval = setInterval(async () => {
      try {
        const settlement = await tryRelayGet(pp.handshakeId);
        if (settlement) {
          clearInterval(state.relayPollInterval);
          state.relayPollInterval = null;
          // Auto-complete — relay delivered the settlement
          try {
            const parsed = HCP.parseConfirmationPayload(settlement);
            await completeInitiatorSide(parsed);
          } catch(e) { console.error('Relay settlement parse failed', e); }
        }
      } catch(e) { /* silent */ }
    }, 3000);
  }

  function copyProposal() {
    const p = document.getElementById('proposal-payload').value;
    navigator.clipboard.writeText(p).then(() => toast('Copied')).catch(() => { document.getElementById('proposal-payload').select(); document.execCommand('copy'); toast('Copied'); });
  }

  function shareProposal() {
    const p = document.getElementById('proposal-payload').value;
    if (navigator.share) navigator.share({ text: p }).catch(() => {});
    else copyProposal();
  }

  // Initiator scans confirmation from receiver (legacy — redirects to new flow)
  function scanConfirmation() {
    if (state.proposalPath === 'inperson') {
      initiatorConfirmScan();
    } else {
      initiatorConfirmSent();
    }
  }

  function parseExConfirmation() {
    const raw = document.getElementById('ex-paste-input-msg').value.trim();
    if (!raw) { toast('Paste a confirmation first'); return; }
    try {
      const parsed = HCP.parseConfirmationPayload(raw);
      completeInitiatorSide(parsed);
    } catch(e) { toast('Invalid confirmation'); }
  }

  async function completeInitiatorSide(confirmation) {
    // Verify this confirmation matches our proposal
    if (confirmation.originalFp !== state.fingerprint) {
      toast('This confirmation is for a different person');
      return;
    }

    // Create record with the receiver as counterparty
    const h = state.pendingProposal;
    const record = HCP.createRecord({
      type: h.details.type, value: h.details.value, energyState: h.details.energyState,
      counterparty: confirmation.fp,
      description: h.details.description,
      category: h.details.category, duration: h.details.duration,
      city: h.city, state: h.state_field,
      counterpartyDeviceHash: confirmation.deviceHash || undefined,
    });

    // Capture sensor data
    try {
      var snap = await captureSensor();
      if (snap.geo) record.geo = snap.geo;
      if (snap.device) record.device = snap.device;
      if (snap.sensorHash) record.sensorHash = snap.sensorHash;
      record.pohSnapshot = {
        signalHash: snap.signalHash,
        networkHash: snap.networkHash,
        webglHash: snap.webglHash,
        canvasHash: snap.canvasHash,
        batteryState: snap.batteryState,
        capabilityMask: snap.capabilityMask,
        capturedAt: snap.timestamp
      };
    } catch(sensorErr) {
      console.log('[sensor] Capture failed:', sensorErr.message);
    }

    // --- Integrity fields ---
    record.exchangePath = HCP.EXCHANGE_PATHS.QR;
    record.connectivityAvailable = navigator.onLine;
    try { var ep = await HCP.chainEntropyPrev(state.chain); if (ep) record.entropyPrev = ep; } catch(e) {}
    try { var mr = await HCP.chainMerkleRoot(state.chain); if (mr) record.chainMerkleRoot = mr; } catch(e) {}

    // A writes to chain
    await appendRecord(record);
    save();

    // Witness attestation (non-blocking)
    const counterpartyPub = confirmation.pub;
    submitWitness(record, counterpartyPub);

    // Generate settlement payload for B
    const settlementPayload = await HCP.generateSettlementPayload(state.publicKeyJwk, confirmation.fp, state.privateKey);
    state.settlementPayload = settlementPayload;
    const settlementUrl = getAppBase() + '?st=' + b64Encode(settlementPayload);

    // Settlement relay — push to server so B can auto-receive
    let relayDelivered = false;
    if (getWitnessUrl() && h.payload) {
      try {
        const proposalTs = JSON.parse(h.payload).z;
        const hsId = await HCP.computeHandshakeId(state.publicKeyJwk, counterpartyPub, proposalTs);
        relayDelivered = await relayPut(hsId, settlementPayload);
        if (relayDelivered) console.log('[relay] Settlement deposited for auto-settle');
      } catch(e) { console.log('[relay] Could not deposit settlement:', e.message); }
    }

    // Store done summary
    const dirLabel = h.details.energyState === 'provided' ? 'Provided' : 'Received';
    state.doneSummary = dirLabel + ' ' + h.details.value + ' for "' + h.details.description + '" -- recorded.';
    var _donePartnerName = '';
    if (sessionPartner && sessionPartner.thread_snapshot) {
      var _dts = typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot;
      _donePartnerName = (_dts && _dts._name) || '';
    }
    state.doneDetails = {
      partner: _donePartnerName,
      direction: h.details.energyState === 'provided' ? 'You provided' : 'You received',
      description: h.details.description || '',
      category: h.details.category || '',
      value: h.details.value,
      witnessed: !!(getWitnessUrl())
    };

    // Clear pending
    const pending = loadPending();
    const match = pending.findIndex(p => p.role === 'initiator' && p.description === h.details.description && p.value === h.details.value);
    if (match >= 0) { pending.splice(match, 1); savePending(pending); }

    // Clear form
    ['ex-desc','ex-value','ex-category','ex-duration','ex-hours','ex-minutes','ex-city','ex-state'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    state.pendingProposal = null;
    localStorage.removeItem('hcp_pending_proposal');

    if (relayDelivered) {
      // Server delivered the settlement -- skip the QR, go straight to done
      exRenderDoneCard();
      showModal('exchange');
      showExStep('done');
    } else {
      // No server or relay failed — show settlement QR for manual delivery
      const path = state.proposalPath || 'inperson';
      showModal('exchange');
      document.getElementById('settle-inperson').style.display = path === 'inperson' ? 'block' : 'none';
      document.getElementById('settle-message').style.display = path === 'message' ? 'block' : 'none';
      if (path === 'inperson') {
        try { QR.generate(settlementUrl, document.getElementById('settlement-qr'), 300); } catch(e) {}
      }
      document.getElementById('settlement-payload').value = settlementPayload;
      showExStep('settle');
    }
    refreshHome();
  }

  // --- Share Chain (negotiation view) ---
  async function shareChain(fromModal) {
    const snap = HCP.chainSnapshot(state.chain);
    const summaryEl = document.getElementById('chainshare-summary');
    summaryEl.innerHTML = `
      <div class="review-row"><span class="rlbl">Acts</span><span class="rval">${snap.n}</span></div>
      <div class="review-row"><span class="rlbl">Density</span><span class="rval">${snap.d}</span></div>
      <div class="review-row"><span class="rlbl">Give/Receive</span><span class="rval">${snap.g}/${snap.r}</span></div>
      <div class="review-row"><span class="rlbl">Thread Age</span><span class="rval">${snap.t0?new Date(snap.t0).toLocaleDateString():'\u2014'}</span></div>
      ${Object.entries(snap.cats).map(([k,v])=>`<div class="review-row"><span class="rlbl">${esc(k)}</span><span class="rval">${v.n} acts \u00b7 avg ${v.avg}</span></div>`).join('')}
    `;

    // Enriched snapshot payload — balance excluded, all viewer tab data included
    const viewPayload = JSON.stringify({ a:'cv', f:state.fingerprint, s:snap, z:new Date().toISOString() });

    const qrUrl = getAppBase() + '?cv=' + b64Encode(viewPayload);
    document.getElementById('chainshare-payload').value = viewPayload;
    try { QR.generate(qrUrl, document.getElementById('chainshare-qr'), 300); } catch(e) {}
    if (fromModal) closeModal(fromModal);
    showModal('chainshare');
  }

  function shareChainFromViewer() {
    shareChain('chain');
  }

  // --- Incoming Chain Viewer (Five Tabs) ---
  let incomingSnap = null;

  function showIncomingChainView(data) {
    incomingSnap = data.s || {};
    incomingSnap._fp = data.f || '';
    showModal('chainview');
    incomingChainTab('texture');
  }

  function incomingChainTab(tab) {
    ['cv-texture','cv-wordcloud','cv-ratio','cv-time','cv-stability'].forEach(function(t) {
      document.getElementById(t).classList.toggle('active', t === 'cv-' + tab);
    });
    renderIncomingTab(tab);
  }

  function renderIncomingTab(tab) {
    const body = document.getElementById('chainview-body');
    const s = incomingSnap;
    if (!s || !s.n) { body.innerHTML = '<div class="empty-state">No thread data received.</div>'; return; }

    if (tab === 'texture') {
      let h = '<div class="review-panel">';
      h += '<div class="review-row"><span class="rlbl">From</span><span class="rval" style="font-family:var(--font-mono);font-size: 13px;">' + esc(s._fp) + '</span></div>';
      h += '<div class="review-row"><span class="rlbl">Total Acts</span><span class="rval">' + s.n + '</span></div>';
      h += '<div class="review-row"><span class="rlbl">Density</span><span class="rval">' + s.d + ' u/act</span></div>';
      h += '<div class="review-row"><span class="rlbl">Give / Receive</span><span class="rval">' + s.g + ' / ' + s.r + '</span></div>';
      h += '<div class="review-row"><span class="rlbl">Thread Age</span><span class="rval">' + (s.t0 ? new Date(s.t0).toLocaleDateString() + ' \u2014 ' + new Date(s.t1).toLocaleDateString() : '\u2014') + '</span></div>';
      h += '</div>';
      h += '<h3 style="margin:16px 0 8px;font-size:13px;color:var(--text-dim);">Categories</h3>';
      const cats = s.cats || {};
      if (Object.keys(cats).length) {
        h += '<div class="review-panel">';
        Object.entries(cats).sort(function(a,b){return b[1].n - a[1].n;}).forEach(function(e) {
          const k = e[0], v = e[1];
          const pct = Math.round(v.n / s.n * 100);
          h += '<div style="margin-bottom:12px;">';
          h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:14px;font-weight:500;">' + esc(k) + '</span><span style="font-size:13px;color:var(--text-dim);">' + v.n + ' acts \u00b7 ' + pct + '%</span></div>';
          h += '<div style="height:14px;background:var(--bg-input);border-radius:7px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:3px;"></div></div>';
          h += '<div style="font-size: 13px;color:var(--text-faint);margin-top:3px;">avg ' + v.avg + ' units \u00b7 provided ' + v.g + ' \u00b7 received ' + v.r + '</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      body.innerHTML = h;
    }
    else if (tab === 'wordcloud') {
      const words = s.words || {};
      const entries = Object.entries(words).sort(function(a,b){return b[1]-a[1];});
      if (!entries.length) { body.innerHTML = '<div class="empty-state">No description data available.</div>'; return; }
      const maxCount = entries[0][1];
      let h = '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0;">';
      entries.forEach(function(e) {
        const word = e[0], count = e[1];
        const size = Math.max(13, Math.min(28, 13 + (count / maxCount) * 15));
        const opacity = 0.5 + (count / maxCount) * 0.5;
        h += '<span style="font-size:' + size + 'px;opacity:' + opacity + ';color:var(--accent);font-weight:500;cursor:pointer;padding:4px 8px;background:rgba(42,90,143,0.08);border-radius:6px;" onclick="App.wordCloudDetail(\'' + esc(word) + '\')">' + esc(word) + '<sub style="font-size: 13px;color:var(--text-faint);margin-left:2px;">' + count + '</sub></span>';
      });
      h += '</div>';
      h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;">Tap a word to see details. Larger words appear more often in their exchange descriptions.</p>';
      body.innerHTML = h;
    }
    else if (tab === 'ratio') {
      const myDensity = HCP.chainDensity(state.chain);
      const theirDensity = s.d || 1;
      const ratio = myDensity / theirDensity;
      const isParity = Math.abs(ratio - 1) < 0.15;
      const ratioStr = isParity ? '1 : 1' : (ratio >= 1 ? '1 : ' + ratio.toFixed(2) : (1/ratio).toFixed(2) + ' : 1');

      let h = '<div style="text-align:center;padding:20px;border-radius:var(--radius);margin-bottom:16px;background:' + (isParity ? 'rgba(43,140,62,0.1)' : 'rgba(42,90,143,0.1)') + ';border:1px solid ' + (isParity ? 'var(--green)' : 'var(--blue)') + ';">';
      h += '<div style="font-size:13px;color:var(--text-dim);margin-bottom:4px;">Exchange Ratio</div>';
      h += '<div style="font-size:36px;font-weight:300;color:' + (isParity ? 'var(--green)' : 'var(--blue)') + ';">' + ratioStr + '</div>';
      h += '<div style="font-size: 13px;color:var(--text-faint);margin-top:6px;">You: ' + myDensity.toFixed(1) + ' u/act \u00b7 Them: ' + theirDensity + ' u/act</div>';
      h += '</div>';

      // What prices mean in your units
      const theirAvg = theirDensity;
      h += '<div class="review-panel" style="margin-bottom:12px;">';
      h += '<div style="font-size:13px;color:var(--text-dim);margin-bottom:10px;">What their prices mean in your units</div>';
      [50, 100, 200, 500].forEach(function(val) {
        const inYours = Math.round(val * ratio);
        const hrs = myDensity > 0 ? (inYours / myDensity).toFixed(1) : '\u2014';
        h += '<div class="review-row"><span class="rlbl">' + val + ' of their units</span><span class="rval">' + inYours + ' of yours \u00b7 ~' + hrs + ' avg acts</span></div>';
      });
      h += '</div>';

      h += '<p style="font-size: 13px;color:var(--text-faint);line-height:1.5;">' + (isParity ? 'Near parity. Your unit scales are roughly equivalent.' : 'Different densities. The ratio adjusts prices so both sides are honestly represented. Neither unit is worth more — they measure at different scales.') + '</p>';
      body.innerHTML = h;
    }
    else if (tab === 'time') {
      const timeData = s.time || {};
      const months = Object.keys(timeData).sort();
      if (!months.length) { body.innerHTML = '<div class="empty-state">No time data available.</div>'; return; }
      const maxActs = Math.max.apply(null, Object.values(timeData));
      let h = '<div style="padding:4px 0;">';
      months.forEach(function(m) {
        const count = timeData[m];
        const pct = Math.round(count / maxActs * 100);
        const parts = m.split('-');
        const label = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
        h += '<span style="font-size: 13px;color:var(--text-dim);min-width:70px;">' + label + '</span>';
        h += '<div style="flex:1;height:14px;background:var(--bg-input);border-radius:7px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:4px;"></div></div>';
        h += '<span style="font-size: 13px;font-weight:500;min-width:28px;text-align:right;">' + count + '</span>';
        h += '</div>';
      });
      h += '</div>';
      // Gap detection
      if (months.length > 1) {
        const gaps = [];
        for (let i = 1; i < months.length; i++) {
          const prev = months[i-1].split('-').map(Number);
          const curr = months[i].split('-').map(Number);
          const diff = (curr[0] - prev[0]) * 12 + (curr[1] - prev[1]);
          if (diff > 1) gaps.push(diff + ' month gap before ' + months[i]);
        }
        if (gaps.length) {
          h += '<div style="margin-top:12px;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm);font-size: 13px;color:var(--text-dim);line-height:1.5;">Gaps: ' + gaps.join(', ') + '</div>';
        }
      }
      h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;">Activity pattern over time. Consistent activity suggests a stable, active participant.</p>';
      body.innerHTML = h;
    }
    else if (tab === 'stability') {
      const stab = s.stab || {};
      const cats = Object.keys(stab);
      if (!cats.length) { body.innerHTML = '<div class="empty-state">No stability data available.</div>'; return; }
      let h = '';
      cats.sort(function(a,b){return (s.cats[b]||{n:0}).n - (s.cats[a]||{n:0}).n;}).forEach(function(cat) {
        const d = stab[cat]; // [min, max, avg, stddev]
        const range = d[1] - d[0];
        const cv = d[2] > 0 ? (d[3] / d[2] * 100).toFixed(0) : 0;
        h += '<div class="review-panel" style="margin-bottom:10px;">';
        h += '<div style="font-size:14px;font-weight:500;margin-bottom:8px;">' + esc(cat) + '</div>';
        h += '<div class="review-row"><span class="rlbl">Average</span><span class="rval">' + d[2] + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Range</span><span class="rval">' + d[0] + ' \u2014 ' + d[1] + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Std Dev</span><span class="rval">' + d[3] + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Variation</span><span class="rval">' + cv + '%</span></div>';
        // Visual range bar
        h += '<div style="margin-top:8px;position:relative;height:24px;background:var(--bg-input);border-radius:4px;">';
        const maxVal = d[1] * 1.2 || 100;
        const minPct = d[0] / maxVal * 100;
        const maxPct = d[1] / maxVal * 100;
        const avgPct = d[2] / maxVal * 100;
        h += '<div style="position:absolute;left:' + minPct + '%;width:' + (maxPct - minPct) + '%;top:4px;height:16px;background:rgba(42,90,143,0.2);border-radius:3px;"></div>';
        h += '<div style="position:absolute;left:' + avgPct + '%;top:2px;width:2px;height:20px;background:var(--accent);border-radius:1px;"></div>';
        h += '</div>';
        h += '</div>';
      });
      h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;line-height:1.5;">Low variation indicates consistent pricing. High variation may reflect different scopes of work within a category. The data is raw — you decide what it means.</p>';
      body.innerHTML = h;
    }
  }

  function wordCloudDetail(word) {
    const s = incomingSnap;
    const cats = s.cats || {};
    const count = (s.words || {})[word] || 0;
    const total = Object.values(s.words || {}).reduce(function(a,b){return a+b;}, 0);
    const pct = total > 0 ? Math.round(count / total * 100) : 0;
    // Find which categories likely contain this word
    let detail = word + ': ' + count + ' mentions (' + pct + '% of all words)';
    toast(detail);
  }

  function copyChainShare() {
    const p = document.getElementById('chainshare-payload').value;
    navigator.clipboard.writeText(p).then(() => toast('Copied')).catch(() => toast('Could not copy'));
  }

  function shareChainShareText() {
    const p = document.getElementById('chainshare-payload').value;
    if (navigator.share) navigator.share({ text: p }).catch(() => {});
    else copyChainShare();
  }

  // --- Confirm (Receiver Side) ---
  function showCfStep(step) {
    document.querySelectorAll('#confirm-body .hs-step').forEach(s => s.classList.remove('active'));
    document.getElementById('cf-step-' + step).classList.add('active');
  }

  function openConfirm() {
    showModal('confirm');
    showCfStep('scan');
    state.pendingProposal = null;
  }

  function closeConfirm() {
    state.pendingProposal = null;
    closeModal('confirm');
    refreshHome();
  }

  function parseCfProposal() {
    const raw = document.getElementById('cf-paste-input').value.trim();
    if (!raw) { toast('Paste a payload first'); return; }
    try { showCfReview(HCP.parseHandshakePayload(raw)); } catch(e) { toast('Invalid payload'); }
  }

  // === THREE-TAB NEGOTIATION STATE ===
  let cfStep = 0, cfSeen = [false,false,false], cfRecvCat = '', cfProvCat = '', cfAdjVal = 0, cfOrigVal = 0;

  function showCfReview(parsed) {
    state.pendingProposal = parsed;
    cfStep = 0; cfSeen = [false,false,false]; cfRecvCat = ''; cfProvCat = ''; cfAdjVal = 0;
    cfOrigVal = parsed.exchange.value;
    // Store snapshot for chain drill-down
    if (parsed.snapshot && parsed.snapshot.n) {
      incomingSnap = parsed.snapshot;
      incomingSnap._fp = parsed.fp;
    }
    renderCfStepBar();
    renderCfPage();
    showCfStep('review');
  }

  function cfGoStep(s) {
    if (s > cfStep + 1) return;
    cfSeen[cfStep] = true;
    cfStep = s;
    renderCfStepBar();
    renderCfPage();
  }

  function setCfRecvCat(v) { cfRecvCat = v; renderCfPage(); }
  function setCfProvCat(v) { cfProvCat = v; renderCfPage(); }

  function cfUpdSlider() {
    const sl = document.getElementById('cf-nslider');
    if (!sl) return;
    cfAdjVal = parseInt(sl.value);
    const d = getCfNegoData();
    const el = document.getElementById('cf-nv');
    const sub = document.getElementById('cf-nv-sub');
    if (el) el.textContent = cfAdjVal;
    if (sub) sub.textContent = 'converts to ' + Math.round(cfAdjVal * d.catER) + ' in your units';
  }

  function cfEditValue() {
    const display = document.getElementById('cf-nv');
    const edit = document.getElementById('cf-nedit');
    if (!display || !edit) return;
    edit.value = cfAdjVal || cfOrigVal;
    display.parentElement.style.display = 'none';
    edit.style.display = 'block';
    edit.focus();
    edit.select();
  }

  function cfCommitEdit() {
    const edit = document.getElementById('cf-nedit');
    if (!edit) return;
    const val = parseInt(edit.value);
    if (!isNaN(val) && val >= 0) {
      cfAdjVal = val;
      // Re-render the price page so slider range updates relative to new value
      renderCfPage();
    } else {
      // Invalid — just close the edit
      const display = document.getElementById('cf-nv');
      if (display) display.parentElement.style.display = 'flex';
      edit.style.display = 'none';
    }
  }

  function getCfNegoData() {
    const parsed = state.pendingProposal;
    const mySnap = HCP.chainSnapshot(state.chain);
    const theirSnap = parsed.snapshot || {};
    const myDensity = HCP.chainDensity(state.chain);
    const theirDensity = theirSnap.d || parsed.density || 1;
    const cat = parsed.exchange.category || '';
    // Provider (their) comparison category — selectable
    const theirCompCat = cfProvCat && theirSnap.cats && theirSnap.cats[cfProvCat] ? cfProvCat : (cat && theirSnap.cats && theirSnap.cats[cat] ? cat : '');
    const theirCatData = theirCompCat && theirSnap.cats ? theirSnap.cats[theirCompCat] : null;
    const theirCatAvg = theirCatData ? theirCatData.avg : theirDensity;
    const theirStab = theirCompCat && theirSnap.stab ? theirSnap.stab[theirCompCat] : null;
    const theirCompLabel = theirCompCat || 'overall';
    // Their provided categories for dropdown
    const theirCatList = [];
    if (theirSnap.cats) Object.keys(theirSnap.cats).forEach(function(k) { if (theirSnap.cats[k].g > 0) theirCatList.push(k); });
    // My (receiver) comparison category — selectable
    const myCompCat = cfRecvCat && mySnap.cats[cfRecvCat] ? cfRecvCat : (mySnap.cats[cat] ? cat : '');
    const myCompAvg = myCompCat && mySnap.cats[myCompCat] ? mySnap.cats[myCompCat].avg : myDensity;
    const myCompLabel = myCompCat || 'overall';
    const catER = myCompAvg / theirCatAvg;
    const overallER = myDensity / theirDensity;
    // My provided categories for dropdown
    const myCatList = [];
    Object.keys(mySnap.cats).forEach(function(k) { if (mySnap.cats[k].g > 0) myCatList.push(k); });
    // Build comps from their snapshot acts if available — use stability data
    const proposedVal = cfAdjVal || cfOrigVal;
    const fieldAdj = Math.round(proposedVal * catER);
    // Surplus — walletBalance returns provided_total minus received_total as a single number
    const mySurplus = HCP.walletBalance(state.chain) || 0;
    const afterBalance = mySurplus - fieldAdj;
    return {
      parsed, mySnap, theirSnap, myDensity, theirDensity,
      cat, theirCompCat, theirCompLabel, theirCatData, theirCatAvg, theirStab, theirCatList,
      myCompCat, myCompAvg, myCompLabel, catER, overallER,
      myCatList, proposedVal, fieldAdj, mySurplus, afterBalance
    };
  }

  function renderCfStepBar() {
    const labels = ['The Rate', 'The Price', 'The Record'];
    let h = '';
    for (let i = 0; i < 3; i++) {
      let cls = 'cf-step-tab';
      if (i === cfStep) cls += ' active';
      else if (cfSeen[i]) cls += ' seen';
      else if (i > cfStep + 1 || (i > 0 && !cfSeen[i-1] && i !== cfStep + 1)) cls += ' locked';
      const numC = (cfSeen[i] && i !== cfStep) ? '\u2713' : (i + 1);
      h += '<button class="' + cls + '" onclick="App.cfGoStep(' + i + ')"><span class="cst-num">' + numC + '</span><span class="cst-label">' + labels[i] + '</span></button>';
    }
    document.getElementById('cf-step-bar').innerHTML = h;
  }

  function renderCfPage() {
    const parsed = state.pendingProposal;
    if (!parsed) return;
    const hasSnap = parsed.snapshot && parsed.snapshot.n;
    // Hide all pages
    ['cf-page-rate','cf-page-price','cf-page-record'].forEach(function(id) {
      document.getElementById(id).className = 'cf-page';
      document.getElementById(id).innerHTML = '';
    });
    const pageId = ['cf-page-rate','cf-page-price','cf-page-record'][cfStep];
    document.getElementById(pageId).className = 'cf-page active';

    if (!hasSnap) {
      // No snapshot — simple review fallback
      renderCfSimpleReview();
      return;
    }

    const d = getCfNegoData();

    if (cfStep === 0) renderCfRate(d);
    else if (cfStep === 1) renderCfPrice(d);
    else if (cfStep === 2) renderCfRecord(d);
  }

  function renderCfSimpleReview() {
    // Fallback when no snapshot available — basic proposal info + confirm
    const parsed = state.pendingProposal;
    const flip = parsed.exchange.energyState === 'provided' ? 'You receive' : 'You provide';
    let h = '<div style="text-align:center;padding:12px 0;"><h3>Review this exchange</h3></div>';
    h += '<div class="cf-ctx">';
    h += '<div class="cf-ctx-row"><span class="cl">Value</span><span class="cv">' + parsed.exchange.value + '</span></div>';
    h += '<div class="cf-ctx-row"><span class="cl">Direction</span><span class="cv">' + flip + '</span></div>';
    if (parsed.exchange.description) h += '<div class="cf-ctx-row"><span class="cl">Their description</span><span class="cv">' + esc(parsed.exchange.description) + '</span></div>';
    if (parsed.exchange.category) h += '<div class="cf-ctx-row"><span class="cl">Category</span><span class="cv">' + esc(parsed.exchange.category) + '</span></div>';
    h += '<div class="cf-ctx-row"><span class="cl">Their density</span><span class="cv">' + parsed.density.toFixed(1) + '</span></div>';
    h += '<div class="cf-ctx-row"><span class="cl">Their thread</span><span class="cv">' + parsed.chainLen + ' acts</span></div>';
    h += '</div>';
    h += '<div class="field"><label>Their name (for your records)</label><input type="text" id="cf-name" placeholder="Optional"></div>';
    h += '<button class="btn btn-primary" onclick="App.confirmAndSign()">Confirm & Sign</button>';
    h += '<button class="btn btn-secondary" onclick="App.cancelConfirm()">Decline</button>';
    document.getElementById('cf-page-rate').innerHTML = h;
  }

  function renderCfRate(d) {
    let h = '<div style="font-size:14px;color:var(--text);margin-bottom:14px;">What\u2019s the exchange rate for <strong>' + esc(d.cat || 'this work') + '</strong>?</div>';

    // Two rate cards
    h += '<div class="cf-rate-pair">';
    h += '<div class="cf-rate-card overall"><div class="crc-label">Overall Rate</div>';
    h += '<div class="crc-val" style="color:var(--blue)">1 = ' + d.overallER.toFixed(2) + '</div>';
    h += '<div class="crc-sub">All work averaged</div></div>';
    const isPar = Math.abs(d.catER - 1) < 0.15;
    h += '<div class="cf-rate-card specific"><div class="crc-label">' + esc(d.theirCompLabel) + ' \u2194 ' + esc(d.myCompLabel) + '</div>';
    h += '<div class="crc-val" style="color:' + (isPar ? 'var(--green)' : 'var(--accent)') + '">1 = ' + d.catER.toFixed(2) + '</div>';
    h += '<div class="crc-sub">Category-specific</div></div>';
    h += '</div>';

    if (Math.abs(d.catER - d.overallER) > 0.3) {
      h += '<div class="cf-rate-diverge">The category rate differs from the overall \u2014 this comparison has its own honest conversion.</div>';
    }

    // Provider category picker — what work of theirs to base the rate on
    if (d.theirCatList.length > 1) {
      const provDefLabel = d.cat && d.theirSnap.cats[d.cat] ? esc(d.cat) + ' (proposed)' : 'Overall density';
      h += '<div class="cf-recv-comp"><h4>Their work to compare</h4>';
      h += '<div class="rcd">Which of their work categories should set the rate?</div>';
      h += '<select onchange="App.setCfProvCat(this.value)">';
      h += '<option value=""' + (cfProvCat === '' ? ' selected' : '') + '>' + provDefLabel + ' \u2014 default</option>';
      d.theirCatList.forEach(function(k) {
        if (k === d.cat && d.theirSnap.cats[d.cat]) return;
        h += '<option value="' + esc(k) + '"' + (cfProvCat === k ? ' selected' : '') + '>' + esc(k) + ' (avg ' + d.theirSnap.cats[k].avg + ')</option>';
      });
      h += '</select></div>';
    }

    // Receiver category picker — what work of yours to compare against
    if (d.myCatList.length > 1) {
      const defLabel = d.mySnap.cats[d.cat] ? esc(d.cat) + ' (matching)' : 'Overall density';
      h += '<div class="cf-recv-comp"><h4>Your work to compare</h4>';
      h += '<div class="rcd">What does this cost in terms of your own work?</div>';
      h += '<select onchange="App.setCfRecvCat(this.value)">';
      h += '<option value=""' + (cfRecvCat === '' ? ' selected' : '') + '>' + defLabel + ' \u2014 default</option>';
      d.myCatList.forEach(function(k) {
        if (k === d.cat && d.mySnap.cats[d.cat]) return;
        h += '<option value="' + esc(k) + '"' + (cfRecvCat === k ? ' selected' : '') + '>' + esc(k) + ' (avg ' + d.mySnap.cats[k].avg + ')</option>';
      });
      h += '</select></div>';
    }

    // Their selected category context
    if (d.theirCatData) {
      h += '<div class="cf-ctx"><h4>Their ' + esc(d.theirCompCat) + ' history</h4>';
      h += '<div class="cf-ctx-row"><span class="cl">Acts</span><span class="cv">' + d.theirCatData.n + '</span></div>';
      h += '<div class="cf-ctx-row"><span class="cl">Average</span><span class="cv">' + d.theirCatData.avg + '</span></div>';
      if (d.theirStab) h += '<div class="cf-ctx-row"><span class="cl">Range</span><span class="cv">' + d.theirStab[0] + ' \u2014 ' + d.theirStab[1] + '</span></div>';
      h += '</div>';
    }

    // My comparison context
    if (d.myCompCat && d.mySnap.cats[d.myCompCat]) {
      const mc = d.mySnap.cats[d.myCompCat], ms = d.mySnap.stab[d.myCompCat];
      h += '<div class="cf-ctx"><h4>Your ' + esc(d.myCompCat) + ' history</h4>';
      h += '<div class="cf-ctx-row"><span class="cl">Acts</span><span class="cv">' + mc.n + '</span></div>';
      h += '<div class="cf-ctx-row"><span class="cl">Average</span><span class="cv">' + mc.avg + '</span></div>';
      if (ms) h += '<div class="cf-ctx-row"><span class="cl">Range</span><span class="cv">' + ms[0] + ' \u2014 ' + ms[1] + '</span></div>';
      h += '</div>';
    }

    h += '<button class="cf-advance" onclick="App.cfGoStep(1)">Got it \u2014 set the price \u2192</button>';
    h += '<button class="btn btn-secondary" onclick="App.cancelConfirm()" style="margin-top:8px;">Decline</button>';
    document.getElementById('cf-page-rate').innerHTML = h;
  }

  function renderCfPrice(d) {
    let h = '<div style="font-size:14px;color:var(--text);margin-bottom:14px;">What is this act of <strong>' + esc(d.cat || 'work') + '</strong> worth?</div>';

    // Slider — range 0 to 3x current value, editable number
    const def = cfAdjVal || cfOrigVal;
    const mx = Math.max(Math.round(def * 3), 100);

    h += '<div class="cf-slider">';
    h += '<div class="cs-label">Proposed value (their units)</div>';
    h += '<div style="display:flex;align-items:center;justify-content:center;gap:6px;">';
    h += '<div class="cs-val" id="cf-nv" onclick="App.cfEditValue()" style="cursor:pointer;">' + def + '</div>';
    h += '<button onclick="App.cfEditValue()" style="background:none;border:none;color:var(--accent);font-size:16px;cursor:pointer;padding:4px;" title="Edit value">&#9998;</button>';
    h += '</div>';
    h += '<input type="number" id="cf-nedit" style="display:none;width:140px;margin:4px auto 8px;text-align:center;padding:10px;font-size:24px;font-weight:300;background:var(--bg-input);border:2px solid var(--accent);border-radius:var(--radius-sm);color:var(--accent);font-family:var(--font);outline:none;" min="0" step="1" inputmode="numeric" onblur="App.cfCommitEdit()" onkeydown="if(event.key===\'Enter\')this.blur()">';
    h += '<div class="cs-sub" id="cf-nv-sub">converts to ' + Math.round(def * d.catER) + ' in your units</div>';
    h += '<input type="range" id="cf-nslider" min="0" max="' + mx + '" value="' + def + '" step="1" oninput="App.cfUpdSlider()">';
    h += '<div class="cf-slider-labels"><span>0</span><span>Proposed: ' + cfOrigVal + '</span><span>' + mx + '</span></div>';
    h += '</div>';

    if (cfAdjVal && cfAdjVal !== cfOrigVal) {
      h += '<div class="cf-revised">You\u2019ve adjusted from ' + cfOrigVal + ' to ' + cfAdjVal + ' \u2014 this will be sent as a revision.</div>';
    }

    // Side-by-side comps from stability data
    h += '<div class="cf-comps">';
    // Left — their acts in this category (from stability)
    h += '<div><div class="cf-comps-title" style="color:var(--accent);">Their ' + esc(d.theirCompLabel) + ' pricing</div>';
    if (d.theirStab) {
      h += '<div class="cf-comp-item"><span class="cd">Highest</span><span class="cv hi">' + d.theirStab[1] + '</span></div>';
      h += '<div class="cf-comp-item"><span class="cd">Average</span><span class="cv">' + d.theirStab[2] + '</span></div>';
      h += '<div class="cf-comp-item"><span class="cd">Lowest</span><span class="cv lo">' + d.theirStab[0] + '</span></div>';
      h += '<div class="cf-comp-item"><span class="cd">Variation</span><span class="cv">' + (d.theirStab[2] > 0 ? Math.round(d.theirStab[3]/d.theirStab[2]*100) : 0) + '%</span></div>';
    } else {
      h += '<div style="font-size: 13px;color:var(--text-faint);padding:4px 0;">No history</div>';
    }
    h += '</div>';
    // Right — my comparison category
    h += '<div><div class="cf-comps-title" style="color:var(--blue);">Your ' + esc(d.myCompLabel) + ' pricing</div>';
    if (d.myCompCat && d.mySnap.stab[d.myCompCat]) {
      const ms = d.mySnap.stab[d.myCompCat];
      h += '<div class="cf-comp-item"><span class="cd">Highest</span><span class="cv hi">' + ms[1] + '</span></div>';
      h += '<div class="cf-comp-item"><span class="cd">Average</span><span class="cv">' + ms[2] + '</span></div>';
      h += '<div class="cf-comp-item"><span class="cd">Lowest</span><span class="cv lo">' + ms[0] + '</span></div>';
      h += '<div class="cf-comp-item"><span class="cd">Variation</span><span class="cv">' + (ms[2] > 0 ? Math.round(ms[3]/ms[2]*100) : 0) + '%</span></div>';
    } else {
      h += '<div style="font-size: 13px;color:var(--text-faint);padding:4px 0;">No data</div>';
    }
    h += '</div></div>';

    h += '<button class="cf-advance" onclick="App.cfGoStep(2)" style="margin-top:14px;">See what gets recorded \u2192</button>';
    document.getElementById('cf-page-price').innerHTML = h;
  }

  function renderCfRecord(d) {
    const val = cfAdjVal || cfOrigVal;
    const fieldAdj = Math.round(val * d.catER);
    const mySurplus = HCP.walletBalance(state.chain) || 0;
    const afterBal = mySurplus - fieldAdj;

    let h = '<div style="font-size:14px;color:var(--text);margin-bottom:14px;">What does each thread record?</div>';

    if (cfAdjVal && cfAdjVal !== cfOrigVal) {
      h += '<div class="cf-revised">Revised from ' + cfOrigVal + ' to ' + cfAdjVal + ' \u2014 they\u2019ll confirm the new value.</div>';
    }

    // Record cards
    h += '<div class="cf-record-cards">';
    h += '<div class="cf-rec prov"><div class="cfr-label">Their thread</div><div class="cfr-val" style="color:var(--green);">' + val + '</div><div class="cfr-unit">provided</div></div>';
    h += '<div class="cf-rec arrow">\u21c4</div>';
    h += '<div class="cf-rec recv"><div class="cfr-label">Your thread</div><div class="cfr-val" style="color:var(--blue);">' + fieldAdj + '</div><div class="cfr-unit">received</div></div>';
    h += '</div>';

    // Cost
    h += '<div class="cf-cost"><h4>What this costs you</h4>';
    h += '<div class="cf-cost-row"><span class="cl">Field-adjusted cost</span><span class="cv">' + fieldAdj + ' units</span></div>';
    if (d.myCompCat && d.mySnap.cats[d.myCompCat]) {
      const eqActs = d.mySnap.cats[d.myCompCat].avg > 0 ? (fieldAdj / d.mySnap.cats[d.myCompCat].avg).toFixed(1) : '\u2014';
      h += '<div class="cf-cost-row"><span class="cl">Equivalent to</span><span class="cv">~' + eqActs + ' of your ' + esc(d.myCompCat) + '</span></div>';
    } else {
      const eqActs = d.myDensity > 0 ? (fieldAdj / d.myDensity).toFixed(1) : '\u2014';
      h += '<div class="cf-cost-row"><span class="cl">Equivalent avg acts</span><span class="cv">~' + eqActs + '</span></div>';
    }
    h += '<div class="cf-cost-row"><span class="cl">Your current surplus</span><span class="cv" style="color:' + (mySurplus >= 0 ? 'var(--green)' : 'var(--red)') + '">' + mySurplus + '</span></div>';
    h += '<div class="cf-cost-row"><span class="cl">After this exchange</span><span class="cv" style="color:' + (afterBal >= 0 ? 'var(--green)' : 'var(--red)') + '">' + afterBal + '</span></div>';
    if (afterBal < 0) {
      h += '<div class="cf-deficit">You\u2019d enter deficit. This is not blocked \u2014 deficit is an honest position. It records that you received something valuable.</div>';
    }
    h += '</div>';

    // Description + category summary (their description)
    if (d.parsed.exchange.description || d.parsed.exchange.category) {
      h += '<div class="cf-ctx">';
      if (d.parsed.exchange.description) h += '<div class="cf-ctx-row"><span class="cl">Their description</span><span class="cv">' + esc(d.parsed.exchange.description) + '</span></div>';
      if (d.parsed.exchange.category) h += '<div class="cf-ctx-row"><span class="cl">Category</span><span class="cv">' + esc(d.parsed.exchange.category) + '</span></div>';
      h += '</div>';
    }

    // Name field
    h += '<div class="field"><label>Their name (for your records)</label><input type="text" id="cf-name" placeholder="Optional display name"></div>';

    // View chain link
    h += '<div style="text-align:center;margin-bottom:12px;"><button style="font-size:13px;color:var(--accent);background:none;border:none;text-decoration:underline;cursor:pointer;" onclick="App.viewProposalChain()">View their full thread data \u203a</button></div>';

    h += '<button class="btn btn-primary" onclick="App.confirmAndSign()">Confirm & Sign</button>';
    h += '<button class="btn btn-secondary" onclick="App.cancelConfirm()">Decline</button>';

    h += '<div class="cf-note"><strong>What happens next:</strong> ' +
      (cfAdjVal && cfAdjVal !== cfOrigVal ?
        'Your revised value will be sent to them for confirmation. They\u2019ll see ' + cfAdjVal + ' instead of ' + cfOrigVal + '. If they confirm, the three-touch settlement proceeds normally.' :
        'Your confirmation is sent back. They complete the settlement. Both threads record the exchange in their own units.') +
      '</div>';

    document.getElementById('cf-page-record').innerHTML = h;
  }

  function viewProposalChain() {
    if (incomingSnap && incomingSnap.n) {
      showModal('chainview');
      incomingChainTab('texture');
    }
  }

  async function confirmAndSign() {
    if (!state.pendingProposal) return;
    const parsed = state.pendingProposal;

    // If value was adjusted, update the exchange before building record
    if (cfAdjVal && cfAdjVal !== cfOrigVal) {
      parsed.exchange.value = cfAdjVal;
      parsed.exchange._revised = true;
      parsed.exchange._originalValue = cfOrigVal;
    }

    // Capture confirmer's own description (dual descriptions)
    // Build the record but DO NOT write to chain yet -- provisional
    const nameEl = document.getElementById('cf-name');
    const record = HCP.recordFromHandshake(parsed, {
      counterpartyName: nameEl ? nameEl.value.trim() || undefined : undefined,
    });

    // Capture sensor data
    try {
      var snap = await captureSensor();
      if (snap.geo) record.geo = snap.geo;
      if (snap.device) record.device = snap.device;
      if (snap.sensorHash) record.sensorHash = snap.sensorHash;
      record.pohSnapshot = {
        signalHash: snap.signalHash,
        networkHash: snap.networkHash,
        webglHash: snap.webglHash,
        canvasHash: snap.canvasHash,
        batteryState: snap.batteryState,
        capabilityMask: snap.capabilityMask,
        capturedAt: snap.timestamp
      };
    } catch(sensorErr) {
      console.log('[sensor] Capture failed:', sensorErr.message);
    }

    // --- Integrity fields ---
    record.exchangePath = HCP.EXCHANGE_PATHS.QR;
    record.connectivityAvailable = navigator.onLine;
    try { var ep = await HCP.chainEntropyPrev(state.chain); if (ep) record.entropyPrev = ep; } catch(e) {}
    try { var mr = await HCP.chainMerkleRoot(state.chain); if (mr) record.chainMerkleRoot = mr; } catch(e) {}

    // Store provisional record — chain writes only on settlement
    const provisional = { record: record, initiatorFp: parsed.fp, initiatorPub: parsed.pub, proposalTs: parsed.ts, created: Date.now() };
    localStorage.setItem('hcp_provisional', JSON.stringify(provisional));

    // Generate return confirmation payload — include confirmer's description
    const returnPayload = await HCP.generateConfirmationPayload(state.publicKeyJwk, state.chain, parsed, state.privateKey, _cachedDeviceHash);
    const returnUrl = getAppBase() + '?cf=' + b64Encode(returnPayload);
    document.getElementById('return-payload').value = returnPayload;
    try { QR.generate(returnUrl, document.getElementById('return-qr'), 300); } catch(e) { console.error('QR gen failed', e); }

    const confirmedDesc = parsed.exchange.description;
    const confirmedVal = parsed.exchange.value;

    // Start relay polling immediately if server configured
    const initiatorPub = parsed.pub;
    const proposalTs = parsed.ts;

    state.pendingProposal = null;
    cfStep = 0; cfSeen = [false,false,false]; cfRecvCat = ''; cfProvCat = ''; cfAdjVal = 0;

    // Update pending item to show as confirmed-provisional
    const cpending = loadPending();
    const cmatch = cpending.findIndex(p => p.role === 'confirmer' && p.description === confirmedDesc && p.value === confirmedVal);
    if (cmatch >= 0) { cpending[cmatch].status = 'provisional'; savePending(cpending); }

    showCfStep('return');
    toast('Confirmed — show them your screen');

    // Begin relay polling in the background while B shows the return QR
    if (getWitnessUrl() && initiatorPub && proposalTs) {
      HCP.computeHandshakeId(initiatorPub, state.publicKeyJwk, proposalTs).then(hsId => {
        startRelayPoll(hsId);
      }).catch(e => console.log('[relay] Could not start polling:', e.message));
    }
  }

  function cancelConfirm() {
    state.pendingProposal = null;
    cfStep = 0; cfSeen = [false,false,false]; cfRecvCat = ''; cfProvCat = ''; cfAdjVal = 0;
    showCfStep('scan');
  }

  function copyReturn() {
    const p = document.getElementById('return-payload').value;
    navigator.clipboard.writeText(p).then(() => toast('Copied')).catch(() => toast('Could not copy'));
  }

  function shareReturn() {
    const p = document.getElementById('return-payload').value;
    if (navigator.share) navigator.share({ text: p }).catch(() => {});
    else copyReturn();
  }

  // --- Proposal Path ---
  function setProposalPath(path) {
    state.proposalPath = path;
    document.getElementById('path-inperson').classList.toggle('active', path === 'inperson');
    document.getElementById('path-message').classList.toggle('active', path === 'message');
    document.getElementById('pv-inperson').classList.toggle('active', path === 'inperson');
    document.getElementById('pv-message').classList.toggle('active', path === 'message');
  }

  function setCfReturnPath(path) {
    document.getElementById('cf-rv-inperson').style.display = path === 'inperson' ? 'block' : 'none';
    document.getElementById('cf-rv-message').style.display = path === 'message' ? 'block' : 'none';
  }

  function cfConfirmTheyScanned() {
    // Confirmer says the other person has received the confirmation
    // Move to waiting for settlement (three-scan) or auto-complete (two-scan relay)
    waitForSettlement();
  }

  // Scan confirmation — context-aware based on path (updated for v2.13.0)
  function scanConfirmation(path) {
    state.proposalPath = path || state.proposalPath || 'inperson';
    if (state.proposalPath === 'inperson') {
      initiatorConfirmScan();
    } else {
      initiatorConfirmSent();
    }
  }

  // Message path paste for confirmation
  function parseExConfirmationMsg() {
    const raw = document.getElementById('ex-paste-input-msg').value.trim();
    if (!raw) { toast('Paste a confirmation first'); return; }
    try {
      const parsed = HCP.parseConfirmationPayload(raw);
      completeInitiatorSide(parsed);
    } catch(e) { toast('Invalid confirmation'); }
  }

  // --- Settlement (B side) ---
  function waitForSettlement() {
    showCfStep('waiting');
    // Start relay polling if witness server configured
    if (getWitnessUrl()) {
      const provRaw = localStorage.getItem('hcp_provisional');
      if (provRaw) {
        try {
          const prov = JSON.parse(provRaw);
          if (prov.initiatorPub && prov.proposalTs) {
            HCP.computeHandshakeId(prov.initiatorPub, state.publicKeyJwk, prov.proposalTs).then(hsId => {
              startRelayPoll(hsId);
            });
          }
        } catch(e) { console.log('[relay] Could not start polling:', e.message); }
      }
    }
  }

  function parseSettlement() {
    const raw = document.getElementById('cf-settle-input').value.trim();
    if (!raw) { toast('Paste settlement first'); return; }
    processSettlement(raw);
  }

  async function processSettlement(payload) {
    try {
      const settlement = HCP.parseSettlementPayload(payload);

      // Load provisional record
      const provRaw = localStorage.getItem('hcp_provisional');
      if (!provRaw) { toast('No provisional record found'); return; }
      const prov = JSON.parse(provRaw);

      // Verify settlement matches — the initiator's fingerprint should match
      if (settlement.fp !== prov.initiatorFp) {
        toast('Settlement does not match your provisional record');
        return;
      }

      // NOW write to chain
      await appendRecord(prov.record);
      save();

      // Stop relay polling
      stopRelayPoll();

      // Witness attestation (non-blocking)
      if (prov.initiatorPub) {
        submitWitness(prov.record, prov.initiatorPub);
      }

      // Clear provisional
      localStorage.removeItem('hcp_provisional');

      // Clear matching pending item
      const cpending = loadPending();
      const cmatch = cpending.findIndex(p => p.role === 'confirmer' && p.status === 'provisional');
      if (cmatch >= 0) { cpending.splice(cmatch, 1); savePending(cpending); }

      // Show settled
      showModal('confirm');
      showCfStep('settled');
      refreshHome();
    } catch(e) {
      toast('Invalid settlement');
    }
  }

  // --- Settlement (A side) ---
  function finishExchange() {
    exRenderDoneCard();
    showExStep('done');
  }

  function exRenderDoneCard() {
    var card = document.getElementById('ex-done-card');
    if (!card) return;
    var d = state.doneDetails;
    if (!d) {
      card.innerHTML = '<div style="font-size:14px; color:var(--text-dim);">' + esc(state.doneSummary || 'Exchange recorded.') + '</div>';
      return;
    }
    var rows = [];
    if (d.partner) rows.push(['With', d.partner]);
    rows.push(['Direction', d.direction]);
    if (d.description) rows.push(['Description', d.description]);
    if (d.category) rows.push(['Category', d.category]);
    rows.push(['Value', Number(d.value).toLocaleString()]);
    rows.push(['Witnessed', d.witnessed ? 'Yes' : 'No']);
    var html = '';
    rows.forEach(function(r, i) {
      var valStyle = r[0] === 'Witnessed' && d.witnessed ? ' color:var(--green);' : '';
      html += '<div class="exf-done-row">';
      html += '<span class="exf-done-label">' + esc(r[0]) + '</span>';
      html += '<span class="exf-done-val" style="' + valStyle + '">' + esc(String(r[1])) + '</span>';
      html += '</div>';
    });
    card.innerHTML = html;
  }

  function settleViaMessage() {
    document.getElementById('settle-inperson').style.display = 'none';
    document.getElementById('settle-message').style.display = 'block';
  }

  function shareSettlement() {
    const p = state.settlementPayload;
    if (p && navigator.share) navigator.share({ text: p }).catch(() => {});
    else copySettlement();
  }

  function copySettlement() {
    const p = document.getElementById('settlement-payload').value;
    navigator.clipboard.writeText(p).then(() => toast('Copied')).catch(() => toast('Could not copy'));
  }

  // --- Scanner (shared, prefix-based) ---


  // --- Chain Viewer ---
  function openChainViewer() {
    showModal('chain');
    var filter = document.getElementById('chain-filter');
    if (filter) filter.style.display = '';
    var tabs = document.querySelector('#chain-overlay .tabs');
    if (tabs) tabs.style.display = '';
    chainTab('records');
  }

  function chainDirFilter(dir) {
    var filter = document.getElementById('chain-filter');
    filter.querySelectorAll('[data-dir]').forEach(b => b.classList.remove('active'));
    var btn = filter.querySelector('[data-dir="' + dir + '"]');
    if (btn) btn.classList.add('active');
    renderChainView('records');
  }

  function openMyTexture() {
    showModal('chain');
    // Hide filter bar and tabs
    var filter = document.getElementById('chain-filter');
    if (filter) filter.style.display = 'none';
    var tabs = document.querySelector('#chain-overlay .tabs');
    if (tabs) tabs.style.display = 'none';
    var body = document.getElementById('chain-body');

    if (!state.chain.length) {
      body.innerHTML = '<div style="font-size:13px; color:var(--text-dim); line-height:1.6; padding:16px 0;">You have no exchanges yet. Once you start cooperating, this view will show you how your chain looks to others \u2014 the same assessment they see when deciding whether to exchange with you.</div>';
      return;
    }

    // Build self-snapshot with device data
    var ts = HCP.chainSnapshot(state.chain);
    var pohCount = 0, hasGeo = 0, hasSensor = 0, pingCount = 0;
    state.chain.forEach(function(r) {
      if (r.pohSnapshot) pohCount++;
      if (r.geo) hasGeo++;
      if (r.sensorHash) hasSensor++;
      if (r.type === HCP.RECORD_TYPE_PING) pingCount++;
    });
    var exchangeCount = state.chain.filter(HCP.isAct).length;
    var webgl = getWebGLRenderer();
    ts._device = {
      platform: navigator.platform,
      screen: screen.width + 'x' + screen.height,
      touchPoints: navigator.maxTouchPoints,
      webgl: webgl || null,
      pohSnapshots: pohCount,
      pingRecords: pingCount,
      exchangeRecords: exchangeCount,
      recordsWithGeo: hasGeo,
      recordsWithSensor: hasSensor,
      totalRecords: state.chain.length,
      capabilityMask: (_sensor.accel ? 2 : 0) | (_sensor.gyro ? 4 : 0) | (_sensor.battery ? 8 : 0) | (_sensor.network ? 16 : 0)
    };
    ts._name = state.declarations.name || 'You';

    // Stash for detail views
    _textureTs = ts;
    // Self-chain analyses — only available for own texture, not counterparty
    _textureTs._deltas = analyzePingDeltas(state.chain);
    _textureTs._platforms = analyzeCounterpartyPlatforms(state.chain);

    // Classify and render — but override name for self-view context
    var cl = exClassifyChain(ts);
    var html = '<div style="font-size:12px; color:var(--text-faint); margin-bottom:12px;">This is how your chain looks to someone considering an exchange with you.</div>';

    // Override the name to frame as self-view
    var selfName = 'Your chain';

    if (cl.state === 'nonhuman') {
      html += exRenderNonhuman(ts, selfName, ts._device, cl);
    } else if (cl.state === 'young') {
      html += exRenderYoung(ts, selfName, ts._device, cl);
    } else if (cl.state === 'unusual') {
      html += exRenderUnusual(ts, selfName, ts._device, cl);
    } else {
      html += exRenderHealthy(ts, selfName, ts._device, cl);
    }

    body.innerHTML = html;
  }

  function exRenderHealthy(ts, name, dev, cl) {
    var months = '';
    if (ts.t0) {
      var m = Math.round((Date.now() - new Date(ts.t0).getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (m >= 1) months = ' over ' + m + ' month' + (m > 1 ? 's' : '');
    }
    var catCount = Object.keys(ts.cats || {}).length;
    var html = '<div style="padding:16px; background:rgba(43,140,62,0.04); border:1px solid rgba(43,140,62,0.12); border-radius:var(--radius); overflow:hidden;">';
    html += '<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">';
    html += '<span style="font-size:18px; color:var(--green);">&#10003;</span>';
    html += '<div style="font-size:15px; font-weight:600; color:var(--green);">Healthy chain</div>';
    html += '</div>';
    html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">';
    html += esc(name) + ' has ' + ts.n + ' exchanges' + months + ' across ' + catCount + ' categor' + (catCount === 1 ? 'y' : 'ies') + '. Consistent cooperation with diverse counterparties.';
    html += '</div>';
    html += exCoopBar(ts.g, ts.r);
    if (dev.touchPoints > 0 && !exIsEmulator(dev)) {
      html += '<div style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:12px; color:var(--text-faint);">';
      html += '<span style="color:var(--green);">&#10003;</span> Real phone';
      html += '</div>';
    }
    html += '</div>';
    html += '<div style="padding:0 4px;">';
    html += exDetailLink('&#9679;', 'What the chain shows', 'healthy-signals');
    html += exDetailLink('&#9679;', 'Activity breakdown', 'healthy-categories');
    if (dev.webgl || dev.platform) {
      html += exDetailLink('&#9679;', 'View device details', 'device-signals');
    }
    html += '</div>';
    return html;
  }

  function openMyPricing() {
    showModal('chain');
    var filter = document.getElementById('chain-filter');
    if (filter) filter.style.display = 'none';
    var tabs = document.querySelector('#chain-overlay .tabs');
    if (tabs) tabs.style.display = 'none';
    var body = document.getElementById('chain-body');

    if (!state.chain.length) {
      body.innerHTML = '<div style="font-size:13px; color:var(--text-dim); line-height:1.6; padding:16px 0;">You have no exchanges yet. Once you start cooperating, your services and pricing history will appear here.</div>';
      return;
    }

    // Build service catalog from own chain — provided services only
    var providedMap = {};
    state.chain.forEach(function(r) {
      if (r.energyState !== 'provided') return;
      var desc = (r.description || '').trim();
      if (!desc) return;
      var key = desc.toLowerCase();
      if (!providedMap[key]) {
        providedMap[key] = { desc: desc, cat: r.category || '', n: 0, counterparties: {}, prices: [] };
      }
      providedMap[key].n++;
      providedMap[key].prices.push({ v: r.value, w: r.timestamp });
      if (r.counterparty) providedMap[key].counterparties[r.counterparty] = 1;
    });

    var services = {};
    Object.keys(providedMap).forEach(function(key) {
      var s = providedMap[key];
      var vals = s.prices.map(function(p) { return p.v; });
      services[key] = {
        desc: s.desc, cat: s.cat, n: s.n,
        people: Object.keys(s.counterparties).length,
        low: Math.min.apply(null, vals),
        high: Math.max.apply(null, vals),
        avg: Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length),
        prices: s.prices.slice(-10)
      };
    });

    var svcKeys = Object.keys(services);
    if (!svcKeys.length) {
      body.innerHTML = '<div style="font-size:13px; color:var(--text-dim); line-height:1.6; padding:16px 0;">You have not provided any services yet. Once you provide something in an exchange, your pricing history will appear here.</div>';
      return;
    }

    // Group by category
    var byCat = {};
    var uncategorized = [];
    svcKeys.forEach(function(key) {
      var s = services[key];
      var cat = (s.cat || '').trim();
      if (!cat) uncategorized.push(s);
      else {
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(s);
      }
    });

    var html = '<div style="font-size:12px; color:var(--text-faint); margin-bottom:8px;">Your services and pricing as others see them during an exchange.</div>';
    html += '<div style="font-size:14px; font-weight:500; color:var(--text); margin-bottom:12px;">' + svcKeys.length + ' service' + (svcKeys.length > 1 ? 's' : '') + ' you provide</div>';

    Object.keys(byCat).sort().forEach(function(cat) {
      var items = byCat[cat];
      var total = items.reduce(function(sum, s) { return sum + s.n; }, 0);
      html += exRenderServiceCategory(cat, items, total);
    });
    if (uncategorized.length) {
      var total = uncategorized.reduce(function(sum, s) { return sum + s.n; }, 0);
      html += exRenderServiceCategory('Uncategorized', uncategorized, total);
    }

    // Contextual tip
    html += '<div style="margin-top:20px; padding:14px; background:var(--bg-raised); border-radius:var(--radius); border:1px solid var(--border); font-size:13px; color:var(--text-dim); line-height:1.6;">';
    if (uncategorized.length) {
      html += 'Some of your services have no category. Adding categories to your exchanges helps the person you are cooperating with understand what you offer at a glance. ';
    }
    html += 'You can update your skills and what you offer in your declarations. The clearer your profile, the easier it is for others to see what you do and decide to cooperate with you.';
    html += '<div style="margin-top:10px;"><button style="background:none; border:none; color:var(--accent); font-size:13px; font-weight:500; text-decoration:underline; cursor:pointer; padding:0;" onclick="App.closeModal(\'chain\'); App.openDeclarationsEdit();">Update your declarations</button></div>';
    html += '</div>';

    body.innerHTML = html;
  }

  function chainTab(tab) {
    var el = document.getElementById('ctab-records');
    if (el) el.classList.toggle('active', tab === 'records');
    renderChainView(tab);
  }

  function renderChainView(tab) {
    const body = document.getElementById('chain-body'), filter = document.getElementById('chain-filter');
    if (!state.chain.length) {
      let emptyHtml = '';
      if (state.declarations.rangeSimpleVal && state.declarations.rangeComplexVal) {
        const ratio = Math.round(state.declarations.rangeComplexVal / state.declarations.rangeSimpleVal);
        emptyHtml += '<div style="padding:14px 16px; background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:14px;">';
        emptyHtml += '<div style="font-size:13px; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Your Scale Exercise</div>';
        emptyHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
        emptyHtml += '<div><div style="font-size:14px; color:var(--text-dim);">A small favor</div><div style="font-size:20px; font-weight:500; color:var(--accent);">' + state.declarations.rangeSimpleVal + '</div></div>';
        emptyHtml += '<div style="font-size:14px; color:var(--text-faint);">1 : ' + ratio + '</div>';
        emptyHtml += '<div style="text-align:right;"><div style="font-size:14px; color:var(--text-dim);">Your best work</div><div style="font-size:20px; font-weight:500; color:var(--accent);">' + state.declarations.rangeComplexVal + '</div></div>';
        emptyHtml += '</div>';
        if (state.declarations.rangeDailyVal) {
          emptyHtml += '<div style="border-top:1px solid var(--border); padding-top:8px; margin-top:4px; font-size:14px; color:var(--text-dim);">A full day of work: <span style="color:var(--accent); font-weight:500;">' + state.declarations.rangeDailyVal + '</span></div>';
        }
        emptyHtml += '</div>';
        emptyHtml += '<div class="empty-state">Your scale is set. Your thread will grow from your first exchange.</div>';
      } else {
        emptyHtml = '<div class="empty-state">Your thread is empty. Your first exchange will appear here.</div>';
      }
      body.innerHTML = emptyHtml; filter.innerHTML = ''; return;
    }

    // Category filter chips and direction filter (for records tab)
    if (tab === 'records') {
      // Direction filter
      var dirFilter = '<div style="display:flex; gap:6px; margin-bottom:10px;">';
      dirFilter += '<button class="filter-chip active" data-dir="all" onclick="App.chainDirFilter(\'all\')">All</button>';
      dirFilter += '<button class="filter-chip" data-dir="provided" onclick="App.chainDirFilter(\'provided\')" style="border-color:rgba(43,140,62,0.3);">Provided</button>';
      dirFilter += '<button class="filter-chip" data-dir="received" onclick="App.chainDirFilter(\'received\')" style="border-color:rgba(42,90,143,0.3);">Received</button>';
      dirFilter += '</div>';

      // Category filter
      const cats = new Set(state.chain.filter(HCP.isAct).map(r => r.category || 'uncategorized'));
      var catFilter = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">';
      catFilter += '<button class="filter-chip active" data-cat="all">All categories</button>';
      cats.forEach(c => { catFilter += '<button class="filter-chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; });
      catFilter += '</div>';

      filter.innerHTML = dirFilter + catFilter;
      filter.querySelectorAll('[data-cat]').forEach(ch => ch.addEventListener('click', () => { filter.querySelectorAll('[data-cat]').forEach(c => c.classList.remove('active')); ch.classList.add('active'); renderChainView(tab); }));
      
      const activeDir = filter.querySelector('[data-dir].active')?.dataset.dir || 'all';
      const ac = filter.querySelector('[data-cat].active')?.dataset.cat || 'all';
      var filtered = state.chain.filter(HCP.isAct);
      if (activeDir !== 'all') filtered = filtered.filter(r => r.energyState === activeDir);
      if (ac !== 'all') filtered = filtered.filter(r => (r.category || 'uncategorized') === ac);

      // Summary
      var totalP = 0, totalR = 0, actsP = 0, actsR = 0;
      state.chain.filter(HCP.isAct).forEach(r => { if (r.energyState === 'provided') { totalP += r.value; actsP++; } else if (r.energyState === 'received') { totalR += r.value; actsR++; } });
      var summaryHtml = '<div style="padding:12px 14px; background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:14px;">';
      summaryHtml += '<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:4px;"><span style="color:var(--text-dim);">Provided</span><span style="color:var(--green); font-weight:500;">' + actsP + ' acts · +' + totalP + '</span></div>';
      summaryHtml += '<div style="display:flex; justify-content:space-between; font-size:14px;"><span style="color:var(--text-dim);">Received</span><span style="color:var(--blue); font-weight:500;">' + actsR + ' acts · \u2212' + totalR + '</span></div>';
      summaryHtml += '</div>';

      body.innerHTML = summaryHtml;
      if (!filtered.length) {
        body.innerHTML += '<div style="font-size:13px; color:var(--text-faint); text-align:center; padding:20px 0;">No records match this filter.</div>';
      } else {
        filtered.slice().reverse().forEach(r => body.appendChild(makeCard(r)));
      }
    } else {
      filter.innerHTML = '';
      // Generate snapshot from local chain for consistent rendering
      const s = HCP.chainSnapshot(state.chain);

      if (tab === 'texture') {
        let h = '<div class="review-panel">';
        h += '<div class="review-row"><span class="rlbl">Total Acts</span><span class="rval">' + s.n + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Density</span><span class="rval">' + s.d + ' u/act</span></div>';
        h += '<div class="review-row"><span class="rlbl">Give / Receive</span><span class="rval">' + s.g + ' / ' + s.r + '</span></div>';
        h += '<div class="review-row"><span class="rlbl">Thread Age</span><span class="rval">' + (s.t0 ? new Date(s.t0).toLocaleDateString() + ' \u2014 ' + new Date(s.t1).toLocaleDateString() : '\u2014') + '</span></div>';
        if (s.pings > 0) {
          h += '<div class="review-row"><span class="rlbl">Heartbeats</span><span class="rval">' + s.pings + '</span></div>';
        }
        h += '</div>';
        h += '<h3 style="margin:16px 0 8px;font-size:13px;color:var(--text-dim);">Categories</h3>';
        const cats = s.cats || {};
        if (Object.keys(cats).length) {
          h += '<div class="review-panel">';
          Object.entries(cats).sort(function(a,b){return b[1].n - a[1].n;}).forEach(function(e) {
            const k = e[0], v = e[1];
            const pct = Math.round(v.n / s.n * 100);
            h += '<div style="margin-bottom:12px;">';
            h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:14px;font-weight:500;">' + esc(k) + '</span><span style="font-size:13px;color:var(--text-dim);">' + v.n + ' acts \u00b7 ' + pct + '%</span></div>';
            h += '<div style="height:14px;background:var(--bg-input);border-radius:7px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:3px;"></div></div>';
            h += '<div style="font-size: 13px;color:var(--text-faint);margin-top:3px;">avg ' + v.avg + ' units \u00b7 provided ' + v.g + ' \u00b7 received ' + v.r + '</div>';
            h += '</div>';
          });
          h += '</div>';
        }
        body.innerHTML = h;
      }
      else if (tab === 'words') {
        const words = s.words || {};
        const entries = Object.entries(words).sort(function(a,b){return b[1]-a[1];});
        if (!entries.length) { body.innerHTML = '<div class="empty-state">No description data yet. Add descriptions to your exchanges.</div>'; return; }
        const maxCount = entries[0][1];
        let h = '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0;">';
        entries.forEach(function(e) {
          const word = e[0], count = e[1];
          const size = Math.max(13, Math.min(28, 13 + (count / maxCount) * 15));
          const opacity = 0.5 + (count / maxCount) * 0.5;
          h += '<span style="font-size:' + size + 'px;opacity:' + opacity + ';color:var(--accent);font-weight:500;padding:4px 8px;background:rgba(42,90,143,0.08);border-radius:6px;">' + esc(word) + '<sub style="font-size: 13px;color:var(--text-faint);margin-left:2px;">' + count + '</sub></span>';
        });
        h += '</div>';
        h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;">Words from your exchange descriptions. Larger words appear more often.</p>';
        body.innerHTML = h;
      }
      else if (tab === 'time') {
        const timeData = s.time || {};
        const months = Object.keys(timeData).sort();
        if (!months.length) { body.innerHTML = '<div class="empty-state">No time data yet.</div>'; return; }
        const maxActs = Math.max.apply(null, Object.values(timeData));
        let h = '<div style="padding:4px 0;">';
        months.forEach(function(m) {
          const count = timeData[m];
          const pct = Math.round(count / maxActs * 100);
          const isYear = m.length === 4;
          const label = isYear ? m : new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
          h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
          h += '<span style="font-size: 13px;color:var(--text-dim);min-width:70px;">' + label + '</span>';
          h += '<div style="flex:1;height:14px;background:var(--bg-input);border-radius:7px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:4px;"></div></div>';
          h += '<span style="font-size: 13px;font-weight:500;min-width:28px;text-align:right;">' + count + '</span>';
          h += '</div>';
        });
        h += '</div>';
        h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;">Your activity pattern over time.</p>';
        body.innerHTML = h;
      }
      else if (tab === 'stability') {
        const stab = s.stab || {};
        const stabCats = Object.keys(stab);
        if (!stabCats.length) { body.innerHTML = '<div class="empty-state">Not enough data for stability analysis.</div>'; return; }
        let h = '';
        stabCats.sort(function(a,b){return (s.cats[b]||{n:0}).n - (s.cats[a]||{n:0}).n;}).forEach(function(cat) {
          const d = stab[cat];
          const cv = d[2] > 0 ? (d[3] / d[2] * 100).toFixed(0) : 0;
          h += '<div class="review-panel" style="margin-bottom:10px;">';
          h += '<div style="font-size:14px;font-weight:500;margin-bottom:8px;">' + esc(cat) + '</div>';
          h += '<div class="review-row"><span class="rlbl">Average</span><span class="rval">' + d[2] + '</span></div>';
          h += '<div class="review-row"><span class="rlbl">Range</span><span class="rval">' + d[0] + ' \u2014 ' + d[1] + '</span></div>';
          h += '<div class="review-row"><span class="rlbl">Std Dev</span><span class="rval">' + d[3] + '</span></div>';
          h += '<div class="review-row"><span class="rlbl">Variation</span><span class="rval">' + cv + '%</span></div>';
          h += '<div style="margin-top:8px;position:relative;height:24px;background:var(--bg-input);border-radius:4px;">';
          const maxVal = d[1] * 1.2 || 100;
          const minPct = d[0] / maxVal * 100;
          const maxPct = d[1] / maxVal * 100;
          const avgPct = d[2] / maxVal * 100;
          h += '<div style="position:absolute;left:' + minPct + '%;width:' + (maxPct - minPct) + '%;top:4px;height:16px;background:rgba(42,90,143,0.2);border-radius:3px;"></div>';
          h += '<div style="position:absolute;left:' + avgPct + '%;top:2px;width:2px;height:20px;background:var(--accent);border-radius:1px;"></div>';
          h += '</div></div>';
        });
        h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:12px;line-height:1.5;">Low variation indicates consistent pricing. High variation may reflect different scopes of work within a category.</p>';
        body.innerHTML = h;
      }
    }
  }

  // --- Declarations Edit ---
  function openDeclarationsEdit() {
    closeModal('settings'); showModal('declarations');
    const p = document.getElementById('edit-photo-preview');
    if (state.declarations.photo) { p.innerHTML = '<img src="' + state.declarations.photo + '">'; p.classList.add('has-photo'); }
    else { p.innerHTML = '\u25ce'; p.classList.remove('has-photo'); }
    document.getElementById('edit-name').value = state.declarations.name || '';
    document.getElementById('edit-about').value = state.declarations.about || '';
    const de = document.getElementById('edit-photo-date');
    de.textContent = state.declarations.photoDate ? 'Photo: ' + new Date(state.declarations.photoDate).toLocaleDateString() : 'No photo yet';
    renderSkillsList('edit');
    // Show scale exercise values if set
    const rangeDisplay = document.getElementById('edit-range-display');
    if (state.declarations.rangeSimpleVal && state.declarations.rangeComplexVal) {
      const ratio = Math.round(state.declarations.rangeComplexVal / state.declarations.rangeSimpleVal);
      let h = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
      h += '<div><div style="font-size:13px; color:var(--text-faint);">A small favor</div><div style="font-size:18px; font-weight:500; color:var(--accent);">' + state.declarations.rangeSimpleVal + '</div></div>';
      h += '<div style="font-size:14px; color:var(--text-faint);">1 : ' + ratio + '</div>';
      h += '<div style="text-align:right;"><div style="font-size:13px; color:var(--text-faint);">Your best work</div><div style="font-size:18px; font-weight:500; color:var(--accent);">' + state.declarations.rangeComplexVal + '</div></div>';
      h += '</div>';
      if (state.declarations.rangeDailyVal) {
        h += '<div style="border-top:1px solid var(--border); padding-top:8px; margin-top:4px; font-size:14px; color:var(--text-dim);">A full day of work: <span style="color:var(--accent); font-weight:500;">' + state.declarations.rangeDailyVal + '</span></div>';
      }
      document.getElementById('edit-range-summary').innerHTML = h;
      rangeDisplay.style.display = 'block';
    } else {
      rangeDisplay.style.display = 'none';
    }
  }
  function editCapturePhoto() { document.getElementById('edit-photo-capture').click(); }
  function editUploadPhoto() { document.getElementById('edit-photo-file').click(); }
  function handleEditPhotoFile(event) {
    const file = event.target.files[0]; if (!file) return;
    const isCamera = event.target.hasAttribute('capture');
    const reader = new FileReader();
    reader.onload = e => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const max = 400; let w = img.width, h = img.height; if (w > h) { if (w > max) { h = h * max / w; w = max; } } else { if (h > max) { w = w * max / h; h = max; } } c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); const du = c.toDataURL('image/jpeg', 0.8); state.declarations.photo = du; state.declarations.photoDate = new Date().toISOString(); state.declarations.photoSource = isCamera ? 'camera' : 'file'; const p = document.getElementById('edit-photo-preview'); p.innerHTML = '<img src="' + du + '">'; p.classList.add('has-photo'); document.getElementById('edit-photo-date').textContent = 'Photo: ' + new Date().toLocaleDateString(); }; img.src = e.target.result; };
    reader.readAsDataURL(file); event.target.value = '';
  }
  function saveDeclarationsEdit() {
    state.declarations.name = document.getElementById('edit-name').value.trim();
    state.declarations.about = document.getElementById('edit-about').value.trim();
    save(); closeModal('declarations'); refreshHome(); toast('Declarations updated');
  }

  // --- Scale Exercise (standalone modal) ---
  function openDeclareRange() {
    document.getElementById('dr-simple-val').value = '';
    document.getElementById('dr-complex-val').value = '';
    document.getElementById('dr-daily-val').value = '';
    document.getElementById('dr-result').style.display = 'none';
    // Clear all val tags
    ['dr-vt-simple','dr-vt-complex','dr-vt-daily'].forEach(id => {
      document.querySelectorAll('#' + id + ' .val-tag').forEach(t => t.classList.remove('selected'));
    });
    showModal('range');
  }

  function declareRangeUpdate() {
    const sv = parseFloat(document.getElementById('dr-simple-val').value);
    const cv = parseFloat(document.getElementById('dr-complex-val').value);
    const dv = parseFloat(document.getElementById('dr-daily-val').value);
    const result = document.getElementById('dr-result');
    if (sv > 0 && cv > 0 && sv < cv) {
      const ratio = Math.round(cv / sv);
      let summary = 'A small favor at ' + sv;
      if (dv > 0) summary += ', a full day at ' + dv;
      summary += ', your best work at ' + cv;
      document.getElementById('dr-ratio').textContent = '1 : ' + ratio;
      document.getElementById('dr-summary').textContent = summary;
      result.style.display = 'block';
    } else { result.style.display = 'none'; }
  }

  function submitDeclareRange() {
    const sv = parseFloat(document.getElementById('dr-simple-val').value);
    const cv = parseFloat(document.getElementById('dr-complex-val').value);
    if (!sv || !cv || sv >= cv) { toast('Enter a small favor value and a larger best work value'); return; }
    state.declarations.rangeSimpleVal = sv;
    state.declarations.rangeComplexVal = cv;
    state.declarations.rangeDailyVal = parseFloat(document.getElementById('dr-daily-val').value) || 0;
    state.declarations.rangeDeclaredAt = new Date().toISOString();
    // Save valuation method tags
    state.declarations.valTagsSimple = getValTags('dr-vt-simple');
    state.declarations.valTagsComplex = getValTags('dr-vt-complex');
    state.declarations.valTagsDaily = getValTags('dr-vt-daily');
    save(); closeModal('range'); toast('Scale exercise saved'); refreshHome();
  }

  function dismissRangePrompt() {
    const body = document.getElementById('cooperate-body');
    const prompt = body.querySelector('[style*="rgba(42,90,143"]');
    if (prompt) prompt.style.display = 'none';
  }

  // --- Witness Client ---
  let relayPollTimer = null;

  function getWitnessUrl() {
    const raw = (state.settings.witnessUrl || '').trim().replace(/\/+$/, '');
    if (!raw) return DEFAULT_WITNESS_URL;
    // Local network addresses are never valid witness servers in production
    if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.|localhost)/i.test(raw)) {
      return DEFAULT_WITNESS_URL;
    }
    return raw;
  }

  // Wrapper for all server fetch calls - adds headers needed for tunneling services
  function serverFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'ngrok-skip-browser-warning': '1' }, opts.headers || {});
    return fetch(url, opts);
  }

  // === LAYER 4: Server Reputation Tracking ===
  // Per-server trust scores stored locally. Integrity failures reduce trust.
  // When multiple servers available, deprioritized servers are skipped.
  const SERVER_REPUTATION_KEY = 'hep_server_reputation';
  const SERVER_TRUST_INITIAL = 100;
  const SERVER_TRUST_PENALTY = 25;
  const SERVER_TRUST_THRESHOLD = 25;

  function getServerReputation() {
    try {
      var raw = localStorage.getItem(SERVER_REPUTATION_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function saveServerReputation(rep) {
    try { localStorage.setItem(SERVER_REPUTATION_KEY, JSON.stringify(rep)); } catch(e) {}
  }

  function recordServerFailure(url, reason) {
    var rep = getServerReputation();
    if (!rep[url]) rep[url] = { trust: SERVER_TRUST_INITIAL, failures: 0, successes: 0, lastFailure: null };
    rep[url].failures++;
    rep[url].trust = Math.max(0, rep[url].trust - SERVER_TRUST_PENALTY);
    rep[url].lastFailure = new Date().toISOString();
    rep[url].lastReason = reason;
    console.log('[reputation] Server', url, 'trust now:', rep[url].trust, 'reason:', reason);
    saveServerReputation(rep);
  }

  function recordServerSuccess(url) {
    var rep = getServerReputation();
    if (!rep[url]) rep[url] = { trust: SERVER_TRUST_INITIAL, failures: 0, successes: 0, lastFailure: null };
    rep[url].successes++;
    // Slowly recover trust on success (max initial)
    rep[url].trust = Math.min(SERVER_TRUST_INITIAL, rep[url].trust + 5);
    saveServerReputation(rep);
  }

  function getServerTrust(url) {
    var rep = getServerReputation();
    if (!rep[url]) return SERVER_TRUST_INITIAL;
    return rep[url].trust;
  }

  async function witnessPost(mintHash, pubkeyA, pubkeyB, deviceTs, chainSig) {
    const url = getWitnessUrl();
    if (!url) return null;
    try {
      const resp = await serverFetch(url + '/witness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint_hash: mintHash, pubkey_a: pubkeyA, pubkey_b: pubkeyB, device_timestamp: deviceTs, chain_sig: chainSig }),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch(e) { console.log('[witness] POST failed:', e.message); return null; }
  }

  async function relayPut(handshakeId, encryptedPayload) {
    const url = getWitnessUrl();
    if (!url) return false;
    try {
      const resp = await serverFetch(url + '/relay/' + handshakeId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_payload: encryptedPayload }),
      });
      return resp.ok;
    } catch(e) { console.log('[relay] PUT failed:', e.message); return false; }
  }

  async function relayGet(handshakeId) {
    const url = getWitnessUrl();
    if (!url) return null;
    try {
      const resp = await serverFetch(url + '/relay/' + handshakeId);
      if (resp.status === 404) return null;
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.found ? data.encrypted_payload : null;
    } catch(e) { console.log('[relay] GET failed:', e.message); return null; }
  }

  async function witnessStatus() {
    const url = getWitnessUrl();
    if (!url) return null;
    try {
      const resp = await serverFetch(url + '/status', { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch(e) { return null; }
  }

  async function submitWitness(record, counterpartyPub) {
    try {
      const mintHash = await HCP.computeMintHash(state.publicKeyJwk, counterpartyPub, record.timestamp);
      const pubA = HCP.bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(state.publicKeyJwk)))));
      const pubB = HCP.bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(counterpartyPub)))));
      const rttStart = Date.now();
      const attestation = await witnessPost(mintHash, pubA, pubB, Math.floor(Date.now() / 1000), record.signature || 'none');
      const rttMs = Date.now() - rttStart;
      if (attestation && attestation.witnessed) {
        record.witnessAttestation = {
          server_pubkey: attestation.server_pubkey,
          server_timestamp: attestation.server_timestamp,
          server_signature: attestation.server_signature,
          rtt_ms: rttMs,
        };
        save();
        console.log('[witness] Attestation received:', mintHash.substring(0, 16) + '...');
        return true;
      }
    } catch(e) { console.log('[witness] Submit failed:', e.message); }
    return false;
  }

  // ==========================================================
  // GENESIS PING — Proof-of-Human Heartbeat
  // ==========================================================
  // Randomized sensor snapshots embedded into the chain between
  // exchanges. Makes retroactive chain fabrication geometrically
  // harder over time. Absence of pings is itself a signal.

  const PING_MIN_SPACING_MS = 24 * 60 * 60 * 1000; // 1 day minimum between pings
  const PING_LAST_KEY = 'hcp_last_ping';
  var _cachedDeviceHash = ''; // Pre-computed on login for cross-device exchange
  var _cachedGeo = null; // Continuously updated from GPS watch
  var _geoWatchId = null;

  function lastPingTimestamp() {
    // Check localStorage first (fast), fall back to chain scan
    var stored = localStorage.getItem(PING_LAST_KEY);
    if (stored) return parseInt(stored, 10);
    // Scan chain for most recent ping
    for (var i = state.chain.length - 1; i >= 0; i--) {
      if (state.chain[i].type === HCP.RECORD_TYPE_PING) {
        var ts = new Date(state.chain[i].timestamp).getTime();
        localStorage.setItem(PING_LAST_KEY, String(ts));
        return ts;
      }
    }
    return 0; // No pings ever
  }

  async function computePingSeed() {
    // Deterministic seed from chain state + current date
    // Verifiable after the fact: given chain state and date, anyone can recompute
    var lastHash = '';
    if (state.chain.length > 0) {
      try { lastHash = await HCP.hashRecord(state.chain[state.chain.length - 1]); } catch(e) {}
    }
    var dateStr = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
    var seedInput = lastHash + ':' + dateStr + ':' + state.fingerprint;
    var hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seedInput));
    return new Uint8Array(hashBuf);
  }

  var PHOTO_NUDGE_DAYS = 180;
  function checkPhotoNudge() {
    if (!state.initialized || !state.declarations) return;
    var photoDate = state.declarations.photoDate;
    if (!photoDate) return;
    var daysSince = Math.floor((Date.now() - new Date(photoDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < PHOTO_NUDGE_DAYS) return;
    var dismissed = sessionStorage.getItem('hep_photo_nudge_dismissed');
    if (dismissed) return;
    var months = Math.floor(daysSince / 30);
    var bar = document.createElement('div');
    bar.id = 'photo-nudge-bar';
    bar.style.cssText = 'position:fixed; bottom:0; left:0; right:0; background:var(--bg-raised); border-top:1px solid var(--border); padding:14px 20px; padding-bottom:calc(14px + var(--safe-bottom)); z-index:900; display:flex; align-items:center; gap:12px;';
    bar.innerHTML = '<div style="flex:1; font-size:13px; color:var(--text-dim); line-height:1.4;">'
      + 'Your photo is ' + months + ' months old. Updating it strengthens your chain\'s integrity.'
      + '</div>'
      + '<button onclick="sessionStorage.setItem(\'hep_photo_nudge_dismissed\',\'1\'); document.getElementById(\'photo-nudge-bar\').remove();" style="background:none; border:none; color:var(--text-faint); font-size:18px; cursor:pointer; padding:4px;">&#10005;</button>';
    document.body.appendChild(bar);
  }

  async function checkPingOnOpen() {
    if (!state.initialized || !state.privateKey) return;

    // Pre-compute device hash for cross-device comparison during exchanges
    try { _cachedDeviceHash = await quickDeviceHash(); } catch(e) {}
    // Start watching geo for cross-device location sharing — updates continuously
    try {
      if ('geolocation' in navigator) {
        if (_geoWatchId) navigator.geolocation.clearWatch(_geoWatchId);
        // Immediate grab — accepts any OS-cached position from last 2 minutes
        navigator.geolocation.getCurrentPosition(
          function(pos) { if (!_cachedGeo) _cachedGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }; },
          function() {},
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 120000 }
        );
        // Continuous watch for higher accuracy updates
        _geoWatchId = navigator.geolocation.watchPosition(
          function(pos) { _cachedGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }; },
          function() {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }
    } catch(e) {}

    if (!state.chain.length) return; // No chain yet — wait for first exchange

    var now = Date.now();
    var lastPing = lastPingTimestamp();
    var elapsed = now - lastPing;

    // Minimum spacing: never more than one ping per day
    if (lastPing > 0 && elapsed < PING_MIN_SPACING_MS) {
      return;
    }

    // Days since last ping (0 if never pinged)
    var days = lastPing > 0 ? elapsed / (24 * 60 * 60 * 1000) : 14;

    // Probability ramp: increases with days elapsed
    // 1 day: ~10%, 3 days: ~29%, 5 days: ~49%, 7 days: ~69%, 10 days: ~98%, 11+: guaranteed
    var threshold = Math.min(255, Math.floor(days * 25));

    // Deterministic seed from chain state — verifiable after the fact
    var seedBytes = await computePingSeed();
    var roll = seedBytes[0]; // 0-255

    if (roll < threshold) {
      console.log('[ping] Gate passed: roll=' + roll + ' threshold=' + threshold + ' days=' + days.toFixed(1));
      setTimeout(function() { captureAndWritePing(seedBytes); }, 1500);
    } else {
      console.log('[ping] Gate held: roll=' + roll + ' threshold=' + threshold + ' days=' + days.toFixed(1));
    }
  }

  function pingStats(chain) {
    // Count exchanges and distinct counterparties since the last ping
    let exchanges = 0;
    const counterparties = new Set();
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i].type === HCP.RECORD_TYPE_PING) break;
      if (HCP.isAct(chain[i])) {
        exchanges++;
        if (chain[i].counterparty) counterparties.add(chain[i].counterparty);
      }
    }
    return { exchanges: exchanges, counterparties: counterparties.size };
  }

  async function counterpartySetHash(chain) {
    // SHA-256 of sorted counterparty keys since last ping
    const keys = [];
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i].type === HCP.RECORD_TYPE_PING) break;
      if (HCP.isAct(chain[i]) && chain[i].counterparty) keys.push(chain[i].counterparty);
    }
    keys.sort();
    return await sensorSha256(keys.join(':'));
  }

  async function captureAndWritePing(seedBytes) {
    if (!state.initialized || !state.privateKey) {
      console.log('[ping] Not initialized, skipping');
      return;
    }
    console.log('[ping] Capturing heartbeat...');

    try {
      // Capture sensor data (same as exchange records — fresh snapshot right now)
      var snap = await captureSensor();
      // Refresh cache for cross-device exchange
      if (snap.geo) _cachedGeo = snap.geo;
      try { _cachedDeviceHash = await quickDeviceHash(); } catch(e) {}

      // Compute integrity fields
      var entropyPrev = null;
      try { entropyPrev = await HCP.chainEntropyPrev(state.chain); } catch(e) {}

      var merkleRoot = null;
      try { merkleRoot = await HCP.chainMerkleRoot(state.chain); } catch(e) {}

      // Compute ping-specific network participation fields
      var ps = pingStats(state.chain);
      var cpSetHash = null;
      try { cpSetHash = await counterpartySetHash(state.chain); } catch(e) {}

      // Record the seed for verification (first 8 bytes as hex)
      var seedHex = seedBytes ? HCP.bufToHex(seedBytes.slice(0, 8)) : '';

      // Compute photo hash for continuity (hash of current stored photo)
      var pingPhotoHash = null;
      try {
        if (state.declarations.photo) {
          pingPhotoHash = await sensorSha256(state.declarations.photo);
        }
      } catch(pe) {}

      // Create the ping record
      var record = HCP.createPingRecord({
        geo: snap.geo,
        device: snap.device,
        sensorHash: snap.sensorHash,
        entropyPrev: entropyPrev,
        exchangePath: 'ping',
        chainMerkleRoot: merkleRoot,
        photoHash: pingPhotoHash,
        pohSnapshot: {
          signalHash: snap.signalHash,
          networkHash: snap.networkHash,
          webglHash: snap.webglHash,
          canvasHash: snap.canvasHash,
          batteryState: snap.batteryState,
          capabilityMask: snap.capabilityMask,
          capturedAt: snap.timestamp,
          exchangesSinceLastPing: ps.exchanges,
          distinctCounterpartiesSinceLastPing: ps.counterparties,
          counterpartySetHash: cpSetHash,
          gateSeed: seedHex,
          photoSource: state.declarations.photoSource || 'unknown',
        }
      });

      // Append to chain (hash-linked, signed)
      await appendRecord(record);
      console.log('[ping] Record appended at seq ' + (state.chain.length - 1));

      // Update last ping timestamp
      localStorage.setItem(PING_LAST_KEY, String(Date.now()));

      // Submit ping attestation to witness server
      try {
        await submitPing(record);
      } catch(e) {
        console.log('[ping] Server attestation failed (record still in chain):', e.message);
      }

      save();
      console.log('[ping] Heartbeat complete');

    } catch(err) {
      console.log('[ping] Capture failed:', err.message);
    }
  }

  async function submitPing(record) {
    var url = getWitnessUrl();
    if (!url) return;
    try {
      var chainFp = state.fingerprint;

      // Request challenge nonce first
      var challengeNonce = null;
      try {
        var challengeResp = await serverFetch(url + '/ping/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain_fingerprint: chainFp }),
        });
        if (challengeResp.ok) {
          var challengeData = await challengeResp.json();
          challengeNonce = challengeData.nonce;
        }
      } catch(ce) {
        console.log('[ping] Challenge request failed, submitting without:', ce.message);
      }

      var rttStart = Date.now();
      var resp = await serverFetch(url + '/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain_fingerprint: chainFp,
          sensor_hash: record.sensorHash || '',
          device_ts: Math.floor(Date.now() / 1000),
          seq: record.seq,
          challenge_nonce: challengeNonce,
        }),
      });
      var rttMs = Date.now() - rttStart;
      if (resp.ok) {
        var data = await resp.json();
        if (data && data.attested) {
          record.witnessAttestation = {
            server_pubkey: data.server_pubkey,
            server_timestamp: data.server_timestamp,
            server_signature: data.server_signature,
            rtt_ms: rttMs,
            challenged: data.challenged || false,
          };
          save();
          console.log('[ping] Server attestation received, RTT ' + rttMs + 'ms, challenged=' + (data.challenged || false));
        }
      }
    } catch(e) {
      console.log('[ping] Server submit failed:', e.message);
    }
  }

  function startRelayPoll(handshakeId) {
    stopRelayPoll();
    if (!getWitnessUrl()) return;
    console.log('[relay] Polling for settlement:', handshakeId.substring(0, 16) + '...');
    const pollEl = document.getElementById('cf-relay-status');
    const returnPollEl = document.getElementById('cf-return-relay-status');
    if (pollEl) pollEl.style.display = 'block';
    if (returnPollEl) returnPollEl.style.display = 'block';

    let attempts = 0;
    relayPollTimer = setInterval(async () => {
      attempts++;
      const payload = await relayGet(handshakeId);
      if (payload) {
        stopRelayPoll();
        console.log('[relay] Settlement received via relay');
        toast('Settlement received');
        processSettlement(payload);
      } else if (attempts > 120) {
        // Stop after ~60 minutes (30s intervals)
        stopRelayPoll();
        if (pollEl) pollEl.textContent = 'Auto-settle timed out. Use manual method.';
      }
    }, 30000); // Every 30 seconds
    // Also do one immediate check
    setTimeout(async () => {
      const payload = await relayGet(handshakeId);
      if (payload) {
        stopRelayPoll();
        toast('Settlement received');
        processSettlement(payload);
      }
    }, 2000);
  }

  function stopRelayPoll() {
    if (relayPollTimer) { clearInterval(relayPollTimer); relayPollTimer = null; }
    const pollEl = document.getElementById('cf-relay-status');
    const returnPollEl = document.getElementById('cf-return-relay-status');
    if (pollEl) pollEl.style.display = 'none';
    if (returnPollEl) returnPollEl.style.display = 'none';
  }

  async function testWitnessConnection() {
    const statusEl = document.getElementById('witness-status');
    const urlEl = document.getElementById('witness-url-display');
    if (!statusEl) return;
    const url = getWitnessUrl();
    if (urlEl) urlEl.textContent = url || '';
    if (!url) { statusEl.textContent = 'No server configured'; statusEl.style.color = 'var(--text-dim)'; return; }
    statusEl.textContent = 'Connecting...';
    statusEl.style.color = 'var(--text-dim)';
    try {
      const resp = await serverFetch(url + '/status', { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) throw new Error('Status ' + resp.status);
      const data = await resp.json();
      statusEl.innerHTML = '<span style="color:var(--green)">Connected</span> &middot; v' + data.version + ' &middot; ' + data.witnessed_total + ' witnesses';
    } catch(e) {
      statusEl.innerHTML = '<span style="color:var(--red)">Failed</span> &middot; ' + (e.message || 'Could not reach server');
    }
  }

  async function checkForUpdates() {
    try {
      const resp = await fetch(VERSION_CHECK_URL, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.version && data.version !== APP_VERSION) {
        showUpdateBanner('Version ' + data.version + ' is available.');
        // Trigger SW update check so new files are cached
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then(function(reg) {
            if (reg) reg.update();
          });
        }
      } else {
        // Versions match -- dismiss any stale banner
        var banner = document.getElementById('update-banner');
        if (banner) banner.classList.remove('show');
        _pendingUpdateMsg = null;
      }
    } catch(e) { /* silent -- version check is optional */ }
  }

  var _pendingUpdateMsg = null;

  function showUpdateBanner(msg) {
    // Only show after PIN unlock (home screen visible)
    var homeEl = document.getElementById('home');
    if (!homeEl || homeEl.style.display === 'none') {
      _pendingUpdateMsg = msg;
      return;
    }
    var banner = document.getElementById('update-banner');
    var bannerText = document.getElementById('update-banner-text');
    if (banner && bannerText) {
      bannerText.textContent = msg || 'A new version is available.';
      banner.classList.add('show');
    }
  }

  function showPendingUpdateBanner() {
    if (_pendingUpdateMsg) {
      showUpdateBanner(_pendingUpdateMsg);
      _pendingUpdateMsg = null;
    }
  }

  // --- Settings ---
  function openSettings() {
    showModal('settings');
    document.getElementById('settings-fp').textContent = state.fingerprint;
    var sv = document.getElementById('settings-version');
    if (sv) sv.textContent = 'v' + APP_VERSION + ' \u00b7 The value trust creates';
    document.getElementById('switch-location').classList.toggle('on', state.settings.locationAuto);
    document.getElementById('switch-hide-names').classList.toggle('on', state.settings.hideNames);
    document.getElementById('switch-hide-location').classList.toggle('on', state.settings.hideLocations);
    var motionSwitch = document.getElementById('switch-motion');
    if (motionSwitch) motionSwitch.classList.toggle('on', state.settings.sensorMotion);
    updateSensorStatus();
    testWitnessConnection();
  }

  function togglePrivacy(key) {
    if (!key) key = 'hideNames'; // default for tab toggle
    state.settings[key] = !state.settings[key];
    // Update both old modal and new tab switches if they exist
    var el1 = document.getElementById('switch-hide-names');
    if (el1) el1.classList.toggle('on', state.settings.hideNames);
    var el2 = document.getElementById('switch-hide-names-tab');
    if (el2) el2.classList.toggle('on', state.settings.hideNames);
    var el3 = document.getElementById('switch-hide-location');
    if (el3) el3.classList.toggle('on', state.settings.hideLocations);
    save();
  }

  function toggleLocation() {
    state.settings.locationAuto = !state.settings.locationAuto;
    document.getElementById('switch-location').classList.toggle('on', state.settings.locationAuto);
    save();
    if (state.settings.locationAuto) navigator.geolocation?.getCurrentPosition(function() { toast('Location enabled'); updateSensorStatus(); }, function() { state.settings.locationAuto = false; document.getElementById('switch-location').classList.remove('on'); save(); toast('Location denied'); });
    else updateSensorStatus();
  }

  async function toggleMotion() {
    if (state.settings.sensorMotion) {
      state.settings.sensorMotion = false;
      document.getElementById('switch-motion').classList.remove('on');
      save();
      updateSensorStatus();
      return;
    }
    var granted = await requestMotionPermission();
    if (granted) {
      document.getElementById('switch-motion').classList.add('on');
      toast('Motion sensors enabled');
    } else {
      toast('Motion permission denied by browser');
    }
    updateSensorStatus();
  }

  async function toggleMotionTab() {
    if (state.settings.sensorMotion) {
      state.settings.sensorMotion = false;
      save();
      renderSettingsTab();
      refreshHome();
      return;
    }
    var granted = await requestMotionPermission();
    if (granted) {
      toast('Motion sensors enabled');
    } else {
      toast('Motion permission denied by browser');
    }
    renderSettingsTab();
    refreshHome();
  }

  // Turn location ON or OFF from the Settings tab / Standing tile.
  //
  // Previously this flipped the toggle visible-state, fired getCurrentPosition,
  // then flipped back on denial. On a PC where the browser has location
  // pre-blocked, the flip + revert was near-instant and invisible, making
  // the toggle appear broken. Michael reported: "it kind of toggles off
  // rapidly, it's hard to see if it works, but when I go back it's usually
  // off."
  //
  // New behavior:
  //  1. If Permissions API is available and state is 'denied', DON'T flip
  //     the toggle at all. Show a persistent-style error message with
  //     instructions specific to the browser. Toggle state stays OFF,
  //     visibly consistent with reality.
  //  2. If state is 'prompt' or unknown, flip the toggle optimistically
  //     and request the position. On denial, flip back with clear error.
  //  3. If state is 'granted', flip on without the permission roundtrip.
  //  4. Turning OFF is immediate, no permission check needed.
  async function toggleLocationTab() {
    // Turning OFF is always immediate
    if (state.settings.locationAuto) {
      state.settings.locationAuto = false;
      save();
      renderSettingsTab();
      refreshHome();
      return;
    }

    // Turning ON: check permission state first
    if (!navigator.geolocation) {
      toast('Location not available on this device');
      return;
    }

    // Query Permissions API when available — avoids visible toggle flicker
    // when permission is pre-denied
    try {
      if (navigator.permissions && navigator.permissions.query) {
        var perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          toast('Browser blocked location \u2014 enable it in the browser\'s site permissions');
          return;
        }
      }
    } catch(e) {
      // Permissions API unavailable or errored — fall through to request
    }

    // Optimistic flip, then request position
    state.settings.locationAuto = true;
    save();
    renderSettingsTab();
    refreshHome();

    navigator.geolocation.getCurrentPosition(
      function() {
        toast('Location enabled');
      },
      function(err) {
        // Revert and explain
        state.settings.locationAuto = false;
        save();
        renderSettingsTab();
        refreshHome();
        var msg;
        if (err && err.code === 1) msg = 'Browser blocked location \u2014 enable it in the browser\'s site permissions';
        else if (err && err.code === 2) msg = 'Location unavailable on this device right now';
        else if (err && err.code === 3) msg = 'Location request timed out \u2014 try again';
        else msg = 'Location could not be enabled';
        toast(msg);
      },
      { timeout: 10000 }
    );
  }

  function updateSensorStatus() {
    var el = document.getElementById('sensor-status');
    if (!el) return;
    var parts = [];
    // Passive sensors that are always on
    if (_sensor.battery) parts.push('Battery: active');
    if (_sensor.network) parts.push('Network: active');
    if (_sensor.light !== null) parts.push('Light sensor: active');
    if (_sensor.pressure !== null) parts.push('Pressure sensor: active');
    // Active sensors
    if (state.settings.sensorMotion && (_sensor.accel || state.settings.sensorMotionGranted)) {
      parts.push('Motion: active');
    } else if (needsMotionPermission()) {
      parts.push('Motion: requires permission');
    }
    if (state.settings.locationAuto) parts.push('Location: active');
    if (!parts.length) {
      el.textContent = 'Passive sensors (battery, network) are captured automatically when available.';
    } else {
      el.textContent = 'Active: ' + parts.join(', ') + '. Battery and network are captured automatically.';
    }
  }

  async function exportBackupAction() {
    try {
      const bk = await HCP.exportBackup(state.chain, state.publicKeyJwk, state.privateKeyJwk, state.pin);
      bk.declarations = state.declarations;
      bk.settings = state.settings;
      const blob = new Blob([JSON.stringify(bk, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      var exportName = (state.declarations.name || '').trim().replace(/[^a-zA-Z0-9]/g, '-') || state.fingerprint.slice(0, 8);
      var exportDate = new Date().toISOString().slice(0, 10);
      a.download = 'HEP-Backup_' + exportName + '_' + exportDate + '.json';
      a.click(); URL.revokeObjectURL(a.href); toast('Backup downloaded');
    } catch(e) { toast('Backup failed'); }
  }

  function importBackupAction() { document.getElementById('import-file').click(); }

  async function handleImportFile(event) {
    const file = event.target.files[0]; if (!file) return;
    try {
      const bk = JSON.parse(await file.text());
      const pin = prompt('Enter the PIN used to create this backup:');
      if (!pin) return;
      const r = await HCP.importBackup(bk, pin);
      state.chain = r.chain; state.publicKey = r.publicKey; state.privateKey = r.privateKey;
      state.publicKeyJwk = r.publicKeyJwk; state.privateKeyJwk = r.privateKeyJwk;
      state.fingerprint = await HCP.keyFingerprint(r.publicKeyJwk);
      if (bk.declarations) state.declarations = Object.assign(state.declarations, bk.declarations);
      if (bk.settings) state.settings = Object.assign(state.settings, bk.settings);
      // Witness URL is a device setting, not a chain property — never import it
      state.settings.witnessUrl = DEFAULT_WITNESS_URL;
      state.pin = pin; await saveKeys(pin); save(); state.initialized = true; refreshHome();
      showScreen('home'); closeModal('settings'); toast('Restored \u2014 ' + state.chain.filter(HCP.isAct).length + ' acts');
      handleIncomingPayload(); checkPingOnOpen(); checkPhotoNudge();
    } catch(e) { console.error('Import error:', e); toast('Import failed: ' + e.message); }
    event.target.value = '';
  }

  function changePIN() { toast('PIN change \u2014 next update'); }

  function installFromSettings() {
    if (deferredInstallPrompt) {
      installApp();
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (isStandalone) {
        toast('Already installed');
      } else if (isIOS) {
        toast('Tap the share button below, then "Add to Home Screen"');
      } else {
        toast('Open this page in Chrome, then use the browser menu to add to home screen');
      }
    }
  }

  function forceUpdate() {
    toast('Checking for updates...');
    // Step 1: Check version.json for newer version
    fetch(VERSION_CHECK_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      .then(function(resp) { return resp.ok ? resp.json() : null; })
      .then(function(data) {
        if (data && data.version && data.version !== APP_VERSION) {
          toast('Version ' + data.version + ' found. Updating...');
        } else if (data && data.version === APP_VERSION) {
          toast('Already on latest version (v' + APP_VERSION + ')');
          return;
        }
        // Step 2: Tell SW to check for new version
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then(function(reg) {
            if (reg) reg.update();
          });
        }
        // Step 3: Reload to pick up new files (network-first SW will fetch fresh)
        setTimeout(function() { window.location.reload(); }, 1000);
      })
      .catch(function() {
        // Offline or error -- fall back to nuclear option
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(regs) {
            return Promise.all(regs.map(function(r) { return r.unregister(); }));
          }).then(function() {
            return caches.keys();
          }).then(function(keys) {
            return Promise.all(keys.map(function(k) { return caches.delete(k); }));
          }).then(function() {
            toast('Caches cleared. Reloading...');
            setTimeout(function() { window.location.reload(true); }, 800);
          });
        } else {
          window.location.reload(true);
        }
      });
  }

  function deleteChain() {
    // Step 1: Offer backup first
    const hasChain = state.chain.length > 0;
    const exCount = state.chain.filter(HCP.isAct).length;
    const msg = hasChain
      ? 'You have ' + exCount + ' acts on your chain. Before deleting, you should save a backup.\n\nWould you like to export a backup first?'
      : 'This will delete your identity and all data from this device.\n\nWould you like to export a backup first?';

    const wantsBackup = confirm(msg);
    if (wantsBackup) {
      // Trigger backup download, then come back
      exportBackupAction().then(() => {
        setTimeout(() => proceedWithDelete(), 1000);
      });
      return;
    }

    proceedWithDelete();
  }

  function proceedWithDelete() {
    if (!confirm('Your thread will be permanently erased from this device. If you have not saved a backup, it is gone forever.\n\nContinue?')) return;
    const typed = prompt('Type DELETE to confirm:');
    if (typed !== 'DELETE') { toast('Deletion cancelled'); return; }

    // Scorched earth
    localStorage.removeItem(SK);
    localStorage.removeItem(SK + '_keys');
    localStorage.removeItem('hcp_install_dismissed');

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }

    // Clear caches
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(k => caches.delete(k));
      });
    }

    // Reset state
    state.chain = [];
    state.publicKey = null; state.privateKey = null;
    state.publicKeyJwk = null; state.privateKeyJwk = null;
    state.fingerprint = '';
    state.pin = '';
    state.declarations = { name: '', about: '', photo: null, photoDate: null };
    state.initialized = false;

    closeModal('settings');
    showScreen('setup');
    toast('Everything deleted');
  }

  // --- Share / Onboarding ---
  function openShare() {
    showModal('share');
    const baseUrl = getAppBase();
    const refUrl = baseUrl + '?ref=' + state.fingerprint;
    document.getElementById('share-url').textContent = baseUrl;
    document.getElementById('share-url-ref').textContent = refUrl;
    try { QR.generate(baseUrl, document.getElementById('share-qr'), 280); } catch(e) {}
  }

  function copyShareLink() {
    navigator.clipboard.writeText(getAppBase()).then(() => toast('Link copied')).catch(() => toast('Could not copy'));
  }

  function copyShareLinkRef() {
    const url = getAppBase() + '?ref=' + state.fingerprint;
    navigator.clipboard.writeText(url).then(() => toast('Introduction link copied')).catch(() => toast('Could not copy'));
  }

  function shareViaSystem() {
    if (navigator.share) {
      navigator.share({ title: 'Human Exchange Protocol', text: 'Record your cooperative acts. The value trust creates.', url: getAppBase() }).catch(() => {});
    } else { copyShareLink(); }
  }

  // Canonical app URL — all share surfaces, QR codes, and clipboard links
  // resolve to this URL regardless of where the user is running from
  // (local dev, alternate domain, installed PWA). Sharing always points
  // people to the live app, not to a local dev build or the marketing
  // root. Marketing site is at humanexchangeprotocol.org; app is at the
  // subdomain below.
  var CANONICAL_APP_URL = 'https://app.humanexchangeprotocol.org/';

  function getAppBase() {
    return CANONICAL_APP_URL;
  }

  function b64Encode(str) { return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64Decode(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return atob(str); }

  function checkReferral() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.length === 16) {
      state.referrer = ref;
    }
    // Check for incoming handshake proposal
    const hs = params.get('hs');
    if (hs) {
      try {
        state.pendingIncoming = { type: 'proposal', payload: b64Decode(hs) };
      } catch(e) {}
    }
    // Check for incoming confirmation
    const cf = params.get('cf');
    if (cf) {
      try {
        state.pendingIncoming = { type: 'confirmation', payload: b64Decode(cf) };
      } catch(e) {}
    }
    // Check for incoming chain view
    const cv = params.get('cv');
    if (cv) {
      try {
        state.pendingIncoming = { type: 'chainview', payload: b64Decode(cv) };
      } catch(e) {}
    }
    // Check for incoming settlement
    const st = params.get('st');
    if (st) {
      try {
        state.pendingIncoming = { type: 'settlement', payload: b64Decode(st) };
      } catch(e) {}
    }
    // Clean URL without reload
    if (ref || hs || cf || cv || st) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  function handleIncomingPayload() {
    if (!state.pendingIncoming || !state.initialized) return;
    const inc = state.pendingIncoming;
    state.pendingIncoming = null;

    setTimeout(() => {
      try {
        if (inc.type === 'proposal') {
          const parsed = HCP.parseHandshakePayload(inc.payload);
          // Save as pending confirmer item
          addPendingItem({
            role: 'confirmer',
            direction: parsed.exchange.energyState === 'provided' ? 'received' : 'provided',
            description: parsed.exchange.description,
            value: parsed.exchange.value,
            category: parsed.exchange.category,
            payload: inc.payload,
          });
          openConfirm();
          setTimeout(() => showCfReview(parsed), 300);
        } else if (inc.type === 'confirmation') {
          // Restore pending proposal from localStorage
          const saved = localStorage.getItem('hcp_pending_proposal');
          if (saved) {
            state.pendingProposal = JSON.parse(saved);
            // Arrived via URL scan — in-person path
            state.proposalPath = 'inperson';
            const parsed = HCP.parseConfirmationPayload(inc.payload);
            completeInitiatorSide(parsed);
          } else {
            toast('No pending proposal found');
          }
        } else if (inc.type === 'chainview') {
          const data = JSON.parse(inc.payload);
          showIncomingChainView(data);
        } else if (inc.type === 'settlement') {
          processSettlement(inc.payload);
        }
      } catch(e) {
        toast('Could not read the exchange data');
      }
    }, 400);
  }

  function showGuidedIntro() {
    if (!state.referrer) return;
    // After setup, prompt the new user with a guided first exchange
    const ref = state.referrer;
    state.referrer = null;
    setTimeout(() => {
      if (confirm('You were introduced by someone. Would you like to record a practice exchange to see how it works?')) {
        // Pre-populate exchange
        showModal('exchange');
        setDirection('received');
        document.getElementById('ex-desc').value = 'Introduction to HEP';
        document.getElementById('ex-value').value = '1';
        document.getElementById('ex-category').value = 'introduction';
        toast('Fields pre-filled \u2014 tap Generate to try it');
      }
    }, 500);
  }

  // --- Learn ---
  const LEARN_TOPICS = {
    // === START HERE (boot camp) ===
    act: {
      title: 'The Cooperative Act',
      slides: [
        { icon: '&#9741;', title: 'Before anyone named it',
          body: '<p>Two people. One helps the other. Something exists afterward that didn\u2019t exist before.</p><p><span class="highlight">This has always happened.</span> Before money. Before barter. Before any system anyone ever invented. Two people, and the honest moment between them.</p><p>A neighbor watches your kids. A friend drives you to the airport. Someone shares a meal. Energy moved. That\u2019s a cooperative act. It always was.</p>' },
        { icon: '&#127975;', title: 'The permission system',
          body: '<p>The monetary system didn\u2019t just create a medium of exchange. It created a <span class="highlight">permission system for what counts as work.</span></p><p>Caregiving. Domestic labor. Community maintenance. Creative practice. All reclassified as leisure or charity \u2014 not because they produce no value, but because they produce no extractable value for the system doing the classifying.</p><p>HEP refuses this permission system entirely.</p>' },
        { icon: '&#129309;', title: 'The tarp',
          body: '<p>Two homeless people. One has a tarp. One needs it. Energy moves.</p><p><span class="highlight">That is a cooperative act. It always was.</span> The monetary system didn\u2019t invent it \u2014 it just stopped counting it.</p><p>Nobody loses when that exchange gets recorded. No pool is drained. No authority is threatened. Two people\u2019s reality becomes slightly more legible. That is all. And that is everything.</p>' },
        { icon: '&#128203;', title: 'The honest record',
          body: '<p>HEP records cooperative acts between people. What you did, with whom, when \u2014 confirmed by both parties, held only by the people who lived it.</p><p><span class="highlight">Not a currency. Not a score. A record.</span></p><p>Before money existed, communities remembered who contributed and who received. This is that memory \u2014 made portable, tamper-evident, and held by the people who made it.</p>' },
      ]
    },
    value: {
      title: 'Value Is Yours',
      slides: [
        { icon: '&#9878;', title: 'You declare',
          body: '<p>When you provide something \u2014 mow a lawn, fix a pipe, teach a lesson, share a skill \u2014 <span class="highlight">you name the value.</span> A number that represents the energy you spent.</p><p>No institution tells you what your work is worth. No algorithm decides. You declare it, and the other person either agrees or you have a conversation.</p><p>This is how valuation worked before anyone decided for everyone.</p>' },
        { icon: '&#128587;', title: 'Both sides honest',
          body: '<p>Every act has a provider and a receiver. <span class="highlight">Both are honest positions.</span></p><p>A teacher provides for years before receiving. A student receives for years before giving. A person in crisis receives care. None of this is a burden \u2014 it\u2019s honest receiving.</p><p>The words are simple: <span class="highlight">provided</span> and <span class="highlight">received</span>. No moral weight. Just honest direction.</p>' },
        { icon: '&#128200;', title: 'Your thread is your reference',
          body: '<p>Over time your thread builds a record of what you\u2019ve valued and what others have valued when working with you. <span class="highlight">Your own history becomes your pricing guide.</span></p><p>Fixed three faucets last month at 15 each? That\u2019s your context for the next one. The pattern is yours. Nobody else sets it.</p><p>Price discovery emerges naturally from honest history. No authority required.</p>' },
        { icon: '&#128161;', title: 'No wrong number',
          body: '<p>A haircut might be worth 10 in one context and 25 in another. <span class="highlight">The protocol records what you agreed on, not what someone decided for you.</span></p><p>There is no correct price for anything. There is only what two people honestly agreed happened between them. The thread doesn\u2019t judge. It records the cooperative reality.</p><p>That\u2019s the point. The value is yours.</p>' },
      ]
    },
    beyond: {
      title: 'Beyond the Moment',
      slides: [
        { icon: '&#8987;', title: 'The timing problem',
          body: '<p>You fix your neighbor\u2019s sink. She\u2019s grateful, but she can\u2019t help you right now \u2014 and what you actually need is someone to tutor your kid.</p><p><span class="highlight">This is the oldest problem in cooperation.</span> Economists call it the coincidence of wants: both people need to want what the other has, at the same time, in the right proportion.</p><p>For most of human history, communities solved this with memory. Everyone knew who contributed and who received. That memory was the ledger.</p>' },
        { icon: '&#127759;', title: 'What money solved',
          body: '<p>Community memory worked, but it had limits. <span class="highlight">It couldn\u2019t scale beyond the people who knew you.</span></p><p>Money solved this by creating a universal token \u2014 help someone, receive a coin, spend that coin with a stranger across town. You no longer needed the same person to help you back. The timing problem was solved.</p><p>But money solved it by creating a permission system. If the system doesn\u2019t recognize your work, you don\u2019t get the token. No token, no participation. The solution created its own exclusions.</p>' },
        { icon: '&#128241;', title: 'What your thread solves',
          body: '<p>Your thread is a portable record of your cooperative history. When someone who\u2019s never met you reads it, <span class="highlight">they can see the shape of who you are</span> \u2014 what you\u2019ve done, how consistently, in what categories.</p><p>You fix the sink. Your thread records it. Next week you meet a tutor. She doesn\u2019t know your neighbor. She doesn\u2019t need to. She reads your thread and sees a real person with a real history of honest cooperation.</p><p>The timing problem is solved. No universal token required.</p>' },
        { icon: '&#9878;', title: 'No one is excluded',
          body: '<p>Here\u2019s the difference: <span class="highlight">you don\u2019t need a balance or a surplus to participate.</span> Your thread doesn\u2019t check your account before letting you cooperate.</p><p>A person who has received far more than they\u2019ve provided \u2014 a student, an elder, someone recovering from crisis \u2014 still has a readable thread. Still has a history. Still can cooperate with anyone willing.</p><p>Money solved the coincidence of wants but created gatekeeping. The thread solves it without the gate.</p>' },
      ]
    },
    calibrate: {
      title: 'Find Your Unit',
      interactive: true,
      slides: [
        { icon: '&#9881;', title: 'Your starting point',
          body: '<p>Before your first exchange, it helps to think about <span class="highlight">what your unit means to you.</span></p><p>This is a thought exercise. There are no right answers. You\u2019re building your own internal compass \u2014 a sense of relative value that\u2019s yours alone.</p><p>Think of <span class="highlight">the simplest helpful thing you do regularly.</span> Something easy. Something you wouldn\u2019t think twice about.</p>' +
            '<div class="cal-input-group"><div class="cal-label">Describe it in a few words:</div>' +
            '<input class="cal-input" type="text" id="cal-simple-desc" placeholder="e.g. watering a neighbor\u2019s plants" oninput="App.calUpdate()"></div>' +
            '<div class="cal-input-group"><div class="cal-input-row"><div class="cal-label">Give it a number:</div>' +
            '<input class="cal-input cal-input-num" type="number" id="cal-simple-val" placeholder="5" min="1" oninput="App.calUpdate()"></div>' +
            '<div class="cal-note">Pick any number that feels right. This becomes your anchor.</div></div>' },
        { icon: '&#11088;', title: 'Your skilled work',
          body: '<p>Now think of <span class="highlight">the most skilled thing you do.</span> Something that took years to learn, or that very few people around you can do.</p>' +
            '<div class="cal-input-group"><div class="cal-label">Describe it:</div>' +
            '<input class="cal-input" type="text" id="cal-skilled-desc" placeholder="e.g. rewiring a circuit breaker panel" oninput="App.calUpdate()"></div>' +
            '<p>How many of your simple acts does this equal? If <span class="highlight" id="cal-anchor-echo">your simple act</span> is <span class="highlight" id="cal-anchor-val-echo">your number</span>, what\u2019s this worth?</p>' +
            '<div class="cal-input-group"><div class="cal-input-row"><div class="cal-label">Its value:</div>' +
            '<input class="cal-input cal-input-num" type="number" id="cal-skilled-val" placeholder="50" min="1" oninput="App.calUpdate()"></div>' +
            '<div class="cal-note" id="cal-ratio-note"></div></div>' },
        { icon: '&#128296;', title: 'Something in between',
          body: '<p>Most of what you do probably falls somewhere between those two. <span class="highlight">Think of an everyday task that takes real effort</span> but isn\u2019t your most specialized work.</p>' +
            '<div class="cal-input-group"><div class="cal-label">Describe it:</div>' +
            '<input class="cal-input" type="text" id="cal-mid-desc" placeholder="e.g. cooking a full meal for a gathering" oninput="App.calUpdate()"></div>' +
            '<div class="cal-input-group"><div class="cal-input-row"><div class="cal-label">Its value:</div>' +
            '<input class="cal-input cal-input-num" type="number" id="cal-mid-val" placeholder="20" min="1" oninput="App.calUpdate()"></div>' +
            '<div class="cal-note" id="cal-mid-note"></div></div>' },
        { icon: '&#127760;', title: 'Something you\u2019d receive',
          body: '<p>You won\u2019t just be providing \u2014 you\u2019ll be receiving too. <span class="highlight">Think of something you\u2019d want from someone else.</span></p>' +
            '<div class="cal-input-group"><div class="cal-label">What would you receive?</div>' +
            '<input class="cal-input" type="text" id="cal-recv-desc" placeholder="e.g. someone tutoring my kid in math" oninput="App.calUpdate()"></div>' +
            '<div class="cal-input-group"><div class="cal-input-row"><div class="cal-label">What feels fair?</div>' +
            '<input class="cal-input cal-input-num" type="number" id="cal-recv-val" placeholder="25" min="1" oninput="App.calUpdate()"></div>' +
            '<div class="cal-note">There\u2019s no wrong answer. This is about your sense of proportion.</div></div>' },
        { icon: '&#128209;', title: 'Your map',
          body: '<p>Here\u2019s the internal map you just built \u2014 <span class="highlight">your own sense of relative value.</span></p>' +
            '<div id="cal-summary"></div>' +
            '<p>This isn\u2019t a price list. It\u2019s a compass. When you do your first real exchange and someone asks <span class="highlight">\u201cwhat\u2019s this worth?\u201d</span> \u2014 you already have an answer that\u2019s yours.</p>' +
            '<div class="cal-note">Your thread will grow from here. Every real exchange refines your sense of value. This was just the starting point.</div>' },
      ]
    },

    // === GO DEEPER ===
    foundations: {
      title: 'Foundations',
      slides: [
        { icon: '&#8644;', title: 'How does an exchange work?',
          body: '<p>One person provides a service, a product, or help. The other person receives it. Both agree on a value \u2014 a number that represents what just happened.</p><p><span class="highlight">You declare the value of your own work.</span> Nobody tells you what it\u2019s worth. The other person agrees or you negotiate.</p><p>The act gets recorded on both threads. That\u2019s it. No money changed hands. Real work got recorded.</p>' },
        { icon: '&#9776;', title: 'What\u2019s a thread?',
          body: '<p>Your thread is your complete history of cooperative acts. Every exchange you\u2019ve ever done, in order, linked together so nothing can be changed after the fact.</p><p><span class="highlight">Your balance shows whether you\u2019ve provided more than you\u2019ve received, or the reverse.</span> Both are honest positions.</p><p>A teacher gives for years before receiving. A student receives for years before giving. The thread holds the full arc. Nobody owns your thread except you.</p>' },
        { icon: '&#128241;', title: 'Two phones, one exchange',
          body: '<p>An exchange can happen several ways. If you are together, you exchange short pairing codes and your phones connect through the network. <span class="highlight">Both phones record the act. Both threads grow by one entry.</span></p><p>If there is no internet, you can use QR codes directly between phones. The record lives on your phone and theirs. Nobody else has a copy unless you choose to share it.</p>' },
        { icon: '&#10024;', title: 'What can you imagine?',
          body: '<p>A neighborhood where every act of cooperation is visible. A community that can see what it\u2019s actually capable of. An elder whose lifetime of giving is finally recorded.</p><p><span class="highlight">Your imagination is the limit.</span> This tool records cooperative acts \u2014 what you build with it is up to you and your community.</p><p>Start by doing what you\u2019re already doing. Just record it this time.</p>' },
      ]
    },
    pricing: {
      title: 'Price Discovery',
      slides: [
        { icon: '&#128269;', title: 'Your thread is your reference',
          body: '<p>Over time, your thread builds a record of what you\u2019ve charged and what you\u2019ve paid. When negotiating a new exchange, <span class="highlight">you can surface comparable acts from your own history.</span></p><p>Fixed three faucets last month at 15 each? That\u2019s your pricing context. The other person can see the pattern without seeing who those acts were with.</p><p>Price discovery emerges naturally from honest history.</p>' },
        { icon: '&#9881;', title: 'Negotiation is human',
          body: '<p>Two people might value the same work differently. That\u2019s not a flaw \u2014 it\u2019s how real exchange works. <span class="highlight">The protocol records what you agreed on, not what someone decided for you.</span></p><p>A haircut might be worth 10 in one context and 25 in another. The thread doesn\u2019t judge. It records the cooperative reality between two specific people at a specific moment.</p>' },
        { icon: '&#128202;', title: 'The thread viewer',
          body: '<p>When someone shares their thread with you before an exchange, <span class="highlight">you can see the shape of their work</span> \u2014 what categories they work in, how consistently they price, how active they\u2019ve been.</p><p>This is the context that makes negotiation informed rather than blind. You\u2019re not guessing. You\u2019re reading an honest record.</p>' },
      ]
    },
    exchange: {
      title: 'Exchange & Parity',
      slides: [
        { icon: '&#8644;', title: 'The exchange rate',
          body: '<p>Every person values their effort on their own scale. Your \u201c10\u201d and someone else\u2019s \u201c10\u201d might represent very different amounts of energy. <span class="highlight">The exchange rate translates between your scale and theirs.</span></p><p>Think of it the way currencies work between countries. A dollar and a euro measure differently. Neither is wrong. The exchange rate makes sure both sides are represented honestly.</p><p>Your rate comes from your thread\u2019s density compared to theirs. As both threads grow, the rate gets more precise.</p>' },
        { icon: '&#9878;', title: 'How parity works',
          body: '<p>When two people exchange, the rate between their threads adjusts prices so both sides are honestly represented. <span class="highlight">This happens automatically from the data. Nobody sets the rate.</span></p><p>Over time, your thread accumulates valuation data from everyone you have exchanged with. That accumulated data forms a basket, similar to what economists use to calculate purchasing power parity between countries, except nobody built or governs it.</p><p>Within specific categories of work, the rates are even more precise.</p>' },
        { icon: '&#128279;', title: 'Trust across threads',
          body: '<p>You don\u2019t need to know someone to exchange with them. You need to see their thread. <span class="highlight">A long, active, balanced thread is hard to fake and easy to trust.</span></p><p>The protocol doesn\u2019t vouch for anyone. The thread speaks for itself. A person with 500 confirmed acts over two years tells a different story than a person with 3 acts last week.</p><p>Trust is built honestly through cooperation. Fabrication is expensive to sustain.</p>' },
      ]
    },
    community: {
      title: 'Building Community',
      slides: [
        { icon: '&#127793;', title: 'Planting the first seeds',
          body: '<p>Every network starts with two people doing one honest exchange. <span class="highlight">You don\u2019t need critical mass. You need one real act.</span></p><p>Start with what\u2019s already happening \u2014 a neighbor who watches your kids, a friend who fixes your car, a colleague who covers your shift. Record what was already real.</p><p>The protocol doesn\u2019t create cooperation. It makes existing cooperation visible.</p>' },
        { icon: '&#127760;', title: 'The network grows naturally',
          body: '<p>When your counterparties start recording their own acts with others, the network spreads without anyone managing it. <span class="highlight">There is no sign-up, no onboarding funnel, no growth team.</span></p><p>Each person\u2019s thread is independent. The connections form when people exchange. The community emerges from the acts themselves, not from a platform.</p>' },
        { icon: '&#127919;', title: 'What communities can see',
          body: '<p>When enough people in a neighborhood are recording cooperative acts, <span class="highlight">the community can see what it\u2019s actually capable of.</span></p><p>How much tutoring happens every week. How many meals get shared. How much repair work circulates. The invisible economy becomes visible \u2014 not to surveil, but to understand and strengthen.</p><p>A community that can see its own cooperation can organize around it.</p>' },
      ]
    },
    sovereignty: {
      title: 'Your Phone, Your Server',
      slides: [
        { icon: '&#128241;', title: 'Offline by design',
          body: '<p>This app works without the internet. Your thread lives on your device. Exchanges happen face-to-face. <span class="highlight">No server, no cloud, no dependency.</span></p><p>This isn\u2019t a limitation \u2014 it\u2019s the design. A system that requires infrastructure excludes everyone without access to it. A system that runs on any phone includes everyone.</p>' },
        { icon: '&#128274;', title: 'Your data stays yours',
          body: '<p>No one can access your thread without your PIN. No company stores a copy. No government has a backdoor. <span class="highlight">If you delete it, it\u2019s gone.</span></p><p>This is data sovereignty in its simplest form. The person who created the data controls the data. There is no terms of service. There is no privacy policy to read. There is nothing to agree to because no one else is involved.</p>' },
        { icon: '&#9889;', title: 'Resilience through simplicity',
          body: '<p>The entire application is a single file. It runs on any phone with a browser. <span class="highlight">There is no server to hack, no database to breach, no company to shut down.</span></p><p>If the website disappears tomorrow, every installed copy keeps working. The protocol lives wherever the people are. That\u2019s the point.</p>' },
      ]
    },
    privacy: {
      title: 'Privacy & Safety',
      slides: [
        { icon: '&#9737;', title: 'You control what others see',
          body: '<p>When you share your thread for negotiation, <span class="highlight">no counterparty names are ever shown.</span> Only your work patterns, categories, and pricing history.</p><p>The person you\u2019re negotiating with can see the shape of your work without knowing who you worked with. Your competence travels with you. Your connections stay private.</p>' },
        { icon: '&#128737;', title: 'Protection in dangerous places',
          body: '<p>If you\u2019re in a situation where revealing your network could be dangerous, <span class="highlight">the protocol protects you by design.</span></p><p>No central registry knows you exist. No list of members can be seized. Your thread is encrypted behind your PIN. To an outside observer, the app is just a file on your phone.</p><p>If you need to disappear, delete your thread. It\u2019s gone. No trace, no record, no recovery.</p>' },
        { icon: '&#128100;', title: 'Identity without identification',
          body: '<p>Your fingerprint \u2014 a short hash of your public key \u2014 identifies you in exchanges. <span class="highlight">It proves you\u2019re the same person across acts without revealing who you are.</span></p><p>You can participate fully without ever giving your real name. The declarations section is optional. What you share is what you choose to share. Nothing more.</p>' },
      ]
    },
  };

  // Calibration exercise state
  let calData = { simpleDesc: '', simpleVal: 0, skilledDesc: '', skilledVal: 0, midDesc: '', midVal: 0, recvDesc: '', recvVal: 0 };

  function calUpdate() {
    // Read all inputs
    const sd = document.getElementById('cal-simple-desc');
    const sv = document.getElementById('cal-simple-val');
    const skd = document.getElementById('cal-skilled-desc');
    const skv = document.getElementById('cal-skilled-val');
    const md = document.getElementById('cal-mid-desc');
    const mv = document.getElementById('cal-mid-val');
    const rd = document.getElementById('cal-recv-desc');
    const rv = document.getElementById('cal-recv-val');

    if (sd) calData.simpleDesc = sd.value;
    if (sv) calData.simpleVal = parseInt(sv.value) || 0;
    if (skd) calData.skilledDesc = skd.value;
    if (skv) calData.skilledVal = parseInt(skv.value) || 0;
    if (md) calData.midDesc = md.value;
    if (mv) calData.midVal = parseInt(mv.value) || 0;
    if (rd) calData.recvDesc = rd.value;
    if (rv) calData.recvVal = parseInt(rv.value) || 0;

    // Update echoes on slide 2
    const ae = document.getElementById('cal-anchor-echo');
    const ave = document.getElementById('cal-anchor-val-echo');
    if (ae) ae.textContent = calData.simpleDesc || 'your simple act';
    if (ave) ave.textContent = calData.simpleVal ? calData.simpleVal.toString() : 'your number';

    // Ratio note on slide 2
    const rn = document.getElementById('cal-ratio-note');
    if (rn && calData.simpleVal > 0 && calData.skilledVal > 0) {
      const ratio = Math.round(calData.skilledVal / calData.simpleVal * 10) / 10;
      rn.textContent = 'That\u2019s ' + ratio + 'x your simple act. Does that feel right?';
    } else if (rn) {
      rn.textContent = '';
    }

    // Mid note on slide 3
    const mn = document.getElementById('cal-mid-note');
    if (mn && calData.simpleVal > 0 && calData.midVal > 0) {
      const ratio = Math.round(calData.midVal / calData.simpleVal * 10) / 10;
      mn.textContent = 'That\u2019s ' + ratio + 'x your simple act.';
    } else if (mn) {
      mn.textContent = '';
    }

    // Build summary on slide 5
    calBuildSummary();
  }

  function calBuildSummary() {
    const el = document.getElementById('cal-summary');
    if (!el) return;

    const items = [];
    if (calData.simpleDesc && calData.simpleVal > 0) items.push({ desc: calData.simpleDesc, val: calData.simpleVal, type: 'provided' });
    if (calData.midDesc && calData.midVal > 0) items.push({ desc: calData.midDesc, val: calData.midVal, type: 'provided' });
    if (calData.skilledDesc && calData.skilledVal > 0) items.push({ desc: calData.skilledDesc, val: calData.skilledVal, type: 'provided' });
    if (calData.recvDesc && calData.recvVal > 0) items.push({ desc: calData.recvDesc, val: calData.recvVal, type: 'received' });

    if (items.length === 0) {
      el.innerHTML = '<div class="cal-empty">Go back and fill in your acts to see your map here.</div>';
      return;
    }

    // Sort provided by value ascending, received at end
    const provided = items.filter(i => i.type === 'provided').sort((a, b) => a.val - b.val);
    const received = items.filter(i => i.type === 'received');
    const sorted = [...provided, ...received];

    let h = '<div class="cal-reflect">';
    sorted.forEach(item => {
      const ratio = calData.simpleVal > 0 ? Math.round(item.val / calData.simpleVal * 10) / 10 : 0;
      const ratioStr = ratio > 0 && item !== sorted[0] && item.type === 'provided' ? ratio + 'x' : '';
      const dirLabel = item.type === 'received' ? ' \u2190' : '';
      h += '<div class="cal-reflect-row">';
      h += '<div class="cal-reflect-desc">' + item.desc + dirLabel + '</div>';
      if (ratioStr) h += '<div class="cal-reflect-ratio">' + ratioStr + '</div>';
      h += '<div class="cal-reflect-val">' + item.val + '</div>';
      h += '</div>';
    });
    h += '</div>';
    el.innerHTML = h;
  }

  function calRestoreInputs() {
    // After a slide renders, restore any saved values
    setTimeout(() => {
      const fields = [
        ['cal-simple-desc', 'simpleDesc'], ['cal-simple-val', 'simpleVal'],
        ['cal-skilled-desc', 'skilledDesc'], ['cal-skilled-val', 'skilledVal'],
        ['cal-mid-desc', 'midDesc'], ['cal-mid-val', 'midVal'],
        ['cal-recv-desc', 'recvDesc'], ['cal-recv-val', 'recvVal'],
      ];
      fields.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el && calData[key]) el.value = calData[key];
      });
      calUpdate();
    }, 50);
  }

  let currentLearnTopic = null;
  let currentLearnSlide = 0;

  // Lesson modal state (new tile-based system for Learn tab)
  var _lessonTopicKey = null;
  var _lessonSlideIdx = 0;
  var _lessonTouchStartX = null;

  function _getLessonCompleted() {
    try { return JSON.parse(localStorage.getItem('hep_lessons_done') || '{}'); } catch(e) { return {}; }
  }
  function _setLessonCompleted(key) {
    var done = _getLessonCompleted();
    done[key] = true;
    localStorage.setItem('hep_lessons_done', JSON.stringify(done));
  }

  function openLessonTile(topicKey) {
    var topic = LEARN_TOPICS[topicKey];
    if (!topic) return;
    _lessonTopicKey = topicKey;
    _lessonSlideIdx = 0;
    var modal = document.getElementById('lesson-modal');
    modal.classList.add('active');
    _lessonRenderTile();

    // Touch swipe
    var content = document.getElementById('lesson-content');
    content.ontouchstart = function(e) { _lessonTouchStartX = e.touches[0].clientX; };
    content.ontouchmove = function(e) { e.preventDefault(); };
    content.ontouchend = function(e) {
      if (_lessonTouchStartX === null) return;
      var dx = e.changedTouches[0].clientX - _lessonTouchStartX;
      _lessonTouchStartX = null;
      if (Math.abs(dx) > 60) {
        if (dx < 0) lessonNext();
        else lessonPrev();
      }
    };
  }

  function _lessonRenderTile() {
    var topic = LEARN_TOPICS[_lessonTopicKey];
    if (!topic) return;
    var slides = topic.slides;
    var total = slides.length;
    var idx = _lessonSlideIdx;

    // Counter
    document.getElementById('lesson-counter').textContent = (idx + 1) + ' of ' + total;

    // Progress bar
    document.getElementById('lesson-bar-fill').style.width = ((idx + 1) / total * 100) + '%';

    // Back button opacity
    var backBtn = document.getElementById('lesson-back-btn');
    if (backBtn) backBtn.style.opacity = idx === 0 ? '0.3' : '1';

    // Content
    var s = slides[idx];
    var icon = s.icon || '';
    // Strip HTML entities for visual display
    var content = document.getElementById('lesson-content');
    content.innerHTML = '<div class="lesson-tile-visual" style="animation:lessonFadeUp 0.35s ease">' + icon + '</div>' +
      '<h3 class="lesson-tile-heading" key="h' + idx + '">' + s.title + '</h3>' +
      '<div class="lesson-tile-body" key="b' + idx + '">' + _lessonStripHTML(s.body) + '</div>';

    // Bottom (dots + button)
    var bottom = document.getElementById('lesson-bottom');
    var dotsHtml = '<div style="display:flex; gap:8px; justify-content:center; align-items:center;">';
    for (var i = 0; i < total; i++) {
      var cls = i === idx ? 'lesson-dot current' : (i < idx ? 'lesson-dot done' : 'lesson-dot');
      dotsHtml += '<div class="' + cls + '"></div>';
    }
    dotsHtml += '</div>';
    var btnLabel = idx === total - 1 ? 'Finish' : 'Next';
    dotsHtml += '<button class="btn btn-primary" style="width:100%; max-width:320px; padding:14px;" onclick="App.lessonNext()">' + btnLabel + '</button>';
    bottom.innerHTML = dotsHtml;
  }

  function _lessonStripHTML(body) {
    // Extract plain text from the rich HTML slides, keeping it concise for tile display
    var tmp = document.createElement('div');
    tmp.innerHTML = body;
    var text = tmp.textContent || tmp.innerText || '';
    // Truncate to ~200 chars for tile readability
    if (text.length > 250) text = text.substring(0, 247) + '...';
    return text;
  }

  function _lessonShowComplete() {
    _setLessonCompleted(_lessonTopicKey);
    var topic = LEARN_TOPICS[_lessonTopicKey];
    var content = document.getElementById('lesson-content');
    content.innerHTML = '<div class="lesson-complete">' +
      '<div class="lesson-complete-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
      '<h2 style="font-size:var(--fs-xl); font-weight:500; color:var(--text); margin:0 0 12px;">Lesson complete</h2>' +
      '<p style="font-size:var(--fs-md); color:var(--text-dim); line-height:1.5; margin:0 0 8px; max-width:280px;">Great job taking the time to learn about this. Every bit of understanding strengthens the network.</p>' +
      '<p style="font-size:var(--fs-sm); color:var(--text-faint); margin:0;">' + esc(topic.title) + '</p>' +
      '</div>';
    document.getElementById('lesson-counter').textContent = '';
    document.getElementById('lesson-bar-fill').style.width = '100%';
    var bottom = document.getElementById('lesson-bottom');
    bottom.innerHTML = '<button class="btn btn-primary" style="width:100%; max-width:320px; padding:14px;" onclick="App.lessonClose()">Continue learning</button>';
  }

  function lessonNext() {
    var topic = LEARN_TOPICS[_lessonTopicKey];
    if (!topic) return;
    if (_lessonSlideIdx < topic.slides.length - 1) {
      _lessonSlideIdx++;
      _lessonRenderTile();
    } else {
      _lessonShowComplete();
    }
  }

  function lessonPrev() {
    if (_lessonSlideIdx > 0) {
      _lessonSlideIdx--;
      _lessonRenderTile();
    }
  }

  function lessonClose() {
    var modal = document.getElementById('lesson-modal');
    modal.classList.remove('active');
    _lessonTopicKey = null;
    _lessonSlideIdx = 0;
    // Re-render learn tab to reflect completion state
    var el = document.getElementById('tab-learn-content');
    if (el) el.removeAttribute('data-rendered');
    renderLearnTab();
  }

  function openLearn() {
    showModal('learn');
    learnShowMenu();
  }

  function learnShowMenu() {
    currentLearnTopic = null;
    document.getElementById('learn-menu').style.display = 'block';
    document.getElementById('learn-slides').classList.remove('active');
    document.getElementById('learn-title').textContent = 'Learn';
    document.getElementById('learn-close-btn').onclick = () => closeModal('learn');
  }

  function learnOpen(topicKey) {
    const topic = LEARN_TOPICS[topicKey];
    if (!topic) return;
    currentLearnTopic = topicKey;
    currentLearnSlide = 0;

    // Reset calibration data when entering calibration fresh
    if (topicKey === 'calibrate') {
      calData = { simpleDesc: '', simpleVal: 0, skilledDesc: '', skilledVal: 0, midDesc: '', midVal: 0, recvDesc: '', recvVal: 0 };
    }

    document.getElementById('learn-menu').style.display = 'none';
    document.getElementById('learn-title').textContent = topic.title;
    document.getElementById('learn-close-btn').onclick = () => App.learnBack();

    const carousel = document.getElementById('learn-carousel');
    carousel.innerHTML = '';
    topic.slides.forEach(s => {
      const tile = document.createElement('div');
      tile.className = 'learn-tile';
      tile.innerHTML = '<div class="learn-tile-icon">' + s.icon + '</div><h3>' + s.title + '</h3>' + s.body;
      carousel.appendChild(tile);
    });

    const dots = document.getElementById('learn-dots');
    dots.innerHTML = '';
    topic.slides.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'learn-dot' + (i === 0 ? ' active' : '');
      dots.appendChild(d);
    });

    document.getElementById('learn-slides').classList.add('active');
    carousel.scrollLeft = 0;
    learnUpdateNav();

    // Restore calibration inputs if returning to calibrate
    if (topicKey === 'calibrate') calRestoreInputs();

    carousel.onscroll = () => {
      const idx = Math.round(carousel.scrollLeft / carousel.offsetWidth);
      if (idx !== currentLearnSlide) {
        currentLearnSlide = idx;
        dots.querySelectorAll('.learn-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
        learnUpdateNav();
        if (currentLearnTopic === 'calibrate') calRestoreInputs();
      }
    };
  }

  function learnUpdateNav() {
    const topic = LEARN_TOPICS[currentLearnTopic];
    if (!topic) return;
    const total = topic.slides.length;
    document.getElementById('learn-prev').disabled = currentLearnSlide === 0;
    const nextBtn = document.getElementById('learn-next');
    if (currentLearnSlide === total - 1) {
      nextBtn.textContent = 'Done';
      nextBtn.disabled = false;
    } else {
      nextBtn.innerHTML = 'Next \u203A';
      nextBtn.disabled = false;
    }
  }

  function learnPrev() {
    if (currentLearnSlide > 0) {
      currentLearnSlide--;
      const carousel = document.getElementById('learn-carousel');
      carousel.scrollTo({ left: currentLearnSlide * carousel.offsetWidth, behavior: 'smooth' });
      if (currentLearnTopic === 'calibrate') calRestoreInputs();
    }
  }

  function learnNext() {
    const topic = LEARN_TOPICS[currentLearnTopic];
    if (!topic) return;
    if (currentLearnSlide < topic.slides.length - 1) {
      currentLearnSlide++;
      const carousel = document.getElementById('learn-carousel');
      carousel.scrollTo({ left: currentLearnSlide * carousel.offsetWidth, behavior: 'smooth' });
      if (currentLearnTopic === 'calibrate') calRestoreInputs();
    } else {
      learnBack();
    }
  }

  function learnBack() {
    if (currentLearnTopic) {
      learnShowMenu();
    } else {
      closeModal('learn');
    }
  }

  // --- Install Prompt ---
  let deferredInstallPrompt = null;

  function setupInstallPrompt() {
    // Android/Chrome — capture the native install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (!localStorage.getItem('hcp_install_dismissed')) {
        document.getElementById('install-banner').classList.add('show');
      }
    });

    // iOS detection — show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIOS && !isStandalone && !localStorage.getItem('hcp_install_dismissed')) {
      const banner = document.getElementById('install-banner');
      document.getElementById('install-sub').textContent = 'Tap the share button, then "Add to Home Screen"';
      document.getElementById('install-btn').textContent = 'Got it';
      document.getElementById('install-btn').onclick = () => { banner.classList.remove('show'); };
      banner.classList.add('show');
    }
  }

  function installApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
          toast('Installing...');
        }
        deferredInstallPrompt = null;
        document.getElementById('install-banner').classList.remove('show');
      });
    } else {
      // Fallback — just dismiss with instructions
      document.getElementById('install-banner').classList.remove('show');
    }
  }

  function dismissInstall() {
    document.getElementById('install-banner').classList.remove('show');
    localStorage.setItem('hcp_install_dismissed', '1');
  }

  function isIOSBrowser() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    return isIOS && !isStandalone;
  }

  function skipInstallFirst() {
    localStorage.setItem('hcp_skip_install', '1');
    document.querySelectorAll('#setup .step').forEach(s => s.classList.remove('active'));
    document.getElementById('setup-welcome1').classList.add('active');
  }

  // --- Init ---
  function isDesktopBrowser() {
    var hasTouchScreen = navigator.maxTouchPoints > 0;
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    return !hasTouchScreen && !isStandalone;
  }

function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function(reg) {
        // SW lifecycle events no longer trigger user banners.
        // Network-first strategy means files are already fresh on load.
        // Version check (checkForUpdates) handles the rare edge case.
      }).catch(function(e) {
        console.log('[SW] Registration failed:', e.message);
      });
    }

    // Check for updates when app comes back to foreground
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && state.fingerprint) {
        checkForUpdates();
      }
    });

    initSensors();
    checkReferral();
    setupInstallPrompt();
    if (load() && state.fingerprint) {
      checkForUpdates();
      showLockScreen();
    } else {
      showScreen('setup');
      // If iOS browser and no existing data, show install-first prompt
      if (isIOSBrowser() && !localStorage.getItem('hcp_skip_install')) {
        document.querySelectorAll('#setup .step').forEach(s => s.classList.remove('active'));
        document.getElementById('setup-install-first').classList.add('active');
      }
      // Desktop: make import prominent
      if (isDesktopBrowser()) {
        var importBtns = document.querySelectorAll('#setup .step button[onclick*="importBackup"]');
        importBtns.forEach(function(btn) {
          btn.style.background = 'var(--accent)';
          btn.style.color = '#fff';
          btn.style.textDecoration = 'none';
          btn.style.padding = '12px 24px';
          btn.style.borderRadius = '8px';
          btn.style.fontSize = '15px';
          btn.textContent = 'Import an existing thread';
        });
      }
    }
  }
  
  // After setup completes, check for guided intro
  const _origComplete = completeSetup;
  function completeSetupWrapped() {
    showScreen('home');
    refreshHome();
    showPendingUpdateBanner();
    showGuidedIntro();
    resumePendingPair();
  }

  // ============================================================
  // NEW 8-STEP EXCHANGE FLOW
  // connect → verify → texture → role → service → proposal → confirm → done
  // Steps 1-3 built here. Steps 4-8 coming next.
  // ============================================================

  let exFlowActive = false;
  let exConnectMode = null; // 'start' or 'join'
  let exInitiatorRole = null; // 'provider' or 'receiver' — set by initiator before connection

  function deriveJoinCode(code) {
    return code.split('').map(function(c) {
      var idx = PAIR_CHARS.indexOf(c);
      return PAIR_CHARS[(idx + 1) % PAIR_CHARS.length];
    }).join('');
  }

  function toggleCoopStart() {
    var s = document.getElementById('coop-sub-opts');
    var c = document.getElementById('coop-chevron');
    if (s && c) { s.classList.toggle('open'); c.classList.toggle('open'); }
  }

  function exStartProviding() {
    exInitiatorRole = 'provider';
    exBeginStart();
  }

  function exStartReceiving() {
    exInitiatorRole = 'receiver';
    exBeginStart();
  }

  function exBeginStart() {
    var url = getWitnessUrl();
    if (!url) { openCooperate(); return; }

    exFlowActive = true;
    exConnectMode = 'start';
    cleanupSession();
    showModal('exchange');
    document.getElementById('exchange-header').textContent = 'Cooperate';
    showExStep('connect');

    // Generate the visible code
    var bytes = crypto.getRandomValues(new Uint8Array(4));
    sessionCode = Array.from(bytes).map(b => PAIR_CHARS[b % PAIR_CHARS.length]).join('');
    sessionTheirCode = deriveJoinCode(sessionCode);

    var html = '<div style="text-align:center; margin-bottom:16px;">';
    html += '<div style="font-size:17px; font-weight:600; color:var(--text);">Your code</div>';
    html += '</div>';
    html += '<div class="pair-code-display">';
    html += '<div class="pair-code-chars">' + esc(sessionCode) + '</div>';
    html += '<div class="pair-code-hint">Read this to the other person</div>';
    html += '</div>';
    html += '<div style="display:flex; align-items:center; gap:8px; justify-content:center; margin-top:20px;">';
    html += '<div style="width:8px; height:8px; border-radius:50%; background:var(--accent); animation:pulse 1.5s infinite;"></div>';
    html += '<span style="font-size:13px; color:var(--accent);">Waiting for them to join...</span>';
    html += '</div>';
    html += '<div style="text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">';
    html += '<span style="font-size:14px; color:var(--text-faint);">Have their code? </span>';
    html += '<span style="font-size:14px; color:var(--accent); font-weight:500; cursor:pointer;" onclick="App.exSwitchToJoin()">Enter it here</span>';
    html += '</div>';
    document.getElementById('ex-connect-content').innerHTML = html;

    // Post to server immediately
    exPostJoin(sessionCode, sessionTheirCode);
  }

  function startCooperateFlow() {
    // Legacy entry — redirect to providing by default
    exStartProviding();
  }

  function exSwitchToJoin() {
    // Stop polling for the code we generated, switch to join mode
    exStopConnectPoll();
    cleanupSession();
    // Close and reopen as joiner
    closeModal('exchange');
    setTimeout(function() { exJoinExchange(); }, 100);
  }

  function exJoinExchange() {
    var url = getWitnessUrl();
    if (!url) { openCooperate(); return; }

    exFlowActive = true;
    exConnectMode = 'join';
    exInitiatorRole = null; // joiner — role determined by partner
    cleanupSession();
    showModal('exchange');
    document.getElementById('exchange-header').textContent = 'Cooperate';
    showExStep('connect');

    var html = '<div style="text-align:center; margin-bottom:16px;">';
    html += '<div style="font-size:17px; font-weight:600; color:var(--text);">Enter their code</div>';
    html += '</div>';
    html += '<div class="pair-input-section" style="margin-top:20px;">';
    html += '<label>Code from the other person</label>';
    html += '<input type="text" id="ex-join-code" maxlength="4" placeholder="4 letters" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" oninput="App.exCodeInput(this)" style="font-size:24px; text-align:center; letter-spacing:8px; font-family:var(--font-mono);">';
    html += '</div>';
    html += '<button class="btn btn-primary" style="margin-top:20px;" id="ex-join-btn" onclick="App.exConnect()">Connect</button>';
    html += '<div id="ex-join-status" style="display:none; margin-top:16px;"></div>';
    document.getElementById('ex-connect-content').innerHTML = html;
    setTimeout(function() {
      var inp = document.getElementById('ex-join-code');
      if (inp) inp.focus();
    }, 100);
  }

  function exCodeInput(el) {
    el.value = el.value.toUpperCase().replace(/[^ACDEFGHJKMNPQRTUVWXYZ]/g, '').substring(0, 4);
  }

  async function exConnect() {
    // Joiner path: they typed the starter's code
    var btn = document.getElementById('ex-join-btn');
    if (btn) { btn.textContent = 'Connecting...'; btn.disabled = true; }

    var rawVal = (document.getElementById('ex-join-code') || {}).value;
    var starterCode = (rawVal || '').trim().toUpperCase();
    if (!starterCode || starterCode.length !== 4) {
      toast('Enter the 4-letter code');
      if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
      return;
    }

    // Joiner's my_code is derived from the starter's code
    sessionCode = deriveJoinCode(starterCode);
    sessionTheirCode = starterCode;

    await exPostJoin(sessionCode, sessionTheirCode);
  }

  async function exPostJoin(myCode, theirCode) {
    try {
      var url = getWitnessUrl();
      if (!url) { toast('No server available'); return; }

      var joinPayload = {
          my_code: myCode,
          their_code: theirCode,
          fingerprint: state.fingerprint,
          public_key: state.publicKeyJwk,
          role: exInitiatorRole || null,
      };
      console.log('[ex-flow] Posting to /session/join:', JSON.stringify({
        my_code: myCode, their_code: theirCode,
        fingerprint: (state.fingerprint || '').substring(0, 16) + '...',
        has_pubkey: !!state.publicKeyJwk,
        role: exInitiatorRole || null,
      }));

      var resp = await serverFetch(url + '/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinPayload),
      });

      if (!resp.ok) {
        var errBody = '';
        try { errBody = await resp.text(); } catch(e2) {}
        console.error('[ex-flow] Server returned ' + resp.status + ':', errBody);
        toast('Server error (' + resp.status + '): ' + (errBody || 'unknown'));
        if (exConnectMode === 'join') {
          var btn = document.getElementById('ex-join-btn');
          if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
        }
        return;
      }

      var data = await resp.json();

      if (data.connected) {
        sessionPartner = data.partner;
        exOnConnected();
      } else {
        // Show waiting and poll
        if (exConnectMode === 'join') {
          var statusEl = document.getElementById('ex-join-status');
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = '<div class="pair-status resolving"><div class="ps-icon">&#9203;</div><div class="ps-text">Waiting for connection...</div></div>';
          }
          var btn = document.getElementById('ex-join-btn');
          if (btn) btn.style.display = 'none';
        }
        exStartConnectPoll();
        sessionSetState('awaiting_connection');
      }
    } catch(e) {
      console.error('[ex-flow] Connect error:', e);
      toast('Error: ' + e.message);
      if (exConnectMode === 'join') {
        var btn = document.getElementById('ex-join-btn');
        if (btn) { btn.textContent = 'Connect'; btn.disabled = false; }
      }
    }
  }

  let exConnectPollTimer = null;

  function exStartConnectPoll() {
    exStopConnectPoll();
    const url = getWitnessUrl();
    if (!url || !sessionCode) return;

    let attempts = 0;
    exConnectPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 120) { exStopConnectPoll(); return; }
      try {
        const resp = await serverFetch(url + '/session/' + sessionCode);
        if (!resp.ok) return;
        const rawText = await resp.text();
        var data;
        try { data = JSON.parse(rawText); } catch(pe) { sessionViolation('invalid_json'); return; }
        var validation = sessionValidateResponse(data, rawText.length);
        if (!validation.valid) { sessionViolation(validation.reason); return; }
        if (data.connected && data.partner) {
          exStopConnectPoll();
          sessionPartner = data.partner;
          exOnConnected();
        }
      } catch(e) {}
    }, 3000);

    // Immediate check
    setTimeout(async () => {
      try {
        const resp = await serverFetch(url + '/session/' + sessionCode);
        if (!resp.ok) return;
        const rawText = await resp.text();
        var data;
        try { data = JSON.parse(rawText); } catch(pe) { sessionViolation('invalid_json'); return; }
        var validation = sessionValidateResponse(data, rawText.length);
        if (!validation.valid) { sessionViolation(validation.reason); return; }
        if (data.connected && data.partner) {
          exStopConnectPoll();
          sessionPartner = data.partner;
          exOnConnected();
        }
      } catch(e) {}
    }, 1500);
  }

  function exStopConnectPoll() {
    if (exConnectPollTimer) { clearInterval(exConnectPollTimer); exConnectPollTimer = null; }
  }

  async function exOnConnected() {
    if (!sessionPartner) return;
    sessionSetState('connected');

    // Derive ECDH shared key for encrypted relay
    try {
      if (sessionPartner.public_key && state.privateKeyJwk) {
        sessionSharedKey = await HCP.deriveSharedKey(state.privateKeyJwk, sessionPartner.public_key);
      }
    } catch(ek) { console.log('[ex-flow] ECDH key derivation failed:', ek.message); sessionSharedKey = null; }

    // Send our encrypted snapshot with ex-flow extras (only once)
    if (!sessionPartner._ourSnapshotSent && sessionSharedKey) {
      sessionPartner._ourSnapshotSent = true;
      // Build ex-flow extras: role, device reality, service pricing
      var extras = {};
      if (exInitiatorRole) extras._role = exInitiatorRole;
      // Device reality summary
      var pohCount = 0, hasGeo = 0, hasSensor = 0, hasDevice = 0;
      state.chain.forEach(function(r) {
        if (r.pohSnapshot) pohCount++;
        if (r.geo) hasGeo++;
        if (r.sensorHash) hasSensor++;
        if (r.device) hasDevice++;
      });
      var webgl = getWebGLRenderer();
      extras._device = {
        platform: navigator.platform,
        screen: screen.width + 'x' + screen.height,
        touchPoints: navigator.maxTouchPoints,
        webgl: webgl || null,
        pohSnapshots: pohCount,
        recordsWithGeo: hasGeo,
        recordsWithSensor: hasSensor,
        recordsWithDevice: hasDevice,
        totalRecords: state.chain.length,
        capabilityMask: (_sensor.accel ? 2 : 0) | (_sensor.gyro ? 4 : 0) | (_sensor.battery ? 8 : 0) | (_sensor.network ? 16 : 0)
      };
      // Per-service pricing data
      if (state.chain.length > 0) {
        var svcMap = {};
        state.chain.forEach(function(r) {
          var desc = (r.description || '').trim();
          if (!desc) return;
          var key = desc.toLowerCase();
          if (!svcMap[key]) {
            svcMap[key] = { description: desc, prices: [], counterparties: {}, category: r.category || '' };
          }
          svcMap[key].prices.push({ value: r.value, dir: r.energyState, when: r.timestamp });
          if (r.counterparty) svcMap[key].counterparties[r.counterparty] = 1;
        });
        var services = {};
        Object.keys(svcMap).forEach(function(key) {
          var s = svcMap[key];
          var vals = s.prices.map(function(p) { return p.value; });
          var provided = s.prices.filter(function(p) { return p.dir === 'provided'; });
          var received = s.prices.filter(function(p) { return p.dir === 'received'; });
          services[key] = {
            desc: s.description,
            cat: s.category,
            n: s.prices.length,
            g: provided.length,
            r: received.length,
            people: Object.keys(s.counterparties).length,
            low: Math.min.apply(null, vals),
            high: Math.max.apply(null, vals),
            avg: Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length),
            prices: s.prices.slice(-10).map(function(p) { return { v: p.value, d: p.dir, w: p.when }; })
          };
        });
        extras._services = services;
      }
      sendEncryptedSnapshot(extras);
    }

    // Determine session role
    if (exInitiatorRole) {
      // I'm the initiator -- I already chose my role
      sessionRole = exInitiatorRole === 'provider' ? 'proposer' : 'confirmer';
    } else {
      // I'm the joiner -- take complement of partner's role
      // Check partner.role field first (Option B), fall back to snapshot._role (old clients)
      var partnerRole = sessionPartner.role || null;
      if (!partnerRole) {
        try { partnerRole = sessionPartner.thread_snapshot ? (typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot)._role : null; } catch(e) {}
      }
      if (partnerRole === 'provider') {
        sessionRole = 'confirmer'; // partner provides, I receive
      } else if (partnerRole === 'receiver') {
        sessionRole = 'proposer'; // partner receives, I provide
      } else {
        sessionRole = 'confirmer'; // fallback: wait for proposal
      }
    }

    // Compute SAS from both fingerprints
    const myFp = state.fingerprint || '';
    const theirFp = sessionPartner.fingerprint || '';
    const sasResult = await computeSAS(myFp, theirFp);
    sessionSASHash = sasResult.fullHash; // store for automatic collision detection

    // Get partner name from snapshot (may not be available yet)
    let partnerName = 'Connected';
    let partnerInitial = '?';
    try {
      const snap = sessionPartner.thread_snapshot;
      if (snap && snap._name) {
        partnerName = snap._name;
        partnerInitial = partnerName.charAt(0).toUpperCase();
      }
    } catch(e) {}

    // Show verify step: name + 2-char SAS code
    document.getElementById('ex-verify-avatar').textContent = partnerInitial;
    document.getElementById('ex-verify-name').textContent = partnerName;
    document.getElementById('ex-sas-code').textContent = sasResult.code;
    showExStep('verify');

    // Poll for partner's encrypted snapshot if not yet received
    if (!sessionPartner._snapshotDecrypted && sessionSharedKey) {
      startSnapshotPoll(function(decrypted) {
        // Update verify screen with partner name if still showing
        if (decrypted && decrypted._name) {
          var nameEl = document.getElementById('ex-verify-name');
          var avatarEl = document.getElementById('ex-verify-avatar');
          if (nameEl) nameEl.textContent = decrypted._name;
          if (avatarEl) avatarEl.textContent = decrypted._name.charAt(0).toUpperCase();
        }
        // If the user already confirmed SAS and the Review screen is
        // showing (ex-review-container exists and is visible), the
        // counterparty context block may have been rendered without
        // data. Re-invoke exConfirmSAS now so the context cards fill
        // in from the newly arrived snapshot. Same for the receiver-
        // wait screen if we're past Review.
        var reviewContainer = document.getElementById('ex-review-container');
        if (reviewContainer && reviewContainer.style.display !== 'none' && reviewContainer.innerHTML.length > 0) {
          try { exConfirmSAS(); } catch(e) { console.log('[ex-flow] Re-render after snapshot failed:', e.message); }
        }
        var rwTiles = document.getElementById('ex-rw-tiles');
        if (rwTiles) {
          try { exRenderReceiverWait(); } catch(e) { console.log('[ex-flow] Wait re-render after snapshot failed:', e.message); }
        }
      });
    }
  }

  async function computeSAS(fpA, fpB) {
    // Sort fingerprints for canonical ordering -- both phones compute the same
    const sorted = [fpA, fpB].sort();
    const input = sorted[0] + '|' + sorted[1];
    const encoded = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    const hashArr = new Uint8Array(hashBuf);
    // Internal: 16-byte hash for automatic collision detection
    const fullHash = Array.from(hashArr.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
    // Display: 2-char alphanumeric code from first 2 bytes
    const CHARS = 'ABCDEFGHJKMNPQRTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I/L, S/5)
    const char1 = CHARS[hashArr[0] % CHARS.length];
    const char2 = CHARS[hashArr[1] % CHARS.length];
    const code = char1 + char2;
    return { code: code, fullHash: fullHash };
  }

  function exConfirmSAS() {
    // SAS confirmed — render the Review screen. Partner identity block
    // at top, then counterparty context (chain shape + POH verdict),
    // then the primary Confirm action. All the legacy assessment logic
    // that used to live here (exClassifyChain, exIsEmulator, healthBadge,
    // pohOk, ad-hoc signal interpretation) was removed in v2.54.0 once
    // the registry-backed POH card took over and made it redundant.
    var ts = sessionPartner ? sessionPartner.thread_snapshot : null;
    if (typeof ts === 'string') { try { ts = JSON.parse(ts); } catch(e) {} }
    _textureTs = ts;
    var name = (ts && ts._name) || 'Partner';
    var initial = name.charAt(0).toUpperCase();
    var sasCode = document.getElementById('ex-sas-code') ? document.getElementById('ex-sas-code').textContent : '--';
    var fp = sessionPartner ? (sessionPartner.fingerprint || '').substring(0, 16) : '';

    var html = '';

    // Partner identity + SAS (compact)
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:10px; box-shadow:var(--shadow);">';
    html += '<div style="display:flex; gap:14px; align-items:center;">';
    html += '<div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, var(--accent), var(--accent-dim)); display:flex; align-items:center; justify-content:center; color:#fff; font-size:20px; flex-shrink:0;">' + initial + '</div>';
    html += '<div style="flex:1; min-width:0;">';
    html += '<div style="font-size:17px; font-weight:600; color:var(--text);">' + esc(name) + '</div>';
    html += '<div style="font-size:11px; color:var(--text-faint); font-family:var(--font-mono);">' + esc(fp) + '</div>';
    html += '</div>';
    html += '<div style="background:var(--accent-light); border-radius:8px; padding:6px 14px; text-align:center;">';
    html += '<div style="font-size:9px; color:var(--text-dim); font-weight:500; letter-spacing:0.5px;">CODE</div>';
    html += '<div style="font-size:24px; font-weight:700; color:var(--accent); font-family:var(--font-mono); letter-spacing:4px;">' + esc(sasCode) + '</div>';
    html += '</div></div></div>';

    // Counterparty context block — chain shape card + POH verdict card.
    // Placed above the Confirm button so it's visible without scrolling
    // past the primary action. If the snapshot hasn't arrived yet (rare
    // but possible on fast SAS verification), the block is simply
    // omitted and will appear when exConfirmSAS is re-invoked from the
    // snapshot poll callback in exOnConnected.
    if (ts) {
      try { html += renderCounterpartyContextBlock(ts); } catch(cpe) {
        console.log('[ex-flow] Counterparty context render failed:', cpe.message);
      }
    }

    // Confirm button
    html += '<button class="btn btn-primary" style="width:100%; margin-bottom:4px;" onclick="App.exReviewConfirm()">Confirm</button>';
    html += '<div style="text-align:center; margin-bottom:14px;"><span style="font-size:13px; color:var(--text-faint); cursor:pointer;" onclick="App.exRejectSAS()">Not the right person?</span></div>';

    // Render into the verify step container (replacing the SAS-only view)
    var verifyStep = document.getElementById('ex-step-verify');
    // Clear old progress bar and content, replace with review
    var oldProg = verifyStep.querySelector('.ex-progress');
    if (oldProg) oldProg.style.display = 'none';
    var verifyPartner = document.getElementById('ex-verify-partner');
    if (verifyPartner) verifyPartner.style.display = 'none';
    // Hide old buttons
    verifyStep.querySelectorAll('button, div').forEach(function(el) {
      if (el.id !== 'ex-review-container') el.style.display = 'none';
    });
    // Insert review content
    var reviewContainer = document.getElementById('ex-review-container');
    if (!reviewContainer) {
      reviewContainer = document.createElement('div');
      reviewContainer.id = 'ex-review-container';
      verifyStep.appendChild(reviewContainer);
    }
    reviewContainer.style.display = 'block';
    reviewContainer.innerHTML = html;
  }

  function exReviewConfirm() {
    // Skip texture step, go directly to exchange form
    exContinueFromTexture();
  }

  function exRejectSAS() {
    toast('Connection failed verification — closing');
    cleanupSession();
    exFlowActive = false;
    closeModal('exchange');
  }

  // =====================================================
  // CHAIN TEXTURE REVIEW — Four-state classification
  // =====================================================
  var YOUNG_THRESHOLD = 6;

  function exIsEmulator(dev) {
    if (!dev || !dev.webgl) return false;
    var w = dev.webgl.toLowerCase();
    return w.indexOf('swiftshader') >= 0 || w.indexOf('llvmpipe') >= 0 || w.indexOf('microsoft basic') >= 0;
  }

  function exClassifyChain(ts) {
    var dev = ts._device || {};
    var observations = [];

    // --- Non-human: device-level signals ---
    if (exIsEmulator(dev)) {
      observations.push({ signal: 'emulator', text: 'This device does not have a real graphics chip. It is using software to pretend it has one. Real phones have physical hardware built by companies like Qualcomm or Apple. This device is using a simulated environment \u2014 the kind used by emulators and virtual machines that can run without a person present.' });
    }
    if (dev.touchPoints === 0 && dev.totalRecords > 0) {
      observations.push({ signal: 'no-touch', text: 'This device has no touch screen. Every smartphone has one. A device with zero touch capability is a computer, a server, or a simulated phone \u2014 not a phone someone carries in their pocket.' });
    }
    if (dev.totalRecords >= 5 && dev.recordsWithSensor === 0 && dev.recordsWithGeo === 0) {
      observations.push({ signal: 'no-sensors', text: 'Across ' + dev.totalRecords + ' exchanges, this device has never recorded any physical sensor data \u2014 no motion, no location, no orientation. A real phone constantly senses the world around it. This phone appears to exist in a place where physics does not apply.' });
    }
    var hasNonHumanSignal = observations.some(function(o) { return o.signal === 'emulator' || o.signal === 'no-touch'; });
    if (hasNonHumanSignal) {
      return { state: 'nonhuman', observations: observations };
    }

    // --- Young: low record count ---
    if (!ts.n || ts.n < YOUNG_THRESHOLD) {
      // Still gather behavioral observations within young
      if (ts.n >= 2 && ts.r > 0 && ts.g === 0) {
        observations.push({ signal: 'receive-only', text: 'This person has received ' + ts.r + ' time' + (ts.r > 1 ? 's' : '') + ' but has not provided anything yet. They have only been on the receiving end so far.' });
      }
      if (ts.n >= 2 && ts.g > 0 && ts.r === 0) {
        observations.push({ signal: 'provide-only', text: 'This person has provided ' + ts.g + ' time' + (ts.g > 1 ? 's' : '') + ' but has not received anything. They have only been giving so far.' });
      }
      var uniquePeople = {};
      // Estimate counterparty diversity from category data
      var catCount = Object.keys(ts.cats || {}).length;
      if (ts.n >= 3 && catCount <= 1) {
        observations.push({ signal: 'single-cat', text: 'So far, all exchanges fall in one category. This is normal if this is what the person does for their work or daily life. As their thread grows, more variety may appear naturally.' });
      }
      return { state: 'young', observations: observations };
    }

    // --- Unusual: behavioral patterns on a mature-enough chain ---
    if (ts.g > 0 && ts.r === 0) {
      observations.push({ signal: 'provide-only', text: 'This person has provided ' + ts.g + ' times but has never received. In real cooperative relationships, people both give and receive. A chain that only flows in one direction is unusual.' });
    }
    if (ts.r > 0 && ts.g === 0) {
      observations.push({ signal: 'receive-only', text: 'This person has received ' + ts.r + ' times but has never provided anything to anyone. They have only taken so far, never given.' });
    }
    var catCount = Object.keys(ts.cats || {}).length;
    if (catCount <= 1) {
      var catName = Object.keys(ts.cats || {})[0] || 'one type of service';
      var catText = 'This person\u2019s exchanges are all in one category: ' + esc(catName) + '. This is not unusual if it is what they do for their profession or life\u2019s work.';
      if (ts.g > 0 && ts.r > 0) {
        catText += ' They both provide and receive, which shows real cooperative activity.';
      } else if (ts.g > 0 && ts.r === 0) {
        catText += ' They have only provided so far \u2014 they may be early in building their cooperative network.';
      }
      observations.push({ signal: 'single-cat', text: catText });
    }
    var timeKeys = Object.keys(ts.time || {});
    if (ts.n >= 10 && timeKeys.length <= 1) {
      observations.push({ signal: 'burst', text: 'All ' + ts.n + ' exchanges happened in a single short period. Real cooperation happens over days, weeks, months. When everything appears at once, it can mean the records were created together rather than lived.' });
    }
    // Low sensor coverage on a real device
    if (dev.totalRecords >= 5) {
      var sensorPct = Math.round(dev.recordsWithSensor / dev.totalRecords * 100);
      var hasSensorCapability = (dev.capabilityMask || 0) & 6; // bits 2 (accel) + 4 (gyro)
      if (sensorPct < 30 && hasSensorCapability) {
        // Device CAN read sensors but most records don't have them
        observations.push({ signal: 'low-sensor', text: 'Only ' + sensorPct + '% of this person\u2019s exchanges carry physical sensor data. Their device is capable of reading sensors, but most exchanges are missing this data. The phone may have been sitting still, or the exchanges may not have involved a person actively holding the device.' });
      } else if (sensorPct < 30 && !hasSensorCapability) {
        // Device CANNOT read sensors — platform limitation (e.g. iOS Safari)
        // Do not flag as unusual — this is expected behavior
        // Optionally add informational note without triggering unusual state
      }
    }

    if (observations.length > 0) {
      return { state: 'unusual', observations: observations };
    }

    // --- Healthy ---
    return { state: 'healthy', observations: [] };
  }

  // Cooperation ratio bar (used across states)
  function exCoopBar(g, r) {
    var total = g + r;
    if (total === 0) return '';
    var gPct = Math.round(g / total * 100);
    var rPct = 100 - gPct;
    var html = '<div style="margin-top:12px;">';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;">';
    html += '<span style="font-size:11px; color:var(--text-faint);">provided ' + g + '</span>';
    html += '<span style="font-size:11px; color:var(--text-faint);">received ' + r + '</span>';
    html += '</div>';
    html += '<div style="height:14px; background:var(--bg-input); border-radius:7px; overflow:hidden; display:flex;">';
    if (gPct > 0) html += '<div style="width:' + gPct + '%; background:var(--accent); border-radius:7px 0 0 7px;"></div>';
    if (rPct > 0) html += '<div style="width:' + rPct + '%; background:var(--blue); border-radius:0 7px 7px 0;"></div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Detail link row (chevron-style)
  function exDetailLink(icon, label, detailKey, highlight) {
    var labelColor = highlight ? 'var(--text)' : 'var(--text-dim)';
    var labelWeight = highlight ? 'font-weight:500;' : '';
    var iconColor = highlight ? 'var(--accent)' : 'var(--text-faint)';
    return '<div style="display:flex; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid var(--border); cursor:pointer;" onclick="App.showTextureDetail(\'' + detailKey + '\')">' +
      '<span style="font-size:10px; flex-shrink:0; width:20px; text-align:center; color:' + iconColor + ';">' + icon + '</span>' +
      '<span style="flex:1; font-size:13px; color:' + labelColor + '; line-height:1.4;' + labelWeight + '">' + label + '</span>' +
      '<span style="font-size:14px; color:var(--text-faint); flex-shrink:0;">&#8250;</span>' +
      '</div>';
  }

  // --- Texture detail modal ---
  var _textureTs = null; // stashed for detail views

  function showTextureDetail(key) {
    var title = '', body = '';

    // Handle keys that don't need texture snapshot
    if (key === 'wallet-position-explain') {
      var bal = HCP.walletBalance(state.chain);
      var balStr = (bal >= 0 ? '+' : '') + bal.toFixed(0);
      var balClass = bal > 0 ? 'var(--green)' : bal < 0 ? 'var(--red)' : 'var(--text-dim)';
      title = 'What this number means';
      body = '<div style="text-align:center; margin-bottom:16px;">' +
        '<div style="font-size:36px; font-weight:600; color:' + balClass + ';">' + balStr + '</div>' +
        '</div>' +
        '<div style="font-size:14px; color:var(--text-dim); line-height:1.7; margin-bottom:14px;">' +
        'This number represents your cooperative position right now. It does not mean you have received less or more than others. It may simply mean that what you received was deeply valuable to the person who provided it, and you agreed.' +
        '</div>' +
        '<div style="font-size:14px; color:var(--text-dim); line-height:1.7; margin-bottom:14px;">' +
        'This is not debt. No one will ever come for this balance. Human beings receive far more than they give for most of their early life, and when we get old, we will again. There are seasons of providing and seasons of receiving.' +
        '</div>' +
        '<div style="font-size:14px; color:var(--text-dim); line-height:1.7;">' +
        'This number does not stop you from cooperating with anyone. You can provide, you can receive. Your thread continues to grow regardless of where this number sits.' +
        '</div>';
      document.getElementById('texture-detail-title').textContent = title;
      document.getElementById('texture-detail-body').innerHTML = body;
      var el = document.getElementById('texture-detail-overlay');
      el.style.display = 'flex';
      requestAnimationFrame(function() { requestAnimationFrame(function() { el.classList.add('active'); }); });
      return;
    }

    var ts = _textureTs;
    if (!ts) return;
    var dev = ts._device || {};
    var name = (ts._name) || 'This person';

    if (key === 'healthy-signals') {
      title = 'What the chain shows';
      body = exDetailSignals(ts, dev);
    } else if (key === 'healthy-categories') {
      title = 'Activity breakdown';
      body = exDetailCategories(ts);
    } else if (key === 'young-thin') {
      title = 'What makes a chain young';
      body = '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">' +
        'A young chain simply means this person has not been using the protocol for long. There are few exchanges on record, which means less history to read.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'This is not a concern on its own. Everyone starts with an empty chain. What matters is whether what is here looks genuine and whether the context makes sense for your exchange.' +
        '</div>';
    } else if (key === 'young-depth') {
      title = 'Why network depth matters';
      body = '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">' +
        'A chain builds credibility through diversity \u2014 different people, different services, different times. A person who has exchanged with many different people across months is harder to fabricate than one with a few exchanges in a single week.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'Depth comes with time. A young chain will grow if the person continues to cooperate genuinely.' +
        '</div>';
    } else if (key === 'young-questions') {
      title = 'Questions to consider';
      body = exDetailQuestions([
        { q: 'Do you know this person?', a: 'If you know them personally, a thin chain is less concerning. You have context the chain has not built yet.' },
        { q: 'Is this your first exchange with them?', a: 'First exchanges are normal. If the stakes are high, you might want to start small and build trust over time.' },
        { q: 'Does their chain match their story?', a: 'If someone says they have been doing this for a year but their chain is two weeks old, that is worth asking about.' },
      ]);
    } else if (key === 'unusual-attention') {
      title = 'What caught our attention';
      body = exDetailObservations(ts);
    } else if (key === 'unusual-means') {
      title = 'What this means for you';
      body = '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">' +
        'Unusual patterns do not mean this person is dishonest. There are many legitimate reasons a chain might look one-sided or concentrated \u2014 someone new to their area, someone who primarily offers one skill, or simply someone early in their journey.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'What it does mean is that you have less history to rely on. The chain is giving you less information than a more established one would. Factor that into your decision.' +
        '</div>';
    } else if (key === 'unusual-questions') {
      title = 'Questions to consider';
      body = exDetailQuestions([
        { q: 'Is the pattern consistent with what they told you?', a: 'If someone says they are a plumber and their chain shows only plumbing, that one-category pattern makes sense. If they claim variety but the chain says otherwise, notice that.' },
        { q: 'Are you comfortable with the stakes?', a: 'A small exchange with someone whose chain raises questions is different from a large one. Match your commitment to your confidence.' },
        { q: 'Would you do this exchange outside of HEP?', a: 'The protocol gives you more information than you would have without it. If you would trust this person anyway, the chain observations are just additional context.' },
      ]);
    } else if (key === 'unusual-gaming') {
      title = 'How gaming works \u2014 and what it costs';
      body = '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">' +
        'To inflate a chain, a person needs accomplices. Say three people agree to fake exchanges to build each other\u2019s records.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'Each fake exchange creates a real record \u2014 with a real deficit for the person issuing the value. That deficit is permanent and visible. They have sacrificed their own record to build someone else\u2019s.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'The beneficiary now has a chain where all exchanges are with the same two people. Anyone reviewing it will see this immediately \u2014 deep relationship, tiny network.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'The effort required to game the system costs more than genuine cooperation would. And the result tells a story any community member can read.' +
        '</div>';
    } else if (key === 'nonhuman-what') {
      title = 'What makes this non-human';
      body = exDetailNonhumanSignals(dev);
    } else if (key === 'nonhuman-means') {
      title = 'What this means for you';
      body = '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">' +
        'The device on the other end of this exchange is not behaving like a real phone carried by a person. This does not necessarily mean the person is fake \u2014 but the tool they are using is not a normal phone.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'Emulators and virtual machines can generate exchanges without a human being present. They can run around the clock, from anywhere, and simulate interactions that never happened in the physical world.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'You decide whether to proceed. The chain is showing you what it sees.' +
        '</div>';
    } else if (key === 'nonhuman-questions') {
      title = 'Questions to consider';
      body = exDetailQuestions([
        { q: 'Is this person physically in front of you?', a: 'If you can see them holding a device, consider whether the device matches what the data describes. A person on a laptop claiming to be on a phone is worth noticing.' },
        { q: 'Do they have a reason to use an emulator?', a: 'Some developers test on emulators. But exchanging value through an emulator removes the physical reality layer that protects both of you.' },
        { q: 'What are the stakes of this exchange?', a: 'The higher the value involved, the more this signal matters.' },
      ]);
    } else if (key === 'nonhuman-extract') {
      title = 'How fabricated chains extract from communities';
      body = '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">' +
        'A fabricated chain is a script \u2014 an automated system producing exchanges that never involved real cooperation. The chain looks populated but the work never happened.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px;">' +
        'When someone with a fabricated chain enters a genuine community, they receive real cooperation in exchange for a record that was manufactured. Your real effort gets recorded against their artificial history.' +
        '</div>' +
        '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-top:12px; color:var(--accent); font-weight:500;">' +
        'The deeper your own network grows \u2014 more people, more diversity, more genuine exchanges \u2014 the more your chain speaks for itself, and the harder it becomes for anyone to extract value from your community.' +
        '</div>';
    } else if (key === 'device-signals') {
      title = 'Device details';
      body = exDetailDeviceSignals(dev);
    }

    if (!title) return;
    document.getElementById('texture-detail-title').textContent = title;
    document.getElementById('texture-detail-body').innerHTML = body;
    var el = document.getElementById('texture-detail-overlay');
    el.style.display = 'flex';
    requestAnimationFrame(function() { requestAnimationFrame(function() { el.classList.add('active'); }); });
  }

  function closeTextureDetail() {
    var el = document.getElementById('texture-detail-overlay');
    el.classList.remove('active');
    setTimeout(function() { if (!el.classList.contains('active')) el.style.display = 'none'; }, 320);
  }

  // --- Detail content builders ---

  function exDetailSignals(ts, dev) {
    var html = '';
    // Device reality
    var isPhone = dev.touchPoints > 0;
    if (isPhone) {
      html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">';
      html += '<span style="color:var(--green); font-size:14px;">&#10003;</span>';
      html += '<span style="font-size:13px; color:var(--text-dim);">Real phone confirmed</span>';
      html += '</div>';
      html += '<div style="font-size:12px; color:var(--text-faint); margin-bottom:16px; line-height:1.5;">This device has a touch screen, a hardware graphics chip, and physical sensors. It behaves like a real phone carried by a person.</div>';
    }
    // Sensor coverage
    if (dev.totalRecords > 0) {
      var sensorPct = Math.round(dev.recordsWithSensor / dev.totalRecords * 100);
      var geoPct = Math.round(dev.recordsWithGeo / dev.totalRecords * 100);
      html += '<div style="font-size:14px; font-weight:500; color:var(--text); margin-bottom:8px;">Physical reality signals</div>';
      var hasSensorCap = (dev.capabilityMask || 0) & 6;
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-bottom:10px;">';
      html += '<strong style="color:var(--accent);">' + sensorPct + '%</strong> of exchanges carry sensor data \u2014 ';
      if (!hasSensorCap && sensorPct < 30) {
        html += 'this device\u2019s operating system does not allow apps to read physical sensors like accelerometers and gyroscopes. This is a platform limitation (common on iPhones), not a concern about the person.';
      } else if (sensorPct >= 80) {
        html += 'this phone is consistently sensing the real world during exchanges. Motion, gravity, air pressure \u2014 the physics of a person holding a phone.';
      } else if (sensorPct >= 50) {
        html += 'most exchanges show physical reality. Some older records may not have captured sensors.';
      } else if (sensorPct > 0) {
        html += 'many exchanges are missing physical sensor data. This could mean the phone was sitting still, or sensors were not available at the time.';
      } else {
        html += 'no exchanges carry physical sensor data. The phone has not recorded any motion, gravity, or air pressure during exchanges.';
      }
      html += '</div>';
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-bottom:10px;">';
      html += '<strong style="color:var(--accent);">' + geoPct + '%</strong> carry location data \u2014 ';
      if (geoPct >= 80) {
        html += 'exchanges are happening in real, locatable places. The phone knows where it is.';
      } else if (geoPct >= 30) {
        html += 'some exchanges have location, some do not. The person may have location permissions off sometimes, or may be indoors.';
      } else if (geoPct > 0) {
        html += 'very few exchanges have location. This does not mean the person is not real, but it does mean there is less geographic evidence to work with.';
      } else {
        html += 'no exchanges have location data. The person may not have granted location permission.';
      }
      html += '</div>';
      if (dev.pohSnapshots > 0) {
        html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">';
        html += '<strong style="color:var(--accent);">' + dev.pohSnapshots + '</strong> proof-of-human snapshot' + (dev.pohSnapshots > 1 ? 's' : '') + ' \u2014 ';
        if (dev.pingRecords > 0) {
          html += '<strong style="color:var(--accent);">' + dev.pingRecords + '</strong> standalone heartbeat' + (dev.pingRecords > 1 ? 's' : '') + ' between exchanges. ';
          html += 'The phone proved it exists in the physical world at unpredictable intervals, independent of any exchange.';
        } else {
          html += 'periodic check-ins where the phone proved it exists in the physical world, independent of any exchange.';
        }
        html += '</div>';
      }
    }
    // --- Heartbeat drift analysis ---
    var deltas = ts._deltas;
    if (deltas && deltas.length > 0) {
      html += '<div style="font-size:14px; font-weight:500; color:var(--text); margin:16px 0 8px;">Heartbeat drift</div>';
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">';
      var identicalCount = 0;
      deltas.forEach(function(d) {
        if (d.gpsIdentical) identicalCount++;
        if (d.sensorIdentical) identicalCount++;
        if (d.batteryIdentical && d.gapMin > 2) identicalCount++;
      });
      if (identicalCount === 0 && deltas.length > 0) {
        html += '<span style="color:var(--green);">\u2713</span> Across <strong style="color:var(--accent);">' + deltas.length + '</strong> heartbeat-to-exchange pair' + (deltas.length > 1 ? 's' : '') + ', ';
        html += 'the phone shows natural drift \u2014 GPS shifts, battery drains, sensor readings change. This is what a real phone in a real hand looks like.';
      } else if (identicalCount > 0) {
        html += '<span style="color:var(--red);">\u26a0</span> <strong style="color:var(--red);">' + identicalCount + '</strong> identical reading' + (identicalCount > 1 ? 's' : '') + ' between heartbeat and exchange. ';
        html += 'Real phones produce different readings minutes apart. Identical readings suggest a device that didn\u2019t move.';
      }
      html += '</div>';
    }
    // --- Counterparty platform distribution ---
    var plat = ts._platforms;
    if (plat && plat.total > 0) {
      html += '<div style="font-size:14px; font-weight:500; color:var(--text); margin:16px 0 8px;">Counterparty devices</div>';
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.7;">';
      var platEntries = Object.entries(plat.platforms).sort(function(a,b) { return b[1] - a[1]; });
      platEntries.forEach(function(e) {
        var pct = Math.round(e[1] / plat.total * 100);
        html += '<strong style="color:var(--accent);">' + e[0] + '</strong>: ' + e[1] + ' (' + pct + '%) \u00b7 ';
      });
      html = html.replace(/ \u00b7 $/, '');
      if (plat.identicalSensorHash > 0) {
        html += '<div style="margin-top:6px; color:var(--red);"><span>\u26a0</span> <strong>' + plat.identicalSensorHash + '</strong> exchange' + (plat.identicalSensorHash > 1 ? 's' : '') + ' where both devices produced identical sensor readings. Real phones in different hands produce different physics.</div>';
      }
      html += '</div>';
    }
    return html;
  }

  // --- Delta analysis: ping-to-exchange drift ---
  function analyzePingDeltas(chain) {
    var deltas = [];
    for (var i = 0; i < chain.length - 1; i++) {
      if (chain[i].type !== HCP.RECORD_TYPE_PING) continue;
      // Find the next non-ping record
      var ping = chain[i];
      var next = null;
      for (var j = i + 1; j < chain.length; j++) {
        if (chain[j].type !== HCP.RECORD_TYPE_PING) { next = chain[j]; break; }
      }
      if (!next) continue;
      var gap = Math.abs(new Date(next.timestamp).getTime() - new Date(ping.timestamp).getTime());
      var d = { gapMs: gap, gapMin: Math.round(gap / 60000) };
      // GPS drift
      if (ping.geo && next.geo) {
        var dlat = Math.abs(ping.geo.lat - next.geo.lat);
        var dlng = Math.abs(ping.geo.lng - next.geo.lng);
        d.gpsDrift = Math.round(Math.sqrt(dlat * dlat + dlng * dlng) * 111000); // rough meters
        d.gpsIdentical = (dlat < 0.000001 && dlng < 0.000001);
      }
      // Sensor hash comparison
      if (ping.sensorHash && next.sensorHash) {
        d.sensorIdentical = (ping.sensorHash === next.sensorHash);
      }
      // Battery drift
      var pingBat = ping.pohSnapshot && ping.pohSnapshot.batteryState;
      var nextBat = next.pohSnapshot && next.pohSnapshot.batteryState;
      if (pingBat && nextBat && typeof pingBat.level === 'number' && typeof nextBat.level === 'number') {
        d.batteryDelta = Math.round((nextBat.level - pingBat.level) * 10000) / 100; // percent change
        d.batteryIdentical = (Math.abs(d.batteryDelta) < 0.01);
      }
      deltas.push(d);
    }
    return deltas;
  }

  // --- Cross-device platform distribution ---
  function analyzeCounterpartyPlatforms(chain) {
    var platforms = {};
    var total = 0;
    var hasSensorHash = 0, identicalHash = 0;
    chain.forEach(function(r) {
      if (r.type === HCP.RECORD_TYPE_PING) return;
      if (r.counterpartyPlatform) {
        var p = r.counterpartyPlatform;
        // Simplify platform string
        if (p.indexOf('iPhone') >= 0 || p.indexOf('iPad') >= 0 || p.indexOf('iOS') >= 0) p = 'iOS';
        else if (p.indexOf('Linux arm') >= 0 || p.indexOf('Android') >= 0) p = 'Android';
        else if (p.indexOf('Win') >= 0) p = 'Windows';
        else if (p.indexOf('Mac') >= 0) p = 'macOS';
        platforms[p] = (platforms[p] || 0) + 1;
        total++;
      }
      if (r.counterpartySensorHash && r.sensorHash) {
        hasSensorHash++;
        if (r.counterpartySensorHash === r.sensorHash) identicalHash++;
      }
    });
    return { platforms: platforms, total: total, hasSensorHash: hasSensorHash, identicalSensorHash: identicalHash };
  }

  function exDetailCategories(ts) {
    var cats = ts.cats || {};
    var keys = Object.keys(cats);
    if (!keys.length) return '<div style="font-size:13px; color:var(--text-faint);">No category data available.</div>';
    var html = '';
    Object.entries(cats).sort(function(a,b) { return b[1].n - a[1].n; }).forEach(function(e) {
      var k = e[0], v = e[1];
      var pct = Math.round(v.n / ts.n * 100);
      html += '<div style="margin-bottom:14px;">';
      html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;">';
      html += '<span style="font-size:14px; font-weight:500; color:var(--text);">' + esc(k) + '</span>';
      html += '<span style="font-size:12px; color:var(--text-faint);">' + v.n + ' acts \u00b7 ' + pct + '%</span>';
      html += '</div>';
      html += '<div style="height:5px; background:var(--bg-input); border-radius:3px; overflow:hidden;">';
      html += '<div style="height:100%; width:' + pct + '%; background:var(--accent); border-radius:3px;"></div>';
      html += '</div>';
      html += '<div style="font-size:12px; color:var(--text-faint); margin-top:3px;">provided ' + v.g + ' \u00b7 received ' + v.r + ' \u00b7 avg ' + (v.avg || 0) + ' units</div>';
      html += '</div>';
    });
    return html;
  }

  function exDetailObservations(ts) {
    var cl = exClassifyChain(ts);
    if (!cl.observations.length) return '<div style="font-size:13px; color:var(--text-faint);">No specific observations.</div>';
    var html = '';
    cl.observations.forEach(function(obs) {
      html += '<div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--border);">';
      html += '<span style="color:var(--accent); font-size:14px; flex-shrink:0; margin-top:2px;">&#9679;</span>';
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">' + obs.text + '</div>';
      html += '</div>';
    });
    return html;
  }

  function exDetailQuestions(items) {
    var html = '';
    items.forEach(function(item) {
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-size:14px; font-weight:500; color:var(--text); margin-bottom:6px;">' + item.q + '</div>';
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">' + item.a + '</div>';
      html += '</div>';
    });
    return html;
  }

  function exDetailNonhumanSignals(dev) {
    var html = '';
    var webgl = dev.webgl || '';
    if (exIsEmulator(dev)) {
      html += '<div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:14px;">';
      html += '<span style="color:var(--red); font-size:14px; flex-shrink:0; margin-top:2px;">&#9679;</span>';
      html += '<div><div style="font-size:13px; color:var(--text); font-weight:500; margin-bottom:4px;">This is not a real phone</div>';
      html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">The graphics chip in this device is software pretending to be hardware. Real phones have physical chips made by companies like Qualcomm, ARM, or Apple. This device reports: ' + esc(webgl) + '. This is the signature of an emulator or virtual machine \u2014 a program that imitates a phone without being one.</div></div>';
      html += '</div>';
    }
    if (dev.touchPoints === 0) {
      html += '<div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:14px;">';
      html += '<span style="color:var(--red); font-size:14px; flex-shrink:0; margin-top:2px;">&#9679;</span>';
      html += '<div><div style="font-size:13px; color:var(--text); font-weight:500; margin-bottom:4px;">No touch screen</div>';
      html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">Every smartphone has a touch screen. This device reports zero touch capability. That means it is either a desktop computer, a server, or a virtual machine. None of those are phones that a person carries and uses in daily life.</div></div>';
      html += '</div>';
    }
    if (dev.totalRecords >= 5 && dev.recordsWithSensor === 0) {
      html += '<div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:14px;">';
      html += '<span style="color:var(--red); font-size:14px; flex-shrink:0; margin-top:2px;">&#9679;</span>';
      html += '<div><div style="font-size:13px; color:var(--text); font-weight:500; margin-bottom:4px;">No physical reality in any exchange</div>';
      html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">Across ' + dev.totalRecords + ' exchanges, this device has never recorded any motion, gravity, air pressure, or orientation. A real phone constantly feels the world around it \u2014 every tilt, every step, every change in altitude or weather. This phone appears to exist in a place where none of that happens.</div></div>';
      html += '</div>';
    }
    if (!html) {
      html = '<div style="font-size:13px; color:var(--text-faint);">Device signals flagged during classification.</div>';
    }
    return html;
  }

  function exDetailDeviceSignals(dev) {
    var html = '';
    html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-bottom:12px;">These are the physical characteristics of the device on the other end of this exchange. Each one tells you something about whether this is a real phone in a real person\u2019s hand.</div>';
    // Platform
    html += '<div style="padding:10px 0; border-bottom:1px solid var(--border);">';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:13px; color:var(--text-faint);">Platform</span><span style="font-size:13px; color:var(--text); font-family:var(--font-mono);">' + esc(dev.platform || '\u2014') + '</span></div>';
    html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">The operating system. Android and iOS are phones. Linux or Win32 is a computer.</div>';
    html += '</div>';
    // Screen
    html += '<div style="padding:10px 0; border-bottom:1px solid var(--border);">';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:13px; color:var(--text-faint);">Screen</span><span style="font-size:13px; color:var(--text); font-family:var(--font-mono);">' + esc(dev.screen || '\u2014') + '</span></div>';
    html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">The screen resolution. Phone screens are typically narrow and tall. Very large or square resolutions suggest a desktop monitor.</div>';
    html += '</div>';
    // Touch points
    html += '<div style="padding:10px 0; border-bottom:1px solid var(--border);">';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:13px; color:var(--text-faint);">Touch points</span><span style="font-size:13px; color:var(--text); font-family:var(--font-mono);">' + (dev.touchPoints != null ? '' + dev.touchPoints : '\u2014') + '</span></div>';
    html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">How many fingers the screen can detect at once. Phones report 5 or more. Zero means no touch screen at all.</div>';
    html += '</div>';
    // GPU
    html += '<div style="padding:10px 0; border-bottom:1px solid var(--border);">';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:13px; color:var(--text-faint);">Graphics chip</span><span style="font-size:13px; color:var(--text); font-family:var(--font-mono); max-width:60%; text-align:right; word-break:break-word;">' + esc(dev.webgl || '\u2014') + '</span></div>';
    html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">The hardware that draws the screen. Real phones have chips from Qualcomm (Adreno), ARM (Mali), or Apple. Software renderers like SwiftShader or llvmpipe mean the device is simulated.</div>';
    html += '</div>';
    if (dev.totalRecords > 0) {
      var sensorPct = Math.round(dev.recordsWithSensor / dev.totalRecords * 100);
      var geoPct = Math.round(dev.recordsWithGeo / dev.totalRecords * 100);
      html += '<div style="margin-top:12px; font-size:13px; color:var(--text-dim); line-height:1.6;">';
      html += 'Sensor coverage: <strong style="color:var(--accent);">' + sensorPct + '%</strong> \u00b7 Location: <strong style="color:var(--accent);">' + geoPct + '%</strong>';
      if (dev.pohSnapshots > 0) html += ' \u00b7 Proof-of-human: <strong style="color:var(--accent);">' + dev.pohSnapshots + '</strong>';
      if (dev.pingRecords > 0) html += ' (' + dev.pingRecords + ' heartbeat' + (dev.pingRecords > 1 ? 's' : '') + ')';
      html += '</div>';
    }
    return html;
  }

  // =====================================================
  // MAIN TEXTURE RENDER — Four states
  // =====================================================

  function exRenderTexture() {
    var container = document.getElementById('ex-texture-content');
    if (!sessionPartner) {
      container.innerHTML = '<div class="empty-state">No partner data available.</div>';
      return;
    }

    var ts = sessionPartner.thread_snapshot;
    if (typeof ts === 'string') { try { ts = JSON.parse(ts); } catch(e) {} }
    _textureTs = ts; // stash for detail views
    var name = (ts && ts._name) || 'This person';
    var dev = (ts && ts._device) || {};
    var html = '';

    // --- Brand new participant (zero records) ---
    if (!ts || !ts.n) {
      var cl = ts ? exClassifyChain(ts) : { state: 'young', observations: [] };
      // Check non-human even on empty chain
      if (cl.state === 'nonhuman') {
        html += exRenderNonhuman(ts, name, dev, cl);
      } else {
        html += exRenderNew(ts, name, dev);
      }
      container.innerHTML = html;
      return;
    }

    // --- Classify ---
    var cl = exClassifyChain(ts);

    if (cl.state === 'nonhuman') {
      html = exRenderNonhuman(ts, name, dev, cl);
    } else if (cl.state === 'young') {
      html = exRenderYoung(ts, name, dev, cl);
    } else if (cl.state === 'unusual') {
      html = exRenderUnusual(ts, name, dev, cl);
    } else {
      html = exRenderHealthy(ts, name, dev, cl);
    }

    container.innerHTML = html;
  }

  // --- State: Brand new (0 records, real device) ---
  function exRenderNew(ts, name, dev) {
    var html = '<div style="padding:16px; background:rgba(42,90,143,0.04); border:1px solid rgba(42,90,143,0.12); border-radius:var(--radius); overflow:hidden;">';
    html += '<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">';
    html += '<span style="font-size:18px; color:var(--blue);">&#9679;</span>';
    html += '<div style="font-size:15px; font-weight:600; color:var(--blue);">New participant</div>';
    html += '</div>';
    html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">';
    html += esc(name) + ' has no exchange history yet. Everyone starts somewhere.';
    html += '</div>';
    // Device check even on new
    if (dev.touchPoints > 0 && !exIsEmulator(dev)) {
      html += '<div style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:12px; color:var(--text-faint);">';
      html += '<span style="color:var(--green);">&#10003;</span> Real phone';
      html += '</div>';
    }
    html += '</div>';
    // Detail links
    html += '<div style="padding:0 4px;">';
    html += exDetailLink('&#9679;', 'Learn what makes a chain young', 'young-thin');
    html += exDetailLink('&#9679;', 'Why network depth matters', 'young-depth');
    html += exDetailLink('&#9679;', 'Questions to consider asking this person', 'young-questions');
    if (dev.webgl || dev.platform) {
      html += exDetailLink('&#9679;', 'View device details', 'device-signals');
    }
    html += '</div>';
    return html;
  }

  // --- State: Young ---
  function exRenderYoung(ts, name, dev, cl) {
    var html = '<div style="padding:16px; background:rgba(42,90,143,0.04); border:1px solid rgba(42,90,143,0.12); border-radius:var(--radius); overflow:hidden;">';
    html += '<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">';
    html += '<span style="font-size:18px; color:var(--blue);">&#9679;</span>';
    html += '<div style="font-size:15px; font-weight:600; color:var(--blue);">This chain is young.</div>';
    html += '</div>';
    html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">';
    html += esc(name) + ' has ' + ts.n + ' exchange' + (ts.n > 1 ? 's' : '') + ' on record. What is here looks genuine \u2014 the chain just has not had time to build depth yet.';
    html += '</div>';

    // Observations within young
    if (cl.observations.length > 0) {
      html += '<div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(42,90,143,0.12);">';
      cl.observations.forEach(function(obs) {
        html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5; margin-bottom:4px;">\u2022 ' + obs.text + '</div>';
      });
      html += '</div>';
    }

    // Cooperation bar
    html += exCoopBar(ts.g, ts.r);

    // Device confirmation
    if (dev.touchPoints > 0 && !exIsEmulator(dev)) {
      html += '<div style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:12px; color:var(--text-faint);">';
      html += '<span style="color:var(--green);">&#10003;</span> Real phone';
      html += '</div>';
    }

    html += '</div>';

    // Detail links
    html += '<div style="padding:0 4px;">';
    html += exDetailLink('&#9679;', 'Learn what makes a chain young', 'young-thin');
    html += exDetailLink('&#9679;', 'Why network depth matters', 'young-depth');
    html += exDetailLink('&#9679;', 'Questions to consider asking this person', 'young-questions');
    if (dev.webgl || dev.platform) {
      html += exDetailLink('&#9679;', 'View device details', 'device-signals');
    }
    html += '</div>';
    return html;
  }

  // --- State: Unusual ---
  function exRenderUnusual(ts, name, dev, cl) {
    var months = '';
    if (ts.t0) {
      var m = Math.round((Date.now() - new Date(ts.t0).getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (m >= 1) months = ' over ' + m + ' month' + (m > 1 ? 's' : '');
    }
    var html = '<div style="padding:16px; background:rgba(42,90,143,0.04); border:1px solid rgba(42,90,143,0.12); border-radius:var(--radius); overflow:hidden;">';
    html += '<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">';
    html += '<span style="font-size:18px; color:var(--accent);">&#9888;</span>';
    html += '<div style="font-size:15px; font-weight:600; color:var(--accent);">Some things here are unusual.</div>';
    html += '</div>';
    html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">';
    html += esc(name) + ' has ' + ts.n + ' exchanges' + months + '. ';
    html += 'This person may be perfectly honest, but some patterns do not match what you would typically see. It is worth understanding what you are looking at before you proceed.';
    html += '</div>';

    // Cooperation bar
    html += exCoopBar(ts.g, ts.r);

    html += '</div>';

    // Detail links
    html += '<div style="padding:0 4px;">';
    html += exDetailLink('&#9679;', 'Learn what caught our attention', 'unusual-attention', true);
    html += exDetailLink('&#9679;', 'What this means for you if you choose to transact', 'unusual-means');
    html += exDetailLink('&#9679;', 'Questions to consider asking this person', 'unusual-questions');
    html += exDetailLink('&#9679;', 'Learn how gaming the system works \u2014 and what it costs', 'unusual-gaming');
    if (dev.webgl || dev.platform) {
      html += exDetailLink('&#9679;', 'View device details', 'device-signals');
    }
    html += '</div>';
    return html;
  }

  // --- State: Non-human ---
  function exRenderNonhuman(ts, name, dev, cl) {
    var html = '<div style="padding:16px; background:rgba(204,68,68,0.04); border:1px solid rgba(204,68,68,0.15); border-radius:var(--radius); overflow:hidden;">';
    html += '<div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:8px;">';
    html += '<span style="font-size:18px; color:var(--red); flex-shrink:0; margin-top:2px;">&#10006;</span>';
    html += '<div style="font-size:15px; font-weight:600; color:var(--red); line-height:1.4;">This person is using a device that does not behave like a normal phone.</div>';
    html += '</div>';
    html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">';
    html += 'The person you are dealing with may be real, but the device they are holding is not behaving the way any normal person\u2019s phone would. Multiple signals point to a simulated or automated device.';
    html += '</div>';
    html += '</div>';

    // Detail links
    html += '<div style="padding:0 4px;">';
    html += exDetailLink('&#9679;', 'Learn what makes this non-human', 'nonhuman-what', true);
    html += exDetailLink('&#9679;', 'What this means for you if you choose to transact', 'nonhuman-means');
    html += exDetailLink('&#9679;', 'Questions to consider asking this person', 'nonhuman-questions');
    html += exDetailLink('&#9679;', 'How fabricated chains extract from communities', 'nonhuman-extract');
    html += exDetailLink('&#9679;', 'View device details', 'device-signals');
    html += '</div>';
    return html;
  }

  function exContinueFromTexture() {
    if (sessionRole === 'proposer') {
      showExStep('form');
      document.getElementById('exchange-header').textContent = 'Set up the exchange';
      // Reset form fields
      document.getElementById('ex-desc').value = '';
      document.getElementById('ex-value').value = '';
      document.getElementById('ex-category').value = '';
      var durEl = document.getElementById('ex-duration');
      if (durEl) durEl.value = '';
      document.getElementById('ex-hours').value = '';
      document.getElementById('ex-minutes').value = '';
      document.getElementById('ex-city').value = '';
      document.getElementById('ex-state').value = '';
      // Render category pills
      exRenderCategoryPills('');
      // Clear pricing context
      var ctx = document.getElementById('ex-pricing-context');
      if (ctx) ctx.innerHTML = '';
      // Set partner label
      var partnerSnap = null;
      if (sessionPartner && sessionPartner.thread_snapshot) {
        partnerSnap = typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot;
      }
      var partnerName = (partnerSnap && partnerSnap._name) || 'the other person';
      var labelEl = document.getElementById('ex-form-partner-label');
      if (labelEl) labelEl.innerHTML = 'Describe the exchange with <strong style="color:var(--text);">' + esc(partnerName) + '</strong>';
      // Apply prefill from "Use previous" if available
      if (window._fabPrefill) {
        var pf = window._fabPrefill;
        if (pf.description) document.getElementById('ex-desc').value = pf.description;
        if (pf.value) document.getElementById('ex-value').value = pf.value;
        if (pf.category) {
          document.getElementById('ex-category').value = pf.category;
          exRenderCategoryPills(pf.category);
          exRenderPricingContext(pf.category);
        }
        if (pf.duration && durEl) {
          var pfHrs = Math.floor(pf.duration / 60);
          var pfMins = pf.duration % 60;
          var durText = '';
          if (pfHrs) durText += pfHrs + ' hour' + (pfHrs > 1 ? 's' : '');
          if (pfMins) durText += (durText ? ' ' : '') + pfMins + ' min';
          durEl.value = durText;
        }
        setDirection(pf.energyState || 'provided');
        showPrefillBar(pf.description || pf.category || 'Previous exchange');
        window._fabPrefill = null;
      }
      // Inject back link above the form
      var formStep = document.getElementById('ex-step-form');
      var oldBack = document.getElementById('ex-form-back');
      if (oldBack) oldBack.remove();
      var oldReuse = document.getElementById('ex-reusable-acts');
      if (oldReuse) oldReuse.remove();
      var backLink = document.createElement('div');
      backLink.id = 'ex-form-back';
      backLink.style.cssText = 'font-size:13px; color:var(--text-faint); cursor:pointer; margin-bottom:12px;';
      backLink.textContent = '\u2190 Review their chain';
      backLink.addEventListener('click', function() { App.exBackToTexture(); });
      if (formStep) formStep.insertBefore(backLink, formStep.firstChild);
      exRenderReusableActs();
    } else {
      showExStep('receiver-wait');
      exRenderReceiverWait();
      sessionSetState('awaiting_proposal');
      startSessionPoll();
    }
  }

  function exBackToTexture() {
    exRenderTexture();
    showExStep('texture');
  }

  // === REUSABLE ACTS IN FORM STEP ===
  function exRenderReusableActs() {
    var target = document.getElementById('ex-prefill-bar');
    if (!target) return;
    if (!state.chain.length) return;

    // Group acts by description
    var actMap = {};
    state.chain.forEach(function(r) {
      var key = (r.description || '').trim().toLowerCase();
      if (!key) return;
      if (!actMap[key]) {
        actMap[key] = { description: r.description, category: r.category, value: r.value, energyState: r.energyState, duration: r.duration, count: 0, lastUsed: r.timestamp };
      }
      actMap[key].count++;
      if (r.timestamp > actMap[key].lastUsed) {
        actMap[key].value = r.value;
        actMap[key].energyState = r.energyState;
        actMap[key].category = r.category;
        actMap[key].duration = r.duration;
        actMap[key].lastUsed = r.timestamp;
      }
    });

    var acts = Object.values(actMap).sort(function(a, b) { return b.count - a.count; });
    if (!acts.length) return;

    // Build reusable acts section before the form
    var container = document.createElement('div');
    container.id = 'ex-reusable-acts';
    container.style.cssText = 'margin-bottom:16px;';
    var hdr = document.createElement('div');
    hdr.style.cssText = 'font-size:13px; color:var(--text-dim); margin-bottom:8px;';
    hdr.textContent = 'Repeat a previous act';
    container.appendChild(hdr);

    acts.slice(0, 6).forEach(function(act) {
      var card = document.createElement('div');
      card.className = 'coop-act';
      var dir = act.energyState === 'provided' ? '\u2191' : '\u2193';
      var dirColor = act.energyState === 'provided' ? 'rgba(43,140,62,0.15)' : 'rgba(204,68,68,0.15)';
      var dirTextColor = act.energyState === 'provided' ? 'var(--green)' : 'var(--red)';
      var meta = [];
      if (act.category) meta.push(esc(act.category));
      if (act.count > 1) meta.push(act.count + ' times');
      card.innerHTML =
        '<div class="coop-act-icon" style="background:' + dirColor + '; color:' + dirTextColor + ';">' + dir + '</div>' +
        '<div class="coop-act-info">' +
          '<div class="coop-act-desc">' + esc(act.description) + '</div>' +
          (meta.length ? '<div class="coop-act-meta">' + meta.join(' \u00b7 ') + '</div>' : '') +
        '</div>' +
        '<div class="coop-act-val">' + act.value + '</div>';
      card.addEventListener('click', function() {
        setDirection(act.energyState);
        document.getElementById('ex-desc').value = act.description || '';
        document.getElementById('ex-value').value = act.value || '';
        document.getElementById('ex-category').value = act.category || '';
        if (act.category) {
          exRenderCategoryPills(act.category);
          exRenderPricingContext(act.category);
        }
        if (act.duration) {
          var durEl = document.getElementById('ex-duration');
          if (durEl) {
            var dh = Math.floor(act.duration / 60);
            var dm = act.duration % 60;
            var dt = '';
            if (dh) dt += dh + ' hour' + (dh > 1 ? 's' : '');
            if (dm) dt += (dt ? ' ' : '') + dm + ' min';
            durEl.value = dt;
          }
        }
        showPrefillBar(act.description || 'Previous act');
        // Remove the reusable acts section
        var el = document.getElementById('ex-reusable-acts');
        if (el) el.remove();
      });
      container.appendChild(card);
    });

    // Insert before the direction toggle
    var formStep = document.getElementById('ex-step-form');
    var dirToggle = document.getElementById('dir-toggle');
    if (formStep && dirToggle) {
      formStep.insertBefore(container, dirToggle);
    }
  }

  function exSelectRole(role) {
    // Legacy -- kept for backward compatibility
    if (role === 'provider') {
      sessionRole = 'proposer';
      showExStep('form');
      document.getElementById('exchange-header').textContent = 'Set up the exchange';
      document.getElementById('ex-desc').value = '';
      document.getElementById('ex-value').value = '';
      document.getElementById('ex-category').value = '';
      var durEl = document.getElementById('ex-duration');
      if (durEl) durEl.value = '';
      document.getElementById('ex-hours').value = '';
      document.getElementById('ex-minutes').value = '';
      document.getElementById('ex-city').value = '';
      document.getElementById('ex-state').value = '';
      exRenderCategoryPills('');
    } else {
      sessionRole = 'confirmer';
      showExStep('receiver-wait');
      exRenderReceiverWait();
      startSessionPoll();
    }
  }

  function exViewProposal() {
    exShowProposalReady();
  }

  function exRenderReceiverWait() {
    // Reset proposal area
    var proposalEl = document.getElementById('ex-rw-proposal');
    if (proposalEl) { proposalEl.style.display = 'none'; proposalEl.innerHTML = ''; }
    var spinnerEl = document.getElementById('ex-rw-spinner');
    if (spinnerEl) spinnerEl.style.display = 'block';
    var cancelEl = document.getElementById('ex-rw-cancel');
    if (cancelEl) { cancelEl.textContent = 'Cancel exchange'; cancelEl.onclick = function() { App.closeExchange(); }; }

    var ts = sessionPartner ? sessionPartner.thread_snapshot : null;
    if (typeof ts === 'string') { try { ts = JSON.parse(ts); } catch(e) {} }
    var name = (ts && ts._name) || 'the other person';

    // Update spinner label
    var spinLabel = document.getElementById('ex-rw-spinner-label');
    if (spinLabel) spinLabel.textContent = 'Waiting for ' + name + '\'s proposal';

    var tilesEl = document.getElementById('ex-rw-tiles');
    if (!tilesEl) return;

    // Counterparty context block — chain shape card + POH verdict card.
    // Replaces the legacy "Their Pricing" + "Chain Health" tiles that
    // lived here before v2.53.0. Renders while the user waits for the
    // proposer to submit their proposal. When the proposal arrives,
    // exShowProposalReady renders into ex-rw-proposal below but does
    // NOT re-render this block — it stays visible above the proposal
    // card so the user has the full "about them" context throughout.
    var html = '';
    if (ts) {
      try { html += renderCounterpartyContextBlock(ts); } catch(cpe) {
        console.log('[ex-flow] Counterparty context render failed on wait:', cpe.message);
      }
    }
    tilesEl.innerHTML = html;
  }

  function exShowProposalReady() {
    if (!sessionProposal) return;

    var p = sessionProposal;
    var proposedValue = p.value;
    var serviceDesc = (p.description || '').trim();
    var serviceKey = serviceDesc.toLowerCase();
    var serviceCat = (p.category || '').trim();

    // Get partner info
    var providerSnap = null;
    if (sessionPartner && sessionPartner.thread_snapshot) {
      providerSnap = typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot;
    }
    var providerName = (providerSnap && providerSnap._name) || 'Partner';
    var provSvc = null;
    if (providerSnap && providerSnap._services && providerSnap._services[serviceKey]) {
      provSvc = providerSnap._services[serviceKey];
    }

    // Hide spinner
    var spinnerEl = document.getElementById('ex-rw-spinner');
    if (spinnerEl) spinnerEl.style.display = 'none';

    // Pulse the Exchange step in the progress bar
    var indicator = document.getElementById('ex4-indicator');
    if (indicator) {
      var step3 = indicator.querySelector('[data-step="3"]');
      if (step3) step3.classList.add('notify');
    }

    // Build proposal card
    var html = '';

    // Counterparty context block — chain shape + POH verdict. While the
    // user was waiting for the proposal, this block lived in ex-rw-tiles
    // above the spinner. Now that the proposal has arrived, re-render it
    // at the TOP of the proposal region so the full decision surface
    // reads in natural order: context \u2192 proposal \u2192 pricing \u2192 buttons.
    // We also hide ex-rw-tiles below to prevent the wait-screen copy
    // from ending up positioned below the Confirm button (the DOM order
    // in index.html places tiles after proposal).
    var rwTiles = document.getElementById('ex-rw-tiles');
    if (rwTiles) rwTiles.style.display = 'none';
    try {
      if (providerSnap) {
        html += renderCounterpartyContextBlock(providerSnap);
      }
    } catch(cpe) {
      console.log('[ex-flow] Counterparty context render failed on proposal:', cpe.message);
    }

    html += '<div style="font-size:15px; color:var(--text-dim); margin-bottom:12px;"><strong style="color:var(--text);">' + esc(providerName) + '</strong> is proposing this exchange</div>';

    html += '<div style="background:var(--bg-raised,#fff); border:1px solid var(--border); border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,0.06); padding:16px; margin-bottom:12px;">';

    // Direction badges
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    if (p.direction === 'provided') {
      html += '<span style="font-size:12px; font-weight:600; padding:4px 10px; border-radius:12px; background:rgba(43,140,62,0.08); color:var(--green);">They provided</span>';
      html += '<span style="font-size:12px; color:var(--text-faint);">You received</span>';
    } else {
      html += '<span style="font-size:12px; font-weight:600; padding:4px 10px; border-radius:12px; background:rgba(42,90,143,0.08); color:var(--accent);">They received</span>';
      html += '<span style="font-size:12px; color:var(--text-faint);">You provided</span>';
    }
    html += '</div>';

    // Description
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:12px; color:var(--text-faint); margin-bottom:2px;">What was done</div>';
    html += '<div style="font-size:15px; font-weight:500; color:var(--text);">' + esc(serviceDesc) + '</div>';
    html += '</div>';

    // Category + Duration
    html += '<div style="display:flex; gap:16px; margin-bottom:12px;">';
    if (serviceCat) {
      html += '<div><div style="font-size:12px; color:var(--text-faint); margin-bottom:2px;">Category</div>';
      html += '<div style="font-size:14px; color:var(--text);">' + esc(serviceCat) + '</div></div>';
    }
    if (p.duration) {
      var dH = Math.floor(p.duration / 60);
      var dM = p.duration % 60;
      var dStr = '';
      if (dH) dStr += dH + ' hour' + (dH > 1 ? 's' : '');
      if (dM) dStr += (dStr ? ' ' : '') + dM + ' min';
      html += '<div><div style="font-size:12px; color:var(--text-faint); margin-bottom:2px;">Duration</div>';
      html += '<div style="font-size:14px; color:var(--text);">' + esc(dStr) + '</div></div>';
    }
    html += '</div>';

    // Value
    html += '<div style="border-top:1px solid var(--border); padding-top:12px;">';
    html += '<div style="font-size:12px; color:var(--text-faint); margin-bottom:4px;">Proposed value</div>';
    html += '<div style="font-size:28px; font-weight:700; color:var(--accent); font-family:var(--font-mono,monospace);">' + Number(proposedValue).toLocaleString() + '</div>';
    html += '</div>';

    // Pricing context for this specific category
    if (provSvc && provSvc.n > 0 && provSvc.low != null) {
      html += '<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border);">';
      html += '<div style="font-size:11px; font-weight:600; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">';
      html += esc(providerName) + '\'s ' + (serviceCat ? esc(serviceCat.toLowerCase()) : 'service') + ' range</div>';
      html += exRenderRangeBar(provSvc.low, provSvc.high, provSvc.avg, proposedValue);
      var diff = proposedValue - provSvc.avg;
      var pctDiff = provSvc.avg > 0 ? Math.abs(Math.round((diff / provSvc.avg) * 100)) : 0;
      if (pctDiff <= 10) {
        html += '<div style="font-size:11px; color:var(--text-faint);">This value is near their average</div>';
      } else if (proposedValue > provSvc.high) {
        html += '<div style="font-size:11px; color:var(--warning,#e67e22);">This value is above their usual range</div>';
      } else if (proposedValue < provSvc.low) {
        html += '<div style="font-size:11px; color:var(--accent);">This value is below their usual range</div>';
      }
      html += '</div>';
    }

    html += '</div>'; // end card

    // Pricing context time-scatter chart — category-locked, shows my +
    // their + shared history over time with today's proposed value
    // pinned. Complements the service-description range bar above,
    // which matches exact service description; this chart matches the
    // category broadly and adds temporal + relational dimensions.
    //
    // The counterparty context block (chain shape + POH verdict) is
    // NOT re-rendered here. It lives in ex-rw-tiles above the proposal
    // area, populated by exRenderReceiverWait when the wait screen
    // first mounted, and stays visible throughout. Rendering it again
    // here caused duplicate-card stacking below the Confirm button.
    try {
      if (providerSnap && sessionPartner) {
        html += renderPricingContextChart(
          providerSnap,
          p,
          sessionPartner.fingerprint
        );
      }
    } catch(pce) {
      console.log('[ex-flow] Pricing chart render failed:', pce.message);
    }

    // Confirm / reject
    html += '<button class="btn btn-primary" id="btn-session-accept" style="width:100%; margin-bottom:8px;" onclick="App.sessionConfirm()">Confirm exchange</button>';
    html += '<button class="btn btn-secondary" style="width:100%; margin-bottom:8px;" onclick="App.sessionReject()">This doesn\'t look right</button>';

    // Show it
    var proposalEl = document.getElementById('ex-rw-proposal');
    if (proposalEl) {
      proposalEl.innerHTML = html;
      proposalEl.style.display = 'block';
    }

    // Auto-expand the pricing tile for the relevant category
    if (serviceCat) {
      var pricingDetail = document.getElementById('ex-rw-pricing-detail');
      if (pricingDetail) pricingDetail.style.display = 'block';
    }

    // Update cancel button
    var cancelEl = document.getElementById('ex-rw-cancel');
    if (cancelEl) cancelEl.style.display = 'none';
  }

  function exRenderServiceCategory(catName, items, totalCount) {
    var catId = 'svc-cat-' + catName.replace(/[^a-zA-Z0-9]/g, '_');
    var html = '<div style="margin-bottom:2px;">';
    html += '<div style="display:flex; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid var(--border); cursor:pointer;" onclick="App.toggleServiceCat(\'' + catId + '\')">';
    html += '<span class="coop-chevron" id="' + catId + '-chev" style="font-size:12px; color:var(--text-faint); transition:transform 0.2s;">&#9656;</span>';
    html += '<span style="flex:1; font-size:14px; font-weight:500; color:var(--text);">' + esc(catName) + '</span>';
    html += '<span style="font-size:12px; color:var(--text-faint);">' + items.length + ' service' + (items.length > 1 ? 's' : '') + ' \u00b7 ' + totalCount + 'x</span>';
    html += '</div>';

    // Collapsible service list
    html += '<div id="' + catId + '" style="display:none; padding-left:22px;">';
    items.sort(function(a, b) { return b.n - a.n; }).forEach(function(s) {
      html += '<div style="padding:10px 0; border-bottom:1px solid var(--border);">';
      html += '<div style="font-size:13px; color:var(--text); margin-bottom:4px;">' + esc(s.desc) + '</div>';
      html += '<div style="font-size:12px; color:var(--text-faint); line-height:1.5;">';
      if (s.n === 1) {
        html += 'Offered once \u00b7 ' + s.avg + ' units';
      } else {
        html += s.n + ' times \u00b7 ' + s.people + ' people \u00b7 ';
        if (s.low === s.high) {
          html += s.avg + ' units';
        } else {
          html += s.low + '\u2013' + s.high + ' (avg ' + s.avg + ')';
        }
      }
      html += '</div>';
      // Mini price range bar
      if (s.n > 1 && s.low !== s.high) {
        html += '<div style="margin-top:6px; height:4px; background:var(--bg-input); border-radius:2px; overflow:hidden; position:relative;">';
        html += '<div style="position:absolute; left:0; right:0; height:100%; background:var(--accent); opacity:0.3; border-radius:2px;"></div>';
        var avgPct = Math.round(((s.avg - s.low) / (s.high - s.low)) * 100);
        html += '<div style="position:absolute; left:' + Math.max(0, avgPct - 2) + '%; width:4%; min-width:4px; height:100%; background:var(--accent); border-radius:2px;"></div>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function toggleServiceCat(catId) {
    var el = document.getElementById(catId);
    var chev = document.getElementById(catId + '-chev');
    if (!el) return;
    var open = el.style.display !== 'none';
    el.style.display = open ? 'none' : 'block';
    if (chev) chev.style.transform = open ? '' : 'rotate(90deg)';
  }

  function exRenderProposalReview() {
    if (!sessionProposal) return;

    var p = sessionProposal;
    var myDirection = p.direction === 'provided' ? 'received' : 'provided';
    var proposedValue = p.value;
    var serviceDesc = (p.description || '').trim();
    var serviceKey = serviceDesc.toLowerCase();
    var serviceCat = (p.category || '').trim();

    document.getElementById('exchange-header').textContent = 'Review proposal';

    var stepTitle = document.getElementById('ex-receiver-wait-title');
    if (stepTitle) stepTitle.textContent = 'Review their proposal';

    var container = document.getElementById('ex-receiver-wait-content');
    var waitStatus = container.parentElement.querySelector('.pair-status');
    if (waitStatus) waitStatus.style.display = 'none';

    // Get provider's service history from their snapshot
    var providerSnap = null;
    if (sessionPartner && sessionPartner.thread_snapshot) {
      providerSnap = typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot;
    }
    var providerName = (providerSnap && providerSnap._name) || 'Provider';
    var provSvc = null;
    if (providerSnap && providerSnap._services && providerSnap._services[serviceKey]) {
      provSvc = providerSnap._services[serviceKey];
    }

    var html = '';
    html += '<div style="font-size:15px; color:var(--text-dim); margin-bottom:16px;"><strong style="color:var(--text);">' + esc(providerName) + '</strong> is proposing this exchange</div>';

    // Proposal card
    html += '<div style="background:var(--bg-raised,#fff); border:1px solid var(--border); border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,0.06); padding:16px; margin-bottom:16px;">';

    // Direction badges
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
    if (p.direction === 'provided') {
      html += '<span style="font-size:12px; font-weight:600; padding:4px 10px; border-radius:12px; background:rgba(43,140,62,0.08); color:var(--green);">They provided</span>';
      html += '<span style="font-size:12px; color:var(--text-faint);">You received</span>';
    } else {
      html += '<span style="font-size:12px; font-weight:600; padding:4px 10px; border-radius:12px; background:rgba(42,90,143,0.08); color:var(--accent);">They received</span>';
      html += '<span style="font-size:12px; color:var(--text-faint);">You provided</span>';
    }
    html += '</div>';

    // Description
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:12px; color:var(--text-faint); margin-bottom:2px;">What was done</div>';
    html += '<div style="font-size:15px; font-weight:500; color:var(--text);">' + esc(serviceDesc) + '</div>';
    html += '</div>';

    // Category + Duration row
    html += '<div style="display:flex; gap:16px; margin-bottom:12px;">';
    if (serviceCat) {
      html += '<div><div style="font-size:12px; color:var(--text-faint); margin-bottom:2px;">Category</div>';
      html += '<div style="font-size:14px; color:var(--text);">' + esc(serviceCat) + '</div></div>';
    }
    if (p.duration) {
      var dHrs = Math.floor(p.duration / 60);
      var dMin = p.duration % 60;
      var durStr = '';
      if (dHrs) durStr += dHrs + ' hour' + (dHrs > 1 ? 's' : '');
      if (dMin) durStr += (durStr ? ' ' : '') + dMin + ' min';
      html += '<div><div style="font-size:12px; color:var(--text-faint); margin-bottom:2px;">Duration</div>';
      html += '<div style="font-size:14px; color:var(--text);">' + esc(durStr) + '</div></div>';
    }
    html += '</div>';

    // Proposed value
    html += '<div style="border-top:1px solid var(--border); padding-top:12px;">';
    html += '<div style="font-size:12px; color:var(--text-faint); margin-bottom:4px;">Proposed value</div>';
    html += '<div style="font-size:28px; font-weight:700; color:var(--accent); font-family:var(--font-mono,monospace);">' + Number(proposedValue).toLocaleString() + '</div>';
    html += '</div>';

    // Pricing context
    if (provSvc && provSvc.n > 0 && provSvc.low != null) {
      html += '<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border);">';
      html += '<div style="font-size:11px; font-weight:600; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">';
      html += esc(providerName) + '\'s ' + (serviceCat ? esc(serviceCat.toLowerCase()) : 'service') + ' range</div>';
      html += exRenderRangeBar(provSvc.low, provSvc.high, provSvc.avg, proposedValue);
      // Context note
      var diff = proposedValue - provSvc.avg;
      var pctDiff = provSvc.avg > 0 ? Math.abs(Math.round((diff / provSvc.avg) * 100)) : 0;
      if (pctDiff <= 10) {
        html += '<div style="font-size:11px; color:var(--text-faint);">This value is near their average for this category</div>';
      } else if (proposedValue > provSvc.high) {
        html += '<div style="font-size:11px; color:var(--warning,#e67e22);">This value is above their usual range</div>';
      } else if (proposedValue < provSvc.low) {
        html += '<div style="font-size:11px; color:var(--accent);">This value is below their usual range</div>';
      }
      html += '</div>';
    }

    html += '</div>'; // end proposal card

    // Counterparty context block — chain shape + POH verdict, rendered
    // again on the proposal review surface so the decision has the full
    // context present at the moment of choosing. First shown after SAS
    // verification (exConfirmSAS), shown again here for continuity.
    try {
      if (providerSnap) {
        html += renderCounterpartyContextBlock(providerSnap);
      }
    } catch(cpe) {
      console.log('[ex-flow] Counterparty context render failed on proposal:', cpe.message);
    }

    // Pricing context time-scatter chart — category-locked, shows my +
    // their + shared history over time with today's proposed value
    // pinned. Complements (does not replace) the existing service-
    // description range bar above, which is service-granular rather
    // than category-level. Both live together for now.
    try {
      if (providerSnap && sessionPartner) {
        html += renderPricingContextChart(
          providerSnap,
          p,
          sessionPartner.fingerprint
        );
      }
    } catch(pce) {
      console.log('[ex-flow] Pricing context render failed:', pce.message);
    }

    // Confirm / discuss
    html += '<button class="btn btn-primary" id="btn-session-accept" style="width:100%; margin-top:16px; margin-bottom:8px;" onclick="App.sessionConfirm()">Confirm exchange</button>';
    html += '<button class="btn btn-secondary" style="width:100%;" onclick="App.sessionReject()">This doesn\'t look right</button>';

    container.innerHTML = html;
  }

  function exRenderRangeBar(low, high, avg, proposed) {
    if (low == null || high == null) return '';
    var range = high - low || 1;
    var padded = range * 0.4;
    var min = Math.max(0, low - padded);
    var max = high + padded;
    var span = max - min || 1;
    var lowPct = ((low - min) / span) * 100;
    var highPct = ((high - min) / span) * 100;
    var avgPct = ((avg - min) / span) * 100;
    var proposedPct = proposed != null ? Math.min(100, Math.max(0, ((proposed - min) / span) * 100)) : null;
    var proposedColor = proposed > high ? 'var(--red)' : proposed < low ? 'var(--blue)' : 'var(--green)';
    var h = '<div style="margin-bottom:14px;">';
    h += '<div style="position:relative; height:8px; background:var(--bg-input); border-radius:4px;">';
    h += '<div style="position:absolute; left:' + lowPct + '%; width:' + Math.max(1, highPct - lowPct) + '%; top:0; bottom:0; background:rgba(42,90,143,0.2); border-radius:4px;"></div>';
    h += '<div style="position:absolute; left:' + avgPct + '%; top:-4px; width:2px; height:16px; background:var(--accent); border-radius:1px; opacity:0.5;"></div>';
    if (proposedPct != null) {
      h += '<div style="position:absolute; left:calc(' + proposedPct + '% - 1px); top:-6px; width:3px; height:20px; background:' + proposedColor + '; border-radius:2px;"></div>';
    }
    h += '</div>';
    h += '<div style="display:flex; justify-content:space-between; margin-top:4px;">';
    h += '<span style="font-size:10px; font-family:var(--font-mono); color:var(--text-faint);">' + low + '</span>';
    h += '<span style="font-size:10px; font-family:var(--font-mono); color:var(--accent);">avg ' + avg + '</span>';
    h += '<span style="font-size:10px; font-family:var(--font-mono); color:var(--text-faint);">' + high + '</span>';
    h += '</div></div>';
    return h;
  }

  function exTimeAgo(ts) {
    var diff = Date.now() - new Date(ts).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    var weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + 'w ago';
    var months = Math.floor(days / 30);
    return months + 'mo ago';
  }

  // === TAB NAVIGATION ===
  // The Standing tab was removed in v2.58.0 — its content moved into the
  // wallet modal (top-right icon), freeing the primary nav slot for Share.
  // Default here must match the tab marked active in index.html's tab bar.
  var activeTab = 'home';

  function switchTab(tab) {
    activeTab = tab;
    // Close FAB menu when switching tabs
    if (fabOpen) toggleFab();
    document.querySelectorAll('.tab-bar-item').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.tab-content').forEach(function(el) {
      el.classList.toggle('active', el.id === 'tab-' + tab);
    });
    if (tab === 'home') renderHomeTab();
    else if (tab === 'share') renderShareTab();
    else if (tab === 'history') renderHistoryTab();
    else if (tab === 'learn') renderLearnTab();
    else if (tab === 'settings') renderSettingsTab();
  }

  // --- Home tab (default landing surface, v2.59.0) ---
  // Restores a proper landing after the Standing tab was retired and its
  // detail surfaces moved into the wallet modal. The Home tab is
  // intentionally thin: a totals card (provided / received / acts /
  // participation ratio) and the user's recent exchanges with the same
  // filter pills that the full History tab uses. Tapping a row expands
  // it inline, same pattern as History. Anything deeper — identity
  // panel, POH verdict, categories — lives behind the wallet icon at
  // the top of the device.
  function renderHomeTab() {
    var el = document.getElementById('tab-home-content');
    if (!el) return;

    var ex = state.chain.filter(HCP.isAct);
    var totalP = 0, totalR = 0, actsP = 0, actsR = 0;
    ex.forEach(function(r) {
      if (r.energyState === 'provided') { totalP += r.value; actsP++; }
      else if (r.energyState === 'received') { totalR += r.value; actsR++; }
    });
    var totalActs = actsP + actsR;
    var ratioStr;
    if (actsR > 0) ratioStr = (Math.round(actsP / actsR * 10) / 10) + ' : 1';
    else if (actsP > 0) ratioStr = actsP + ' : 0';
    else ratioStr = '\u2014';
    var pPct = totalActs > 0 ? Math.round((actsP / totalActs) * 100) : 0;
    var rPct = totalActs > 0 ? (100 - pPct) : 0;

    var html = '';

    // Totals card — the basic standing numbers Michael asked to keep visible
    // on the landing screen without forcing users into the wallet every time.
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:18px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:14px;">';
    html += '<div style="flex:1; min-width:0;"><div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:0.6px; margin-bottom:3px;">Provided</div><div style="font-size:24px; font-weight:600; color:var(--green);">+' + totalP + '</div><div style="font-size:var(--fs-xs); color:var(--text-faint);">' + actsP + ' act' + (actsP === 1 ? '' : 's') + '</div></div>';
    html += '<div style="flex:1; min-width:0;"><div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:0.6px; margin-bottom:3px;">Received</div><div style="font-size:24px; font-weight:600; color:var(--blue);">\u2212' + totalR + '</div><div style="font-size:var(--fs-xs); color:var(--text-faint);">' + actsR + ' act' + (actsR === 1 ? '' : 's') + '</div></div>';
    html += '</div>';

    // Participation ratio bar — same visual as the wallet's ratio bar so
    // the two read consistently.
    if (totalActs > 0) {
      html += '<div style="display:flex; justify-content:space-between; font-size:var(--fs-xs); color:var(--text-faint); margin-bottom:4px;"><span>participation ratio</span><span style="color:var(--text-dim); font-weight:500;">' + ratioStr + '</span></div>';
      html += '<div style="height:10px; border-radius:5px; overflow:hidden; display:flex; background:var(--bg-input);">';
      if (pPct > 0) html += '<div style="width:' + pPct + '%; background:var(--accent); border-radius:5px 0 0 5px;"></div>';
      if (rPct > 0) html += '<div style="width:' + rPct + '%; background:var(--blue); border-radius:0 5px 5px 0;"></div>';
      html += '</div>';
    } else {
      html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-align:center; padding:4px 0;">No exchanges yet. Tap the + button below to start one.</div>';
    }
    html += '</div>';

    // Recent transactions with filter — only if the chain has any
    if (ex.length > 0) {
      var recent = ex.slice().reverse().slice(0, 8);

      html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">';
      html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px;">Recent exchanges</div>';
      if (ex.length > 8) {
        html += '<span style="font-size:var(--fs-sm); color:var(--accent); cursor:pointer;" onclick="App.switchTab(\'history\')">View all</span>';
      }
      html += '</div>';

      // Filter pills — same data-attribute pattern as History so the filter
      // handler can stay the same. Uses home-specific class so the two
      // filters don't collide visually.
      html += '<div style="display:flex; gap:8px; margin-bottom:12px;">';
      html += '<button class="home-pill hist-pill active" data-home-filter="all" onclick="App.homeFilter(\'all\')">All</button>';
      html += '<button class="home-pill hist-pill" data-home-filter="provided" onclick="App.homeFilter(\'provided\')">Provided</button>';
      html += '<button class="home-pill hist-pill" data-home-filter="received" onclick="App.homeFilter(\'received\')">Received</button>';
      html += '</div>';

      html += '<div id="home-list" style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:0 14px; box-shadow:var(--shadow);">';
      recent.forEach(function(r, idx) {
        var desc = r.description || r.category || 'Exchange';
        var name = state.settings.hideNames ? '' : (r.counterpartyName || (r.counterparty || '').substring(0, 8));
        var ds = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        var isProv = r.energyState === 'provided';
        var valColor = isProv ? 'var(--green)' : 'var(--red)';
        var valSign = isProv ? '+' : '\u2212';
        var bgColor = isProv ? 'var(--green-light)' : 'var(--red-light)';
        var arrowIcon = isProv
          ? '<svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="' + valColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="6" x2="2" y2="6"/><polyline points="6 2 2 6 6 10"/></svg>'
          : '<svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="' + valColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="6" x2="12" y2="6"/><polyline points="8 2 12 6 8 10"/></svg>';
        var personIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + valColor + '" stroke="none"><circle cx="12" cy="7" r="4"/><path d="M12 13c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z"/></svg>';
        var border = idx < recent.length - 1 ? 'border-bottom:1px solid var(--border);' : '';
        html += '<div class="home-row" data-dir="' + r.energyState + '" style="' + border + ' cursor:pointer;" onclick="var d=this.querySelector(\'.home-detail\'); d.style.display=d.style.display===\'block\'?\'none\':\'block\';">';
        html += '<div style="display:flex; align-items:center; gap:12px; padding:14px 0;">';
        html += '<div style="width:42px; height:32px; border-radius:8px; background:' + bgColor + '; display:flex; align-items:center; justify-content:center; gap:2px; flex-shrink:0;">' + arrowIcon + personIcon + '</div>';
        html += '<div style="flex:1; min-width:0;">';
        html += '<div style="font-size:var(--fs-md); font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(desc) + '</div>';
        html += '<div style="font-size:var(--fs-sm); color:var(--text-faint);">' + (name ? esc(name) + ' \u00b7 ' : '') + ds + '</div>';
        html += '</div>';
        html += '<div style="font-size:var(--fs-md); font-weight:600; color:' + valColor + '; white-space:nowrap;">' + valSign + r.value + '</div>';
        html += '</div>';
        // Expandable detail
        html += '<div class="home-detail" style="display:none; padding:0 0 14px 56px; font-size:var(--fs-sm); color:var(--text-dim); line-height:1.8;">';
        if (r.category) html += '<div><span style="color:var(--text-faint);">Category:</span> ' + esc(r.category) + '</div>';
        if (r.duration) html += '<div><span style="color:var(--text-faint);">Duration:</span> ' + formatDuration(r.duration) + '</div>';
        var fullName = r.counterpartyName || '';
        var fpShort = (r.counterparty || '').substring(0, 16);
        if (fullName) html += '<div><span style="color:var(--text-faint);">With:</span> ' + esc(fullName) + '</div>';
        html += '<div><span style="color:var(--text-faint);">Fingerprint:</span> <span style="font-family:var(--font-mono);">' + esc(fpShort) + '</span></div>';
        if (r.witnessAttestation) html += '<div style="color:var(--green);">&#10003; Witness attested</div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:30px 20px; text-align:center; box-shadow:var(--shadow);">';
      html += '<div style="font-size:var(--fs-md); color:var(--text-dim); line-height:1.6;">When you record your first cooperative exchange, it will appear here.</div>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  // Home-tab filter — matches the History-tab pattern but scoped to
  // the home rows only (separate data-attribute so the two filters
  // don't clobber each other).
  function homeFilter(dir) {
    document.querySelectorAll('.home-pill').forEach(function(p) {
      p.classList.toggle('active', p.getAttribute('data-home-filter') === dir);
    });
    document.querySelectorAll('.home-row').forEach(function(row) {
      if (dir === 'all') row.style.display = '';
      else row.style.display = row.getAttribute('data-dir') === dir ? '' : 'none';
    });
  }

  // --- Share tab (replaces the old Standing tab in the bottom bar) ---
  // Standing content moved into the wallet modal; the Share surface took
  // over the primary tab slot. Renders QR code, copy link, and the intro
  // link (referral flow). Same content as the legacy share modal but
  // inline in the tab instead of overlaid.
  function renderShareTab() {
    var el = document.getElementById('tab-share-content');
    if (!el) return;
    var baseUrl = getAppBase();
    var refUrl = baseUrl + '?ref=' + state.fingerprint;

    var html = '';
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Share the protocol</div>';
    html += '<p style="font-size:var(--fs-md); color:var(--text-dim); margin:0 0 18px; line-height:1.5;">Share the Human Exchange Protocol with someone. They\'ll be able to install it on their phone and get started.</p>';
    html += '<div class="share-url" id="share-tab-url" style="margin-bottom:14px;">' + esc(baseUrl) + '</div>';
    html += '<div class="qr-container" style="display:flex; justify-content:center; margin-bottom:16px;"><canvas id="share-tab-qr"></canvas></div>';
    html += '<button class="btn btn-primary" style="width:100%; margin-bottom:8px;" onclick="App.copyShareLink()">Copy link</button>';
    html += '<button class="btn btn-secondary" style="width:100%;" onclick="App.shareViaSystem()">Share via system</button>';
    html += '</div>';

    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Introduce with a first exchange</div>';
    html += '<p style="font-size:var(--fs-md); color:var(--text-dim); margin:0 0 16px; line-height:1.5;">Want to introduce someone with a guided first exchange? Send the link below instead — it includes your identity so they can practice with you.</p>';
    html += '<div class="share-url" style="margin-bottom:14px;">' + esc(refUrl) + '</div>';
    html += '<button class="btn btn-secondary" style="width:100%;" onclick="App.copyShareLinkRef()">Copy introduction link</button>';
    html += '</div>';

    el.innerHTML = html;

    // Render QR asynchronously so the tab switch doesn't block
    try {
      var canvas = document.getElementById('share-tab-qr');
      if (canvas) QR.generate(baseUrl, canvas, 240);
    } catch(e) {
      console.log('[share tab] QR render failed:', e.message);
    }
  }

  // --- Device capabilities for POH rollup ---
  // Reads live _sensor state and browser feature detection to tell the
  // registry what hardware this device has and what the user has enabled.
  function pohDeviceCapabilities() {
    var cap = {
      // Geolocation
      hasGeolocation: ('geolocation' in navigator),
      locationEnabled: !!state.settings.locationAuto,
      liveGeo: _sensor.geo || null,
      // Motion
      hasMotion: ('DeviceMotionEvent' in window) || ('DeviceOrientationEvent' in window),
      motionEnabled: !!state.settings.sensorMotion,
      liveAccel: _sensor.accel || null,
      liveGyro: _sensor.gyro || null,
      // Battery
      hasBattery: ('getBattery' in navigator) && !!_sensor.battery,
      liveBattery: _sensor.battery || null,
      // Network
      hasNetworkInfo: !!(navigator.connection || navigator.mozConnection || navigator.webkitConnection),
      liveNetwork: _sensor.network || null,
      // Ambient light
      hasAmbientLight: ('AmbientLightSensor' in window),
      liveLight: (typeof _sensor.light === 'number') ? _sensor.light : null,
      // Barometric pressure
      hasPressure: ('PressureSensor' in window) || ('Barometer' in window),
      livePressure: (typeof _sensor.pressure === 'number') ? _sensor.pressure : null,
      // WebGL / canvas
      hasWebGL: (function() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch(e) { return false; } })(),
      liveWebGL: getWebGLRenderer(),
      hasCanvas: (function() { try { return !!document.createElement('canvas').getContext('2d'); } catch(e) { return false; } })(),
      liveCanvas: null // canvas hash computed at capture time only
    };
    return cap;
  }

  // --- Proof of Human verdict card renderer ---
  // Context shape: { chain, exchange (optional) }
  // Used on Standing (aggregate) and chain viewer (per-exchange, later).
  function renderPOHVerdict(ctx) {
    var v;
    try { v = POH.rollup(ctx); } catch(e) { console.log('[POH] rollup failed:', e.message); return ''; }
    if (!v) return '';

    // Tone → accent color + icon
    var toneColor = 'var(--text-dim)';
    var toneBg = 'var(--bg-raised)';
    var toneBorder = 'var(--border)';
    var toneIcon = '&#9679;'; // filled circle
    if (v.tone === 'strong') { toneColor = 'var(--green)'; toneBg = 'rgba(43,140,62,0.06)'; toneBorder = 'rgba(43,140,62,0.25)'; toneIcon = '&#10003;'; }
    else if (v.tone === 'partial') { toneColor = '#B45309'; toneBg = 'rgba(180,83,9,0.06)'; toneBorder = 'rgba(180,83,9,0.25)'; toneIcon = '&#9679;'; }
    else if (v.tone === 'weak') { toneColor = 'var(--text-dim)'; toneIcon = '&#9679;'; }
    else if (v.tone === 'alarming') { toneColor = 'var(--red)'; toneBg = 'rgba(214,107,107,0.06)'; toneBorder = 'rgba(214,107,107,0.35)'; toneIcon = '&#9888;'; }

    var h = '';
    h += '<div style="background:' + toneBg + '; border:1px solid ' + toneBorder + '; border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';

    // Level 1 — verdict header (always visible), tappable to toggle list
    h += '<div style="cursor:pointer;" onclick="App.togglePOHSignals(this)">';
    h += '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">';
    h += '<div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">';
    h += '<div style="width:24px; height:24px; border-radius:50%; background:' + toneColor + '; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0;">' + toneIcon + '</div>';
    h += '<div style="min-width:0; flex:1;">';
    h += '<div style="font-size:var(--fs-md); font-weight:600; color:var(--text); line-height:1.3;">' + esc(v.statement) + '</div>';

    // Main data-sources summary. When bonus signals push totalContributing
    // above totalAvailable the old "X of Y available" wording reads as
    // broken math (e.g. "14 of 12"). Separate expected from bonus.
    var mainLine;
    var presentExpected = Math.min(v.countPresentExpected || 0, v.totalAvailable);
    if (v.countBonus > 0) {
      mainLine = 'Drawing from ' + presentExpected + ' of ' + v.totalAvailable + ' expected source' + (v.totalAvailable === 1 ? '' : 's') + ' \u00b7 plus ' + v.countBonus + ' bonus';
    } else {
      mainLine = 'Drawing from ' + v.totalContributing + ' of ' + v.totalAvailable + ' available data source' + (v.totalAvailable === 1 ? '' : 's');
    }
    if (v.countAlarming > 0) mainLine += ' \u00b7 ' + v.countAlarming + ' alarming';
    else if (v.countWorthNoting > 0) mainLine += ' \u00b7 ' + v.countWorthNoting + ' worth noting';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); margin-top:2px;">' + mainLine + '</div>';
    h += '</div></div>';
    h += '<span class="poh-chev" style="font-size:22px; color:var(--accent); transition:transform 0.2s; flex-shrink:0; margin-left:4px; line-height:1;">&#8250;</span>';
    h += '</div></div>';

    // Per-origin breakdown strip (compact, just below header)
    h += '<div style="display:flex; gap:8px; margin-top:12px; font-size:var(--fs-xs);">';
    var bo = v.byOrigin;
    if (bo.device.expected > 0) {
      h += '<div style="flex:1; background:var(--bg-input); border-radius:var(--radius-sm); padding:8px 10px; text-align:center;">';
      h += '<div style="color:var(--text-faint); letter-spacing:0.5px; margin-bottom:2px;">' + renderOriginIcon('device') + ' Device</div>';
      h += '<div style="color:var(--text); font-weight:600;">' + bo.device.contributing + ' / ' + bo.device.expected + '</div>';
      h += '</div>';
    }
    if (bo.external.expected > 0) {
      h += '<div style="flex:1; background:var(--bg-input); border-radius:var(--radius-sm); padding:8px 10px; text-align:center;">';
      h += '<div style="color:var(--text-faint); letter-spacing:0.5px; margin-bottom:2px;">' + renderOriginIcon('external') + ' External</div>';
      h += '<div style="color:var(--text); font-weight:600;">' + bo.external.contributing + ' / ' + bo.external.expected + '</div>';
      h += '</div>';
    }
    if (bo.chain.expected > 0) {
      h += '<div style="flex:1; background:var(--bg-input); border-radius:var(--radius-sm); padding:8px 10px; text-align:center;">';
      h += '<div style="color:var(--text-faint); letter-spacing:0.5px; margin-bottom:2px;">' + renderOriginIcon('chain') + ' Chain</div>';
      h += '<div style="color:var(--text); font-weight:600;">' + bo.chain.contributing + ' / ' + bo.chain.expected + '</div>';
      h += '</div>';
    }
    h += '</div>';

    // Level 2 — full list (hidden by default)
    h += '<div class="poh-signals" style="display:none; margin-top:14px; border-top:1px solid var(--border); padding-top:6px;">';

    // Origin explainer at top of expanded section — each origin on its own line
    h += '<div style="padding:10px 0; border-bottom:1px solid var(--border); margin-bottom:6px;">';
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">How to read these</div>';
    h += '<div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:6px;">';
    h += '<div style="flex-shrink:0; margin-top:1px;">' + renderOriginIcon('device') + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4;"><strong style="color:var(--text);">Device</strong> — hardware on your phone contributes to each record.</div>';
    h += '</div>';
    h += '<div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:6px;">';
    h += '<div style="flex-shrink:0; margin-top:1px;">' + renderOriginIcon('external') + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4;"><strong style="color:var(--text);">External</strong> — data that reaches you from others or from the witness.</div>';
    h += '</div>';
    h += '<div style="display:flex; align-items:flex-start; gap:8px;">';
    h += '<div style="flex-shrink:0; margin-top:1px;">' + renderOriginIcon('chain') + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4;"><strong style="color:var(--text);">Chain</strong> — patterns we observe as your chain grows over time.</div>';
    h += '</div>';
    h += '</div>';

    // Sort signals: origin grouping first (device → external → chain), then
    // within each group, present signals first / absent signals last, then
    // by tier. This makes the top of the list read as "what's working" and
    // dim absent signals get stacked at the bottom of each group —
    // transparent but visually receding.
    var sorted = v.signals.slice().sort(function(a, b) {
      var originOrder = { device: 0, external: 1, chain: 2 };
      var ao = originOrder[a.origin] !== undefined ? originOrder[a.origin] : 9;
      var bo2 = originOrder[b.origin] !== undefined ? originOrder[b.origin] : 9;
      if (ao !== bo2) return ao - bo2;
      // Present first, absent last within each origin group
      var aPresent = a.presence === 'present' ? 0 : 1;
      var bPresent = b.presence === 'present' ? 0 : 1;
      if (aPresent !== bPresent) return aPresent - bPresent;
      return (b.tier || 0) - (a.tier || 0);
    });

    for (var i = 0; i < sorted.length; i++) {
      h += renderPOHSignalRow(sorted[i], i);
    }
    h += '</div>';

    h += '</div>';
    return h;
  }

  // Small icon + color for each origin type
  function renderOriginIcon(origin) {
    if (origin === 'device') return '<span style="display:inline-block; width:14px; text-align:center; color:var(--green); font-weight:600;">&#9670;</span>'; // diamond
    if (origin === 'external') return '<span style="display:inline-block; width:14px; text-align:center; color:#B45309; font-weight:600;">&#9671;</span>'; // hollow diamond
    if (origin === 'chain') return '<span style="display:inline-block; width:14px; text-align:center; color:var(--accent); font-weight:600;">&#9679;</span>'; // dot
    return '<span style="display:inline-block; width:14px;">&nbsp;</span>';
  }

  // One row in the signal list, expandable to show Level 3 details.
  function renderPOHSignalRow(s, idx) {
    // Status dot color
    var dotColor = 'var(--text-faint)';
    if (s.presence === 'absent' && s.expected) dotColor = '#B45309';
    else if (s.presence === 'absent' && !s.expected) dotColor = 'var(--text-faint)';
    else if (s.behavior === 'normal') dotColor = 'var(--green)';
    else if (s.behavior === 'worth-noting') dotColor = '#B45309';
    else if (s.behavior === 'alarming') dotColor = 'var(--red)';

    // Expected-vs-bonus badge
    var badge = '';
    if (!s.expected && s.presence === 'present') {
      badge = '<span style="font-size:10px; font-weight:600; color:var(--green); background:rgba(43,140,62,0.12); padding:2px 6px; border-radius:8px; margin-left:6px; letter-spacing:0.3px;">BONUS</span>';
    } else if (!s.expected) {
      badge = '<span style="font-size:10px; font-weight:500; color:var(--text-faint); background:var(--bg-input); padding:2px 6px; border-radius:8px; margin-left:6px; letter-spacing:0.3px;">N/A FOR DEVICE</span>';
    }

    // Inline enable affordance — show for device-origin sources that are
    // expected, hardware-available, but user hasn't enabled
    var enableCtrl = '';
    if (s.origin === 'device' && s.expected && s.raw && s.raw.hardwareAvailable && s.raw.enabled === false) {
      // Only wire toggles for signals we actually have handlers for
      if (s.id === 'locationSensor') {
        enableCtrl = '<div class="switch" onclick="event.stopPropagation(); App.toggleLocationTab()"></div>';
      } else if (s.id === 'motionSensor') {
        enableCtrl = '<div class="switch" onclick="event.stopPropagation(); App.toggleMotionTab()"></div>';
      }
    }

    // Dim opacity on absent signals so they visually recede while staying
    // readable. Present signals render at full contrast.
    var rowOpacity = s.presence === 'absent' ? '0.55' : '1';

    var h = '';
    h += '<div class="poh-signal-row" data-idx="' + idx + '" style="opacity:' + rowOpacity + ';">';
    // Row header (tap to expand Level 3)
    h += '<div style="display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer;" onclick="App.togglePOHSignalDetail(this)">';
    h += '<div style="width:10px; height:10px; border-radius:50%; background:' + dotColor + '; flex-shrink:0;"></div>';
    h += '<div style="flex-shrink:0;">' + renderOriginIcon(s.origin) + '</div>';
    h += '<div style="flex:1; min-width:0;">';
    h += '<div style="font-size:var(--fs-md); color:var(--text); font-weight:500;">' + esc(s.humanName) + badge + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); margin-top:2px; line-height:1.4;">' + esc(s.summary) + '</div>';
    h += '</div>';
    if (enableCtrl) h += '<div style="flex-shrink:0; margin-right:4px;">' + enableCtrl + '</div>';
    h += '<span class="poh-sig-chev" style="font-size:20px; color:var(--accent); transition:transform 0.2s; flex-shrink:0; margin-left:4px; line-height:1;">&#8250;</span>';
    h += '</div>';

    // Level 3 — inline detail panel
    var hasCopy = s.copy && (s.copy.whatItMeans || s.copy.whyItMatters);
    var isStub = !hasCopy || s.copy.whatItMeans === 'TODO';

    h += '<div class="poh-signal-detail" style="display:none; padding:8px 0 14px 20px; border-left:2px solid var(--border); margin:0 0 8px 5px;">';

    if (isStub) {
      h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); line-height:1.5; font-style:italic;">Detailed explanation coming in a future update.</div>';
    } else {
      // What it means
      h += '<div style="margin-bottom:12px;">';
      h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">What it means</div>';
      h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.6;">' + esc(s.copy.whatItMeans) + '</div>';
      h += '</div>';

      // What we see here (pulled from raw capture)
      h += '<div style="margin-bottom:12px;">';
      h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">What we see here</div>';
      h += '<div style="font-size:var(--fs-sm); color:var(--text); line-height:1.5; background:var(--bg-input); border-radius:var(--radius-sm); padding:10px 12px;">';
      h += renderPOHSignalData(s);
      h += '</div>';
      h += '</div>';

      // Why it matters
      h += '<div style="margin-bottom:12px;">';
      h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Why it matters</div>';
      h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.6;">' + esc(s.copy.whyItMatters) + '</div>';
      h += '</div>';

      // Visualization (placeholder — descriptive only for now)
      if (s.visualize) {
        try {
          var vSpec = s.visualize(s.raw, null);
          if (vSpec) {
            h += '<div style="margin-bottom:12px;">';
            h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Visualization</div>';
            if (vSpec.type === 'range') {
              h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); font-style:italic; line-height:1.5;">[range chart: value ' + esc(String(vSpec.value)) + ' ' + esc(vSpec.unit || '') + ', normal range ' + esc(JSON.stringify(vSpec.normalRange)) + ']</div>';
            } else if (vSpec.type === 'breakdown') {
              h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); font-style:italic; line-height:1.5;">[breakdown chart: ' + vSpec.parts.map(function(p) { return esc(p.label) + ' ' + p.value; }).join(' · ') + ' of ' + vSpec.total + ']</div>';
            } else {
              h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); font-style:italic; line-height:1.5;">[' + esc(vSpec.type) + ' chart]</div>';
            }
            h += '</div>';
          }
        } catch(e) {}
      }

      // Full technical spec link
      h += '<div>';
      h += '<button style="background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); padding:6px 12px; font-size:var(--fs-sm); font-weight:500; cursor:pointer;" onclick="App.openPOHTechnical(\'' + esc(s.id) + '\')">Full technical specification &rsaquo;</button>';
      h += '</div>';
    }

    h += '</div>';
    h += '</div>';
    return h;
  }

  // "What we see here" formatter — pulls numbers/hashes from raw signal data
  function renderPOHSignalData(s) {
    if (!s.raw) {
      if (!s.expected) return 'This data source is not expected on your device. Not applicable.';
      return 'No data captured for this source yet.';
    }
    // Device-origin: common pattern — hardware availability + enabled state + live reading
    if (s.origin === 'device') {
      var h = '';
      h += '<div><strong>Hardware available:</strong> ' + (s.raw.hardwareAvailable ? 'yes' : 'no') + '</div>';
      if (typeof s.raw.enabled === 'boolean') {
        h += '<div style="margin-top:4px;"><strong>Enabled:</strong> ' + (s.raw.enabled ? 'yes' : 'no') + '</div>';
      }
      // Per-sensor live reading formats
      if (s.id === 'locationSensor' && s.raw.liveGeo) {
        var g = s.raw.liveGeo;
        h += '<div style="margin-top:4px;"><strong>Last reading:</strong> ' + (g.lat !== undefined ? g.lat.toFixed(3) + ', ' + g.lng.toFixed(3) : '(captured)') + '</div>';
      }
      if (s.id === 'locationSensor' && typeof s.raw.contributed === 'number' && s.raw.total > 0) {
        var pct = Math.round((s.raw.contributed / s.raw.total) * 100);
        h += '<div style="margin-top:4px;"><strong>Attached to records:</strong> ' + s.raw.contributed + ' of ' + s.raw.total + ' (' + pct + '%)</div>';
      }
      if (s.id === 'motionSensor') {
        h += '<div style="margin-top:4px;"><strong>Accelerometer live:</strong> ' + (s.raw.accelLive ? 'yes' : 'no') + '</div>';
        h += '<div style="margin-top:4px;"><strong>Gyroscope live:</strong> ' + (s.raw.gyroLive ? 'yes' : 'no') + '</div>';
      }
      if (s.id === 'batterySensor' && s.raw.liveReading) {
        var pct2 = Math.round((s.raw.liveReading.level || 0) * 100);
        h += '<div style="margin-top:4px;"><strong>Current level:</strong> ' + pct2 + '%</div>';
        h += '<div style="margin-top:4px;"><strong>Charging:</strong> ' + (s.raw.liveReading.charging ? 'yes' : 'no') + '</div>';
      }
      if (s.id === 'networkSensor' && s.raw.liveReading) {
        var n = s.raw.liveReading;
        if (n.effectiveType) h += '<div style="margin-top:4px;"><strong>Effective type:</strong> ' + esc(n.effectiveType) + '</div>';
        if (n.type) h += '<div style="margin-top:4px;"><strong>Type:</strong> ' + esc(n.type) + '</div>';
        if (typeof n.downlink === 'number') h += '<div style="margin-top:4px;"><strong>Downlink:</strong> ' + n.downlink + ' Mbps</div>';
        if (typeof n.rtt === 'number') h += '<div style="margin-top:4px;"><strong>Round-trip:</strong> ' + n.rtt + ' ms</div>';
      }
      if (s.id === 'ambientLightSensor' && typeof s.raw.liveReading === 'number') {
        h += '<div style="margin-top:4px;"><strong>Current reading:</strong> ' + s.raw.liveReading + ' lux</div>';
      }
      if (s.id === 'pressureSensor' && typeof s.raw.liveReading === 'number') {
        h += '<div style="margin-top:4px;"><strong>Current pressure:</strong> ' + s.raw.liveReading + ' hPa</div>';
      }
      if (s.id === 'webglRenderer' && s.raw.liveReading) {
        h += '<div style="margin-top:4px;"><strong>Renderer:</strong> ' + esc(s.raw.liveReading) + '</div>';
      }
      return h;
    }
    // Clock agreement: aggregated skew across exchanges
    if (s.id === 'clockSkew' && typeof s.raw.meanAbsMs === 'number') {
      var meanSec = (s.raw.meanAbsMs / 1000).toFixed(2);
      var maxSec = (s.raw.maxAbsMs / 1000).toFixed(2);
      var h = '';
      h += '<div><strong>Samples measured:</strong> ' + s.raw.count + ' exchange' + (s.raw.count === 1 ? '' : 's') + '</div>';
      h += '<div style="margin-top:4px;"><strong>Mean drift:</strong> ' + meanSec + ' s</div>';
      h += '<div style="margin-top:4px;"><strong>Largest drift:</strong> ' + maxSec + ' s</div>';
      h += '<div style="margin-top:8px; color:var(--text-dim);"><strong>Normal range:</strong> mean under 3.00 s</div>';
      return h;
    }
    // Witness RTT
    if (s.id === 'witnessRTT' && typeof s.raw.meanMs === 'number') {
      var h = '';
      h += '<div><strong>Attested records:</strong> ' + s.raw.count + '</div>';
      h += '<div style="margin-top:4px;"><strong>Mean response:</strong> ' + s.raw.meanMs + ' ms</div>';
      h += '<div style="margin-top:4px;"><strong>Range:</strong> ' + s.raw.minMs + ' – ' + s.raw.maxMs + ' ms</div>';
      h += '<div style="margin-top:8px; color:var(--text-dim);"><strong>Healthy range:</strong> under 1500 ms</div>';
      return h;
    }
    // Device consistency
    if (s.id === 'sensorHashMatch' && typeof s.raw.total === 'number') {
      var pct = Math.round(s.raw.primaryRatio * 100);
      var h = '';
      h += '<div><strong>Records with fingerprint:</strong> ' + s.raw.total + '</div>';
      h += '<div style="margin-top:4px;"><strong>Distinct fingerprints:</strong> ' + s.raw.distinct + '</div>';
      h += '<div style="margin-top:4px;"><strong>Primary device share:</strong> ' + pct + '% (' + s.raw.primaryCount + ' of ' + s.raw.total + ')</div>';
      h += '<div style="margin-top:8px; color:var(--text-dim);"><strong>Normal range:</strong> 80% or higher from one primary device</div>';
      return h;
    }
    // Counterparty locations
    if (s.id === 'counterpartyGeo' && typeof s.raw.total === 'number') {
      var pct = Math.round(s.raw.ratio * 100);
      var h = '';
      h += '<div><strong>Total exchanges:</strong> ' + s.raw.total + '</div>';
      h += '<div style="margin-top:4px;"><strong>With shared location:</strong> ' + s.raw.withGeo + ' (' + pct + '%)</div>';
      return h;
    }
    // Connectivity mix
    if (s.id === 'connectivity' && typeof s.raw.total === 'number') {
      var pct = Math.round(s.raw.onlineRatio * 100);
      var h = '';
      h += '<div><strong>Records with connectivity data:</strong> ' + s.raw.total + '</div>';
      h += '<div style="margin-top:4px;"><strong>Online:</strong> ' + s.raw.online + ' (' + pct + '%)</div>';
      h += '<div style="margin-top:4px;"><strong>Offline:</strong> ' + s.raw.offline + '</div>';
      return h;
    }
    // Exchange method mix
    if (s.id === 'exchangePath' && typeof s.raw.total === 'number') {
      var ratio = Math.round(s.raw.coPresentRatio * 100);
      var h = '';
      h += '<div><strong>Total exchanges:</strong> ' + s.raw.total + '</div>';
      h += '<div style="margin-top:4px;"><strong>Live sessions:</strong> ' + s.raw.session + '</div>';
      h += '<div style="margin-top:4px;"><strong>In-person QR:</strong> ' + s.raw.qr + '</div>';
      h += '<div style="margin-top:4px;"><strong>Deferred (offline):</strong> ' + s.raw.offline + '</div>';
      h += '<div style="margin-top:8px; color:var(--text-dim);"><strong>Co-present ratio:</strong> ' + ratio + '%</div>';
      return h;
    }
    // Battery signature
    if (s.id === 'batteryDetails' && typeof s.raw.samples === 'number') {
      var h = '';
      h += '<div><strong>Samples captured:</strong> ' + s.raw.samples + '</div>';
      if (s.raw.minLevel !== null && s.raw.maxLevel !== null) {
        var minPct = Math.round(s.raw.minLevel * 100);
        var maxPct = Math.round(s.raw.maxLevel * 100);
        var rangePct = Math.round((s.raw.rangeLevel || 0) * 100);
        h += '<div style="margin-top:4px;"><strong>Level range:</strong> ' + minPct + '% – ' + maxPct + '% (' + rangePct + '% span)</div>';
      }
      h += '<div style="margin-top:4px;"><strong>Charging state seen:</strong> ' + (s.raw.chargingSeen ? 'yes' : 'no') + '</div>';
      h += '<div style="margin-top:4px;"><strong>Not-charging state seen:</strong> ' + (s.raw.notChargingSeen ? 'yes' : 'no') + '</div>';
      return h;
    }
    // Merkle root
    if (s.id === 'merkleRoot' && s.raw && (typeof s.raw.total === 'number' || typeof s.raw.legacySkipped === 'number')) {
      var pct = s.raw.total > 0 ? Math.round(s.raw.ratio * 100) : 100;
      var h = '';
      h += '<div><strong>Eligible records:</strong> ' + s.raw.total + '</div>';
      h += '<div style="margin-top:4px;"><strong>With Merkle root:</strong> ' + s.raw.withRoot + ' (' + pct + '%)</div>';
      if (s.raw.legacySkipped > 0) {
        h += '<div style="margin-top:8px; color:var(--text-dim); font-style:italic;">' + s.raw.legacySkipped + ' record' + (s.raw.legacySkipped === 1 ? '' : 's') + ' predate this feature and are not counted.</div>';
      }
      return h;
    }
    // Entropy chain
    if (s.id === 'entropyChain' && s.raw && (typeof s.raw.total === 'number' || typeof s.raw.legacySkipped === 'number')) {
      var pct = s.raw.total > 0 ? Math.round(s.raw.ratio * 100) : 100;
      var h = '';
      h += '<div><strong>Eligible records:</strong> ' + s.raw.total + '</div>';
      h += '<div style="margin-top:4px;"><strong>With entropy link:</strong> ' + s.raw.withEntropy + ' (' + pct + '%)</div>';
      if (s.raw.legacySkipped > 0) {
        h += '<div style="margin-top:8px; color:var(--text-dim); font-style:italic;">' + s.raw.legacySkipped + ' record' + (s.raw.legacySkipped === 1 ? '' : 's') + ' predate this feature and are not counted.</div>';
      }
      return h;
    }
    // Generic fallback — show whatever's in raw
    try { return '<pre style="white-space:pre-wrap; margin:0; font-size:var(--fs-sm); font-family:var(--font-mono);">' + esc(JSON.stringify(s.raw, null, 2)) + '</pre>'; }
    catch(e) { return 'Data present but not displayable.'; }
  }

  // Level 4 — modal with full technical spec
  function openPOHTechnical(signalId) {
    var sig = POH.SIGNALS[signalId];
    if (!sig) return;
    var ctx = { chain: state.chain, deviceCapabilities: pohDeviceCapabilities() };
    var v = POH.rollup(ctx);
    var s = v.signals.find(function(x) { return x.id === signalId; });

    var h = '';
    h += '<div style="padding:4px 0 16px;">';
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Technical specification</div>';
    h += '<div style="font-size:var(--fs-lg); font-weight:600; color:var(--text); margin-bottom:4px;">' + esc(sig.humanName) + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); font-family:var(--font-mono);">signal.id: ' + esc(sig.id) + '</div>';
    h += '</div>';

    h += '<div style="background:var(--bg-input); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:12px;">';
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Classification</div>';
    var tierName = sig.tier === 3 ? 'Critical' : sig.tier === 2 ? 'Supporting' : 'Enrichment';
    h += '<div style="font-size:var(--fs-sm); color:var(--text); line-height:1.8;">';
    h += '<div><strong>Weight tier:</strong> ' + tierName + ' (contribution ' + sig.tier + ')</div>';
    h += '<div><strong>Expected on:</strong> ' + sig.expectedOn.join(', ') + '</div>';
    h += '<div><strong>Your device class:</strong> ' + v.deviceClass + '</div>';
    h += '<div><strong>Expected for this device:</strong> ' + (s.expected ? 'yes' : 'no') + '</div>';
    h += '</div>';
    h += '</div>';

    h += '<div style="background:var(--bg-input); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:12px;">';
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Observed on this device</div>';
    if (s.raw) {
      h += '<pre style="margin:0; font-size:var(--fs-sm); font-family:var(--font-mono); white-space:pre-wrap; color:var(--text);">' + esc(JSON.stringify(s.raw, null, 2)) + '</pre>';
    } else {
      h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); font-style:italic;">No capture data available in current context.</div>';
    }
    h += '</div>';

    h += '<div style="background:var(--bg-input); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:12px;">';
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Interpretation result</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text); line-height:1.8;">';
    h += '<div><strong>Presence:</strong> ' + s.presence + '</div>';
    h += '<div><strong>Behavior:</strong> ' + s.behavior + '</div>';
    h += '<div><strong>Contribution to verdict:</strong> ' + s.contribution + '</div>';
    h += '<div><strong>Summary:</strong> ' + esc(s.summary) + '</div>';
    h += '</div>';
    h += '</div>';

    h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); line-height:1.6; padding:0 4px;">This is the raw technical readout for this signal as evaluated against your device and chain. The interpretation logic lives in the signal registry and is the same for everyone using this version of HEP.</div>';

    // Reuse chain modal as a generic content viewer
    showModal('chain');
    var filter = document.getElementById('chain-filter');
    if (filter) filter.style.display = 'none';
    var tabs = document.querySelector('#chain-overlay .tabs');
    if (tabs) tabs.style.display = 'none';
    var body = document.getElementById('chain-body');
    if (body) body.innerHTML = h;
  }

  // UI toggle handlers
  function togglePOHSignals(header) {
    var wrap = header.parentElement;
    var list = wrap.querySelector('.poh-signals');
    var chev = header.querySelector('.poh-chev');
    if (!list) return;
    var open = list.style.display === 'block';
    list.style.display = open ? 'none' : 'block';
    if (chev) chev.style.transform = open ? '' : 'rotate(90deg)';
  }

  function togglePOHSignalDetail(rowHeader) {
    var row = rowHeader.parentElement;
    var detail = row.querySelector('.poh-signal-detail');
    var chev = rowHeader.querySelector('.poh-sig-chev');
    if (!detail) return;
    var open = detail.style.display === 'block';
    detail.style.display = open ? 'none' : 'block';
    if (chev) chev.style.transform = open ? '' : 'rotate(90deg)';
  }

  // --- Counterparty POH verdict renderer ---
  // Renders a pre-computed verdict broadcast by a counterparty (v2.47.0+) or
  // a minimal verdict synthesized from an older thread_snapshot's integrity
  // block. Distinguished from the owner's POH card by label and by the
  // absence of sensor toggles and raw-data detail — those belong to the
  // owner of the chain. The receiver sees the counterparty's read of their
  // own chain, rendered through the receiver's local registry for copy.
  function renderCounterpartyPOH(verdict, options) {
    if (!verdict) return '';
    options = options || {};
    var v = verdict;

    var toneColor = 'var(--text-dim)';
    var toneBg = 'var(--bg-raised)';
    var toneBorder = 'var(--border)';
    var toneIcon = '&#9679;';
    if (v.tone === 'strong') { toneColor = 'var(--green)'; toneBg = 'rgba(43,140,62,0.06)'; toneBorder = 'rgba(43,140,62,0.25)'; toneIcon = '&#10003;'; }
    else if (v.tone === 'partial') { toneColor = '#B45309'; toneBg = 'rgba(180,83,9,0.06)'; toneBorder = 'rgba(180,83,9,0.25)'; toneIcon = '&#9679;'; }
    else if (v.tone === 'weak') { toneColor = 'var(--text-dim)'; toneIcon = '&#9679;'; }
    else if (v.tone === 'alarming') { toneColor = 'var(--red)'; toneBg = 'rgba(214,107,107,0.06)'; toneBorder = 'rgba(214,107,107,0.35)'; toneIcon = '&#9888;'; }

    var h = '';
    h += '<div style="background:' + toneBg + '; border:1px solid ' + toneBorder + '; border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';

    // Distinguishing label
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">';
    h += options.isLegacyDerived ? 'Their proof-of-human (older version)' : 'Their proof-of-human';
    h += '</div>';

    // Level 1 — verdict header
    h += '<div style="cursor:pointer;" onclick="App.togglePOHSignals(this)">';
    h += '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">';
    h += '<div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">';
    h += '<div style="width:24px; height:24px; border-radius:50%; background:' + toneColor + '; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0;">' + toneIcon + '</div>';
    h += '<div style="min-width:0; flex:1;">';
    h += '<div style="font-size:var(--fs-md); font-weight:600; color:var(--text); line-height:1.3;">' + esc(v.statement) + '</div>';
    // Same bonus-aware main-line logic as the owner's POH card.
    var mainLine;
    var presentExpected = Math.min(v.countPresentExpected || 0, v.totalAvailable);
    if (v.countBonus > 0) {
      mainLine = 'Drawing from ' + presentExpected + ' of ' + v.totalAvailable + ' expected source' + (v.totalAvailable === 1 ? '' : 's') + ' \u00b7 plus ' + v.countBonus + ' bonus';
    } else {
      mainLine = 'Drawing from ' + v.totalContributing + ' of ' + v.totalAvailable + ' available data source' + (v.totalAvailable === 1 ? '' : 's');
    }
    if (v.countAlarming > 0) mainLine += ' \u00b7 ' + v.countAlarming + ' alarming';
    else if (v.countWorthNoting > 0) mainLine += ' \u00b7 ' + v.countWorthNoting + ' worth noting';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); margin-top:2px;">' + mainLine + '</div>';
    h += '</div></div>';
    h += '<span class="poh-chev" style="font-size:22px; color:var(--accent); transition:transform 0.2s; flex-shrink:0; margin-left:4px; line-height:1;">&#8250;</span>';
    h += '</div></div>';

    // Per-origin breakdown strip
    if (v.byOrigin) {
      var showStrip = (v.byOrigin.device && v.byOrigin.device.expected > 0) ||
                      (v.byOrigin.external && v.byOrigin.external.expected > 0) ||
                      (v.byOrigin.chain && v.byOrigin.chain.expected > 0);
      if (showStrip) {
        h += '<div style="display:flex; gap:8px; margin-top:12px; font-size:var(--fs-xs);">';
        var bo = v.byOrigin;
        if (bo.device && bo.device.expected > 0) {
          h += '<div style="flex:1; background:var(--bg-input); border-radius:var(--radius-sm); padding:8px 10px; text-align:center;">';
          h += '<div style="color:var(--text-faint); letter-spacing:0.5px; margin-bottom:2px;">' + renderOriginIcon('device') + ' Device</div>';
          h += '<div style="color:var(--text); font-weight:600;">' + bo.device.contributing + ' / ' + bo.device.expected + '</div>';
          h += '</div>';
        }
        if (bo.external && bo.external.expected > 0) {
          h += '<div style="flex:1; background:var(--bg-input); border-radius:var(--radius-sm); padding:8px 10px; text-align:center;">';
          h += '<div style="color:var(--text-faint); letter-spacing:0.5px; margin-bottom:2px;">' + renderOriginIcon('external') + ' External</div>';
          h += '<div style="color:var(--text); font-weight:600;">' + bo.external.contributing + ' / ' + bo.external.expected + '</div>';
          h += '</div>';
        }
        if (bo.chain && bo.chain.expected > 0) {
          h += '<div style="flex:1; background:var(--bg-input); border-radius:var(--radius-sm); padding:8px 10px; text-align:center;">';
          h += '<div style="color:var(--text-faint); letter-spacing:0.5px; margin-bottom:2px;">' + renderOriginIcon('chain') + ' Chain</div>';
          h += '<div style="color:var(--text); font-weight:600;">' + bo.chain.contributing + ' / ' + bo.chain.expected + '</div>';
          h += '</div>';
        }
        h += '</div>';
      }
    }

    // Level 2 — full signal list
    h += '<div class="poh-signals" style="display:none; margin-top:14px; border-top:1px solid var(--border); padding-top:6px;">';

    // Origin explainer — reads "their phone" not "your phone"
    h += '<div style="padding:10px 0; border-bottom:1px solid var(--border); margin-bottom:6px;">';
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">How to read these</div>';
    h += '<div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:6px;">';
    h += '<div style="flex-shrink:0; margin-top:1px;">' + renderOriginIcon('device') + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4;"><strong style="color:var(--text);">Device</strong> \u2014 hardware on their phone contributes to each record.</div>';
    h += '</div>';
    h += '<div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:6px;">';
    h += '<div style="flex-shrink:0; margin-top:1px;">' + renderOriginIcon('external') + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4;"><strong style="color:var(--text);">External</strong> \u2014 data reaching their chain from others or from a witness.</div>';
    h += '</div>';
    h += '<div style="display:flex; align-items:flex-start; gap:8px;">';
    h += '<div style="flex-shrink:0; margin-top:1px;">' + renderOriginIcon('chain') + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4;"><strong style="color:var(--text);">Chain</strong> \u2014 patterns observed across their chain over time.</div>';
    h += '</div>';
    h += '</div>';

    // Sort and render signal rows. Same present-first / absent-bottom
    // logic as the owner's POH card for visual consistency.
    var sorted = (v.signals || []).slice().sort(function(a, b) {
      var originOrder = { device: 0, external: 1, chain: 2 };
      var ao = originOrder[a.origin] !== undefined ? originOrder[a.origin] : 9;
      var bo2 = originOrder[b.origin] !== undefined ? originOrder[b.origin] : 9;
      if (ao !== bo2) return ao - bo2;
      var aPresent = a.presence === 'present' ? 0 : 1;
      var bPresent = b.presence === 'present' ? 0 : 1;
      if (aPresent !== bPresent) return aPresent - bPresent;
      return (b.tier || 0) - (a.tier || 0);
    });
    for (var i = 0; i < sorted.length; i++) {
      h += renderCounterpartyPOHSignalRow(sorted[i], i);
    }
    h += '</div>';
    h += '</div>';
    return h;
  }

  // Signal row for counterparty verdict. No enable toggles (not our device).
  // No raw-data formatter ("What we see here" — we don't have raw capture
  // data for their device). Copy is looked up from our local POH.SIGNALS by
  // id; if the signal id is unknown (counterparty on newer version) the row
  // degrades to the shipped humanName + summary only.
  function renderCounterpartyPOHSignalRow(s, idx) {
    var dotColor = 'var(--text-faint)';
    if (s.presence === 'absent' && s.expected) dotColor = '#B45309';
    else if (s.presence === 'absent' && !s.expected) dotColor = 'var(--text-faint)';
    else if (s.behavior === 'normal') dotColor = 'var(--green)';
    else if (s.behavior === 'worth-noting') dotColor = '#B45309';
    else if (s.behavior === 'alarming') dotColor = 'var(--red)';

    var badge = '';
    if (!s.expected && s.presence === 'present') {
      badge = '<span style="font-size:10px; font-weight:600; color:var(--green); background:rgba(43,140,62,0.12); padding:2px 6px; border-radius:8px; margin-left:6px; letter-spacing:0.3px;">BONUS</span>';
    } else if (!s.expected) {
      badge = '<span style="font-size:10px; font-weight:500; color:var(--text-faint); background:var(--bg-input); padding:2px 6px; border-radius:8px; margin-left:6px; letter-spacing:0.3px;">N/A FOR DEVICE</span>';
    }

    // Dim absent rows (same treatment as owner's POH card)
    var rowOpacity = s.presence === 'absent' ? '0.55' : '1';

    var h = '';
    h += '<div class="poh-signal-row" data-idx="' + idx + '" style="opacity:' + rowOpacity + ';">';
    h += '<div style="display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer;" onclick="App.togglePOHSignalDetail(this)">';
    h += '<div style="width:10px; height:10px; border-radius:50%; background:' + dotColor + '; flex-shrink:0;"></div>';
    h += '<div style="flex-shrink:0;">' + renderOriginIcon(s.origin) + '</div>';
    h += '<div style="flex:1; min-width:0;">';
    h += '<div style="font-size:var(--fs-md); color:var(--text); font-weight:500;">' + esc(s.humanName) + badge + '</div>';
    h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); margin-top:2px; line-height:1.4;">' + esc(s.summary || '') + '</div>';
    h += '</div>';
    h += '<span class="poh-sig-chev" style="font-size:20px; color:var(--accent); transition:transform 0.2s; flex-shrink:0; margin-left:4px; line-height:1;">&#8250;</span>';
    h += '</div>';

    // Level 3 — lookup copy from local registry
    var localSig = (typeof POH !== 'undefined' && POH.SIGNALS) ? POH.SIGNALS[s.id] : null;
    var copy = localSig ? localSig.copy : null;
    var hasCopy = copy && copy.whatItMeans && copy.whatItMeans !== 'TODO';

    h += '<div class="poh-signal-detail" style="display:none; padding:8px 0 14px 20px; border-left:2px solid var(--border); margin:0 0 8px 5px;">';

    if (hasCopy) {
      h += '<div style="margin-bottom:12px;">';
      h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">What it means</div>';
      h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.6;">' + esc(copy.whatItMeans) + '</div>';
      h += '</div>';
    }

    // What this reads on their chain — shipped summary only
    if (s.summary) {
      h += '<div style="margin-bottom:12px;">';
      h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">What this reads on their chain</div>';
      h += '<div style="font-size:var(--fs-sm); color:var(--text); line-height:1.5; background:var(--bg-input); border-radius:var(--radius-sm); padding:10px 12px;">' + esc(s.summary) + '</div>';
      h += '</div>';
    }

    if (hasCopy && copy.whyItMatters) {
      h += '<div style="margin-bottom:12px;">';
      h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Why it matters</div>';
      h += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.6;">' + esc(copy.whyItMatters) + '</div>';
      h += '</div>';
    }

    if (!hasCopy && !s.summary) {
      h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); line-height:1.5; font-style:italic;">No detail shared for this signal.</div>';
    }

    h += '</div>';
    h += '</div>';
    return h;
  }

  // Fallback: synthesize a minimal verdict from a pre-v2.47.0 thread_snapshot
  // that has no broadcast pohVerdict. Translates the integrity block into
  // pseudo-signal rows so the same renderer can display them. Not meant to
  // match the full registry — just the readable subset of what older
  // versions shipped. Rows use legacy-prefixed ids so they don't try to
  // look up copy from our registry; inline summary carries the meaning.
  function deriveCounterpartyVerdictFromLegacySnap(ts) {
    if (!ts || !ts.integrity) return null;
    var ig = ts.integrity;
    var signals = [];
    var countStrong = 0, countWorthNoting = 0;
    var expected = 0, contributing = 0;

    expected++;
    signals.push({
      id: 'legacyGenesisPhoto',
      humanName: 'Genesis photo anchored',
      tier: 2,
      origin: 'chain',
      expected: true,
      presence: ig.genesisPhoto ? 'present' : 'absent',
      behavior: ig.genesisPhoto ? 'normal' : 'worth-noting',
      summary: ig.genesisPhoto ? 'Chain anchored to photo at first launch' + (ig.genesisPhotoSource ? ' (' + ig.genesisPhotoSource + ')' : '') : 'No genesis photo on this chain'
    });
    if (ig.genesisPhoto) { countStrong++; contributing++; } else { countWorthNoting++; }

    if (typeof ig.sensorCoverage === 'number') {
      expected++;
      var covOk = ig.sensorCoverage >= 50;
      signals.push({
        id: 'legacySensorCoverage',
        humanName: 'Sensor coverage',
        tier: 2,
        origin: 'chain',
        expected: true,
        presence: ig.sensorCoverage > 0 ? 'present' : 'absent',
        behavior: covOk ? 'normal' : 'worth-noting',
        summary: ig.sensorCoverage + '% of records carry sensor snapshots'
      });
      if (covOk && ig.sensorCoverage > 0) { countStrong++; contributing++; } else { countWorthNoting++; }
    }

    if (typeof ig.distinctDevices === 'number') {
      expected++;
      var devOk = ig.distinctDevices >= 1 && ig.distinctDevices <= 3;
      signals.push({
        id: 'legacyDeviceConsistency',
        humanName: 'Device consistency',
        tier: 3,
        origin: 'chain',
        expected: true,
        presence: 'present',
        behavior: devOk ? 'normal' : 'worth-noting',
        summary: ig.distinctDevices + ' distinct device fingerprint' + (ig.distinctDevices === 1 ? '' : 's') + ' across chain'
      });
      if (devOk) { countStrong++; contributing++; } else { countWorthNoting++; }
    }

    if (typeof ig.distinctCounterparties === 'number' && ig.distinctCounterparties > 0) {
      expected++;
      signals.push({
        id: 'legacyCounterpartyDiversity',
        humanName: 'Counterparty diversity',
        tier: 2,
        origin: 'chain',
        expected: true,
        presence: 'present',
        behavior: 'normal',
        summary: ig.distinctCounterparties + ' distinct counterpart' + (ig.distinctCounterparties === 1 ? 'y' : 'ies') + ' in chain history'
      });
      countStrong++; contributing++;
    }

    if (typeof ig.avgPingGapDays === 'number' && ts.pings > 0) {
      expected++;
      signals.push({
        id: 'legacyPingRhythm',
        humanName: 'Ping rhythm',
        tier: 1,
        origin: 'chain',
        expected: true,
        presence: 'present',
        behavior: 'normal',
        summary: ts.pings + ' ping' + (ts.pings === 1 ? '' : 's') + ', average gap ' + ig.avgPingGapDays + ' days'
      });
      countStrong++; contributing++;
    }

    var statement, tone;
    if (countStrong >= Math.ceil(expected * 0.75)) { statement = 'Partial signals (older version) \u2014 readable'; tone = 'partial'; }
    else if (countStrong >= Math.ceil(expected / 2)) { statement = 'Partial signals (older version)'; tone = 'partial'; }
    else { statement = 'Limited signals on this chain'; tone = 'weak'; }

    return {
      deviceClass: 'unknown',
      statement: statement,
      tone: tone,
      countStrong: countStrong,
      countWorthNoting: countWorthNoting,
      countAlarming: 0,
      countExpected: expected,
      countPresentExpected: contributing,
      countBonus: 0,
      totalContributing: contributing,
      totalAvailable: expected,
      byOrigin: {
        device:   { expected: 0, contributing: 0, total: 0 },
        external: { expected: 0, contributing: 0, total: 0 },
        chain:    { expected: expected, contributing: contributing, total: expected }
      },
      signals: signals
    };
  }

  // --- Counterparty chain shape card (relational density, uplifting framing) ---
  // Shows the *shape* of a chain: its rhythm of giving and receiving, age,
  // reach, and category breadth. This is not a score. Heavy-receive is a
  // valid rhythm (student, patient, caregiver-receiver, someone rebuilding).
  // Heavy-give is a valid rhythm (service provider, structural-giver).
  // Language is neutral. The card describes what this chain looks like,
  // not whether it's "good." Every chain has its own pattern of
  // participation. Different shapes are all valid.
  function renderCounterpartyChainShape(ts) {
    if (!ts || !ts.n) return '';

    var total = ts.n;
    var gave = ts.g || 0;
    var received = ts.r || 0;
    var cats = ts.cats || {};
    var catKeys = Object.keys(cats).filter(function(k) { return k !== 'other'; });
    var catCount = catKeys.length;
    var ig = ts.integrity || {};
    var distinctCp = ig.distinctCounterparties || 0;

    // Thread age in human language
    var ageText = '';
    if (ts.t0 && ts.t1) {
      var t0 = new Date(ts.t0).getTime();
      var t1 = new Date(ts.t1).getTime();
      var days = Math.max(1, Math.round((t1 - t0) / 86400000));
      if (days < 30) ageText = days + ' day' + (days === 1 ? '' : 's');
      else if (days < 365) { var mo = Math.round(days / 30); ageText = mo + ' month' + (mo === 1 ? '' : 's'); }
      else ageText = (days / 365).toFixed(1) + ' years';
    }

    // Balance position — a continuum, not a value judgment.
    // 0 = all received, 0.5 = balanced, 1 = all provided.
    var balanceRatio = total > 0 ? gave / total : 0.5;
    var balancePct = Math.round(balanceRatio * 100);

    // Neutral shape description — language intentionally non-judgmental.
    var shapeDesc;
    if (total < 3) shapeDesc = 'Chain just starting';
    else if (balanceRatio >= 0.7) shapeDesc = 'Provides more than receives';
    else if (balanceRatio <= 0.3) shapeDesc = 'Receives more than provides';
    else shapeDesc = 'Balanced giving and receiving';

    var h = '';
    h += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';

    // Label
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Their chain shape</div>';

    // Summary line — the facts, composed as one readable sentence
    h += '<div style="font-size:var(--fs-md); color:var(--text); line-height:1.5; margin-bottom:14px;">';
    h += '<strong>' + total + '</strong> exchange' + (total === 1 ? '' : 's');
    if (ageText) h += ' over ' + ageText;
    if (distinctCp > 0) h += ' with <strong>' + distinctCp + '</strong> counterpart' + (distinctCp === 1 ? 'y' : 'ies');
    if (catCount > 0) h += ' across ' + catCount + ' categor' + (catCount === 1 ? 'y' : 'ies');
    h += '.</div>';

    // Balance strip — shows position on a continuum, not a rating.
    // Left end labeled with count provided; right end labeled with count received.
    // Mid-strip label summarizes the shape in neutral language.
    h += '<div style="margin-bottom:14px;">';
    h += '<div style="display:flex; justify-content:space-between; align-items:baseline; font-size:var(--fs-xs); color:var(--text-faint); margin-bottom:6px;">';
    h += '<span>Provided <strong style="color:var(--text-dim);">' + gave + '</strong></span>';
    h += '<span style="color:var(--text-dim); font-weight:500;">' + shapeDesc + '</span>';
    h += '<span>Received <strong style="color:var(--text-dim);">' + received + '</strong></span>';
    h += '</div>';
    // Horizontal balance bar — two halves in different accents, with a centerline.
    // The accent side grows with provided share; green side with received share.
    // No value judgment in color choice — both are present on every chain.
    h += '<div style="position:relative; height:10px; background:var(--bg-input); border-radius:5px; overflow:hidden;">';
    h += '<div style="position:absolute; left:0; top:0; height:100%; width:' + balancePct + '%; background:var(--accent); opacity:0.55;"></div>';
    h += '<div style="position:absolute; right:0; top:0; height:100%; width:' + (100 - balancePct) + '%; background:var(--green); opacity:0.55;"></div>';
    // Midpoint reference tick
    h += '<div style="position:absolute; left:50%; top:-2px; width:1px; height:14px; background:var(--text-faint); opacity:0.5;"></div>';
    h += '</div>';
    h += '</div>';

    // Top categories — a quick read of what this chain does
    if (catCount > 0) {
      var sortedCats = catKeys.map(function(k) { return { k: k, n: cats[k].n, avg: cats[k].avg }; })
        .sort(function(a, b) { return b.n - a.n; }).slice(0, 3);
      h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Most active categories</div>';
      h += '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;">';
      sortedCats.forEach(function(c) {
        h += '<span style="background:var(--bg-input); padding:4px 10px; border-radius:12px; font-size:var(--fs-sm); color:var(--text-dim);">' + esc(c.k) + ' <span style="color:var(--text-faint);">\u00b7 ' + c.n + '</span></span>';
      });
      h += '</div>';
    }

    // Uplifting framing — Every chain has its own rhythm.
    // This text is load-bearing against the anti-caste principle and must
    // stay. Do not replace with language that implies balance is better
    // than heavy-receive or heavy-give. All three are participation.
    h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); line-height:1.5; font-style:italic; border-top:1px solid var(--border); padding-top:10px;">Every chain has its own rhythm. Some provide more, some receive more. Both are participation.</div>';

    h += '</div>';
    return h;
  }

  // Shared helper — renders the counterparty context cards used on both the
  // pre-proposal connected screen and the proposal review screen. This is
  // chain shape + proof-of-human verdict, preceded by a distinguishing
  // section header so the surfaces read as a coherent "about them" block.
  function renderCounterpartyContextBlock(ts) {
    if (!ts) return '';
    var h = '';

    // Section header — makes the new surfaces visibly distinct from the
    // legacy thread tabs and proposal block.
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1.5px; margin:4px 0 10px; font-weight:600;">About this counterparty</div>';

    // Chain shape card
    h += renderCounterpartyChainShape(ts);

    // Proof-of-human verdict — pohVerdict for v2.47.0+ senders, integrity-
    // derived fallback for older. Card omitted if neither is available.
    try {
      var cpVerdict = null;
      var cpVerdictLegacy = false;
      if (ts.pohVerdict) {
        cpVerdict = ts.pohVerdict;
      } else if (ts.integrity) {
        cpVerdict = deriveCounterpartyVerdictFromLegacySnap(ts);
        cpVerdictLegacy = true;
      }
      if (cpVerdict) {
        h += renderCounterpartyPOH(cpVerdict, { isLegacyDerived: cpVerdictLegacy });
      }
    } catch(e) {
      console.log('[session] Counterparty POH render failed:', e.message);
    }

    return h;
  }

  // Module state for pricing-chart filter. Held outside the render function
  // so pill clicks can re-render the chart in place without losing context.
  var _pricingFilterMode = null;
  var _pricingFilterState = null;

  // Set the active pricing-filter mode and re-render the chart in place.
  // Called from pill-button onclick handlers below.
  function setPricingFilter(mode) {
    _pricingFilterMode = mode;
    if (!_pricingFilterState) return;
    var container = document.getElementById('ex-pricing-chart');
    if (!container) return;
    var newHtml = renderPricingContextChart(
      _pricingFilterState.ts,
      _pricingFilterState.proposal,
      _pricingFilterState.partnerFp
    );
    // Replace the existing container with the freshly rendered one
    if (newHtml) {
      var wrapper = document.createElement('div');
      wrapper.innerHTML = newHtml;
      var fresh = wrapper.firstElementChild;
      if (fresh && container.parentNode) {
        container.parentNode.replaceChild(fresh, container);
      }
    }
  }

  // --- Pricing context chart (time-scatter with filter pills) ---
  // For the proposal being reviewed, plots value over time from four data
  // sources: my chain, counterparty's chain (from broadcast), our shared
  // history, and today's proposed value. A pill row at the top lets the
  // reviewer pivot the view:
  //
  //   [Category]     — filters to proposal.category (default if present)
  //   [Description]  — filters to proposal.description key (fallback default)
  //   [All]          — no filter, full chain context
  //
  // This always renders when there's any pivot available. The proposer
  // omitting category is information, not a block — the reviewer still
  // has agency to inspect pricing from their own vantage point.
  function renderPricingContextChart(ts, proposal, partnerFp) {
    if (!proposal) return '';
    var todayVal = proposal.value || 0;
    var nowMs = Date.now();

    // Build available filter modes, most specific first.
    var modes = [];
    if (proposal.category) {
      modes.push({ type: 'category', label: proposal.category, value: proposal.category });
    }
    var descRaw = (proposal.description || '').trim();
    if (descRaw) {
      var descLabel = descRaw.length > 24 ? descRaw.substring(0, 22) + '\u2026' : descRaw;
      modes.push({ type: 'description', label: descLabel, value: descRaw.toLowerCase() });
    }
    modes.push({ type: 'all', label: 'All', value: null });

    // Pick default mode: most specific available, but honor current filter
    // selection if it's still valid.
    var defaultMode = modes[0];
    var active = defaultMode;
    if (_pricingFilterMode) {
      var found = modes.find(function(m) { return m.type === _pricingFilterMode; });
      if (found) active = found;
    }

    // Stash state for the pill click handler to re-render
    _pricingFilterState = { ts: ts, proposal: proposal, partnerFp: partnerFp };

    // --- Collect data points according to active pivot ---
    // myPoints: my chain records matching the pivot
    // sharedPoints: subset of mine where counterparty fingerprint matches
    // theirPoints: their chain records matching the pivot (from broadcast)
    var myPoints = [];
    var sharedPoints = [];
    state.chain.forEach(function(rec) {
      if (!HCP.isAct(rec)) return;
      var matches = false;
      if (active.type === 'all') {
        matches = true;
      } else if (active.type === 'category') {
        matches = rec.category === active.value;
      } else if (active.type === 'description') {
        matches = (rec.description || '').trim().toLowerCase() === active.value;
      }
      if (!matches) return;
      var ms = new Date(rec.timestamp).getTime();
      if (isNaN(ms)) return;
      myPoints.push([ms, rec.value]);
      if (partnerFp && rec.counterparty === partnerFp) {
        sharedPoints.push([ms, rec.value]);
      }
    });

    // theirPoints come from different sources depending on pivot:
    // - category → ts.catsTimeline[category] (v2.47.0+ broadcast)
    // - description → ts._services[descKey].prices (ex-flow service extras)
    // - all → every catsTimeline entry across all categories
    var theirPoints = [];
    if (active.type === 'category' && ts && ts.catsTimeline && ts.catsTimeline[active.value]) {
      ts.catsTimeline[active.value].forEach(function(entry) {
        if (entry && entry.length >= 2 && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
          theirPoints.push([entry[0], entry[1]]);
        }
      });
    } else if (active.type === 'description' && ts && ts._services) {
      var svc = ts._services[active.value];
      if (svc && svc.prices) {
        svc.prices.forEach(function(pr) {
          if (pr && typeof pr.v === 'number' && typeof pr.w === 'number') {
            theirPoints.push([pr.w, pr.v]);
          }
        });
      }
    } else if (active.type === 'all' && ts && ts.catsTimeline) {
      Object.keys(ts.catsTimeline).forEach(function(k) {
        ts.catsTimeline[k].forEach(function(entry) {
          if (entry && entry.length >= 2 && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
            theirPoints.push([entry[0], entry[1]]);
          }
        });
      });
    }

    // Aggregate fallback from older snapshots (only meaningful for category pivot)
    var theirAvg = null, theirMin = null, theirMax = null;
    if (active.type === 'category' && ts && ts.cats && ts.cats[active.value]) {
      theirAvg = ts.cats[active.value].avg;
      if (ts.stab && ts.stab[active.value]) {
        theirMin = ts.stab[active.value][0];
        theirMax = ts.stab[active.value][1];
      }
    }

    // --- Card shell + pill bar — always rendered ---
    var h = '';
    h += '<div id="ex-pricing-chart" style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';

    // Title
    h += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Pricing context</div>';

    // Pill bar — only show if more than one mode available
    if (modes.length > 1) {
      h += '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">';
      modes.forEach(function(m) {
        var isActive = m.type === active.type;
        var bg = isActive ? 'var(--accent)' : 'var(--bg-input)';
        var col = isActive ? '#fff' : 'var(--text-dim)';
        h += '<button onclick="App.setPricingFilter(\'' + m.type + '\')" style="background:' + bg + '; color:' + col + '; border:none; border-radius:14px; padding:5px 12px; font-size:var(--fs-xs); font-weight:500; cursor:pointer; font-family:var(--font);">' + esc(m.label) + '</button>';
      });
      h += '</div>';
    }

    // --- If nothing to plot on the active pivot, show a gentle empty state ---
    if (myPoints.length === 0 && theirPoints.length === 0 && theirAvg === null) {
      h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); padding:8px 0; line-height:1.5;">';
      if (active.type === 'category') {
        h += 'No history yet in <strong>' + esc(active.value) + '</strong>. Today\'s proposal of <strong>' + todayVal + '</strong> would be the first data point in this category.';
      } else if (active.type === 'description') {
        h += 'No prior exchanges match this exact description. Switch to All to see broader context.';
      } else {
        h += 'No chain data to plot yet.';
      }
      h += '</div></div>';
      return h;
    }

    // --- Compute extents ---
    var allVals = [todayVal];
    myPoints.forEach(function(p) { allVals.push(p[1]); });
    theirPoints.forEach(function(p) { allVals.push(p[1]); });
    if (theirMin !== null) allVals.push(theirMin);
    if (theirMax !== null) allVals.push(theirMax);
    var minVal = Math.min.apply(null, allVals);
    var maxVal = Math.max.apply(null, allVals);
    var yPad = Math.max(1, (maxVal - minVal) * 0.1);
    var yMin = Math.max(0, minVal - yPad);
    var yMax = maxVal + yPad;
    if (yMax === yMin) yMax = yMin + 1;

    var allTimes = [nowMs];
    myPoints.forEach(function(p) { allTimes.push(p[0]); });
    theirPoints.forEach(function(p) { allTimes.push(p[0]); });
    var tMin = Math.min.apply(null, allTimes);
    var tMax = Math.max(nowMs, Math.max.apply(null, allTimes));
    var tSpan = Math.max(86400000 * 7, tMax - tMin); // minimum 7-day window so single-point charts don't collapse
    var tPad = tSpan * 0.03;
    tMin -= tPad;
    tMax += tPad;
    tSpan = tMax - tMin;

    // Chart dimensions
    var W = 360, H = 200;
    var PX = 42, PR = 14, PT = 16, PB = 28;
    var CW = W - PX - PR, CH = H - PT - PB;

    function xOf(t) { return PX + ((t - tMin) / tSpan) * CW; }
    function yOf(v) { return PT + CH - ((v - yMin) / (yMax - yMin)) * CH; }

    // --- Build SVG ---
    var s = '';
    s += '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%; height:auto; display:block; color:var(--text);" xmlns="http://www.w3.org/2000/svg">';

    // Horizontal gridlines + Y labels
    var yTicks = [yMin, (yMin + yMax) / 2, yMax];
    yTicks.forEach(function(v) {
      var yy = yOf(v);
      s += '<line x1="' + PX + '" y1="' + yy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + yy.toFixed(1) + '" stroke="currentColor" opacity="0.1"/>';
      s += '<text x="' + (PX - 6) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" fill="currentColor" opacity="0.5" font-size="10">' + Math.round(v) + '</text>';
    });

    function fmtDate(ms) {
      var d = new Date(ms);
      return (d.getMonth() + 1) + '/' + d.getDate();
    }
    var xTicks = [tMin, tMin + tSpan / 2, tMax];
    xTicks.forEach(function(t) {
      var xx = xOf(t);
      s += '<text x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="currentColor" opacity="0.5" font-size="10">' + fmtDate(t) + '</text>';
    });

    if (theirMin !== null && theirMax !== null && theirPoints.length === 0) {
      var bandTop = yOf(theirMax);
      var bandBottom = yOf(theirMin);
      s += '<rect x="' + PX + '" y="' + bandTop.toFixed(1) + '" width="' + CW + '" height="' + (bandBottom - bandTop).toFixed(1) + '" fill="#B45309" opacity="0.08"/>';
      if (theirAvg !== null) {
        var avgY = yOf(theirAvg);
        s += '<line x1="' + PX + '" y1="' + avgY.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + avgY.toFixed(1) + '" stroke="#B45309" opacity="0.35" stroke-dasharray="3,3"/>';
      }
    }

    theirPoints.forEach(function(p) {
      s += '<circle cx="' + xOf(p[0]).toFixed(1) + '" cy="' + yOf(p[1]).toFixed(1) + '" r="3.5" fill="#B45309" opacity="0.75"/>';
    });

    myPoints.forEach(function(p) {
      var isShared = sharedPoints.some(function(sp) { return sp[0] === p[0] && sp[1] === p[1]; });
      var cx = xOf(p[0]).toFixed(1);
      var cy = yOf(p[1]).toFixed(1);
      if (isShared) {
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.9"/>';
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="var(--accent)" opacity="0.95"/>';
      } else {
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="var(--accent)" opacity="0.6"/>';
      }
    });

    var tx = xOf(nowMs);
    var ty = yOf(todayVal);
    s += '<line x1="' + tx.toFixed(1) + '" y1="' + PT + '" x2="' + tx.toFixed(1) + '" y2="' + (H - PB) + '" stroke="var(--accent)" stroke-width="1" opacity="0.3" stroke-dasharray="2,3"/>';
    s += '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="6.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="2.5"/>';
    s += '<text x="' + tx.toFixed(1) + '" y="' + (ty - 11).toFixed(1) + '" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="600">' + todayVal + '</text>';

    s += '</svg>';

    // Legend
    h += '<div style="display:flex; flex-wrap:wrap; gap:12px 14px; font-size:var(--fs-xs); color:var(--text-dim); margin-bottom:10px; line-height:1.6;">';
    if (theirPoints.length > 0 || (theirMin !== null && theirMax !== null)) {
      h += '<span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#B45309; opacity:0.75; margin-right:5px; vertical-align:middle;"></span>Their history</span>';
    }
    if (myPoints.length > 0) {
      h += '<span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent); opacity:0.6; margin-right:5px; vertical-align:middle;"></span>Your history</span>';
    }
    if (sharedPoints.length > 0) {
      h += '<span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; border:2px solid var(--accent); background:var(--accent); margin-right:5px; vertical-align:middle;"></span>Between you two</span>';
    }
    h += '<span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--accent); border:2px solid var(--bg-raised); box-shadow:0 0 0 1.5px var(--accent); margin-right:5px; vertical-align:middle;"></span>Today\'s proposal</span>';
    h += '</div>';

    h += s;

    // Deviation note — neutral factual comparison
    var referenceAvg = null;
    if (theirPoints.length > 0) {
      var sum = 0;
      theirPoints.forEach(function(p) { sum += p[1]; });
      referenceAvg = sum / theirPoints.length;
    } else if (theirAvg !== null) {
      referenceAvg = theirAvg;
    }

    var note = '';
    if (referenceAvg !== null && referenceAvg > 0) {
      var deviation = ((todayVal - referenceAvg) / referenceAvg) * 100;
      if (Math.abs(deviation) < 15) {
        note = 'Close to their typical';
      } else if (deviation > 0) {
        note = 'Today\'s value is ' + Math.round(deviation) + '% above their typical';
      } else {
        note = 'Today\'s value is ' + Math.round(-deviation) + '% below their typical';
      }
      if (active.type === 'category') note += ' for this category.';
      else if (active.type === 'description') note += ' for this exact service.';
      else note += '.';
    }

    if (theirPoints.length > 0) {
      var sortedTheirs = theirPoints.slice().sort(function(a, b) { return b[0] - a[0]; });
      var mostRecent = sortedTheirs[0];
      var daysAgo = Math.round((nowMs - mostRecent[0]) / 86400000);
      if (daysAgo >= 0 && daysAgo <= 7 && mostRecent[1] !== todayVal && mostRecent[1] > 0) {
        var diffPct = Math.round(((todayVal - mostRecent[1]) / mostRecent[1]) * 100);
        var whenStr = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo + ' days ago';
        note += (note ? ' ' : '') + 'Their last ' + whenStr + ' was ' + mostRecent[1] + ' (' + (diffPct > 0 ? '+' : '') + diffPct + '% change).';
      }
    }

    // Counts summary
    var countParts = [];
    if (myPoints.length > 0) countParts.push(myPoints.length + ' in your chain');
    if (theirPoints.length > 0) countParts.push(theirPoints.length + ' in theirs');
    if (sharedPoints.length > 0) countParts.push(sharedPoints.length + ' between you');
    if (countParts.length > 0) {
      h += '<div style="font-size:var(--fs-sm); color:var(--text-faint); margin-top:12px; line-height:1.5;">';
      h += countParts.join(' \u00b7 ') + '.';
      h += '</div>';
    }

    if (note) {
      h += '<div style="font-size:var(--fs-sm); color:var(--text); margin-top:8px; line-height:1.5;">' + esc(note) + '</div>';
    }

    h += '</div>';
    return h;
  }

  // renderStandingTab — now writes into the wallet modal, not a tab.
  // In v2.58.0 the Standing tab was removed from the bottom nav and its
  // content moved into the wallet modal body (opened via the wallet icon
  // at the top of the device). The function name is kept for continuity
  // with callers, but it now targets 'wallet-standing-content'.
  function renderStandingTab() {
    var el = document.getElementById('wallet-standing-content');
    if (!el) return;
    var ex = state.chain.filter(HCP.isAct);
    var balance = HCP.walletBalance(state.chain);
    var provided = ex.filter(function(r) { return r.energyState === 'provided'; });
    var received = ex.filter(function(r) { return r.energyState === 'received'; });
    var counterparties = {};
    ex.forEach(function(r) { if (r.counterparty) counterparties[r.counterparty] = 1; });
    var cats = {};
    ex.forEach(function(r) { var k = r.category || 'uncategorized'; cats[k] = (cats[k] || 0) + 1; });

    var html = '';

    // Identity panel (collapsible) with three-state photo logic
    var name = state.declarations.name || 'Anonymous';
    var genesisPhoto = '';
    var genesisRec = state.chain.find(function(r) { return r.type === HCP.RECORD_TYPE_GENESIS && r.photoData; });
    if (genesisRec) genesisPhoto = genesisRec.photoData;
    var currentPhoto = state.declarations.photo || '';
    // Determine photo state: 'none', 'genesis', 'both'
    var photoState = 'none';
    if (genesisPhoto && currentPhoto && genesisPhoto !== currentPhoto) photoState = 'both';
    else if (genesisPhoto || currentPhoto) photoState = 'genesis';
    var displayPhoto = currentPhoto || genesisPhoto || '';
    var fp = state.fingerprint || '';
    var decls = [];
    if (state.declarations.skills && state.declarations.skills.length) decls = state.declarations.skills;

    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:16px; box-shadow:var(--shadow); overflow:hidden;">';
    html += '<div style="display:flex; align-items:center; gap:12px; padding:16px; cursor:pointer;" onclick="var p=this.nextElementSibling; p.style.display=p.style.display===\'block\'?\'none\':\'block\'; this.querySelector(\'.id-chev\').style.transform=p.style.display===\'block\'?\'rotate(90deg)\':\'\';">';
    if (displayPhoto) {
      html += '<div style="position:relative; flex-shrink:0;"><img src="' + displayPhoto + '" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid var(--accent);">';
      if (photoState === 'genesis') html += '<div style="position:absolute; bottom:-2px; right:-2px; width:16px; height:16px; border-radius:50%; background:rgba(180,83,9,0.15); border:2px solid var(--bg-raised); display:flex; align-items:center; justify-content:center; font-size:9px; color:#B45309;">!</div>';
      html += '</div>';
    } else {
      html += '<div style="position:relative; flex-shrink:0;"><div style="width:44px; height:44px; border-radius:50%; background:var(--accent-light); border:2px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:20px; color:var(--accent); flex-shrink:0;">' + name.charAt(0).toUpperCase() + '</div>';
      html += '<div style="position:absolute; bottom:-2px; right:-2px; width:16px; height:16px; border-radius:50%; background:rgba(180,83,9,0.15); border:2px solid var(--bg-raised); display:flex; align-items:center; justify-content:center; font-size:9px; color:#B45309;">!</div>';
      html += '</div>';
    }
    html += '<div style="flex:1; min-width:0;">';
    html += '<div style="font-size:var(--fs-lg); font-weight:600; color:var(--text);">' + esc(name) + '</div>';
    html += '<div style="font-size:var(--fs-sm); color:var(--text-faint); font-family:var(--font-mono);">' + esc(fp) + '</div>';
    html += '</div>';
    html += '<span class="id-chev" style="font-size:14px; color:var(--text-faint); transition:transform 0.2s;">&#9656;</span>';
    html += '</div>';
    // Expanded panel
    html += '<div style="display:none; padding:0 16px 16px; border-top:1px solid var(--border);">';

    // Photo state nudges
    if (photoState === 'none') {
      html += '<div style="background:rgba(180,83,9,0.08); border-radius:var(--radius-sm); padding:12px 14px; margin-top:12px; display:flex; gap:12px; align-items:flex-start;">';
      html += '<div style="width:32px; height:32px; border-radius:50%; background:rgba(180,83,9,0.12); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>';
      html += '<div style="flex:1; min-width:0;"><div style="font-size:var(--fs-sm); font-weight:600; color:var(--text); margin-bottom:4px;">Add your genesis photo</div>';
      html += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4; margin-bottom:10px;">Your first photo anchors your identity on-chain. It is how others know your chain started with a real person.</div>';
      html += '<div style="display:flex; gap:12px; align-items:center;">';
      html += '<button style="background:var(--accent); color:#fff; border:none; border-radius:var(--radius-sm); padding:8px 16px; font-size:var(--fs-sm); font-weight:600; cursor:pointer;" onclick="App.openDeclarationsEdit()">Take photo</button>';
      html += '<span style="font-size:var(--fs-sm); color:var(--accent); cursor:pointer; font-weight:500;" onclick="App.openLessonTile(\'sovereignty\')">Learn why</span>';
      html += '</div></div></div>';
    } else if (photoState === 'genesis') {
      // Show genesis photo circle + empty current circle
      html += '<div style="display:flex; justify-content:center; gap:20px; margin:12px 0 16px; padding-bottom:4px;">';
      html += '<div style="text-align:center;"><img src="' + (genesisPhoto || currentPhoto) + '" style="width:56px; height:56px; border-radius:50%; object-fit:cover; border:3px solid var(--accent);"><div style="font-size:10px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Genesis</div></div>';
      html += '<div style="text-align:center;"><div style="width:56px; height:56px; border-radius:50%; border:2px dashed var(--accent); background:var(--accent-light); display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="App.openDeclarationsEdit()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div><div style="font-size:10px; font-weight:600; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Current</div></div>';
      html += '</div>';
      html += '<div style="background:rgba(180,83,9,0.08); border-radius:var(--radius-sm); padding:12px 14px; display:flex; gap:12px; align-items:flex-start;">';
      html += '<div style="width:32px; height:32px; border-radius:50%; background:rgba(180,83,9,0.12); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>';
      html += '<div style="flex:1; min-width:0;"><div style="font-size:var(--fs-sm); font-weight:600; color:var(--text); margin-bottom:4px;">Add a current photo</div>';
      html += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.4; margin-bottom:10px;">A recent photo shows continuity. It tells others the same person is still behind this chain.</div>';
      html += '<div style="display:flex; gap:12px; align-items:center;">';
      html += '<button style="background:var(--accent); color:#fff; border:none; border-radius:var(--radius-sm); padding:8px 16px; font-size:var(--fs-sm); font-weight:600; cursor:pointer;" onclick="App.openDeclarationsEdit()">Update photo</button>';
      html += '<span style="font-size:var(--fs-sm); color:var(--accent); cursor:pointer; font-weight:500;" onclick="App.openLessonTile(\'sovereignty\')">Learn why</span>';
      html += '</div></div></div>';
    } else if (photoState === 'both') {
      // Both photos - toggle view
      html += '<div style="display:flex; justify-content:center; gap:24px; margin:12px 0 16px; padding:4px 0 8px;">';
      html += '<div style="text-align:center; cursor:pointer;" onclick="var g=this.querySelector(\'img\'); var c=this.parentElement.querySelector(\'[data-photo=current]\'); if(g)g.style.border=\'3px solid var(--accent)\'; if(c)c.style.border=\'3px solid transparent\';"><img data-photo="genesis" src="' + genesisPhoto + '" style="width:56px; height:56px; border-radius:50%; object-fit:cover; border:3px solid transparent;"><div style="font-size:10px; font-weight:600; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Genesis</div></div>';
      html += '<div style="text-align:center; cursor:pointer;" onclick="var c=this.querySelector(\'img\'); var g=this.parentElement.querySelector(\'[data-photo=genesis]\'); if(c)c.style.border=\'3px solid var(--accent)\'; if(g)g.style.border=\'3px solid transparent\';"><img data-photo="current" src="' + currentPhoto + '" style="width:56px; height:56px; border-radius:50%; object-fit:cover; border:3px solid var(--accent);"><div style="font-size:10px; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Current</div></div>';
      html += '</div>';
      html += '<div style="background:var(--green-light); border-radius:var(--radius-sm); padding:10px 14px; display:flex; gap:10px; align-items:center;">';
      html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      html += '<span style="font-size:var(--fs-sm); color:var(--green); font-weight:500;">Identity signals complete</span>';
      html += '</div>';
    }

    var aboutText = (state.declarations.about || '').trim();
    if (aboutText) {
      html += '<div style="margin-top:12px; font-size:var(--fs-md); color:var(--text-dim); line-height:1.5;">' + esc(aboutText) + '</div>';
    }
    if (decls.length) {
      html += '<div style="margin-top:12px;"><div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Skills</div>';
      html += '<div style="display:flex; flex-wrap:wrap; gap:6px;">';
      decls.forEach(function(s) { html += '<span style="padding:4px 10px; background:var(--accent-light); color:var(--accent); border-radius:12px; font-size:var(--fs-sm); font-weight:500;">' + esc(s) + '</span>'; });
      html += '</div></div>';
    }
    html += '<button style="width:100%; margin-top:12px; padding:10px; background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); font-size:var(--fs-sm); font-weight:500;" onclick="App.openDeclarationsEdit()">Edit profile</button>';
    html += '</div></div>';

    // Proof of Human verdict card (aggregate for this chain)
    // Absorbs what used to be a separate "Strengthen your chain" nudge card —
    // device-origin rows now carry inline enable toggles when the source
    // is available but not enabled.
    html += renderPOHVerdict({ chain: state.chain, deviceCapabilities: pohDeviceCapabilities() });

    // Participation card (no position/balance shown - person can check via wallet)
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Participation</div>';
    html += '<div style="display:flex; gap:16px; margin-bottom:12px;">';
    html += '<div style="flex:1;"><div style="font-size:var(--fs-xs); color:var(--text-faint);">Provided</div><div style="font-size:var(--fs-lg); font-weight:600; color:var(--green);">' + provided.length + '</div></div>';
    html += '<div style="flex:1;"><div style="font-size:var(--fs-xs); color:var(--text-faint);">Received</div><div style="font-size:var(--fs-lg); font-weight:600; color:var(--accent);">' + received.length + '</div></div>';
    html += '</div>';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="font-size:var(--fs-md); color:var(--text-dim);">People</span><span style="font-size:var(--fs-md); font-weight:600; color:var(--text);">' + Object.keys(counterparties).length + '</span></div>';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="font-size:var(--fs-md); color:var(--text-dim);">Categories</span><span style="font-size:var(--fs-md); font-weight:600; color:var(--text);">' + Object.keys(cats).length + '</span></div>';
    html += '<div style="display:flex; justify-content:space-between;"><span style="font-size:var(--fs-md); color:var(--text-dim);">Total exchanges</span><span style="font-size:var(--fs-md); font-weight:600; color:var(--text);">' + ex.length + '</span></div>';
    // Chain age
    if (state.chain.length > 0) {
      var genesis = new Date(state.chain[0].timestamp);
      var now = new Date();
      var days = Math.floor((now - genesis) / 86400000);
      var ageStr = days === 0 ? 'Today' : days === 1 ? '1 day' : days < 30 ? days + ' days' : days < 365 ? Math.floor(days / 30) + ' months' : Math.floor(days / 365) + 'y ' + Math.floor((days % 365) / 30) + 'm';
      html += '<div style="display:flex; justify-content:space-between; margin-top:8px;"><span style="font-size:var(--fs-md); color:var(--text-dim);">Chain age</span><span style="font-size:var(--fs-md); font-weight:600; color:var(--text);">' + ageStr + '</span></div>';
    }
    html += '</div>';

    if (ex.length === 0) {
      html += '<div style="text-align:center; padding:24px 16px; color:var(--text-dim); font-size:var(--fs-md); line-height:1.6;">';
      html += 'No exchanges yet. Tap <strong>+</strong> to start your first one.';
      html += '</div>';
    } else if (ex.length > 0) {
      // Recent activity (last 3)
      var recent = ex.slice().reverse().slice(0, 3);
      html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
      html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px;">Recent</div>';
      html += '<span style="font-size:var(--fs-sm); color:var(--accent); cursor:pointer;" onclick="App.switchTab(\'history\')">View all</span>';
      html += '</div>';
      recent.forEach(function(r) {
        var desc = r.description || r.category || 'Exchange';
        var isProv = r.energyState === 'provided';
        var valColor = isProv ? 'var(--green)' : 'var(--red)';
        var valSign = isProv ? '+' : '-';
        var ds = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        html += '<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0;' + (r !== recent[recent.length-1] ? ' border-bottom:1px solid var(--border);' : '') + '">';
        html += '<div style="font-size:var(--fs-md); color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; margin-right:12px;">' + esc(desc) + '</div>';
        html += '<div style="display:flex; align-items:center; gap:8px;">';
        html += '<span style="font-size:var(--fs-sm); color:var(--text-faint);">' + ds + '</span>';
        html += '<span style="font-size:var(--fs-md); font-weight:600; color:' + valColor + ';">' + valSign + r.value + '</span>';
        html += '</div></div>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
  }

  function renderHistoryTab() {
    var el = document.getElementById('tab-history-content');
    if (!el) return;
    var ex = state.chain.filter(HCP.isAct).slice().reverse();
    var html = '';
    if (ex.length === 0) {
      html += '<div style="text-align:center; padding:40px 16px; color:var(--text-dim); font-size:var(--fs-md); line-height:1.6;">';
      html += 'Your exchange history will appear here once you complete your first exchange.</div>';
      el.innerHTML = html;
      return;
    }
    html += '<div style="display:flex; gap:8px; margin-bottom:16px; padding-top:4px;">';
    html += '<button class="hist-pill active" data-filter="all" onclick="App.histFilter(\'all\')">All</button>';
    html += '<button class="hist-pill" data-filter="provided" onclick="App.histFilter(\'provided\')">Provided</button>';
    html += '<button class="hist-pill" data-filter="received" onclick="App.histFilter(\'received\')">Received</button>';
    html += '</div>';
    html += '<div id="hist-list">';
    ex.forEach(function(r) {
      var desc = r.description || r.category || 'Exchange';
      var name = state.settings.hideNames ? '' : (r.counterpartyName || (r.counterparty || '').substring(0, 8));
      var ds = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      var ts = new Date(r.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      var isProv = r.energyState === 'provided';
      var valColor = isProv ? 'var(--green)' : 'var(--red)';
      var valSign = isProv ? '+' : '-';
      var bgColor = isProv ? 'var(--green-light)' : 'var(--red-light)';
      // Horizontal arrow (left) + person silhouette (right). Arrow toward person = received, away = provided.
      var arrowIcon = isProv
        ? '<svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="' + valColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="6" x2="2" y2="6"/><polyline points="6 2 2 6 6 10"/></svg>'
        : '<svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="' + valColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="6" x2="12" y2="6"/><polyline points="8 2 12 6 8 10"/></svg>';
      var personIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + valColor + '" stroke="none"><circle cx="12" cy="7" r="4"/><path d="M12 13c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z"/></svg>';
      html += '<div class="hist-row" data-dir="' + r.energyState + '" style="border-bottom:1px solid var(--border); cursor:pointer;" onclick="var d=this.querySelector(\'.hist-detail\'); d.style.display=d.style.display===\'block\'?\'none\':\'block\';">';
      html += '<div style="display:flex; align-items:center; gap:12px; padding:14px 0;">';
      html += '<div style="width:42px; height:32px; border-radius:8px; background:' + bgColor + '; display:flex; align-items:center; justify-content:center; gap:2px; flex-shrink:0;">' + arrowIcon + personIcon + '</div>';
      html += '<div style="flex:1; min-width:0;">';
      html += '<div style="font-size:var(--fs-md); font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(desc) + '</div>';
      html += '<div style="font-size:var(--fs-sm); color:var(--text-faint);">' + (name ? esc(name) + ' \u00b7 ' : '') + ds + ' \u00b7 ' + ts + '</div>';
      html += '</div>';
      html += '<div style="font-size:var(--fs-md); font-weight:600; color:' + valColor + '; white-space:nowrap;">' + valSign + r.value + '</div>';
      html += '</div>';
      // Expandable detail
      html += '<div class="hist-detail" style="display:none; padding:0 0 14px 56px; font-size:var(--fs-sm); color:var(--text-dim); line-height:1.8;">';
      if (r.category) html += '<div><span style="color:var(--text-faint);">Category:</span> ' + esc(r.category) + '</div>';
      if (r.duration) html += '<div><span style="color:var(--text-faint);">Duration:</span> ' + formatDuration(r.duration) + '</div>';
      var fullName = r.counterpartyName || '';
      var fpShort = (r.counterparty || '').substring(0, 16);
      if (fullName) html += '<div><span style="color:var(--text-faint);">With:</span> ' + esc(fullName) + '</div>';
      html += '<div><span style="color:var(--text-faint);">Fingerprint:</span> <span style="font-family:var(--font-mono);">' + esc(fpShort) + '</span></div>';
      html += '<div><span style="color:var(--text-faint);">Sequence:</span> #' + r.seq + '</div>';
      if (r.witnessAttestation) html += '<div style="color:var(--green);">&#10003; Witness attested</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  function histFilter(dir) {
    document.querySelectorAll('.hist-pill').forEach(function(p) {
      p.classList.toggle('active', p.getAttribute('data-filter') === dir);
    });
    document.querySelectorAll('.hist-row').forEach(function(row) {
      if (dir === 'all') row.style.display = '';
      else row.style.display = row.getAttribute('data-dir') === dir ? '' : 'none';
    });
  }

  function renderLearnTab() {
    var el = document.getElementById('tab-learn-content');
    if (!el) return;
    if (el.getAttribute('data-rendered')) return;
    el.setAttribute('data-rendered', '1');
    var done = _getLessonCompleted();

    // Topic groups with their lesson keys
    var topicGroups = [
      { title: 'Getting Started', icon: '&#127793;', description: 'Learn the basics of cooperative exchange', lessons: [
        { key: 'act', title: 'The Cooperative Act' },
        { key: 'value', title: 'Value Is Yours' },
        { key: 'calibrate', title: 'Find Your Unit' },
      ]},
      { title: 'Understanding Your Chain', icon: '&#128279;', description: 'How your cooperation record works', lessons: [
        { key: 'foundations', title: 'Foundations' },
        { key: 'pricing', title: 'Price Discovery' },
        { key: 'exchange', title: 'Exchange & Parity' },
      ]},
      { title: 'The Bigger Picture', icon: '&#127760;', description: 'Why cooperative exchange matters', lessons: [
        { key: 'beyond', title: 'Beyond the Moment' },
        { key: 'community', title: 'Building Community' },
        { key: 'sovereignty', title: 'Your Phone, Your Server' },
        { key: 'privacy', title: 'Privacy & Safety' },
      ]},
    ];

    var html = '<div style="padding-top:4px;">';
    html += '<div style="margin-bottom:16px;"><div style="font-size:var(--fs-xl); font-weight:500; color:var(--text);">Learn</div>';
    html += '<div style="font-size:var(--fs-sm); color:var(--text-faint);">Understanding builds trust</div></div>';

    topicGroups.forEach(function(group, gi) {
      var totalLessons = group.lessons.length;
      var doneLessons = group.lessons.filter(function(l) { return done[l.key]; }).length;
      var allDone = doneLessons === totalLessons;
      var groupId = 'learn-group-' + gi;

      html += '<div class="ltab-card">';
      // Topic header
      html += '<button class="ltab-header" onclick="var el=document.getElementById(\'' + groupId + '\'); var chev=this.querySelector(\'.ltab-chev\'); if(el.style.display===\'block\'){el.style.display=\'none\'; chev.classList.remove(\'open\');}else{el.style.display=\'block\'; chev.classList.add(\'open\');}">';
      html += '<span class="ltab-icon">' + group.icon + '</span>';
      html += '<div style="flex:1; min-width:0;"><div class="ltab-title">' + group.title + '</div>';
      html += '<div class="ltab-sub">' + (allDone ? 'Completed' : doneLessons + ' of ' + totalLessons + ' lessons') + '</div></div>';
      if (allDone) {
        html += '<div class="ltab-done"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>';
      } else {
        html += '<span class="ltab-chev">&#9662;</span>';
      }
      html += '</button>';

      // Progress bar (partial completion)
      if (doneLessons > 0 && !allDone) {
        html += '<div class="ltab-progress"><div class="ltab-progress-fill" style="width:' + (doneLessons / totalLessons * 100) + '%"></div></div>';
      }

      // Lessons list (hidden by default)
      html += '<div class="ltab-lessons" id="' + groupId + '" style="display:none;">';
      group.lessons.forEach(function(lesson, li) {
        var isDone = done[lesson.key];
        var topic = LEARN_TOPICS[lesson.key];
        var stepCount = topic ? topic.slides.length : 0;
        html += '<button class="ltab-lesson" onclick="App.openLessonTile(\'' + lesson.key + '\')">';
        if (isDone) {
          html += '<div class="ltab-num done"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>';
        } else {
          html += '<div class="ltab-num pending">' + (li + 1) + '</div>';
        }
        html += '<div style="flex:1; min-width:0;"><div class="ltab-lesson-title" style="' + (isDone ? 'color:var(--text-dim);' : '') + '">' + lesson.title + '</div>';
        html += '<div class="ltab-lesson-steps">' + stepCount + ' steps</div></div>';
        html += '<span style="font-size:14px; color:var(--text-faint);">&#8250;</span>';
        html += '</button>';
      });
      html += '</div>';

      html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  function renderSettingsTab() {
    var el = document.getElementById('tab-settings-content');
    if (!el) return;
    var html = '';

    // Privacy
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; margin-top:4px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Privacy</div>';
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
    html += '<div><div style="font-size:var(--fs-md); color:var(--text);">Hide counterparty names</div><div style="font-size:var(--fs-sm); color:var(--text-faint);">Names hidden in shared data</div></div>';
    html += '<div class="switch ' + (state.settings.hideNames ? 'on' : '') + '" id="switch-hide-names-tab" onclick="App.togglePrivacy()"></div>';
    html += '</div></div>';

    // Proof of Human
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Proof of Human</div>';
    html += '<div style="font-size:var(--fs-sm); color:var(--text-dim); line-height:1.6; margin-bottom:14px;">Your phone captures glimpses of physical reality during each exchange. Only hashes are stored. Raw data never leaves your device.</div>';
    // Motion toggle
    html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">';
    html += '<div><div style="font-size:var(--fs-md); color:var(--text);">Motion sensors</div><div style="font-size:var(--fs-sm); color:var(--text-faint);">Proves a real hand holds a real phone</div></div>';
    html += '<div class="switch ' + (state.settings.sensorMotion ? 'on' : '') + '" id="switch-motion-tab" onclick="App.toggleMotionTab()"></div>';
    html += '</div>';
    // Location toggle
    html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">';
    html += '<div><div style="font-size:var(--fs-md); color:var(--text);">Location</div><div style="font-size:var(--fs-sm); color:var(--text-faint);">Proves your chain spans real places over time</div></div>';
    html += '<div class="switch ' + (state.settings.locationAuto ? 'on' : '') + '" id="switch-location-tab" onclick="App.toggleLocationTab()"></div>';
    html += '</div>';
    // Passive sensor status
    var statusParts = [];
    if (_sensor.battery) statusParts.push('Battery');
    if (_sensor.network) statusParts.push('Network');
    if (_sensor.light !== null) statusParts.push('Light');
    if (_sensor.pressure !== null) statusParts.push('Pressure');
    html += '<div style="font-size:var(--fs-sm); color:var(--text-faint); padding-top:10px; line-height:1.5;">';
    if (statusParts.length) {
      html += 'Captured automatically: ' + statusParts.join(', ');
    } else {
      html += 'Passive sensors will activate when available';
    }
    html += '</div>';
    html += '</div>';

    // Network
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Network</div>';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:var(--text-dim);">Witness server</span><span style="color:var(--text); font-size:var(--fs-sm);">' + esc(getWitnessUrl() || 'None') + '</span></div>';
    html += '<div id="settings-witness-status" style="font-size:var(--fs-sm); color:var(--text-faint); margin-bottom:8px;"></div>';
    html += '<button style="width:100%; padding:10px; background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); font-size:var(--fs-sm); font-weight:500;" onclick="App.testWitnessConnection()">Test connection</button>';
    html += '</div>';

    // Data
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Data</div>';
    html += '<div style="display:flex; gap:10px; margin-bottom:10px;">';
    html += '<button style="flex:1; padding:10px; background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); font-size:var(--fs-sm); font-weight:500;" onclick="App.exportBackup()">Export backup</button>';
    html += '<button style="flex:1; padding:10px; background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); font-size:var(--fs-sm); font-weight:500;" onclick="App.importBackup()">Import backup</button>';
    html += '</div>';
    // Chain tools
    html += '<div style="border-top:1px solid var(--border); padding-top:10px;">';
    html += '<div style="display:flex; align-items:center; padding:10px 0; cursor:pointer;" onclick="App.openChainViewer()">';
    html += '<span style="flex:1; font-size:var(--fs-md); color:var(--text);">View full chain</span>';
    html += '<span style="font-size:14px; color:var(--text-faint);">&#8250;</span></div>';
    html += '<div style="display:flex; align-items:center; padding:10px 0; cursor:pointer;" onclick="App.openMyTexture()">';
    html += '<span style="flex:1; font-size:var(--fs-md); color:var(--text);">Chain health</span>';
    html += '<span style="font-size:14px; color:var(--text-faint);">&#8250;</span></div>';
    html += '<div style="display:flex; align-items:center; padding:10px 0; cursor:pointer;" onclick="App.openMyPricing()">';
    html += '<span style="flex:1; font-size:var(--fs-md); color:var(--text);">Pricing history</span>';
    html += '<span style="font-size:14px; color:var(--text-faint);">&#8250;</span></div>';
    html += '</div></div>';

    // Security
    html += '<div style="background:var(--bg-raised); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; box-shadow:var(--shadow);">';
    html += '<div style="font-size:var(--fs-xs); color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Security</div>';
    html += '<button style="width:100%; padding:10px; background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); font-size:var(--fs-sm); font-weight:500; margin-bottom:8px;" onclick="App.changePIN()">Change PIN</button>';
    html += '<button style="width:100%; padding:10px; background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); font-size:var(--fs-sm); font-weight:500;" onclick="App.installFromSettings()">Install to home screen</button>';
    html += '<button style="width:100%; padding:10px; background:none; border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--accent); font-size:var(--fs-sm); font-weight:500; margin-top:8px;" onclick="App.forceUpdate()">Check for updates</button>';
    html += '</div>';

    // Danger zone
    html += '<div style="background:var(--bg-raised); border:1px solid var(--red-light); border-radius:var(--radius); padding:16px; margin-bottom:16px;">';
    html += '<div style="font-size:var(--fs-xs); color:var(--red); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Danger zone</div>';
    html += '<button style="width:100%; padding:10px; background:none; border:1px solid var(--red); border-radius:var(--radius-sm); color:var(--red); font-size:var(--fs-sm); font-weight:500;" onclick="App.deleteChain()">Delete chain</button>';
    html += '<div style="font-size:var(--fs-sm); color:var(--text-faint); margin-top:8px; line-height:1.5;">This permanently deletes your chain and keys. Export a backup first.</div>';
    html += '</div>';

    // Version
    html += '<div style="text-align:center; padding:16px 0; color:var(--text-faint); font-size:var(--fs-sm);">HEP v' + APP_VERSION + '</div>';

    el.innerHTML = html;
  }

  function shareApp() {
    var url = getAppBase();
    if (navigator.share) {
      navigator.share({ title: 'Human Exchange Protocol', text: 'Record cooperative acts between people.', url: url }).catch(function() {});
    } else {
      try { navigator.clipboard.writeText(url); toast('Link copied'); } catch(e) { toast('Share not available'); }
    }
  }

  var fabOpen = false;
  function toggleFab() {
    // Legacy — no-op now, kept for any remaining references
  }

  function fabAction(action) {
    // Legacy — redirect to new functions
    if (action === 'provide') fabNew();
    else if (action === 'join') exJoinExchange();
  }

  function fabNew() {
    var url = getWitnessUrl();
    if (!url) { openCooperate(); return; }

    exFlowActive = true;
    cleanupSession();
    showModal('exchange');
    document.getElementById('exchange-header').textContent = 'New Exchange';
    showExStep('connect');

    var html = '<div style="text-align:center; margin-bottom:24px; padding-top:8px;">';
    html += '<div style="font-size:17px; font-weight:600; color:var(--text); margin-bottom:6px;">How are you connecting?</div>';
    html += '<div style="font-size:14px; color:var(--text-dim);">Both people need to start an exchange</div>';
    html += '</div>';

    // Two equal buttons
    html += '<div style="display:flex; flex-direction:column; gap:12px;">';

    html += '<button style="width:100%; padding:20px 16px; background:var(--bg-raised); border:1.5px solid var(--accent); border-radius:var(--radius); cursor:pointer; text-align:left; display:flex; align-items:center; gap:14px;" onclick="App.exStartProviding()">';
    html += '<div style="width:44px; height:44px; border-radius:50%; background:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>';
    html += '<div><div style="font-size:16px; font-weight:600; color:var(--text);">Start</div>';
    html += '<div style="font-size:13px; color:var(--text-dim);">Generate a code for the other person to enter</div></div>';
    html += '</button>';

    html += '<button style="width:100%; padding:20px 16px; background:var(--bg-raised); border:1.5px solid var(--border); border-radius:var(--radius); cursor:pointer; text-align:left; display:flex; align-items:center; gap:14px;" onclick="App.exJoinExchange()">';
    html += '<div style="width:44px; height:44px; border-radius:50%; background:var(--bg-input); border:1.5px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></div>';
    html += '<div><div style="font-size:16px; font-weight:600; color:var(--text);">Join</div>';
    html += '<div style="font-size:13px; color:var(--text-dim);">Enter the code the other person gave you</div></div>';
    html += '</button>';

    html += '</div>';
    document.getElementById('ex-connect-content').innerHTML = html;
  }

  function fabUse() {
    var ex = state.chain.filter(HCP.isAct).slice().reverse();
    if (ex.length === 0) {
      toast('No previous exchanges to reuse');
      fabNew();
      return;
    }

    // Build picker modal
    showModal('use-picker');
    var modal = document.getElementById('use-picker-body');
    if (!modal) return;

    var html = '<div style="font-size:var(--fs-sm); color:var(--text-faint); margin-bottom:12px;">Tap an exchange to use it as a template</div>';
    // Deduplicate by description
    var seen = {};
    var unique = [];
    ex.forEach(function(r) {
      var key = (r.description || '') + '|' + (r.category || '') + '|' + r.value;
      if (!seen[key] && unique.length < 15) {
        seen[key] = true;
        unique.push(r);
      }
    });

    unique.forEach(function(r, i) {
      var desc = r.description || r.category || 'Exchange';
      var isProv = r.energyState === 'provided';
      var valColor = isProv ? 'var(--green)' : 'var(--accent)';
      var dirLabel = isProv ? 'Provided' : 'Received';
      var cat = r.category || '';
      html += '<button style="width:100%; display:flex; align-items:center; gap:12px; padding:14px 0; border:none; background:none; cursor:pointer; text-align:left; font-family:var(--font);' + (i < unique.length - 1 ? ' border-bottom:1px solid var(--border);' : '') + '" onclick="App.fabUseSelect(' + i + ')">';
      html += '<div style="flex:1; min-width:0;">';
      html += '<div style="font-size:var(--fs-md); font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + esc(desc) + '</div>';
      html += '<div style="font-size:var(--fs-sm); color:var(--text-faint);">' + (cat ? esc(cat) + ' · ' : '') + dirLabel + '</div>';
      html += '</div>';
      html += '<div style="font-size:var(--fs-md); font-weight:600; color:' + valColor + ';">' + r.value + '</div>';
      html += '</button>';
    });
    modal.innerHTML = html;

    // Store the unique list for selection
    window._fabUseList = unique;
  }

  function fabUseSelect(idx) {
    var list = window._fabUseList;
    if (!list || !list[idx]) return;
    var act = list[idx];
    closeModal('use-picker');
    // Store prefill data — will be applied when form step renders
    window._fabPrefill = {
      description: act.description || '',
      value: act.value || '',
      category: act.category || '',
      duration: act.duration || 0,
      energyState: act.energyState || 'provided',
      city: act.city || '',
      state_field: act.state_field || ''
    };
    // Start exchange flow
    exInitiatorRole = act.energyState === 'provided' ? 'provider' : 'receiver';
    exBeginStart();
  }

  return {
    init, setupStep, completeSetup: completeSetupWrapped,
    switchTab, histFilter, shareApp, toggleFab, fabAction, fabNew, fabUse, fabUseSelect,
    capturePhoto, uploadPhoto, handlePhotoFile, submitDeclarations, skipDeclarations, rangeUpdate, submitRange, skipRange, rangeNav, toggleValTag,
    setupToggleLocation, setupToggleMotion, submitSensors,
    addSkill, removeSkill, toggleSkillPicker,
    showFullQR, closeFullQR,
    openCooperate, coopNewAct, coopReuseAct,
    startCooperateFlow, toggleCoopStart, exStartProviding, exStartReceiving, exJoinExchange, exSwitchToJoin, exCodeInput, exConnect, exConfirmSAS, exRejectSAS, exReviewConfirm, exContinueFromTexture, exBackToTexture, exSelectRole, exViewProposal,
    openExchange, closeExchange, setDirection, generateProposal, copyProposal, shareProposal,
    selectTransport, switchTransport, initiatorConfirmScan, initiatorConfirmSent, initiatorReadyScan, initiatorGoBack,
    pairCodeInput, submitPairCode,
    coopReceiveProposal, sessionCodeInput, sessionConnect, sessionConfirm, sessionReject, sendSessionProposal, sessionThreadTab,
    setProposalPath, scanConfirmation, parseExConfirmation, parseExConfirmationMsg,
    finishExchange, settleViaMessage, shareSettlement, copySettlement,
    shareChain, shareChainFromViewer, showIncomingChainView, incomingChainTab, wordCloudDetail, viewProposalChain, copyChainShare, shareChainShareText,
    openConfirm, closeConfirm, parseCfProposal, confirmAndSign, cancelConfirm, openCamera,
    cfGoStep, setCfRecvCat, setCfProvCat, cfUpdSlider, cfEditValue, cfCommitEdit,
    setCfReturnPath, cfConfirmTheyScanned, waitForSettlement, parseSettlement,
    copyReturn, shareReturn,
    showTextureDetail, closeTextureDetail, toggleServiceCat,
    openChainViewer, chainTab, chainDirFilter, openMyTexture, openMyPricing,
    openMyTextureFromWallet, openMyPricingFromWallet, openChainViewerFromWallet, showMyPhotos,
    openWallet, openRecentActs, filterRecentActs,
    openPending, deletePendingItem, deleteAllPending, resumePending, clearPrefill,
    togglePasteMode, inviteViaText, inviteViaQR,
    openShare, copyShareLink, copyShareLinkRef, shareViaSystem,
    openLearn, learnOpen, learnBack, learnPrev, learnNext, calUpdate,
    openLessonTile, lessonClose, lessonNext, lessonPrev,
    openDeclarationsEdit, editCapturePhoto, editUploadPhoto, handleEditPhotoFile, saveDeclarationsEdit,
    openDeclareRange, declareRangeUpdate, submitDeclareRange, dismissRangePrompt,
    openSettings, togglePrivacy, toggleLocation, toggleMotion, toggleMotionTab, toggleLocationTab,
    togglePOHSignals, togglePOHSignalDetail, openPOHTechnical,
    setPricingFilter, homeFilter,
    testWitnessConnection,
    exportBackup: exportBackupAction, importBackup: importBackupAction, handleImportFile,
    changePIN, installFromSettings, forceUpdate, deleteChain, closeModal,
    installApp, dismissInstall, skipInstallFirst,
  };
})();

// Viewport height fix for mobile browsers
function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}
setVH();
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', () => setTimeout(setVH, 100));

document.addEventListener('DOMContentLoaded', App.init);
