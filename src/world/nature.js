import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * 自然景物：竹林、松柏、花树、垂柳、湖石假山、水面、莲荷、花径。
 */

// ---------- 竹 ----------

function bambooTuftGeometry() {
  const planes = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1.5, 0.42, 3, 1);
    // 叶面略下垂
    const pos = p.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      pos.setY(v, pos.getY(v) - Math.abs(x) * 0.28);
    }
    p.rotateY((i / 3) * Math.PI);
    planes.push(p);
  }
  return mergeGeometries(planes);
}

// 一片竹林（实例化渲染，带风摆）
export function bambooGrove(spots, mats, { sway = true } = {}) {
  const g = new THREE.Group();
  const n = spots.length;
  if (!n) return g;

  const stemGeo = new THREE.CylinderGeometry(0.06, 0.09, 1, 6);
  stemGeo.translate(0, 0.5, 0);
  const tuftGeo = bambooTuftGeometry();

  const stemMat = mats.bambooStem.clone();
  const tuftMat = mats.bamboo.clone();
  if (sway) {
    for (const mat of [stemMat, tuftMat]) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        mat.userData.shader = shader;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
              float swayPhase = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.9;
              float swayAmt = max(transformed.y - 0.5, 0.0) * 0.06;
              transformed.x += sin(uTime * 1.4 + swayPhase) * swayAmt;
              transformed.z += cos(uTime * 1.1 + swayPhase) * swayAmt * 0.7;
            #endif
          `);
      };
    }
  }

  const stems = new THREE.InstancedMesh(stemGeo, stemMat, n);
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, n * 2);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  spots.forEach(({ x, z, y = 0 }, i) => {
    const h = 4.2 + Math.random() * 2.8;
    dummy.position.set(x, y, z);
    dummy.rotation.set((Math.random() - 0.5) * 0.08, Math.random() * Math.PI, (Math.random() - 0.5) * 0.08);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    stems.setColorAt(i, color.setHSL(0.22, 0.35, 0.32 + Math.random() * 0.14));

    for (let k = 0; k < 2; k++) {
      dummy.position.set(x, y + h * (0.82 + k * 0.14), z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const s = 1.0 + Math.random() * 0.6;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      tufts.setMatrixAt(i * 2 + k, dummy.matrix);
      tufts.setColorAt(i * 2 + k, color.setHSL(0.26, 0.42, 0.3 + Math.random() * 0.12));
    }
  });
  stems.castShadow = true;
  tufts.castShadow = true;
  g.add(stems, tufts);
  g.userData.swayMats = [stemMat, tuftMat];
  return g;
}

// ---------- 树 ----------

function blobFoliage(r, mat, flatShading = false) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + (Math.random() - 0.5) * 0.25);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  if (flatShading) m.material = mat.clone(), m.material.flatShading = true;
  return m;
}

export function tree(mats, { scale = 1, blossom = null } = {}) {
  const g = new THREE.Group();
  const trunkH = 2.2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, trunkH, 7), mats.beam);
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = (Math.random() - 0.5) * 0.12;
  g.add(trunk);
  const leafMat = blossom || (Math.random() > 0.5 ? mats.foliage : mats.foliageLight);
  const blobs = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = 0.9 + Math.random() * 0.7;
    const b = blobFoliage(r, leafMat);
    const a = (i / blobs) * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.7, trunkH + 0.5 + Math.random() * 0.8, Math.sin(a) * 0.7);
    g.add(b);
  }
  const crown = blobFoliage(1.1, leafMat);
  crown.position.y = trunkH + 1.5;
  g.add(crown);
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.colliders = [{ kind: 'circle', x: 0, z: 0, r: 0.3 * scale }];
  return g;
}

export function pine(mats, { scale = 1 } = {}) {
  const g = new THREE.Group();
  const trunkH = 2.8;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, trunkH, 7), mats.woodDark);
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const r = 1.6 - i * 0.4;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.85, 8), mats.pine);
    cone.position.y = trunkH * 0.55 + i * 1.05;
    cone.scale.y = 0.75;
    g.add(cone);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.colliders = [{ kind: 'circle', x: 0, z: 0, r: 0.3 * scale }];
  return g;
}

export function willow(mats, { scale = 1 } = {}) {
  const g = new THREE.Group();
  const trunkH = 2.6;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, trunkH, 7), mats.beam);
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = 0.08;
  g.add(trunk);
  const crown = blobFoliage(1.3, mats.foliageLight);
  crown.position.y = trunkH + 0.4;
  crown.scale.y = 0.7;
  g.add(crown);
  // 垂条
  const strandMat = mats.foliageLight;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r0 = 0.9 + Math.random() * 0.4;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(a) * r0 * 0.5, trunkH + 0.7, Math.sin(a) * r0 * 0.5),
      new THREE.Vector3(Math.cos(a) * r0, trunkH + 0.2, Math.sin(a) * r0),
      new THREE.Vector3(Math.cos(a) * r0 * 1.15, trunkH - 1.4 - Math.random() * 0.5, Math.sin(a) * r0 * 1.15),
    );
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 5, 0.05, 4), strandMat);
    g.add(tube);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.colliders = [{ kind: 'circle', x: 0, z: 0, r: 0.35 * scale }];
  return g;
}

// ---------- 土山 ----------

// 与 Garden.getGroundHeight 的余弦缓坡近似一致的可视山体
export function hillMesh(mats, { r = 15, h = 2.6 }) {
  const geo = new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const wobble = 1 + Math.sin(a * 5.3) * 0.06 + Math.cos(a * 3.7) * 0.05;
    pos.setXYZ(i, v.x * r * wobble, v.y * h, v.z * r * wobble);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats.grass);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- 湖石假山 ----------

export function rock(mats, { w = 2, h = 2.4, dark = false } = {}) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position;
  const seed = Math.random() * 100;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed) * Math.sin(v.z * 3.7 + seed);
    v.multiplyScalar(1 + n * 0.32 + (Math.random() - 0.5) * 0.1);
    pos.setXYZ(i, v.x, v.y * 1.25, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, dark ? mats.rockDark : mats.rock);
  m.scale.set(w / 2, h / 2, w / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function rockCluster(mats, { count = 4, spread = 3, maxW = 2.6, maxH = 3 } = {}) {
  const g = new THREE.Group();
  const colliders = [];
  for (let i = 0; i < count; i++) {
    const w = maxW * (0.5 + Math.random() * 0.5);
    const h = maxH * (0.5 + Math.random() * 0.5);
    const r = rock(mats, { w, h, dark: Math.random() > 0.6 });
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * spread * 0.5;
    r.position.set(Math.cos(a) * d, h * 0.32, Math.sin(a) * d);
    r.rotation.y = Math.random() * Math.PI;
    g.add(r);
    colliders.push({ kind: 'circle', x: r.position.x, z: r.position.z, r: w * 0.42 });
  }
  g.userData.colliders = colliders;
  return g;
}

// ---------- 水面 ----------

export function waterMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x55857a });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uShallow = { value: new THREE.Color(0x5f9889) };
    shader.uniforms.uDeep = { value: new THREE.Color(0x35605a) };
    shader.uniforms.uSpark = { value: new THREE.Color(0xcfe8d8) };
    mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos2;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWorldPos2 = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldPos2;
        uniform float uTime;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uSpark;
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float w1 = sin(vWorldPos2.x * 0.55 + uTime * 0.7) * sin(vWorldPos2.z * 0.62 - uTime * 0.5);
          float w2 = sin(vWorldPos2.x * 0.21 - uTime * 0.35) * sin(vWorldPos2.z * 0.26 + uTime * 0.42);
          float mixv = clamp(0.5 + w1 * 0.28 + w2 * 0.3, 0.0, 1.0);
          diffuseColor.rgb = mix(uDeep, uShallow, mixv);
          float spark = smoothstep(0.965, 1.0, sin(vWorldPos2.x * 2.6 + uTime * 1.6) * sin(vWorldPos2.z * 2.9 - uTime * 1.2));
          diffuseColor.rgb += uSpark * spark * 0.55;
        }
      `);
  };
  return mat;
}

