"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

export default function Hero3D() {
  const wrapRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    /* =========================================================
     * Busy overlay (rendering...)
     * =======================================================*/
    const busy = (() => {
      const el = document.createElement("div");
      el.setAttribute("aria-live", "polite");
      el.style.position = "absolute";
      el.style.inset = "0";
      el.style.display = "grid";
      el.style.placeItems = "center";
      el.style.background = "rgba(10,12,16,0.45)";
      el.style.backdropFilter = "blur(2px)";
      el.style.transition = "opacity 150ms ease";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      el.style.zIndex = "2";

      const box = document.createElement("div");
      box.style.padding = "10px 14px";
      box.style.borderRadius = "10px";
      box.style.background = "rgba(20,24,32,0.85)";
      box.style.color = "#dbe7ff";
      box.style.font = "500 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      box.style.letterSpacing = "0.3px";
      box.style.display = "inline-flex";
      box.style.alignItems = "center";
      box.style.gap = "10px";
      box.textContent = "Rendering…";

      const dot = document.createElement("span");
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.background = "#55bbff";
      dot.style.animation = "renovaPulse 1000ms infinite ease-in-out";
      box.prepend(dot);

      const style = document.createElement("style");
      style.textContent = `
        @keyframes renovaPulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
      `;
      el.appendChild(style);
      el.appendChild(box);

      wrap.style.position = "relative";
      wrap.appendChild(el);

      let count = 0;
      const tags = new Set();
      return {
        add(tag = "render") {
          if (!tags.has(tag)) {
            tags.add(tag);
            count++;
          }
          if (count > 0) {
            el.style.opacity = "1";
            el.style.pointerEvents = "auto";
          }
        },
        remove(tag = "render") {
          if (tags.has(tag)) {
            tags.delete(tag);
            count = Math.max(0, count - 1);
          }
          if (count === 0) {
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          }
        },
        clear() {
          tags.clear();
          count = 0;
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        },
        destroy() {
          el.remove();
        }
      };
    })();

    /* =========================================================
     * Renderer
     * =======================================================*/
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    wrap.appendChild(renderer.domElement);

    /* =========================================================
     * Scene & Camera
     * =======================================================*/
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(7, 4.8, 7);
    camera.lookAt(0, 1.2, 0);

    /* =========================================================
     * Lights / Environment Map
     * =======================================================*/
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(6, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88b0ff, 0.45);
    rim.position.set(-6, 5, -4);
    scene.add(rim);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x151a22);
    const envTex = pmrem.fromScene(envScene, 0.1).texture;

    /* =========================================================
     * Root Groups
     * =======================================================*/
    const root = new THREE.Group();
    root.rotation.x = -0.12;
    scene.add(root);

    const furniture = new THREE.Group();
    root.add(furniture);

    // Grid floor
    const gridFloor = new THREE.GridHelper(16, 16, 0x60e7ff, 0x1cc6ff);
    gridFloor.material.transparent = true;
    gridFloor.material.opacity = 0.16;
    root.add(gridFloor);

    // Back/left walls as grids
    const makeWall = (size, div, color, axis) => {
      const g = new THREE.GridHelper(size, div, color, color);
      g.material.transparent = true;
      g.material.opacity = 0.08;
      if (axis === "back") {
        g.rotation.x = Math.PI / 2;
        g.position.z = -size / 2;
        g.position.y = size / 2;
      } else {
        g.rotation.z = Math.PI / 2;
        g.position.x = -size / 2;
        g.position.y = size / 2;
      }
      return g;
    };
    root.add(makeWall(16, 16, 0x9e5bff, "back"), makeWall(16, 16, 0xff9d4d, "left"));

    // Solid floor plane
    const floorSolid = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x1a2029,
        roughness: 0.85,
        metalness: 0.15,
        envMap: envTex,
        envMapIntensity: 0.35,
      })
    );
    floorSolid.rotation.x = -Math.PI / 2;
    floorSolid.position.y = 0.001;
    root.add(floorSolid);

    /* =========================================================
     * Laser Sweep
     * =======================================================*/
    const ROOM_Z = 8;

    const laserCore = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 0.14),
      new THREE.MeshBasicMaterial({
        color: 0x3aaeff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    laserCore.rotation.x = -Math.PI / 2;
    laserCore.position.y = 0.021;
    root.add(laserCore);

    const laserGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 1.8),
      new THREE.MeshBasicMaterial({
        color: 0x3aaeff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    laserGlow.rotation.x = -Math.PI / 2;
    laserGlow.position.y = 0.02;
    root.add(laserGlow);

    /* =========================================================
     * Shared Materials / Helpers
     * =======================================================*/
    const neonMat = (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.35,
        metalness: 0,
        roughness: 0.7,
        transparent: true,
        opacity: 0.12,
      });

    const solidMat = (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.5,
        metalness: 0.2,
        envMap: envTex,
        envMapIntensity: 0.5,
        transparent: true,
        opacity: 0,
        emissive: 0x000000,
        emissiveIntensity: 0,
      });

    const addEdges = (mesh, color = 0xffffff) => {
      const e = new THREE.EdgesGeometry(mesh.geometry, 0.2);
      const lines = new THREE.LineSegments(
        e,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
      );
      mesh.add(lines);
      return lines;
    };

    // neon “outline” + solid fill meshes
    function buildMultiPart(subs, color) {
      const group = new THREE.Group();
      const neons = [];
      const solids = [];
      const edges = [];

      subs.forEach(({ geo, pos = [0, 0, 0], rot = [0, 0, 0] }) => {
        const neon = new THREE.Mesh(geo, neonMat(color));
        neon.position.set(...pos);
        neon.rotation.set(...rot);
        const edge = addEdges(neon);

        const solid = new THREE.Mesh(geo.clone(), solidMat(color));
        solid.position.copy(neon.position);
        solid.rotation.copy(neon.rotation);

        neons.push(neon);
        solids.push(solid);
        edges.push(edge);
      });

      const edgesHolder = new THREE.Group();
      neons.forEach((n) => edgesHolder.add(n));

      const solidsHolder = new THREE.Group();
      solids.forEach((s) => solidsHolder.add(s));

      const holder = new THREE.Group();
      holder.add(edgesHolder, solidsHolder);
      holder.scale.setScalar(0.01);

      return { group: holder, neons, solids, edges, edgesHolder, solidsHolder };
    }

    /* =========================================================
     * OBJ Prototypes (loading once, then cloning)
     * =======================================================*/

// couch------------------------------------------
    const COUCH_TARGET_W = 3.6;
    const couchProto = { obj: null };
    new OBJLoader().load(
      "/3D/couch.obj",
      (obj) => {
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        obj.position.sub(center);
        obj.scale.setScalar(COUCH_TARGET_W / Math.max(size.x || 1, 1e-6));
        obj.traverse((ch) => {
          if (ch.isMesh) {
            ch.material = new THREE.MeshStandardMaterial({
              color: 0xcfd6df,
              roughness: 0.45,
              metalness: 0.2,
              envMap: envTex,
              envMapIntensity: 0.55,
              transparent: true,
              opacity: 0,
            });
          }
        });
        couchProto.obj = obj;
      },
      undefined,
      () => console.warn("couch.obj failed to load; primitives will remain.")
    );
    const makeCouchOBJ = () => (couchProto.obj ? couchProto.obj.clone(true) : null);
  
// tv_panel------------------------------------------
    const TV_TARGET_W = 0.2;
    const tvProto = { obj: null };
    new OBJLoader().load(
      "/3D/tv_panel.obj",
      (obj) => {
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        obj.position.sub(center);

        obj.scale.setScalar(TV_TARGET_W / Math.max(size.x || 1, 1e-6));

        obj.rotation.y += Math.PI / 2;
        obj.rotation.y += Math.PI;
        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(c2);
        }

        obj.traverse((ch) => {
          if (ch.isMesh) {
            ch.material = new THREE.MeshStandardMaterial({
              color: 0x0d1016,
              roughness: 0.6,
              metalness: 0.2,
              envMap: envTex,
              envMapIntensity: 0.5,
              transparent: true,
              opacity: 0,
            });
          }
        });
        tvProto.obj = obj;
      },
      undefined,
      () => console.warn("tv_panel.obj failed to load; keeping primitive TV.")
    );
    const makeTVOBJ = () => (tvProto.obj ? tvProto.obj.clone(true) : null);

