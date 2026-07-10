// =============================================================================
// DotGlobe — a slowly-rotating 3D sphere of dots (three.js), with attack-category
// pills anchored to points ON the sphere so they orbit with it (composio-style).
// Pills fade/scale as they rotate to the back; the dot mesh is grey on the light
// page. Falls back gracefully (renders nothing over the layout) if WebGL is out,
// and pauses under prefers-reduced-motion.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type GlobePill = { label: string };

// Even-ish distribution of anchor points on a sphere (Fibonacci lattice).
function fibonacciPoints(n: number, radius: number) {
    const pts: THREE.Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2; // 1 → -1
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        pts.push(
            new THREE.Vector3(
                Math.cos(theta) * r * radius,
                y * radius,
                Math.sin(theta) * r * radius,
            ),
        );
    }
    return pts;
}

const DotGlobe = ({ pills }: { pills: GlobePill[] }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    // Screen-space position + visibility for each pill, updated each frame.
    const [placed, setPlaced] = useState<
        { x: number; y: number; scale: number; opacity: number; z: number }[]
    >(() => pills.map(() => ({ x: 0, y: 0, scale: 1, opacity: 0, z: 0 })));

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "low-power",
            });
            if (!renderer.getContext()) {
                renderer.dispose();
                return;
            }
        } catch {
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.z = 5.4;

        const RADIUS = 1.9;

        // --- dot sphere ---
        const dotCount = 1800;
        const dotPts = fibonacciPoints(dotCount, RADIUS);
        const posArr = new Float32Array(dotCount * 3);
        dotPts.forEach((p, i) => {
            posArr[i * 3] = p.x;
            posArr[i * 3 + 1] = p.y;
            posArr[i * 3 + 2] = p.z;
        });
        const dotGeo = new THREE.BufferGeometry();
        dotGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));

        // Circular sprite texture so each point renders as a ROUND dot (GL points
        // are square by default). A radial gradient gives a soft, anti-aliased edge.
        const makeDotTexture = () => {
            const s = 64;
            const cv = document.createElement("canvas");
            cv.width = cv.height = s;
            const ctx = cv.getContext("2d");
            if (ctx) {
                const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
                g.addColorStop(0, "rgba(255,255,255,1)");
                g.addColorStop(0.7, "rgba(255,255,255,1)");
                g.addColorStop(1, "rgba(255,255,255,0)");
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            const tex = new THREE.CanvasTexture(cv);
            tex.needsUpdate = true;
            return tex;
        };
        const dotTexture = makeDotTexture();

        const dotMat = new THREE.PointsMaterial({
            color: 0x8b95a5,
            size: 0.055,
            map: dotTexture,
            alphaMap: dotTexture,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
        });
        const dots = new THREE.Points(dotGeo, dotMat);

        // faint fill sphere so back dots read slightly dimmer
        const fill = new THREE.Mesh(
            new THREE.SphereGeometry(RADIUS * 0.985, 48, 48),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.25,
            }),
        );

        const group = new THREE.Group();
        group.add(fill); // fill first (behind), then dots
        group.add(dots);
        scene.add(group);

        // --- pill anchor points on the sphere ---
        const anchors = fibonacciPoints(Math.max(pills.length, 1), RADIUS * 1.02)
            // spread pills toward the front hemisphere-ish for legibility
            .slice(0, pills.length);

        const canvas = renderer.domElement;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        mount.appendChild(canvas);

        const resize = () => {
            const w = Math.max(1, mount.clientWidth);
            const h = Math.max(1, mount.clientHeight);
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(mount);

        const world = new THREE.Vector3();
        const ndc = new THREE.Vector3();
        let raf = 0;
        let last = 0;

        const project = () => {
            const w = mount.clientWidth || 1;
            const h = mount.clientHeight || 1;
            const next = anchors.map((a) => {
                // world position of the anchor after the group's rotation
                world.copy(a).applyMatrix4(group.matrixWorld);
                // screen projection
                ndc.copy(world).project(camera);
                const x = (ndc.x * 0.5 + 0.5) * w;
                const y = (-ndc.y * 0.5 + 0.5) * h;
                // facing: world Z > 0 → front hemisphere (camera at +Z)
                const t = (world.z + RADIUS) / (2 * RADIUS); // 0 back → 1 front
                const front = world.z > -0.25;
                return {
                    x,
                    y,
                    z: world.z,
                    scale: 0.82 + t * 0.2,
                    opacity: front
                        ? Math.min(1, 0.2 + t * 1.2)
                        : Math.max(0, t * 0.45),
                };
            });
            setPlaced(next);
        };

        const animate = (ms: number) => {
            const dt = last ? (ms - last) / 1000 : 0;
            last = ms;
            group.rotation.y += dt * 0.12; // slow circling
            group.rotation.x = -0.28;
            group.updateMatrixWorld();
            renderer.render(scene, camera);
            project();
            raf = requestAnimationFrame(animate);
        };

        // Always project at least one frame synchronously so pills are placed
        // and visible even if the rAF loop never advances (headless / no WebGL).
        group.rotation.set(-0.28, 0.6, 0);
        group.updateMatrixWorld();
        renderer.render(scene, camera);
        project();

        if (!reduce) {
            raf = requestAnimationFrame(animate);
        }

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            dotGeo.dispose();
            dotMat.dispose();
            dotTexture.dispose();
            fill.geometry.dispose();
            (fill.material as THREE.Material).dispose();
            renderer.dispose();
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pills.length]);

    return (
        <div className="absolute inset-0">
            {/* Soft blurred glow behind the sphere (subtle grey vignette, like the ref) */}
            <div
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
                style={{
                    background:
                        "radial-gradient(closest-side at 55% 52%, rgba(148,163,184,0.18) 0%, rgba(148,163,184,0.10) 45%, rgba(148,163,184,0) 72%)",
                    filter: "blur(24px)",
                }}
            />
            {/* WebGL dot-sphere */}
            <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />
            {/* Pills anchored to the sphere, projected to screen and orbiting with it */}
            {pills.map((p, i) => {
                const s = placed[i] || { x: 0, y: 0, scale: 1, opacity: 0 };
                return (
                    <div
                        key={p.label}
                        className="mono-pill absolute -translate-x-1/2 -translate-y-1/2 will-change-transform"
                        style={{
                            left: s.x,
                            top: s.y,
                            transform: `translate(-50%, -50%) scale(${s.scale})`,
                            opacity: s.opacity,
                            zIndex: 10 + Math.round((s.scale - 0.8) * 100),
                            pointerEvents: "none",
                        }}
                    >
                        <span className="w-2 h-2 bg-[#3b82f6] shrink-0 rounded-[1px]" />
                        {p.label}
                    </div>
                );
            })}
        </div>
    );
};

export default DotGlobe;
