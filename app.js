// ═══════════════════════════════════════════════════════
//  솔브아트 관리 시스템 v3.0 — app.js
//  미술학원 통합 관리 솔루션
//  Firebase + GitHub Pages
// ═══════════════════════════════════════════════════════



// ════════════════════════════════════════════
//  🔥 FIREBASE 설정
// ════════════════════════════════════════════
const FB_CFG = {
  apiKey:            "AIzaSyAXdWV656FNkkf-ex9Gk3cAugIq82lh9mo",
  authDomain:        "solve-99f06.firebaseapp.com",
  projectId:         "solve-99f06",
  storageBucket:     "solve-99f06.firebasestorage.app",
  messagingSenderId: "757315756544",
  appId:             "1:757315756544:web:fe614f31b75712c58eaee5"
};
// ════════════════════════════════════════════

let fbApp, auth, db;
const FB_READY = FB_CFG.apiKey !== "YOUR_API_KEY";
if(FB_READY){try{fbApp=firebase.initializeApp(FB_CFG);auth=firebase.auth();db=firebase.firestore();}catch(e){console.warn(e);}}

// ── 전역 상태 ──
let CU=null,CP=null;
let DB=JSON.parse(localStorage.getItem('sa_db')||'[]');
let STUS=JSON.parse(localStorage.getItem('sa_stus')||'[]');
let SU=localStorage.getItem('sa_url')||'';
let CFG=JSON.parse(localStorage.getItem('sa_cfg')||'{}');
let ocrData=null,curImg=null;
let editUid='',newPerms={input:true,view:true,report:false};
let resetEmail2='';
let calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
let selSlots=[];
let editRecIdx=-1;
let editPermsObj={};

// ── 권한 구조 정의 (전역)
const PERM_STRUCTURE=[
  {section:'📋 수업일지 스캔',key:'scan',items:[
    {label:'스캔 업로드',key:'scan_upload'},
    {label:'결과 수정',key:'scan_edit'},
    {label:'저장',key:'scan_save'},
  ]},
  {section:'👥 원생 관리',key:'students',items:[
    {label:'원생 목록 열람',key:'stu_view'},
    {label:'원생 등록',key:'stu_add'},
    {label:'원생 수정',key:'stu_edit'},
    {label:'원생 삭제',key:'stu_delete'},
    {label:'퇴원/휴강 관리',key:'stu_status'},
  ]},
  {section:'📅 출석 달력',key:'calendar',items:[
    {label:'출석 달력 열람',key:'cal_view'},
  ]},
  {section:'💳 수강료 관리',key:'payment',items:[
    {label:'수강료 열람',key:'pay_view'},
    {label:'납부 등록/수정',key:'pay_edit'},
  ]},
  {section:'📁 전체 기록',key:'history',items:[
    {label:'기록 열람',key:'hist_view'},
    {label:'기록 수정',key:'hist_edit'},
    {label:'기록 삭제',key:'hist_delete'},
  ]},
  {section:'📊 보고서',key:'report',items:[
    {label:'보고서 열람',key:'rpt_view'},
    {label:'리포트 출력',key:'rpt_print'},
  ]},
  {section:'🖼 구글 드라이브',key:'drive',items:[
    {label:'작품 갤러리 열람',key:'drive_view'},
    {label:'교육 리포트 생성',key:'drive_report'},
  ]},
];
const DEFAULT_PERMS={
  scan_upload:true,scan_edit:true,scan_save:true,
  stu_view:true,stu_add:false,stu_edit:false,stu_delete:false,stu_status:false,
  cal_view:true,
  pay_view:false,pay_edit:false,
  hist_view:true,hist_edit:false,hist_delete:false,
  rpt_view:true,rpt_print:true,
  drive_view:true,drive_report:true,
};

// ════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════
if(auth){
  auth.onAuthStateChanged(async u=>{
    if(u){CU=u;await loadProfile(u.uid);showApp();}
    else{CU=null;CP=null;showLogin();}
  });
} else showLogin();

async function loadProfile(uid){
  if(!db)return;
  try{
    const doc=await db.collection('users').doc(uid).get();
    CP=doc.exists?doc.data():{name:CU.email,role:'teacher',email:CU.email,perms:{input:true,view:true,report:false}};
    if(!doc.exists)await db.collection('users').doc(uid).set(CP);
  }catch(e){CP={name:CU?.email||'사용자',role:'teacher',perms:{input:true,view:true,report:true}};}
}

function openPwReset(){
  const emailInput = el('login-email');
  const resetEmailEl = el('pw-reset-email');
  if(resetEmailEl && emailInput) resetEmailEl.value = emailInput.value || '';
  const overlay = el('pw-reset-overlay');
  if(overlay){ overlay.style.display='flex'; overlay.classList.add('show'); }
  el('pw-reset-form').style.display='block';
  el('pw-reset-done').style.display='none';
  const msgEl = el('pw-reset-msg');
  if(msgEl) msgEl.textContent='';
}

function closePwReset(){
  const overlay = el('pw-reset-overlay');
  if(overlay){ overlay.style.display='none'; overlay.classList.remove('show'); }
}

async function sendPwReset(){
  const email = el('pw-reset-email')?.value?.trim();
  const msgEl = el('pw-reset-msg');
  if(!email){
    if(msgEl){ msgEl.textContent='이메일을 입력해 주세요'; msgEl.style.color='#C62828'; }
    return;
  }
  if(!email.includes('@')){
    if(msgEl){ msgEl.textContent='올바른 이메일 형식이 아니에요'; msgEl.style.color='#C62828'; }
    return;
  }
  if(msgEl){ msgEl.textContent='전송 중...'; msgEl.style.color='#888'; }
  try{
    await firebase.auth().sendPasswordResetEmail(email);
    // 성공
    el('pw-reset-form').style.display='none';
    el('pw-reset-done').style.display='block';
    const doneMsg = el('pw-reset-done-msg');
    if(doneMsg) doneMsg.textContent=email+' 으로\n재설정 링크를 전송했어요.';
  }catch(err){
    let errMsg = '전송에 실패했어요. 다시 시도해 주세요.';
    if(err.code==='auth/user-not-found') errMsg='등록되지 않은 이메일이에요.';
    else if(err.code==='auth/invalid-email') errMsg='이메일 형식이 올바르지 않아요.';
    else if(err.code==='auth/too-many-requests') errMsg='너무 많이 시도했어요. 잠시 후 다시 시도해 주세요.';
    if(msgEl){ msgEl.textContent=errMsg; msgEl.style.color='#C62828'; }
  }
}

// 오버레이 바깥 클릭 시 닫기
document.addEventListener('click', function(e){
  const overlay = el('pw-reset-overlay');
  if(overlay && e.target === overlay) closePwReset();
});

async function doLogin(){
  const id=gv('li').trim(),pw=gv('lp');
  el('lerr').textContent='';
  if(!id||!pw){el('lerr').textContent='아이디와 비밀번호를 입력하세요';return;}
  if(!FB_READY){
    if(id==='admin@solveart.com'&&pw==='admin1234'){
      CU={uid:'admin',email:id};CP={name:'관리자',role:'admin',email:id,perms:{input:true,view:true,report:true}};
      showApp();toast('⚠️ 데모 모드');return;
    }
    el('lerr').textContent='Firebase 미설정 상태입니다';return;
  }
  el('lerr').textContent='로그인 중...';
  try{await auth.signInWithEmailAndPassword(id,pw);}
  catch(e){
    const m={'auth/user-not-found':'등록되지 않은 아이디','auth/wrong-password':'비밀번호 오류',
      'auth/invalid-credential':'아이디 또는 비밀번호 오류','auth/too-many-requests':'잠시 후 다시 시도'};
    el('lerr').textContent=m[e.code]||e.message;
  }
}
async function doLogout(){if(auth)await auth.signOut();else showLogin();}

function showLogin(){el('login-screen').style.display='flex';el('main-app').style.display='none';sv('li','');sv('lp','');el('lerr').textContent='';}

function showApp(){
  el('login-screen').style.display='none';el('main-app').style.display='block';
  const isA=CP?.role==='admin';
  el('bnav-t').style.display=isA?'none':'flex';el('bnav-a').style.display=isA?'flex':'none';
  if(el('sn-admin'))el('sn-admin').style.display=isA?'flex':'none';
  if(el('sn-report'))el('sn-report').style.display='flex';
  el('hdr-nm').textContent=CP?.name||'사용자';
  const rb=el('hdr-role');rb.textContent=isA?'관리자':'선생님';
  rb.className='rbdg '+(isA?'r-admin':'r-teacher');
  sv('r-teacher',CP?.name||'');sv('r-date',today());sv('mon-date',today());sv('sel-month',today().slice(0,7));
  renderHome();initMyPage();loadStudentsFromDB();
  setTimeout(()=>syncPageTopNav('home'),0);
  AI_CFG = JSON.parse(localStorage.getItem('sa_ai_cfg')||'{}');
  checkPortalParam();
  loadCounselsFromDB();
  if(CP?.role==='admin')loadFinanceFromDB();
  // 반 데이터 Firestore 로드
  if(FB_READY&&db){
    db.collection('classes').get().then(snap=>{
      snap.forEach(doc=>{ if(!CLASSES.find(c=>c.id===doc.id)) CLASSES.push({id:doc.id,...doc.data()}); });
      localStorage.setItem('sa_classes',JSON.stringify(CLASSES));
    }).catch(e=>{});
  }
  // 권한에 따라 버튼 표시 제어
  setTimeout(()=>{
    const addBtn=el('btn-add-stu');
    if(addBtn)addBtn.style.display=hasPerm('stu_add')?'':'none';
  },100);
  if(isA&&el('fb-auth-badge')){
    el('fb-auth-badge').textContent=FB_READY?'⬤ 연결됨':'⬤ 데모';
    el('fb-auth-badge').className='apist '+(FB_READY?'ok':'no');
    el('fb-db-badge').textContent=FB_READY&&db?'⬤ 연결됨':'⬤ 데모';
    el('fb-db-badge').className='apist '+(FB_READY&&db?'ok':'no');
  }
}

// ════════════════════════════════════════════
//  원생 관리
// ════════════════════════════════════════════
async function loadStudentsFromDB(){
  if(FB_READY&&db){
    try{
      const snap=await db.collection('students').orderBy('name').get();
      STUS=[];snap.forEach(d=>STUS.push({id:d.id,...d.data()}));
      localStorage.setItem('sa_stus',JSON.stringify(STUS));
      // 수강료 데이터도 Firestore에서 로드
      await loadPaymentsFromDB();
    }catch(e){STUS=JSON.parse(localStorage.getItem('sa_stus')||'[]');}
  }
  updStuSelects();
  initCounselSelects();
}

async function loadPaymentsFromDB(){
  if(!FB_READY||!db)return;
  try{
    const yr=new Date().getFullYear();
    const snap=await db.collection('payments').get();
    snap.forEach(doc=>{
      localStorage.setItem(doc.id, JSON.stringify(doc.data()));
    });
  }catch(e){console.warn('수강료 로드 오류:',e);}
}

function updStuSelects(){
  const stus=STUS.map(s=>s.name).filter(Boolean).sort();
  ['m-stu','sel-stu','cal-stu'].forEach(id=>{
    const e=el(id);if(!e)return;const c=e.value;
    const opts=stus.map(s=>`<option value="${s}">${s}</option>`).join('');
    e.innerHTML=(id==='cal-stu'?'<option value="">-- 원생 선택 --</option>':'<option value="">-- 선택 --</option>')+opts;
    if(c)e.value=c;
  });
}

function openAddStu(){
  el('stu-modal-title').textContent='원생 등록';
  sv('stu-edit-id','');sv('stu-name','');sv('stu-phone','');sv('stu-fee',CFG.fee||'');
  sv('stu-regdate',today());sv('stu-memo','');
  selSlots=[];
  sv('stu-type','');sv('stu-sibling','0');sv('stu-gender','');sv('stu-age','');sv('stu-grade','');sv('stu-school','');sv('stu-addr','');sv('stu-drive-id','');
  if(el('stu-fee-badge'))el('stu-fee-badge').textContent='';
  document.querySelectorAll('#stu-slots-wrap .perm-btn').forEach(b=>b.classList.remove('on'));
  el('modal-stu').classList.add('show');
}

function openEditStu(id){
  const s=STUS.find(x=>x.id===id);if(!s)return;
  el('stu-modal-title').textContent='원생 수정';
  sv('stu-edit-id',id);sv('stu-name',s.name||'');sv('stu-phone',s.phone||'');
  sv('stu-fee',s.fee||'');sv('stu-regdate',s.regdate||today());sv('stu-memo',s.memo||'');
  sv('stu-type',s.feeType||'');sv('stu-sibling',s.sibling||'0');sv('stu-gender',s.gender||'');sv('stu-age',s.age||'');sv('stu-grade',s.grade||'');sv('stu-school',s.school||'');sv('stu-addr',s.addr||'');sv('stu-drive-id',s.driveId||'');
  if(el('stu-fee-badge'))el('stu-fee-badge').textContent=s.feeType?getFeeLabel(s.feeType,s.sibling):'';
  selSlots=[...(s.slots||[])];
  document.querySelectorAll('#stu-slots-wrap .perm-btn').forEach(b=>{
    b.classList.toggle('on',selSlots.includes(b.dataset.slot));
  });
  el('modal-stu').classList.add('show');
}

function tSlot(btn){
  const slot=btn.dataset.slot;
  if(selSlots.includes(slot)){selSlots=selSlots.filter(s=>s!==slot);btn.classList.remove('on');}
  else{selSlots.push(slot);btn.classList.add('on');}
}

async function saveStu(){
  const name=gv('stu-name').trim();
  if(!name){toast('이름을 입력하세요');return;}
  const feeType=gv('stu-type');const sibling=gv('stu-sibling');
  const data={name,gender:gv('stu-gender'),age:gv('stu-age'),grade:gv('stu-grade'),school:gv('stu-school'),addr:gv('stu-addr'),phone:gv('stu-phone'),slots:selSlots,feeType,sibling,fee:gv('stu-fee'),regdate:gv('stu-regdate'),memo:gv('stu-memo'),driveId:gv('stu-drive-id'),updatedAt:new Date().toISOString()};
  showOv('저장 중…');
  try{
    const editId=gv('stu-edit-id');
    if(FB_READY&&db){
      if(editId){await db.collection('students').doc(editId).update(data);const i=STUS.findIndex(x=>x.id===editId);if(i>=0)STUS[i]={id:editId,...data};}
      else{const ref=await db.collection('students').add({...data,createdAt:new Date().toISOString()});STUS.push({id:ref.id,...data});}
    }else{
      if(editId){const i=STUS.findIndex(x=>x.id===editId);if(i>=0)STUS[i]={id:editId,...data};}
      else STUS.push({id:'s'+Date.now(),...data});
      localStorage.setItem('sa_stus',JSON.stringify(STUS));
    }
    toast(`✅ ${name} ${editId?'수정':'등록'} 완료!`);
    closeM('modal-stu');renderStudents();updStuSelects();
  }catch(e){toast('오류: '+e.message);}
  hideOv();
}

async function deleteStu(id,name){
  if(!confirm(`⚠️ "${name}" 원생을 삭제할까요?`))return;
  showOv('삭제 중…');
  try{
    if(FB_READY&&db)await db.collection('students').doc(id).delete();
    STUS=STUS.filter(x=>x.id!==id);
    localStorage.setItem('sa_stus',JSON.stringify(STUS));
    toast(`✅ ${name} 삭제 완료`);renderStudents();updStuSelects();
  }catch(e){toast('오류: '+e.message);}
  hideOv();
}

function renderStudents(){
  const q=(gv('stu-q')||'').toLowerCase();
  const all=STUS.filter(s=>!q||s.name?.toLowerCase().includes(q));

  // 카운트 배지 업데이트
  const cntAll=all.length;
  const cntActive=all.filter(s=>!s.status||s.status==='active').length;
  const cntPause=all.filter(s=>s.status==='pause').length;
  const cntOut=all.filter(s=>s.status==='out').length;
  const setCnt=(id,n)=>{const e=el(id);if(e)e.textContent=n?`(${n})`:'';};
  setCnt('cnt-all',cntAll);setCnt('cnt-active',cntActive);
  setCnt('cnt-pause',cntPause);setCnt('cnt-out',cntOut);

  // 필터 적용
  const list=all.filter(s=>{
    if(stuFilter==='all') return true;
    if(stuFilter==='active') return !s.status||s.status==='active';
    return s.status===stuFilter;
  });

  const wrap=el('stu-list-wrap');
  if(!list.length){
    const msg=stuFilter==='all'?'등록된 원생이 없어요':
      stuFilter==='active'?'수강중인 원생이 없어요':
      stuFilter==='pause'?'휴강중인 원생이 없어요':'퇴원한 원생이 없어요';
    wrap.innerHTML=`<div style="text-align:center;padding:2rem;color:var(--muted);font-size:.78rem;">${msg}${stuFilter==='all'?'<br><br><button class=\"btn btn-b btn-sm\" onclick=\"openAddStu()\">+ 원생 등록</button>':''}</div>`;
    return;
  }
  wrap.innerHTML=list.map(s=>{
    const recs=DB.filter(r=>r.studentName===s.name);
    const m=today().slice(0,7);const mR=recs.filter(r=>r.date?.startsWith(m));
    const pr=mR.filter(r=>r.attendance==='present').length;const tot=mR.length;
    const rate=tot?Math.round(pr/tot*100):null;
    return `<div class="stu-card">
      <div class="stu-hd">
        <div class="stu-av" style="${s.status==='out'?'background:var(--red);opacity:.6':s.status==='pause'?'background:var(--gold)':''}">${(s.name||'?')[0]}</div>
        <div class="stu-info">
          <h4>${s.name||'이름없음'} ${s.status==='out'?'<span class=\"status-badge status-out\">퇴원</span>':s.status==='pause'?'<span class=\"status-badge status-pause\">휴강중</span>':'<span class=\"status-badge status-active\">수강중</span>'}</h4>
          <p>${[s.gender,s.grade,s.school].filter(Boolean).join(' · ')||'정보 없음'}</p>
          <p>${s.phone||'연락처 없음'} ${rate!==null?`· 이달 ${rate}%`:''}</p>
          ${s.addr?`<p style="font-size:.67rem;color:var(--muted);">📍 ${s.addr}</p>`:''}
          ${s.feeType?`<p style="font-size:.68rem;color:var(--blue);margin-top:.1rem;">${getFeeLabel(s.feeType,s.sibling)}</p>`:''}
        </div>
        <div class="stu-actions">
          ${hasPerm('stu_edit')?`<button class="btn btn-o btn-sm" onclick="openEditStu('${s.id}')">수정</button>`:''}
          ${s.driveId?`<button class="btn btn-b btn-sm" onclick="openDriveGallery('${s.id}','${s.name}','${s.driveId||''}')">🖼 작품</button>`:''}
          ${hasPerm('stu_status')?`<button class="btn btn-gold btn-sm" onclick="openStuMgmt('${s.id}','${s.name}')">관리</button>`:''}
          ${hasPerm('stu_delete')?`<button class="btn btn-r btn-sm" onclick="deleteStu('${s.id}','${s.name}')">삭제</button>`:''}
        </div>
      </div>
      ${s.slots?.length?`<div class="stu-slots">${s.slots.map(sl=>`<span class="stu-slot">⏰ ${sl}</span>`).join('')}</div>`:''}
    </div>`;
  }).join('');
}

// ── 출석 달력 ──
function renderCal(){
  const name=gv('cal-stu');
  if(!name){el('cal-wrap').innerHTML='';el('cal-legend').style.display='none';return;}
  el('cal-legend').style.display='block';
  buildCal(name,calYear,calMonth);
}

function buildCal(name,year,month){
  const recs=DB.filter(r=>r.studentName===name&&r.date?.startsWith(`${year}-${String(month+1).padStart(2,'0')}`));
  const attMap={};recs.forEach(r=>{if(r.date)attMap[r.date]=r.attendance;});
  const pr=recs.filter(r=>r.attendance==='present').length;
  const ab=recs.filter(r=>r.attendance==='absent').length;
  const lt=recs.filter(r=>r.attendance==='late').length;
  const tot=pr+ab+lt;const rate=tot?Math.round(pr/tot*100):0;
  el('cal-stats').innerHTML=`
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
      <span class="bdg bg">○ 출석 ${pr}일</span>
      <span class="bdg br">✕ 결석 ${ab}일</span>
      <span class="bdg bo">△ 지각 ${lt}일</span>
      <span class="bdg bb">출석률 ${rate}%</span>
    </div>`;
  const first=new Date(year,month,1).getDay();
  const days=new Date(year,month+1,0).getDate();
  const todayStr=today();
  let html=`<div class="cal-nav">
    <button onclick="moveCal(-1)">‹</button>
    <h3>${year}년 ${month+1}월</h3>
    <button onclick="moveCal(1)">›</button>
  </div>
  <div class="cal-grid">
    ${['일','월','화','수','목','금','토'].map(d=>`<div class="cal-hdr">${d}</div>`).join('')}
    ${Array(first).fill('<div></div>').join('')}`;
  for(let d=1;d<=days;d++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const att=attMap[ds];
    const dotCls=att==='present'?'dot-p':att==='absent'?'dot-a':att==='late'?'dot-l':'';
    const todayCls=ds===todayStr?'today':'';
    html+=`<div class="cal-day ${todayCls}">
      <span>${d}</span>
      ${att?`<div class="cal-dot ${dotCls}"></div>`:''}
    </div>`;
  }
  html+='</div>';
  el('cal-wrap').innerHTML=html;
}

function moveCal(dir){
  calMonth+=dir;
  if(calMonth<0){calMonth=11;calYear--;}
  if(calMonth>11){calMonth=0;calYear++;}
  renderCal();
}

function stuTab(id,btn){
  document.querySelectorAll('#page-students .tab').forEach(t=>t.classList.remove('on'));btn.classList.add('on');
  ['st-list','st-cal','st-pay'].forEach(t=>el(t).style.display='none');
  el('st-'+id).style.display='block';
  if(id==='list')renderStudents();
  if(id==='cal'){updStuSelects();renderCal();}
  if(id==='pay')renderPay();
}

