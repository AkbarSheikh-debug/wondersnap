// WebGL2 renderer: GPU particle physics via transform feedback (ping-pong buffers A <-> B), then
// webcam quad -> globe lines -> instanced trail lines -> glowing point sprites, all additive (ONE, ONE).
import * as S from './shaders.js';
import { makeRng } from '../lib/rng.js';
import { makeSeeds } from '../logic/simRef.js';

// ---------------------------------------------------------------- column-major mat4 helpers
export function perspective(fovyDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovyDeg * Math.PI) / 360), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
export const translate4 = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
export function rotY4(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
/** Row-major nested 3x3 -> column-major Float32Array for uniformMatrix3fv. */
export const mat3Col = (R) => new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
/** Project a world point with a column-major mat4 to NDC [x, y, w]. */
export function project(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, w];
}

/** Wireframe sphere as LINES vertex pairs (the holographic globe around the model). */
export function globeLines(r = 1, nLat = 7, nLon = 12, seg = 64) {
  const out = [];
  const push = (a, b) => out.push(...a, ...b);
  for (let i = 1; i < nLat; i++) {
    const phi = (Math.PI * i) / nLat - Math.PI / 2;
    for (let k = 0; k < seg; k++) {
      const t0 = (2 * Math.PI * k) / seg, t1 = (2 * Math.PI * (k + 1)) / seg;
      push([Math.cos(t0) * Math.cos(phi) * r, Math.sin(phi) * r, Math.sin(t0) * Math.cos(phi) * r],
        [Math.cos(t1) * Math.cos(phi) * r, Math.sin(phi) * r, Math.sin(t1) * Math.cos(phi) * r]);
    }
  }
  for (let j = 0; j < nLon; j++) {
    const th = (2 * Math.PI * j) / nLon, h = seg / 2;
    for (let k = 0; k < h; k++) {
      const t0 = -Math.PI / 2 + (Math.PI * k) / h, t1 = -Math.PI / 2 + (Math.PI * (k + 1)) / h;
      push([Math.cos(t0) * Math.cos(th) * r, Math.sin(t0) * r, Math.cos(t0) * Math.sin(th) * r],
        [Math.cos(t1) * Math.cos(th) * r, Math.sin(t1) * r, Math.cos(t1) * Math.sin(th) * r]);
    }
  }
  return new Float32Array(out);
}

// ---------------------------------------------------------------- renderer
export class Renderer {
  constructor(canvas, n, { preserve = false } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl; this.canvas = canvas; this.n = n; this.cur = 0;
    this.info = { renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) this.info.renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);

    this.pUpdate = this.program(S.UPDATE_VS, S.DISCARD_FS, ['out_pos', 'out_vel']);
    this.pPoints = this.program(S.PARTICLE_VS, S.PARTICLE_FS);
    this.pTrails = this.program(S.TRAIL_VS, S.TRAIL_FS);
    this.pLines = this.program(S.LINES_VS, S.LINES_FS);
    this.pBg = this.program(S.BG_VS, S.BG_FS);

    const buf = (data, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b; };
    this.state = [buf(new Float32Array(n * 6), gl.DYNAMIC_COPY), buf(new Float32Array(n * 6), gl.DYNAMIC_COPY)];
    this.target = buf(new Float32Array(n * 3), gl.DYNAMIC_DRAW);
    this.offset = buf(new Float32Array(n * 4), gl.DYNAMIC_DRAW);
    this.tint = buf(new Float32Array(n * 3).fill(1), gl.DYNAMIC_DRAW);
    this.pick = buf(new Float32Array(n).fill(-1), gl.DYNAMIC_DRAW);
    this.seed = buf(makeSeeds(n, makeRng(0)));
    const globe = globeLines(1.0);
    this.globeCount = globe.length / 3;
    this.globe = buf(globe);

