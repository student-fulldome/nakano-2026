/**
 * dome.js — Three.js フルスクリーン ドーム背景
 *
 * ドームマスター UV シェーダー / 星空・座席テクスチャ / グリッドライン / クロスフェード
 */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('dome.js: Three.js が読み込まれていません');
    return;
  }

  var canvas = document.getElementById('dome-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  /* ── 角丸矩形パスヘルパー ── */
  function pathRoundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  /* ── 星空テクスチャ（ドームマスター形式・円形クリップ） ── */
  function buildStarTexture() {
    const S = 2048, CX = S / 2, CY = S / 2, R = S / 2;
    const tc = document.createElement('canvas');
    tc.width = tc.height = S;
    const ctx = tc.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();

    const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
    bg.addColorStop(0,   '#141436');
    bg.addColorStop(0.6, '#0a0a1e');
    bg.addColorStop(1,   '#06060e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    /* 星雲 */
    [[60,90,180],[80,60,160],[40,110,170],[50,130,200]].forEach(function (c) {
      for (var k = 0; k < 3; k++) {
        var a = Math.random() * Math.PI * 2;
        var d = Math.random() * R * 0.82;
        var x = CX + d * Math.cos(a), y = CY + d * Math.sin(a);
        var nr = 80 + Math.random() * 200;
        var ng = ctx.createRadialGradient(x, y, 0, x, y, nr);
        ng.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.10)');
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng;
        ctx.fillRect(0, 0, S, S);
      }
    });

    /* 小さな星 */
    for (var i = 0; i < 4500; i++) {
      var a = Math.random() * Math.PI * 2;
      var d = Math.sqrt(Math.random()) * R;
      var x = CX + d * Math.cos(a), y = CY + d * Math.sin(a);
      var r = Math.random() * 1.1 + 0.2;
      var al = Math.random() * 0.65 + 0.25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() > 0.8
        ? 'rgba(180,210,255,' + al + ')'
        : 'rgba(255,255,255,' + al + ')';
      ctx.fill();
    }

    /* 明るい星（グロー付き） */
    for (var i = 0; i < 30; i++) {
      var a = Math.random() * Math.PI * 2;
      var d = Math.random() * R * 0.88;
      var x = CX + d * Math.cos(a), y = CY + d * Math.sin(a);
      var r = 1.5 + Math.random() * 2;
      var gl = ctx.createRadialGradient(x, y, 0, x, y, r * 8);
      gl.addColorStop(0,    'rgba(255,255,255,0.95)');
      gl.addColorStop(0.25, 'rgba(200,225,255,0.35)');
      gl.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - r * 8, y - r * 8, r * 16, r * 16);
    }

    ctx.restore();
    var tex = new THREE.CanvasTexture(tc);
    tex.flipY = false;
    return tex;
  }

  /* ── シアター座席テクスチャ（天底俯瞰） ── */
  function buildSeatTexture() {
    var S = 1024, CX = S / 2, CY = S / 2, R = S / 2;
    var tc = document.createElement('canvas');
    tc.width = tc.height = S;
    var ctx = tc.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R - 1, 0, Math.PI * 2);
    ctx.clip();

    /* 床グラデーション */
    var floor = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
    floor.addColorStop(0,    '#0e0e1c');
    floor.addColorStop(0.45, '#090910');
    floor.addColorStop(1,    '#050508');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, S, S);

    /* 座席エリアの環境光 */
    var amb = ctx.createRadialGradient(CX, CY, R * 0.15, CX, CY, R * 0.82);
    amb.addColorStop(0,   'rgba(30,38,80,0.18)');
    amb.addColorStop(0.6, 'rgba(18,24,55,0.10)');
    amb.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, S, S);

    var ROWS   = 8;
    var IN_R   = 0.17 * R;
    var OUT_R  = 0.74 * R;
    var AISLE  = Math.PI * 1.5;  /* 通路位置（下方向） */
    var AISLE_W = 0.06;

    for (var row = 0; row < ROWS; row++) {
      var t    = row / (ROWS - 1);
      var rowR = IN_R + t * (OUT_R - IN_R);
      var SW   = 10 + row * 0.6;   /* 幅（円周方向） */
      var SD   = 13 + row * 0.5;   /* 奥行き（半径方向） */
      var step = (SW * 1.55) / rowR;
      var nSeats = Math.floor(Math.PI * 2 / step);
      var offset = (row % 2) * step * 0.5;
      var bBase  = 22 + row * 2;
      var cBody  = 'rgb(' + bBase + ',' + (bBase+3) + ',' + (bBase+14) + ')';
      var cBack  = 'rgb(' + (bBase+12) + ',' + (bBase+15) + ',' + (bBase+30) + ')';

      for (var s = 0; s < nSeats; s++) {
        var ang     = offset + (s / nSeats) * Math.PI * 2;
        var normAng = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        var diff    = Math.abs(normAng - AISLE);
        diff = Math.min(diff, Math.PI * 2 - diff);
        if (diff < AISLE_W) continue;

        var sx = CX + rowR * Math.cos(ang);
        var sy = CY + rowR * Math.sin(ang);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang + Math.PI / 2);

        /* 座面 */
        ctx.fillStyle = cBody;
        ctx.beginPath();
        pathRoundRect(ctx, -SW / 2, 0, SW, SD * 0.55, 1.5);
        ctx.fill();

        /* 背もたれ（外側） */
        ctx.fillStyle = cBack;
        ctx.beginPath();
        pathRoundRect(ctx, -SW / 2, -SD * 0.45, SW, SD * 0.45, 1.5);
        ctx.fill();

        ctx.restore();
      }
    }

    /* 中央プロジェクターシルエット */
    ctx.fillStyle = 'rgba(6,6,16,0.92)';
    ctx.beginPath();
    ctx.arc(CX, CY, IN_R * 0.55, 0, Math.PI * 2);
    ctx.fill();

    var projGl = ctx.createRadialGradient(CX, CY - IN_R * 0.1, 0, CX, CY, IN_R * 0.55);
    projGl.addColorStop(0, 'rgba(55,70,130,0.22)');
    projGl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = projGl;
    ctx.beginPath();
    ctx.arc(CX, CY, IN_R * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    var tex = new THREE.CanvasTexture(tc);
    tex.flipY = false;
    return tex;
  }

  /* ── シェーダー ── */
  var vertexShader = [
    'varying vec3 vPos;',
    'void main() {',
    '  vPos = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var fragmentShader = [
    'uniform sampler2D uTexA;',
    'uniform sampler2D uTexB;',
    'uniform float     uBlend;',
    'uniform sampler2D uSeatTex;',
    'varying vec3 vPos;',
    'const float PI = 3.14159265358979323;',
    '',
    'void main() {',
    '  vec3  dir   = normalize(vPos);',
    '  float phi   = acos(clamp(dir.y, -1.0, 1.0));',
    '  float theta = atan(dir.z, dir.x);',
    '',
    '  /* 上半球: ドームマスター画像 (クロスフェード) */',
    '  /* 水平線を超えた分（下半球側）は円の外にはみ出さないようクランプ */',
    '  float r_dome = min(phi, PI * 0.5) / (PI * 0.5) * 0.5;',
    '  vec2  uv_dome = vec2(0.5 + r_dome * cos(theta), 0.5 + r_dome * sin(theta));',
    '  vec4  domeCol = mix(texture2D(uTexA, uv_dome), texture2D(uTexB, uv_dome), uBlend);',
    '',
    '  /* 下半球: 座席テクスチャ */',
    '  /* phi=PI(天底)→r=0(中心), phi=PI/2(水平)→r=0.5(外縁=座席) */',
    '  float r_seat = (PI - max(phi, PI * 0.5)) / (PI * 0.5) * 0.5;',
    '  vec2  uv_seat = vec2(0.5 + r_seat * cos(theta), 0.5 + r_seat * sin(theta));',
    '  vec4  seatCol = texture2D(uSeatTex, uv_seat);',
    '',
    '  /* 水平線ちょうどで切り替え（帯を広げると、クランプした端のピクセルが透けて見えるため狭く保つ） */',
    '  float hBlend = smoothstep(PI * 0.495, PI * 0.505, phi);',
    '  vec4  color  = mix(domeCol, seatCol, hBlend);',
    '',
    '  /* ドームメッシュ グリッドライン (上半球のみ) */',
    '  float LAT_STEP = PI / 9.0;',
    '  float LON_STEP = PI / 6.0;',
    '  float LW       = 0.003;',
    '',
    '  float latMod  = mod(phi, LAT_STEP);',
    '  float latDist = min(latMod, LAT_STEP - latMod);',
    '  float latLine = 1.0 - smoothstep(0.0, LW, latDist);',
    '',
    '  float lonMod  = mod(theta + PI, LON_STEP);',
    '  float lonDist = min(lonMod, LON_STEP - lonMod);',
    '  float lonLine = (1.0 - smoothstep(0.0, LW, lonDist)) * smoothstep(0.0, 0.08, phi);',
    '',
    '  float grid = max(latLine, lonLine) * (1.0 - hBlend) * 0.12;',
    '  color = mix(color, vec4(0.5, 0.68, 1.0, 1.0), grid);',
    '',
    '  gl_FragColor = color;',
    '}'
  ].join('\n');

  /* ── メッシュ ── */
  var geo     = new THREE.SphereGeometry(100, 64, 40);
  var starTex  = buildStarTexture();
  var seatTex  = buildSeatTexture();

  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTexA:    { value: starTex },
      uTexB:    { value: starTex },
      uBlend:   { value: 0.0 },
      uSeatTex: { value: seatTex },
    },
    vertexShader:   vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide,
  });

  scene.add(new THREE.Mesh(geo, mat));

  /* ── クロスフェード ── */
  var loader    = new THREE.TextureLoader();
  var fadeStart = -1;
  var FADE_DUR  = 600; /* ms */

  function crossfadeTo(newTex) {
    mat.uniforms.uTexA.value  = mat.uniforms.uTexB.value;
    mat.uniforms.uTexB.value  = newTex;
    mat.uniforms.uBlend.value = 0.0;
    fadeStart = performance.now();
  }

  var loadTimer = null;
  document.addEventListener('dome:setTexture', function (e) {
    var src = e.detail && e.detail.src;
    if (!src) return;
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      loader.load(src, function (tex) {
        tex.flipY = false;
        crossfadeTo(tex);
      });
    }, 80);
  });

  document.addEventListener('dome:resetTexture', function () {
    crossfadeTo(starTex);
  });

  /* ── 視点制御 ── */
  var phi   = Math.PI * 0.3, theta = 0;  /* 天頂から54°（水平より36°上向き） */
  var tPhi  = phi,           tTheta = theta;
  var lastInteract = 0;

  var isDragging = false, dragX = 0, dragY = 0;
  window.addEventListener('mousedown', function (e) {
    isDragging = true; dragX = e.clientX; dragY = e.clientY;
    lastInteract = Date.now();
  });
  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    tTheta -= (e.clientX - dragX) * 0.003;
    tPhi    = clampPhi(tPhi + (e.clientY - dragY) * 0.003);
    dragX = e.clientX; dragY = e.clientY; lastInteract = Date.now();
  });
  window.addEventListener('mouseup', function () { isDragging = false; });

  var tx = 0, ty = 0;
  window.addEventListener('touchstart', function (e) {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    lastInteract = Date.now();
  }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    tTheta -= (e.touches[0].clientX - tx) * 0.003;
    tPhi    = clampPhi(tPhi + (e.touches[0].clientY - ty) * 0.003);
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; lastInteract = Date.now();
  }, { passive: true });

  /* beta が ±90°付近（端末を立てて縦持ちする姿勢）ではセンサーのジンバルロックにより
     alpha が瞬間的に大きく暴れることがあるため、円環を考慮した指数移動平均で平滑化する */
  var useGyro = false, gyroAlpha = 0, gyroBeta = 90, gyroInit = false;
  function onOrientation(e) {
    if (e.alpha === null) return;
    useGyro = true; lastInteract = Date.now();

    if (!gyroInit) {
      gyroAlpha = e.alpha; gyroBeta = e.beta; gyroInit = true;
      return;
    }
    var da = ((e.alpha - gyroAlpha + 540) % 360) - 180; /* -180〜180 の最短差分 */
    gyroAlpha = (gyroAlpha + da * 0.15 + 360) % 360;
    gyroBeta += (e.beta - gyroBeta) * 0.15;
  }
  function enableGyro() { window.addEventListener('deviceorientation', onOrientation); }
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.addEventListener('click', function req() {
      DeviceOrientationEvent.requestPermission()
        .then(function (s) { if (s === 'granted') enableGyro(); })
        .catch(function () {});
      document.removeEventListener('click', req);
    }, { once: true });
  } else if ('DeviceOrientationEvent' in window) {
    enableGyro();
  }

  function clampPhi(v)  { return Math.max(0.08, Math.min(Math.PI - 0.08, v)); }
  function degToRad(d) { return d * Math.PI / 180; }

  /* ── アニメーションループ ── */
  function animate() {
    requestAnimationFrame(animate);

    /* クロスフェード */
    if (fadeStart >= 0) {
      var t = Math.min((performance.now() - fadeStart) / FADE_DUR, 1.0);
      mat.uniforms.uBlend.value = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      if (t >= 1.0) {
        fadeStart = -1;
        mat.uniforms.uTexA.value  = mat.uniforms.uTexB.value;
        mat.uniforms.uBlend.value = 0.0;
      }
    }

    if (useGyro) {
      tPhi   = clampPhi(degToRad(90 - gyroBeta));
      tTheta = degToRad(gyroAlpha);
    } else if (Date.now() - lastInteract > 4000) {
      tTheta += 0.00035;
    }

    phi += (tPhi - phi) * 0.06;
    var dTheta = ((tTheta - theta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    theta += dTheta * 0.06;

    camera.lookAt(
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.cos(theta)
    );

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
})();
