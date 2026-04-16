import { Platform } from 'react-native';

// Procedural ambient audio engine using Web Audio API
// Generates cosmic/space-themed soundscapes per environment

type EnvironmentType = 'space' | 'cantina' | 'desert' | 'jungle' | 'urban' | 'ice' | 'industrial' | 'ruins' | 'dark_side';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let activeNodes: AudioNode[] = [];
let activeOscillators: OscillatorNode[] = [];
let activeIntervals: ReturnType<typeof setInterval>[] = [];
let currentEnv: string | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.3;
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio not available:', e);
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function createNoise(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      data[i] = white;
    } else if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else { // brown
      data[i] = (b0 + white * 0.02) * 0.5;
      b0 = data[i];
      data[i] *= 3.5;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function createDrone(ctx: AudioContext, freq: number, type: OscillatorType = 'sine', detune: number = 0): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  return osc;
}

function createLFO(ctx: AudioContext, freq: number, min: number, max: number): { lfo: OscillatorNode; gain: GainNode } {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = (max - min) / 2;
  lfo.connect(gain);
  return { lfo, gain };
}

function stopAll() {
  activeOscillators.forEach(osc => {
    try { osc.stop(); } catch (_e) { /* ignore */ }
  });
  activeNodes.forEach(node => {
    try { node.disconnect(); } catch (_e) { /* ignore */ }
  });
  activeIntervals.forEach(interval => clearInterval(interval));
  activeOscillators = [];
  activeNodes = [];
  activeIntervals = [];
}

// === ENVIRONMENT SOUNDSCAPES ===

function buildSpace(ctx: AudioContext, out: GainNode) {
  // Deep sub-bass cosmic drone
  const drone = createDrone(ctx, 40, 'sine');
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.15;
  drone.connect(droneGain);
  droneGain.connect(out);
  drone.start();
  activeOscillators.push(drone);
  activeNodes.push(droneGain);

  // Second drone for depth
  const drone2 = createDrone(ctx, 55, 'sine', 3);
  const d2Gain = ctx.createGain();
  d2Gain.gain.value = 0.08;
  drone2.connect(d2Gain);
  d2Gain.connect(out);
  drone2.start();
  activeOscillators.push(drone2);
  activeNodes.push(d2Gain);

  // Soft white noise — vacuum hum
  const noise = createNoise(ctx, 'brown');
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 200;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.04;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(out);
  noise.start();
  activeNodes.push(noise, noiseFilter, noiseGain);

  // Distant metallic pings
  const pingInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const ping = ctx.createOscillator();
    ping.type = 'sine';
    ping.frequency.value = 800 + Math.random() * 2000;
    const pingGain = ctx.createGain();
    pingGain.gain.setValueAtTime(0.02 + Math.random() * 0.03, ctx.currentTime);
    pingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    ping.connect(pingGain);
    pingGain.connect(out);
    ping.start();
    ping.stop(ctx.currentTime + 1.5);
  }, 3000 + Math.random() * 5000);
  activeIntervals.push(pingInterval);
}

function buildCantina(ctx: AudioContext, out: GainNode) {
  // Warm low-frequency buzz
  const buzz = createDrone(ctx, 120, 'sawtooth');
  const buzzFilter = ctx.createBiquadFilter();
  buzzFilter.type = 'lowpass';
  buzzFilter.frequency.value = 300;
  const buzzGain = ctx.createGain();
  buzzGain.gain.value = 0.06;
  buzz.connect(buzzFilter);
  buzzFilter.connect(buzzGain);
  buzzGain.connect(out);
  buzz.start();
  activeOscillators.push(buzz);
  activeNodes.push(buzzFilter, buzzGain);

  // Muffled crowd murmur
  const crowd = createNoise(ctx, 'pink');
  const crowdFilter = ctx.createBiquadFilter();
  crowdFilter.type = 'bandpass';
  crowdFilter.frequency.value = 400;
  crowdFilter.Q.value = 0.5;
  const crowdGain = ctx.createGain();
  crowdGain.gain.value = 0.05;
  crowd.connect(crowdFilter);
  crowdFilter.connect(crowdGain);
  crowdGain.connect(out);
  crowd.start();
  activeNodes.push(crowd, crowdFilter, crowdGain);

  // Rhythmic tapping
  const tapInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const tap = ctx.createOscillator();
    tap.type = 'triangle';
    tap.frequency.value = 200 + Math.random() * 100;
    const tapGain = ctx.createGain();
    tapGain.gain.setValueAtTime(0.04, ctx.currentTime);
    tapGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    tap.connect(tapGain);
    tapGain.connect(out);
    tap.start();
    tap.stop(ctx.currentTime + 0.15);
  }, 400 + Math.random() * 200);
  activeIntervals.push(tapInterval);
}

