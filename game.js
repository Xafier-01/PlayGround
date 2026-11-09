(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = (s) => document.querySelector(s);
  const scoreEl = $('#score'), coinsEl = $('#coins'), livesEl = $('#lives'), timeEl = $('#time'), progressEl = $('#progress');
  const overlay = $('#overlay'), overlayCard = $('#overlayCard'), toast = $('#toast');
  const abilityStatus = $('#abilityStatus');
  const keys = new Set(), touch = new Set();
  const levelEnd = 4540;
  let state = 'title', last = 0, elapsed = 0, camera = 0, soundOn = true, audioCtx = null, toastTimer;
  let player, platforms, blocks, coins, enemies, particles, blackholes, score, coinCount, lives, timeLeft, flagRaised;
  let blackholeCooldown = 0, shootingLast = false;

  const ground = [{x:0,w:1525},{x:1645,w:1445},{x:3235,w:1450}];
  const platformSeed = [
    [300,355,150,22],[555,300,120,22],[765,350,165,22],[1005,285,140,22],
    [1240,340,150,22],[1510,300,115,22],[1745,350,145,22],[1980,290,170,22],
    [2240,345,130,22],[2490,280,150,22],[2740,340,145,22],[3000,300,115,22],
    [3345,350,150,22],[3580,290,170,22],[3860,345,145,22],[4100,285,140,22]
  ];
  const blockSeed = [[455,355],[485,355],[515,355],[885,265],[915,265],[945,265],[1380,295],[2040,250],[2070,250],[2380,300],[2670,235],[2700,235],[3710,245],[3740,245],[4010,300]];
  const coinSeed = [
    [210,407],[250,407],[300,310],[360,310],[410,310],[565,255],[610,255],[655,255],
    [785,305],[835,305],[885,215],[915,215],[945,215],[1020,235],[1070,235],
    [1260,295],[1310,295],[1360,295],[1520,250],[1760,305],[1810,305],[1860,305],
    [1990,245],[2040,200],[2070,200],[2100,245],[2260,300],[2310,300],[2390,255],
    [2510,235],[2560,235],[2610,235],[2685,190],[2715,190],[2760,295],[2810,295],
    [3020,255],[3070,255],[3370,305],[3420,305],[3590,245],[3640,245],[3690,245],
    [3725,200],[3755,200],[3880,300],[3930,300],[4025,255],[4075,255],[4125,255],[4290,407]
  ];

  function resetGame() {
    player = {x:70,y:390,w:29,h:43,vx:0,vy:0,grounded:false,facing:1,invuln:0,walk:0};
    platforms = platformSeed.map(([x,y,w,h]) => ({x,y,w,h}));
    blocks = blockSeed.map(([x,y]) => ({x,y,w:30,h:30,used:false,bump:0}));
    coins = coinSeed.map(([x,y]) => ({x,y,r:9,taken:false,bob:Math.random()*6}));
    enemies = [
      {x:700,y:422,w:30,h:28,vx:45,min:675,max:755,alive:true},
      {x:1165,y:422,w:30,h:28,vx:-48,min:1125,max:1205,alive:true},
      {x:1840,y:422,w:30,h:28,vx:50,min:1800,max:1925,alive:true},
      {x:2340,y:422,w:30,h:28,vx:-54,min:2300,max:2405,alive:true},
      {x:2870,y:422,w:30,h:28,vx:52,min:2825,max:2915,alive:true},
      {x:3470,y:422,w:30,h:28,vx:-50,min:3420,max:3530,alive:true},
      {x:3970,y:422,w:30,h:28,vx:55,min:3925,max:4005,alive:true}
    ];
    particles = []; blackholes = []; blackholeCooldown = 0; shootingLast = false;
    score = 0; coinCount = 0; lives = 3; timeLeft = 300; camera = 0; flagRaised = false;
    updateHud();
  }
  resetGame();

  function playSound(freq=600, duration=.08, type='square') {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(.055, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }
  function updateHud() {
    scoreEl.textContent = String(score).padStart(6,'0');
    coinsEl.textContent = String(coinCount).padStart(2,'0');
    livesEl.textContent = lives > 0 ? '♥ '.repeat(lives).trim() : '—';
    timeEl.textContent = String(Math.max(0, Math.ceil(timeLeft))).padStart(3,'0');
    abilityStatus.textContent = blackholeCooldown <= 0 ? 'READY' : `${blackholeCooldown.toFixed(1)}s`;
    abilityStatus.classList.toggle('ready', blackholeCooldown <= 0);
    progressEl.style.width = `${Math.max(0, Math.min(100, (player.x / levelEnd) * 100))}%`;
  }
  function showToast(text) {
    toast.textContent = text; toast.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1150);
  }
  function startGame() {
    if (state === 'title' || state === 'over' || state === 'won') resetGame();
    state = 'playing'; overlay.classList.add('hidden'); last = performance.now(); playSound(520,.07);
  }
  function pauseGame() {
    if (state === 'playing') {
      state = 'paused'; overlayCard.innerHTML = '<div class="mini-kicker"><span>Ⅱ</span> TAKE A BREATHER</div><h1 style="color:#286eaa;text-shadow:2px 3px 0 #aad9ec">PAUSED</h1><p class="overlay-copy">Your adventure is right where you left it.</p><button class="play-button" id="playButton"><span>▶</span> KEEP GOING</button><div class="control-hint"><kbd>P</kbd> RESUME <i>·</i> <kbd>R</kbd> RESTART</div>';
      $('#playButton').addEventListener('click', startGame); overlay.classList.remove('hidden');
    } else if (state === 'paused') startGame();
  }
  function finishGame(won) {
    state = won ? 'won' : 'over';
    const title = won ? 'LEVEL<br><em>CLEARED!</em>' : 'GAME<br><em>OVER</em>';
    const copy = won ? `You made it! Final score: ${String(score).padStart(6,'0')}` : 'The hills will be here when you’re ready.';
    overlayCard.innerHTML = `<div class="mini-kicker"><span>★</span> ${won ? 'A HEROIC RUN' : 'NICE TRY, HERO'} <span>★</span></div><h1>${title}</h1><p class="overlay-copy">${copy}</p><button class="play-button" id="playButton"><span>↻</span> PLAY AGAIN</button><div class="control-hint">WORLD 1—1 <i>·</i> ${coinCount} COINS COLLECTED</div>`;
    $('#playButton').addEventListener('click', startGame); overlay.classList.remove('hidden'); playSound(won?850:220,.22,won?'triangle':'sawtooth');
  }
  $('#playButton').addEventListener('click', startGame);
  $('#soundButton').addEventListener('click', () => {
    soundOn = !soundOn; $('#soundButton').innerHTML = `${soundOn?'♫':'♪'} <span>SOUND ${soundOn?'ON':'OFF'}</span>`;
    if (soundOn) playSound(660,.06);
  });

  function inputDown(e) {
    const key = e.key.toLowerCase();
    if (['arrowleft','arrowright','arrowup',' ','arrowdown'].includes(key)) e.preventDefault();
    keys.add(key);
    if (key === 'p' && (state === 'playing' || state === 'paused')) pauseGame();
    if (key === 'r' && state !== 'title') { resetGame(); startGame(); }
    if ((key === ' ' || key === 'arrowup' || key === 'w') && (state === 'title' || state === 'over' || state === 'won')) startGame();
  }
  function inputUp(e) { keys.delete(e.key.toLowerCase()); }
  window.addEventListener('keydown', inputDown); window.addEventListener('keyup', inputUp);
  window.addEventListener('blur', () => { keys.clear(); touch.clear(); });
  document.querySelectorAll('[data-control]').forEach(button => {
    const control = button.dataset.control;
    const down = e => { e.preventDefault(); touch.add(control); button.classList.add('pressed'); if (state === 'title' && control === 'jump') startGame(); };
    const up = e => { e.preventDefault(); touch.delete(control); button.classList.remove('pressed'); };
    button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('lostpointercapture', up);
  });

  function pressed(...names) { return names.some(n => keys.has(n) || touch.has(n)); }
  function rects(a,b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function surfaces() { return platforms.concat(ground.map(g => ({x:g.x,y:450,w:g.w,h:120})), blocks); }
  function emit(x,y,color,count=7) {
    for (let i=0;i<count;i++) particles.push({x,y,vx:(Math.random()-.5)*180,vy:-Math.random()*150-35,life:.45+Math.random()*.35,color,size:3+Math.random()*3});
  }
  function loseLife() {
    if (player.invuln > 0 || state !== 'playing') return;
    lives--; updateHud(); playSound(180,.18,'sawtooth');
    if (lives <= 0) { finishGame(false); return; }
    player.x = Math.max(70,camera+90); player.y = 330; player.vx = 0; player.vy = -260; player.invuln = 2;
    showToast('OOPS! KEEP GOING');
  }
  function collectCoin(c) {
    c.taken = true; coinCount++; score += 100; updateHud(); emit(c.x,c.y,'#ffd34e',5); playSound(740,.07);
  }
  function fireBlackhole() {
    if (state !== 'playing' || blackholeCooldown > 0) return;
    blackholes.push({x:player.x+player.w/2+player.facing*18,y:player.y+player.h*.45,vx:player.facing*500,age:0,life:0,mode:'fly',spin:Math.random()*Math.PI*2});
    blackholeCooldown = 1.05; playSound(145,.16,'sawtooth');
  }
  function updateBlackholes(dt) {
    blackholeCooldown = Math.max(0,blackholeCooldown-dt);
    for (const hole of blackholes) {
      if (hole.mode === 'fly') {
        hole.x += hole.vx*dt; hole.age += dt;
        let impact = false;
        for (const enemy of enemies) if (enemy.alive && Math.hypot(enemy.x+enemy.w/2-hole.x,enemy.y+enemy.h/2-hole.y)<31) impact = true;
        if (impact || hole.age >= .48) {
          hole.mode = 'vortex'; hole.life = 1.12; playSound(95,.12,'triangle');
          emit(hole.x,hole.y,'#b58cff',12);
        }
      } else {
        hole.life -= dt; hole.spin += dt*7;
        const radius = 108;
        for (const enemy of enemies) if (enemy.alive) {
          const dx=hole.x-(enemy.x+enemy.w/2),dy=hole.y-(enemy.y+enemy.h/2),dist=Math.hypot(dx,dy);
          if (dist<radius) {
            if (dist<22) {
              enemy.alive=false; score+=300; emit(enemy.x+enemy.w/2,enemy.y+enemy.h/2,'#b58cff',12); playSound(260,.08,'triangle'); updateHud();
            } else {
              const pull=Math.min(360*dt,dist*.62),ratio=pull/dist;
              enemy.x+=dx*ratio; enemy.y+=dy*ratio;
            }
          }
        }
        for (const coin of coins) if (!coin.taken) {
          const dx=hole.x-coin.x,dy=hole.y-coin.y,dist=Math.hypot(dx,dy);
          if (dist<radius) {
            if (dist<17) collectCoin(coin);
            else { const pull=Math.min(420*dt,dist*.7),ratio=pull/dist; coin.x+=dx*ratio; coin.y+=dy*ratio; }
          }
        }
      }
    }
    blackholes=blackholes.filter(h=>h.mode==='fly'?h.x>-40&&h.x<levelEnd+40:h.life>0);
  }
  function update(dt) {
    if (state !== 'playing') return;
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; updateHud(); finishGame(false); return; }
    const left = pressed('arrowleft','a','left'), right = pressed('arrowright','d','right');
    const jump = pressed(' ','arrowup','w','jump');
    const shoot = pressed('x','f','shoot');
    if (shoot && !shootingLast) fireBlackhole();
    shootingLast = shoot;
    const speed = 235, accel = player.grounded ? 1550 : 930;
    if (left !== right) { player.vx += (left ? -1 : 1) * accel * dt; player.vx = Math.max(-speed,Math.min(speed,player.vx)); player.facing = left ? -1 : 1; }
    else player.vx *= Math.pow(player.grounded ? .001 : .3,dt);
    if (jump && player.grounded) { player.vy = -515; player.grounded = false; playSound(410,.08); }
    player.vy = Math.min(760,player.vy + 1420*dt);
    const oldY = player.y, oldBottom = player.y+player.h;
    player.x += player.vx*dt;
    for (const s of surfaces()) if (rects(player,s)) {
      if (player.vx > 0) player.x = s.x-player.w;
      else if (player.vx < 0) player.x = s.x+s.w;
      player.vx = 0;
    }
    player.y += player.vy*dt; player.grounded = false;
    for (const s of surfaces()) if (rects(player,s)) {
      if (player.vy > 0) { player.y = s.y-player.h; player.vy = 0; player.grounded = true; }
      else if (player.vy < 0 && oldY >= s.y+s.h-2) {
        player.y = s.y+s.h; player.vy = 90;
        const block = blocks.find(b => b === s);
        if (block && !block.used) { block.used = true; block.bump = 80; score += 200; coinCount++; emit(block.x+15,block.y-4,'#ffd34e',8); playSound(880,.12); showToast('COIN +200'); updateHud(); }
        else playSound(190,.04);
      }
    }
    player.x = Math.max(0,Math.min(levelEnd-10,player.x));
    player.walk += Math.abs(player.vx)*dt*.045;
    if (player.invuln > 0) player.invuln -= dt;
    for (const b of blocks) if (b.bump>0) b.bump=Math.max(0,b.bump-dt*80);

    for (const e of enemies) if (e.alive) {
      e.x += e.vx*dt;
      if (e.x < e.min || e.x+e.w > e.max) e.vx *= -1;
      if (rects(player,e)) {
        if (player.vy > 80 && oldBottom <= e.y+12) {
          e.alive=false; player.y=e.y-player.h; player.vy=-310; score+=200; emit(e.x+15,e.y+8,'#ce7052'); playSound(300,.09); updateHud(); showToast('NICE STOMP! +200');
        } else loseLife();
      }
    }
    updateBlackholes(dt);
    for (const c of coins) if (!c.taken && rects(player,{x:c.x-c.r,y:c.y-c.r+Math.sin(elapsed*4+c.bob)*3,w:c.r*2,h:c.r*2})) collectCoin(c);
    for (const p of particles) {p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=380*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    if (player.y > H+110) loseLife();
    camera = Math.max(0,Math.min(levelEnd-W+130,player.x-300));
    if (player.x > levelEnd-100 && !flagRaised) { flagRaised=true; score += Math.ceil(timeLeft)*10; updateHud(); finishGame(true); }
    updateHud();
  }

  function rounded(x,y,w,h,r,color) {
    ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
  }
  function drawBackground() {
    const sky=ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#73d3f2'); sky.addColorStop(1,'#c7eff0'); ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffe89a';ctx.beginPath();ctx.arc(815,105,38,0,Math.PI*2);ctx.fill();
    const cloud=(x,y,s)=>{ctx.fillStyle='#ffffffc9';ctx.beginPath();ctx.ellipse(x,y,30*s,12*s,0,0,Math.PI*2);ctx.ellipse(x-19*s,y+3*s,17*s,10*s,0,0,Math.PI*2);ctx.ellipse(x+18*s,y+1*s,19*s,11*s,0,0,Math.PI*2);ctx.fill();};
    for(let i=0;i<7;i++){let x=((i*197-camera*.18)%(W+180)+W+180)%(W+180)-70;cloud(x,95+(i%3)*49,.8+(i%2)*.22);}
    for(let layer=0;layer<2;layer++){
      const shift=camera*(layer?.26:.13), base=layer?394:421, color=layer?'#9bdc9a':'#b4e6a5';ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);
      for(let x=-160;x<W+200;x+=1){const wx=x+shift;const y=base-Math.max(0,Math.sin(wx*.005+layer)*85)-Math.max(0,Math.sin(wx*.011+2)*24);ctx.lineTo(x,y);}
      ctx.lineTo(W,H);ctx.closePath();ctx.fill();
    }
    for(let i=0;i<12;i++){
      const x=((i*155-camera*.42)%(W+150)+W+150)%(W+150)-50,y=365+(i%3)*12;
      ctx.fillStyle='#71c589';ctx.fillRect(x-5,y,10,57);ctx.beginPath();ctx.arc(x,y-5,25,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x-15,y+9,16,0,Math.PI*2);ctx.arc(x+14,y+10,17,0,Math.PI*2);ctx.fill();
    }
  }
  function drawGround() {
    for(const g of ground){
      const sx=g.x-camera;if(sx>W||sx+g.w<0)continue;
      ctx.fillStyle='#8c542d';ctx.fillRect(sx,450,g.w,100);ctx.fillStyle='#66bb54';ctx.fillRect(sx,450,g.w,12);ctx.fillStyle='#9cdf66';ctx.fillRect(sx,450,g.w,4);
      for(let x=Math.max(0,Math.floor((camera-g.x)/32)*32);x<Math.min(g.w,camera+W-g.x);x+=32){
        const px=g.x+x-camera;ctx.fillStyle='#a96b3d';ctx.fillRect(px,462,30,25);ctx.strokeStyle='#7d492e';ctx.lineWidth=2;ctx.strokeRect(px,462,30,25);
        ctx.beginPath();ctx.moveTo(px,474);ctx.lineTo(px+30,474);ctx.moveTo(px+15,462);ctx.lineTo(px+15,474);ctx.moveTo(px+8,474);ctx.lineTo(px+8,487);ctx.stroke();ctx.fillStyle='#bf7c42';ctx.fillRect(px+3,465,5,3);
      }
    }
  }
  function drawPlatform(p) {
    const x=p.x-camera;if(x+p.w<0||x>W)return;
    ctx.fillStyle='#b87342';ctx.fillRect(x,p.y,p.w,p.h);ctx.fillStyle='#edb05d';ctx.fillRect(x,p.y,p.w,5);ctx.strokeStyle='#8e5637';ctx.lineWidth=2;
    for(let xx=0;xx<p.w;xx+=30)ctx.strokeRect(x+xx,p.y+5,30,p.h-5);
    ctx.beginPath();ctx.moveTo(x,p.y+14);ctx.lineTo(x+p.w,p.y+14);ctx.stroke();ctx.fillStyle='#f4c578';ctx.fillRect(x+5,p.y+2,7,2);
  }
  function drawBlock(b) {
    const x=b.x-camera;if(x+30<0||x>W)return;const bump=b.bump?Math.sin((b.bump/80)*Math.PI)*6:0,y=b.y-bump;
    rounded(x,y,30,30,4,b.used?'#bf8852':'#f9b944');ctx.strokeStyle=b.used?'#95613a':'#fff0a1';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,28,28);
    if(!b.used){ctx.fillStyle='#fff4bf';ctx.font='bold 20px Nunito';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',x+15,y+15);}else{ctx.fillStyle='#a56b3b';ctx.fillRect(x+9,y+13,12,4);}
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }
  function drawCoin(c) {
    if(c.taken)return;const x=c.x-camera,y=c.y+Math.sin(elapsed*4+c.bob)*3;if(x<-20||x>W+20)return;
    ctx.fillStyle='#d99526';ctx.beginPath();ctx.ellipse(x,y,c.r*.76,c.r,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd94f';ctx.beginPath();ctx.ellipse(x-1,y-1,c.r*.62,c.r*.83,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff1a7';ctx.fillRect(x-2,y-5,3,7);
  }
  function drawEnemy(e) {
    if(!e.alive)return;const x=e.x-camera,y=e.y+Math.sin(elapsed*8+e.x)*1.3;if(x<-40||x>W+40)return;
    ctx.fillStyle='#513a3c';ctx.fillRect(x+3,y+22,9,6);ctx.fillRect(x+19,y+22,9,6);ctx.fillStyle='#9d533d';ctx.beginPath();ctx.ellipse(x+15,y+14,15,14,0,Math.PI,Math.PI*2);ctx.lineTo(x+30,y+22);ctx.quadraticCurveTo(x+15,y+31,x,y+22);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f8edd2';ctx.fillRect(x+8,y+12,6,8);ctx.fillRect(x+18,y+12,6,8);ctx.fillStyle='#293c4a';ctx.fillRect(x+11,y+15,3,5);ctx.fillRect(x+20,y+15,3,5);ctx.strokeStyle='#4b302e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+7,y+11);ctx.lineTo(x+14,y+13);ctx.moveTo(x+18,y+13);ctx.lineTo(x+25,y+11);ctx.stroke();
  }
  function drawBlackholes() {
    for (const hole of blackholes) {
      const x=hole.x-camera,y=hole.y;
      if(x<-140||x>W+140)continue;
      if(hole.mode==='fly') {
        ctx.save();
        ctx.shadowColor='#9b62ff';ctx.shadowBlur=18;ctx.fillStyle='#160d2b';ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#e2c6ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,17,6,hole.spin,0,Math.PI*2);ctx.stroke();
        ctx.restore();
      } else {
        const pulse=1+Math.sin(elapsed*15+hole.spin)*.08, radius=35*pulse;
        ctx.save();ctx.translate(x,y);ctx.rotate(hole.spin);
        ctx.globalAlpha=Math.min(1,hole.life*2);
        ctx.strokeStyle='#a968ff';ctx.lineWidth=3;ctx.shadowColor='#8c4bea';ctx.shadowBlur=22;
        ctx.beginPath();ctx.ellipse(0,0,radius*1.6,radius*.48,0,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='#e5c4ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,radius*1.25,radius*.34,Math.PI/5,0,Math.PI*2);ctx.stroke();
        const glow=ctx.createRadialGradient(0,0,3,0,0,radius);
        glow.addColorStop(0,'#05030a');glow.addColorStop(.58,'#160d2b');glow.addColorStop(.78,'#6e35b8cc');glow.addColorStop(1,'#a56aff00');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#08050e';ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }
  }
  function drawHero() {
    if(player.invuln>0&&Math.floor(elapsed*12)%2===0)return;
    const x=player.x-camera,y=player.y,dir=player.facing;ctx.save();ctx.translate(x+player.w/2,y);ctx.scale(dir,1);
    const step=player.grounded?Math.sin(player.walk*1.6)*3:0;
    ctx.fillStyle='#70432e';ctx.fillRect(-13,36+Math.max(0,step),12,7);ctx.fillRect(3,36+Math.max(0,-step),12,7);
    ctx.fillStyle='#287ac2';ctx.fillRect(-11,25,22,14);ctx.fillRect(-12,23,9,10);ctx.fillRect(3,23,9,10);ctx.fillStyle='#f5cb70';ctx.fillRect(-7,27,4,4);ctx.fillRect(4,27,4,4);
    ctx.fillStyle='#e94e40';ctx.fillRect(-12,15,24,13);ctx.fillRect(-14,18,4,9);ctx.fillStyle='#f4bd8c';ctx.fillRect(-10,5,19,14);ctx.fillRect(-13,11,4,6);ctx.fillRect(8,12,4,5);
    ctx.fillStyle='#e94e40';ctx.fillRect(-12,1,24,6);ctx.fillRect(-8,-3,19,5);ctx.fillRect(-15,5,29,3);ctx.fillStyle='#fff1d2';ctx.fillRect(1,1,5,3);ctx.fillStyle='#263c4b';ctx.fillRect(3,9,3,5);ctx.fillStyle='#533a33';ctx.fillRect(-5,15,13,4);ctx.fillRect(5,14,7,3);ctx.restore();
  }
  function drawFlag() {
    const x=levelEnd-68-camera;if(x<-40||x>W+30)return;
    ctx.fillStyle='#f9f4de';ctx.fillRect(x,167,6,283);ctx.fillStyle='#d5dfcc';ctx.fillRect(x+6,172,3,278);ctx.fillStyle='#fc5a48';ctx.beginPath();ctx.moveTo(x+5,174);ctx.lineTo(x+72,190);ctx.lineTo(x+5,209);ctx.closePath();ctx.fill();ctx.fillStyle='#ffe275';ctx.beginPath();ctx.arc(x+3,166,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4b9a55';ctx.fillRect(x-10,442,28,8);ctx.fillRect(x-17,448,42,6);
  }
  function draw() {
    ctx.clearRect(0,0,W,H);drawBackground();
    for(let i=0;i<16;i++){const wx=i*287+155,sx=wx-camera;if(sx<0||sx>W)continue;ctx.fillStyle='#438e52';ctx.fillRect(sx,438,2,12);ctx.fillStyle=i%2?'#fff5db':'#ff8290';ctx.beginPath();ctx.arc(sx,436,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fbd04c';ctx.beginPath();ctx.arc(sx,436,1.5,0,Math.PI*2);ctx.fill();}
    drawGround();for(const p of platforms)drawPlatform(p);for(const b of blocks)drawBlock(b);for(const c of coins)drawCoin(c);drawFlag();for(const e of enemies)drawEnemy(e);
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x-camera,p.y,p.size,p.size);ctx.globalAlpha=1;}
    drawBlackholes();drawHero();const vignette=ctx.createLinearGradient(0,0,0,H);vignette.addColorStop(0,'#18395112');vignette.addColorStop(.28,'transparent');vignette.addColorStop(1,'#342b2520');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  }
  function frame(now) {
    const dt=Math.min(.033,(now-last)/1000||0);last=now;elapsed+=dt;update(dt);draw();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
