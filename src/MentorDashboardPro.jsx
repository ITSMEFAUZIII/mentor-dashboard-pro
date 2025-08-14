import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import courseData from "./course_js.json"; // <— file kurikulum yang kamu paste

// MentorDashboardPro.jsx — FINAL + CURRICULUM
// + Auto-save/load (localStorage)
// + Confetti (tanpa lib) & Sound (Web Audio API)
// + Dark mode + theme toggle
// + XP, badges, milestones, capstones, export/import JSON
// + Quest Harian otomatis, Leaderboard mingguan, Badge Editor
// + NEW: Kurikulum JS (21 section, 332 lecture) + checklist per lecture

const THEMES = {
  mono:  { bar: "bg-neutral-900 dark:bg-neutral-100", bg: "from-slate-50 to-slate-100",   darkBg: "from-neutral-900 to-neutral-950" },
  ocean: { bar: "bg-cyan-600 dark:bg-cyan-400",       bg: "from-cyan-50 to-sky-100",      darkBg: "from-cyan-950 to-slate-950" },
  grape: { bar: "bg-purple-600 dark:bg-violet-400",   bg: "from-fuchsia-50 to-violet-100",darkBg: "from-violet-950 to-slate-950" },
  lime:  { bar: "bg-lime-600 dark:bg-lime-400",       bg: "from-lime-50 to-emerald-100",  darkBg: "from-emerald-950 to-slate-950" },
};

const DEFAULT_BADGES = [
  { key: "bug_hunter", name: "Bug Hunter", goal: 10, stat: "bugs_fixed" },
  { key: "code_marathon", name: "Code Marathon", goal: 5, stat: "exercises_completed" },
  { key: "test_pilot", name: "Test Pilot", goal: 10, stat: "tests_written" },
  { key: "framework_explorer", name: "Framework Explorer", goal: 3, stat: "frameworks_tried" },
  { key: "consistency_7", name: "Konsistensi Hebat", goal: 7, stat: "streak" },
];

const CAPSTONES = [
  { key: "ecommerce_js", title: "Mini E-commerce (Next.js + Node + Postgres)", xp: 150, criteria: [
    "Auth (register/login, JWT/NextAuth)","Product list/detail, cart, checkout","Orders API (CRUD) + validation","Database schema w/ relations & indexes","Basic testing (≥10 tests)"
  ]},
  { key: "social_feed", title: "Social Feed (React + Node + MongoDB)", xp: 150, criteria: [
    "Post CRUD, like/comment","Infinite scroll & optimistic update","Image upload & CDN handling","Role-based access (admin/mod/user)","E2E tests for critical flows"
  ]},
  { key: "data_analytics_py", title: "Data Analytics (Python + Pandas)", xp: 150, criteria: [
    "Data cleaning & feature engineering","Exploratory analysis (plots)","Insight summary (markdown/pdf)","Reproducible notebook + script","Export results & dashboard PNGs"
  ]},
];

const LS_KEY   = "mentor-progress-v4";           // state, theme, dark, quests, history, courseDone
const QUESTS_KEY_PREFIX = "quests-";             // quests-YYYY-MM-DD
const DAY_MS  = 24*60*60*1000;

// ======== Utility tanggal lokal ========
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

// ======== Extract kurikulum dari JSON ========
const COURSE_SECTIONS = (courseData?.sections ?? []).map((s, si) => ({
  name: s.name,
  lectures: s.lectures || [],
  index: si,
}));
const TOTAL_LECTURES = COURSE_SECTIONS.reduce((acc, s) => acc + s.lectures.length, 0);

// Opsional: XP per lecture checklist (kecil saja biar fair)
const LECTURE_XP = 1;

