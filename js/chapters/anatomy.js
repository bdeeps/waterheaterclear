// Chapter 1: take a wall-mounted storage geyser apart, and compare it with an instant geyser
// and a gas geyser.
import { THREE, M, box, exploder, swarm, clamp } from '../kit.js';
import { makeGeyser, makeInstant, makeGas, makeWall, heatUp, C_W, fitView, responsive } from '../geyser.js';

const VIEW = { pos: [2.1, 4.3, 7.9], target: [-0.9, 3.2, 0] };
const Y = 2.2;   // height of the tank's bottom above the floor (scene units of 10 cm)
// Instant geyser: 3 kW warming water by 25 °C gives P/(c·ΔT) litres a second.
const instantFlow = (kw = 3, dT = 25) => (kw / (C_W * dT)) * 60;
// Gas geyser: 6 L/min warmed 25 °C needs 6/60 × 4.18 × 25 = 10.5 kW of heat. At ~80% efficiency and
// LPG's 46 MJ/kg lower heating value (EU JRC / IPCC 2006 default 47.3 gross, ~46 net), that is about
// 1 kg of LPG an hour.
const GAS = (() => { const heat = (6 / 60) * C_W * 25, input = heat / 0.8; return { heat, input, kgph: (input / 46000) * 3600 }; })();

