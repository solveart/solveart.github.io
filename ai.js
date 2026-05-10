// ════════════════════════════════════════════════════════════
//  솔브아트 전용 AI 모듈 (ai.js) v2
//  RAG 기반 학원 전용 AI
//  ✅ Claude.ai / ChatGPT 복사 모드 활용 (무료 API 키 불필요)
//  ✅ Claude API 직접 연동 (선택)
//  ✅ Ollama 로컬 AI (선택)
// ════════════════════════════════════════════════════════════

let AI_CFG = JSON.parse(localStorage.getItem('sa_ai_cfg') || '{}');
let aiChatHistory = [];
let aiCurrentStu = '';

// ════════════════════════════════════════════
//  컨텍스트 빌더 — 학원 데이터를 프롬프트로 변환
// ════════════════════════════════════════════
function buildAcademyContext(options = {}) {
  const { stuName = '', months = 2, includeAll = false } = options;
  const now = new Date();
  const monthsAgo = new Date(now);
  monthsAgo.setMonth(monthsAgo.getMonth() - months);

  let ctx = '';

  // 1. 학원 기본 정보
  ctx += `[학원 정보]\n`;
  ctx += `학원명: ${CFG.name||'솔브아트'} | 전화: ${CFG.phone||''}\n`;
  ctx += `수강료: 주1회 ${(CFG.feeW1||110000).toLocaleString()}원 / 주2회 ${(CFG.feeW2||130000).toLocaleString()}원 / 주3회 ${(CFG.feeW3||150000).toLocaleString()}원\n\n`;

  // 2. 원생 현황
  const activeStus = STUS.filter(s => !s.status || s.status === 'active');
  const targetStus = stuName
    ? STUS.filter(s => s.name === stuName)
    : (includeAll ? activeStus.slice(0, 15) : activeStus.slice(0, 8));

  ctx += `[원생 현황] 수강중 ${activeStus.length}명\n`;

  targetStus.forEach(s => {
    const recs = DB.filter(r =>
      r.studentName === s.name && r.date && new Date(r.date) >= monthsAgo
    ).sort((a, b) => b.date > a.date ? 1 : -1);

    ctx += `\n▶ ${s.name} (${s.grade||''} ${s.school||''}) ${s.slots?.join('·')||''}\n`;

    if (recs.length) {
      const pr = recs.filter(r => r.attendance === 'present').length;
      const ab = recs.filter(r => r.attendance === 'absent').length;
      const rate = Math.round(pr / recs.length * 100);
      const compRecs = recs.filter(r => r.completion > 0);
      const avgC = compRecs.length
        ? (compRecs.reduce((s,r) => s+r.completion, 0) / compRecs.length).toFixed(1) : '-';
      ctx += `  출석 ${pr}회/결석 ${ab}회 (${rate}%) | 평균완성도 ${avgC}/5\n`;

      const works = recs.filter(r => r.workName).slice(0, 5);
      if (works.length) {
        ctx += `  수업: ` + works.map(r =>
          `${r.date?.slice(5)||''} ${r.workName}#${r.workNum||1}(★${r.completion||0})`
        ).join(' / ') + '\n';
      }
    } else {
      ctx += `  최근 ${months}개월 수업 기록 없음\n`;
    }

    // 상담 기록
    const counsels = COUNSELS.filter(c => c.stuName === s.name).slice(0, 2);
    if (counsels.length) {
      ctx += `  상담: ` + counsels.map(c =>
        `[${c.date} ${c.type}] ${c.content?.slice(0,40)}`
      ).join(' / ') + '\n';
    }
  });

  // 3. 이달 수납
  const yr = now.getFullYear(), cm = now.getMonth()+1;
  const paid = activeStus.filter(s => {
    const p = JSON.parse(localStorage.getItem('pay_'+s.id+'_'+yr)||'{}');
    return p[cm];
  }).length;
  ctx += `\n[이달 수납] 납부 ${paid}명 / 미납 ${activeStus.length-paid}명\n`;

  // 4. 최근 운영 요약
  const recentRecs = DB.filter(r => r.date && new Date(r.date) >= monthsAgo);
  if (recentRecs.length) {
    const present = recentRecs.filter(r => r.attendance === 'present').length;
    const absent = recentRecs.filter(r => r.attendance === 'absent').length;
    const late = recentRecs.filter(r => r.attendance === 'late').length;
    const comps = recentRecs.filter(r => Number(r.completion) > 0).map(r => Number(r.completion));
    const avg = comps.length ? (comps.reduce((a,b)=>a+b,0)/comps.length).toFixed(1) : '-';
    const works = {};
    recentRecs.forEach(r => { if(r.workName) works[r.workName] = (works[r.workName]||0)+1; });
    const topWorks = Object.entries(works).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w,n])=>`${w}(${n}회)`).join(', ');
    ctx += `\n[최근 ${months}개월 운영 요약] 기록 ${recentRecs.length}건 / 출석 ${present} / 결석 ${absent} / 지각 ${late} / 평균완성도 ${avg}/5\n`;
    if(topWorks) ctx += `주요 수업/작품: ${topWorks}\n`;
  }

  // 5. 지식 베이스 (원장님이 입력한 규칙)
  if (AI_CFG.kbRules) ctx += `\n[학원 운영 규칙]\n${AI_CFG.kbRules}\n`;
  if (AI_CFG.kbCurriculum) ctx += `\n[수업 커리큘럼]\n${AI_CFG.kbCurriculum}\n`;
  if (AI_CFG.kbReportEx) ctx += `\n[리포트 예시]\n${AI_CFG.kbReportEx}\n`;

  return ctx;
}

function buildSystemPrompt(contextOptions = {}) {
  const academyCtx = buildAcademyContext(contextOptions);
  return `당신은 솔브아트 미술학원의 전용 AI 어시스턴트입니다.
아래 학원 데이터를 바탕으로 원장님을 도와주세요.
답변은 친근하고 전문적으로, 구체적인 원생 이름과 수업 내용을 언급해주세요.

=== 학원 데이터 ===
${academyCtx}
=================`;
}

