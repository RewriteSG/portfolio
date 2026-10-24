import * as THREE from './vendor/three.module.js';

const BLACK = 0x0a0a0a;
const STEP = 50;
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
let seed = 2015;
const random = (a, b) => {
  seed = (seed * 16807) % 2147483647;
  return a + (b - a) * (seed / 2147483647);
};

function lines(vertices, color = 0x7b7b7b, opacity = 0.5) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function textPanel(text, { x = 0, y = 0, z = 0, align = 'center', size = 50, rotation = 0 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const rows = text.split('\n');
  ctx.font = `${size}px 'Trebuchet MS', Arial, sans-serif`;
  const width = Math.ceil(Math.max(...rows.map(row => ctx.measureText(row).width))) + 24;
  const height = (size + 40) * rows.length + 20;
  canvas.width = width * 2;
  canvas.height = height * 2;
  ctx.scale(2, 2);
  ctx.font = `${size}px 'Trebuchet MS', Arial, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.fillStyle = '#c8c8c8';
  rows.forEach((row, i) => ctx.fillText(row, align === 'left' ? 8 : align === 'right' ? width - 8 : width / 2, i * (size + 40) + 8));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width / 20, height / 20), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotation;
  mesh.userData.title = true;
  return mesh;
}

// Read the reference's legacy JSON mesh data without depending on its old renderer.
function legacyGeometry(data) {
  const positions = [], normals = [];
  const uvLayers = (data.uvs || []).filter(layer => layer.length);
  let offset = 0;
  while (offset < data.faces.length) {
    const flags = data.faces[offset++];
    const count = flags & 1 ? 4 : 3;
    const indices = data.faces.slice(offset, offset + count);
    offset += count;
    if (flags & 2) offset++;
    if (flags & 4) offset += uvLayers.length;
    if (flags & 8) offset += count * uvLayers.length;
    let faceNormal = null, vertexNormals = null;
    if (flags & 16) faceNormal = data.faces[offset++];
    if (flags & 32) { vertexNormals = data.faces.slice(offset, offset + count); offset += count; }
    if (flags & 64) offset++;
    if (flags & 128) offset += count;
    const triangles = count === 4 ? [0, 1, 3, 1, 2, 3] : [0, 1, 2];
    for (const corner of triangles) {
      const index = indices[corner] * 3;
      positions.push(data.vertices[index], data.vertices[index + 1], data.vertices[index + 2]);
      const ni = (vertexNormals ? vertexNormals[corner] : faceNormal) * 3;
      if (data.normals?.length && Number.isFinite(ni)) normals.push(data.normals[ni], data.normals[ni + 1], data.normals[ni + 2]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geometry.computeVertexNormals();
  return geometry;
}

export async function createExperience(container, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(BLACK);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BLACK);
  scene.fog = new THREE.FogExp2(BLACK, 0.009);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 1100);
  camera.position.set(0, 0, 40);
  scene.add(new THREE.AmbientLight(0xffffff, 0.32));
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(0.2, 1, 0.5);
  scene.add(light);

  const loader = new THREE.TextureLoader();
  const loadTexture = async name => {
    try { const t = await loader.loadAsync(`./assets/${name}`); t.colorSpace = THREE.SRGBColorSpace; return t; }
    catch { return null; }
  };
  const [smokeMap, helloMap, ballMap, matcap, faceData, rockData, dropMap, beamMap, flareMap, cityData, shinyMatcap] = await Promise.all([
    loadTexture('smoke.png'), loadTexture('hello.png'), loadTexture('ball.png'), loadTexture('matcap.jpg'),
    fetch('./assets/face.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('./assets/rocks.json').then(r => r.ok ? r.json() : null).catch(() => null),
    loadTexture('drop.png'),
    loadTexture('laser-body.png'), loadTexture('laser-flare.png'),
    Promise.all(['grounds', 'buildings', 'towers'].map(name => fetch(`./assets/city-${name}.json`).then(r => r.ok ? r.json() : null).catch(() => null))),
    loadTexture('matcap-shiny.jpg'),
  ]);
  const groups = Array.from({ length: 14 }, (_, i) => {
    const group = new THREE.Group(); group.position.y = -i * STEP; group.visible = i === 0; scene.add(group); return group;
  });
  const animators = [];
  const animate = (index, fn) => animators.push({ index, fn });
  const material = (color = 0x999999, wireframe = false) => new THREE.MeshPhongMaterial({ color, shininess: 90, flatShading: true, wireframe, side: THREE.DoubleSide });

  const starPositions = [];
  for (let i = 0; i < 1000; i++) {
    starPositions.push(random(-90, 90), random(-740, 60), random(-100, 28));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdddddd, size: 0.23, transparent: true, opacity: 0.9, sizeAttenuation: true }));
  scene.add(stars);
  const streakData = [];
  for (let i = 0; i < 250; i++) {
    const x = random(-95, 95), y = random(-740, 60), z = random(-100, 25);
    streakData.push(x, y, z, x, y + random(0.1, 0.7), z);
  }
  const streaks = lines(streakData, 0xb8b8b8, 0.4); scene.add(streaks);

  function addSmoke(index, colored = false) {
    if (!smokeMap) return;
    const map = smokeMap.clone(); map.needsUpdate = true; map.repeat.set(1 / 8, 1 / 8);
    const placements = [[10.7, 3.9, 17.8, 2.7, 3.9], [-2.8, 2.6, -11, 0.7, 7.7], [13, 19.5, -1.3, 2, 2.7]];
    const meshes = placements.map(([x, y, z, rotation, scale], i) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.2, depthWrite: false, color: colored ? [0x808080, 0xaaaaaa, 0x888888][i] : z < 0 ? 0xffffff : 0x4c4c4c }));
      mesh.position.set(x, y, z); mesh.rotation.z = rotation; mesh.scale.setScalar(scale); groups[index].add(mesh); return mesh;
    });
    animate(index, time => {
      const frame = Math.floor(time / 0.05) % 64;
      map.offset.set((frame % 8) / 8, 1 - (Math.floor(frame / 8) + 1) / 8);
      meshes.forEach((mesh, i) => { mesh.rotation.z = placements[i][3] + Math.sin(time * 0.04) * 0.08; });
    });
  }
  addSmoke(0);
  let hello;
  if (helloMap) {
    helloMap.repeat.set(0.25, 0.1);
    hello = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: helloMap, transparent: true, depthWrite: false }));
    groups[0].add(hello);
    animate(0, time => { const f = reducedMotion ? 25 : Math.floor(time / 0.07) % 40; helloMap.offset.set((f % 4) / 4, 1 - (Math.floor(f / 4) + 1) / 10); });
  } else { groups[0].add(textPanel('H  E  L  L  O', { size: 65 })); }
  if (flareMap) {
    [[-11, -9, 7], [10, -15, 6]].forEach(([x, y, z], i) => {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
      cube.position.set(x, y, z); groups[0].add(cube);
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareMap, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); flare.scale.set(8, 8, 1); cube.add(flare);
      cube.add(lines([0, 0, 0, 0, 1.5, 0], 0x999999, 0.4));
      animate(0, t => { cube.rotation.set(t * 0.2, t * 0.3, 0); cube.position.y = y + Math.sin(t * 0.3 + i) * 0.5; });
    });
  }

  // Beams: sharp cones of light cutting through the smoke.
  addSmoke(1);
  const beams = new THREE.Group(); groups[1].add(beams);
  for (let i = 0; i < 3; i++) {
    const [x, y, z, width] = [[15, 25, -10, 2], [0, 15, 0, 4], [-20, 30, -20, 2]][i];
    const beam = new THREE.Group(); beam.position.set(x, y - 12, z); beams.add(beam);
    const body = new THREE.Mesh(new THREE.PlaneGeometry(width, 35), new THREE.MeshBasicMaterial({ map: beamMap, color: [0x808080, 0xffffff, 0x4c4c4c][i], transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); body.position.y = 12; beam.add(body);
    beam.add(lines([0, -5, 0, 0, 30, 0], 0xcccccc, 0.5));
    const cube = new THREE.Mesh(new THREE.BoxGeometry(width / 4, width / 4, width / 4), new THREE.MeshBasicMaterial({ color: 0xcccccc })); cube.position.y = -5; beam.add(cube);
    if (flareMap) { const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flare.position.y = -5; flare.scale.set(10, 10, 1); beam.add(flare); }
  }
  animate(1, t => { beams.children.forEach((beam, i) => { beam.position.y = [13, 3, 18][i] + Math.sin(t * 0.3 + i) * 2; beam.children[2].rotation.set(t * 0.2, t * 0.3, 0); }); });

  // A liquid idea becomes a tangible striped sphere.
  groups[2].add(textPanel('F  R  O  M\nA N   I D E A', { x: -15, y: 8, align: 'right' }));
  const drop = new THREE.Group();
  drop.rotation.x = -1.2; drop.position.y = -10; groups[2].add(drop);
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ map: dropMap, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    drop.add(ring);
  }
  animate(2, t => { drop.children.forEach((ring, i) => { const p = ((t + i * 0.1) % 1.5) / 1.5; ring.scale.setScalar(0.1 + p * (i + 1) * 4 / 6); ring.material.opacity = 1 - p; }); });

  if (ballMap) { ballMap.wrapS = ballMap.wrapT = THREE.RepeatWrapping; ballMap.repeat.set(1, 6); }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 32), new THREE.MeshBasicMaterial({ map: ballMap, color: ballMap ? 0xffffff : 0xcccccc }));
  ball.rotation.z = 2; groups[3].add(ball);
  groups[3].add(textPanel('G  I  V  E\nS  H  A  P  E', { x: 15, z: 15, align: 'left', rotation: -0.4 }));
  const gridVertices = [];
  for (let i = -5; i <= 5; i++) { gridVertices.push(i * 5, -30, 0, i * 5, 30, 0, -30, i * 5, 0, 30, i * 5, 0); }
  const ballGrid = lines(gridVertices, 0xaaaaaa, 0.4);
  ballGrid.rotation.set(1.5, 1, 2); ballGrid.position.x = -20; groups[3].add(ballGrid);
  animate(3, t => { ball.rotation.x = t * 0.65; ball.rotation.y = t * 0.3; if (ballMap) ballMap.repeat.y = 5.5 + Math.sin(t * 0.5) * 2; ballGrid.rotation.z = 2 + Math.sin(t * 0.2) * 0.2; });

  const fieldGroup = new THREE.Group(); groups[4].add(fieldGroup);
  const fieldSegments = [];
  for (let i = 0; i < 1500; i++) {
    const x = random(-55, 55), y = random(-28, 28), z = random(-35, 4);
    const a = Math.sin(x * 0.08) * Math.cos(y * 0.05) * 3;
    fieldSegments.push(x, y, z, x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, z);
  }
  fieldGroup.add(lines(fieldSegments, 0x888888, 0.32));
  groups[4].add(textPanel('F  O  L  L  O  W\nT  H  E    T  R  E  N  D  S', { z: 8, size: 44, rotation: 0.2 }));
  animate(4, t => { fieldGroup.rotation.z = Math.sin(t * 0.07) * 0.15; fieldGroup.position.x = Math.sin(t * 0.1) * 4; });

  addSmoke(5, true);
  const neons = new THREE.Group(); groups[5].add(neons);
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 20, 6), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
    mesh.position.set(0, [0, 0, 13, -13][i], -5); mesh.rotation.z = i === 0 ? 0 : 2; neons.add(mesh);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 20, 8), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.add(glow);
  }
  animate(5, t => { neons.rotation.z = Math.sin(t * 0.2) * 0.08; neons.children.forEach((n, i) => { n.visible = Math.sin(t * 3 + i * 0.8) > -0.85; }); });

  const heightVertices = [], heightCount = 90;
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < heightCount - 1; col++) {
      const x = (col / (heightCount - 1) - 0.5) * 50, z = (row / 39 - 0.5) * 35;
      heightVertices.push(x, 0, z, x + 50 / (heightCount - 1), 0, z);
    }
  }
  const terrain = lines(heightVertices, 0xaaaaaa, 0.65);
  terrain.rotation.set(0.35, -0.6, 0); terrain.position.set(10, -2, -10); groups[6].add(terrain);
  const hPositions = terrain.geometry.attributes.position;
  animate(6, t => {
    for (let i = 0; i < hPositions.count; i++) {
      const x = hPositions.getX(i), z = hPositions.getZ(i);
      const d = Math.sqrt((x + Math.sin(t * 0.35) * 8) ** 2 + z * z);
      hPositions.setY(i, Math.sin(d * 0.45 - t) * Math.exp(-d * 0.045) * 6 + Math.sin(x * 0.16 + t * 0.2) * 2);
    }
    hPositions.needsUpdate = true;
  });
  groups[6].add(textPanel('L  E  T    I  T\nM  O  R  P  H', { x: -21, align: 'right', z: 3 }));

  const wave = new THREE.Group(); groups[7].add(wave);
  const waveMeshes = [];
  for (let row = 0; row < 45; row++) {
    const points = [];
    for (let col = 0; col < 100; col++) points.push(new THREE.Vector3((col - 50) * 1.5, -12, (row - 20) * 2));
    const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.45 }));
    wave.add(mesh); waveMeshes.push(mesh);
  }
  groups[7].add(textPanel('E  Y  E  S    O  N    T  H  E\nH  O  R  I  Z  O  N', { y: 9, size: 42 }));
  animate(7, t => waveMeshes.forEach((mesh, row) => {
    const p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, -14 + Math.sin(i * 0.08 + row * 0.13 - t * 0.5) * 3 + Math.sin(i * 0.04 + t * 0.3) * 4);
    p.needsUpdate = true;
  }));

  const faceGeo = faceData ? legacyGeometry(faceData) : new THREE.IcosahedronGeometry(12, 2);
  faceGeo.computeBoundingBox();
  const fSize = new THREE.Vector3(); faceGeo.boundingBox.getSize(fSize); faceGeo.center();
  const reflectionMaterial = shinyMatcap ? new THREE.ShaderMaterial({
    uniforms: { image: { value: shinyMatcap } },
    vertexShader: `varying vec2 reflectionUv; void main() { vec4 viewPosition = modelViewMatrix * vec4(position, 1.0); vec3 ray = reflect(normalize(viewPosition.xyz), normalize(normalMatrix * normal)); reflectionUv = ray.xy / (2.0 * length(vec3(ray.xy, ray.z + 1.0))) + 0.5; gl_Position = projectionMatrix * viewPosition; }`,
    fragmentShader: `uniform sampler2D image; varying vec2 reflectionUv; void main() { gl_FragColor = vec4(texture2D(image, reflectionUv).rgb, 1.0); }`,
  }) : material(0x595959);
  const face = new THREE.Mesh(faceGeo, reflectionMaterial);
  face.scale.set(1.5, 1.5, 1); face.rotation.set(-0.1, 0, 0.25); face.position.set(-1, -1, 0); groups[8].add(face);
  groups[8].add(textPanel('K  E  E  P\nT  R  Y  I  N  G', { x: 24, align: 'left', rotation: -0.4 }));
  const strips = new THREE.Group(); groups[8].add(strips);
  for (let i = 0; i < 10; i++) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(random(2, 12), random(0.3, 2)), new THREE.MeshBasicMaterial({ color: [0x222222, 0x333333, 0x171717][i % 3], side: THREE.DoubleSide }));
    strip.position.set(random(-36, 36), random(-25, 25), random(-5, 12)); strips.add(strip);
  }
  animate(8, t => { face.rotation.y = Math.sin(t * 0.25) * 0.25; face.position.y = -1 + Math.sin(t * 0.5) * 0.5; strips.children.forEach((s, i) => { s.position.x += Math.sin(t + i) * 0.007; }); });

  const rocks = new THREE.Group(); groups[9].add(rocks);
  if (rockData) {
    const geo = legacyGeometry(rockData); geo.center(); geo.computeBoundingBox();
    const size = new THREE.Vector3(); geo.boundingBox.getSize(size);
    const rock = new THREE.Mesh(geo, material(0x777777)); rock.scale.setScalar(70 / Math.max(size.x, size.y, size.z)); rocks.add(rock);
  } else {
    for (let i = 0; i < 25; i++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(random(1, 4), 0), material(0x777777)); r.position.set(random(-30, 30), random(-20, 20), random(-15, 4)); rocks.add(r); }
  }
  groups[9].add(textPanel('K  E  E  P\nL  E  A  R  N  I  N  G', { z: 16, size: 45 }));
  animate(9, t => { rocks.rotation.y = t * 0.06; rocks.rotation.x = Math.sin(t * 0.1) * 0.1; });

  const galaxy = new THREE.Group(); groups[10].add(galaxy);
  const orbiting = [];
  [8, 10, 16, 25, 31].forEach((radius, i) => {
    const points = [], colors = [];
    for (let n = 0; n <= 100; n++) {
      const a = n / 100 * TAU; points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
      const c = new THREE.Color().setScalar(0.08 + Math.max(0, 1 - n / 30) * 0.7); colors.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true })); orbit.rotation.z = random(0, TAU); galaxy.add(orbit);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry([1, 0.5, 2.5, 3.5, 2.5][i], 24, 16), material([0xffffff, 0x4c4c4c, 0x4c4c4c, 0xffffff, 0x111111][i]));
    galaxy.add(sphere); orbiting.push({ sphere, radius, phase: random(0, TAU), speed: [-1.8, -1.8, -1.2, -0.6, -3][i] });
  });
  galaxy.rotation.set(-1, 0.2, 0); galaxy.position.y = -3;
  groups[10].add(textPanel('W  O  R  K\nA  S    A    T  E  A  M', { y: 18, z: -14 }));
  animate(10, t => { orbiting.forEach(({ sphere, radius, phase, speed }) => sphere.position.set(Math.cos(t * speed + phase) * radius, Math.sin(t * speed + phase) * radius, 0)); });

  const gravityVertices = [];
  for (let row = -24; row <= 24; row++) for (let col = -24; col < 24; col++) {
    gravityVertices.push(col * 2, 0, row * 2, (col + 1) * 2, 0, row * 2);
    gravityVertices.push(row * 2, 0, col * 2, row * 2, 0, (col + 1) * 2);
  }
  const gravity = lines(gravityVertices, 0x888888, 0.6); gravity.rotation.x = 0.3; gravity.position.y = -4; groups[11].add(gravity);
  const gp = gravity.geometry.attributes.position;
  const gravityBall = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 24), matcap ? new THREE.MeshMatcapMaterial({ matcap }) : material());
  gravityBall.position.set(0, -3, 0); groups[11].add(gravityBall);
  animate(11, t => {
    const bx = Math.sin(t * 0.3) * 10, bz = Math.cos(t * 0.3) * 5; gravityBall.position.x = bx; gravityBall.position.z = bz;
    for (let i = 0; i < gp.count; i++) { const d = Math.hypot(gp.getX(i) - bx, gp.getZ(i) - bz); gp.setY(i, -12 * Math.exp(-d * d / 100)); }
    gp.needsUpdate = true;
  });

  const city = new THREE.Group(); groups[12].add(city);
  if (cityData.every(Boolean)) {
    cityData.forEach(data => {
      const geo = legacyGeometry(data);
      city.add(new THREE.Mesh(geo, material(0x333333)));
      city.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.42 })));
    });
  } else {
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const cityMat = material(0x555555);
  const buildings = new THREE.InstancedMesh(buildingGeo, cityMat, 200);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 200; i++) {
    const x = (i % 20 - 10) * 3.2, z = (Math.floor(i / 20) - 5) * 3.2, h = random(1, 12);
    dummy.position.set(x, h / 2 - 12, z); dummy.scale.set(random(1.2, 2.5), h, random(1.2, 2.5)); dummy.updateMatrix(); buildings.setMatrixAt(i, dummy.matrix);
  }
  city.add(buildings);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.5, 30, 8), material(0x999999)); tower.position.set(0, 1, 0); city.add(tower);
  for (const [y, r] of [[-1, 3], [9, 2.1]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material(0x999999)); m.position.y = y; city.add(m); }
  }
  city.rotation.set(0, 0, Math.PI / 16); city.position.set(5, -10, 0);
  animate(12, t => { city.rotation.y = t * TAU / 30; });

  groups[13].add(textPanel('T  H  A  N  K  S\nF  O  R    W  A  T  C  H  I  N  G', { size: 48 }));
  const shards = new THREE.Group(); groups[13].add(shards);
  for (let i = 0; i < 50; i++) {
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(3), material(0x999999));
    shard.position.set(random(-50, 50), random(-50, 50), random(-50, 20)); shard.scale.setScalar(random(0.6, 1)); shard.lookAt(0, 0, 0); shards.add(shard);
  }
  animate(13, t => { shards.rotation.y = t * 0.035; });

  let width = 0, height = 0, quality = 1, frameId = null;
  let paused = false, target = 0, previous = 0, startY = 0, transitionStart = -10000, transitioning = false;
  let pointerX = 0, elapsed = 0, lastTime = performance.now(), disposed = false;
  const duration = reducedMotion ? 1 : 1500;
  const titleTransforms = [];
  groups.forEach(group => group.children.filter(child => child.userData.title).forEach(title => {
    titleTransforms.push({ title, position: title.position.clone(), rotation: title.rotation.clone(), scale: title.scale.clone() });
  }));
  function resize() {
    width = container.clientWidth || window.innerWidth; height = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * quality);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    const portrait = width < height;
    camera.fov = portrait ? 70 : 60;
    camera.position.z = portrait ? 70 : 40;
    titleTransforms.forEach(({ title, position, rotation, scale }) => {
      if (portrait) {
        title.position.set(0, -22, 12); title.rotation.set(0, 0, 0);
        const available = 2 * (camera.position.z - 12) * Math.tan(camera.fov * Math.PI / 360) * camera.aspect * 0.84;
        title.scale.setScalar(Math.min(1, available / title.geometry.parameters.width));
      } else { title.position.copy(position); title.rotation.copy(rotation); title.scale.copy(scale); }
    });
    camera.updateProjectionMatrix();
  }
  function onPointer(event) { pointerX = reducedMotion ? 0 : (event.clientX / width * 2 - 1) * 5; }
  window.addEventListener('resize', resize);
  container.addEventListener('pointermove', onPointer);
  resize();
  function draw(now) {
    if (disposed) return;
    const delta = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    if (!paused && !document.hidden) {
      elapsed += reducedMotion ? 0 : delta;
      if (transitioning) {
        const p = clamp((now - transitionStart) / duration, 0, 1);
        const eased = p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2;
        camera.position.y = startY + (-target * STEP - startY) * eased;
        streaks.scale.y = 1;
        if (p === 1) { transitioning = false; groups.forEach((g, i) => { g.visible = i === target; }); }
      }
      camera.position.x += (pointerX - camera.position.x) * 0.03;
      for (const { index, fn } of animators) if (groups[index].visible) fn(elapsed);
      renderer.render(scene, camera);
    }
    frameId = requestAnimationFrame(draw);
  }
  animators.filter(a => a.index === 0).forEach(a => a.fn(0));
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(draw);

  return {
    goTo(index) {
      index = clamp(Math.round(index), 0, groups.length - 1);
      if (index === target) return;
      previous = target; target = index; startY = camera.position.y; transitionStart = performance.now(); transitioning = true;
      const low = Math.min(previous, target), high = Math.max(previous, target);
      groups.forEach((g, i) => { g.visible = i >= low && i <= high; });
    },
    resize,
    setQuality(value) { quality = value === 0.5 ? 0.5 : 1; resize(); },
    setPaused(value) { paused = Boolean(value); lastTime = performance.now(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frameId); window.removeEventListener('resize', resize); container.removeEventListener('pointermove', onPointer);
      const textures = new Set(), materials = new Set(), geometries = new Set();
      scene.traverse(obj => { if (obj.geometry) geometries.add(obj.geometry); if (obj.material) for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) { materials.add(mat); for (const v of Object.values(mat)) if (v?.isTexture) textures.add(v); } });
      textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
