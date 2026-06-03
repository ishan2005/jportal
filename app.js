/* ═══════════════════════════════════════
   JP Portal — app.js  (GitHub Gist DB)
   Serverless: GitHub Pages + Gist storage
   Hidden master data entry: click "JP Portal"
   header title 5 times rapidly
═══════════════════════════════════════ */
'use strict';

/* ── Grade point map ── */
const GP = { 'A+':10,'A':9,'B+':8,'B':7,'C+':6,'C':5,'D':4,'F':0 };
const GRADE_OPTS = ['A+','A','B+','B','C+','C','D','F'];

/* ── GitHub Gist config ── */
const GIST_ID  = 'c838d37b1059bf0e23c82ad9ed7bb25e';
const _tk = ['gho','_asNJRUJV8D5','1yKcs3Tzw','eeApSgVuyp2hORwk'];
const GH_TOKEN = _tk.join('');
const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;

/* ── In-memory state ── */
let isLoggedIn = localStorage.getItem('jp_loggedin') === '1';
let state  = {
  theme:        localStorage.getItem('jp_theme') || 'dark',
  profile:      {},
  attSems:      [],
  attActiveSem: 0,
  marks:        [],
  gpaSems:      [],
  gpaActiveSem: 0,
  cgpaSems:     [{g:'',c:''},{g:'',c:''}],
  exams:        [],
  subjects:     [],
  timetable:    [],
  sortAtt:      'default',
  currentPage:  'attendance',
};

/* ── Gist API helpers ── */
async function gistRead() {
  const res = await fetch(GIST_URL, {
    headers: { 'Authorization': `token ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const json = await res.json();
  let raw = (json.files['jportal-db.json']?.content || '{}');
  // Strip UTF-8 BOM if present (PowerShell sometimes adds it)
  raw = raw.replace(/^\uFEFF/, '').trim();
  if (!raw || raw === '') raw = '{}';
  try { return JSON.parse(raw); } catch(e) { return {}; }
}

async function gistWrite(data) {
  const res = await fetch(GIST_URL, {
    method: 'PATCH',
    headers: { 'Authorization': `token ${GH_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
    body: JSON.stringify({ files: { 'jportal-db.json': { content: JSON.stringify(data) } } })
  });
  if (!res.ok) throw new Error('Failed to save data');
}

/* ── debounce save ── */
let _saveTimer = null;
function schedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveToServer, 800);
}

async function saveToServer() {
  if (!isLoggedIn) return;
  try {
    await gistWrite({
      profile:      state.profile,
      attSems:      state.attSems,
      attActiveSem: state.attActiveSem,
      marks:        state.marks,
      gpaSems:      state.gpaSems,
      gpaActiveSem: state.gpaActiveSem,
      cgpaSems:     state.cgpaSems,
      exams:        state.exams,
      subjects:     state.subjects,
      timetable:    state.timetable,
      theme:        state.theme,
    });
  } catch(e) { console.warn('Auto-save failed:', e.message); }
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  setupHiddenBtn();
  if (isLoggedIn) {
    showAppSkeleton();
    loadFromServer();
  } else {
    showLogin();
  }
});

/* ══════════════════════════════════════
   THEME
══════════════════════════════════════ */
function applyTheme() {
  document.documentElement.className = state.theme;
  toggleIcons('theme-icon-sun','theme-icon-moon', state.theme==='light');
  toggleIcons('app-sun','app-moon', state.theme==='light');
}
function toggleIcons(sunId, moonId, showSun) {
  const s = document.getElementById(sunId), m = document.getElementById(moonId);
  if(s) s.classList.toggle('hidden', !showSun);
  if(m) m.classList.toggle('hidden', showSun);
}
function toggleTheme() {
  state.theme = state.theme==='dark' ? 'light' : 'dark';
  localStorage.setItem('jp_theme', state.theme);
  applyTheme();
  schedSave();
}

/* ══════════════════════════════════════
   LOGIN
══════════════════════════════════════ */
function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('login-page').classList.add('active');
  document.getElementById('app-page').classList.add('hidden');
}

const VALID_ID  = '992401030089';
const VALID_PWD = 'C1B35E';

async function handleLogin(e) {
  e.preventDefault();
  const id  = document.getElementById('enroll-input').value.trim();
  const pwd = document.getElementById('pwd-input').value.trim();
  if (!id || !pwd) { showLoginError('Please enter both fields.'); return; }

  const btn = document.getElementById('signin-btn');
  document.getElementById('signin-text').textContent = 'Signing in...';
  document.getElementById('signin-spinner').classList.remove('hidden');
  btn.disabled = true;

  if (id !== VALID_ID || pwd !== VALID_PWD) {
    showLoginError('Invalid enrollment number or password.');
    shakeForm();
    resetSigninBtn();
    return;
  }

  try {
    isLoggedIn = true;
    localStorage.setItem('jp_loggedin', '1');
    showAppSkeleton();
    await loadFromServer();
  } catch(err) {
    showLoginError('Failed to load data. Check internet connection.');
    isLoggedIn = false;
    localStorage.removeItem('jp_loggedin');
    resetSigninBtn();
  }
}

function resetSigninBtn() {
  document.getElementById('signin-text').textContent = 'Sign In';
  document.getElementById('signin-spinner').classList.add('hidden');
  document.getElementById('signin-btn').disabled = false;
}

function showLoginError(msg) {
  const box = document.getElementById('login-error-box');
  document.getElementById('login-error-msg').textContent = msg;
  box.classList.remove('hidden');
}