// ════════════════════════════════════════════
//  핵심 기능: Claude.ai / ChatGPT용 프롬프트 생성 + 복사
// ════════════════════════════════════════════
function buildClaudePrompt(userQuestion, contextOptions = {}) {
  const systemCtx = buildAcademyContext(contextOptions);
  return `[솔브아트 미술학원 AI 어시스턴트]

아래 학원 데이터를 바탕으로 질문에 답해주세요.
친근하고 전문적으로, 구체적인 원생 이름과 수업 내용을 언급해주세요.

=== 학원 데이터 ===
${systemCtx}
=================

질문: ${userQuestion}`;
}

async function copyToClaudeAI(userQuestion, contextOptions = {}) {
  const fullPrompt = buildClaudePrompt(userQuestion, contextOptions);

  // 클립보드 복사
  try {
    await navigator.clipboard.writeText(fullPrompt);
    return { success: true, prompt: fullPrompt };
  } catch(e) {
    // 폴백: textarea
    const ta = document.createElement('textarea');
    ta.value = fullPrompt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return { success: true, prompt: fullPrompt };
  }
}


function getCopyTargetLabel(target = 'claude') {
  if (target === 'chatgpt') return 'ChatGPT';
  if (target === 'both') return 'Claude.ai 또는 ChatGPT';
  return 'Claude.ai';
}

function getCopyTargetUrl(target = 'claude') {
  if (target === 'chatgpt') return 'https://chatgpt.com/';
  return 'https://claude.ai/';
}

function getCopyTargetOpenButtons(target = 'both') {
  const btnStyle = 'padding:.35rem .7rem;border-radius:8px;font-size:.72rem;font-weight:800;text-decoration:none;display:inline-block;';
  if (target === 'chatgpt') {
    return `<a href="https://chatgpt.com/" target="_blank" style="background:#10A37F;color:#fff;${btnStyle}">🚀 ChatGPT 열기</a>`;
  }
  if (target === 'claude') {
    return `<a href="https://claude.ai/" target="_blank" style="background:#1a1a1a;color:var(--gold);${btnStyle}">🚀 Claude.ai 열기</a>`;
  }
  return `<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;">
    <a href="https://claude.ai/" target="_blank" style="background:#1a1a1a;color:var(--gold);${btnStyle}">🚀 Claude.ai</a>
    <a href="https://chatgpt.com/" target="_blank" style="background:#10A37F;color:#fff;${btnStyle}">🚀 ChatGPT</a>
  </div>`;
}

async function copyToAnyAI(userQuestion, contextOptions = {}, target = 'both') {
  const fullPrompt = buildClaudePrompt(userQuestion, contextOptions);
  try {
    await navigator.clipboard.writeText(fullPrompt);
  } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = fullPrompt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  return { success: true, prompt: fullPrompt, target, label: getCopyTargetLabel(target) };
}

// ════════════════════════════════════════════
//  AI API 직접 호출 (선택 기능)
// ════════════════════════════════════════════
async function callClaudeAPI(messages, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages
    })
  });
  if (!response.ok) throw new Error('Claude API 오류: ' + response.status);
  const data = await response.json();
  return data.content?.[0]?.text || '응답 없음';
}

async function callOllamaAPI(messages, systemPrompt) {
  const url = (AI_CFG.ollamaUrl || 'http://localhost:11434') + '/api/chat';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_CFG.ollamaModel || 'llama3.2',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false
    })
  });
  if (!response.ok) throw new Error('Ollama 연결 실패 - http://localhost:11434 실행 확인');
  const data = await response.json();
  return data.message?.content || '응답 없음';
}

async function callAI(userMessage, contextOptions = {}) {
  const mode = AI_CFG.mode || 'copy';
  const systemPrompt = buildSystemPrompt(contextOptions);
  aiChatHistory.push({ role: 'user', content: userMessage });
  const recent = aiChatHistory.slice(-8);
  let answer = '';
  if (mode === 'ollama') answer = await callOllamaAPI(recent, systemPrompt);
  else if (mode === 'api') answer = await callClaudeAPI(recent, systemPrompt);
  else throw new Error('copy_mode'); // Claude.ai 복사 모드
  aiChatHistory.push({ role: 'assistant', content: answer });
  return answer;
}

