import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { generate3DGeometryData } from '../cv/engine.ts';
import type { ProcessOptions, MaterialPreset, MeshMode, ManufacturingProduct } from '../types/index.ts';
import {
  RotateCcw,
  Compass,
  Eye,
  Scissors,
  Ruler,
  Maximize2,
} from 'lucide-react';

interface ThreeCanvasProps {
  heightfield: number[][]; // [y][x] normalized 0..1
  options: ProcessOptions;
  product: ManufacturingProduct;
  blueprintUrl?: string;
  normalMapUrl?: string;
  isProcessing?: boolean;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  heightfield,
  options,
  product,
  blueprintUrl,
  normalMapUrl,
  isProcessing = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const activeMeshRef = useRef<THREE.Mesh | THREE.Points | null>(null);
  const dimensionGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
  const clipPlaneRef = useRef<THREE.Plane | null>(null);
  const clipHelperRef = useRef<THREE.PlaneHelper | null>(null);

  const blueprintTextureRef = useRef<THREE.Texture | null>(null);
  const normalTextureRef = useRef<THREE.Texture | null>(null);

  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [sliceEnabled, setSliceEnabled] = useState<boolean>(false);
  const [sliceOffset, setSliceOffset] = useState<number>(0);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const wireframeRef = useRef(wireframe);
  wireframeRef.current = wireframe;

  // Initialize Three.js scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.003);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(75, -85, 80);
    camera.lookAt(0, 0, 15);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.minDistance = 25;
    controls.maxDistance = 350;
    controls.target.set(0, 0, 15);
    controlsRef.current = controls;