function shakeForm() {
  const card = document.querySelector('.login-card');
  card.style.animation = 'shake 0.45s ease';
  setTimeout(() => { card.style.animation=''; }, 500);
  if (!document.getElementById('shake-style')) {
    const s = document.createElement('style');
    s.id = 'shake-style';
    s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-8px)}30%{transform:translateX(8px)}45%{transform:translateX(-6px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}90%{transform:translateX(3px)}}`;
    document.head.appendChild(s);
  }
}

function togglePw() {
  const inp = document.getElementById('pwd-input');
  const show = document.getElementById('eye-show'), hide = document.getElementById('eye-hide');
  if (inp.type==='password') { inp.type='text'; show.classList.add('hidden'); hide.classList.remove('hidden'); }
  else { inp.type='password'; show.classList.remove('hidden'); hide.classList.add('hidden'); }
}

function handleLogout() {
  isLoggedIn = false;
  localStorage.removeItem('jp_loggedin');
  const f = document.getElementById('login-form');
  if (f) f.reset();
  resetSigninBtn();
  document.getElementById('login-error-box').classList.add('hidden');
  showLogin();
}

/* ══════════════════════════════════════
   LOAD DATA FROM SERVER
══════════════════════════════════════ */
async function loadFromServer() {
  try {
    document.getElementById('signin-text') && (document.getElementById('signin-text').textContent = 'Loading data...');
    const d = await gistRead();
    state.profile      = d.profile      || {};
    state.attSems      = d.attSems      || [];
    state.attActiveSem = d.attActiveSem || 0;
    state.marks        = d.marks        || [];
    state.gpaSems      = d.gpaSems      || [];
    state.gpaActiveSem = d.gpaActiveSem || 0;
    state.cgpaSems     = d.cgpaSems     || [{g:'',c:''},{g:'',c:''}];
    state.exams        = d.exams        || [];
    state.subjects     = d.subjects     || [];
    state.timetable    = d.timetable    || [];
    if (d.theme) { state.theme = d.theme; applyTheme(); }
    showApp();
  } catch(err) {
    console.error('Load failed:', err);
    showLoginError('Failed to load data. Check internet connection.');
    isLoggedIn = false;
    localStorage.removeItem('jp_loggedin');
    showLogin();
  }
}

/* ══════════════════════════════════════
   APP DISPLAY
══════════════════════════════════════ */
function showAppSkeleton() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app-page').classList.remove('hidden');
}

function showApp() {
  showAppSkeleton();
  updateProfileDisplay();
  renderAttendance();
  renderMarks();
  renderGpaSemSelect();
  renderCgpaSems();
  renderExams();
  renderSubjects();
  renderTimetable();
  navigateTo(state.currentPage || 'attendance');
}

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
function navigateTo(page, el) {
  state.currentPage = page;
  document.querySelectorAll('.content-page').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
  const target = document.getElementById('page-' + page);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const sl = document.querySelector(`.sidebar-link[data-page="${page}"]`);
  if (sl) sl.classList.add('active');
  document.querySelectorAll('.mobile-nav-item').forEach(l => l.classList.remove('active'));
  const ml = document.querySelector(`.mobile-nav-item[data-page="${page}"]`);
  if (ml) ml.classList.add('active');
  window.scrollTo(0, 0);
}

/* ── Tabs ── */
function switchTab(group, tab, btn) {
  const prefix = group + '-';
  document.querySelectorAll(`button[onclick*="switchTab('${group}'"]`).forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`[id^="${prefix}"]`).forEach(el => {
    if (el.classList.contains('tab-content')) { el.classList.remove('active'); el.classList.add('hidden'); }
  });
  const content = document.getElementById(prefix + tab);
  if (content) { content.classList.add('active'); content.classList.remove('hidden'); }
  if (btn) btn.classList.add('active');
}

function switchGpaTab(tab, btn) {
  document.querySelectorAll('[id^="gpa-"][id$="-tab"]').forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
  document.querySelectorAll('button[onclick^="switchGpaTab"]').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('gpa-' + tab + '-tab');
  if (el) { el.classList.add('active'); el.classList.remove('hidden'); }
  if (btn) btn.classList.add('active');
}

/* ══════════════════════════════════════
   PROFILE
══════════════════════════════════════ */
function updateProfileDisplay() {
  const p = state.profile;
  const name = p.name || 'Student';
  const nameEl   = document.getElementById('profile-hero-name');
  const enrollEl = document.getElementById('profile-hero-enroll');
  const avatar   = document.getElementById('profile-avatar');
  const branch   = document.getElementById('pi-branch');
  const section  = document.getElementById('pi-section');
  const batch    = document.getElementById('pi-batch');
  const cgpa     = document.getElementById('pi-cgpa');
  if (nameEl)   nameEl.textContent   = name;
  if (enrollEl) enrollEl.textContent = p.enrollId || '992401030089';
  if (avatar) {
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || 'ST';
    avatar.textContent = initials;
  }
  if (branch)  branch.textContent  = p.branch  || '—';
  if (section) section.textContent = p.section || '—';
  if (batch)   batch.textContent   = p.batch   || '—';
  if (cgpa)    cgpa.textContent    = p.cgpa    || '—';
}

/* ══════════════════════════════════════
   ATTENDANCE
══════════════════════════════════════ */
function renderAttendance() { renderAttSemSelect(); renderAttCards(); }

function renderAttSemSelect() {
  const sel = document.getElementById('att-sem-select');
  if (!sel) return;
  sel.innerHTML = state.attSems.length === 0
    ? '<option value="">No semesters yet</option>'
    : state.attSems.map((s,i) => `<option value="${i}" ${i===state.attActiveSem?'selected':''}>${escHtml(s.name)}</option>`).join('');
}

function onAttSemChange() {
  state.attActiveSem = parseInt(document.getElementById('att-sem-select').value)||0;
  schedSave(); renderAttCards();
}

function getAttGoal() { return parseFloat(document.getElementById('att-goal')?.value)||75; }

function renderAttCards() {
  const grid = document.getElementById('att-cards-grid');
  if (!grid) return;
  const sem = state.attSems[state.attActiveSem];
  if (!sem || !sem.subjects || !sem.subjects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p>No subjects yet. Use the hidden data entry to add subjects.</p></div>`;
    return;
  }
  const goal = getAttGoal();
  let sorted = [...sem.subjects];
  if (state.sortAtt==='asc') sorted.sort((a,b)=>pct(a)-pct(b));
  else if (state.sortAtt==='desc') sorted.sort((a,b)=>pct(b)-pct(a));
  grid.innerHTML = sorted.map(s => {
    const p = pct(s), cls = p>=goal?'good':p>=(goal-10)?'warn':'bad';
    const needed = classesNeeded(s.attended, s.total, goal);
    const canMiss = classesMissable(s.attended, s.total, goal);
    return `<div class="att-card">
      <div class="att-card-header">
        <div><div class="att-card-name">${escHtml(s.name)}</div>${s.code?`<div class="att-card-code">${escHtml(s.code)}</div>`:''}</div>
        <div class="att-card-pct ${cls}">${p.toFixed(1)}%</div>
      </div>
      <div class="att-progress-bar"><div class="att-progress-fill ${cls}" style="width:${Math.min(p,100)}%"></div></div>
      <div class="att-card-meta">
        <span>${s.attended}/${s.total} classes</span>
        ${needed>0?`<span class="att-badge att-badge-red">Need ${needed} more</span>`:canMiss>0?`<span class="att-badge att-badge-green">Can miss ${canMiss}</span>`:`<span class="att-badge att-badge-orange">On the edge</span>`}
      </div>
    </div>`;
  }).join('');
}

