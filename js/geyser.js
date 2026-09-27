// WaterHeaterClear's shared physics and parts: water properties, heat-up and mixing maths,
// a layered (stratified) tank model, BEE star bands, a temperature colour scale, and 3D
// builders for a wall-mounted storage geyser, an instant geyser and a gas geyser.
// Scale: 1 scene unit = 10 cm, so 1 cubic unit = 1 litre. The storage tank holds about 15 L.
import { THREE, M, box, tube, rod, clamp, lerp } from './kit.js';

// ---------------------------------------------------------------- water
// Specific heat of liquid water, kJ/(kg·K). It varies only from 4.18 to 4.19 between 20 and 70 °C
// (IAPWS-95 via the NIST Chemistry WebBook), so one value is fine for a geyser.
export const C_W = 4.18;
// Density of water, kg/m³, at 1 atm (CRC Handbook of Chemistry and Physics, "Density of water").
export const RHO = [[4, 999.97], [10, 999.70], [20, 998.21], [30, 995.65], [40, 992.22], [50, 988.04], [60, 983.20], [70, 977.76], [80, 971.80], [90, 965.31], [100, 958.35]];
function interp(table, x, xi = 0, yi = 1) {
  if (x <= table[0][xi]) return table[0][yi];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1], b = table[i];
    if (x <= b[xi]) return lerp(a[yi], b[yi], (x - a[xi]) / (b[xi] - a[xi]));
  }
  return table[table.length - 1][yi];
}
export const rho = (T) => interp(RHO, T);

// Heat-up: Q = m·c·ΔT. A litre of water is 1 kg (to within 1.5% over this range).
// eff: the share of the element's heat that stays in the water while it heats (about 95% for a
// well-insulated storage geyser; the rest leaks out through the insulation and pipes).
export const TARIFF = 7;   // ₹ per kWh, a typical Indian household rate
export function heatUp({ litres = 15, tin = 20, tset = 45, kw = 2, eff = 0.95 }) {
  const dT = Math.max(0, tset - tin);
  const MJ = (litres * C_W * dT) / 1000;          // heat the water needs
  const kWh = MJ / 3.6 / eff;                      // electricity drawn
  const min = (kWh / kw) * 60;                     // time at full power
  return { dT, MJ, kWh, min, rupees: kWh * TARIFF };
}
// Mixing hot and cold to a comfortable temperature. Energy balance, same c for both:
//   h·(Th − Tm) = k·(Tm − Tc)  →  total litres at Tm = V·(Th − Tc)/(Tm − Tc).
export function mixLitres(V, Th, Tc, Tm = 40) {
  if (Th <= Tm) return { total: V, cold: 0, ok: false };
  const total = (V * (Th - Tc)) / Math.max(0.5, Tm - Tc);
  return { total, cold: total - V, ok: true };
}