export default function MentorDashboardPro({
  initial = {
    level: 1, xp: 0, streak: 0, track: "JS Beginner", week: 1, step: 1,
    stats: { bugs_fixed: 0, exercises_completed: 0, tests_written: 0, frameworks_tried: 0 },
    badgesUnlocked: [],
    history: {} // { 'YYYY-MM-DD': xpGained }
  },
}) {
  // ===== LOAD =====
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; } }, []);
  const [dark, setDark]     = useState(saved?.dark ?? false);
  const [theme, setTheme]   = useState(saved?.theme ?? "mono");
  const [state, setState]   = useState(saved?.state ?? initial);

  // quests
  const [quests, setQuests]   = useState(saved?.quests ?? null);
  const [dateKey, setDateKey] = useState(todayKey());

  // kurikulum: simpan set id lecture yang selesai -> array di storage
  const [courseDone, setCourseDone] = useState(new Set(saved?.courseDoneArray ?? []));
  const [expanded, setExpanded] = useState({}); // ekspansi accordion per section

  // confetti + fx
  const [confetti, setConfetti] = useState([]);
  const [justLeveled, setJustLeveled] = useState(false);
  const fileRef = useRef(null);

  const xpInLevel = state.xp % 100;
  const progress = Math.min(100, Math.max(0, xpInLevel));
  const levelNow = Math.floor(state.xp / 100) + 1;
  const themeObj = THEMES[theme] || THEMES.mono;

  // ===== AUTOSAVE =====
  useEffect(() => {
    const payload = { dark, theme, state, quests, courseDoneArray: Array.from(courseDone) };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  }, [dark, theme, state, quests, courseDone]);

  // ===== SOUNDS =====
  const playTone = (freq=440, duration=0.12, type="sine", gain=0.08) => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq; g.gain.value = gain;
    osc.connect(g); g.connect(ctx.destination); osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, duration*1000);
  };
  const levelUpSound = () => [440,660,880].forEach((f,i)=>setTimeout(()=>playTone(f,0.1,"triangle",0.07), i*120));
  const badgeSound   = () => playTone(880, 0.15, "square", 0.06);
  const capstoneSound= () => [523,659,783,1046].forEach((f,i)=>setTimeout(()=>playTone(f,0.12,"sine",0.08), i*110));
  const tickSound    = () => playTone(660, 0.05, "sine", 0.05);

  // ===== CONFETTI =====
  const launchConfetti = (count=50) => {
    const pieces = Array.from({length:count}).map((_,i)=>({
      id:`${Date.now()}_${i}`, x:Math.random()*100, r:Math.random()*360, d:60+Math.random()*30, s:6+Math.random()*10
    }));
    setConfetti(pieces);
    setTimeout(()=>setConfetti([]), 1500);
  };

  // ===== QUESTS =====
  const BASE_QUEST_POOL = [
    { id:"q1", title:"Selesaikan 2 latihan", xp:20, type:"exercises_completed", target:2 },
    { id:"q2", title:"Perbaiki 3 bug/lint", xp:15, type:"bugs_fixed",           target:3 },
    { id:"q3", title:"Tulis 5 unit test",   xp:25, type:"tests_written",        target:5 },
    { id:"q4", title:"Coba 1 framework",    xp:10, type:"frameworks_tried",     target:1 },
    { id:"q5", title:"Baca 30 baris kode & catat 3 insight", xp:15, type:"exercises_completed", target:1 },
  ];

  const loadOrGenerateQuests = (key) => {
    const existing = JSON.parse(localStorage.getItem(QUESTS_KEY_PREFIX + key) || "null");
    if (existing && existing.items) return existing;
    const pool = [...BASE_QUEST_POOL];
    const chosen = [];
    while (chosen.length < 3 && pool.length) {
      const idx = Math.floor(Math.random()*pool.length);
      const q = pool.splice(idx,1)[0];
      chosen.push({ ...q, done:false, progress:0 });
    }
    const pack = { dateKey:key, items: chosen };
    localStorage.setItem(QUESTS_KEY_PREFIX + key, JSON.stringify(pack));
    return pack;
  };

  useEffect(() => {
    const dk = todayKey();
    setDateKey(dk);
    const pack = loadOrGenerateQuests(dk);
    setQuests(pack);

    const timer = setInterval(() => {
      const nk = todayKey();
      if (nk !== dateKey) {
        setDateKey(nk);
        setQuests(loadOrGenerateQuests(nk));
      }
    }, 60*1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line
  }, []);

  // ===== HISTORY & WEEKLY =====
  const DAY_MS = 24*60*60*1000;
  const addHistory = (delta) => {
    const k = todayKey();
    setState((s) => {
      const h = { ...(s.history || {}) };
      h[k] = (h[k] || 0) + delta;
      return { ...s, history: h };
    });
  };
  const weeklyXP = useMemo(() => {
    const h = state.history || {};
    let total = 0;
    const now = new Date(todayKey());
    for (let i=0;i<7;i++){
      const d = new Date(now.getTime() - i*DAY_MS);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      total += h[k] || 0;
    }
    return total;
  }, [state.history]);

  // ===== CORE STATE OPS =====
  const awardXP = (amount) => {
    setState((s) => {
      const xp = s.xp + amount;
      const before = Math.floor(s.xp / 100) + 1;
      const after  = Math.floor(xp  / 100) + 1;
      if (after > before) { setJustLeveled(true); launchConfetti(); levelUpSound(); setTimeout(()=>setJustLeveled(false), 1500); }
      return { ...s, xp };
    });
    addHistory(amount);
  };
  const incStat = (key, delta=1) => setState((s)=>({ ...s, stats:{ ...s.stats, [key]: Math.max(0, (s.stats[key]||0)+delta) }}));
  const completeExercise = () => { incStat("exercises_completed",1); awardXP(10); };
  const completeStep     = () => { setState((s)=>{ let {step,week}=s; step+=1; if(step>3){step=1;week+=1;} return {...s, step, week}; }); awardXP(25); };
  const addBugFix  = () => { incStat("bugs_fixed",1); awardXP(5); };
  const addTests   = () => { incStat("tests_written",3); awardXP(15); };
  const tryFramework=() => { incStat("frameworks_tried",1); awardXP(10); };

  // ===== BADGE CHECK =====
  const ALL_BADGES = useMemo(()=>[...DEFAULT_BADGES, ...(state.customBadges||[])], [state.customBadges]);
  useEffect(() => {
    const newly = [];
    ALL_BADGES.forEach((b) => {
      const cur = b.stat === "streak" ? state.streak : (state.stats[b.stat] || 0);
      const have = state.badgesUnlocked?.includes(b.key);
      if (!have && cur >= b.goal) newly.push(b.key);
    });
    if (newly.length) {
      setState((s)=>({ ...s, badgesUnlocked:[...(s.badgesUnlocked||[]), ...newly] }));
      launchConfetti(35); badgeSound();
    }
  }, [state.stats, state.streak, ALL_BADGES]); // eslint-disable-line

  // ===== EXPORT / IMPORT =====
  const exportProgress = () => {
    const payload = { dark, theme, state, quests, courseDoneArray: Array.from(courseDone) };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const dl = document.createElement("a"); dl.href = dataStr; dl.download = "mentor-progress.json"; dl.click();
  };
  const importProgress = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const obj = JSON.parse(String(evt.target.result));
        setDark(!!obj.dark); if (obj.theme) setTheme(obj.theme);
        if (obj.state) setState(obj.state);
        if (obj.quests) setQuests(obj.quests);
        if (obj.courseDoneArray) setCourseDone(new Set(obj.courseDoneArray));
      } catch { alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  };

  const claimCapstone = () => { const xp = CAPSTONES.find((c)=>c.key===selectedCapstone).xp; awardXP(xp); launchConfetti(60); capstoneSound(); };

  // ===== KURIKULUM: helpers =====
  const doneCount = courseDone.size;
  const curriculumProgress = TOTAL_LECTURES ? Math.round((doneCount / TOTAL_LECTURES) * 100) : 0;

  const lectureId = (si, li) => `${si}-${li}`; // key stabil
  const isLectureDone = (si, li) => courseDone.has(lectureId(si, li));

  const toggleLecture = (si, li) => {
    const id = lectureId(si, li);
    setCourseDone(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        awardXP(LECTURE_XP); // kecil saja biar gak overpower
        tickSound();
      }
      return next;
    });
  };

  const markSection = (si, done=true) => {
    const section = COURSE_SECTIONS[si];
    setCourseDone(prev => {
      const next = new Set(prev);
      section.lectures.forEach((_, li) => {
        const id = lectureId(si, li);
        if (done && !next.has(id)) { next.add(id); awardXP(LECTURE_XP); }
        if (!done && next.has(id)) { next.delete(id); }
      });
      tickSound(); return next;
    });
  };

  // ===== LEADERBOARD (mock) =====
  const peers = useMemo(()=>{
    const base = weeklyXP;
    const daySeed = (new Date(dateKey)).getDate();
    const sample = ["Rani","Budi","Sinta","Aji","Dewi","Arif"].map((name,i)=>{
      const variance = ((i+1)*13 + daySeed*7) % 80;
      const score = Math.max(0, base + (i%2===0 ? -variance : +variance));
      return { name, score };
    });
    const me = { name:"Kamu", score: base };
    return [...sample, me].sort((a,b)=>b.score-a.score).slice(0,7);
  }, [weeklyXP, dateKey]);

  // ===== BADGE EDITOR =====
  const [badgeForm, setBadgeForm] = useState({ name:"", stat:"exercises_completed", goal:5 });
  const addCustomBadge = (e) => {
    e.preventDefault();
    if (!badgeForm.name.trim()) return;
    const key = "custom_" + badgeForm.name.toLowerCase().replace(/\s+/g,"_");
    const newBadge = { key, name:badgeForm.name.trim(), goal:Number(badgeForm.goal||5), stat:badgeForm.stat };
    setState((s)=>({ ...s, customBadges:[...(s.customBadges||[]), newBadge] }));
    setBadgeForm({ name:"", stat:"exercises_completed", goal:5 });
  };

  // ===== RENDER =====
  return (
    <div className={(dark ? "dark " : "") + "min-h-screen w-full bg-gradient-to-br " + (dark ? themeObj.darkBg : themeObj.bg) + " p-6 text-neutral-900 dark:text-neutral-100 relative overflow-hidden"}>
      {/* CONFETTI */}
      {confetti.map((p)=>(
        <motion.div key={p.id} initial={{opacity:1,y:-20,x:`${p.x}vw`,rotate:p.r}} animate={{y:"100vh",rotate:p.r+180}} transition={{duration:p.d/100,ease:"easeOut"}} className="pointer-events-none absolute top-0"
          style={{ width:p.s, height:p.s, borderRadius:2, background:["#22c55e","#3b82f6","#eab308","#ef4444","#a855f7"][Math.floor(Math.random()*5)] }} />
      ))}

      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mentor Coding Dashboard Pro</h1>
            <p className="text-neutral-600 dark:text-neutral-300">Track: <span className="font-medium">{state.track}</span> — Minggu {state.week}, Step {state.step}</p>
          </div>
          <div className="flex gap-2">
            <select value={theme} onChange={e=>setTheme(e.target.value)} className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm bg-white/90 dark:bg-neutral-800">
              {Object.keys(THEMES).map(k=><option key={k} value={k}>{k}</option>)}
            </select>
            <button onClick={()=>setDark(d=>!d)} className="rounded-2xl border border-neutral-200 dark:border-neutral-700 px-4 py-2 text-sm bg-white/90 dark:bg-neutral-800">Toggle {dark? "Light":"Dark"}</button>
            <button onClick={()=>{ localStorage.removeItem(LS_KEY); location.reload(); }} className="rounded-2xl border border-neutral-200 dark:border-neutral-700 px-4 py-2 text-sm bg-white/90 dark:bg-neutral-800">Reset Local Data</button>
          </div>
        </header>

        {/* XP & LEVEL */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">XP & Level</h2>
          <div className="flex items-center gap-3">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              <motion.div initial={{width:0}} animate={{width:`${progress}%`}} transition={{type:"spring",stiffness:80,damping:20}} className={"absolute left-0 top-0 h-full " + themeObj.bar} />
            </div>
            <div className="text-sm tabular-nums w-24 text-right dark:text-neutral-200">{xpInLevel}/100</div>
          </div>
          <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">Level <span className="font-medium">{levelNow}</span> — Total XP: <span className="font-medium">{state.xp}</span></div>
          {justLeveled && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="mt-3 text-center text-sm">
              <div className="inline-flex items-center gap-2 rounded-2xl px-3 py-1 bg-amber-100 dark:bg-amber-200/20 text-amber-700 dark:text-amber-300 shadow"><span>✨ LEVEL UP!</span><span className="font-semibold">→ Level {levelNow}</span></div>
            </motion.div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={()=>{ incStat("exercises_completed",1); awardXP(10); }} className="rounded-2xl bg-neutral-900 text-white px-4 py-2 shadow hover:opacity-90">+10 XP (Latihan)</button>
            <button onClick={()=>{ setState(s=>{ let {step,week}=s; step+=1; if(step>3){step=1; week+=1;} return {...s, step, week}; }); awardXP(25); }} className="rounded-2xl bg-neutral-900 text-white px-4 py-2 shadow hover:opacity-90">+25 XP (Step Selesai)</button>
            <button onClick={()=>awardXP(50)} className="rounded-2xl bg-neutral-900 text-white px-4 py-2 shadow hover:opacity-90">+50 XP (Proyek Mini)</button>
          </div>
        </section>

        {/* QUEST HARIAN */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Quest Harian — {dateKey}</h2>
          {!quests ? <div className="text-sm">Loading quests...</div> : (
            <ul className="space-y-2">
              {quests.items.map((q, idx)=>(
                <li key={q.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 dark:border-neutral-700 p-3">
                  <div className="text-sm">{q.title} <span className="text-xs opacity-70">(+{q.xp} XP)</span></div>
                  <button onClick={()=>{ const val = !q.done; setQuests(old=>{ const items=[...old.items]; items[idx] = {...items[idx], done:val}; const pack={...old, items}; localStorage.setItem(QUESTS_KEY_PREFIX+old.dateKey, JSON.stringify(pack)); return pack; }); if(val) awardXP(q.xp); }} className={"rounded-xl border px-3 py-1 text-sm " + (q.done? "bg-emerald-500 text-white border-emerald-500":"hover:bg-neutral-50 dark:hover:bg-neutral-800")}>
                    {q.done? "Selesai ✅" : "Tandai Selesai"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="text-xs mt-2 opacity-70">Quest reset otomatis jam 00:00 (lokal).</div>
        </section>

        {/* STREAK & BADGES + EDITOR */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Streak & Badges</h2>
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-2xl bg-white dark:bg-neutral-800 shadow px-3 py-2">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Streak</div>
              <div className="text-lg">🔥 x{state.streak}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setState(s=>({...s, streak:s.streak+1}))} className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800">+1 Streak</button>
              <button onClick={()=>setState(s=>({...s, streak:Math.max(0, s.streak-1)}))} className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800">-1 Streak</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...DEFAULT_BADGES, ...(state.customBadges||[])].map((b) => {
              const cur = b.stat === "streak" ? state.streak : (state.stats[b.stat] || 0);
              const pct = Math.min(100, Math.floor((cur / b.goal) * 100));
              const unlocked = (state.badgesUnlocked || []).includes(b.key);
              return (
                <div key={b.key} className={"rounded-2xl border p-4 " + (unlocked ? "border-emerald-400" : "border-neutral-200 dark:border-neutral-700")}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">{b.name}</div>
                    <div className={"text-[10px] px-2 py-0.5 rounded-full " + (unlocked ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200")}>{unlocked ? "Unlocked" : "Progress"}</div>
                  </div>
                  <div className="text-xs mb-1 dark:text-neutral-300">{cur}/{b.goal}</div>
                  <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <motion.div initial={{width:0}} animate={{width:pct+"%"}} className={"h-full " + (unlocked ? "bg-emerald-500" : "bg-neutral-500")} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={()=>{ incStat("bugs_fixed",1); awardXP(5); }} className="rounded-xl border px-3 py-1 text-sm">+ Bug Fixed</button>
            <button onClick={()=>{ incStat("exercises_completed",1); }} className="rounded-xl border px-3 py-1 text-sm">+ Exercise</button>
            <button onClick={()=>{ incStat("tests_written",3); awardXP(15); }} className="rounded-xl border px-3 py-1 text-sm">+1 Test</button>
            <button onClick={()=>{ incStat("frameworks_tried",1); awardXP(10); }} className="rounded-xl border px-3 py-1 text-sm">Try Framework</button>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4">
            <h3 className="font-semibold mb-2">Badge Editor (Custom)</h3>
            <form onSubmit={(e)=>{e.preventDefault(); const name=e.target.name.value.trim(); const stat=e.target.stat.value; const goal=Number(e.target.goal.value||5); if(!name) return; const key="custom_"+name.toLowerCase().replace(/\s+/g,"_"); const newBadge={key,name,stat,goal}; setState(s=>({...s, customBadges:[...(s.customBadges||[]), newBadge]})); e.target.reset(); }} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input name="name" placeholder="Nama badge" className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 bg-white/90 dark:bg-neutral-800"/>
              <select name="stat" className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 bg-white/90 dark:bg-neutral-800">
                <option value="exercises_completed">exercises_completed</option>
                <option value="bugs_fixed">bugs_fixed</option>
                <option value="tests_written">tests_written</option>
                <option value="frameworks_tried">frameworks_tried</option>
                <option value="streak">streak</option>
              </select>
              <input type="number" name="goal" min={1} defaultValue={5} className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 bg-white/90 dark:bg-neutral-800"/>
              <button className="rounded-xl bg-neutral-900 text-white px-4 py-2">Tambah Badge</button>
            </form>
          </div>
        </section>

        {/* KURIKULUM JS — CHECKLIST PER LECTURE */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Kurikulum JavaScript — {COURSE_SECTIONS.length} Section • {TOTAL_LECTURES} Lecture</h2>
            <div className="text-sm opacity-80">Progress: {doneCount}/{TOTAL_LECTURES} lecture</div>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700 mb-4">
            <motion.div initial={{width:0}} animate={{width:`${curriculumProgress}%`}} className="absolute left-0 top-0 h-full bg-emerald-500"/>
          </div>

          <div className="space-y-3">
            {COURSE_SECTIONS.map((sec, si) => {
              const secDone = sec.lectures.filter((_, li)=>isLectureDone(si, li)).length;
              const secPct  = sec.lectures.length ? Math.round((secDone/sec.lectures.length)*100) : 0;
              const isOpen  = !!expanded[si];
              return (
                <div key={si} className="rounded-2xl border border-neutral-200 dark:border-neutral-700">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3"
                    onClick={()=>setExpanded(e=>({ ...e, [si]: !isOpen }))}
                  >
                    <div className="text-sm font-semibold">{si+1}. {sec.name}</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs opacity-80">{secDone}/{sec.lectures.length} • {secPct}%</div>
                      <div className={"size-6 rounded-full grid place-items-center " + (isOpen? "bg-neutral-900 text-white":"bg-neutral-200 dark:bg-neutral-800")}>
                        {isOpen? "−" : "+"}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-3">
                      <div className="mb-3 flex gap-2">
                        <button onClick={()=>markSection(si,true)} className="rounded-xl border px-3 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800">Selesaikan Section</button>
                        <button onClick={()=>markSection(si,false)} className="rounded-xl border px-3 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800">Clear Section</button>
                      </div>
                      <ul className="space-y-1">
                        {sec.lectures.map((title, li) => {
                          const id = lectureId(si, li);
                          const done = isLectureDone(si, li);
                          return (
                            <li key={id} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={done} onChange={()=>toggleLecture(si, li)} />
                                <div className={"text-sm " + (done? "line-through opacity-70":"")}>{(li+1)+". "+title}</div>
                              </div>
                              <div className="text-[10px] opacity-70">+{LECTURE_XP} XP</div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* MILESTONES (mingguan) */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Milestone Minggu Ini</h2>
          <ul className="space-y-2">
            {[1,2,3].map((i)=>(
              <li key={i} className="flex items-center justify-between rounded-2xl border border-neutral-200 dark:border-neutral-700 p-3">
                <div className="flex items-center gap-3">
                  <div className={"size-4 rounded-full " + (state.step>i? "bg-emerald-500":"bg-neutral-300")} />
                  <div className="text-sm">Step {i}: Tugas #{i}</div>
                </div>
                <button className="rounded-xl border px-3 py-1 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800" onClick={completeStep}>Tandai Selesai</button>
              </li>
            ))}
          </ul>
        </section>

        {/* CAPSTONES */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Capstone Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {CAPSTONES.map((c,i)=>(
              <label key={c.key} className={"rounded-2xl border p-4 cursor-pointer " + "border-neutral-200 dark:border-neutral-700"}>
                <input type="radio" className="hidden" name="cap" value={c.key} onChange={()=>{ /* pilih */ }} />
                <div className="text-sm font-semibold mb-1">{c.title}</div>
                <div className="text-xs mb-2 text-neutral-600 dark:text-neutral-300">XP: {c.xp}</div>
                <ul className="text-xs list-disc pl-5 space-y-1">{c.criteria.map((t,idx)=>(<li key={idx}>{t}</li>))}</ul>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={()=>{ /* pilih default index 0 jika belum */ }} className="rounded-2xl bg-neutral-900 text-white px-4 py-2 shadow hover:opacity-90" disabled>Claim XP Capstone (pilih capstone di atas)</button>
          </div>
        </section>

        {/* LEADERBOARD */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Leaderboard (XP 7 Hari Terakhir)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {peers.map((p, i)=>(
              <div key={p.name+i} className={"flex items-center justify-between rounded-2xl border p-3 " + (p.name==="Kamu" ? "border-emerald-400" : "border-neutral-200 dark:border-neutral-700")}>
                <div className="flex items-center gap-3">
                  <div className={"size-8 rounded-full grid place-items-center text-xs " + (p.name==="Kamu" ? "bg-emerald-500 text-white" : "bg-neutral-200 dark:bg-neutral-800")}>{i+1}</div>
                  <div className="text-sm font-medium">{p.name}</div>
                </div>
                <div className="text-sm">{p.score} XP</div>
              </div>
            ))}
          </div>
        </section>

        {/* EXPORT / IMPORT */}
        <section className="mb-6 rounded-3xl bg-white/90 dark:bg-neutral-900 p-5 shadow">
          <h2 className="text-lg font-semibold mb-3">Export / Import Progress</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={exportProgress} className="rounded-2xl border border-neutral-200 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800">Export JSON</button>
            <input ref={fileRef} type="file" accept="application/json" onChange={importProgress} className="text-sm" />
          </div>
        </section>

        <footer className="mt-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
          Built for your Custom GPT — Kurikulum JS + checklist (21/332), quests, leaderboard, badges, autosave, confetti, sounds.
        </footer>
      </div>
    </div>
  );
}
