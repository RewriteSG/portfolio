import * as THREE from '../vendor/three.module.js';

// A small, walkable city built as a single batch of coloured voxel boxes.
// Everything is local to the returned group so the journey can move it as one asset.
export function createCity() {
  const group = new THREE.Group();
  group.name = 'Small Worlds city';
  const blocks = [];
  const shadowFootprints = [];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const palette = {
    cream: 0xe9dfc7, pale: 0xf3ead7, stone: 0xc1baa0, edge: 0xa4a58b,
    coral: 0xd88e79, coralDark: 0xbb7867, sage: 0xa9b69b, lilac: 0xa6aec8,
    glass: 0x668c88, darkGlass: 0x496e70, road: 0x8d9890, line: 0xe8e2cb,
    wood: 0xbc956f, bark: 0x9b8664, green: 0x7f9d70, lightGreen: 0x9bb686,
    darkGreen: 0x68895f, metal: 0x768479, water: 0x80b7bf
  };
  function box(x, y, z, sx, sy, sz, color) {
    blocks.push({ x, y, z, sx, sy, sz, color });
  }
  const groundY = .38;
  function terrainTop(x, z) {
    const edge = Math.max(Math.abs(Math.round(x)) / 12, Math.abs(Math.round(z)) / 10);
    return (edge > .95 ? -.26 : edge > .87 ? -.04 : .22) + .13;
  }

  // Cropped corners and visibly stepped limestone edges give the miniature depth.
  for (let ix = -12; ix <= 12; ix++) {
    for (let iz = -10; iz <= 10; iz++) {
      if (Math.abs(ix) + Math.abs(iz) > 20) continue;
      const canal = ix >= 4 && ix <= 6;
      const edge = Math.max(Math.abs(ix) / 12, Math.abs(iz) / 10);
      const tier = edge > .95 ? -.26 : edge > .87 ? -.04 : .22;
      const top = canal ? -.28 : tier;
      const bottom = -1.65 + ((ix * 7 + iz * 13 + 500) % 4) * .09;
      box(ix, (top + bottom) / 2, iz, 1.006, top - bottom, 1.006,
        [0xc0bca3, 0xc7c1aa, 0xb6b69c, 0xcec7af][(ix * 3 + iz + 400) % 4]);
      if (canal) {
        box(ix, -.245, iz, 1.01, .08, 1.01, 0xb7c0a8);
      } else {
        const isGreen = edge > .85 || (ix < -6 && iz > 7) || (ix > 7 && iz > 7);
        box(ix, top + .065, iz, 1.01, .13, 1.01, isGreen ?
          [0xa6bb8b, 0x9db483, 0xb0c295][(ix + iz + 400) % 3] : 0xd9d5ba);
      }
    }
  }

  // The roads remain narrow enough that buildings, courtyards and trees dominate.
  box(-3.82, .367, 2.25, 15.3, .06, 2.06, palette.road);
  box(9.15, .367, 2.25, 5.3, .06, 2.06, palette.road);
  box(-5.15, .367, -.1, 1.82, .06, 18.4, palette.road);
  box(-3.75, .399, 3.43, 15.5, .1, .25, palette.pale);
  box(-3.75, .399, 1.07, 15.5, .1, .25, palette.pale);
  box(-6.25, .399, -.2, .25, .1, 18.4, palette.pale);
  box(-4.05, .399, -.2, .25, .1, 18.4, palette.pale);
  for (let x = -10.5; x < 11.2; x += 1.25) {
    if (x > 3.15 && x < 6.85) continue;
    box(x, .403, 2.25, .5, .018, .065, palette.line);
  }
  for (let z = -8.2; z < 8.5; z += 1.25) {
    if (z > .6 && z < 3.7) continue;
    box(-5.15, .404, z, .065, .018, .45, palette.line);
  }
  for (let n = 0; n < 5; n++) {
    box(-6.1 + n * .44, .409, 3.02, .22, .02, .58, palette.pale);
    box(-3.45, .409, 1.36 + n * .44, .6, .02, .22, palette.pale);
  }

  // A long blue canal cuts through the neighbourhood, with stone quay walls.
  const waterMaterial = new THREE.MeshStandardMaterial({ color: palette.water, roughness: .38, metalness: .02 });
  const water = new THREE.Mesh(boxGeometry, waterMaterial);
  water.name = 'City canal';
  water.position.set(5, .10, 0);
  water.scale.set(3.01, .10, 20.96);
  water.receiveShadow = true;
  group.add(water);
  [-1, 1].forEach(side => {
    const x = 5 + side * 1.67;
    box(x, .10, 0, .27, .59, 20.7, palette.stone);
    box(x, .425, 0, .42, .13, 20.7, palette.pale);
    for (let z = -9.5; z <= 9.5; z++) {
      box(x, .17, z, .29, .025, .82, 0xb4b199);
    }
  });

  function bridge(z, street = false) {
    const width = street ? 2.45 : 1.1;
    box(5, .43, z, 3.85, .23, width, street ? palette.road : palette.wood);
    if (!street) {
      for (let x = 3.16; x <= 6.9; x += .22) box(x, .565, z, .15, .04, width, 0xd6b58b);
    } else {
      for (let x = 3.5; x < 7; x += .85) box(x, .558, z, .4, .02, .065, palette.pale);
    }
    [-1, 1].forEach(side => {
      const railZ = z + side * (width / 2 + .025);
      box(5, 1.08, railZ, 3.95, .085, .075, street ? palette.pale : 0xc2a27b);
      for (let x = 3.1; x <= 6.95; x += .55) {
        box(x, .82, railZ, .065, .55, .065, street ? palette.stone : palette.wood);
      }
    });
    [3.65, 6.35].forEach(x => box(x, -.08, z, .28, .9, width * .72, palette.stone));
  }
  bridge(2.25, true);
  bridge(-7.4);

  function planter(x, y, z, width = .6, color = palette.coral) {
    box(x, y + .14, z, width, .28, width, color);
    box(x, y + .28, z, width + .05, .09, width + .05, palette.cream);
    box(x, y + .43, z, width * .8, .27, width * .8, palette.green);
    box(x + width * .14, y + .6, z - width * .08, width * .54, .18, width * .54, palette.lightGreen);
  }
  function roofGarden(x, y, z, w, d) {
    box(x, y + .06, z, w - .3, .1, d - .3, 0xc9c4ac);
    [-1, 1].forEach(side => {
      box(x + side * (w / 2 - .1), y + .2, z, .12, .3, d, palette.pale);
      box(x, y + .2, z + side * (d / 2 - .1), w, .3, .12, palette.pale);
    });
    planter(x - w * .3, y + .14, z + d * .24, .52);
    planter(x + w * .3, y + .14, z + d * .24, .52, palette.sage);
    box(x + .35, y + .26, z - d * .23, .75, .38, .65, palette.edge);
    box(x + .35, y + .475, z - d * .23, .84, .07, .72, palette.cream);
    for (let i = 0; i < 3; i++) box(x + .12 + i * .23, y + .52, z - d * .23, .07, .02, .5, 0x86978e);
  }
  function building({ x, z, w, d, h, color, roof = palette.pale, shop = false, floors = 3 }) {
    const base = groundY + .08;
    shadowFootprints.push({ x: x + .18, y: .367, z: z + .22, w: w + 1.8, d: d + 1.8 });
    box(x, base - .035, z, w + .34, .16, d + .3, palette.pale);
    box(x, base + h / 2, z, w, h, d, color);
    box(x, base + h - .11, z, w + .12, .13, d + .12, palette.cream);
    box(x, base + h + .06, z, w + .28, .18, d + .26, roof);
    const cols = Math.max(2, Math.floor(w / .78));
    const sideCols = Math.max(2, Math.floor(d / .8));
    const rowH = h / floors;
    for (let row = 0; row < floors; row++) {
      const y = base + .42 + row * rowH;
      const winH = Math.min(.64, rowH * .57);
      for (let col = 0; col < cols; col++) {
        const wx = x + (col - (cols - 1) / 2) * (w / cols);
        box(wx, y, z + d / 2 + .019, w / cols * .56, winH, .045,
          (row + col) % 3 === 0 ? palette.darkGlass : palette.glass);
        box(wx, y - winH / 2 - .045, z + d / 2 + .055, w / cols * .71, .08, .13, palette.pale);
      }
      for (let col = 0; col < sideCols; col++) {
        const wz = z + (col - (sideCols - 1) / 2) * (d / sideCols);
        box(x + w / 2 + .019, y, wz, .045, winH, d / sideCols * .55, palette.glass);
        box(x + w / 2 + .055, y - winH / 2 - .045, wz, .13, .08, d / sideCols * .7, palette.cream);
      }
      if (row > 0) box(x, base + row * rowH, z + d / 2 + .04, w, .065, .09, palette.cream);
    }
    box(x - w * .19, base + .46, z + d / 2 + .04, .52, .92, .08, palette.darkGlass);
    box(x - w * .19, base + .96, z + d / 2 + .07, .69, .09, .18, palette.pale);
    box(x - w * .32, base + .46, z + d / 2 + .085, .045, .65, .03, palette.cream);
    if (shop) {
      const awningWidth = w * .84;
      for (let i = 0; i < 8; i++) {
        box(x - awningWidth / 2 + (i + .5) * awningWidth / 8, base + 1.12,
          z + d / 2 + .33, awningWidth / 8, .12, .74, i % 2 ? palette.pale : palette.coralDark);
      }
      box(x, base + 1.37, z + d / 2 + .06, w * .54, .24, .1, roof);
      for (let i = 0; i < 4; i++) box(x - .31 + i * .2, base + 1.37, z + d / 2 + .12, .11, .055, .025, palette.pale);
    }
    roofGarden(x, base + h + .16, z, w, d);
    return base + h;
  }

  building({ x: -8.55, z: -6.25, w: 3.25, d: 3.15, h: 3.3, color: palette.cream, floors: 3 });
  building({ x: -8.5, z: -1.65, w: 3.25, d: 2.85, h: 4.2, color: palette.coral, floors: 4, shop: true });
  building({ x: -8.45, z: 5.75, w: 3.3, d: 3.15, h: 2.45, color: palette.sage, floors: 2, shop: true });
  building({ x: -2.25, z: -6.35, w: 2.65, d: 3.35, h: 5.3, color: palette.lilac, floors: 5 });
  const towerTop = building({ x: .68, z: -6.5, w: 2.6, d: 3.05, h: 6.7, color: palette.cream, roof: palette.sage, floors: 6 });
  // A stepped crown, antenna and tiny roof beacon make the skyline recognisable.
  box(.68, towerTop + .72, -6.75, 1.58, .95, 1.7, palette.sage);
  box(.68, towerTop + 1.24, -6.75, 1.75, .11, 1.88, palette.pale);
  box(.85, towerTop + 1.92, -6.8, .065, 1.3, .065, palette.metal);
  box(.85, towerTop + 2.6, -6.8, .15, .12, .15, palette.coral);
  building({ x: -.78, z: -1.4, w: 4.9, d: 2.8, h: 3.25, color: 0xb8c2ad, floors: 3 });
  building({ x: -1.5, z: 5.75, w: 4.2, d: 3.05, h: 2.35, color: palette.coral, roof: palette.lilac, floors: 2, shop: true });
  building({ x: 9.1, z: -6.3, w: 3.2, d: 3.25, h: 4.25, color: palette.sage, floors: 4 });
  building({ x: 9.05, z: -1.55, w: 3.15, d: 2.85, h: 3.15, color: palette.cream, roof: palette.lilac, floors: 3, shop: true });
  building({ x: 9, z: 5.65, w: 3.1, d: 3.05, h: 2.3, color: palette.lilac, floors: 2 });

  // Sunshade, outdoor worktables and rooftop solar panels reward the final approach.
  [-1, 1].forEach(side => {
    box(-1.5 + side * 1.45, 3.7, 5.5, .09, 1.65, .09, palette.cream);
    box(-1.5 + side * 1.45, 3.7, 6.5, .09, 1.65, .09, palette.cream);
  });
  for (let z = 5; z < 7; z += .26) box(-1.5, 4.56, z, 3.3, .08, .12, palette.wood);
  for (let x = 8.25; x <= 9.8; x += .55) {
    box(x, 5.0, -6.75, .45, .12, 1.35, 0x698a98);
    box(x, 5.075, -6.75, .025, .025, 1.3, 0xb7c8cd);
  }

  function tree(x, z, size = 1, y = terrainTop(x, z)) {
    shadowFootprints.push({ x: x + .2, y: y + .014, z: z + .15, w: size * 1.8, d: size * 1.8 });
    box(x, y + .56 * size, z, .21 * size, 1.12 * size, .21 * size, palette.bark);
    box(x, y + 1.38 * size, z, .92 * size, .95 * size, .95 * size, palette.green);
    box(x + .14 * size, y + 2.0 * size, z - .08 * size, .69 * size, .42 * size, .72 * size, palette.lightGreen);
    box(x - .43 * size, y + 1.34 * size, z + .15 * size, .5 * size, .56 * size, .58 * size, palette.darkGreen);
  }
  [
    [-11.25, -4.3, .85], [-11.2, -.25, .85], [-11.05, 4.2, .9], [-9.8, 8.6, .85],
    [-7.3, 8.5, .75], [-3.3, 8.8, .7], [0, 8.7, .86], [2.3, 6.6, .85],
    [2.25, -3.65, .73], [-3.3, -3.6, .75], [-3.65, .1, .65], [-3.4, 4.3, .7],
    [7.15, 8.6, .8], [10.1, 8.65, .8], [11.3, 4.4, .72], [11.25, -3.7, .72],
    [7.3, -4.0, .6], [-7.1, -8.8, .7], [-.9, -9, .72], [8.4, -9, .7]
  ].forEach(args => tree(...args));

  function bench(x, z, sideways = false) {
    if (sideways) {
      box(x, groundY + .4, z, .36, .12, 1.05, palette.wood);
      box(x - .18, groundY + .65, z, .08, .36, 1.05, 0xcba77b);
      [-.38, .38].forEach(off => box(x, groundY + .18, z + off, .3, .35, .09, palette.metal));
    } else {
      box(x, groundY + .4, z, 1.05, .12, .36, palette.wood);
      box(x, groundY + .65, z - .18, 1.05, .36, .08, 0xcba77b);
      [-.38, .38].forEach(off => box(x + off, groundY + .18, z, .09, .35, .3, palette.metal));
    }
  }
  bench(2.5, -.65, true);
  bench(7.2, 5.1, true);
  bench(-2.8, 8.15);
  bench(-9.6, 8.1);
  [[2.5, -5.2], [2.5, 4.7], [7.2, -8.8], [7.25, -.2], [-7.2, 4.2], [-3.45, -.25], [1.7, 8.25]].forEach(([x, z], i) => planter(x, groundY, z, .55, i % 2 ? palette.lilac : palette.coral));

  [[-6.45, -4], [-6.45, 5.5], [-3.85, -7.8], [-3.85, .55], [2.8, .6], [7.2, 3.8], [10.8, .6]].forEach(([x, z]) => {
    box(x, groundY + .12, z, .3, .24, .3, palette.stone);
    box(x, groundY + 1.1, z, .065, 2, .065, palette.metal);
    box(x + .16, groundY + 2.1, z, .38, .065, .09, palette.metal);
    box(x + .25, groundY + 2.04, z, .24, .1, .2, 0xf4e7c5);
  });

  // Public square beside the canal: tiled paving, a little fountain and café seats.
  for (let ix = 0; ix < 5; ix++) {
    for (let iz = 0; iz < 3; iz++) box(.2 + ix * .48, .404, 8.0 + iz * .48, .44, .07, .44, (ix + iz) % 2 ? 0xe4ddc6 : 0xd3d0b6);
  }
  box(1.1, .49, 8.6, 1.18, .2, 1.18, palette.pale);
  box(1.1, .61, 8.6, .92, .08, .92, palette.water);
  box(1.1, .85, 8.6, .2, .48, .2, palette.cream);
  box(1.1, 1.13, 8.6, .38, .09, .38, palette.pale);
  [[-9.3, 3.95], [-7.85, 3.95], [8.2, .45], [9.55, .45]].forEach(([x, z]) => {
    box(x, .86, z, .68, .09, .55, palette.wood);
    box(x, .63, z, .08, .4, .08, palette.metal);
    [-.42, .42].forEach(off => {
      box(x + off, .69, z, .27, .09, .28, palette.coral);
      box(x + off, .5, z, .05, .34, .05, palette.metal);
    });
  });

  function car(x, z, color, sideways = false) {
    const w = sideways ? 1.35 : .65;
    const d = sideways ? .65 : 1.35;
    box(x, .64, z, w, .34, d, color);
    box(x - (sideways ? .08 : 0), .91, z + (sideways ? 0 : .08), w * .62, .25, d * .62, palette.cream);
    if (sideways) box(x, .91, z + d / 2 + .01, w * .48, .15, .025, palette.glass);
    else box(x + w / 2 + .01, .91, z, .025, .15, d * .48, palette.glass);
    [-1, 1].forEach(side => {
      [-1, 1].forEach(end => {
        box(x + (sideways ? end * .42 : side * .32), .48, z + (sideways ? side * .32 : end * .42), .18, .22, .18, 0x69736d);
      });
    });
  }
  car(-1.6, 1.8, palette.coral, true);
  car(-5.55, -4.3, palette.lilac);
  car(8.9, 2.75, 0xb9c3a2, true);

  function person(x, z, color, y = groundY) {
    box(x, y + .46, z, .23, .32, .2, color);
    box(x, y + .74, z, .21, .21, .21, 0xcda883);
    box(x, y + .85, z - .02, .23, .07, .23, 0x7b8265);
    [-1, 1].forEach(side => box(x + side * .066, y + .18, z, .065, .27, .1, 0x687a75));
  }
  person(-6.8, 3.7, palette.coral);
  person(2.65, -2.3, palette.lilac);
  person(7.25, 5.8, palette.coral);
  person(-2.3, 8.1, palette.sage);
  person(5.25, 2.5, palette.lilac, .57);

  // A tiny mooring and a canal skiff connect this world to the ocean journey.
  for (let z = 5.1; z <= 7.2; z += .21) box(3.9, .39, z, 1.25, .1, .14, palette.wood);
  [5.2, 7.1].forEach(z => box(4.3, .34, z, .12, .9, .12, palette.bark));
  box(5.1, .29, 6.25, .8, .25, 1.7, palette.coral);
  box(5.1, .45, 6.25, .58, .16, 1.4, palette.cream);
  box(5.1, .55, 6.2, .62, .08, .19, palette.wood);
  box(5.1, .4, 7.12, .5, .23, .22, palette.coralDark);

  const solidMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88, metalness: 0 });
  const cityMesh = new THREE.InstancedMesh(boxGeometry, solidMaterial, blocks.length);
  cityMesh.name = 'City architecture and street life';
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  blocks.forEach((block, index) => {
    dummy.position.set(block.x, block.y, block.z);
    dummy.scale.set(block.sx, block.sy, block.sz);
    dummy.updateMatrix();
    cityMesh.setMatrixAt(index, dummy.matrix);
    cityMesh.setColorAt(index, tint.setHex(block.color));
  });
  cityMesh.instanceMatrix.needsUpdate = true;
  cityMesh.instanceColor.needsUpdate = true;
  cityMesh.castShadow = true;
  cityMesh.receiveShadow = true;
  cityMesh.computeBoundingSphere();
  group.add(cityMesh);

  // Soft baked contact shadows keep the city grounded without a shadow map.
  const shadowData = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const distance = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
      const alpha = Math.max(0, 1 - distance);
      const offset = (y * 32 + x) * 4;
      shadowData[offset] = 255;
      shadowData[offset + 1] = 255;
      shadowData[offset + 2] = 255;
      shadowData[offset + 3] = Math.round(alpha * alpha * 255);
    }
  }
  const shadowTexture = new THREE.DataTexture(shadowData, 32, 32, THREE.RGBAFormat);
  shadowTexture.magFilter = THREE.LinearFilter;
  shadowTexture.minFilter = THREE.LinearFilter;
  shadowTexture.needsUpdate = true;
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x5e6654, map: shadowTexture, transparent: true, opacity: .36, depthWrite: false
  });
  const contactShadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, shadowFootprints.length);
  contactShadows.name = 'Baked city contact shadows';
  shadowFootprints.forEach((footprint, index) => {
    dummy.position.set(footprint.x, footprint.y, footprint.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(footprint.w, footprint.d, 1);
    dummy.updateMatrix();
    contactShadows.setMatrixAt(index, dummy.matrix);
  });
  contactShadows.instanceMatrix.needsUpdate = true;
  contactShadows.computeBoundingSphere();
  group.add(contactShadows);

  const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0xc9e2db, transparent: true, opacity: .68 });
  const ripples = [];
  [-9, -5.5, -3.4, -.6, 4.1, 8.3].forEach((z, index) => {
    const ripple = new THREE.Mesh(boxGeometry, rippleMaterial);
    ripple.position.set(4.4 + index % 2 * .9, .165, z);
    ripple.scale.set(.65, .014, .035);
    group.add(ripple);
    ripples.push(ripple);
  });

  group.userData.bounds = { width: 25.01, depth: 21.01, minY: -1.65, maxY: 9.85 };
  group.userData.recommendedCamera = { position: [30, 25, 35], target: [0, 2, 0] };
  group.userData.instanceCount = blocks.length;
  let disposed = false;
  return {
    group,
    update(time, reducedMotion = false) {
      const t = reducedMotion ? 0 : time;
      ripples.forEach((ripple, index) => {
        ripple.scale.x = .61 + Math.sin(t * .7 + index * 1.8) * .1;
        ripple.position.x = 4.4 + index % 2 * .9 + Math.sin(t * .3 + index) * .1;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cityMesh.dispose();
      contactShadows.dispose();
      boxGeometry.dispose();
      solidMaterial.dispose();
      waterMaterial.dispose();
      rippleMaterial.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      shadowTexture.dispose();
      group.clear();
    }
  };
}