// ---------------------------------------------------------------- a layered tank
// A one-dimensional stratified tank, the standard "multi-node" model used in solar and
// water-heater simulation (e.g. TRNSYS Type 4/60; Kleinbach, Beckman & Klein, Solar Energy 50, 1993):
//  - N equal layers from bottom (0) to top (N−1);
//  - drawing hot water pushes every layer up (plug flow) and cold water enters at the bottom;
//  - the inlet jet mixes the bottom few layers (more without a deflector);
//  - the element heats the layers beside it; any layer warmer than the one above it is mixed
//    upward at once (buoyant convection), so heat rises to the top first;
//  - a thermostat reads the layer at the sensor height and switches the element.
export class Tank {
  constructor({ V = 15, N = 48, T0 = 20, elemLo = 0.07, elemHi = 0.5, sensor = 0.3 } = {}) {
    Object.assign(this, { V, N, elemLo, elemHi, sensor });
    this.T = new Float32Array(N).fill(T0);
    this.on = false; this.drawn = 0;
  }
  fill(T) { this.T.fill(T); this.drawn = 0; }
  get mean() { let s = 0; for (const t of this.T) s += t; return s / this.N; }
  get outlet() { return this.T[this.N - 1]; }
  litresAbove(Tmin) { let n = 0; for (const t of this.T) if (t >= Tmin) n++; return (n * this.V) / this.N; }
  // Height fraction (0 bottom → 1 top) of the hot/cold boundary: the highest layer below `mid`.
  thermocline(mid) { for (let i = this.N - 1; i >= 0; i--) if (this.T[i] < mid) return (i + 1) / this.N; return 0; }
  sensorT() { return this.T[Math.floor(this.sensor * this.N)]; }
  // dt in simulated seconds. q in litres per minute. kw element power. jet: bottom layers mixed by the inlet.
  step(dt, { q = 0, tin = 20, kw = 2, heat = true, tset = 60, diff = 4, jet = 2 }) {
    const N = this.N, dV = this.V / N, T = this.T;
    // Thermostat with a small switching differential.
    const ts = this.sensorT();
    if (!heat) this.on = false; else if (ts >= tset) this.on = false; else if (ts <= tset - diff) this.on = true;
    // Draw-off: advect in whole-layer substeps so the thermocline stays sharp.
    const vol = (q / 60) * dt;
    this.carry = (this.carry || 0) + vol / dV;
    this.drawn += vol;
    while (this.carry >= 1) {
      this.carry -= 1;
      for (let i = N - 1; i > 0; i--) T[i] = T[i - 1];
      T[0] = tin;
      // The inlet jet stirs the bottom layers together.
      const k = Math.min(N, jet); let s = 0;
      for (let i = 0; i < k; i++) s += T[i];
      for (let i = 0; i < k; i++) T[i] = s / k;
    }
    // Element heat into the layers beside it.
    if (this.on) {
      const a = Math.floor(this.elemLo * N), b = Math.max(a + 1, Math.floor(this.elemHi * N));
      const dT = (kw * dt) / ((b - a) * dV * C_W);
      for (let i = a; i < b; i++) T[i] += dT;
    }
    // Buoyant mixing: merge any warmer-below pair into a well-mixed block.
    for (let pass = 0; pass < N; pass++) {
      let moved = false;
      for (let i = 0; i < N - 1; i++) {
        if (T[i] > T[i + 1] + 1e-4) {
          let j = i + 1, s = T[i] + T[i + 1];
          while (j + 1 < N && T[j + 1] < s / (j - i + 1)) { j++; s += T[j]; }
          const m = s / (j - i + 1);
          for (let k = i; k <= j; k++) T[k] = m;
          moved = true;
        }
      }
      if (!moved) break;
    }
    // Slow conduction between layers (water: k = 0.6 W/m·K). Tiny, but it softens the edge a bit.
    const layerH = 0.30 / N, A = Math.PI * 0.135 * 0.135;          // tank ~30 cm tall, 27 cm across
    const g = (0.6 * A * dt) / (layerH * dV * C_W * 1000);
    if (g > 0) for (let i = 0; i < N - 1; i++) { const f = g * (T[i + 1] - T[i]); T[i] += f; T[i + 1] -= f; }
    return this.on;
  }
}

// ---------------------------------------------------------------- BEE star bands
// India's Bureau of Energy Efficiency, Schedule 10 (stationary storage-type electric water heaters),
// Table 3, the mandatory star table from 1 July 2015: maximum standing loss in kWh per 24 h at a
// 45 °C difference, tested to IS 2082. Columns: 1★ … 5★. A 1★ heater must be at or below the first
// number; anything above it can't carry a label.
// https://www.beestarlabel.com/Content/Files/Schedule_10.pdf
export const BEE = {
  6: [0.469, 0.426, 0.387, 0.352, 0.320],
  10: [0.587, 0.534, 0.485, 0.441, 0.401],
  15: [0.675, 0.614, 0.558, 0.507, 0.461],
  25: [0.823, 0.748, 0.680, 0.618, 0.562],
  35: [0.940, 0.855, 0.777, 0.706, 0.642],
  50: [1.086, 0.988, 0.898, 0.816, 0.742],
};
// A heater near the middle of its band (5★: 7% under the line; 1★: just under the limit).
export function standingLoss(litres, star) {
  const row = BEE[litres] || BEE[15], hi = row[star - 1];
  const lo = star < 5 ? row[star] : hi * 0.86;
  return (lo + hi) / 2;
}
// UA in W/K from a standing loss: S kWh per day at 45 K.
export const uaFrom = (S) => (S * 1000) / 24 / 45;

