"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { Box3, Group, Vector3 } from "three";

type Framing = "portrait" | "headshot" | "full";
type Mood = "happy" | "neutral" | "sad" | "excited";

interface VRMModelProps {
  url: string;
  mood?: Mood;
  framing?: Framing;
}

function VRMModel({ url, mood = "neutral" }: VRMModelProps) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const vrmRef = useRef<VRM | null>(null);
  const clockRef = useRef(0);
  const rootRef = useRef<Group | null>(null);

  // Compute auto-frame transform + do one-time VRM prep (pure computation from gltf).
  // useLoader suspends until gltf is ready so this memo is safe.
  const { autoTransform, vrm } = useMemo(() => {
    const v: VRM | undefined = (gltf as unknown as { userData: { vrm?: VRM } }).userData.vrm;
    if (!v) return { autoTransform: null, vrm: null };

    VRMUtils.removeUnnecessaryVertices(v.scene);
    VRMUtils.combineSkeletons(v.scene);
    VRMUtils.combineMorphs(v);

    // VRM spec says +Z is the model's front; three.js default camera at +Z
    // already looks at the front, so no rotation needed.
    v.scene.traverse((obj) => { obj.frustumCulled = false; });

    v.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(v.scene);
    const size = new Vector3();
    box.getSize(size);
    // Normalize so the larger dimension (height or width) is 1.0 unit,
    // then center the bbox at origin. This handles both tall humanoids
    // and wide animal/chibi models consistently.
    const nativeSize = Math.max(size.y, size.x, 0.01);
    const scale = 1.0 / nativeSize;
    const centerY = (box.min.y + box.max.y) / 2;
    const offsetY = -centerY * scale;
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log(`[VRM] ${url.split("/").pop()} bbox=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)} → scale=${scale.toFixed(2)} offsetY=${offsetY.toFixed(2)}`);
    }
    return { autoTransform: { y: offsetY, scale }, vrm: v };
  }, [gltf, url]);

  // Keep a stable ref so useFrame can see the vrm; dispose when it changes
  useEffect(() => {
    vrmRef.current = vrm;
    const current = vrm;
    return () => {
      if (current) VRMUtils.deepDispose(current.scene);
    };
  }, [vrm]);

  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm?.expressionManager) return;
    const em = vrm.expressionManager;
    const setSafely = (name: string, v: number) => { try { em.setValue(name, v); } catch {} };
    ["happy", "angry", "sad", "relaxed", "surprised", "neutral"].forEach((n) => setSafely(n, 0));
    switch (mood) {
      case "happy":    setSafely("happy", 0.8); break;
      case "excited":  setSafely("happy", 1); setSafely("surprised", 0.4); break;
      case "sad":      setSafely("sad", 0.8); break;
      default:         setSafely("relaxed", 0.5);
    }
    em.update();
  }, [mood]);

  useFrame((_, delta) => {
    clockRef.current += delta;
    const vrm = vrmRef.current;
    if (!vrm || !autoTransform) return;
    const t = clockRef.current;

    if (rootRef.current) {
      rootRef.current.position.y = autoTransform.y + Math.sin(t * 1.4) * 0.01;
      rootRef.current.rotation.y = Math.PI + Math.sin(t * 0.6) * 0.1;
    }

    if (vrm.expressionManager) {
      const cycle = (t % 3.5) / 3.5;
      const blink = cycle > 0.97 ? (1 - (cycle - 0.97) / 0.03) : cycle > 0.94 ? ((cycle - 0.94) / 0.03) : 0;
      try { vrm.expressionManager.setValue("blink", blink); } catch {}
      vrm.expressionManager.update();
    }

    vrm.update(delta);
  });

  if (!autoTransform) return null;
  return (
    <group ref={rootRef} position={[0, autoTransform.y, 0]} scale={autoTransform.scale} rotation={[0, Math.PI, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

interface Props {
  url: string;
  mood?: Mood;
  size?: number;
  framing?: Framing;
  fallbackEmoji?: string;
}

export default function VRMViewer({ url, mood, size, framing = "portrait", fallbackEmoji = "🐾" }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex items-center justify-center select-none"
        style={{ width: size ?? "100%", height: size ?? "100%", fontSize: Math.min((size ?? 200) * 0.6, 112) }}
      >
        {fallbackEmoji}
      </div>
    );
  }

  // Model is normalized to max dimension = 1.0, centered at origin.
  // Portrait keeps full body + ~25% padding so the pet feels like it's living
  // inside the orb rather than pressed against the glass.
  const cam = framing === "full"
    ? { pos: [0, 0, 2.8] as const, fov: 26, target: [0, 0, 0] as const }
    : framing === "headshot"
    ? { pos: [0, 0.25, 1.2] as const, fov: 24, target: [0, 0.25, 0] as const }
    : { pos: [0, 0, 2.3] as const, fov: 26, target: [0, 0, 0] as const };  // portrait (default)

  return (
    <div
      className="vrm-viewer-wrap"
      style={{ position: "relative", width: size ? `${size}px` : "100%", height: size ? `${size}px` : "100%" }}
    >
      <style>{`.vrm-viewer-wrap canvas { width: 100% !important; height: 100% !important; display: block; }`}</style>
      <ErrorBoundary onError={() => setFailed(true)}>
        <Canvas
          camera={{ position: cam.pos, fov: cam.fov, near: 0.05, far: 50 }}
          onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          dpr={[1, 2]}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <ambientLight intensity={0.95} />
          <directionalLight position={[1, 2, 1.5]} intensity={1.3} />
          <directionalLight position={[-1, 0.5, -1]} intensity={0.4} />
          <Suspense fallback={null}>
            <VRMModel url={url} mood={mood} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}
