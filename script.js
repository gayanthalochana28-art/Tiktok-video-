import { removeBackground } from "https://esm.sh/@imgly/background-removal@1.5.5";
window.__removeBackground = removeBackground;

function showTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
}

/* ---------- TikTok downloader ---------- */
async function fetchTikTok(){
  const urlInput = document.getElementById('tiktokUrl');
  const url = urlInput.value.trim();
  const statusEl = document.getElementById('tkStatus');
  const resultEl = document.getElementById('tkResult');
  const btn = document.getElementById('fetchBtn');
  resultEl.classList.remove('show');
  statusEl.className = 'status';

  if(!url || !url.includes('tiktok.com')){
    statusEl.textContent = 'Paste a valid TikTok link first.';
    statusEl.className = 'status error';
    return;
  }

  statusEl.textContent = 'Looking up video…';
  btn.disabled = true;

  // Official oEmbed preview (always attempt — works for any public video URL)
  loadOEmbed(url);

  try{
    const api = 'https://www.tikwm.com/api/?url=' + encodeURIComponent(url) + '&hd=1';
    const res = await fetch(api);
    if(!res.ok) throw new Error('lookup failed');
    const data = await res.json();

    if(data.code !== 0 || !data.data){
      throw new Error(data.msg || 'Could not resolve this link');
    }

    const d = data.data;
    document.getElementById('tkThumb').src = d.cover || d.origin_cover || '';
    document.getElementById('tkTitle').textContent = d.title || 'TikTok video';
    document.getElementById('tkAuthor').textContent = d.author ? ('@' + d.author.unique_id) : '';

    const base = 'https://www.tikwm.com';
    const noWm = d.play ? (d.play.startsWith('http') ? d.play : base + d.play) : '';
    const hd = d.hdplay ? (d.hdplay.startsWith('http') ? d.hdplay : base + d.hdplay) : noWm;

    document.getElementById('tkNoWm').href = noWm;
    document.getElementById('tkHd').href = hd;

    resultEl.classList.add('show');
    statusEl.textContent = 'Found it — pick a download option below.';
  }catch(err){
    statusEl.textContent = 'Could not fetch a download link right now (service may be rate-limited). The preview below still works. Try again in a moment.';
    statusEl.className = 'status error';
  }finally{
    btn.disabled = false;
  }
}

async function loadOEmbed(url){
  const box = document.getElementById('oembedBox');
  box.innerHTML = '<span style="color:var(--muted); font-size:13px;">Loading preview…</span>';
  try{
    const res = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url));
    if(!res.ok) throw new Error('no oembed');
    const data = await res.json();
    box.innerHTML = data.html || '';
    // load TikTok's embed script so the blockquote renders as a real player
    if(!document.getElementById('tiktok-embed-script')){
      const s = document.createElement('script');
      s.id = 'tiktok-embed-script';
      s.src = 'https://www.tiktok.com/embed.js';
      s.async = true;
      document.body.appendChild(s);
    } else if(window.tiktokEmbed && window.tiktokEmbed.lib && window.tiktokEmbed.lib.render){
      window.tiktokEmbed.lib.render();
    }
  }catch(e){
    box.innerHTML = '<span style="color:var(--muted); font-size:13px;">Preview unavailable for this link.</span>';
  }
}

/* ---------- Background remover ---------- */
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

['dragenter','dragover'].forEach(evt=>{
  dropZone.addEventListener(evt, e=>{ e.preventDefault(); dropZone.classList.add('drag'); });
});
['dragleave','drop'].forEach(evt=>{
  dropZone.addEventListener(evt, e=>{ e.preventDefault(); dropZone.classList.remove('drag'); });
});
dropZone.addEventListener('drop', e=>{
  const file = e.dataTransfer.files[0];
  if(file) handleImage(file);
});
fileInput.addEventListener('change', e=>{
  const file = e.target.files[0];
  if(file) handleImage(file);
});

