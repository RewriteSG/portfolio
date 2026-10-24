import * as THREE from '../../vendor/three.module.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const chapters = [...document.querySelectorAll('.chapter')];
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const menu = document.querySelector('#chapter-menu');
const menuToggle = document.querySelector('.menu-toggle');
let current = Math.max(0, chapters.findIndex(section => `#${section.id}` === location.hash));
let wheelTotal = 0;
let wheelAt = 0;
let lockedUntil = 0;
let terrainScene;

function toggleMenu(open = menu.hidden) {
  menu.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  document.querySelector('.menu-label').textContent = open ? 'Close' : 'Explore';
  if (open) menu.querySelector(`[data-go="${current}"]`).focus();
  else menuToggle.focus();
}

function goTo(index, updateHash = true) {
  index = Math.max(0, Math.min(chapters.length - 1, index));
  current = index;
  lockedUntil = performance.now() + (reduced ? 180 : 850);
  chapters.forEach((section, i) => {
    const active = i === index;
    section.classList.toggle('is-active', active);
    section.inert = !active;
    section.setAttribute('aria-hidden', String(!active));
    if (active) section.scrollTop = 0;
  });
  previous.disabled = index === 0;
  next.disabled = index === chapters.length - 1;
  document.querySelector('#current-number').textContent = String(index + 1).padStart(2, '0');
  document.querySelector('#current-name').textContent = chapters[index].dataset.name;
  document.querySelector('#progress-fill').style.width = `${(index + 1) / chapters.length * 100}%`;
  document.querySelector('#chapter-announcement').textContent = `${index + 1} of ${chapters.length}: ${chapters[index].dataset.name}`;
  document.querySelectorAll('#chapter-menu [data-go]').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.go) === index)));
  document.body.dataset.chapter = String(index);
  if (updateHash && location.hash !== `#${chapters[index].id}`) history.replaceState(null, '', `#${chapters[index].id}`);
  terrainScene?.setChapter(index);
}

document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => {
  if (!menu.hidden) toggleMenu(false);
  goTo(Number(button.dataset.go));
}));
document.querySelector('.wordmark').addEventListener('click', event => { event.preventDefault(); goTo(0); });
previous.addEventListener('click', () => goTo(current - 1));
next.addEventListener('click', () => goTo(current + 1));
menuToggle.addEventListener('click', () => toggleMenu());
window.addEventListener('hashchange', () => { const index = chapters.findIndex(section => `#${section.id}` === location.hash); if (index >= 0) goTo(index, false); });

window.addEventListener('keydown', event => {
  if (!menu.hidden) {
    if (event.key === 'Escape') { event.preventDefault(); toggleMenu(false); }
    if (event.key === 'Tab') {
      const focusable = [menuToggle, ...menu.querySelectorAll('button,a')];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); menuToggle.focus(); }
    }
    return;
  }
  if (event.target.closest('a,button,input,textarea,select') && [' ', 'Enter'].includes(event.key)) return;
  const directions = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ' ': 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 };
  if (event.key in directions) { event.preventDefault(); goTo(current + directions[event.key]); }
  if (event.key === 'Home') { event.preventDefault(); goTo(0); }
  if (event.key === 'End') { event.preventDefault(); goTo(chapters.length - 1); }
});

