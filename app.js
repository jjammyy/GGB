(() => {
  'use strict';

  // 로그인 없는 공용 가계부: 이 공개 키로 누구나 같은 데이터를 읽고 쓴다.
  const SUPABASE_URL = 'https://twdyxomovxfpxicuooyg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_VngNOJBs2yDhjtLqimONkA_hTL_MRuD';
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const TX_COLUMNS = 'id, date, type, category, amount, memo, author, created_at';
  const AUTHOR_KEY = 'ggb.author'; // 이 브라우저에서 마지막으로 쓴 이름 (입력 편의용)
  const PAGE_SIZE = 1000; // Supabase API가 한 번에 돌려주는 최대 행 수
  const SETTINGS_SAVE_DELAY = 600;
  const RELOAD_MS = 30 * 1000;

  // 예전 버전이 브라우저에 저장하던 키 (처음 열 때 DB로 옮긴다)
  const LEGACY_KEYS = {
    transactions: 'ggb.transactions.v1',
    budget: 'ggb.budget.v1',
    settings: 'ggb.settings.v1',
    weather: 'ggb.weather.v1',
  };
  const INTEREST_TAX = 0.154; // 이자소득세 15.4%

  const SKIES = {
    sunny: { icon: '☀️', label: '맑음' },
    cloudy: { icon: '⛅', label: '구름 조금' },
    overcast: { icon: '☁️', label: '흐림' },
    rain: { icon: '🌧️', label: '비' },
    snow: { icon: '❄️', label: '눈' },
    fog: { icon: '🌫️', label: '안개' },
    thunder: { icon: '⛈️', label: '뇌우' },
  };

  // 서울 강남구청 좌표 기준 현재 날씨 (Open-Meteo, API 키 불필요)
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.5172&longitude=127.0473'
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day'
    + '&wind_speed_unit=ms&timezone=Asia%2FSeoul';
  const WEATHER_REFRESH_MS = 10 * 60 * 1000;

  const CATEGORIES = {
    expense: ['식비', '카페·간식', '교통', '주거·통신', '생활용품', '쇼핑', '의료·건강', '문화·여가', '교육', '경조사', '기타'],
    income: ['급여', '용돈', '부수입', '금융수입', '기타'],
  };
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const MAX_AMOUNT = 999999999999;

  const $ = (id) => document.getElementById(id);
  const el = {
    monthLabel: $('monthLabel'),
    prevMonth: $('prevMonth'),
    nextMonth: $('nextMonth'),
    exportBtn: $('exportBtn'),
    importInput: $('importInput'),
    sumIncome: $('sumIncome'),
    sumExpense: $('sumExpense'),
    sumBalance: $('sumBalance'),
    budgetEdit: $('budgetEdit'),
    budgetBody: $('budgetBody'),
    formCard: $('formCard'),
    formTitle: $('formTitle'),
    form: $('txForm'),
    date: $('date'),
    amount: $('amount'),
    category: $('category'),
    memo: $('memo'),
    author: $('author'),
    cancelEdit: $('cancelEdit'),
    submitBtn: $('submitBtn'),
    breakdown: $('breakdown'),
    filterType: $('filterType'),
    search: $('search'),
    txList: $('txList'),
    hero: $('hero'),
    heroArt: $('heroArt'),
    heroTag: $('heroTag'),
    heroTitle: $('heroTitle'),
    heroDesc: $('heroDesc'),
    heroFacts: $('heroFacts'),
    goalInput: $('goalInput'),
    rateInput: $('rateInput'),
    monthsInput: $('monthsInput'),
    interestType: $('interestType'),
    goalStatus: $('goalStatus'),
    projection: $('projection'),
    weatherRefresh: $('weatherRefresh'),
    weatherBody: $('weatherBody'),
    loadingMsg: $('loadingMsg'),
    retryBtn: $('retryBtn'),
  };

  // ---------- 예전 브라우저 저장소 ----------
  const legacyStorage = {
    load(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    hasAny() {
      try {
        return Object.values(LEGACY_KEYS).some((k) => localStorage.getItem(k) !== null);
      } catch {
        return false;
      }
    },
    clear() {
      try {
        Object.values(LEGACY_KEYS).forEach((k) => localStorage.removeItem(k));
      } catch {
        // 지우지 못해도 다음 로그인 때 다시 물어볼 뿐이다
      }
    },
  };

  function notifyError(msg, err) {
    console.error(err);
    alert(`${msg}\n${err && err.message ? err.message : ''}`.trim());
  }

  function isValidTx(t) {
    return t !== null && typeof t === 'object'
      && typeof t.id === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
      && (t.type === 'income' || t.type === 'expense')
      && Number.isSafeInteger(t.amount) && t.amount > 0
      && typeof t.category === 'string';
  }

  function normalizeTx(t) {
    return {
      id: t.id,
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      memo: typeof t.memo === 'string' ? t.memo : '',
      author: typeof t.author === 'string' ? t.author.slice(0, 20) : '',
      createdAt: Number(t.createdAt) || 0,
    };
  }

  function fromRow(r) {
    return normalizeTx({
      id: r.id,
      date: r.date,
      type: r.type,
      category: r.category,
      amount: Number(r.amount),
      memo: r.memo,
      author: r.author,
      createdAt: Date.parse(r.created_at),
    });
  }

  // import_transactions RPC에 넘길 형태
  function toImportRow(t) {
    return {
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      memo: t.memo,
      author: t.author,
      created_at: t.createdAt ? new Date(t.createdAt).toISOString() : null,
    };
  }

  function sanitizeBudget(raw) {
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 && n <= MAX_AMOUNT ? n : 0;
  }

  function sanitizeSettings(raw) {
    const s = raw !== null && typeof raw === 'object' ? raw : {};
    const goal = Number(s.savingsGoal);
    const rate = Number(s.interestRate);
    const months = Number(s.months);
    return {
      savingsGoal: Number.isSafeInteger(goal) && goal > 0 && goal <= MAX_AMOUNT ? goal : 0,
      interestRate: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0,
      months: Number.isInteger(months) && months >= 1 && months <= 600 ? months : 12,
      interestType: s.interestType === 'compound' ? 'compound' : 'simple',
    };
  }

  // 날짜별 날씨: { 'YYYY-MM-DD': { sky, temp } }
  function sanitizeWeather(raw) {
    const out = {};
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [date, w] of Object.entries(raw)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || w === null || typeof w !== 'object') continue;
      const sky = Object.hasOwn(SKIES, w.sky) ? w.sky : '';
      const temp = Number.isFinite(w.temp) && w.temp >= -60 && w.temp <= 60 ? w.temp : null;
      if (sky || temp !== null) out[date] = { sky, temp };
    }
    return out;
  }

  // ---------- 상태 ----------
  let loadedAt = 0;
  let transactions = [];
  let budget = 0;
  let settings = sanitizeSettings({});
  let weather = {};
  let settingsTimer = 0;
  let settingsPending = false;
  let liveWeather = null;
  let weatherLoading = false;
  let weatherError = false;
  let weatherFetchedAt = 0;
  let heroArtState = null;
  let editingId = null;
  let editingBudget = false;
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth(); // 0-based

  // ---------- 유틸 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthKey = () => `${viewYear}-${pad(viewMonth + 1)}`;
  const won = (n) => `${n.toLocaleString('ko-KR')}원`;
  const signedWon = (n) => (n < 0 ? '-' : '') + won(Math.abs(n));
  const parseAmount = (s) => Number(String(s).replace(/\D/g, '')) || 0;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function formatDayLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return `${m}월 ${d}일 (${WEEKDAYS[day]})`;
  }

  function isCurrentMonth() {
    const t = new Date();
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth;
  }

  function isPastMonth() {
    const t = new Date();
    return viewYear * 12 + viewMonth < t.getFullYear() * 12 + t.getMonth();
  }

  function defaultDate() {
    return isCurrentMonth() ? toDateStr(new Date()) : `${monthKey()}-01`;
  }

  function selectedType() {
    return el.form.querySelector('input[name="type"]:checked').value;
  }

  function setType(type) {
    el.form.querySelector(`input[name="type"][value="${type}"]`).checked = true;
    fillCategories(type);
  }

  function fillCategories(type, selected) {
    const list = CATEGORIES[type].slice();
    // 가져온 데이터에 목록에 없는 분류가 있으면 그대로 보여준다
    if (selected && !list.includes(selected)) list.push(selected);
    el.category.innerHTML = list
      .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
      .join('');
    if (selected) el.category.value = selected;
  }

  function formatAmountInput(input) {
    const digits = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
    input.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
  }

  // ---------- Supabase ----------
  async function selectAll(build) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE_SIZE) return rows;
    }
  }

  async function fetchLedger() {
    const [txRows, wRows, s] = await Promise.all([
      selectAll(() => db.from('transactions').select(TX_COLUMNS).order('date').order('id')),
      selectAll(() => db.from('daily_weather').select('date, sky, temp').order('date')),
      db.from('ledger_settings').select('*').maybeSingle(),
    ]);
    if (s.error) throw s.error;
    const row = s.data;
    return {
      hasSettings: Boolean(row),
      transactions: txRows.map(fromRow).filter(isValidTx),
      budget: row ? sanitizeBudget(row.budget) : 0,
      settings: sanitizeSettings(row ? {
        savingsGoal: Number(row.savings_goal),
        interestRate: Number(row.interest_rate),
        months: row.months,
        interestType: row.interest_type,
      } : {}),
      weather: sanitizeWeather(Object.fromEntries(wRows.map((r) => [
        r.date,
        { sky: r.sky || '', temp: r.temp === null ? null : Number(r.temp) },
      ]))),
    };
  }

  function applyLedger(d) {
    transactions = d.transactions;
    budget = d.budget;
    settings = d.settings;
    weather = d.weather;
    loadedAt = Date.now();
    if (editingId && !transactions.some((t) => t.id === editingId)) resetForm();
    syncSettingsInputs();
  }

  async function pushSettings() {
    const { error } = await db.from('ledger_settings').upsert({
      id: 1, // 공용 가계부라 설정은 한 행뿐이다
      budget,
      savings_goal: settings.savingsGoal,
      interest_rate: settings.interestRate,
      months: settings.months,
      interest_type: settings.interestType,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  // 입력할 때마다 저장하지 않도록 잠깐 모았다가 저장한다
  function saveSettings(delay = SETTINGS_SAVE_DELAY) {
    clearTimeout(settingsTimer);
    settingsPending = true;
    settingsTimer = setTimeout(flushSettings, delay);
  }

  async function flushSettings() {
    clearTimeout(settingsTimer);
    if (!settingsPending) return;
    settingsPending = false;
    try {
      await pushSettings();
    } catch (err) {
      notifyError('설정을 저장하지 못했어요.', err);
    }
  }

  function weatherRows(map) {
    return Object.entries(map).map(([date, w]) => ({ date, sky: w.sky || null, temp: w.temp }));
  }

  async function pushWeather(map, ignoreDuplicates = false) {
    const rows = weatherRows(map);
    if (!rows.length) return;
    const { error } = await db.from('daily_weather').upsert(rows, { ignoreDuplicates });
    if (error) throw error;
  }

  // 내역 날짜 옆에 보이도록 오늘 날씨를 기록한다
  function recordWeather() {
    if (!liveWeather) return;
    const date = liveWeather.time.slice(0, 10);
    weather[date] = { sky: liveWeather.sky, temp: liveWeather.temp };
    pushWeather({ [date]: weather[date] }).catch((err) => console.error(err));
  }

  // 예전 버전에서 브라우저에만 저장해 둔 기록을 DB로 옮긴다
  async function migrateLegacyData(hasSettings) {
    if (!legacyStorage.hasAny()) return false;
    const raw = legacyStorage.load(LEGACY_KEYS.transactions, []);
    const txs = Array.isArray(raw) ? raw.filter(isValidTx).map(normalizeTx) : [];
    if (txs.length && !confirm(`이 브라우저에만 저장돼 있던 내역 ${txs.length}건을 DB로 옮길까요?\n`
      + '취소하면 다음에 열 때 다시 물어볼게요.')) return false;

    if (txs.length) {
      const { error } = await db.rpc('import_transactions', { rows: txs.map(toImportRow) });
      if (error) throw error;
    }
    if (!hasSettings) {
      budget = sanitizeBudget(legacyStorage.load(LEGACY_KEYS.budget, 0));
      settings = sanitizeSettings(legacyStorage.load(LEGACY_KEYS.settings, {}));
      await pushSettings();
    }
    await pushWeather(sanitizeWeather(legacyStorage.load(LEGACY_KEYS.weather, {})), true);
    legacyStorage.clear();
    return true;
  }

  // ---------- 불러오기 ----------
  function setLoadState(state) {
    document.body.dataset.state = state; // 'loading' | 'ready'
  }

  async function openLedger() {
    setLoadState('loading');
    el.loadingMsg.textContent = '가계부를 불러오는 중이에요…';
    el.retryBtn.hidden = true;
    try {
      let d = await fetchLedger();
      if (await migrateLegacyData(d.hasSettings)) d = await fetchLedger();
      applyLedger(d);
      recordWeather();
      setLoadState('ready');
      render();
    } catch (err) {
      console.error(err);
      el.loadingMsg.textContent = `가계부를 불러오지 못했어요. ${err && err.message ? err.message : ''}`;
      el.retryBtn.hidden = false;
    }
  }

  async function reloadLedger() {
    try {
      const d = await fetchLedger();
      if (settingsPending) return;
      applyLedger(d);
      render();
    } catch (err) {
      console.error(err);
    }
  }

  el.retryBtn.addEventListener('click', openLedger);

  // ---------- 렌더링 ----------
  function monthTransactions() {
    const key = monthKey();
    return transactions.filter((t) => t.date.startsWith(key));
  }

  function render() {
    const list = monthTransactions();
    const o = outlook(list);
    el.monthLabel.textContent = `${viewYear}년 ${viewMonth + 1}월`;
    renderWeather();
    renderHero(o);
    renderSummary(list);
    renderBudget(list);
    renderSavings(o);
    renderBreakdown(list);
    renderList(list);
  }

  // 이번 달 저금 금액 = 수입 - 지출
  function outlook(list) {
    const { income, expense } = totals(list);
    return { income, expense, saved: income - expense };
  }

  function heroState(o) {
    const goal = settings.savingsGoal;
    if (!o.income && !o.expense) return 'empty';
    if (o.saved < 0) return 'beggar';
    if (o.saved === 0 || (goal && o.saved < goal)) return 'struggle';
    return 'princess';
  }

  function renderHero(o) {
    const state = heroState(o);
    const goal = settings.savingsGoal;
    const m = `${viewMonth + 1}월`;
    const past = isPastMonth();
    const saved = o.saved;
    let tag = '';
    let title;
    let desc;

    if (state === 'beggar') {
      tag = '적자 경보';
      title = past ? `${m}은 거지 신세` : '이대로 쓰면 거지 됩니다';
      desc = !o.income
        ? `수입은 0원인데 ${won(o.expense)}을 썼어요. 깡통 하나 장만하세요.`
        : `수입보다 ${won(-saved)} 더 썼어요. 저금은커녕 적자예요. 깡통 하나 장만하세요.`;
    } else if (state === 'struggle') {
      tag = '아슬아슬';
      title = '아슬아슬 줄타기 중';
      desc = saved === 0
        ? '저금할 돈이 한 푼도 없어요. 한 발만 삐끗하면 적자예요.'
        : `${m} 저금 금액은 ${won(saved)}이에요. 적자는 면했지만 저금 목표까지 ${won(goal - saved)} 모자라요.`;
    } else if (state === 'princess') {
      tag = '여유 만만';
      title = past ? `${m}은 부자 공주님` : '이대로면 부자 공주님';
      desc = `${m} 저금 금액은 ${won(saved)}이에요.${goal ? ' 저금 목표도 거뜬해요.' : ' 저금 목표도 정해 보세요.'}`;
    } else {
      title = '아직 기록이 없어요';
      desc = '수입과 지출을 입력하면 이대로 썼을 때 어떻게 될지 그림으로 보여드릴게요.';
    }

    el.hero.dataset.state = state;
    if (heroArtState !== state) {
      el.heroArt.innerHTML = window.GGB_ART[state];
      heroArtState = state;
    }
    el.heroTag.textContent = tag;
    el.heroTitle.textContent = title;
    el.heroDesc.textContent = desc;

    const facts = [];
    if (state !== 'empty') {
      facts.push(`저금 금액 (수입 − 지출) <b>${signedWon(saved)}</b>`);
      if (goal) facts.push(`저금 목표 <b>${won(goal)}</b>`);
    }
    el.heroFacts.innerHTML = facts.map((f) => `<span>${f}</span>`).join('');
  }

  // 매달 초에 같은 금액을 넣는다고 가정
  function savingsResult(monthly, months, ratePct, type) {
    const principal = monthly * months;
    const r = ratePct / 100 / 12;
    let interest;
    if (type === 'compound') {
      interest = r ? (monthly * (1 + r) * ((1 + r) ** months - 1)) / r - principal : 0;
    } else {
      interest = monthly * r * (months * (months + 1)) / 2;
    }
    interest = Math.round(interest);
    const tax = Math.round(interest * INTEREST_TAX);
    return { principal, interest, tax, total: principal + interest - tax };
  }

  function renderSavings(o) {
    const goal = settings.savingsGoal;
    const left = o.saved;

    // 이번 달 저금 목표 달성 여부
    let g = `<h3>${isCurrentMonth() ? '이번 달' : `${viewMonth + 1}월`} 저금 금액 (수입 − 지출)</h3>
      <strong class="big-num ${left < 0 ? 'expense' : ''}">${signedWon(left)}</strong>`;
    if (goal) {
      const met = left >= goal;
      const ratio = Math.min(Math.max(left, 0) / goal, 1);
      g += `<div class="budget-bar ${met ? 'good' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100"
          aria-valuenow="${Math.round(ratio * 100)}"><span style="width:${ratio * 100}%"></span></div>`;
      g += met
        ? `<p class="goal-msg income">저금 목표 ${won(goal)} 달성!${left > goal ? ` ${won(left - goal)} 더 남았어요.` : ''}</p>`
        : `<p class="goal-msg expense">저금 목표 ${won(goal)}까지 ${won(goal - Math.max(left, 0))} 모자라요.</p>`;
    } else {
      g += '<p class="goal-note">저금 목표를 입력하면 이번 달 목표를 채우는지 알려드려요.</p>';
    }
    el.goalStatus.innerHTML = g;

    // n개월 뒤 예상 저금액
    const n = settings.months;
    const rate = settings.interestRate;
    const typeLabel = settings.interestType === 'compound' ? '월복리' : '단리';
    let p = `<h3>이 저금 금액을 매달 넣으면 ${n}개월 뒤</h3>`;
    if (left <= 0) {
      p += '<strong class="big-num">0원</strong>';
      p += left < 0
        ? `<p class="goal-msg expense">저금할 돈이 없어요. 이 상태가 ${n}개월 이어지면 빚만 ${won(-left * n)} 쌓여요.</p>`
        : `<p class="goal-msg">남는 돈이 0원이라 ${n}개월 뒤에도 저금액은 0원이에요.</p>`;
    } else {
      const r = savingsResult(left, n, rate, settings.interestType);
      p += `<strong class="big-num income">${won(r.total)}</strong>
        <dl class="proj-table">
          <div><dt>매달 저금</dt><dd>${won(left)}</dd></div>
          <div><dt>원금 합계</dt><dd>${won(r.principal)}</dd></div>
          <div><dt>이자 (연 ${rate}%, ${typeLabel})</dt><dd>+${won(r.interest)}</dd></div>
          <div><dt>이자소득세 15.4%</dt><dd>-${won(r.tax)}</dd></div>
        </dl>`;
      if (goal && goal !== left) {
        p += `<p class="goal-note">목표 금액(${won(goal)})대로 저금하면 ${won(savingsResult(goal, n, rate, settings.interestType).total)}이에요.</p>`;
      }
      if (!rate) p += '<p class="goal-note">은행 이자율을 입력하면 이자까지 계산해요.</p>';
    }
    p += '<p class="goal-note">매달 초에 넣는다고 가정한 세후 예상치예요.</p>';
    el.projection.innerHTML = p;
  }

  function syncSettingsInputs() {
    el.goalInput.value = settings.savingsGoal ? settings.savingsGoal.toLocaleString('ko-KR') : '';
    el.rateInput.value = settings.interestRate ? String(settings.interestRate) : '';
    el.monthsInput.value = settings.months;
    el.interestType.value = settings.interestType;
  }

  function updateSettings(patch) {
    settings = { ...settings, ...patch };
    saveSettings();
    render();
  }

  // ---------- 날씨 ----------
  const formatTemp = (t) => `${t}°C`;
  const round1 = (n) => Math.round(n * 10) / 10;

  // WMO 날씨 코드 → 하늘 상태
  function skyFromCode(code) {
    if (code <= 1) return 'sunny';
    if (code === 2) return 'cloudy';
    if (code === 3) return 'overcast';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'thunder';
    return 'rain'; // 이슬비·비·소나기
  }

  async function fetchWeather() {
    if (weatherLoading) return;
    weatherLoading = true;
    renderWeather();
    try {
      const res = await fetch(WEATHER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const c = (await res.json()).current;
      if (!c || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.weather_code)) throw new Error('bad data');
      liveWeather = {
        sky: skyFromCode(c.weather_code),
        isDay: c.is_day !== 0,
        temp: round1(c.temperature_2m),
        feels: Number.isFinite(c.apparent_temperature) ? round1(c.apparent_temperature) : null,
        humidity: Number.isFinite(c.relative_humidity_2m) ? Math.round(c.relative_humidity_2m) : null,
        wind: Number.isFinite(c.wind_speed_10m) ? round1(c.wind_speed_10m) : null,
        time: String(c.time), // 서울 시간 'YYYY-MM-DDTHH:MM'
      };
      weatherFetchedAt = Date.now();
      weatherError = false;
      recordWeather();
    } catch {
      weatherError = true;
    } finally {
      weatherLoading = false;
      render();
    }
  }

  function renderWeather() {
    el.weatherRefresh.disabled = weatherLoading;
    el.weatherRefresh.textContent = weatherLoading ? '불러오는 중…' : '새로고침';

    const w = liveWeather;
    if (!w) {
      el.weatherBody.innerHTML = `<p class="empty">${weatherError
        ? '날씨를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침을 눌러 주세요.'
        : '날씨를 불러오는 중이에요…'}</p>`;
      return;
    }
    const s = SKIES[w.sky];
    const icon = w.sky === 'sunny' && !w.isDay ? '🌙' : s.icon;
    const facts = [
      w.feels !== null ? ['체감', formatTemp(w.feels)] : null,
      w.humidity !== null ? ['습도', `${w.humidity}%`] : null,
      w.wind !== null ? ['바람', `${w.wind}m/s`] : null,
    ].filter(Boolean);
    el.weatherBody.innerHTML = `
      <div class="weather-now">
        <span class="weather-icon" aria-hidden="true">${icon}</span>
        <div class="weather-main">
          <strong class="weather-temp">${formatTemp(w.temp)}</strong>
          <span class="weather-sky">${s.label}</span>
        </div>
        <dl class="weather-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </div>
      <p class="weather-meta">
        ${formatDayLabel(w.time.slice(0, 10))} ${escapeHtml(w.time.slice(11, 16))} 기준${weatherError ? ' · <span class="expense">최신 날씨를 불러오지 못했어요</span>' : ''}
        · 날씨 정보 <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
      </p>`;
  }

  function weatherBadge(date) {
    const w = weather[date];
    if (!w) return '';
    const parts = [];
    if (w.sky) parts.push(SKIES[w.sky].icon);
    if (w.temp !== null) parts.push(formatTemp(w.temp));
    const title = [w.sky ? SKIES[w.sky].label : '', w.temp !== null ? formatTemp(w.temp) : ''].filter(Boolean).join(', ');
    return ` <span class="day-weather" title="${escapeHtml(title)}">${parts.join(' ')}</span>`;
  }

  function totals(list) {
    let income = 0;
    let expense = 0;
    for (const t of list) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense };
  }

  function renderSummary(list) {
    const { income, expense } = totals(list);
    const balance = income - expense;
    el.sumIncome.textContent = won(income);
    el.sumExpense.textContent = won(expense);
    el.sumBalance.textContent = (balance < 0 ? '-' : '') + won(Math.abs(balance));
    el.sumBalance.className = balance < 0 ? 'expense' : '';
  }

  function renderBudget(list) {
    el.budgetEdit.hidden = editingBudget;
    el.budgetEdit.textContent = budget ? '변경' : '설정';

    if (editingBudget) {
      el.budgetBody.innerHTML = `
        <form class="budget-form" id="budgetForm">
          <div class="amount-wrap">
            <input type="text" id="budgetInput" inputmode="numeric" placeholder="매달 쓸 금액"
              value="${budget ? budget.toLocaleString('ko-KR') : ''}" aria-label="월 예산">
            <span class="unit">원</span>
          </div>
          <button type="button" class="ghost-btn" data-budget="cancel">취소</button>
          <button type="submit" class="primary-btn">저장</button>
        </form>`;
      const input = $('budgetInput');
      input.focus();
      input.select();
      return;
    }

    if (!budget) {
      el.budgetBody.innerHTML = '<p class="empty">예산을 설정하면 이번 달 지출 진행률을 볼 수 있어요.</p>';
      return;
    }

    const { expense } = totals(list);
    const ratio = expense / budget;
    const left = budget - expense;
    const state = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
    el.budgetBody.innerHTML = `
      <div class="budget-bar ${state}" role="progressbar" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${Math.round(Math.min(ratio, 1) * 100)}">
        <span style="width:${Math.min(ratio, 1) * 100}%"></span>
      </div>
      <div class="budget-meta num">
        <span><b>${won(expense)}</b> / ${won(budget)} (${Math.round(ratio * 100)}%)</span>
        <span>${left >= 0 ? `남은 예산 <b>${won(left)}</b>` : `<b class="expense">${won(-left)} 초과</b>`}</span>
      </div>`;
  }

  function renderBreakdown(list) {
    const byCat = new Map();
    let total = 0;
    for (const t of list) {
      if (t.type !== 'expense') continue;
      byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
      total += t.amount;
    }
    if (!total) {
      el.breakdown.innerHTML = '<p class="empty">이번 달 지출 내역이 없습니다.</p>';
      return;
    }
    const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const max = rows[0][1];
    el.breakdown.innerHTML = `<ul class="cat-list">${rows.map(([cat, amt]) => `
      <li class="cat-row">
        <span>${escapeHtml(cat)}</span>
        <span class="cat-amt">${won(amt)}<span class="cat-pct">${Math.round((amt / total) * 100)}%</span></span>
        <div class="cat-bar"><span style="width:${(amt / max) * 100}%"></span></div>
      </li>`).join('')}</ul>`;
  }

  function renderList(list) {
    const type = el.filterType.value;
    const q = el.search.value.trim().toLowerCase();
    const filtered = list
      .filter((t) => type === 'all' || t.type === type)
      .filter((t) => !q || [t.memo, t.category, t.author].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    if (!filtered.length) {
      el.txList.innerHTML = `<p class="empty">${list.length ? '조건에 맞는 내역이 없습니다.' : '이번 달 내역이 없습니다. ‘내역 추가’에서 입력해 보세요.'}</p>`;
      return;
    }

    const groups = new Map();
    for (const t of filtered) {
      if (!groups.has(t.date)) groups.set(t.date, []);
      groups.get(t.date).push(t);
    }

    el.txList.innerHTML = [...groups.entries()].map(([date, items]) => {
      const { income, expense } = totals(items);
      const dayTotals = [
        income ? `<span class="income">+${won(income)}</span>` : '',
        expense ? `<span class="expense">-${won(expense)}</span>` : '',
      ].filter(Boolean).join(' ');
      return `
        <div class="day">
          <div class="day-head"><span>${formatDayLabel(date)}${weatherBadge(date)}</span><span class="num">${dayTotals}</span></div>
          <ul class="tx-list">${items.map(renderRow).join('')}</ul>
        </div>`;
    }).join('');
  }

  function renderRow(t) {
    const sign = t.type === 'income' ? '+' : '-';
    return `
      <li class="tx${t.id === editingId ? ' editing' : ''}" data-id="${escapeHtml(t.id)}">
        <span class="tags">
          <span class="chip">${escapeHtml(t.category)}</span>
          ${t.author ? `<span class="who" title="입력한 사람">${escapeHtml(t.author)}</span>` : ''}
        </span>
        <span class="memo${t.memo ? '' : ' none'}" title="${escapeHtml(t.memo)}">${t.memo ? escapeHtml(t.memo) : '메모 없음'}</span>
        <span class="amt ${t.type}">${sign}${won(t.amount)}</span>
        <span class="row-actions">
          <button type="button" data-action="edit">수정</button>
          <button type="button" data-action="delete">삭제</button>
        </span>
      </li>`;
  }

  // ---------- 폼 ----------
  const savedAuthor = {
    load() {
      try {
        return localStorage.getItem(AUTHOR_KEY) || '';
      } catch {
        return '';
      }
    },
    save(name) {
      try {
        localStorage.setItem(AUTHOR_KEY, name);
      } catch {
        // 기억하지 못해도 다음에 다시 입력하면 된다
      }
    },
  };

  function resetForm() {
    editingId = null;
    el.formCard.classList.remove('editing');
    el.formTitle.textContent = '내역 추가';
    el.submitBtn.textContent = '추가';
    el.cancelEdit.hidden = true;
    el.amount.value = '';
    el.memo.value = '';
    el.author.value = savedAuthor.load();
    if (!el.date.value) el.date.value = defaultDate();
  }

  function startEdit(id) {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    setType(t.type);
    fillCategories(t.type, t.category);
    el.date.value = t.date;
    el.amount.value = t.amount.toLocaleString('ko-KR');
    el.memo.value = t.memo;
    el.author.value = t.author;
    el.formCard.classList.add('editing');
    el.formTitle.textContent = '내역 수정';
    el.submitBtn.textContent = '수정';
    el.cancelEdit.hidden = false;
    el.formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.amount.focus({ preventScroll: true });
    render();
  }

  async function deleteTx(id) {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    const label = `${formatDayLabel(t.date)} ${t.category} ${won(t.amount)}`;
    if (!confirm(`${label} 내역을 삭제할까요?`)) return;
    const { error } = await db.from('transactions').delete().eq('id', id);
    if (error) {
      notifyError('내역을 삭제하지 못했어요.', error);
      return;
    }
    transactions = transactions.filter((x) => x.id !== id);
    if (editingId === id) resetForm();
    render();
  }

  el.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseAmount(el.amount.value);
    if (!amount || amount > MAX_AMOUNT) {
      alert('금액을 올바르게 입력해 주세요.');
      el.amount.focus();
      return;
    }
    if (!el.date.value) {
      el.date.focus();
      return;
    }
    const author = el.author.value.trim();
    if (!author) {
      alert('입력한 사람 이름을 적어 주세요.');
      el.author.focus();
      return;
    }
    const data = {
      date: el.date.value,
      type: selectedType(),
      category: el.category.value,
      amount,
      memo: el.memo.value.trim(),
      author,
    };
    if (!editingId) savedAuthor.save(author); // 남의 내역을 고칠 때는 내 이름을 바꾸지 않는다

    const id = editingId;
    el.submitBtn.disabled = true;
    try {
      const query = id
        ? db.from('transactions').update(data).eq('id', id)
        : db.from('transactions').insert(data);
      const { data: row, error } = await query.select(TX_COLUMNS).single();
      if (error) throw error;
      const saved = fromRow(row);
      transactions = id
        ? transactions.map((t) => (t.id === id ? saved : t))
        : [...transactions, saved];
    } catch (err) {
      notifyError('내역을 저장하지 못했어요.', err);
      return;
    } finally {
      el.submitBtn.disabled = false;
    }

    // 저장한 날짜의 달로 이동해 결과가 바로 보이게 한다
    const [y, m] = data.date.split('-').map(Number);
    viewYear = y;
    viewMonth = m - 1;
    resetForm();
    render();
    el.amount.focus();
  });

  el.cancelEdit.addEventListener('click', () => {
    resetForm();
    render();
  });

  el.form.addEventListener('change', (e) => {
    if (e.target.name === 'type') fillCategories(e.target.value);
  });

  el.amount.addEventListener('input', () => formatAmountInput(el.amount));

  // ---------- 월 이동 ----------
  function moveMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    if (!editingId) el.date.value = defaultDate();
    render();
  }

  el.prevMonth.addEventListener('click', () => moveMonth(-1));
  el.nextMonth.addEventListener('click', () => moveMonth(1));
  el.monthLabel.addEventListener('click', () => {
    const t = new Date();
    moveMonth((t.getFullYear() - viewYear) * 12 + (t.getMonth() - viewMonth));
  });

  // ---------- 내역 목록 ----------
  el.txList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('.tx').dataset.id;
    if (btn.dataset.action === 'edit') startEdit(id);
    else if (btn.dataset.action === 'delete') deleteTx(id);
  });

  el.filterType.addEventListener('change', () => renderList(monthTransactions()));
  el.search.addEventListener('input', () => renderList(monthTransactions()));

  // ---------- 예산 ----------
  el.budgetEdit.addEventListener('click', () => {
    editingBudget = true;
    render();
  });

  el.budgetBody.addEventListener('input', (e) => {
    if (e.target.id === 'budgetInput') formatAmountInput(e.target);
  });

  el.budgetBody.addEventListener('click', (e) => {
    if (e.target.dataset.budget === 'cancel') {
      editingBudget = false;
      render();
    }
  });

  el.budgetBody.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = parseAmount($('budgetInput').value);
    budget = value <= MAX_AMOUNT ? value : 0; // 비우고 저장하면 예산 해제
    saveSettings(0);
    editingBudget = false;
    render();
  });

  // ---------- 저금 계획 ----------
  el.goalInput.addEventListener('input', () => {
    formatAmountInput(el.goalInput);
    updateSettings({ savingsGoal: parseAmount(el.goalInput.value) });
  });

  el.rateInput.addEventListener('input', () => {
    const v = parseFloat(el.rateInput.value);
    updateSettings({ interestRate: Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 0 });
  });

  el.monthsInput.addEventListener('input', () => {
    const v = Number(el.monthsInput.value);
    if (Number.isInteger(v) && v >= 1 && v <= 600) updateSettings({ months: v });
  });
  // 잘못된 값을 남긴 채 벗어나면 저장된 값으로 되돌린다
  el.monthsInput.addEventListener('change', syncSettingsInputs);
  el.rateInput.addEventListener('change', syncSettingsInputs);

  el.interestType.addEventListener('change', () => updateSettings({ interestType: el.interestType.value }));

  // ---------- 날씨 새로고침 ----------
  el.weatherRefresh.addEventListener('click', fetchWeather);

  setInterval(() => {
    if (!document.hidden) fetchWeather();
  }, WEATHER_REFRESH_MS);

  // 오래 다른 탭에 있다 돌아오면 다시 불러온다 (다른 기기·탭에서 바꾼 내역도 반영)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushSettings(); // 탭을 닫기 전에 모아 둔 설정을 저장한다
      return;
    }
    if (Date.now() - weatherFetchedAt > WEATHER_REFRESH_MS) fetchWeather();
    if (loadedAt && !editingId && !editingBudget && Date.now() - loadedAt > RELOAD_MS) reloadLedger();
  });

  // ---------- 백업 ----------
  el.exportBtn.addEventListener('click', () => {
    const payload = {
      app: 'ggb',
      version: 1,
      exportedAt: new Date().toISOString(),
      budget,
      settings,
      weather,
      transactions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `가계부_${toDateStr(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  el.importInput.addEventListener('change', async () => {
    const file = el.importInput.files[0];
    el.importInput.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      alert('JSON 파일을 읽을 수 없습니다.');
      return;
    }
    const rawList = Array.isArray(parsed) ? parsed : parsed && parsed.transactions;
    if (!Array.isArray(rawList)) {
      alert('가계부 백업 파일 형식이 아닙니다.');
      return;
    }
    const valid = rawList.filter(isValidTx).map(normalizeTx);
    const skipped = rawList.length - valid.length;
    const msg = `${valid.length}건을 불러옵니다${skipped ? ` (형식이 맞지 않는 ${skipped}건 제외)` : ''}.\n`
      + `현재 저장된 ${transactions.length}건은 모두 대체됩니다. 계속할까요?`;
    if (!confirm(msg)) return;

    try {
      const { error } = await db.rpc('import_transactions', { rows: valid.map(toImportRow), replace: true });
      if (error) throw error;
      const backup = parsed && !Array.isArray(parsed) ? parsed : null;
      if (backup && (Number.isSafeInteger(backup.budget) || backup.settings)) {
        if (Number.isSafeInteger(backup.budget) && backup.budget >= 0) budget = sanitizeBudget(backup.budget);
        if (backup.settings) settings = sanitizeSettings(backup.settings);
        clearTimeout(settingsTimer);
        settingsPending = false;
        await pushSettings();
      }
      if (backup && backup.weather) await pushWeather(sanitizeWeather(backup.weather));
      applyLedger(await fetchLedger());
    } catch (err) {
      notifyError('백업을 가져오지 못했어요.', err);
      reloadLedger();
      return;
    }
    resetForm();
    render();
  });

  // ---------- 시작 ----------
  syncSettingsInputs();
  fillCategories('expense');
  el.date.value = defaultDate();
  el.author.value = savedAuthor.load();
  render();
  fetchWeather();
  openLedger();
})();