function buildDesert(ctx: AudioContext, out: GainNode) {
  // Wind noise sweeps
  const wind = createNoise(ctx, 'pink');
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 600;
  windFilter.Q.value = 2;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.08;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(out);
  wind.start();
  activeNodes.push(wind, windFilter, windGain);

  // LFO on wind filter for sweep
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 400;
  lfo.connect(lfoGain);
  lfoGain.connect(windFilter.frequency);
  lfo.start();
  activeOscillators.push(lfo);
  activeNodes.push(lfoGain);

  // Heat shimmer high tone
  const shimmer = createDrone(ctx, 3000, 'sine');
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.01;
  shimmer.connect(shimmerGain);
  shimmerGain.connect(out);
  shimmer.start();
  activeOscillators.push(shimmer);
  activeNodes.push(shimmerGain);
}

function buildJungle(ctx: AudioContext, out: GainNode) {
  // Base ambience — rustling noise
  const rustle = createNoise(ctx, 'pink');
  const rustleFilter = ctx.createBiquadFilter();
  rustleFilter.type = 'bandpass';
  rustleFilter.frequency.value = 2000;
  rustleFilter.Q.value = 1;
  const rustleGain = ctx.createGain();
  rustleGain.gain.value = 0.03;
  rustle.connect(rustleFilter);
  rustleFilter.connect(rustleGain);
  rustleGain.connect(out);
  rustle.start();
  activeNodes.push(rustle, rustleFilter, rustleGain);

  // Chirping insects
  const chirpInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const chirp = ctx.createOscillator();
    chirp.type = 'sine';
    chirp.frequency.value = 3000 + Math.random() * 3000;
    const chirpGain = ctx.createGain();
    chirpGain.gain.setValueAtTime(0.03, ctx.currentTime);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    chirp.connect(chirpGain);
    chirpGain.connect(out);
    chirp.start();
    chirp.stop(ctx.currentTime + 0.1);
  }, 200 + Math.random() * 800);
  activeIntervals.push(chirpInterval);

  // Water drips
  const dripInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const drip = ctx.createOscillator();
    drip.type = 'sine';
    drip.frequency.setValueAtTime(1500, ctx.currentTime);
    drip.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
    const dripGain = ctx.createGain();
    dripGain.gain.setValueAtTime(0.04, ctx.currentTime);
    dripGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    drip.connect(dripGain);
    dripGain.connect(out);
    drip.start();
    drip.stop(ctx.currentTime + 0.35);
  }, 2000 + Math.random() * 4000);
  activeIntervals.push(dripInterval);
}