window.addEventListener('wheel', event => {
  if (!menu.hidden || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
  const section = chapters[current];
  const scrollable = section.scrollHeight > section.clientHeight + 3;
  const down = event.deltaY > 0;
  const atEdge = down ? section.scrollTop + section.clientHeight >= section.scrollHeight - 3 : section.scrollTop <= 2;
  if (scrollable && !atEdge) { wheelTotal = 0; return; }
  if (performance.now() < lockedUntil) { event.preventDefault(); return; }
  event.preventDefault();
  if (performance.now() - wheelAt > 220 || Math.sign(wheelTotal) !== Math.sign(event.deltaY)) wheelTotal = 0;
  wheelAt = performance.now();
  wheelTotal += event.deltaY;
  if (Math.abs(wheelTotal) > 65) { goTo(current + (down ? 1 : -1)); wheelTotal = 0; }
}, { passive: false });

let touchStart;
window.addEventListener('touchstart', event => { if (menu.hidden && event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, scrollTop: chapters[current].scrollTop }; }, { passive: true });
window.addEventListener('touchend', event => {
  if (!touchStart || !menu.hidden) return;
  const section = chapters[current];
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  const scrollable = section.scrollHeight > section.clientHeight + 3;
  const horizontalSwipe = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4;
  const verticalSwipe = Math.abs(dy) > 75 && Math.abs(dy) > Math.abs(dx) * 1.4;
  if (performance.now() >= lockedUntil) {
    if (horizontalSwipe) goTo(current + (dx < 0 ? 1 : -1));
    else if (verticalSwipe && !scrollable) goTo(current + (dy < 0 ? 1 : -1));
  }
  touchStart = null;
}, { passive: true });

function makeTerrain() {
  const canvas = document.querySelector('#landscape');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x171d1d);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x171d1d, .0038);
  const camera = new THREE.PerspectiveCamera(43, 1, 1, 1500);
  const ambient = new THREE.HemisphereLight(0xe7eee7, 0x28382c, 2.0);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(0xf5f5e9, 3.2);
  light.position.set(-100, 160, 70);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0x8caa9a, .65);
  rim.position.set(100, 50, -160);
  scene.add(rim);

  const peaks = [
    [-10, -50, 112, 55, 52], [70, -30, 77, 45, 47], [-95, -90, 81, 52, 55],
    [37, 85, 48, 65, 38], [-90, 85, 40, 48, 65], [135, -100, 57, 57, 45],
    [-155, -15, 43, 47, 65], [150, 80, 30, 66, 62], [30,-160,60,80,45]
  ];
  const hash = (x,z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123; return n - Math.floor(n); };
  function noise(x,z) {
    const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
  }
  function height(x,z) {
    let h = 0;
    for (const [px,pz,ph,wx,wz] of peaks) {
      const radius = Math.sqrt(((x-px)/wx)**2 + ((z-pz)/wz)**2);
      h = Math.max(h, ph * Math.max(0, 1 - radius * .58) ** 2.2);
    }
    const n = (noise(x*.025,z*.025)-.5)*10 + (noise(x*.09,z*.09)-.5)*4 + (noise(x*.21,z*.21)-.5)*1.3;
    const folds = Math.sin(x*.035+z*.022)*Math.cos(z*.042-x*.013)*3;
    return h + n * Math.min(1,h*.025+.2) + folds;
  }
  const size = 640, divisions = 150;
  let geometry = new THREE.PlaneGeometry(size,size,divisions,divisions);
  geometry.rotateX(-Math.PI/2);
  const position = geometry.attributes.position;
  for (let i=0;i<position.count;i++) position.setY(i,height(position.getX(i),position.getZ(i)));
  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();
  const vertices = geometry.attributes.position;
  const colors = new Float32Array(vertices.count*3);
  const rockDark = new THREE.Color(0x4c5a50), rockLight = new THREE.Color(0x8b998b), snow = new THREE.Color(0xdde3d9), c = new THREE.Color();
  for(let i=0;i<vertices.count;i+=3) {
    const a = new THREE.Vector3().fromBufferAttribute(vertices,i), b = new THREE.Vector3().fromBufferAttribute(vertices,i+1), d = new THREE.Vector3().fromBufferAttribute(vertices,i+2);
    const normal = b.clone().sub(a).cross(d.clone().sub(a)).normalize();
    const y=(a.y+b.y+d.y)/3, x=(a.x+b.x+d.x)/3,z=(a.z+b.z+d.z)/3;
    const grain=noise(x*.18,z*.18);
    c.copy(rockDark).lerp(rockLight,THREE.MathUtils.clamp((y+15)/125+grain*.16,0,.85));
    const snowLine=51+noise(x*.035,z*.035)*22;
    const snowAmount=THREE.MathUtils.smoothstep(y,snowLine,snowLine+12)*THREE.MathUtils.smoothstep(normal.y,.45,.85);
    c.lerp(snow,snowAmount*.95);
    for(let j=0;j<3;j++) { colors[(i+j)*3]=c.r;colors[(i+j)*3+1]=c.g;colors[(i+j)*3+2]=c.b; }
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const mountain = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({ vertexColors:true,flatShading:true,roughness:1,metalness:0 }));
  scene.add(mountain);

  // Topographic lines follow the same height field as the mountain mesh.
  const contourVertices=[];
  const step=7.5, range=240;
  for(let level=8;level<=92;level+=10) {
    for(let x=-range;x<range;x+=step) for(let z=-range;z<range;z+=step) {
      const corners=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]];
      const values=corners.map(([cx,cz])=>height(cx,cz));
      const points=[];
      for(let edge=0;edge<4;edge++) {
        const edgeNext=(edge+1)%4, a=values[edge],b=values[edgeNext];
        if ((a<level&&b>=level)||(b<level&&a>=level)) {
          const t=(level-a)/(b-a);
          points.push([THREE.MathUtils.lerp(corners[edge][0],corners[edgeNext][0],t),level+.24,THREE.MathUtils.lerp(corners[edge][1],corners[edgeNext][1],t)]);
        }
      }
      for(let p=0;p+1<points.length;p+=2) contourVertices.push(...points[p],...points[p+1]);
    }
  }
  const contours = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(contourVertices,3)),new THREE.LineBasicMaterial({ color:0xd3dfcb,transparent:true,opacity:.16,depthWrite:false }));
  scene.add(contours);

  const routePoints=[];
  const routePositions=[[-110,97],[-78,56],[-50,28],[-37,5],[-23,-26],[-10,-50],[18,-58],[55,-48],[70,-30],[95,-8]];
  for(const [x,z] of routePositions) routePoints.push(new THREE.Vector3(x,height(x,z)+.7,z));
  const routeCurve=new THREE.CatmullRomCurve3(routePoints);
  const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(routeCurve.getPoints(160)),new THREE.LineDashedMaterial({ color:0xf4efcf,dashSize:1.2,gapSize:1.1,transparent:true,opacity:.48 }));
  route.computeLineDistances();scene.add(route);
  const marker = new THREE.Group();
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.7,1.85,48),new THREE.MeshBasicMaterial({color:0xe8f0de,side:THREE.DoubleSide,transparent:true,opacity:.85}));
  ring.rotation.x=-Math.PI/2;marker.add(ring);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,8,6),new THREE.MeshBasicMaterial({color:0xe8f0de}));pole.position.y=4;marker.add(pole);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(3.5,1.8),new THREE.MeshBasicMaterial({color:0xe8f0de,side:THREE.DoubleSide}));flag.position.set(1.7,7,0);marker.add(flag);scene.add(marker);

  const views = [
    { p:[173,112,181],t:[-43,32,-10],m:[-10,-50],fog:.0033 },
    { p:[-138,85,156],t:[8,23,-10],m:[-78,56],fog:.0038 },
    { p:[95,123,122],t:[-30,25,-39],m:[-10,-50],fog:.0046 },
    { p:[-136,112,-10],t:[12,34,-35],m:[-37,5],fog:.0040 },
    { p:[108,71,-123],t:[12,22,40],m:[70,-30],fog:.0044 },
    { p:[12,179,175],t:[0,12,-5],m:[-23,-26],fog:.0044 },
    { p:[-145,78,138],t:[-40,35,-85],m:[-10,-50],fog:.0033 }
  ];
  const desiredPosition=new THREE.Vector3(),desiredTarget=new THREE.Vector3(),target=new THREE.Vector3();
  let chapter=current, pointer={x:0,y:0},last=performance.now();
  function setChapter(index,immediate=false) {
    chapter=index;
    const view=views[index],mobile=innerWidth<700;
    desiredPosition.fromArray(view.p);
    if(mobile) desiredPosition.multiplyScalar(1.2);
    desiredTarget.fromArray(view.t);
    if (mobile && index===0) desiredTarget.set(-22,55,0);
    marker.position.set(view.m[0],height(...view.m)+.8,view.m[1]);
    if(immediate||reduced) { camera.position.copy(desiredPosition);target.copy(desiredTarget);camera.lookAt(target);scene.fog.density=view.fog; }
  }
  function resize() { camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);setChapter(chapter,reduced); }
  window.addEventListener('resize',resize);
  window.addEventListener('pointermove',event=>{pointer.x=(event.clientX/innerWidth-.5)*2;pointer.y=(event.clientY/innerHeight-.5)*2;},{passive:true});
  document.addEventListener('visibilitychange',()=>{last=performance.now();});
  resize();setChapter(current,true);
  function render(now) {
    requestAnimationFrame(render);
    if(document.hidden) return;
    const dt=Math.min((now-last)/1000,.05);last=now;
    const ease=reduced?1:1-Math.exp(-dt*3.1);
    const p=desiredPosition.clone();
    if(!reduced&&innerWidth>700){p.x+=pointer.x*2.1;p.y-=pointer.y*1.0;}
    camera.position.lerp(p,ease);target.lerp(desiredTarget,ease);camera.lookAt(target);
    scene.fog.density=THREE.MathUtils.lerp(scene.fog.density,views[chapter].fog,ease);
    renderer.render(scene,camera);
  }
  requestAnimationFrame(render);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();document.body.classList.add('webgl-unavailable');});
  return {setChapter};
}

try { terrainScene=makeTerrain(); }
catch(error) { document.body.classList.add('webgl-unavailable'); console.warn('Mountain landscape unavailable; the full presentation remains accessible.',error); }
goTo(current,false);