export default {
  id: 'anatomy',
  short: 'Inside a geyser',
  title: 'Inside a geyser',
  subtitle: 'A steel tank wrapped in foam, with a hot rod inside and a clever valve below.',
  view: VIEW,
  learn: `<p>A <b>storage geyser</b> is a big insulated flask with a heater inside. The common Indian ones hold <b>10 to 25 litres</b>. Inside the white <b>outer body</b> is a steel <b>inner tank</b>, lined with a layer of glass (or made of stainless steel) so it doesn't rust. Between the two is thick <b>PUF foam</b> insulation, which keeps the water hot for hours.</p>
    <p>A <b>heating element</b> pokes up from the bottom: a coiled wire packed in powder inside a metal tube, usually <b>2 kW</b>. A <b>thermostat</b> senses the water and switches it off at the temperature you set, and a <b>thermal cut-out</b> steps in if the thermostat fails. A <b>magnesium anode rod</b> quietly rusts away so the tank doesn't.</p>
    <p>Cold water comes in at the <b>bottom</b>. Hot water leaves from the <b>top</b>, through a pipe that reaches right up inside the tank. On the cold pipe sits a brass <b>multi-function valve</b>: it stops hot water flowing back into your cold pipes and lets out water if the pressure climbs too high.</p>
    <p>An <b>instant geyser</b> has a tiny 1 to 3 litre tank and a bigger 3 kW element. A <b>gas geyser</b> has no tank at all: a row of gas flames heats a copper coil as the water flows through it (see how flames and flues work in <a href="/chimneyclear/#flame">ChimneyClear</a>).</p>
    <p class="tip"><b>Try it:</b> switch on X-ray and take the geyser apart. Then compare the three kinds of geyser.</p>`,
  terms: [
    { t: 'Storage geyser', d: 'A water heater that keeps a tank of water hot, ready for when you need it.' },
    { t: 'Heating element', d: 'A metal tube with a resistance wire inside. Current through the wire makes heat, like a toaster underwater.' },
    { t: 'PUF', d: 'Polyurethane foam, a light, rigid foam full of tiny gas bubbles that slows heat escaping.' },
    { t: 'Anode rod', d: 'A rod of magnesium that corrodes on purpose, protecting the steel tank.' },
    { t: 'Multi-function valve', d: 'A brass valve on the cold inlet: a non-return valve and a pressure-relief valve in one.' },
  ],
  defaults: { kind: 'storage', explode: 0, xray: true, running: true },
  controls: [
    { key: 'kind', type: 'seg', label: 'Kind of geyser', options: [{ v: 'storage', label: 'Storage' }, { v: 'instant', label: 'Instant' }, { v: 'gas', label: 'Gas' }], fmt: (v) => ({ storage: '15 L, 2 kW', instant: '3 L, 3 kW', gas: '6 L/min, LPG' }[v]) },
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%', hint: 'Takes apart the storage geyser.' },
    { key: 'xray', type: 'toggle', label: 'X-ray the casing' },
    { key: 'running', type: 'toggle', label: 'Switched on' },
  ],
  quiz: [
    { q: 'What keeps the water in a storage geyser hot for hours after it switches off?', options: ['The anode rod', 'A thick layer of foam insulation', 'The thermostat', 'The hot outlet pipe'], answer: 1, why: 'PUF foam between the tank and the outer body slows the heat escaping, like a flask.' },
    { q: 'Where does hot water leave a storage geyser?', options: ['From the bottom of the tank', 'From the middle', 'From the top of the tank', 'Through the relief valve'], answer: 2, why: 'Hot water is lighter and floats, so the outlet pipe reaches up to the top of the tank.' },
    { q: 'Why does a gas geyser not need a big tank?', options: ['Gas flames put out much more heat, fast enough to warm water as it flows', 'Gas makes water lighter', 'It stores the heat in the gas', 'It only works in summer'], answer: 0, why: 'Its burner gives around 10 kW or more, enough to heat a steady flow on the spot. A 2 kW element can only keep up by heating a tank in advance.' },
  ],
  reel: [
    { ms: 5600, caption: 'A storage geyser is a steel tank in foam, with a 2 kW heating rod inside.', set: { kind: 'storage', xray: true, running: true }, anim: { explode: [0, 0.9] }, spin: 0.5 },
    { ms: 5000, caption: 'Instant geysers hold just 3 litres; gas geysers heat water as it flows.', set: { explode: 0, xray: true, running: true, kind: 'instant' }, anim: { kind: ['instant', 'gas'] }, spin: 0.35 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    root.add(makeWall());
    const G = makeGeyser(); G.group.position.y = Y; root.add(G.group);
    const I = makeInstant(); I.group.position.set(0, 2.6, -0.8); root.add(I.group);
    const S = makeGas(); S.group.position.set(0, 1.4, -1.2); root.add(S.group);
    // Water pipes on the wall below each heater.
    const tap = box(0.5, 0.25, 0.3, M.metal(0xb9bec8)); tap.position.set(-0.95, Y - 2.05, 0.15); G.group.add(tap);

    // Convection: warm water rising from the element when it's on.
    const NB = 70, bub = swarm(NB, new THREE.SphereGeometry(0.05, 8, 6), M.glow(0xffa04a, { transparent: true, opacity: 0.85 }));
    bub.castShadow = false; G.group.add(bub);
    const seed = Array.from({ length: NB }, (_, i) => [((i * 0.618) % 1), ((i * 0.377) % 1) - 0.5, ((i * 0.71) % 1) - 0.5]);

    const setExplode = exploder([
      { obj: G.shell, off: [0, 2.4, 0] },
      { obj: G.puf, off: [0, 1.3, 0] },
      { obj: G.element, off: [0, 0, 1.6] },
      { obj: G.anode, off: [1.1, 0.3, 1.2] },
      { obj: G.anodeCore, off: [1.1, 0.3, 1.2] },
      { obj: G.pocket, off: [-1.1, 0.2, 1.1] },
      { obj: G.thermo, off: [-0.9, -0.5, 0.9] },
      { obj: G.cutout, off: [1.0, -0.6, 0.9] },
      { obj: G.inlet, off: [-0.9, 0, 0.2] },
      { obj: G.outlet, off: [0.9, 0, 0.2] },
      { obj: G.mfv, off: [-1.4, -0.3, 0.6] },
    ]);

    const minor = [], sets = { storage: [], instant: [], gas: [] };
    const L = (t, obj, p, kind, main, cls = '') => { const l = stage.label(t, p, obj, cls); sets[kind].push(l); if (!main) minor.push(l); return l; };
    L('Outer body', G.shell, [0.2, 3.85, 1.2], 'storage', true);
    L('PUF insulation', G.puf, [-1.95, 1.2, 0.4], 'storage');
    L('Inner tank (glass-lined)', G.tank, [1.9, 2.75, 0.4], 'storage', true);
    L('Heating element, 2 kW', G.element, [0.1, 1.8, 0.4], 'storage', true, 'hot');
    L('Magnesium anode', G.anode, [0.95, 1.75, 0], 'storage');
    L('Thermostat pocket', G.pocket, [-0.95, 0.85, 0], 'storage');
    L('Hot outlet (from the top)', G.outlet, [0.9, 3.25, 0], 'storage', true, 'hot');
    L('Cold inlet (at the bottom)', G.inlet, [-1.0, 0.25, 0], 'storage', true);
    L('Multi-function valve', G.mfv, [-1.2, 0, 0.2], 'storage', true);
    L('Thermostat knob', G.thermo, [-0.95, -0.3, 0.2], 'storage');
    L('Thermal cut-out', G.cutout, [1.0, -0.25, 0.3], 'storage');
    L('Indicator lamps', G.shell, [0.95, 0.45, 1.8], 'storage');
    L('3 L tank', I.tank, [1.2, 2.2, 0.8], 'instant', true);
    L('3 kW element', I.element, [0.5, 0.9, 0.6], 'instant', true, 'hot');
    L('Cold in', I.inlet, [-0.3, -0.3, 0.4], 'instant');
    L('Hot out', I.outlet, [0.3, -0.3, 0.4], 'instant', false, 'hot');
    L('Burner (LPG)', S.burner, [1.9, 0.1, 0.5], 'gas', true, 'hot');
    L('Copper heat exchanger', S.hx, [2.0, 0.4, 0.5], 'gas', true);
    L('Flue: fumes out', S.flue, [0.7, 1.6, 0], 'gas', true);
    L('Gas valve', S.valve, [0.8, -0.2, 0.3], 'gas');
    L('Cold in', S.inlet, [1.5, -0.2, 0.4], 'gas');
    L('Hot out', S.outlet, [-1.6, -0.2, 0.4], 'gas', false, 'hot');

    let t = 0, run = 1;
    const resp = responsive(stage, (p) => (p ? fitView(stage, [0, 3.0, 0], [0.35, 0.3, 1], 12.5) : VIEW));
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt);
        resp();
        t += dt;
        const k = s.kind;
        G.group.visible = k === 'storage'; I.group.visible = k === 'instant'; S.group.visible = k === 'gas';
        const narrow = stage.host.clientWidth < 560;
        for (const [kk, arr] of Object.entries(sets)) arr.forEach((l) => { l.visible = kk === k && !(narrow && minor.includes(l)); });
        setExplode(k === 'storage' ? s.explode : 0);
        G.setXray(s.xray); I.setXray(s.xray); S.setXray(s.xray);
        run += ((s.running ? 1 : 0) - run) * Math.min(1, dt * 3);
        G.setElement(run); G.setLamps(s.running, s.running);
        I.elemMat.emissiveIntensity = 1.4 * run; I.lamp.visible = s.running;
        S.flames.forEach((f, i) => { f.visible = run > 0.2; f.scale.y = run * (0.85 + 0.25 * Math.sin(t * 17 + i * 1.7)); f.position.y = 1.1 + 0.22 * f.scale.y; });
        // Warm plumes rise from the element tip and spread under the top of the tank.
        const show = k === 'storage' && s.xray && s.explode < 0.05 && run > 0.2;
        bub.visible = show;
        if (show) {
          for (let i = 0; i < NB; i++) {
            const u = (seed[i][0] + t * 0.18) % 1, y = 0.3 + u * 2.6;
            const spread = clamp((y - 1.4) / 1.4, 0, 1) * 1.0 + 0.12;
            bub.place(i, [seed[i][1] * spread * 2, y, 0.35 + seed[i][2] * 0.4], null, run * (1 - u * 0.5));
          }
          bub.done();
        }
      },
      readout: (s) => {
        if (s.kind === 'storage') {
          const h = heatUp({ litres: 15, tin: 20, tset: 45, kw: 2 });
          return `<div class="big">Storage geyser</div>
            <div class="row"><span>Tank</span><b>15 L</b></div>
            <div class="row"><span>Element</span><b>2 kW</b></div>
            <div class="row"><span>20 → 45 °C takes</span><b>${Math.round(h.min)} min</b></div>
            <small>Heats a tankful ahead of time, then keeps it hot.</small>`;
        }
        if (s.kind === 'instant') return `<div class="big">Instant geyser</div>
            <div class="row"><span>Tank</span><b>3 L</b></div>
            <div class="row"><span>Element</span><b>3 kW</b></div>
            <div class="row"><span>Steady flow warmed by 25 °C</span><b>${instantFlow().toFixed(1)} L/min</b></div>
            <small>Hot in a minute or two, but only a trickle after the 3 L run out.</small>`;
        return `<div class="big">Gas geyser</div>
            <div class="row"><span>Flow, warmed by 25 °C</span><b>6 L/min</b></div>
            <div class="row"><span>Heat into the water</span><b>${GAS.heat.toFixed(1)} kW</b></div>
            <div class="row"><span>LPG burned</span><b>${GAS.kgph.toFixed(1)} kg/h</b></div>
            <small>Needs fresh air and a flue: flames in a closed bathroom make deadly carbon monoxide.</small>`;
      },
    };
  },
};
