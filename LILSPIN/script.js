const spinBtn = document.getElementById('spinBtn');
const betInput = document.getElementById('bet');
const result = document.getElementById('result');
const balanceSpan = document.getElementById('balance');
const buyBtn = document.getElementById('buyBtn');
const buyModal = document.getElementById('buyModal');
const buyClose = document.getElementById('buyClose');
const confirmBuy = document.getElementById('confirmBuy');
const buyAmountButtons = () => document.querySelectorAll('.buy-amount');
let selectedBuyAmount = null;

// load balance from localStorage so it persists across reloads
const _stored = localStorage.getItem('lilspin_balance');
let balance = _stored !== null ? Number(_stored) : 100;
balanceSpan.textContent = balance;

function saveBalance(){
    localStorage.setItem('lilspin_balance', String(balance));
}

// top-up handler
function topUp(amount){
    const n = Number(amount) || 0;
    if(n <= 0) return false;
    balance += Math.floor(n);
    balanceSpan.textContent = balance;
    saveBalance();
    // brief success message
    result.textContent = `+${n} токенов`; result.className='';
    setTimeout(()=>{ if(result.textContent.startsWith('+')) result.textContent = ''; }, 1500);
    return true;
}

const symbols = ['cherry.png','lemon.png','watermelon.png','bell.png','seven.png','wild.svg','scatter.svg'];
const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
];

// payline definitions: each pattern is an array of row indices (one per column)
const PAYLINES = [
    { name: 'Middle', pattern: [1,1,1] },
    { name: 'Top', pattern: [0,0,0] },
    { name: 'Bottom', pattern: [2,2,2] },
    { name: 'Diag TL-BR', pattern: [0,1,2] },
    { name: 'Diag BL-TR', pattern: [2,1,0] }
];

// Win keep probability: if <1, some detected matches may be skipped to reduce frequency.
// Set to 1.0 to ensure any valid 3-in-row is always paid.
const WIN_KEEP_PROB = 1.0; // 1.0 = deterministic payouts

// helper to get active payline indices according to the UI select
function getActivePaylineIndices(){
    const sel = document.getElementById('linesSelect');
    if(!sel) return [0];
    const v = sel.value;
    if(v === '1') return [0]; // middle
    if(v === '3') return [1,0,2]; // top, middle, bottom (order: payline array indices)
    return [0,1,2,3,4]; // default 5
}

const spinSound = document.getElementById('spinSound');
const stopSound = document.getElementById('stopSound');
const winSound = document.getElementById('winSound');

function getRandomSymbol(free=false) {
    const r = Math.random();
    // Variant C: rarer wins + stronger bonuses
    // During free spins make wild more likely
    if(free && r < 0.18) return 'wild.svg';
    if(r < 0.01) return 'seven.png';
    else if(r < 0.05) return 'bell.png';
    else if(r < 0.15) return 'watermelon.png';
    else if(r < 0.35) return 'lemon.png';
    else if(r < 0.39) return 'wild.svg';
    else if(r < 0.45) return 'scatter.svg';
    else return 'cherry.png';
}

function createReelImages(reel, free=false){
    reel.innerHTML = '';
    for(let i=0;i<12;i++){
        const img = document.createElement('img');
        // use a reliable relative path so images are loaded from the local "img" folder
        img.src = './img/' + getRandomSymbol(free);
        reel.appendChild(img);
    }
}

// initialize reels on page load so visible symbols appear immediately
function initReels(){
    reels.forEach(r=>createReelImages(r,false));
    // snap to random start positions after images render
    setTimeout(()=>{
        reels.forEach(r=>{
            const imgs = [...r.querySelectorAll('img')];
            if(imgs.length===0) return;
            const imgH = imgs[0].clientHeight || Math.floor(r.clientHeight/3);
            const maxStart = Math.max(0, imgs.length - 3);
            const start = Math.floor(Math.random()*(maxStart+1));
            r.scrollTop = start * imgH;
        });
    }, 30);
}

