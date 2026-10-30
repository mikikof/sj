(() => {
  'use strict';

  const config = window.REVIEW_CONFIG || {};
  const apiUrl = typeof config.API_URL === 'string' ? config.API_URL : '';
  const pollMs = Number(config.POLL_MS) > 0 ? Number(config.POLL_MS) : 10000;
  const timeoutMs = Number(config.TIMEOUT_MS) > 0 ? Number(config.TIMEOUT_MS) : 26000;
  const sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms';
  // CodePen の fullpage は Referer が codepen.io でないと、上に英語の黒い帯を出します。帯の高さ（実測 98〜99px）と、その下にできる影（約 5px）の分だけ上へずらして隠します。0 で無効。
  const cropTop = Number.isFinite(Number(config.PREVIEW_CROP_TOP)) ? Math.max(0, Math.min(160, Math.round(Number(config.PREVIEW_CROP_TOP)))) : 104;
  const classes = ['A', 'B', 'C', 'D', 'E', 'F'];
  const $ = id => document.getElementById(id);
  const LOGIN_FAIL_LIMIT = 5;
  const loginLead = document.querySelector('.login-lead');
  const studentLead = Array.from(loginLead.childNodes, node => node.cloneNode(true));
  const LOGIN_TEXT = {
    studentMismatch: '組・出席番号・パスワードのどれかが、合いません。配られた紙を見て、入れ直してください。続けて ' + LOGIN_FAIL_LIMIT + ' 回間違えると、10 分間ログインできなくなります。',
    studentLocked: 'この組・出席番号では、間違いが続いたため、10 分間ログインできません。10 分たってから、入れ直してください。紙をなくしたとき、10 分たっても、入れないときは、直接伝えてください。',
    teacherMismatch: 'パスワードが合いません。',
    teacherLocked: '間違いが続いたため、10 分間ログインできません。10 分たってから、入れ直してください。'
  };
  const allFailureKinds = message => Object.fromEntries(['offline', 'timeout', 'http', 'broken'].map(kind => [kind, message]));
  const FAIL_TEXT = {
    board: {
      offline: 'ネットとの接続が、切れているようです。つながると、自動でもう一度読み込みます。',
      timeout: 'ネットとの接続が、切れているようです。つながると、自動でもう一度読み込みます。',
      http: 'うまく、読み込めませんでした。少し待つと、自動でもう一度、読み込みます。',
      broken: 'うまく、読み込めませんでした。少し待つと、自動でもう一度、読み込みます。'
    },
    login: {
      offline: 'つながりませんでした。ネットにつながっているか確かめて、もう一度「ログイン」を押してください。',
      timeout: 'つながりませんでした。ネットにつながっているか確かめて、もう一度「ログイン」を押してください。',
      http: 'うまく、受け取れませんでした。少し待って、もう一度「ログイン」を押してください。',
      broken: 'うまく、受け取れませんでした。少し待って、もう一度「ログイン」を押してください。'
    },
    comment: {
      offline: '送れませんでした。書いた文は残っています。ネットにつながってから、もう一度「送る」を押してください。',
      ...Object.fromEntries(['timeout', 'http', 'broken'].map(kind => [kind, '送れたか確かめられませんでした。コメントの欄に出ていなければ、もう一度「送る」を押してください。書いた文は残っています。']))
    },
    like: allFailureKinds('いいねを変えられませんでした。ボタンの色を見てから、もう一度押してください。'),
    delete: allFailureKinds('消せませんでした。コメントが残っていれば、もう一度「消す」を押してください。'),
    report: allFailureKinds('知らせられませんでした。もう一度「知らせる」を押してください。'),
    vote_ctl: allFailureKinds('投票の状態を変えられませんでした。もう一度押してください。'),
    scope_set: allFailureKinds('見せる範囲を変えられませんでした。もう一度押してください。'),
    password_list: allFailureKinds('パスワードの設定状況を読み込めませんでした。箱を開き直すと、もう一度読み込みます。'),
    password_reset: allFailureKinds('リセットできたか確かめられませんでした。やめるを押して一覧を開き直し、設定状況を確認してください。'),
    vote_live: allFailureKinds('集計を更新できませんでした。次の更新で取り直します。'),
    vote_results: allFailureKinds('結果を読み込めませんでした。一覧へ戻って、もう一度開いてください。')
  };
  const readStorage = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, value); } catch (_) { /* 保存できなくても、この画面では使えます。 */ } };
  const removeStorage = key => { try { localStorage.removeItem(key); } catch (_) { /* 保存できない環境にも対応します。 */ } };
  const savedPreview = readStorage('sj-review-preview');
  const initialPreview = savedPreview === '1' ? true : savedPreview === '0' ? false
    : !matchMedia('(prefers-reduced-motion: reduce)').matches && config.PREVIEW_DEFAULT !== false;
  let seen = {};
  try { const value = JSON.parse(readStorage('sj-review-seen') || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) seen = value; } catch (_) { /* 初めて開いたときと同じ状態です。 */ }
  const state = {
    token: readStorage('sj-review') || '', me: null, works: [], comments: [], rev: '',
    teacherLogin: false, studentPasscode: false, studentSetup: false, studentPassword: false, studentEntry: false, loginBusy: false, passwordNoticeTimer: null, view: 'A', modalKey: null, preview: initialPreview, busyBoard: false,
    queuedForce: false, lastFull: 0, lastPollAt: 0, pollTimer: null, serverPollMs: pollMs, hiddenAt: null, hiddenPreviewTimer: null, session: 0, writes: 0, sending: false, sendRun: 0,
    kind: '感想', drafts: new Map(), cards: new Map(), likesBusy: new Set(), groupKey: '', commentsKey: '',
    visible: new Set(), previewFrame: 0, previewTimer: null, previewQueue: [], nextPreviewAt: 0, returnFocus: null, hasBoard: false,
    vote: null, voteBusy: false, voteError: '', voteControlBusy: false, voteControlError: '', projector: null, projectionRun: 0,
    scope: 'class', scopeBusy: false, scopeError: '', myVotesKey: '', arrivals: new Map(), arrivalTimer: null,
    passwordOpen: false, passwordClass: 'A', passwordPeople: null, passwordBusy: false, passwordRun: 0, passwordError: '', passwordReset: null, passwordResetBusy: false, passwordReturnFocus: null,
    mypageKey: '', replyDrafts: new Map(), replyBusy: new Set(), mypageReturn: 'A', live: null, liveBusy: false, liveTimer: null, liveClass: 'A', liveShow: false, hideReports: false, liveStarted: false, liveError: '', confettiFrame: 0, projectionFocus: null,
    seenIds: new Map(), announceFrame: 0, loginWaitTimer: null, commentWaitTimer: null, reportCounts: new Map(), reported: new Set(), reportCursor: null, feedbackVersion: 0, pollFailures: 0
  };

  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  // §15: an unchanged value must not emit a DOM mutation (including reflected properties).
  function setText(element, value) { const text = String(value); if (element.textContent !== text) element.textContent = text; }
  function setProperty(element, key, value) { if (element[key] !== value) element[key] = value; }
  function setAttribute(element, key, value) { const text = String(value); if (element.getAttribute(key) !== text) element.setAttribute(key, text); }
  function removeAttribute(element, key) { if (element.hasAttribute(key)) element.removeAttribute(key); }
  function setClass(element, key, value) { if (element.classList.contains(key) !== !!value) element.classList.toggle(key, !!value); }

  const pendingRenders = new Map(), composingReplies = new Set();
  let pressedControl = null, renderFlushTimer = null;
  function queueRenderFlush() {
    clearTimeout(renderFlushTimer);
    renderFlushTimer = setTimeout(() => {
      for (const [container, render] of Array.from(pendingRenders)) {
        if (pendingRenders.get(container) !== render) continue;
        pendingRenders.delete(container);
        if (container.isConnected) render();
      }
    }, 0);
  }
  function controlKey(node) {
    return node.nodeType !== 1 ? '' : node.id ? 'id:' + node.id
      : node.hasAttribute('data-vote-star') ? 'star:' + node.dataset.voteStar
      : node.hasAttribute('data-password-reset') ? 'reset:' + node.dataset.passwordReset
      : node.hasAttribute('data-key') ? 'key:' + node.dataset.key : '';
  }
  // Only these small generated panels are reconciled. Button handlers are properties so that
  // retained buttons use the newest state without replacing their DOM node or keyboard focus.
  function patchPanel(current, next) {
    if (current.nodeType === 3) { if (current.data !== next.data) current.data = next.data; return; }
    pendingRenders.delete(current);
    if (current === document.activeElement && next.disabled) {
      // Native disabled blurs even a retained button in Chrome and WebKit.
      // Expose the new state and prevent activation now; finish native disabling
      // after focus moves. A newer render replaces or cancels this pending state.
      const ariaDisabled = next.getAttribute('aria-disabled');
      next.disabled = false; next.setAttribute('aria-disabled', 'true'); next.onclick = null;
      const finishDisable = () => {
        if (current === document.activeElement) { pendingRenders.set(current, finishDisable); return; }
        setProperty(current, 'disabled', true);
        if (ariaDisabled === null) removeAttribute(current, 'aria-disabled');
        else setAttribute(current, 'aria-disabled', ariaDisabled);
      };
      pendingRenders.set(current, finishDisable);
    }
    for (const attribute of Array.from(current.attributes)) if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
    for (const attribute of Array.from(next.attributes)) setAttribute(current, attribute.name, attribute.value);
    current.onclick = next.onclick;
    const old = Array.from(current.childNodes), used = new Set();
    for (const [index, desired] of Array.from(next.childNodes).entries()) {
      const key = controlKey(desired);
      const match = key ? old.find(node => !used.has(node) && controlKey(node) === key)
        : old.find((node, position) => position === index && !used.has(node) && !controlKey(node) && node.nodeType === desired.nodeType && node.nodeName === desired.nodeName);
      const node = match || desired;
      if (match) { used.add(match); patchPanel(match, desired); }
      if (current.childNodes[index] !== node) current.insertBefore(node, current.childNodes[index] || null);
    }
    for (const node of old) if (!used.has(node) && node.parentNode === current) node.remove();
  }
  function stablePanel(container, next) {
    const active = document.activeElement, key = container.contains(active) ? controlKey(active) : '';
    const losesFocus = key && !Array.from(next.querySelectorAll('*')).some(node => controlKey(node) === key);
    // A held mouse/keyboard press finishes against its original button before any new state.
    if (container.contains(pressedControl) || losesFocus) {
      pendingRenders.set(container, () => stablePanel(container, next)); return false;
    }
    pendingRenders.delete(container);
    patchPanel(container, next);
    return true;
  }
  document.addEventListener('pointerdown', event => { pressedControl = event.target.closest?.('button') || null; }, true);
  document.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) pressedControl = event.target.closest?.('button') || null; }, true);
  const releaseControl = () => { setTimeout(() => { pressedControl = null; queueRenderFlush(); }, 0); };
  document.addEventListener('pointerup', releaseControl, true);
  document.addEventListener('pointercancel', releaseControl, true);
  document.addEventListener('keyup', releaseControl, true);
  document.addEventListener('focusout', queueRenderFlush, true);

  function showNetwork(message) {
    setText($('network-status'), message || '');
    setText($('dialog-network'), message || '');
  }

  function failure(kind) { const error = new Error(kind); error.kind = kind; return error; }
  function validPerson(person) {
    if (!person || typeof person.name !== 'string' || typeof person.teacher !== 'boolean') return false;
    if (person.teacher) return person.key === '先生' && person.cls === '先生';
    return classes.includes(person.cls) && Number.isInteger(person.no) && person.no >= 1 && person.no <= 40 && person.key === person.cls + '-' + String(person.no).padStart(2, '0');
  }
  function failureText(op, error) { return error.api ? error.message : FAIL_TEXT[op][error.kind || 'broken']; }
  function clearFailures(expectedVersion) {
    if (expectedVersion !== undefined && expectedVersion !== state.feedbackVersion) return state.feedbackVersion;
    state.feedbackVersion += 1;
    for (const element of document.querySelectorAll('#login-error, #comment-error, #like-error, .comment-error')) element.textContent = '';
    return state.feedbackVersion;
  }
  function showFailure(element, text) {
    element.textContent = text;
    keepQuotedText(element);
    element.scrollIntoView({ block: 'nearest' });
  }
  function keepQuotedText(element) {
    const text = element.textContent;
    const matches = Array.from(text.matchAll(/「[^」]+」/g));
    if (!matches.length) return;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      fragment.append(document.createTextNode(text.slice(offset, match.index)), document.createElement('wbr'), textElement('span', 'nb', match[0]), document.createElement('wbr'));
      offset = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(offset)));
    element.replaceChildren(fragment);
  }
  function reconcileWrite(error) {
    if (['timeout', 'http', 'broken'].includes(error.kind)) refreshBoard(true);
  }
  // 時間切れでも書き込みが済んでいることがある。取り直した盤面に、同じ文の自分のコメントが増えていれば、送れたものとして下書きと赤い文を消す（同じ文を二重に送らせない）。
  async function reconcileSavedComment(key, text, submittedDraft, knownMine, session) {
    await refreshBoard(true);
    if (session !== state.session) return;
    if (!state.comments.some(comment => comment.mine && comment.to === key && !comment.replyTo && comment.text === text && !knownMine.has(comment.id))) return;
    const saved = state.drafts.get(key); if (saved && saved.text === submittedDraft) state.drafts.delete(key);
    if (state.modalKey === key && $('comment-text').value === submittedDraft) $('comment-text').value = '';
    clearFailures();
    if (state.modalKey === key) { renderComments(false); announceComments('コメントを送りました。'); }
  }
  function stopLoginWait() {
    clearTimeout(state.loginWaitTimer);
    state.loginWaitTimer = null;
    $('login-wait').textContent = '';
  }
  function stopCommentWait() {
    clearTimeout(state.commentWaitTimer);
    state.commentWaitTimer = null;
    $('comment-wait').textContent = '';
    $('comment-send').textContent = '送る';
    $('comment-send').classList.remove('is-waiting');
    $('comment-send').removeAttribute('aria-disabled');
  }
  function announceComments(message) {
    cancelAnimationFrame(state.announceFrame);
    $('comments-status').textContent = '';
    state.announceFrame = requestAnimationFrame(() => {
      if (state.modalKey) $('comments-status').textContent = message;
    });
  }

  async function request(op, data = {}) {
    if (!apiUrl) throw new Error('受け取り口の URL が入っていません');
    const session = state.session;
    const sender = state.me?.key;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ op, token: state.token, ...data }),
        redirect: 'follow', credentials: 'omit', signal: controller.signal
      });
      if (!response.ok) throw failure('http');
      let result;
      try { result = await response.json(); } catch (error) { if (error.name === 'AbortError') throw error; throw failure('broken'); }
      if (!result || typeof result.ok !== 'boolean') throw failure('broken');
      if (!result.ok) {
        if (result.code === 'auth' && op !== 'login' && session === state.session) showLogin('ログインの期限が切れました。もう一度ログインしてください。');
        // 受け取り口の文は「合言葉」と書くことがある。画面の言い方（パスワード）にそろえる。
        const error = new Error(typeof result.why === 'string' ? result.why.replace(/合言葉/g, 'パスワード') : '受け付けられませんでした。');
        error.api = true;
        error.code = result.code;
        error.loginMode = result.loginMode;
        error.entry = result.entry === true;
        throw error;
      }
      if (op === 'login' && (typeof result.token !== 'string' || !result.token || !validPerson(result.me))) throw failure('broken');
      if (op === 'board' && result.unchanged !== true && (!validPerson(result.me) || !Array.isArray(result.works) || !Array.isArray(result.comments) || !validVotePayload(result.vote, result.me))) throw failure('broken');
      if (op === 'comment') {
        const comment = result.comment;
        if (!comment || typeof comment.id !== 'string' || !comment.id || comment.to !== data.to || comment.from !== sender || typeof comment.fromName !== 'string' || comment.kind !== (data.replyTo ? '返信' : data.kind) || (data.replyTo && comment.replyTo !== data.replyTo) || typeof comment.text !== 'string' || comment.text !== data.text || !Number.isFinite(comment.at) || comment.mine !== true) throw failure('broken');
      }
      if (op === 'vote_set' && (!Array.isArray(result.mine) || result.mine.length > 2 || !result.mine.every(v => v && typeof v.to === 'string' && /^[A-F]-\d{2}$/.test(v.to)) || result.remaining !== 2 - result.mine.length)) throw failure('broken');
      if (op === 'vote_ctl' && !validVotePayload(result.status, state.me)) throw failure('broken');
      if (op === 'scope_set' && !['class', 'all'].includes(result.scope)) throw failure('broken');
      if (op === 'password_list' && (result.cls !== data.cls || !Array.isArray(result.people) || !Number.isInteger(result.set) || result.total !== result.people.length || result.set !== result.people.filter(person => person.set).length || !result.people.every(person => person && Number.isInteger(person.no) && person.no >= 1 && person.no <= 40 && typeof person.name === 'string' && typeof person.set === 'boolean'))) throw failure('broken');
      if (op === 'vote_results' && (result.cls !== data.cls || !Array.isArray(result.ranking))) throw failure('broken');
      if (op === 'like' && (typeof result.liked !== 'boolean' || !Number.isInteger(result.likes) || result.likes < 0)) throw failure('broken');
      if (session === state.session) showNetwork('');
      return result;
    } catch (error) {
      if (error.api || error.kind) throw error;
      throw failure(error.name === 'AbortError' ? 'timeout' : error instanceof TypeError ? 'offline' : 'broken');
    } finally { clearTimeout(timeout); }
  }

  function validWork(work) {
    if (!work || !classes.includes(work.cls) || !Number.isInteger(Number(work.no)) || Number(work.no) < 1 || Number(work.no) > 40) return null;
    const key = work.cls + '-' + String(Number(work.no)).padStart(2, '0');
    if (work.key !== key) return null;
    const submitted = !!work.submitted && /^[A-Za-z0-9_-]{1,40}$/.test(work.user || '') && /^[A-Za-z0-9]{3,20}$/.test(work.pen || '');
    return {
      key, cls: work.cls, no: Number(work.no), name: String(work.name || ''), submitted,
      user: submitted ? work.user : '', pen: submitted ? work.pen : '',
      likes: Math.max(0, Number(work.likes) || 0), liked: !!work.liked,
      n: Math.max(0, Number(work.n) || 0), q: Math.max(0, Number(work.q) || 0)
    };
  }

  function currentView() {
    const value = location.hash.slice(1);
    const available = availableClasses();
    if (!state.hasBoard) return value === 'me' && state.me && !state.me.teacher ? 'me' : classes.includes(value) || value === 'all' ? value : classes.includes(state.me?.cls) ? state.me.cls : 'A';
    if (value === 'me' && state.me && !state.me.teacher) return 'me';
    if (classOnly()) return state.me.cls;
    if (value === 'all' && available.length > 1) return value;
    return available.includes(value) ? value : available.includes(state.me?.cls) ? state.me.cls : available[0] || 'A';
  }

  function classOnly() { return !!state.me && !state.me.teacher && state.scope === 'class'; }

  function normalizeScopeHash() {
    if (state.hasBoard && classOnly() && location.hash !== '#me' && location.hash !== '#' + state.me.cls) {
      history.replaceState(history.state, '', '#' + state.me.cls);
    }
  }

  // 保存してあるトークンが管理用なら、期限が切れても管理用のログインの欄を出す（生徒用の欄が出て戸惑わないように）。
  function tokenIsTeacher(token) { try { return JSON.parse(atob(String(token).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).t === 't'; } catch (_) { return false; } }
  function showLogin(message = '') {
    if (state.me ? state.me.teacher : tokenIsTeacher(state.token)) state.teacherLogin = true;
    state.session += 1;
    pendingRenders.clear(); composingReplies.clear(); pressedControl = null;
    state.serverPollMs = pollMs; state.followedView = '';
    clearTimeout(state.hiddenPreviewTimer); state.hiddenPreviewTimer = null; state.hiddenAt = null;
    state.token = '';
    state.me = null;
    state.works = [];
    state.comments = [];
    state.rev = '';
    state.hasBoard = false;
    state.vote = null;
    state.scope = 'class'; state.scopeBusy = false; state.scopeError = ''; state.myVotesKey = '';
    state.passwordOpen = false; state.passwordClass = 'A'; state.passwordPeople = null; state.passwordBusy = false; state.passwordRun += 1; state.passwordError = ''; state.passwordReset = null; state.passwordResetBusy = false; state.passwordReturnFocus = null;
    clearTimeout(state.passwordNoticeTimer); $('password-notice').textContent = '';
    if ($('password-confirm').open) $('password-confirm').close();
    $('password-confirm-text').textContent = ''; $('password-confirm-error').textContent = '';
    renderPasswordControls();
    state.arrivals.clear(); clearTimeout(state.arrivalTimer); state.arrivalTimer = null;
    $('vote-status').textContent = '';
    if ($('scope-confirm').open) $('scope-confirm').close();
    if ($('stage-confirm').open) $('stage-confirm').close();
    renderScopeControls();
    state.live = null; state.liveShow = false; state.hideReports = false; document.body.classList.remove('hide-reports'); state.liveError = ''; state.liveStarted = false; clearTimeout(state.liveTimer); state.liveTimer = null;
    state.replyDrafts.clear(); state.replyBusy.clear(); state.mypageKey = '';
    $('mypage-view').hidden = true;
    $('mypage-identity').textContent = '';
    $('mypage-own').replaceChildren(); delete $('mypage-own').dataset.contentKey; $('mypage-comments').replaceChildren(); $('mypage-replies').replaceChildren();
    $('new-replies').hidden = true;
    state.voteBusy = false;
    state.voteError = '';
    state.voteControlBusy = false;
    state.voteControlError = '';
    closeProjection();
    renderVoteBand();
    renderVotePanel();
    state.sending = false;
    state.sendRun += 1;
    state.pollFailures = 0;
    state.likesBusy.clear();
    state.groupKey = '';
    state.seenIds.clear();
    state.reportCounts.clear();
    state.reported.clear();
    state.reportCursor = null;
    stopLoginWait();
    stopCommentWait();
    clearPreviewQueue();
    clearFailures();
    showNetwork('');
    clearTimeout(state.pollTimer);
    removeStorage('sj-review');
    closeModal(false);
    state.drafts.clear();
    observer.disconnect();
    resizeObserver.disconnect();
    state.cards.clear();
    state.visible.clear();
    $('work-groups').replaceChildren();
    $('comments').replaceChildren();
    $('work-title').textContent = '';
    $('work-position').textContent = '';
    $('current-user').textContent = '';
    $('comment-text').value = '';
    $('new-comments').textContent = '';
    $('new-comments').hidden = true;
    $('report-alert').textContent = '';
    $('report-alert').hidden = true;
    $('codepen-link').removeAttribute('href');
    $('board-loading').hidden = false;
    $('board-loading').textContent = '作品を読み込んでいます。';
    $('board-view').hidden = true;
    $('board-view').classList.remove('teacher-view');
    $('login-view').hidden = false;
    $('login-error').textContent = message;
    $('login-code').value = '';
    $('login-code').type = 'password';
    $('login-code-visible').checked = false;
    state.studentPasscode = false;
    state.studentSetup = false; state.studentPassword = false; state.studentEntry = false;
    renderLoginFields();
    $('login-submit').textContent = 'ログイン';
    $('login-submit').disabled = !apiUrl;
    if (history.state && history.state.reviewModal) history.replaceState({}, '', location.href);
  }

  function enterBoardPending() {
    $('login-view').hidden = true;
    $('board-view').hidden = false;
    $('my-work').hidden = true;
    $('current-user').textContent = '前回のログインを確かめています。';
  }

  function presetClassFromHash() {
    if (state.loginBusy) return;
    const cls = location.hash.slice(1);
    if (!$('login-view').hidden && !state.teacherLogin && classes.includes(cls) && $('login-class').value !== cls) {
      $('login-class').value = cls;
      clearStudentCode();
    }
  }

  // 見ている組（#B など）と投票パネルの対象がずれたまま、別の組の投票を始めてしまわないよう、対象を見ている組に合わせます。
  function followLiveClass() {
    if (!state.me?.teacher) return;
    if (!classes.includes(state.view)) { state.followedView = ''; return; }
    // 見ている組が変わったときだけ追従する（投票パネルの組ボタンで選んだ組を、盤面の更新で戻さない）。
    if (state.followedView === state.view) return;
    state.followedView = state.view;
    if (state.liveClass === state.view) return;
    state.liveClass = state.view; state.live = null;
    renderVoteBand(); clearTimeout(state.liveTimer); state.liveTimer = null; refreshLive();
  }

  function applyHideReports() {
    const hide = !!state.me?.teacher && state.hideReports;
    document.body.classList.toggle('hide-reports', hide);
    $('report-hide').textContent = hide ? '知らせを出す' : '知らせを隠す'; $('report-hide').setAttribute('aria-pressed', String(hide));
  }
  $('report-hide').addEventListener('click', () => { state.hideReports = !state.hideReports; applyHideReports(); });

  function showBoard() {
    const entering = $('board-view').hidden || !state.hasBoard;
    $('login-view').hidden = true;
    $('board-view').hidden = !!state.projector;
    $('board-view').classList.toggle('teacher-view', !!state.me.teacher);
    $('current-user').textContent = state.me.teacher ? '管理用でログインしています。' : state.me.cls + '組 ' + state.me.no + '番　' + state.me.name;
    $('my-work').hidden = !!state.me.teacher;
    $('report-hide').hidden = !state.me.teacher; applyHideReports();
    $('password-controls').hidden = !state.me.teacher;
    if (!classes.includes(location.hash.slice(1)) && location.hash !== '#all' && location.hash !== '#me' && !(state.me.teacher && /^#vote-[A-F]$/.test(location.hash))) history.replaceState({}, '', '#' + currentView());
    normalizeScopeHash();
    state.view = currentView();
    followLiveClass();
    updateTabs();
    if (entering && !state.projector) $('current-user').focus({ preventScroll: true });
  }

  function schedulePoll() {
    clearTimeout(state.pollTimer);
    const backoff = state.pollFailures >= 2 ? Math.pow(2, state.pollFailures - 1) : 1;
    const interval = Math.min(60000, state.serverPollMs * backoff) * (0.7 + Math.random() * 0.3);
    if (state.token && !document.hidden) state.pollTimer = setTimeout(() => refreshBoard(false), Math.max(0, interval - (Date.now() - state.lastPollAt)));
  }

  async function refreshBoard(force = false) {
    if (!state.token || document.hidden) return;
    if (state.busyBoard) { state.queuedForce = state.queuedForce || force; return; }
    state.busyBoard = true;
    state.lastPollAt = Date.now();
    const session = state.session;
    const writes = state.writes;
    const full = force || !state.rev || Date.now() - state.lastFull >= 300000;
    try {
      const result = await request('board', full ? {} : { rev: state.rev });
      if (session !== state.session || !state.token) return;
      state.pollFailures = 0;
      state.serverPollMs = Number.isFinite(Number(result.poll)) && Number(result.poll) > 0 ? Number(result.poll) : pollMs;
      if (writes !== state.writes) { state.queuedForce = true; return; }
      if (full) state.lastFull = Date.now();
      if (result.unchanged) return;
      if (!result.works.length && state.works.length && result.scope === state.scope) return;
      const works = result.works.map(validWork).filter(Boolean).sort((a, b) => a.cls.localeCompare(b.cls) || a.no - b.no);
      if (!works.length && state.works.length && result.scope === state.scope) return;
      const previousVote = state.vote?.state, hadBoard = state.hasBoard;
      const scopeChanged = state.scope !== result.scope;
      const scrollPosition = [window.scrollX, window.scrollY];
      trackArrivals(works, scopeChanged);
      state.me = result.me;
      state.scope = result.scope === 'all' ? 'all' : 'class';
      const incomingVote = normalizeVote(result.vote);
      if (state.voteBusy && incomingVote?.state === 'open' && !state.me.teacher) { incomingVote.mine = state.vote.mine; incomingVote.remaining = state.vote.remaining; }
      state.vote = incomingVote;
      state.works = works;
      state.comments = result.comments.filter(comment => comment && typeof comment.id === 'string' && typeof comment.text === 'string');
      state.rev = result.rev;
      state.hasBoard = true;
      if (hadBoard && !state.me.teacher && previousVote !== incomingVote?.state) {
        announceVote(previousVote === 'closed' && incomingVote?.state === 'open' ? '投票が始まりました。'
          : previousVote === 'open' && incomingVote?.state === 'ended' ? '投票はしめきりました。' : '');
      }
      showBoard();
      renderBoard();
      renderMypage();
      if (state.modalKey) renderModal(false);
      updateNotification();
      renderVoteBand();
      renderScopeControls();
      syncProjection();
      scheduleLive();
      if (hadBoard && scopeChanged) window.scrollTo(...scrollPosition);
    } catch (error) {
      if (session === state.session && state.token) { state.pollFailures += 1; showNetwork(failureText('board', error)); }
    } finally {
      state.busyBoard = false;
      if (state.queuedForce && state.token) {
        state.queuedForce = false;
        refreshBoard(true);
      } else schedulePoll();
    }
  }

  function availableClasses() { return classes.filter(cls => state.works.some(work => work.cls === cls)); }

  function updateTabs() {
    const available = availableClasses();
    const wanted = [...available, ...(available.length > 1 ? ['all'] : [])];
    const nav = $('class-tabs');
    if (Array.from(nav.querySelectorAll('a'), link => link.hash.slice(1)).join(',') !== wanted.join(',')) {
      nav.replaceChildren(...wanted.map(cls => { const link = textElement('a', '', cls === 'all' ? '学年ぜんたい' : cls + '組'); link.href = '#' + cls; return link; }));
    }
    for (const link of nav.querySelectorAll('a')) {
      if (link.hash === '#' + state.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    nav.hidden = state.view === 'me' || classOnly();
    $('board-view').classList.toggle('class-only', classOnly());
    $('board-main').hidden = state.view === 'me';
    $('mypage-view').hidden = state.view !== 'me';
    document.querySelector('.header-bottom').hidden = state.view === 'me';
    if (state.view !== 'me' && $('mypage-own').querySelector('iframe')) { $('mypage-own').querySelector('iframe').remove(); delete $('mypage-own').dataset.contentKey; state.mypageKey = ''; }
  }

  function visibleWorks() { return state.works.filter(work => state.view === 'all' || work.cls === (state.view === 'me' ? state.me?.cls : state.view)); }

  function renderBoard() {
    updateReportCounts();
    const works = visibleWorks();
    const groupKey = state.view + ':' + (classOnly() ? 'class:' : '') + works.map(work => work.key).join(',');
    $('board-loading').hidden = state.hasBoard && state.works.length > 0;
    $('board-loading').textContent = state.hasBoard && !state.works.length
      ? '作品の一覧が、まだできていません。できると、この画面に自動で出ます。それでも出ないときは、直接伝えてください。'
      : '作品を読み込んでいます。';
    if (groupKey !== state.groupKey) {
      state.groupKey = groupKey;
      clearPreviewQueue();
      observer.disconnect();
      resizeObserver.disconnect();
      state.visible.clear();
      state.cards.clear();
      $('work-groups').replaceChildren();
      for (const cls of availableClasses().filter(value => state.view === 'all' || (state.view === 'me' ? state.me?.cls : state.view) === value)) {
        const members = works.filter(work => work.cls === cls);
        const section = textElement('section', 'class-group');
        section.dataset.cls = cls;
        const bar = textElement('div', 'class-bar');
        const heading = textElement('h2', 'class-heading', cls + (classOnly() ? '組の作品' : '組'));
        heading.append(textElement('span'));
        const jump = textElement('select');
        jump.setAttribute('aria-label', '番号へ移る');
        const first = textElement('option', '', '番号を選ぶ');
        first.value = '';
        jump.append(first);
        for (const member of members) {
          const option = textElement('option', '', member.no + '番');
          option.value = member.key;
          jump.append(option);
        }
        jump.addEventListener('change', () => {
          state.cards.get(jump.value)?.article.scrollIntoView({ block: 'start' });
          jump.value = '';
        });
        bar.append(heading, jump);
        const note = textElement('p', 'empty-note group-note');
        note.hidden = true;
        section.append(bar, note);
        const grid = textElement('div', 'works-grid');
        for (const work of members) grid.append(createCard(work));
        section.append(grid);
        $('work-groups').append(section);
      }
    }
    for (const section of $('work-groups').querySelectorAll('.class-group')) {
      const members = works.filter(work => work.cls === section.dataset.cls);
      const submitted = members.filter(work => work.submitted).length;
      section.querySelector('.class-heading span').textContent = members.length + '人（提出 ' + submitted + '）';
      const note = section.querySelector('.group-note');
      note.textContent = !members.length
        ? 'この組の一覧は、まだできていません。できると、この画面に自動で出ます。'
        : 'この組では、まだだれも作品を出していません。';
      note.hidden = submitted > 0;
    }
    for (const work of works) updateCard(work);
    if (state.modalKey) resizeObserver.observe($('modal-preview'));
    schedulePreviews();
  }

  function createCard(work) {
    const article = textElement('article', 'work-card');
    article.dataset.key = work.key;
    article.dataset.cls = work.cls;
    article.dataset.no = work.no;
    const button = textElement('button', 'work-open');
    button.type = 'button';
    const heading = textElement('span', 'card-heading');
    const number = textElement('span', 'card-number', String(work.no).padStart(2, '0'));
    number.append(textElement('small', '', '番'));
    const person = textElement('span', 'card-person');
    const name = textElement('span', 'card-name', work.name);
    const own = textElement('span', 'own-tag', '自分の作品');
    const voteStar = textElement('span', 'card-vote');
    voteStar.hidden = true;
    const voteLabel = textElement('span', 'card-vote-label', 'あなたが入れた');
    voteLabel.hidden = true;
    const got = textElement('span', 'card-got');
    got.hidden = true;
    const reportTag = state.me.teacher ? textElement('span', 'report-tag', '知らせあり') : null;
    person.append(name, own, voteLabel);
    if (reportTag) { reportTag.hidden = true; person.append(reportTag); }
    heading.append(number, person, voteStar);
    const preview = textElement('span', 'preview-frame');
    const placeholder = textElement('span', 'preview-placeholder', '▶ 開く');
    const arrival = textElement('span', 'card-arrival', 'いま届きました');
    arrival.hidden = true; arrival.setAttribute('aria-hidden', 'true');
    preview.append(placeholder, arrival);
    button.append(heading, preview);
    const stats = textElement('div', 'card-stats');
    const likes = textElement('span', 'card-likes');
    const comments = textElement('span', 'card-comments');
    const questions = textElement('span', 'card-questions');
    stats.append(likes, comments, questions);
    article.append(button, stats, got);
    button.addEventListener('click', () => openModal(work.key));
    state.cards.set(work.key, { article, button, name, own, reportTag, voteStar, voteLabel, arrival, got, preview, placeholder, likes, comments, questions, work, iframe: null });
    observer.observe(preview);
    resizeObserver.observe(preview);
    return article;
  }

  function updateCard(work) {
    const card = state.cards.get(work.key);
    if (!card) return;
    const changedPen = card.work.user !== work.user || card.work.pen !== work.pen;
    card.work = work;
    const own = work.key === state.me.key;
    setClass(card.article, 'own', own);
    setClass(card.article, 'unsubmitted', !work.submitted);
    setAttribute(card.article, 'data-submitted', work.submitted);
    setProperty(card.button, 'disabled', !work.submitted);
    setAttribute(card.button, 'aria-label', work.cls + '組 ' + work.no + '番 ' + work.name + (work.submitted ? 'の作品を開く' : '。まだ出ていません') + (own ? '。自分の作品です' : ''));
    setText(card.name, work.name);
    setProperty(card.own, 'hidden', !own);
    const voted = !state.me.teacher && state.vote?.state !== 'closed' && state.vote?.mine?.some(v => v.to === work.key);
    setProperty(card.voteStar, 'hidden', !voted);
    setProperty(card.voteLabel, 'hidden', !voted);
    setProperty(card.arrival, 'hidden', !work.submitted || (state.arrivals.get(work.key) || 0) <= Date.now());
    setText(card.voteStar, voted ? '★'.repeat(state.vote.mine.filter(v => v.to === work.key).length) : '');
    if (voted) setAttribute(card.voteStar, 'aria-label', '自分が投票した作品');
    else removeAttribute(card.voteStar, 'aria-label');
    const got = own ? receivedVoteText() : '';
    setText(card.got, got);
    setProperty(card.got, 'hidden', !got);
    const hasReports = !!state.me.teacher && (state.reportCounts.get(work.key) || 0) > 0;
    if (card.reportTag) setProperty(card.reportTag, 'hidden', !hasReports);
    setClass(card.article, 'has-reports', hasReports);
    setText(card.placeholder, work.submitted ? '▶ 開く' : own ? 'あなたの作品は、まだ出ていません。' : 'まだ出ていません');
    setText(card.likes, '♥ ' + work.likes);
    setText(card.comments, work.n > 0 ? 'コメント ' + work.n : '');
    setText(card.questions, '');
    setProperty(card.likes, 'hidden', !work.submitted);
    setProperty(card.comments, 'hidden', !work.submitted || work.n === 0);
    setProperty(card.questions, 'hidden', true);
    if ((!work.submitted || changedPen) && card.iframe) { card.iframe.remove(); card.iframe = null; }
  }

  function makeIframe(work, interactive) {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', sandbox);
    frame.referrerPolicy = 'no-referrer';
    frame.loading = interactive ? 'eager' : 'lazy';
    frame.width = '800';
    frame.height = String(600 + cropTop);
    if (cropTop) frame.style.height = (600 + cropTop) + 'px';
    frame.title = work.cls + '組 ' + work.no + '番の作品';
    frame.src = 'https://cdpn.io/' + work.user + '/fullpage/' + work.pen;
    if (!interactive) { frame.tabIndex = -1; frame.setAttribute('aria-hidden', 'true'); }
    return frame;
  }

  function fitFrame(container) {
    const frame = container.querySelector('iframe');
    if (!frame) return;
    let scale = container.clientWidth / 800;
    // 作品の窓の枠は、窓の高さに合わせて縦に伸びる。作品に渡す画面の高さも、枠の高さに合わせて増やす（縮尺は変えず、見える縦の範囲を広げる）。
    // 枠が横に長いときは、縮尺を下げて、渡す画面が 800×600（これまでの大きさ）より小さくならないようにする。
    if (container.id === 'modal-preview' && container.clientWidth > 0 && container.clientHeight > 0) {
      scale = Math.min(scale, container.clientHeight / 600);
      const width = Math.round(container.clientWidth / scale) + 'px', height = Math.min(3000, Math.ceil(container.clientHeight / scale)) + cropTop + 'px';
      if (frame.style.width !== width) frame.style.width = width;
      if (frame.style.height !== height) frame.style.height = height;
    }
    const transform = 'scale(' + scale + ')' + (cropTop ? ' translateY(-' + cropTop + 'px)' : '');
    if (frame.style.transform !== transform) frame.style.transform = transform;
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) state.visible.add(entry.target);
      else state.visible.delete(entry.target);
    }
    schedulePreviews();
  }, { rootMargin: '220px 0px' });
  const resizeObserver = new ResizeObserver(entries => { for (const entry of entries) fitFrame(entry.target); });
  function updateDialogHeadingSize() {
    const height = document.querySelector('.dialog-heading').getBoundingClientRect().height;
    if (height > 0) $('work-dialog').style.setProperty('--dialog-heading-height', height + 'px');
  }
  const dialogHeadingObserver = new ResizeObserver(updateDialogHeadingSize);
  dialogHeadingObserver.observe(document.querySelector('.dialog-heading'));

  function schedulePreviews() {
    if (!state.previewFrame) state.previewFrame = requestAnimationFrame(updatePreviews);
  }

  function clearPreviewQueue() {
    clearTimeout(state.previewTimer);
    state.previewTimer = null;
    state.previewQueue = [];
  }

  function updatePreviews() {
    cancelAnimationFrame(state.previewFrame);
    state.previewFrame = 0;
    // §15: short trips to another tab retain the already loaded CodePen documents.
    if (document.hidden && state.hiddenAt !== null && Date.now() - state.hiddenAt < 60000) { clearPreviewQueue(); return; }
    // 同時に動かす本数は端末に合わせる（コアが 4 以下の Chromebook・iPad などは 6 本、それ以外は 12 本。前は 16 本）。窓を開いている間は CSS で止める。
    const limit = (Number(navigator.hardwareConcurrency) || 4) <= 4 ? 6 : 12;
    const candidates = state.preview && !document.hidden && !state.projector && state.view !== 'me' ? Array.from(state.cards.values()).filter(card => card.work.submitted && state.visible.has(card.preview)) : [];
    // 画面に入っているカードを先にし、そのあと画面の中央に近い順（画面の外の余白ぶんは、空いた本数だけ）。
    const previewRank = card => { const r = card.preview.getBoundingClientRect(); return (r.bottom > 0 && r.top < innerHeight ? 0 : 1e6) + Math.abs(r.top - innerHeight / 2); };
    candidates.sort((a, b) => previewRank(a) - previewRank(b));
    const keep = new Set(candidates.slice(0, limit));
    for (const card of state.cards.values()) if (card.iframe && !keep.has(card)) { card.iframe.remove(); card.iframe = null; }
    clearPreviewQueue();
    for (const card of keep) fitFrame(card.preview);
    if (!state.preview || document.hidden || state.modalKey) return;
    state.previewQueue = Array.from(keep).filter(card => !card.iframe);
    if (state.previewQueue.length && Date.now() < state.nextPreviewAt) {
      state.previewTimer = setTimeout(updatePreviews, state.nextPreviewAt - Date.now());
      return;
    }
    let created = 0;
    while (state.previewQueue.length && created < 4) {
      const card = state.previewQueue.shift();
      if (state.cards.get(card.work.key) !== card || !card.article.isConnected || !card.work.submitted || !state.visible.has(card.preview) || card.iframe) continue;
      card.iframe = makeIframe(card.work, false);
      card.preview.append(card.iframe);
      fitFrame(card.preview);
      created += 1;
    }
    if (created) state.nextPreviewAt = Date.now() + 250;
    if (state.previewQueue.length) state.previewTimer = setTimeout(updatePreviews, 250);
  }

  function saveDraft() {
    if (state.modalKey && !$('work-dialog').classList.contains('scope-unavailable')) state.drafts.set(state.modalKey, { text: $('comment-text').value, kind: state.kind });
  }

  function releaseCommentView(container) {
    // Explicit navigation/revocation cancels background work for the old view. A deferred
    // callback must never put old comments back after their work has been closed or hidden.
    pendingRenders.delete(container);
    for (const input of composingReplies) if (container.contains(input)) composingReplies.delete(input);
    if (container.contains(document.activeElement) && document.activeElement.matches('.reply-text')) document.activeElement.blur();
  }

  function openModal(key, push = true) {
    const work = state.works.find(item => item.key === key);
    if (!work || !work.submitted) return;
    const changingWork = !!state.modalKey;
    const navigationButton = changingWork && ['prev-work', 'next-work'].includes(document.activeElement?.id) ? document.activeElement : null;
    if (state.modalKey) saveDraft();
    else state.returnFocus = document.activeElement;
    if (state.modalKey !== key) releaseCommentView($('comments'));
    state.modalKey = key;
    $('work-dialog').classList.remove('scope-unavailable');
    state.commentsKey = '';
    const draft = state.drafts.get(key) || { text: '', kind: '感想' };
    $('comment-text').value = draft.text;
    state.kind = draft.kind;
    clearFailures();
    if (push) {
      if (history.state?.reviewModal) history.replaceState({ reviewModal: key }, '', location.href);
      else history.pushState({ reviewModal: key }, '', location.href);
    }
    if (!$('work-dialog').open) $('work-dialog').showModal();
    document.body.classList.add('dialog-open');
    updatePreviews();
    for (const element of document.querySelectorAll('#work-dialog, .work-display, .conversation, #comments')) element.scrollTop = 0;
    renderModal(true);
    updateDialogHeadingSize();
    updateComposer();
    if (!changingWork) $('work-title').focus({ preventScroll: true });
    else if (navigationButton && !navigationButton.disabled) navigationButton.focus({ preventScroll: true });
    const total = state.comments.filter(comment => comment.to === key && !comment.replyTo).length;
    announceComments(changingWork ? work.cls + '組 ' + work.no + '番 ' + work.name : total > 0 ? 'コメント ' + total + ' 件' : 'コメント');
  }

  function closeModal(goBack = true) {
    if (!state.modalKey && !$('work-dialog').open) return;
    saveDraft();
    releaseCommentView($('comments'));
    state.modalKey = null;
    clearFailures();
    cancelAnimationFrame(state.announceFrame);
    $('comments-status').textContent = '';
    $('modal-preview').replaceChildren();
    if ($('work-dialog').open) $('work-dialog').close();
    document.body.classList.remove('dialog-open');
    schedulePreviews();
    if (goBack && history.state && history.state.reviewModal) history.back();
    if (state.returnFocus && state.returnFocus.isConnected) state.returnFocus.focus({ preventScroll: true });
    else if (state.view === 'me') ($('mypage-open') || $('mypage-title')).focus({preventScroll:true});
  }

  function modalSequence() { return visibleWorks().filter(work => work.submitted); }

  function navigateModal(direction) {
    const sequence = modalSequence();
    const position = sequence.findIndex(work => work.key === state.modalKey);
    const work = sequence[position + direction];
    if (!work) return;
    try { history.replaceState({ reviewModal: work.key }, '', location.href); } catch (_) {}
    openModal(work.key, false);
  }

  function renderModal(changedWork) {
    const work = state.works.find(item => item.key === state.modalKey);
    if (!work && classOnly() && state.modalKey && state.modalKey[0] !== state.me.cls) {
      // A scope change revokes the old data while keeping the open dialog and draft.
      saveDraft(); $('work-dialog').classList.add('scope-unavailable');
      $('work-title').textContent = 'この作品は表示できません。';
      $('work-position').textContent = '自分の組の作品だけです。';
      releaseCommentView($('comments'));
      $('modal-preview').replaceChildren(); $('comments').replaceChildren(); state.commentsKey = '';
      $('codepen-link').removeAttribute('href'); $('vote-panel').replaceChildren();
      $('comment-text').value = ''; return;
    }
    if (!work || !work.submitted) { closeModal(false); return; }
    if ($('work-dialog').classList.contains('scope-unavailable')) {
      $('comment-text').value = state.drafts.get(work.key)?.text || '';
      $('work-dialog').classList.remove('scope-unavailable');
    }
    $('work-title').textContent = work.name;
    $('work-position').textContent = work.cls + '組 ' + work.no + '番' + (work.key === state.me.key ? '・自分の作品' : '');
    $('work-dialog').dataset.key = work.key;
    const frame = $('modal-preview').querySelector('iframe');
    const src = 'https://cdpn.io/' + work.user + '/fullpage/' + work.pen;
    if (!frame || frame.src !== src) {
      $('modal-preview').replaceChildren();
      updatePreviews();
      // 読み込みの間は「読み込んでいます」を出し、作品が出そろってから見せます（白い枠のまま止まって見えないように）。
      const loadingNote = textElement('span', 'preview-placeholder preview-loading', '作品を読み込んでいます…'), frame2 = makeIframe(work, true);
      frame2.style.opacity = '0';
      const slowNote = setTimeout(() => { loadingNote.textContent = '時間がかかっています。うまく見えないときは、「CodePen で開く」を押してください。'; }, 8000);
      frame2.addEventListener('load', () => { clearTimeout(slowNote); frame2.style.opacity = ''; loadingNote.remove(); }, { once: true });
      $('modal-preview').append(loadingNote, frame2);
      resizeObserver.observe($('modal-preview'));
      fitFrame($('modal-preview'));
    }
    $('codepen-link').href = 'https://codepen.io/' + work.user + '/pen/' + work.pen;
    $('like-button').textContent = (work.liked ? '♥ いいね済み ' : '♥ いいね ') + work.likes;
    $('like-button').setAttribute('aria-pressed', String(work.liked));
    $('like-button').disabled = work.key === state.me.key || state.likesBusy.has(work.key);
    $('like-button').removeAttribute('title');
    $('like-note').textContent = work.key === state.me.key ? '自分の作品には、いいねを付けられません。' : 'いいねは、もう一度押すと取り消せます。';
    const likePhrases = $('like-note').textContent.match(/^(自分の作品には、|いいねは、)(いいねを|もう一度押すと)(付けられません。|取り消せます。)$/);
    if (likePhrases) {
      const fragments = [];
      for (const phrase of likePhrases.slice(1)) {
        if (fragments.length) fragments.push(document.createElement('wbr'));
        fragments.push(textElement('span', 'nb', phrase));
      }
      $('like-note').replaceChildren(...fragments);
    }
    $('report-note').hidden = !!state.me.teacher;
    const sequence = modalSequence();
    const position = sequence.findIndex(item => item.key === work.key);
    $('prev-work').disabled = position <= 0;
    $('next-work').disabled = position < 0 || position >= sequence.length - 1;
    if (changedWork) state.voteError = '';
    renderVotePanel();
    renderComments(changedWork);
    if (work.key === state.me.key) {
      seen[state.me.key] = Date.now();
      writeStorage('sj-review-seen', JSON.stringify(seen));
      updateNotification();
    }
  }

  function commentAuthor(comment) {
    return /^[A-F]-\d{2}$/.test(comment.from) ? comment.from.replace(/^([A-F])-0?(\d+)$/, '$1組 $2番') + ' ' + comment.fromName : '管理用';
  }

  function createComment(comment, scope, oldErrors = new Map(), nesting = false) {
    const article = textElement('article', 'comment' + (nesting ? ' comment-reply' : ''));
    article.dataset.id = comment.id;
    const reported = state.me.teacher && Number(comment.reported) > 0;
    article.classList.toggle('reported', !!reported);
    const header = textElement('div', 'comment-head');
    header.append(textElement('span', 'comment-author', commentAuthor(comment)));
    header.append(textElement('span', 'kind-badge' + (comment.kind === '質問' ? ' question' : ''), comment.replyTo ? 'コメントバック' : comment.kind));
    const time = textElement('time', 'comment-time');
    const at = new Date(Number(comment.at));
    if (Number.isFinite(at.getTime())) {
      time.dateTime = at.toISOString();
      time.textContent = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at);
    }
    article.append(header, time, textElement('p', 'comment-text', comment.text));
    const actions = textElement('div', 'comment-actions');
    if (comment.mine || state.me.teacher) {
      const remove = textElement('button', '', '消す'); remove.type = 'button'; remove.dataset.action = 'delete';
      remove.addEventListener('click', () => changeComment('delete', comment, remove)); actions.append(remove);
    }
    if (!comment.mine && !state.me.teacher) {
      const report = textElement('button', '', state.reported.has(comment.id) ? '知らせました' : '知らせる');
      report.type = 'button'; report.dataset.action = 'report'; report.disabled = state.reported.has(comment.id);
      report.classList.toggle('done', report.disabled);
      report.addEventListener('click', () => changeComment('report', comment, report)); actions.append(report);
    }
    if (reported) actions.append(textElement('span', 'reported-count', '知らせ ' + Number(comment.reported) + '件'));
    const error = textElement('p', 'comment-error error-message', oldErrors.get(comment.id) || '');
    error.setAttribute('role', 'alert'); keepQuotedText(error); actions.append(error); article.append(actions);
    if (!nesting && !comment.replyTo) {
      const replies = state.comments.filter(reply => reply.replyTo === comment.id).sort((a,b) => a.at-b.at || a.id.localeCompare(b.id));
      const list = textElement('div', 'comment-replies');
      for (const reply of replies) list.append(createComment(reply, scope, oldErrors, true));
      article.append(list);
      if (!state.me.teacher && comment.to === state.me.key && !comment.mine) {
        if (!replies.length) article.append(textElement('p', 'reply-unanswered', 'まだ返していません。'));
        if (replies.length >= 3) article.append(textElement('p', 'reply-limit', '返信は 3 件までです。'));
        else {
          const replyButton = textElement('button', 'secondary reply-open', 'コメントバック');
          replyButton.type = 'button'; replyButton.dataset.action = 'reply';
          const draft = state.replyDrafts.get(comment.id);
          replyButton.hidden = !!draft?.open;
          replyButton.addEventListener('click', () => {
            state.replyDrafts.set(comment.id, { text: draft?.text || '', open: true, error: '' });
            replaceCommentViews();
            findCommentInScope(scope, comment.id)?.querySelector('.reply-text')?.focus();
          });
          article.append(replyButton);
          if (draft?.open) article.append(createReplyForm(comment, scope));
        }
      }
    }
    return article;
  }

  function findCommentInScope(scope, id) { return Array.from($(scope).querySelectorAll('.comment')).find(article => article.dataset.id === id); }
  function preserveCommentFocus(container, render) {
    // Restoring a selection after replacement does not restore an IME composition.
    // Keep the original textarea until both focus and composition have ended; the map
    // replaces earlier pending callbacks so several polls produce one final render.
    if (container.contains(document.activeElement) && document.activeElement.matches('.reply-text')
        || Array.from(composingReplies).some(input => container.contains(input))) {
      pendingRenders.set(container, () => preserveCommentFocus(container, render)); return;
    }
    pendingRenders.delete(container);
    const active = document.activeElement;
    const focused = container.contains(active);
    const id = focused ? active.closest('.comment')?.dataset.id : null;
    const action = active.dataset?.action;
    const textarea = active.matches?.('.reply-text');
    const selection = textarea ? [active.selectionStart, active.selectionEnd] : null;
    const top = container.scrollTop;
    render(); container.scrollTop = top;
    if (!id) return;
    const article = Array.from(container.querySelectorAll('.comment')).find(item => item.dataset.id === id);
    const target = textarea ? article?.querySelector('.reply-text') : action ? article?.querySelector('[data-action="' + action + '"]') : null;
    if (target && !target.disabled) { target.focus({ preventScroll: true }); if (selection) target.setSelectionRange(...selection); }
    else (container.id === 'comments' ? $('comments-title') : $('mypage-title')).focus({preventScroll:true});
  }

  function createReplyForm(comment, scope) {
    const draft = state.replyDrafts.get(comment.id);
    const busy = state.replyBusy.has(comment.id);
    const form = textElement('form', 'reply-form');
    const label = textElement('label', '', 'コメントバック');
    const input = textElement('textarea', 'reply-text'); input.rows = 3; input.value = draft.text;
    input.setAttribute('aria-label', 'コメントバックの本文');
    label.append(input);
    const note = textElement('p', 'reply-note', '返事は、この作品を見た人みんなに見えます。');
    const row = textElement('div', 'reply-send-row');
    const remaining = textElement('span', 'reply-remaining muted'); remaining.setAttribute('role', 'status');
    const send = textElement('button', 'primary reply-send', busy ? '送っています…' : '送る'); send.type = 'submit'; send.dataset.action = 'reply-send';
    const cancel = textElement('button', 'quiet reply-cancel', 'やめる'); cancel.type = 'button'; cancel.dataset.action = 'reply-cancel'; cancel.disabled = busy;
    const error = textElement('p', 'reply-error error-message', draft.error || ''); error.setAttribute('role', 'alert');
    const update = () => {
      const value = cleanText(input.value), length = Array.from(value).length, lines = (value.match(/\n/g) || []).length;
      remaining.textContent = length > 200 ? '200 字をこえています。' + (length-200) + ' 字ぶん減らしてください。' : lines > 3 ? '改行は 3 つまでです。' : '残り ' + (200-length) + ' 字';
      send.disabled = state.replyBusy.has(comment.id) || length < 1 || length > 200 || lines > 3;
      input.setAttribute('aria-invalid', String(length > 200 || lines > 3));
      draft.text = input.value;
    };
    input.addEventListener('input', update);
    input.addEventListener('compositionstart', () => composingReplies.add(input));
    input.addEventListener('compositionend', () => { composingReplies.delete(input); update(); queueRenderFlush(); });
    update();
    cancel.addEventListener('click', () => {
      draft.open = false; draft.error = ''; replaceCommentViews();
      findCommentInScope(scope, comment.id)?.querySelector('[data-action="reply"]')?.focus({ preventScroll: true });
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (send.disabled || state.replyBusy.has(comment.id)) return;
      const session = state.session; const value = cleanText(input.value);
      state.replyBusy.add(comment.id); draft.error = ''; send.disabled = cancel.disabled = true; send.textContent = '送っています…';
      try {
        const result = await request('comment', { to: comment.to, replyTo: comment.id, text: value });
        if (session !== state.session) return;
        state.writes += 1;
        if (!state.comments.some(item => item.id === result.comment.id)) state.comments.unshift(result.comment);
        state.replyDrafts.delete(comment.id); replaceCommentViews();
        const article = findCommentInScope(scope, comment.id);
        (article?.querySelector('[data-action="reply"]') || article?.querySelector('[data-action="delete"]') || (scope === 'comments' ? $('comments-title') : $('mypage-title'))).focus({ preventScroll: true });
        refreshBoard(true);
      } catch (error) {
        if (session === state.session) { draft.error = failureText('comment', error); reconcileWrite(error); }
      } finally {
        if (session === state.session) {
          state.replyBusy.delete(comment.id); replaceCommentViews();
          if (draft.error) findCommentInScope(scope, comment.id)?.querySelector('.reply-text')?.focus({ preventScroll: true });
        }
      }
    });
    row.append(remaining, send, cancel); form.append(label, note, row, error); return form;
  }

  function replaceCommentViews() {
    state.commentsKey = ''; state.mypageKey = '';
    if (state.modalKey) renderComments(false);
    renderMypage();
  }

  function renderComments(changedWork) {
    const comments = state.comments.filter(comment => comment.to === state.modalKey && !comment.replyTo).sort((a,b) => b.at-a.at);
    document.querySelector('#comments-title .comments-count').textContent = comments.length ? comments.length + ' 件' : '';
    const previousIds = state.seenIds.get(state.modalKey) || new Set();
    const added = comments.filter(comment => !comment.mine && !previousIds.has(comment.id)).length;
    state.seenIds.set(state.modalKey, new Set(comments.map(comment => comment.id)));
    if (!changedWork && added) announceComments('コメントが ' + added + ' 件増えました（全 ' + comments.length + ' 件）。');
    const signature = JSON.stringify(state.comments.filter(comment => comment.to === state.modalKey));
    if (!changedWork && signature === state.commentsKey) return;
    state.commentsKey = signature;
    const container = $('comments');
    const oldErrors = new Map(Array.from(container.querySelectorAll('.comment'), article => [article.dataset.id, article.querySelector('.comment-error')?.textContent || '']));
    preserveCommentFocus(container, () => {
      container.replaceChildren();
      if (!comments.length) container.append(textElement('p', 'comments-empty', 'コメントは、まだありません。下の欄から書けます。'));
      for (const comment of comments) container.append(createComment(comment, 'comments', changedWork ? new Map() : oldErrors));
    });
    if (changedWork) container.scrollTop = 0;
    if (changedWork && state.me.teacher && !state.hideReports) {
      const reported = container.querySelector('.comment.reported');
      if (reported) container.scrollTop = reported.offsetTop - container.offsetTop;
    }
  }

  function renderMypage() {
    if (!state.me || state.me.teacher || state.view !== 'me') return;
    $('mypage-identity').textContent = state.me.cls + '組 ' + state.me.no + '番 ' + state.me.name + ' としてログインしています。ちがう人のときは、ログアウトしてください。';
    const own = state.works.find(work => work.key === state.me.key);
    const received = state.comments.filter(comment => comment.to === state.me.key && !comment.replyTo).sort((a,b) => b.at-a.at);
    const mine = new Map(state.comments.filter(comment => comment.mine && !comment.replyTo).map(comment => [comment.id,comment]));
    const replies = state.comments.filter(comment => comment.replyTo && mine.has(comment.replyTo)).sort((a,b) => b.at-a.at);
    const signature = JSON.stringify([own, received, replies, state.comments.filter(comment => comment.to === state.me.key && comment.replyTo)]);
    if (signature !== state.mypageKey) {
      state.mypageKey = signature;
      const ownBox = $('mypage-own');
      const ownKey = JSON.stringify([own?.key,own?.name,own?.submitted,own?.user,own?.pen]);
      if (ownBox.dataset.contentKey !== ownKey) {
      ownBox.dataset.contentKey = ownKey; ownBox.replaceChildren(textElement('h3', '', '自分の作品'));
      if (!own?.submitted) ownBox.append(textElement('p', 'muted', 'まだ提出されていません。提出すると、ここに出ます。'));
      else {
        const card = textElement('div', 'mypage-work');
        const preview = textElement('div', 'mypage-preview'); preview.append(makeIframe(own, false));
        const detail = textElement('div', 'mypage-work-detail');
        detail.append(textElement('p', 'muted', own.cls + '組 ' + own.no + '番'), textElement('h4', '', own.name));
        const actions = textElement('div', 'mypage-work-actions');
        const edit = textElement('a', 'secondary', 'CodePen で編集する ↗'); edit.id = 'mypage-edit'; edit.href = 'https://codepen.io/' + own.user + '/pen/' + own.pen; edit.target = '_blank'; edit.rel = 'noopener noreferrer';
        const open = textElement('button', 'secondary', 'このサイトで見る'); open.id = 'mypage-open'; open.type = 'button'; open.addEventListener('click', () => openModal(own.key));
        actions.append(edit,open); detail.append(actions,textElement('p','mypage-edit-note muted','編集するには、CodePen にログインしている必要があります。'));
        card.append(preview,detail); ownBox.append(card); resizeObserver.observe(preview); fitFrame(preview);
      }
      }
      const container = $('mypage-comments');
      const oldErrors = new Map(Array.from(container.querySelectorAll('.comment'), article => [article.dataset.id, article.querySelector('.comment-error')?.textContent || '']));
      preserveCommentFocus(container, () => { container.replaceChildren(); for (const comment of received) container.append(createComment(comment, 'mypage-comments', oldErrors)); if (!received.length) container.append(textElement('p','muted','コメントは、まだありません。')); });
      const inbox = $('mypage-replies');
      preserveCommentFocus(inbox, () => {
        inbox.replaceChildren();
        for (const reply of replies) {
          const parent = mine.get(reply.replyTo), work = state.works.find(item => item.key === reply.to);
          const section = textElement('section','mypage-reply');
          section.append(textElement('h4','',work ? work.cls + '組 ' + work.no + '番 ' + work.name + 'の作品' : '作品'),textElement('p','reply-original','自分のコメント: ' + Array.from(parent.text).slice(0,50).join('')));
          section.append(createComment(reply,'mypage-replies',new Map(),true));
          const open = textElement('button','secondary','作品を開く'); open.type = 'button'; open.addEventListener('click', () => openModal(reply.to)); section.append(open); inbox.append(section);
        }
        if (!replies.length) inbox.append(textElement('p','muted','返事は、まだありません。'));
      });
    }
    if (!state.modalKey) { seen[state.me.key] = Date.now(); seen[state.me.key + ':replies'] = Date.now(); writeStorage('sj-review-seen',JSON.stringify(seen)); }
    updateNotification();
  }

  async function changeComment(op, comment, button) {
    if (button.disabled) return;
    const excerptCharacters = Array.from(comment.text.replace(/\r\n?|\n/g, ' '));
    const excerpt = excerptCharacters.slice(0, 30).join('') + (excerptCharacters.length > 30 ? '…' : '');
    const prompt = (op === 'delete' ? 'このコメントを消しますか。' : 'このコメントを知らせますか。') + '\n\n「' + excerpt + '」\n\n'
      + (op === 'delete' ? '消したコメントは、元に戻せません。' : '知らせたことは、書いた人には伝わりません。');
    if (!window.confirm(prompt)) return;
    const session = state.session;
    const hadFocus = document.activeElement === button;
    const actionContainer = button.closest('#mypage-comments, #mypage-replies, #comments') || $('comments');
    const oldArticles = Array.from(actionContainer.querySelectorAll('.comment'));
    const position = oldArticles.findIndex(article => article.dataset.id === comment.id);
    const focusAfterDelete = [...oldArticles.slice(position + 1), ...oldArticles.slice(0, position).reverse()].map(article => article.dataset.id);
    const feedbackVersion = clearFailures();
    button.disabled = true;
    try {
      await request(op, { id: comment.id });
      if (session !== state.session) return;
      state.writes += 1;
      if (op === 'delete') {
        state.comments = state.comments.filter(item => item.id !== comment.id && item.replyTo !== comment.id);
        const work = state.works.find(item => item.key === comment.to);
        if (work && !comment.replyTo) { work.n = Math.max(0, work.n - 1); if (comment.kind === '質問') work.q = Math.max(0, work.q - 1); updateCard(work); }
        replaceCommentViews();
        if (hadFocus && state.view === 'me' && !state.modalKey) $('mypage-title').focus({ preventScroll: true });
        updateReportCounts();
        if (work) updateCard(work);
        updateNotification();
        if (state.modalKey === comment.to && feedbackVersion === state.feedbackVersion) announceComments('コメントを消しました。');
        if (hadFocus && state.modalKey === comment.to) {
          const articles = Array.from($('comments').querySelectorAll('.comment'));
          const target = focusAfterDelete.map(id => articles.find(article => article.dataset.id === id)?.querySelector('button:not(:disabled)')).find(Boolean);
          (target || $('comments-title')).focus({ preventScroll: true });
        }
      } else {
        state.reported.add(comment.id);
        const currentButton = Array.from(actionContainer.querySelectorAll('.comment')).find(article => article.dataset.id === comment.id)?.querySelector('[data-action="report"]');
        if (currentButton) {
          currentButton.textContent = '知らせました';
          currentButton.disabled = true;
          currentButton.classList.add('done');
          if (hadFocus) (state.modalKey ? $('comments-title') : $('mypage-title')).focus({ preventScroll: true });
        }
      }
      refreshBoard(true);
      clearFailures(feedbackVersion);
    } catch (error) {
      if (session === state.session) {
        const article = Array.from(actionContainer.querySelectorAll('.comment')).find(item => item.dataset.id === comment.id);
        if (article) {
          if (feedbackVersion === state.feedbackVersion) showFailure(article.querySelector('.comment-error'), failureText(op, error));
          const currentButton = article.querySelector('[data-action="' + op + '"]');
          if (currentButton) { currentButton.disabled = false; if (hadFocus) currentButton.focus({ preventScroll: true }); }
        }
        reconcileWrite(error);
      }
    }
  }

  function cleanText(text) { return text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, '').trim(); }

  function updateComposer() {
    const text = cleanText($('comment-text').value);
    const length = Array.from(text).length;
    const invalidLines = (text.match(/\n/g) || []).length > 3;
    $('comment-remaining').textContent = length > 200 ? '200 字をこえています。' + (length - 200) + ' 字ぶん減らしてください。'
      : invalidLines ? '改行は 3 つまでです。行を減らしてください。' : '残り ' + (200 - length) + ' 字';
    const overLimit = $('comment-remaining').textContent.match(/^(200 字を)(こえています。)(\d+ 字ぶん)(減らしてください。)$/);
    if (overLimit) {
      const fragments = [];
      for (const phrase of overLimit.slice(1)) {
        if (fragments.length) fragments.push(document.createElement('wbr'));
        fragments.push(textElement('span', 'nb', phrase));
      }
      $('comment-remaining').replaceChildren(...fragments);
    }
    $('comment-remaining').classList.toggle('invalid', length > 200 || invalidLines);
    if (length > 200 || invalidLines) $('comment-text').setAttribute('aria-invalid', 'true');
    else $('comment-text').removeAttribute('aria-invalid');
    $('comment-text').placeholder = state.kind === '質問' ? '作品について聞きたいことを書いてください。' : '作品を見て感じたことを書いてください。';
    $('comment-send').disabled = !state.sending && (length < 1 || length > 200 || invalidLines);
    $('comment-send').textContent = state.sending ? '送っています…' : '送る';
    $('comment-send').classList.toggle('is-waiting', state.sending);
    if (state.sending) $('comment-send').setAttribute('aria-disabled', 'true');
    else $('comment-send').removeAttribute('aria-disabled');
    $('kind-thought').setAttribute('aria-pressed', String(state.kind === '感想'));
    $('kind-question').setAttribute('aria-pressed', String(state.kind === '質問'));
    saveDraft();
  }

  function updateReportCounts() {
    state.reportCounts.clear();
    if (!state.me || !state.me.teacher) return;
    for (const comment of state.comments) {
      if (Number(comment.reported) > 0) state.reportCounts.set(comment.to, (state.reportCounts.get(comment.to) || 0) + 1);
    }
  }

  function updateNotification() {
    const reportCount = Array.from(state.reportCounts.values()).reduce((sum, count) => sum + count, 0);
    $('report-alert').hidden = !state.me || !state.me.teacher || !reportCount;
    $('report-alert').textContent = reportCount ? '知らせのあるコメントが ' + reportCount + ' 件（' + state.reportCounts.size + ' 作品）あります。押すと開きます。' : '';
    if (!state.me || state.me.teacher) { $('new-comments').hidden = true; $('new-replies').hidden = true; return; }
    const last = Number(seen[state.me.key]) || 0;
    const count = state.comments.filter(comment => comment.to === state.me.key && !comment.replyTo && !comment.mine && Number(comment.at) > last).length;
    $('new-comments').hidden = !count;
    $('new-comments').replaceChildren();
    if (count) {
      for (const phrase of ['自分の作品に', '新しいコメントが ', count + ' 件あります。', '押すとマイページが', '開きます。']) {
        if ($('new-comments').childNodes.length) $('new-comments').append(document.createElement('wbr'));
        $('new-comments').append(textElement('span', 'nb', phrase));
      }
    }
    const mine = new Set(state.comments.filter(comment => comment.mine && !comment.replyTo).map(comment => comment.id));
    const replyCount = state.comments.filter(comment => comment.replyTo && mine.has(comment.replyTo) && Number(comment.at) > (Number(seen[state.me.key + ':replies']) || 0)).length;
    $('new-replies').hidden = !replyCount;
    $('new-replies').replaceChildren();
    if (replyCount) $('new-replies').append(textElement('span','nb','返事が届いています'),document.createElement('wbr'),textElement('span','nb','（' + replyCount + '件）'));
  }

  function openOwnWork() {
    if (!state.me || state.me.teacher) return;
    state.mypageReturn = state.view !== 'me' ? state.view : state.mypageReturn;
    location.hash = 'me';
  }

  function openReportedWork() {
    if (!state.me || !state.me.teacher) return;
    const works = state.works.filter(work => work.submitted && state.reportCounts.has(work.key));
    if (!works.length) return;
    const current = works.findIndex(work => work.key === state.reportCursor);
    const work = works[(current + 1) % works.length];
    state.reportCursor = work.key;
    if (state.view !== 'all' && state.view !== work.cls) {
      history.pushState({}, '', '#' + work.cls);
      state.view = work.cls;
      updateTabs();
      state.groupKey = '';
      renderBoard();
    }
    state.cards.get(work.key)?.article.scrollIntoView({ block: 'center' });
    openModal(work.key);
  }

  $('login-code-visible').addEventListener('change', () => {
    if (state.studentSetup && !state.teacherLogin) $('login-code').type = $('login-code-visible').checked ? 'password' : 'text';
    else $('login-code').type = $('login-code-visible').checked ? 'text' : 'password';
  });

  function renderLoginFields() {
    const needsCode = state.teacherLogin || state.studentPasscode;
    const setup = !state.teacherLogin && state.studentSetup;
    $('student-fields').hidden = state.teacherLogin;
    $('login-no').disabled = state.teacherLogin || state.loginBusy;
    $('login-class').disabled = state.teacherLogin || state.loginBusy;
    $('login-code-fields').hidden = !needsCode;
    $('login-code-fields').dataset.mode = setup ? 'setup' : 'code';
    // The initial student button stays above the additional fields, so revealing them never moves it.
    if (state.teacherLogin || needsCode && !state.studentPassword) {
      if ($('login-code-fields').nextElementSibling !== $('login-submit')) $('login-submit').before($('login-code-fields'));
    } else if ($('login-submit').nextElementSibling !== $('login-code-fields')) $('login-submit').after($('login-code-fields'));
    $('login-code-title').hidden = !setup;
    $('login-code-help').hidden = !setup;
    const entryOn = setup && state.studentEntry;
    $('login-entry-label').hidden = !entryOn; $('login-entry-help').hidden = !entryOn;
    $('login-entry').disabled = !entryOn; $('login-entry').required = entryOn;
    if (!entryOn) $('login-entry').value = '';
    $('login-code-note').hidden = !(needsCode && !setup && !state.teacherLogin && state.studentPassword);
    $('login-code').disabled = !needsCode;
    $('login-code').required = needsCode;
    $('login-code').autocomplete = setup ? 'new-password' : needsCode ? 'current-password' : 'off';
    if (setup) $('login-code').setAttribute('aria-describedby', 'login-code-help');
    else $('login-code').removeAttribute('aria-describedby');
    $('login-code-visible').disabled = !needsCode;
    $('login-code-visibility-label').textContent = setup ? 'かくす' : 'パスワードを表示する';
    $('login-code-submit').hidden = state.teacherLogin || !needsCode || !state.studentPassword;
    $('login-code-submit').disabled = !apiUrl || state.loginBusy || !needsCode;
    $('login-code-submit').textContent = state.loginBusy ? '確認しています…' : setup ? '決定して始める' : 'ログイン';
    $('login-title').textContent = state.teacherLogin ? '管理用のログイン' : 'ログイン';
    if (state.teacherLogin) loginLead.textContent = loginLead.dataset.teacherText;
    else loginLead.replaceChildren(...studentLead.map(node => node.cloneNode(true)));
    $('teacher-toggle').textContent = state.teacherLogin ? '生徒はこちら' : '管理用はこちら';
    if (!needsCode) {
      $('login-code').value = '';
      $('login-code').type = 'password';
      $('login-code-visible').checked = false;
    }
  }

  $('teacher-toggle').addEventListener('click', () => {
    state.teacherLogin = !state.teacherLogin;
    state.studentPasscode = false; state.studentSetup = false; state.studentPassword = false; state.studentEntry = false;
    clearFailures();
    $('login-code').value = '';
    $('login-code').type = 'password';
    $('login-code-visible').checked = false;
    renderLoginFields();
    (state.teacherLogin ? $('login-code') : $('login-class').value ? $('login-no') : $('login-class')).focus();
  });

  function clearStudentCode() {
    if (state.teacherLogin || state.loginBusy || !state.studentPasscode) return;
    state.studentPasscode = false; state.studentSetup = false; state.studentPassword = false; state.studentEntry = false;
    clearFailures(); renderLoginFields();
  }
  $('login-class').addEventListener('change', clearStudentCode);
  $('login-no').addEventListener('input', clearStudentCode);

  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if ($('login-submit').disabled || state.loginBusy) return;
    const session = state.session;
    const teacherLogin = state.teacherLogin;
    const needsCode = teacherLogin || state.studentPasscode;
    const setup = !teacherLogin && state.studentSetup;
    const password = !teacherLogin && state.studentPassword;
    state.loginBusy = true;
    $('login-submit').disabled = true;
    $('teacher-toggle').disabled = true;
    $('login-submit').textContent = '確認しています…';
    renderLoginFields();
    const feedbackVersion = clearFailures();
    stopLoginWait();
    state.loginWaitTimer = setTimeout(() => { $('login-wait').textContent = '時間がかかっています。そのまま待ってください。'; }, 8000);
    try {
      const credentials = { cls: teacherLogin ? '先生' : $('login-class').value, no: teacherLogin ? undefined : Number($('login-no').value) };
      if (needsCode) credentials[setup ? 'newCode' : 'code'] = $('login-code').value;
      if (setup && state.studentEntry) credentials.entry = $('login-entry').value;
      const result = await request('login', credentials);
      if (session !== state.session) return;
      state.session += 1;
      state.token = result.token;
      state.me = result.me;
      state.rev = '';
      state.lastFull = 0;
      writeStorage('sj-review', state.token);
      $('login-code').value = '';
      $('login-code').type = 'password';
      $('login-code-visible').checked = false;
      showBoard();
      await refreshBoard(true);
      if (setup && state.token === result.token) {
        $('password-notice').textContent = 'パスワードを決めました。次からはこのパスワードでログインします。';
        clearTimeout(state.passwordNoticeTimer);
        state.passwordNoticeTimer = setTimeout(() => { $('password-notice').textContent = ''; }, 7000);
      }
    } catch (error) {
      if (session !== state.session) return;
      // 混んでいて排他を待ちきれなかっただけのとき（少し待って）は、10 分のロックと言わず、入力も消さない。
      const waiting = !!error.api && error.code === 'locked' && /少し待って/.test(String(error.message || ''));
      if (password && error.api && ['auth', 'locked'].includes(error.code) && !waiting) $('login-code').value = '';
      if (!teacherLogin && error.api && error.code === 'need_entry') {
        state.studentEntry = true; renderLoginFields();
        if (feedbackVersion === state.feedbackVersion) showFailure($('login-error'), error.message);
        $('login-entry').focus();
        return;
      }
      if (!teacherLogin && error.api && ['need_setup', 'need_code', 'already_set'].includes(error.code)) {
        state.studentPasscode = true;
        state.studentSetup = error.code === 'need_setup';
        state.studentPassword = error.code !== 'need_code' || error.loginMode === 'password';
        state.studentEntry = error.code === 'need_setup' && error.entry === true;
        $('login-code').value = '';
        $('login-code-visible').checked = false;
        $('login-code').type = state.studentSetup ? 'text' : 'password';
        renderLoginFields();
        if (feedbackVersion === state.feedbackVersion) showFailure($('login-error'), error.message);
        if (state.studentEntry && state.studentSetup) $('login-entry').focus();
        else if (state.studentPassword) $('login-code').focus();
        else $('login-code').focus({ preventScroll: true });
        return;
      }
      const prefix = teacherLogin ? 'teacher' : 'student';
      const text = waiting ? error.message : password && error.api && error.code === 'locked'
        ? 'この組・出席番号では、間違いが続いたため、10 分間ログインできません。10 分たってから、入れ直してください。パスワードを忘れたときは、直接伝えてください。'
        : needsCode && !password && error.api && ['auth', 'bad', 'locked', 'mismatch'].includes(error.code)
        ? LOGIN_TEXT[prefix + (error.code === 'locked' ? 'Locked' : 'Mismatch')]
        : failureText('login', error);
      if (feedbackVersion === state.feedbackVersion) showFailure($('login-error'), text);
    } finally {
      stopLoginWait();
      state.loginBusy = false;
      renderLoginFields();
      $('login-submit').textContent = 'ログイン';
      $('login-submit').disabled = !apiUrl;
      $('teacher-toggle').disabled = false;
    }
  });

  $('logout-button').addEventListener('click', () => {
    showLogin();
    $('login-class').value = '';
    $('login-no').value = '';
    window.scrollTo(0, 0);
    $('site-title').focus({ preventScroll: true });
  });
  $('my-work').addEventListener('click', openOwnWork);
  $('new-comments').addEventListener('click', openOwnWork);
  $('new-replies').addEventListener('click', openOwnWork);
  $('mypage-back').addEventListener('click', () => { location.hash = state.mypageReturn; });
  $('report-alert').addEventListener('click', openReportedWork);
  $('preview-toggle').addEventListener('change', () => {
    state.preview = $('preview-toggle').checked;
    writeStorage('sj-review-preview', state.preview ? '1' : '0');
    document.body.classList.toggle('preview-off', !state.preview);
    updatePreviews();
  });
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    $('board-main').focus();
  });
  $('prev-work').addEventListener('click', () => navigateModal(-1));
  $('next-work').addEventListener('click', () => navigateModal(1));
  $('close-work').addEventListener('click', () => closeModal());
  $('work-dialog').addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
  $('work-dialog').addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    navigateModal(event.key === 'ArrowRight' ? 1 : -1);
  });
  $('kind-thought').addEventListener('click', () => { state.kind = '感想'; updateComposer(); });
  $('kind-question').addEventListener('click', () => { state.kind = '質問'; updateComposer(); });
  $('comment-text').addEventListener('input', updateComposer);

  $('comment-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (state.sending || $('comment-send').disabled || !state.modalKey) return;
    const key = state.modalKey;
    const session = state.session;
    const text = cleanText($('comment-text').value);
    const kind = state.kind;
    const submittedDraft = $('comment-text').value;
    const sendRun = ++state.sendRun;
    const knownMine = new Set(state.comments.filter(comment => comment.mine).map(comment => comment.id));
    const returnToComposer = document.activeElement === $('comment-send') && $('comment-send').matches(':focus-visible');
    state.sending = true;
    const feedbackVersion = clearFailures();
    updateComposer();
    state.commentWaitTimer = setTimeout(() => {
      if (session === state.session && state.sending) $('comment-wait').textContent = '時間がかかっています。そのまま待ってください。';
    }, 8000);
    try {
      const result = await request('comment', { to: key, kind, text });
      if (session !== state.session) return;
      state.writes += 1;
      if (!state.comments.some(comment => comment.id === result.comment.id)) state.comments.unshift(result.comment);
      const work = state.works.find(item => item.key === key);
      if (work) { work.n += 1; if (kind === '質問') work.q += 1; updateCard(work); }
      const draft = state.drafts.get(key);
      if (draft && draft.text === submittedDraft) state.drafts.delete(key);
      if (state.modalKey === key) {
        if ($('comment-text').value === submittedDraft) $('comment-text').value = '';
        renderComments(false);
        $('comments').scrollTop = 0;
        if (feedbackVersion === state.feedbackVersion) announceComments('コメントを送りました。');
      }
      clearFailures(feedbackVersion);
      refreshBoard(true);
    } catch (error) {
      if (session === state.session) {
        if (state.modalKey === key && feedbackVersion === state.feedbackVersion) showFailure($('comment-error'), failureText('comment', error));
        if (['timeout', 'http', 'broken'].includes(error.kind)) reconcileSavedComment(key, text, submittedDraft, knownMine, session);
      }
    }
    finally {
      if (sendRun === state.sendRun) stopCommentWait();
      if (session === state.session) {
        state.sending = false;
        updateComposer();
        if (returnToComposer && state.modalKey === key) $('comment-text').focus({ preventScroll: true });
      }
    }
  });

  $('like-button').addEventListener('click', async () => {
    const key = state.modalKey;
    const session = state.session;
    if (!key || $('like-button').disabled) return;
    const hadFocus = document.activeElement === $('like-button');
    const feedbackVersion = clearFailures();
    state.likesBusy.add(key);
    $('like-button').disabled = true;
    try {
      const result = await request('like', { to: key });
      if (session !== state.session) return;
      state.writes += 1;
      const work = state.works.find(item => item.key === key);
      if (work) { work.likes = Number(result.likes) || 0; work.liked = !!result.liked; updateCard(work); }
      if (state.modalKey === key) renderModal(false);
      clearFailures(feedbackVersion);
      refreshBoard(true);
    } catch (error) {
      if (session === state.session) {
        if (state.modalKey === key && feedbackVersion === state.feedbackVersion) showFailure($('like-error'), failureText('like', error));
        reconcileWrite(error);
      }
    }
    finally {
      if (session === state.session) {
        state.likesBusy.delete(key);
        if (state.modalKey === key && state.me) {
          $('like-button').disabled = key === state.me.key;
          if (hadFocus && !$('like-button').disabled) $('like-button').focus({ preventScroll: true });
        }
      }
    }
  });

  // §13: scopes and vote choices are rendered independently of the grid and work dialog.
  function renderScopeControls() {
    if ($('scope-controls').contains(pressedControl)) { pendingRenders.set($('scope-controls'), renderScopeControls); return; }
    pendingRenders.delete($('scope-controls'));
    setProperty($('scope-controls'), 'hidden', !state.me?.teacher);
    if (!state.me?.teacher) return;
    setText($('scope-status'), state.scope === 'all' ? 'いまは、生徒に学年ぜんたいが見えます。' : 'いまは、生徒に自分の組だけが見えます。');
    setText($('scope-toggle'), state.scope === 'all' ? '自分の組だけに戻す' : '学年ぜんたいを公開する');
    setProperty($('scope-toggle'), 'disabled', state.scopeBusy);
    setText($('scope-error'), state.scopeError);
  }

  async function setScope(scope) {
    if (!state.me?.teacher || state.scopeBusy) return;
    const session = state.session;
    state.scopeBusy = true; state.scopeError = ''; renderScopeControls();
    try {
      const result = await request('scope_set', {scope});
      if (session !== state.session) return;
      state.writes += 1; state.scope = result.scope;
      await refreshBoard(true);
    } catch (error) {
      if (session === state.session) state.scopeError = failureText('scope_set', error);
    } finally {
      if (session === state.session) { state.scopeBusy = false; renderScopeControls(); $('scope-toggle').focus({preventScroll:true}); }
    }
  }

  $('scope-toggle').addEventListener('click', () => {
    if (state.scope === 'all') setScope('class');
    else { $('scope-confirm').showModal(); $('scope-confirm-cancel').focus(); }
  });
  $('scope-confirm-cancel').addEventListener('click', () => $('scope-confirm').close());
  $('scope-confirm').addEventListener('close', () => { if (state.me?.teacher) $('scope-toggle').focus({preventScroll:true}); });
  $('scope-confirm-publish').addEventListener('click', () => { $('scope-confirm').close(); setScope('all'); });

  // §14: fetch only on opening, changing class, and after a reset; board/live polls never call this.
  function renderPasswordControls() {
    setProperty($('password-controls'), 'hidden', !state.me?.teacher);
    setText($('password-toggle'), state.passwordOpen ? '閉じる' : '開く');
    setAttribute($('password-toggle'), 'aria-expanded', String(state.passwordOpen));
    setProperty($('password-content'), 'hidden', !state.passwordOpen);
    setAttribute($('password-content'), 'aria-busy', String(state.passwordBusy));
    const tabs = $('password-class-tabs');
    if (!tabs.childElementCount) for (const cls of classes) {
      const button = textElement('button', 'secondary', cls + '組');
      button.type = 'button'; button.id = 'password-class-' + cls;
      button.addEventListener('click', () => {
        state.passwordClass = cls; loadPasswords();
      });
      tabs.append(button);
    }
    for (const cls of classes) setAttribute($('password-class-' + cls), 'aria-pressed', String(cls === state.passwordClass));
    setText($('password-error'), state.passwordError);
    setText($('password-summary'), state.passwordBusy ? '読み込んでいます。' : state.passwordPeople
      ? '設定済み ' + state.passwordPeople.set + '/' + state.passwordPeople.total + ' 人' : '');
    const list = $('password-list').cloneNode(false);
    if (!state.me?.teacher || !state.passwordPeople) { stablePanel($('password-list'), list); return; }
    for (const person of state.passwordPeople.people) {
      const row = textElement('div', 'password-row'); row.dataset.no = String(person.no);
      const identity = textElement('p', 'password-person');
      identity.append(textElement('span', 'password-number', person.no + '番'), document.createTextNode(' ' + person.name));
      row.append(identity, textElement('span', 'password-state', person.set ? '設定済み' : 'まだ'));
      const button = textElement('button', 'secondary', 'リセット'); button.type = 'button';
      button.dataset.passwordReset = String(person.no); button.disabled = state.passwordBusy || state.passwordResetBusy;
      button.setAttribute('aria-label', state.passwordClass + '組 ' + person.no + '番 ' + person.name + 'のパスワードをリセット');
      button.onclick = event => {
        state.passwordReset = {cls:state.passwordClass, no:person.no}; state.passwordReturnFocus = event.currentTarget;
        setText($('password-confirm-text'), state.passwordClass + '組 ' + person.no + '番 ' + person.name + ' のパスワードをリセットします。本人は、次のログインで決め直します。');
        setText($('password-confirm-error'), '');
        $('password-confirm').showModal(); $('password-confirm-cancel').focus();
      };
      row.append(button); list.append(row);
    }
    stablePanel($('password-list'), list);
  }

  async function loadPasswords() {
    if (!state.me?.teacher || !state.passwordOpen) return;
    const session = state.session, cls = state.passwordClass, run = ++state.passwordRun;
    state.passwordBusy = true; state.passwordPeople = null; state.passwordError = ''; renderPasswordControls();
    try {
      const result = await request('password_list', {cls});
      if (session !== state.session || run !== state.passwordRun || !state.passwordOpen) return;
      state.passwordPeople = result;
    } catch (error) {
      if (session === state.session && run === state.passwordRun && state.me?.teacher) state.passwordError = failureText('password_list', error);
    } finally {
      if (session === state.session && run === state.passwordRun) { state.passwordBusy = false; renderPasswordControls(); }
    }
  }

  $('password-refresh').addEventListener('click', () => { if (state.me?.teacher && state.passwordOpen) loadPasswords(); });
  $('password-toggle').addEventListener('click', () => {
    if (!state.me?.teacher) return;
    state.passwordOpen = !state.passwordOpen;
    if (state.passwordOpen) loadPasswords();
    else { state.passwordRun += 1; state.passwordBusy = false; state.passwordPeople = null; renderPasswordControls(); }
  });
  $('password-confirm-cancel').addEventListener('click', () => $('password-confirm').close());
  $('password-confirm').addEventListener('cancel', event => {
    if (state.passwordResetBusy) event.preventDefault();
  });
  $('password-confirm').addEventListener('close', () => {
    if (!state.me?.teacher) return;
    const target = state.passwordReturnFocus?.isConnected ? state.passwordReturnFocus
      : $('password-list').querySelector('[data-password-reset="' + state.passwordReset?.no + '"]') || $('password-toggle');
    target.focus({preventScroll:true});
  });
  $('password-confirm-reset').addEventListener('click', async () => {
    if (!state.me?.teacher || !state.passwordReset || state.passwordResetBusy) return;
    const session = state.session, target = {...state.passwordReset};
    state.passwordResetBusy = true; $('password-confirm-reset').disabled = true; $('password-confirm-cancel').disabled = true;
    $('password-confirm-error').textContent = '';
    try {
      await request('password_reset', target);
      if (session !== state.session) return;
      state.passwordResetBusy = false;
      await loadPasswords();
      if (session === state.session) $('password-confirm').close();
    } catch (error) {
      if (session === state.session && state.me?.teacher) showFailure($('password-confirm-error'), failureText('password_reset', error));
    } finally {
      state.passwordResetBusy = false; $('password-confirm-reset').disabled = false; $('password-confirm-cancel').disabled = false;
    }
  });

  function announceVote(message) {
    // Each state transition changes the text; closed and reopening from ended clear it.
    // Unlike repeated comment notices, these announcements do not need a deferred frame.
    $('vote-status').textContent = message;
  }

  function renderMyVotes() {
    const box = $('my-votes');
    const show = !!state.me && !state.me.teacher && !!state.vote && state.vote.state !== 'closed' && !state.vote.sealed;
    box.hidden = !show;
    if (!show) { box.replaceChildren(); state.myVotesKey = ''; return; }
    const votes = new Map();
    for (const vote of state.vote.mine) votes.set(vote.to, (votes.get(vote.to) || 0) + 1);
    const entries = Array.from(votes, ([key, points]) => ({key, points, work:state.works.find(work => work.key === key)})).filter(item => item.work);
    const signature = JSON.stringify([state.vote.state, entries, state.vote.remaining, state.voteBusy, state.voteError]);
    if (signature === state.myVotesKey) return;
    state.myVotesKey = signature;
    const active = document.activeElement, focusKey = box.contains(active) ? active.closest('.my-vote-row')?.dataset.key : null, focusAction = active.dataset?.voteAction;
    const heading = textElement('h2', '', state.vote.state === 'open' ? 'あなたの投票' : 'あなたが入れた作品');
    heading.id = 'my-votes-title'; heading.tabIndex = -1;
    box.replaceChildren(heading); box.setAttribute('aria-busy', String(state.voteBusy));
    const list = textElement('div', 'my-vote-list');
    for (const entry of entries) {
      const row = textElement('div', 'my-vote-row'); row.dataset.key = entry.key;
      row.append(textElement('span', 'my-vote-stars', '★'.repeat(entry.points)), textElement('span', 'my-vote-person', entry.work.no + '番 ' + entry.work.name));
      if (state.vote.state === 'open') {
        const actions = textElement('div', 'my-vote-actions');
        const view = textElement('button', 'secondary', '見る'); view.type = 'button'; view.dataset.voteAction = 'view'; view.addEventListener('click', () => openModal(entry.key));
        const cancel = textElement('button', 'quiet', 'とりけす'); cancel.type = 'button'; cancel.dataset.voteAction = 'cancel'; cancel.disabled = state.voteBusy;
        cancel.setAttribute('aria-label', entry.work.no + '番 ' + entry.work.name + 'への1点をとりけす');
        cancel.addEventListener('click', () => {
          const next = state.vote.mine.slice(), index = next.findIndex(vote => vote.to === entry.key);
          if (index >= 0) { next.splice(index, 1); setVotes(next); }
        });
        actions.append(view, cancel); row.append(actions);
      }
      list.append(row);
    }
    box.append(list);
    if (state.vote.state === 'open') {
      const note = !entries.length ? 'まだ入れていません。作品を開いて、☆ を押します。' : state.vote.remaining ? 'あと ★' + state.vote.remaining + ' 入れられます。作品を開いて、☆ を押します。' : '';
      if (note) box.append(textElement('p', 'my-vote-note muted', note));
    }
    const error = textElement('p', 'error-message', state.voteError); error.id = 'my-vote-error'; error.setAttribute('role', 'alert'); box.append(error);
    if (focusKey) {
      const row = Array.from(list.children).find(item => item.dataset.key === focusKey), target = row?.querySelector('[data-vote-action="' + focusAction + '"]');
      (target && !target.disabled ? target : heading).focus({preventScroll:true});
    }
  }

  function trackArrivals(works, scopeChanged) {
    const previous = new Map(state.works.map(work => [work.key, work]));
    if (state.hasBoard) for (const work of works) {
      const old = previous.get(work.key);
      // Expanding the visible scope alone is not a new submission.
      if (work.submitted && (old ? !old.submitted : !scopeChanged)) state.arrivals.set(work.key, Date.now() + 120000);
    }
    scheduleArrivalExpiry();
  }

  function scheduleArrivalExpiry() {
    clearTimeout(state.arrivalTimer); state.arrivalTimer = null;
    const now = Date.now();
    for (const [key, until] of state.arrivals) if (until <= now) state.arrivals.delete(key);
    if (!state.arrivals.size) return;
    state.arrivalTimer = setTimeout(() => {
      scheduleArrivalExpiry();
      if (state.me) for (const work of visibleWorks()) updateCard(work);
    }, Math.max(1, Math.min(...state.arrivals.values()) - now));
  }

  function validVotePayload(vote, me) {
    if (!vote) return false;
    if (me.teacher) return vote.states && classes.every(cls => ['closed', 'open', 'ended'].includes(vote.states[cls])) && Array.isArray(vote.revealed) && vote.revealed.every(cls => classes.includes(cls)) && typeof vote.sealed === 'boolean'
      && vote.turnout && classes.every(cls => Number.isInteger(vote.turnout[cls]?.voted) && vote.turnout[cls].voted >= 0 && Number.isInteger(vote.turnout[cls]?.total) && vote.turnout[cls].total >= vote.turnout[cls].voted);
    return ['closed', 'open', 'ended'].includes(vote.state) && typeof vote.sealed === 'boolean' && vote.points === 2 && vote.scope === '組' && Array.isArray(vote.mine) && vote.mine.length <= 2
      && vote.mine.every(v => v && typeof v.to === 'string' && /^[A-F]-\d{2}$/.test(v.to) && v.to[0] === me.cls && v.to !== me.key)
      && vote.remaining === 2 - vote.mine.length
      && (vote.got === undefined || vote.state === 'ended' && Number.isInteger(vote.got?.count) && vote.got.count > 0);
  }

  function normalizeVote(vote) {
    if (!vote) return null;
    if (state.me?.teacher) return { states: {...vote.states}, everRevealed: (vote.everRevealed || vote.revealed || []).filter(cls => classes.includes(cls)), revealed: (vote.revealed || []).filter(cls => classes.includes(cls)), sealed: vote.sealed === true, turnout: vote.turnout || {} };
    const mine = Array.isArray(vote.mine) ? vote.mine.filter(v => v && /^[A-F]-\d{2}$/.test(v.to)).slice(0, 2).map(v => ({ to: v.to })) : [];
    const result = { state: vote.state, sealed: vote.sealed === true, points: 2, remaining: 2 - mine.length, mine, scope: '組' };
    if (vote.state === 'ended' && Number.isInteger(vote.got?.count) && vote.got.count > 0) result.got = { count: vote.got.count };
    return result;
  }

  function receivedVoteText() {
    const got = state.me && !state.me.teacher && state.vote?.state === 'ended' ? state.vote.got : null;
    return got?.count > 0 ? 'あなたの作品に、すごい！が ' + got.count + ' 点届きました。' : '';
  }

  function renderVoteBand() {
    const band = $('vote-band').cloneNode(false), controls = $('vote-controls').cloneNode(false);
    buildVoteBand(band, controls);
    stablePanel($('vote-band'), band);
    stablePanel($('vote-controls'), controls);
  }

  function buildVoteBand(band, controls) {
    band.replaceChildren(); controls.replaceChildren(); band.hidden = controls.hidden = true;
    renderMyVotes();
    if (!state.me || !state.vote) return;
    if (!state.me.teacher) {
      if (state.vote.state === 'closed') return;
      band.hidden = false;
      band.append(textElement('p', '', state.vote.state === 'open'
        ? '投票できます。自分の組の作品に、すごい！を 2 点まで入れます。ほかの人には、だれに入れたか見えません。'
        : '投票はしめきりました。結果は、組ごとに映します。'));
      if (state.vote.state === 'open') {
        const remaining = textElement('strong', 'vote-remaining', '残り ★' + state.vote.remaining);
        remaining.id = 'vote-remaining'; remaining.setAttribute('role', 'status'); band.append(remaining);
      }
      return;
    }
    controls.hidden = false;
    const available = classes;
    const cls = state.liveClass, sealed = state.vote.sealed, voteState = state.vote.states[cls];
    const heading = textElement('div', 'vote-controls-heading');
    heading.append(textElement('h2', '', '投票'), textElement('p', '', { closed: 'まだ始めていません。', open: '受付中です。', ended: 'しめきりました。' }[voteState])); controls.append(heading);
    const button = (id, label, disabled, action) => {
      const element = textElement('button', 'secondary', label); element.type = 'button'; element.id = id;
      element.disabled = disabled || state.voteControlBusy; element.onclick = action; return element;
    };
    const actions = textElement('div', 'vote-control-actions');
    actions.append(button('vote-start', cls + '組の投票を始める', sealed || voteState !== 'closed' || state.vote.everRevealed.includes(cls), () => controlVote({ state: 'open', cls })));
    actions.append(button('vote-end', cls + '組の投票をしめきる', sealed || voteState !== 'open', () => controlVote({ state: 'ended', cls })));
    actions.append(button('vote-back', cls + '組の投票をもどす', sealed || voteState === 'closed' || state.vote.everRevealed.includes(cls), () => controlVote({ state: voteState === 'ended' ? 'open' : 'closed', cls }))); controls.append(actions);
    const tabs = textElement('div','vote-control-actions'); tabs.id = 'vote-class-tabs'; tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','投票を操作する組');
    for (const value of available) {
      const tab = button('vote-class-' + value,value + '組',false,() => { state.liveClass = value; renderVoteBand(); clearTimeout(state.liveTimer); state.liveTimer = null; refreshLive(); });
      tab.dataset.voteClass = value; tab.setAttribute('aria-pressed',String(value === cls)); tabs.append(tab);
    }
    controls.append(tabs);
    const statuses = textElement('p', 'vote-class-statuses', classes.map(value => value + ' ' + {closed:'まだ',open:'受付中',ended:'しめきり'}[state.vote.states[value]]).join('／'));
    statuses.id = 'vote-class-statuses'; controls.append(statuses);
    const turnout = textElement('p', 'vote-turnout'); turnout.id = 'vote-turnout';
    const counts = state.live?.turnout?.[cls] || state.vote.turnout[cls];
    turnout.textContent = cls + '組 投票した人数: ' + (counts?.voted || 0) + '/' + (counts?.total || 0) + '人'; controls.append(turnout);
    // 管理画面を映しても、途中の得点が見えないよう、集計は「集計を見る」を押したときだけ出します。
    const liveToggle = button('vote-live-toggle', state.liveShow ? '集計をかくす' : '集計を見る', false, () => { state.liveShow = !state.liveShow; renderVoteBand(); });
    liveToggle.disabled = false; liveToggle.setAttribute('aria-pressed', String(state.liveShow)); controls.append(liveToggle);
    if (state.liveShow) {
      const list = textElement('div','vote-live-list'); list.id = 'vote-live-list';
      const works = (state.live?.classes?.[cls] || []).slice().sort((a,b) => b.points-a.points || a.no-b.no);
      const max = Math.max(1,...works.map(work => work.points));
      for (const work of works) {
        const row = textElement('div','vote-live-row'); row.dataset.key = work.key;
        row.append(textElement('span','vote-live-name',work.no + '番 ' + work.name),textElement('span','vote-live-points',work.points + ' 点'));
        const track = textElement('span','vote-live-track'), bar = textElement('span','vote-live-bar'); bar.style.width = (work.points / max * 100) + '%'; track.append(bar); row.append(track); list.append(row);
      }
      if (!works.length) list.append(textElement('p','muted','点の入った作品は、まだありません。')); controls.append(list);
    }
    const stageActions = textElement('div','vote-control-actions');
    stageActions.append(button('vote-stage',cls + '組の発表モード',voteState === 'closed',() => beginStage(cls)));
    const revealed = state.vote.revealed.includes(cls);
    const reveal = button('vote-reveal-' + cls,cls + '組の本人にも知らせる',voteState !== 'ended' || sealed || revealed,() => controlVote({reveal:cls})); reveal.dataset.voteReveal = cls; stageActions.append(reveal);
    if (revealed) { const hide = button('vote-hide-' + cls,cls + '組の本人へのお知らせをもどす',sealed,() => controlVote({hide:cls})); hide.dataset.voteHide = cls; stageActions.append(hide); }
    controls.append(stageActions);
    controls.append(textElement('p','muted vote-teacher-note',sealed
      ? '投票タブの「誰が」の記録は消してあります。シートの版の履歴には残っている場合があります。'
      : 'ほかの生徒には、だれに入れたか見えません。しめきるまで、シートには「誰が」の記録が残ります。しめきったあとも、管理者が sealVotes() を実行するまでは記録を見られます。'));
    const error = textElement('p','error-message',state.voteControlError || state.liveError); error.id = 'vote-control-error'; error.setAttribute('role','alert'); controls.append(error);
  }

  function scheduleLive() {
    if (!state.me?.teacher || document.hidden || state.projector || state.liveTimer || state.liveBusy) return;
    const delay = state.liveStarted ? 4000 : 0; state.liveStarted = true;
    state.liveTimer = setTimeout(() => { state.liveTimer = null; refreshLive(); }, delay);
  }

  async function refreshLive() {
    if (!state.me?.teacher || document.hidden || state.projector || state.liveBusy) return;
    state.liveBusy = true; const session = state.session;
    try {
      const cls = state.liveClass;
      const result = await request('vote_live', {cls});
      if (!result.turnout || !result.classes || !['closed','open','ended'].includes(result.state)) throw failure('broken');
      if (session !== state.session) return;
      state.live = result; state.liveError = ''; renderVoteBand();
    } catch (error) { if (session === state.session && state.me?.teacher) { state.liveError = failureText('vote_live',error); renderVoteBand(); } }
    finally { state.liveBusy = false; if (session === state.session) scheduleLive(); }
  }

  function renderVotePanel() {
    const panel = $('vote-panel').cloneNode(false), note = $('vote-note').cloneNode(false), got = $('vote-got').cloneNode(false), dialog = $('work-dialog').cloneNode(false);
    buildVotePanel(panel, note, got, dialog);
    if (!stablePanel($('vote-panel'), panel)) { pendingRenders.set($('vote-panel'), renderVotePanel); return; }
    stablePanel($('vote-note'), note);
    stablePanel($('vote-got'), got);
    setAttribute($('work-dialog'), 'class', dialog.className);
  }

  function buildVotePanel(panel, note, got, dialog) {
    panel.setAttribute('aria-busy', String(state.voteBusy)); panel.replaceChildren(); note.textContent = got.textContent = '';
    panel.hidden = note.hidden = got.hidden = true; dialog.classList.remove('has-vote', 'has-vote-note', 'has-vote-got');
    const work = state.works.find(w => w.key === state.modalKey);
    if (!work || !state.me || state.me.teacher || !state.vote || state.vote.state === 'closed') return;
    if (work.key === state.me.key) { got.textContent = receivedVoteText(); got.hidden = !got.textContent; dialog.classList.toggle('has-vote-got', !got.hidden); }
    if (state.vote.state !== 'open') return;
    if (work.key === state.me.key || work.cls !== state.me.cls) {
      note.textContent = work.key === state.me.key ? '自分の作品には入れられません。' : '投票は、自分の組の作品だけです。'; note.hidden = false; dialog.classList.add('has-vote-note'); return;
    }
    if (!work.submitted) return;
    panel.hidden = false; dialog.classList.add('has-vote');
    const status = textElement('div','vote-panel-status'); status.append(textElement('h4','','すごい！'));
    const mine = state.vote.mine.filter(vote => vote.to === work.key).length;
    const stars = textElement('div','vote-stars'); stars.setAttribute('role','group'); stars.setAttribute('aria-label','この作品に入れる点');
    for (let point = 1; point <= 2; point++) {
      const lit = point <= mine, star = textElement('button','vote-star',lit ? '★' : '☆'); star.type = 'button'; star.dataset.voteStar = String(point);
      star.setAttribute('aria-pressed',String(lit)); star.setAttribute('aria-label',lit ? point === 1 ? 'この作品への点を全部戻す' : 'この作品への1点を戻す' : 'この作品に' + point + '点を入れる');
      star.disabled = state.voteBusy || !lit && point-mine > state.vote.remaining;
      star.onclick = () => {
        const next = lit ? point-1 : point, others = state.vote.mine.filter(vote => vote.to !== work.key);
        setVotes([...others,...Array.from({length:next},() => ({to:work.key}))]);
      }; stars.append(star);
    }
    const error = textElement('p','error-message',state.voteError); error.id = 'vote-error'; error.setAttribute('role','alert'); error.hidden = !state.voteError;
    status.append(stars,error); panel.append(status);
  }

  async function setVotes(votes) {
    if (!state.me || state.me.teacher || state.vote?.state !== 'open' || state.voteBusy) return;
    const session = state.session, previous = state.vote.mine.map(v => ({...v}));
    const focusStar = document.activeElement?.dataset.voteStar;
    const focusVote = document.activeElement?.closest('.my-vote-row')?.dataset.key;
    const focusAction = document.activeElement?.dataset.voteAction;
    state.voteBusy = true; state.voteError = ''; state.vote.mine = votes.map(v => ({to:v.to})); state.vote.remaining = 2-votes.length;
    renderVoteBand(); renderVotePanel(); for (const work of visibleWorks()) updateCard(work);
    try {
      const result = await request('vote_set',{votes});
      if (session !== state.session || !state.vote || state.me?.teacher || state.vote.sealed) return;
      state.writes += 1; state.vote.mine = result.mine; state.vote.remaining = result.remaining;
    } catch (error) {
      if (session !== state.session || !state.vote || state.me?.teacher || state.vote.sealed) return;
      state.vote.mine = previous; state.vote.remaining = 2-previous.length;
      state.voteError = error.code === 'locked' ? '混んでいます。' : error.code === 'limit' ? '少し待ってください。' : '保存できません。';
    } finally {
      if (session === state.session) {
        state.voteBusy = false; renderVoteBand(); renderVotePanel(); for (const work of visibleWorks()) updateCard(work);
        const focus = focusStar ? $('vote-panel').querySelector('[data-vote-star="' + focusStar + '"]') : null;
        if (focus && !focus.disabled) focus.focus({preventScroll:true});
        if (focusVote && !state.modalKey && !state.vote?.sealed) {
          const row = Array.from($('my-votes').querySelectorAll('.my-vote-row')).find(item => item.dataset.key === focusVote);
          (row?.querySelector('[data-vote-action="' + focusAction + '"]') || $('my-votes-title'))?.focus({preventScroll:true});
        }
      }
    }
  }

  async function controlVote(change, confirmed = false) {
    if (!state.me?.teacher || state.voteControlBusy || state.vote?.sealed) return false;
    const prompt = change.reveal ? change.reveal + '組の結果を、本人にも知らせますか。知らせたあとは、この組の投票は再開できません。'
      : change.hide ? change.hide + '組の結果を、生徒に表示しない状態へもどしますか。'
      : change.state === 'open' ? (state.vote?.states?.[change.cls] === 'ended' ? change.cls + '組の投票を再開しますか。生徒は、もう一度点を入れ直せるようになります。' : change.cls + '組の投票を始めますか。生徒が2点を入れられるようになります。')
      : change.state === 'ended' ? change.cls + '組の投票をしめきりますか。生徒は点を入れ直せなくなります。'
      : change.cls + '組の投票を始める前の状態へもどしますか。生徒の画面から投票の表示が消えます。';
    if (!confirmed && !window.confirm(prompt)) return false;
    const session = state.session; state.voteControlBusy = true; state.voteControlError = ''; renderVoteBand();
    try {
      const result = await request('vote_ctl',change); if (session !== state.session) return false;
      state.writes += 1; state.vote = normalizeVote(result.status); await refreshBoard(true); await refreshLive(); return true;
    } catch (error) { if (session === state.session) state.voteControlError = failureText('vote_ctl',error); return false; }
    finally { if (session === state.session) { state.voteControlBusy = false; renderVoteBand(); } }
  }

  function beginStage(cls) {
    if (!state.me?.teacher || !classes.includes(cls) || state.vote?.states?.[cls] === 'closed') return;
    state.projectionFocus = $('vote-stage') || document.activeElement;
    if (state.vote.states[cls] === 'open') { $('stage-confirm-title').textContent = cls + '組の投票をしめきってから発表します。しめきりますか。'; $('stage-confirm').dataset.cls = cls; $('stage-confirm').showModal(); $('stage-confirm-cancel').focus(); }
    else location.hash = 'vote-' + cls;
  }
  $('stage-confirm-cancel').addEventListener('click',() => $('stage-confirm').close());
  $('stage-confirm').addEventListener('close',() => { if (state.me?.teacher && $('vote-stage')) $('vote-stage').focus({preventScroll:true});
    else if (state.projectionFocus?.isConnected) state.projectionFocus.focus({preventScroll:true}); });
  $('stage-confirm-end').addEventListener('click',async () => {
    const cls = $('stage-confirm').dataset.cls; $('stage-confirm-end').disabled = true;
    try { if (await controlVote({state:'ended',cls},true)) { $('stage-confirm').close(); location.hash = 'vote-' + cls; } }
    finally { $('stage-confirm-end').disabled = false; }
  });

  function stopConfetti() {
    cancelAnimationFrame(state.confettiFrame); state.confettiFrame = 0;
    const canvas = $('stage-confetti'); canvas.hidden = true; canvas.dataset.active = 'false';
    canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
  }

  function startConfetti() {
    stopConfetti();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = $('stage-confetti'), context = canvas.getContext('2d'); if (!context) return;
    canvas.width = innerWidth; canvas.height = innerHeight; canvas.hidden = false; canvas.dataset.active = 'true';
    const particles = Array.from({length:96},() => ({x:Math.random()*canvas.width,y:Math.random()*canvas.height*.25-80,s:3+Math.random()*5,v:90+Math.random()*100,r:Math.random()*Math.PI,c:['#d4bd84','#f2e4c2','#af9362'][Math.floor(Math.random()*3)]}));
    const start = performance.now();
    const draw = now => {
      const elapsed = (now-start)/1000;
      if (!state.projector || elapsed >= 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) { stopConfetti(); return; }
      context.clearRect(0,0,canvas.width,canvas.height); context.globalAlpha = Math.min(1,(2-elapsed)*2);
      for (const part of particles) {
        context.save(); context.translate(part.x+Math.sin(elapsed*2+part.r)*25,part.y+elapsed*part.v); context.rotate(part.r+elapsed); context.fillStyle = part.c; context.fillRect(-part.s/2,-part.s/2,part.s,part.s*.6); context.restore();
      }
      state.confettiFrame = requestAnimationFrame(draw);
    };
    state.confettiFrame = requestAnimationFrame(draw);
  }

  function closeProjection() {
    state.projectionRun += 1; state.projector = null; stopConfetti();
    $('vote-projector').hidden = true; $('vote-projector-title').textContent = ''; $('vote-projector-content').replaceChildren(); $('vote-projector-error').textContent = '';
    document.body.classList.remove('projecting-vote');
    if (document.fullscreenElement === $('vote-projector') && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (state.me) $('board-view').hidden = false;
    if (state.me?.teacher && $('vote-stage')) $('vote-stage').focus({preventScroll:true});
    else if (state.projectionFocus?.isConnected) state.projectionFocus.focus({preventScroll:true});
    else if (state.me?.teacher) $('vote-stage')?.focus({preventScroll:true});
    schedulePreviews(); scheduleLive();
  }

  function syncProjection() {
    const match = location.hash.match(/^#vote-([A-F])$/);
    if (!match) { if (state.projector) closeProjection(); return false; }
    if (!state.me?.teacher || state.vote?.states?.[match[1]] !== 'ended') {
      closeProjection();
      if (state.hasBoard) history.replaceState({}, '', '#' + currentView());
      if (state.me?.teacher && state.vote?.states?.[match[1]] === 'open') beginStage(match[1]);
      return false;
    }
    if (state.projector?.cls !== match[1]) openProjection(match[1]);
    return true;
  }

  async function openProjection(cls) {
    if (!state.me?.teacher || state.vote?.states?.[cls] !== 'ended') return;
    closeModal(false); closeProjection();
    const run = state.projectionRun, session = state.session;
    state.projector = {cls,slides:[],index:0}; clearTimeout(state.liveTimer); state.liveTimer = null;
    $('board-view').hidden = true; $('vote-projector').hidden = false;
    $('vote-projector-title').textContent = cls + '組 投票結果';
    $('vote-projector-content').replaceChildren(textElement('p','vote-projection-loading','結果を読み込んでいます。'));
    $('vote-projector-fullscreen').hidden = !document.fullscreenEnabled || typeof $('vote-projector').requestFullscreen !== 'function';
    document.body.classList.add('projecting-vote'); window.scrollTo(0,0); updatePreviews();
    try {
      const result = await request('vote_results',{cls}); if (session !== state.session || run !== state.projectionRun) return;
      const groups = result.ranking.filter(group => Number.isInteger(group.rank) && group.rank >= 1 && group.rank <= 3 && Array.isArray(group.works)).map(group => ({rank:group.rank,works:group.works.map(validWork).filter(work => work?.submitted && work.cls === cls).sort((a,b) => a.no-b.no)})).filter(group => group.works.length).sort((a,b) => b.rank-a.rank);
      const slides = [{type:'title',title:cls + '組 投票結果',works:[]}];
      for (const group of groups) {
        const title = '第 ' + group.rank + ' 位'; slides.push({type:'rank',title,rank:group.rank,works:group.works});
        for (const work of group.works) slides.push({type:'work',title,rank:group.rank,works:[work]});
      }
      slides.push({type:'summary',title:cls + '組 投票結果',works:[],groups:groups.slice().reverse()});
      state.projector.slides = slides; renderProjection(); $('vote-projector-title').focus({preventScroll:true});
    } catch (error) { if (session === state.session && run === state.projectionRun) $('vote-projector-error').textContent = failureText('vote_results',error); }
  }

  function stageTitle(element, title) {
    const match = title.match(/^([A-F])組 投票結果$/);
    if (match) element.replaceChildren(textElement('span','nb',match[1] + '組'),document.createTextNode(' '),document.createElement('wbr'),textElement('span','nb','投票結果'));
    else element.textContent = title;
  }

  function renderProjection() {
    const projection = state.projector; if (!projection || !state.me?.teacher) return;
    const slide = projection.slides[projection.index]; if (!slide) return;
    stopConfetti();
    stageTitle($('vote-projector-title'), slide.title);
    const content = $('vote-projector-content'); content.replaceChildren(); content.dataset.stage = slide.type;
    content.dataset.rank = slide.rank ? String(slide.rank) : '';
    content.dataset.density = (slide.type === 'rank' ? slide.works.length : slide.type === 'summary' ? slide.groups.reduce((sum, group) => sum + group.works.length, 0) : 0) > 9 ? 'many' : 'normal';
    content.classList.toggle('vote-title-slide',slide.type === 'title' || slide.type === 'rank');
    if (slide.type === 'title') { const heading = textElement('p','vote-projection-heading'); stageTitle(heading,slide.title); content.append(heading); }
    if (slide.type === 'rank') {
      content.append(textElement('p','stage-numeral',slide.rank));
      const people = textElement('div','stage-tied-names'); people.style.setProperty('--tie-count',slide.works.length);
      for (const work of slide.works) { const person = textElement('p',''); person.dataset.key = work.key; person.append(textElement('span','',work.no + '番 '),document.createTextNode(work.name)); people.append(person); } content.append(people);
      if (slide.rank === 1) startConfetti();
    }
    if (slide.type === 'work') {
      const work = slide.works[0], article = textElement('article','vote-projection-work'); article.dataset.key = work.key;
      const preview = textElement('div','vote-projection-preview'); preview.append(makeIframe(work,true));
      const detail = textElement('div','vote-projection-detail'); detail.append(textElement('p','vote-projection-number',work.no + '番'),textElement('h2','vote-projection-name',work.name));
      article.append(preview,detail); content.append(article); resizeObserver.observe(preview); fitFrame(preview);
    }
    if (slide.type === 'summary') {
      const list = textElement('div','stage-summary');
      for (const group of slide.groups) {
        const section = textElement('section','stage-summary-group'); section.dataset.rank = String(group.rank); section.dataset.many = String(group.works.length > 2); section.append(textElement('h2','','第 ' + group.rank + ' 位'));
        const names = textElement('div','stage-summary-names');
        for (const work of group.works) { const person = textElement('p','stage-summary-person'); person.dataset.key = work.key; person.append(textElement('span','stage-summary-number',work.no + '番 '),document.createTextNode(work.name)); names.append(person); } section.append(names); list.append(section);
      }
      if (!slide.groups.length) list.append(textElement('p','','点の入った作品は、まだありません。'));
      content.append(list);
    }
    $('vote-projector-prev').disabled = projection.index <= 0; $('vote-projector-next').disabled = projection.index >= projection.slides.length-1;
  }

  function moveProjection(direction) {
    if (!state.projector || !state.me?.teacher) return;
    const next = Math.max(0,Math.min(state.projector.slides.length-1,state.projector.index+direction));
    if (next === state.projector.index) return; state.projector.index = next; renderProjection();
  }

  $('vote-projector-prev').addEventListener('click',() => moveProjection(-1));
  $('vote-projector-next').addEventListener('click',() => moveProjection(1));
  $('vote-projector-close').addEventListener('click',() => { location.hash = state.projector?.cls || 'A'; });
  $('vote-projector-fullscreen').addEventListener('click',() => { $('vote-projector').requestFullscreen?.().catch(() => {}); });
  document.addEventListener('keydown',event => {
    if (!state.projector || !state.me?.teacher || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'Escape') { event.preventDefault(); location.hash = state.projector.cls; return; }
    if (!['ArrowLeft','ArrowRight',' ','Enter','PageDown','PageUp'].includes(event.key)) return;
    if ([' ','Enter'].includes(event.key) && event.target.closest('button, a')) return;
    event.preventDefault(); moveProjection(['ArrowLeft','PageUp'].includes(event.key) ? -1 : 1);
  });
  // 作品の中をクリックすると、キーの受け手が作品の窓へ移ります。マウスを作品の外へ出したら、画面送りのキーを取り戻します。
  document.addEventListener('mouseover', event => {
    if (!state.projector || document.activeElement?.tagName !== 'IFRAME' || event.target.closest('iframe')) return;
    const title = $('vote-projector-title'); if (!title) return; title.tabIndex = -1; title.focus({ preventScroll: true });
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event => { if (event.matches) stopConfetti(); });

  function syncLocation() {
    if (!state.me) return;
    if (syncProjection()) return;
    normalizeScopeHash();
    const nextView = currentView();
    if (nextView !== state.view) {
      closeModal(false);
      state.view = nextView;
      followLiveClass();
      updateTabs();
      renderBoard();
      renderMypage();
      if (state.view === 'me') $('mypage-title').focus({ preventScroll: true });
      else if (nextView !== 'me') $('my-work').focus({ preventScroll: true });
    }
    const modalKey = history.state && history.state.reviewModal;
    if (modalKey && state.modalKey !== modalKey) openModal(modalKey, false);
    else if (!modalKey && state.modalKey) closeModal(false);
  }

  window.addEventListener('hashchange', syncLocation);
  window.addEventListener('hashchange', presetClassFromHash);
  window.addEventListener('popstate', syncLocation);
  window.addEventListener('scroll', schedulePreviews, { passive: true });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(state.pollTimer);
    clearTimeout(state.liveTimer); state.liveTimer = null;
    clearPreviewQueue();
    clearTimeout(state.hiddenPreviewTimer); state.hiddenPreviewTimer = null;
    if (document.hidden) {
      if (state.hiddenAt === null) state.hiddenAt = Date.now();
      const remaining = 60000 - (Date.now() - state.hiddenAt);
      if (remaining > 0) state.hiddenPreviewTimer = setTimeout(updatePreviews, remaining);
    } else {
      if (state.hiddenAt !== null && Date.now() - state.hiddenAt >= 60000) {
        for (const card of state.cards.values()) if (card.iframe) { card.iframe.remove(); card.iframe = null; }
      }
      state.hiddenAt = null;
    }
    updatePreviews();
    if (!document.hidden && state.token) { refreshBoard(false); scheduleLive(); }
  });

  window.addEventListener('online', () => { if (state.token) { refreshBoard(false); scheduleLive(); } });

  $('preview-toggle').checked = state.preview;
  document.body.classList.toggle('preview-off', !state.preview);
  renderLoginFields();
  presetClassFromHash();
  if (!apiUrl) { showNetwork('受け取り口の URL が入っていません'); }
  else {
    $('login-submit').disabled = false;
    if (state.token) { enterBoardPending(); refreshBoard(true); }
  }
})();