// ════════════════════════════════════════════
//  UI 렌더링
// ════════════════════════════════════════════
function renderAIPage() {
  const mode = AI_CFG.mode || 'copy';
  const isCopyMode = mode === 'copy' || mode === 'none' || !mode;
  const stuOptions = STUS.filter(s => !s.status || s.status === 'active')
    .map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modeLabel = isCopyMode
    ? '📋 Claude.ai / ChatGPT 복사 모드 (무료)'
    : mode === 'ollama'
      ? '🖥 Ollama 로컬 AI (' + (AI_CFG.ollamaModel||'llama3.2') + ')'
      : '☁️ Claude API';

  return `
  <div class="ptitle">🤖 솔브아트 AI</div>
  <div class="psub">학원 데이터 기반 전용 AI 어시스턴트</div>

  <!-- 현재 모드 배지 -->
  <div style="background:${isCopyMode?'#E8F5E9':'#E3F2FD'};border:1.5px solid ${isCopyMode?'#A5D6A7':'#90CAF9'};
    border-radius:10px;padding:.6rem .9rem;margin-bottom:.8rem;
    display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:.75rem;font-weight:800;color:${isCopyMode?'#1B5E20':'#0D47A1'};">${modeLabel}</span>
    <button class="btn btn-sm" style="font-size:.65rem;" onclick="aiTab('settings')">변경</button>
  </div>

  <!-- 탭 -->
  <div class="tabs" style="font-size:.72rem;margin-bottom:.8rem;">
    <button class="tab on" id="ai-tab-chat" onclick="aiTab('chat',this)">💬 질문하기</button>
    <button class="tab" id="ai-tab-report" onclick="aiTab('report',this)">📝 리포트</button>
    <button class="tab" id="ai-tab-msg" onclick="aiTab('msg',this)">📲 문자초안</button>
    <button class="tab" id="ai-tab-tools" onclick="aiTab('tools',this)">🧰 도구</button>
    <button class="tab" id="ai-tab-analysis" onclick="aiTab('analysis',this)">📊 분석</button>
    <button class="tab" id="ai-tab-kb" onclick="aiTab('kb',this)">📚 지식설정</button>
    <button class="tab" id="ai-tab-settings" onclick="aiTab('settings',this)">⚙️</button>
  </div>

  <!-- ─── 💬 질문하기 ─── -->
  <div id="ai-panel-chat">

    ${isCopyMode ? `
    <!-- Claude.ai / ChatGPT 복사 모드 안내 -->
    <div style="background:linear-gradient(135deg,#1a1a1a,#2a1a00);border-radius:14px;padding:1rem;margin-bottom:.8rem;color:#fff;">
      <div style="font-size:.75rem;font-weight:900;color:var(--gold);margin-bottom:.5rem;">📋 사용 방법 (Claude.ai / ChatGPT 복사)</div>
      <div style="font-size:.72rem;color:rgba(255,255,255,.7);line-height:1.7;">
        1️⃣ 아래 원생 선택 후 질문 입력<br>
        2️⃣ <strong style="color:var(--gold);">Claude.ai 또는 ChatGPT 복사 버튼</strong> 클릭<br>
        3️⃣ 학원 데이터가 포함된 프롬프트가 자동 복사됨<br>
        4️⃣ Claude.ai 또는 ChatGPT 접속 → 붙여넣기(Ctrl+V) → 전송
      </div>
    </div>
    ` : ''}

    <!-- 원생 선택 -->
    <div style="background:#f5f5f3;border-radius:10px;padding:.6rem;margin-bottom:.6rem;">
      <div style="font-size:.72rem;font-weight:700;margin-bottom:.3rem;">원생 선택 (선택사항)</div>
      <select id="ai-stu-select" class="inp" style="font-size:.78rem;" onchange="aiCurrentStu=this.value">
        <option value="">전체 학원 데이터 기반</option>
        ${stuOptions}
      </select>
    </div>

    <!-- 빠른 질문 -->
    <div style="margin-bottom:.6rem;">
      <div style="font-size:.7rem;font-weight:700;color:var(--muted);margin-bottom:.4rem;">빠른 질문</div>
      <div style="display:flex;flex-wrap:wrap;gap:.3rem;">
        ${[
          ['📊 출석 위험 원생', '출석률이 낮거나 이탈 위험이 있는 원생을 분석하고 관리 방법을 알려줘'],
          ['📝 리포트 작성', '선택한 원생의 이번 달 교육 리포트를 작성해줘'],
          ['💳 수납 문자', '이달 수강료 미납 학부모에게 보낼 안내 문자를 작성해줘'],
          ['📚 커리큘럼 추천', '각 원생의 수준에 맞는 다음 수업 커리큘럼을 추천해줘'],
          ['📈 운영 분석', '이달 학원 운영 현황을 분석하고 개선점을 알려줘'],
          ['🎨 작품 평가', '원생들의 완성도 추이를 분석하고 발전 방향을 제안해줘'],
          ['🧭 보강 계획', '결석 원생의 보강 우선순위와 안내 문구를 작성해줘'],
          ['📣 홍보 문구', '이번 달 수업 성과를 바탕으로 인스타그램 홍보 문구를 작성해줘'],
        ].map(([label, q]) => `
          <button class="btn btn-sm"
            style="font-size:.68rem;background:var(--gold-pale);border:1px solid var(--gold-light);"
            onclick="aiSetQuestion('${q.replace(/'/g,'')}')">${label}</button>
        `).join('')}
      </div>
    </div>

    <!-- 질문 입력 -->
    <div class="fg">
      <label style="font-size:.75rem;">질문 입력</label>
      <textarea id="ai-input" class="inp" rows="3"
        placeholder="예: 하윤이 최근 수업 분석해줘&#10;예: 다음 달 수업 계획 추천해줘&#10;예: 결석 많은 원생 연락 문자 작성해줘"></textarea>
    </div>

    <!-- 핵심 버튼: Claude.ai / ChatGPT 복사 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
      <button onclick="sendToClaudeAI()"
        style="width:100%;padding:.85rem;background:#1a1a1a;color:var(--gold);border:none;border-radius:12px;
        font-size:.86rem;font-weight:900;cursor:pointer;font-family:inherit;">
        📋 Claude.ai 복사
      </button>
      <button onclick="sendToChatGPTAI()"
        style="width:100%;padding:.85rem;background:#10A37F;color:#fff;border:none;border-radius:12px;
        font-size:.86rem;font-weight:900;cursor:pointer;font-family:inherit;">
        📋 ChatGPT 복사
      </button>
    </div>
    <button onclick="sendToBothAI()"
      style="width:100%;padding:.72rem;background:var(--gold);color:var(--ink);border:none;border-radius:10px;
      font-size:.82rem;font-weight:900;cursor:pointer;margin-bottom:.5rem;font-family:inherit;">
      📋 같은 프롬프트 복사 후 원하는 AI에서 사용
    </button>

    ${!isCopyMode ? `
    <button onclick="sendAIDirectly()"
      style="width:100%;padding:.7rem;background:var(--gold);color:var(--ink);border:none;border-radius:10px;
      font-size:.85rem;font-weight:800;cursor:pointer;font-family:inherit;">
      ⚡ AI에게 직접 질문 (${mode === 'ollama' ? 'Ollama' : 'API'})
    </button>
    ` : ''}

    <!-- 복사된 프롬프트 미리보기 -->
    <div id="ai-prompt-preview" style="display:none;margin-top:.8rem;">
      <div style="background:var(--gold-pale);border:2px solid var(--gold);border-radius:12px;padding:.9rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
          <div style="font-size:.78rem;font-weight:900;color:#1B5E20;">✅ 프롬프트 복사 완료!</div>
          <div id="ai-prompt-open-buttons">${getCopyTargetOpenButtons('both')}</div>
        </div>
        <div style="font-size:.72rem;color:#555;margin-bottom:.5rem;line-height:1.6;">
          Claude.ai 또는 ChatGPT에서 <strong>Ctrl+V (붙여넣기)</strong> 후 전송하면<br>
          학원 데이터를 분석한 답변을 받을 수 있어요!
        </div>
        <div style="font-size:.68rem;color:var(--muted);margin-bottom:.5rem;">프롬프트 미리보기:</div>
        <div id="ai-prompt-text" style="font-size:.68rem;color:#333;background:#fff;border-radius:8px;
          padding:.6rem;max-height:120px;overflow-y:auto;line-height:1.5;white-space:pre-wrap;"></div>
        <button onclick="copyPromptAgain()" class="btn btn-o btn-sm" style="width:100%;margin-top:.5rem;">
          📋 다시 복사
        </button>
      </div>
    </div>

    <!-- AI 직접 답변 영역 -->
    <div id="ai-direct-result" style="display:none;margin-top:.8rem;">
      <div class="ctitle" style="display:flex;justify-content:space-between;align-items:center;">
        <span>🤖 AI 답변</span>
        <button class="btn btn-o btn-sm" onclick="copyAIResult('ai-direct-text')">📋 복사</button>
      </div>
      <div id="ai-direct-text" style="font-size:.82rem;line-height:1.8;white-space:pre-wrap;
        color:var(--ink);background:var(--gold-pale);padding:.9rem;border-radius:10px;margin-top:.5rem;"></div>
    </div>
  </div>

  <!-- ─── 📝 리포트 자동 생성 ─── -->
  <div id="ai-panel-report" style="display:none;">
    <div class="card" style="padding:.9rem;">
      <div class="ctitle">📝 AI 교육 리포트 생성</div>
      <div class="fg"><label>원생 선택</label>
        <select id="ai-rpt-stu" class="inp"><option value="">-- 선택 --</option>${stuOptions}</select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
        <div class="fg"><label>기간</label>
          <select id="ai-rpt-period" class="inp">
            <option value="1">최근 1개월</option>
            <option value="2">최근 2개월</option>
            <option value="3">최근 3개월</option>
          </select>
        </div>
        <div class="fg"><label>유형</label>
          <select id="ai-rpt-type" class="inp">
            <option value="monthly">월별 성장 리포트</option>
            <option value="parent">학부모 공유용</option>
            <option value="exam">입시 지도 의견</option>
            <option value="portfolio">포트폴리오 평가</option>
          </select>
        </div>
      </div>
      <button onclick="generateAIReport()" class="btn btn-gold" style="width:100%;">
        📋 리포트 프롬프트 생성 + 복사
      </button>
    </div>
    <div id="ai-rpt-preview" style="display:none;" class="card">
      <div class="ctitle" style="display:flex;justify-content:space-between;">
        <span>✅ 복사 완료</span>
        <div style="display:flex;gap:.4rem;">
          <button onclick="copyAIResult('ai-rpt-text')" class="btn btn-o btn-sm">📋 다시 복사</button>
          <a href="https://claude.ai" target="_blank" class="btn btn-gold btn-sm">🚀 Claude.ai</a><a href="https://chatgpt.com/" target="_blank" class="btn btn-g btn-sm">🚀 ChatGPT</a>
        </div>
      </div>
      <div id="ai-rpt-text" style="font-size:.72rem;white-space:pre-wrap;max-height:200px;overflow-y:auto;
        background:#f5f5f3;padding:.7rem;border-radius:8px;color:#333;line-height:1.6;"></div>
    </div>
  </div>

  <!-- ─── 📲 문자 초안 ─── -->
  <div id="ai-panel-msg" style="display:none;">
    <div class="card" style="padding:.9rem;">
      <div class="ctitle">📲 학부모 문자 초안</div>
      <div class="fg"><label>문자 유형</label>
        <select id="ai-msg-type" class="inp">
          <option value="absent">결석 알림</option>
          <option value="fee">수강료 납부 안내</option>
          <option value="report">리포트 발송 안내</option>
          <option value="schedule">수업 일정 변경</option>
          <option value="makeup">보강 안내</option>
          <option value="contest">미술대회 참가 안내</option>
          <option value="good">칭찬/격려 메시지</option>
          <option value="event">학원 공지</option>
        </select>
      </div>
      <div class="fg"><label>원생 (선택사항)</label>
        <select id="ai-msg-stu" class="inp"><option value="">전체 학부모</option>${stuOptions}</select>
      </div>
      <div class="fg"><label>추가 내용</label>
        <input type="text" id="ai-msg-extra" class="inp" placeholder="예: 다음 주 화요일 보강, 재료비 5,000원">
      </div>
      <button onclick="generateAIMessage()" class="btn btn-gold" style="width:100%;">
        📋 문자 프롬프트 생성 + 복사
      </button>
    </div>
    <div id="ai-msg-preview" style="display:none;" class="card">
      <div class="ctitle" style="display:flex;justify-content:space-between;">
        <span>✅ 복사 완료</span>
        <div style="display:flex;gap:.4rem;">
          <button onclick="copyAIResult('ai-msg-text')" class="btn btn-o btn-sm">📋 다시 복사</button>
          <a href="https://claude.ai" target="_blank" class="btn btn-gold btn-sm">🚀 Claude.ai</a><a href="https://chatgpt.com/" target="_blank" class="btn btn-g btn-sm">🚀 ChatGPT</a>
        </div>
      </div>
      <div id="ai-msg-text" style="font-size:.72rem;white-space:pre-wrap;max-height:200px;overflow-y:auto;
        background:#f5f5f3;padding:.7rem;border-radius:8px;color:#333;line-height:1.6;"></div>
    </div>
  </div>


  <!-- ─── 🧰 AI 운영 도구 ─── -->
  <div id="ai-panel-tools" style="display:none;">
    <div class="card" style="padding:.9rem;">
      <div class="ctitle">🧰 AI 운영 도구</div>
      <div style="font-size:.72rem;color:var(--muted);line-height:1.6;margin-bottom:.7rem;">
        버튼을 누르면 학원 데이터가 포함된 전문 프롬프트가 자동 생성·복사됩니다.
      </div>
      <div class="fg"><label>원생 선택 (선택사항)</label>
        <select id="ai-tool-stu" class="inp"><option value="">전체 원생/학원 기준</option>${stuOptions}</select>
      </div>
      <div class="fg"><label>추가 조건</label>
        <input id="ai-tool-extra" class="inp" placeholder="예: 5월 기준, 초등 저학년 중심, 카카오톡용, 160자 이내">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.45rem;">
        ${[
          ['lessonPlan','🗓 주간 수업계획'],
          ['makeup','🧭 보강 우선순위'],
          ['counsel','☎ 상담 스크립트'],
          ['artFeedback','🎨 작품 피드백'],
          ['portfolio','🖼 포트폴리오 방향'],
          ['promotion','📣 홍보 콘텐츠'],
          ['riskMsg','🚨 이탈위험 대응'],
          ['notice','📌 공지문 작성'],
        ].map(([type,label])=>`
          <button class="btn btn-o btn-sm" onclick="generateAITool('${type}')">${label}</button>
        `).join('')}
      </div>
    </div>
    <div id="ai-tool-preview" style="display:none;" class="card">
      <div class="ctitle" style="display:flex;justify-content:space-between;align-items:center;">
        <span id="ai-tool-label">도구 프롬프트</span>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end;">
          <button onclick="copyAIResult('ai-tool-text')" class="btn btn-o btn-sm">📋 다시 복사</button>
          <a href="https://claude.ai" target="_blank" class="btn btn-gold btn-sm">🚀 Claude.ai</a><a href="https://chatgpt.com/" target="_blank" class="btn btn-g btn-sm">🚀 ChatGPT</a>
        </div>
      </div>
      <div id="ai-tool-text" style="font-size:.72rem;white-space:pre-wrap;max-height:240px;overflow-y:auto;background:#f5f5f3;padding:.7rem;border-radius:8px;color:#333;line-height:1.6;"></div>
    </div>
  </div>

  <!-- ─── 📊 분석 ─── -->
  <div id="ai-panel-analysis" style="display:none;">
    <div class="card" style="padding:.9rem;">
      <div class="ctitle">📊 학원 분석 프롬프트</div>
      <div style="display:flex;flex-direction:column;gap:.4rem;">
        ${[
          ['monthly', '📈 이달 운영 현황 종합 분석'],
          ['churn',   '🚨 이탈 위험 원생 심층 분석'],
          ['revenue', '💰 수익 구조 분석 및 개선 제안'],
          ['curriculum', '📚 원생별 커리큘럼 추천'],
          ['growth',  '🌱 학원 성장 전략 제안'],
        ].map(([type, label]) => `
          <button class="btn btn-o btn-sm" style="text-align:left;justify-content:flex-start;"
            onclick="generateAIAnalysis('${type}')">
            ${label}
          </button>
        `).join('')}
      </div>
    </div>
    <div id="ai-analysis-preview" style="display:none;" class="card">
      <div class="ctitle" style="display:flex;justify-content:space-between;">
        <span id="ai-analysis-label">분석 결과</span>
        <div style="display:flex;gap:.4rem;">
          <button onclick="copyAIResult('ai-analysis-text')" class="btn btn-o btn-sm">📋 다시 복사</button>
          <a href="https://claude.ai" target="_blank" class="btn btn-gold btn-sm">🚀 Claude.ai</a><a href="https://chatgpt.com/" target="_blank" class="btn btn-g btn-sm">🚀 ChatGPT</a>
        </div>
      </div>
      <div id="ai-analysis-text" style="font-size:.72rem;white-space:pre-wrap;max-height:240px;overflow-y:auto;
        background:#f5f5f3;padding:.7rem;border-radius:8px;color:#333;line-height:1.6;"></div>
    </div>
  </div>

  <!-- ─── 📚 지식 설정 ─── -->
  <div id="ai-panel-kb" style="display:none;">
    <div class="card" style="padding:.9rem;">
      <div class="ctitle">📚 AI 지식 베이스</div>
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:.7rem;">
        여기에 입력한 내용을 AI가 참고해서 더 정확한 답변을 해요
      </div>
      <div class="fg"><label>🏫 학원 운영 규칙</label>
        <textarea id="ai-kb-rules" class="inp" rows="3"
          placeholder="예: 결석 보강은 2주 이내&#10;수강료는 매월 10일까지&#10;보강은 토요일 2~4시">${AI_CFG.kbRules||''}</textarea>
      </div>
      <div class="fg"><label>📚 수업 커리큘럼</label>
        <textarea id="ai-kb-curriculum" class="inp" rows="3"
          placeholder="예: 초급 - 연필 스케치, 색연필 채색&#10;중급 - 수채화, 아크릴&#10;고급 - 유화, 입시 실기">${AI_CFG.kbCurriculum||''}</textarea>
      </div>
      <div class="fg"><label>📝 리포트 작성 예시</label>
        <textarea id="ai-kb-report-ex" class="inp" rows="3"
          placeholder="예: [이름]은 이번 달 [작품]을 통해 [기술]이 향상되었습니다...">${AI_CFG.kbReportEx||''}</textarea>
      </div>
      <div class="fg"><label>📲 문자 발송 예시</label>
        <textarea id="ai-kb-msg-ex" class="inp" rows="2"
          placeholder="예: [학원명] 안녕하세요. [이름] 학부모님...">${AI_CFG.kbMsgEx||''}</textarea>
      </div>
      <button onclick="saveAIKnowledge()" class="btn btn-b btn-sm" style="width:100%;">
        💾 저장
      </button>
    </div>
  </div>

  <!-- ─── ⚙️ AI 설정 ─── -->
  <div id="ai-panel-settings" style="display:none;">
    <div class="card" style="padding:.9rem;">
      <div class="ctitle">⚙️ AI 방식 선택</div>

      <div style="display:flex;flex-direction:column;gap:.5rem;">

        <!-- 옵션 1: Claude.ai / ChatGPT 복사 (추천) -->
        <label style="display:flex;gap:.7rem;align-items:flex-start;cursor:pointer;
          padding:.8rem;border-radius:10px;border:2px solid ${mode==='copy'||isCopyMode?'var(--gold)':'var(--border)'};
          background:${mode==='copy'||isCopyMode?'var(--gold-pale)':'#fff'};">
          <input type="radio" name="ai-mode" value="copy" ${isCopyMode?'checked':''} onchange="onAIModeChange()">
          <div>
            <div style="font-weight:900;font-size:.85rem;">📋 Claude.ai / ChatGPT 복사 모드 <span style="background:#E8F5E9;color:#1B5E20;font-size:.65rem;padding:1px 7px;border-radius:10px;font-weight:800;">추천 · 무료</span></div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:.2rem;line-height:1.5;">
              ChatGPT Plus 또는 Claude Pro 플랜 그대로 활용.<br>
              프롬프트를 자동 생성해서 Claude.ai/ChatGPT에 붙여넣기만 하면 됨.<br>
              <strong>추가 비용 0원</strong>
            </div>
          </div>
        </label>

        <!-- 옵션 2: Ollama -->
        <label style="display:flex;gap:.7rem;align-items:flex-start;cursor:pointer;
          padding:.8rem;border-radius:10px;border:2px solid ${mode==='ollama'?'var(--gold)':'var(--border)'};
          background:${mode==='ollama'?'var(--gold-pale)':'#fff'};">
          <input type="radio" name="ai-mode" value="ollama" ${mode==='ollama'?'checked':''} onchange="onAIModeChange()">
          <div>
            <div style="font-weight:900;font-size:.85rem;">🖥 Ollama 로컬 AI <span style="background:#E3F2FD;color:#1565C0;font-size:.65rem;padding:1px 7px;border-radius:10px;font-weight:800;">무료 · 완전오프라인</span></div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:.2rem;line-height:1.5;">
              PC에 AI 모델 설치. 인터넷 없이도 사용.<br>
              개인정보 완전 보호. PC 사양 필요 (8GB RAM 이상)
            </div>
          </div>
        </label>

        <!-- 옵션 3: Claude API -->
        <label style="display:flex;gap:.7rem;align-items:flex-start;cursor:pointer;
          padding:.8rem;border-radius:10px;border:2px solid ${mode==='api'?'var(--gold)':'var(--border)'};
          background:${mode==='api'?'var(--gold-pale)':'#fff'};">
          <input type="radio" name="ai-mode" value="api" ${mode==='api'?'checked':''} onchange="onAIModeChange()">
          <div>
            <div style="font-weight:900;font-size:.85rem;">☁️ Claude API <span style="background:#FFF3E0;color:#E65100;font-size:.65rem;padding:1px 7px;border-radius:10px;font-weight:800;">유료 · 자동응답</span></div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:.2rem;line-height:1.5;">
              앱 안에서 바로 AI 답변. 붙여넣기 불필요.<br>
              API 키 별도 발급 필요. 월 7,000~20,000원 예상
            </div>
          </div>
        </label>
      </div>

      <!-- Ollama 세부 설정 -->
      <div id="ai-ollama-cfg" style="${mode==='ollama'?'':'display:none;'}margin-top:.7rem;">
        <div style="background:#E3F2FD;border-radius:10px;padding:.8rem;margin-bottom:.6rem;font-size:.72rem;color:#1565C0;">
          <div style="font-weight:800;margin-bottom:.3rem;">Ollama 설치 방법</div>
          <div>1. ollama.ai 접속 → 다운로드 설치</div>
          <div>2. 터미널: <code style="background:#fff;padding:1px 4px;border-radius:3px;">ollama pull llama3.2</code></div>
          <div>3. Ollama 실행 후 아래 연결 테스트</div>
        </div>
        <div class="fg"><label>서버 URL</label>
          <input type="text" id="ai-ollama-url" class="inp" value="${AI_CFG.ollamaUrl||'http://localhost:11434'}">
        </div>
        <div class="fg"><label>모델</label>
          <select id="ai-ollama-model" class="inp">
            <option value="llama3.2" ${AI_CFG.ollamaModel==='llama3.2'?'selected':''}>llama3.2 (추천 · 한국어 우수)</option>
            <option value="qwen2.5" ${AI_CFG.ollamaModel==='qwen2.5'?'selected':''}>qwen2.5 (한국어 최강)</option>
            <option value="gemma3" ${AI_CFG.ollamaModel==='gemma3'?'selected':''}>gemma3 (Google · 경량)</option>
            <option value="phi3" ${AI_CFG.ollamaModel==='phi3'?'selected':''}>phi3 (저사양 PC용)</option>
          </select>
        </div>
        <button onclick="testOllamaConnection()" class="btn btn-o btn-sm" style="width:100%;">🔌 연결 테스트</button>
        <div id="ai-ollama-test" style="font-size:.72rem;text-align:center;padding:.4rem;min-height:1.2rem;"></div>
      </div>

      <!-- Claude API 세부 설정 -->
      <div id="ai-api-cfg" style="${mode==='api'?'':'display:none;'}margin-top:.7rem;">
        <div class="fg"><label>Anthropic API Key</label>
          <input type="password" id="ai-api-key" class="inp"
            value="${AI_CFG.claudeKey||''}" placeholder="sk-ant-api03-...">
          <div style="font-size:.68rem;color:var(--muted);margin-top:.2rem;">
            console.anthropic.com에서 발급 (Pro와 별개 서비스)
          </div>
        </div>
      </div>

      <button onclick="saveAISettings()" class="btn btn-gold" style="width:100%;margin-top:.8rem;">
        💾 설정 저장
      </button>
    </div>
  </div>
  `;
}