// ---------------------------------------------------------------- colours
// Water temperature to colour: deep blue (cold) → cyan → pale → orange → red (hot).
const STOPS = [[10, 0x2f6bff], [20, 0x3fa9ff], [30, 0x8ee6ff], [38, 0xe8eef8], [48, 0xffc46b], [60, 0xff8a3d], [75, 0xff3b30], [95, 0xd01060]];
const cA = new THREE.Color(), cB = new THREE.Color();
export function tempColor(T, out = new THREE.Color()) {
  if (T <= STOPS[0][0]) return out.set(STOPS[0][1]);
  for (let i = 1; i < STOPS.length; i++) {
    if (T <= STOPS[i][0]) { cA.set(STOPS[i - 1][1]); cB.set(STOPS[i][1]); return out.copy(cA).lerp(cB, (T - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0])); }
  }
  return out.set(STOPS[STOPS.length - 1][1]);
}
export const cssTemp = (T) => '#' + tempColor(T).getHexString();

// ---------------------------------------------------------------- geometry helpers
// Lathe around the Y axis from [y, r] pairs. phi 0 points at +Z (the front).
export function latheY(profile, mat, { seg = 64, phiStart = 0, phiLength = Math.PI * 2 } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(Math.max(0, r), y)), seg, phiStart, phiLength);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
// A capsule-like vessel profile: straight wall from y0 to y1, elliptical heads of height h.
export function vesselProfile(R, y0, y1, h, n = 10) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; p.push([y0 - h * Math.cos(a), R * Math.sin(a)]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; p.push([y1 + h * Math.sin(a), R * Math.cos(a)]); }
  return p;
}
// Radius of that vessel at height y.
export function vesselR(R, y0, y1, h, y) {
  if (y < y0) { const k = clamp((y0 - y) / h, 0, 1); return R * Math.sqrt(1 - k * k); }
  if (y > y1) { const k = clamp((y - y1) / h, 0, 1); return R * Math.sqrt(1 - k * k); }
  return R;
}
// A see-through-able material pair helper.
function xrayable(mat, xo = 0.12) {
  mat.transparent = true;
  return (on) => { mat.opacity = on ? xo : 1; mat.depthWrite = !on; };
}