    // RoomEnvironment reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio 3-point lighting rig
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.4);
    keyLight.position.set(70, -70, 110);
    if (!isHeadless) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      const d = 80;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9bc5ff, 1.4);
    fillLight.position.set(-80, 60, 70);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0xe8f0ff, 0x111827, 0.9);
    scene.add(hemiLight);

    // Contact ground shadow plane
    const groundGeo = new THREE.PlaneGeometry(280, 280);
    const groundMat = new THREE.ShadowMaterial({
      opacity: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.z = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Engineering turntable grid
    const grid = new THREE.GridHelper(200, 20, 0x0284c7, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.04;
    scene.add(grid);

    const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    clipPlaneRef.current = clipPlane;

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    const dimensionGroup = new THREE.Group();
    scene.add(dimensionGroup);
    dimensionGroupRef.current = dimensionGroup;

    textureLoaderRef.current = new THREE.TextureLoader();

    // Render loop
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotateRef.current) {
        meshGroup.rotation.z += delta * 0.35;
        dimensionGroup.rotation.z += delta * 0.35;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update textures
  useEffect(() => {
    if (!textureLoaderRef.current) return;

    if (blueprintUrl) {
      textureLoaderRef.current.load(blueprintUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        blueprintTextureRef.current = tex;
        updateMeshMaterial();
      });
    }

    if (normalMapUrl) {
      textureLoaderRef.current.load(normalMapUrl, (tex) => {
        tex.colorSpace = THREE.NoColorSpace;
        normalTextureRef.current = tex;
        updateMeshMaterial();
      });
    }
  }, [blueprintUrl, normalMapUrl]);

  // Create PBR materials
  const createMaterial = useCallback(
    (preset: MaterialPreset): THREE.Material => {
      const isWire = wireframeRef.current;
      const clippingPlanes = sliceEnabled && clipPlaneRef.current ? [clipPlaneRef.current] : [];

      if (isWire) {
        return new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          wireframe: true,
          clippingPlanes,
          clipShadows: true,
        });
      }

      switch (preset) {
        case 'cnc_aluminum':
          return new THREE.MeshPhysicalMaterial({
            color: 0xd8e1ea,
            metalness: 0.9,
            roughness: 0.22,
            clearcoat: 0.25,
            clearcoatRoughness: 0.15,
            normalMap: normalTextureRef.current,
            normalScale: new THREE.Vector2(0.5, 0.5),
            clippingPlanes,
            clipShadows: true,
          });

        case 'machined_steel':
          return new THREE.MeshPhysicalMaterial({
            color: 0x94a3b8,
            metalness: 0.98,
            roughness: 0.14,
            clearcoat: 0.4,
            normalMap: normalTextureRef.current,
            normalScale: new THREE.Vector2(0.6, 0.6),
            clippingPlanes,
            clipShadows: true,
          });

        case 'cast_iron':
          return new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.6,
            roughness: 0.65,
            normalMap: normalTextureRef.current,
            clippingPlanes,
            clipShadows: true,
          });

        case 'brass_bronze':
          return new THREE.MeshPhysicalMaterial({
            color: 0xdf9e38,
            metalness: 0.85,
            roughness: 0.28,
            clearcoat: 0.2,
            normalMap: normalTextureRef.current,
            clippingPlanes,
            clipShadows: true,
          });

        case 'cad_hologram':
          return new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            wireframe: false,
            transparent: true,
            opacity: 0.78,
            roughness: 0.1,
            metalness: 0.9,
            emissive: new THREE.Color(0x0284c7),
            emissiveIntensity: 0.5,
            clippingPlanes,
            clipShadows: true,
          });

        case 'blueprint_texture':
        default:
          return new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: blueprintTextureRef.current || null,
            normalMap: normalTextureRef.current || null,
            roughness: 0.35,
            metalness: 0.2,
            clippingPlanes,
            clipShadows: true,
          });
      }
    },
    [sliceEnabled]
  );

  const updateMeshMaterial = useCallback(() => {
    if (!activeMeshRef.current) return;
    const mesh = activeMeshRef.current;
    if (mesh instanceof THREE.Mesh) {
      mesh.material = createMaterial(options.materialPreset);
      mesh.material.needsUpdate = true;
    }
  }, [createMaterial, options.materialPreset]);

  // Update 3D Geometry
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup || !heightfield || heightfield.length === 0) return;

    while (meshGroup.children.length > 0) {
      const child = meshGroup.children[0];
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      meshGroup.remove(child);
    }

    const gridH = heightfield.length;
    const gridW = heightfield[0].length;
    const flatDepth = new Float32Array(gridW * gridH);

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        flatDepth[y * gridW + x] = heightfield[y][x];
      }
    }

    if (options.meshMode === 'point_cloud') {
      const extentX = 100;
      const extentY = (100 * gridH) / gridW;
      const zScale = options.depthScale * 35.0;
      const count = gridW * gridH;

      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let y = 0; y < gridH; y++) {
        const v = y / (gridH - 1);
        const posY = (1 - v) * extentY - extentY / 2;
        for (let x = 0; x < gridW; x++) {
          const u = x / (gridW - 1);
          const posX = u * extentX - extentX / 2;
          const d = flatDepth[y * gridW + x];
          const posZ = d * zScale + options.baseThickness;

          const idx = (y * gridW + x) * 3;
          positions[idx] = posX;
          positions[idx + 1] = posY;
          positions[idx + 2] = posZ;

          colors[idx] = 0.2 + d * 0.7;
          colors[idx + 1] = 0.6 + d * 0.4;
          colors[idx + 2] = 1.0;
        }
      }

      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const pMat = new THREE.PointsMaterial({
        size: 1.3,
        vertexColors: true,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(pGeo, pMat);
      meshGroup.add(points);
      activeMeshRef.current = points;
      return;
    }

    const { vertices, normals, uvs, indices } = generate3DGeometryData(
      flatDepth,
      gridW,
      gridH,
      options
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox();

    const material = createMaterial(options.materialPreset);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    meshGroup.add(mesh);
    activeMeshRef.current = mesh;
  }, [heightfield, options, createMaterial]);

  // Dimension lines overlay
  useEffect(() => {
    const dimGroup = dimensionGroupRef.current;
    if (!dimGroup) return;

    while (dimGroup.children.length > 0) {
      const child = dimGroup.children[0];
      if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
      dimGroup.remove(child);
    }

    if (!showDimensions) return;

    const { outerDiameterMm, boreDiameterMm, totalHeightMm } = product.specifications;
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const textMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // 1. Outer Diameter line (along X axis at bottom)
    const odPoints = [
      new THREE.Vector3(-50, -56, 4),
      new THREE.Vector3(50, -56, 4),
    ];
    const odGeo = new THREE.BufferGeometry().setFromPoints(odPoints);
    const odLine = new THREE.Line(odGeo, lineMat);
    dimGroup.add(odLine);

    // 2. Total Height Line (along Z axis)
    const zTop = options.depthScale * 35.0 + options.baseThickness;
    const hPoints = [
      new THREE.Vector3(56, 0, 0),
      new THREE.Vector3(56, 0, zTop),
    ];
    const hGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
    const hLine = new THREE.Line(hGeo, lineMat);
    dimGroup.add(hLine);

    // Dimension tick arrows
    const tickMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const coneGeo = new THREE.ConeGeometry(1.2, 4, 8);

    const arrow1 = new THREE.Mesh(coneGeo, tickMat);
    arrow1.position.set(-50, -56, 4);
    arrow1.rotation.z = Math.PI / 2;
    dimGroup.add(arrow1);

    const arrow2 = new THREE.Mesh(coneGeo, tickMat);
    arrow2.position.set(50, -56, 4);
    arrow2.rotation.z = -Math.PI / 2;
    dimGroup.add(arrow2);

    const arrowH1 = new THREE.Mesh(coneGeo, tickMat);
    arrowH1.position.set(56, 0, 0);
    arrowH1.rotation.x = Math.PI;
    dimGroup.add(arrowH1);

    const arrowH2 = new THREE.Mesh(coneGeo, tickMat);
    arrowH2.position.set(56, 0, zTop);
    dimGroup.add(arrowH2);
  }, [showDimensions, product, options.depthScale, options.baseThickness]);

  // Clipping plane updates
  useEffect(() => {
    if (clipPlaneRef.current) {
      clipPlaneRef.current.constant = sliceOffset;
    }
  }, [sliceOffset]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (sliceEnabled) {
      if (!clipHelperRef.current && clipPlaneRef.current) {
        const helper = new THREE.PlaneHelper(clipPlaneRef.current, 110, 0x38bdf8);
        scene.add(helper);
        clipHelperRef.current = helper;
      }
    } else {
      if (clipHelperRef.current) {
        scene.remove(clipHelperRef.current);
        clipHelperRef.current.dispose();
        clipHelperRef.current = null;
      }
    }
    updateMeshMaterial();
  }, [sliceEnabled, updateMeshMaterial]);

  // Camera presets
  const setCameraView = (view: 'isometric' | 'top' | 'front' | 'side') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    controls.target.set(0, 0, 15);
    switch (view) {
      case 'top':
        camera.position.set(0, 0, 150);
        break;
      case 'front':
        camera.position.set(0, -130, 20);
        break;
      case 'side':
        camera.position.set(130, 0, 20);
        break;
      case 'isometric':
      default:
        camera.position.set(75, -85, 80);
        break;
    }
    camera.lookAt(0, 0, 15);
    controls.update();
  };

  const resetView = () => {
    if (meshGroupRef.current) meshGroupRef.current.rotation.set(0, 0, 0);
    if (dimensionGroupRef.current) dimensionGroupRef.current.rotation.set(0, 0, 0);
    setCameraView('isometric');
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        data-testid="three-canvas-viewport"
      />

      {isProcessing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm pointer-events-none transition-opacity">
          <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-slate-900 border border-cyan-500/30 shadow-2xl">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-cyan-300 tracking-wide">
              Reconstructing 3D Manufacturing Geometry...
            </span>
          </div>
        </div>
      )}

      {/* Top Floating Viewport HUD: Camera Controls & View Presets */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center bg-slate-900/90 border border-slate-700/60 rounded-lg p-0.5 shadow-lg backdrop-blur">
            <button
              onClick={() => setCameraView('isometric')}
              className="px-2 py-1 text-[11px] font-semibold rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="45° Isometric CAD view"
            >
              45° Iso
            </button>
            <button
              onClick={() => setCameraView('front')}
              className="px-2 py-1 text-[11px] font-semibold rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="0° Front Elevation view"
            >
              0° Front
            </button>
            <button
              onClick={() => setCameraView('top')}
              className="px-2 py-1 text-[11px] font-semibold rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="90° Top Plan view"
            >
              90° Top
            </button>
            <button
              onClick={() => setCameraView('side')}
              className="px-2 py-1 text-[11px] font-semibold rounded text-slate-300 hover:text-white hover:bg-slate-800 transition hidden sm:inline-block"
              title="90° Side Profile view"
            >
              90° Side
            </button>
          </div>

          <button
            onClick={resetView}
            className="p-1.5 bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-lg"
            title="Reset Camera & Rotation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top-Right Tools */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-2.5 py-1 flex items-center gap-1 rounded-lg border text-[11px] font-medium transition shadow-lg ${
              showDimensions
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-900/90 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title="Toggle 3D Dimension Overlays"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dimensions</span>
          </button>

          <button
            onClick={() => setSliceEnabled(!sliceEnabled)}
            className={`px-2.5 py-1 flex items-center gap-1 rounded-lg border text-[11px] font-medium transition shadow-lg ${
              sliceEnabled
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900/90 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title="Cross-Section Slicing Tool"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Section Cut</span>
          </button>

          <button
            onClick={() => {
              setWireframe(!wireframe);
              setTimeout(updateMeshMaterial, 10);
            }}
            className={`px-2.5 py-1 flex items-center gap-1 rounded-lg border text-[11px] font-medium transition shadow-lg ${
              wireframe
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900/90 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title="Toggle Wireframe CAD overlay"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wireframe</span>
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1 flex items-center gap-1 rounded-lg border text-[11px] font-medium transition shadow-lg ${
              autoRotate
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900/90 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title="Toggle Turntable Rotation"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Turntable</span>
          </button>
        </div>
      </div>

      {/* Slicing plane interactive slider banner */}
      {sliceEnabled && (
        <div className="absolute top-16 right-4 z-10 w-72 bg-slate-900/95 border border-cyan-500/40 rounded-xl p-3 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span className="font-semibold text-cyan-300 flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5" /> Cross-Section Slicer
            </span>
            <span className="font-mono text-cyan-400">{sliceOffset} mm</span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={sliceOffset}
            onChange={(e) => setSliceOffset(Number(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>-50 mm</span>
            <span>Center (0)</span>
            <span>+50 mm</span>
          </div>
        </div>
      )}

      {/* Mechanical Dimensions Callout HUD */}
      {showDimensions && (
        <div className="absolute bottom-28 left-4 z-10 bg-slate-900/95 border border-amber-500/40 rounded-xl p-3 text-xs text-slate-300 shadow-xl backdrop-blur max-w-sm">
          <div className="font-bold text-amber-400 mb-1.5 flex items-center gap-1.5">
            <Ruler className="w-4 h-4" /> CAD Engineering Specifications
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700/60">
              <span className="text-slate-400 block text-[9px]">OUTER FLANGE DIA</span>
              <span className="text-white font-bold">
                Ø {product.specifications.outerDiameterMm}.00 mm
              </span>
            </div>
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700/60">
              <span className="text-slate-400 block text-[9px]">INTERNAL BORE DIA</span>
              <span className="text-cyan-400 font-bold">
                Ø {product.specifications.boreDiameterMm}.00 mm
              </span>
            </div>
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700/60">
              <span className="text-slate-400 block text-[9px]">TOTAL 3D HEIGHT (Z)</span>
              <span className="text-emerald-400 font-bold">
                {(options.depthScale * 35.0 + options.baseThickness).toFixed(1)} mm
              </span>
            </div>
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700/60">
              <span className="text-slate-400 block text-[9px]">TOLERANCE & SPEC</span>
              <span className="text-slate-200 font-bold">
                {product.specifications.tolerance}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