// ════════════════════════════════════════════
//  탭 전환
// ════════════════════════════════════════════
function aiTab(tab, btn) {
  ['chat','report','msg','tools','analysis','kb','settings'].forEach(t => {
    const p = el('ai-panel-' + t);
    if(p) p.style.display = 'none';
    const b = el('ai-tab-' + t);
    if(b) b.classList.remove('on');
  });
  const target = el('ai-panel-' + tab);
  if(target) target.style.display = 'block';
  if(btn) btn.classList.add('on');
  else { const b = el('ai-tab-' + tab); if(b) b.classList.add('on'); }
}

function onAIModeChange() {
  const mode = document.querySelector('input[name="ai-mode"]:checked')?.value;
  el('ai-ollama-cfg').style.display = mode === 'ollama' ? 'block' : 'none';
  el('ai-api-cfg').style.display = mode === 'api' ? 'block' : 'none';
}

// ════════════════════════════════════════════
//  핵심: Claude.ai / ChatGPT 복사 모드
// ════════════════════════════════════════════
let lastPrompt = '';
let lastPromptTarget = 'both';

async function sendToCopyAI(target = 'both') {
  const question = el('ai-input')?.value?.trim();
  if(!question) { toast('질문을 입력하세요'); return; }

  const stuName = el('ai-stu-select')?.value || '';
  const result = await copyToAnyAI(question, { stuName, months: 2, includeAll: !stuName }, target);
  const prompt = result.prompt;
  lastPrompt = prompt;
  lastPromptTarget = target;

  // 미리보기 표시
  const preview = el('ai-prompt-preview');
  const text = el('ai-prompt-text');
  const btns = el('ai-prompt-open-buttons');
  if(preview) preview.style.display = 'block';
  if(text) text.textContent = prompt.slice(0, 500) + (prompt.length > 500 ? '\n...(이하 생략)' : '');
  if(btns) btns.innerHTML = getCopyTargetOpenButtons(target);
  preview?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  toast('📋 복사 완료! ' + result.label + '에 붙여넣기 하세요');
}