// ---------------------------------------------------------------- the storage geyser
// A vertical, wall-mounted electric storage geyser in the common Indian layout: every pipe and
// the element flange enter through the bottom. Origin: centre of the tank's bottom head.
// Tank (inside): radius 13.5 cm, 30 cm tall with domed ends, about 15 L.
export const TANK = { R: 1.35, y0: 0.35, y1: 2.65, h: 0.35 };
export const TANK_TOP = TANK.y1 + TANK.h, TANK_BOT = TANK.y0 - TANK.h;
export function makeGeyser() {
  const g = new THREE.Group();
  const P = {};
  const { R, y0, y1, h } = TANK;
  // Outer body: enamelled steel/ABS shell, white, 35 cm across. Front and back halves so it can be cut.
  const shellMat = M.plastic(0xf3f4f6, { roughness: 0.3, side: THREE.DoubleSide });
  const shellProf = vesselProfile(1.75, -0.25, 2.8, 0.5);
  P.shellBack = latheY(shellProf, shellMat, { phiStart: Math.PI / 2, phiLength: Math.PI });
  const shellFrontMat = shellMat.clone();
  P.shellFront = latheY(shellProf, shellFrontMat, { phiStart: -Math.PI / 2, phiLength: Math.PI });
  P.shell = new THREE.Group(); P.shell.add(P.shellBack, P.shellFront);
  const xrShellB = xrayable(shellMat, 0.1), xrShellF = xrayable(shellFrontMat, 0.08);
  // Brand band and indicator lamps on the front.
  P.band = latheY([[1.05, 1.765], [1.25, 1.765]], M.plastic(0x2b5fa8), { phiStart: -Math.PI / 2, phiLength: Math.PI });
  P.shell.add(P.band);
  P.lampPower = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), M.glow(0x2a3a2a)); P.lampPower.position.set(-0.28, 0.2, 1.72);
  P.lampHeat = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), M.glow(0x3a2626)); P.lampHeat.position.set(0.28, 0.2, 1.72);
  P.shell.add(P.lampPower, P.lampHeat);
  // PUF insulation: rigid polyurethane foam, about 3 cm thick, fills the gap between tank and shell.
  const pufMat = M.matte(0xe8c65a, { roughness: 0.95, side: THREE.DoubleSide });
  const pufProf = vesselProfile(1.62, 0.3, 2.7, 0.55);
  P.pufBack = latheY(pufProf, pufMat, { phiStart: Math.PI / 2, phiLength: Math.PI });
  const pufFrontMat = pufMat.clone();
  P.pufFront = latheY(pufProf, pufFrontMat, { phiStart: -Math.PI / 2, phiLength: Math.PI });
  P.puf = new THREE.Group(); P.puf.add(P.pufBack, P.pufFront);
  const xrPufB = xrayable(pufMat, 0.12), xrPufF = xrayable(pufFrontMat, 0.08);
  // Inner tank: steel, glass-lined (vitreous enamel, blue) inside.
  const tankMat = M.metal(0x4f79b8, { roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide });
  const tankProf = vesselProfile(R, y0, y1, h);
  P.tankBack = latheY(tankProf, tankMat, { phiStart: Math.PI / 2, phiLength: Math.PI });
  const tankFrontMat = tankMat.clone();
  P.tankFront = latheY(tankProf, tankFrontMat, { phiStart: -Math.PI / 2, phiLength: Math.PI });
  P.tank = new THREE.Group(); P.tank.add(P.tankBack, P.tankFront);
  const xrTankB = xrayable(tankMat, 0.35), xrTankF = xrayable(tankFrontMat, 0.1);
  g.add(P.shell, P.puf, P.tank);

  // Everything that goes through the bottom flange sits a little in front of the centre plane,
  // so it stays visible in front of the cut section.
  const Z = 0.35;
  P.inner = new THREE.Group(); g.add(P.inner);
  P.flange = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 32), M.metal(0x9aa3b2)); P.flange.position.set(0, 0.02, Z * 0.3);
  P.inner.add(P.flange);
  // Heating element: a U-shaped metal sheath, 8 mm across, rising 14 cm from the flange.
  P.elemMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.35, emissive: 0xff3a10, emissiveIntensity: 0 });
  const ex = 0.2, eTop = 1.55;
  P.elemPath = [[-ex, -0.3, Z], [-ex, 0.05, Z], [-ex, eTop - 0.2, Z], [-ex * 0.7, eTop - 0.05, Z], [0, eTop, Z], [ex * 0.7, eTop - 0.05, Z], [ex, eTop - 0.2, Z], [ex, 0.05, Z], [ex, -0.3, Z]];
  P.element = tube(P.elemPath, 0.045, P.elemMat, false, 120);
  P.inner.add(P.element);
  // Thermostat pocket: a thin closed tube holding the capillary bulb, beside the element.
  P.pocket = rodY(-0.25, 1.05, 0.045, M.metal(0xc9ced8)); P.pocket.position.set(-0.55, 0, Z - 0.05); P.inner.add(P.pocket);
  // Magnesium anode rod, about 2 cm across and 20 cm long, on a steel core wire.
  P.anodeCore = rodY(0.05, 2.1, 0.02, M.metal(0x8a8f98)); P.anodeCore.position.set(0.6, 0, Z - 0.1);
  P.anode = rodY(0.15, 2.1, 0.1, M.metal(0xbfc4c9, { roughness: 0.6, metalness: 0.5 })); P.anode.position.set(0.6, 0, Z - 0.1);
  P.inner.add(P.anodeCore, P.anode);
  // Cold inlet (short, with a deflector cap) and hot outlet (a riser to the top of the tank).
  const blue = M.plastic(0x3f8cff, { roughness: 0.35 }), red = M.plastic(0xff5a3d, { roughness: 0.35 });
  P.inlet = new THREE.Group();
  P.inlet.add(rodY(-2.1, 0.45, 0.075, M.metal(0xb9bec8)));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20), M.metal(0xb9bec8)); cap.position.y = 0.52; P.inlet.add(cap);
  P.inlet.add(Object.assign(rodY(-2.1, -0.6, 0.085, blue), {}));
  P.inlet.position.set(-0.95, 0, Z - 0.2);
  P.outlet = new THREE.Group();
  P.outlet.add(rodY(-2.1, 2.8, 0.075, M.metal(0xb9bec8)));
  P.outlet.add(rodY(-2.1, -0.6, 0.085, red));
  P.outlet.position.set(0.95, 0, Z - 0.2);
  g.add(P.inlet, P.outlet);
  // Multi-function valve on the cold inlet: non-return valve + pressure-relief valve (brass).
  P.mfv = new THREE.Group();
  const brass = M.metal(0xd4a64a, { roughness: 0.3 });
  const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20), brass); P.mfv.add(mb);
  const side = rod(0, 0.42, 0.1, 0.1, brass, 16); side.position.y = 0.05; P.mfv.add(side);
  const lever = box(0.06, 0.05, 0.3, M.plastic(0xd12f2f)); lever.position.set(0.42, 0.13, 0.12); P.mfv.add(lever);
  P.mfv.spout = new THREE.Vector3(0.44, -0.05, 0);
  P.mfv.position.set(-0.95, -1.45, Z - 0.2);
  g.add(P.mfv);
  // Thermostat body and knob, the thermal cut-out with its reset button, the drain plug.
  P.thermo = new THREE.Group();
  P.thermo.add(box(0.5, 0.26, 0.36, M.plastic(0x2a2e37)));
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), M.plastic(0xe6e9ee)); knob.rotation.x = Math.PI / 2; knob.position.z = 0.24; P.thermo.add(knob);
  P.knob = knob;
  P.thermo.position.set(-0.3, -0.42, 1.25);
  P.cutout = new THREE.Group();
  P.cutout.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 20), M.metal(0x9aa3b2)));
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), M.plastic(0xd12f2f)); btn.position.y = -0.09; P.cutout.add(btn);
  P.cutout.position.set(0.3, -0.35, Z + 0.2);
  P.drain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 16), M.metal(0xb9bec8)); P.drain.position.set(0.1, -0.78, 0.9);
  // Wiring: live to the thermostat, on to the cut-out and the element; earth to the tank.
  P.wires = new THREE.Group();
  P.wires.add(tube([[-0.3, -0.42, 1.1], [-0.2, -0.5, 0.6], [-0.2, -0.3, Z]], 0.018, M.plastic(0x8a3a2a), false, 30));
  P.wires.add(tube([[0.3, -0.35, Z + 0.2], [0.2, -0.35, Z], [0.2, -0.3, Z]], 0.018, M.plastic(0x8a3a2a), false, 30));
  P.earth = tube([[-0.5, -0.5, 1.1], [-1.2, -0.45, 0.9], [-1.3, -0.1, 0.5]], 0.02, M.plastic(0x4caf50), false, 30);
  P.wires.add(P.earth);
  P.inner.add(P.thermo, P.cutout, P.drain, P.wires);
  // Mounting bracket behind.
  P.bracket = box(1.6, 0.2, 0.3, M.metal(0x6b7280)); P.bracket.position.set(0, 2.9, -1.85); g.add(P.bracket);

  P.setXray = (on) => { xrShellB(on); xrShellF(on); xrPufB(on); xrPufF(on); xrTankB(on && false); xrTankF(on); P.band.visible = !on; };
  // Cut: hide the front halves so the section shows.
  P.setCut = (on) => { P.shellFront.visible = !on; P.pufFront.visible = !on; P.tankFront.visible = !on; P.band.visible = !on; P.lampPower.visible = P.lampHeat.visible = !on; };
  P.setElement = (k) => { P.elemMat.emissiveIntensity = 1.4 * k; P.elemMat.color.setRGB(0.72 + 0.28 * k, 0.45 + 0.1 * k, 0.2); };
  P.setLamps = (power, heat) => { P.lampPower.material.color.set(power ? 0x3cff6a : 0x2a3a2a); P.lampHeat.material.color.set(heat ? 0xff3a2a : 0x3a2626); };
  return { group: g, ...P };
}
// A cylinder standing along Y from y0 to y1.
export function rodY(y0, y1, r, mat, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(y1 - y0), seg), mat);
  m.position.y = (y0 + y1) / 2; m.castShadow = true;
  const gr = new THREE.Group(); gr.add(m); return gr;
}

