import * as THREE from './vendor/three.module.js';
import { createEarth } from './earth.js';
import { createCity } from './city.js';
import { buildProjectLayout, projectAtProgress, projectOrbit } from './project-layout.js';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Pauses are part of the path: copy can be read while the world stays composed.
const path = [
  { p: 0, eye: [0, 0, 65], look: [0, 0, 0], earth: [0, -100, 0], scale: 1 },
  { p: .10, eye: [0, 0, 65], look: [0, 0, 0], earth: [0, -100, 0], scale: 1 },
  { p: .16, eye: [0, 24, 92], look: [0, -5, 0], earth: [0, -54, 0], scale: 1 },
  { p: .22, eye: [0, 25, 70], look: [-5, 3, 0], earth: [0, -5, 0], scale: 1 },
  { p: .265, eye: [2, 20, 48], look: [-9, 6, 0], earth: [0, 0, 0], scale: 1 },
  { p: .38, eye: [2, 20, 48], look: [-9, 6, 0], earth: [0, 0, 0], scale: 1 },
  { p: .48, eye: [0, 45, 105], look: [-4, 0, 0], earth: [20, 0, -4], scale: .6 },
  { p: .55, eye: [47, 9, 230], look: [47, 9, -8], earth: [38, 0, -8], scale: .18 },
  { p: .65, eye: [47, 9, 230], look: [47, 9, -8], earth: [38, 0, -8], scale: .18 },
  { p: .74, eye: [47, 9, 230], look: [47, 9, -8], earth: [38, 0, -8], scale: .18 },
  { p: .83, eye: [47, 9, 230], look: [47, 9, -8], earth: [38, 0, -8], scale: .18 },
  { p: .89, eye: [1, 28, 71], look: [0, 3, 0], earth: [0, 0, 0], scale: 1 },
  { p: .922, eye: [7, 20, 43], look: [1, 7, 0], earth: [0, 0, 0], scale: 1 },
  { p: .939, eye: [11, 16, 30], look: [3, 9, 0], earth: [0, 0, 0], scale: 1 },
  { p: .943, eye: [35, -82, 47], look: [-5, -118, 0], earth: [0, 0, 0], scale: 1 },
  { p: .973, eye: [30, -94, 37], look: [-5, -118, 0], earth: [0, 0, 0], scale: 1 },
  { p: 1, eye: [30, -94, 37], look: [-5, -118, 0], earth: [0, 0, 0], scale: 1 },
];

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(225,239,255,1)');
  gradient.addColorStop(.12, 'rgba(166,204,255,.8)');
  gradient.addColorStop(.4, 'rgba(97,145,255,.18)');
  gradient.addColorStop(1, 'rgba(65,105,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function seededRandom(seed = 2026) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export class JourneyScene {
  constructor(container, { reducedMotion = false, onProgress = () => {}, onError = () => {}, projectIds = [] } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.onProgress = onProgress;
    this.onError = onError;
    this.progress = this.targetProgress = 0;
    this.previousTime = 0;
    this.time = 0;
    this.dirty = true;
    this.disposed = false;
    this.paused = false;
    this.projectFocus = null;
    this.projectLayout = buildProjectLayout(projectIds);
    this.focusedPlanetIndex = -1;
    this.focusAmount = 0;
    this.indexAmount = 0;
    this.focusTransition = null;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050711);
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 1700);
    this.look = new THREE.Vector3();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.className = 'journey-canvas';
    container.append(this.renderer.domElement);
    this.glowMap = glowTexture();
    this.scene.add(new THREE.HemisphereLight(0xe5f0ee, 0x294553, 2.0));
    this.sunLight = new THREE.DirectionalLight(0xfff4db, 3.2);
    this.sunLight.position.set(-35, 55, 50);
    this.scene.add(this.sunLight);
    const fill = new THREE.DirectionalLight(0xa0bfe3, 1.2);
    fill.position.set(25, 10, -40);
    this.scene.add(fill);

    this.makeStars();
    this.earth = createEarth();
    this.scene.add(this.earth.group);
    this.makeSolarSystem();
    this.setProjectIds(projectIds);
    this.city = createCity();
    this.city.group.position.y = -120;
    this.city.group.visible = false;
    this.scene.add(this.city.group);
    this.makeCloudPass();
    this.resize = this.resize.bind(this);
    this.resize();
    addEventListener('resize', this.resize, { passive: true });
    this.visibilityHandler = () => { this.previousTime = 0; this.dirty = true; };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.contextLostHandler = event => {
      event.preventDefault();
      this.renderer.setAnimationLoop(null);
      onError(new Error('The 3D context was interrupted.'));
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLostHandler);
    this.renderer.setAnimationLoop(time => this.frame(time));
  }

  makeStars() {
    const random = seededRandom();
    this.starGroup = new THREE.Group();
    this.scene.add(this.starGroup);
    const distant = [];
    for (let i = 0; i < 1500; i++) {
      const theta = random() * Math.PI * 2;
      const z = random() * 2 - 1;
      const r = 380 + random() * 150;
      distant.push(Math.cos(theta) * Math.sqrt(1 - z * z) * r, z * r, Math.sin(theta) * Math.sqrt(1 - z * z) * r);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(distant, 3));
    this.distantStars = new THREE.Points(geo, new THREE.PointsMaterial({ size: .65, color: 0xbbd0ec, transparent: true, opacity: .66, sizeAttenuation: true, depthWrite: false }));
    this.scene.add(this.distantStars);

    this.starData = Array.from({ length: 160 }, (_, i) => ({
      x: (random() - .5) * 130,
      y: (random() - .5) * 100,
      z: -90 + random() * 110,
      size: i < 22 ? .25 + random() * .32 : .06 + random() * .13,
      rx: random() * 2, ry: random() * 2,
    }));
    this.cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xc9deff, emissive: 0x537ebd, emissiveIntensity: .85, roughness: .25, metalness: .2, transparent: true });
    this.cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.cubeMaterial, this.starData.length);
    this.cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cubes.frustumCulled = false;
    this.starGroup.add(this.cubes);
    this.glowPositions = new Float32Array(this.starData.length * 3);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(this.glowPositions, 3));
    this.starGlows = new THREE.Points(glowGeo, new THREE.PointsMaterial({ size: 2.7, map: this.glowMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .6, color: 0xc8dcff }));
    this.starGroup.add(this.starGlows);
    this.streakPositions = new Float32Array(this.starData.length * 6);
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(this.streakPositions, 3));
    this.streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: 0x93b9ed, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.streaks.frustumCulled = false;
    this.starGroup.add(this.streaks);
    this.starDummy = new THREE.Object3D();
  }

  makeSolarSystem() {
    this.solar = new THREE.Group();
    this.solar.position.set(-18, 0, -8);
    this.scene.add(this.solar);
    this.solarMaterials = [];
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true });
    this.solarMaterials.push(sunMaterial);
    this.solarSun = new THREE.Mesh(new THREE.SphereGeometry(6.5, 40, 24), sunMaterial);
    this.solar.add(this.solarSun);
    const sunHaloMaterial = new THREE.SpriteMaterial({ map: this.glowMap, color: 0xffcf88, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Sprite(sunHaloMaterial);
    halo.scale.set(44, 44, 1);
    this.solar.add(halo);
    this.solarMaterials.push(sunHaloMaterial);
    const planets = [[17, 1.1, 0xba9b88, 1.8], [29, 1.85, 0xd7c0a0, 3.3], [43, 1.5, 0x958087, 4.7], [75, 4, 0x9badae, 2.7], [96, 3.1, 0x8994aa, 5.4]];
    this.planets = [];
    [17, 29, 43, 56, 75, 96].forEach(radius => {
      const points = Array.from({ length: 193 }, (_, i) => new THREE.Vector3(Math.cos(i / 192 * Math.PI * 2) * radius, 0, Math.sin(i / 192 * Math.PI * 2) * radius));
      const material = new THREE.LineBasicMaterial({ color: 0x7a94aa, transparent: true, opacity: .23, depthWrite: false });
      const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
      this.solar.add(orbit);
      this.solarMaterials.push(material);
    });
    planets.forEach(([radius, size, color, angle], index) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: .88, transparent: true });
      const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), material);
      this.solar.add(planet);
      this.solarMaterials.push(material);
      this.planets.push({ mesh: planet, radius, angle, speed: .005 / (index + 1) });
      if (index === 3) {
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xb6bdac, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false });
        const ring = new THREE.Mesh(new THREE.RingGeometry(size * 1.4, size * 2.0, 64), ringMaterial);
        ring.rotation.x = Math.PI / 2.5;
        planet.add(ring);
        this.solarMaterials.push(ringMaterial);
      }
    });
    // This is the same outer orbit as the solar model, with a filled progress arc.
    const arcPositions = [], arcIndices = [];
    for (let i = 0; i <= 256; i++) {
      const angle = -Math.PI / 2 + i / 256 * Math.PI * 2;
      for (const radius of [95.72, 96.28]) arcPositions.push(Math.cos(angle) * radius, .05, Math.sin(angle) * radius);
      if (i < 256) { const a = i * 2; arcIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const arcGeometry = new THREE.BufferGeometry();
    arcGeometry.setAttribute('position', new THREE.Float32BufferAttribute(arcPositions, 3));
    arcGeometry.setIndex(arcIndices);
    const arcMaterial = new THREE.MeshBasicMaterial({ color: 0xd8eee1, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    this.orbitProgress = new THREE.Mesh(arcGeometry, arcMaterial);
    this.solar.add(this.orbitProgress);
    this.solarMaterials.push(arcMaterial);
    this.projectMarkers = [];
    this.solarMaterials.forEach(material => { material.userData.baseOpacity = material.opacity; });
  }

  makeCloudPass() {
    this.cloudMaterial = new THREE.ShaderMaterial({
      uniforms: { uCover: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
      transparent: true, depthWrite: false, depthTest: false,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `
        varying vec2 vUv;uniform float uCover;uniform float uTime;uniform float uAspect;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
        void main(){
          vec2 p=vec2(vUv.x*uAspect,vUv.y)*3.;
          float n=noise(p+uTime*.009)*.58+noise(p*2.1-uTime*.006)*.28+noise(p*4.2)*.14;
          float edge=n*.78+sin(vUv.x*5.+vUv.y*3.)*.12;
          float a=smoothstep(1.08-uCover*1.55,1.22-uCover*1.55,edge);
          vec3 c=mix(vec3(.70,.80,.83),vec3(.95,.97,.96),n*.8+.2);
          gl_FragColor=vec4(c,a);
        }`,
    });
    this.cloudPass = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.cloudMaterial);
    this.cloudPass.frustumCulled = false;
    this.cloudPass.renderOrder = 1000;
    this.scene.add(this.cloudPass);
  }

  setProjectIds(ids) {
    const layout = buildProjectLayout(ids);
    if (this.markerGroup && layout.ids.join('\0') === this.projectLayout.ids.join('\0')) return;
    if (this.markerGroup) {
      const materials = new Set();
      const geometries = new Set();
      this.markerGroup.traverse(object => {
        if (object.material) materials.add(object.material);
        if (object.geometry) geometries.add(object.geometry);
      });
      this.solarMaterials = this.solarMaterials.filter(material => !materials.has(material));
      materials.forEach(material => material.dispose());
      geometries.forEach(geometry => geometry.dispose());
      this.markerGroup.removeFromParent();
    }
    this.projectLayout = layout;
    this.markerGroup = new THREE.Group();
    this.solar.add(this.markerGroup);
    const geometry = layout.ids.length ? new THREE.SphereGeometry(3.3, 24, 16) : null;
    const makeMarker = item => {
      const color = new THREE.Color().setHSL(item.hue / 360, .35, .65);
      const material = new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:.6, roughness:.72, transparent:true});
      const planet = new THREE.Mesh(geometry, material);
      planet.position.set(Math.cos(item.angle) * 96, 0, Math.sin(item.angle) * 96);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap, color, transparent:true, opacity:.2, depthWrite:false, blending:THREE.AdditiveBlending}));
      halo.position.copy(planet.position);
      halo.scale.set(16, 16, 1);
      this.markerGroup.add(planet, halo);
      this.solarMaterials.push(material, halo.material);
      return {...item, planet, halo};
    };
    this.projectMarkers = layout.markers.map(makeMarker);
    // Dense manifests retain every HTML control with a single moving focus marker.
    this.activeProjectMarker = layout.needsActiveMarker ? makeMarker(projectOrbit(layout, 0)) : null;
    this.solarMaterials.forEach(material => {
      if (material.userData.baseOpacity === undefined) material.userData.baseOpacity = material.opacity;
    });
    if (this.activeProjectMarker) this.activeProjectMarker.planet.visible = this.activeProjectMarker.halo.visible = false;
    this.projectFocus = null;
    this.focusedPlanetIndex = -1;
    this.focusAmount = 0;
    this.focusTransition = null;
    this.dirty = true;
  }

  positionActiveMarker(index) {
    const marker = this.activeProjectMarker;
    if (!marker || index === null || (marker.index === index && marker.planet.visible)) return;
    const item = projectOrbit(this.projectLayout, index);
    Object.assign(marker, item);
    marker.planet.position.set(Math.cos(item.angle) * 96, 0, Math.sin(item.angle) * 96);
    marker.halo.position.copy(marker.planet.position);
    marker.planet.material.color.setHSL(item.hue / 360, .35, .65);
    marker.planet.material.emissive.copy(marker.planet.material.color);
    marker.halo.material.color.copy(marker.planet.material.color);
    marker.planet.visible = marker.halo.visible = true;
  }

  markerForIndex(index) {
    return this.activeProjectMarker || this.projectMarkers[index];
  }

  setProgress(progress, immediate = false) {
    const next = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    if (Math.abs(next - this.targetProgress) > .000001) this.dirty = true;
    this.targetProgress = next;
    if (immediate) { this.progress = next; this.dirty = true; }
  }

  setPaused(paused) {
    if (paused && !this.paused) this.frame(performance.now());
    this.paused = Boolean(paused);
    this.previousTime = 0;
    this.dirty = true;
  }

  setProjectFocus(idOrNull) {
    const index = this.projectLayout.ids.indexOf(idOrNull);
    const next = index >= 0 ? index : null;
    if (next === this.projectFocus) return;
    this.projectFocus = next;
    if (next !== null) this.positionActiveMarker(next);
    if (next !== null) this.focusedPlanetIndex = next;
    this.focusTransition = {
      eye: this.camera.position.clone(),
      look: this.look.clone(),
      focus: this.focusAmount,
      index: this.indexAmount,
      started: performance.now(),
    };
    this.dirty = true;
  }

  updateProjectFocus(now) {
    const index = Number.isInteger(this.projectFocus) ? this.projectFocus : -1;
    const targetFocus = index >= 0 ? 1 : 0;
    const targetIndex = 0;
    const transition = this.focusTransition;
    let amount = 1;
    if (transition) {
      amount = this.reducedMotion ? 1 : smooth(0, .72, (now - transition.started) / 1000);
      this.focusAmount = lerp(transition.focus, targetFocus, amount);
      this.indexAmount = lerp(transition.index, targetIndex, amount);
    } else {
      this.focusAmount = targetFocus;
      this.indexAmount = targetIndex;
    }
    if (index >= 0) {
      const planet = this.markerForIndex(index).planet;
      this.solar.updateMatrixWorld(true);
      const center = planet.getWorldPosition(new THREE.Vector3());
      const radius = planet.geometry.parameters.radius * planet.getWorldScale(new THREE.Vector3()).x;
      // Place the actual planet's right limb at 10% of the viewport.
      const angularRadius = THREE.MathUtils.degToRad(25);
      const rightAngle = Math.atan(-.8 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
      const centerAngle = rightAngle - angularRadius;
      const distance = radius / Math.sin(angularRadius);
      this.camera.position.set(center.x - distance * Math.sin(centerAngle), center.y, center.z + distance * Math.cos(centerAngle));
      this.look.copy(this.camera.position).add(new THREE.Vector3(0, 0, -1));
    }
    if (transition) {
      // Perspective compresses most of a long linear zoom into its final frames.
      // An exponential approach lets the surface grow throughout the movement.
      const curve = 4.8;
      const travel = targetFocus
        ? (1 - Math.exp(-curve * amount)) / (1 - Math.exp(-curve))
        : transition.focus > 0 ? (Math.exp(curve * amount) - 1) / (Math.exp(curve) - 1) : amount;
      this.camera.position.lerpVectors(transition.eye, this.camera.position, travel);
      this.look.lerpVectors(transition.look, this.look, travel);
      if (amount === 1) this.focusTransition = null;
    }
    this.camera.lookAt(this.look);
    const othersOpacity = (1 - this.focusAmount) * (1 - this.indexAmount * .82);
    this.solarMaterials.forEach(material => { material.opacity *= othersOpacity; });
    if (this.focusedPlanetIndex >= 0 && this.focusAmount > 0) {
      const { planet, halo } = this.markerForIndex(this.focusedPlanetIndex);
      planet.material.opacity = this.solarOpacity * lerp(othersOpacity, 1, this.focusAmount);
      // Let the lit surface carry the close view rather than an oversized glow.
      halo.material.opacity *= 1 - this.focusAmount;
      planet.material.emissiveIntensity = lerp(.6, .12, this.focusAmount);
    }
    if (this.focusAmount > .35 || this.indexAmount > .5) this.earth.group.visible = false;
  }

  getOrbitLayout() {
    const project = point => {
      point.project(this.camera);
      return { x: (point.x * .5 + .5) * this.width, y: (-point.y * .5 + .5) * this.height };
    };
    const center = project(this.solarSun.getWorldPosition(new THREE.Vector3()));
    return {
      center,
      label: { x: center.x, y: center.y + (this.orbitLabelOffset || 42) },
      stops: this.projectLayout.needsActiveMarker ? [] : this.projectMarkers.map(({ planet }) => project(planet.getWorldPosition(new THREE.Vector3()))),
      opacity: this.solarOpacity || 0,
    };
  }

  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.mobile = this.width <= 760;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.4 : 1.6));
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.fov = this.mobile ? 46 : 42;
    this.camera.updateProjectionMatrix();
    if (this.cloudMaterial) this.cloudMaterial.uniforms.uAspect.value = this.camera.aspect;
    this.dirty = true;
  }

  updateStars(p, time) {
    const descent = smooth(.09, .225, p);
    const visibility = 1 - smooth(.19, .255, p);
    this.starGroup.visible = visibility > .001;
    this.cubeMaterial.opacity = visibility;
    this.starGlows.material.opacity = visibility * .6;
    const streak = Math.sin(descent * Math.PI);
    this.streaks.material.opacity = streak * .7;
    if (!this.starGroup.visible) return;
    const dummy = this.starDummy;
    this.starData.forEach((star, index) => {
      const y = ((star.y - descent * 260 + time * -.14 + 150) % 100 + 100) % 100 - 50;
      dummy.position.set(star.x, y, star.z);
      dummy.rotation.set(star.rx + time * .055, star.ry + time * .08, .3);
      dummy.scale.setScalar(star.size);
      dummy.updateMatrix();
      this.cubes.setMatrixAt(index, dummy.matrix);
      this.glowPositions.set([star.x, y, star.z], index * 3);
      this.streakPositions.set([star.x, y + .1, star.z, star.x, y + .1 + streak * (5 + star.size * 9), star.z], index * 6);
    });
    this.cubes.instanceMatrix.needsUpdate = true;
    this.starGlows.geometry.attributes.position.needsUpdate = true;
    this.streaks.geometry.attributes.position.needsUpdate = true;
  }

  updateCamera(p) {
    let from = path[0], to = path[1];
    for (let i = 1; i < path.length; i++) {
      if (p <= path[i].p) { from = path[i - 1]; to = path[i]; break; }
    }
    const t = smooth(from.p, to.p, p);
    this.camera.position.fromArray(from.eye).lerp(new THREE.Vector3(...to.eye), t);
    this.look.fromArray(from.look).lerp(new THREE.Vector3(...to.look), t);
    this.earth.group.position.fromArray(from.earth).lerp(new THREE.Vector3(...to.earth), t);
    this.earth.group.scale.setScalar(lerp(from.scale, to.scale, t));
    if (this.mobile) {
      if (p < .935) {
        const about = smooth(.19, .265, p) * (1 - smooth(.40, .55, p));
        this.camera.position.z += about * 20;
        this.look.x = this.look.x * (1 - about) + about * 3;
        this.look.y += about * 6;
      } else {
        const amount = smooth(.939, .97, p);
        this.camera.position.x += amount * 11;
        this.camera.position.y += amount * 9;
        this.camera.position.z += amount * 24;
        this.look.x += amount * 5;
        this.look.y += amount * 14;
      }
    }
    const solar = smooth(.48, .57, p) * (1 - smooth(.83, .89, p));
    const stacked = this.mobile && this.height > 500;
    const radiusPixels = stacked ? Math.min(this.width * .31, this.height * .145) : Math.min(this.width * .205, this.height * .34);
    const halfHeight = 62.4 * this.height / (2 * radiusPixels);
    const distance = halfHeight / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const solarX = stacked ? -18 : -18 + halfHeight * this.camera.aspect * .45;
    const solarY = halfHeight * (stacked ? -.44 : .10);
    this.camera.position.lerp(new THREE.Vector3(solarX, solarY, -8 + distance), solar);
    this.look.lerp(new THREE.Vector3(solarX, solarY, -8), solar);
    this.orbitLabelOffset = Math.min(stacked ? 42 : 58, radiusPixels * .45);
    this.camera.lookAt(this.look);
  }

  frame(now) {
    if (this.disposed || this.paused || document.hidden) return;
    const delta = this.previousTime ? Math.min((now - this.previousTime) / 1000, .075) : 1 / 60;
    this.previousTime = now;
    const gap = this.targetProgress - this.progress;
    if (this.reducedMotion) this.progress = this.targetProgress;
    else this.progress += gap * (1 - Math.exp(-12 * delta));
    if (Math.abs(gap) < .00001) this.progress = this.targetProgress;
    if (this.reducedMotion && !this.dirty && Math.abs(gap) < .00001) return;
    this.time += this.reducedMotion ? 0 : delta;
    let p = this.progress;
    if (this.reducedMotion) {
      p = p < .1 ? 0 : p < .22 ? .17 : p < .48 ? .31 : p < .83 ? .64 : p < .94 ? .89 : .99;
    }
    this.updateCamera(p);
    const orbitMorph = smooth(.48, .57, p) * (1 - smooth(.83, .89, p));
    const orbitScale = lerp(1, .65, orbitMorph);
    this.solar.scale.setScalar(orbitScale);
    this.solar.rotation.x = orbitMorph * Math.PI / 2;
    this.earth.group.position.sub(this.solar.position).multiplyScalar(orbitScale).applyAxisAngle(new THREE.Vector3(1, 0, 0), this.solar.rotation.x).add(this.solar.position);
    this.earth.group.scale.multiplyScalar(orbitScale);
    this.updateStars(p, this.time);
    this.earth.group.visible = p >= .155 && p < .941;
    this.earth.update(this.time, smooth(.25, .52, p), this.reducedMotion);
    const solarOpacity = smooth(.40, .55, p) * (1 - smooth(.83, .90, p));
    this.solarOpacity = solarOpacity;
    this.solar.visible = solarOpacity > .001;
    this.solarMaterials.forEach(material => { material.opacity = material.userData.baseOpacity * solarOpacity; });
    this.planets.forEach(planet => { const angle = planet.angle + this.time * planet.speed; planet.mesh.position.set(Math.cos(angle) * planet.radius, 0, Math.sin(angle) * planet.radius); });
    const scroll = this.progress;
    const projectProgress = clamp((scroll - this.projectLayout.chapterStart) / (this.projectLayout.chapterEnd - this.projectLayout.chapterStart), 0, 1);
    this.orbitProgress.geometry.setDrawRange(0, Math.floor(projectProgress * 256) * 6);
    const selectedIndex = projectAtProgress(this.projectLayout, scroll);
    if (this.activeProjectMarker) this.positionActiveMarker(this.projectFocus ?? selectedIndex);
    [...this.projectMarkers, ...(this.activeProjectMarker ? [this.activeProjectMarker] : [])].forEach(({ planet, halo, index }) => {
      planet.material.opacity = solarOpacity;
      halo.material.opacity = solarOpacity * (index === selectedIndex ? .55 : .2);
      planet.material.emissiveIntensity = index === selectedIndex ? .9 : .6;
    });
    this.city.group.visible = p > .938;
    if (this.city.group.visible) this.city.update(this.time, this.reducedMotion);
    const cityBlend = smooth(.922, .946, p);
    this.scene.background.set(0x050711).lerp(new THREE.Color(0xbccfcf), cityBlend);
    this.distantStars.visible = cityBlend < .999;
    this.distantStars.material.opacity = .66 * (1 - cityBlend);
    this.cloudCover = smooth(.885, .936, p) * (1 - smooth(.945, .976, p));
    this.cloudPass.visible = this.cloudCover > .001;
    this.cloudMaterial.uniforms.uCover.value = this.cloudCover;
    this.cloudMaterial.uniforms.uTime.value = this.time;
    this.updateProjectFocus(now);
    this.renderer.render(this.scene, this.camera);
    this.container.dataset.world = p < .10 ? 'hello' : p < .22 ? 'descent' : p < .48 ? 'earth' : p < .83 ? 'solar' : p < .94 ? 'return' : 'city';
    this.onProgress(this.progress);
    this.dirty = false;
  }

  getDebugState() {
    return {
      progress: this.progress,
      targetProgress: this.targetProgress,
      phase: this.container.dataset.world,
      camera: this.camera.position.toArray(),
      projectFocus: this.projectFocus,
      projectFocusId: this.projectLayout.ids[this.projectFocus] || null,
      projectCount: this.projectLayout.ids.length,
      passiveMarkerCount: this.projectMarkers.length,
      activeMarkerCount: this.activeProjectMarker ? 1 : 0,
      focusAmount: this.focusAmount,
      indexAmount: this.indexAmount,
      earthVisible: this.earth.group.visible,
      cityVisible: this.city.group.visible,
      cloudCover: this.cloudCover,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLostHandler);
    this.earth.dispose();
    this.city.dispose();
    this.scene.traverse(object => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(material => material.dispose());
    });
    this.glowMap.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
