import * as THREE from '../vendor/three.module.js';

const RADIUS = 20;
const UP = new THREE.Vector3(0, 1, 0);

// A little deterministic variation keeps the coast and faceted slopes reproducible.
function random(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .03, ...extra });
}

function mesh(geometry, surface, parent, position) {
  const object = new THREE.Mesh(geometry, surface);
  if (position) object.position.fromArray(position);
  parent.add(object);
  return object;
}

function makeOcean() {
  const surface = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vPoint;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(position);
        float wave = sin(position.x * 2.7 + position.z * 1.6 + uTime * .65) * .012;
        wave += sin(position.z * 4.1 - position.y * 2.4 - uTime * .48) * .008;
        vec3 p = position + n * wave;
        vPoint = p;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vPoint;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(cameraPosition - vWorld);
        float ripple = sin(vPoint.x * 8.1 + vPoint.z * 4.3 + sin(vPoint.y * 2.0 - uTime * .32));
        n = normalize(n + vec3(cos(vPoint.z * 7.0 + uTime * .4), sin(vPoint.x * 8.0), 0.0) * .008);
        vec3 sun = normalize(vec3(-.55, .75, .8));
        float daylight = smoothstep(-.28, .85, dot(n, sun));
        vec3 deep = vec3(.019, .12, .17);
        vec3 sea = vec3(.065, .28, .32);
        vec3 color = mix(deep, sea, daylight);
        float fresnel = pow(1.0 - max(dot(n, view), 0.0), 4.0);
        color = mix(color, vec3(.29, .48, .51), fresnel * .65);
        float glint = pow(max(dot(n, normalize(sun + view)), 0.0), 85.0);
        color += vec3(.45, .53, .44) * glint * (.16 + .09 * ripple);
        color += vec3(.12, .26, .25) * pow(max(ripple, 0.0), 20.0) * .052 * daylight;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 128, 80), surface);
  ocean.name = 'Curved ocean';
  return ocean;
}

function makeAtmosphere(radius, strength, power) {
  const surface = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uStrength: { value: strength },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uStrength;
      uniform float uPower;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 view = normalize(cameraPosition - vWorld);
        float edge = pow(1.0 - abs(dot(normalize(vNormal), view)), uPower);
        float sun = .65 + .35 * max(dot(normalize(vNormal), normalize(vec3(-.5, .8, .5))), 0.0);
        gl_FragColor = vec4(vec3(.22, .64, .86), edge * uStrength * sun);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), surface);
  shell.name = 'Atmospheric rim';
  shell.renderOrder = 2;
  return shell;
}