// Water inside the tank as a cut section: N coloured bands on the centre plane, plus a faint
// back half so it reads as a volume. Colour each band with setTemps(T[]).
export function makeWater(N = 48) {
  const g = new THREE.Group();
  const { R, y0, y1, h } = TANK, top = TANK_TOP, bot = TANK_BOT;
  const bands = [];
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < N; i++) {
    const ya = bot + ((top - bot) * i) / N, yb = bot + ((top - bot) * (i + 1)) / N, ym = (ya + yb) / 2;
    const r = vesselR(R - 0.02, y0, y1, h, ym);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.88, toneMapped: false, side: THREE.DoubleSide }));
    m.scale.set(Math.max(0.05, 2 * r), (yb - ya) * 1.02, 1); m.position.set(0, ym, 0);
    g.add(m); bands.push(m);
  }
  const back = latheY(vesselProfile(R - 0.03, y0, y1, h), new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }), { phiStart: Math.PI / 2, phiLength: Math.PI });
  back.castShadow = false; g.add(back);
  const c = new THREE.Color();
  g.setTemps = (T) => {
    let s = 0;
    for (let i = 0; i < N; i++) { const t = T[Math.min(T.length - 1, Math.floor((i / N) * T.length))]; bands[i].material.color.copy(tempColor(t, c)); s += t; }
    back.material.color.copy(tempColor(s / N, c));
  };
  g.bands = bands;
  return g;
}