// 不规则水面的形状几何（shape 的 y 取 -z，抵消 rotateX 的镜像）
export function waterGeometry(cx, cz, rx, rz, wobble = 0.16, segments = 40) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const w = 1 + (Math.sin(a * 3.1 + cx) + Math.cos(a * 2.3 + cz)) * 0.5 * wobble;
    const x = Math.cos(a) * rx * w;
    const z = Math.sin(a) * rz * w;
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  const geo = new THREE.ShapeGeometry(shape, 8);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  return geo;
}

// ---------- 莲荷 ----------

export function lotusCluster(cx, cz, count, mats, spread = 4) {
  const g = new THREE.Group();
  const padGeo = new THREE.CircleGeometry(0.32, 10);
  padGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * spread;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d * 0.8;
    const pad = new THREE.Mesh(padGeo, mats.lotusPad);
    pad.position.set(x, 0.12, z);
    pad.scale.setScalar(0.7 + Math.random() * 0.7);
    g.add(pad);
    if (Math.random() > 0.55) {
      const flower = new THREE.Group();
      for (let p = 0; p < 6; p++) {
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), mats.lotus);
        const pa = (p / 6) * Math.PI * 2;
        petal.position.set(Math.cos(pa) * 0.09, 0.15, Math.sin(pa) * 0.09);
        petal.rotation.set(Math.cos(pa) * 0.5, 0, -Math.sin(pa) * 0.5);
        flower.add(petal);
      }
      const heart = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mats.gold);
      heart.position.y = 0.16;
      flower.add(heart);
      flower.position.set(x, 0.12, z);
      g.add(flower);
    }
  }
  return g;
}

// ---------- 花丛 ----------

export function flowerBed(cx, cz, r, count, flowerMat, mats, { y = 0, noColor = false } = {}) {
  const g = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4).toNonIndexed();
  stemGeo.translate(0, 0.2, 0);
  const budGeo = new THREE.IcosahedronGeometry(0.09, 0);
  budGeo.translate(0, 0.42, 0);
  const merged = mergeGeometries([stemGeo, budGeo]);
  const inst = new THREE.InstancedMesh(merged, flowerMat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    dummy.position.set(cx + Math.cos(a) * d, y, cz + Math.sin(a) * d);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.8;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    if (!noColor) {
      color.setHSL(Math.random() * 0.06 + 0.93, 0.5, 0.6 + Math.random() * 0.2);
      if (Math.random() > 0.7) color.setHSL(0.13, 0.6, 0.65);
      inst.setColorAt(i, color);
    }
  }
  g.add(inst);
  return g;
}

// ---------- 芦苇 ----------

export function reeds(cx, cz, count, mats, spread = 3) {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.05, 1.6, 5);
  geo.translate(0, 0.8, 0);
  const inst = new THREE.InstancedMesh(geo, mats.bambooStem, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * spread;
    dummy.position.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d * 0.7);
    dummy.rotation.set((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2);
    dummy.scale.setScalar(0.7 + Math.random() * 0.7);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.18, 0.3, 0.35 + Math.random() * 0.15);
    inst.setColorAt(i, color);
  }
  g.add(inst);
  return g;
}
