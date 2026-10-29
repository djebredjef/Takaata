// Capture média : appareil photo (sans galerie), vérification du visage, note vocale, réduction des images.
// Prototype : la reconnaissance faciale est simulée ; au lancement, un fournisseur spécialisé compare les visages.
(function () {
  const { esc } = TK.ui;
  const t = (k, v) => TK.t(k, v);

  TK.addStrings({
    fr: {
      'md.close': 'Fermer', 'md.shoot': 'Prendre la photo', 'md.done': 'Terminé · {n} photo(s)', 'md.retake': 'Supprimer',
      'md.noCam': 'Caméra indisponible : autorisez l’accès à l’appareil photo dans le navigateur.',
      'md.openCam': 'Ouvrir l’appareil photo', 'md.demoPhotos': 'Mode démo : ajouter des photos d’exemple', 'md.demoPhoto': 'Photo démo',
      'md.camOnly': 'Photos prises en direct uniquement, sans galerie : elles servent de preuve.',
      'fs.title': 'Vérification du visage', 'fs.place': 'Placez votre visage dans le cercle', 'fs.hold': 'Ne bougez pas…',
      'fs.ok': 'Visage reconnu', 'fs.noFace': 'Aucun visage détecté. Mettez-vous face à la lumière.',
      'fs.demo': 'Mode démo : valider sans caméra', 'fs.why': 'Takaata vérifie que c’est bien vous qui conduisez.',
      'vc.rec': 'Note vocale', 'vc.stop': 'Arrêter', 'vc.noMic': 'Micro indisponible : autorisez l’accès au micro dans le navigateur.'
    },
    en: {
      'md.close': 'Close', 'md.shoot': 'Take photo', 'md.done': 'Done · {n} photo(s)', 'md.retake': 'Delete',
      'md.noCam': 'Camera unavailable: allow camera access in your browser.',
      'md.openCam': 'Open the camera', 'md.demoPhotos': 'Demo mode: add sample photos', 'md.demoPhoto': 'Demo photo',
      'md.camOnly': 'Live photos only, no gallery: they serve as proof.',
      'fs.title': 'Face check', 'fs.place': 'Place your face inside the circle', 'fs.hold': 'Hold still…',
      'fs.ok': 'Face recognised', 'fs.noFace': 'No face detected. Face the light.',
      'fs.demo': 'Demo mode: confirm without camera', 'fs.why': 'Takaata checks that you are the one driving.',
      'vc.rec': 'Voice note', 'vc.stop': 'Stop', 'vc.noMic': 'Microphone unavailable: allow microphone access in your browser.'
    }
  });

  // Réduit une image (fichier, vidéo ou canvas) en JPEG pour le stockage local.
  function toJpeg(src, max = 800, q = 0.6) {
    const w0 = src.videoWidth || src.width, h0 = src.videoHeight || src.height;
    const k = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  }
  function fileToJpeg(file, max, q) {
    return new Promise(resolve => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(toJpeg(img, max, q)); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }
  // Image d'exemple pour tester sans caméra (ordinateur, aperçu).
  function demoImage(label, n) {
    const c = document.createElement('canvas'); c.width = 480; c.height = 360;
    const g = c.getContext('2d');
    g.fillStyle = ['#A9BBB9', '#C6D0D2', '#9DB6B8'][n % 3]; g.fillRect(0, 0, 480, 360);
    g.fillStyle = '#0E2A33'; g.font = '600 28px sans-serif'; g.textAlign = 'center';
    g.fillText(`${label} ${n + 1}`, 240, 180);
    g.font = '18px sans-serif'; g.fillText(new Date().toLocaleString(), 240, 220);
    return c.toDataURL('image/jpeg', 0.6);
  }

  async function openStream(facing) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no-media');
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
  }
  const stopStream = s => { if (s) s.getTracks().forEach(tr => tr.stop()); };

  function overlay(cls) {
    const el = document.createElement('div');
    el.className = 'media-ov ' + cls;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
    document.body.classList.add('media-open');
    return el;
  }
  function closeOverlay(el) { el.remove(); if (!document.querySelector('.media-ov')) document.body.classList.remove('media-open'); }

  // Appareil photo en direct, plusieurs prises. Résout avec la liste des photos (vide si annulé).
  function camera({ title, max = 8, label = t('md.demoPhoto'), size = 640 } = {}) {
    return new Promise(async resolve => {
      const shots = [];
      const el = overlay('cam-ov');
      let stream = null;
      const finish = () => { stopStream(stream); closeOverlay(el); resolve(shots); };
      const draw = live => {
        el.innerHTML = `
          <div class="ov-top"><b>${esc(title)}</b><button type="button" class="ov-x" data-m="close" aria-label="${esc(t('md.close'))}">✕</button></div>
          ${live ? '<video class="cam-video" autoplay playsinline muted></video>' : `<div class="cam-fallback"><p>${esc(t('md.noCam'))}</p>
            <label class="btn btn-light"><input type="file" accept="image/*" capture="environment" data-m="file" hidden>${esc(t('md.openCam'))}</label>
            <button type="button" class="btn btn-ghost-light" data-m="demo">${esc(t('md.demoPhotos'))}</button></div>`}
          <div class="cam-strip">${shots.map((s, i) => `<button type="button" class="cam-thumb" data-m="del" data-i="${i}" aria-label="${esc(t('md.retake'))} ${i + 1}"><img src="${s}" alt=""><i>✕</i></button>`).join('')}</div>
          <p class="ov-hint">${esc(t('md.camOnly'))}</p>
          <div class="cam-bar">
            ${live ? `<button type="button" class="shutter" data-m="shoot" aria-label="${esc(t('md.shoot'))}"${shots.length >= max ? ' disabled' : ''}></button>` : '<span></span>'}
            <button type="button" class="btn btn-signal" data-m="done"${shots.length ? '' : ' disabled'}>${esc(t('md.done', { n: shots.length }))}</button>
          </div>`;
        const v = el.querySelector('video');
        if (v && stream) { v.srcObject = stream; v.play().catch(() => {}); }
      };
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        const m = b.dataset.m;
        if (m === 'close') { shots.length = 0; finish(); }
        if (m === 'done') finish();
        if (m === 'shoot') { const v = el.querySelector('video'); if (v && v.videoWidth) { shots.push(toJpeg(v, size, size < 640 ? 0.5 : 0.6)); draw(true); } }
        if (m === 'del') { shots.splice(+b.dataset.i, 1); draw(!!stream); }
        if (m === 'demo') { for (let i = 0; i < 2 && shots.length < max; i++) shots.push(demoImage(label, shots.length)); draw(false); }
      });
      el.addEventListener('change', async e => {
        const f = e.target.files && e.target.files[0];
        if (f && shots.length < max) { const img = await fileToJpeg(f, size, 0.6); if (img) shots.push(img); }
        draw(false);
      });
      try { stream = await openStream('environment'); draw(true); } catch (err) { draw(false); }
    });
  }

  // Vérification du visage en direct : rapide (≈ 2 s). Résout avec { ok, image }.
  function faceScan({ title = t('fs.title'), sub = t('fs.why') } = {}) {
    return new Promise(async resolve => {
      const el = overlay('face-ov');
      let stream = null, timer = null, done = false;
      const finish = res => { if (done) return; done = true; clearTimeout(timer); stopStream(stream); closeOverlay(el); resolve(res); };
      const frame = (state, msg) => {
        el.innerHTML = `
          <div class="ov-top"><b>${esc(title)}</b><button type="button" class="ov-x" data-m="close" aria-label="${esc(t('md.close'))}">✕</button></div>
          <div class="face-ring is-${state}">${stream ? '<video class="face-video" autoplay playsinline muted></video>' : '<span class="face-blank" aria-hidden="true"></span>'}<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48"></circle></svg></div>
          <p class="face-msg" role="status">${esc(msg)}</p>
          <p class="ov-hint">${esc(sub)}</p>
          ${stream ? '' : `<p class="ov-hint">${esc(t('md.noCam'))}</p><button type="button" class="btn btn-ghost-light" data-m="demo">${esc(t('fs.demo'))}</button>`}`;
        const v = el.querySelector('video');
        if (v) { v.srcObject = stream; v.play().catch(() => {}); }
      };
      const success = image => { frame('ok', '✓ ' + t('fs.ok')); timer = setTimeout(() => finish({ ok: true, image, at: Date.now() }), 700); };
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        if (b.dataset.m === 'close') finish({ ok: false });
        if (b.dataset.m === 'demo') success(demoImage('Visage', 0));
      });
      try { stream = await openStream('user'); } catch (err) { frame('off', t('fs.place')); return; }
      frame('scan', t('fs.place'));
      const v = el.querySelector('video');
      const detector = 'FaceDetector' in window ? new window.FaceDetector({ fastMode: true }) : null;
      let tries = 0;
      const check = async () => {
        if (done) return;
        if (!v.videoWidth) { timer = setTimeout(check, 200); return; }
        let found = true;
        if (detector) { try { found = (await detector.detect(v)).length > 0; } catch (e) { found = true; } }
        if (!found) {
          tries++;
          el.querySelector('.face-msg').textContent = t(tries > 6 ? 'fs.noFace' : 'fs.place');
          timer = setTimeout(check, 400);
          return;
        }
        el.querySelector('.face-msg').textContent = t('fs.hold');
        el.querySelector('.face-ring').className = 'face-ring is-hold';
        const shot = toJpeg(v, 240, 0.6);
        timer = setTimeout(() => success(shot), 1400);
      };
      timer = setTimeout(check, 500);
    });
  }

  // Note vocale (60 s max). start() résout avec un contrôleur { stop(), elapsed() } ou null si le micro est refusé.
  const VOICE_MAX_S = 60;
  async function voice(onTick) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return null;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return null; }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 24000 }, type ? { mimeType: type } : {}));
    const chunks = [], t0 = Date.now();
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    let resolveStop;
    const stopped = new Promise(r => { resolveStop = r; });
    rec.onstop = () => {
      stopStream(stream);
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const fr = new FileReader();
      fr.onload = () => resolveStop({ url: fr.result, sec: Math.max(1, Math.round((Date.now() - t0) / 1000)) });
      fr.readAsDataURL(blob);
    };
    rec.start();
    const iv = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      if (onTick) onTick(s);
      if (s >= VOICE_MAX_S) ctl.stop();
    }, 250);
    const ctl = { stop() { clearInterval(iv); if (rec.state !== 'inactive') rec.stop(); return stopped; } };
    return ctl;
  }

  window.TK = Object.assign(window.TK || {}, { media: { camera, faceScan, voice, fileToJpeg, demoImage, VOICE_MAX_S } });
})();