// ---------------------------------------------------------------- instant and gas geysers
// Instant electric geyser: a 3 L tank with a 3 kW element, about 25 × 30 × 13 cm. Origin: bottom centre.
export function makeInstant() {
  const g = new THREE.Group(), P = {};
  const bodyMat = M.plastic(0xf3f4f6, { roughness: 0.3 });
  P.body = box(2.5, 3.0, 1.4, bodyMat); P.body.position.y = 1.5;
  P.setXray = xrayable(bodyMat, 0.12);
  P.tankMat = M.metal(0xc9ced8, { roughness: 0.3, transparent: true, opacity: 0.55 });
  P.tank = latheY(vesselProfile(0.72, 0.8, 2.3, 0.25), P.tankMat); // ~3 L
  P.elemMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.35, emissive: 0xff3a10, emissiveIntensity: 0 });
  P.element = tube([[-0.25, 0.4, 0.15], [-0.25, 1.9, 0.15], [0, 2.1, 0.15], [0.25, 1.9, 0.15], [0.25, 0.4, 0.15]], 0.05, P.elemMat, false, 60);
  P.inlet = rodY(-0.6, 0.8, 0.07, M.plastic(0x3f8cff)); P.inlet.position.x = -0.5;
  P.outlet = rodY(-0.6, 2.2, 0.07, M.plastic(0xff5a3d)); P.outlet.position.x = 0.5;
  P.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), M.glow(0xff3a2a)); P.lamp.position.set(0, 0.45, 0.71);
  g.add(P.body, P.tank, P.element, P.inlet, P.outlet, P.lamp);
  return { group: g, ...P };
}
// Gas (LPG) instantaneous geyser: burner, finned copper heat exchanger, draught hood and flue.
// About 32 × 50 × 16 cm. Origin: bottom centre.
export function makeGas() {
  const g = new THREE.Group(), P = {};
  const bodyMat = M.plastic(0xe9ecf1, { roughness: 0.3 });
  P.body = box(3.2, 5.0, 1.6, bodyMat); P.body.position.y = 2.5;
  P.setXray = xrayable(bodyMat, 0.1);
  // Burner bar with a row of flames.
  P.burner = box(2.2, 0.18, 0.6, M.metal(0x7a8394)); P.burner.position.y = 1.0;
  P.flames = [];
  const fl = new THREE.ConeGeometry(0.09, 0.45, 12);
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(fl, new THREE.MeshBasicMaterial({ color: 0x3f7bff, transparent: true, opacity: 0.85, toneMapped: false }));
    f.position.set(-0.96 + i * 0.24, 1.32, 0); P.flames.push(f); g.add(f);
  }
  // Heat exchanger: copper fins with the water coil wound round them.
  P.hx = new THREE.Group();
  const finMat = M.metal(0xd07a45, { roughness: 0.35 });
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.9, 0.9), finMat, 36);
  const o = new THREE.Object3D();
  for (let i = 0; i < 36; i++) { o.position.set(-1.05 + i * 0.06, 0, 0); o.updateMatrix(); fins.setMatrixAt(i, o.matrix); }
  P.hx.add(fins);
  const coilPts = [];
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2 * 4; coilPts.push([-1.2 + (2.4 * i) / 64, 0.5 * Math.cos(a), 0.5 * Math.sin(a)]); }
  P.hx.add(tube(coilPts, 0.05, M.metal(0xb86a3a), false, 300));
  P.hx.position.y = 2.5;
  // Draught hood and flue.
  P.hood = latheY([[3.4, 1.4], [3.6, 1.3], [4.3, 0.45], [4.6, 0.4]], M.metal(0x9aa3b2, { side: THREE.DoubleSide }), { seg: 4, phiStart: Math.PI / 4 });
  P.hood.scale.z = 0.45;
  P.flue = rodY(4.6, 6.4, 0.4, M.metal(0xb9bec8, { roughness: 0.5 }));
  P.inlet = tube([[1.1, -0.6, 0.3], [1.1, 1.6, 0.3], [1.2, 2.5, 0]], 0.07, M.plastic(0x3f8cff), false, 40);
  P.outlet = tube([[-1.2, 2.5, 0], [-1.1, 1.8, 0.3], [-1.1, -0.6, 0.3]], 0.07, M.plastic(0xff5a3d), false, 40);
  P.gas = tube([[0, -0.8, 0.4], [0, 0.4, 0.4], [0, 0.9, 0]], 0.06, M.plastic(0xf5c542), false, 30);
  P.valve = box(0.5, 0.4, 0.4, M.plastic(0x2a2e37)); P.valve.position.set(0, 0.45, 0.35);
  g.add(P.body, P.burner, P.hx, P.hood, P.flue, P.inlet, P.outlet, P.gas, P.valve);
  return { group: g, ...P };
}