// plant_potted------------------------------------------
    const PLANT_TARGET_H = 2;
    const plantProto = { obj: null };
    new OBJLoader().load(
      "/3D/plant_potted.obj",
      (obj) => {
        const preBox = new THREE.Box3().setFromObject(obj);
        const preSize = new THREE.Vector3();
        preBox.getSize(preSize);
        const preCtr = new THREE.Vector3();
        preBox.getCenter(preCtr);
        obj.position.sub(preCtr);
        obj.scale.setScalar(PLANT_TARGET_H / Math.max(preSize.y || 1, 1e-6));

        const postBox = new THREE.Box3().setFromObject(obj);
        obj.position.y -= postBox.min.y;
        obj.position.y += 0.005;

        const potMat = new THREE.MeshStandardMaterial({
          color: 0x8a5a3b,
          roughness: 0.85,
          metalness: 0.05,
          envMap: envTex,
          envMapIntensity: 0.25,
          transparent: true,
          opacity: 0,
        });
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x31f86e,
          roughness: 0.6,
          metalness: 0.1,
          envMap: envTex,
          envMapIntensity: 0.35,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          if (n.includes("pot") || n.includes("base") || n.includes("vase")) ch.material = potMat.clone();
          else ch.material = leafMat.clone();
        });
        plantProto.obj = obj;
      },
      undefined,
      () => console.warn("plant_potted.obj failed; keeping primitive plant.")
    );
    const makePlantOBJ = () => (plantProto.obj ? plantProto.obj.clone(true) : null);

// rug------------------------------------------
    const RUG_TARGET_W = 5.0;
    const rugProto = { obj: null };
    new OBJLoader().load(
      "/3D/rug.obj",
      (obj) => {
        const preBox = new THREE.Box3().setFromObject(obj);
        const preSize = new THREE.Vector3();
        preBox.getSize(preSize);
        const preCtr = new THREE.Vector3();
        preBox.getCenter(preCtr);
        obj.position.sub(preCtr);
        obj.scale.setScalar(RUG_TARGET_W / Math.max(preSize.x || 1, 1e-6));
        obj.rotation.x = -Math.PI / 2;
        const postBox = new THREE.Box3().setFromObject(obj);
        obj.position.y -= postBox.min.y;
        obj.position.y += 0.002;
        obj.traverse((ch) => {
          if (ch.isMesh) {
            ch.material = new THREE.MeshStandardMaterial({
              color: 0x3b3f49,
              roughness: 0.9,
              metalness: 0.05,
              envMap: envTex,
              envMapIntensity: 0.2,
              transparent: true,
              opacity: 0,
            });
          }
        });
        rugProto.obj = obj;
      },
      undefined,
      () => console.warn("rug.obj failed; keeping primitive carpet.")
    );
    const makeRugOBJ = () => (rugProto.obj ? rugProto.obj.clone(true) : null);

// coffee_table------------------------------------------
    const CTABLE_TARGET_W = 1.1;
    const coffeeTableProto = { obj: null };
    new OBJLoader().load(
      "/3D/coffee_table.obj",
      (obj) => {
        const preBox = new THREE.Box3().setFromObject(obj);
        const preSize = new THREE.Vector3();
        preBox.getSize(preSize);
        const preCtr = new THREE.Vector3();
        preBox.getCenter(preCtr);
        obj.position.sub(preCtr);
        obj.scale.setScalar(CTABLE_TARGET_W / Math.max(preSize.x || 1, 1e-6));
        obj.rotation.x = -Math.PI / 2;
        const post = new THREE.Box3().setFromObject(obj);
        obj.position.y -= post.min.y;
        obj.position.y += 0.005;
        obj.traverse((ch) => {
          if (ch.isMesh) {
            ch.material = new THREE.MeshStandardMaterial({
              color: 0xa47148,
              roughness: 0.6,
              metalness: 0.15,
              envMap: envTex,
              envMapIntensity: 0.45,
              transparent: true,
              opacity: 0,
            });
          }
        });
        coffeeTableProto.obj = obj;
      },
      undefined,
      () => console.warn("coffee_table.obj failed; keeping primitive table.")
    );
    const makeCoffeeTableOBJ = () => (coffeeTableProto.obj ? coffeeTableProto.obj.clone(true) : null);

// TV_stand------------------------------------------
    const TVSTAND_TARGET_W = 2.0;
    const tvStandProto = { obj: null };
    new OBJLoader().load(
      "/3D/TV_stand.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        pre.getSize(size);
        const ctr = new THREE.Vector3();
        pre.getCenter(ctr);
        obj.position.sub(ctr);

        const horiz = Math.max(size.x, size.z);
        obj.scale.setScalar(TVSTAND_TARGET_W / Math.max(horiz || 1, 1e-6));

        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(c2);
        }

        {
          const post2 = new THREE.Box3().setFromObject(obj);
          obj.position.y -= post2.min.y;
          obj.position.y += 0.005;
        }

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          ch.material = new THREE.MeshStandardMaterial({
            color: 0xa47148,
            roughness: 2,
            metalness: 0.12,
            envMap: envTex,
            envMapIntensity: 0.4,
            transparent: true,
            opacity: 0,
          });
        });

        tvStandProto.obj = obj;
      },
      undefined,
      () => console.warn("TV_stand.obj failed to load; keeping primitive stand.")
    );
    const makeTVStandOBJ = () => (tvStandProto.obj ? tvStandProto.obj.clone(true) : null);

// Bed&bed_platform------------------------------------------
    const BED_TARGET_W = 2.0;
    const bedProto = { obj: null };
    new OBJLoader().load(
      "/3D/Bed%26bed_platform.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        pre.getSize(size);
        const ctr = new THREE.Vector3();
        pre.getCenter(ctr);
        obj.position.sub(ctr);

        const horiz = Math.max(size.x, size.z);
        const scale = BED_TARGET_W / Math.max(horiz || 1, 1e-6);
        obj.scale.setScalar(scale);

        obj.rotation.x = -Math.PI / 2;

        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(new THREE.Vector3(c2.x, 0, c2.z));
          obj.position.y -= post.min.y;
          obj.position.y += 0.003;
        }

        const woodMat = new THREE.MeshStandardMaterial({
          color: 0xa47148,
          roughness: 0.65,
          metalness: 0.12,
          envMap: envTex,
          envMapIntensity: 0.4,
          transparent: true,
          opacity: 0,
        });
        const fabricMat = new THREE.MeshStandardMaterial({
          color: 0xe4e7eb,
          roughness: 0.85,
          metalness: 0.05,
          envMap: envTex,
          envMapIntensity: 0.25,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          if (n.includes("frame") || n.includes("base") || n.includes("platform") || n.includes("wood"))
            ch.material = woodMat.clone();
          else ch.material = fabricMat.clone();
        });

        bedProto.obj = obj;
      },
      undefined,
      () => console.warn("Bed&bed_platform.obj failed; keeping primitive bed.")
    );
    function makeBedOBJ() {
      if (!bedProto.obj) return null;
      const inst = bedProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// shelf_unit------------------------------------------
    const SHELF_TARGET_W = 1.8;
    const shelfProto = { obj: null };
    new OBJLoader().load(
      "/3D/shelf_unit.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const s = new THREE.Vector3();
        pre.getSize(s);
        const c = new THREE.Vector3();
        pre.getCenter(c);
        obj.position.sub(c);

        obj.scale.setScalar(SHELF_TARGET_W / Math.max(s.x || 1, 1e-6));
        obj.rotation.x = Math.PI / -2;

        const post = new THREE.Box3().setFromObject(obj);
        obj.position.y -= post.min.y;
        obj.position.y += 0.005;

        const woodMat = new THREE.MeshStandardMaterial({
          color: 0xa47148,
          roughness: 0.65,
          metalness: 0.12,
          envMap: envTex,
          envMapIntensity: 0.4,
          transparent: true,
          opacity: 0,
        });
        const metalMat = new THREE.MeshStandardMaterial({
          color: 0x9aa3ad,
          roughness: 0.35,
          metalness: 0.55,
          envMap: envTex,
          envMapIntensity: 0.6,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          ch.material = n.includes("frame") || n.includes("metal") || n.includes("leg") || n.includes("rod")
            ? metalMat.clone()
            : woodMat.clone();
        });
        shelfProto.obj = obj;
      },
      undefined,
      () => console.warn("shelf_unit.obj failed; keeping primitive shelf.")
    );
    const makeShelfOBJ = () => (shelfProto.obj ? shelfProto.obj.clone(true) : null);

