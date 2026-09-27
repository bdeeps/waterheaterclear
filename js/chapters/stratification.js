// Chapter 3: hot water floats. The layered tank model (Tank in geyser.js) runs with draw-off,
// the inlet jet and the element, sped up SPEED times. The section shows every layer's temperature.
import { THREE, M, arrow, swarm, tube, canvasTexture, clamp } from '../kit.js';
import { makeGeyser, makeWater, makeWall, Tank, rho, cssTemp, tempColor, TANK_TOP, TANK_BOT, fitView, responsive } from '../geyser.js';

const VIEW = { pos: [1.3, 4.7, 10.8], target: [1.3, 4.0, 0] };
const GX = -0.3, GY = 2.2, SC = 1.0;     // geyser position and scale
const SPEED = 20;                          // simulated seconds per real second
const HOT = 60;
const SH = [2.5, 1.55, 0.3];               // shower head (world)

export default {
  id: 'stratification',
  short: 'Hot floats',
  title: 'Hot water floats',
  subtitle: 'Why the tap runs hot, hot, hot, then suddenly cold.',
  view: VIEW,
  learn: `<p>Warm water is a little <b>lighter</b> than cold water. At 60 °C a litre weighs 983 g; at 20 °C it weighs 998 g. That 1.5% is enough: hot water <b>floats</b> on cold, just as oil floats on water. So a geyser's tank sorts itself into <b>layers</b>, hottest at the top. This is called <b>stratification</b>.</p>
    <p>A geyser uses it. The element sits <b>low down</b>, so the water it warms rises in a gentle plume (a <b>convection current</b>) and collects at the top, where the <b>hot outlet</b> pipe draws from. Cold water comes in at the <b>bottom</b>, through a <b>deflector</b> or dip tube so it slides in gently instead of stirring everything up.</p>
    <p>When you open the tap, the cold water pushes the hot layer up and out like a piston. The boundary between them, the <b>thermocline</b>, climbs steadily. You get full-temperature water almost to the end, then it turns cold within a litre or two. Without a deflector the incoming jet mixes the tank, and the water fades from hot to lukewarm much sooner.</p>
    <p class="tip"><b>Try it:</b> run the shower with the element off and watch the thermocline rise. Then switch the inlet to "jet" and compare the curves.</p>`,
  terms: [
    { t: 'Density', d: 'How much mass fits in a given volume. Warm water is less dense than cold, so it rises.' },
    { t: 'Stratification', d: 'Layers of water sorted by temperature, hottest on top, that don’t mix on their own.' },
    { t: 'Convection', d: 'Heat carried by the fluid itself moving: warm water rises, cooler water sinks to take its place.' },
    { t: 'Thermocline', d: 'The thin boundary between the hot layer and the cold layer below it.' },
    { t: 'Dip tube / deflector', d: 'A pipe or cap that brings cold water in gently at the bottom so it doesn’t stir the tank.' },
  ],
  defaults: { flow: 6, heat: false, inlet: 'gentle', tin: 20 },
  controls: [
    { key: 'flow', type: 'range', label: 'Hot tap', min: 0, max: 10, step: 0.5, ends: ['off', 'full'], fmt: (v) => v.toFixed(1) + ' L/min' },
    { key: 'heat', type: 'toggle', label: 'Element on while you shower', hint: 'A 2 kW element can only reheat about 1.1 L/min by 25 °C, so it can’t keep up.' },
    { key: 'inlet', type: 'seg', label: 'Cold inlet', options: [{ v: 'gentle', label: 'Deflector' }, { v: 'jet', label: 'Jet (no deflector)' }] },
    { key: 'tank', type: 'buttons', label: 'Start again', items: [{ label: `Hot tank (${HOT} °C)`, act: (s, inst) => inst.reset(HOT) }, { label: 'Cold tank', act: (s, inst) => inst.reset(s.tin) }] },
  ],
  quiz: [
    { q: 'Why does hot water collect at the top of a geyser tank?', options: ['The outlet sucks it up', 'Hot water is less dense, so it floats on colder water', 'The element is at the top', 'Steam pushes it up'], answer: 1, why: 'Water expands as it warms. At 60 °C it is about 1.5% lighter than at 20 °C, so it rises and stays on top.' },
    { q: 'Why is the element placed near the bottom?', options: ['It is easier to wire', 'So the warmed water rises and heats the whole tank above it', 'To keep it away from the anode', 'Heat sinks'], answer: 1, why: 'Heat rises with the warm water. An element at the top would only heat the top layer, leaving cold water below.' },
    { q: 'Why does the shower go cold suddenly rather than slowly?', options: ['The thermostat switches off', 'The sharp boundary between hot and cold layers reaches the outlet', 'The pipes cool down', 'The element breaks'], answer: 1, why: 'Cold water fills from the bottom and lifts the hot layer out. Once the thermocline reaches the outlet at the top, it’s all cold.' },
  ],
  reel: [
    { ms: 5600, caption: 'Hot water is 1.5% lighter than cold, so it floats in a layer on top.', set: { flow: 0, heat: false, inlet: 'gentle' }, act: (s, inst) => { inst.reset(HOT); inst.preDraw(7, s); }, spin: 0.3 },
    { ms: 5600, caption: 'Open the tap and cold water lifts the hot layer out, until it suddenly runs cold.', set: { flow: 8, heat: false, inlet: 'gentle' }, act: (s, inst) => inst.reset(HOT), spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    root.add(makeWall(14));
    const pivot = new THREE.Group(); pivot.position.set(GX, GY, 0); pivot.scale.setScalar(SC); root.add(pivot);
    const G = makeGeyser(); G.setCut(true); pivot.add(G.group);
    const W = makeWater(48); pivot.add(W);
    G.anode.visible = G.anodeCore.visible = false;

    // Shower arm from the hot outlet across to a shower head.
    const out = new THREE.Vector3(0.95, -2.0, 0.15).multiplyScalar(SC).add(new THREE.Vector3(GX, GY, 0));
    root.add(tube([[out.x, out.y, out.z], [out.x + 0.2, out.y - 0.05, out.z], [SH[0], out.y, 0.1], [SH[0], SH[1] + 0.2, SH[2]]], 0.08, M.plastic(0xff5a3d), false, 60));
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.2, 0.18, 24), M.metal(0xc9ced8)); head.position.set(...SH); root.add(head);
    const ND = 90, drops = swarm(ND, new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    for (let i = 0; i < ND; i++) drops.setColorAt(i, new THREE.Color(0xffffff));
    drops.castShadow = false; root.add(drops);
    // Cold in (bottom) and hot out (top) arrows, and tracer specks that ride the plug flow.
    const aIn = arrow(0x3f8cff, 0.9, 0.25, 0.05); aIn.position.set(GX - 0.95 * SC, GY - 2.2, 0.6); root.add(aIn);
    const aOut = arrow(0xff5a3d, 0.9, 0.25, 0.05); aOut.position.set(GX + 0.95 * SC, GY - 1.2, 0.6); aOut.rotation.z = Math.PI; root.add(aOut);
    const NT = 60, tr = swarm(NT, new THREE.SphereGeometry(0.035, 6, 5), M.glow(0xffffff, { transparent: true, opacity: 0.7 }));
    tr.castShadow = false; pivot.add(tr);
    const hash = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const seed = Array.from({ length: NT }, (_, i) => [hash(i + 1), hash(i + 101) - 0.5]);

    const lOut = stage.label('', [0.95, TANK_TOP + 0.35, 0.3], pivot, 'hot');
    const lThermo = stage.label('Thermocline', [-1.9, 1.5, 0.3], pivot);
    const lCold = stage.label('', [-1.95, TANK_BOT + 0.35, 0.3], pivot);

    // Chart: outlet temperature against litres drawn.
    let hist = [], hist2 = [];
    const chart = canvasTexture(760, 560, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
      const x0 = 70, x1 = w - 30, y0 = h - 60, y1 = 80;
      const X = (L) => x0 + (L / 30) * (x1 - x0), Y = (T) => y0 - (T / 80) * (y0 - y1);
      g.font = 'bold 32px sans-serif'; g.fillStyle = '#e8eef8'; g.fillText('Water at the tap vs litres drawn', 20, 44);
      g.font = '22px sans-serif'; g.strokeStyle = 'rgba(255,255,255,.12)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
      for (let T = 0; T <= 80; T += 20) { g.beginPath(); g.moveTo(x0, Y(T)); g.lineTo(x1, Y(T)); g.stroke(); g.fillText(T + '°', 18, Y(T) + 8); }
      for (let L = 0; L <= 30; L += 5) g.fillText(L + ' L', X(L) - 16, y0 + 32);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(X(15), y1); g.lineTo(X(15), y0); g.stroke(); g.setLineDash([]);
      g.fillText('one tankful', X(15) + 8, y1 + 20);
      const line = (pts, alpha) => { if (pts.length < 2) return; for (let i = 1; i < pts.length; i++) { g.strokeStyle = cssTemp(pts[i][1]); g.globalAlpha = alpha; g.lineWidth = 6; g.beginPath(); g.moveTo(X(pts[i - 1][0]), Y(pts[i - 1][1])); g.lineTo(X(pts[i][0]), Y(pts[i][1])); g.stroke(); } g.globalAlpha = 1; };
      line(hist2, 0.35); line(hist, 1);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.39), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false }));
    board.position.set(4.6, 4.3, -1.0); board.rotation.y = -0.2; root.add(board);

    const resp = responsive(stage, (p) => (p ? fitView(stage, [1.0, 5.0, 0], [0, 0.12, 1], 15.5) : VIEW), (p) => {
      if (p) { board.position.set(1.0, 8.4, -0.9); board.rotation.y = 0; } else { board.position.set(4.6, 4.3, -1.0); board.rotation.y = -0.2; }
    });
    const tank = new Tank({ V: 15, N: 48, T0: HOT });
    let t = 0, lastRec = -1, redraw = 0;
    const inst = {
      preDraw(L, s) { for (let i = 0; i < 400 && tank.drawn < L; i++) tank.step(1, { q: 6, tin: s.tin, heat: false, jet: 2 }); hist = []; lastRec = -1; },
      reset(T) { tank.fill(T); if (hist.length > 3) hist2 = hist; hist = []; lastRec = -1; },
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        const sub = 6, h = (dt * SPEED) / sub;
        for (let i = 0; i < sub; i++) tank.step(h, { q: s.flow, tin: s.tin, kw: 2 * 0.95, heat: s.heat, tset: HOT, diff: 4, jet: s.inlet === 'jet' ? 16 : 2 });
        if (s.flow > 0 && tank.drawn <= 30 && tank.drawn - lastRec >= 0.1) { hist.push([tank.drawn, tank.outlet]); lastRec = tank.drawn; }
        W.setTemps(tank.T);
        G.setElement(tank.on ? 1 : 0);
        const flowing = s.flow > 0.05;
        aIn.visible = aOut.visible = flowing;
        const ph = (t * 1.2) % 1;
        aIn.position.y = GY - 2.3 + ph * 0.5; aOut.position.y = GY - 1.0 - ph * 0.5;
        // Shower drops coloured by the outlet temperature.
        drops.visible = flowing;
        if (flowing) {
          const c = tempColor(tank.outlet);
          for (let i = 0; i < ND; i++) {
            const u = (i / ND + t * 0.9) % 1, a = i * 2.39996, r = 0.08 + 0.22 * ((i * 0.618) % 1);
            drops.place(i, [SH[0] + Math.cos(a) * r * (1 + u), SH[1] - 0.15 - u * 1.4, SH[2] + Math.sin(a) * r * (1 + u)], null, 0.6 + 0.6 * Math.min(1, s.flow / 6));
            drops.setColorAt(i, c);
          }
          drops.done(); drops.instanceColor.needsUpdate = true;
        }
        // Tracers: move up with the draw (plug flow), and swirl up in a plume above the element.
        const bot = TANK_BOT + 0.1, top = TANK_TOP - 0.1;
        const plug = (s.flow / 60) * SPEED / 15 * (top - bot);   // units per real second
        for (let i = 0; i < NT; i++) {
          let y, x;
          if (tank.on && i < NT / 2) { const u = (seed[i][0] + t * 0.35) % 1; y = 0.4 + u * (top - 0.4); x = seed[i][1] * 0.5 * (0.3 + u); }
          else { seed[i][0] = (seed[i][0] + (plug * dt) / (top - bot)) % 1; y = bot + seed[i][0] * (top - bot); x = seed[i][1] * 2.2; }
          tr.place(i, [x, y, 0.08], null, 1);
        }
        tr.done();
        const tc = tank.thermocline(40);
        lThermo.visible = tc > 0.04 && tc < 0.97;
        lThermo.position.y = TANK_BOT + tc * (TANK_TOP - TANK_BOT);
        lOut.element.innerHTML = `Out <b>${Math.round(tank.outlet)} °C</b>`;
        lCold.element.innerHTML = flowing ? `Cold in <b>${s.tin} °C</b>` : '';
        lCold.visible = flowing;
        if ((redraw += dt) > 0.1) { redraw = 0; chart.redraw(); }
      },
      readout: (s) => {
        const hotL = tank.litresAbove(40);
        return `<div class="big">Tap: ${Math.round(tank.outlet)} °C</div>
          <div class="row"><span>Hot water left (above 40 °C)</span><b>${hotL.toFixed(1)} L</b></div>
          <div class="row"><span>Drawn so far</span><b>${tank.drawn.toFixed(1)} L</b></div>
          <div class="row"><span>Density at 60 °C / 20 °C</span><b>${rho(60).toFixed(0)} / ${rho(20).toFixed(0)} kg/m³</b></div>
          <small>Clock sped up ${SPEED}×. Layered tank model, 48 layers.</small>`;
      },
    };
    return inst;
  },
};