async function handleImage(file){
  const statusEl = document.getElementById('bgStatus');
  const progWrap = document.getElementById('bgProgressWrap');
  const progBar = document.getElementById('bgProgressBar');
  const resultEl = document.getElementById('bgResult');

  if(!file.type.startsWith('image/')){
    statusEl.textContent = 'Please choose an image file.';
    statusEl.className = 'status error';
    return;
  }

  resultEl.classList.remove('show');
  statusEl.className = 'status';
  statusEl.textContent = 'Loading model (first run downloads it, then it\'s cached)…';
  progWrap.style.display = 'block';
  progBar.style.width = '5%';

  const originalUrl = URL.createObjectURL(file);
  document.getElementById('bgOriginal').src = originalUrl;

  try{
    if(!window.__removeBackground){
      await new Promise(r => setTimeout(r, 400));
    }
    const config = {
      progress: (key, current, total) => {
        const pct = total ? Math.round((current/total)*100) : 0;
        progBar.style.width = Math.min(95, pct) + '%';
        statusEl.textContent = 'Removing background… ' + pct + '%';
      }
    };
    const blob = await window.__removeBackground(file, config);
    const outUrl = URL.createObjectURL(blob);
    document.getElementById('bgOutput').src = outUrl;
    document.getElementById('bgDownload').href = outUrl;
    progBar.style.width = '100%';
    statusEl.textContent = 'Done.';
    resultEl.classList.add('show');
    setTimeout(()=>{ progWrap.style.display='none'; progBar.style.width='0%'; }, 600);
  }catch(err){
    console.error(err);
    statusEl.textContent = 'Something went wrong processing that image. Try a smaller file or a different photo.';
    statusEl.className = 'status error';
    progWrap.style.display = 'none';
  }
}

/* ---------- Title & hashtag generator (fully local, no API) ---------- */

const CATEGORY_TAGS = {
  food: ['#foodtiktok','#foodie','#recipe','#homecooking','#easyrecipe','#foodlover','#yummy'],
  travel: ['#travel','#traveltiktok','#wanderlust','#explorepage','#travelgram','#adventure'],
  fitness: ['#fitness','#workout','#gymtok','#fittok','#fitnessmotivation','#healthylifestyle'],
  comedy: ['#comedy','#funny','#humor','#comedytiktok','#relatable','#funnyvideos'],
  beauty: ['#beauty','#makeup','#skincare','#beautytiktok','#glowup','#makeuptutorial'],
  fashion: ['#fashion','#ootd','#style','#fashiontiktok','#outfitinspo'],
  pets: ['#petsoftiktok','#dogsoftiktok','#catsoftiktok','#cuteanimals','#animallovers'],
  music: ['#music','#musictok','#newmusic','#singer','#cover'],
  dance: ['#dance','#dancetiktok','#choreography','#dancer'],
  tech: ['#tech','#technology','#techtok','#gadgets','#coding'],
  gaming: ['#gaming','#gamer','#gamingtiktok','#gameplay','#videogames'],
  diy: ['#diy','#lifehacks','#hacks','#howto','#tutorial'],
  motivation: ['#motivation','#inspiration','#mindset','#selfimprovement'],
  business: ['#smallbusiness','#entrepreneur','#business','#marketing'],
  asmr: ['#asmr','#satisfying','#oddlysatisfying'],
  vlog: ['#vlog','#dayinmylife','#dailyvlog','#lifestyle'],
};

const CATEGORY_KEYWORDS = {
  food: ['food','cook','cooking','recipe','kitchen','eat','eating','meal','tea','coffee','bake','baking','snack','dinner','breakfast','lunch','milk','curry','rice'],
  travel: ['travel','trip','vacation','flight','beach','hotel','explore','city','country','island','tour'],
  fitness: ['gym','workout','fitness','exercise','run','running','training','muscle','cardio'],
  comedy: ['funny','joke','comedy','prank','skit','meme','laugh'],
  beauty: ['makeup','skincare','beauty','glow','routine','skin'],
  fashion: ['outfit','fashion','style','clothes','wear','ootd'],
  pets: ['dog','cat','pet','puppy','kitten','animal'],
  music: ['song','music','sing','singer','cover','beat'],
  dance: ['dance','dancing','choreo','choreography'],
  tech: ['tech','coding','app','software','gadget','ai'],
  gaming: ['game','gaming','gamer','playstation','xbox','stream'],
  diy: ['diy','hack','tutorial','howto','craft','build'],
  motivation: ['motivation','mindset','inspire','success','goals'],
  business: ['business','startup','marketing','entrepreneur','hustle'],
  asmr: ['asmr','satisfying','soap','slime','soft'],
  vlog: ['vlog','day','morning','routine','life'],
};