function spinReel(reel, duration){
    return new Promise(resolve=>{
        spinSound.currentTime = 0;
        spinSound.play();
        let scrollPos = 0;
        const speed = 35;
        const interval = setInterval(() => {
            scrollPos += speed;
            if(scrollPos >= reel.scrollHeight - reel.clientHeight) scrollPos = 0;
            reel.scrollTop = scrollPos;
        }, 16);

        setTimeout(() => {
            clearInterval(interval);
            // snap to nearest full symbol so exactly 3 full symbols are visible
            stopSound.play();
            // compute image height (fallback to one third of reel height)
            const firstImg = reel.querySelector('img');
            const imgH = firstImg ? firstImg.clientHeight : Math.floor(reel.clientHeight/3);
            // current scrollTop may be in middle of an image; snap to nearest index
            const idx = Math.round(reel.scrollTop / imgH);
            const target = Math.max(0, Math.min(idx * imgH, reel.scrollHeight - reel.clientHeight));
            reel.scrollTop = target;
            resolve();
        }, duration);
    });
}

function checkWins(visible, bet){
    let totalWin = 0;
    let winPositions = []; // list of {col, row}
    let winLines = []; // indices of paylines that produced wins
    const active = getActivePaylineIndices();
    active.forEach(pi => {
        const pattern = PAYLINES[pi].pattern;
        const a = visible[0][pattern[0]];
        const b = visible[1][pattern[1]];
        const c = visible[2][pattern[2]];
        // allow wild.svg to substitute any symbol: determine base symbol (first non-wild)
        const symbolsLine = [a,b,c];
        const nonWild = symbolsLine.find(x => x !== 'wild.svg');
        const base = nonWild || 'wild.svg';
        const match = symbolsLine.every(s => s === base || s === 'wild.svg');
        if(match){
            // apply win-keep probability to reduce payout frequency (Variant C)
            if(Math.random() > WIN_KEEP_PROB) return; // skip this payline (no payout)
            let multiplier = 0;
            switch(base){
                case 'seven.png': multiplier = 20; break; // bigger payout
                case 'bell.png': multiplier = 10; break;
                case 'watermelon.png': multiplier = 5; break;
                case 'lemon.png': multiplier = 3; break;
                case 'cherry.png': multiplier = 1; break;
                case 'wild.svg': multiplier = 1; break;
                case 'scatter.svg': multiplier = 0; break;
                default: multiplier = 0;
            }
            if(multiplier > 0){
                totalWin += bet * multiplier;
                // collect positions for highlighting
                winPositions.push({col:0,row:pattern[0]});
                winPositions.push({col:1,row:pattern[1]});
                winPositions.push({col:2,row:pattern[2]});
                winLines.push(pi);
            }
        }
    });
    return { totalWin, winPositions, winLines };
}

function animateWinImgs(imgs){
    imgs.forEach(img => {
        img.style.transform = "translateY(-20px)";
        img.style.transition = "transform 0.3s ease";
        setTimeout(()=> img.style.transform = "translateY(0)", 300);
    });
}

function checkScatter(visible){
    let count = 0;
    visible.forEach(col => col.forEach(s => { if(typeof s === 'string' && s.startsWith('scatter')) count++; }));
    return count;
}