function buildUrban(ctx: AudioContext, out: GainNode) {
  // Neon electrical hum
  const hum = createDrone(ctx, 60, 'sawtooth');
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 180;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.05;
  hum.connect(humFilter);
  humFilter.connect(humGain);
  humGain.connect(out);
  hum.start();
  activeOscillators.push(hum);
  activeNodes.push(humFilter, humGain);

  // Traffic-like pulses
  const traffic = createNoise(ctx, 'brown');
  const trafficFilter = ctx.createBiquadFilter();
  trafficFilter.type = 'lowpass';
  trafficFilter.frequency.value = 150;
  const trafficGain = ctx.createGain();
  trafficGain.gain.value = 0.06;
  traffic.connect(trafficFilter);
  trafficFilter.connect(trafficGain);
  trafficGain.connect(out);
  traffic.start();
  activeNodes.push(traffic, trafficFilter, trafficGain);

  // Distant horns — high-tone blasts
  const hornInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const horn = ctx.createOscillator();
    horn.type = 'sawtooth';
    horn.frequency.value = 350 + Math.random() * 200;
    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 800;
    const hornGain = ctx.createGain();
    hornGain.gain.setValueAtTime(0, ctx.currentTime);
    hornGain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.1);
    hornGain.gain.setValueAtTime(0.025, ctx.currentTime + 0.4);
    hornGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    horn.connect(hornFilter);
    hornFilter.connect(hornGain);
    hornGain.connect(out);
    horn.start();
    horn.stop(ctx.currentTime + 1.3);
  }, 5000 + Math.random() * 8000);
  activeIntervals.push(hornInterval);

  // Distant alarm tones
  const alarmInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const alarm = ctx.createOscillator();
    alarm.type = 'square';
    alarm.frequency.value = 600 + Math.random() * 400;
    const alarmFilter = ctx.createBiquadFilter();
    alarmFilter.type = 'bandpass';
    alarmFilter.frequency.value = 800;
    alarmFilter.Q.value = 5;
    const alarmGain = ctx.createGain();
    alarmGain.gain.setValueAtTime(0.012, ctx.currentTime);
    alarmGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    alarm.connect(alarmFilter);
    alarmFilter.connect(alarmGain);
    alarmGain.connect(out);
    alarm.start();
    alarm.stop(ctx.currentTime + 0.7);
  }, 7000 + Math.random() * 12000);
  activeIntervals.push(alarmInterval);
}

function buildIce(ctx: AudioContext, out: GainNode) {
  // Howling wind
  const wind = createNoise(ctx, 'white');
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 1000;
  windFilter.Q.value = 3;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.06;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(out);
  wind.start();
  activeNodes.push(wind, windFilter, windGain);

  // LFO for howl
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.3;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 600;
  lfo.connect(lfoGain);
  lfoGain.connect(windFilter.frequency);
  lfo.start();
  activeOscillators.push(lfo);
  activeNodes.push(lfoGain);

  // Crystal chimes
  const chimeInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.value = 2000 + Math.random() * 4000;
    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.03, ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    chime.connect(chimeGain);
    chimeGain.connect(out);
    chime.start();
    chime.stop(ctx.currentTime + 1.2);
  }, 2000 + Math.random() * 5000);
  activeIntervals.push(chimeInterval);

  // Cracking/groaning tones
  const crackInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const crack = ctx.createOscillator();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(80, ctx.currentTime);
    crack.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.04, ctx.currentTime);
    crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'lowpass';
    crackFilter.frequency.value = 200;
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(out);
    crack.start();
    crack.stop(ctx.currentTime + 0.6);
  }, 6000 + Math.random() * 10000);
  activeIntervals.push(crackInterval);
}