function sendToClaudeAI() { return sendToCopyAI('claude'); }
function sendToChatGPTAI() { return sendToCopyAI('chatgpt'); }
function sendToBothAI() { return sendToCopyAI('both'); }

async function sendAIDirectly() {
  const question = el('ai-input')?.value?.trim();
  if(!question) { toast('질문을 입력하세요'); return; }
  showOv('AI 답변 생성 중...');
  try {
    const stuName = el('ai-stu-select')?.value || '';
    const answer = await callAI(question, { stuName, months: 2, includeAll: !stuName });
    el('ai-direct-result').style.display = 'block';
    el('ai-direct-text').textContent = answer;
    el('ai-direct-result').scrollIntoView({ behavior: 'smooth' });
  } catch(err) {
    if(err.message === 'copy_mode') {
      toast('⚠️ 설정에서 AI 방식을 선택하세요');
      aiTab('settings');
    } else toast('❌ ' + err.message);
  }
  hideOv();
}

function copyPromptAgain() {
  if(!lastPrompt) return;
  navigator.clipboard.writeText(lastPrompt).then(() => toast('📋 다시 복사! ' + getCopyTargetLabel(lastPromptTarget) + '에서 붙여넣기 하세요'));
}

function aiSetQuestion(q) {
  const inp = el('ai-input');
  if(inp) inp.value = q;
  inp?.scrollIntoView({ behavior: 'smooth' });
}

