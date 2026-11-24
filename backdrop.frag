// index.html の <script id="frag"> と同じ中身。
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform int uSource;   // 0 プリズム 1 青の流れ 2 積雲 3 夕方の雲 4 画像
uniform int uEffect;   // 0 ディザ 1 ドット 2 二色刷り 3 モザイク
uniform int uPattern;  // 0 規則 1 ランダム
uniform int uShape;    // 0 丸 1 線 2 ひし形
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform float uCell;     // 粒の大きさ（実ピクセル）
uniform float uContrast;
uniform float uBright;
uniform float uGap;      // すき間（実ピクセル）
uniform float uLevels;
uniform float uAngle;
uniform float uMix;
uniform vec3 uInk;
uniform vec3 uPaper;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.0;
    a *= 0.5;
  }
  return v;
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// ---- 元の絵 ----
vec3 srcPrism(vec2 q) {
  float t = uTime;
  vec2 dir = normalize(vec2(1.0, 0.62));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 c = vec2(0.0, -0.06);
  float along = dot(q - c, dir);
  float n = fbm(q * 1.6 + vec2(t * 0.03, -t * 0.02));
  float d = dot(q - c, nrm) + 0.09 * (n - 0.5) + 0.04 * sin(along * 3.0 + t * 0.2);
  float x = d / 0.13;
  float st = 0.55 + 0.9 * fbm(vec2(along * 1.8 - t * 0.06, d * 16.0));
  float fade = smoothstep(-1.1, 0.4, along);
  vec3 g = vec3(0.0);
  g += vec3(0.10, 0.38, 1.00) * exp(-pow((x + 0.8) / 0.6, 2.0)) * 0.8;
  g += vec3(0.80, 0.82, 0.85) * exp(-pow((x - 0.05) / 0.26, 2.0)) * 0.75;
  g += vec3(1.00, 0.48, 0.12) * exp(-pow((x - 0.45) / 0.24, 2.0)) * 0.95;
  g += vec3(1.00, 0.10, 0.03) * exp(-pow((x - 0.80) / 0.13, 2.0)) * 1.1;
  vec3 bg = vec3(0.025, 0.027, 0.04) + 0.035 * vec3(n);
  return bg + g * st * fade;
}
vec3 srcSweep(vec2 q) {
  float t = uTime;
  float n = fbm(q * 1.3 + vec2(t * 0.025, t * 0.015));
  float g = dot(q, normalize(vec2(1.0, 0.8))) + 0.16 * (n - 0.5) + 0.03 * sin(q.y * 4.0 + t * 0.3);
  vec3 col = vec3(0.86, 0.89, 0.86);
  col = mix(col, vec3(0.62, 0.76, 0.90), smoothstep(-0.55, -0.2, g));
  col = mix(col, vec3(0.14, 0.33, 0.68), smoothstep(-0.2, 0.08, g));
  col = mix(col, vec3(0.04, 0.10, 0.30), smoothstep(0.04, 0.35, g));
  col = mix(col, vec3(0.01, 0.02, 0.06), smoothstep(0.3, 0.8, g));
  float glow = exp(-pow(length((q - vec2(-0.45, 0.35)) * vec2(1.0, 1.8)) / 0.35, 2.0));
  col += vec3(0.05, 0.20, 0.55) * glow * 0.8;
  return col;
}
float cloudField(vec2 q, float yc, float spread) {
  vec2 p = q * vec2(1.5, 1.9) + vec2(uTime * 0.015, 0.0);
  vec2 w = vec2(fbm(p + vec2(1.7, 9.2)), fbm(p + vec2(8.3, 2.8)));
  float f = fbm(p * 1.4 + 1.6 * w);
  float band = 1.0 - smoothstep(0.0, spread, abs(q.y - yc));
  return f + 0.3 * band - 0.2;
}
vec3 clouds(vec2 q, float yc, float spread, vec3 sky, vec3 shadow, vec3 lit, float edge) {
  float fd = cloudField(q, yc, spread);
  float d = smoothstep(0.48, 0.6, fd);
  float du = smoothstep(0.48, 0.6, cloudField(q - vec2(0.0, 0.035), yc, spread));
  float shade = clamp((d - du) * 2.5, -1.0, 1.0);
  vec3 cl = mix(shadow, lit, clamp(0.5 + edge * shade + 1.2 * (fd - 0.6) + 0.9 * (fbm(q * 5.0 + 3.0) - 0.5), 0.0, 1.0));
  return mix(sky, cl, d);
}
vec3 srcCumulus(vec2 q) {
  vec3 sky = mix(vec3(0.13, 0.30, 0.92), vec3(0.20, 0.42, 0.96), smoothstep(-0.6, 0.6, q.y));
  return clouds(q, 0.0, 0.36, sky, vec3(0.62, 0.70, 0.92), vec3(1.0), 1.2);
}
vec3 srcDusk(vec2 q) {
  vec3 sky = mix(vec3(0.35, 0.44, 0.47), vec3(0.60, 0.68, 0.68), smoothstep(-0.7, 0.5, q.y));
  return clouds(q * 1.1 + vec2(0.3, 0.0), 0.3, 0.3, sky, vec3(0.42, 0.50, 0.52), vec3(0.92, 0.85, 0.66), 1.1);
}
vec3 source(vec2 pix) {
  if (uSource == 4) {
    vec2 uv = pix / uRes;
    float ra = uRes.x / uRes.y, ta = uTexSize.x / uTexSize.y;
    vec2 sc = ra > ta ? vec2(1.0, ta / ra) : vec2(ra / ta, 1.0);
    uv = (uv - 0.5) * sc + 0.5;
    return texture2D(uTex, uv).rgb;
  }
  vec2 q = (pix - 0.5 * uRes) / min(uRes.x, uRes.y);
  if (uSource == 0) return srcPrism(q);
  if (uSource == 1) return srcSweep(q);
  if (uSource == 2) return srcCumulus(q);
  return srcDusk(q);
}
vec3 grade(vec3 c) {
  return clamp((c - 0.5) * uContrast + 0.5 + uBright, 0.0, 1.0);
}