    const attr = (loc, b, size, stride = 0, offset = 0, divisor = 0) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset); gl.vertexAttribDivisor(loc, divisor);
    };
    const vao = (setup) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); setup(); gl.bindVertexArray(null); return v; };
    this.vUpdate = this.state.map((b) => vao(() => { attr(0, b, 3, 24, 0); attr(1, b, 3, 24, 12); attr(2, this.target, 3); attr(3, this.seed, 4); attr(4, this.offset, 4); attr(5, this.pick, 1); }));
    this.vPoints = this.state.map((b) => vao(() => { attr(0, b, 3, 24, 0); attr(1, b, 3, 24, 12); attr(2, this.tint, 3); attr(3, this.pick, 1); }));
    // instanced attributes need divisor 1, otherwise every instance draws the same trail (no GL error!)
    this.vTrails = this.state.map((b) => vao(() => { attr(0, b, 3, 24, 0, 1); attr(1, b, 3, 24, 12, 1); attr(2, this.tint, 3, 0, 0, 1); attr(3, this.pick, 1, 0, 0, 1); }));
    this.vGlobe = vao(() => attr(0, this.globe, 3));
    this.vEmpty = vao(() => {});
    this.tf = gl.createTransformFeedback();

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.texSize = [1, 1];
  }

  program(vs, fs, varyings = null) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
    return { p, loc: {} };
  }

  /** Uniforms stripped by the driver return null locations — setting them is a silent no-op. */
  u(prog, name) { return prog.loc[name] !== undefined ? prog.loc[name] : (prog.loc[name] = this.gl.getUniformLocation(prog.p, name)); }
  f1(prog, name, v) { const l = this.u(prog, name); if (l) this.gl.uniform1f(l, v); }
  i1(prog, name, v) { const l = this.u(prog, name); if (l) this.gl.uniform1i(l, v); }
  v2(prog, name, v) { const l = this.u(prog, name); if (l) this.gl.uniform2fv(l, v); }
  v3(prog, name, v) { const l = this.u(prog, name); if (l) this.gl.uniform3fv(l, v); }
  m3(prog, name, v) { const l = this.u(prog, name); if (l) this.gl.uniformMatrix3fv(l, false, v); }
  m4(prog, name, v) { const l = this.u(prog, name); if (l) this.gl.uniformMatrix4fv(l, false, v); }

  setModel(model) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.target); gl.bufferSubData(gl.ARRAY_BUFFER, 0, model.target);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.offset); gl.bufferSubData(gl.ARRAY_BUFFER, 0, model.offset);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tint); gl.bufferSubData(gl.ARRAY_BUFFER, 0, model.tint);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pick); gl.bufferSubData(gl.ARRAY_BUFFER, 0, model.pick || new Float32Array(model.target.length / 3).fill(-1));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  uploadVideo(video) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    this.texSize = [video.videoWidth, video.videoHeight];
  }

  /** One physics step on the GPU (transform feedback). u: { dt, time, mode, formT, kick, rot, sphereR, explode, scale, exCenter } */
  step(u) {
    const gl = this.gl, P = this.pUpdate;
    gl.useProgram(P.p);
    this.f1(P, 'u_dt', u.dt); this.f1(P, 'u_time', u.time); this.i1(P, 'u_mode', u.mode); this.f1(P, 'u_form_t', u.formT);
    this.f1(P, 'u_kick', u.kick); this.m3(P, 'u_rot', mat3Col(u.rot)); this.f1(P, 'u_sphere_r', u.sphereR ?? 0.85);
    this.f1(P, 'u_explode', u.explode ?? 0); this.f1(P, 'u_scale', u.scale ?? 1); this.v3(P, 'u_excenter', u.exCenter ?? [0, 0, 0]);
    this.f1(P, 'u_sel', u.sel ?? -100); this.v3(P, 'u_pull', u.pull ?? [0, 0, 0]);
    // WebGL forbids a buffer being bound to TRANSFORM_FEEDBACK_BUFFER and any other target at once
    // (INVALID_OPERATION, and every later step silently does nothing) — so drop the generic binding first.
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(this.vUpdate[this.cur]);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.state[1 - this.cur]);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.n);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(null);
    this.cur = 1 - this.cur;
  }

  /** d: { projView, globeMvp, color, globeColor, tintMix, alpha, trails, trailLen, pointPx, gain, video: {has, dim, mirror} } */
  draw(d) {
    const gl = this.gl, W = this.canvas.width, H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);

    const B = this.pBg;                       // background: webcam (cover-fit, mirrored) or deep-space gradient
    gl.useProgram(B.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    this.i1(B, 'u_tex', 0); this.f1(B, 'u_dim', d.video?.dim ?? 0.8); this.f1(B, 'u_has_tex', d.video?.has ? 1 : 0);
    this.f1(B, 'u_mirror', d.video?.mirror === false ? 0 : 1);
    const va = this.texSize[0] / this.texSize[1], ca = W / H;
    this.v2(B, 'u_uv_scale', va > ca ? [ca / va, 1] : [1, va / ca]);
    gl.bindVertexArray(this.vEmpty); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (d.alpha <= 0) { gl.bindVertexArray(null); return; }

    const L = this.pLines;
    gl.useProgram(L.p);
    this.m4(L, 'u_mvp', d.globeMvp); this.v3(L, 'u_color', d.globeColor ?? d.color); this.f1(L, 'u_alpha', 0.12 * d.alpha);
    gl.bindVertexArray(this.vGlobe); gl.drawArrays(gl.LINES, 0, this.globeCount);

    if (d.trails) {
      const T = this.pTrails;
      gl.useProgram(T.p);
      this.m4(T, 'u_mvp', d.projView); this.v3(T, 'u_color', d.color); this.f1(T, 'u_tint_mix', d.tintMix);
      this.f1(T, 'u_alpha', d.alpha); this.f1(T, 'u_trail', d.trailLen ?? 0.06);
      this.f1(T, 'u_sel', d.sel ?? -100); this.f1(T, 'u_cut_on', d.cutOn ? 1 : 0); this.f1(T, 'u_cut', d.cut ?? 0);
      gl.bindVertexArray(this.vTrails[this.cur]); gl.drawArraysInstanced(gl.LINES, 0, 2, this.n);
    }
    const Pp = this.pPoints;
    gl.useProgram(Pp.p);
    this.m4(Pp, 'u_mvp', d.projView); this.v3(Pp, 'u_color', d.color); this.f1(Pp, 'u_tint_mix', d.tintMix);
    this.f1(Pp, 'u_alpha', d.alpha); this.f1(Pp, 'u_point_px', d.pointPx); this.f1(Pp, 'u_gain', d.gain ?? 0.22);
    this.f1(Pp, 'u_sel', d.sel ?? -100); this.f1(Pp, 'u_cut_on', d.cutOn ? 1 : 0); this.f1(Pp, 'u_cut', d.cut ?? 0);
    this.f1(Pp, 'u_flow', d.flow ?? 0); this.f1(Pp, 'u_time', d.time ?? 0);
    gl.bindVertexArray(this.vPoints[this.cur]); gl.drawArrays(gl.POINTS, 0, this.n);
    gl.bindVertexArray(null);
  }

  /** Read back the first `count` particles as Float32Array(count * 6) = [pos, vel] each (tests / debugging). */
  readParticles(count = this.n) {
    const gl = this.gl, out = new Float32Array(count * 6);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.state[this.cur]);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out, 0, count * 6);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return out;
  }

  /** Overwrite the particle state (tests: set a known state before comparing a GPU step with the CPU twin). */
  writeParticles(data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.state[this.cur]);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  readSeeds(count) {
    const gl = this.gl, out = new Float32Array(count * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.seed);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out, 0, count * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return out;
  }
}