// ── 수강료 ──
function renderPay(){
  const yr=parseInt(gv('pay-year')||new Date().getFullYear());
  const wrap=el('pay-list');
  if(!STUS.length){wrap.innerHTML='<div style="text-align:center;padding:2rem;color:var(--muted);font-size:.78rem;">등록된 원생이 없어요<br><br><button class="btn btn-b btn-sm" onclick="stuTab(\'list\',document.querySelector(\'.tab\'))">+ 원생 등록</button></div>';return;}
  let unpaidCnt=0;
  let totalExpected=0,totalPaid=0;
  const curMonth=new Date().getMonth()+1;
  const curYr=new Date().getFullYear();
  const activeStus2=STUS.filter(s=>!s.status||s.status==='active');
  // 먼저 현재 달 미납 카운트 계산
  activeStus2.forEach(s=>{
    const p=JSON.parse(localStorage.getItem('pay_'+s.id+'_'+curYr)||'{}');
    if(!p[curMonth])unpaidCnt++;
  });
  // 즉시 summary 업데이트
  const paidCntInit=activeStus2.length-unpaidCnt;
  if(el('pay-summary')){
    el('pay-summary').innerHTML=
      '<span style="color:var(--sage);font-weight:800;">납부 '+paidCntInit+'명</span>'
      +' <span style="color:var(--muted);">·</span> '
      +'<span style="color:var(--accent);font-weight:800;">미납 '+unpaidCnt+'명</span>';
  }
  unpaidCnt=0; // 리셋 후 카드 렌더링에서 재계산
  wrap.innerHTML=STUS.map(s=>{
    const pays=JSON.parse(localStorage.getItem(`pay_${s.id}_${yr}`)||'{}');
    const months=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    // 현재 달 기준 미납 여부
    const isUnpaidThisMonth=(yr===new Date().getFullYear())&&!pays[curMonth];
    if(isUnpaidThisMonth)unpaidCnt++;
    const thisPaid=pays[curMonth];
    return `<div class="pay-card" style="border-left:4px solid ${thisPaid?'var(--sage)':'var(--accent)'};">
      <div class="pay-hd">
        <span class="pay-name">${s.name}</span>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span class="pay-amount">${s.feeType?getFeeLabel(s.feeType,s.sibling):`월 ${Number(s.fee||0).toLocaleString()}원`}</span>
          <span style="font-size:.7rem;font-weight:800;color:${thisPaid?'var(--sage)':'var(--accent)'};">${thisPaid?'✓ 납부':'✕ 미납'}</span>
        </div>
      </div>
      <div class="pay-months">
        ${months.map((m,i)=>{
          const paid=pays[i+1];
          return `<button class="pay-month ${paid?'paid':''}" ${hasPerm('pay_edit')?`onclick="togglePay('${s.id}',${yr},${i+1},this)"`:'disabled style="cursor:default;"'}>${m}</button>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  // 현재 달 기준으로 정확히 재계산
  let finalUnpaid=0;
  activeStus2.forEach(s=>{
    const p2=JSON.parse(localStorage.getItem('pay_'+s.id+'_'+curYr)||'{}');
    if(!p2[curMonth])finalUnpaid++;
  });
  const paidCnt=activeStus2.length-finalUnpaid;
  if(el('pay-summary')){
    el('pay-summary').innerHTML=
      '<span style="color:var(--sage);font-weight:800;">납부 '+paidCnt+'명</span>'
      +' <span style="color:var(--muted);">·</span> '
      +'<span style="color:var(--accent);font-weight:800;">미납 '+finalUnpaid+'명</span>';
  }
  // 연도 셀렉트
  const yEl=el('pay-year');if(!yEl.options.length){
    const now=new Date().getFullYear();
    for(let y=now-1;y<=now+1;y++)yEl.innerHTML+=`<option value="${y}" ${y===now?'selected':''}>${y}년</option>`;
  }
}

async function togglePay(stuId,year,month,btn){
  const key=`pay_${stuId}_${year}`;
  const pays=JSON.parse(localStorage.getItem(key)||'{}');
  pays[month]=!pays[month];
  localStorage.setItem(key,JSON.stringify(pays));
  btn.className=`pay-month ${pays[month]?'paid':''}`;
  // Firestore에도 저장
  if(FB_READY&&db){
    try{
      await db.collection('payments').doc(key).set(pays,{merge:true});
    }catch(e){console.warn('납부 저장 오류:',e);}
  }
  // 미납 카운트 갱신 — 현재 달 기준으로만 계산
  const curMonth=new Date().getMonth()+1;
  const curYear=new Date().getFullYear();
  const activeOnly=STUS.filter(s=>!s.status||s.status==='active');
  let unpaidCnt=0;
  activeOnly.forEach(s=>{
    const p=JSON.parse(localStorage.getItem('pay_'+s.id+'_'+curYear)||'{}');
    if(!p[curMonth]) unpaidCnt++;
  });
  const paidCnt2=activeOnly.length-unpaidCnt;
  if(el('pay-summary')){
    el('pay-summary').innerHTML=
      '<span style="color:var(--sage);font-weight:800;">납부 '+paidCnt2+'명</span>'
      +' <span style="color:var(--muted);">·</span> '
      +'<span style="color:var(--accent);font-weight:800;">미납 '+unpaidCnt+'명</span>';
  }
}

// ════════════════════════════════════════════
//  기록 수정/삭제
// ════════════════════════════════════════════
function openEditRec(idx){
  const r=DB[idx];if(!r)return;
  editRecIdx=idx;
  sv('edit-rec-idx',idx);sv('edit-date',r.date||'');sv('edit-name',r.studentName||'');
  sv('edit-slot',r.timeSlot||'1~2시');sv('edit-att',r.attendance||'present');
  sv('edit-work',r.workName||'');sv('edit-worknum',r.workNum||'');
  sv('edit-comp',r.completion||0);sv('edit-memo',r.memo||'');sv('edit-teacher',r.teacher||'');
  el('modal-edit-rec').classList.add('show');
}

async function saveRec(){
  const idx=parseInt(gv('edit-rec-idx'));
  if(idx<0||idx>=DB.length)return;
  DB[idx]={...DB[idx],
    date:gv('edit-date'),studentName:gv('edit-name'),timeSlot:gv('edit-slot'),
    attendance:gv('edit-att'),workName:gv('edit-work'),workNum:gv('edit-worknum'),
    completion:parseInt(gv('edit-comp'))||0,memo:gv('edit-memo'),teacher:gv('edit-teacher'),
    updatedAt:new Date().toISOString()
  };
  localStorage.setItem('sa_db',JSON.stringify(DB));
  if(FB_READY&&db&&DB[idx].firestoreId){
    try{await db.collection('records').doc(DB[idx].firestoreId).update(DB[idx]);}catch(e){}
  }
  toast('✅ 수정 완료!');closeM('modal-edit-rec');renderHist();
}

async function deleteRec(){
  const idx=parseInt(gv('edit-rec-idx'));
  if(idx<0||idx>=DB.length)return;
  if(!confirm('이 기록을 삭제할까요?'))return;
  const rec=DB[idx];
  DB.splice(idx,1);
  localStorage.setItem('sa_db',JSON.stringify(DB));
  if(FB_READY&&db&&rec.firestoreId){
    try{await db.collection('records').doc(rec.firestoreId).delete();}catch(e){}
  }
  toast('✅ 삭제 완료');closeM('modal-edit-rec');renderHist();renderHome();
}


// ════════════════════════════════════════════
//  원생 관리 (퇴원/휴강/보강/수업변경)
// ════════════════════════════════════════════
let mgmtStuId='', mgmtStuName='', mgmtType='';
let stuFilter='all'; // 원생 필터: all / active / pause / out

function setStuFilter(filter, btn){
  stuFilter=filter;
  document.querySelectorAll('.stu-filter').forEach(b=>{
    b.style.fontWeight='500';
    b.style.opacity='.7';
  });
  btn.style.fontWeight='900';
  btn.style.opacity='1';
  renderStudents();
}

const MGMT_CONFIG = {
  out:    {title:'🚪 퇴원 등록',    dateLabel:'퇴원일',     dot:'dot-out',    text:'퇴원'},
  pause:  {title:'⏸ 휴강 등록',    dateLabel:'휴강 시작일', dot:'dot-pause',  text:'휴강'},
  resume: {title:'▶️ 복귀 등록',   dateLabel:'복귀일',     dot:'dot-resume', text:'복귀'},
  change: {title:'🔄 수업일 변경', dateLabel:'변경 적용일', dot:'dot-change', text:'수업일 변경'},
  makeup: {title:'📚 보강 등록',   dateLabel:'보강 날짜',  dot:'dot-makeup', text:'보강'},
  memo:   {title:'📝 메모 추가',   dateLabel:'날짜',        dot:'dot-resume', text:'메모'},
};

function openStuMgmt(id, name){
  mgmtStuId=id; mgmtStuName=name;
  el('mgmt-title').textContent=`${name} · 원생 관리`;
  el('mgmt-form').style.display='none';
  sv('mgmt-date', today());
  sv('mgmt-date2',''); sv('mgmt-memo','');
  renderTimeline();
  el('modal-stu-mgmt').classList.add('show');
}

function showMgmtForm(type){
  mgmtType=type;
  const cfg=MGMT_CONFIG[type];
  el('mgmt-form').style.display='block';
  el('mgmt-form-title').textContent=cfg.title;
  el('mgmt-date-label').textContent=cfg.dateLabel;
  el('mgmt-memo-label').textContent=type==='memo'?'메모 내용':'사유 / 메모';
  // 필드 show/hide
  el('mgmt-date2-wrap').style.display=type==='pause'?'block':'none';
  el('mgmt-from-wrap').style.display=type==='change'?'block':'none';
  el('mgmt-to-wrap').style.display=type==='change'?'block':'none';
  el('mgmt-slot-wrap').style.display=type==='makeup'?'block':'none';
  sv('mgmt-date',today());
}

async function saveMgmt(){
  const date=gv('mgmt-date');
  if(!date){toast('날짜를 입력하세요');return;}
  const cfg=MGMT_CONFIG[mgmtType];
  let desc='';
  if(mgmtType==='pause'){
    const d2=gv('mgmt-date2');
    desc=d2?`${date} ~ ${d2}`:`${date}~`;
  } else if(mgmtType==='change'){
    const from=gv('mgmt-from-day'),to=gv('mgmt-to-day');
    desc=`${from}요일 → ${to}요일`;
  } else if(mgmtType==='makeup'){
    desc=`${date} ${gv('mgmt-slot')||''}`;
  }
  const memo=gv('mgmt-memo');
  const entry={type:mgmtType,date,desc,memo,createdAt:new Date().toISOString()};

  // localStorage에 이력 저장
  const key=`mgmt_${mgmtStuId}`;
  const history=JSON.parse(localStorage.getItem(key)||'[]');
  history.unshift(entry);
  localStorage.setItem(key,JSON.stringify(history));

  // 원생 상태 업데이트
  const stu=STUS.find(s=>s.id===mgmtStuId);
  if(stu){
    if(mgmtType==='out') stu.status='out';
    else if(mgmtType==='pause') stu.status='pause';
    else if(mgmtType==='resume') stu.status='active';
    localStorage.setItem('sa_stus',JSON.stringify(STUS));
    if(FB_READY&&db){
      try{await db.collection('students').doc(mgmtStuId).update({status:stu.status});}catch(e){}
    }
  }

  // Firestore에도 이력 저장
  if(FB_READY&&db){
    try{await db.collection('students').doc(mgmtStuId).collection('history').add(entry);}catch(e){}
  }

  toast(`✅ ${cfg.text} 등록 완료!`);
  el('mgmt-form').style.display='none';
  sv('mgmt-memo','');
  renderTimeline();
  renderStudents();
}

function renderTimeline(){
  const key=`mgmt_${mgmtStuId}`;
  const history=JSON.parse(localStorage.getItem(key)||'[]');
  const wrap=el('mgmt-timeline');
  if(!history.length){
    wrap.innerHTML='<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.76rem;">관리 이력이 없어요</div>';
    return;
  }
  wrap.innerHTML=history.map(h=>{
    const cfg=MGMT_CONFIG[h.type]||{text:h.type,dot:'dot-resume'};
    const detail=h.desc?`<br>${h.desc}`:'';
    const memo=h.memo?`<br><span style="color:var(--muted);">${h.memo}</span>`:'';
    return `<div class="timeline-item">
      <div class="timeline-dot ${cfg.dot}"></div>
      <div class="tl-content">
        <div class="tl-title">${cfg.text}</div>
        <div class="tl-desc">${detail}${memo}</div>
        <div class="tl-date">${h.date} · ${h.createdAt?.slice(0,10)||''}</div>
      </div>
      <button class="btn btn-o btn-sm" style="padding:.15rem .4rem;font-size:.6rem;" onclick="deleteMgmt('${h.createdAt}')">삭제</button>
    </div>`;
  }).join('');
}

function deleteMgmt(createdAt){
  if(!confirm('이 이력을 삭제할까요?'))return;
  const key=`mgmt_${mgmtStuId}`;
  const history=JSON.parse(localStorage.getItem(key)||'[]');
  const newH=history.filter(h=>h.createdAt!==createdAt);
  localStorage.setItem(key,JSON.stringify(newH));
  toast('✅ 삭제 완료');renderTimeline();
}

// ════════════════════════════════════════════
//  수강료 계산
// ════════════════════════════════════════════
const FEE_TABLE = {
  '1': CFG.feeW1||110000,
  '2': CFG.feeW2||130000,
  '3': CFG.feeW3||150000,
  'hobby': CFG.feeHobby||160000
};
const FEE_LABELS = {'1':'주 1회','2':'주 2회','3':'주 3회','hobby':'취미반 주 3회'};

function calcFee(){
  const type=gv('stu-type');
  const sibling=parseInt(gv('stu-sibling')||'0');
  if(!type){sv('stu-fee','');el('stu-fee-badge').textContent='';return;}
  const base=FEE_TABLE[type]||0;
  const discount=sibling*5000;
  const total=base-discount;
  sv('stu-fee',total);
  const badge=el('stu-fee-badge');
  if(badge){
    badge.textContent=discount>0?`기본 ${base.toLocaleString()} - 형제할인 ${discount.toLocaleString()}`:`${base.toLocaleString()}원`;
  }
}

function getFeeLabel(type,sibling){
  if(!type)return '';
  const base=FEE_TABLE[type]||0;
  const disc=(parseInt(sibling)||0)*5000;
  const total=base-disc;
  const lbl=FEE_LABELS[type]||'';
  return `${lbl} · ${total.toLocaleString()}원${disc>0?' (형제할인 '+disc.toLocaleString()+')':''}`;
}

// ════════════════════════════════════════════
//  SCAN / OCR
// ════════════════════════════════════════════
function dzEv(e,t){e.preventDefault();const dz=el('dz');
  if(t==='ov')dz.classList.add('ov');if(t==='lv')dz.classList.remove('ov');
  if(t==='dp'){dz.classList.remove('ov');processFile(e.dataTransfer.files[0]);}}
function handleFile(e){if(e.target.files[0])processFile(e.target.files[0]);}
function processFile(file){
  if(!hasPerm('scan_upload')){toast('⚠️ 스캔 업로드 권한이 없어요');return;}
  const r=new FileReader();r.onload=ev=>{curImg=ev.target.result;doScan();};r.readAsDataURL(file);
}
async function doScan(){
  showOv('AI가 일지를 읽고 있어요…');
  try{
    if(SU){
      const res=await fetch(SU,{method:'POST',body:JSON.stringify({action:'ocr',imageBase64:curImg.split(',')[1]}),headers:{'Content-Type':'application/json'}});
      const data=await res.json();hideOv();fillResult(data.parsed||demoOCR(),'',data.confidence||90);
    }else{await delay(1200);hideOv();fillResult(demoOCR(),'',85);toast('⚠️ Sheets URL 미설정 — 데모 데이터');}
    nav('result');
  }catch(e){hideOv();fillResult(demoOCR(),'',75);nav('result');toast('⚠️ 연결 오류 — 데모 데이터');}
}
function demoOCR(){return{date:today(),students:[
  {timeSlot:'1~2시',name:'정이레',attendance:'present',workName:'정물화',workNum:'3',completion:5,memo:'완성'},
  {timeSlot:'1~2시',name:'안지안',attendance:'present',workName:'지정도',workNum:'2',completion:4,memo:''},
  {timeSlot:'3~4시',name:'임혜원',attendance:'present',workName:'가족사진',workNum:'1',completion:3,memo:''},
  {timeSlot:'4~5시',name:'박하야',attendance:'present',workName:'가족사진',workNum:'2',completion:5,memo:'완성'},
  {timeSlot:'4~5시',name:'김민을',attendance:'absent',workName:'',workNum:'',completion:0,memo:''},
  {timeSlot:'5~6시',name:'홍지우',attendance:'absent',workName:'',workNum:'',completion:0,memo:''},
],attMemo:'이원석 결석',mgrMemo:''};}
function fillResult(data,raw,conf){
  ocrData=data;sv('r-date',data.date||today());sv('r-att',data.attMemo||'');sv('r-mgr',data.mgrMemo||'');
  el('conf-n').textContent=conf+'%';
  const wrap=el('scards');wrap.innerHTML='';
  (data.students||[]).forEach((s,i)=>wrap.innerHTML+=buildSCard(s,i));
}
function buildSCard(s,i){
  const aH=['present','absent','late'].map((a,ai)=>
    `<button class="abtn ${s.attendance===a?['p','a','l'][ai]:''}" onclick="setA(${i},'${a}')" id="ab-${i}-${a}">${['○출석','✕결석','△지각'][ai]}</button>`
  ).join('');
  const cH=[1,2,3,4,5].map(n=>
    `<button class="cpill ${s.completion>=n?'on':''}" onclick="setC(${i},${n})" id="cp-${i}-${n}">${n}</button>`
  ).join('');
  // 등록된 원생 자동완성 힌트
  const stuMatch=STUS.find(x=>x.name===s.name);
  const hint=stuMatch?`<span style="font-size:.6rem;color:var(--sage);margin-left:.3rem;">✓ 등록원생</span>`:'';
  return `<div class="ocr-card"><div class="ocr-hd"><h4>${s.name||'이름없음'}${hint}</h4><span class="slot">${s.timeSlot||'미상'}</span></div>
  <div class="ocr-bd">
    <div class="orow"><span class="olbl">출결</span><div class="atog">${aH}</div></div>
    <div class="orow"><span class="olbl">작품명</span><input class="inp" value="${s.workName||''}" oninput="ocrData.students[${i}].workName=this.value"></div>
    <div class="orow"><span class="olbl">회차</span><input class="inp" value="${s.workNum||''}" style="width:66px" oninput="ocrData.students[${i}].workNum=this.value"></div>
    <div class="orow"><span class="olbl">완성도</span><div class="cpills">${cH}</div></div>
    <div class="orow"><span class="olbl">메모</span><input class="inp" value="${s.memo||''}" oninput="ocrData.students[${i}].memo=this.value"></div>
  </div></div>`;
}
function setA(i,v){ocrData.students[i].attendance=v;const m={present:'p',absent:'a',late:'l'};
  ['present','absent','late'].forEach(a=>{const b=el(`ab-${i}-${a}`);if(b)b.className='abtn'+(a===v?' '+m[a]:'');});}
function setC(i,v){ocrData.students[i].completion=v;for(let n=1;n<=5;n++){const b=el(`cp-${i}-${n}`);if(b)b.className='cpill'+(n<=v?' on':'');}}

// ════════════════════════════════════════════
//  저장
// ════════════════════════════════════════════
async function saveAll(){
  if(!ocrData)return;
  const recs=(ocrData.students||[]).map(s=>({
    date:gv('r-date'),teacher:gv('r-teacher')||CP?.name||'',
    timeSlot:s.timeSlot,studentName:s.name,attendance:s.attendance,
    workName:s.workName,workNum:s.workNum,completion:s.completion,memo:s.memo,
    attMemo:gv('r-att'),mgrMemo:gv('r-mgr'),
    savedAt:new Date().toISOString(),savedBy:CU?.uid||'demo'
  }));
  DB=DB.concat(recs);localStorage.setItem('sa_db',JSON.stringify(DB));
  if(FB_READY&&db){
    try{
      const batch=db.batch();
      recs.forEach(r=>{
        const ref=db.collection('records').doc();
        r.firestoreId=ref.id;
        batch.set(ref,r);
      });
      await batch.commit();
    }catch(e){}
  }
  if(SU){try{await fetch(SU,{method:'POST',body:JSON.stringify({action:'save',records:recs}),headers:{'Content-Type':'application/json'}});}catch(e){}}
  toast(`✅ ${recs.length}건 저장 완료!`);nav('home');
}

// ════════════════════════════════════════════
//  홈
// ════════════════════════════════════════════
function renderHome(){
  const now=new Date();
  const dayNames=['일','월','화','수','목','금','토'];
  const dayStr=`${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 (${dayNames[now.getDay()]})`;
  if(el('d-date'))el('d-date').textContent=dayStr;
  const isAdmin2 = CP?.role==='admin';
  const helloTitle = isAdmin2 ? '원장님' : (CP?.name||'선생님')+'선생님';
  if(el('hello-name'))el('hello-name').textContent=helloTitle;

  const m=today().slice(0,7),mR=DB.filter(r=>r.date?.startsWith(m));
  const todayRecs=DB.filter(r=>r.date===today());
  const todayPr=todayRecs.filter(r=>r.attendance==='present').length;
  const todayAb=todayRecs.filter(r=>r.attendance==='absent').length;
  const todayTot=todayPr+todayAb;
  const mPr=mR.filter(r=>r.attendance==='present').length;
  const mTot=mR.length;
  const mAb=mR.filter(r=>r.attendance==='absent').length;

  const activeCount=STUS.filter(s=>!s.status||s.status==='active').length;
  if(el('st-total'))el('st-total').textContent=activeCount||'—';
  if(el('st-today-att'))el('st-today-att').textContent=todayPr||'—';
  if(el('st-att-rate'))el('st-att-rate').textContent=todayTot?`출석률 ${Math.round(todayPr/todayTot*100)}%`:'데이터 없음';
  if(el('st-rate'))el('st-rate').textContent=mTot?Math.round(mPr/mTot*100)+'%':'—';
  if(el('st-ab'))el('st-ab').textContent=`결석 ${mAb}명`;

  const yr=now.getFullYear(),cm=now.getMonth()+1;
  const unpaid=STUS.filter(s=>{const p=JSON.parse(localStorage.getItem(`pay_${s.id}_${yr}`)||'{}');return !p[cm];}).length;
  if(el('st-unpay'))el('st-unpay').textContent=STUS.length?unpaid:'—';

  // 오늘의 수업 현황
  const slots=['1~2시','2~3시','3~4시','4~5시','5~6시'];
  const todayClassWrap=el('d-today-class');
  if(todayClassWrap){
    if(!todayRecs.length){
      todayClassWrap.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.8rem;">오늘 수업 기록이 없어요</div>';
    } else {
      const slotData={};
      slots.forEach(sl=>{
        const recs=todayRecs.filter(r=>r.timeSlot===sl);
        if(recs.length) slotData[sl]=recs;
      });
      todayClassWrap.innerHTML=Object.entries(slotData).map(([sl,recs])=>{
        const pr=recs.filter(r=>r.attendance==='present').length;
        const tot=recs.length;
        const pct=tot?Math.round(pr/tot*100):0;
        const teacher=recs[0]?.teacher||'—';
        return `<div class="today-class-row">
          <span class="tcr-time">${sl}</span>
          <span class="tcr-name">${tot}명</span>
          <div class="tcr-progress">
            <div class="tcr-bar-wrap"><div class="tcr-bar" style="width:${pct}%"></div></div>
            <span class="tcr-pct">${pr}/${tot}</span>
          </div>
          <span class="tcr-teacher">${teacher}</span>
        </div>`;
      }).join('')||'<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.8rem;">시간대별 기록 없음</div>';
    }
  }

  // 완성도 분포
  const compWrap=el('d-completion');
  if(compWrap){
    const now2=new Date(),dow=now2.getDay(),mon=new Date(now2);
    mon.setDate(now2.getDate()-(dow===0?6:dow-1));
    const wRecs=DB.filter(r=>r.date&&new Date(r.date)>=mon&&r.completion>0);
    const compCnt=[0,0,0,0,0];
    wRecs.forEach(r=>{if(r.completion>=1&&r.completion<=5)compCnt[r.completion-1]++;});
    const compTotal=compCnt.reduce((a,b)=>a+b,0);
    const compColors=['#FFB300','#FFC800','#4CAF50','#2196F3','#9C27B0'];
    const compLabels=['1단계','2단계','3단계','4단계','5단계 완성'];
    if(!compTotal){
      compWrap.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.8rem;">이번 주 데이터 없음</div>';
    } else {
      compWrap.innerHTML=`<div style="text-align:center;margin-bottom:.6rem;font-size:.8rem;font-weight:700;color:var(--muted);">총 ${compTotal}건</div>`+
        compCnt.map((c,i)=>{
          const pct=compTotal?Math.round(c/compTotal*100):0;
          return `<div class="completion-row">
            <div class="comp-dot" style="background:${compColors[i]}"></div>
            <span class="comp-lbl">${compLabels[i]}</span>
            <div class="comp-bar-w"><div class="comp-bar" style="width:${pct}%;background:${compColors[i]}"></div></div>
            <span class="comp-val">${c}건 ${pct}%</span>
          </div>`;
        }).join('');
    }
  }

  // 최근 스캔 기록
  const dates=[...new Set(DB.map(r=>r.date).filter(Boolean))].sort().reverse().slice(0,3);
  if(el('d-recent'))el('d-recent').innerHTML=dates.length?dates.map(d=>{
    const rs=DB.filter(r=>r.date===d);const ab2=rs.filter(r=>r.attendance==='absent').length;
    const pr2=rs.filter(r=>r.attendance==='present').length;
    const rate2=rs.length?Math.round(pr2/rs.length*100):0;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem .2rem;border-bottom:1px solid var(--gold-light);font-size:.8rem;">
      <span>📋 <strong>${d}</strong></span>
      <span style="color:var(--muted);">총 ${rs.length}명</span>
      <span style="color:var(--sage);font-weight:700;">출석 ${pr2}명</span>
      <span class="bdg ${rate2>=90?'bg':rate2>=70?'bo':'br'}">${rate2}%</span>
    </div>`;
  }).join(''):'<div style="text-align:center;padding:2rem;color:var(--muted);font-size:.8rem;">📷 아직 스캔 기록이 없어요</div>';

  // 자동 이탈 위험 체크 (백그라운드)
  if(STUS.length) setTimeout(()=>autoChurnCheck(),800);

  // 이달 원생 현황 테이블
  const smap={};mR.forEach(r=>{if(!r.studentName)return;if(!smap[r.studentName])smap[r.studentName]={p:0,a:0,c:[]};
    r.attendance==='present'?smap[r.studentName].p++:smap[r.studentName].a++;if(r.completion)smap[r.studentName].c.push(r.completion);});
  const tbody=el('d-tbody');const entries=Object.entries(smap);
  if(tbody)tbody.innerHTML=entries.length?entries.slice(0,15).map(([nm,d])=>{
    const t=d.p+d.a,r=t?Math.round(d.p/t*100):0,ac=d.c.length?(d.c.reduce((a,b)=>a+b)/d.c.length).toFixed(1):'-';
    const stu=STUS.find(s=>s.name===nm);
    const paid=stu?JSON.parse(localStorage.getItem(`pay_${stu.id}_${yr}`)||'{}')[cm]:null;
    const payBdg=stu?(paid
      ?'<span class="bdg" style="background:#E8F5E9;color:#1B5E20;font-weight:800;">✓ 납부</span>'
      :'<span class="bdg" style="background:#FFEBEE;color:#B71C1C;font-weight:800;">✕ 미납</span>'):'';
    const statusBdg=stu?.status==='out'?'<span class="bdg br" style="font-size:.55rem;margin-left:3px;">퇴원</span>':stu?.status==='pause'?'<span class="bdg bo" style="font-size:.55rem;margin-left:3px;">휴강</span>':'';
    return `<tr><td><strong>${nm}</strong>${statusBdg}</td><td style="color:var(--sage);font-weight:700;">${d.p}</td><td style="color:var(--accent);font-weight:700;">${d.a}</td><td style="font-weight:700;">${ac}</td><td>${payBdg}</td></tr>`;
  }).join(''):'<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.8rem;">이달 기록 없음</td></tr>';
}

// ════════════════════════════════════════════
//  기록 (수정 기능 포함)
// ════════════════════════════════════════════
function renderHist(){
  const q=(el('hist-q')?.value||'').toLowerCase();
  const f=DB.map((r,i)=>({...r,_i:i})).filter(r=>!q||r.date?.includes(q)||r.studentName?.toLowerCase().includes(q))
    .sort((a,b)=>b.savedAt>a.savedAt?1:-1);
  const list=el('hist-list'),emp=el('hist-empty');
  if(!f.length){list.innerHTML='';emp.style.display='block';return;}
  emp.style.display='none';
  const bd={};f.forEach(r=>{const d=r.date||'?';if(!bd[d])bd[d]=[];bd[d].push(r);});
  list.innerHTML=Object.entries(bd).sort((a,b)=>b[0]>a[0]?1:-1).map(([d,rs])=>{
    const ab=rs.filter(r=>r.attendance==='absent').length;
    return `<div class="hist-item">
      <div class="hist-hd">
        <strong style="font-size:.82rem;">📋 ${d}</strong>
        <div style="display:flex;gap:.3rem;"><span class="bdg bg">${rs.length}명</span>${ab?`<span class="bdg br">결석 ${ab}</span>`:''}</div>
      </div>
      ${rs.map(r=>`<div class="hist-row">
        <span style="width:14px;text-align:center;">${r.attendance==='present'?'○':r.attendance==='absent'?'✕':'△'}</span>
        <span style="font-weight:600;min-width:46px;">${r.studentName||'?'}</span>
        <span style="color:var(--muted);font-size:.7rem;">${r.timeSlot||''}</span>
        <span style="color:var(--muted);flex:1;font-size:.72rem;">${r.workName?r.workName+' #'+(r.workNum||1):'-'}</span>
        <span style="color:var(--accent);font-weight:700;font-size:.7rem;">${r.completion?'★'.repeat(r.completion):'-'}</span>
        ${hasPerm('hist_edit')||hasPerm('hist_delete')?`<button class="btn btn-o btn-sm" style="padding:.2rem .5rem;font-size:.65rem;" onclick="openEditRec(${r._i})">수정</button>`:''}
      </div>`).join('')}
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
//  보고서
// ════════════════════════════════════════════
function rTab(id,btn){
  document.querySelectorAll('#page-report .tab').forEach(t=>t.classList.remove('on'));btn.classList.add('on');
  ['week','month','year','stu'].forEach(t=>el('rp-'+t).style.display='none');el('rp-'+id).style.display='block';
  if(id==='month'){sv('sel-month',today().slice(0,7));loadMonth();}
  if(id==='year')loadYear();if(id==='stu')updStuSelects();
}
function initReport(){
  const now=new Date(),dow=now.getDay(),mon=new Date(now);mon.setDate(now.getDate()-(dow===0?6:dow-1));
  const wR=DB.filter(r=>r.date&&new Date(r.date)>=mon&&new Date(r.date)<=now);
  const wP=wR.filter(r=>r.attendance==='present').length,wA=wR.filter(r=>r.attendance==='absent').length;
  const wCs=wR.filter(r=>r.completion).map(r=>r.completion);
  el('w-days').textContent=[...new Set(wR.map(r=>r.date))].length;
  el('w-ab').textContent=wA;el('w-rt').textContent=wR.length?Math.round(wP/wR.length*100)+'%':'—';
  el('w-cp').textContent=wCs.length?(wCs.reduce((a,b)=>a+b)/wCs.length).toFixed(1):'—';
  const dmap={};wR.forEach(r=>{if(!r.date)return;if(!dmap[r.date])dmap[r.date]={p:0,a:0};r.attendance==='present'?dmap[r.date].p++:dmap[r.date].a++;});
  el('w-chart').innerHTML=Object.entries(dmap).sort().map(([d,v])=>{const t=v.p+v.a,r=t?Math.round(v.p/t*100):0;
    return `<div class="crow"><span class="clbl">${d.slice(5).replace('-','/')}</span><div class="cbar-w"><div class="cbar" style="width:${r}%"></div></div><span class="cval">${r}%</span></div>`;
  }).join('')||'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.76rem;">이번 주 기록 없음</div>';
  const slotMap={};wR.forEach(r=>{const s=r.timeSlot||'미상';if(!slotMap[s])slotMap[s]=[];slotMap[s].push(r);});
  el('w-detail').innerHTML=Object.entries(slotMap).map(([sl,rs])=>`
    <div style="margin-bottom:.65rem;"><div style="font-size:.7rem;font-weight:700;color:var(--muted);margin-bottom:.3rem;">${sl}</div>
    ${rs.map(r=>`<div style="display:flex;gap:.5rem;font-size:.73rem;padding:.2rem 0;border-bottom:1px dotted var(--border);">
      <span>${r.attendance==='present'?'○':'✕'}</span><span style="font-weight:600;min-width:48px;">${r.studentName}</span>
      <span style="color:var(--muted);flex:1;">${r.workName||'-'}${r.workNum?' #'+r.workNum:''}</span>
      <span style="color:var(--accent);">${r.completion?'★'.repeat(r.completion):''}</span>
    </div>`).join('')}</div>`).join('')||'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.76rem;">기록 없음</div>';
  const yEl=el('sel-year');const yrs=[...new Set(DB.map(r=>r.date?.slice(0,4)).filter(Boolean))];
  if(!yrs.includes(String(new Date().getFullYear())))yrs.push(String(new Date().getFullYear()));
  yEl.innerHTML=yrs.sort().reverse().map(y=>`<option value="${y}">${y}년</option>`).join('');
  updStuSelects();
}
function loadMonth(){
  const m=gv('sel-month')||today().slice(0,7),recs=DB.filter(r=>r.date?.startsWith(m)),smap={};
  recs.forEach(r=>{if(!r.studentName)return;if(!smap[r.studentName])smap[r.studentName]={p:0,a:0};r.attendance==='present'?smap[r.studentName].p++:smap[r.studentName].a++;});
  el('m-chart').innerHTML=Object.entries(smap).length?Object.entries(smap).map(([nm,d])=>{const t=d.p+d.a,r=t?Math.round(d.p/t*100):0;
    return `<div class="crow"><span class="clbl">${nm}</span><div class="cbar-w"><div class="cbar" style="width:${r}%"></div></div><span class="cval">${r}%</span></div>`;
  }).join(''):'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.76rem;">해당 월 데이터 없음</div>';
  updStuSelects();
}
function loadYear(){
  const yr=gv('sel-year');if(!yr)return;
  const recs=DB.filter(r=>r.date?.startsWith(yr)),mmap={};
  recs.forEach(r=>{const m=r.date?.slice(0,7);if(!m)return;if(!mmap[m])mmap[m]={p:0,a:0};r.attendance==='present'?mmap[m].p++:mmap[m].a++;});
  el('y-mchart').innerHTML=Object.entries(mmap).sort().map(([m,d])=>{const t=d.p+d.a,r=t?Math.round(d.p/t*100):0;
    return `<div class="crow"><span class="clbl">${m.slice(5)}월</span><div class="cbar-w"><div class="cbar" style="width:${r}%"></div></div><span class="cval">${r}%</span></div>`;
  }).join('')||'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.76rem;">데이터 없음</div>';
  const smap={};recs.forEach(r=>{if(!r.studentName)return;if(!smap[r.studentName])smap[r.studentName]=0;if(r.completion>=5)smap[r.studentName]++;});
  const mx=Math.max(...Object.values(smap),1);
  el('y-schart').innerHTML=Object.entries(smap).sort((a,b)=>b[1]-a[1]).map(([nm,c])=>
    `<div class="crow"><span class="clbl">${nm}</span><div class="cbar-w"><div class="cbar" style="width:${Math.round(c/mx*100)}%;background:linear-gradient(90deg,var(--accent),var(--gold))"></div></div><span class="cval">${c}작</span></div>`
  ).join('')||'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.76rem;">완성 기록 없음</div>';
}
function buildCard(){
  const nm=gv('m-stu'),m=gv('sel-month')||today().slice(0,7);if(!nm)return;
  const recs=DB.filter(r=>r.studentName===nm&&r.date?.startsWith(m));
  const pr=recs.filter(r=>r.attendance==='present').length,ab=recs.filter(r=>r.attendance==='absent').length;
  const tot=pr+ab,rate=tot?Math.round(pr/tot*100):0;
  const cs=recs.filter(r=>r.completion).map(r=>r.completion);
  const avgC=cs.length?cs.reduce((a,b)=>a+b)/cs.length:0;
  const lessons=recs.filter(r=>r.workName).map(r=>({d:r.date?.slice(5)||'',c:`${r.workName} #${r.workNum||1} · ★${r.completion||'?'}`}));
  const stu=STUS.find(s=>s.name===nm);
  const yr=new Date().getFullYear(),cm=new Date().getMonth()+1;
  const paid=stu?JSON.parse(localStorage.getItem(`pay_${stu.id}_${yr}`)||'{}')[cm]:null;
  el('rcard-wrap').innerHTML=`<div class="rcard"><div class="rhd">
    <div class="r-ac">${CFG.name||'솔브아트'} · Monthly Report</div>
    <div class="r-nm">${nm}</div><div class="r-pd">${m.replace('-','년 ')}월 · 담당: ${recs[0]?.teacher||'선생님'}</div></div>
    <div class="rbody"><div class="rsec"><div class="rstl">출석 현황</div><div class="attbs">
      <div class="attb pr"><div class="n">${pr}</div><div class="l">출석</div></div>
      <div class="attb ab"><div class="n">${ab}</div><div class="l">결석</div></div>
      <div class="attb rt"><div class="n">${rate}%</div><div class="l">출석률</div></div></div></div>
    <div class="rsec"><div class="rstl">수업 내용</div>
      ${lessons.slice(-5).map(l=>`<div style="font-size:.71rem;padding:.25rem 0;border-bottom:1px dotted var(--border);display:flex;gap:.35rem;"><span style="color:var(--muted);min-width:38px;font-size:.66rem;">${l.d}</span><span>${l.c}</span></div>`).join('')||'<div style="font-size:.73rem;color:var(--muted)">기록 없음</div>'}
    </div><div class="rsec"><div class="rstl">평균 완성도</div>
      <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-bottom:.25rem;"><span>완성도</span><span>${avgC.toFixed(1)}/5</span></div>
      <div class="pbar"><div class="pbarf" style="width:${avgC/5*100}%"></div></div></div>
    ${stu?`<div class="rsec"><div class="rstl">수강료</div><div style="display:flex;justify-content:space-between;font-size:.8rem;"><span>${stu.feeType?getFeeLabel(stu.feeType,stu.sibling):Number(stu.fee||0).toLocaleString()+'원'}</span><span class="bdg ${paid?'b-pay':'b-unpay'}">${paid?'납부완료':'미납'}</span></div></div>`:''}
    </div>
    <div class="rft"><span>${CFG.name||'솔브아트'} · ${CFG.phone||''}</span><span>${recs[0]?.teacher||'선생님'}</span></div></div>`;
}
function loadStuDetail(){
  const nm=gv('sel-stu');if(!nm){el('stu-detail').innerHTML='';return;}
  const recs=DB.filter(r=>r.studentName===nm).sort((a,b)=>a.date>b.date?1:-1);
  if(!recs.length){el('stu-detail').innerHTML='<div style="text-align:center;padding:2rem;color:var(--muted);">기록 없음</div>';return;}
  const bm={};recs.forEach(r=>{const m=r.date?.slice(0,7);if(!m)return;if(!bm[m])bm[m]=[];bm[m].push(r);});
  el('stu-detail').innerHTML=`<div class="card"><div class="ctitle">${nm} · 전체 ${recs.length}건</div>
    ${Object.entries(bm).sort().reverse().map(([m,mrs])=>{
      const p=mrs.filter(r=>r.attendance==='present').length,a=mrs.filter(r=>r.attendance==='absent').length;
      const t=p+a,rate=t?Math.round(p/t*100):0;
      return `<div style="margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem;">
          <strong style="font-size:.82rem;">${m.replace('-','년 ')}월</strong>
          <span class="bdg ${rate>=90?'bg':rate>=70?'bo':'br'}">${rate}%</span></div>
        <div class="crow" style="margin:0 0 .25rem;"><span class="clbl">출석률</span><div class="cbar-w"><div class="cbar" style="width:${rate}%"></div></div><span class="cval">${p}/${t}</span></div>
        ${mrs.filter(r=>r.workName).map(r=>`<div style="font-size:.68rem;color:var(--muted);padding:.1rem 0;">${r.date?.slice(5)||''} · ${r.workName} #${r.workNum||1} · ★${r.completion||'?'}</div>`).join('')}
      </div>`;
    }).join('')}</div>`;
}

// ════════════════════════════════════════════
//  관리자
// ════════════════════════════════════════════
function openAddTeacher(){
  sv('add-name','');sv('add-email','');sv('add-pw','');
  newPerms={input:true,view:true,report:false};updPM();el('modal-add').classList.add('show');
}
function updPM(){['input','view','report'].forEach(p=>{const b=el('pm-'+p);if(b)b.className='perm-btn'+(newPerms[p]?' on':'');});}
function tPerm(p){newPerms[p]=!newPerms[p];updPM();}
async function addTeacher(){
  const name=gv('add-name').trim(),email=gv('add-email').trim(),pw=gv('add-pw'),role=gv('add-role');
  if(!name||!email||!pw){toast('모든 항목을 입력하세요');return;}
  if(pw.length<6){toast('비밀번호는 6자 이상');return;}
  showOv('계정 생성 중…');
  try{
    if(FB_READY&&auth){
      const sec=firebase.initializeApp(FB_CFG,'sec_'+Date.now());const secAuth=sec.auth();
      const cred=await secAuth.createUserWithEmailAndPassword(email,pw);
      const uid=cred.user.uid;await secAuth.signOut();sec.delete();
      await db.collection('users').doc(uid).set({name,email,role,perms:{...newPerms},createdAt:new Date().toISOString(),createdBy:CU?.uid||''});
    }else{
      const users=JSON.parse(localStorage.getItem('sa_demo_users')||'[]');
      users.push({uid:'u'+Date.now(),name,email,pw,role,perms:{...newPerms}});
      localStorage.setItem('sa_demo_users',JSON.stringify(users));
    }
    toast(`✅ ${name} 선생님 등록 완료!`);closeM('modal-add');loadTeachers();
  }catch(e){const m={'auth/email-already-in-use':'이미 등록된 이메일','auth/weak-password':'비밀번호가 너무 간단해요'};toast(m[e.code]||'오류: '+e.message);}
  hideOv();
}
async function loadTeachers(){
  const wrap=el('teacher-list');wrap.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.78rem;">로딩 중...</div>';
  try{
    let list=[];
    if(FB_READY&&db){const snap=await db.collection('users').get();snap.forEach(doc=>list.push({uid:doc.id,...doc.data()}));}
    else{list=JSON.parse(localStorage.getItem('sa_demo_users')||'[]');
      if(!list.find(u=>u.uid==='admin'))list.unshift({uid:'admin',name:'관리자',email:'admin@solveart.com',role:'admin',perms:{input:true,view:true,report:true}});}
    if(!list.length){wrap.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.78rem;">등록된 선생님이 없어요</div>';return;}
    wrap.innerHTML=list.map(t=>{
      const isA=t.role==='admin',isSelf=t.uid===CU?.uid;
      const perms=t.perms||{};
      return `<div class="tcard-wrap" id="tcard-${t.uid}">
        <div class="tcard" style="border-radius:10px;margin-bottom:0;">
          <div class="tavatar ${isA?'admin':''}">${(t.name||'?')[0]}</div>
          <div class="tinfo">
            <h4>${t.name||'이름없음'} ${isSelf?'<span style="font-size:.62rem;color:var(--muted)">(나)</span>':''}</h4>
            <p>${t.email||''}</p>
            <p style="margin-top:.15rem;">
              <span class="bdg ${isA?'b-admin':'bb'}">${isA?'관리자':'선생님'}</span>
            </p>
          </div>
          <div class="tactions">
            ${!isSelf?`
            <button class="btn btn-gold btn-sm" onclick="togglePermPanel('${t.uid}','${t.name}',${JSON.stringify(t.perms||{}).replace(/"/g,"'")})">권한 ▼</button>
            <button class="btn btn-o btn-sm" onclick="openReset('${t.uid}','${t.name}','${t.email||''}')">초기화</button>
            <button class="btn btn-r btn-sm" onclick="delTeacher('${t.uid}','${t.name}')">삭제</button>
            `:'<span style="font-size:.7rem;color:var(--muted)">본인</span>'}
          </div>
        </div>
        <!-- 권한 패널 (숨김) -->
        <div class="perm-panel" id="ppanel-${t.uid}" style="display:none;border:2px solid var(--gold);border-top:none;border-radius:0 0 10px 10px;background:#fff;padding:.9rem;margin-bottom:.6rem;">
          <div style="font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:.7rem;display:flex;justify-content:space-between;align-items:center;">
            <span>🔑 ${t.name} 권한 설정</span>
            <div style="display:flex;gap:.4rem;">
              <button class="btn btn-o btn-sm" style="font-size:.68rem;" onclick="resetToDefaultPerms('${t.uid}')">기본값</button>
              <button class="btn btn-g btn-sm" style="font-size:.68rem;" onclick="saveInlinePerms('${t.uid}')">✅ 저장</button>
            </div>
          </div>
          <div id="perm-items-${t.uid}"></div>
        </div>
      </div>`;
    }).join('');
    // 각 카드에 현재 권한 렌더링
    list.forEach(t=>{
      if(t.role!=='admin'&&t.uid!==CU?.uid){
        renderPermItems(t.uid, t.perms||{});
      }
    });
  }catch(e){wrap.innerHTML=`<div style="color:var(--red);padding:1rem;font-size:.78rem;">오류: ${e.message}</div>`;}
}
let resetUid2='';
function openReset(uid,name,email){resetUid2=uid;resetEmail2=email;el('reset-title').textContent=`${name} 비밀번호 초기화`;el('modal-reset').classList.add('show');}
async function sendResetEmail(){
  showOv('메일 발송 중…');
  try{if(FB_READY&&auth){await auth.sendPasswordResetEmail(resetEmail2);toast(`✅ ${resetEmail2}로 재설정 메일 발송!`);}
  else toast('✅ 재설정 메일 발송 (데모)');closeM('modal-reset');}
  catch(e){toast('오류: '+e.message);}hideOv();
}
// // 구버전 권한 함수 완전 제거됨
async function delTeacher(uid,name){
  if(!confirm(`⚠️ "${name}" 계정을 삭제할까요?`))return;showOv('삭제 중…');
  try{if(FB_READY&&db)await db.collection('users').doc(uid).delete();
    else{const u=JSON.parse(localStorage.getItem('sa_demo_users')||'[]');localStorage.setItem('sa_demo_users',JSON.stringify(u.filter(x=>x.uid!==uid)));}
    toast(`✅ ${name} 삭제 완료`);loadTeachers();}
  catch(e){toast('오류: '+e.message);}hideOv();
}
function loadMonitor(){
  const date=gv('mon-date'),wrap=el('monitor-wrap');
  const recs=DB.filter(r=>r.date===date);const bySlot={};
  recs.forEach(r=>{const s=r.timeSlot||'미상';if(!bySlot[s])bySlot[s]=[];bySlot[s].push(r);});
  if(!Object.keys(bySlot).length){wrap.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.76rem;">해당 날짜 기록 없음</div>';return;}
  wrap.innerHTML=Object.entries(bySlot).map(([slot,rs])=>`
    <div class="mon-card"><div class="mon-hd"><h4>⏰ ${slot}</h4><span class="bdg bb">${rs.length}명</span></div>
      ${rs.map(r=>`<div class="mon-row">
        <span style="width:14px;text-align:center;">${r.attendance==='present'?'○':r.attendance==='absent'?'✕':'△'}</span>
        <span style="font-weight:600;min-width:48px;">${r.studentName||'?'}</span>
        <span style="color:var(--muted);flex:1;">${r.workName||'-'}${r.workNum?' #'+r.workNum:''}</span>
        <span style="color:var(--accent);font-weight:700;">${r.completion?'★'.repeat(r.completion):''}</span>
      </div>`).join('')}
    </div>`).join('');
  const m=today().slice(0,7),mR=DB.filter(r=>r.date?.startsWith(m)),tMap={};
  mR.forEach(r=>{const t=r.teacher||'미상';if(!tMap[t])tMap[t]=0;tMap[t]++;});
  el('teacher-activity').innerHTML=Object.entries(tMap).length
    ?Object.entries(tMap).map(([t,c])=>`<div class="crow"><span class="clbl">${t}</span><div class="cbar-w"><div class="cbar" style="width:${Math.min(100,c*4)}%"></div></div><span class="cval">${c}건</span></div>`).join('')
    :'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.76rem;">이달 기록 없음</div>';
}
function aTab(id,btn){
  document.querySelectorAll('#page-admin .tab').forEach(t=>t.classList.remove('on'));btn.classList.add('on');
  ['teachers','monitor','salary','ledger','config'].forEach(t=>{if(el('at-'+t))el('at-'+t).style.display='none';});el('at-'+id).style.display='block';
  if(id==='teachers')loadTeachers();
  if(id==='monitor'){sv('mon-date',today());loadMonitor();}
  if(id==='salary'){loadSalaryTeachers();}
  if(id==='finance'){initFinance();loadFinanceFromDB();}
  if(id==='ledger'){initLedger();}
  if(id==='config'){
    el('su-input').value=SU;
    el('cfg-nm').value=CFG.name||'솔브아트';
    el('cfg-ph').value=CFG.phone||'';
    // 알림 설정 로드
    if(el('notify-type')){
      el('notify-type').value=NOTIFY_CFG.type||'none';
      sv('notify-kakao-key',NOTIFY_CFG.kakaoKey||'');
      sv('notify-kakao-profile',NOTIFY_CFG.kakaoProfile||'');
      sv('notify-sms-key',NOTIFY_CFG.smsKey||'');
      sv('notify-sms-from',NOTIFY_CFG.smsFrom||'');
      toggleNotifySettings();
    }
    if(el('cfg-sender-email'))el('cfg-sender-email').value=CFG.senderEmail||'';
    if(el('fee-w1'))el('fee-w1').value=CFG.feeW1||110000;
    if(el('fee-w2'))el('fee-w2').value=CFG.feeW2||130000;
    if(el('fee-w3'))el('fee-w3').value=CFG.feeW3||150000;
    if(el('fee-hobby'))el('fee-hobby').value=CFG.feeHobby||160000;
    if(el('fee-sibling'))el('fee-sibling').value=CFG.feeSibling||5000;
  }
}

// ════════════════════════════════════════════
//  내 계정
// ════════════════════════════════════════════
function initMyPage(){
  if(!CP)return;const isA=CP.role==='admin',n=CP.name||'사용자';
  el('my-avatar').textContent=n[0];el('my-avatar').style.background=isA?'var(--blue)':'var(--sage)';
  el('my-name').textContent=n;el('my-email').textContent=CP.email||CU?.email||'';
  el('my-role-wrap').innerHTML=`<span class="rbdg ${isA?'r-admin':'r-teacher'}" style="font-size:.7rem;padding:.2rem .55rem;">${isA?'관리자':'선생님'}</span>`;
  const p=CP.perms||{};
  el('my-perms').innerHTML=`<div style="font-size:.72rem;font-weight:500;color:var(--muted);margin-bottom:.4rem;">내 권한</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
      <span class="bdg ${p.input?'bg':'br'}">${p.input?'📝 입력 가능':'📝 입력 불가'}</span>
      <span class="bdg ${p.view?'bb':'br'}">${p.view?'👁 열람 가능':'👁 열람 불가'}</span>
      <span class="bdg ${p.report?'bo':'br'}">${p.report?'📊 보고서 가능':'📊 보고서 불가'}</span>
    </div>`;
}
async function changePw(){
  const cur=gv('pw-cur'),nw=gv('pw-new'),nw2=gv('pw-new2');
  if(!cur||!nw||!nw2){toast('모든 항목 입력 필요');return;}
  if(nw!==nw2){toast('새 비밀번호가 일치하지 않아요');return;}
  if(nw.length<6){toast('새 비밀번호는 6자 이상');return;}
  showOv('비밀번호 변경 중…');
  try{if(FB_READY&&auth&&CU){
    const cred=firebase.auth.EmailAuthProvider.credential(CU.email,cur);
    await CU.reauthenticateWithCredential(cred);await CU.updatePassword(nw);
    toast('✅ 비밀번호 변경 완료');sv('pw-cur','');sv('pw-new','');sv('pw-new2','');
  }else toast('✅ 변경 완료 (데모)');}
  catch(e){const m={'auth/wrong-password':'현재 비밀번호 오류','auth/weak-password':'비밀번호가 너무 간단합니다'};toast(m[e.code]||e.message);}
  hideOv();
}

// ════════════════════════════════════════════
//  설정
// ════════════════════════════════════════════
function saveCfg(){
  CFG={
    name:gv('cfg-nm'),phone:gv('cfg-ph'),
    senderEmail:gv('cfg-sender-email'),
    feeW1:parseInt(el('fee-w1')?.value||110000),
    feeW2:parseInt(el('fee-w2')?.value||130000),
    feeW3:parseInt(el('fee-w3')?.value||150000),
    feeHobby:parseInt(el('fee-hobby')?.value||160000),
    feeSibling:parseInt(el('fee-sibling')?.value||5000),
  };
  localStorage.setItem('sa_cfg',JSON.stringify(CFG));
  // FEE_TABLE 동적 업데이트
  FEE_TABLE['1']=CFG.feeW1;FEE_TABLE['2']=CFG.feeW2;
  FEE_TABLE['3']=CFG.feeW3;FEE_TABLE['hobby']=CFG.feeHobby;
  if(FB_READY&&db){db.collection('config').doc('fees').set(CFG).catch(e=>{});}
  toast('✅ 설정 저장 완료');
}
function saveURL(){SU=el('su-input').value.trim();localStorage.setItem('sa_url',SU);toast('✅ URL 저장');}
async function testConn(){if(!SU){toast('⚠️ URL 미입력');return;}try{const r=await fetch(SU);const d=await r.json();toast(d.status==='ok'?'✅ 연결 성공!':'⚠️ 응답 이상');}catch{toast('❌ 연결 실패');}}

// ════════════════════════════════════════════
//  공통 뒤로가기 / 닫기 네비게이션
// ════════════════════════════════════════════
let SA_CURRENT_PAGE = 'home';
let SA_PREV_PAGE = '';
let SA_NAV_READY = false;

function getActivePageId(){
  const active = document.querySelector('.page.on');
  return active ? active.id.replace('page-','') : SA_CURRENT_PAGE || 'home';
}

function ensurePageTopNav(){
  document.querySelectorAll('.page').forEach(page=>{
    if(page.querySelector(':scope > .page-top-nav')) return;
    const bar = document.createElement('div');
    bar.className = 'page-top-nav no-print';
    bar.innerHTML = '<button type="button" class="page-back-btn" onclick="goBackPage()">← 뒤로</button><button type="button" class="page-home-btn" onclick="goHomePage()">🏠 홈</button>';
    page.insertBefore(bar, page.firstChild);
  });
}

function syncPageTopNav(id){
  ensurePageTopNav();
  document.querySelectorAll('.page-top-nav').forEach(bar=>{
    const page = bar.closest('.page');
    const pid = page ? page.id.replace('page-','') : '';
    bar.style.display = (pid && pid !== 'home') ? 'flex' : 'none';
  });
}

function goBackPage(){
  const current = getActivePageId();
  if(SA_PREV_PAGE && SA_PREV_PAGE !== current){
    nav(SA_PREV_PAGE, false);
    return;
  }
  if(window.history && window.history.length > 1){
    window.history.back();
  }else{
    nav('home', false);
  }
}

function goHomePage(){
  nav('home', false);
}

function closePrintPage(){
  try{ window.close(); }
  catch(e){ history.back(); }
}

window.addEventListener('popstate', function(e){
  const page = e.state && e.state.saPage ? e.state.saPage : 'home';
  nav(page, false);
});

// ════════════════════════════════════════════
//  NAV
// ════════════════════════════════════════════
function nav(id, pushStateFlag=true){
  if(!CP)return;
  if(id==='scan'&&!hasPerm('scan_upload')){toast('⚠️ 스캔 권한이 없어요');return;}
  if(id==='lesson'&&!hasPerm('scan_save')){toast('⚠️ 수업 입력 권한이 없어요');return;}
  if(id==='report'&&!hasPerm('rpt_view')){toast('⚠️ 보고서 열람 권한이 없어요');return;}
  if(id==='hist'&&!hasPerm('hist_view')){toast('⚠️ 기록 열람 권한이 없어요');return;}
  if(id==='students'&&!hasPerm('stu_view')){toast('⚠️ 원생 관리 열람 권한이 없어요');return;}
  if(id==='admin'&&CP.role!=='admin'){toast('⚠️ 관리자 전용');return;}

  const beforePage = getActivePageId();
  if(beforePage && beforePage !== id) SA_PREV_PAGE = beforePage;
  SA_CURRENT_PAGE = id;
  if(pushStateFlag && window.history){
    const state = { saPage:id };
    if(!SA_NAV_READY){
      window.history.replaceState({saPage:beforePage || 'home'}, '', window.location.href);
      SA_NAV_READY = true;
    }
    window.history.pushState(state, '', window.location.href);
  }

  // 페이지 전환
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  el('page-'+id)?.classList.add('on');

  // 바텀네비 활성화
  document.querySelectorAll('.nitem').forEach(n=>n.classList.remove('on'));
  const isA=CP.role==='admin';
  const navScope = isA ? el('bnav-a') : el('bnav-t');
  const mobileMap=isA
    ? {home:0,scan:1,students:2,ai:3,report:4,admin:5}
    : {home:0,lesson:1,students:2,ai:3,hist:4,mypage:5};
  if(navScope && mobileMap[id]!==undefined)navScope.querySelectorAll('.nitem')[mobileMap[id]]?.classList.add('on');

  // 사이드바 활성화
  document.querySelectorAll('#sidebar .sn-item').forEach(n=>n.classList.remove('on'));
  const snMap={home:0,scan:1,students:2,hist:3,report:isA?4:4,admin:isA?5:99,mypage:isA?6:4};
  const snItems=document.querySelectorAll('#sidebar .sn-item');
  snItems.forEach(n=>{
    const onclick=n.getAttribute('onclick')||'';
    if(onclick.includes("'"+id+"'"))n.classList.add('on');
  });

  // 페이지별 초기화
  if(id==='home')renderHome();
  if(id==='report')initReport();
  if(id==='hist')renderHist();
  if(id==='students'){renderStudents();updStuSelects();}
  if(id==='admin')loadTeachers();
  if(id==='mypage')initMyPage();
  if(id==='ai'){
    const cont = el('ai-page-content');
    if(cont && typeof renderAIPage === 'function'){
      cont.innerHTML = renderAIPage();
      if(typeof aiTab === 'function') aiTab('chat');
    }
  }
  if(id==='result'){}
  syncPageTopNav(id);
  window.scrollTo({top:0, behavior:'smooth'});
}


// ════════════════════════════════════════════
//  대시보드 상세 팝업
// ════════════════════════════════════════════
function openStatDetail(type){
  const modal=el('modal-stat-detail');
  const title=el('stat-detail-title');
  const body=el('stat-detail-body');
  const m=today().slice(0,7);
  const mR=DB.filter(r=>r.date?.startsWith(m));
  const yr=new Date().getFullYear(),cm=new Date().getMonth()+1;

  if(type==='students'){
    title.textContent='👥 원생 현황';
    const active=STUS.filter(s=>!s.status||s.status==='active');
    const pause=STUS.filter(s=>s.status==='pause');
    const out=STUS.filter(s=>s.status==='out');
    body.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:1rem;">
        <div style="text-align:center;background:#E8F5E9;border-radius:10px;padding:.8rem;border:2px solid #A5D6A7;">
          <div style="font-size:1.6rem;font-weight:900;color:#2E7D32;">${active.length}</div>
          <div style="font-size:.72rem;font-weight:700;color:#2E7D32;">수강중</div>
        </div>
        <div style="text-align:center;background:#FFF8E1;border-radius:10px;padding:.8rem;border:2px solid #FFE082;">
          <div style="font-size:1.6rem;font-weight:900;color:#F57F17;">${pause.length}</div>
          <div style="font-size:.72rem;font-weight:700;color:#F57F17;">휴강중</div>
        </div>
        <div style="text-align:center;background:#FFEBEE;border-radius:10px;padding:.8rem;border:2px solid #EF9A9A;">
          <div style="font-size:1.6rem;font-weight:900;color:#C62828;">${out.length}</div>
          <div style="font-size:.72rem;font-weight:700;color:#C62828;">퇴원</div>
        </div>
      </div>
      <div style="font-size:.75rem;font-weight:800;color:var(--muted);margin-bottom:.5rem;border-bottom:1px solid var(--gold-light);padding-bottom:.4rem;">수강중 원생 목록</div>
      ${active.length?active.map(s=>`<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px dotted var(--gold-light);">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.85rem;">${(s.name||'?')[0]}</div>
        <div style="flex:1;">
          <div style="font-size:.82rem;font-weight:700;">${s.name}</div>
          <div style="font-size:.68rem;color:var(--muted);">${[s.grade,s.school].filter(Boolean).join(' · ')||'정보없음'}</div>
        </div>
        <div style="font-size:.7rem;color:var(--blue);font-weight:700;">${s.feeType?getFeeLabel(s.feeType,s.sibling):''}</div>
      </div>`).join(''):'<div style="text-align:center;padding:1rem;color:var(--muted);">원생 없음</div>'}
      <div style="margin-top:.8rem;text-align:right;">
        <button class="btn btn-gold btn-sm" onclick="closeM('modal-stat-detail');nav('students');">원생 관리 →</button>
      </div>`;
  }

  else if(type==='today-att'){
    title.textContent='✅ 오늘 출석 현황';
    const todayRecs=DB.filter(r=>r.date===today());
    const slots=['1~2시','2~3시','3~4시','4~5시','5~6시'];
    const pr=todayRecs.filter(r=>r.attendance==='present').length;
    const ab=todayRecs.filter(r=>r.attendance==='absent').length;
    const lt=todayRecs.filter(r=>r.attendance==='late').length;
    body.innerHTML=`
      <div style="display:flex;gap:.5rem;margin-bottom:1rem;">
        <div style="flex:1;text-align:center;background:#E8F5E9;border-radius:10px;padding:.7rem;border:2px solid #A5D6A7;">
          <div style="font-size:1.5rem;font-weight:900;color:#2E7D32;">${pr}</div>
          <div style="font-size:.7rem;font-weight:700;color:#2E7D32;">출석</div>
        </div>
        <div style="flex:1;text-align:center;background:#FFEBEE;border-radius:10px;padding:.7rem;border:2px solid #EF9A9A;">
          <div style="font-size:1.5rem;font-weight:900;color:#C62828;">${ab}</div>
          <div style="font-size:.7rem;font-weight:700;color:#C62828;">결석</div>
        </div>
        <div style="flex:1;text-align:center;background:#FFF8E1;border-radius:10px;padding:.7rem;border:2px solid #FFE082;">
          <div style="font-size:1.5rem;font-weight:900;color:#F57F17;">${lt}</div>
          <div style="font-size:.7rem;font-weight:700;color:#F57F17;">지각</div>
        </div>
      </div>
      ${todayRecs.length?slots.map(sl=>{
        const rs=todayRecs.filter(r=>r.timeSlot===sl);
        if(!rs.length)return '';
        return `<div style="margin-bottom:.7rem;">
          <div style="font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:.3rem;background:var(--gold-pale);padding:.3rem .6rem;border-radius:6px;">⏰ ${sl}</div>
          ${rs.map(r=>`<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem .4rem;border-bottom:1px dotted var(--gold-light);font-size:.78rem;">
            <span style="font-size:1rem;">${r.attendance==='present'?'○':r.attendance==='absent'?'✕':'△'}</span>
            <span style="font-weight:700;min-width:50px;">${r.studentName||'?'}</span>
            <span style="color:var(--muted);flex:1;">${r.workName||'-'}${r.workNum?' #'+r.workNum:''}</span>
            <span style="color:var(--gold);">${'★'.repeat(r.completion||0)||''}</span>
          </div>`).join('')}
        </div>`;
      }).join(''):'<div style="text-align:center;padding:2rem;color:var(--muted);">오늘 수업 기록 없음</div>'}`;
  }

  else if(type==='month-att'){
    title.textContent='📊 이달 출석 현황';
    const smap={};
    mR.forEach(r=>{
      if(!r.studentName)return;
      if(!smap[r.studentName])smap[r.studentName]={p:0,a:0,l:0};
      if(r.attendance==='present')smap[r.studentName].p++;
      else if(r.attendance==='absent')smap[r.studentName].a++;
      else smap[r.studentName].l++;
    });
    const entries=Object.entries(smap).sort((a,b)=>{
      const ra=a[1].p/(a[1].p+a[1].a+a[1].l||1);
      const rb=b[1].p/(b[1].p+b[1].a+b[1].l||1);
      return rb-ra;
    });
    body.innerHTML=entries.length?`
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:.7rem;">${m.replace('-','년 ')}월 기준</div>
      ${entries.map(([nm,d])=>{
        const tot=d.p+d.a+d.l,rate=tot?Math.round(d.p/tot*100):0;
        const color=rate>=90?'#2E7D32':rate>=70?'#E65100':'#C62828';
        return `<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px dotted var(--gold-light);">
          <span style="font-weight:700;min-width:55px;font-size:.82rem;">${nm}</span>
          <div style="flex:1;background:var(--gold-pale);border-radius:4px;height:12px;overflow:hidden;border:1px solid var(--gold-light);">
            <div style="height:100%;background:${color};width:${rate}%;border-radius:4px;transition:width .6s;"></div>
          </div>
          <span style="font-size:.72rem;font-weight:800;color:${color};min-width:35px;">${rate}%</span>
          <span style="font-size:.68rem;color:var(--muted);">출${d.p}/결${d.a}</span>
        </div>`;
      }).join('')}`
    :'<div style="text-align:center;padding:2rem;color:var(--muted);">이달 기록 없음</div>';
  }

  else if(type==='unpay'){
    title.textContent='💰 수강료 납부 현황';
    const activeStus=STUS.filter(s=>!s.status||s.status==='active');
    const paidList=activeStus.filter(s=>JSON.parse(localStorage.getItem(`pay_${s.id}_${yr}`)||'{}')[cm]);
    const unpaidList=activeStus.filter(s=>!JSON.parse(localStorage.getItem(`pay_${s.id}_${yr}`)||'{}')[cm]);
    body.innerHTML=`
      <div style="display:flex;gap:.5rem;margin-bottom:1rem;">
        <div style="flex:1;text-align:center;background:#E8F5E9;border-radius:10px;padding:.7rem;border:2px solid #A5D6A7;">
          <div style="font-size:1.5rem;font-weight:900;color:#2E7D32;">${paidList.length}</div>
          <div style="font-size:.7rem;font-weight:700;color:#2E7D32;">납부완료</div>
        </div>
        <div style="flex:1;text-align:center;background:#FFEBEE;border-radius:10px;padding:.7rem;border:2px solid #EF9A9A;">
          <div style="font-size:1.5rem;font-weight:900;color:#C62828;">${unpaidList.length}</div>
          <div style="font-size:.7rem;font-weight:700;color:#C62828;">미납</div>
        </div>
      </div>
      ${unpaidList.length?`<div style="font-size:.75rem;font-weight:800;color:var(--accent);margin-bottom:.5rem;padding:.3rem .6rem;background:#FFEBEE;border-radius:6px;">⚠️ 미납 원생</div>
      ${unpaidList.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px dotted var(--gold-light);">
        <div>
          <span style="font-weight:700;font-size:.82rem;">${s.name}</span>
          <span style="font-size:.68rem;color:var(--muted);margin-left:.4rem;">${s.grade||''}</span>
        </div>
        <div style="text-align:right;">
          <div style="font-size:.76rem;font-weight:700;color:var(--blue);">${s.feeType?getFeeLabel(s.feeType,s.sibling):Number(s.fee||0).toLocaleString()+'원'}</div>
          <div style="font-size:.65rem;color:var(--accent);">미납</div>
        </div>
      </div>`).join('')}`:''}
      ${paidList.length?`<div style="font-size:.75rem;font-weight:800;color:var(--sage);margin:.7rem 0 .5rem;padding:.3rem .6rem;background:#E8F5E9;border-radius:6px;">✅ 납부 완료</div>
      ${paidList.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px dotted var(--gold-light);">
        <div>
          <span style="font-weight:700;font-size:.82rem;">${s.name}</span>
          <span style="font-size:.68rem;color:var(--muted);margin-left:.4rem;">${s.grade||''}</span>
        </div>
        <div style="font-size:.76rem;font-weight:700;color:var(--sage);">✓ 납부</div>
      </div>`).join('')}`:''}
      <div style="margin-top:.8rem;text-align:right;">
        <button class="btn btn-gold btn-sm" onclick="closeM('modal-stat-detail');nav('students');setTimeout(()=>stuTab('pay',document.querySelectorAll('#page-students .tab')[2]),100);">수강료 관리 →</button>
      </div>`;
  }

  else if(type==='completion'){
    title.textContent='🎨 완성도 분포 상세';
    const now2=new Date(),dow=now2.getDay(),mon=new Date(now2);
    mon.setDate(now2.getDate()-(dow===0?6:dow-1));
    const wRecs=DB.filter(r=>r.date&&new Date(r.date)>=mon&&r.completion>0);
    const compCnt=[0,0,0,0,0];
    wRecs.forEach(r=>{if(r.completion>=1&&r.completion<=5)compCnt[r.completion-1]++;});
    const total=compCnt.reduce((a,b)=>a+b,0);
    const compColors=['#FFB300','#FFC800','#4CAF50','#2196F3','#9C27B0'];
    const compLabels=['① 시작','② 밑색','③ 명암','④ 마무리','⑤ 완성'];
    const stuComp={};
    wRecs.filter(r=>r.completion===5).forEach(r=>{
      if(!stuComp[r.studentName])stuComp[r.studentName]=[];
      stuComp[r.studentName].push(r.workName||'작품');
    });
    body.innerHTML=`
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:.8rem;">이번 주 총 ${total}건</div>
      ${total?compCnt.map((c,i)=>{
        const pct=total?Math.round(c/total*100):0;
        return `<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;">
          <span style="font-size:.76rem;font-weight:700;min-width:55px;">${compLabels[i]}</span>
          <div style="flex:1;background:var(--gold-pale);border-radius:5px;height:14px;overflow:hidden;border:1px solid var(--gold-light);">
            <div style="height:100%;background:${compColors[i]};width:${pct}%;border-radius:5px;"></div>
          </div>
          <span style="font-size:.72rem;font-weight:800;min-width:45px;text-align:right;">${c}건 ${pct}%</span>
        </div>`;
      }).join(''):'<div style="text-align:center;padding:1.5rem;color:var(--muted);">이번 주 기록 없음</div>'}
      ${Object.keys(stuComp).length?`<div style="margin-top:1rem;font-size:.75rem;font-weight:800;color:#7B1FA2;padding:.3rem .6rem;background:#F3E5F5;border-radius:6px;margin-bottom:.5rem;">⭐ 이번 주 완성 작품</div>
      ${Object.entries(stuComp).map(([nm,works])=>`<div style="display:flex;gap:.5rem;padding:.35rem 0;border-bottom:1px dotted var(--gold-light);font-size:.78rem;">
        <span style="font-weight:700;min-width:55px;">${nm}</span>
        <span style="color:var(--muted);">${works.join(', ')}</span>
      </div>`).join('')}`:''}`;
  }

  else if(type==='recent'){
    title.textContent='📷 스캔 기록 상세';
    const dates=[...new Set(DB.map(r=>r.date).filter(Boolean))].sort().reverse().slice(0,10);
    body.innerHTML=dates.length?dates.map(d=>{
      const rs=DB.filter(r=>r.date===d);
      const pr=rs.filter(r=>r.attendance==='present').length;
      const ab=rs.filter(r=>r.attendance==='absent').length;
      const rate=rs.length?Math.round(pr/rs.length*100):0;
      return `<div style="background:var(--gold-pale);border-radius:10px;padding:.7rem .9rem;margin-bottom:.6rem;border:1.5px solid var(--gold-light);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
          <strong style="font-size:.84rem;">📋 ${d}</strong>
          <span style="font-size:.72rem;font-weight:800;color:${rate>=90?'#2E7D32':rate>=70?'#E65100':'#C62828'};">${rate}%</span>
        </div>
        <div style="display:flex;gap:.5rem;font-size:.72rem;">
          <span style="color:var(--sage);font-weight:700;">출석 ${pr}명</span>
          <span style="color:var(--accent);font-weight:700;">결석 ${ab}명</span>
          <span style="color:var(--muted);">총 ${rs.length}명</span>
        </div>
        <div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:.25rem;">
          ${rs.filter(r=>r.attendance==='absent').map(r=>`<span style="font-size:.65rem;background:#FFEBEE;color:#C62828;padding:.1rem .4rem;border-radius:10px;font-weight:700;">✕${r.studentName}</span>`).join('')}
        </div>
      </div>`;
    }).join(''):'<div style="text-align:center;padding:2rem;color:var(--muted);">스캔 기록이 없어요</div>';
  }

  else if(type==='month-stu'){
    title.textContent='👥 이달 원생 현황 상세';
    const smap2={};
    mR.forEach(r=>{
      if(!r.studentName)return;
      if(!smap2[r.studentName])smap2[r.studentName]={p:0,a:0,c:[],works:[]};
      r.attendance==='present'?smap2[r.studentName].p++:smap2[r.studentName].a++;
      if(r.completion)smap2[r.studentName].c.push(r.completion);
      if(r.workName&&!smap2[r.studentName].works.includes(r.workName))smap2[r.studentName].works.push(r.workName);
    });
    body.innerHTML=Object.entries(smap2).length?Object.entries(smap2).map(([nm,d])=>{
      const tot=d.p+d.a,rate=tot?Math.round(d.p/tot*100):0;
      const avgC=d.c.length?(d.c.reduce((a,b)=>a+b)/d.c.length).toFixed(1):'-';
      const color=rate>=90?'#2E7D32':rate>=70?'#E65100':'#C62828';
      const stu=STUS.find(s=>s.name===nm);
      const paid=stu?JSON.parse(localStorage.getItem(`pay_${stu.id}_${yr}`)||'{}')[cm]:null;
      return `<div style="background:#fff;border:2px solid var(--gold-light);border-radius:10px;padding:.75rem .9rem;margin-bottom:.6rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
          <div style="display:flex;align-items:center;gap:.5rem;">
            <div style="width:30px;height:30px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;">${nm[0]}</div>
            <div>
              <div style="font-size:.84rem;font-weight:800;">${nm}</div>
              <div style="font-size:.67rem;color:var(--muted);">${stu?[stu.grade,stu.school].filter(Boolean).join(' · '):'정보없음'}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:.68rem;font-weight:800;background:${paid?'#E8F5E9':'#FFEBEE'};color:${paid?'#2E7D32':'#C62828'};padding:.15rem .5rem;border-radius:10px;">${paid?'✓납부':'✕미납'}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem;">
          <div style="flex:1;background:var(--gold-pale);border-radius:4px;height:10px;overflow:hidden;border:1px solid var(--gold-light);">
            <div style="height:100%;background:${color};width:${rate}%;border-radius:4px;"></div>
          </div>
          <span style="font-size:.72rem;font-weight:800;color:${color};min-width:35px;">${rate}%</span>
        </div>
        <div style="display:flex;gap:.6rem;font-size:.68rem;color:var(--muted);">
          <span>출석 <strong style="color:var(--sage);">${d.p}</strong></span>
          <span>결석 <strong style="color:var(--accent);">${d.a}</strong></span>
          <span>완성도 <strong>${avgC}</strong></span>
          ${d.works.length?`<span>진행작품: <strong>${d.works.join(', ')}</strong></span>`:''}
        </div>
      </div>`;
    }).join(''):'<div style="text-align:center;padding:2rem;color:var(--muted);">이달 기록 없음</div>';
  }

  modal.classList.add('show');
}




// ════════════════════════════════════════════
//  급여대장 & 명세서 발송
// ════════════════════════════════════════════

function initLedger(){
  // 연도 셀렉트 초기화
  const yrSel=el('ledger-year');
  if(yrSel&&!yrSel.options.length){
    const now=new Date().getFullYear();
    for(let y=now-2;y<=now+1;y++)
      yrSel.innerHTML+=`<option value="${y}" ${y===now?'selected':''}>${y}년</option>`;
  }
  // 급여지급일 로드
  const payDay=CFG.payDay||25;
  if(el('pay-day'))el('pay-day').value=payDay;
  updateNextPayday();
  // 현재 월 선택
  if(el('ledger-month'))el('ledger-month').value=new Date().getMonth()+1;
  renderLedger();
}

function savePayDay(){
  const d=parseInt(el('pay-day')?.value||25);
  CFG.payDay=d;
  localStorage.setItem('sa_cfg',JSON.stringify(CFG));
  if(FB_READY&&db)db.collection('config').doc('fees').set(CFG).catch(e=>{});
  updateNextPayday();
  toast('✅ 급여지급일 저장: 매월 '+d+'일');
}

function updateNextPayday(){
  const d=CFG.payDay||25;
  const now=new Date();
  let next=new Date(now.getFullYear(),now.getMonth(),d);
  if(next<=now)next=new Date(now.getFullYear(),now.getMonth()+1,d);
  const span=el('next-payday');
  if(span)span.textContent='다음 지급일: '+next.toLocaleDateString('ko-KR');
}

async function renderLedger(){
  const yr=gv('ledger-year')||new Date().getFullYear();
  const mo=parseInt(gv('ledger-month')||0);
  const tbody=el('ledger-tbody');
  if(!tbody)return;

  // 모든 급여 기록 수집
  const records=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith('salary_rec_')){
      const r=JSON.parse(localStorage.getItem(k)||'{}');
      if(r.year==yr&&(mo===0||r.month==mo))records.push(r);
    }
  }

  // Firestore에서도 로드
  if(FB_READY&&db){
    try{
      const snap=await db.collection('salaries').get();
      snap.forEach(doc=>{
        const r=doc.data();
        if(r.year==yr&&(mo===0||r.month==mo)){
          if(!records.find(x=>x.uid===r.uid&&x.month===r.month))records.push(r);
        }
      });
    }catch(e){}
  }

  if(!records.length){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--muted);">급여 기록이 없어요</td></tr>';
    el('ledger-total').style.display='none';
    return;
  }

  // 선생님 이름 맵
  const userMap={};
  if(FB_READY&&db){
    try{
      const snap=await db.collection('users').get();
      snap.forEach(d=>userMap[d.id]=d.data().name||d.data().email);
    }catch(e){}
  }

  let totalNet=0;
  tbody.innerHTML=records.sort((a,b)=>a.month-b.month).map(r=>{
    const hourly=parseFloat(r.hourly||0);
    const hours=parseFloat(r.hours||0);
    const days=parseFloat(r.days||0);
    const extraDays=parseFloat(r.extraDays||0);
    const extraHours=parseFloat(r.extraHours||0);
    const bonus=parseFloat(r.bonus||0);
    const annual=parseFloat(r.annual||0);
    const leave=parseFloat(r.leave||0);
    const absent=parseFloat(r.absent||0);

    const actualDays=days-leave-absent;
    const base=Math.round(hourly*hours*actualDays);
    const extra=Math.round(hourly*1.5*extraHours*extraDays);
    const annualPay=Math.round(hourly*hours*annual);
    const gross=base+extra+bonus+annualPay;
    // 4대보험 근로자 부담 (간략 계산: 약 9.4%)
    const insEE=Math.round(gross*0.094);
    const net=gross-insEE;
    totalNet+=net;

    const name=userMap[r.uid]||r.uid;
    const paid=JSON.parse(localStorage.getItem('ledger_paid_'+r.uid+'_'+r.year+'_'+r.month)||'false');

    return `<tr>
      <td style="font-weight:700;">${name}</td>
      <td>${r.year}년 ${r.month}월</td>
      <td style="text-align:right;">${base.toLocaleString()}원</td>
      <td style="text-align:right;color:var(--sage);">+${(extra+bonus+annualPay).toLocaleString()}원</td>
      <td style="text-align:right;color:var(--accent);">-${insEE.toLocaleString()}원</td>
      <td style="text-align:right;font-weight:800;color:var(--blue);">${net.toLocaleString()}원</td>
      <td style="text-align:center;">
        <button class="btn btn-sm ${paid?'btn-g':'btn-o'}" style="font-size:.65rem;padding:.2rem .5rem;"
          onclick="togglePaidStatus('${r.uid}','${r.year}','${r.month}',this)">
          ${paid?'✅지급':'미지급'}
        </button>
      </td>
      <td style="text-align:center;">
        <button class="btn btn-o btn-sm" style="font-size:.62rem;padding:.2rem .4rem;"
          onclick="sendPayslip('${r.uid}','${name}','${r.year}','${r.month}',${net},${gross},${base},${extra+bonus+annualPay},${insEE})">
          📧 발송
        </button>
      </td>
    </tr>`;
  }).join('');

  el('ledger-total').style.display='block';
  el('ledger-total-amt').textContent=totalNet.toLocaleString()+'원';
}

function togglePaidStatus(uid,year,month,btn){
  const key='ledger_paid_'+uid+'_'+year+'_'+month;
  const current=JSON.parse(localStorage.getItem(key)||'false');
  localStorage.setItem(key,JSON.stringify(!current));
  btn.className=`btn btn-sm ${!current?'btn-g':'btn-o'}`;
  btn.style.fontSize='.65rem';btn.style.padding='.2rem .5rem';
  btn.textContent=!current?'✅지급':'미지급';
  toast(!current?'✅ 지급 완료 처리':'↩ 미지급으로 변경');
}

function buildPayslipHTML(name, year, month, net, gross, base, allowance, insEE){
  const payDay=CFG.payDay||25;
  const academy=CFG.name||'솔브아트';
  const phone=CFG.phone||'';
  const insER=Math.round(gross*0.115);
  // 2024년 기준 요율 (매년 업데이트 필요)
  const rates={
    pension:{ee:4.5,er:4.5},health:{ee:3.545,er:3.545},
    care:{ee:0.4591,er:0.4591},employ:{ee:0.9,er:1.15},indus:{ee:0,er:0.6}
  };
  const calcIns=(g,r)=>Math.round(g*r/100);

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<style>
  body{font-family:'Noto Sans KR',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;}
  h2{text-align:center;color:#1a1a1a;margin-bottom:4px;}
  .sub{text-align:center;color:#888;font-size:12px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;}
  th{background:#1a1a1a;color:#FFC800;padding:8px;text-align:left;font-size:12px;}
  td{padding:7px 8px;border-bottom:1px solid #f0e8d0;font-size:13px;}
  .total{background:#FFC800;font-weight:900;font-size:1.1rem;}
  .footer{text-align:center;font-size:11px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:12px;}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;}
</style></head><body>
<h2>💵 급여명세서</h2>
<div class="sub">${year}년 ${month}월 | 지급일: ${year}년 ${month}월 ${payDay}일 | ${academy}</div>
<table>
  <tr><th colspan="2">수신인</th></tr>
  <tr><td>성명</td><td><strong>${name}</strong></td></tr>
</table>
<table>
  <tr><th colspan="2">지급 내역</th></tr>
  <tr><td>기본급</td><td style="text-align:right;">${base.toLocaleString()}원</td></tr>
  <tr><td>제수당 (초과근무·상여·연차)</td><td style="text-align:right;">${allowance.toLocaleString()}원</td></tr>
  <tr style="font-weight:700;background:#fff8e1;"><td>총 지급액</td><td style="text-align:right;">${gross.toLocaleString()}원</td></tr>
</table>
<table>
  <tr><th>공제 항목</th><th style="text-align:center;">근로자 부담</th><th style="text-align:center;">사용자 부담</th></tr>
  <tr><td>국민연금 (${rates.pension.ee}%/${rates.pension.er}%)</td>
    <td style="text-align:right;">${calcIns(gross,rates.pension.ee).toLocaleString()}원</td>
    <td style="text-align:right;">${calcIns(gross,rates.pension.er).toLocaleString()}원</td></tr>
  <tr><td>건강보험 (${rates.health.ee}%/${rates.health.er}%)</td>
    <td style="text-align:right;">${calcIns(gross,rates.health.ee).toLocaleString()}원</td>
    <td style="text-align:right;">${calcIns(gross,rates.health.er).toLocaleString()}원</td></tr>
  <tr><td>장기요양보험</td>
    <td style="text-align:right;">${calcIns(gross,rates.care.ee).toLocaleString()}원</td>
    <td style="text-align:right;">${calcIns(gross,rates.care.er).toLocaleString()}원</td></tr>
  <tr><td>고용보험 (${rates.employ.ee}%/${rates.employ.er}%)</td>
    <td style="text-align:right;">${calcIns(gross,rates.employ.ee).toLocaleString()}원</td>
    <td style="text-align:right;">${calcIns(gross,rates.employ.er).toLocaleString()}원</td></tr>
  <tr><td>산재보험</td>
    <td style="text-align:right;">-</td>
    <td style="text-align:right;">${calcIns(gross,rates.indus.er).toLocaleString()}원</td></tr>
  <tr style="background:#ffebee;font-weight:700;"><td>공제 합계</td>
    <td style="text-align:right;color:#c62828;">${insEE.toLocaleString()}원</td>
    <td style="text-align:right;color:#1565c0;">${insER.toLocaleString()}원</td></tr>
</table>
<table>
  <tr class="total"><td>💰 실수령액</td><td style="text-align:right;font-size:1.2rem;">${net.toLocaleString()}원</td></tr>
</table>
<div class="footer">
  ${academy} · ${phone}<br>
  본 명세서는 근로기준법 제48조에 의거하여 발급됩니다.
</div>
</body></html>`;
}

function sendPayslip(uid, name, year, month, net, gross, base, allowance, insEE){
  const html2=buildPayslipHTML(name,year,month,net,gross,base,allowance,insEE);
  // 새 창에서 미리보기 + 이메일 안내
  const win=window.open('','_blank');
  win.document.write(html2);
  win.document.close();
  // 이메일 발송 안내
  setTimeout(()=>{
    const senderEmail=CFG.senderEmail||'';
    if(!senderEmail){
      toast('⚠️ 설정에서 발송자 이메일을 먼저 등록하세요');
      return;
    }
    // EmailJS 또는 mailto 방식
    const subject=encodeURIComponent(`[${CFG.name||'솔브아트'}] ${year}년 ${month}월 급여명세서`);
    const body=encodeURIComponent(`${name} 선생님께

${year}년 ${month}월 급여명세서를 첨부합니다.
실수령액: ${net.toLocaleString()}원

${CFG.name||'솔브아트'} 드림`);
    window.location.href=`mailto:?subject=${subject}&body=${body}`;
  },500);
}

function sendAllPayslips(type){
  if(type==='email'){
    toast('📧 각 선생님 급여명세서를 개별 발송하세요 (발송 버튼 클릭)');
  } else {
    // 카카오톡 공유 - 카카오 SDK 필요
    toast('💬 카카오톡 공유: 각 명세서를 캡처 후 공유하세요');
  }
}




// ════════════════════════════════════════════
//  1. 수강료 자동 청구 알림
// ════════════════════════════════════════════
let AUTO_FEE_CFG = JSON.parse(localStorage.getItem('sa_auto_fee')||'{}');

function saveAutoFeeSettings(){
  AUTO_FEE_CFG = {
    day: parseInt(gv('auto-fee-day')||0),
    remind: parseInt(gv('auto-fee-remind')||0),
    msg: gv('auto-fee-msg')||'[{학원명}] {원생명} 학생의 {월}월 수강료({금액}원) 납부 부탁드립니다.'
  };
  localStorage.setItem('sa_auto_fee', JSON.stringify(AUTO_FEE_CFG));
  if(FB_READY&&db){ db.collection('config').doc('auto_fee').set(AUTO_FEE_CFG).catch(e=>{}); }
  toast('✅ 수강료 자동 청구 설정 저장!');
}

function buildFeeMsg(stu, month){
  const fee = stu.feeType ? getFeeLabel(stu.feeType, stu.sibling) : (Number(stu.fee||0).toLocaleString()+'원');
  return AUTO_FEE_CFG.msg
    ? AUTO_FEE_CFG.msg
        .replace('{학원명}', CFG.name||'솔브아트')
        .replace('{원생명}', stu.name)
        .replace('{월}', month)
        .replace('{금액}', fee)
    : '['+( CFG.name||'솔브아트')+'] '+stu.name+' 학생의 '+month+'월 수강료('+fee+') 납부 부탁드립니다.';
}

function sendFeeAlertNow(){
  const yr=new Date().getFullYear(), cm=new Date().getMonth()+1;
  const activeStus=STUS.filter(s=>!s.status||s.status==='active');
  const unpaid=activeStus.filter(s=>{
    const p=JSON.parse(localStorage.getItem('pay_'+s.id+'_'+yr)||'{}');
    return !p[cm];
  });
  if(!unpaid.length){toast('✅ 미납 원생이 없어요!');return;}
  if(!NOTIFY_CFG.type||NOTIFY_CFG.type==='none'){
    const msgs=unpaid.slice(0,3).map(s=>buildFeeMsg(s,cm));
    const preview=msgs[0]||'';
    const confirmMsg='알림 설정이 없어요. 미납: '+unpaid.length+'명\n예시: '+preview+'\n\n설정 후 실제 발송 가능해요.';
    if(confirm(confirmMsg)){
      toast('📲 관리자 > 설정에서 알림을 설정하세요');
    }
    return;
  }
  if(!confirm(cm+'월 미납 '+unpaid.length+'명에게 청구 알림을 발송할까요?'))return;
  showOv('발송 중…');
  let sent=0;
  unpaid.forEach(s=>{
    if(s.phone){
      const msg=buildFeeMsg(s,cm);
      console.log('발송:',s.phone,msg);
      sent++;
    }
  });
  hideOv();
  const log={type:'fee_alert',month:cm,year:yr,sent,total:unpaid.length,sentAt:new Date().toISOString(),by:CU?.uid||''};
  if(FB_READY&&db){db.collection('notify_logs').add(log).catch(e=>{});}
  toast('✅ '+sent+'명 발송! (미등록 '+(unpaid.length-sent)+'명 제외)');
}

function testFeeAlert(){
  const cm=new Date().getMonth()+1;
  const sample=STUS.find(s=>!s.status||s.status==='active')||{name:'홍길동',feeType:'3',sibling:'0'};
  const msg=buildFeeMsg(sample,cm);
  alert('테스트 메시지:\n\n'+msg);
}

function runChurnAnalysis(){
  const activeStus = STUS.filter(s=>!s.status||s.status==='active');
  const results = activeStus.map(s=>({
    ...s, risk: calcChurnRisk(s.id, s.name)
  })).filter(s=>s.risk.level!=='safe')
    .sort((a,b)=>b.risk.score-a.risk.score);

  const card = el('churn-alert-card');
  const list = el('churn-alert-list');
  if(!card||!list) return;

  if(!results.length){
    card.style.display='none';
    toast('✅ 이탈 위험 원생이 없어요! 학원이 잘 운영되고 있어요 😊');
    return;
  }

  card.style.display='block';
  list.innerHTML = results.map(s=>`
    <div style="display:flex;align-items:center;gap:.7rem;padding:.6rem 0;border-bottom:1px solid var(--gold-light);">
      <div style="width:36px;height:36px;border-radius:50%;background:${s.risk.color};display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;flex-shrink:0;font-size:.85rem;">${(s.name||'?')[0]}</div>
      <div style="flex:1;">
        <div style="font-weight:800;font-size:.85rem;">${s.name} <span style="font-size:.72rem;color:${s.risk.color};font-weight:900;">${s.risk.label}</span></div>
        <div style="font-size:.68rem;color:var(--muted);">${s.risk.reasons.join(' · ')}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.1rem;font-weight:900;color:${s.risk.color};">${s.risk.score}점</div>
        <button class="btn btn-sm" style="font-size:.62rem;padding:.2rem .5rem;margin-top:.2rem;background:${s.risk.color};color:#fff;border:none;" onclick="contactParent('${s.id}','${s.name}')">연락</button>
      </div>
    </div>`).join('');
  toast('🚨 이탈 위험 '+results.length+'명 감지! 대시보드를 확인하세요.');
}

function contactParent(stuId, stuName){
  const stu=STUS.find(s=>s.id===stuId);
  if(!stu){toast('원생 정보 없음');return;}
  const risk=calcChurnRisk(stuId,stuName);
  const reasons=risk.reasons.join(', ');
  const acad=CFG.name||'솔브아트';
  const msg='['+acad+'] '+stuName+' 학부모님, 최근 '+reasons+' 확인되어 연락드립니다.';
  const phone=stu.phone?'→ '+stu.phone:'(전화번호 미등록)';
  const confirmMsg='아래 내용으로 연락할까요?\n\n'+msg+'\n\n'+phone;
  if(confirm(confirmMsg)){
    if(FB_READY&&db){
      db.collection('contact_logs').add({
        stuId,stuName,msg,phone:stu.phone||'',sentAt:new Date().toISOString(),by:CU?.uid||''
      }).catch(e=>{});
    }
    toast('📞 연락 기록 저장 완료');
  }
}

// openStatDetail에 churn 케이스 추가
const _origOpenStatDetail = openStatDetail;
function openStatDetail(type){
  if(type==='churn'){
    const title=el('stat-detail-title');
    const body=el('stat-detail-body');
    const modal=el('modal-stat-detail');
    if(title) title.textContent='🚨 이탈 위험 원생 전체';
    if(body){
      const activeStus=STUS.filter(s=>!s.status||s.status==='active');
      const all=activeStus.map(s=>({...s,risk:calcChurnRisk(s.id,s.name)}))
        .sort((a,b)=>b.risk.score-a.risk.score);
      body.innerHTML=all.map(s=>`
        <div style="display:flex;align-items:center;gap:.7rem;padding:.6rem 0;border-bottom:1px solid var(--gold-light);">
          <div style="width:32px;height:32px;border-radius:50%;background:${s.risk.color};display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:.8rem;">${(s.name||'?')[0]}</div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:.82rem;">${s.name} <span style="font-size:.7rem;font-weight:900;color:${s.risk.color};">${s.risk.label}</span></div>
            <div style="font-size:.67rem;color:var(--muted);">${s.risk.reasons.length?s.risk.reasons.join(' · '):'이탈 위험 없음'}</div>
          </div>
          <div style="font-size:1rem;font-weight:900;color:${s.risk.color};">${s.risk.score}점</div>
        </div>`).join('');
    }
    if(modal) modal.classList.add('show');
    return;
  }
  _origOpenStatDetail(type);
}

// ════════════════════════════════════════════
//  3. 학부모 링크 갤러리 포털
// ════════════════════════════════════════════
let portalStuId='', portalStuName='';

function shareParentLink(stuId, stuName){
  portalStuId=stuId; portalStuName=stuName;
  const pnameEl=el('plink-name');
  if(pnameEl) pnameEl.textContent=stuName+' 학부모님께';
  // 포털 URL 생성 (현재 앱 URL + 파라미터)
  const base=window.location.href.split('?')[0];
  const token=btoa(stuId+'|'+stuName+'|'+new Date().getFullYear()+'|'+(new Date().getMonth()+1));
  const url=base+'?portal='+token;
  const purlEl=el('plink-url');
  if(purlEl) purlEl.textContent=url;
  el('modal-parent-link').classList.add('show');
}

function copyParentLink(){
  const url=el('plink-url')?.textContent||'';
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=>toast('✅ 링크 복사 완료!'));
  } else {
    const ta=document.createElement('textarea');
    ta.value=url;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
    toast('✅ 링크 복사 완료!');
  }
}

function shareKakao(){
  const url=el('plink-url')?.textContent||'';
  // Kakao SDK 없을 시 클립보드 복사로 대체
  copyParentLink();
  toast('📋 링크를 복사했어요. 카카오톡에 붙여넣어 공유하세요!');
}

function shareSMS(){
  const url=el('plink-url')?.textContent||'';
  const stu=STUS.find(s=>s.id===portalStuId);
  const phone=stu?.phone||'';
  const smsBody='['+( CFG.name||'솔브아트')+'] 학부모 전용 갤러리: '+url;
  if(phone){
    window.open('sms:'+phone+'?body='+encodeURIComponent(smsBody));
  } else {
    copyParentLink();
    toast('📱 링크를 복사했어요. 문자로 붙여넣어 발송하세요!');
  }
}

function openParentPortal(stuId, stuName){
  portalStuId=stuId; portalStuName=stuName;
  const stu=STUS.find(s=>s.id===stuId);
  const m=today().slice(0,7);
  const recs=DB.filter(r=>r.studentName===stuName&&r.date?.startsWith(m));
  const pr=recs.filter(r=>r.attendance==='present').length;
  const ab=recs.filter(r=>r.attendance==='absent').length;
  const yr=new Date().getFullYear(),cm=new Date().getMonth()+1;
  const paid=stu?JSON.parse(localStorage.getItem('pay_'+stuId+'_'+yr)||'{}')[cm]:null;

  const pname=el('portal-stu-name');
  if(pname) pname.textContent=stuName+' 학생';
  const pper=el('portal-period');
  if(pper) pper.textContent=m.replace('-','년 ')+'월 리포트';
  const pacad=el('portal-academy-name');
  if(pacad) pacad.textContent=CFG.name||'솔브아트';

  // 출석 통계
  const attEl=el('portal-att-stats');
  if(attEl) attEl.innerHTML=
    '<div style="flex:1;text-align:center;background:var(--gold-pale);border-radius:8px;padding:.6rem;">'
    +'<div style="font-size:1.4rem;font-weight:900;color:var(--sage);">'+pr+'</div>'
    +'<div style="font-size:.65rem;color:var(--muted);">출석</div></div>'
    +'<div style="flex:1;text-align:center;background:var(--gold-pale);border-radius:8px;padding:.6rem;">'
    +'<div style="font-size:1.4rem;font-weight:900;color:var(--accent);">'+ab+'</div>'
    +'<div style="font-size:.65rem;color:var(--muted);">결석</div></div>'
    +'<div style="flex:1;text-align:center;background:var(--gold-pale);border-radius:8px;padding:.6rem;">'
    +'<div style="font-size:1rem;font-weight:900;color:'+(paid?'var(--sage)':'var(--accent)')+';">'+(paid?'납부':'미납')+'</div>'
    +'<div style="font-size:.65rem;color:var(--muted);">수강료</div></div>';

  // 수업 내용
  const lessons=recs.filter(r=>r.workName).slice(-5);
  const lessEl=el('portal-lessons');
  if(lessEl) lessEl.innerHTML=lessons.length
    ?lessons.map(l=>'<div style="display:flex;gap:.5rem;font-size:.76rem;padding:.3rem 0;border-bottom:1px solid var(--gold-light);">'
      +'<span style="color:var(--muted);min-width:42px;font-size:.68rem;">'+(l.date?.slice(5)||'')+'</span>'
      +'<span style="flex:1;font-weight:700;">'+l.workName+' #'+( l.workNum||1)+'</span>'
      +'<span style="color:var(--gold);">'+('★'.repeat(l.completion||0)||'-')+'</span></div>').join('')
    :'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.78rem;">수업 기록 없음</div>';

  // 사진 (드라이브 연동 시)
  const photoEl=el('portal-photos');
  const noPhotoEl=el('portal-no-photos');
  if(photoEl&&noPhotoEl){
    if(stu?.driveId&&driveAccessToken){
      photoEl.innerHTML='<div style="text-align:center;padding:.5rem;font-size:.72rem;color:var(--muted);">🔄 사진 불러오는 중...</div>';
      noPhotoEl.style.display='none';
      loadPortalPhotos(stu.driveId, photoEl, noPhotoEl);
    } else {
      photoEl.innerHTML='';
      noPhotoEl.style.display='block';
    }
  }
  el('modal-parent-portal').classList.add('show');
}

async function loadPortalPhotos(folderId, photoEl, noPhotoEl){
  try{
    const q="'"+folderId+"' in parents and (mimeType contains 'image/') and trashed=false";
    const resp=await gapi.client.drive.files.list({
      q,fields:'files(id,name,thumbnailLink,createdTime)',
      orderBy:'createdTime desc',pageSize:9
    });
    const files=resp.result.files||[];
    if(!files.length){photoEl.innerHTML='';noPhotoEl.style.display='block';return;}
    photoEl.innerHTML=files.map(f=>{
      const thumb=f.thumbnailLink?f.thumbnailLink.replace('=s220','=s400'):'https://drive.google.com/thumbnail?id='+f.id+'&sz=w400';
      return '<div><img src="'+thumb+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1.5px solid var(--border);" loading="lazy"></div>';
    }).join('');
  }catch(e){ photoEl.innerHTML='';noPhotoEl.style.display='block'; }
}

// URL 파라미터로 포털 자동 열기
function checkPortalParam(){
  const params=new URLSearchParams(window.location.search);
  const token=params.get('portal');
  if(!token) return;
  try{
    const decoded=atob(token).split('|');
    if(decoded.length>=2){
      const stuId=decoded[0], stuName=decoded[1];
      setTimeout(()=>openParentPortal(stuId,stuName),1500);
    }
  }catch(e){}
}

// ════════════════════════════════════════════
//  4. 키오스크 출결 모드
// ════════════════════════════════════════════
let kioskMode = false;
let kioskInput = '';

function openKioskMode(){
  kioskMode=true;
  kioskInput='';
  const overlay=document.createElement('div');
  overlay.id='kiosk-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:var(--ink);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;';
  overlay.innerHTML=`
    <div style="font-size:1.5rem;font-weight:900;color:var(--gold);margin-bottom:.5rem;">${CFG.name||'솔브아트'}</div>
    <div style="font-size:1rem;color:rgba(255,255,255,.6);margin-bottom:2rem;">학부모 번호 뒷 4자리를 입력하세요</div>
    <div id="kiosk-display" style="font-size:3rem;font-weight:900;letter-spacing:.3em;color:var(--gold);min-height:4rem;margin-bottom:1.5rem;">____</div>
    <div style="display:grid;grid-template-columns:repeat(3,80px);gap:.6rem;">
      ${[1,2,3,4,5,6,7,8,9,'',0,'←'].map(n=>`
        <button onclick="kioskInput_btn('${n}')"
          style="width:80px;height:80px;border-radius:16px;border:none;background:${n===''?'transparent':n==='←'?'#C62828':'rgba(255,255,255,.12)'};
          color:#fff;font-size:${n==='←'?'1.5rem':'1.8rem'};font-weight:900;cursor:pointer;${n===''?'pointer-events:none;':''}"
        >${n}</button>`).join('')}
    </div>
    <button onclick="closeKiosk()" style="margin-top:2rem;padding:.6rem 2rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);border-radius:10px;color:rgba(255,255,255,.5);font-size:.8rem;cursor:pointer;">닫기 (관리자 전용)</button>`;
  document.body.appendChild(overlay);
}

function kioskInput_btn(val){
  if(!kioskMode) return;
  if(val==='←'){ kioskInput=kioskInput.slice(0,-1); }
  else if(val!==''&&kioskInput.length<4){ kioskInput+=String(val); }
  const disp=el('kiosk-display');
  if(disp) disp.textContent=(kioskInput+'____').slice(0,4).replace(/./g,(c,i)=>i<kioskInput.length?c:'_');
  if(kioskInput.length===4) setTimeout(()=>kioskCheck(),300);
}

function kioskCheck(){
  const code=kioskInput;
  kioskInput='';
  const matched=STUS.filter(s=>{
    const phone=(s.phone||'').replace(/[^0-9]/g,'');
    return phone.slice(-4)===code&&(!s.status||s.status==='active');
  });
  const disp=el('kiosk-display');
  if(!matched.length){
    if(disp){disp.textContent='❌';disp.style.color='var(--accent)';}
    setTimeout(()=>{if(disp){disp.textContent='____';disp.style.color='var(--gold)';}},1500);
    return;
  }
  matched.forEach(s=>{
    const rec={date:today(),studentName:s.name,studentId:s.id,
      attendance:'present',teacher:'키오스크',createdAt:new Date().toISOString()};
    DB.push(rec);
    if(FB_READY&&db) db.collection('records').add(rec).catch(e=>{});
  });
  localStorage.setItem('sa_db',JSON.stringify(DB));
  const names=matched.map(s=>s.name).join(', ');
  if(disp){disp.textContent='✅';disp.style.color='#4CAF50';disp.style.fontSize='3.5rem';}
  const overlay=el('kiosk-overlay');
  if(overlay){
    const msg=document.createElement('div');
    msg.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-40%);font-size:1.5rem;font-weight:900;color:#4CAF50;text-align:center;';
    msg.textContent=names+' 출석!';
    overlay.appendChild(msg);
    setTimeout(()=>{
      if(disp){disp.textContent='____';disp.style.color='var(--gold)';disp.style.fontSize='3rem';}
      msg.remove();renderHome();
    },2000);
  }
}

function closeKiosk(){
  kioskMode=false;
  const overlay=el('kiosk-overlay');
  if(overlay) overlay.remove();
}

// 키오스크 버튼을 대시보드에 추가 (관리자 전용)
// showApp 시 자동 실행 항목 추가

// ════════════════════════════════════════════
//  상담 일지
// ════════════════════════════════════════════
let COUNSELS = JSON.parse(localStorage.getItem('sa_counsels')||'[]');
let editCounselId = '';

const COUNSEL_TYPE_COLORS = {
  '신규':'#1565C0','정기':'#2E7D32','불만':'#E65100',
  '이탈위험':'#C62828','퇴원':'#4A148C','기타':'#555'
};
const COUNSEL_TYPE_ICONS = {
  '신규':'📋','정기':'🔄','불만':'⚠️','이탈위험':'🚨','퇴원':'🚪','기타':'💬'
};

function initCounselSelects(){
  // 원생 선택 셀렉트 초기화
  const sel=el('counsel-stu');
  const fsel=el('counsel-stu-filter');
  const activeStus=STUS.filter(s=>!s.status||s.status==='active');
  if(sel){
    sel.innerHTML='<option value="">-- 원생 선택 --</option>';
    activeStus.forEach(s=>{ sel.innerHTML+=`<option value="${s.id}">${s.name}</option>`; });
  }
  if(fsel){
    fsel.innerHTML='<option value="">전체 원생</option>';
    activeStus.forEach(s=>{ fsel.innerHTML+=`<option value="${s.id}">${s.name}</option>`; });
  }
}

function renderCounselList(){
  initCounselSelects();
  const stuId=gv('counsel-stu-filter');
  let data=stuId?COUNSELS.filter(c=>c.stuId===stuId):[...COUNSELS];
  data.sort((a,b)=>b.date>a.date?1:-1);

  // 통계
  const statsEl=el('counsel-stats');
  if(statsEl){
    const total=data.length;
    const upcoming=data.filter(c=>c.nextDate&&c.nextDate>=today()).length;
    const thisMonth=data.filter(c=>c.date?.startsWith(today().slice(0,7))).length;
    statsEl.innerHTML=
      '<div style="background:#E3F2FD;border-radius:10px;padding:.7rem;text-align:center;border:1.5px solid #90CAF9;">'
      +'<div style="font-size:1.4rem;font-weight:900;color:#1565C0;">'+total+'</div>'
      +'<div style="font-size:.68rem;color:#1565C0;">전체 상담</div></div>'
      +'<div style="background:#E8F5E9;border-radius:10px;padding:.7rem;text-align:center;border:1.5px solid #A5D6A7;">'
      +'<div style="font-size:1.4rem;font-weight:900;color:#2E7D32;">'+thisMonth+'</div>'
      +'<div style="font-size:.68rem;color:#2E7D32;">이달 상담</div></div>'
      +'<div style="background:#FFF3E0;border-radius:10px;padding:.7rem;text-align:center;border:1.5px solid #FFCC80;">'
      +'<div style="font-size:1.4rem;font-weight:900;color:#E65100;">'+upcoming+'</div>'
      +'<div style="font-size:.68rem;color:#E65100;">예약 상담</div></div>';
  }

  const wrap=el('counsel-list-wrap');
  if(!wrap) return;
  if(!data.length){
    wrap.innerHTML='<div style="text-align:center;padding:2.5rem;color:var(--muted);font-size:.82rem;">상담 기록이 없어요<br><br><button class="btn btn-b btn-sm" onclick="openAddCounsel()">+ 첫 상담 등록</button></div>';
    return;
  }
  wrap.innerHTML=data.map(c=>{
    const icon=COUNSEL_TYPE_ICONS[c.type]||'💬';
    const color=COUNSEL_TYPE_COLORS[c.type]||'#555';
    const isUpcoming=c.nextDate&&c.nextDate>=today();
    return `<div style="background:#fff;border-radius:12px;border:1.5px solid var(--gold-light);margin-bottom:.7rem;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:.6rem;padding:.75rem .9rem;border-bottom:1px solid var(--gold-light);">
        <div style="width:36px;height:36px;border-radius:10px;background:${color}22;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${icon}</div>
        <div style="flex:1;">
          <div style="font-size:.82rem;font-weight:800;">${c.stuName||'이름없음'} <span style="font-size:.7rem;font-weight:600;color:${color};">${c.type}</span></div>
          <div style="font-size:.68rem;color:var(--muted);">${c.date} · ${c.staff||''}</div>
        </div>
        <div style="display:flex;gap:.3rem;">
          ${isUpcoming?`<span style="font-size:.65rem;background:#FFF3E0;color:#E65100;padding:2px 7px;border-radius:10px;font-weight:700;">D-${Math.floor((new Date(c.nextDate)-new Date())/86400000)}일</span>`:''}
          <button class="btn btn-o btn-sm" style="font-size:.65rem;padding:.2rem .5rem;" onclick="openEditCounsel('${c.id}')">수정</button>
        </div>
      </div>
      <div style="padding:.65rem .9rem;font-size:.78rem;color:var(--ink);line-height:1.6;">${c.content||''}</div>
      ${c.result?`<div style="padding:.3rem .9rem .6rem;font-size:.72rem;">
        <span style="background:var(--gold-pale);color:var(--ink);padding:2px 8px;border-radius:10px;font-weight:700;">결과: ${c.result}</span>
        ${c.nextDate?`<span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:10px;font-weight:700;margin-left:.3rem;">다음상담: ${c.nextDate}</span>`:''}
      </div>`:''}
    </div>`;
  }).join('');
}

function openAddCounsel(){
  editCounselId='';
  el('counsel-modal-title').textContent='상담 등록';
  el('counsel-edit-id').value='';
  el('counsel-del-btn').style.display='none';
  sv('counsel-date',today());
  sv('counsel-type','신규');
  sv('counsel-stu','');
  sv('counsel-phone','');
  sv('counsel-content','');
  sv('counsel-result','계속관찰');
  sv('counsel-next','');
  sv('counsel-staff',CP?.name||'');
  initCounselSelects();
  el('modal-counsel').classList.add('show');
}

function openEditCounsel(id){
  const c=COUNSELS.find(x=>x.id===id);
  if(!c) return;
  editCounselId=id;
  el('counsel-modal-title').textContent='상담 수정';
  el('counsel-edit-id').value=id;
  el('counsel-del-btn').style.display='';
  sv('counsel-date',c.date||today());
  sv('counsel-type',c.type||'기타');
  initCounselSelects();
  sv('counsel-stu',c.stuId||'');
  sv('counsel-phone',c.phone||'');
  sv('counsel-content',c.content||'');
  sv('counsel-result',c.result||'계속관찰');
  sv('counsel-next',c.nextDate||'');
  sv('counsel-staff',c.staff||'');
  el('modal-counsel').classList.add('show');
}

function onCounselStuChange(){
  const stuId=gv('counsel-stu');
  const stu=STUS.find(s=>s.id===stuId);
  if(stu) sv('counsel-phone',stu.phone||'');
}

async function saveCounsel(){
  const stuId=gv('counsel-stu');
  const stu=STUS.find(s=>s.id===stuId);
  const counsel={
    id:editCounselId||'cs_'+Date.now(),
    stuId,stuName:stu?.name||gv('counsel-stu'),
    date:gv('counsel-date'),type:gv('counsel-type'),
    phone:gv('counsel-phone'),content:gv('counsel-content'),
    result:gv('counsel-result'),nextDate:gv('counsel-next'),
    staff:gv('counsel-staff'),
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  if(editCounselId){ COUNSELS=COUNSELS.map(c=>c.id===editCounselId?counsel:c); }
  else { COUNSELS.push(counsel); }
  localStorage.setItem('sa_counsels',JSON.stringify(COUNSELS));
  if(FB_READY&&db){ await db.collection('counsels').doc(counsel.id).set(counsel).catch(e=>{}); }
  closeM('modal-counsel');
  renderCounselList();
  toast('✅ 상담 기록 저장!');
}

function deleteCounsel(){
  if(!editCounselId||!confirm('이 상담 기록을 삭제할까요?')) return;
  COUNSELS=COUNSELS.filter(c=>c.id!==editCounselId);
  localStorage.setItem('sa_counsels',JSON.stringify(COUNSELS));
  if(FB_READY&&db){ db.collection('counsels').doc(editCounselId).delete().catch(e=>{}); }
  closeM('modal-counsel');
  renderCounselList();
  toast('✅ 삭제 완료');
}

// 앱 시작 시 Firestore에서 상담 데이터 로드
async function loadCounselsFromDB(){
  if(!FB_READY||!db) return;
  try{
    const snap=await db.collection('counsels').get();
    snap.forEach(doc=>{ if(!COUNSELS.find(c=>c.id===doc.id)) COUNSELS.push({id:doc.id,...doc.data()}); });
    localStorage.setItem('sa_counsels',JSON.stringify(COUNSELS));
  }catch(e){}
}

// ════════════════════════════════════════════
//  포트폴리오 생성 (PDF / JPG)
// ════════════════════════════════════════════
let pfStuId='', pfStuName='', pfFormat='pdf', pfSelectedPhotos=[];

function openPortfolio(stuId, stuName){
  pfStuId=stuId; pfStuName=stuName; pfSelectedPhotos=[];
  const pn=el('pf-stu-name');if(pn) pn.textContent=stuName;
  const pp=el('pf-period');
  const now=new Date();
  const yr=now.getFullYear();
  const mStr=yr+'년 '+(now.getMonth()+1)+'월';
  if(pp) pp.textContent=mStr+' · 포트폴리오';
  if(el('portfolio-title')) el('portfolio-title').textContent='📁 '+stuName+' 포트폴리오';

  // 기간 기본값: 6개월
  const sixMoAgo=new Date(now);sixMoAgo.setMonth(sixMoAgo.getMonth()-6);
  const toStr=now.toISOString().slice(0,10);
  const fromStr=sixMoAgo.toISOString().slice(0,10);
  sv('pf-from',fromStr);sv('pf-to',toStr);
  sv('pf-custom-title',stuName+' 작품 포트폴리오 ('+yr+'년)');
  sv('pf-teacher-comment','');
  sv('pf-purpose','일반');

  loadPortfolioWorks();
  loadPortfolioPhotos();
  el('modal-portfolio').classList.add('show');
}

function loadPortfolioWorks(){
  const from=gv('pf-from'), to=gv('pf-to');
  const recs=DB.filter(r=>r.studentName===pfStuName&&r.workName
    &&(!from||r.date>=from)&&(!to||r.date<=to));
  const countEl=el('pf-work-count');
  if(countEl) countEl.textContent='('+recs.length+'건)';
  const listEl=el('pf-works-list');
  if(!listEl) return;
  if(!recs.length){
    listEl.innerHTML='<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.78rem;">기간 내 수업 기록 없음</div>';
    return;
  }
  listEl.innerHTML=recs.map(r=>`
    <div style="display:flex;gap:.5rem;font-size:.76rem;padding:.3rem 0;border-bottom:1px solid var(--gold-light);align-items:center;">
      <span style="color:var(--muted);min-width:46px;font-size:.68rem;">${r.date?.slice(5)||''}</span>
      <span style="flex:1;font-weight:700;">${r.workName} <span style="font-weight:400;color:var(--muted);">#${r.workNum||1}</span></span>
      <span style="color:var(--gold);font-size:.7rem;">${'★'.repeat(r.completion||0)||'—'}</span>
    </div>`).join('');
}

async function loadPortfolioPhotos(){
  const stu=STUS.find(s=>s.id===pfStuId);
  const gridEl=el('pf-photo-grid');
  const statusEl=el('pf-drive-status');
  if(!gridEl) return;
  if(!stu?.driveId){
    if(statusEl) statusEl.textContent='구글 드라이브 폴더를 원생 정보에 등록하면 작품 사진이 자동으로 포함돼요';
    gridEl.innerHTML='';return;
  }
  if(!driveAccessToken){
    if(statusEl) statusEl.innerHTML='<button class="btn btn-o btn-sm" onclick="signInGoogle()">🔑 구글 드라이브 연결</button>';
    gridEl.innerHTML='';return;
  }
  if(statusEl) statusEl.textContent='사진 불러오는 중...';
  gapi.client.drive.files.list({
    q:"'"+stu.driveId+"' in parents and (mimeType contains 'image/') and trashed=false",
    fields:'files(id,name,thumbnailLink,createdTime)',
    orderBy:'createdTime desc',pageSize:20
  }).then(resp=>{
    const files=resp.result.files||[];
    if(statusEl) statusEl.textContent=files.length+'장의 작품 사진';
    pfSelectedPhotos=files.map(f=>({...f,selected:true}));
    gridEl.innerHTML=files.map(f=>{
      const thumb=f.thumbnailLink?f.thumbnailLink.replace('=s220','=s300'):'https://drive.google.com/thumbnail?id='+f.id+'&sz=w300';
      return '<div style="position:relative;cursor:pointer;" data-fid="'+f.id+'" class="pf-photo-item">'
        +'<img src="'+thumb+'" id="pfimg-'+f.id+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:2px solid var(--gold);transition:opacity .2s;" loading="lazy">'
        +'<div id="pfchk-'+f.id+'" style="position:absolute;top:3px;right:3px;background:var(--gold);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:900;color:var(--ink);">✓</div>'
        +'</div>';
    }).join('');
    // 이벤트 위임 방식으로 클릭 처리
    gridEl.onclick=function(e){
      const item=e.target.closest('.pf-photo-item');
      if(item) togglePfPhoto(item.dataset.fid);
    };
  }).catch(e=>{if(statusEl) statusEl.textContent='사진 불러오기 실패';});
}

function togglePfPhoto(fileId){
  const f=pfSelectedPhotos.find(x=>x.id===fileId);
  if(!f) return;
  f.selected=!f.selected;
  const img=el('pfimg-'+fileId);
  const chk=el('pfchk-'+fileId);
  if(img) img.style.opacity=f.selected?'1':'0.35';
  if(img) img.style.border=f.selected?'2px solid var(--gold)':'2px solid transparent';
  if(chk) chk.style.display=f.selected?'flex':'none';
}

function setPfFormat(fmt, btn){
  pfFormat=fmt;
  document.querySelectorAll('.pf-format-btn').forEach(b=>{
    b.style.background='';b.style.color='var(--ink)';
  });
  btn.style.background='var(--ink)';btn.style.color='#fff';
}

async function generatePortfolio(){
  const from=gv('pf-from'), to=gv('pf-to');
  const title=gv('pf-custom-title')||pfStuName+' 포트폴리오';
  const comment=gv('pf-teacher-comment');
  const purpose=gv('pf-purpose');
  const recs=DB.filter(r=>r.studentName===pfStuName&&r.workName
    &&(!from||r.date>=from)&&(!to||r.date<=to));
  const selPhotos=pfSelectedPhotos.filter(f=>f.selected);

  showOv('포트폴리오 생성 중…');

  // ── 포트폴리오 HTML 생성
  const accentColor = purpose==='입시'?'#1a1a1a':'#FFC800';
  const bgColor = purpose==='입시'?'#f8f8f8':'#FFFDF5';

  let photoHtml='';
  if(selPhotos.length>0){
    photoHtml='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px;">'
      +selPhotos.map(f=>{
        const thumb=f.thumbnailLink?f.thumbnailLink.replace('=s220','=s400'):'https://drive.google.com/thumbnail?id='+f.id+'&sz=w400';
        const date=f.createdTime?f.createdTime.slice(0,10):'';
        return '<div style="break-inside:avoid;">'
          +'<img src="'+thumb+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #ddd;" crossorigin="anonymous">'
          +'<div style="font-size:9px;color:#999;text-align:center;margin-top:3px;">'+date+'</div></div>';
      }).join('')+'</div>';
  }

  const lessonRows=recs.map(r=>
    '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;">'+( r.date||'')+'</td>'
    +'<td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;font-weight:bold;">'+r.workName+'</td>'
    +'<td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;">#'+( r.workNum||1)+'</td>'
    +'<td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:center;color:#BA7517;">'+('★'.repeat(r.completion||0)||'—')+'</td>'
    +'<td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;color:#888;">'+( r.attendance==='present'?'출석':'결석')+'</td></tr>'
  ).join('');

  const attPr=recs.filter(r=>r.attendance==='present').length;
  const attAb=recs.filter(r=>r.attendance==='absent').length;
  const attTot=attPr+attAb;
  const attRate=attTot?Math.round(attPr/attTot*100):100;
  const avgComp=recs.filter(r=>r.completion>0).length
    ?( recs.filter(r=>r.completion>0).reduce((s,r)=>s+r.completion,0)/recs.filter(r=>r.completion>0).length).toFixed(1):'—';

  const pfHtml=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Malgun Gothic','Noto Sans KR',sans-serif;background:${bgColor};color:#1a1a1a;font-size:14px;}
.wrap{max-width:794px;margin:0 auto;padding:30px 24px;}
.cover{background:${accentColor==='#FFC800'?'#1a1a1a':'#1a1a1a'};color:#fff;border-radius:16px;padding:40px 36px;margin-bottom:24px;position:relative;overflow:hidden;}
.cover::after{content:'🎨';position:absolute;right:24px;top:20px;font-size:80px;opacity:.06;}
.cover-badge{font-size:10px;letter-spacing:.15em;color:${accentColor};font-weight:700;margin-bottom:8px;}
.cover-name{font-size:28px;font-weight:900;margin-bottom:4px;}
.cover-sub{font-size:13px;color:rgba(255,255,255,.5);}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
.stat-box{background:#fff;border-radius:10px;padding:12px;text-align:center;border:1.5px solid #FFE082;}
.stat-n{font-size:22px;font-weight:900;}
.stat-l{font-size:10px;color:#888;margin-top:2px;}
.section-title{font-size:11px;font-weight:800;letter-spacing:.1em;color:#888;border-bottom:2px solid ${accentColor};padding-bottom:6px;margin-bottom:12px;}
table{width:100%;border-collapse:collapse;}
th{background:#1a1a1a;color:#fff;padding:8px;font-size:11px;font-weight:600;text-align:left;}
.comment-box{background:#fff;border:1.5px solid #FFE082;border-radius:12px;padding:16px;margin-bottom:20px;}
.footer{display:flex;justify-content:space-between;font-size:11px;color:#999;margin-top:20px;padding-top:12px;border-top:1px solid #eee;}
@media print{
  .no-print{display:none!important;}
  body{background:#fff;}
  .wrap{padding:10px;}
}
</style></head><body>
<div class="wrap">

<div class="cover">
  <div class="cover-badge">${purpose==='입시'?'ENTRANCE EXAM PORTFOLIO':'ART PORTFOLIO'} · ${CFG.name||'SOLVE ART'}</div>
  <div class="cover-name">${pfStuName}</div>
  <div class="cover-sub">${from} ~ ${to} · 총 ${recs.length}회 수업</div>
</div>

<div class="stats-row">
  <div class="stat-box"><div class="stat-n" style="color:#2E7D32;">${attPr}</div><div class="stat-l">출석</div></div>
  <div class="stat-box"><div class="stat-n" style="color:#C62828;">${attAb}</div><div class="stat-l">결석</div></div>
  <div class="stat-box"><div class="stat-n" style="color:#BA7517;">${attRate}%</div><div class="stat-l">출석률</div></div>
  <div class="stat-box"><div class="stat-n" style="color:#6A1B9A;">${avgComp}</div><div class="stat-l">평균 완성도</div></div>
</div>

${comment?'<div class="comment-box"><div class="section-title" style="margin-bottom:8px;">선생님 총평</div><div style="font-size:13px;line-height:1.7;color:#333;">'+comment+'</div></div>':''}

<div style="margin-bottom:20px;">
  <div class="section-title">작품 기록</div>
  <table>
    <thead><tr><th>날짜</th><th>작품명</th><th>회차</th><th>완성도</th><th>출결</th></tr></thead>
    <tbody>${lessonRows||'<tr><td colspan="5" style="text-align:center;padding:12px;color:#999;">수업 기록 없음</td></tr>'}</tbody>
  </table>
</div>

${selPhotos.length?'<div style="margin-bottom:20px;"><div class="section-title">완성 작품 사진</div>'+photoHtml+'</div>':''}

<div class="footer">
  <span>${CFG.name||'솔브아트'} · ${CFG.phone||''}</span>
  <span>생성일: ${today()}</span>
</div>

<div class="no-print" style="text-align:center;margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
  <button onclick="window.print()" style="padding:10px 28px;background:#1a1a1a;color:#FFC800;border:none;border-radius:8px;font-weight:900;cursor:pointer;font-size:14px;">🖨️ PDF로 저장 / 인쇄</button>
  ${pfFormat==='jpg'?'<button onclick="captureJPG()" style="padding:10px 28px;background:#6A1B9A;color:#fff;border:none;border-radius:8px;font-weight:900;cursor:pointer;font-size:14px;">🖼 JPG로 저장</button>':''}
  <button onclick="window.close()" style="padding:10px 28px;background:#666;color:#fff;border:none;border-radius:8px;font-weight:900;cursor:pointer;font-size:14px;">✕ 닫기</button>
</div>
</div>
</body></html>`;

  hideOv();

  if(pfFormat==='jpg'){
    // JPG: html2canvas 방식으로 새 창에서 캡처 안내
    const w=window.open('','_blank','width=900,height=700');
    w.document.write(pfHtml);
    w.document.close();
    toast('🖼 JPG: 새 창에서 인쇄 > "이미지로 저장" 선택하세요');
  } else {
    // PDF: 새 창에서 인쇄
    const w=window.open('','_blank','width=900,height=700');
    w.document.write(pfHtml);
    w.document.close();
    setTimeout(()=>w.print(),800);
    toast('📄 PDF 생성 완료! 인쇄 창에서 "PDF로 저장"을 선택하세요');
  }
  closeM('modal-portfolio');
}

// ════════════════════════════════════════════
//  기능1: 수업 직접 입력
// ════════════════════════════════════════════
let lessonRows = [];

function initLessonInput(){
  sv('li-date', today());
  sv('li-teacher', CP?.name || '');
  renderLessonRows();
  el('li-date').onchange = renderLessonRows;
  el('li-slot').onchange = renderLessonRows;
}

function renderLessonRows(){
  const slot = gv('li-slot');
  // 해당 시간대에 등록된 수강중 원생 필터
  const slotStus = STUS.filter(s =>
    (!s.status || s.status === 'active') &&
    s.slots && s.slots.includes(slot)
  );
  // 전체 수강중 원생도 표시 (시간대 미등록 포함)
  const activeStus = STUS.filter(s => !s.status || s.status === 'active');
  const displayStus = slotStus.length > 0 ? slotStus : activeStus;

  const wrap = el('li-rows');
  const empty = el('li-empty');
  const cnt = el('li-count');
  if(!wrap) return;

  if(!displayStus.length){
    wrap.innerHTML = '';
    if(empty) empty.style.display = 'block';
    if(cnt) cnt.textContent = '0명';
    return;
  }
  if(empty) empty.style.display = 'none';
  if(cnt) cnt.textContent = displayStus.length + '명';

  wrap.innerHTML = displayStus.map(s => `
    <div style="border-bottom:1px solid var(--gold-light);padding:.7rem 0;" id="lrow-${s.id}">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9rem;flex-shrink:0;">${(s.name||'?')[0]}</div>
        <span style="font-weight:800;font-size:.9rem;flex:1;">${s.name}</span>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-sm att-btn" data-id="${s.id}" data-att="present"
            onclick="setLessonAtt('${s.id}','present',this)"
            style="background:#E8F5E9;color:#2E7D32;border:2px solid #A5D6A7;font-weight:700;padding:.2rem .5rem;">○출석</button>
          <button class="btn btn-sm att-btn" data-id="${s.id}" data-att="absent"
            onclick="setLessonAtt('${s.id}','absent',this)"
            style="font-weight:700;padding:.2rem .5rem;">✕결석</button>
          <button class="btn btn-sm att-btn" data-id="${s.id}" data-att="late"
            onclick="setLessonAtt('${s.id}','late',this)"
            style="font-weight:700;padding:.2rem .5rem;">△지각</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 80px;gap:.4rem;margin-left:42px;">
        <input type="text" class="inp" id="lwork-${s.id}" placeholder="작품명 (정물화, 수채화 등)" style="font-size:.78rem;">
        <input type="number" class="inp" id="lnum-${s.id}" placeholder="회차" min="1" style="font-size:.78rem;">
      </div>
      <div style="display:flex;gap:.3rem;margin-left:42px;margin-top:.3rem;">
        ${[1,2,3,4,5].map(n=>`<button class="btn btn-sm star-btn" data-id="${s.id}" data-v="${n}" onclick="setLessonStar('${s.id}',${n},this)" style="padding:.15rem .35rem;font-size:.7rem;color:#BA7517;">${'★'.repeat(n)}</button>`).join('')}
      </div>
      <input type="hidden" id="latt-${s.id}" value="present">
      <input type="hidden" id="lstar-${s.id}" value="0">
    </div>`).join('');
}

function setLessonAtt(stuId, att, btn){
  const row = el('lrow-'+stuId);
  if(!row) return;
  row.querySelectorAll('.att-btn').forEach(b => {
    b.style.background = '';b.style.color = '';b.style.border = '';
  });
  if(att === 'present'){ btn.style.background='#E8F5E9';btn.style.color='#2E7D32';btn.style.border='2px solid #A5D6A7'; }
  else if(att === 'absent'){ btn.style.background='#FFEBEE';btn.style.color='#C62828';btn.style.border='2px solid #EF9A9A'; }
  else { btn.style.background='#FFF3E0';btn.style.color='#E65100';btn.style.border='2px solid #FFCC80'; }
  const hidden = el('latt-'+stuId);
  if(hidden) hidden.value = att;
}

function setLessonStar(stuId, val, btn){
  const row = el('lrow-'+stuId);
  if(!row) return;
  row.querySelectorAll('.star-btn[data-id="'+stuId+'"]').forEach(b => {
    b.style.background = '';b.style.fontWeight = '';
  });
  btn.style.background = 'var(--gold-pale)';btn.style.fontWeight = '900';
  const hidden = el('lstar-'+stuId);
  if(hidden) hidden.value = val;
}

async function saveLessonInput(){
  const date = gv('li-date');
  const slot = gv('li-slot');
  const teacher = gv('li-teacher');
  if(!date){ toast('날짜를 선택하세요'); return; }

  const activeStus = STUS.filter(s => !s.status || s.status === 'active');
  const slotStus = activeStus.filter(s => s.slots && s.slots.includes(slot));
  const displayStus = slotStus.length > 0 ? slotStus : activeStus;
  if(!displayStus.length){ toast('등록된 원생이 없어요'); return; }

  showOv('수업 기록 저장 중…');
  const batch = [];
  displayStus.forEach(s => {
    const att = el('latt-'+s.id)?.value || 'present';
    const work = el('lwork-'+s.id)?.value || '';
    const num = parseInt(el('lnum-'+s.id)?.value || 1);
    const comp = parseInt(el('lstar-'+s.id)?.value || 0);
    const rec = {
      date, timeSlot:slot, teacher: teacher||CP?.name||'',
      studentName:s.name, studentId:s.id,
      attendance:att, workName:work, workNum:num,
      completion:comp, note:gv('li-note')||'',
      createdAt:new Date().toISOString(), createdBy:CU?.uid||''
    };
    DB.push(rec);
    batch.push(rec);
  });

  localStorage.setItem('sa_db', JSON.stringify(DB));
  if(FB_READY && db){
    try{
      for(const rec of batch){
        await db.collection('records').add(rec);
      }
    }catch(e){ console.warn('저장 오류:', e); }
  }
  hideOv();
  toast(`✅ ${displayStus.length}명 수업 기록 저장 완료!`);
  sv('li-note','');
  renderLessonRows();
  renderHome();
}

// ════════════════════════════════════════════
//  기능2: 반(클래스) 관리
// ════════════════════════════════════════════
let CLASSES = JSON.parse(localStorage.getItem('sa_classes') || '[]');
let editClassId = '';
let selectedClassColor = '#FFC800';
let classAttData = {};

function renderClassList(){
  const wrap = el('class-list-wrap');
  if(!wrap) return;
  if(!CLASSES.length){
    wrap.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:.8rem;">반이 없어요. 반을 추가해보세요!</div>';
    el('class-attend-card').style.display = 'none';
    return;
  }
  wrap.innerHTML = CLASSES.map(c => {
    const members = STUS.filter(s => s.classIds && s.classIds.includes(c.id) && (!s.status || s.status === 'active'));
    return `<div style="display:flex;align-items:center;gap:.7rem;padding:.7rem 0;border-bottom:1px solid var(--gold-light);">
      <div style="width:10px;height:40px;border-radius:4px;background:${c.color||'#FFC800'};flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="font-weight:800;font-size:.88rem;">${c.name}</div>
        <div style="font-size:.72rem;color:var(--muted);">${c.slot} · ${c.days?.join('·')||''} · ${c.teacher||'미정'} · ${members.length}명</div>
      </div>
      <div style="display:flex;gap:.3rem;">
        <button class="btn btn-gold btn-sm" onclick="openClassAttend('${c.id}','${c.name}')">출결</button>
        <button class="btn btn-o btn-sm" onclick="openEditClass('${c.id}')">수정</button>
        <button class="btn btn-r btn-sm" onclick="deleteClass('${c.id}')">삭제</button>
      </div>
    </div>`;
  }).join('');
}

function openAddClass(){
  editClassId = '';
  sv('class-name','');sv('class-slot','1~2시');sv('class-teacher','');
  sv('class-color','#FFC800');selectedClassColor='#FFC800';
  el('class-modal-title').textContent = '반 추가';
  document.querySelectorAll('.day-btn').forEach(b => b.style.background = '');
  document.querySelectorAll('.color-btn').forEach(b => b.style.border = '2px solid transparent');
  el('modal-class').classList.add('show');
}

function openEditClass(id){
  const c = CLASSES.find(x=>x.id===id);
  if(!c) return;
  editClassId = id;
  sv('class-name', c.name||'');sv('class-slot', c.slot||'1~2시');
  sv('class-teacher', c.teacher||'');sv('class-color', c.color||'#FFC800');
  selectedClassColor = c.color||'#FFC800';
  el('class-modal-title').textContent = '반 수정';
  document.querySelectorAll('.day-btn').forEach(b => {
    b.style.background = c.days?.includes(b.dataset.day) ? 'var(--gold)' : '';
  });
  el('modal-class').classList.add('show');
}

function toggleDay(btn){
  const isOn = btn.style.background === 'var(--gold)' || btn.style.background.includes('FFC800');
  btn.style.background = isOn ? '' : 'var(--gold)';
  btn.style.color = isOn ? '' : 'var(--ink)';
  btn.style.fontWeight = isOn ? '' : '900';
}

function selClassColor(btn){
  document.querySelectorAll('.color-btn').forEach(b => b.style.border = '2px solid transparent');
  btn.style.border = '3px solid var(--ink)';
  selectedClassColor = btn.dataset.color;
  el('class-color').value = btn.dataset.color;
}

function saveClass(){
  const name = gv('class-name');
  if(!name){ toast('반 이름을 입력하세요'); return; }
  const days = [...document.querySelectorAll('.day-btn')]
    .filter(b => b.style.background === 'var(--gold)' || b.style.background.includes('FFC800'))
    .map(b => b.dataset.day);
  const classData = {
    id: editClassId || 'cls_'+Date.now(),
    name, slot:gv('class-slot'), days,
    teacher:gv('class-teacher'), color:selectedClassColor,
    createdAt: new Date().toISOString()
  };
  if(editClassId){ CLASSES = CLASSES.map(c=>c.id===editClassId?classData:c); }
  else { CLASSES.push(classData); }
  localStorage.setItem('sa_classes', JSON.stringify(CLASSES));
  if(FB_READY&&db){ db.collection('classes').doc(classData.id).set(classData).catch(e=>{}); }
  closeM('modal-class');
  renderClassList();
  toast('✅ 반 저장 완료!');
}

function deleteClass(id){
  if(!confirm('이 반을 삭제할까요?')) return;
  CLASSES = CLASSES.filter(c=>c.id!==id);
  localStorage.setItem('sa_classes', JSON.stringify(CLASSES));
  if(FB_READY&&db){ db.collection('classes').doc(id).delete().catch(e=>{}); }
  renderClassList();
  toast('✅ 삭제 완료');
}

function openClassAttend(classId, className){
  const cls = CLASSES.find(c=>c.id===classId);
  if(!cls) return;
  classAttData = { classId, className };
  el('class-attend-title').textContent = className + ' 출결 체크';
  el('class-att-date').value = today();
  const members = STUS.filter(s => (!s.status||s.status==='active'));
  el('class-attend-rows').innerHTML = members.map(s => `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--gold-light);">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;flex-shrink:0;">${(s.name||'?')[0]}</div>
      <span style="flex:1;font-weight:700;font-size:.85rem;">${s.name}</span>
      <div style="display:flex;gap:.3rem;">
        <button class="btn btn-sm" id="ca-p-${s.id}" onclick="setCA('${s.id}','present')"
          style="background:#E8F5E9;color:#2E7D32;border:2px solid #A5D6A7;font-weight:700;padding:.2rem .5rem;">○</button>
        <button class="btn btn-sm" id="ca-a-${s.id}" onclick="setCA('${s.id}','absent')"
          style="font-weight:700;padding:.2rem .5rem;">✕</button>
        <button class="btn btn-sm" id="ca-l-${s.id}" onclick="setCA('${s.id}','late')"
          style="font-weight:700;padding:.2rem .5rem;">△</button>
      </div>
      <input type="hidden" id="ca-att-${s.id}" value="present">
    </div>`).join('');
  el('class-attend-card').style.display = 'block';
  el('class-attend-card').scrollIntoView({behavior:'smooth'});
}

function setCA(stuId, att){
  ['p','a','l'].forEach(t => {
    const b = el('ca-'+t+'-'+stuId);
    if(b){ b.style.background='';b.style.color='';b.style.border=''; }
  });
  const btn = el('ca-'+att[0]+'-'+stuId);
  if(btn){
    if(att==='present'){btn.style.background='#E8F5E9';btn.style.color='#2E7D32';btn.style.border='2px solid #A5D6A7';}
    else if(att==='absent'){btn.style.background='#FFEBEE';btn.style.color='#C62828';btn.style.border='2px solid #EF9A9A';}
    else{btn.style.background='#FFF3E0';btn.style.color='#E65100';btn.style.border='2px solid #FFCC80';}
  }
  const h = el('ca-att-'+stuId);
  if(h) h.value = att;
}

function setAllAttend(att){
  STUS.filter(s=>!s.status||s.status==='active').forEach(s => setCA(s.id, att));
}

async function saveClassAttend(){
  const date = el('class-att-date')?.value || today();
  const members = STUS.filter(s=>!s.status||s.status==='active');
  if(!members.length){ toast('원생이 없어요'); return; }
  showOv('출결 저장 중…');
  for(const s of members){
    const att = el('ca-att-'+s.id)?.value || 'present';
    const existing = DB.findIndex(r => r.date===date && r.studentId===s.id);
    const rec = { date, studentName:s.name, studentId:s.id, attendance:att,
      teacher:CP?.name||'', createdAt:new Date().toISOString() };
    if(existing>=0){ DB[existing] = {...DB[existing], ...rec}; }
    else { DB.push(rec); }
  }
  localStorage.setItem('sa_db', JSON.stringify(DB));
  if(FB_READY&&db){
    for(const s of members){
      const rec = DB.find(r=>r.date===date&&r.studentId===s.id);
      if(rec) await db.collection('records').add(rec).catch(e=>{});
    }
  }
  hideOv();
  toast('✅ 출결 저장 완료!');
  renderHome();
}

// ════════════════════════════════════════════
//  기능3: 출석 달력 직접 수정
// ════════════════════════════════════════════
let calEditDate = '', calEditStuId = '', calEditRecIdx = -1;

function openCalEdit(date, stuId, stuName){
  calEditDate = date; calEditStuId = stuId;
  const existing = DB.findIndex(r => r.date===date && (r.studentId===stuId || r.studentName===stuName));
  calEditRecIdx = existing;
  const rec = existing>=0 ? DB[existing] : null;
  el('cal-edit-title').textContent = stuName + ' · ' + date;
  el('cal-edit-info').innerHTML = `<strong>${stuName}</strong>의 ${date} 수업 기록을 수정해요`;
  const att = rec?.attendance || 'present';
  el('cal-edit-att').value = att;
  selAttEdit(att, document.querySelector(`.att-sel-btn[data-att="${att}"]`));
  sv('cal-edit-work', rec?.workName||'');
  sv('cal-edit-num', rec?.workNum||'');
  sv('cal-edit-memo', rec?.memo||'');
  el('cal-edit-star').value = rec?.completion||0;
  document.querySelectorAll('.star-btn').forEach(b => b.style.background = '');
  if(rec?.completion) selStar(rec.completion);
  el('cal-edit-del-btn').style.display = existing>=0 ? '' : 'none';
  el('modal-cal-edit').classList.add('show');
}

function selAttEdit(att, btn){
  document.querySelectorAll('.att-sel-btn').forEach(b => {
    b.style.background='#fff';b.style.color='var(--muted)';b.style.border='1px solid var(--border)';
  });
  if(!btn) return;
  if(att==='present'){btn.style.background='#E8F5E9';btn.style.color='#2E7D32';btn.style.border='2px solid #A5D6A7';}
  else if(att==='absent'){btn.style.background='#FFEBEE';btn.style.color='#C62828';btn.style.border='2px solid #EF9A9A';}
  else{btn.style.background='#FFF3E0';btn.style.color='#E65100';btn.style.border='2px solid #FFCC80';}
  el('cal-edit-att').value = att;
}

function selStar(val){
  document.querySelectorAll('.star-btn').forEach(b => {
    b.style.background = parseInt(b.dataset.v)<=val ? 'var(--gold-pale)' : '';
    b.style.fontWeight = parseInt(b.dataset.v)<=val ? '900' : '';
  });
  el('cal-edit-star').value = val;
}

async function saveCalEdit(){
  const date = calEditDate;
  const stuId = calEditStuId;
  const stu = STUS.find(s=>s.id===stuId);
  const rec = {
    date, studentId:stuId, studentName:stu?.name||'',
    attendance: el('cal-edit-att').value,
    workName: gv('cal-edit-work'),
    workNum: parseInt(gv('cal-edit-num')||1),
    completion: parseInt(el('cal-edit-star').value||0),
    memo: gv('cal-edit-memo'),
    teacher: CP?.name||'',
    updatedAt: new Date().toISOString()
  };
  if(calEditRecIdx>=0){ DB[calEditRecIdx] = {...DB[calEditRecIdx], ...rec}; }
  else { DB.push(rec); }
  localStorage.setItem('sa_db', JSON.stringify(DB));
  if(FB_READY&&db){
    try{ await db.collection('records').add(rec); }catch(e){}
  }
  closeM('modal-cal-edit');
  renderCal();
  renderHome();
  toast('✅ 출결 수정 완료!');
}

async function deleteCalRecord(){
  if(!confirm('이 기록을 삭제할까요?')) return;
  if(calEditRecIdx>=0){ DB.splice(calEditRecIdx,1); }
  localStorage.setItem('sa_db', JSON.stringify(DB));
  closeM('modal-cal-edit');
  renderCal();
  toast('✅ 삭제 완료');
}

// ════════════════════════════════════════════
//  기능4: 수업일지 전용 양식 출력
// ════════════════════════════════════════════
function printJournalTemplate(){
  const activeStus = STUS.filter(s=>!s.status||s.status==='active').slice(0,20);
  const rows = activeStus.length > 0
    ? activeStus.map(s=>`<tr><td style="padding:6px 8px;border:1px solid #ccc;font-weight:bold;">${s.name}</td><td style="padding:6px 8px;border:1px solid #ccc;text-align:center;font-size:18px;">○</td><td style="padding:6px 8px;border:1px solid #ccc;"></td><td style="padding:6px 8px;border:1px solid #ccc;text-align:center;"></td><td style="padding:6px 8px;border:1px solid #ccc;"></td></tr>`).join('')
    : [1,2,3,4,5,6,7,8,9,10].map(()=>`<tr><td style="padding:10px 8px;border:1px solid #ccc;"></td><td style="padding:10px 8px;border:1px solid #ccc;text-align:center;"></td><td style="padding:10px 8px;border:1px solid #ccc;"></td><td style="padding:10px 8px;border:1px solid #ccc;text-align:center;"></td><td style="padding:10px 8px;border:1px solid #ccc;"></td></tr>`).join('');

  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>수업일지 양식</title>
  <style>body{font-family:'Malgun Gothic',sans-serif;padding:20px;max-width:800px;margin:0 auto;}
  h2{text-align:center;font-size:18px;margin-bottom:4px;}
  .meta{display:flex;gap:20px;margin-bottom:12px;font-size:13px;}
  .meta span{border-bottom:1px solid #000;min-width:120px;padding:2px 6px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{background:#f0f0f0;padding:7px 8px;border:1px solid #ccc;text-align:center;}
  .footer{margin-top:12px;display:flex;justify-content:space-between;font-size:12px;color:#666;}
  .top-actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-bottom:12px;}
  .top-actions button{padding:8px 14px;border:none;border-radius:7px;font-weight:800;cursor:pointer;font-size:13px;}
  .btn-print{background:#FFC800;color:#1a1a1a;}.btn-close{background:#555;color:#fff;}
  @media print{.no-print,button{display:none!important;} body{padding:12px;}}
  </style></head><body>
  <div class="top-actions no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 인쇄</button>
    <button class="btn-close" onclick="window.close()">✕ 닫기</button>
  </div>
  <h2>${CFG.name||'솔브아트'} 미술학원 — 수업일지</h2>
  <div class="meta">
    <span>날짜: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
    <span>시간대: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
    <span>선생님: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
  </div>
  <table>
    <thead><tr>
      <th style="width:80px;">이름</th>
      <th style="width:50px;">출결<br><small>○/✕/△</small></th>
      <th>작품명</th>
      <th style="width:50px;">회차</th>
      <th style="width:80px;">완성도<br><small>★1~5</small></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>* 출결: ○출석 ✕결석 △지각</span>
    <span>* 완성도: ★시작 ★★밑색 ★★★명암 ★★★★마무리 ★★★★★완성</span>
  </div>
  <div class="no-print" style="margin-top:10px;text-align:center;display:flex;gap:8px;justify-content:center;">
    <button onclick="window.print()" style="padding:8px 24px;background:#FFC800;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;">🖨️ 인쇄</button>
    <button onclick="window.close()" style="padding:8px 24px;background:#555;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;">✕ 닫기</button>
  </div>
  </body></html>`);
  w.document.close();
}

// ════════════════════════════════════════════
//  기능5: 학부모 알림 설정
// ════════════════════════════════════════════
let NOTIFY_CFG = JSON.parse(localStorage.getItem('sa_notify')||'{}');

function toggleNotifySettings(){
  const type = gv('notify-type');
  el('notify-kakao-wrap').style.display = type==='kakao' ? 'block' : 'none';
  el('notify-sms-wrap').style.display = type==='sms' ? 'block' : 'none';
  el('notify-none-msg').style.display = type==='none' ? 'block' : 'none';
}

function saveNotifySettings(){
  NOTIFY_CFG = {
    type: gv('notify-type'),
    kakaoKey: gv('notify-kakao-key')||'',
    kakaoProfile: gv('notify-kakao-profile')||'',
    smsKey: gv('notify-sms-key')||'',
    smsFrom: gv('notify-sms-from')||'',
  };
  localStorage.setItem('sa_notify', JSON.stringify(NOTIFY_CFG));
  if(FB_READY&&db){ db.collection('config').doc('notify').set(NOTIFY_CFG).catch(e=>{}); }
  toast('✅ 알림 설정 저장 완료!');
}

// 원생 카드에서 알림 발송 버튼
async function sendNotifyToParent(stuId, type){
  const stu = STUS.find(s=>s.id===stuId);
  if(!stu){ toast('원생 정보 없음'); return; }
  if(!stu.phone){ toast('연락처가 없어요. 원생 정보를 수정해주세요.'); return; }
  if(!NOTIFY_CFG.type || NOTIFY_CFG.type==='none'){
    toast('⚠️ 알림 설정이 없어요. 관리자 > 설정에서 알림을 설정하세요.'); return;
  }
  const yr=new Date().getFullYear(),cm=new Date().getMonth()+1;
  const paid=JSON.parse(localStorage.getItem('pay_'+stuId+'_'+yr)||'{}')[cm];
  let msg = '';
  if(type==='fee'){
    msg = `[${CFG.name||'솔브아트'}] ${stu.name} 학생의 ${cm}월 수강료(${stu.fee||''}원) 납부를 부탁드립니다.`;
  } else if(type==='absent'){
    msg = `[${CFG.name||'솔브아트'}] ${stu.name} 학생이 오늘(${today()}) 결석했습니다.`;
  }
  // 실제 발송은 백엔드 필요 - 현재는 메시지 미리보기 제공
  if(confirm('아래 메시지를 발송할까요?\n\n'+msg+'\n\n→ 수신: '+stu.phone)){
    toast('📲 알림 발송 준비 완료 (백엔드 연동 후 실제 발송)');
  }
}

// aTab에서 notify 설정 로드
// ════════════════════════════════════════════
//  매입매출 관리
// ════════════════════════════════════════════
let FINANCE = JSON.parse(localStorage.getItem('sa_finance')||'[]');
let finFilter = 'all';
let currentFinTab = 'income';

const EXP_TYPE_LABELS = {
  salary:'급여',material:'재료/소모품',utility:'공과금',rent:'임대료',
  insurance:'보험료',marketing:'광고/홍보',meal:'식대',transport:'교통비',etc:'기타'
};
const INC_TYPE_LABELS = {tuition:'수강료',material:'재료비',etc:'기타'};
const METHOD_LABELS = {cash:'현금',card:'카드',transfer:'계좌이체'};

function initFinance(){
  // 연도/월 셀렉트 초기화
  const yrSel=el('fin-year');
  if(yrSel&&!yrSel.options.length){
    const now=new Date().getFullYear();
    for(let y=now-1;y<=now+1;y++)
      yrSel.innerHTML+=`<option value="${y}" ${y===now?'selected':''}>${y}년</option>`;
  }
  const mSel=el('fin-month');
  if(mSel) mSel.value=new Date().getMonth()+1;
  // 기본 날짜 설정
  sv('inc-date',today());sv('exp-date',today());
  loadFinance();
}

function loadFinance(){
  const yr=parseInt(gv('fin-year')||new Date().getFullYear());
  const mo=parseInt(gv('fin-month')||new Date().getMonth()+1);
  const prefix=`${yr}-${String(mo).padStart(2,'0')}`;
  const monthData=FINANCE.filter(f=>f.date?.startsWith(prefix));
  const income=monthData.filter(f=>f.kind==='income').reduce((s,f)=>s+(f.amount||0),0);
  const expense=monthData.filter(f=>f.kind==='expense').reduce((s,f)=>s+(f.amount||0),0);
  const profit=income-expense;
  if(el('fin-income-total'))el('fin-income-total').textContent=income.toLocaleString()+'원';
  if(el('fin-expense-total'))el('fin-expense-total').textContent=expense.toLocaleString()+'원';
  if(el('fin-profit-total')){
    el('fin-profit-total').textContent=(profit>=0?'+':'')+profit.toLocaleString()+'원';
    el('fin-profit-total').style.color=profit>=0?'#2E7D32':'#C62828';
  }
  renderFinList();
}

function finTab(id,btn){
  document.querySelectorAll('.tabs .fin-filter, #at-finance .tabs .tab').forEach(t=>t.classList.remove('on'));
  if(btn)btn.classList.add('on');
  ['income','expense','upload','list'].forEach(t=>{
    const e=el('fin-'+t);if(e)e.style.display='none';
  });
  const target=el('fin-'+id);if(target)target.style.display='block';
  currentFinTab=id;
  if(id==='list')renderFinList();
}

function addFinanceItem(kind){
  const isIncome=kind==='income';
  const date=gv(isIncome?'inc-date':'exp-date');
  const type=gv(isIncome?'inc-type':'exp-type');
  const desc=gv(isIncome?'inc-desc':'exp-desc');
  const amount=parseInt(gv(isIncome?'inc-amount':'exp-amount')||0);
  const method=gv(isIncome?'inc-method':'exp-method');
  const memo=gv(isIncome?'inc-memo':'exp-memo');
  if(!date||!amount){toast('날짜와 금액을 입력하세요');return;}
  const item={
    id:'fin_'+Date.now(),kind,date,type,desc,amount,method,memo,
    createdAt:new Date().toISOString(),createdBy:CU?.uid||''
  };
  FINANCE.push(item);
  localStorage.setItem('sa_finance',JSON.stringify(FINANCE));
  if(FB_READY&&db){db.collection('finance').doc(item.id).set(item).catch(e=>{});}
  toast(`✅ ${isIncome?'매출':'경비'} ${amount.toLocaleString()}원 등록!`);
  // 입력 초기화
  sv(isIncome?'inc-amount':'exp-amount','');
  sv(isIncome?'inc-desc':'exp-desc','');
  sv(isIncome?'inc-memo':'exp-memo','');
  loadFinance();
}

function deleteFinItem(id){
  if(!confirm('이 항목을 삭제할까요?'))return;
  FINANCE=FINANCE.filter(f=>f.id!==id);
  localStorage.setItem('sa_finance',JSON.stringify(FINANCE));
  if(FB_READY&&db){db.collection('finance').doc(id).delete().catch(e=>{});}
  toast('✅ 삭제 완료');loadFinance();
}

function setFinFilter(filter,btn){
  finFilter=filter;
  document.querySelectorAll('.fin-filter').forEach(b=>{
    b.style.fontWeight='500';b.style.opacity='.7';
  });
  if(btn){btn.style.fontWeight='900';btn.style.opacity='1';}
  renderFinList();
}

function renderFinList(){
  const wrap=el('fin-list-wrap');if(!wrap)return;
  const yr=parseInt(gv('fin-year')||new Date().getFullYear());
  const mo=parseInt(gv('fin-month')||new Date().getMonth()+1);
  const prefix=`${yr}-${String(mo).padStart(2,'0')}`;
  let data=FINANCE.filter(f=>f.date?.startsWith(prefix));
  if(finFilter!=='all')data=data.filter(f=>f.kind===finFilter);
  data.sort((a,b)=>b.date>a.date?1:-1);
  if(!data.length){wrap.innerHTML='<div style="text-align:center;padding:2rem;color:var(--muted);font-size:.78rem;">내역이 없어요</div>';return;}
  // 날짜별 그룹
  const groups={};
  data.forEach(f=>{if(!groups[f.date])groups[f.date]=[];groups[f.date].push(f);});
  wrap.innerHTML=Object.entries(groups).sort((a,b)=>b[0]>a[0]?1:-1).map(([date,items])=>{
    const dayIncome=items.filter(f=>f.kind==='income').reduce((s,f)=>s+f.amount,0);
    const dayExpense=items.filter(f=>f.kind==='expense').reduce((s,f)=>s+f.amount,0);
    return `<div style="margin-bottom:.8rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem .5rem;background:var(--gold-pale);border-radius:6px;margin-bottom:.3rem;">
        <strong style="font-size:.78rem;">${date}</strong>
        <div style="font-size:.68rem;">
          ${dayIncome?`<span style="color:#2E7D32;font-weight:700;">+${dayIncome.toLocaleString()}</span>`:''}
          ${dayExpense?`<span style="color:#C62828;font-weight:700;margin-left:.3rem;">-${dayExpense.toLocaleString()}</span>`:''}
        </div>
      </div>
      ${items.map(f=>`<div style="display:flex;align-items:center;gap:.5rem;padding:.38rem .4rem;border-bottom:1px dotted var(--gold-light);font-size:.74rem;">
        <span style="font-size:.9rem;">${f.kind==='income'?'💚':'🔴'}</span>
        <div style="flex:1;">
          <div style="font-weight:700;">${f.desc||f.type} <span style="font-size:.65rem;color:var(--muted);font-weight:400;">${(f.kind==='income'?INC_TYPE_LABELS:EXP_TYPE_LABELS)[f.type]||f.type}</span></div>
          <div style="font-size:.65rem;color:var(--muted);">${METHOD_LABELS[f.method]||f.method}${f.memo?' · '+f.memo:''}</div>
        </div>
        <span style="font-weight:800;color:${f.kind==='income'?'#2E7D32':'#C62828'};">${f.kind==='income'?'+':'-'}${f.amount.toLocaleString()}원</span>
        <button class="btn btn-o btn-sm" style="padding:.15rem .4rem;font-size:.6rem;" onclick="deleteFinItem('${f.id}')">삭제</button>
      </div>`).join('')}
    </div>`;
  }).join('');
}

// 영수증 OCR 추출
function extractReceipt(event){
  const file=event.target.files[0];if(!file)return;
  showOv('영수증 분석 중…');
  const reader=new FileReader();
  reader.onload=async(e)=>{
    // 실제로는 Google Vision API 사용 - 여기서는 파일명/날짜로 시범 추출
    hideOv();
    sv('exp-date',today());
    toast('📸 영수증 업로드 완료! 내용을 확인 후 등록하세요');
    // 이미지 미리보기
    const preview=document.createElement('img');
    preview.src=e.target.result;
    preview.style.cssText='width:100%;border-radius:8px;margin-top:.5rem;max-height:200px;object-fit:contain;';
    const receiptZone=document.querySelector('[onclick="document.getElementById(\'receipt-img\').click()"]');
    if(receiptZone){
      const existing=receiptZone.querySelector('img');
      if(existing)existing.remove();
      receiptZone.appendChild(preview);
    }
  };
  reader.readAsDataURL(file);
}

// 카드 내역서 Excel 업로드
async function uploadCardExcel(event){
  const file=event.target.files[0];if(!file)return;
  el('card-upload-result').textContent='파일 분석 중...';
  try{
    const data=await readExcelFile(file);
    const items=parseCardExcel(data);
    items.forEach(item=>{FINANCE.push(item);});
    localStorage.setItem('sa_finance',JSON.stringify(FINANCE));
    if(FB_READY&&db){
      const batch=db.batch();
      items.forEach(item=>batch.set(db.collection('finance').doc(item.id),item));
      await batch.commit().catch(e=>{});
    }
    el('card-upload-result').textContent=`✅ ${items.length}건 불러오기 완료!`;
    el('card-upload-result').style.color='var(--sage)';
    loadFinance();
    toast(`✅ 카드내역 ${items.length}건 등록!`);
  }catch(e){
    el('card-upload-result').textContent='❌ 파일 읽기 실패: '+e.message;
    el('card-upload-result').style.color='var(--accent)';
  }
}

// 은행 이체 내역 Excel
async function uploadBankExcel(event){
  const file=event.target.files[0];if(!file)return;
  el('bank-upload-result').textContent='파일 분석 중...';
  try{
    const data=await readExcelFile(file);
    const items=parseBankExcel(data);
    items.forEach(item=>{FINANCE.push(item);});
    localStorage.setItem('sa_finance',JSON.stringify(FINANCE));
    if(FB_READY&&db){
      const batch=db.batch();
      items.forEach(item=>batch.set(db.collection('finance').doc(item.id),item));
      await batch.commit().catch(e=>{});
    }
    el('bank-upload-result').textContent=`✅ ${items.length}건 불러오기 완료!`;
    el('bank-upload-result').style.color='var(--sage)';
    loadFinance();
    toast(`✅ 은행내역 ${items.length}건 등록!`);
  }catch(e){
    el('bank-upload-result').textContent='❌ 파일 읽기 실패: '+e.message;
    el('bank-upload-result').style.color='var(--accent)';
  }
}

// 영수증 다중 업로드
async function uploadMultiReceipts(event){
  const files=event.target.files;
  el('receipts-upload-result').textContent=`${files.length}장 처리 중...`;
  let cnt=0;
  for(const file of files){
    const item={
      id:'fin_'+Date.now()+'_'+cnt,kind:'expense',
      date:today(),type:'etc',
      desc:file.name.replace(/\.[^.]+$/,''),
      amount:0,method:'card',memo:'영수증 업로드',
      createdAt:new Date().toISOString(),createdBy:CU?.uid||''
    };
    FINANCE.push(item);cnt++;
  }
  localStorage.setItem('sa_finance',JSON.stringify(FINANCE));
  el('receipts-upload-result').textContent=`✅ ${cnt}건 등록 (금액 확인 필요)`;
  el('receipts-upload-result').style.color='var(--sage)';
  toast(`✅ 영수증 ${cnt}장 등록! 금액을 확인해주세요`);
  loadFinance();
}

// Excel 파일 읽기 (SheetJS)
function readExcelFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        resolve(data);
      }catch(err){reject(err);}
    };
    reader.onerror=()=>reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

// 카드 내역 파싱 (일반적인 한국 카드사 형식)
function parseCardExcel(rows){
  const items=[];
  rows.forEach((row,i)=>{
    if(i===0)return; // 헤더 스킵
    // 날짜/가맹점/금액 컬럼 자동 감지
    let date='',desc='',amount=0,method='card';
    row.forEach((cell,ci)=>{
      const str=String(cell||'').trim();
      // 날짜 패턴: 2024-04-15 또는 2024.04.15
      if(/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(str)&&!date){
        date=str.replace(/\./g,'-').replace(/(\d{4})-(\d{1,2})-(\d{1,2}).*/,'$1-'+('0'+'$2').slice(-2)+'-'+('0'+'$3').slice(-2));
      }
      // 금액 패턴: 숫자 (콤마 포함)
      const num=parseInt(str.replace(/,/g,''));
      if(!isNaN(num)&&num>0&&num<100000000&&!amount&&str.length>2)amount=num;
      // 가맹점명: 숫자/날짜 아닌 한글/영문
      if(str.length>1&&!/^\d+$/.test(str)&&!/^\d{4}/.test(str)&&!desc&&ci>0)desc=str;
    });
    if(date&&amount){
      items.push({
        id:'fin_card_'+Date.now()+'_'+i,kind:'expense',
        date,type:'etc',desc:desc||'카드결제',
        amount,method:'card',memo:'카드내역 업로드',
        createdAt:new Date().toISOString(),createdBy:CU?.uid||''
      });
    }
  });
  return items;
}

// 은행 이체 내역 파싱
function parseBankExcel(rows){
  const items=[];
  rows.forEach((row,i)=>{
    if(i===0)return;
    let date='',desc='',amount=0,kind='expense';
    row.forEach((cell,ci)=>{
      const str=String(cell||'').trim();
      if(/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(str)&&!date){
        date=str.replace(/\./g,'-').slice(0,10);
      }
      const num=parseInt(str.replace(/,/g,''));
      if(!isNaN(num)&&num>0&&num<100000000&&!amount)amount=num;
      if(str.length>1&&!/^\d+$/.test(str)&&!/^\d{4}/.test(str)&&!desc&&ci>0)desc=str;
    });
    // 입금/출금 구분 시도 (컬럼 위치로)
    if(row.length>=4){
      const c2=parseInt(String(row[2]||'').replace(/,/g,''));
      const c3=parseInt(String(row[3]||'').replace(/,/g,''));
      if(!isNaN(c2)&&c2>0){kind='expense';amount=c2;}
      if(!isNaN(c3)&&c3>0){kind='income';amount=c3;}
    }
    if(date&&amount){
      items.push({
        id:'fin_bank_'+Date.now()+'_'+i,kind,
        date,type:kind==='income'?'tuition':'etc',
        desc:desc||'은행이체',amount,method:'transfer',
        memo:'은행내역 업로드',
        createdAt:new Date().toISOString(),createdBy:CU?.uid||''
      });
    }
  });
  return items;
}

// CSV 내보내기
function exportFinanceCSV(){
  const yr=gv('fin-year')||new Date().getFullYear();
  const mo=gv('fin-month')||new Date().getMonth()+1;
  const prefix=yr+'-'+String(mo).padStart(2,'0');
  const data=FINANCE.filter(f=>f.date&&f.date.startsWith(prefix));
  const rows=['날짜,구분,유형,내용,금액,결제수단,메모'];
  data.forEach(f=>{
    const row=[f.date,(f.kind==='income'?'매출':'경비'),f.type||'',(f.desc||''),(f.amount||0),(f.method||''),(f.memo||'')].join(',');
    rows.push(row);
  });
  const sep='\n';
  const blob=new Blob([rows.join(sep)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='매입매출_'+yr+'년'+mo+'월.csv';a.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV 다운로드 완료!');
}

// Firestore에서 finance 데이터 로드
async function loadFinanceFromDB(){
  if(!FB_READY||!db)return;
  try{
    const snap=await db.collection('finance').get();
    const dbItems=[];
    snap.forEach(doc=>dbItems.push({id:doc.id,...doc.data()}));
    // 로컬과 병합
    const localIds=new Set(FINANCE.map(f=>f.id));
    dbItems.forEach(item=>{if(!localIds.has(item.id))FINANCE.push(item);});
    localStorage.setItem('sa_finance',JSON.stringify(FINANCE));
  }catch(e){console.warn('Finance 로드 오류:',e);}
}

// ════════════════════════════════════════════
//  급여 관리
// ════════════════════════════════════════════
let currentSalaryUid = '';
let salaryProfileData = {};

function loadSalaryTeachers(){
  const sel = el('salary-stu-sel');
  if(!sel) return;
  // Firestore에서 선생님 목록 로드
  if(FB_READY&&db){
    db.collection('users').get().then(snap=>{
      sel.innerHTML='<option value="">-- 선생님 선택 --</option>';
      snap.forEach(doc=>{
        const d=doc.data();
        if(d.role!=='admin'){
          sel.innerHTML+=`<option value="${doc.id}">${d.name||d.email}</option>`;
        }
      });
    });
  }
  // 연도 셀렉트
  const yrSel=el('salary-year');
  if(yrSel&&!yrSel.options.length){
    const now=new Date().getFullYear();
    for(let y=now-1;y<=now+1;y++)yrSel.innerHTML+=`<option value="${y}" ${y===now?'selected':''}>${y}년</option>`;
  }
  // 현재 월 기본 선택
  const mSel=el('salary-month');
  if(mSel) mSel.value=new Date().getMonth()+1;
}

function loadSalaryInfo(){
  currentSalaryUid=gv('salary-stu-sel');
  if(!currentSalaryUid){
    el('salary-profile-card').style.display='none';
    el('salary-calc-card').style.display='none';
    el('salary-history-card').style.display='none';
    return;
  }
  el('salary-profile-card').style.display='block';
  el('salary-calc-card').style.display='block';
  el('salary-history-card').style.display='block';

  // 신상명세 로드
  const key='salary_profile_'+currentSalaryUid;
  salaryProfileData=JSON.parse(localStorage.getItem(key)||'{}');
  renderSalaryProfile();

  // 급여 기록 로드
  loadSalaryHistory();

  // 최저임금 기본값
  if(!el('sal-hourly').value) el('sal-hourly').value=10030;
  if(!el('sal-hours').value) el('sal-hours').value=8;
  if(!el('sal-days').value) el('sal-days').value=22;
  calcSalary();
}

function renderSalaryProfile(){
  const d=salaryProfileData;
  const view=el('salary-profile-view');
  if(!view)return;
  if(Object.keys(d).length===0){
    view.innerHTML='<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.78rem;">신상명세를 등록하세요</div>';
    return;
  }
  // 근속 연수 계산
  let tenure='';
  if(d.joinDate){
    const ms=new Date()-new Date(d.joinDate);
    const years=Math.floor(ms/1000/60/60/24/365);
    const months=Math.floor((ms/1000/60/60/24%365)/30);
    tenure=`${years}년 ${months}개월`;
  }
  view.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;font-size:.76rem;">
      ${d.birth?`<div><span style="color:var(--muted);">생년월일</span><br><strong>${d.birth}</strong></div>`:''}
      ${d.gender?`<div><span style="color:var(--muted);">성별</span><br><strong>${d.gender}</strong></div>`:''}
      ${d.edu?`<div><span style="color:var(--muted);">학력</span><br><strong>${d.edu}</strong></div>`:''}
      ${d.major?`<div><span style="color:var(--muted);">전공</span><br><strong>${d.major}</strong></div>`:''}
      ${d.phone?`<div><span style="color:var(--muted);">연락처</span><br><strong>${d.phone}</strong></div>`:''}
      ${d.joinDate?`<div><span style="color:var(--muted);">입사일</span><br><strong>${d.joinDate}</strong><br><span style="color:var(--blue);font-size:.68rem;">근속 ${tenure}</span></div>`:''}
      ${d.bank?`<div><span style="color:var(--muted);">계좌</span><br><strong>${d.bank}</strong></div>`:''}
    </div>
    ${d.addr?`<div style="margin-top:.4rem;font-size:.74rem;"><span style="color:var(--muted);">주소</span><br>${d.addr}</div>`:''}
    ${d.career?`<div style="margin-top:.4rem;font-size:.74rem;"><span style="color:var(--muted);">경력</span><br>${d.career}</div>`:''}`;
}

function toggleSalaryProfile(){
  const edit=el('salary-profile-edit');
  const isOpen=edit.style.display!=='none';
  if(!isOpen){
    // 편집 모드 열기
    const d=salaryProfileData;
    sv('sp-birth',d.birth||'');sv('sp-gender',d.gender||'');
    sv('sp-edu',d.edu||'');sv('sp-major',d.major||'');
    sv('sp-addr',d.addr||'');sv('sp-phone',d.phone||'');
    sv('sp-career',d.career||'');sv('sp-join',d.joinDate||'');
    sv('sp-bank',d.bank||'');
    edit.style.display='block';
  } else {
    edit.style.display='none';
  }
}

function saveSalaryProfile(){
  salaryProfileData={
    birth:gv('sp-birth'),gender:gv('sp-gender'),
    edu:gv('sp-edu'),major:gv('sp-major'),
    addr:gv('sp-addr'),phone:gv('sp-phone'),
    career:gv('sp-career'),joinDate:gv('sp-join'),
    bank:gv('sp-bank'),updatedAt:new Date().toISOString()
  };
  const key='salary_profile_'+currentSalaryUid;
  localStorage.setItem(key,JSON.stringify(salaryProfileData));
  if(FB_READY&&db){
    db.collection('users').doc(currentSalaryUid).update({profile:salaryProfileData}).catch(e=>{});
  }
  renderSalaryProfile();
  el('salary-profile-edit').style.display='none';
  toast('✅ 신상명세 저장 완료');
}

// 이력서 이미지 OCR (데모 - 실제는 AI 연동 필요)
function extractResume(event){
  const file=event.target.files[0];
  if(!file)return;
  toast('📄 이력서 분석 중... (기능 준비 중)');
  // 실제 구현 시 Google Vision API 또는 Tesseract.js 사용
}

function calcSalary(){
  const hourly=parseFloat(el('sal-hourly')?.value||0);
  const hours=parseFloat(el('sal-hours')?.value||0);
  const days=parseFloat(el('sal-days')?.value||0);
  const extraDays=parseFloat(el('sal-extra-days')?.value||0);
  const extraHours=parseFloat(el('sal-extra-hours')?.value||0);
  const bonus=parseFloat(el('sal-bonus')?.value||0);
  const annualDays=parseFloat(el('sal-annual')?.value||0);
  const leaveDays=parseFloat(el('sal-leave')?.value||0);
  const absentDays=parseFloat(el('sal-absent')?.value||0);

  if(!hourly||!hours||!days){
    if(el('sal-base-result'))el('sal-base-result').textContent='0원';
    return;
  }

  // 기본급 계산
  const actualDays=days-leaveDays-absentDays;
  const basePay=Math.round(hourly*hours*actualDays);

  // 추가근무수당 (1.5배)
  const extraPay=Math.round(hourly*1.5*extraHours*extraDays);

  // 연차수당
  const annualPay=Math.round(hourly*hours*annualDays);

  // 총 지급액
  const totalGross=basePay+extraPay+bonus+annualPay;

  if(el('sal-base-result'))el('sal-base-result').textContent=basePay.toLocaleString()+'원';

  // 4대보험 계산
  const getRate=(id)=>parseFloat(el(id)?.value||0)/100;
  const insItems=[
    {name:'국민연금',ee:'ins-pension-ee',er:'ins-pension-er',amtId:'ins-pension-amt'},
    {name:'건강보험',ee:'ins-health-ee',er:'ins-health-er',amtId:'ins-health-amt'},
    {name:'장기요양',ee:'ins-care-ee',er:'ins-care-er',amtId:'ins-care-amt'},
    {name:'고용보험',ee:'ins-employ-ee',er:'ins-employ-er',amtId:'ins-employ-amt'},
    {name:'산재보험',ee:null,er:'ins-indus-er',amtId:'ins-indus-amt'},
  ];

  let totalEE=0,totalER=0;
  insItems.forEach(ins=>{
    const eeRate=ins.ee?getRate(ins.ee):0;
    const erRate=getRate(ins.er);
    const eeAmt=Math.round(totalGross*eeRate);
    const erAmt=Math.round(totalGross*erRate);
    totalEE+=eeAmt;totalER+=erAmt;
    if(el(ins.amtId))el(ins.amtId).textContent=(eeAmt+erAmt).toLocaleString()+'원';
  });

  // 퇴사 처리 시 일할계산
  let finalPay=totalGross-totalEE;
  const resignCheck=el('sal-resign');
  if(resignCheck?.checked){
    el('sal-resign-date-wrap').style.display='flex';
    const resignDate=gv('sal-resign-date');
    if(resignDate){
      const d=new Date(resignDate);
      const yr=parseInt(gv('salary-year')||new Date().getFullYear());
      const mo=parseInt(gv('salary-month')||new Date().getMonth()+1);
      const daysInMonth=new Date(yr,mo,0).getDate();
      const workedDays=d.getDate();
      finalPay=Math.round(finalPay*(workedDays/daysInMonth));
    }
  } else {
    if(el('sal-resign-date-wrap'))el('sal-resign-date-wrap').style.display='none';
  }

  // 결과 표시
  const summary=el('sal-summary');
  if(!summary)return;
  summary.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:.4rem;">
      <div style="display:flex;justify-content:space-between;font-size:.78rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.1);">
        <span style="color:rgba(255,255,255,.7);">기본급</span><span style="font-weight:700;">${basePay.toLocaleString()}원</span>
      </div>
      ${extraPay?`<div style="display:flex;justify-content:space-between;font-size:.78rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.1);">
        <span style="color:rgba(255,255,255,.7);">초과근무수당</span><span style="font-weight:700;">+${extraPay.toLocaleString()}원</span>
      </div>`:''}
      ${bonus?`<div style="display:flex;justify-content:space-between;font-size:.78rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.1);">
        <span style="color:rgba(255,255,255,.7);">상여금</span><span style="font-weight:700;">+${bonus.toLocaleString()}원</span>
      </div>`:''}
      ${annualPay?`<div style="display:flex;justify-content:space-between;font-size:.78rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.1);">
        <span style="color:rgba(255,255,255,.7);">연차수당</span><span style="font-weight:700;">+${annualPay.toLocaleString()}원</span>
      </div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:.78rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.15);">
        <span style="color:rgba(255,255,255,.7);">총 지급액</span><span style="font-weight:800;color:var(--gold);">${totalGross.toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.78rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.1);">
        <span style="color:rgba(255,255,255,.7);">4대보험 공제 (근로자)</span><span style="color:#ff8a80;font-weight:700;">-${totalEE.toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.78rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.1);">
        <span style="color:rgba(255,255,255,.7);">사용자 부담 4대보험</span><span style="color:#80cbc4;font-weight:700;">${totalER.toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:1rem;padding:.5rem 0;margin-top:.2rem;border-top:2px solid rgba(255,200,0,.4);">
        <span style="font-weight:800;color:var(--gold);">💵 실수령액</span>
        <span style="font-size:1.3rem;font-weight:900;color:var(--gold);">${finalPay.toLocaleString()}원</span>
      </div>
    </div>`;
}

function saveSalaryRecord(){
  if(!currentSalaryUid){toast('선생님을 선택하세요');return;}
  const yr=gv('salary-year'),mo=gv('salary-month');
  const key='salary_rec_'+currentSalaryUid+'_'+yr+'_'+mo;
  const record={
    uid:currentSalaryUid,year:yr,month:mo,
    hourly:gv('sal-hourly'),hours:gv('sal-hours'),days:gv('sal-days'),
    extraDays:gv('sal-extra-days'),extraHours:gv('sal-extra-hours'),
    bonus:gv('sal-bonus'),annual:gv('sal-annual'),
    leave:gv('sal-leave'),absent:gv('sal-absent'),
    savedAt:new Date().toISOString()
  };
  localStorage.setItem(key,JSON.stringify(record));
  if(FB_READY&&db){
    db.collection('salaries').doc(key).set(record).catch(e=>{});
  }
  toast('✅ 급여 기록 저장 완료!');
  loadSalaryHistory();
}

function loadSalaryHistory(){
  const list=el('salary-history-list');
  if(!list)return;
  const prefix='salary_rec_'+currentSalaryUid+'_';
  const records=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith(prefix)){
      records.push(JSON.parse(localStorage.getItem(k)||'{}'));
    }
  }
  records.sort((a,b)=>(b.year+b.month)>(a.year+a.month)?1:-1);
  list.innerHTML=records.length?records.slice(0,6).map(r=>{
    const base=Math.round((r.hourly||0)*(r.hours||0)*(r.days||0));
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px dotted var(--gold-light);font-size:.78rem;">
      <span style="font-weight:700;">${r.year}년 ${r.month}월</span>
      <span style="color:var(--muted);">시급 ${Number(r.hourly).toLocaleString()}원 · ${r.days}일</span>
      <span style="font-weight:800;color:var(--blue);">${base.toLocaleString()}원~</span>
    </div>`;
  }).join(''):'<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.78rem;">급여 기록이 없어요</div>';
}


// ════════════════════════════════════════════
//  인라인 권한 패널
// ════════════════════════════════════════════
let inlinePerms = {}; // uid -> perms 객체

function renderPermItems(uid, perms){
  const wrap = el('perm-items-'+uid);
  if(!wrap) return;
  // 현재 권한을 복사해서 편집용으로 저장
  if(!inlinePerms[uid]) inlinePerms[uid] = Object.assign({}, DEFAULT_PERMS, perms);

  let html2 = '';
  PERM_STRUCTURE.forEach(sec => {
    html2 += `<span class="perm-section-header">${sec.section}</span>`;
    html2 += `<div class="perm-row"><span class="perm-row-label">세부 권한</span><div class="perm-row-btns">`;
    sec.items.forEach(item => {
      const isOn = inlinePerms[uid][item.key] === true;
      html2 += `<button class="perm-btn ${isOn?'on':''}" id="pbtn-${uid}-${item.key}"
        onclick="toggleInlinePerm('${uid}','${item.key}',this)">${item.label}</button>`;
    });
    html2 += `</div></div>`;
  });
  wrap.innerHTML = html2;
}

function toggleInlinePerm(uid, key, btn){
  if(!inlinePerms[uid]) inlinePerms[uid] = Object.assign({}, DEFAULT_PERMS);
  inlinePerms[uid][key] = !inlinePerms[uid][key];
  btn.className = `perm-btn ${inlinePerms[uid][key] ? 'on' : ''}`;
}

function togglePermPanel(uid, name, permsStr){
  const panel = el('ppanel-'+uid);
  const btn = panel?.previousElementSibling?.querySelector('.btn-gold');
  if(!panel) return;
  const isOpen = panel.style.display !== 'none';
  // 모든 패널 닫기
  document.querySelectorAll('.perm-panel').forEach(p => {
    p.style.display = 'none';
    const prevBtn = p.previousElementSibling?.querySelector('.btn-gold');
    if(prevBtn) prevBtn.textContent = '권한 ▼';
  });
  if(!isOpen){
    // 열기
    let perms = {};
    try{ perms = typeof permsStr === 'string' ? JSON.parse(permsStr.replace(/'/g,'"')) : permsStr; }catch(e){ perms = {}; }
    inlinePerms[uid] = Object.assign({}, DEFAULT_PERMS, perms);
    renderPermItems(uid, inlinePerms[uid]);
    panel.style.display = 'block';
    if(btn) btn.textContent = '권한 ▲';
    // 스크롤
    setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),100);
  }
}

async function saveInlinePerms(uid){
  const perms = inlinePerms[uid];
  if(!perms){ toast('권한 정보 없음'); return; }
  showOv('권한 저장 중…');
  try{
    if(FB_READY&&db){
      await db.collection('users').doc(uid).update({perms});
    } else {
      const u = JSON.parse(localStorage.getItem('sa_demo_users')||'[]');
      const t = u.find(x=>x.uid===uid);
      if(t) t.perms = perms;
      localStorage.setItem('sa_demo_users', JSON.stringify(u));
    }
    toast('✅ 권한 저장 완료!');
    // 패널 닫기
    const panel = el('ppanel-'+uid);
    if(panel) panel.style.display = 'none';
    loadTeachers();
  }catch(e){ toast('오류: '+e.message); }
  hideOv();
}

function resetToDefaultPerms(uid){
  inlinePerms[uid] = Object.assign({}, DEFAULT_PERMS);
  renderPermItems(uid, inlinePerms[uid]);
  toast('기본값으로 초기화했어요. 저장 버튼을 눌러 적용하세요.');
}

// ════════════════════════════════════════════
//  세부 권한 관리
// ════════════════════════════════════════════

function openEditPerm(uid, name, perms){
  editUid = uid;
  // 기존 권한과 기본값 병합
  editPermsObj = Object.assign({}, DEFAULT_PERMS, perms || {});
  el('perm-title').textContent = name + ' 권한 편집';
  renderPermTable();
  el('modal-perm').classList.add('show');
}

function renderPermTable(){
  const wrap = el('perm-table-wrap');
  let html2 = '<table class="perm-table"><thead><tr><th>항목</th><th>열람</th><th>등록/수정</th></tr></thead><tbody>';
  PERM_STRUCTURE.forEach(sec => {
    html2 += `<tr><td colspan="3" class="perm-section">${sec.section}</td></tr>`;
    sec.items.forEach(item => {
      // 열람 항목인지 등록/수정 항목인지 분류
      const isViewOnly = item.key.endsWith('_view') || item.key.endsWith('_print');
      const isEditOnly = item.key.endsWith('_add') || item.key.endsWith('_edit') ||
                         item.key.endsWith('_delete') || item.key.endsWith('_save') ||
                         item.key.endsWith('_upload') || item.key.endsWith('_status') ||
                         item.key.endsWith('_report');
      const val = editPermsObj[item.key] !== undefined ? editPermsObj[item.key] : false;
      const tog = `<button class="perm-toggle ${val?'on':'off'}" onclick="togglePermItem('${item.key}',this)"></button>`;
      html2 += `<tr>
        <td style="font-size:.78rem;font-weight:600;">${item.label}</td>
        <td><div class="perm-cell">${isViewOnly ? tog : (isEditOnly ? '-' : tog)}</div></td>
        <td><div class="perm-cell">${isEditOnly ? tog : (isViewOnly ? '-' : '')}</div></td>
      </tr>`;
    });
  });
  html2 += '</tbody></table>';
  wrap.innerHTML = html2;
}

function togglePermItem(key, btn){
  editPermsObj[key] = !editPermsObj[key];
  btn.className = `perm-toggle ${editPermsObj[key] ? 'on' : 'off'}`;
}

async function savePerms(){
  showOv('권한 저장 중…');
  try{
    const permsToSave = {...editPermsObj};
    if(FB_READY&&db){
      await db.collection('users').doc(editUid).update({perms: permsToSave});
    } else {
      const u = JSON.parse(localStorage.getItem('sa_demo_users')||'[]');
      const t = u.find(x=>x.uid===editUid);
      if(t) t.perms = permsToSave;
      localStorage.setItem('sa_demo_users', JSON.stringify(u));
    }
    toast('✅ 권한 저장 완료');
    closeM('modal-perm');
    loadTeachers();
  } catch(e){ toast('오류: '+e.message); }
  hideOv();
}

// 권한 체크 함수
function hasPerm(key){
  if(!CP) return false;
  if(CP.role === 'admin') return true; // 관리자는 모든 권한
  const perms = CP.perms || {};
  // 구버전 호환
  if(key === 'scan_upload' || key === 'scan_save') return perms.input !== false;
  if(key === 'rpt_view') return perms.report !== false || perms.view !== false;
  if(key === 'hist_view') return perms.view !== false;
  // 새 권한
  return perms[key] === true;
}

// ════════════════════════════════════════════
//  GOOGLE DRIVE 연동
// ════════════════════════════════════════════
const GDRIVE_CLIENT_ID = '757315756544-5das13kq5sfb6j4jpes9ntu8p2neruu9.apps.googleusercontent.com';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
let gapiReady=false,gisReady=false,tokenClient=null,driveAccessToken=null;
let currentDriveStuId='',currentDriveFolderId='',currentDriveStuName='';
let selectedDriveFiles=[],drivePageToken=null;

function initGapi(){
  gapi.load('client',async()=>{
    await gapi.client.init({discoveryDocs:['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']});
    gapiReady=true;
  });
}
function initGis(){
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:GDRIVE_CLIENT_ID,scope:GDRIVE_SCOPE,
    callback:(resp)=>{
      if(resp.error){toast('❌ 구글 로그인 실패');return;}
      driveAccessToken=resp.access_token;
      gapi.client.setToken({access_token:driveAccessToken});
      fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+driveAccessToken}})
        .then(r=>r.json()).then(info=>{const e=el('drive-user-email');if(e)e.textContent=info.email||'';});
      showDriveGallery();
    },
  });
  gisReady=true;
}
function signInGoogle(){
  if(!gapiReady||!gisReady){toast('⚠️ 잠시 후 다시 시도하세요');initGapi();initGis();return;}
  tokenClient.requestAccessToken({prompt:''});
}
function signOutGoogle(){
  if(driveAccessToken){google.accounts.oauth2.revoke(driveAccessToken,()=>{});driveAccessToken=null;gapi.client.setToken(null);}
  el('drive-login-section').style.display='block';
  el('drive-gallery-section').style.display='none';
  toast('✅ 로그아웃 완료');
}
function openDriveGallery(stuId,stuName,folderId){
  currentDriveStuId=stuId;currentDriveStuName=stuName;currentDriveFolderId=folderId;
  selectedDriveFiles=[];drivePageToken=null;
  el('drive-title').textContent='🖼 '+stuName+' 작품 갤러리';
  el('drive-grid').innerHTML='';
  el('drive-empty').style.display='none';
  el('drive-loading').style.display='none';
  el('drive-selected-bar').style.display='none';
  el('drive-page-info').textContent='';
  el('drive-folder-info').textContent='📁 폴더: '+folderId;
  if(driveAccessToken){
    el('drive-login-section').style.display='none';
    el('drive-gallery-section').style.display='block';
    showDriveGallery();
  } else {
    el('drive-login-section').style.display='block';
    el('drive-gallery-section').style.display='none';
    if(!gapiReady)initGapi();if(!gisReady)initGis();
  }
  el('modal-drive').classList.add('show');
}
async function showDriveGallery(){
  el('drive-login-section').style.display='none';
  el('drive-gallery-section').style.display='block';
  el('drive-loading').style.display='block';
  el('drive-grid').innerHTML='';
  try{
    const q="'"+currentDriveFolderId+"' in parents and (mimeType contains 'image/') and trashed=false";
    const resp=await gapi.client.drive.files.list({
      q,fields:'nextPageToken,files(id,name,mimeType,createdTime,thumbnailLink)',
      orderBy:'createdTime desc',pageSize:30,pageToken:drivePageToken||undefined
    });
    el('drive-loading').style.display='none';
    const files=resp.result.files||[];
    drivePageToken=resp.result.nextPageToken||null;
    if(!files.length){el('drive-empty').style.display='block';return;}
    el('drive-page-info').textContent='총 '+files.length+'장'+(drivePageToken?' (더보기 가능)':'');
    el('drive-grid').innerHTML=files.map(f=>{
      const thumb=f.thumbnailLink?f.thumbnailLink.replace('=s220','=s400'):'https://drive.google.com/thumbnail?id='+f.id+'&sz=w400';
      const date=f.createdTime?f.createdTime.slice(0,10):'';
      const oc='toggleDrivePhoto("'+f.id+'","'+f.name.replace(/"/g,"'")+'","'+thumb+'","'+date+'")';
      return '<div class="drive-photo-card" id="dpc-'+f.id+'" onclick="'+oc+'">'
        +'<img src="'+thumb+'" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:2px solid var(--gold-light);">'
        +'<div style="font-size:.6rem;color:var(--muted);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+date+'</div>'
        +'<div class="drive-check-icon" id="dchk-'+f.id+'">✓</div>'
        +'</div>';
    }).join('');
  }catch(e){
    el('drive-loading').style.display='none';
    if(e.status===401){driveAccessToken=null;el('drive-login-section').style.display='block';el('drive-gallery-section').style.display='none';toast('⚠️ 로그인이 만료됐어요');}
    else toast('❌ 사진 불러오기 실패: '+(e.result?.error?.message||e.message||''));
  }
}
function toggleDrivePhoto(id,name,thumb,date){
  const idx=selectedDriveFiles.findIndex(f=>f.id===id);
  const card=el('dpc-'+id),chk=el('dchk-'+id);
  if(idx>=0){selectedDriveFiles.splice(idx,1);if(card)card.style.outline='';if(chk)chk.style.display='none';}
  else{selectedDriveFiles.push({id,name,thumb,date});if(card)card.style.outline='3px solid var(--gold)';if(chk)chk.style.display='flex';}
  const bar=el('drive-selected-bar'),cnt=el('drive-sel-count');
  if(bar)bar.style.display=selectedDriveFiles.length?'block':'none';
  if(cnt)cnt.textContent=selectedDriveFiles.length;
}
function addSelectedToReport(){closeM('modal-drive');openEducationReport(currentDriveStuId,currentDriveStuName,selectedDriveFiles);}

function openEducationReport(stuId,stuName,photos){
  const stu=STUS.find(s=>s.id===stuId);
  const m=today().slice(0,7);
  const recs=DB.filter(r=>r.studentName===stuName&&r.date?.startsWith(m));
  const pr=recs.filter(r=>r.attendance==='present').length;
  const ab=recs.filter(r=>r.attendance==='absent').length;
  const tot=pr+ab,rate=tot?Math.round(pr/tot*100):0;
  const lessons=recs.filter(r=>r.workName).map(r=>({date:r.date?.slice(5)||'',work:r.workName,num:r.workNum||1,comp:r.completion||0}));
  const yr=new Date().getFullYear(),cm=new Date().getMonth()+1;
  const paid=stu?JSON.parse(localStorage.getItem('pay_'+stu.id+'_'+yr)||'{}')[cm]:null;

  el('rview-title').textContent=stuName+' 교육 리포트';
  el('rview-name').textContent=stuName;
  el('rview-period').textContent=m.replace('-','년 ')+'월 · 담당: '+(recs[0]?.teacher||'선생님');
  el('rview-academy').textContent=CFG.name||'솔브아트';
  el('rview-teacher').textContent=recs[0]?.teacher||'선생님';

  el('rview-attendance').innerHTML=
    '<div style="flex:1;text-align:center;background:var(--gold-pale);border:2px solid var(--gold-light);border-radius:10px;padding:.7rem .2rem;">'
    +'<div style="font-size:1.6rem;font-weight:900;color:var(--sage);">'+pr+'</div><div style="font-size:.65rem;color:var(--muted);font-weight:600;">출석</div></div>'
    +'<div style="flex:1;text-align:center;background:var(--gold-pale);border:2px solid var(--gold-light);border-radius:10px;padding:.7rem .2rem;">'
    +'<div style="font-size:1.6rem;font-weight:900;color:var(--accent);">'+ab+'</div><div style="font-size:.65rem;color:var(--muted);font-weight:600;">결석</div></div>'
    +'<div style="flex:1;text-align:center;background:var(--gold-pale);border:2px solid var(--gold-light);border-radius:10px;padding:.7rem .2rem;">'
    +'<div style="font-size:1.6rem;font-weight:900;color:var(--blue);">'+rate+'%</div><div style="font-size:.65rem;color:var(--muted);font-weight:600;">출석률</div></div>'
    +(stu?'<div style="flex:1;text-align:center;background:var(--gold-pale);border:2px solid var(--gold-light);border-radius:10px;padding:.7rem .2rem;">'
    +'<div style="font-size:.95rem;font-weight:900;color:'+(paid?'var(--sage)':'var(--accent)')+';">'+( paid?'납부':'미납')+'</div>'
    +'<div style="font-size:.65rem;color:var(--muted);font-weight:600;">수강료</div></div>':'');

  el('rview-lessons').innerHTML=lessons.length
    ?lessons.slice(-8).map(l=>'<div style="display:flex;gap:.5rem;font-size:.76rem;padding:.3rem 0;border-bottom:1px solid var(--gold-light);align-items:center;">'
      +'<span style="color:var(--muted);min-width:40px;font-size:.68rem;">'+l.date+'</span>'
      +'<span style="font-weight:700;flex:1;">'+l.work+' #'+l.num+'</span>'
      +'<span style="color:var(--gold);">'+('★'.repeat(l.comp)||'-')+'</span></div>').join('')
    :'<div style="font-size:.78rem;color:var(--muted);padding:.5rem 0;">수업 기록 없음</div>';

  const photoWrap=el('rview-photos-wrap'),photoGrid=el('rview-photos');
  if(photos&&photos.length){
    photoWrap.style.display='block';
    photoGrid.innerHTML=photos.map(p=>'<div><img src="'+p.thumb+'" alt="'+p.name+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:2px solid var(--gold-light);">'
      +'<div style="font-size:.62rem;color:var(--muted);margin-top:.2rem;text-align:center;">'+p.date+'</div></div>').join('');
  } else photoWrap.style.display='none';

  el('modal-report-view').classList.add('show');
}

function openDriveHelp(){toast('📁 드라이브 폴더 열기 → 주소창 URL 끝부분 복사');window.open('https://drive.google.com','_blank');}

window.addEventListener('load',()=>{
  const wG=setInterval(()=>{if(typeof gapi!=='undefined'){clearInterval(wG);initGapi();}},300);
  const wI=setInterval(()=>{if(typeof google!=='undefined'&&google.accounts){clearInterval(wI);initGis();}},300);
});

// ════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════
function el(id){return document.getElementById(id);}
function gv(id){return el(id)?.value||'';}
function sv(id,v){const e=el(id);if(e)e.value=v||'';}
function today(){return new Date().toISOString().slice(0,10);}
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
function showOv(msg){el('ov').classList.add('show');if(msg)el('ov-msg').textContent=msg;}
function hideOv(){el('ov').classList.remove('show');}
function closeM(id){el(id).classList.remove('show');}
function shareRpt(){if(navigator.share)navigator.share({title:'솔브아트 리포트'});else toast('화면 캡처 후 카카오톡으로 공유하세요');}
function toast(msg){const t=el('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);}