// ---- 効果 ----
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float gapMask(vec2 loc) {
  vec2 px = loc * uCell;
  return step(uGap, px.x) * step(uGap, px.y);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 outc;
  float aa = 0.8 / uCell;

  if (uEffect == 0) {
    vec2 cell = floor(frag / uCell);
    vec2 loc = fract(frag / uCell);
    vec3 c = grade(source((cell + 0.5) * uCell));
    vec3 b = uPattern == 0 ? vec3(bayer8(cell))
                           : vec3(hash(cell + 0.31), hash(cell + 17.7), hash(cell + 41.3));
    float L = max(uLevels - 1.0, 1.0);
    c = clamp(floor(c * L + b) / L, 0.0, 1.0);
    outc = c * gapMask(loc);
  } else if (uEffect == 1) {
    vec2 cell = floor(frag / uCell);
    vec2 loc = fract(frag / uCell) - 0.5;
    vec3 c = grade(source((cell + 0.5) * uCell));
    float l = luma(c);
    float r = sqrt(l) * 0.62;
    float m = 1.0 - smoothstep(r - aa, r + aa, length(loc));
    vec3 dotc = clamp(mix(c, c / max(sqrt(l), 0.15), 0.45), 0.0, 1.0);
    outc = mix(uInk, dotc, m);
  } else if (uEffect == 2) {
    float a = radians(uAngle);
    float ca = cos(a), sa = sin(a);
    vec2 rp = vec2(ca * frag.x + sa * frag.y, -sa * frag.x + ca * frag.y);
    vec2 cell = floor(rp / uCell);
    vec2 loc = fract(rp / uCell) - 0.5;
    vec2 cc = (cell + 0.5) * uCell;
    vec2 center = vec2(ca * cc.x - sa * cc.y, sa * cc.x + ca * cc.y);
    float l = luma(grade(source(center)));
    float dist, r;
    if (uShape == 0) { dist = length(loc); r = sqrt(l) * 0.6; }
    else if (uShape == 1) { dist = abs(loc.y); r = l * 0.5; }
    else { dist = (abs(loc.x) + abs(loc.y)) * 0.7071; r = sqrt(l) * 0.5; }
    float m = 1.0 - smoothstep(r - aa, r + aa, dist);
    outc = mix(uInk, uPaper, m);
  } else {
    vec2 cell = floor(frag / uCell);
    vec2 loc = fract(frag / uCell);
    vec3 c = grade(source((cell + 0.5) * uCell));
    float P = max(uLevels - 1.0, 1.0);
    float l = luma(c);
    float ql = floor(l * P + 0.5) / P;
    vec3 pc = clamp(c * (ql / max(l, 0.001)), 0.0, 1.0);
    float lev = floor(clamp(l, 0.0, 0.999) * 5.0);
    vec2 s = (floor(loc * 5.0) + 0.5) / 5.0 - 0.5;
    float cheb = max(abs(s.x), abs(s.y));
    float g = 0.0;
    if (lev > 3.5) g = step(cheb, 0.45) * (1.0 - step(0.35, abs(s.x)) * step(0.35, abs(s.y)));
    else if (lev > 2.5) g = step(cheb, 0.25);
    else if (lev > 1.5) g = step(abs(cheb - 0.2), 0.05);
    else if (lev > 0.5) g = step(cheb, 0.05);
    vec3 bg = pc * 0.86;
    vec3 fg = clamp(mix(pc, vec3(1.0), 0.14) * 1.05, 0.0, 1.0);
    outc = mix(bg, fg, g) * gapMask(loc);
  }

  if (uMix > 0.001) outc = mix(outc, grade(source(frag)), uMix);
  gl_FragColor = vec4(outc, 1.0);
}