// A bathroom wall with tiles, for context.
export function makeWall(w = 16, hgt = 12, z = -2.05) {
  const g = new THREE.Group();
  const tiles = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#2a303b'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#323a47'; x.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
    return c;
  })());
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(w / 4, hgt / 4); tiles.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6 }));
  m.position.set(0, hgt / 2, z); m.receiveShadow = true;
  g.add(m);
  return g;
}

// ---------------------------------------------------------------- framing for tall screens
// The stage backs the camera off by k on narrow screens (stage.js). These helpers undo that so a
// portrait layout (phones, and the 1080×1920 video) can stack the model and its chart and fill the frame.
export const isPortrait = (stage) => stage.camera.aspect < 0.9;
export const aspectK = (stage) => Math.min(2.5, Math.max(1, 1.45 / Math.max(0.3, stage.camera.aspect)));
export function fitView(stage, target, dir, D) {
  const k = aspectK(stage), d = new THREE.Vector3(...dir).normalize().multiplyScalar(D / k);
  return { pos: [target[0] + d.x, target[1] + d.y, target[2] + d.z], target };
}
// Call every frame: when the screen flips between wide, tall and phone-narrow, re-lay the scene out
// and re-frame it (unless the viewer has orbited the camera themselves). On a narrow phone stage the
// readout covers the top left, so the picture is nudged down and the camera backs off a little.
export function responsive(stage, views, relayout) {
  let last = null;
  return () => {
    const p = isPortrait(stage), narrow = !p && stage.host.clientWidth < 560, mode = p ? 'tall' : narrow ? 'narrow' : 'wide';
    if (mode === last) return;
    last = mode;
    relayout?.(p);
    stage.setShift(0, narrow ? -0.16 : 0);
    const v = views(p);
    const pos = narrow ? v.pos.map((x, i) => v.target[i] + (x - v.target[i]) * 1.12) : v.pos;
    if (!stage.moved) stage.setView(pos, v.target, 0.6);
  };
}