function buildIndustrial(ctx: AudioContext, out: GainNode) {
  // Heavy mechanical grinding drone
  const grind = createDrone(ctx, 80, 'sawtooth');
  const grindFilter = ctx.createBiquadFilter();
  grindFilter.type = 'lowpass';
  grindFilter.frequency.value = 250;
  const grindGain = ctx.createGain();
  grindGain.gain.value = 0.07;
  grind.connect(grindFilter);
  grindFilter.connect(grindGain);
  grindGain.connect(out);
  grind.start();
  activeOscillators.push(grind);
  activeNodes.push(grindFilter, grindGain);

  // Steam hiss
  const steam = createNoise(ctx, 'white');
  const steamFilter = ctx.createBiquadFilter();
  steamFilter.type = 'highpass';
  steamFilter.frequency.value = 3000;
  const steamGain = ctx.createGain();
  steamGain.gain.value = 0.03;
  steam.connect(steamFilter);
  steamFilter.connect(steamGain);
  steamGain.connect(out);
  steam.start();
  activeNodes.push(steam, steamFilter, steamGain);

  // Clanking rhythm
  const clankInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const clank = ctx.createOscillator();
    clank.type = 'square';
    clank.frequency.value = 100 + Math.random() * 50;
    const clankGain = ctx.createGain();
    clankGain.gain.setValueAtTime(0.06, ctx.currentTime);
    clankGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    const clankFilter = ctx.createBiquadFilter();
    clankFilter.type = 'bandpass';
    clankFilter.frequency.value = 200;
    clankFilter.Q.value = 10;
    clank.connect(clankFilter);
    clankFilter.connect(clankGain);
    clankGain.connect(out);
    clank.start();
    clank.stop(ctx.currentTime + 0.08);
  }, 800 + Math.random() * 400);
  activeIntervals.push(clankInterval);

  // Distant alarm horns — high-pitched warning tones
  const alarmInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    // Two-tone alarm
    for (let i = 0; i < 3; i++) {
      const alarm = ctx.createOscillator();
      alarm.type = 'sawtooth';
      alarm.frequency.value = i % 2 === 0 ? 500 : 600;
      const alarmFilter = ctx.createBiquadFilter();
      alarmFilter.type = 'bandpass';
      alarmFilter.frequency.value = 700;
      alarmFilter.Q.value = 3;
      const alarmGain = ctx.createGain();
      const startTime = ctx.currentTime + i * 0.3;
      alarmGain.gain.setValueAtTime(0, startTime);
      alarmGain.gain.linearRampToValueAtTime(0.02, startTime + 0.05);
      alarmGain.gain.setValueAtTime(0.02, startTime + 0.15);
      alarmGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      alarm.connect(alarmFilter);
      alarmFilter.connect(alarmGain);
      alarmGain.connect(out);
      alarm.start(startTime);
      alarm.stop(startTime + 0.28);
    }
  }, 8000 + Math.random() * 15000);
  activeIntervals.push(alarmInterval);

  // Distant horn blasts
  const hornInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const horn = ctx.createOscillator();
    horn.type = 'sawtooth';
    horn.frequency.value = 280 + Math.random() * 120;
    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 600;
    const hornGain = ctx.createGain();
    hornGain.gain.setValueAtTime(0, ctx.currentTime);
    hornGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.2);
    hornGain.gain.setValueAtTime(0.03, ctx.currentTime + 0.8);
    hornGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    horn.connect(hornFilter);
    hornFilter.connect(hornGain);
    hornGain.connect(out);
    horn.start();
    horn.stop(ctx.currentTime + 2.1);
  }, 10000 + Math.random() * 20000);
  activeIntervals.push(hornInterval);
}

function buildRuins(ctx: AudioContext, out: GainNode) {
  // Hollow wind
  const wind = createNoise(ctx, 'brown');
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 300;
  windFilter.Q.value = 5;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(out);
  wind.start();
  activeNodes.push(wind, windFilter, windGain);

  // Echoing drips with reverb-like delay
  const dripInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const freq = 800 + Math.random() * 1200;
    for (let echo = 0; echo < 3; echo++) {
      const drip = ctx.createOscillator();
      drip.type = 'sine';
      drip.frequency.value = freq;
      const dripGain = ctx.createGain();
      const vol = 0.03 * Math.pow(0.5, echo);
      const time = ctx.currentTime + echo * 0.15;
      dripGain.gain.setValueAtTime(vol, time);
      dripGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      drip.connect(dripGain);
      dripGain.connect(out);
      drip.start(time);
      drip.stop(time + 0.35);
    }
  }, 3000 + Math.random() * 6000);
  activeIntervals.push(dripInterval);

  // Stone settling creaks
  const creakInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const creak = ctx.createOscillator();
    creak.type = 'triangle';
    creak.frequency.setValueAtTime(60, ctx.currentTime);
    creak.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.8);
    const creakGain = ctx.createGain();
    creakGain.gain.setValueAtTime(0.03, ctx.currentTime);
    creakGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    creak.connect(creakGain);
    creakGain.connect(out);
    creak.start();
    creak.stop(ctx.currentTime + 0.9);
  }, 8000 + Math.random() * 15000);
  activeIntervals.push(creakInterval);
}

