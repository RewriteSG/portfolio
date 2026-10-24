import * as THREE from '../../vendor/three.module.js';

const waterVertex=`
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
float waves(vec2 p){
  float t=uTime;
  return sin(p.x*.23+p.y*.18+t*.85)*.28+sin(p.x*.43-p.y*.28+t*.68)*.14+sin(p.x*.83+p.y*.41-t*.9)*.065+sin(p.x*1.35-p.y*.9+t*1.4)*.025;
}
void main(){
  vec3 p=position;
  p.z=waves(p.xy);
  float e=.12;
  float dx=(waves(p.xy+vec2(e,0.))-waves(p.xy-vec2(e,0.)))/(2.*e);
  float dy=(waves(p.xy+vec2(0.,e))-waves(p.xy-vec2(0.,e)))/(2.*e);
  vNormal=normalize(mat3(modelMatrix)*vec3(-dx,-dy,1.));
  vec4 world=modelMatrix*vec4(p,1.);
  vWorld=world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const waterFragment=`
uniform float uTime;
uniform vec3 uEye;
varying vec3 vWorld;
varying vec3 vNormal;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 n=normalize(vNormal);
  n.x+=sin(vWorld.z*7.+vWorld.x*3.+uTime*1.3)*.025;
  n.z+=sin(vWorld.x*5.-vWorld.z*4.+uTime)*.018;
  n=normalize(n);
  vec3 eye=normalize(uEye-vWorld);
  float fres=pow(1.-max(dot(n,eye),0.),3.5);
  vec3 deep=vec3(.023,.21,.28);
  vec3 shallow=vec3(.09,.36,.41);
  vec3 sky=vec3(.53,.68,.69);
  float crest=smoothstep(-.25,.55,vWorld.y);
  vec3 color=mix(deep,shallow,crest*.7);
  color=mix(color,sky,fres*.68);
  vec3 light=normalize(vec3(-.4,.45,-.8));
  vec3 halfway=normalize(light+eye);
  float spec=pow(max(dot(n,halfway),0.),110.);
  color+=vec3(.58,.72,.67)*spec*.75;
  float ripple=sin(vWorld.x*10.+vWorld.z*5.+sin(vWorld.z*3.+uTime)*1.5);
  color+=vec3(.23,.46,.46)*pow(max(ripple,0.),18.)*crest*.075;
  float distance=length(uEye-vWorld);
  float fog=1.-exp(-distance*.008);
  color=mix(color,vec3(.55,.69,.7),min(fog,.91));
  gl_FragColor=vec4(color,1.);
}`;

export class OceanScene{
  constructor(container,reducedMotion){
    this.container=container;this.reducedMotion=reducedMotion;this.chapter=0;this.pointer=new THREE.Vector2();this.time=0;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.1,1200);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.05;
    container.append(this.renderer.domElement);
    this.scene.fog=new THREE.FogExp2(0x94b5ba,.005);
    this.scene.add(new THREE.HemisphereLight(0xdce9e0,0x254a59,2.1));
    const sun=new THREE.DirectionalLight(0xfff7db,2.7);sun.position.set(-25,50,-20);this.scene.add(sun);
    this.makeSky();this.makeOcean();this.makeBoat();this.makeWake();this.makeGulls();
    this.targetPosition=new THREE.Vector3();this.targetLook=new THREE.Vector3();this.look=new THREE.Vector3();
    this.clock=new THREE.Clock();
    this.setChapter(0,true);
    addEventListener('resize',()=>this.resize());
    addEventListener('pointermove',e=>{this.pointer.set((e.clientX/innerWidth-.5)*2,(e.clientY/innerHeight-.5)*2);},{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.clock.getDelta();});
    this.renderer.setAnimationLoop(()=>this.animate());
  }
  makeSky(){
    const geometry=new THREE.SphereGeometry(550,32,24);
    const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:`varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vPosition;void main(){float h=normalize(vPosition).y;vec3 horizon=vec3(.60,.73,.74);vec3 top=vec3(.78,.83,.81);vec3 c=mix(horizon,top,smoothstep(0.,.5,h));float cloud=sin(vPosition.x*.017+vPosition.z*.012)*sin(vPosition.x*.009-vPosition.z*.019);c+=smoothstep(.3,.8,cloud)*.035*smoothstep(.04,.25,h);gl_FragColor=vec4(c,1.);}`});
    this.scene.add(new THREE.Mesh(geometry,material));
    // A pale, distant land mass anchors the atmospheric horizon.
    const points=[];for(let i=0;i<=40;i++){const x=-210+i*10.5;points.push(new THREE.Vector3(x,Math.sin(i*.7)*1.8+Math.sin(i*1.8)*.6-1,-260));}points.push(new THREE.Vector3(210,-5,-260),new THREE.Vector3(-210,-5,-260));
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,p.y)));
    const land=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0x90afb3,transparent:true,opacity:.4}));land.position.z=-260;this.scene.add(land);
  }
  makeOcean(){
    this.waterMaterial=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment,uniforms:{uTime:{value:0},uEye:{value:new THREE.Vector3()}},side:THREE.DoubleSide});
    const water=new THREE.Mesh(new THREE.PlaneGeometry(900,900,280,280),this.waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=-.1;this.scene.add(water);
  }
  material(color,roughness=.7){return new THREE.MeshStandardMaterial({color,roughness,metalness:.05});}
  makeBoat(){
    this.boat=new THREE.Group();this.boat.position.set(6,0,0);this.scene.add(this.boat);
    const hullMat=this.material(0xf0eee1,.5),woodMat=this.material(0xa8794e),darkMat=this.material(0x173543),metalMat=this.material(0xc7cec5,.4),sailMat=new THREE.MeshStandardMaterial({color:0xf4f1dc,roughness:.85,metalness:0,side:THREE.DoubleSide});
    hullMat.side=THREE.DoubleSide;woodMat.side=THREE.DoubleSide;
    // Cross-sections form a slender V-bottom hull with a curved pointed bow.
    const sections=[[-5.4,.06,.55],[-4.65,.65,.66],[-3.1,1.2,.73],[-1,1.45,.78],[1.6,1.3,.75],[3.9,.98,.69],[4.8,.8,.68]];
    const hullPositions=[],hullIndices=[];
    sections.forEach(([z,w,y])=>{hullPositions.push(-w,y,z,-w*.76,-.12,z,0,-.8,z,w*.76,-.12,z,w,y,z);});
    for(let s=0;s<sections.length-1;s++)for(let j=0;j<4;j++){const a=s*5+j,b=a+5;hullIndices.push(a,b,a+1,a+1,b,b+1);}
    hullIndices.push(0,1,2,0,2,3,0,3,4);const last=(sections.length-1)*5;hullIndices.push(last,last+2,last+1,last,last+3,last+2,last,last+4,last+3);
    const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(hullPositions,3));hullGeo.setIndex(hullIndices);hullGeo.computeVertexNormals();this.boat.add(new THREE.Mesh(hullGeo,hullMat));
    const deckShape=new THREE.Shape();deckShape.moveTo(0,-5.4);sections.slice(1).forEach(([z,w])=>deckShape.lineTo(w,z));sections.slice(1).reverse().forEach(([z,w])=>deckShape.lineTo(-w,z));deckShape.closePath();
    const deck=new THREE.Mesh(new THREE.ShapeGeometry(deckShape),woodMat);deck.rotation.x=Math.PI/2;deck.position.y=.69;this.boat.add(deck);
    // Fine teak planking and white gunwales make the close camera chapters legible.
    const plankMat=new THREE.LineBasicMaterial({color:0x674f39,transparent:true,opacity:.45});
    for(let x=-1.1;x<=1.1;x+=.18){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.709,-3.2),new THREE.Vector3(x,.709,3.7)]),plankMat);this.boat.add(line);}
    const pole=(a,b,r,mat)=>{const d=new THREE.Vector3().subVectors(b,a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());this.boat.add(mesh);return mesh;};
    const railMat=this.material(0xeeeedd,.5);
    for(const side of [-1,1]){
      const railPoints=sections.map(([z,w,y])=>new THREE.Vector3(w*side,y+.04,z));
      const curve=new THREE.CatmullRomCurve3(railPoints);
      this.boat.add(new THREE.Mesh(new THREE.TubeGeometry(curve,36,.045,5,false),railMat));
      for(const z of [-3.2,-1,1.5,3.8]){const w=z<0?1.24:1.13;pole(new THREE.Vector3(w*side,.77,z),new THREE.Vector3(w*side,1.3,z),.018,metalMat);}
      const safety=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side*.5,1.13,-4.8),new THREE.Vector3(side*1.24,1.3,-3.2),new THREE.Vector3(side*1.24,1.3,-1),new THREE.Vector3(side*1.13,1.3,1.5),new THREE.Vector3(side*1.13,1.3,3.8),new THREE.Vector3(side*.8,1.2,4.75)]),new THREE.LineBasicMaterial({color:0xd5dfd6,transparent:true,opacity:.65}));this.boat.add(safety);
    }
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.6,.75,2.5),hullMat);cabin.position.set(0,1.02,.25);this.boat.add(cabin);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(1.74,.13,2.7),hullMat);roof.position.set(0,1.46,.2);this.boat.add(roof);
    for(const side of [-1,1]){for(const z of [-.4,.5]){const window=new THREE.Mesh(new THREE.BoxGeometry(.03,.22,.65),darkMat);window.position.set(side*.82,1.12,z);this.boat.add(window);}}
    const cockpit=new THREE.Mesh(new THREE.BoxGeometry(1.45,.08,1.6),darkMat);cockpit.position.set(0,.77,2.9);this.boat.add(cockpit);
    for(const x of [-.95,.95]){const seat=new THREE.Mesh(new THREE.BoxGeometry(.35,.22,1.6),woodMat);seat.position.set(x,.9,2.9);this.boat.add(seat);}
    const mastBottom=new THREE.Vector3(0,1.42,-.75),mastTop=new THREE.Vector3(0,11.6,-.75);
    pole(mastBottom,mastTop,.055,metalMat);
    pole(new THREE.Vector3(0,2.1,-.75),new THREE.Vector3(1.1,2.1,3.65),.045,metalMat);
    const sail=(a,b,c,bulge)=>{
      const positions=[],uvs=[],indices=[],n=24;
      for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){
        const u=i/n,v=j/n,w=1-u-v;
        const point=new THREE.Vector3().copy(a).multiplyScalar(w).addScaledVector(b,u).addScaledVector(c,v);
        point.x+=Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*bulge*3;
        positions.push(point.x,point.y,point.z);uvs.push(u,v);
      }
      const idx=(i,j)=>i*(n+1)-(i*(i-1))/2+j;
      for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){indices.push(idx(i,j),idx(i+1,j),idx(i,j+1));if(j<n-i-1)indices.push(idx(i+1,j),idx(i+1,j+1),idx(i,j+1));}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
      this.boat.add(new THREE.Mesh(geo,sailMat));
      const seamMat=new THREE.LineBasicMaterial({color:0xc4c8b6,transparent:true,opacity:.45});
      for(let f=.2;f<1;f+=.2){const p1=a.clone().lerp(b,f),p2=c.clone().lerp(b,f),points=[];for(let step=0;step<=25;step++){const t=step/25,p=p1.clone().lerp(p2,t);p.x+=Math.sin(f*Math.PI)*Math.sin(t*(1-f)*Math.PI)*bulge*2;points.push(p);}this.boat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),seamMat));}
    };
    sail(new THREE.Vector3(.07,2.13,-.72),new THREE.Vector3(.07,11.25,-.72),new THREE.Vector3(1.12,2.13,3.55),.6);
    sail(new THREE.Vector3(0,1.25,-5.1),new THREE.Vector3(.02,10.95,-.8),new THREE.Vector3(-.65,1.65,-1.35),-.4);
    const ropeMat=new THREE.LineBasicMaterial({color:0xe4e3d0,transparent:true,opacity:.7});
    for(const end of [new THREE.Vector3(0,.8,-5.3),new THREE.Vector3(-1.4,.8,-.7),new THREE.Vector3(1.4,.8,-.7),new THREE.Vector3(0,.8,4.7)])this.boat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([mastTop,end]),ropeMat));
    pole(new THREE.Vector3(0,.85,3.7),new THREE.Vector3(0,1.5,3.7),.025,metalMat);
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.25,.018,6,20),metalMat);wheel.position.set(0,1.5,3.7);this.boat.add(wheel);
    const flagGeometry=new THREE.PlaneGeometry(.65,.3,8,3);const flag=new THREE.Mesh(flagGeometry,this.material(0x1c6570));flag.position.set(.32,10.5,-.78);this.boat.add(flag);
    this.boat.rotation.y=-.48;
  }
  makeWake(){
    this.wake=new THREE.Group();this.scene.add(this.wake);
    const foamMaterial=new THREE.MeshBasicMaterial({color:0xe1eee1,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide});
    this.foam=[];
    for(let i=0;i<46;i++){
      const t=i/46;const geometry=new THREE.PlaneGeometry(.3+t*2,.06+t*.16);
      const mesh=new THREE.Mesh(geometry,foamMaterial.clone());mesh.rotation.x=-Math.PI/2;mesh.rotation.z=(i%2?1:-1)*.25;
      const side=i%2?1:-1;mesh.userData={t,side};this.wake.add(mesh);this.foam.push(mesh);
    }
  }
  makeGulls(){
    this.gulls=new THREE.Group();this.scene.add(this.gulls);const material=new THREE.LineBasicMaterial({color:0x52757d,transparent:true,opacity:.65});
    for(let i=0;i<7;i++){const points=[new THREE.Vector3(-.3,0,0),new THREE.Vector3(-.12,.08,0),new THREE.Vector3(0,0,0),new THREE.Vector3(.12,.08,0),new THREE.Vector3(.3,0,0)];const bird=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);bird.position.set(-20+i*4,8+(i%3)*1.3,-35-i*4);this.gulls.add(bird);}
  }
  setChapter(index,immediate=false){
    this.chapter=index;
    const mobile=innerWidth<651;
    const positions=mobile?[[14,12,36],[-10,6,26],[12,5.4,19],[-11,7,23],[3,23,18],[18,8,28],[10,5.2,38]]:[[23,10.5,33],[-13,7,23],[18,6.2,19],[-14,8,25],[6,28,15],[22,6,25],[12,5.8,44]];
    const targets=mobile?[[6,8,0],[5,4,0],[5,4,0],[6,3.5,0],[6,2,-1],[6,4,0],[4,4,-4]]:[[-3,3.5,0],[9,3.2,0],[-1,3,0],[11,3.2,0],[1,2,0],[-1,3,0],[-4,3,-5]];
    this.targetPosition.fromArray(positions[index]);this.targetLook.fromArray(targets[index]);
    if(immediate){this.camera.position.copy(this.targetPosition);this.look.copy(this.targetLook);this.camera.lookAt(this.look);}
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.setChapter(this.chapter,this.reducedMotion);}
  animate(){
    if(document.hidden)return;
    const dt=Math.min(this.clock.getDelta(),.05);if(!this.reducedMotion)this.time+=dt;
    const t=this.time;
    this.waterMaterial.uniforms.uTime.value=t;
    const blend=this.reducedMotion?1:1-Math.exp(-dt*2.1);
    this.camera.position.lerp(this.targetPosition,blend);this.look.lerp(this.targetLook,blend);
    const look=this.look.clone();if(!this.reducedMotion){look.x+=this.pointer.x*.25;look.y-=this.pointer.y*.12;}
    this.camera.lookAt(look);this.waterMaterial.uniforms.uEye.value.copy(this.camera.position);
    this.boat.position.y=Math.sin(t*.8)*.1-.03;
    this.boat.rotation.z=Math.sin(t*.55)*.025-.035;
    this.boat.rotation.x=Math.sin(t*.7)*.012;
    this.foam.forEach((mesh,i)=>{
      const {side}=mesh.userData;const phase=(mesh.userData.t+t*.035)%1;
      const local=new THREE.Vector3(side*(.8+phase*2.2),.04+Math.sin(t*.8+phase*8)*.035,4+phase*24).applyAxisAngle(new THREE.Vector3(0,1,0),-.48);
      mesh.position.copy(local).add(this.boat.position);mesh.material.opacity=(1-phase)*.23;mesh.scale.x=.6+phase*1.8;mesh.rotation.z=-.48+side*.25;
    });
    this.gulls.position.x=Math.sin(t*.025)*7;this.gulls.children.forEach((bird,i)=>{bird.position.y=8+(i%3)*1.3+Math.sin(t*1.2+i)*.25;});
    this.renderer.render(this.scene,this.camera);
  }
}
