// ============================================================
// APPLICATION LAYER v2.34.2
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
    // Accelerometer
    window.addEventListener('devicemotion', function(e) {
      var a = e.accelerationIncludingGravity;
      if (a && (a.x !== null || a.y !== null || a.z !== null)) {
        _sensor.accel = { x: a.x, y: a.y, z: a.z };
      }
    });
    // Gyroscope
    window.addEventListener('deviceorientation', function(e) {
      if (e.alpha !== null || e.beta !== null || e.gamma !== null) {
        _sensor.gyro = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
      }
    });
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
    settings: { locationAuto: false, hideNames: true, hideLocations: true, witnessUrl: DEFAULT_WITNESS_URL },
    direction: 'provided',
    pendingHandshake: null,
    proposalPath: 'inperson',
    settlementPayload: null,
    doneSummary: '',
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
    state.settings = Object.assign({ locationAuto: false, hideNames: true, hideLocations: true, witnessUrl: DEFAULT_WITNESS_URL }, d.settings || {});
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
  function submitDeclarations() { state.declarations.about = document.getElementById('setup-about').value.trim(); setupStep('range'); }
  function skipDeclarations() { setupStep('range'); }

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
    html += '<div style="position:absolute; left:0; top:0; bottom:0; width:' + barPct + '%; background:rgba(125,204,123,0.3); border-radius:8px 0 0 8px;"></div>';
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
    setupStep('generating');
    generateIdentity(state.pin);
  }

  function skipRange() {
    // Save name from the name step
    state.declarations.name = (document.getElementById('setup-name-input').value || '').trim();
    // Range stays at 0/empty — pending state
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
  function completeSetup() { showScreen('home'); refreshHome(); checkPingOnOpen(); }

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
    ['ex-desc','ex-value','ex-category','ex-hours','ex-minutes','ex-city','ex-state'].forEach(id => document.getElementById(id).value = '');
    setDirection('provided');
    // Deselect skills
    document.querySelectorAll('#ex-skill-chips .skill-pick.selected').forEach(c => c.classList.remove('selected'));
    toast('Cleared');
  }

  function refreshHome() {
    const name = state.declarations.name;
    document.getElementById('home-greeting').textContent = name ? name + '\u2019s Thread' : 'Your Thread';
    var vb = document.getElementById('app-version-badge');
    if (vb) vb.textContent = 'HEP v' + APP_VERSION;
    // Hide "Received a proposal?" when online
    var recvBtn = document.querySelector('.coop-receive-btn');
    if (recvBtn) recvBtn.parentElement.style.display = navigator.onLine ? 'none' : 'block';
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
        html += '<div style="padding:16px; background:rgba(224,180,138,0.08); border:1px solid var(--accent-dim); border-radius:var(--radius); margin-bottom:16px; line-height:1.6;">';
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
      rangeNudge = '<div style="padding:12px 14px; background:rgba(224,180,138,0.08); border:1px solid var(--accent-dim); border-radius:var(--radius); margin-bottom:14px; font-size:14px; color:var(--text-dim); line-height:1.5;">' +
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
      const dirColor = act.energyState === 'provided' ? 'rgba(125,204,123,0.15)' : 'rgba(217,106,106,0.15)';
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

  function setDirection(dir) {
    state.direction = dir;
    const btns = document.getElementById('dir-toggle').children;
    btns[0].className = dir === 'provided' ? 'active providing' : '';
    btns[1].className = dir === 'received' ? 'active receiving' : '';
  }

  async function generateProposal() {
    const val = parseFloat(document.getElementById('ex-value').value);
    if (isNaN(val) || val < 0) { toast('Enter a valid value'); return; }
    const desc = document.getElementById('ex-desc').value.trim();
    if (!desc) { toast('Enter a description'); return; }

    // Append selected skills to description
    const selectedSkills = getSelectedSkills();
    const fullDesc = selectedSkills.length ? desc + ' [Skills: ' + selectedSkills.join(', ') + ']' : desc;

    const hrs = parseInt(document.getElementById('ex-hours').value) || 0;
    const mins = parseInt(document.getElementById('ex-minutes').value) || 0;
    const totalMins = (hrs * 60) + mins;

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
    showExStep('done');
    document.getElementById('ex-done-summary').textContent =
      (half.direction === 'provided' ? 'Provided' : 'Received') + ': ' + half.description + ' — ' + half.value + ' units';

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

      // Build thread snapshot for sharing
      let threadSnap = null;
      try {
        if (state.chain.length > 0) {
          threadSnap = HCP.chainSnapshot(state.chain);
        } else {
          threadSnap = { n: 0, d: 0, g: 0, r: 0, cats: {}, words: {}, time: {}, stab: {}, t0: null, t1: null };
        }
      } catch(snapErr) {
        console.error('[session] Thread snapshot FAILED:', snapErr);
        // Fallback: build a minimal snapshot manually
        try {
          var fbDensity = 0;
          try { fbDensity = +HCP.chainDensity(state.chain).toFixed(1); } catch(de) {}
          var fbEx = state.chain.filter(HCP.isAct);
          threadSnap = {
            n: fbEx.length,
            g: fbEx.filter(function(r){ return r.energyState === 'provided'; }).length,
            r: fbEx.filter(function(r){ return r.energyState === 'received'; }).length,
            d: fbDensity,
            cats: {},
            words: {},
            time: {},
            stab: {},
            t0: state.chain[0] ? state.chain[0].timestamp : null,
            t1: state.chain[state.chain.length-1] ? state.chain[state.chain.length-1].timestamp : null
          };
        } catch(e2) {
        }
      }
      // Attach range exercise data to snapshot
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
        // Include genesis photo for counterparty comparison
        var genesisRec = state.chain.find(function(r) { return r.type === HCP.RECORD_TYPE_GENESIS && r.photoData; });
        if (genesisRec) threadSnap._genesisPhoto = genesisRec.photoData;
      }

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
          thread_snapshot: threadSnap ? JSON.stringify(threadSnap) : null,
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
        onSessionConnected();
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
        h += '<span style="font-size:' + size + 'px;opacity:' + opacity + ';color:var(--accent);font-weight:500;padding:4px 8px;background:rgba(224,180,138,0.08);border-radius:6px;">' + esc(word) + '<sub style="font-size: 13px;color:var(--text-faint);margin-left:2px;">' + count + '</sub></span>';
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
        h += '<div style="position:absolute;left:' + minPct + '%;width:' + (maxPct - minPct) + '%;top:4px;height:16px;background:rgba(224,180,138,0.2);border-radius:3px;"></div>';
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
      h += '<div style="margin-top:14px;padding:12px;background:rgba(224,180,138,0.08);border:1px solid var(--accent-dim);border-radius:var(--radius-sm);text-align:center;">';
      h += '<div style="font-size: 13px;color:var(--text-dim);margin-bottom:4px;">Your proposal: ' + propVal + ' units (' + esc(proposalCat) + ')</div>';
      h += '<div style="font-size:20px;font-weight:500;color:var(--accent);">\u2248 ' + converted + ' in their units</div>';
      h += '<div style="font-size: 13px;color:var(--text-faint);margin-top:4px;">Using ' + rateLabel + ' rate</div>';
      h += '</div>';
    }

    h += '<p style="font-size: 13px;color:var(--text-faint);margin-top:14px;line-height:1.5;">' + (isParity ? 'Near parity. Your unit scales are roughly equivalent.' : 'Different densities. The ratio adjusts so both sides are honestly represented. Neither unit is worth more \u2014 they measure at different scales.') + '</p>';
    return h;
  }

  function onSessionConnected() {
    document.getElementById('session-status-line').textContent = 'Connected';
    const content = document.getElementById('session-content');
    content.style.display = 'block';
    sessionActiveTab = 'texture';

    // Partner info
    let html = '<div class="session-partner">' +
      '<div class="sp-label">Connected to</div>' +
      '<div class="sp-fp">' + esc((sessionPartner.fingerprint || '').substring(0, 16) + '...') + '</div>' +
      '</div>';

    // Interactive thread viewer tabs
    const ts = sessionPartner.thread_snapshot;
    if (ts && ts.n) {
      html += '<div style="margin-bottom:16px;">';
      html += buildSessionTabBar();
      html += '<div class="sess-tab-content" id="sess-tab-body">' + renderSessionTabContent('texture') + '</div>';
      html += '</div>';
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
      html += '<button class="btn btn-primary" style="margin-top:16px;" onclick="App.sendSessionProposal()">Send proposal</button>';
      content.innerHTML = html;
    } else {
      html += '<div class="pair-status resolving" style="margin-top:16px;" id="session-waiting-proposal">' +
        '<div class="ps-icon">&#9203;</div>' +
        '<div class="ps-text">Exploring their thread. Their proposal will appear here when they send it.</div></div>';
      content.innerHTML = html;
      startSessionPoll();
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

      const resp = await serverFetch(url + '/session/' + sessionCode + '/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: pp.details.value,
          direction: pp.details.energyState,
          description: pp.details.description,
          category: pp.details.category || '',
          duration: pp.details.duration || 0,
          device_ts: Date.now(),
          sensor_hash: _cachedDeviceHash,
          platform: navigator.platform,
          geo: _cachedGeo ? JSON.stringify(_cachedGeo) : '',
          device_hash: _cachedDeviceHash,
          photo: state.declarations.photo || '',
          photo_hash: proposePhotoHash,
        }),
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
      const data = await resp.json();

      // First: check for connection if not yet connected
      if (!sessionPartner && data.connected) {
        sessionPartner = data.partner;
        stopSessionPoll();
        onSessionConnected();
        return;
      }

      // Check for proposal (confirmer path)
      if (sessionRole === 'confirmer' && data.proposal && data.proposal.status === 'pending') {
        stopSessionPoll();
        sessionProposal = data.proposal;
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

    // 3. Clock skew: delta between counterparty's device timestamp and ours
    try {
      var counterpartyTs = null;
      if (role === 'confirmer') {
        // Confirmer: the proposer's device_ts is on the proposal
        counterpartyTs = p.device_ts || (data.proposal && data.proposal.device_ts);
      } else {
        // Proposer: the confirmer's device_ts comes back as confirmer_device_ts
        counterpartyTs = (data.proposal && data.proposal.confirmer_device_ts) || p.confirmer_device_ts;
      }
      if (typeof counterpartyTs === 'number') {
        record.clockSkew = Date.now() - counterpartyTs;
      }
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

    // Show done
    showExStep('done');
    document.getElementById('ex-done-summary').textContent =
      (myDirection === 'provided' ? 'Provided' : 'Received') + ': ' + (p.description || '') + ' — ' + p.value + ' units';

    refreshHome();
    toast('Exchange complete');
  }

  function cleanupSession() {
    stopSessionPoll();
    sessionCode = null;
    sessionTheirCode = null;
    sessionPartner = null;
    sessionProposal = null;
    sessionRole = null;
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
    state.doneSummary = dirLabel + ' ' + h.details.value + ' for "' + h.details.description + '" — recorded.';

    // Clear pending
    const pending = loadPending();
    const match = pending.findIndex(p => p.role === 'initiator' && p.description === h.details.description && p.value === h.details.value);
    if (match >= 0) { pending.splice(match, 1); savePending(pending); }

    // Clear form
    ['ex-desc','ex-value','ex-category','ex-hours','ex-minutes','ex-city','ex-state'].forEach(id => document.getElementById(id).value = '');
    state.pendingProposal = null;
    localStorage.removeItem('hcp_pending_proposal');

    if (relayDelivered) {
      // Server delivered the settlement — skip the QR, go straight to done
      document.getElementById('ex-done-summary').textContent = state.doneSummary;
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
        h += '<span style="font-size:' + size + 'px;opacity:' + opacity + ';color:var(--accent);font-weight:500;cursor:pointer;padding:4px 8px;background:rgba(224,180,138,0.08);border-radius:6px;" onclick="App.wordCloudDetail(\'' + esc(word) + '\')">' + esc(word) + '<sub style="font-size: 13px;color:var(--text-faint);margin-left:2px;">' + count + '</sub></span>';
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

      let h = '<div style="text-align:center;padding:20px;border-radius:var(--radius);margin-bottom:16px;background:' + (isParity ? 'rgba(125,204,123,0.1)' : 'rgba(107,143,199,0.1)') + ';border:1px solid ' + (isParity ? 'var(--green)' : 'var(--blue)') + ';">';
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
        h += '<div style="position:absolute;left:' + minPct + '%;width:' + (maxPct - minPct) + '%;top:4px;height:16px;background:rgba(224,180,138,0.2);border-radius:3px;"></div>';
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
    document.getElementById('ex-done-summary').textContent = state.doneSummary || 'Exchange recorded.';
    showExStep('done');
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
    var html = '<div style="padding:16px; background:rgba(125,204,123,0.04); border:1px solid rgba(125,204,123,0.12); border-radius:var(--radius); overflow:hidden;">';
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
      dirFilter += '<button class="filter-chip" data-dir="provided" onclick="App.chainDirFilter(\'provided\')" style="border-color:rgba(125,204,123,0.3);">Provided</button>';
      dirFilter += '<button class="filter-chip" data-dir="received" onclick="App.chainDirFilter(\'received\')" style="border-color:rgba(107,143,199,0.3);">Received</button>';
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
          h += '<span style="font-size:' + size + 'px;opacity:' + opacity + ';color:var(--accent);font-weight:500;padding:4px 8px;background:rgba(224,180,138,0.08);border-radius:6px;">' + esc(word) + '<sub style="font-size: 13px;color:var(--text-faint);margin-left:2px;">' + count + '</sub></span>';
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
          h += '<div style="position:absolute;left:' + minPct + '%;width:' + (maxPct - minPct) + '%;top:4px;height:16px;background:rgba(224,180,138,0.2);border-radius:3px;"></div>';
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
    const prompt = body.querySelector('[style*="rgba(224,180,138"]');
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

  // Wrapper for all server fetch calls — adds headers needed for tunneling services
  function serverFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'ngrok-skip-browser-warning': '1' }, opts.headers || {});
    return fetch(url, opts);
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
        const banner = document.getElementById('update-banner');
        const bannerText = document.getElementById('update-banner-text');
        const bannerLink = document.getElementById('update-banner-link');
        if (banner) {
          bannerText.textContent = 'Version ' + data.version + ' is available.';
          if (data.url) bannerLink.href = data.url;
          banner.classList.add('show');
        }
      }
    } catch(e) { /* silent -- version check is optional */ }
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
    testWitnessConnection();
  }

  function togglePrivacy(key) {
    state.settings[key] = !state.settings[key];
    document.getElementById('switch-hide-names').classList.toggle('on', state.settings.hideNames);
    document.getElementById('switch-hide-location').classList.toggle('on', state.settings.hideLocations);
    save();
  }

  function toggleLocation() {
    state.settings.locationAuto = !state.settings.locationAuto;
    document.getElementById('switch-location').classList.toggle('on', state.settings.locationAuto);
    save();
    if (state.settings.locationAuto) navigator.geolocation?.getCurrentPosition(() => toast('Location enabled'), () => { state.settings.locationAuto = false; document.getElementById('switch-location').classList.remove('on'); save(); toast('Location denied'); });
  }

  async function exportBackupAction() {
    try {
      const bk = await HCP.exportBackup(state.chain, state.publicKeyJwk, state.privateKeyJwk, state.pin);
      bk.declarations = state.declarations;
      bk.settings = state.settings;
      const blob = new Blob([JSON.stringify(bk, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0,19)}_hep-backup-${state.fingerprint.slice(0,8)}.json`;
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

  function getAppBase() {
    return window.location.href.split('?')[0].replace(/\/+$/, '') + '/';
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
      navigator.serviceWorker.register('./sw.js').catch(function(e) {
        console.log('[SW] Registration failed:', e.message);
      });
    }
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

    var roleLabel = exInitiatorRole === 'provider' ? 'PROVIDING' : 'RECEIVING';
    var roleColor = exInitiatorRole === 'provider' ? 'var(--green)' : 'var(--blue)';

    var html = '<div style="text-align:center; margin-bottom:16px;">';
    html += '<div style="font-size:11px; color:var(--text-faint); letter-spacing:1px; margin-bottom:4px;">STEP 1 OF 5 \u00b7 ' + roleLabel + '</div>';
    html += '<div style="font-size:17px; font-weight:600; color:var(--text);">Your code</div>';
    html += '</div>';
    html += '<div class="pair-code-display">';
    html += '<div class="pair-code-chars" style="color:' + roleColor + '; border-color:' + roleColor + ';">' + esc(sessionCode) + '</div>';
    html += '<div class="pair-code-hint">Read this to the other person</div>';
    html += '</div>';
    html += '<div style="display:flex; align-items:center; gap:8px; justify-content:center; margin-top:20px;">';
    html += '<div style="width:8px; height:8px; border-radius:50%; background:var(--accent); animation:pulse 1.5s infinite;"></div>';
    html += '<span style="font-size:13px; color:var(--accent);">Waiting for them to join...</span>';
    html += '</div>';
    document.getElementById('ex-connect-content').innerHTML = html;

    // Post to server immediately
    exPostJoin(sessionCode, sessionTheirCode);
  }

  function startCooperateFlow() {
    // Legacy entry — redirect to providing by default
    exStartProviding();
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
    html += '<div style="font-size:11px; color:var(--text-faint); letter-spacing:1px; margin-bottom:4px;">STEP 1 OF 5</div>';
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

      // Build thread snapshot
      var threadSnap = null;
      try {
        if (state.chain.length > 0) {
          threadSnap = HCP.chainSnapshot(state.chain);
        } else {
          threadSnap = { n: 0, d: 0, g: 0, r: 0, cats: {}, words: {}, time: {}, stab: {}, t0: null, t1: null };
        }
      } catch(snapErr) {
        threadSnap = { n: state.chain.filter(HCP.isAct).length, d: 0, g: 0, r: 0, cats: {}, words: {}, time: {}, stab: {}, t0: null, t1: null };
      }
      if (threadSnap && state.declarations) {
        threadSnap.range = {
          simpleVal: state.declarations.rangeSimpleVal || 0,
          complexVal: state.declarations.rangeComplexVal || 0,
          dailyVal: state.declarations.rangeDailyVal || 0,
        };
        threadSnap._name = state.declarations.name || '';
        var genesisRec = state.chain.find(function(r) { return r.type === HCP.RECORD_TYPE_GENESIS && r.photoData; });
        if (genesisRec) threadSnap._genesisPhoto = genesisRec.photoData;
      }
      // Attach initiator role so joiner knows the complement
      if (threadSnap && exInitiatorRole) {
        threadSnap._role = exInitiatorRole;
      }

      // Attach device reality summary for chain health assessment
      if (threadSnap) {
        var pohCount = 0;
        var hasGeo = 0, hasSensor = 0, hasDevice = 0;
        state.chain.forEach(function(r) {
          if (r.pohSnapshot) pohCount++;
          if (r.geo) hasGeo++;
          if (r.sensorHash) hasSensor++;
          if (r.device) hasDevice++;
        });
        var webgl = getWebGLRenderer();
        threadSnap._device = {
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
      }

      // Enrich with per-service pricing data for exchange assessment
      if (threadSnap && state.chain.length > 0) {
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
        threadSnap._services = services;
      }

      var joinPayload = {
          my_code: myCode,
          their_code: theirCode,
          fingerprint: state.fingerprint,
          public_key: state.publicKeyJwk,
          thread_snapshot: threadSnap ? JSON.stringify(threadSnap) : null,
      };
      console.log('[ex-flow] Posting to /session/join:', JSON.stringify({
        my_code: myCode, their_code: theirCode,
        fingerprint: (state.fingerprint || '').substring(0, 16) + '...',
        has_pubkey: !!state.publicKeyJwk,
        has_snapshot: !!threadSnap,
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
        const data = await resp.json();
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
        const data = await resp.json();
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

    // Determine session role
    if (exInitiatorRole) {
      // I'm the initiator — I already chose my role
      sessionRole = exInitiatorRole === 'provider' ? 'proposer' : 'confirmer';
    } else {
      // I'm the joiner — take complement of partner's role
      var partnerRole = null;
      try { partnerRole = sessionPartner.thread_snapshot ? JSON.parse(sessionPartner.thread_snapshot)._role || sessionPartner.thread_snapshot._role : null; } catch(e) {}
      // thread_snapshot might already be parsed
      if (!partnerRole && sessionPartner.thread_snapshot) {
        try {
          var snap = typeof sessionPartner.thread_snapshot === 'string' ? JSON.parse(sessionPartner.thread_snapshot) : sessionPartner.thread_snapshot;
          partnerRole = snap._role;
        } catch(e2) {}
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
    const sasCode = await computeSAS(myFp, theirFp);

    // Get partner name from snapshot
    let partnerName = 'Connected';
    let partnerInitial = '?';
    try {
      const snap = sessionPartner.thread_snapshot;
      if (snap && snap._name) {
        partnerName = snap._name;
        partnerInitial = partnerName.charAt(0).toUpperCase();
      }
    } catch(e) {}

    // Show verify step
    document.getElementById('ex-verify-avatar').textContent = partnerInitial;
    document.getElementById('ex-verify-name').textContent = partnerName;
    document.getElementById('ex-sas-code').textContent = sasCode;
    showExStep('verify');
  }

  async function computeSAS(fpA, fpB) {
    // Sort fingerprints for canonical ordering — both phones compute the same
    const sorted = [fpA, fpB].sort();
    const input = sorted[0] + '|' + sorted[1];
    const encoded = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    const hashArr = new Uint8Array(hashBuf);
    // First 2 bytes → 4 hex chars
    const hex = Array.from(hashArr.slice(0, 2)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return hex;
  }

  function exConfirmSAS() {
    // SAS confirmed — show texture review
    exRenderTexture();
    showExStep('texture');
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
    var html = '<div style="padding:16px; background:rgba(123,170,204,0.04); border:1px solid rgba(123,170,204,0.12); border-radius:var(--radius); overflow:hidden;">';
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
    var html = '<div style="padding:16px; background:rgba(123,170,204,0.04); border:1px solid rgba(123,170,204,0.12); border-radius:var(--radius); overflow:hidden;">';
    html += '<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">';
    html += '<span style="font-size:18px; color:var(--blue);">&#9679;</span>';
    html += '<div style="font-size:15px; font-weight:600; color:var(--blue);">This chain is young.</div>';
    html += '</div>';
    html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6;">';
    html += esc(name) + ' has ' + ts.n + ' exchange' + (ts.n > 1 ? 's' : '') + ' on record. What is here looks genuine \u2014 the chain just has not had time to build depth yet.';
    html += '</div>';

    // Observations within young
    if (cl.observations.length > 0) {
      html += '<div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(123,170,204,0.12);">';
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
    var html = '<div style="padding:16px; background:rgba(224,180,138,0.04); border:1px solid rgba(224,180,138,0.12); border-radius:var(--radius); overflow:hidden;">';
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
    var html = '<div style="padding:16px; background:rgba(204,123,123,0.04); border:1px solid rgba(204,123,123,0.15); border-radius:var(--radius); overflow:hidden;">';
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
      document.getElementById('ex-desc').value = '';
      document.getElementById('ex-value').value = '';
      document.getElementById('ex-category').value = '';
      document.getElementById('ex-hours').value = '';
      document.getElementById('ex-minutes').value = '';
      document.getElementById('ex-city').value = '';
      document.getElementById('ex-state').value = '';
      renderSkillPicker();
      // Inject back link + reusable acts above the form
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
      var dirToggle = document.getElementById('dir-toggle');
      if (formStep && dirToggle) formStep.insertBefore(backLink, formStep.firstChild);
      exRenderReusableActs();
    } else {
      showExStep('receiver-wait');
      exRenderReceiverWait();
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
      var dirColor = act.energyState === 'provided' ? 'rgba(125,204,123,0.15)' : 'rgba(217,106,106,0.15)';
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
        if (act.duration) {
          document.getElementById('ex-hours').value = Math.floor(act.duration / 60) || '';
          document.getElementById('ex-minutes').value = act.duration % 60 || '';
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
    // Legacy — kept for backward compatibility
    if (role === 'provider') {
      sessionRole = 'proposer';
      showExStep('form');
      document.getElementById('exchange-header').textContent = 'Set up the exchange';
      document.getElementById('ex-desc').value = '';
      document.getElementById('ex-value').value = '';
      document.getElementById('ex-category').value = '';
      document.getElementById('ex-hours').value = '';
      document.getElementById('ex-minutes').value = '';
      document.getElementById('ex-city').value = '';
      document.getElementById('ex-state').value = '';
      renderSkillPicker();
    } else {
      sessionRole = 'confirmer';
      showExStep('receiver-wait');
      exRenderReceiverWait();
      startSessionPoll();
    }
  }

  function exShowProposalReady() {
    // Show sticky banner at top of service catalog
    var banner = document.getElementById('proposal-ready-banner');
    if (banner) banner.style.display = 'block';
    // Also update the bottom waiting indicator
    var waitStatus = document.querySelector('#ex-step-receiver-wait .pair-status');
    if (waitStatus) {
      waitStatus.className = 'pair-status';
      waitStatus.innerHTML =
        '<div style="padding:14px; background:rgba(125,204,123,0.06); border:1px solid rgba(125,204,123,0.15); border-radius:var(--radius); text-align:center;">' +
        '<div style="font-size:14px; font-weight:500; color:var(--green); margin-bottom:6px;">Proposal received</div>' +
        '<div style="font-size:13px; color:var(--text-dim); margin-bottom:12px;">Take your time reviewing their services. When you\u2019re ready:</div>' +
        '<button class="btn btn-primary" style="width:100%;" onclick="App.exViewProposal()">View proposal</button>' +
        '</div>';
    }
    // Also update the step header
    var stepTitle = document.getElementById('ex-receiver-wait-title');
    if (stepTitle) stepTitle.textContent = 'Browse their services';
  }

  function exViewProposal() {
    var banner = document.getElementById('proposal-ready-banner');
    if (banner) banner.style.display = 'none';
    exRenderProposalReview();
  }

  function exRenderReceiverWait() {
    const container = document.getElementById('ex-receiver-wait-content');
    // Reset proposal banner
    var banner = document.getElementById('proposal-ready-banner');
    if (banner) banner.style.display = 'none';
    var ts = sessionPartner ? sessionPartner.thread_snapshot : null;
    if (typeof ts === 'string') { try { ts = JSON.parse(ts); } catch(e) {} }
    var name = (ts && ts._name) || 'This person';
    var services = (ts && ts._services) || {};
    var svcKeys = Object.keys(services);

    var html = '';

    if (!svcKeys.length) {
      // No service history — show minimal waiting state
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.6; margin-bottom:16px;">';
      html += esc(name) + ' has no service history yet. Their proposal will appear here when ready.';
      html += '</div>';
    } else {
      // Group by category
      var byCat = {};
      var uncategorized = [];
      svcKeys.forEach(function(key) {
        var s = services[key];
        var cat = (s.cat || '').trim();
        if (!cat) {
          uncategorized.push(s);
        } else {
          if (!byCat[cat]) byCat[cat] = [];
          byCat[cat].push(s);
        }
      });
      var catNames = Object.keys(byCat).sort();

      html += '<div style="font-size:13px; color:var(--text-dim); margin-bottom:12px;">';
      html += esc(name) + '\u2019s services \u00b7 ' + svcKeys.length + ' offered';
      html += '</div>';

      // Render each category as expandable
      catNames.forEach(function(cat) {
        var items = byCat[cat];
        var totalInCat = items.reduce(function(sum, s) { return sum + s.n; }, 0);
        html += exRenderServiceCategory(cat, items, totalInCat);
      });

      // Uncategorized
      if (uncategorized.length) {
        var totalUncat = uncategorized.reduce(function(sum, s) { return sum + s.n; }, 0);
        html += exRenderServiceCategory('Uncategorized', uncategorized, totalUncat);
      }
    }

    // Cancel exchange button
    html += '<button class="btn btn-secondary" style="width:100%; margin-top:20px; color:var(--text-faint);" onclick="App.closeExchange()">Cancel exchange</button>';

    container.innerHTML = html;
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

    // Update step header
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

    // Get receiver's own payment history from local chain
    var myHistory = [];
    state.chain.forEach(function(r) {
      if ((r.description || '').trim().toLowerCase() === serviceKey) {
        myHistory.push({ v: r.value, d: r.energyState, w: r.timestamp });
      }
    });
    var myAvg = myHistory.length ? Math.round(myHistory.reduce(function(s, h) { return s + h.v; }, 0) / myHistory.length) : null;
    var myLow = myHistory.length ? Math.min.apply(null, myHistory.map(function(h) { return h.v; })) : null;
    var myHigh = myHistory.length ? Math.max.apply(null, myHistory.map(function(h) { return h.v; })) : null;

    // Compute assessment
    var assessment;
    if (!provSvc || !provSvc.n) {
      var rangeNote = '';
      if (providerSnap && providerSnap.range && providerSnap.range.dailyVal) {
        rangeNote = ' Their scale exercise puts a full day of work at ' + providerSnap.range.dailyVal + ' units.';
      }
      assessment = { color: 'var(--blue)', icon: '&#9679;', text: 'First time ' + esc(providerName) + ' is offering this service. No pricing history yet.' + rangeNote };
    } else if (proposedValue > provSvc.avg * 1.5) {
      assessment = { color: 'var(--red)', icon: '&#9888;', text: esc(providerName) + ' typically offers ' + esc(serviceDesc) + ' between ' + provSvc.low + ' and ' + provSvc.high + ' units. Today\'s proposal of ' + proposedValue + ' is well above that range. There may be a good reason \u2014 ask about it.' };
    } else if (proposedValue > provSvc.high) {
      assessment = { color: 'var(--accent)', icon: '&#9679;', text: esc(providerName) + '\'s typical range for ' + esc(serviceDesc) + ' is ' + provSvc.low + ' to ' + provSvc.high + '. This proposal is a bit higher. Could reflect complexity, scarcity, or an adjustment.' };
    } else {
      assessment = { color: 'var(--green)', icon: '&#10003;', text: esc(providerName) + ' typically offers ' + esc(serviceDesc) + ' between ' + provSvc.low + ' and ' + provSvc.high + ' units. This price is within that range.' };
    }

    var borderColor = assessment.color === 'var(--red)' ? 'rgba(204,123,123,0.15)' : assessment.color === 'var(--accent)' ? 'rgba(224,180,138,0.15)' : assessment.color === 'var(--blue)' ? 'rgba(123,170,204,0.15)' : 'rgba(125,204,123,0.15)';
    var bgColor = borderColor.replace('0.15', '0.04');

    var html = '';

    // Assessment card
    html += '<div style="background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:var(--radius); overflow:hidden;">';
    html += '<div style="padding:16px;">';

    // Service + flow
    var hasGenesis = providerSnap && providerSnap._genesisPhoto;
    var hasCurrent = p.proposer_photo;
    if (hasGenesis || hasCurrent) {
      html += '<div style="display:flex; justify-content:center; align-items:flex-end; gap:16px; margin-bottom:12px;">';
      if (hasGenesis) {
        html += '<div style="text-align:center;">' +
          '<img src="' + providerSnap._genesisPhoto + '" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:2px solid var(--border);">' +
          '<div style="font-size:11px; color:var(--text-faint); margin-top:4px;">Genesis</div></div>';
      }
      if (hasCurrent) {
        html += '<div style="text-align:center;">' +
          '<img src="' + p.proposer_photo + '" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:2px solid var(--accent-dim);">' +
          '<div style="font-size:11px; color:var(--text-faint); margin-top:4px;">' + (hasGenesis ? 'Current' : 'Current') + '</div></div>';
      }
      html += '</div>';
    }
    html += '<div style="font-size:18px; font-weight:600; color:var(--text); margin-bottom:4px;">' + esc(serviceDesc) + '</div>';
    html += '<div style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-dim); margin-bottom:14px;">';
    html += '<span>' + esc(providerName) + '</span><span style="color:var(--text-faint);">\u2192</span><span>You</span>';
    html += '</div>';

    // Price
    html += '<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:14px;">';
    html += '<span style="font-size:28px; font-weight:700; font-family:var(--font-mono); color:var(--accent);">' + proposedValue + '</span>';
    html += '<span style="font-size:12px; color:var(--text-faint);">units proposed</span>';
    html += '</div>';

    // Assessment verdict
    html += '<div style="display:flex; align-items:flex-start; gap:8px;">';
    html += '<span style="color:' + assessment.color + '; font-size:14px; flex-shrink:0; margin-top:1px;">' + assessment.icon + '</span>';
    html += '<div style="font-size:12px; color:var(--text-dim); line-height:1.6;">' + assessment.text + '</div>';
    html += '</div>';

    // Range bar
    if (provSvc && provSvc.low != null) {
      html += '<div style="margin-top:14px;">' + exRenderRangeBar(provSvc.low, provSvc.high, provSvc.avg, proposedValue) + '</div>';
    }
    html += '</div>';

    // Expandable sections
    html += '<div style="border-top:1px solid var(--border); padding:0 16px;">';

    // Provider's history
    if (provSvc && provSvc.n > 0) {
      html += '<div class="ex-expand-row" onclick="this.classList.toggle(\'open\');">';
      html += '<div class="ex-expand-header"><span style="font-size:14px; color:var(--text-faint);">\u25F7</span><span style="font-size:13px; color:var(--text); flex:1;">' + esc(providerName) + '\'s pricing history for ' + esc(serviceDesc) + '</span><span class="ex-expand-chev">\u25B8</span></div>';
      html += '<div class="ex-expand-body">';
      html += '<div style="display:flex; gap:16px; margin-bottom:12px;">';
      html += '<div><div style="font-size:18px; font-weight:700; font-family:var(--font-mono); color:var(--accent);">' + provSvc.n + '</div><div style="font-size:10px; color:var(--text-faint);">times</div></div>';
      html += '<div><div style="font-size:18px; font-weight:700; font-family:var(--font-mono); color:var(--accent);">' + provSvc.people + '</div><div style="font-size:10px; color:var(--text-faint);">people</div></div>';
      html += '<div><div style="font-size:18px; font-weight:700; font-family:var(--font-mono); color:var(--accent);">' + provSvc.avg + '</div><div style="font-size:10px; color:var(--text-faint);">avg</div></div>';
      html += '</div>';
      html += exRenderRangeBar(provSvc.low, provSvc.high, provSvc.avg, proposedValue);
      if (provSvc.prices) {
        provSvc.prices.forEach(function(pr) {
          var when = pr.w ? exTimeAgo(pr.w) : '';
          html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">';
          html += '<span style="font-size:12px; color:var(--text-faint);">' + when + '</span>';
          html += '<span style="font-size:14px; font-family:var(--font-mono); color:var(--accent); font-weight:600;">' + pr.v + '</span>';
          html += '</div>';
        });
      }
      html += '</div></div>';
    }

    // Receiver's own history
    if (myHistory.length > 0) {
      html += '<div class="ex-expand-row" onclick="this.classList.toggle(\'open\');">';
      html += '<div class="ex-expand-header"><span style="font-size:14px; color:var(--text-faint);">\u25F7</span><span style="font-size:13px; color:var(--text); flex:1;">Your payment history for ' + esc(serviceDesc) + '</span><span class="ex-expand-chev">\u25B8</span></div>';
      html += '<div class="ex-expand-body">';
      html += '<div style="font-size:12px; color:var(--text-dim); line-height:1.6; margin-bottom:12px;">You have paid for ' + esc(serviceDesc) + ' ' + myHistory.length + ' times. Your range: ' + myLow + ' to ' + myHigh + ' units.</div>';
      html += exRenderRangeBar(myLow, myHigh, myAvg, proposedValue);
      myHistory.slice(-10).forEach(function(h) {
        var when = h.w ? exTimeAgo(h.w) : '';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">';
        html += '<span style="font-size:12px; color:var(--text-faint);">' + when + '</span>';
        html += '<span style="font-size:14px; font-family:var(--font-mono); color:var(--accent); font-weight:600;">' + h.v + '</span>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // Reality signals
    if (providerSnap && providerSnap.integrity) {
      var ig = providerSnap.integrity;
      html += '<div class="ex-expand-row" onclick="this.classList.toggle(\'open\');">';
      html += '<div class="ex-expand-header"><span style="font-size:14px; color:var(--text-faint);">\u25C9</span><span style="font-size:13px; color:var(--text); flex:1;">Reality signals</span><span class="ex-expand-chev">\u25B8</span></div>';
      html += '<div class="ex-expand-body">';
      html += '<div style="font-size:13px; color:var(--text-dim); line-height:1.8;">';
      html += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);"><span>Genesis photo anchored</span><span style="font-weight:500;">' + (ig.genesisPhoto ? '\u2713 Yes' + (ig.genesisPhotoSource ? ' (' + ig.genesisPhotoSource + ')' : '') : '\u2014 No') + '</span></div>';
      html += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);"><span>Sensor coverage</span><span style="font-weight:500;">' + ig.sensorCoverage + '%</span></div>';
      html += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);"><span>Platforms</span><span style="font-weight:500;">' + (ig.platforms && ig.platforms.length ? ig.platforms.join(', ') : '\u2014') + '</span></div>';
      html += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);"><span>Distinct devices</span><span style="font-weight:500;">' + ig.distinctDevices + '</span></div>';
      html += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);"><span>Distinct counterparties</span><span style="font-weight:500;">' + ig.distinctCounterparties + '</span></div>';
      if (ig.distinctCounterpartyDevices > 0) {
        var cpRatio2 = ig.distinctCounterparties > 0 ? (ig.distinctCounterparties / ig.distinctCounterpartyDevices) : 0;
        var cpDevStyle2 = cpRatio2 > 2 ? ' color:var(--warning,#e67e22);' : '';
        html += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);"><span>Counterparty devices</span><span style="font-weight:500;' + cpDevStyle2 + '">' + ig.distinctCounterpartyDevices + '</span></div>';
      }
      var ps = ig.photoSources || {};
      if (ps.camera || ps.file) {
        html += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border);"><span>Photos</span><span style="font-weight:500;">' + (ps.camera || 0) + ' camera, ' + (ps.file || 0) + ' uploaded</span></div>';
      }
      html += '<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Pings</span><span style="font-weight:500;">' + (providerSnap.pings || 0) + (ig.avgPingGapDays != null ? ' (avg ' + ig.avgPingGapDays + ' day gap)' : '') + '</span></div>';
      html += '</div>';
      html += '<p style="font-size:12px; color:var(--text-faint); line-height:1.5; margin-top:10px;">These signals come from the device data embedded in their chain. Camera photos, consistent device fingerprints, and regular pings suggest a real person using a real phone.</p>';
      html += '</div></div>';
    }

    // How to think about this price
    html += '<div class="ex-expand-row" onclick="this.classList.toggle(\'open\');">';
    html += '<div class="ex-expand-header"><span style="font-size:14px; color:var(--text-faint);">?</span><span style="font-size:13px; color:var(--text); flex:1;">How to think about this price</span><span class="ex-expand-chev">\u25B8</span></div>';
    html += '<div class="ex-expand-body">';
    html += '<p style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-bottom:12px;">The person offering this service sets the price. That is how it works \u2014 the provider declares what they believe their work is worth. You decide whether that value makes sense to you.</p>';
    html += '<p style="font-size:13px; color:var(--text-dim); line-height:1.7; margin-bottom:12px;">The pricing history gives you context. If this person has offered the same service many times at a consistent price, and multiple different people have agreed to pay it, that is a strong signal the price reflects real value.</p>';
    html += '<p style="font-size:13px; color:var(--text-dim); line-height:1.7;">Your own payment history tells you what you have typically valued this type of work at. If the gap between what you usually pay and what they propose is large, that is worth understanding before you agree.</p>';
    html += '</div></div>';

    html += '</div></div>';

    // Confirm/reject
    html += '<button class="btn btn-primary" id="btn-session-accept" style="width:100%; margin-top:16px; margin-bottom:8px;" onclick="App.sessionConfirm()">Accept</button>';
    html += '<button class="btn btn-secondary" style="width:100%;" onclick="App.sessionReject()">Not right</button>';

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
    h += '<div style="position:absolute; left:' + lowPct + '%; width:' + Math.max(1, highPct - lowPct) + '%; top:0; bottom:0; background:rgba(224,180,138,0.2); border-radius:4px;"></div>';
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

  return {
    init, setupStep, completeSetup: completeSetupWrapped,
    capturePhoto, uploadPhoto, handlePhotoFile, submitDeclarations, skipDeclarations, rangeUpdate, submitRange, skipRange, rangeNav, toggleValTag,
    addSkill, removeSkill, toggleSkillPicker,
    showFullQR, closeFullQR,
    openCooperate, coopNewAct, coopReuseAct,
    startCooperateFlow, toggleCoopStart, exStartProviding, exStartReceiving, exJoinExchange, exCodeInput, exConnect, exConfirmSAS, exRejectSAS, exContinueFromTexture, exBackToTexture, exSelectRole, exViewProposal,
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
    openDeclarationsEdit, editCapturePhoto, editUploadPhoto, handleEditPhotoFile, saveDeclarationsEdit,
    openDeclareRange, declareRangeUpdate, submitDeclareRange, dismissRangePrompt,
    openSettings, togglePrivacy, toggleLocation,
    testWitnessConnection,
    exportBackup: exportBackupAction, importBackup: importBackupAction, handleImportFile,
    changePIN, installFromSettings, deleteChain, closeModal,
    installApp, dismissInstall, skipInstallFirst,
  };
})();

// DEVELOPMENT MODE: No service worker. Kill any old ones.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}
if ('caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(k => caches.delete(k));
  });
}

// Viewport height fix for mobile browsers
function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}
setVH();
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', () => setTimeout(setVH, 100));

document.addEventListener('DOMContentLoaded', App.init);
