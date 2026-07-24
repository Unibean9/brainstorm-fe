"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

export type EngineCoreState = "idle" | "listening" | "agent-speaking" | "processing";

type RoomEngineCoreProps = {
  state: EngineCoreState;
  className?: string;
};

/**
 * Dense orchestration core — graph + filament, wrapped in atmospheric volume.
 * Palette: coral / sticky / sky / ink / canvas (DESIGN.md).
 */
const ENGINE_NODES = [
  { id: "hub", color: "#ea580c", r: 0, y: 0, size: 0.16, isHub: true, shell: 0 },
  { id: "observe", color: "#ea580c", r: 0.82, y: 0.14, size: 0.07, isHub: false, shell: 1 },
  { id: "analyze", color: "#0ea5e9", r: 0.86, y: 0.04, size: 0.064, isHub: false, shell: 1 },
  { id: "diagnose", color: "#fde047", r: 0.8, y: -0.1, size: 0.062, isHub: false, shell: 1 },
  { id: "state", color: "#0ea5e9", r: 0.84, y: -0.16, size: 0.06, isHub: false, shell: 1 },
  { id: "technique", color: "#fde047", r: 0.85, y: 0.0, size: 0.062, isHub: false, shell: 1 },
  { id: "trace", color: "#334155", r: 0.78, y: 0.1, size: 0.062, isHub: false, shell: 1 },
  { id: "idea-a", color: "#ea580c", r: 1.08, y: 0.08, size: 0.032, isHub: false, shell: 2 },
  { id: "idea-b", color: "#0ea5e9", r: 1.1, y: -0.05, size: 0.03, isHub: false, shell: 2 },
  { id: "idea-c", color: "#fde047", r: 1.06, y: 0.02, size: 0.028, isHub: false, shell: 2 },
  { id: "idea-d", color: "#334155", r: 1.09, y: -0.12, size: 0.03, isHub: false, shell: 2 },
  { id: "idea-e", color: "#0ea5e9", r: 1.07, y: 0.14, size: 0.028, isHub: false, shell: 2 },
  { id: "idea-f", color: "#ea580c", r: 1.12, y: -0.02, size: 0.03, isHub: false, shell: 2 },
] as const;

/** Hub spokes + inner loop + outer links into nearest loop nodes. */
const ENGINE_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 1],
  [1, 7],
  [2, 8],
  [3, 9],
  [4, 10],
  [5, 11],
  [6, 12],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 7],
];

const STATE_TUNING: Record<
  EngineCoreState,
  {
    spin: number;
    breatheSpeed: number;
    breatheAmp: number;
    pulseSpeed: number;
    filamentGlow: number;
    hubBoost: number;
    spokeDir: number;
  }
> = {
  idle: {
    spin: 0.16,
    breatheSpeed: 0.48,
    breatheAmp: 0.012,
    pulseSpeed: 0.22,
    filamentGlow: 0.55,
    hubBoost: 1,
    spokeDir: 1,
  },
  listening: {
    spin: 0.28,
    breatheSpeed: 1.15,
    breatheAmp: 0.02,
    pulseSpeed: 0.78,
    filamentGlow: 0.9,
    hubBoost: 1.24,
    spokeDir: -1,
  },
  processing: {
    spin: 0.62,
    breatheSpeed: 1.35,
    breatheAmp: 0.016,
    pulseSpeed: 1.55,
    filamentGlow: 1,
    hubBoost: 1.14,
    spokeDir: 1,
  },
  "agent-speaking": {
    spin: 0.32,
    breatheSpeed: 1.48,
    breatheAmp: 0.028,
    pulseSpeed: 1.0,
    filamentGlow: 0.95,
    hubBoost: 1.28,
    spokeDir: 1,
  },
};

function makeSoftSpriteTexture(
  inner = "rgba(255,255,255,1)",
  mid = "rgba(255,255,255,0.55)"
) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function nodeBasePosition(index: number, def: (typeof ENGINE_NODES)[number]) {
  if (def.isHub) return new THREE.Vector3(0, def.y, 0);
  const sameShell = ENGINE_NODES.map((n, i) => ({ n, i })).filter(
    ({ n }) => n.shell === def.shell && !n.isHub
  );
  const localIndex = sameShell.findIndex(({ i }) => i === index);
  const count = sameShell.length;
  const angle = (localIndex / count) * Math.PI * 2 - Math.PI / 2 + (def.shell === 2 ? 0.22 : 0);
  return new THREE.Vector3(Math.cos(angle) * def.r, def.y, Math.sin(angle) * def.r);
}