function buildDarkSide(ctx: AudioContext, out: GainNode) {
  // Ominous sub-bass throb
  const throb = createDrone(ctx, 30, 'sine');
  const throbGain = ctx.createGain();
  throbGain.gain.value = 0.12;
  throb.connect(throbGain);
  throbGain.connect(out);
  throb.start();
  activeOscillators.push(throb);
  activeNodes.push(throbGain);

  // LFO on throb for pulsing
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain);
  lfoGain.connect(throbGain.gain);
  lfo.start();
  activeOscillators.push(lfo);
  activeNodes.push(lfoGain);

  // Dissonant whisper harmonics
  const whisper = createNoise(ctx, 'pink');
  const whisperFilter = ctx.createBiquadFilter();
  whisperFilter.type = 'bandpass';
  whisperFilter.frequency.value = 1500;
  whisperFilter.Q.value = 15;
  const whisperGain = ctx.createGain();
  whisperGain.gain.value = 0.02;
  whisper.connect(whisperFilter);
  whisperFilter.connect(whisperGain);
  whisperGain.connect(out);
  whisper.start();
  activeNodes.push(whisper, whisperFilter, whisperGain);

  // Dissonant chord
  const dis1 = createDrone(ctx, 110, 'sine');
  const dis2 = createDrone(ctx, 116, 'sine'); // slightly detuned = dissonance
  const disGain = ctx.createGain();
  disGain.gain.value = 0.04;
  dis1.connect(disGain);
  dis2.connect(disGain);
  disGain.connect(out);
  dis1.start();
  dis2.start();
  activeOscillators.push(dis1, dis2);
  activeNodes.push(disGain);

  // Crackling energy
  const crackleInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const crackle = ctx.createOscillator();
    crackle.type = 'sawtooth';
    crackle.frequency.value = 2000 + Math.random() * 3000;
    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0.04, ctx.currentTime);
    crackleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    crackle.connect(crackleGain);
    crackleGain.connect(out);
    crackle.start();
    crackle.stop(ctx.currentTime + 0.06);
  }, 500 + Math.random() * 2000);
  activeIntervals.push(crackleInterval);
}

// === PUBLIC API ===

const BUILDERS: Record<string, (ctx: AudioContext, out: GainNode) => void> = {
  space: buildSpace,
  cantina: buildCantina,
  desert: buildDesert,
  jungle: buildJungle,
  urban: buildUrban,
  ice: buildIce,
  industrial: buildIndustrial,
  ruins: buildRuins,
  dark_side: buildDarkSide,
};

export function startAmbientAudio(environment: string) {
  if (Platform.OS !== 'web') return;
  if (environment === currentEnv) return; // Already playing

  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  // Fade out existing
  stopAll();
  currentEnv = environment;

  const builder = BUILDERS[environment];
  if (builder) {
    builder(ctx, masterGain);
  } else {
    // Default to space
    buildSpace(ctx, masterGain);
  }
}

export function stopAmbientAudio() {
  stopAll();
  currentEnv = null;
}

export function setAmbientVolume(volume: number) {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }
}

// === SOUND EFFECTS ===

export function playDiceRollSound() {
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  // Rattling burst — rapid frequency clicks
  for (let i = 0; i < 8; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 200 + Math.random() * 600;
    const gain = ctx.createGain();
    const t = ctx.currentTime + i * 0.04;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }
}

export function playCommBeep() {
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

export function playWarningKlaxon() {
  const ctx = getAudioContext();
  if (!ctx || !masterGain) return;

  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = i === 0 ? 400 : 500;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 5;
    const gain = ctx.createGain();
    const t = ctx.currentTime + i * 0.2;
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}
