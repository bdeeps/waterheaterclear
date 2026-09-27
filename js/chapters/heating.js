// Chapter 2: how long it takes. Q = m·c·ΔT, the element's power, and mixing hot with cold.
// The tank on screen runs the layered model in geyser.js, sped up so a full heat-up plays in a few seconds.
import { THREE, canvasTexture, clamp } from '../kit.js';
import { makeGeyser, makeWater, makeWall, heatUp, mixLitres, Tank, cssTemp, TARIFF, fitView, responsive } from '../geyser.js';

const VIEW = { pos: [0.1, 4.5, 11.6], target: [0.1, 3.75, 0] };
const GX = -2.9, GY = 1.9;       // geyser position
const PLAY = 6;                 // real seconds for a whole heat-up on screen
const BUCKET = 20;              // litres in a typical bath bucket

export default {
  id: 'heating',
  short: 'Heating up',
  title: 'How long does it take?',
  subtitle: 'Mass, specific heat and a temperature rise: the sum behind the wait.',
  view: VIEW,
  learn: `<p>Water is hard to heat. Every kilogram (one litre) needs <b>4,180 joules</b> to warm by just 1 °C. That number is water's <b>specific heat</b>, and it's higher than almost any other common substance.</p>
    <p>So the heat a geyser must deliver is <b>Q = m × c × ΔT</b>: mass × specific heat × temperature rise. Warming 15 L from 20 to 45 °C takes 15 × 4,180 × 25 = <b>1.57 million joules</b>. A 2 kW element supplies 2,000 joules a second, and about 95% of it stays in the water, so that's about <b>14 minutes</b>.</p>
    <p>In a Delhi winter, the water in the pipes may be 10 to 15 °C instead of 25 to 30 °C in summer, so the same geyser takes about <b>twice as long</b>. And a hotter tank goes further: you <b>mix</b> it with cold water at the tap. Hot at 60 °C and cold at 20 °C make roughly <b>two buckets</b> of 40 °C bath water from one 15 L tank.</p>
    <p>The element itself is just a resistor. At 230 V, a 2 kW element has a resistance of about 26 Ω (P = V² ÷ R: see <a href="/ohmslawclear/#heat">Ohm's law</a>).</p>
    <p class="tip"><b>Try it:</b> switch between summer and winter water, then turn the thermostat up and count the buckets.</p>`,
  terms: [
    { t: 'Specific heat', d: 'The energy needed to warm 1 kg of a substance by 1 °C. For water, about 4,180 joules.' },
    { t: 'Joule', d: 'The unit of energy. One watt is one joule every second.' },
    { t: 'kWh (unit)', d: 'One kilowatt for one hour: 3.6 million joules. Your bill counts these as “units”.' },
    { t: 'Mixing', d: 'Hot and cold water blended at the tap. The heat the hot water loses is the heat the cold water gains.' },
  ],
  defaults: { litres: 15, tin: 20, tset: 45, kw: 2 },
  controls: [
    { key: 'litres', type: 'seg', label: 'Tank size', options: [6, 10, 15, 25, 35].map((v) => ({ v, label: v + ' L' })), fmt: (v) => v + ' litres' },
    { key: 'tin', type: 'range', label: 'Cold water in', min: 8, max: 35, step: 1, ends: ['winter', 'summer'], fmt: (v) => Math.round(v) + ' °C' },
    { key: 'tset', type: 'range', label: 'Thermostat set to', min: 35, max: 75, step: 1, fmt: (v) => Math.round(v) + ' °C' },
    { key: 'kw', type: 'seg', label: 'Element', options: [{ v: 1.5, label: '1.5 kW' }, { v: 2, label: '2 kW' }, { v: 3, label: '3 kW' }], fmt: (v) => Math.round(230 * 230 / (v * 1000)) + ' Ω at 230 V' },
  ],
  quiz: [
    { q: 'How much heat does it take to warm 15 L of water by 25 °C?', options: ['About 1,500 joules', 'About 1.57 million joules', 'About 25 kWh', 'About 4.18 joules'], answer: 1, why: 'Q = m·c·ΔT = 15 kg × 4,180 J/kg°C × 25 °C ≈ 1.57 MJ, which is about 0.44 kWh.' },
    { q: 'Why does a geyser take longer in winter?', options: ['The element is weaker in the cold', 'The cold water starts colder, so it needs a bigger temperature rise', 'Water is heavier in winter', 'The thermostat is slower'], answer: 1, why: 'The heat needed is proportional to the rise. From 12 °C to 45 °C is almost twice the rise from 28 °C.' },
    { q: 'Hot water at 60 °C is mixed with cold at 20 °C to make 40 °C. How much 40 °C water does 15 L of hot make?', options: ['15 L', '20 L', '30 L', '60 L'], answer: 2, why: 'The hot water cools by 20 °C and the cold warms by 20 °C, so they mix one to one: 15 L hot + 15 L cold = 30 L.' },
  ],
  reel: [
    { ms: 5800, caption: 'Warming 15 L from 20 to 45 °C takes 1.57 million joules: about 14 minutes at 2 kW.', set: { litres: 15, tin: 20, tset: 45, kw: 2 }, act: (s, inst) => inst.restart(), spin: 0.15 },
    { ms: 5200, caption: 'Winter water starts colder, so the same geyser takes about twice as long.', set: { litres: 15, tset: 45, kw: 2 }, anim: { tin: [28, 12] }, act: (s, inst) => inst.restart(), spin: 0 },
  ],
  onChange(s) { s.tin = Math.round(s.tin); s.tset = Math.round(s.tset); },

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    root.add(makeWall(14));
    const pivot = new THREE.Group(); pivot.position.set(GX, GY, 0); root.add(pivot);
    const G = makeGeyser(); G.setCut(true); pivot.add(G.group);
    const W = makeWater(48); pivot.add(W);
    const lbT = stage.label('', [0, 1.2, 1.5], pivot, 'hot');

    // The board: temperature against time, and buckets of mixed water.
    let st = { litres: 15, tin: 20, tset: 45, kw: 2 }, now = { tmin: 0, T: 20 };
    const board = canvasTexture(900, 700, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
      const hu = heatUp(st), maxMin = Math.max(10, Math.ceil(hu.min / 10) * 10 + 5);
      const x0 = 80, x1 = w - 50, y0 = 380, y1 = 80;
      const X = (m) => x0 + (m / maxMin) * (x1 - x0), Y = (T) => y0 - ((T - 0) / 80) * (y0 - y1);
      g.font = 'bold 38px sans-serif'; g.fillStyle = '#e8eef8'; g.fillText(`${st.litres} L at ${st.kw} kW: ${hu.min.toFixed(1)} minutes`, 24, 44);
      g.font = '24px sans-serif'; g.strokeStyle = 'rgba(255,255,255,.12)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
      for (let T = 0; T <= 80; T += 20) { g.beginPath(); g.moveTo(x0, Y(T)); g.lineTo(x1, Y(T)); g.stroke(); g.fillText(T + '°', 24, Y(T) + 8); }
      const stepM = maxMin > 40 ? 10 : 5;
      for (let m = 0; m <= maxMin; m += stepM) g.fillText(m + ' min', X(m) - 26, y0 + 32);
      // Heat-up line: a straight ramp, since the power is steady and c barely changes.
      const grad = g.createLinearGradient(0, Y(st.tin), 0, Y(st.tset));
      grad.addColorStop(0, cssTemp(st.tin)); grad.addColorStop(1, cssTemp(st.tset));
      g.strokeStyle = grad; g.lineWidth = 6; g.beginPath(); g.moveTo(X(0), Y(st.tin)); g.lineTo(X(hu.min), Y(st.tset)); g.lineTo(X(maxMin), Y(st.tset)); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(clamp(now.tmin, 0, maxMin)), Y(now.T), 11, 0, Math.PI * 2); g.fill();
      // Buckets of 40 °C water.
      const mx = mixLitres(st.litres, st.tset, st.tin, 40);
      g.fillStyle = '#e8eef8'; g.font = 'bold 32px sans-serif';
      g.fillText(mx.ok ? `Mixed to 40 °C: ${Math.round(mx.total)} L (${(mx.total / BUCKET).toFixed(1)} buckets)` : `Set below 40 °C: no cold needed`, 24, 470);
      const n = mx.total / BUCKET, full = Math.floor(n + 1e-6);
      for (let i = 0; i < Math.min(8, Math.ceil(n - 1e-6)); i++) {
        const bx = 40 + i * 104, by = 510, bw = 76, bh = 150, frac = i < full ? 1 : n - full;
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 8, by + bh); g.lineTo(bx + bw - 8, by + bh); g.lineTo(bx + bw, by); g.stroke();
        const hotF = mx.ok ? st.litres / mx.total : 1;
        g.fillStyle = cssTemp(40); g.fillRect(bx + 8, by + bh - bh * frac, bw - 16, bh * frac);
        g.fillStyle = 'rgba(255,138,61,.9)'; g.fillRect(bx + 8, by + bh - bh * frac * hotF, 8, bh * frac * hotF);
      }
      g.font = '22px sans-serif'; g.fillStyle = 'rgba(255,255,255,.65)';
      g.fillText('Each bucket is 20 L. Orange edge: the share that came from the geyser.', 24, h - 12);
    });
    const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.98), new THREE.MeshBasicMaterial({ map: board.tex, transparent: true, toneMapped: false }));
    boardMesh.position.set(2.7, 3.1, -0.9); boardMesh.rotation.y = -0.14; root.add(boardMesh);

    const resp = responsive(stage, (p) => (p ? fitView(stage, [0, 5.0, 0], [0, 0.12, 1], 15.5) : VIEW), (p) => {
      if (p) { pivot.position.set(0, GY - 0.6, 0); boardMesh.position.set(0, 8.2, -0.9); boardMesh.rotation.y = 0; }
      else { pivot.position.set(GX, GY, 0); boardMesh.position.set(2.7, 3.1, -0.9); boardMesh.rotation.y = -0.14; }
    });
    const tank = new Tank({ V: 15, N: 48, T0: 20 });
    let key = '', hold = 0, simT = 0, restart = true;
    const inst = {
      restart() { restart = true; },
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt);
        resp();
        const hu = heatUp(s);
        const k = `${s.litres}|${s.tin}|${s.tset}|${s.kw}`;
        if (k !== key) { key = k; restart = true; st = { litres: s.litres, tin: s.tin, tset: s.tset, kw: s.kw }; pivot.scale.setScalar(Math.cbrt(s.litres / 15)); }
        if (restart) { restart = false; tank.V = s.litres; tank.fill(s.tin); simT = 0; hold = 0; }
        // Speed the clock so a full heat-up plays in PLAY seconds; power is the element's × 95%.
        const rate = Math.max(1, (hu.min * 60) / PLAY);
        if (tank.on || simT === 0 || hold === 0) {
          const sub = 8, h = (dt * rate) / sub;
          for (let i = 0; i < sub; i++) tank.step(h, { q: 0, tin: s.tin, kw: s.kw * 0.95, tset: s.tset, diff: 3 });
          simT += dt * rate;
        }
        if (!tank.on && simT > 5) { hold += dt; if (hold > 2.2) restart = true; }
        now = { tmin: simT / 60, T: tank.mean };
        W.setTemps(tank.T);
        G.setElement(tank.on ? 1 : 0); G.setLamps(true, tank.on);
        lbT.element.innerHTML = `Top of tank <b>${Math.round(tank.outlet)} °C</b>`;
        board.redraw();
      },
      readout: (s) => {
        const hu = heatUp(s), mx = mixLitres(s.litres, s.tset, s.tin, 40);
        return `<div class="big">${hu.min.toFixed(0)} minutes</div>
          <div class="row"><span>Heat into the water</span><b>${hu.MJ.toFixed(2)} MJ</b></div>
          <div class="row"><span>Electricity</span><b>${hu.kWh.toFixed(2)} kWh · ₹${hu.rupees.toFixed(1)}</b></div>
          <div class="row"><span>Water at 40 °C after mixing</span><b>${Math.round(mx.total)} L</b></div>
          <small>Q = m·c·ΔT, 95% of the heat kept, ₹${TARIFF}/kWh.</small>`;
      },
    };
    return inst;
  },
};
