// App state machine. Pure logic: feed (stable pose, poseChanged, snapped, t); read sim parameters.
//
//   IDLE --snap--> SPHERE (burst from centre)
//   SPHERE --fist--> FORMED (particles fly into the current model)
//   FORMED --open--> SPHERE + next model        (wonders only)
//   FORMED + machine: hand openness = exploded view (open = apart, fist = assembled) — handled by the app
//   SPHERE/FORMED --peace ✌--> SPHERE + next model (any model)
//   SPHERE/FORMED --snap--> DISSOLVE --(1.2 s)--> IDLE
import { OPEN, FIST, PEACE } from './gestures.js';

export const IDLE = 'idle', SPHERE = 'sphere', FORMED = 'formed', DISSOLVE = 'dissolve';
export const SIM = { idle: 0, sphere: 1, formed: 2, dissolve: 3 };
export const DISSOLVE_S = 1.2, FADE_IN_S = 0.35;

export class WonderState {
  constructor(n, isMachine = () => false, start = 0) {
    this.n = n; this.isMachine = isMachine; this.index = start;
    this.state = IDLE; this.tState = 0; this.kick = false; this.fadeIn = false;
    this.targetDirty = true;           // app must upload model `index` into the target buffers
    this.events = [];                  // event log, drained by the UI
  }
  go(s, t) { this.state = s; this.tState = t; }
  emit(e) { this.events.push(e); }

  /** The burst impulse is latched until the render loop reads it (update() may run more than once per frame). */
  consumeKick() { const k = this.kick; this.kick = false; return k; }

  advance(step) {
    this.index = (((this.index + step) % this.n) + this.n) % this.n;
    this.targetDirty = true;
  }

  update(pose, changed, snapped, t) {
    if (snapped) {
      if (this.state === IDLE) { this.go(SPHERE, t); this.kick = true; this.fadeIn = true; this.emit('snap'); }
      else if (this.state === SPHERE || this.state === FORMED) { this.go(DISSOLVE, t); this.emit('dissolve'); }
    } else if (changed && pose === PEACE && (this.state === SPHERE || this.state === FORMED)) {
      this.advance(1); this.go(SPHERE, t); this.fadeIn = false; this.emit('next');
    } else if (this.state === SPHERE && changed && pose === FIST) {
      this.go(FORMED, t); this.fadeIn = false; this.emit('form');
    } else if (this.state === FORMED && changed && pose === OPEN && !this.isMachine(this.index)) {
      this.advance(1); this.go(SPHERE, t); this.fadeIn = false; this.emit('next');
    }
    if (this.state === DISSOLVE && t - this.tState >= DISSOLVE_S) this.go(IDLE, t);
  }

  /** UI / keyboard selection of a specific model. */
  select(i, t) {
    if (i === this.index && this.state !== IDLE && this.state !== DISSOLVE) return;
    this.index = ((i % this.n) + this.n) % this.n; this.targetDirty = true;
    if (this.state === IDLE || this.state === DISSOLVE) { this.go(SPHERE, t); this.kick = true; this.fadeIn = true; }
    else this.go(SPHERE, t);
    this.emit('select');
  }

  simMode() { return SIM[this.state]; }
  formT(t) { return this.state === FORMED ? t - this.tState : 0; }
  alpha(t) {
    const dt = t - this.tState;
    if (this.state === IDLE) return 0;
    if (this.state === DISSOLVE) return Math.max(0, 1 - dt / DISSOLVE_S);
    if (this.state === SPHERE && this.fadeIn) return Math.min(1, 0.15 + dt / FADE_IN_S);
    return 1;
  }
}