const TITLE_TEMPLATES = [
  x => `POV: ${x}`,
  x => `Wait for it 👀 ${x}`,
  x => `You won't believe this ${x}`,
  x => `${x} hits different`,
  x => `Day in my life: ${x}`,
  x => `Rating this ${x}`,
  x => `Nobody talks about this ${x} trick`,
  x => `${x}, but make it aesthetic ✨`,
  x => `Tell me you love ${x} without telling me`,
  x => `The ${x} everyone's talking about`,
  x => `Okay but ${x} though 😭`,
  x => `Save this for later: ${x}`,
];

const STOPWORDS = new Set(['the','and','with','this','that','for','from','your','you','are','was','were','have','has','into','onto','about','just','very','make','making','quick','short','clip','video','today','my','a','an','of','to','in','on','at','it','is']);

function detectCategories(text){
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];
  const scores = {};
  for(const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)){
    let score = 0;
    for(const w of words){ if(kws.includes(w)) score++; }
    if(score > 0) scores[cat] = score;
  }
  return Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
}

function toPhrase(desc, vibe){
  const base = (vibe || desc).trim();
  let words = base.split(/\s+/).slice(0, 6).join(' ');
  words = words.replace(/[.!?]+$/,'');
  return words.length > 42 ? words.slice(0,42).trim() : words;
}

function deriveKeywordTags(text, limit){
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];
  const seen = new Set();
  const tags = [];
  for(const w of words){
    if(w.length < 4 || STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    tags.push('#' + w.replace(/[^a-z0-9]/g,''));
    if(tags.length >= limit) break;
  }
  return tags;
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function generateCaption(){
  const desc = document.getElementById('capDesc').value.trim();
  const vibe = document.getElementById('capVibe').value.trim();
  const count = parseInt(document.getElementById('capCount').value, 10);
  const statusEl = document.getElementById('capStatus');
  const resultEl = document.getElementById('capResult');

  statusEl.className = 'status';
  resultEl.classList.remove('show');

  if(!desc){
    statusEl.textContent = 'Describe what happens in the video first.';
    statusEl.className = 'status error';
    return;
  }

  const fullText = desc + ' ' + vibe;
  const categories = detectCategories(fullText);
  const phrase = toPhrase(desc, vibe);

  // Title
  const template = TITLE_TEMPLATES[Math.floor(Math.random()*TITLE_TEMPLATES.length)];
  let title = template(phrase.toLowerCase());
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Hashtags: general + matched categories + keywords pulled from the description itself
  const general = ['#fyp','#foryou','#foryoupage','#viral','#trending'];
  let pool = [...general];
  for(const cat of categories.slice(0,3)){
    pool.push(...CATEGORY_TAGS[cat]);
  }
  pool.push(...deriveKeywordTags(fullText, 8));
  if(categories.length === 0){
    pool.push('#tiktok','#trendingnow','#explorepage');
  }

  const unique = [...new Set(pool)];
  const hashtags = shuffle(unique).slice(0, count);

  document.getElementById('capTitleOut').textContent = title;
  document.getElementById('capTagsOut').textContent = hashtags.join(' ');
  resultEl.classList.add('show');
  statusEl.textContent = '';
}

function useVideoForCaption(){
  const title = document.getElementById('tkTitle').textContent.trim();
  if(title && title !== '—'){
    document.getElementById('capDesc').value = title;
  }
  showTab('caption');
  generateCaption();
}

function copyText(id, btn){
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.textContent).then(()=>{
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(()=>{ btn.textContent = original; }, 1200);
  });
}

/* This file is loaded as a module (needed for the import above), so top-level
   functions aren't global by default. Expose the ones the HTML calls via
   onclick="" attributes. */
window.showTab = showTab;
window.fetchTikTok = fetchTikTok;
window.generateCaption = generateCaption;
window.useVideoForCaption = useVideoForCaption;
window.copyText = copyText;
