// Chapter 4: the thermostat and the safety chain. A lumped (well-mixed) tank model:
//   m·c·dT/dt = P·on − UA·(T − T_room) − q·c·(T − T_in)
// UA = 0.52 W/K, a 15 L tank that just meets BEE 3★ (0.558 kWh/24 h at 45 K; see geyser.js).
// Pressure: heating water expands (density table in geyser.js). The non-return valve stops the
// extra volume going back into the cold pipe, so it must squeeze the tank. A full 15 L steel tank
// (13.5 cm radius, 1.5 mm wall, E = 200 GPa) plus the water's own compressibility (4.6e-5 per bar)
// gives about 2 mL per bar, so 1 °C of warming (≈6 mL) would add about 3 bar. That is why the
// relief valve drips every time a geyser heats, and why blocking it is so dangerous.
import { THREE, M, box, swarm, canvasTexture, clamp } from '../kit.js';
import { makeGeyser, makeWater, makeWall, rho, C_W, cssTemp, fitView, responsive } from '../geyser.js';

const VIEW = { pos: [1.3, 4.5, 12.4], target: [1.3, 4.0, 0] };
const GX = 0.5, GY = 2.4;
const SPEED = 300;              // simulated seconds per real second (1 s = 5 min)
const V = 15, P = 2000, UA = 0.52, ROOM = 25, TIN = 20;
const DIFF = 5;                 // thermostat switching differential, K (capillary thermostats: about 4–8 K)
const CUT = 88;                 // thermal cut-out trips (typical 85–95 °C), manual reset
const P_SUP = 1.0;              // supply pressure, bar gauge (an overhead tank ~10 m up)
const P_REL = 6.5;              // relief valve opens (typical settings 6–8 bar)
const C_ML = 2.0;               // mL of room per bar (tank stretch + water compression)
const SPAN = 4 * 3600;          // chart width, simulated seconds