function makeLand(direction, width, depth, height, seed) {
  const n = new THREE.Vector3().fromArray(direction).normalize();
  const right = new THREE.Vector3().crossVectors(UP, n).normalize();
  const forward = new THREE.Vector3().crossVectors(n, right).normalize();
  const slices = 48;
  const rings = 12;
  const vertices = [];
  const positions = [];
  const colors = [];
  const sand = new THREE.Color(0xbab293);
  const grass = new THREE.Color(0x6c8977);
  const rock = new THREE.Color(0x788786);
  const snow = new THREE.Color(0xdbe6df);

  function point(ring, slice) {
    const angle = slice / slices * Math.PI * 2;
    const scallop = 1 + Math.sin(angle * 3 + seed) * .15 + Math.sin(angle * 7 - seed) * .07;
    const r = ring / rings;
    const jitter = ring === rings ? 0 : (random(ring * slices + slice + seed) - .5) * .035;
    const x = Math.cos(angle) * (r + jitter) * width * scallop;
    const y = Math.sin(angle) * (r + jitter) * depth * scallop;
    const fade = Math.pow(Math.max(0, 1 - r * r), .82);
    const a = Math.exp(-((x + width * .23) ** 2 / (width * width * .2) + (y - depth * .12) ** 2 / (depth * depth * .28)));
    const b = Math.exp(-((x - width * .28) ** 2 / (width * width * .12) + (y + depth * .2) ** 2 / (depth * depth * .15)));
    const ridge = .6 + .4 * Math.abs(Math.sin(x * .95 + y * .48 + seed));
    const elevation = .085 + fade * height * Math.max(a, b * .76) * ridge;
    const p = n.clone().multiplyScalar(RADIUS).addScaledVector(right, x).addScaledVector(forward, y).normalize().multiplyScalar(RADIUS + elevation);
    return { p, elevation, r };
  }

  vertices.push(point(0, 0));
  for (let ring = 1; ring <= rings; ring++) {
    for (let slice = 0; slice < slices; slice++) vertices.push(point(ring, slice));
  }
  const index = (ring, slice) => ring === 0 ? 0 : 1 + (ring - 1) * slices + ((slice + slices) % slices);
  function triangle(a, b, c) {
    const points = [vertices[a], vertices[b], vertices[c]];
    const elevation = points.reduce((sum, p) => sum + p.elevation, 0) / 3;
    const edge = points.reduce((sum, p) => sum + p.r, 0) / 3;
    let color = sand.clone().lerp(grass, THREE.MathUtils.smoothstep(1 - edge, .03, .22));
    color.lerp(rock, THREE.MathUtils.smoothstep(elevation / height, .28, .6));
    color.lerp(snow, THREE.MathUtils.smoothstep(elevation / height, .59, .9));
    color.multiplyScalar(.91 + random(a + b * 3 + c * 7 + seed) * .17);
    for (const { p } of points) {
      positions.push(p.x, p.y, p.z);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let slice = 0; slice < slices; slice++) triangle(0, index(1, slice), index(1, slice + 1));
  for (let ring = 1; ring < rings; ring++) {
    for (let slice = 0; slice < slices; slice++) {
      triangle(index(ring, slice), index(ring + 1, slice), index(ring + 1, slice + 1));
      triangle(index(ring, slice), index(ring + 1, slice + 1), index(ring, slice + 1));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const land = new THREE.Mesh(geometry, material(0xffffff, { vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  land.name = 'Faceted mountain coast';
  return land;
}

function makeBoat() {
  const boat = new THREE.Group();
  boat.name = 'Ivory sailing boat';
  const hullMaterial = material(0xebe9d7, { roughness: .47, side: THREE.DoubleSide });
  const wood = material(0x9f7857);
  const metal = material(0xcad3cb, { roughness: .35, metalness: .3 });
  const dark = material(0x173f4a, { roughness: .35 });
  const sailMaterial = material(0xf3f0dc, { roughness: .95, side: THREE.DoubleSide });
  const sections = [[-5.2, .025, .55], [-4.3, .65, .68], [-2.7, 1.08, .76], [-.5, 1.25, .79], [1.5, 1.18, .76], [3.6, .95, .71], [4.5, .76, .67]];
  const positions = [];
  const indices = [];
  sections.forEach(([z, w, y]) => positions.push(-w, y, z, -w * .75, -.15, z, 0, -.7, z, w * .75, -.15, z, w, y, z));
  for (let s = 0; s < sections.length - 1; s++) {
    for (let j = 0; j < 4; j++) {
      const a = s * 5 + j;
      const b = a + 5;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const last = (sections.length - 1) * 5;
  indices.push(0, 1, 2, 0, 2, 3, 0, 3, 4, last, last + 2, last + 1, last, last + 3, last + 2, last, last + 4, last + 3);
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hull.setIndex(indices);
  hull.computeVertexNormals();
  mesh(hull, hullMaterial, boat);

  const deckShape = new THREE.Shape();
  deckShape.moveTo(0, -5.2);
  sections.slice(1).forEach(([z, w]) => deckShape.lineTo(w, z));
  sections.slice(1).reverse().forEach(([z, w]) => deckShape.lineTo(-w, z));
  deckShape.closePath();
  const deck = mesh(new THREE.ShapeGeometry(deckShape), material(0x9f7857, { side: THREE.DoubleSide }), boat, [0, .75, 0]);
  deck.rotation.x = Math.PI / 2;

  const pole = (start, end, radius, surface = metal) => {
    const a = new THREE.Vector3().fromArray(start);
    const b = new THREE.Vector3().fromArray(end);
    const delta = new THREE.Vector3().subVectors(b, a);
    const object = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 7), surface, boat);
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(UP, delta.normalize());
    return object;
  };
  for (const side of [-1, 1]) {
    const rail = sections.map(([z, w, y]) => new THREE.Vector3(side * w, y + .045, z));
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 26, .055, 5, false), hullMaterial, boat);
  }
  mesh(new THREE.BoxGeometry(1.45, .66, 2.3), hullMaterial, boat, [0, 1.08, -.05]);
  mesh(new THREE.BoxGeometry(1.58, .14, 2.5), hullMaterial, boat, [0, 1.46, -.1]);
  for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(.025, .23, 1.5), dark, boat, [side * .737, 1.12, -.1]);
  mesh(new THREE.BoxGeometry(1.35, .08, 1.3), dark, boat, [0, .81, 2.7]);
  for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(.28, .21, 1.4), wood, boat, [side * .87, .93, 2.75]);
  pole([0, 1.4, -.8], [0, 11.8, -.8], .06);
  pole([0, 2.05, -.8], [.9, 2.05, 3.6], .045);
  pole([0, .8, 3.6], [0, 1.45, 3.6], .03);
  mesh(new THREE.TorusGeometry(.24, .022, 6, 18), metal, boat, [0, 1.45, 3.6]);

  const linePositions = [];
  const addLine = (a, b) => linePositions.push(...a, ...b);
  for (const target of [[0, .8, -5], [-1.17, .85, -.8], [1.17, .85, -.8], [0, .8, 4.4]]) addLine([0, 11.6, -.8], target);
  for (const side of [-1, 1]) {
    const rails = [[side * .4, 1.15, -4.7], [side * 1.08, 1.3, -2.7], [side * 1.25, 1.32, -.5], [side * 1.18, 1.3, 1.5], [side * .95, 1.25, 3.6], [side * .76, 1.2, 4.5]];
    for (let i = 0; i < rails.length - 1; i++) addLine(rails[i], rails[i + 1]);
    for (const point of rails.slice(1)) addLine(point, [point[0], point[1] - .5, point[2]]);
  }

  function sail(a, b, c, fullness) {
    const vertices = [];
    const faces = [];
    const n = 18;
    const va = new THREE.Vector3().fromArray(a);
    const vb = new THREE.Vector3().fromArray(b);
    const vc = new THREE.Vector3().fromArray(c);
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const u = i / n;
        const v = j / n;
        const w = 1 - u - v;
        const p = va.clone().multiplyScalar(w).addScaledVector(vb, u).addScaledVector(vc, v);
        p.x += Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * fullness * 2.8;
        vertices.push(p.x, p.y, p.z);
      }
    }
    const at = (i, j) => i * (n + 1) - i * (i - 1) / 2 + j;
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      faces.push(at(i, j), at(i + 1, j), at(i, j + 1));
      if (j < n - i - 1) faces.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    mesh(geometry, sailMaterial, boat);
    // Quiet panel seams make the sail read as cloth at the closest camera distance.
    for (let f = .2; f < 1; f += .2) {
      const start = va.clone().lerp(vb, f);
      const end = vc.clone().lerp(vb, f);
      for (let step = 0; step < 16; step++) {
        const p = [];
        for (const t of [step / 16, (step + 1) / 16]) {
          const point = start.clone().lerp(end, t);
          point.x += Math.sin(f * Math.PI) * Math.sin(t * (1 - f) * Math.PI) * fullness * 2.8 + .012;
          p.push(point.toArray());
        }
        addLine(p[0], p[1]);
      }
    }
  }
  sail([.08, 2.1, -.75], [.08, 11.45, -.75], [.95, 2.1, 3.5], .55);
  sail([0, 1.18, -4.95], [.02, 11.2, -.88], [-.6, 1.6, -1.32], -.32);
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  boat.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: 0xb8c2b1, transparent: true, opacity: .6 })));
  const flag = mesh(new THREE.PlaneGeometry(.65, .3), material(0x3a7681, { side: THREE.DoubleSide }), boat, [.32, 10.6, -.8]);
  flag.rotation.y = .25;
  boat.scale.setScalar(.44);
  return boat;
}

