(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = (s) => document.querySelector(s);
  const scoreEl = $('#score'), waveEl = $('#wave'), livesEl = $('#lives'), timeEl = $('#time'), progressEl = $('#progress');
  const overlay = $('#overlay'), overlayCard = $('#overlayCard'), toast = $('#toast'), abilityStatus = $('#abilityStatus');
  const keys = new Set(), touch = new Set();
  let state = 'title', last = 0, elapsed = 0, soundOn = true, audioCtx = null, toastTimer;
  let player, enemies, shots, holes, enemyShots, particles, score, lives, gameTime, spawnTimer, fireTimer, holeCooldown;
  let pointer = {x: 900, y: 270, active: false};
  const stars = Array.from({length: 145}, () => ({x:Math.random()*W,y:Math.random()*H,r:.4+Math.random()*1.6,s:.15+Math.random()*.8,p:Math.random()*6.2}));

  function resetGame() {
    player = {x:145,y:H/2-15,w:38,h:30,vx:0,vy:0,invuln:0,facing:1,thruster:0};
    enemies=[]; shots=[]; holes=[]; enemyShots=[]; particles=[];
    score=0; lives=3; gameTime=0; spawnTimer=.7; fireTimer=0; holeCooldown=0;
    updateHud();
  }
  resetGame();
  function playSound(freq=600,duration=.08,type='sine',volume=.045) {
    if(!soundOn)return;
    try { audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume();
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audioCtx.currentTime);gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
    } catch(_){}
  }
  function updateHud() {
    scoreEl.textContent=String(score).padStart(6,'0');
    waveEl.textContent=String(Math.min(9,1+Math.floor(gameTime/15))).padStart(2,'0');
    livesEl.textContent=lives>0?'◆ '.repeat(lives).trim():'—';
    const secs=Math.floor(gameTime);timeEl.textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
    progressEl.style.width=`${Math.min(100,gameTime/60*100)}%`;
    abilityStatus.textContent=holeCooldown<=0?'READY':`${holeCooldown.toFixed(1)}s`;
    abilityStatus.style.color=holeCooldown<=0?'#71f0d0':'#e5a0ff';
  }
  function showToast(text) { toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1050); }
  function startGame() {
    if(state==='title'||state==='over'||state==='won')resetGame();
    state='playing';overlay.classList.add('hidden');last=performance.now();playSound(510,.1,'triangle');
  }
  function pauseGame() {
    if(state==='playing') {state='paused';overlayCard.innerHTML='<div class="mini-kicker"><span>Ⅱ</span> SIGNAL PAUSED</div><h1>PAUSED</h1><p class="overlay-copy">The void can wait. Catch your breath, pilot.</p><button class="play-button" id="playButton"><span>▶</span> RESUME MISSION</button><div class="control-hint"><kbd>P</kbd> RESUME <i>·</i> <kbd>R</kbd> RESTART</div>';$('#playButton').addEventListener('click',startGame);overlay.classList.remove('hidden');}
    else if(state==='paused')startGame();
  }
  function finishGame(won) {
    state=won?'won':'over';
    const title=won?'HORIZON<br><em>HELD!</em>':'SHIP<br><em>LOST</em>';
    const copy=won?`You survived the void. Final score: ${String(score).padStart(6,'0')}`:'The stars will be waiting when you are ready.';
    overlayCard.innerHTML=`<div class="mini-kicker"><span>✦</span> ${won?'MISSION COMPLETE':'SIGNAL LOST'} <span>✦</span></div><h1>${title}</h1><p class="overlay-copy">${copy}</p><button class="play-button" id="playButton"><span>↻</span> FLY AGAIN</button><div class="control-hint">${Math.floor(gameTime)} SECONDS SURVIVED <i>·</i> ${score} POINTS</div>`;
    $('#playButton').addEventListener('click',startGame);overlay.classList.remove('hidden');playSound(won?850:145,.3,won?'triangle':'sawtooth');
  }
  $('#playButton').addEventListener('click',startGame);
  $('#soundButton').addEventListener('click',()=>{soundOn=!soundOn;$('#soundButton').innerHTML=`${soundOn?'♫':'♪'} <span>SOUND ${soundOn?'ON':'OFF'}</span>`;if(soundOn)playSound(660,.06);});
  function inputDown(e) {
    const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(key))e.preventDefault();keys.add(key);
    if(key==='p'&&(state==='playing'||state==='paused'))pauseGame();
    if(key==='r'&&state!=='title'){resetGame();startGame();}
    if((key===' '||key==='enter')&&(state==='title'||state==='over'||state==='won'))startGame();
  }
  window.addEventListener('keydown',inputDown);window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();touch.clear();});
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)*W/r.width;pointer.y=(e.clientY-r.top)*H/r.height;pointer.active=true;});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){const r=canvas.getBoundingClientRect();pointer.x=(e.clientX-r.left)*W/r.width;pointer.y=(e.clientY-r.top)*H/r.height;pointer.active=true;touch.add('fire');}});
  window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')touch.delete('fire');});
  document.querySelectorAll('[data-control]').forEach(button=>{
    const control=button.dataset.control;const down=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);touch.add(control);button.classList.add('pressed');if(state==='title'&&control==='fire')startGame();};
    const up=e=>{e.preventDefault();touch.delete(control);button.classList.remove('pressed');};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
  });
  function pressed(...names){return names.some(n=>keys.has(n)||touch.has(n));}
  function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function emit(x,y,color,count=9) {for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*180;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.55,color,size:1.5+Math.random()*3});}}
  function spawnEnemy() {
    const wave=1+Math.floor(gameTime/15),heavy=wave>=3&&Math.random()<.25;
    const y=38+Math.random()*(H-100);
    enemies.push({x:W+35,y,w:heavy?39:31,h:heavy?36:28,hp:heavy?2:1,maxHp:heavy?2:1,vx:-(65+wave*11+Math.random()*30),vy:(Math.random()-.5)*35,phase:Math.random()*6.28,fire:1+Math.random()*2,heavy,alive:true});
  }
  function fireBlackHole() {
    if(holeCooldown>0||shots.filter(s=>!s.dead).length>=3)return;
    const sx=player.x+player.w+2,sy=player.y+player.h/2;
    let dx=1,dy=0;
    if(pointer.active){dx=pointer.x-sx;dy=pointer.y-sy;const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;}
    else {dy=(pressed('up','w','arrowup')?-1:pressed('down','s','arrowdown')?1:0);dx=pressed('left','a','arrowleft')?-1:1;const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;}
    player.facing=dx<0?-1:1;
    shots.push({x:sx,y:sy,vx:dx*410,vy:dy*410,life:1.25,dead:false});holeCooldown=.42;playSound(235,.13,'sawtooth',.035);
  }
  function loseLife() {
    if(player.invuln>0||state!=='playing')return;
    lives--;player.invuln=1.65;emit(player.x+player.w/2,player.y+player.h/2,'#ff719a',18);playSound(105,.22,'sawtooth');
    if(lives<=0){updateHud();finishGame(false);return;}
    player.x=Math.max(24,player.x-22);showToast('HULL HIT — STAY SHARP');updateHud();
  }
  function update(dt) {
    if(state!=='playing')return;
    gameTime+=dt;if(gameTime>=60){gameTime=60;score+=lives*500;updateHud();finishGame(true);return;}
    const left=pressed('arrowleft','a','left'),right=pressed('arrowright','d','right'),up=pressed('arrowup','w','up'),down=pressed('arrowdown','s','down');
    const ax=(right?1:0)-(left?1:0),ay=(down?1:0)-(up?1:0),len=Math.hypot(ax,ay)||1;
    player.vx=(ax/len)*250;player.vy=(ay/len)*250;player.x=Math.max(15,Math.min(W-player.w-12,player.x+player.vx*dt));player.y=Math.max(35,Math.min(H-player.h-25,player.y+player.vy*dt));
    if(ax)player.facing=ax>0?1:-1;player.thruster+=dt*16;if(player.invuln>0)player.invuln-=dt;
    holeCooldown=Math.max(0,holeCooldown-dt);fireTimer-=dt;
    if(pressed(' ','space','fire')&&fireTimer<=0){fireBlackHole();fireTimer=.22;}
    spawnTimer-=dt;if(spawnTimer<=0){spawnEnemy();const wave=1+Math.floor(gameTime/15);spawnTimer=Math.max(.48,1.35-(wave-1)*.18)+Math.random()*.4;}
    for(const e of enemies){e.x+=e.vx*dt;e.y+=Math.sin(gameTime*2+e.phase)*e.vy*dt;e.y=Math.max(24,Math.min(H-70,e.y));e.fire-=dt;
      if(e.fire<=0&&e.x<W-35){const dx=player.x+player.w/2-e.x,dy=player.y+player.h/2-e.y,mag=Math.hypot(dx,dy)||1,speed=110+Math.floor(gameTime/15)*12;enemyShots.push({x:e.x,y:e.y+e.h/2,vx:dx/mag*speed,vy:dy/mag*speed,r:e.heavy?4:3});e.fire=2.2+Math.random()*1.8;}
      if(e.x<-60)e.alive=false;
    }
    for(const s of shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(s.life<=0||s.x<-10||s.x>W+10||s.y<0||s.y>H){holes.push({x:Math.max(14,Math.min(W-20,s.x)),y:Math.max(22,Math.min(H-28,s.y)),life:1.6,age:0,r:0});s.dead=true;playSound(115,.14,'sine',.025);}}
    for(const hole of holes){hole.life-=dt;hole.age+=dt;hole.r=Math.min(67,hole.r+dt*200);
      for(const e of enemies){if(!e.alive)continue;const dx=hole.x-(e.x+e.w/2),dy=hole.y-(e.y+e.h/2),d=Math.hypot(dx,dy);if(d<hole.r+48){const pull=Math.min(220,5600/(d+12));e.x+=dx/(d||1)*pull*dt;e.y+=dy/(d||1)*pull*dt;if(d<24){e.hp-=dt*4;if(e.hp<=0){e.alive=false;score+=e.heavy?250:100;emit(e.x+e.w/2,e.y+e.h/2,'#ce85ff',12);playSound(460,.07,'triangle',.03);}}}}
    }
    for(const b of enemyShots){b.x+=b.vx*dt;b.y+=b.vy*dt;if(overlaps({x:b.x-b.r,y:b.y-b.r,w:b.r*2,h:b.r*2},player)){b.dead=true;loseLife();}if(b.x<-20||b.x>W+20||b.y<-20||b.y>H+20)b.dead=true;}
    for(const e of enemies)if(e.alive&&overlaps(e,player)){e.alive=false;emit(e.x+e.w/2,e.y+e.h/2,'#ff8e9a',12);loseLife();}
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.08,dt);p.vy*=Math.pow(.08,dt);p.life-=dt;}
    shots=shots.filter(s=>!s.dead);holes=holes.filter(h=>h.life>0);enemyShots=enemyShots.filter(s=>!s.dead);enemies=enemies.filter(e=>e.alive);particles=particles.filter(p=>p.life>0);
    updateHud();
  }
  function drawBackground() {
    const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#090d22');bg.addColorStop(.55,'#11102a');bg.addColorStop(1,'#080b1b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    const neb=ctx.createRadialGradient(690,280,8,690,280,330);neb.addColorStop(0,'#623c9630');neb.addColorStop(1,'#533a8b00');ctx.fillStyle=neb;ctx.fillRect(350,0,610,H);
    for(const s of stars){const x=(s.x-gameTime*22*s.s%W+W)%W;ctx.globalAlpha=.35+.55*(.5+.5*Math.sin(elapsed*2+s.p));ctx.fillStyle=s.r>1.3?'#b8caff':'#828dbb';ctx.fillRect(x,s.y,s.r,s.r);}ctx.globalAlpha=1;
    ctx.save();ctx.translate(730,286);ctx.rotate(elapsed*.035);ctx.strokeStyle='#ab67ff15';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(0,0,90+i*28,20+i*9,.55+i*.24,0,Math.PI*2);ctx.stroke();}ctx.restore();
  }
  function drawPlayer() {
    if(player.invuln>0&&Math.floor(elapsed*14)%2===0)return;
    const x=player.x,y=player.y;ctx.save();ctx.translate(x+player.w/2,y+player.h/2);ctx.scale(player.facing,1);
    const flame=10+Math.sin(player.thruster)*4;const fg=ctx.createLinearGradient(-34,0,-13,0);fg.addColorStop(0,'#ff5db9');fg.addColorStop(1,'#ffe690');ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(-14,-7);ctx.lineTo(-14,7);ctx.lineTo(-flame-14,0);ctx.closePath();ctx.fill();
    ctx.shadowColor='#69dafa';ctx.shadowBlur=15;ctx.fillStyle='#82d9f4';ctx.beginPath();ctx.moveTo(-19,-11);ctx.lineTo(5,-14);ctx.lineTo(19,0);ctx.lineTo(5,14);ctx.lineTo(-19,11);ctx.lineTo(-11,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#3d5a99';ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(5,-9);ctx.lineTo(15,0);ctx.lineTo(5,9);ctx.lineTo(-9,8);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#c8fbff';ctx.beginPath();ctx.ellipse(3,0,8,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(0,-2,4,2);ctx.restore();
  }
  function drawEnemy(e) {
    const x=e.x,y=e.y;ctx.save();ctx.translate(x+e.w/2,y+e.h/2);ctx.rotate(Math.sin(elapsed*2+e.phase)*.08);
    ctx.shadowColor=e.heavy?'#ff8b6a':'#ff538d';ctx.shadowBlur=16;ctx.fillStyle=e.heavy?'#c95468':'#a44978';ctx.beginPath();ctx.moveTo(-e.w/2,-e.h/2);ctx.lineTo(e.w/2-5,-e.h/2+2);ctx.lineTo(e.w/2,e.h/2);ctx.lineTo(-e.w/2+4,e.h/2-2);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#39234b';ctx.beginPath();ctx.ellipse(0,0,9,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffdf76';ctx.fillRect(-2,-3,6,3);ctx.fillStyle='#633257';ctx.beginPath();ctx.moveTo(-e.w/2+4,-e.h/2);ctx.lineTo(-e.w/2-7,-e.h/2-7);ctx.lineTo(-e.w/2+1,0);ctx.fill();ctx.beginPath();ctx.moveTo(e.w/2-6,e.h/2);ctx.lineTo(e.w/2+5,e.h/2+7);ctx.lineTo(e.w/2-1,0);ctx.fill();ctx.restore();
    if(e.maxHp>1){ctx.fillStyle='#24152f';ctx.fillRect(x,y-7,e.w,3);ctx.fillStyle='#ff8b75';ctx.fillRect(x,y-7,e.w*e.hp/e.maxHp,3);}
  }
  function drawHole(h) {
    const fade=Math.min(1,h.life/.3, h.age/.08),r=h.r;ctx.save();ctx.globalAlpha=Math.max(0,fade);
    const glow=ctx.createRadialGradient(h.x,h.y,3,h.x,h.y,r+24);glow.addColorStop(0,'#05040e');glow.addColorStop(.18,'#100923');glow.addColorStop(.45,'#9b54fc88');glow.addColorStop(.65,'#37d8ff58');glow.addColorStop(1,'#7551ff00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(h.x,h.y,r+24,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(h.x,h.y);ctx.rotate(elapsed*2);ctx.scale(1,.32);ctx.strokeStyle='#ff8fe0';ctx.lineWidth=3;ctx.shadowColor='#b66cff';ctx.shadowBlur=14;ctx.beginPath();ctx.ellipse(0,0,r*.95,r*.47,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#72eaff';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,r*1.25,r*.6,0,Math.PI*.2,Math.PI*1.55);ctx.stroke();ctx.restore();
    ctx.fillStyle='#03030a';ctx.shadowColor='#a872ff';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(h.x,h.y,Math.max(3,r*.42),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.globalAlpha*=.65;ctx.beginPath();ctx.arc(h.x-2,h.y-2,2,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function draw() {
    drawBackground();
    for(const h of holes)drawHole(h);
    for(const s of shots){const g=ctx.createRadialGradient(s.x,s.y,1,s.x,s.y,17);g.addColorStop(0,'#fff');g.addColorStop(.22,'#eca5ff');g.addColorStop(1,'#a24cff00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(s.x,s.y,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,4,0,Math.PI*2);ctx.fill();}
    for(const b of enemyShots){ctx.fillStyle='#ff738e';ctx.shadowColor='#ff426e';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    for(const e of enemies)drawEnemy(e);
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;
    drawPlayer();
    const vignette=ctx.createRadialGradient(W/2,H/2,140,W/2,H/2,620);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#02030caa');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  }
  function frame(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;elapsed+=dt;update(dt);draw();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();