function buildFilamentCurve(a: THREE.Vector3, b: THREE.Vector3, arch: number) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const outward = mid.clone().normalize();
  if (outward.lengthSq() < 0.001) outward.set(0, 1, 0);
  mid.addScaledVector(outward, arch);
  mid.y += arch * 0.4;
  return new THREE.CatmullRomCurve3([a.clone(), mid, b.clone()]);
}

export function RoomEngineCore({ state, className }: RoomEngineCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.background = "transparent";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    // Narrower FOV + farther camera = generous margin so nothing hits canvas edges.
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40);
    camera.position.set(0, 0, 4.4);

    const root = new THREE.Group();
    scene.add(root);

    const glowMap = makeSoftSpriteTexture();
    const pulseMap = makeSoftSpriteTexture("rgba(255,255,255,1)", "rgba(253,224,71,0.55)");

    // Soft hub bloom only — keep small so it never fills/clips the canvas.
    const aura = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowMap,
        color: new THREE.Color("#ea580c"),
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    aura.scale.set(1.35, 1.35, 1);
    root.add(aura);

    const basePositions = ENGINE_NODES.map((n, i) => nodeBasePosition(i, n));

    type NodeRuntime = {
      mesh: THREE.Mesh;
      glow: THREE.Sprite;
      baseSize: number;
      isHub: boolean;
      shell: number;
      index: number;
    };

    const nodes: NodeRuntime[] = ENGINE_NODES.map((def, i) => {
      const color = new THREE.Color(def.color);
      const geo = new THREE.SphereGeometry(1, 28, 28);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: def.isHub ? 0.98 : def.shell === 2 ? 0.72 : 0.94,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(def.size);
      mesh.position.copy(basePositions[i]);
      root.add(mesh);

      const glowMat = new THREE.SpriteMaterial({
        map: glowMap,
        color,
        transparent: true,
        opacity: def.isHub ? 0.65 : def.shell === 2 ? 0.28 : 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.setScalar(def.size * (def.isHub ? 6.5 : def.shell === 2 ? 3.4 : 5));
      glow.position.copy(basePositions[i]);
      root.add(glow);

      return {
        mesh,
        glow,
        baseSize: def.size,
        isHub: def.isHub,
        shell: def.shell,
        index: i,
      };
    });

    type EdgeRuntime = {
      curve: THREE.CatmullRomCurve3;
      tube: THREE.Mesh;
      core: THREE.Mesh;
      pulse: THREE.Sprite;
      from: number;
      to: number;
      phase: number;
      isRing: boolean;
      isOuter: boolean;
    };

    const edges: EdgeRuntime[] = ENGINE_EDGES.map(([from, to], edgeIndex) => {
      const fromShell = ENGINE_NODES[from].shell;
      const toShell = ENGINE_NODES[to].shell;
      const isOuter = fromShell === 2 || toShell === 2;
      const isRing = from !== 0 && to !== 0;
      const arch = isOuter ? 0.08 : isRing ? 0.14 : 0.08;
      const curve = buildFilamentCurve(basePositions[from], basePositions[to], arch);
      const colorA = new THREE.Color(ENGINE_NODES[from].color);
      const colorB = new THREE.Color(ENGINE_NODES[to].color);
      const tubeColor = colorA.clone().lerp(colorB, 0.5);

      const tubeRadius = isOuter ? 0.01 : from === 0 ? 0.02 : 0.016;
      const tubeGeo = new THREE.TubeGeometry(curve, 48, tubeRadius, 10, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: tubeColor,
        transparent: true,
        opacity: isOuter ? 0.28 : 0.48,
        depthWrite: false,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      root.add(tube);

      const coreGeo = new THREE.TubeGeometry(curve, 48, tubeRadius * 0.35, 6, false);
      const coreMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#faf7f2"),
        transparent: true,
        opacity: isOuter ? 0.35 : 0.7,
        depthWrite: false,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      root.add(core);

      const pulseMat = new THREE.SpriteMaterial({
        map: pulseMap,
        color: tubeColor.clone().lerp(new THREE.Color("#faf7f2"), 0.15),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pulse = new THREE.Sprite(pulseMat);
      pulse.scale.setScalar(isOuter ? 0.1 : 0.18);
      root.add(pulse);

      return {
        curve,
        tube,
        core,
        pulse,
        from,
        to,
        phase: edgeIndex / ENGINE_EDGES.length,
        isRing,
        isOuter,
      };
    });

    // Filament motes
    const moteCount = edges.length * 5;
    const motePositions = new Float32Array(moteCount * 3);
    const moteSeeds = new Float32Array(moteCount);
    const moteColors = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const edge = edges[i % edges.length];
      const u = (i / moteCount + (i % 5) * 0.09) % 1;
      const p = edge.curve.getPointAt(u);
      motePositions[i * 3] = p.x;
      motePositions[i * 3 + 1] = p.y;
      motePositions[i * 3 + 2] = p.z;
      moteSeeds[i] = Math.random();
      const c = new THREE.Color(ENGINE_NODES[edge.from].color).lerp(
        new THREE.Color(ENGINE_NODES[edge.to].color),
        u
      );
      moteColors[i * 3] = c.r;
      moteColors[i * 3 + 1] = c.g;
      moteColors[i * 3 + 2] = c.b;
    }
    const moteGeo = new THREE.BufferGeometry();
    const motePosAttr = new THREE.BufferAttribute(motePositions.slice(), 3);
    moteGeo.setAttribute("position", motePosAttr);
    moteGeo.setAttribute("color", new THREE.BufferAttribute(moteColors, 3));
    const moteMat = new THREE.PointsMaterial({
      size: 0.04,
      map: glowMap,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    root.add(motes);

    const tuning = { ...STATE_TUNING.idle };
    const hubTint = new THREE.Color("#ea580c");
    const hubTarget = new THREE.Color("#ea580c");
    let frameId = 0;
    const start = performance.now();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = (performance.now() - start) / 1000;
      const currentState = stateRef.current;
      const target = STATE_TUNING[currentState];

      tuning.spin += (target.spin - tuning.spin) * 0.035;
      tuning.breatheSpeed += (target.breatheSpeed - tuning.breatheSpeed) * 0.035;
      tuning.breatheAmp += (target.breatheAmp - tuning.breatheAmp) * 0.035;
      tuning.pulseSpeed += (target.pulseSpeed - tuning.pulseSpeed) * 0.04;
      tuning.filamentGlow += (target.filamentGlow - tuning.filamentGlow) * 0.04;
      tuning.hubBoost += (target.hubBoost - tuning.hubBoost) * 0.04;
      tuning.spokeDir += (target.spokeDir - tuning.spokeDir) * 0.06;

      if (currentState === "agent-speaking") hubTarget.set("#0ea5e9");
      else if (currentState === "listening") hubTarget.set("#fde047");
      else hubTarget.set("#ea580c");
      hubTint.lerp(hubTarget, 0.04);
      const hubNode = nodes[0];
      (hubNode.mesh.material as THREE.MeshBasicMaterial).color.copy(hubTint);
      (hubNode.glow.material as THREE.SpriteMaterial).color.copy(hubTint);
      (aura.material as THREE.SpriteMaterial).color.copy(hubTint);
      (aura.material as THREE.SpriteMaterial).opacity = 0.12 + tuning.filamentGlow * 0.1;

      const breathe = 1 + Math.sin(t * tuning.breatheSpeed) * tuning.breatheAmp;
      root.scale.setScalar(breathe);

      for (const node of nodes) {
        const pulse =
          node.isHub
            ? tuning.hubBoost * (1 + Math.sin(t * tuning.breatheSpeed * 1.25) * 0.05)
            : 1 +
              Math.sin(t * tuning.breatheSpeed + node.index * 0.7) *
                (node.shell === 2 ? 0.05 : 0.035);
        node.mesh.scale.setScalar(node.baseSize * pulse);
        node.glow.scale.setScalar(
          node.baseSize * (node.isHub ? 6.5 : node.shell === 2 ? 3.4 : 5) * pulse
        );
        const glowMat = node.glow.material as THREE.SpriteMaterial;
        glowMat.opacity =
          (node.isHub ? 0.48 : node.shell === 2 ? 0.18 : 0.3) *
          (0.65 + tuning.filamentGlow * 0.4);
      }

      for (const edge of edges) {
        const tubeMat = edge.tube.material as THREE.MeshBasicMaterial;
        const coreMat = edge.core.material as THREE.MeshBasicMaterial;
        tubeMat.opacity =
          (edge.isOuter ? 0.16 : 0.28) + tuning.filamentGlow * (edge.isOuter ? 0.22 : 0.4);
        coreMat.opacity =
          (edge.isOuter ? 0.25 : 0.42) + tuning.filamentGlow * (edge.isOuter ? 0.2 : 0.35);

        const dir = edge.isRing && !edge.isOuter ? 1 : tuning.spokeDir;
        const speed = tuning.pulseSpeed * (edge.isOuter ? 0.45 : edge.isRing ? 1 : 0.65);
        const raw = t * speed * dir + edge.phase;
        const pulseU = ((raw % 1) + 1) % 1;
        edge.pulse.position.copy(edge.curve.getPointAt(pulseU));
        const pulseMat = edge.pulse.material as THREE.SpriteMaterial;
        pulseMat.opacity =
          (edge.isOuter ? 0.45 : edge.isRing ? 0.95 : 0.75) *
          (0.35 + tuning.filamentGlow * 0.65);
        edge.pulse.scale.setScalar((edge.isOuter ? 0.08 : 0.12) + tuning.filamentGlow * 0.06);
      }

      const moteArr = motePosAttr.array as Float32Array;
      for (let i = 0; i < moteCount; i++) {
        const edge = edges[i % edges.length];
        const u = (moteSeeds[i] + t * tuning.pulseSpeed * 0.14) % 1;
        const p = edge.curve.getPointAt(u);
        moteArr[i * 3] = p.x;
        moteArr[i * 3 + 1] = p.y;
        moteArr[i * 3 + 2] = p.z;
      }
      motePosAttr.needsUpdate = true;
      moteMat.opacity = 0.28 + tuning.filamentGlow * 0.4;

      root.rotation.y += 0.0018 * tuning.spin;
      root.rotation.x = Math.sin(t * 0.22) * 0.04;
      root.position.y = Math.sin(t * tuning.breatheSpeed * 0.65) * 0.015;

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      for (const edge of edges) {
        edge.tube.geometry.dispose();
        (edge.tube.material as THREE.Material).dispose();
        edge.core.geometry.dispose();
        (edge.core.material as THREE.Material).dispose();
        (edge.pulse.material as THREE.Material).dispose();
      }
      for (const node of nodes) {
        node.mesh.geometry.dispose();
        (node.mesh.material as THREE.Material).dispose();
        (node.glow.material as THREE.Material).dispose();
      }
      moteGeo.dispose();
      moteMat.dispose();
      (aura.material as THREE.Material).dispose();
      glowMap.dispose();
      pulseMap.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative size-full touch-none bg-transparent [&_canvas]:bg-transparent", className)}
      role="img"
      aria-label="AI Facilitator engine — phòng agent với knowledge graph và filament sống"
    />
  );
}

const FALLBACK_STATE: Record<
  EngineCoreState,
  { hub: string; ring: string; glow: string }
> = {
  idle: { hub: "#ea580c", ring: "#0ea5e9", glow: "#ea580c44" },
  listening: { hub: "#ea580c", ring: "#fde047", glow: "#ea580c66" },
  processing: { hub: "#ea580c", ring: "#334155", glow: "#33415555" },
  "agent-speaking": { hub: "#0ea5e9", ring: "#0ea5e9", glow: "#0ea5e966" },
};

export function RoomEngineCoreFallback({ state, className }: RoomEngineCoreProps) {
  const tone = FALLBACK_STATE[state];
  const loop = ENGINE_NODES.filter((n) => n.shell === 1);

  return (
    <div
      className={cn("relative grid place-items-center overflow-visible bg-transparent", className)}
      role="img"
      aria-label="AI Facilitator engine — knowledge graph tĩnh (reduced motion)"
    >
      <div
        className="absolute inset-[22%] rounded-full blur-3xl transition-[background] duration-700 ease-out"
        style={{ background: tone.glow }}
        aria-hidden
      />
      <svg viewBox="0 0 200 200" className="relative size-[92%] bg-transparent" aria-hidden>
        {loop.map((sat, i) => {
          const a = (i / loop.length) * Math.PI * 2 - Math.PI / 2;
          const x = 100 + Math.cos(a) * 52;
          const y = 100 + Math.sin(a) * 52;
          const na = ((i + 1) / loop.length) * Math.PI * 2 - Math.PI / 2;
          const nx = 100 + Math.cos(na) * 52;
          const ny = 100 + Math.sin(na) * 52;
          return (
            <g key={sat.id}>
              <path
                d={`M100 100 Q ${(100 + x) / 2} ${(100 + y) / 2 - 14} ${x} ${y}`}
                fill="none"
                stroke={sat.color}
                strokeWidth="3"
                strokeOpacity="0.55"
                strokeLinecap="round"
              />
              <path
                d={`M${x} ${y} Q ${(x + nx) / 2} ${(y + ny) / 2 - 10} ${nx} ${ny}`}
                fill="none"
                stroke={tone.ring}
                strokeWidth="2.2"
                strokeOpacity="0.45"
                strokeLinecap="round"
              />
              <circle cx={x} cy={y} r="14" fill={sat.color} opacity="0.22" />
              <circle cx={x} cy={y} r="8" fill={sat.color} opacity="0.95" />
            </g>
          );
        })}
        <circle cx="100" cy="100" r="32" fill={tone.hub} opacity="0.18" />
        <circle cx="100" cy="100" r="18" fill={tone.hub} />
      </svg>
    </div>
  );
}