// ════════════════════════════════════════════
//  리포트 프롬프트 생성
// ════════════════════════════════════════════
async function generateAIReport() {
  const stuName = gv('ai-rpt-stu');
  const months = parseInt(gv('ai-rpt-period') || 1);
  const type = gv('ai-rpt-type');
  if(!stuName) { toast('원생을 선택하세요'); return; }

  const typeLabels = {
    monthly:'월별 성장 리포트', parent:'학부모 공유용 리포트',
    exam:'입시 지도 의견서', portfolio:'포트폴리오 평가서'
  };

  const question = `${stuName} 원생의 최근 ${months}개월 수업 기록을 바탕으로 ${typeLabels[type]}를 작성해줘.
포함할 내용: 주요 작품과 기법 발전 과정, 출석 현황, 강점, 보완 필요한 부분, 다음 목표, 선생님 총평.
자연스럽고 따뜻한 한국어로 작성해줘.`;

  const prompt = buildClaudePrompt(question, { stuName, months, includeAll: false });
  lastPrompt = prompt;

  try { await navigator.clipboard.writeText(prompt); } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = prompt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }

  el('ai-rpt-preview').style.display = 'block';
  el('ai-rpt-text').textContent = prompt.slice(0, 600) + '...';
  toast('📋 리포트 프롬프트 복사! Claude.ai 또는 ChatGPT에 붙여넣기 하세요');
}

