// GLSL ES 3.00 ports of wondersnap/shaders/*.vert|frag (WebGL2). The update step runs with transform
// feedback exactly like the desktop version. UPDATE_VS MUST stay numerically identical to src/logic/simRef.js.

export const UPDATE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 in_pos;
layout(location=1) in vec3 in_vel;
layout(location=2) in vec3 in_target;   // this particle's point on the current model (normalized units)
layout(location=3) in vec4 in_seed;     // xyz: random unit direction, w: random 0..1
layout(location=4) in vec4 in_offset;   // xyz: explode vector, w: explode stage 0..1 (machines only)
layout(location=5) in float in_group;   // part id (label index) for picking, -1 = none

uniform float u_dt;
uniform float u_time;
uniform int   u_mode;      // 0 idle, 1 sphere, 2 form, 3 dissolve
uniform float u_form_t;    // seconds since FORM began
uniform float u_kick;      // 1.0 on the single frame of a burst, else 0.0
uniform mat3  u_rot;       // model rotation (tilt * slow spin)
uniform float u_sphere_r;
uniform float u_explode;   // 0 assembled .. 1 fully exploded (driven by hand openness)
uniform float u_scale;     // zoom-out that keeps the exploded view on screen
uniform vec3  u_excenter;  // centre of the fully exploded cloud
uniform float u_sel;       // selected part id (-100 = none)
uniform vec3  u_pull;      // world-space pull applied to the selected part (pinch = pull it out toward you)

out vec3 out_pos;
out vec3 out_vel;

const float SWIRL = 0.45;
const float ORBIT = 1.6;
const float RAD_DAMP = 5.0;
const float K_RAD = 14.0;
const float DAMP = 2.2;
const float KICK = 2.2;
const float K_FORM = 80.0;
const float STAGGER = 0.6;
const float OUT_ACC = 2.5;

// Gradient of phi = sum(sin(k.p + w t)); the flow cross(n, grad phi) is tangent to the sphere and
// divergence-free on it, so particles swirl in vortices without clumping.
vec3 grad_phi(vec3 p, float t) {
  const vec3 k1 = vec3(1.7, 2.3, 0.0);
  const vec3 k2 = vec3(0.0, 1.9, 2.6);
  const vec3 k3 = vec3(2.4, 0.0, 1.5);
  return k1 * cos(dot(k1, p) + 0.9 * t) + k2 * cos(dot(k2, p) - 0.7 * t) + k3 * cos(dot(k3, p) + 1.1 * t);
}

void main() {
  vec3 p = in_pos;
  vec3 v = in_vel;
  float dt = u_dt;
  float r = length(p) + 1e-5;
  vec3 n = p / r;
  vec3 tang = cross(n, grad_phi(p, u_time));
  vec3 acc = vec3(0.0);

  if (u_mode == 0) {                         // idle: collapse invisibly to the centre
    p = p * exp(-10.0 * dt);
    v = vec3(0.0);
  } else if (u_mode == 1) {                  // swirling sphere shell
    float R = u_sphere_r * (0.93 + 0.07 * in_seed.w);
    float ang = in_seed.w * 6.2831853;
    vec3 axis = normalize(cross(in_seed.xyz, vec3(sin(ang), 0.37, cos(ang))));
    vec3 orbit = cross(axis, p) * ORBIT;
    float vr = dot(v, n);
    float centripetal = (dot(v, v) - vr * vr) / r;
    acc = (orbit + tang * SWIRL - v) * DAMP + n * ((R - r) * K_RAD - vr * RAD_DAMP - centripetal);
    v += in_seed.xyz * (u_kick * KICK);
  } else if (u_mode == 2) {                  // fly to the model, staggered, critically damped
    float delay = in_seed.w * STAGGER;
    float e = smoothstep(delay, delay + 0.35, u_form_t);
    float k = K_FORM * e;
    float s = clamp((u_explode - in_offset.w) / max(1.0 - in_offset.w, 1e-3), 0.0, 1.0);
    s = s * s * (3.0 - 2.0 * s);
    vec3 tgt = u_rot * ((in_target + in_offset.xyz * s - u_excenter * u_explode) * u_scale);
    if (abs(in_group - u_sel) < 0.5) tgt += u_pull;
    acc = k * (tgt - p) - 2.0 * sqrt(k) * v + (1.0 - e) * (tang * SWIRL - v * DAMP);
  } else {                                   // dissolve: blow outward
    acc = normalize(p * 0.5 + in_seed.xyz) * OUT_ACC + tang * 0.8 - v * 0.3;
  }
  if (u_mode != 0) {
    v += acc * dt;
    p += v * dt;
  }
  out_pos = p;
  out_vel = v;
}`;

export const DISCARD_FS = `#version 300 es
precision mediump float;
out vec4 f_color;
void main() { f_color = vec4(0.0); }`;

export const PARTICLE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 in_pos;
layout(location=1) in vec3 in_vel;
layout(location=2) in vec3 in_tint;
layout(location=3) in float in_group;
uniform mat4 u_mvp;
uniform vec3 u_color;
uniform float u_tint_mix;    // 0 = model colour (sphere), 1 = per-part colours (formed machine)
uniform float u_alpha;
uniform float u_point_px;    // point size in px at distance 1 (scaled with framebuffer height)
uniform float u_sel;         // selected part id: it glows, everything else dims (-100 = none)
uniform float u_cut_on;      // cut-away: hide everything beyond the plane x = u_cut
uniform float u_cut;
uniform float u_flow;        // travelling pulses of light (blood / air flow)
uniform float u_time;
out vec3 v_col;
out float v_a;
void main() {
  if (u_cut_on > 0.5 && in_pos.x > u_cut) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; v_col = vec3(0.0); v_a = 0.0; return; }
  gl_Position = u_mvp * vec4(in_pos, 1.0);
  gl_PointSize = clamp(u_point_px / gl_Position.w, 1.0, 12.0);
  float speed = length(in_vel);
  vec3 base = mix(u_color, in_tint, u_tint_mix);
  if (u_sel > -50.0) base *= abs(in_group - u_sel) < 0.5 ? 1.8 : 0.25;
  base *= 1.0 + u_flow * 1.6 * pow(max(0.0, sin(in_pos.y * 9.0 - u_time * 5.0)), 14.0);
  float edge = u_cut_on * (1.0 - smoothstep(0.0, 0.03, u_cut - in_pos.x));      // glowing cross-section face
  base = mix(base, vec3(1.0), edge * 0.7) * (1.0 + edge);
  v_col = mix(base, vec3(1.0), clamp(speed * 0.18, 0.0, 0.75));   // fast = hotter / whiter
  v_a = u_alpha;
}`;

