"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import ThreeForceGraph from "three-forcegraph";

import {
  linkTouchesSelection,
  resolveGraphNodeColor,
  resolveGraphNodeVal,
  resolveLinkColor,
  resolveLinkParticleColor,
  resolveLinkParticles,
} from "../data/room-graph-palette";
import type { RoomGraphData, RoomGraphLink, RoomGraphNode } from "../data/room-graph-types";

type RoomKnowledgeGraphProps = {
  data: RoomGraphData;
  selectedNodeId: string | null;
  focusPhaseKey?: string | null;
  liveParticles?: boolean;
  onNodeSelect: (node: RoomGraphNode | null) => void;
};

const NODE_REL_SIZE = 3;

function createSelectedGlow(node: RoomGraphNode, selectedId: string | null) {
  if (node.id !== selectedId) return false as unknown as THREE.Object3D;

  const radius = Math.cbrt(resolveGraphNodeVal(node, selectedId)) * NODE_REL_SIZE;
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.42, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xea580c,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    })
  );
}

function findClosestNode(
  nodes: RoomGraphNode[],
  camera: THREE.PerspectiveCamera,
  pointer: THREE.Vector2
) {
  const projected = new THREE.Vector3();
  let closest: RoomGraphNode | null = null;
  let minDist = Infinity;

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    projected.set(node.x, node.y, node.z ?? 0).project(camera);
    const dx = projected.x - pointer.x;
    const dy = projected.y - pointer.y;
    const dist = dx * dx + dy * dy;
    if (dist < minDist && dist < 0.016) {
      minDist = dist;
      closest = node;
    }
  }

  return closest;
}

function applyGraphSelectionStyle(
  graph: ThreeForceGraph<RoomGraphNode, RoomGraphLink>,
  selectedId: string | null,
  liveParticles: boolean,
  nodes: RoomGraphNode[]
) {
  graph
    .nodeVal((node) => resolveGraphNodeVal(node, selectedId))
    .nodeColor((node) => resolveGraphNodeColor(node, selectedId))
    .nodeThreeObject((node) => createSelectedGlow(node, selectedId))
    .nodeThreeObjectExtend(true)
    .linkColor((link) => resolveLinkColor(link, selectedId))
    .linkWidth((link) => (linkTouchesSelection(link, selectedId) ? 0.8 : 0))
    .linkDirectionalParticles((link) => resolveLinkParticles(link, selectedId, liveParticles))
    .linkDirectionalParticleColor((link) =>
      resolveLinkParticleColor(link, selectedId, nodes)
    )
    .refresh();
}

export function RoomKnowledgeGraph({
  data,
  selectedNodeId,
  focusPhaseKey = null,
  liveParticles = false,
  onNodeSelect,
}: RoomKnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ThreeForceGraph<RoomGraphNode, RoomGraphLink> | null>(null);
  const selectedRef = useRef(selectedNodeId);
  const liveRef = useRef(liveParticles);
  const onNodeSelectRef = useRef(onNodeSelect);

  selectedRef.current = selectedNodeId;
  liveRef.current = liveParticles;
  onNodeSelectRef.current = onNodeSelect;

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const nodes = graph.graphData().nodes as RoomGraphNode[];
    applyGraphSelectionStyle(graph, selectedRef.current, liveRef.current, nodes);
  }, [selectedNodeId, focusPhaseKey, liveParticles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const nodeCount = data.nodes.length;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaf7f2);

    const graph = new ThreeForceGraph<RoomGraphNode, RoomGraphLink>()
      .graphData(data)
      .numDimensions(3)
      .nodeId("id")
      .nodeVal((node) => resolveGraphNodeVal(node, selectedRef.current))
      .nodeRelSize(NODE_REL_SIZE)
      .nodeOpacity(0.92)
      .nodeResolution(8)
      .nodeColor((node) => resolveGraphNodeColor(node, selectedRef.current))
      .nodeThreeObject((node) => createSelectedGlow(node, selectedRef.current))
      .nodeThreeObjectExtend(true)
      .linkColor((link) => resolveLinkColor(link, selectedRef.current))
      .linkOpacity(0.85)
      .linkWidth((link) =>
        linkTouchesSelection(link, selectedRef.current) ? 0.8 : 0
      )
      .linkDirectionalParticles((link) =>
        resolveLinkParticles(link, selectedRef.current, liveRef.current)
      )
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleWidth(1.4)
      .linkDirectionalParticleColor((link) =>
        resolveLinkParticleColor(
          link,
          selectedRef.current,
          data.nodes as RoomGraphNode[]
        )
      )
      .d3AlphaDecay(0.0228)
      .d3VelocityDecay(0.4)
      .warmupTicks(100)
      .cooldownTicks(Infinity);

    const chargeForce = graph.d3Force("charge");
    if (chargeForce && typeof chargeForce.strength === "function") {
      chargeForce.strength(-52);
    }
    const linkForce = graph.d3Force("link");
    if (linkForce && typeof linkForce.distance === "function") {
      linkForce.distance(36);
    }

    graphRef.current = graph;
    scene.add(graph);
    scene.add(new THREE.AmbientLight(0xcccccc, Math.PI));

    const camera = new THREE.PerspectiveCamera();
    camera.near = 0.1;
    camera.far = 10000;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.position.z = Math.cbrt(nodeCount) * 180;

    const controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 2;
    controls.zoomSpeed = 1.2;
    controls.noZoom = false;
    controls.noPan = false;

    let initialFitDone = false;
    graph.onEngineStop(() => {
      if (initialFitDone) return;
      initialFitDone = true;
      const bbox = graph.getGraphBbox();
      if (!bbox) return;
      const maxDim = Math.max(
        bbox.x[1] - bbox.x[0],
        bbox.y[1] - bbox.y[0],
        bbox.z[1] - bbox.z[0],
        60
      );
      camera.position.set(0, 0, maxDim * 1.8);
      camera.lookAt(0, 0, 0);
      controls.update();
    });

    const pointer = new THREE.Vector2();
    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const nodes = graph.graphData().nodes as RoomGraphNode[];
      const hit = findClosestNode(nodes, camera, pointer);
      onNodeSelectRef.current(hit);
    };

    renderer.domElement.addEventListener("click", onClick);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      graph.tickFrame();
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    return () => {
      graphRef.current = null;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [data]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 h-full w-full touch-none overflow-hidden"
      role="img"
      aria-label="Knowledge graph 3D — các node theo phase brainstorm"
    />
  );
}