// ════════════════════════════════════════════
//  문자 초안 프롬프트 생성
// ════════════════════════════════════════════
async function generateAIMessage() {
  const type = gv('ai-msg-type');
  const stuName = gv('ai-msg-stu');
  const extra = gv('ai-msg-extra');

  const typeQ = {
    absent: '오늘 결석한 원생 학부모에게 보낼 부드러운 안내 문자',
    fee: '이달 수강료 미납 학부모에게 보낼 정중한 납부 안내 문자',
    report: '월별 교육 리포트 발송 안내 문자',
    schedule: '수업 일정 변경 안내 문자',
    makeup: '보강 수업 일정 안내 문자',
    contest: '전국 미술대회 참가 안내 문자',
    good: '원생 칭찬 및 격려 메시지',
    event: '학원 공지 및 이벤트 안내 문자'
  };

  const question = `${typeQ[type]}를 작성해줘.
${stuName ? '대상: ' + stuName + ' 학부모님' : '전체 학부모 대상'}
${extra ? '추가 정보: ' + extra : ''}
요구사항: 학원명(${CFG.name||'솔브아트'}) 포함, 160자 이내, 신뢰감 있는 톤, 날짜/금액은 [날짜][금액] 형태로 표시, 문자 본문만 작성`;

  const prompt = buildClaudePrompt(question, { stuName, months: 1 });
  lastPrompt = prompt;

  try { await navigator.clipboard.writeText(prompt); } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = prompt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }

  el('ai-msg-preview').style.display = 'block';
  el('ai-msg-text').textContent = prompt.slice(0, 600) + '...';
  toast('📋 문자 프롬프트 복사! Claude.ai 또는 ChatGPT에 붙여넣기 하세요');
}