export const PARTICLE_FS = `#version 300 es
precision mediump float;
in vec3 v_col;
in float v_a;
uniform float u_gain;
out vec4 f_color;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(c, c);
  if (d2 > 1.0) discard;
  float glow = exp(-d2 * 4.0) * 0.8 + exp(-d2 * 18.0) * 0.6;       // soft halo + hot core
  f_color = vec4(v_col * glow * v_a * u_gain, 1.0);                  // additive blend (ONE, ONE)
}`;

export const TRAIL_VS = `#version 300 es
precision highp float;
// Instanced LINES: 2 vertices per particle instance. Vertex 0 = head, vertex 1 = tail = pos - vel*len.
layout(location=0) in vec3 in_pos;   // per-instance
layout(location=1) in vec3 in_vel;   // per-instance
layout(location=2) in vec3 in_tint;  // per-instance
layout(location=3) in float in_group; // per-instance
uniform float u_sel;
uniform float u_cut_on;
uniform float u_cut;
uniform mat4 u_mvp;
uniform vec3 u_color;
uniform float u_tint_mix;
uniform float u_alpha;
uniform float u_trail;               // trail length in seconds of motion
out vec3 v_col;
out float v_a;
void main() {
  float tail = float(gl_VertexID & 1);
  vec3 p = in_pos - in_vel * (u_trail * tail);
  gl_Position = u_mvp * vec4(p, 1.0);
  float speed = length(in_vel);
  v_col = mix(mix(u_color, in_tint, u_tint_mix), vec3(1.0), 0.3);
  v_a = u_alpha * (1.0 - tail) * clamp(speed * 0.5 - 0.1, 0.0, 1.0);   // only moving particles streak
  if (u_sel > -50.0 && abs(in_group - u_sel) >= 0.5) v_a *= 0.25;
  if (u_cut_on > 0.5 && in_pos.x > u_cut) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); v_a = 0.0; }
}`;

export const TRAIL_FS = `#version 300 es
precision mediump float;
in vec3 v_col;
in float v_a;
out vec4 f_color;
void main() { f_color = vec4(v_col * v_a * 0.12, 1.0); }`;

export const LINES_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 in_pos;
uniform mat4 u_mvp;
void main() { gl_Position = u_mvp * vec4(in_pos, 1.0); }`;

export const LINES_FS = `#version 300 es
precision mediump float;
uniform vec3 u_color;
uniform float u_alpha;
out vec4 f_color;
void main() { f_color = vec4(u_color * u_alpha, 1.0); }`;

export const BG_VS = `#version 300 es
precision highp float;
// Full-screen triangle, no vertex buffer: draw 3 vertices.
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = vec2(p.x, 1.0 - p.y);            // video rows are top-down
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const BG_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
uniform float u_dim;
uniform float u_has_tex;
uniform vec2 u_uv_scale;                  // object-fit: cover
uniform float u_mirror;                   // selfie view
in vec2 v_uv;
out vec4 f_color;
void main() {
  vec2 uv = (v_uv - 0.5) * u_uv_scale + 0.5;
  if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
  vec3 cam = texture(u_tex, uv).rgb * u_dim;
  vec2 q = v_uv - vec2(0.62, 0.5);
  vec3 bg = vec3(0.012, 0.016, 0.03) + vec3(0.03, 0.045, 0.08) * exp(-dot(q, q) * 3.0);   // no camera: deep-space gradient
  f_color = vec4(mix(bg, cam, u_has_tex), 1.0);
}`;
