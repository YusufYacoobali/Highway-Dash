(function () {
  const LANES = [-4.5, -1.5, 1.5, 4.5];
  const ROAD_W = 13;
  const BODY_COLORS = [0x3B7BE0, 0xF2B705, 0x2FBF71, 0x9B5DE5, 0xF25C54, 0x24C6DC, 0xF08A24, 0xEDEDED];

  function waitForThree() {
    return new Promise((res) => {
      if (window.THREE) return res(window.THREE);
      const iv = setInterval(() => { if (window.THREE) { clearInterval(iv); res(window.THREE); } }, 40);
    });
  }

  class HDScene extends HTMLElement {
    static get observedAttributes() { return ['mode']; }

    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      this.style.cssText = 'position:absolute;inset:0;display:block;overflow:hidden';
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
      this.appendChild(this.canvas);
      waitForThree().then((T) => this.init(T));
    }
    disconnectedCallback() { this._dead = true; if (this._raf) cancelAnimationFrame(this._raf); }
    attributeChangedCallback(n, o, v) { if (n === 'mode' && this.g) this.setMode(v); }

    // ---------- construction ----------
    init(T) {
      this.T = T;
      const w = this.clientWidth || 402, h = this.clientHeight || 874;
      const renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer = renderer;

      const scene = new T.Scene();
      scene.fog = new T.Fog(0x8FC7F5, 60, 190);
      this.scene = scene;

      const camera = new T.PerspectiveCamera(62, w / h, 0.4, 400);
      camera.position.set(0, 6.9, 14.6);
      camera.lookAt(0, 1.4, -14);
      this.camera = camera;

      scene.add(new T.HemisphereLight(0xEAF6FF, 0x4E7A3A, 0.95));
      const sun = new T.DirectionalLight(0xFFF0D0, 1.5);
      sun.position.set(-16, 30, 12);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      const d = 34;
      sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
      sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
      sun.shadow.camera.far = 90;
      scene.add(sun);
      scene.add(sun.target);
      this.sunLight = sun;

      this.buildSky(T);
      this.buildGround(T);
      this.buildProps(T);

      this.player = this.makeCar(T, 0xE8332E, 'hero');
      this.player.userData.modelKind = 'hero';
      this.player.position.set(0, 0, -2);
      scene.add(this.player);

      this.traffic = [];
      this.coins = [];
      this.trafficPool = [];
      this.coinPool = [];

      this.g = {
        t: 0, speed: 26, target: 0, x: 0, dist: 0, coins: 0, combo: 0, comboT: 0,
        near: 0, stars: 0, starProg: 0, lastNear: -9, maxStars: 0, top: 90,
        spawn: 0.4, coinSpawn: 1, over: false, started: false, nitro: 0, mode: 'menu',
        shake: 0, ramp: +(this.getAttribute('ramp') || 115),
      };
      this.setMode(this.getAttribute('mode') || 'menu');
      this.prefill();

      this.canvas.addEventListener('pointerdown', this.onDown);
      this.canvas.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('keydown', this.onKey);
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this);

      this.clock = new T.Clock();
      this.loadModels(T);
      this.loop();
    }

    async loadModels(T) {
      let GLTFLoader;
      try {
        ({ GLTFLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'));
      } catch (e) { return; }
      const base = this.getAttribute('models') || 'uploads/';
      const files = {
        hero:  'player_sports_car.glb',
        sedan: 'traffic_sedan_blue.glb',
        hatch: 'traffic_hatchback_teal.glb',
        suv:   'traffic_suv_yellow.glb',
        truck: 'traffic_box_truck.glb',
      };
      const loader = new GLTFLoader();
      const out = {};
      await Promise.all(Object.entries(files).map(([k, f]) => new Promise((res) => {
        loader.load(base + f, (g) => { out[k] = g.scene; res(); }, undefined, () => res());
      })));
      const targetLen = { hero: 5.4, sedan: 5.4, hatch: 5.0, suv: 5.8, truck: 8.4 };
      for (const [k, root] of Object.entries(out)) {
        const box = new T.Box3().setFromObject(root);
        const size = new T.Vector3(), center = new T.Vector3();
        box.getSize(size); box.getCenter(center);
        const s = targetLen[k] / Math.max(0.001, size.z);
        root.scale.setScalar(s);
        root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
        root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
        const wrap = new T.Group();
        wrap.add(root);
        wrap.rotation.y = Math.PI; // models face +Z, traffic drives toward -Z
        const holder = new T.Group();
        holder.add(wrap);
        holder.userData = { len: targetLen[k], wid: size.x * s };
        out[k] = holder;
      }
      if (!Object.keys(out).length) return;
      this.models = out;
      this.skin(this.player, 'hero');
      this.traffic.concat(this.trafficPool).forEach((c) => this.skin(c, c.userData.modelKind));
    }

    skin(group, kind) {
      const m = this.models && (this.models[kind] || this.models.sedan);
      if (!m || !group) return;
      for (let i = group.children.length - 1; i >= 0; i--) group.remove(group.children[i]);
      const clone = m.clone(true);
      group.add(clone);
      group.userData.len = m.userData.len;
      group.userData.wid = m.userData.wid;
      group.userData.modelKind = kind;
    }

    buildSky(T) {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 256;
      const ctx = c.getContext('2d');
      const grd = ctx.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0.00, '#1F7FE0');
      grd.addColorStop(0.42, '#5FB8F5');
      grd.addColorStop(0.68, '#FFC46B');
      grd.addColorStop(0.85, '#FF9A4D');
      grd.addColorStop(1.00, '#FFD79A');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, 4, 256);
      const tex = new T.CanvasTexture(c);
      const sky = new T.Mesh(
        new T.SphereGeometry(280, 24, 16),
        new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false })
      );
      this.scene.add(sky);

      const sun = new T.Mesh(
        new T.CircleGeometry(13, 32),
        new T.MeshBasicMaterial({ color: 0xFFF2C2, fog: false })
      );
      sun.position.set(0, 6, -220);
      this.scene.add(sun);

      // skyline silhouette
      const sky1 = new T.Group();
      let x = -150;
      while (x < 150) {
        const bw = 6 + Math.random() * 12, bh = 14 + Math.random() * 40;
        if (Math.abs(x) > 16) {
          const b = new T.Mesh(
            new T.BoxGeometry(bw, bh, 6),
            new T.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x6B5CA5 : 0x7C6BB8, fog: false })
          );
          b.position.set(x + bw / 2, bh / 2, -178 - Math.random() * 26);
          sky1.add(b);
        }
        x += bw + 2 + Math.random() * 5;
      }
      this.scene.add(sky1);

      const cloudMat = new T.MeshBasicMaterial({ color: 0xFFE7C9, fog: false });
      for (let i = 0; i < 5; i++) {
        const g = new T.Group();
        for (let j = 0; j < 3; j++) {
          const s = 5 + Math.random() * 5;
          const m = new T.Mesh(new T.SphereGeometry(s, 10, 8), cloudMat);
          m.position.set(j * s * 1.1 - s, Math.random() * 2, 0);
          m.scale.y = 0.62;
          g.add(m);
        }
        g.position.set(-130 + Math.random() * 260, 58 + Math.random() * 30, -160 - Math.random() * 60);
        this.scene.add(g);
      }
    }

    buildGround(T) {
      const grass = new T.Mesh(
        new T.PlaneGeometry(400, 620),
        new T.MeshLambertMaterial({ color: 0x57B94A })
      );
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(0, -0.06, -180);
      grass.receiveShadow = true;
      this.scene.add(grass);

      const road = new T.Mesh(
        new T.PlaneGeometry(ROAD_W, 620),
        new T.MeshLambertMaterial({ color: 0x41454C })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, -180);
      road.receiveShadow = true;
      this.scene.add(road);

      const shoulder = new T.MeshLambertMaterial({ color: 0xF2F1EC });
      [-ROAD_W / 2 + 0.32, ROAD_W / 2 - 0.32].forEach((sx) => {
        const m = new T.Mesh(new T.PlaneGeometry(0.42, 620), shoulder);
        m.rotation.x = -Math.PI / 2;
        m.position.set(sx, 0.02, -180);
        this.scene.add(m);
      });

      // dashed lane markers (recycled)
      this.dashes = [];
      const dashGeo = new T.PlaneGeometry(0.28, 3.4);
      const dashMat = new T.MeshBasicMaterial({ color: 0xF4F3EE });
      for (const lx of [-3, 0, 3]) {
        for (let i = 0; i < 26; i++) {
          const m = new T.Mesh(dashGeo, dashMat);
          m.rotation.x = -Math.PI / 2;
          m.position.set(lx, 0.03, 10 - i * 8);
          this.scene.add(m);
          this.dashes.push(m);
        }
      }

      // barriers
      this.barriers = [];
      const barGeoW = new T.BoxGeometry(0.7, 1.1, 4.4);
      const white = new T.MeshLambertMaterial({ color: 0xF2F1EC });
      const red = new T.MeshLambertMaterial({ color: 0xE0503F });
      for (const sx of [-ROAD_W / 2 - 0.6, ROAD_W / 2 + 0.6]) {
        for (let i = 0; i < 34; i++) {
          const m = new T.Mesh(barGeoW, i % 2 ? red : white);
          m.position.set(sx, 0.55, 10 - i * 5.4);
          m.castShadow = true;
          this.scene.add(m);
          this.barriers.push(m);
        }
      }
    }

    buildProps(T) {
      this.trees = [];
      const trunkMat = new T.MeshLambertMaterial({ color: 0x8B5A2B });
      const leafMats = [0x3F9E33, 0x4FBF3F, 0x358C2E].map((c) => new T.MeshLambertMaterial({ color: c }));
      const trunkGeo = new T.CylinderGeometry(0.32, 0.42, 2.2, 6);
      const leafGeo = new T.IcosahedronGeometry(2.5, 0);
      for (let i = 0; i < 26; i++) {
        const g = new T.Group();
        const tr = new T.Mesh(trunkGeo, trunkMat);
        tr.position.y = 1.1; tr.castShadow = true;
        const lf = new T.Mesh(leafGeo, leafMats[i % 3]);
        lf.position.y = 3.6; lf.scale.set(1, 1.15, 1); lf.castShadow = true;
        g.add(tr, lf);
        const side = i % 2 ? 1 : -1;
        g.position.set(side * (10 + Math.random() * 16), 0, 8 - i * 9 - Math.random() * 5);
        g.rotation.y = Math.random() * 3;
        const s = 0.85 + Math.random() * 0.6;
        g.scale.setScalar(s);
        this.scene.add(g);
        this.trees.push(g);
      }
    }

    makeCar(T, color, kind) {
      const g = new T.Group();
      const paint = new T.MeshLambertMaterial({ color });
      const dark = new T.MeshLambertMaterial({ color: 0x1B2330 });
      const glass = new T.MeshLambertMaterial({ color: 0x2C3E55 });
      const light = new T.MeshLambertMaterial({ color: 0xFFE9A8 });
      const tail = new T.MeshLambertMaterial({ color: 0xE8443A });
      const chrome = new T.MeshLambertMaterial({ color: 0xBFC7D2 });

      const isTruck = kind === 'truck';
      const isVan = kind === 'van';
      const len = isTruck ? 8.4 : isVan ? 6.4 : 5.4;
      const wid = isTruck ? 3.0 : 2.5;
      const bodyH = isTruck ? 1.5 : 1.05;

      const body = new T.Mesh(new T.BoxGeometry(wid, bodyH, len), paint);
      body.position.y = 0.92; body.castShadow = true;
      g.add(body);

      if (isTruck) {
        const box = new T.Mesh(new T.BoxGeometry(wid + 0.12, 2.5, len * 0.62), new T.MeshLambertMaterial({ color: 0xF0EFEA }));
        box.position.set(0, 2.65, -len * 0.12);
        box.castShadow = true;
        g.add(box);
        const cab = new T.Mesh(new T.BoxGeometry(wid - 0.2, 1.5, 1.9), paint);
        cab.position.set(0, 2.15, len * 0.34);
        cab.castShadow = true;
        g.add(cab);
        const cw = new T.Mesh(new T.BoxGeometry(wid - 0.5, 0.85, 0.14), glass);
        cw.position.set(0, 2.3, len * 0.34 + 0.95);
        g.add(cw);
      } else {
        const cabinLen = isVan ? len * 0.62 : len * 0.5;
        const cabin = new T.Mesh(new T.BoxGeometry(wid - 0.28, isVan ? 1.35 : 0.95, cabinLen), paint);
        cabin.position.set(0, 1.42 + (isVan ? 0.2 : 0), isVan ? -0.1 : -0.35);
        cabin.castShadow = true;
        g.add(cabin);
        const roofGlass = new T.Mesh(new T.BoxGeometry(wid - 0.5, 0.06, cabinLen - 0.7), glass);
        roofGlass.position.set(0, 1.92 + (isVan ? 0.3 : 0), isVan ? -0.1 : -0.35);
        g.add(roofGlass);
        const rear = new T.Mesh(new T.BoxGeometry(wid - 0.5, 0.72, 0.12), glass);
        rear.position.set(0, 1.5 + (isVan ? 0.2 : 0), -0.35 + cabinLen / 2);
        g.add(rear);
        const front = new T.Mesh(new T.BoxGeometry(wid - 0.5, 0.66, 0.12), glass);
        front.position.set(0, 1.5 + (isVan ? 0.2 : 0), -0.35 - cabinLen / 2);
        g.add(front);
      }

      if (kind === 'hero') {
        const stripeMat = new T.MeshLambertMaterial({ color: 0xFFFFFF });
        [-0.38, 0.38].forEach((sx) => {
          const roof = new T.Mesh(new T.BoxGeometry(0.34, 0.06, len * 0.48), stripeMat);
          roof.position.set(sx, 1.93, -0.35);
          g.add(roof);
          const hood = new T.Mesh(new T.BoxGeometry(0.34, 0.06, len * 0.2), stripeMat);
          hood.position.set(sx, 1.46, -len * 0.36);
          g.add(hood);
          const trunk = new T.Mesh(new T.BoxGeometry(0.34, 0.06, len * 0.18), stripeMat);
          trunk.position.set(sx, 1.46, len * 0.34);
          g.add(trunk);
        });
        const spoiler = new T.Mesh(new T.BoxGeometry(wid - 0.3, 0.14, 0.5), dark);
        spoiler.position.set(0, 1.62, len / 2 - 0.35);
        g.add(spoiler);
      }

      // wheels
      const wheelGeo = new T.CylinderGeometry(0.58, 0.58, 0.42, 12);
      const wz = len / 2 - 1.15;
      [[-wid / 2, wz], [wid / 2, wz], [-wid / 2, -wz], [wid / 2, -wz]].forEach(([wx, wzz]) => {
        const w = new T.Mesh(wheelGeo, dark);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.58, wzz);
        w.castShadow = true;
        g.add(w);
      });

      // lights
      [[-wid / 2 + 0.5, 1], [wid / 2 - 0.5, 1]].forEach(([lx]) => {
        const back = new T.Mesh(new T.BoxGeometry(0.6, 0.26, 0.12), tail);
        back.position.set(lx, 1.02, len / 2 + 0.01);
        g.add(back);
        const fr = new T.Mesh(new T.BoxGeometry(0.62, 0.28, 0.12), light);
        fr.position.set(lx, 1.02, -len / 2 - 0.01);
        g.add(fr);
      });
      const bumper = new T.Mesh(new T.BoxGeometry(wid + 0.08, 0.3, 0.3), chrome);
      bumper.position.set(0, 0.68, len / 2 + 0.05);
      g.add(bumper);

      g.userData = { len, wid };
      return g;
    }

    spawnTraffic() {
      const T = this.T, g = this.g;
      const lane = LANES[(Math.random() * 4) | 0];
      let car = this.trafficPool.pop();
      if (!car) {
        const kinds = ['sedan', 'hatch', 'suv', 'sedan', 'truck'];
        const kind = kinds[(Math.random() * kinds.length) | 0];
        car = this.makeCar(T, BODY_COLORS[(Math.random() * BODY_COLORS.length) | 0], kind === 'truck' ? 'truck' : kind === 'suv' ? 'van' : 'sedan');
        car.userData.modelKind = kind;
        this.scene.add(car);
        if (this.models) this.skin(car, kind);
      }
      car.visible = true;
      car.position.set(lane + (Math.random() - 0.5) * 0.7, 0, -150);
      car.userData.speed = 11 + Math.random() * 7;
      car.userData.passed = false;
      this.traffic.push(car);
    }

    spawnCoinRun() {
      const lane = LANES[(Math.random() * 4) | 0];
      const n = 4 + ((Math.random() * 4) | 0);
      const arc = Math.random() < 0.45;
      for (let i = 0; i < n; i++) {
        const c = this.spawnCoin();
        c.position.x = lane;
        c.position.z = -150 - i * 4.2;
        c.position.y = arc ? 1.4 + Math.sin((i / (n - 1)) * Math.PI) * 1.9 : 1.4;
      }
    }
    spawnCoin() {
      const T = this.T;
      let c = this.coinPool.pop();
      if (!c) {
        c = new T.Mesh(
          new T.CylinderGeometry(0.62, 0.62, 0.14, 16),
          new T.MeshLambertMaterial({ color: 0xFFC02E, emissive: 0x6B4400 })
        );
        c.rotation.x = Math.PI / 2;
        c.castShadow = true;
        this.scene.add(c);
      }
      c.visible = true;
      c.position.set(LANES[(Math.random() * 4) | 0], 1.4, -150);
      this.coins.push(c);
      return c;
    }

    // ---------- input ----------
    onDown = (e) => {
      const g = this.g; if (!g || g.mode !== 'run' || g.over) return;
      g.drag = true; g.started = true;
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
      this.steerTo(e);
    };
    onMove = (e) => { if (this.g && this.g.drag) this.steerTo(e); };
    onUp = () => { if (this.g) this.g.drag = false; };
    onKey = (e) => {
      const g = this.g; if (!g || g.mode !== 'run' || g.over) return;
      if (e.key === 'ArrowLeft') { g.target = Math.max(-5.4, g.target - 1.5); g.started = true; }
      if (e.key === 'ArrowRight') { g.target = Math.min(5.4, g.target + 1.5); g.started = true; }
      if (e.code === 'Space') this.nitro();
    };
    steerTo(e) {
      const r = this.canvas.getBoundingClientRect();
      const f = (e.clientX - r.left) / r.width;
      this.g.target = Math.max(-5.4, Math.min(5.4, (f - 0.5) * 13));
    }
    nitro() { const g = this.g; if (g && g.mode === 'run' && !g.over && g.nitro <= 0) { g.nitro = 2.2; g.started = true; } }

    setMode(mode) {
      const g = this.g; if (!g) return;
      g.mode = mode;
      if (mode !== 'run') { g.over = false; g.speed = 24; }
      if (mode === 'run') {
        g.crashPayload = null; g.reported = false; g.crashT = 0;
        this.player.rotation.set(0, 0, 0); this.player.position.set(0, 0, -2);
        this.camera.fov = 62; this.camera.updateProjectionMatrix();
        g.t = 0; g.speed = 30; g.dist = 0; g.coins = 0; g.combo = 0; g.comboT = 0;
        g.near = 0; g.stars = 0; g.starProg = 0; g.lastNear = -9; g.maxStars = 0;
        g.top = 90; g.over = false; g.started = false; g.nitro = 0; g.x = 0; g.target = 0;
        g.ramp = +(this.getAttribute('ramp') || 115);
        while (this.traffic.length) { const c = this.traffic.pop(); c.visible = false; this.trafficPool.push(c); }
        while (this.coins.length) { const c = this.coins.pop(); c.visible = false; this.coinPool.push(c); }
        this.prefill(true);
      }
    }

    prefill(runway) {
      const start = runway ? -52 : -14;
      for (let i = 0; i < 12; i++) {
        this.spawnTraffic();
        const c = this.traffic[this.traffic.length - 1];
        c.position.z = start - i * (runway ? 17 : 11) - Math.random() * 6;
        // keep the player's start lane clear for the first rows
        if (runway && i < 5 && Math.abs(c.position.x) < 2.5) c.position.x = c.position.x < 0 ? -4.5 : 4.5;
      }
      for (let i = 0; i < 3; i++) {
        this.spawnCoinRun();
        for (const c of this.coins.slice(-7)) c.position.z -= i * 34;
      }
    }
    resize() {
      const w = this.clientWidth, h = this.clientHeight;
      if (!w || !h || !this.renderer) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    emit(name, detail) {
      const bridge = document.querySelector('[data-hd-bridge="' + name + '"]');
      if (bridge) {
        bridge.dataset.payload = JSON.stringify(detail);
        bridge.click();
      }
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    }
    hud(detail) {
      const el = document.querySelector('[data-hd-hud]');
      if (!el) return;
      el.dataset.hud = JSON.stringify(detail);
      el.click();
    }

    // ---------- loop ----------
    loop = () => {
      if (this._dead) return;
      this._raf = requestAnimationFrame(this.loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      const g = this.g;
      if (!g) return;

      if (g.over && g.crashPayload) { this.crashStep(dt); return; }
      const menu = g.mode !== 'run';
      g.t += dt;

      if (menu) {
        g.speed = 24;
        g.x += (Math.sin(g.t * 0.42) * 2.4 - g.x) * dt * 1.6;
      } else {
        const ramp = Math.max(20, g.ramp);
        const base = 48 + Math.min(72, (g.t / ramp) * 72);
        g.nitro = Math.max(0, g.nitro - dt);
        g.speed += ((g.nitro > 0 ? base * 1.5 : base) - g.speed) * dt * 3.2;
        g.x += (g.target - g.x) * Math.min(1, dt * 11);
      }
      if (!g.started && !menu) g.speed = 44;

      const kmh = Math.round(g.speed * 3.9);
      g.top = Math.max(g.top, kmh);
      g.dist += g.speed * dt;

      // player
      const p = this.player;
      const tilt = Math.max(-0.3, Math.min(0.3, (g.target - g.x) * 0.16));
      p.position.x += (g.x - p.position.x) * Math.min(1, dt * 12);
      p.rotation.y = -tilt * (menu ? 0.4 : 1);
      p.rotation.z = tilt * 0.5;

      // camera
      const shake = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
      g.shake = Math.max(0, g.shake - dt * 1.6);
      const camX = p.position.x * 0.55 + shake;
      this.camera.position.x += (camX - this.camera.position.x) * Math.min(1, dt * 7);
      this.camera.position.y = 6.9 + (menu ? 0.6 : 0);
      this.camera.position.z = 14.6 + (g.nitro > 0 ? 1.3 : 0);
      this.camera.lookAt(p.position.x * 0.35, 1.1, -20);
      const fov = 62 + (g.nitro > 0 ? 10 : 0) + Math.min(8, (kmh - 120) / 22);
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
      this.sunLight.target.position.set(p.position.x, 0, -10);

      const move = g.speed * dt;

      for (const d of this.dashes) { d.position.z += move; if (d.position.z > 14) d.position.z -= 208; }
      for (const b of this.barriers) { b.position.z += move; if (b.position.z > 14) b.position.z -= 183.6; }
      for (const t of this.trees) {
        t.position.z += move;
        if (t.position.z > 16) {
          t.position.z -= 240;
          t.position.x = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 16);
        }
      }

      // spawn
      if (!g.over) {
        g.spawn -= dt;
        if (g.spawn <= 0) {
          g.spawn = menu ? 0.42 : Math.max(0.42, 1.15 - g.speed / 190);
          this.spawnTraffic();
          if (!menu && g.t > 22 && Math.random() < 0.16) this.spawnTraffic();
        }
        g.coinSpawn -= dt;
        if (g.coinSpawn <= 0) { g.coinSpawn = 2.1; this.spawnCoinRun(); }
      }

      // traffic
      for (let i = this.traffic.length - 1; i >= 0; i--) {
        const c = this.traffic[i];
        c.position.z += (g.speed - c.userData.speed) * dt;
        const dx = Math.abs(c.position.x - p.position.x);
        const dz = c.position.z - p.position.z;
        if (!menu && !g.over && dz > -3.2 && dz < 3.2 && dx < (c.userData.wid + 2.5) / 2) {
          this.crash('SMASHED!');
          return;
        }
        if (!menu && !c.userData.passed && dz > 1.5) {
          c.userData.passed = true;
          if (dx < 3.6) {
            g.near++; g.combo++; g.comboT = 1.6; g.lastNear = g.t; g.shake = 0.5;
            g.coins += 2 + ((g.combo / 3) | 0);
            if (++g.starProg >= 4 && g.stars < 5) { g.starProg = 0; g.stars++; g.maxStars = Math.max(g.maxStars, g.stars); }
            this.emit('hdnear', { combo: g.combo, stars: g.stars });
          }
        }
        if (dz > 20) { c.visible = false; this.traffic.splice(i, 1); this.trafficPool.push(c); }
      }

      // coins
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.position.z += move;
        c.rotation.z += dt * 5;
        if (!menu && Math.abs(c.position.x - p.position.x) < 1.9 && c.position.z - p.position.z > -2 && c.position.z - p.position.z < 2.4) {
          g.coins += 5;
          c.visible = false; this.coins.splice(i, 1); this.coinPool.push(c);
          continue;
        }
        if (c.position.z > 20) { c.visible = false; this.coins.splice(i, 1); this.coinPool.push(c); }
      }

      if (g.comboT > 0) { g.comboT -= dt; if (g.comboT <= 0) g.combo = 0; }
      if (!menu) {
        if (g.t - g.lastNear > 7 && g.stars > 0) { g.stars--; g.starProg = 0; g.lastNear = g.t; }
        if (g.stars >= 5) { g.hot = (g.hot || 0) + dt; if (g.hot > 9) { this.crash('BUSTED!'); return; } }
        else g.hot = 0;
        this.hud({
          kmh, dist: Math.round(g.dist * 2.2), coins: g.coins, combo: g.comboT > 0 ? g.combo : 0,
          stars: g.stars, started: g.started, nitro: g.nitro > 0,
        });
      }

      this.renderer.render(this.scene, this.camera);
    };

    crash(title) {
      const g = this.g;
      if (g.over) return;
      g.over = true;
      g.shake = 3.2;
      g.crashT = 0;
      g.crashSpin = (Math.random() > 0.5 ? 1 : -1) * (3.4 + Math.random() * 2.2);
      g.crashLift = 7 + Math.random() * 3;
      g.crashPayload = {
        title, dist: Math.round(g.dist * 2.2), coins: g.coins, near: g.near,
        top: g.top, stars: g.maxStars, xp: Math.round(g.dist * 0.28) + g.near * 3,
      };
    }

    crashStep(dt) {
      const g = this.g, p = this.player, T = this.T;
      g.crashT += dt;
      const t = g.crashT;
      // slow-mo tumble away from the impact
      const slow = Math.max(0.12, 1 - t * 1.5);
      g.speed = Math.max(0, g.speed - dt * 34);
      const move = g.speed * dt * slow;
      for (const d of this.dashes) { d.position.z += move; if (d.position.z > 14) d.position.z -= 208; }
      for (const b of this.barriers) { b.position.z += move; if (b.position.z > 14) b.position.z -= 183.6; }
      for (const tr of this.trees) { tr.position.z += move; if (tr.position.z > 16) tr.position.z -= 240; }
      for (const c of this.traffic) c.position.z += (g.speed - c.userData.speed) * dt * slow;
      for (const c of this.coins) c.position.z += move;

      p.rotation.y += g.crashSpin * dt * slow * 2.4;
      p.rotation.z += g.crashSpin * dt * slow * 1.1;
      p.position.y = Math.max(0, p.position.y + (g.crashLift * dt - t * t * 7 * dt) * 3.4);
      p.position.z += 5.5 * dt * slow;
      p.position.x += g.crashSpin * 0.35 * dt;

      // camera punches in, then pulls back and drops low
      const k = Math.min(1, t / 0.9);
      this.camera.position.x += (p.position.x * 0.8 - this.camera.position.x) * Math.min(1, dt * 5);
      this.camera.position.y = 6.9 - 3.1 * k + Math.sin(t * 26) * g.shake * 0.16;
      this.camera.position.z = 14.6 - 5.4 * k;
      this.camera.lookAt(p.position.x * 0.6, 1.1 + p.position.y * 0.5, p.position.z - 4);
      this.camera.fov += ((78 - 16 * k) - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
      g.shake = Math.max(0, g.shake - dt * 2.2);

      this.renderer.render(this.scene, this.camera);
      if (t > 1.25 && !g.reported) { g.reported = true; this.emit('hdcrash', g.crashPayload); }
    }
  }

  if (!customElements.get('hd-scene')) customElements.define('hd-scene', HDScene);
  window.HDScene = HDScene;
})();
