import * as THREE from '../../vendor/three.module.js';

export function createWorld(canvas, container, reduced) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.setClearColor(0xf0f0e9, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.23;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-12, 12, 12, -12, .1, 150);
  camera.position.set(19, 20, 23);
  const target = new THREE.Vector3(0, 1, 0);
  const targetGoal = target.clone();
  const cameraGoal = camera.position.clone();
  let zoomGoal = 1;
  let currentChapter = 0;
  let width = 1;
  let height = 1;
  let pointerX = 0;
  let pointerY = 0;

  scene.add(new THREE.HemisphereLight(0xfffaed, 0x778b69, 2.5));
  const sun = new THREE.DirectionalLight(0xfff5df, 3.4);
  sun.position.set(-8, 18, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.normalBias = .035;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe9efff, 1.3);
  fill.position.set(7, 6, -9);
  scene.add(fill);

  const group = new THREE.Group();
  group.rotation.y = -.08;
  scene.add(group);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map();
  function material(color, roughness = .85) {
    const key = `${color}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
    return materials.get(key);
  }
  function box(x, y, z, sx, sy, sz, color, parent = group, shadow = true) {
    const mesh = new THREE.Mesh(boxGeometry, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x647157, opacity: .11 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.23;
  ground.receiveShadow = true;
  scene.add(ground);

  const terrain = [];
  const terrainSize = .84;
  function islandHeight(x, z) {
    const nx = x / 7.6;
    const nz = z / 6.1;
    if (Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(nz), 4) > 1 || (x < -5.7 && z > 3.8) || (x > 5.9 && z < -4)) return 0;
    let h = 1.05;
    if (Math.abs(x) > 5.8 || Math.abs(z) > 4.8) h = .6;
    const hill = Math.max(Math.abs((x + 3.2) / 1.1), Math.abs((z + 3.45) / 1.05));
    if (hill < 3.5) h += Math.max(0, 3 - Math.floor(hill)) * .66;
    if (x > -4.4 && x < -.75 && z > -2.05 && z < 1.5) h = 1.05;
    if (x > 2 && z < -1.8) h = 1.6;
    if (x > 1.15 && z > .9 && x < 5.7 && z < 4.9) h = .63;
    if (x > 2.75 && x < 4.65 && z > -2.1 && z < 1.4) h = .63;
    return h;
  }
  const stone = [0xb5b49c, 0xc4c0a5, 0xa6a88f, 0xb9b79d];
  const greens = [0x9eb881, 0xa6bd89, 0x9bb47c, 0xa3ba84];
  for (let ix = -9; ix <= 9; ix++) {
    for (let iz = -7; iz <= 7; iz++) {
      const x = ix * terrainSize;
      const z = iz * terrainSize;
      const h = islandHeight(x, z);
      if (!h) continue;
      const waterbed = h < .7 && x > 1;
      terrain.push({ x, y: h / 2 - .1, z, sx: .848, sy: h, sz: .848, color: stone[(ix * 17 + iz * 3 + 250) % 4] });
      terrain.push({ x, y: h - .04, z, sx: .85, sy: .14, sz: .85, color: waterbed ? 0xc3c2a2 : greens[(ix * 13 + iz * 7 + 250) % 4] });
    }
  }
  const terrainMesh = new THREE.InstancedMesh(boxGeometry, new THREE.MeshStandardMaterial({ roughness: .95 }), terrain.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  terrain.forEach((voxel, index) => {
    position.set(voxel.x, voxel.y, voxel.z);
    scale.set(voxel.sx, voxel.sy, voxel.sz);
    matrix.compose(position, quaternion, scale);
    terrainMesh.setMatrixAt(index, matrix);
    terrainMesh.setColorAt(index, new THREE.Color(voxel.color));
  });
  terrainMesh.castShadow = true;
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // The canal steps into a broad pool; translucent tiles keep its edges crisp.
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x79b8c4, roughness: .35, metalness: .05, transparent: true, opacity: .88 });
  const water = new THREE.Group();
  group.add(water);
  const waterTiles = [];
  for (let ix = 2; ix <= 6; ix++) {
    for (let iz = 2; iz <= 5; iz++) {
      const tile = new THREE.Mesh(boxGeometry, waterMaterial);
      tile.position.set(ix * .84, .76, iz * .84);
      tile.scale.set(.846, .13, .846);
      tile.receiveShadow = true;
      water.add(tile);
      waterTiles.push(tile);
    }
  }
  for (let iz = -2; iz <= 1; iz++) {
    for (let ix = 4; ix <= 5; ix++) {
      const tile = new THREE.Mesh(boxGeometry, waterMaterial);
      tile.position.set(ix * .84, .76, iz * .84);
      tile.scale.set(.846, .13, .846);
      tile.receiveShadow = true;
      water.add(tile);
      waterTiles.push(tile);
    }
  }
  const ripples = [];
  [[2.5, 2.3], [4.3, 3.5], [3.8, -.9], [1.9, 3.8], [4.8, 1.5]].forEach(([x, z], i) => {
    const ripple = box(x, .838, z, .65 + i * .05, .012, .027, 0xb7d9d8, group, false);
    ripples.push(ripple);
    box(x + .2, .839, z + .17, .3, .012, .023, 0xc2dfdc, group, false);
  });

  // A continuous pale path gives the tiny world a clear route.
  const pathColor = 0xdad5b6;
  [[-5, 1], [-4.15, 1], [-3.3, 1], [-2.45, 1], [-1.6, 1], [-.75, 1], [.1, 1], [.95, 1], [1.8, 1], [2.6, 1], [-3.3, .15], [-3.3, -.7], [-3.3, -1.55], [-3.3, -2.4], [.1, 1.85], [.1, 2.7], [.1, 3.55], [.1, 4.4]].forEach(([x, z]) => {
    const y = islandHeight(x, z);
    box(x, y + .056, z, .64, .1, .6, pathColor, group, false);
  });

  // Signal house: a coral pavilion with a deep roof and an open front.
  const pavilion = new THREE.Group();
  pavilion.position.set(-2.7, 1.08, -.7);
  group.add(pavilion);
  box(0, .1, 0, 3.15, .2, 2.25, 0xe5dfc2, pavilion);
  box(0, .75, -.7, 2.7, 1.35, .28, 0xd77d66, pavilion);
  box(-1.17, .75, .05, .26, 1.35, 1.6, 0xe49076, pavilion);
  box(1.17, .75, .05, .26, 1.35, 1.6, 0xc96f59, pavilion);
  [-1.12, 1.12].forEach(x => box(x, .77, .9, .13, 1.42, .13, 0xeee8d1, pavilion));
  box(0, 1.54, .05, 3.1, .23, 2.3, 0xf2ead5, pavilion);
  box(0, 1.71, .05, 3.18, .15, 2.38, 0xa6b69b, pavilion);
  box(0, .37, -.35, 1.6, .3, .48, 0xb3b78e, pavilion);
  box(0, .55, -.35, 1.7, .09, .6, 0xf1e8ce, pavilion);
  box(.45, .66, -.39, .32, .15, .25, 0x8f97b8, pavilion);
  box(-.37, .65, -.34, .37, .12, .28, 0xd7a173, pavilion);
  box(0, .09, 1.47, 2.1, .17, .45, 0xd9d3b6, pavilion);
  box(0, -.01, 1.77, 1.8, .13, .3, 0xcac6a8, pavilion);

  // The atelier has a lilac sign, a roof terrace and a little outdoor desk.
  const atelier = new THREE.Group();
  atelier.position.set(3.45, 1.65, -3.1);
  group.add(atelier);
  box(0, .65, 0, 2, 1.3, 1.8, 0xdad8c6, atelier);
  box(0, 1.38, 0, 2.23, .18, 2.05, 0x9ca1bf, atelier);
  box(0, 1.48, 0, 2.05, .1, 1.85, 0xb2b5d0, atelier);
  box(0, .67, .914, .9, .8, .035, 0x5b796c, atelier);
  box(0, .67, .945, .04, .8, .06, 0xe9e4d2, atelier);
  box(0, .67, .945, .9, .04, .06, 0xe9e4d2, atelier);
  box(-1.02, .65, 0, .035, .65, .9, 0x6c8b81, atelier);
  box(.67, 1.86, -.45, .1, .7, .1, 0x536b4d, atelier);
  box(.65, 2.1, -.43, .65, .35, .6, 0x6f8f55, atelier);
  box(-.65, 1.68, .45, .45, .3, .45, 0xd77d66, atelier);
  box(-.65, 1.91, .45, .58, .2, .58, 0x95ac73, atelier);
  box(-.58, .2, 1.35, 1.8, .1, .7, 0xe5dec6, atelier);
  box(-.58, .55, 1.54, .95, .08, .4, 0xc08e64, atelier);
  [-.94, -.22].forEach(x => box(x, .36, 1.54, .07, .4, .07, 0x8d8167, atelier));

  // A timber crossing joins the research house to the garden.
  for (let i = 0; i < 12; i++) {
    const x = 2.3 + i * .26;
    box(x, 1.25, .55, .225, .13, .85, i % 2 ? 0xd4ae7c : 0xcca16c);
  }
  [2.38, 3.15, 3.92, 4.69, 5.14].forEach(x => {
    [-.02, 1.11].forEach(z => box(x, 1.58, z, .065, .68, .065, 0xb28b61));
  });
  [-.02, 1.11].forEach(z => box(3.77, 1.86, z, 2.95, .065, .065, 0xd6b387));
  box(5.43, 1.1, .55, .45, .19, .85, 0xdcd4b5);

  // The high lookout is a landmark rather than a conventional sculpture.
  const lookout = new THREE.Group();
  lookout.position.set(-3.35, 3.08, -3.4);
  group.add(lookout);
  box(0, .03, 0, 1.5, .14, 1.3, 0xe1ddc5, lookout);
  box(-.4, .44, 0, .45, .75, .45, 0x8994b7, lookout);
  box(.06, .88, 0, .45, 1.63, .45, 0x9ba5c7, lookout);
  box(.52, 1.33, 0, .45, 2.5, .45, 0xb0b9d9, lookout);
  box(.52, 2.65, 0, .65, .12, .65, 0xe4e1ce, lookout);
  const flagpole = box(.53, 3.13, 0, .035, .9, .035, 0x737e63, lookout);
  const flag = box(.84, 3.37, 0, .6, .31, .045, 0xd9826e, lookout);

  // Garden: plots, a worktable, and a lilac shade structure on the water.
  const garden = new THREE.Group();
  garden.position.set(-.2, 1.05, 3.2);
  group.add(garden);
  [[-1.55, -.4], [-2.5, -.4], [-1.55, .55], [-2.5, .55]].forEach(([x, z], i) => {
    box(x, .11, z, .73, .16, .73, 0x8a8a64, garden);
    box(x, .25, z, .6, .15, .6, i % 2 ? 0xa8b48a : 0x7e9b65, garden);
    for (let j = 0; j < 3; j++) box(x - .18 + j * .18, .4 + j % 2 * .08, z, .1, .23, .35, i % 2 ? 0xada7bf : 0x6e8b51, garden);
  });
  box(.86, .17, .22, 1.2, .18, 2.2, 0xc89d71, garden);
  [-.15, .85].forEach(z => {
    box(.86, .45, z, 1, .1, .27, 0xd4ad80, garden);
    [.5, 1.22].forEach(x => box(x, .3, z, .07, .3, .07, 0xa38460, garden));
  });
  box(.86, .72, .35, .85, .09, .62, 0xdac19b, garden);
  box(.86, .55, .35, .1, .32, .1, 0x9a8462, garden);
  [[.35, -.45], [1.38, -.45], [.35, 1.1], [1.38, 1.1]].forEach(([x, z]) => box(x, 1.25, z, .08, 2.15, .08, 0xd6c5a4, garden));
  box(.86, 2.3, .35, 1.38, .13, 1.95, 0xa9aec8, garden);
  for (let z = -.48; z < 1.3; z += .3) box(.86, 2.39, z, 1.45, .06, .12, 0xc3c5d6, garden);

  function tree(x, z, size = 1, tint = 0x6f8b56) {
    const y = islandHeight(x, z);
    if (!y) return;
    const trunk = box(x, y + .5 * size, z, .18 * size, 1.02 * size, .18 * size, 0x9b8862);
    box(x, y + 1.23 * size, z, .88 * size, .88 * size, .88 * size, tint);
    box(x + .12 * size, y + 1.81 * size, z - .03 * size, .66 * size, .42 * size, .65 * size, 0x8aa16a);
    box(x - .45 * size, y + 1.1 * size, z + .12 * size, .48 * size, .5 * size, .55 * size, 0x7f9a60);
    trunk.userData.tree = true;
  }
  [[-6, -2, 1.05], [-5.8, 1.5, 1.3], [-5.3, 3, .78], [-.1, -4.5, 1.07], [1.3, -4, .76], [5.8, -1, .9], [5.8, 2.4, 1.12], [-.7, 4.9, .7], [-4.4, 4.25, .65], [-6.1, -3.7, .65]].forEach(args => tree(...args));

  // Small human details make the level feel lived in.
  function bench(x, y, z, angle = 0) {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    b.rotation.y = angle;
    group.add(b);
    box(0, .35, 0, 1.05, .11, .38, 0xc18b63, b);
    box(0, .61, -.18, 1.05, .35, .08, 0xd6a47a, b);
    [-.4, .4].forEach(x => box(x, .16, 0, .09, .3, .31, 0x797f69, b));
  }
  bench(-5.1, 1.09, -.4, Math.PI / 2);
  bench(.2, 1.09, -1.75, -.3);
  [[-4.7, 2.5], [.6, -3], [5.8, 3.65], [-.7, 4.2], [2, -4.7]].forEach(([x, z], i) => {
    const y = islandHeight(x, z);
    box(x, y + .15, z, .38, .3, .38, 0xdca57b);
    box(x, y + .42, z, .48, .32, .48, i % 2 ? 0x8f9c73 : 0xa3ab85);
  });
  [[-4.4, 1.2], [-.8, .65], [.2, 2.1], [5.2, -.4]].forEach(([x, z]) => {
    const y = islandHeight(x, z);
    box(x, y + .68, z, .065, 1.35, .065, 0x747f64);
    box(x, y + 1.35, z, .32, .18, .32, 0xeee6cf);
    box(x, y + 1.48, z, .39, .07, .39, 0x889573);
  });
  const walker = new THREE.Group();
  walker.position.set(-.1, 1.17, 1);
  group.add(walker);
  box(0, .47, 0, .21, .29, .2, 0xe18a6e, walker);
  box(0, .72, 0, .2, .2, .2, 0xc79970, walker);
  box(0, .85, -.015, .24, .075, .24, 0x7f8a5e, walker);
  [-.065, .065].forEach(x => box(x, .19, 0, .065, .27, .09, 0x606d69, walker));
  const stones = [[-7, 0], [-6.8, 3], [6.8, 1], [-3, 5.4], [1.1, -5.1]];
  stones.forEach(([x, z], i) => {
    const y = islandHeight(x, z);
    if (y) box(x, y + .16, z, .5, .3, .4, i % 2 ? 0xb4b5a2 : 0xc6c5b0);
  });

  const views = [
    { p: [20, 20, 24], t: [0, .8, 0], z: 1.05 },
    { p: [17, 18, 20], t: [-1.8, 1.8, -1.8], z: 1.15 },
    { p: [16, 14, 21], t: [-1.5, 1.0, -.8], z: 1.33 },
    { p: [20, 16, 16], t: [2.8, 1.25, -2.1], z: 1.39 },
    { p: [18, 18, 23], t: [-.1, .8, 2.0], z: 1.36 },
    { p: [22, 18, 16], t: [1.7, .9, .4], z: 1.2 },
    { p: [14, 23, 24], t: [0, .8, 0], z: 1.03 }
  ];
  const pins = [
    { element: container.querySelector('[data-pin="northstar"]'), point: new THREE.Vector3(-2.7, 3.3, -.7), chapter: 2 },
    { element: container.querySelector('[data-pin="lumen"]'), point: new THREE.Vector3(3.45, 3.6, -3.1), chapter: 3 },
    { element: container.querySelector('[data-pin="field-notes"]'), point: new THREE.Vector3(.66, 3.6, 3.55), chapter: 4 }
  ];
  const projected = new THREE.Vector3();
  let hidden = false;
  const clock = new THREE.Clock();

  function resize() {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const span = window.innerWidth < 760 ? 19.4 : 19.3;
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function setChapter(index, instant = false) {
    currentChapter = index;
    const view = views[index];
    cameraGoal.fromArray(view.p);
    targetGoal.fromArray(view.t);
    zoomGoal = view.z;
    if (window.innerWidth < 760) zoomGoal *= .96;
    if (instant || reduced.matches) {
      camera.position.copy(cameraGoal);
      target.copy(targetGoal);
      camera.zoom = zoomGoal;
      camera.updateProjectionMatrix();
    }
    pins.forEach(pin => pin.element.classList.toggle('visible', index === 0 || index === pin.chapter));
  }
  container.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const bounds = container.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - .5) * .65;
    pointerY = ((event.clientY - bounds.top) / bounds.height - .5) * .3;
  });
  container.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });

  function animate() {
    requestAnimationFrame(animate);
    if (hidden) return;
    const elapsed = clock.getElapsedTime();
    const blend = reduced.matches ? 1 : .045;
    camera.position.lerp(cameraGoal, blend);
    target.lerp(targetGoal, blend);
    camera.zoom += (zoomGoal - camera.zoom) * blend;
    camera.updateProjectionMatrix();
    camera.lookAt(target.x + (reduced.matches ? 0 : pointerX), target.y + (reduced.matches ? 0 : pointerY), target.z);
    if (!reduced.matches) {
      flag.rotation.y = Math.sin(elapsed * 1.4) * .05;
      ripples.forEach((ripple, i) => { ripple.scale.x = .7 + Math.sin(elapsed * .65 + i) * .07; });
      walker.rotation.y = Math.sin(elapsed * .17) * .18;
    }
    group.updateMatrixWorld();
    camera.updateMatrixWorld();
    pins.forEach(pin => {
      projected.copy(pin.point).applyMatrix4(group.matrixWorld).project(camera);
      pin.element.style.left = `${(projected.x * .5 + .5) * width}px`;
      pin.element.style.top = `${(-projected.y * .5 + .5) * height}px`;
    });
    renderer.render(scene, camera);
  }
  animate();
  return { setChapter };
}