// Round_Carpet------------------------------------------
    const ROUND_RUG_TARGET_D = 3.8;
    const roundCarpetProto = { obj: null };
    new OBJLoader().load(
      "/3D/Round_Carpet.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const c = pre.getCenter(new THREE.Vector3());
        obj.position.sub(c);

        const post1 = new THREE.Box3().setFromObject(obj);
        const dx = post1.max.x - post1.min.x;
        const dz = post1.max.z - post1.min.z;
        const span = Math.max(dx, dz) || 1;
        obj.scale.setScalar(ROUND_RUG_TARGET_D / span);

        const post2 = new THREE.Box3().setFromObject(obj);
        obj.position.y -= post2.min.y;
        obj.position.y += 0.002;

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          ch.material = new THREE.MeshStandardMaterial({
            color: 0x3b3f49,
            roughness: 0.9,
            metalness: 0.05,
            envMap: envTex,
            envMapIntensity: 0.2,
            transparent: true,
            opacity: 0,
          });
        });

        roundCarpetProto.obj = obj;
      },
      undefined,
      () => console.warn("Round_Carpet.obj failed; keeping rectangular rug in living room.")
    );
    function makeRoundCarpetOBJ() {
      if (!roundCarpetProto.obj) return null;
      const inst = roundCarpetProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// desk------------------------------------------
    const DESK_TARGET_W = 1.8;
    const deskProto = { obj: null };
    new OBJLoader().load(
      "/3D/desk.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const s = new THREE.Vector3();
        pre.getSize(s);
        const c = new THREE.Vector3();
        pre.getCenter(c);
        obj.position.sub(c);

        const horiz = Math.max(s.x, s.z);
        obj.scale.setScalar(DESK_TARGET_W / Math.max(horiz || 1, 1e-6));

        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(c2);
          const minY = post.min.y;
          obj.position.y -= minY;
          obj.position.y += 0.005;
        }

        const woodMat = new THREE.MeshStandardMaterial({
          color: 0xa47148,
          roughness: 0.6,
          metalness: 0.15,
          envMap: envTex,
          envMapIntensity: 0.45,
          transparent: true,
          opacity: 0,
        });
        const metalMat = new THREE.MeshStandardMaterial({
          color: 0x9aa3ad,
          roughness: 0.35,
          metalness: 0.55,
          envMap: envTex,
          envMapIntensity: 0.6,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          if (n.includes("leg") || n.includes("metal") || n.includes("frame")) ch.material = metalMat.clone();
          else ch.material = woodMat.clone();
        });

        deskProto.obj = obj;
      },
      undefined,
      () => console.warn("desk.obj failed to load; keeping primitive desk.")
    );
    function makeDeskOBJ() {
      if (!deskProto.obj) return null;
      const inst = deskProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// bed_table------------------------------------------
    const BTARGET_W = 0.55;
    const bedTableProto = { obj: null };
    new OBJLoader().load(
      "/3D/bed_table.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        pre.getSize(size);
        const ctr = new THREE.Vector3();
        pre.getCenter(ctr);
        obj.position.sub(ctr);

        const horiz = Math.max(size.x, size.z);
        obj.scale.setScalar(BTARGET_W / Math.max(horiz || 1, 1e-6));

        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(new THREE.Vector3(c2.x, 0, c2.z));
          obj.position.y -= post.min.y;
          obj.position.y += 0.003;
        }

        const woodMat = new THREE.MeshStandardMaterial({
          color: 0xa47148,
          roughness: 0.65,
          metalness: 0.12,
          envMap: envTex,
          envMapIntensity: 0.35,
          transparent: true,
          opacity: 0,
        });
        const metalMat = new THREE.MeshStandardMaterial({
          color: 0x9aa3ad,
          roughness: 0.35,
          metalness: 0.55,
          envMap: envTex,
          envMapIntensity: 0.6,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          ch.material =
            n.includes("handle") || n.includes("knob") || n.includes("hinge") || n.includes("metal")
              ? metalMat.clone()
              : woodMat.clone();
        });

        bedTableProto.obj = obj;
      },
      undefined,
      () => console.warn("bed_table.obj failed; keeping primitive bedside tables.")
    );
    function makeBedTableOBJ() {
      if (!bedTableProto.obj) return null;
      const inst = bedTableProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// Bathroom_tile------------------------------------------
    const TILES_TARGET_W = 5;
    const bathTilesProto = { obj: null };
    new OBJLoader().load(
      "/3D/Bathroom_tile.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        pre.getSize(size);
        const ctr = new THREE.Vector3();
        pre.getCenter(ctr);
        obj.position.sub(ctr);

        const scale = TILES_TARGET_W / Math.max(size.x || 1, 1e-6);
        obj.scale.setScalar(scale);
        obj.rotation.y += Math.PI / 2;

        const post = new THREE.Box3().setFromObject(obj);
        obj.position.y -= post.min.y;
        obj.position.y += 0.002;

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          ch.material = new THREE.MeshStandardMaterial({
            color: 0xdfe5ea,
            roughness: 0.9,
            metalness: 0.05,
            envMap: envTex,
            envMapIntensity: 0.2,
            transparent: true,
            opacity: 0,
          });
        });

        bathTilesProto.obj = obj;
      },
      undefined,
      () => console.warn("Bathroom_tile.obj failed to load; keeping placeholder tiles.")
    );
    function makeBathTilesOBJ() {
      if (!bathTilesProto.obj) return null;
      const inst = bathTilesProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// sink------------------------------------------
    const SINK_TARGET_W = 1.1;
    const sinkProto = { obj: null };
    new OBJLoader().load(
      "/3D/sink.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        pre.getSize(size);
        const ctr = new THREE.Vector3();
        pre.getCenter(ctr);
        obj.position.sub(ctr);

        const horiz = Math.max(size.x, size.z);
        obj.scale.setScalar(SINK_TARGET_W / Math.max(horiz || 1, 1e-6));

        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(new THREE.Vector3(c2.x, 0, c2.z));
          obj.position.y -= post.min.y;
          obj.position.y += 0.003;
        }

        const porcelain = new THREE.MeshStandardMaterial({
          color: 0xdfe5ea,
          roughness: 0.9,
          metalness: 0.05,
          envMap: envTex,
          envMapIntensity: 0.2,
          transparent: true,
          opacity: 0,
        });
        const chrome = new THREE.MeshStandardMaterial({
          color: 0x9aa3ad,
          roughness: 0.25,
          metalness: 0.85,
          envMap: envTex,
          envMapIntensity: 0.6,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          if (n.includes("faucet") || n.includes("tap") || n.includes("handle") || n.includes("pipe") || n.includes("metal"))
            ch.material = chrome.clone();
          else ch.material = porcelain.clone();
        });

        sinkProto.obj = obj;
      },
      undefined,
      () => console.warn("sink.obj failed to load; keeping primitive sink.")
    );
    function makeSinkOBJ() {
      if (!sinkProto.obj) return null;
      const inst = sinkProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// bathtub------------------------------------------
    const BATHTUB_TARGET_W = 2.1;
    const bathtubProto = { obj: null };
    new OBJLoader().load(
      "/3D/bathtub.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        pre.getSize(size);
        const ctr = new THREE.Vector3();
        pre.getCenter(ctr);
        obj.position.sub(ctr);

        const horiz = Math.max(size.x, size.z);
        obj.scale.setScalar(BATHTUB_TARGET_W / Math.max(horiz || 1, 1e-6));
        obj.rotation.y = Math.PI;

        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(new THREE.Vector3(c2.x, 0, c2.z));
          obj.position.y -= post.min.y;
          obj.position.y += 0.003;
        }

        const tubMat = new THREE.MeshStandardMaterial({
          color: 0xdfe5ea,
          roughness: 0.9,
          metalness: 0.05,
          envMap: envTex,
          envMapIntensity: 0.2,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          ch.material = tubMat.clone();
        });

        bathtubProto.obj = obj;
      },
      undefined,
      () => console.warn("bathtub.obj failed to load; keeping primitive bathtub.")
    );
    function makeBathtubOBJ() {
      if (!bathtubProto.obj) return null;
      const inst = bathtubProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// fridge&sink&countertop------------------------------------------
    const KITCHENSET_TARGET_W = 6.5; // as-is per your values
    const kitchenSetProto = { obj: null };
    new OBJLoader().load(
      "/3D/fridge%26sink%26countertop.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const s = pre.getSize(new THREE.Vector3());
        const c = pre.getCenter(new THREE.Vector3());
        obj.position.sub(c);

        const horiz = Math.max(s.x, s.z);
        obj.scale.setScalar(KITCHENSET_TARGET_W / Math.max(horiz || 1, 1e-6));
        obj.rotation.y = Math.PI / 2;

        const post = new THREE.Box3().setFromObject(obj);
        obj.position.y -= post.min.y;
        obj.position.y += 0.005;

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          ch.material = new THREE.MeshStandardMaterial({
            color: 0xb0b8c2,
            roughness: 0.6,
            metalness: 0.2,
            envMap: envTex,
            envMapIntensity: 0.45,
            transparent: true,
            opacity: 0,
          });
        });

        kitchenSetProto.obj = obj;
      },
      undefined,
      () => console.warn("fridge&sink&countertop.obj failed to load; keeping placeholders.")
    );
    function makeKitchenSetOBJ() {
      if (!kitchenSetProto.obj) return null;
      const inst = kitchenSetProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// dining_table------------------------------------------
    const DTABLE_TARGET_W = 2.6;
    const diningTableProto = { obj: null };
    new OBJLoader().load(
      "/3D/dining_table.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const s = pre.getSize(new THREE.Vector3());
        const c = pre.getCenter(new THREE.Vector3());
        obj.position.sub(c);

        const horiz = Math.max(s.x, s.z);
        obj.scale.setScalar(DTABLE_TARGET_W / Math.max(horiz || 1, 1e-6));

        const post = new THREE.Box3().setFromObject(obj);
        obj.position.y -= post.min.y;
        obj.position.y += 0.005;

        const woodMat = new THREE.MeshStandardMaterial({
          color: 0xa47148,
          roughness: 0.6,
          metalness: 0.15,
          envMap: envTex,
          envMapIntensity: 0.45,
          transparent: true,
          opacity: 0,
        });
        const metalMat = new THREE.MeshStandardMaterial({
          color: 0x9aa3ad,
          roughness: 0.35,
          metalness: 0.55,
          envMap: envTex,
          envMapIntensity: 0.6,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          ch.material = n.includes("leg") || n.includes("metal") || n.includes("frame") ? metalMat.clone() : woodMat.clone();
        });

        diningTableProto.obj = obj;
      },
      undefined,
      () => console.warn("dining_table.obj failed to load; using coffee table fallback.")
    );
    function makeDiningTableOBJ() {
      if (!diningTableProto.obj) return null;
      const inst = diningTableProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

// toilet------------------------------------------
    const TOILET_TARGET_W = 1;
    const toiletProto = { obj: null };
    new OBJLoader().load(
      "/3D/toilet.obj",
      (obj) => {
        const pre = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        pre.getSize(size);
        const ctr = new THREE.Vector3();
        pre.getCenter(ctr);
        obj.position.sub(ctr);

        const horiz = Math.max(size.x, size.z);
        obj.scale.setScalar(TOILET_TARGET_W / Math.max(horiz || 1, 1e-6));

        {
          const post = new THREE.Box3().setFromObject(obj);
          const c2 = post.getCenter(new THREE.Vector3());
          obj.position.sub(new THREE.Vector3(c2.x, 0, c2.z));
          obj.position.y -= post.min.y;
          obj.position.y += 0.003;
        }

        const porcelain = new THREE.MeshStandardMaterial({
          color: 0xdfe5ea,
          roughness: 0.9,
          metalness: 0.05,
          envMap: envTex,
          envMapIntensity: 0.2,
          transparent: true,
          opacity: 0,
        });
        const chrome = new THREE.MeshStandardMaterial({
          color: 0xb0b8c2,
          roughness: 0.25,
          metalness: 0.8,
          envMap: envTex,
          envMapIntensity: 0.6,
          transparent: true,
          opacity: 0,
        });

        obj.traverse((ch) => {
          if (!ch.isMesh) return;
          const n = (ch.name || "").toLowerCase();
          if (n.includes("handle") || n.includes("hinge") || n.includes("metal") || n.includes("lever"))
            ch.material = chrome.clone();
          else ch.material = porcelain.clone();
        });

        toiletProto.obj = obj;
      },
      undefined,
      () => console.warn("toilet.obj failed to load; keeping primitive toilet.")
    );
    function makeToiletOBJ() {
      if (!toiletProto.obj) return null;
      const inst = toiletProto.obj.clone(true);
      inst.traverse((ch) => {
        if (ch.isMesh && ch.material) ch.material = ch.material.clone();
      });
      return inst;
    }

    /* =========================================================
     * “solid render”  (for outline->solid)
     * =======================================================*/
    const COLORS = {
      fabric: [0xcfd6df, 0x9db4c0, 0xb8a69c, 0x8899aa, 0xe4e7eb],
      wood: [0x8b5a2b, 0xa47148, 0xb98b5d, 0x79553a],
      carpet: [0x2a2f3a, 0x3b3f49, 0x5b6270],
      green: [0x43ffd0, 0x31f86e, 0x27c17b],
      metal: [0xb0b8c2, 0x9aa3ad],
      screen: [0x0d1016],
      bath: [0xdfe5ea, 0xcfd8df],
    };
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const r = (deg) => (deg * Math.PI) / 180;

    // Y-offsets for OBJ
    const OBJ_ATTACH_OFFSETS = {
      tv: 0.55,
      carpet: 0.005,
      rug: 0.005,
      table: 0.0,
      couch: 0.0,
      plant: 0.0,
      shelf: 0.0,
      tvstand: 0.0,
      bed: 0.0,
      bedtable: 0.0,
      desk: 0.0,
      rcarpet: 0.0,
      tiles: 0.002,
      toilet: 0,
      sink: 0,
      bathtub: 0,
      fridge: 0,
    };

    // Per-type nudges 
    const OBJ_LOCAL_NUDGE = {
      tv: new THREE.Vector3(-0.48, 0.7, 0.1),
      tvstand: new THREE.Vector3(1.55, 0, 0.1),
      couch: new THREE.Vector3(0, 0, 0),
      table: new THREE.Vector3(0, 0, 0),
      carpet: new THREE.Vector3(0, 0, 0),
      plant: new THREE.Vector3(0, 0, 0),
      shelf: new THREE.Vector3(0, 0, 0),
      bed: new THREE.Vector3(0, 0.7, 0),
      bedtable: new THREE.Vector3(0, 0, -0.2),
      desk: new THREE.Vector3(0, 0, 0),
      rcarpet: new THREE.Vector3(0, 0, 0),
      tiles: new THREE.Vector3(0, -0.11, 0),
      toilet: new THREE.Vector3(0, 0, 0),
      sink: new THREE.Vector3(-1.3, 0, 0),
      bathtub: new THREE.Vector3(0, 0, 0),
      fridge: new THREE.Vector3(-1.7, 0, 2.5),
    };

    // Primitives (neon outline + “solid” placeholders)
    const buildCouch = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(3.6, 0.6, 1.4), pos: [0, 0.3, 0] },
          { geo: new THREE.BoxGeometry(3.6, 0.8, 0.3), pos: [0, 0.95, -0.55] },
          { geo: new THREE.BoxGeometry(0.3, 0.6, 1.4), pos: [-1.95, 0.3, 0] },
          { geo: new THREE.BoxGeometry(0.3, 0.6, 1.4), pos: [1.95, 0.3, 0] },
        ],
        pick(COLORS.fabric)
      );

    const buildBedTable = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(0.55, 0.5, 0.45), pos: [0, 0.25, 0] },
          { geo: new THREE.BoxGeometry(0.58, 0.04, 0.48), pos: [0, 0.52, 0] },
          { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.18, 12), pos: [-0.24, 0.09, -0.19] },
          { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.18, 12), pos: [0.24, 0.09, -0.19] },
          { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.18, 12), pos: [-0.24, 0.09, 0.19] },
          { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.18, 12), pos: [0.24, 0.09, 0.19] },
          { geo: new THREE.BoxGeometry(0.5, 0.18, 0.015), pos: [0, 0.33, 0.23] },
          { geo: new THREE.BoxGeometry(0.5, 0.18, 0.015), pos: [0, 0.17, 0.23] },
          { geo: new THREE.SphereGeometry(0.012, 12, 12), pos: [-0.09, 0.33, 0.245] },
          { geo: new THREE.SphereGeometry(0.012, 12, 12), pos: [-0.09, 0.17, 0.245] },
        ],
        0xa47148
      );

    const buildCoffeeTable = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(1.1, 0.1, 0.7), pos: [0, 0.35, 0] },
          { geo: new THREE.BoxGeometry(1.0, 0.05, 0.6), pos: [0, 0.32, 0] },
          { geo: new THREE.BoxGeometry(0.05, 0.32, 0.05), pos: [-0.5, 0.16, -0.3] },
          { geo: new THREE.BoxGeometry(0.05, 0.32, 0.05), pos: [0.5, 0.16, -0.3] },
          { geo: new THREE.BoxGeometry(0.05, 0.32, 0.05), pos: [-0.5, 0.16, 0.3] },
          { geo: new THREE.BoxGeometry(0.05, 0.32, 0.05), pos: [0.5, 0.16, 0.3] },
        ],
        pick(COLORS.wood)
      );

    const buildCarpet = () =>
      buildMultiPart([{ geo: new THREE.PlaneGeometry(5.0, 3.6), pos: [0, 0.01, 0], rot: [-Math.PI / 2, 0, 0] }], pick(COLORS.carpet));

    const buildPlant = () =>
      buildMultiPart(
        [
          { geo: new THREE.CylinderGeometry(0.35, 0.5, 0.7, 24), pos: [0, 0.35, 0] },
          { geo: new THREE.SphereGeometry(0.5, 24, 24), pos: [0, 1.15, 0] },
        ],
        pick(COLORS.green)
      );

    const buildTV = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(1.9, 1.1, 0.06), pos: [0, 1.0, 0] },
          { geo: new THREE.BoxGeometry(0.6, 0.08, 0.25), pos: [0, 0.55, 0.1] },
          { geo: new THREE.BoxGeometry(0.04, 0.45, 0.04), pos: [0, 0.8, 0.05] },
        ],
        pick(COLORS.screen)
      );

    const buildDesk = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(1.8, 0.1, 0.8), pos: [0, 0.78, 0] },
          { geo: new THREE.BoxGeometry(0.07, 0.78, 0.07), pos: [-0.85, 0.39, -0.35] },
          { geo: new THREE.BoxGeometry(0.07, 0.78, 0.07), pos: [0.85, 0.39, -0.35] },
          { geo: new THREE.BoxGeometry(0.07, 0.78, 0.07), pos: [-0.85, 0.39, 0.35] },
          { geo: new THREE.BoxGeometry(0.07, 0.78, 0.07), pos: [0.85, 0.39, 0.35] },
        ],
        pick(COLORS.wood)
      );

    const buildShelf = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(1.8, 0.08, 0.3), pos: [0, 0.2, 0] },
          { geo: new THREE.BoxGeometry(1.8, 0.08, 0.3), pos: [0, 0.6, 0] },
          { geo: new THREE.BoxGeometry(1.8, 0.08, 0.3), pos: [0, 1.0, 0] },
          { geo: new THREE.BoxGeometry(0.08, 1.2, 0.3), pos: [-0.9, 0.6, 0] },
          { geo: new THREE.BoxGeometry(0.08, 1.2, 0.3), pos: [0.9, 0.6, 0] },
        ],
        pick(COLORS.wood)
      );

    const buildBed = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(2.0, 0.5, 1.6), pos: [0, 0.25, 0] },
          { geo: new THREE.BoxGeometry(2.0, 0.7, 0.15), pos: [0, 0.6, -0.9] },
          { geo: new THREE.BoxGeometry(0.5, 0.15, 0.3), pos: [-0.5, 0.5, -0.5] },
          { geo: new THREE.BoxGeometry(0.5, 0.15, 0.3), pos: [0.5, 0.5, -0.5] },
        ],
        pick(COLORS.fabric)
      );

    const buildRoundCarpet = () =>
      buildMultiPart(
        [
          {
            geo: new THREE.CircleGeometry(ROUND_RUG_TARGET_D / 2, 64),
            pos: [0, 0.01, 0],
            rot: [-Math.PI / 2, 0, 0],
          },
        ],
        pick(COLORS.carpet)
      );

    const buildTVStand = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(2.0, 0.5, 0.5), pos: [0, 0.25, 0] },
          { geo: new THREE.BoxGeometry(2.05, 0.05, 0.52), pos: [0, 0.525, 0] },
          { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), pos: [-0.95, 0.09, -0.22] },
          { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), pos: [0.95, 0.09, -0.22] },
          { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), pos: [-0.95, 0.09, 0.22] },
          { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), pos: [0.95, 0.09, 0.22] },
          { geo: new THREE.BoxGeometry(0.95, 0.36, 0.02), pos: [-0.5, 0.27, 0.255] },
          { geo: new THREE.BoxGeometry(0.95, 0.36, 0.02), pos: [0.5, 0.27, 0.255] },
        ],
        0xa47148
      );

    const buildBathTiles = () =>
      buildMultiPart(
        [
          {
            geo: new THREE.PlaneGeometry(5.0, 3.6, 10, 8),
            pos: [0, 0.01, 0],
            rot: [-Math.PI / 2, 0, 0],
          },
        ],
        0xdfe5ea
      );

    const buildFridge = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(0.9, 1.9, 0.8), pos: [0, 0.95, 0] },
          { geo: new THREE.BoxGeometry(0.04, 0.7, 0.04), pos: [0.42, 1.45, 0.35] },
          { geo: new THREE.BoxGeometry(0.04, 0.9, 0.04), pos: [0.42, 0.7, 0.35] },
        ],
        pick(COLORS.metal)
      );

    const buildIsland = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(2.4, 0.9, 1.0), pos: [0, 0.45, 0] },
          { geo: new THREE.BoxGeometry(2.5, 0.08, 1.1), pos: [0, 0.9, 0] },
        ],
        pick(COLORS.wood)
      );

    const buildSink = () =>
      buildMultiPart(
        [
          { geo: new THREE.CylinderGeometry(0.22, 0.28, 0.8, 24), pos: [0, 0.4, 0] },
          { geo: new THREE.SphereGeometry(0.35, 24, 24), pos: [0, 0.85, 0] },
        ],
        pick(COLORS.bath)
      );

    const buildToilet = () =>
      buildMultiPart(
        [
          { geo: new THREE.CylinderGeometry(0.25, 0.3, 0.4, 24), pos: [0, 0.2, 0] },
          { geo: new THREE.BoxGeometry(0.5, 0.2, 0.6), pos: [0, 0.5, 0] },
          { geo: new THREE.BoxGeometry(0.5, 0.5, 0.2), pos: [0, 0.75, -0.2] },
        ],
        pick(COLORS.bath)
      );

    const buildBathtub = () =>
      buildMultiPart(
        [
          { geo: new THREE.BoxGeometry(1.6, 0.5, 0.8), pos: [0, 0.25, 0] },
          { geo: new THREE.BoxGeometry(1.5, 0.4, 0.7), pos: [0, 0.3, 0] },
        ],
        pick(COLORS.bath)
      );

    /* =========================================================
     * Object Pools
     * =======================================================*/
    const TYPES = {
      couch: buildCouch,
      carpet: buildCarpet,
      plant: buildPlant,
      tv: buildTV,
      desk: buildDesk,
      table: buildCoffeeTable,
      shelf: buildShelf,
      bed: buildBed,
      fridge: buildFridge,
      island: buildIsland,
      sink: buildSink,
      toilet: buildToilet,
      bathtub: buildBathtub,
      tvstand: buildTVStand,
      bedtable: buildBedTable,
      rcarpet: buildRoundCarpet,
      tiles: buildBathTiles,
    };
    const POOL_COUNTS = {
      couch: 2,
      carpet: 3,
      plant: 6,
      tv: 2,
      desk: 2,
      table: 3,
      shelf: 4,
      bed: 2,
      fridge: 2,
      island: 2,
      sink: 2,
      toilet: 2,
      bathtub: 2,
      tvstand: 2,
      bedtable: 4,
      rcarpet: 2,
      tiles: 2,
    };

    const pools = {};
    Object.keys(TYPES).forEach((t) => (pools[t] = []));
    const masterPool = [];

    const hidePiece = (p) => {
      p.group.scale.setScalar(0.01);
      p.edges.forEach((l) => {
        l.material.color.setHex(0xffffff);
        l.material.opacity = 0;
      });
      p.solids.forEach((s) => {
        s.material.opacity = 0;
        s.material.emissive.setHex(0x000000);
        s.material.emissiveIntensity = 0;
      });
      p.solidsHolder.visible = true;
      p.neons.forEach((n) => { if (n.material) n.material.opacity = 0.12; });
    };
    const colorize = (p, hex) => {
      p.neons.forEach((n) => {
        n.material.color.setHex(hex);
        n.material.emissive.setHex(hex);
      });
      p.solids.forEach((s) => s.material.color.setHex(hex));
    };
    const placeForAdd = (p, x, z, rotY) => {
      p.group.position.set(x, 0, z);
      p.group.rotation.y = rotY || 0;
      p.group.scale.setScalar(0.01);
      p.edges.forEach((l) => {
        l.material.color.setHex(0xffffff);
        l.material.opacity = 0.9;
      });
      p.solids.forEach((s) => {
        s.material.opacity = 0;
        s.material.emissive.setHex(0x000000);
        s.material.emissiveIntensity = 0;
      });
      p.solidsHolder.visible = true;
      p.neons.forEach((n) => { if (n.material) n.material.opacity = 0.12; });
      p.edgesHolder.visible = true;
    };

    Object.entries(POOL_COUNTS).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        const p = TYPES[type]();
        furniture.add(p.group);
        hidePiece(p);
        const entry = { type, piece: p, inUse: false };
        pools[type].push(entry);
        masterPool.push(entry);
      }
    });

    const acquire = (type) => {
      const e = pools[type].find((x) => !x.inUse);
      if (!e) return null;
      e.inUse = true;
      return e.piece;
    };
    const release = (piece) => {
      const e = masterPool.find((x) => x.piece === piece);
      if (e) e.inUse = false;
      hidePiece(piece);
    };

    /* =========================================================
     * Layouts
     * =======================================================*/
    const THEMES = ["living", "kitchen", "bedroom", "bathroom"];
    const LAYOUTS = {
      living: [
        {
          items: [
            { type: "rcarpet", pos: [0, 0, 0], rot: 0 },
            { type: "couch", pos: [0, 0, 1.6], rot: r(180) },
            { type: "table", pos: [0, 0, 0.1], rot: 0 },
            { type: "tvstand", pos: [0, 0, -2.3], rot: 0 },
            { type: "tv", pos: [0, 0, -2.28], rot: 0 },
            { type: "plant", pos: [-2.8, 0, -1.6], rot: 0 },
            { type: "shelf", pos: [3.0, 0, -1.0], rot: r(-20) },
          ],
        },
        {
          items: [
            { type: "rcarpet", pos: [0, 0, 0], rot: 0 },
            { type: "couch", pos: [-1.3, 0, 1.2], rot: r(160) },
            { type: "table", pos: [-0.4, 0, -0.2], rot: r(160) },
            { type: "tvstand", pos: [1.2, 0, -2.2], rot: r(-10) },
            { type: "tv", pos: [1.2, 0, -2.18], rot: r(-10) },
            { type: "plant", pos: [-3.4, 0, -0.4], rot: 0 },
            { type: "shelf", pos: [2.8, 0, 1.0], rot: r(20) },
          ],
        },
      ],
      kitchen: [
        {
          items: [
            { type: "island", pos: [0.3, 0, 0.2], rot: r(10) },
            { type: "fridge", pos: [-2.8, 0, -1.6], rot: r(90) },
            { type: "shelf", pos: [-1.85, 0, 1.6], rot: r(90) },
            { type: "plant", pos: [-3.8, 0, -0.2], rot: 0 },
            { type: "table", pos: [0.5, 0, 1.4], rot: r(10) },
          ],
        },
      ],
      bedroom: [
        {
          items: [
            { type: "bed", pos: [0, 0, 0.2], rot: r(180) },
            { type: "bedtable", pos: [-1.3, 0, 0.8], rot: r(180) },
            { type: "bedtable", pos: [1.3, 0, 0.8], rot: r(180) },
            { type: "carpet", pos: [0, 0, 0.4], rot: 0 },
            { type: "desk", pos: [-2.6, 0, -1.2], rot: r(20) },
            { type: "plant", pos: [2.6, 0, -1.2], rot: 0 },
            { type: "shelf", pos: [0, 0, -2.4], rot: 0 },
          ],
        },
        {
          items: [
            { type: "bed", pos: [-0.4, 0, 0.0], rot: r(165) },
            { type: "bedtable", pos: [-1.8, 0, 0.3], rot: r(165) },
            { type: "bedtable", pos: [0.6, 0, 1], rot: r(165) },
            { type: "carpet", pos: [-0.3, 0, 0.4], rot: r(6) },
            { type: "desk", pos: [2.8, 0, -1.2], rot: r(-20) },
            { type: "plant", pos: [-2.6, 0, -1.4], rot: 0 },
          ],
        },
      ],
      bathroom: [
        {
          items: [
            { type: "tiles", pos: [0, 0, 0], rot: 0 },
            { type: "bathtub", pos: [-2.2, 0, 0.8], rot: r(90) },
            { type: "sink", pos: [0.6, 0, -1.8], rot: 0 },
            { type: "toilet", pos: [2.0, 0, -1.0], rot: r(-20) },
            { type: "plant", pos: [2.6, 0, 1.4], rot: 0 },
            { type: "shelf", pos: [-0.2, 0, 1.8], rot: 0 },
          ],
        },
        {
          items: [
            { type: "tiles", pos: [0, 0, 0], rot: 0 },
            { type: "bathtub", pos: [0.0, 0, -1.8], rot: 0 },
            { type: "sink", pos: [-2.4, 0, -0.8], rot: r(90) },
            { type: "toilet", pos: [2.4, 0, -0.6], rot: r(-90) },
            { type: "plant", pos: [-2.6, 0, 1.6], rot: 0 },
          ],
        },
      ],
    };

    const pickTheme = () => THEMES[Math.floor(Math.random() * THEMES.length)];

    // Instantiate items for a given theme layout
    function makeLayoutFromTheme(theme) {
      const variant = LAYOUTS[theme][Math.floor(Math.random() * LAYOUTS[theme].length)];
      const items = [];

      variant.items.forEach((spec, i) => {
        const piece = acquire(spec.type);
        if (!piece) return;

        // choose a color 
        const family =
          spec.type === "plant"
            ? COLORS.green
            : spec.type === "carpet" || spec.type === "rcarpet"
            ? COLORS.carpet
            : spec.type === "tv"
            ? COLORS.screen
            : ["sink", "toilet", "bathtub", "fridge", "tiles"].includes(spec.type)
            ? COLORS.bath
            : ["desk", "shelf", "island", "table", "tvstand"].includes(spec.type)
            ? COLORS.wood
            : COLORS.fabric;
        const hex = pick(family);

        colorize(piece, hex);
        placeForAdd(piece, spec.pos[0], spec.pos[2] ?? 0, spec.rot ?? 0);

        items.push({
          type: spec.type,
          piece,
          appearAt: i,
          removeOrder: i,
          removed: false,
          rendered: false,
          hitAt: 0,
          morphStart: 0,
          solidFadeStart: 0,
          objFadeStart: 0,
          obj: null,
          objShown: false,
          stage: 0,
          _waitingAsset: false,
          _swapWaitSet: false,
          _swapWaitUntil: 0
        });
      });

      // randomize removal order
      for (let i = 0; i < items.length; i++) {
        const j = Math.floor(Math.random() * items.length);
        [items[i].removeOrder, items[j].removeOrder] = [items[j].removeOrder, items[i].removeOrder];
      }
      return { theme, items };
    }

    /* =========================================================
     * Helper: create a temporary outline over an OBJ for “drawing”
     * =======================================================*/
    function createOBJOutline(rootObj, color = 0x55bbff, initOpacity = 0.9) {
      const group = new THREE.Group();
      const mats = [];
      rootObj.traverse((ch) => {
        if (!ch.isMesh || !ch.geometry) return;
        const eg = new THREE.EdgesGeometry(ch.geometry, 40);
        const mat = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: initOpacity,
          depthWrite: false,
        });
        const ls = new THREE.LineSegments(eg, mat);
        ls.position.copy(ch.position);
        ls.rotation.copy(ch.rotation);
        ls.scale.copy(ch.scale);
        group.add(ls);
        mats.push(mat);
      });
      return { group, mats };
    }

    /* =========================================================
     * Timings / Animation Phases + Waits
     * =======================================================*/
    const ROT = 18;
    const ADD_PLACE_END = 0.28;
    const BURST_COUNT = 2;
    const BURST_LEAD = 0.25;
    const SCALE_SPEED = 7;

    const LASER_DELAY = 1.2;
    const LASER_DURATION = 5.0;
    const LASER_HIT_TIME = 0.45;

    const OBJ_DELAY_AFTER_HIT = 1.2;
    const SOLID_FADE = 0.25;
    const OBJ_FADE = 0.55;

    const SWAP_MIN_DELAY = 2;   
    const LAYOUT_MIN_GAP = 0.5;   
    const SHOWCASE_HOLD = 5.0;  
    const GAP_AFTER_REMOVE = 5;   
    let layoutWaitUntil = 0;
    let addHoldUntil = 0;   
    let lastRemovalAt = 0;      

    // overlay flag
    let endOverlayShown = false;

    let mode = "add";
    let phaseStart = performance.now() / 1000;

    let current = makeLayoutFromTheme(pickTheme());
    let nextLayout = null;

    /* =========================================================
     * Resize Handling
     * =======================================================*/
    const onResize = () => {
      const w = wrap.clientWidth || 600;
      const h = wrap.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    onResize();
    window.addEventListener("resize", onResize);

    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const lerp = (a, b, t) => a + (b - a) * clamp01(t);

    /* =========================================================
     * OBJ registry
     * =======================================================*/
    const OBJ_PROTOS = {
      couch: { make: makeCouchOBJ },
      tv: { make: makeTVOBJ },
      carpet: { make: makeRugOBJ },
      rcarpet: { make: makeRoundCarpetOBJ },
      table: { make: makeCoffeeTableOBJ },
      plant: { make: makePlantOBJ },
      shelf: { make: makeShelfOBJ },
      tvstand: { make: makeTVStandOBJ },
      bed: { make: makeBedOBJ },
      bedtable: { make: makeBedTableOBJ },
      desk: { make: makeDeskOBJ },
      tiles: { make: makeBathTilesOBJ },
      toilet: { make: makeToiletOBJ },
      sink: { make: makeSinkOBJ },
      bathtub: { make: makeBathtubOBJ },
      fridge: { make: makeKitchenSetOBJ },
      island: {
        make: () => {
          // dummy group so “island” placeholder is replaced by “fridge”
          const g = new THREE.Group();
          g.name = "KitchenSetDummy_fridge";
          return g;
        },
      },
    };

    /* =========================================================
     * Main Animation Loop
     * =======================================================*/
    let raf = 0;
    function animate() {
      const now = performance.now() / 1000;
      const t = (now - phaseStart) / ROT;
      root.rotation.y = (t % 1) * Math.PI * 2;

      if (mode === "add") {
        const total = current.items.length || 1;
        const placeWindow = ADD_PLACE_END * ROT;

        // Initial place-in animation
        for (let i = 0; i < current.items.length; i++) {
          const it = current.items[i];
          const burst = i < BURST_COUNT;
          const appearTime = (it.appearAt / total) * placeWindow - (burst ? BURST_LEAD : 0);
          const local = (now - phaseStart) - appearTime;

          if (local <= 0) {
            it.piece.group.scale.setScalar(0.01);
            it.piece.edges.forEach((l) => (l.material.opacity = 0.9));
            it.piece.solids.forEach((s) => {
              s.material.opacity = 0;
              s.material.emissiveIntensity = 0;
            });
            it.piece.solidsHolder.visible = true;
            if (it.obj) it.obj.visible = false;
            it.stage = 0;
            it.objShown = false;
            it._waitingAsset = false; it._swapWaitSet = false; it._swapWaitUntil = 0;
          } else {
            const s = Math.min(1, local * SCALE_SPEED);
            it.piece.group.scale.setScalar(lerp(0.01, 1, s));
            it.piece.edges.forEach((l) => (l.material.opacity = 0.9));
            it.piece.solids.forEach((s) => (s.material.opacity = 0));
          }
          it.rendered = false;
          it.morphStart = 0;
          it.solidFadeStart = 0;
          it.objFadeStart = 0;
        }

        // Laser sweep across
        const laserStart = phaseStart + placeWindow + LASER_DELAY;
        const laserEnd = laserStart + LASER_DURATION;
        if (now >= laserStart && now <= laserEnd) {
          const k = (now - laserStart) / LASER_DURATION;
          const zPos = lerp(-ROOM_Z, ROOM_Z, k);
          laserCore.position.z = zPos;
          laserGlow.position.z = zPos;
          const vis = Math.sin(k * Math.PI);
          laserCore.material.opacity = 0.85 * vis;
          laserGlow.material.opacity = 0.18 * vis;

          current.items.forEach((it) => {
            const targetZ = it.piece.group.position.z;
            if (!it.rendered && zPos >= targetZ) {
              it.rendered = true;
              it.hitAt = now;
              it.stage = 1;
            }
          });
        } else {
          laserCore.material.opacity = 0;
          laserGlow.material.opacity = 0;
        }

        // Replace primitive solids with OBJs after laser hits
        current.items.forEach((it) => {
          if (it.hitAt > 0) {
            const kh = clamp01((now - it.hitAt) / LASER_HIT_TIME);

            // neon edges fade out
            it.piece.edges.forEach((l) => {
              l.material.color.setHex(0x55bbff);
              l.material.opacity = lerp(0.9, 0.0, kh);
            });
            it.piece.solids.forEach((m) => {
              if (!m.material) return;
              m.material.opacity = lerp(0.0, 1.0, kh);
              m.material.emissive = new THREE.Color(0x2a7dff);
              m.material.emissiveIntensity = lerp(0.8, 0.0, kh);
            });
            if (kh >= 1 && it.stage === 1) {
              it.piece.edgesHolder.visible = false;
              it.piece.neons.forEach((n) => {
                if (n.material) n.material.opacity = 0;
              });
            }

            // OBJ spawn / special per-theme replacements + overlay if asset not ready
            if (!it.obj && (OBJ_PROTOS[it.type] || it.type === "carpet")) {
              let makerFn = OBJ_PROTOS[it.type]?.make;
              if (it.type === "carpet" && current?.theme === "living") makerFn = makeRoundCarpetOBJ;
              if (it.type === "table" && current?.theme === "kitchen") makerFn = makeDiningTableOBJ;

              const inst = makerFn && makerFn();
              if (!inst) {
                if (!it._waitingAsset) { it._waitingAsset = true; busy.add("asset"); }
              } else {
                if (it._waitingAsset) { it._waitingAsset = false; busy.remove("asset"); }
                it.obj = inst;
                it.obj.visible = false;
                it.piece.group.add(it.obj);

                const yOff = OBJ_ATTACH_OFFSETS[it.type] ?? 0;
                it.obj.position.set(0, yOff, 0);
                const nudge = OBJ_LOCAL_NUDGE[it.type];
                if (nudge) it.obj.position.add(nudge);

                if (it.type === "tvstand") it.obj.rotation.y += Math.PI;
                if (it.type === "table" && current?.theme === "kitchen") {
                  it.obj.position.x += 2;
                  it.obj.position.z += 1;
                  it.obj.rotation.y += THREE.MathUtils.degToRad(-10);
                }
                it.obj.traverse((ch) => { if (ch.isMesh && ch.material) ch.material.opacity = 0; });

                const outline = createOBJOutline(it.obj, 0x55bbff, 0.9);
                it.objOutline = outline;
                it.piece.group.add(outline.group);
                outline.group.visible = false;
                outline.group.position.copy(it.obj.position);
                outline.group.rotation.copy(it.obj.rotation);
                outline.group.scale.copy(it.obj.scale);
              }
            }

            // wait gate: solid -> OBJ
            const readyToSwap = (now - it.hitAt) > (LASER_HIT_TIME + OBJ_DELAY_AFTER_HIT);
            if (it.stage === 1 && readyToSwap) {
              if (!it._swapWaitSet) {
                it._swapWaitSet = true;
                it._swapWaitUntil = now + SWAP_MIN_DELAY;
                busy.add("swap");
              }
              if (now >= it._swapWaitUntil) {
                busy.remove("swap");
                it.stage = 2;
                it.solidFadeStart = now;
              }
            }

            // fade solids away, then fade in OBJ
            if (it.stage === 2) {
              const ks = clamp01((now - it.solidFadeStart) / SOLID_FADE);
              it.piece.solids.forEach((m) => { if (m.material) m.material.opacity = lerp(1, 0, ks); });
              if (ks >= 1) {
                it.piece.solidsHolder.visible = false;
                it.piece.edgesHolder.visible = false;
                if (it.obj) {
                  it.obj.visible = true;
                  it.objFadeStart = now;
                  it.stage = 3;
                  if (it.objOutline) it.objOutline.group.visible = true;
                } else {
                  it.stage = 4;
                }
              }
            }

            if (it.stage === 3 && it.obj) {
              const ko = clamp01((now - it.objFadeStart) / OBJ_FADE);
              it.obj.traverse((ch) => { if (ch.isMesh && ch.material) ch.material.opacity = ko; });

              if (it.objOutline) {
                it.objOutline.mats.forEach((m) => (m.opacity = lerp(0.9, 0.0, ko)));
                if (ko >= 1) it.objOutline.group.visible = false;
              }

              if (ko >= 1) {
                it.stage = 4;
                it.objShown = true;
              }
            }
          }
        });

        // -----------------------------
        // ADD  ->  REMOVE transition
        // -----------------------------
        const nextT = ((now + 0.016) - phaseStart) / ROT;
        if (addHoldUntil === 0) {
          const allShown = current.items.length > 0 && current.items.every((it) => it.objShown || it.stage >= 4);
          if (allShown) {
            addHoldUntil = now + SHOWCASE_HOLD; 
          }
        }
        if (Math.floor(nextT) > Math.floor(t)) {
          if (addHoldUntil && now < addHoldUntil) {
            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
            return;
          }

          // removal
          mode = "remove";
          phaseStart = performance.now() / 1000;
          laserCore.material.opacity = 0;
          laserGlow.material.opacity = 0;
          endOverlayShown = false;
          addHoldUntil = 0; 
        }
      } else {
        // shrink & fade 
        const n = current.items.length || 1;
        const seg = 1 / n;

        const tt = (now - phaseStart) / ROT;
        if (!nextLayout && tt > 0.06) {
          let nextTheme = pickTheme();
          if (nextTheme === current.theme) nextTheme = pickTheme();
          nextLayout = makeLayoutFromTheme(nextTheme);
        }

        for (let i = 0; i < current.items.length; i++) {
          const it = current.items[i];
          const idx = it.removeOrder;
          const start = idx * seg;
          const end = start + seg * 0.85;
          const k = ((now - phaseStart) / ROT - start) / (end - start);

          if (k <= 0) {
            it.piece.group.scale.setScalar(1);
            it.piece.edges.forEach((l) => (l.material.opacity = 0));
            if (it.objShown && it.obj) {
              it.obj.visible = true;
              it.obj.traverse((ch) => {
                if (ch.isMesh && ch.material) ch.material.opacity = 1;
              });
              it.piece.solidsHolder.visible = false;
            } else {
              it.piece.solidsHolder.visible = true;
              it.piece.solids.forEach((m) => {
                if (m.material) m.material.opacity = 1;
              });
            }
          } else if (k > 0 && k < 1) {
            const ease = k < 0.5 ? k * 2 : 1;
            const s = lerp(1, 0.01, ease);
            it.piece.group.scale.setScalar(s);
            if (it.objShown && it.obj) {
              it.obj.traverse((ch) => {
                if (ch.isMesh && ch.material) ch.material.opacity = lerp(1, 0, k);
              });
            } else {
              it.piece.solids.forEach((m) => {
                if (m.material) m.material.opacity = lerp(1, 0, k);
              });
            }
          } else if (!it.removed) {
            it.removed = true;
            lastRemovalAt = now; 
            if (it.obj) {
              it.piece.group.remove(it.obj);
              it.obj = null;
              it.objShown = false;
            }
            // cleanup outline
            if (it.objOutline) {
              it.piece.group.remove(it.objOutline.group);
              it.objOutline = null;
            }
            release(it.piece);
          }
        }
        // Show overlay
        if (!endOverlayShown && current.items.length > 0 && current.items.every((it) => it.removed)) {
          endOverlayShown = true;
          busy.add("end");
        }
        //handoff once everything is gone
        const allRemoved = current.items.length > 0 && current.items.every((it) => it.removed);

        // show the “rendering...” 
        if (!endOverlayShown && allRemoved) {
          endOverlayShown = true;
          busy.add("end");
        }
        if (allRemoved) {
          if ((now - lastRemovalAt) >= GAP_AFTER_REMOVE) {
            if (endOverlayShown) {
              busy.remove("end");
              endOverlayShown = false;
            }
            if (!nextLayout) nextLayout = makeLayoutFromTheme(pickTheme());
            current = nextLayout;
            nextLayout = null;
            mode = "add";
            phaseStart = performance.now() / 1000;
          } else {
            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
            return;
          }
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    /* =========================================================
     * Cleanup
     * =======================================================*/
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      busy.destroy();
      wrap.removeChild(renderer.domElement);
      renderer.dispose();
      pmrem.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, []);

  return <div ref={wrapRef} className="hero3d" aria-label="Renova 3D preview" />;
}