async function spin(free=false){
    const bet = Number(betInput.value);
    if(bet>balance && !free){ result.textContent = 'Недостаточно средств!'; result.className='msg-fail'; return;}
    if(!free) {
        balance -= bet;
        saveBalance();
    }
    balanceSpan.textContent = balance;
    result.textContent = '';

    // clear previous highlights/lines
    reels.forEach(r=> r.querySelectorAll('img').forEach(img=> img.classList.remove('highlight')));
    document.querySelectorAll('.paylines path').forEach(p => p.classList.remove('active','visible'));

    reels.forEach(r=>createReelImages(r, free));
    // UI: pulse spin button while reels spin and prevent re-clicks
    spinBtn.classList.add('pulse');
    spinBtn.disabled = true;

    try{
        // payline visuals are only shown when a win occurs

        await spinReel(reels[0], 1000);
        await spinReel(reels[1], 1300);
        await spinReel(reels[2], 1600);
    } finally {
        // always re-enable after spin sequence completes (even on error)
        spinBtn.disabled = false;
        // stopping pulse is handled below after processing results
    }

    // compute visible images based on each reel's scrollTop (snapped position)
    const visible = [];
    const startIndices = [];
    reels.forEach(r => {
        const imgs = [...r.querySelectorAll('img')];
        const imgH = imgs[0] ? imgs[0].clientHeight : Math.floor(r.clientHeight/3);
        const start = Math.round(r.scrollTop / imgH);
        startIndices.push(start);
        const names = [];
        for(let i=0;i<3;i++){
            const img = imgs[start + i];
            names.push(img ? img.getAttribute('src').split('/').pop() : null);
        }
        visible.push(names);
    });
    const {totalWin, winPositions, winLines} = checkWins(visible, bet);

    // clear any previous active payline visuals
    document.querySelectorAll('.paylines path').forEach(p => p.classList.remove('active'));

    if(totalWin>0){
        balance+=totalWin;
        balanceSpan.textContent = balance;
        saveBalance();
        result.textContent = `🎉 Вы выиграли ${totalWin} токенов!`;
        result.className = '';
        winSound.play();
        let winImgs = [];
        // clear previous highlights
        reels.forEach(r=> r.querySelectorAll('img').forEach(img=> img.classList.remove('highlight')));
        // highlight each winning position (use startIndices to map row->actual image index)
        winPositions.forEach(p => {
            const start = startIndices[p.col] || 0;
            const img = reels[p.col].querySelectorAll('img')[start + p.row];
            if(img){ img.classList.add('highlight'); winImgs.push(img); }
        });
        // highlight the winning payline(s)
        if(Array.isArray(winLines)){
            winLines.forEach(i => {
                const path = document.getElementById('line-' + i);
                if(path) path.classList.add('active');
            });
        }
        animateWinImgs(winImgs);
    } else {
        result.textContent = 'Попробуйте снова!';
        result.className = 'msg-fail';
    }

    const scatterCount = checkScatter(visible);
    if(scatterCount>=3){
        // larger free-spin reward under Variant C
        let freeSpins = 8 + Math.floor(Math.random()*8); // 8-15 free spins
        result.textContent = `🎁 ${freeSpins} бесплатных спинов!`;
        while(freeSpins>0){
            freeSpins--;
            await spin(true);
        }
    }

    // stop UI pulse
    spinBtn.classList.remove('pulse');
}

spinBtn.addEventListener('click', ()=>spin());

// wire top-up button
// Buy modal wiring (stub) — integrate real payment provider in production
if(buyBtn){
    buyBtn.addEventListener('click', ()=>{
        if(buyModal) buyModal.setAttribute('aria-hidden','false');
        selectedBuyAmount = null;
        (buyAmountButtons() || []).forEach(b=>b.classList.remove('active'));
    });
}
if(buyClose){ buyClose.addEventListener('click', ()=> buyModal && buyModal.setAttribute('aria-hidden','true')); }
// amount buttons
function onAmountClick(e){
    const b = e.currentTarget;
    selectedBuyAmount = Number(b.dataset.amount) || null;
    (buyAmountButtons() || []).forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
}
(function attachAmountHandlers(){
    const buttons = buyAmountButtons();
    buttons.forEach(b=> b.addEventListener('click', onAmountClick));
})();
if(confirmBuy){
    confirmBuy.addEventListener('click', ()=>{
        if(!selectedBuyAmount){ result.textContent = 'Выберите сумму покупки'; result.className='msg-fail'; return; }
        // In production open payment gateway here. For demo, we simulate success after short delay.
        result.textContent = 'Переход к платёжному шлюзу...'; result.className='';
        setTimeout(()=>{
            // simulate successful payment
            topUp(selectedBuyAmount);
            if(buyModal) buyModal.setAttribute('aria-hidden','true');
        }, 900);
    });
}

// tilt interaction removed per user request (3D screen movement disabled)

// initialize reels immediately so visible symbols show on page load
initReels();
