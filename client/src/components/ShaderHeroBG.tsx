// =============================================================================
// ShaderHeroBG — live WebGL fragment-shader mesh (composio-style flowing
// blue/cyan gradient). A full-screen triangle rendered with Three.js; the
// fragment shader animates layered value-noise (FBM) tinted across a
// white → sky → blue palette. Falls back to a static image if WebGL is
// unavailable, and pauses under prefers-reduced-motion.
// =============================================================================

import { useEffect, useRef } from "react";
import * as THREE from "three";

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2  uRes;
varying vec2  vUv;

// hash / value-noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = vUv;
  vec2 p = uv * 1.9;
  float t = uTime * 0.025;   // slow, calm drift

  // domain-warped flow (gentle)
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t)));
  vec2 r = vec2(fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.08 * t),
                fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.06 * t));
  float f = fbm(p + 1.8 * r);

  // composio palette: soft pastels, near-white base
  vec3 white = vec3(0.985, 0.99, 1.00);
  vec3 sky   = vec3(0.74, 0.92, 0.98);   // pale cyan
  vec3 blue  = vec3(0.62, 0.76, 0.98);   // soft periwinkle blue

  vec3 col = mix(white, sky, smoothstep(0.25, 0.75, f));
  col = mix(col, blue, smoothstep(0.6, 1.05, f + 0.25 * r.x));

  // keep it airy — bias toward white, gentle center glow
  float vign = smoothstep(1.2, 0.2, distance(uv, vec2(0.5, 0.6)));
  col = mix(vec3(0.985, 0.99, 1.0), col, 0.5 + 0.5 * vign);

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const ShaderHeroBG = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // Respect reduced motion — render one static frame, no rAF loop.
        const reduce = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true, // transparent clear → CSS fallback shows if shader fails
                premultipliedAlpha: false,
                powerPreference: "low-power",
                failIfMajorPerformanceCaveat: false,
            });
            // Bail to the CSS fallback if there's no usable GL context.
            if (!renderer.getContext()) {
                renderer.dispose();
                return;
            }
        } catch {
            return; // WebGL unavailable → CSS fallback image shows through
        }
        renderer.setClearColor(0x000000, 0);

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const scene = new THREE.Scene();
        const camera = new THREE.Camera();

        const uniforms = {
            uTime: { value: 0 },
            uRes: { value: new THREE.Vector2(1, 1) },
        };

        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms,
            depthTest: false,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        const canvas = renderer.domElement;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.opacity = "0";
        canvas.style.transition = "opacity 0.6s ease";
        mount.appendChild(canvas);

        const resize = () => {
            const w = Math.max(1, mount.clientWidth);
            const h = Math.max(1, mount.clientHeight);
            renderer.setSize(w, h, false);
            uniforms.uRes.value.set(w, h);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(mount);

        // Fade the canvas in only after a real frame paints, so a failed shader
        // never flashes over the CSS fallback.
        let painted = false;
        const markPainted = () => {
            if (!painted) {
                painted = true;
                canvas.style.opacity = "1";
            }
        };

        let raf = 0;
        const render = (ms: number) => {
            uniforms.uTime.value = ms / 1000;
            renderer.render(scene, camera);
            markPainted();
            raf = requestAnimationFrame(render);
        };

        if (reduce) {
            uniforms.uTime.value = 12; // a pleasant static frame
            renderer.render(scene, camera);
            markPainted();
        } else {
            raf = requestAnimationFrame(render);
        }

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            geo.dispose();
            mat.dispose();
            renderer.dispose();
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        };
    }, []);

    return (
        <div
            ref={mountRef}
            className="absolute inset-0 h-full w-full pointer-events-none"
            aria-hidden="true"
        />
    );
};

export default ShaderHeroBG;