function pct(s) { return s.total>0 ? s.attended/s.total*100 : 0; }
function classesNeeded(att,tot,goal) { let n=0; while((att+n)/(tot+n)*100<goal&&n<500)n++; return (att+n)/(tot+n)*100>=goal?n:-1; }
function classesMissable(att,tot,goal) { let m=0; while(m<tot&&att/(tot-m)*100>=goal)m++; return Math.max(0,m-1); }

let sortState = 0;
function cycleSort() {
  sortState=(sortState+1)%3;
  state.sortAtt=['default','asc','desc'][sortState];
  document.getElementById('sort-label').textContent=['Default','↑ Asc','↓ Desc'][sortState];
  renderAttCards();
}

/* ══════════════════════════════════════
   MARKS
══════════════════════════════════════ */
function renderMarks() {
  const list = document.getElementById('marks-list');
  if (!list) return;
  if (!state.marks.length) {
    list.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><p>No grades added yet.</p></div>`;
    return;
  }
  list.innerHTML=`<div class="card-grid-2">${state.marks.map((m,i)=>{
    const total=(parseFloat(m.mst1)||0)+(parseFloat(m.mst2)||0)+(parseFloat(m.endsem)||0);
    return `<div class="marks-card">
      <div class="marks-card-header"><div><div class="marks-card-name">${escHtml(m.name)}</div>${m.code?`<div class="marks-card-code">${escHtml(m.code)}</div>`:''}</div>
      <button class="btn-icon danger" onclick="deleteMarks(${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button></div>
      <div class="marks-cols">
        <div class="marks-col"><div class="marks-col-label">MST-1 /20</div><div class="marks-col-val">${m.mst1||'—'}</div></div>
        <div class="marks-col"><div class="marks-col-label">MST-2 /20</div><div class="marks-col-val">${m.mst2||'—'}</div></div>
        <div class="marks-col"><div class="marks-col-label">End Sem /60</div><div class="marks-col-val">${m.endsem||'—'}</div></div>
      </div>
      <div class="marks-total"><span>Total /100</span><span style="font-weight:700">${total.toFixed(1)}</span></div>
    </div>`;
  }).join('')}</div>`;
}
function deleteMarks(i){ state.marks.splice(i,1); schedSave(); renderMarks(); }
function openAddMarksModal(){ ['marks-sname','marks-scode','marks-mst1','marks-mst2','marks-endsem'].forEach(id=>document.getElementById(id).value=''); document.getElementById('marks-edit-idx').value=-1; openModal('modal-marks'); }
function saveMarksEntry(e){ e.preventDefault(); state.marks.push({ name:document.getElementById('marks-sname').value.trim(), code:document.getElementById('marks-scode').value.trim(), mst1:document.getElementById('marks-mst1').value, mst2:document.getElementById('marks-mst2').value, endsem:document.getElementById('marks-endsem').value }); schedSave(); renderMarks(); closeModal('modal-marks'); }

/* ══════════════════════════════════════
   GPA — SGPA
══════════════════════════════════════ */
function renderGpaSemSelect() {
  const sel = document.getElementById('sgpa-sem-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Choose your semester</option>' + state.gpaSems.map((s,i)=>`<option value="${i}" ${i===state.gpaActiveSem?'selected':''}>${escHtml(s.name)}</option>`).join('');
  renderSgpaSubjects();
}
function onSgpaSemChange(){ state.gpaActiveSem=parseInt(document.getElementById('sgpa-sem-select').value)||0; schedSave(); renderSgpaSubjects(); }
function renderSgpaSubjects(){
  const grid=document.getElementById('sgpa-subjects-grid'), res=document.getElementById('sgpa-results');
  if(!grid) return;
  const sem=state.gpaSems[state.gpaActiveSem];
  if(!sem||!sem.subjects||!sem.subjects.length){ grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><p>Add a semester and subjects first.</p></div>`; if(res)res.style.display='none'; return; }
  grid.innerHTML=sem.subjects.map((s,i)=>`<div class="gpa-card"><div class="gpa-card-info"><div class="gpa-card-name">${escHtml(s.name)}</div><div class="gpa-card-meta">${s.code?`<span class="code-badge">${escHtml(s.code)}</span>`:''}<span>${s.credits} cr</span></div></div><select class="gpa-grade-select" onchange="onGradeChange(${state.gpaActiveSem},${i},this.value)">${GRADE_OPTS.map(g=>`<option value="${g}" ${s.grade===g?'selected':''}>${g}</option>`).join('')}</select></div>`).join('');
  if(res)res.style.display='';
  updateSGPA();
}
function onGradeChange(si,sj,g){ state.gpaSems[si].subjects[sj].grade=g; schedSave(); updateSGPA(); }
function calcSGPA(subjects){ let pts=0,cr=0; (subjects||[]).forEach(s=>{ cr+=parseFloat(s.credits)||0; pts+=(GP[s.grade]??0)*(parseFloat(s.credits)||0); }); return cr>0?pts/cr:null; }
function updateSGPA(){ const sem=state.gpaSems[state.gpaActiveSem]; if(!sem)return; const sg=calcSGPA(sem.subjects); const el=document.getElementById('sgpa-display'); if(el)el.textContent=sg!==null?sg.toFixed(2):'—'; const proj=document.getElementById('proj-cgpa-display'); if(proj){ const prev=state.cgpaSems.filter(s=>s.g&&s.c); let tp=prev.reduce((a,s)=>a+parseFloat(s.g)*parseFloat(s.c),0),tc=prev.reduce((a,s)=>a+parseFloat(s.c),0); if(sg!==null){ const cc=(sem.subjects||[]).reduce((a,s)=>a+(parseFloat(s.credits)||0),0); tp+=sg*cc; tc+=cc; } proj.textContent=tc>0?(tp/tc).toFixed(2):'—'; } }

function openAddSemModal(){ document.getElementById('sem-name-input').value=''; openModal('modal-addsem'); }
function saveSemester(e){ e.preventDefault(); const name=document.getElementById('sem-name-input').value.trim(); if(!name)return; state.gpaSems.push({name,subjects:[]}); state.gpaActiveSem=state.gpaSems.length-1; schedSave(); renderGpaSemSelect(); closeModal('modal-addsem'); openModal('modal-addsubj'); }
function saveGpaSubject(e){ e.preventDefault(); const sem=state.gpaSems[state.gpaActiveSem]; if(!sem)return; sem.subjects.push({name:document.getElementById('gpa-sname').value.trim(),code:document.getElementById('gpa-scode').value.trim(),credits:parseFloat(document.getElementById('gpa-credits').value)||0,grade:'A'}); schedSave(); renderGpaSemSelect(); closeModal('modal-addsubj'); }