function makeWake() {
  const positions = [];
  const colors = [];
  const color = new THREE.Color(0xb1d3cd);
  for (let i = 0; i < 30; i++) {
    const t = i / 30;
    for (const side of [-1, 1]) {
      const x = side * (.4 + t * 1.4);
      const z = 1.8 + t * 6;
      const width = .18 + t * .65;
      const y = -.1 - (x * x + z * z) / (RADIUS * 2);
      positions.push(x - width, y, z, x + width, y, z + .08, x + width * .6, y, z + .13);
      for (let vertex = 0; vertex < 3; vertex++) colors.push(color.r * (1 - t * .8), color.g * (1 - t * .8), color.b * (1 - t * .8));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false }));
}

export function createEarth() {
  const group = new THREE.Group();
  group.name = 'Earth';
  const ocean = makeOcean();
  group.add(ocean);
  group.add(makeLand([-.49, .43, .76], 8.7, 6.7, 4.8, 2.6));
  group.add(makeLand([-.85, .19, .39], 3.1, 4.3, 2.4, 4.1));
  group.add(makeLand([-.12, .85, -.51], 6.5, 5.8, 3.4, 8.5));
  group.add(makeLand([.63, -.62, -.46], 6.7, 5.2, 3.6, 6.2));
  group.add(makeLand([-.64, -.65, .4], 4.5, 3.4, 2.6, 3.3));
  group.add(makeAtmosphere(20.24, .75, 4.2));
  group.add(makeAtmosphere(20.72, .21, 7));

  const surfaceAnchor = new THREE.Group();
  const boat = makeBoat();
  const wake = makeWake();
  const heading = new THREE.Group();
  heading.rotation.y = -1.05;
  heading.add(boat, wake);
  surfaceAnchor.add(heading);
  group.add(surfaceAnchor);
  const start = new THREE.Vector3(.43, .72, .55).normalize();
  const finish = new THREE.Vector3(.60, .57, .56).normalize();
  const normal = new THREE.Vector3();

  function update(time = 0, sailing = 0, reducedMotion = false) {
    const t = reducedMotion ? 0 : time;
    const progress = THREE.MathUtils.clamp(sailing, 0, 1);
    ocean.material.uniforms.uTime.value = t;
    normal.copy(start).lerp(finish, progress).normalize();
    surfaceAnchor.position.copy(normal).multiplyScalar(RADIUS + .17);
    surfaceAnchor.quaternion.setFromUnitVectors(UP, normal);
    boat.position.y = reducedMotion ? 0 : Math.sin(t * .72) * .025;
    boat.rotation.x = reducedMotion ? 0 : Math.sin(t * .6) * .012;
    boat.rotation.z = reducedMotion ? -.024 : -.024 + Math.sin(t * .48) * .022;
    wake.material.opacity = reducedMotion ? .13 : .17 + Math.sin(t * .6) * .025;
  }

  function dispose() {
    const geometries = new Set();
    const materials = new Set();
    group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        const surfaces = Array.isArray(object.material) ? object.material : [object.material];
        surfaces.forEach(surface => materials.add(surface));
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(surface => surface.dispose());
  }

  update(0, 0, true);
  return { group, update, dispose };
}