export default {
  id: 'thermostat',
  short: 'Safety chain',
  title: 'The thermostat and the safety chain',
  subtitle: 'One switch does the work; three more stand guard in case it fails.',
  view: VIEW,
  learn: `<p>A <b>thermostat</b> is an automatic switch. In most Indian geysers it's a <b>capillary thermostat</b>: a thin tube of liquid sits in the pocket beside the element. As the water warms, the liquid expands and pushes a switch open at the temperature you set on the knob, usually <b>25 to 75 °C</b>. Others use a <b>bimetal</b> disc that snaps over when hot. It switches back on only after the water cools a few degrees, so it doesn't click on and off all the time.</p>
    <p>If the thermostat sticks on, a separate <b>thermal cut-out</b> trips at about <b>85 to 90 °C</b> and stays off until someone presses its reset button. Water also <b>expands</b> as it warms, about 200 mL for a 15 L tank heated to 60 °C. The non-return valve won't let it back into the cold pipe, so the <b>pressure-relief valve</b> lets a little out at about <b>6 to 8 bar</b>. That drip is normal. <b>Never block it</b>: a sealed tank of very hot water can burst with the force of a small bomb.</p>
    <p>Finally, the metal body is <b>earthed</b>, and an <b>RCCB</b> (or ELCB) in your fuse box cuts the power in a few hundredths of a second if even <b>30 mA</b> of current leaks to earth, for example through a cracked element. Water and electricity are a risky mix; see <a href="/ohmslawclear/#safety">Ohm's law and safety</a>.</p>
    <p class="tip"><b>Try it:</b> set the knob and watch the on/off trace. Then jam the thermostat, block the relief valve, or crack the element, and see what saves you.</p>`,
  terms: [
    { t: 'Thermostat', d: 'A switch worked by temperature. It turns the heater off at the set point and back on when the water cools.' },
    { t: 'Differential', d: 'The gap between the switch-off and switch-on temperatures, so the heater doesn’t flicker on and off.' },
    { t: 'Thermal cut-out', d: 'A backup switch that trips at about 85–90 °C if the thermostat fails, and must be reset by hand.' },
    { t: 'Pressure-relief valve', d: 'A spring-loaded valve that lets water out if the tank pressure climbs too high.' },
    { t: 'RCCB / ELCB', d: 'A breaker that compares the current going out and coming back, and trips if about 30 mA leaks away to earth.' },
  ],
  defaults: { tset: 60, shower: false, stuck: false, blocked: false, leak: false },
  controls: [
    { key: 'tset', type: 'range', label: 'Thermostat knob', min: 25, max: 75, step: 1, fmt: (v) => Math.round(v) + ' °C' },
    { key: 'shower', type: 'toggle', label: 'Hot tap running (6 L/min)' },
    { key: 'stuck', type: 'toggle', label: 'Fault: thermostat stuck on' },
    { key: 'blocked', type: 'toggle', label: 'Fault: relief valve blocked' },
    { key: 'leak', type: 'toggle', label: 'Fault: cracked element leaks to earth' },
    { key: 'fix', type: 'buttons', label: 'Reset', items: [{ label: 'Press cut-out reset', act: (s, inst) => inst.resetCut() }, { label: 'Start cold', act: (s, inst) => inst.cold() }] },
  ],
  quiz: [
    { q: 'Why does a geyser’s relief valve drip a little while it heats?', options: ['It is broken', 'Water expands as it warms, and the extra volume has to go somewhere', 'Steam is escaping', 'The thermostat is set too low'], answer: 1, why: 'A 15 L tank heated from 25 to 60 °C grows by about 200 mL. The non-return valve blocks the cold pipe, so the relief valve lets it out.' },
    { q: 'What does the thermal cut-out do?', options: ['Sets the temperature', 'Switches the element off for good if the water gets far too hot', 'Stops rust', 'Lets cold water in'], answer: 1, why: 'It is the backup to the thermostat. It trips at about 85–90 °C and stays off until reset by hand.' },
    { q: 'An RCCB trips when…', options: ['the geyser uses more than 2 kW', 'a little current, about 30 mA, leaks to earth instead of returning', 'the water reaches 60 °C', 'the pressure is too high'], answer: 1, why: 'It compares the current in the live and neutral wires. Any difference is leaking somewhere, maybe through a person.' },
  ],
  reel: [
    { ms: 5400, caption: 'A thermostat switches the element off at the set point; the relief valve drips as the water expands.', set: { tset: 60, shower: false, stuck: false, blocked: false, leak: false }, act: (s, inst) => inst.cold(), spin: 0.2 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    root.add(makeWall(16));
    const pivot = new THREE.Group(); pivot.position.set(GX, GY, 0); root.add(pivot);
    const G = makeGeyser(); G.setXray(true); pivot.add(G.group);
    G.shellFront.visible = G.pufFront.visible = G.tankFront.visible = false;
    const W = makeWater(8); W.bands.forEach((b) => { b.material.opacity = 0.7; }); pivot.add(W);
    // RCCB on the wall, with its toggle lever, and a cable to the geyser.
    const rccb = new THREE.Group(); rccb.position.set(-2.6, 2.2, -1.9); root.add(rccb);
    rccb.add(box(0.9, 1.2, 0.35, M.plastic(0xe9ecf1)));
    const lever = box(0.18, 0.4, 0.14, M.plastic(0x2b5fa8)); lever.position.set(0, 0.12, 0.24); rccb.add(lever);
    const tbtn = box(0.2, 0.12, 0.1, M.plastic(0xf5c542)); tbtn.position.set(0, -0.38, 0.2); rccb.add(tbtn);
    // Drips from the relief valve's side outlet.
    const ND = 24, drips = swarm(ND, new THREE.SphereGeometry(0.05, 8, 6), M.glow(0x8ec5ff));
    drips.castShadow = false; root.add(drips);
    const spout = G.mfv.position.clone().add(G.mfv.spout).add(pivot.position);

    const lT = stage.label('', [0, 1.6, 1.6], pivot, 'hot');
    const lTh = stage.label('Thermostat', [-1.3, -0.45, 1.2], pivot);
    const lCut = stage.label('Cut-out', [1.25, -0.4, 0.6], pivot);
    const lMfv = stage.label('Relief valve', [-1.95, -1.55, 0.2], pivot);
    const lR = stage.label('', [0, 0.95, 0.2], rccb);

    const sim = { T: 25, m: V * rho(25) / 1000, p: P_SUP, on: false, cut: false, rccb: false, drip: 0, dripRate: 0, t: 0 };
    let hist = [], cur = { tset: 60 };
    const cold = () => { Object.assign(sim, { T: 25, m: V * rho(25) / 1000, p: P_SUP, on: false, cut: false, rccb: false, drip: 0, t: 0 }); hist = []; };
    const chart = canvasTexture(900, 760, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
      const x0 = 80, x1 = w - 30, X = (t) => x0 + (t / SPAN) * (x1 - x0);
      const TY0 = 390, TY1 = 70, TY = (T) => TY0 - (T / 100) * (TY0 - TY1);
      const PY0 = 690, PY1 = 520, PY = (p) => PY0 - (clamp(p, 0, 10) / 10) * (PY0 - PY1);
      g.font = 'bold 32px sans-serif'; g.fillStyle = '#e8eef8'; g.fillText('Water temperature', 20, 44);
      g.font = '22px sans-serif'; g.lineWidth = 1;
      for (let T = 0; T <= 100; T += 20) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x0, TY(T)); g.lineTo(x1, TY(T)); g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(T + '°', 22, TY(T) + 8); }
      const hline = (y, color, text) => { g.strokeStyle = color; g.setLineDash([8, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]); g.fillStyle = color; g.fillText(text, x1 - 200, y - 8); };
      hline(TY(cur.tset), 'rgba(255,255,255,.7)', `set ${cur.tset} °C`);
      hline(TY(CUT), '#ff5a5a', `cut-out ${CUT} °C`);
      // Heater on/off strip.
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('Element on', x0, 412);
      for (let i = 1; i < hist.length; i++) {
        const [t0, T0] = hist[i - 1], [t1, T1, on] = hist[i];
        g.strokeStyle = cssTemp(T1); g.lineWidth = 6; g.beginPath(); g.moveTo(X(t0), TY(T0)); g.lineTo(X(t1), TY(T1)); g.stroke();
        if (on) { g.fillStyle = '#ff7a3d'; g.fillRect(X(t0), 420, X(t1) - X(t0) + 1, 26); }
      }
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.strokeRect(x0, 420, x1 - x0, 26);
      g.fillStyle = '#e8eef8'; g.font = 'bold 28px sans-serif'; g.fillText('Pressure (bar)', 20, 500);
      g.font = '22px sans-serif';
      for (let p = 0; p <= 10; p += 5) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x0, PY(p)); g.lineTo(x1, PY(p)); g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(String(p), 34, PY(p) + 8); }
      hline(PY(P_REL), '#8ec5ff', `relief ${P_REL} bar`);
      g.strokeStyle = '#8ec5ff'; g.lineWidth = 4; g.beginPath();
      hist.forEach(([t, , , p], i) => (i ? g.lineTo(X(t), PY(p)) : g.moveTo(X(t), PY(p)))); g.stroke();
      for (let hr = 0; hr <= 4; hr++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(hr + ' h', X(hr * 3600) - 14, h - 22); }
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.88), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false }));
    board.position.set(5.0, 3.5, -1.0); board.rotation.y = -0.2; root.add(board);

    let t = 0, redraw = 0, rec = -1e9;
    const resp = responsive(stage, (p) => (p ? fitView(stage, [0.2, 5.3, 0], [0, 0.12, 1], 16) : VIEW), (p) => {
      if (p) { pivot.position.set(0.8, GY, 0); board.position.set(0.2, 8.9, -0.9); board.rotation.y = 0; rccb.position.set(-1.9, 1.6, -1.9); }
      else { pivot.position.set(GX, GY, 0); board.position.set(5.0, 3.5, -1.0); board.rotation.y = -0.2; rccb.position.set(-2.6, 2.2, -1.9); }
      spout.copy(G.mfv.position).add(G.mfv.spout).add(pivot.position);
    });
    return {
      cold() { cold(); rec = -1e9; }, resetCut() { if (sim.T < CUT - 15) sim.cut = false; },
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        cur.tset = Math.round(s.tset);
        if (s.leak) sim.rccb = true; else if (sim.rccb && !s.leak) sim.rccb = false;
        const sub = 20, h = (Math.min(dt, 0.05) * SPEED) / sub;
        sim.dripRate = 0;
        for (let k = 0; k < sub; k++) {
          // Thermostat (or a stuck one), then the cut-out, then the RCCB.
          if (s.stuck) sim.on = true; else if (sim.T >= s.tset) sim.on = false; else if (sim.T <= s.tset - DIFF) sim.on = true;
          if (sim.T >= CUT) sim.cut = true;
          const heating = sim.on && !sim.cut && !sim.rccb;
          const q = s.shower ? 6 / 60 : 0;                                  // kg per second drawn
          const dQ = (heating ? P : 0) - UA * (sim.T - ROOM) - q * C_W * 1000 * (sim.T - TIN);
          sim.T += (dQ * h) / (sim.m * C_W * 1000);
          // Pressure from expansion.
          const vol = sim.m / (rho(sim.T) / 1000);                          // litres the water wants
          const extra = (vol - V) * 1000;                                   // mL more than the tank holds
          if (s.shower) { sim.m = V * rho(sim.T) / 1000; sim.p = P_SUP; }   // tap open: pressure is the supply's
          else if (extra <= 0) { sim.m = V * rho(sim.T) / 1000; sim.p = P_SUP; }  // cools: the non-return valve lets water in
          else {
            sim.p = P_SUP + extra / C_ML;
            if (!s.blocked && sim.p > P_REL) {
              const let_ = extra - (P_REL - P_SUP) * C_ML;                  // mL the valve releases
              sim.m -= (let_ / 1000) * (rho(sim.T) / 1000);
              sim.drip += let_; sim.dripRate += let_; sim.p = P_REL;
            }
          }
          sim.t += h; sim.heating = heating;
        }
        if (sim.t - rec > 60 || sim.t < rec) { rec = sim.t; hist.push([sim.t % SPAN, sim.T, sim.heating, sim.p]); if (hist.length > 1 && hist.at(-1)[0] < hist.at(-2)[0]) hist = [hist.at(-1)]; }
        W.setTemps([sim.T]);
        G.setElement(sim.heating ? 1 : 0); G.setLamps(!sim.rccb, sim.heating);
        G.knob.rotation.z = -((s.tset - 25) / 50) * 4.2;
        lever.position.y = sim.rccb ? -0.12 : 0.12; lever.material.color.set(sim.rccb ? 0xd12f2f : 0x2b5fa8);
        lR.element.innerHTML = sim.rccb ? 'RCCB <b>tripped</b>' : 'RCCB 30 mA';
        lT.element.innerHTML = `Water <b>${sim.T.toFixed(0)} °C</b> · ${sim.blocked ? '' : ''}<b>${sim.p > 20 ? '> 20' : sim.p.toFixed(1)} bar</b>`;
        lCut.element.innerHTML = sim.cut ? 'Cut-out <b>tripped</b>' : 'Cut-out';
        lMfv.element.innerHTML = s.blocked ? 'Relief valve <b>blocked</b>' : 'Relief valve';
        const nar = stage.host.clientWidth < 560; lTh.visible = lCut.visible = lMfv.visible = !nar;
        lTh.element.innerHTML = s.stuck ? 'Thermostat <b>stuck on</b>' : 'Thermostat';
        const dripping = sim.dripRate > 0.001 && !s.blocked;
        drips.visible = dripping;
        if (dripping) { for (let i = 0; i < ND; i++) { const u = (i / ND + t * 1.3) % 1; drips.place(i, [spout.x + 0.05, spout.y - u * 1.6, spout.z + 0.1], null, 1 - u * 0.4); } drips.done(); }
        if ((redraw += dt) > 0.15) { redraw = 0; chart.redraw(); }
      },
      readout: (s) => {
        const state = sim.rccb ? '<span class="no">Power cut by the RCCB</span>' : sim.cut ? '<span class="no">Cut-out tripped: element off</span>' : sim.heating ? 'Element on' : 'Element off: at temperature';
        const pr = sim.p > 20 ? '<span class="no">over 20 bar: burst risk</span>' : `${sim.p.toFixed(1)} bar`;
        return `<div class="big">${sim.T.toFixed(0)} °C</div>
          <div class="row"><span>Status</span><b>${state}</b></div>
          <div class="row"><span>Tank pressure</span><b>${pr}</b></div>
          <div class="row"><span>Dripped from the relief valve</span><b>${Math.round(sim.drip)} mL</b></div>
          <small>Clock sped up ${SPEED}×: 1 s = 5 min. Mains from an overhead tank at ${P_SUP} bar.</small>`;
      },
    };
  },
};
