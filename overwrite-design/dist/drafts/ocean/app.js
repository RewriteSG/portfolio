const chapters = [
  {id:'departure',label:'Departure',next:'Meet Hazwan',className:'hero-chapter',content:`<p class="chapter-kicker">A portfolio in seven chapters</p><h1 class="hero-heading">A clear<span class="second-line">direction.</span></h1><p class="hero-intro">I'm <strong>Hazwan</strong>, a product designer and creative developer. I make complex digital products feel obvious.</p><p class="hero-signature">Good things begin<br>with a little curiosity.</p><span class="tiny-coordinate">1°17′ N &nbsp; 103°51′ E</span>`},
  {id:'perspective',label:'Perspective',next:'Northstar',className:'about-chapter',content:`<p class="chapter-kicker">Perspective</p><h2 class="about-heading">Find the<br>human<br>in the system.</h2><div class="about-text"><p>Every product carries a lot beneath its surface: people's habits, a team's intentions, the choices that came before.</p><p>I work where those things meet. Research helps me understand the real question. Design gives it shape. Code lets me see how it feels.</p><p>Based in Singapore.<br>Always curious about what comes next.</p></div><div class="about-disciplines"><span>Product thinking</span><span>Visual systems</span><span>Creative development</span></div>`},
  {id:'northstar',label:'Northstar',next:'Lumen',className:'project-chapter northstar-chapter',content:`<p class="chapter-kicker">Selected work · Product system</p><h2>Northstar</h2><p class="project-subtitle">Less searching.<br>More understanding.</p><p class="project-body">A product study in making research and customer signals easier to find, frame, and share. A shared place to turn scattered observations into a useful direction.</p><div class="project-tags"><span>Research experience</span><span>Information design</span><span>Product strategy</span></div><div class="signal-log"><div class="log-title"><span>Signals, brought together</span><span>↗</span></div><div class="log-row"><small>01</small><p>Find the question.<span>Search around an intention.</span></p></div><div class="log-row"><small>02</small><p>Keep the context.<span>Let evidence travel with an insight.</span></p></div><div class="log-row"><small>03</small><p>Share the direction.<span>Make the next conversation easier.</span></p></div></div><div class="project-detail"><strong>The design question</strong>How can a team see the signal without losing the story behind it?</div>`},
  {id:'lumen',label:'Lumen',next:'Field Notes',className:'project-chapter lumen-chapter',content:`<p class="chapter-kicker">Selected work · Identity system</p><h2>Lumen</h2><p class="project-subtitle">A small identity.<br>A world of possibility.</p><p class="project-body">A portable identity study for a studio making thoughtful tools for teams. Built around an open, recognisable mark and a visual language that can move between product, print, and motion.</p><div class="project-tags"><span>Visual identity</span><span>Art direction</span><span>Motion language</span></div><div class="lumen-mark" aria-label="Lumen overlapping orbit symbol"><span>lumen</span></div><div class="project-detail"><strong>One idea, many expressions</strong>A flexible system that keeps its character whether it lives in a small app icon or across an entire screen.</div>`},
  {id:'field-notes',label:'Field Notes',next:'My approach',className:'project-chapter field-chapter',content:`<p class="chapter-kicker">Selected work · Workspace</p><h2>Field Notes</h2><p class="project-subtitle">Give a good question<br>somewhere to grow.</p><p class="project-body">A flexible workspace study for teams who want to stay curious. Questions, observations, and half-formed ideas sit together, ready to become the next useful conversation.</p><div class="project-tags"><span>Interaction design</span><span>Prototyping</span><span>Workspace systems</span></div><p class="field-question">What are we<br>not seeing yet?</p><div class="project-detail"><strong>Designed for the unfinished</strong>Capture lightly. Connect related thoughts. Return when an idea is ready to take shape.</div>`},
  {id:'approach',label:'Approach',next:'Get in touch',className:'approach-chapter',content:`<p class="chapter-kicker">My approach</p><h2 class="approach-heading">A little<br>structure.<br>Room to<br>explore.</h2><div class="approach-list"><section class="approach-item"><h3>Find the real question.</h3><p>Context before concepts. Listen, observe, and understand what people are actually trying to do.</p></section><section class="approach-item"><h3>Shape the signal.</h3><p>Turn the useful details into a system people can understand, trust, and make their own.</p></section><section class="approach-item"><h3>Make the next step obvious.</h3><p>Build, try, and refine. Aim for clarity with a point of view, right down to the smallest interaction.</p></section></div><p class="approach-endnote">The process is a compass.<br>The people are the point.</p>`},
  {id:'contact',label:'A new horizon',next:'Back to the beginning',className:'contact-chapter',content:`<p class="chapter-kicker">A new horizon</p><h2>Where<br>to next?</h2><a class="contact-link" href="mailto:hello@hazwan.design">hello@hazwan.design<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 16 16 2M2 2h14v14"/></svg></a><p class="contact-description">Have a question worth exploring?<br>I'd love to hear what you're thinking.</p><p class="contact-signoff">Thanks for coming<br>along for the voyage.</p>`}
];
const article=document.querySelector('#chapter');
const nav=document.querySelector('#chapter-nav');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let current=Math.max(0,chapters.findIndex(c=>`#${c.id}`===location.hash));
let busy=false;
let scene;
let lastInteraction=0;
nav.innerHTML=chapters.map((c,i)=>`<button type="button" data-index="${i}" aria-label="Chapter ${i+1}: ${c.label}" title="${c.label}">${String(i+1).padStart(2,'0')}</button>`).join('');
function render(){
  const chapter=chapters[current];
  article.className=`chapter ${chapter.className}`;
  article.innerHTML=chapter.content;
  article.scrollTop=0;
  document.body.className=`chapter-active-${current}`;
  document.querySelector('#current-number').textContent=String(current+1).padStart(2,'0');
  document.querySelector('#progress-fill').style.width=`${(current+1)/chapters.length*100}%`;
  document.querySelector('#next-label').textContent=chapter.next;
  document.querySelector('#previous').disabled=current===0;
  document.querySelector('#next').setAttribute('aria-label',current===6?'Return to beginning':`Next chapter: ${chapters[current+1].label}`);
  nav.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',String(i===current)));
  document.querySelectorAll('.top-nav a').forEach(a=>a.toggleAttribute('data-current',a.hash===`#${chapter.id}`));
  document.title=`Hazwan — ${current===0?'A clear direction':chapter.label}`;
  scene?.setChapter(current);
}
function go(index,{history=true}={}){
  index=Math.max(0,Math.min(6,index));
  if(index===current||busy)return;
  busy=true;lastInteraction=performance.now();
  article.classList.add('changing');
  document.body.classList.add('is-moving');
  setTimeout(()=>{
    current=index;render();
    if(history)window.history.replaceState(null,'',`#${chapters[current].id}`);
    setTimeout(()=>{busy=false;document.body.classList.remove('is-moving');},reducedMotion?0:580);
  },reducedMotion?0:180);
}
nav.addEventListener('click',event=>{const button=event.target.closest('button');if(button)go(Number(button.dataset.index));});
document.querySelector('#previous').addEventListener('click',()=>go(current-1));
document.querySelector('#next').addEventListener('click',()=>go(current===6?0:current+1));
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');
  if(!link||link.hash==='#chapter')return;
  const i=chapters.findIndex(c=>`#${c.id}`===link.hash);
  if(i>=0){event.preventDefault();go(i);}
});
addEventListener('hashchange',()=>{const i=chapters.findIndex(c=>`#${c.id}`===location.hash);if(i>=0)go(i,{history:false});});
let wheelSum=0,wheelReset,lastContentScroll=0;
const contentOverflows=()=>article.scrollHeight>article.clientHeight+2;
const canScrollContent=direction=>contentOverflows()&&(direction>0?article.scrollTop+article.clientHeight<article.scrollHeight-2:article.scrollTop>2);
article.addEventListener('scroll',()=>{lastContentScroll=performance.now();},{passive:true});
addEventListener('wheel',event=>{
  if(event.ctrlKey||event.altKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  const direction=Math.sign(event.deltaY);
  if(canScrollContent(direction)){
    wheelSum=0;
    if(!article.contains(event.target))article.scrollTop+=event.deltaY;
    return;
  }
  if(busy||performance.now()-lastInteraction<900||performance.now()-lastContentScroll<280)return;
  wheelSum+=event.deltaY;
  clearTimeout(wheelReset);wheelReset=setTimeout(()=>{wheelSum=0;},220);
  if(Math.abs(wheelSum)>52){go(current+Math.sign(wheelSum));wheelSum=0;}
},{passive:true});
addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.target.matches('input,textarea,select'))return;
  if(event.key===' '&&event.target.closest('button,a'))return;
  const verticalDown=['ArrowDown','PageDown',' '].includes(event.key);
  const verticalUp=['ArrowUp','PageUp'].includes(event.key);
  if((verticalDown||verticalUp)&&canScrollContent(verticalDown?1:-1)){
    event.preventDefault();
    article.scrollTop+=(verticalDown?1:-1)*(event.key.startsWith('Arrow')?50:article.clientHeight*.8);
    return;
  }
  if(['ArrowDown','ArrowRight','PageDown',' '].includes(event.key)){event.preventDefault();go(current+1);}
  if(['ArrowUp','ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();go(current-1);}
  if(event.key==='Home'){event.preventDefault();go(0);}
  if(event.key==='End'){event.preventDefault();go(6);}
});
let touchStart;
addEventListener('touchstart',event=>{
  touchStart=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY,scrolling:contentOverflows()}:null;
},{passive:true});
addEventListener('touchend',event=>{
  if(!touchStart||!event.changedTouches.length)return;
  const dx=touchStart.x-event.changedTouches[0].clientX,dy=touchStart.y-event.changedTouches[0].clientY;
  const horizontal=Math.abs(dx)>Math.abs(dy);
  if(Math.max(Math.abs(dx),Math.abs(dy))>50&&(horizontal||!touchStart.scrolling))go(current+Math.sign(horizontal?dx:dy));
  touchStart=null;
},{passive:true});
render();
import('./scene.js').then(({OceanScene})=>{
  try{scene=new OceanScene(document.querySelector('#sea'),reducedMotion);scene.setChapter(current,true);}
  catch(error){console.warn('Ocean unavailable:',error);document.querySelector('#render-note').hidden=false;}
}).catch(error=>{console.warn('Ocean unavailable:',error);document.querySelector('#render-note').hidden=false;});