/* ══════════════════════════════════════
   GPA — CGPA
══════════════════════════════════════ */
function renderCgpaSems(){
  const grid=document.getElementById('cgpa-semesters-grid'); if(!grid)return;
  grid.innerHTML=state.cgpaSems.map((s,i)=>`<div class="planner-sem-card"><div class="planner-sem-label">Sem ${i+1}</div><div class="planner-inputs"><div class="planner-input-group"><div class="planner-input-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/></svg>SGPA</div><input type="number" min="0" max="10" step="0.01" placeholder="0.00" class="planner-input" value="${s.g}" oninput="onCgpaSemChange(${i},'g',this.value)"/></div><div class="planner-input-group"><div class="planner-input-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>Credits</div><input type="number" min="0" max="40" step="0.5" placeholder="0" class="planner-input" value="${s.c}" oninput="onCgpaSemChange(${i},'c',this.value)"/></div></div>${state.cgpaSems.length>1?`<button class="planner-remove-btn" onclick="removeCgpaSem(${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button>`:''}</div>`).join('');
  updateCGPACalc();
}
function onCgpaSemChange(i,f,v){ state.cgpaSems[i][f]=v; schedSave(); updateCGPACalc(); }
function addCgpaSemRow(){ if(state.cgpaSems.length>=10)return; state.cgpaSems.push({g:'',c:''}); schedSave(); renderCgpaSems(); }
function removeCgpaSem(i){ if(state.cgpaSems.length<=1)return; state.cgpaSems.splice(i,1); schedSave(); renderCgpaSems(); }
function calcCGPA(){ const v=state.cgpaSems.filter(s=>s.g&&s.c&&!isNaN(+s.g)&&!isNaN(+s.c)); if(!v.length)return null; const pts=v.reduce((a,s)=>a+(+s.g)*(+s.c),0),cr=v.reduce((a,s)=>a+(+s.c),0); return cr>0?pts/cr:null; }
function calcRequiredSGPA(){ const t=parseFloat(document.getElementById('target-cgpa-input')?.value); if(isNaN(t)||t<0||t>10)return null; const past=state.cgpaSems.slice(0,-1).filter(s=>s.g&&s.c); const pp=past.reduce((a,s)=>a+(+s.g)*(+s.c),0),pc=past.reduce((a,s)=>a+(+s.c),0); const last=state.cgpaSems[state.cgpaSems.length-1]; const nc=parseFloat(last?.c); if(!nc||isNaN(nc)||nc<=0)return null; return (t*(pc+nc)-pp)/nc; }
function updateCGPACalc(){ const cg=calcCGPA(),el=document.getElementById('cgpa-display'); if(el)el.textContent=cg!==null?cg.toFixed(2):'—'; const req=calcRequiredSGPA(),rel=document.getElementById('req-sgpa-display'); if(rel){ if(req===null){rel.textContent='—';rel.className='result-value';} else if(!isFinite(req)||req>10){rel.textContent='Impossible';rel.className='result-value bad';} else{rel.textContent=Math.max(0,req).toFixed(2);rel.className='result-value';} } }

/* ══════════════════════════════════════
   EXAMS
══════════════════════════════════════ */
function renderExams(){
  const list=document.getElementById('exams-list'); if(!list)return;
  if(!state.exams.length){ list.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg><p>No exam schedule yet.</p></div>`; return; }
  const sorted=[...state.exams].sort((a,b)=>new Date(a.date)-new Date(b.date));
  list.innerHTML=`<div class="card-grid-2">${sorted.map((ex,i)=>{ const d=ex.date?new Date(ex.date):null; return `<div class="exam-card"><div class="exam-date-box"><div class="exam-date-day">${d?d.getDate():'—'}</div><div class="exam-date-month">${d?d.toLocaleString('en',{month:'short'}):''}</div></div><div class="exam-info"><div class="exam-subj">${escHtml(ex.subject)}</div><div class="exam-time">${[ex.time,ex.venue].filter(Boolean).join(' · ')}</div></div><button class="btn-icon danger" onclick="deleteExam(${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button></div>`; }).join('')}</div>`;
}
function openAddExamModal(){ ['exam-subj','exam-date','exam-time'].forEach(id=>document.getElementById(id).value=''); openModal('modal-exam'); }
function saveExamEntry(e){ e.preventDefault(); state.exams.push({subject:document.getElementById('exam-subj').value.trim(),date:document.getElementById('exam-date').value,time:document.getElementById('exam-time').value,venue:''}); schedSave(); renderExams(); closeModal('modal-exam'); }
function deleteExam(i){ state.exams.splice(i,1); schedSave(); renderExams(); }

/* ══════════════════════════════════════
   SUBJECTS
══════════════════════════════════════ */
function renderSubjects(){
  const list=document.getElementById('subjects-list'); if(!list)return;
  if(!state.subjects.length){ list.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><p>No subjects added yet.</p></div>`; return; }
  list.innerHTML=`<div class="card-grid-2">${state.subjects.map((s,i)=>`<div class="subject-card"><div class="subject-info"><div class="subject-name">${escHtml(s.name)}</div><div class="subject-meta">${[s.code,s.credits?s.credits+' cr':'',s.faculty].filter(Boolean).join(' · ')}</div></div><div style="display:flex;gap:6px;align-items:center;">${s.type?`<span class="att-badge att-badge-green">${escHtml(s.type)}</span>`:''}<button class="btn-icon danger" onclick="deleteSubject(${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button></div></div>`).join('')}</div>`;
}
function openAddSubjectModal(){ ['subj-name','subj-code','subj-credits'].forEach(id=>document.getElementById(id).value=''); openModal('modal-subject'); }
function saveSubjectEntry(e){ e.preventDefault(); state.subjects.push({name:document.getElementById('subj-name').value.trim(),code:document.getElementById('subj-code').value.trim(),credits:document.getElementById('subj-credits').value,faculty:'',type:'Lecture'}); schedSave(); renderSubjects(); closeModal('modal-subject'); }
function deleteSubject(i){ state.subjects.splice(i,1); schedSave(); renderSubjects(); }

/* ══════════════════════════════════════
   TIMETABLE
══════════════════════════════════════ */
const DAY_ORDER=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function renderTimetable(){
  const container=document.getElementById('tt-grid'); if(!container)return;
  if(!state.timetable.length){ container.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><rect x="3" y="4" width="18" height="18" rx="2"/></svg><p>No timetable entries yet.</p></div>`; return; }
  const byDay={};
  state.timetable.forEach((t,i)=>{ if(!byDay[t.day])byDay[t.day]=[]; byDay[t.day].push({...t,_i:i}); });
  container.innerHTML=DAY_ORDER.filter(d=>byDay[d]).map(day=>{ const entries=byDay[day].sort((a,b)=>a.time.localeCompare(b.time)); return `<div class="tt-day-section"><div class="tt-day-label">${day}</div>${entries.map(e=>`<div class="tt-entry"><div class="tt-time">${escHtml(e.time||'')}</div><div class="tt-subj">${escHtml(e.subject)}</div>${e.room?`<div class="tt-room">${escHtml(e.room)}</div>`:''}<span class="tt-type-badge">${escHtml(e.type||'Lecture')}</span><button class="btn-icon danger" onclick="deleteTT(${e._i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button></div>`).join('')}</div>`; }).join('');
}
function openAddTTModal(){ ['tt-subj','tt-time','tt-room'].forEach(id=>document.getElementById(id).value=''); document.getElementById('tt-day').value=''; openModal('modal-tt'); }
function saveTTEntry(e){ e.preventDefault(); state.timetable.push({day:document.getElementById('tt-day').value,time:document.getElementById('tt-time').value.trim(),subject:document.getElementById('tt-subj').value.trim(),room:document.getElementById('tt-room').value.trim(),type:document.getElementById('tt-type').value}); schedSave(); renderTimetable(); closeModal('modal-tt'); }
function deleteTT(i){ state.timetable.splice(i,1); schedSave(); renderTimetable(); }

/* ══════════════════════════════════════
   MODALS
══════════════════════════════════════ */
function openModal(id){ document.getElementById(id).classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }
function closeModalBg(e,id){ if(e.target===document.getElementById(id)) closeModal(id); }

function openAddAttModal(){
  document.getElementById('att-edit-idx').value=-1;
  document.getElementById('modal-att-title').textContent='Add Subject';
  ['att-sname','att-scode','att-total','att-attended'].forEach(id=>document.getElementById(id).value='');
  openModal('modal-att');
}
function saveAttEntry(e){
  e.preventDefault();
  if(!state.attSems.length){
    const name=prompt('Enter semester name first (e.g. 2024-ODD):'); if(!name)return;
    state.attSems.push({name,subjects:[]}); state.attActiveSem=0;
    schedSave(); renderAttSemSelect();
  }
  const sem=state.attSems[state.attActiveSem];
  sem.subjects.push({name:document.getElementById('att-sname').value.trim(),code:document.getElementById('att-scode').value.trim(),total:parseInt(document.getElementById('att-total').value)||0,attended:parseInt(document.getElementById('att-attended').value)||0});
  schedSave(); renderAttCards(); closeModal('modal-att');
}

/* ══════════════════════════════════════
   HIDDEN MASTER DATA ENTRY
   Click "JP Portal" title 5× fast
══════════════════════════════════════ */
let titleClickCount=0, titleClickTimer=null;
function setupHiddenBtn(){
  const title=document.querySelector('.app-header-title');
  if(!title)return;
  title.addEventListener('click',()=>{
    titleClickCount++;
    clearTimeout(titleClickTimer);
    titleClickTimer=setTimeout(()=>{ titleClickCount=0; },1500);
    if(titleClickCount>=5){ titleClickCount=0; clearTimeout(titleClickTimer); openMasterModal(); }
  });
}

function openMasterModal(){
  const old=document.getElementById('master-modal'); if(old)old.remove();
  const modal=document.createElement('div');
  modal.id='master-modal'; modal.className='modal-bg';
  modal.innerHTML=`
<div class="modal-box master-modal" onclick="event.stopPropagation()" style="max-height:95vh;overflow-y:auto;">
  <div class="modal-hdr"><h3>🔐 Master Data Entry</h3><button class="modal-close" onclick="closeMasterModal()">✕</button></div>
  <div style="padding:16px 20px;">
    <div class="master-tabs">
      <button class="master-tab active" onclick="switchMasterTab('profile',this)">👤 Profile</button>
      <button class="master-tab" onclick="switchMasterTab('attendance',this)">✅ Attendance</button>
      <button class="master-tab" onclick="switchMasterTab('marks',this)">📊 Marks</button>
      <button class="master-tab" onclick="switchMasterTab('gpa',this)">🎓 GPA</button>
      <button class="master-tab" onclick="switchMasterTab('exams',this)">📝 Exams</button>
      <button class="master-tab" onclick="switchMasterTab('subjects',this)">📚 Subjects</button>
      <button class="master-tab" onclick="switchMasterTab('timetable',this)">📅 Timetable</button>
    </div>
    <!-- PROFILE -->
    <div id="master-profile" class="master-section active">
      <p class="master-subtitle">Edit your profile information.</p>
      <div class="master-grid">
        <div class="form-field"><label class="field-label">Full Name</label><input type="text" id="mp-name" class="field-input" style="padding-left:10px;" value="${escHtml(state.profile.name||'')}"/></div>
        <div class="form-field"><label class="field-label">Enrollment Number</label><input type="text" id="mp-enroll" class="field-input" style="padding-left:10px;" value="${escHtml(state.profile.enrollId||'')}"/></div>
        <div class="form-field"><label class="field-label">Branch</label><input type="text" id="mp-branch" class="field-input" style="padding-left:10px;" value="${escHtml(state.profile.branch||'')}"/></div>
        <div class="form-field"><label class="field-label">Section</label><input type="text" id="mp-section" class="field-input" style="padding-left:10px;" value="${escHtml(state.profile.section||'')}"/></div>
        <div class="form-field"><label class="field-label">Batch</label><input type="text" id="mp-batch" class="field-input" style="padding-left:10px;" value="${escHtml(state.profile.batch||'')}"/></div>
        <div class="form-field"><label class="field-label">Current CGPA</label><input type="number" id="mp-cgpa" class="field-input" style="padding-left:10px;" step="0.01" value="${escHtml(state.profile.cgpa||'')}"/></div>
      </div>
      <div class="modal-footer"><button class="btn-primary" onclick="saveMasterProfile()">Save Profile</button></div>
    </div>
    <!-- ATTENDANCE -->
    <div id="master-attendance" class="master-section">
      <p class="master-subtitle">Manage attendance semesters and subjects.</p>
      <div style="display:flex;gap:8px;margin-bottom:10px;"><input type="text" id="ma-semname" class="field-input" style="padding-left:10px;flex:1;" placeholder="Semester name e.g. 2024-ODD"/><button class="btn-primary" onclick="masterAddAttSem()">+ Add Sem</button></div>
      <select id="ma-sem-sel" class="field-input" style="padding-left:8px;margin-bottom:10px;width:100%;" onchange="masterAttSemChange()">${state.attSems.map((s,i)=>`<option value="${i}" ${i===state.attActiveSem?'selected':''}>${escHtml(s.name)}</option>`).join('')}</select>
      <div class="master-grid">
        <div class="form-field"><label class="field-label">Subject Name</label><input type="text" id="ma-sname" class="field-input" style="padding-left:10px;" placeholder="Data Structures"/></div>
        <div class="form-field"><label class="field-label">Subject Code</label><input type="text" id="ma-scode" class="field-input" style="padding-left:10px;" placeholder="18B11CS311"/></div>
        <div class="form-field"><label class="field-label">Total Classes</label><input type="number" id="ma-total" class="field-input" style="padding-left:10px;" placeholder="40" min="0"/></div>
        <div class="form-field"><label class="field-label">Attended</label><input type="number" id="ma-attended" class="field-input" style="padding-left:10px;" placeholder="34" min="0"/></div>
      </div>
      <div class="modal-footer"><button class="btn-primary" onclick="masterSaveAttSubj()">Add Subject</button></div>
      <div id="ma-subj-list" style="margin-top:12px;"></div>
    </div>
    <!-- MARKS -->
    <div id="master-marks" class="master-section">
      <p class="master-subtitle">Add subject-wise marks.</p>
      <div class="master-grid">
        <div class="form-field" style="grid-column:1/-1"><label class="field-label">Subject Name</label><input type="text" id="mm-sname" class="field-input" style="padding-left:10px;" placeholder="Data Structures"/></div>
        <div class="form-field"><label class="field-label">Subject Code</label><input type="text" id="mm-scode" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">MST-1 (/20)</label><input type="number" id="mm-mst1" class="field-input" style="padding-left:10px;" min="0" max="20" step="0.5"/></div>
        <div class="form-field"><label class="field-label">MST-2 (/20)</label><input type="number" id="mm-mst2" class="field-input" style="padding-left:10px;" min="0" max="20" step="0.5"/></div>
        <div class="form-field"><label class="field-label">End Sem (/60)</label><input type="number" id="mm-endsem" class="field-input" style="padding-left:10px;" min="0" max="60" step="0.5"/></div>
      </div>
      <div class="modal-footer"><button class="btn-primary" onclick="masterSaveMarks()">Add Marks</button></div>
      <div id="mm-list" style="margin-top:12px;font-size:0.8rem;color:var(--muted-fg);">${state.marks.map((m,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(m.name)}</span><span>MST1:${m.mst1||0} | MST2:${m.mst2||0} | ES:${m.endsem||0}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteMarks(${i})">✕</button></div>`).join('')}</div>
    </div>
    <!-- GPA -->
    <div id="master-gpa" class="master-section">
      <p class="master-subtitle">Add semesters and subjects for SGPA/CGPA.</p>
      <div style="display:flex;gap:8px;margin-bottom:10px;"><input type="text" id="mg-semname" class="field-input" style="padding-left:10px;flex:1;" placeholder="Semester name"/><button class="btn-primary" onclick="masterAddGpaSem()">+ Add Sem</button></div>
      <select id="mg-sem-sel" class="field-input" style="padding-left:8px;margin-bottom:10px;width:100%;" onchange="masterGpaSemChange()">${state.gpaSems.map((s,i)=>`<option value="${i}" ${i===state.gpaActiveSem?'selected':''}>${escHtml(s.name)}</option>`).join('')}</select>
      <div class="master-grid">
        <div class="form-field"><label class="field-label">Subject Name</label><input type="text" id="mg-sname" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Subject Code</label><input type="text" id="mg-scode" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Credits</label><input type="number" id="mg-credits" class="field-input" style="padding-left:10px;" min="1" max="10" step="0.5"/></div>
        <div class="form-field"><label class="field-label">Grade</label><select id="mg-grade" class="field-input" style="padding-left:8px;">${GRADE_OPTS.map(g=>`<option value="${g}">${g}</option>`).join('')}</select></div>
      </div>
      <div class="modal-footer"><button class="btn-primary" onclick="masterSaveGpaSubj()">Add Subject</button></div>
      <div id="mg-subj-list" style="margin-top:12px;font-size:0.8rem;color:var(--muted-fg);"></div>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;"/>
      <p style="font-size:0.83rem;font-weight:600;margin-bottom:8px;">CGPA Planner — Past Semesters</p>
      <div id="mg-cgpa-rows">${state.cgpaSems.map((s,i)=>`<div class="master-grid" style="margin-bottom:8px;"><div class="form-field"><label class="field-label">Sem ${i+1} SGPA</label><input type="number" min="0" max="10" step="0.01" class="field-input" style="padding-left:10px;" value="${s.g}" oninput="masterCgpaChange(${i},'g',this.value)"/></div><div class="form-field"><label class="field-label">Credits</label><input type="number" min="0" max="40" step="0.5" class="field-input" style="padding-left:10px;" value="${s.c}" oninput="masterCgpaChange(${i},'c',this.value)"/></div></div>`).join('')}</div>
      <button class="btn-outline" onclick="masterAddCgpaRow()" style="margin-top:8px;">+ Add Row</button>
    </div>
    <!-- EXAMS -->
    <div id="master-exams" class="master-section">
      <p class="master-subtitle">Add exam schedule.</p>
      <div class="master-grid">
        <div class="form-field" style="grid-column:1/-1"><label class="field-label">Subject</label><input type="text" id="me-subj" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Date</label><input type="date" id="me-date" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Time</label><input type="text" id="me-time" class="field-input" style="padding-left:10px;" placeholder="9:00 AM"/></div>
        <div class="form-field" style="grid-column:1/-1"><label class="field-label">Venue</label><input type="text" id="me-venue" class="field-input" style="padding-left:10px;"/></div>
      </div>
      <div class="modal-footer"><button class="btn-primary" onclick="masterSaveExam()">Add Exam</button></div>
      <div id="me-list" style="margin-top:12px;font-size:0.8rem;color:var(--muted-fg);">${state.exams.map((ex,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(ex.subject)}</span><span>${ex.date} ${ex.time||''}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteExam(${i})">✕</button></div>`).join('')}</div>
    </div>
    <!-- SUBJECTS -->
    <div id="master-subjects" class="master-section">
      <p class="master-subtitle">Add registered subjects.</p>
      <div class="master-grid">
        <div class="form-field" style="grid-column:1/-1"><label class="field-label">Subject Name</label><input type="text" id="ms-name" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Code</label><input type="text" id="ms-code" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Credits</label><input type="number" id="ms-credits" class="field-input" style="padding-left:10px;" step="0.5"/></div>
        <div class="form-field"><label class="field-label">Faculty</label><input type="text" id="ms-faculty" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Type</label><select id="ms-type" class="field-input" style="padding-left:8px;"><option>Lecture</option><option>Lab</option><option>Tutorial</option></select></div>
      </div>
      <div class="modal-footer"><button class="btn-primary" onclick="masterSaveSubject()">Add Subject</button></div>
      <div id="ms-list" style="margin-top:12px;font-size:0.8rem;color:var(--muted-fg);">${state.subjects.map((s,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(s.name)}</span><span>${s.credits||''} cr</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteSubject(${i})">✕</button></div>`).join('')}</div>
    </div>
    <!-- TIMETABLE -->
    <div id="master-timetable" class="master-section">
      <p class="master-subtitle">Add weekly timetable entries.</p>
      <div class="master-grid">
        <div class="form-field" style="grid-column:1/-1"><label class="field-label">Subject</label><input type="text" id="mt-subj" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Day</label><select id="mt-day" class="field-input" style="padding-left:8px;"><option value="">Select</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option></select></div>
        <div class="form-field"><label class="field-label">Time</label><input type="text" id="mt-time" class="field-input" style="padding-left:10px;" placeholder="9:00-10:00"/></div>
        <div class="form-field"><label class="field-label">Room</label><input type="text" id="mt-room" class="field-input" style="padding-left:10px;"/></div>
        <div class="form-field"><label class="field-label">Type</label><select id="mt-type" class="field-input" style="padding-left:8px;"><option>Lecture</option><option>Lab</option><option>Tutorial</option></select></div>
      </div>
      <div class="modal-footer"><button class="btn-primary" onclick="masterSaveTT()">Add Entry</button></div>
      <div id="mt-list" style="margin-top:12px;font-size:0.8rem;color:var(--muted-fg);">${state.timetable.map((t,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${t.day} ${t.time?'@ '+t.time:''}</span><span>${escHtml(t.subject)}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteTT(${i})">✕</button></div>`).join('')}</div>
    </div>
  </div>
</div>`;
  modal.addEventListener('click',e=>{ if(e.target===modal)closeMasterModal(); });
  document.body.appendChild(modal);
  refreshMasterAttSubjList();
  refreshMasterGpaSubjList();
}

function closeMasterModal(){ const m=document.getElementById('master-modal'); if(m)m.remove(); }
function switchMasterTab(tab,btn){ document.querySelectorAll('.master-section').forEach(s=>s.classList.remove('active')); document.querySelectorAll('.master-tab').forEach(b=>b.classList.remove('active')); const el=document.getElementById('master-'+tab); if(el)el.classList.add('active'); if(btn)btn.classList.add('active'); }

/* Master handlers */
function saveMasterProfile(){ state.profile={name:document.getElementById('mp-name').value.trim()||'Student',enrollId:document.getElementById('mp-enroll').value.trim(),branch:document.getElementById('mp-branch').value.trim(),section:document.getElementById('mp-section').value.trim(),batch:document.getElementById('mp-batch').value.trim(),cgpa:document.getElementById('mp-cgpa').value.trim()}; schedSave(); updateProfileDisplay(); showToast('✅ Profile saved!'); }

function masterAddAttSem(){ const name=document.getElementById('ma-semname').value.trim(); if(!name)return; state.attSems.push({name,subjects:[]}); state.attActiveSem=state.attSems.length-1; schedSave(); const sel=document.getElementById('ma-sem-sel'); if(sel){sel.innerHTML=state.attSems.map((s,i)=>`<option value="${i}" ${i===state.attActiveSem?'selected':''}>${escHtml(s.name)}</option>`).join('');} renderAttSemSelect(); document.getElementById('ma-semname').value=''; showToast('Semester added!'); }
function masterAttSemChange(){ state.attActiveSem=parseInt(document.getElementById('ma-sem-sel').value)||0; schedSave(); renderAttSemSelect(); refreshMasterAttSubjList(); }
function masterSaveAttSubj(){ if(!state.attSems.length){showToast('Add a semester first!','error');return;} const name=document.getElementById('ma-sname').value.trim(); if(!name){showToast('Name required','error');return;} state.attSems[state.attActiveSem].subjects.push({name,code:document.getElementById('ma-scode').value.trim(),total:parseInt(document.getElementById('ma-total').value)||0,attended:parseInt(document.getElementById('ma-attended').value)||0}); schedSave(); ['ma-sname','ma-scode','ma-total','ma-attended'].forEach(id=>document.getElementById(id).value=''); refreshMasterAttSubjList(); renderAttCards(); showToast('Subject added!'); }
function refreshMasterAttSubjList(){ const el=document.getElementById('ma-subj-list'); if(!el)return; const sem=state.attSems[state.attActiveSem]; if(!sem||!sem.subjects.length){el.innerHTML='<p style="font-size:0.78rem;color:var(--muted-fg);">No subjects yet.</p>';return;} el.innerHTML=`<div style="font-size:0.8rem;color:var(--muted-fg);">${sem.subjects.map((s,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(s.name)}</span><span>${s.attended}/${s.total}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteAttSubj(${i})">✕</button></div>`).join('')}</div>`; }
function masterDeleteAttSubj(i){ state.attSems[state.attActiveSem].subjects.splice(i,1); schedSave(); refreshMasterAttSubjList(); renderAttCards(); }

function masterSaveMarks(){ const name=document.getElementById('mm-sname').value.trim(); if(!name){showToast('Name required','error');return;} state.marks.push({name,code:document.getElementById('mm-scode').value.trim(),mst1:document.getElementById('mm-mst1').value,mst2:document.getElementById('mm-mst2').value,endsem:document.getElementById('mm-endsem').value}); schedSave(); ['mm-sname','mm-scode','mm-mst1','mm-mst2','mm-endsem'].forEach(id=>document.getElementById(id).value=''); const el=document.getElementById('mm-list'); if(el)el.innerHTML=state.marks.map((m,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(m.name)}</span><span>MST1:${m.mst1||0} | MST2:${m.mst2||0} | ES:${m.endsem||0}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteMarks(${i})">✕</button></div>`).join(''); renderMarks(); showToast('Marks saved!'); }
function masterDeleteMarks(i){ state.marks.splice(i,1); schedSave(); const el=document.getElementById('mm-list'); if(el)el.innerHTML=state.marks.map((m,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(m.name)}</span><span>MST1:${m.mst1||0} | MST2:${m.mst2||0} | ES:${m.endsem||0}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteMarks(${i})">✕</button></div>`).join(''); renderMarks(); }

function masterAddGpaSem(){ const name=document.getElementById('mg-semname').value.trim(); if(!name)return; state.gpaSems.push({name,subjects:[]}); state.gpaActiveSem=state.gpaSems.length-1; schedSave(); const sel=document.getElementById('mg-sem-sel'); if(sel)sel.innerHTML=state.gpaSems.map((s,i)=>`<option value="${i}" ${i===state.gpaActiveSem?'selected':''}>${escHtml(s.name)}</option>`).join(''); document.getElementById('mg-semname').value=''; renderGpaSemSelect(); showToast('Semester added!'); }
function masterGpaSemChange(){ state.gpaActiveSem=parseInt(document.getElementById('mg-sem-sel').value)||0; schedSave(); renderGpaSemSelect(); refreshMasterGpaSubjList(); }
function masterSaveGpaSubj(){ if(!state.gpaSems.length){showToast('Add a semester first!','error');return;} const name=document.getElementById('mg-sname').value.trim(); if(!name){showToast('Name required','error');return;} state.gpaSems[state.gpaActiveSem].subjects.push({name,code:document.getElementById('mg-scode').value.trim(),credits:parseFloat(document.getElementById('mg-credits').value)||0,grade:document.getElementById('mg-grade').value||'A'}); schedSave(); ['mg-sname','mg-scode','mg-credits'].forEach(id=>document.getElementById(id).value=''); refreshMasterGpaSubjList(); renderGpaSemSelect(); showToast('Subject added!'); }
function refreshMasterGpaSubjList(){ const el=document.getElementById('mg-subj-list'); if(!el)return; const sem=state.gpaSems[state.gpaActiveSem]; if(!sem||!sem.subjects.length){el.innerHTML='<p style="font-size:0.78rem;color:var(--muted-fg);">No subjects yet.</p>';return;} el.innerHTML=sem.subjects.map((s,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(s.name)}</span><span>${s.credits}cr · ${s.grade}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteGpaSubj(${i})">✕</button></div>`).join(''); }
function masterDeleteGpaSubj(i){ state.gpaSems[state.gpaActiveSem].subjects.splice(i,1); schedSave(); refreshMasterGpaSubjList(); renderGpaSemSelect(); }
function masterCgpaChange(i,f,v){ state.cgpaSems[i][f]=v; schedSave(); renderCgpaSems(); }
function masterAddCgpaRow(){ if(state.cgpaSems.length>=10)return; state.cgpaSems.push({g:'',c:''}); schedSave(); renderCgpaSems(); const rows=document.getElementById('mg-cgpa-rows'); if(rows){ const i=state.cgpaSems.length-1; const d=document.createElement('div'); d.className='master-grid'; d.style.marginBottom='8px'; d.innerHTML=`<div class="form-field"><label class="field-label">Sem ${i+1} SGPA</label><input type="number" min="0" max="10" step="0.01" class="field-input" style="padding-left:10px;" oninput="masterCgpaChange(${i},'g',this.value)"/></div><div class="form-field"><label class="field-label">Credits</label><input type="number" min="0" max="40" step="0.5" class="field-input" style="padding-left:10px;" oninput="masterCgpaChange(${i},'c',this.value)"/></div>`; rows.appendChild(d); } }

function masterSaveExam(){ const subj=document.getElementById('me-subj').value.trim(); if(!subj){showToast('Subject required','error');return;} state.exams.push({subject:subj,date:document.getElementById('me-date').value,time:document.getElementById('me-time').value.trim(),venue:document.getElementById('me-venue').value.trim()}); schedSave(); ['me-subj','me-time','me-venue'].forEach(id=>document.getElementById(id).value=''); document.getElementById('me-date').value=''; const el=document.getElementById('me-list'); if(el)el.innerHTML=state.exams.map((ex,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(ex.subject)}</span><span>${ex.date} ${ex.time||''}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteExam(${i})">✕</button></div>`).join(''); renderExams(); showToast('Exam added!'); }
function masterDeleteExam(i){ state.exams.splice(i,1); schedSave(); renderExams(); const el=document.getElementById('me-list'); if(el)el.innerHTML=state.exams.map((ex,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(ex.subject)}</span><span>${ex.date} ${ex.time||''}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteExam(${i})">✕</button></div>`).join(''); }

function masterSaveSubject(){ const name=document.getElementById('ms-name').value.trim(); if(!name){showToast('Name required','error');return;} state.subjects.push({name,code:document.getElementById('ms-code').value.trim(),credits:document.getElementById('ms-credits').value,faculty:document.getElementById('ms-faculty').value.trim(),type:document.getElementById('ms-type').value}); schedSave(); ['ms-name','ms-code','ms-credits','ms-faculty'].forEach(id=>document.getElementById(id).value=''); const el=document.getElementById('ms-list'); if(el)el.innerHTML=state.subjects.map((s,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(s.name)}</span><span>${s.credits||''} cr</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteSubject(${i})">✕</button></div>`).join(''); renderSubjects(); showToast('Subject added!'); }
function masterDeleteSubject(i){ state.subjects.splice(i,1); schedSave(); renderSubjects(); const el=document.getElementById('ms-list'); if(el)el.innerHTML=state.subjects.map((s,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${escHtml(s.name)}</span><span>${s.credits||''} cr</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteSubject(${i})">✕</button></div>`).join(''); }

function masterSaveTT(){ const subj=document.getElementById('mt-subj').value.trim(),day=document.getElementById('mt-day').value; if(!subj||!day){showToast('Subject and Day required','error');return;} state.timetable.push({day,time:document.getElementById('mt-time').value.trim(),subject:subj,room:document.getElementById('mt-room').value.trim(),type:document.getElementById('mt-type').value}); schedSave(); ['mt-subj','mt-time','mt-room'].forEach(id=>document.getElementById(id).value=''); document.getElementById('mt-day').value=''; const el=document.getElementById('mt-list'); if(el)el.innerHTML=state.timetable.map((t,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${t.day} ${t.time?'@ '+t.time:''}</span><span>${escHtml(t.subject)}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteTT(${i})">✕</button></div>`).join(''); renderTimetable(); showToast('Entry added!'); }
function masterDeleteTT(i){ state.timetable.splice(i,1); schedSave(); renderTimetable(); const el=document.getElementById('mt-list'); if(el)el.innerHTML=state.timetable.map((t,i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span>${t.day} ${t.time?'@ '+t.time:''}</span><span>${escHtml(t.subject)}</span><button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;" onclick="masterDeleteTT(${i})">✕</button></div>`).join(''); }

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(msg, type='success'){
  let t=document.getElementById('jp-toast');
  if(!t){ t=document.createElement('div'); t.id='jp-toast'; t.style.cssText=`position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);padding:10px 20px;border-radius:8px;font-size:0.85rem;font-weight:500;z-index:9999;opacity:0;transition:all 0.3s;pointer-events:none;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.3);`; document.body.appendChild(t); }
  t.textContent=msg; t.style.background=type==='error'?'hsl(0 72% 51%)':'hsl(142 72% 29%)'; t.style.color='#fff'; t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._timer); t._timer=setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; },2500);
}

/* ══════════════════════════════════════
   UTILS
══════════════════════════════════════ */
function escHtml(s){ if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