// ════════════════════════════════════════════
//  AI 운영 도구 프롬프트 생성
// ════════════════════════════════════════════
async function generateAITool(type) {
  const stuName = gv('ai-tool-stu');
  const extra = gv('ai-tool-extra');
  const labels = {
    lessonPlan:'🗓 주간 수업계획', makeup:'🧭 보강 우선순위', counsel:'☎ 상담 스크립트',
    artFeedback:'🎨 작품 피드백', portfolio:'🖼 포트폴리오 방향', promotion:'📣 홍보 콘텐츠',
    riskMsg:'🚨 이탈위험 대응', notice:'📌 공지문 작성'
  };
  const instructions = {
    lessonPlan:'최근 수업기록과 완성도를 바탕으로 다음 1주일 수업계획을 원생 수준별로 작성해줘. 준비물, 수업목표, 난이도, 교사 메모를 표 형태로 정리해줘.',
    makeup:'최근 결석·지각 기록을 기준으로 보강 우선순위를 정하고, 학부모에게 보낼 안내 문구와 내부 관리 체크리스트를 만들어줘.',
    counsel:'선택한 원생 또는 전체 원생의 상담 포인트를 정리하고, 학부모 상담 전화 스크립트와 예상 질문 답변을 작성해줘.',
    artFeedback:'최근 작품명, 회차, 완성도를 바탕으로 작품별 장점·보완점·다음 과제를 학부모가 이해하기 쉬운 말로 작성해줘.',
    portfolio:'원생의 최근 작업 흐름을 바탕으로 포트폴리오 구성 방향, 보완 작품, 추천 주제, 4주 실행계획을 작성해줘.',
    promotion:'최근 수업 성과와 학원 분위기를 바탕으로 블로그/인스타그램 홍보 콘텐츠를 작성해줘. 개인정보가 드러나지 않게 표현해줘.',
    riskMsg:'출석 저하, 완성도 하락, 미납 가능성을 기준으로 이탈위험 원생을 분석하고, 단계별 대응 메시지와 관리표를 작성해줘.',
    notice:'학부모 공지문을 작성해줘. 제목, 본문, 카카오톡 짧은 문구, 안내사항 체크리스트를 함께 만들어줘.'
  };
  const question = `${instructions[type] || instructions.lessonPlan}\n${stuName ? '대상 원생: '+stuName : '대상: 전체 원생/학원'}\n${extra ? '추가 조건: '+extra : ''}\n작성 기준: 따뜻하지만 전문적인 말투, 실제 학원 운영자가 바로 사용할 수 있는 문장, 표가 필요한 경우 표로 정리.`;
  const prompt = buildClaudePrompt(question, { stuName, months: 3, includeAll: !stuName });
  lastPrompt = prompt;
  lastPromptTarget = 'both';
  try { await navigator.clipboard.writeText(prompt); } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = prompt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
  const prev = el('ai-tool-preview');
  const text = el('ai-tool-text');
  const label = el('ai-tool-label');
  if(label) label.textContent = labels[type] || 'AI 운영 도구';
  if(text) text.textContent = prompt.slice(0, 900) + (prompt.length > 900 ? '\n...(이하 생략)' : '');
  if(prev) { prev.style.display='block'; prev.scrollIntoView({behavior:'smooth', block:'nearest'}); }
  toast('📋 '+(labels[type]||'도구')+' 프롬프트 복사 완료!');
}

// ════════════════════════════════════════════
//  분석 프롬프트 생성
// ════════════════════════════════════════════
async function generateAIAnalysis(type) {
  const labels = {
    monthly:'📈 이달 운영 현황 종합 분석',
    churn:'🚨 이탈 위험 원생 심층 분석',
    revenue:'💰 수익 구조 분석 및 개선 제안',
    curriculum:'📚 원생별 커리큘럼 추천',
    growth:'🌱 학원 성장 전략 제안'
  };
  const questions = {
    monthly:'이달 학원 운영 현황을 종합 분석하고, 잘 되는 점과 개선이 필요한 점을 구체적으로 알려줘.',
    churn:'출석률, 완성도, 수납 패턴을 분석해서 이탈 위험 원생을 찾고, 원생별 맞춤 관리 방법을 제안해줘.',
    revenue:'현재 수강료 구조와 원생 현황을 바탕으로 수익을 높일 방법과 미납 관리 전략을 제안해줘.',
    curriculum:'각 원생의 수준과 진행 작품을 분석해서 다음 수업에서 진행할 커리큘럼을 원생별로 추천해줘.',
    growth:'현재 학원의 강점과 약점을 분석하고, 원생 수를 늘리고 수익을 높이기 위한 구체적인 전략을 제안해줘.'
  };

  const prompt = buildClaudePrompt(questions[type], { months: 3, includeAll: true });
  lastPrompt = prompt;

  try { await navigator.clipboard.writeText(prompt); } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = prompt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }

  el('ai-analysis-label').textContent = labels[type];
  el('ai-analysis-preview').style.display = 'block';
  el('ai-analysis-text').textContent = prompt.slice(0, 600) + '...';
  toast('📋 분석 프롬프트 복사! Claude.ai 또는 ChatGPT에 붙여넣기 하세요');
}

// ════════════════════════════════════════════
//  Ollama 연결 테스트
// ════════════════════════════════════════════
async function testOllamaConnection() {
  const url = el('ai-ollama-url')?.value || 'http://localhost:11434';
  const model = el('ai-ollama-model')?.value || 'llama3.2';
  const r = el('ai-ollama-test');
  if(r) { r.textContent = '테스트 중...'; r.style.color = 'var(--muted)'; }
  try {
    const resp = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(5000) });
    if(resp.ok) {
      const data = await resp.json();
      const models = (data.models || []).map(m => m.name);
      const has = models.some(m => m.includes(model));
      if(r) {
        r.textContent = has ? '✅ 연결 성공! ' + model + ' 준비됨' : '⚠️ 연결됨. ' + model + ' 모델 없음 (ollama pull ' + model + ')';
        r.style.color = has ? 'var(--sage)' : 'var(--accent)';
      }
    }
  } catch(e) {
    if(r) { r.textContent = '❌ 연결 실패. Ollama 실행 여부 확인'; r.style.color = 'var(--accent)'; }
  }
}

// ════════════════════════════════════════════
//  설정 저장
// ════════════════════════════════════════════
function saveAISettings() {
  const mode = document.querySelector('input[name="ai-mode"]:checked')?.value || 'copy';
  AI_CFG = {
    ...AI_CFG, mode,
    claudeKey: el('ai-api-key')?.value || '',
    ollamaUrl: el('ai-ollama-url')?.value || 'http://localhost:11434',
    ollamaModel: el('ai-ollama-model')?.value || 'llama3.2',
  };
  localStorage.setItem('sa_ai_cfg', JSON.stringify(AI_CFG));
  toast('✅ 저장! AI 탭을 다시 열면 적용돼요');
  // 페이지 새로고침 효과
  setTimeout(() => {
    const cont = el('ai-page-content');
    if(cont) cont.innerHTML = renderAIPage();
    aiTab('chat');
  }, 800);
}

function saveAIKnowledge() {
  AI_CFG = {
    ...AI_CFG,
    kbRules: el('ai-kb-rules')?.value || '',
    kbCurriculum: el('ai-kb-curriculum')?.value || '',
    kbReportEx: el('ai-kb-report-ex')?.value || '',
    kbMsgEx: el('ai-kb-msg-ex')?.value || '',
  };
  localStorage.setItem('sa_ai_cfg', JSON.stringify(AI_CFG));
  if(FB_READY && db) { db.collection('config').doc('ai_kb').set(AI_CFG).catch(e=>{}); }
  toast('✅ 지식 베이스 저장 완료!');
}

function copyAIResult(elId) {
  const text = el(elId)?.textContent || '';
  navigator.clipboard.writeText(text).then(() => toast('📋 복사!')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('📋 복사!');
  });
}
