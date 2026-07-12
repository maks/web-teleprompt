import { loadScripts, saveScripts, nextId } from './store.js';
import { md } from './markdown.js';

(() => {
  let scripts = [];
  let activeId = null;
  let prompterScrollId = null;
  let paused = false;
  let speed = 25;

  // ── DOM refs ──
  const editorView = document.getElementById('editorView');
  const mainEditor = document.getElementById('mainEditor');
  const sidebar = document.getElementById('sidebar');
  const scriptList = document.getElementById('scriptList');
  const newScriptBtn = document.getElementById('newScriptBtn');
  const titleInput = document.getElementById('titleInput');
  const editor = document.getElementById('editor');
  const teleprompterBtn = document.getElementById('teleprompterBtn');
  const emptyState = document.getElementById('emptyState');
  const teleprompterView = document.getElementById('teleprompterView');
  const prompterControls = document.getElementById('prompterControls');
  const prompterContent = document.getElementById('prompterContent');
  const prompterText = document.getElementById('prompterText');
  const speedSlider = document.getElementById('speedSlider');
  const speedLabel = document.getElementById('speedLabel');
  const wakeLockLabel = document.getElementById('wakeLockLabel');
  const wakeLockToggle = document.getElementById('wakeLockToggle');
  const pauseBtn = document.getElementById('pauseBtn');
  const exitBtn = document.getElementById('exitBtn');

  // Safety check for DOM elements
  if (!editorView || !mainEditor || !sidebar || !scriptList) {
    console.error('Missing required DOM elements');
    return;
  }

  // ── Render script list ──
  function renderList() {
    scriptList.innerHTML = '';
    if (scripts.length === 0) {
      emptyState.classList.add('visible');
      titleInput.style.display = 'none';
      editor.style.display = 'none';
      sidebar.style.display = 'none';
      return;
    }
    emptyState.classList.remove('visible');
    titleInput.style.display = '';
    editor.style.display = '';
    sidebar.style.display = 'flex';
    scripts.forEach(s => {
      const li = document.createElement('li');
      if (s.id === activeId) li.classList.add('active');
      const name = document.createElement('span');
      name.className = 'scriptName';
      name.textContent = s.title || 'Untitled';
      name.addEventListener('click', () => selectScript(s.id));
      const del = document.createElement('button');
      del.className = 'deleteBtn';
      del.textContent = '✕';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteScript(s.id);
      });
      li.append(name, del);
      scriptList.appendChild(li);
    });
  }

  // ── Select / edit ──
  function selectScript(id) {
    // Save the PREVIOUS script before switching (if we have one)
    if (activeId) {
      saveCurrent();
    }
    activeId = id;
    const s = scripts.find(x => x.id === id);
    if (!s) return;
    titleInput.value = s.title;
    editor.value = s.content;
    renderList();
    const activeLi = scriptList.querySelector('li.active');
    if (activeLi) activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    teleprompterBtn.disabled = false;
  }

  function saveCurrent() {
    if (!activeId) return;
    const s = scripts.find(x => x.id === activeId);
    if (!s) return;
    s.title = titleInput.value.trim() || 'Untitled';
    s.content = editor.value;
    s.updatedAt = Date.now();
    saveScripts(scripts);
    renderList();
  }

  function createScript() {
    const s = {
      id: nextId(),
      title: 'Untitled',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    scripts.push(s);
    saveScripts(scripts);
    selectScript(s.id);
  }

  function deleteScript(id) {
    const s = scripts.find(x => x.id === id);
    if (!s) return;
    const title = s.title || 'Untitled';
    if (!confirm(`Delete "${title}"?\n\nThis cannot be undone.`)) return;
    const idx = scripts.findIndex(x => x.id === id);
    scripts = scripts.filter(x => x.id !== id);
    saveScripts(scripts);
    if (activeId === id) {
      if (scripts.length) {
        // Keep activeId pointing at the deleted script so selectScript's
        // saveCurrent() no-ops instead of writing the stale editor
        // contents into the newly selected script.
        selectScript(scripts[Math.max(0, idx - 1)].id);
      } else {
        activeId = null;
        titleInput.value = '';
        editor.value = '';
        teleprompterBtn.disabled = true;
      }
    }
    renderList();
  }

  // ── Autosave ──
  let autosaveTimer = null;
  function onEditorChange() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveCurrent, 400);
  }
  titleInput.addEventListener('input', onEditorChange);
  editor.addEventListener('input', onEditorChange);

  // ── Teleprompter ──
  function openTeleprompter() {
    saveCurrent();
    const s = scripts.find(x => x.id === activeId);
    if (!s) return;
    prompterText.innerHTML = md(s.content);
    scrollOffset = 0;
    applyOffset();
    paused = false;
    pauseBtn.textContent = 'Pause';
    teleprompterView.classList.add('active');
    document.body.style.overflow = 'hidden';
    refreshMaxScroll();
    startScroll();
  }

  function closeTeleprompter() {
    teleprompterView.classList.remove('active');
    document.body.style.overflow = '';
    stopScroll();
    scrollOffset = 0;
    applyOffset();
  }

  function getSpeedPxPerSecond() {
    // map 1–100 to ~4.5–180 px/s
    const v = parseFloat(speedSlider.value);
    return 4.5 + (v / 100) * 175.5;
  }

  let scrollOffset = 0;
  let maxScroll = 0;
  function refreshMaxScroll() {
    maxScroll = Math.max(0, prompterContent.scrollHeight - prompterContent.clientHeight);
  }
  let lastAppliedOffset = null;
  function applyOffset() {
    if (scrollOffset === lastAppliedOffset) return;
    lastAppliedOffset = scrollOffset;
    prompterText.style.transform = `translate3d(0, ${-scrollOffset}px, 0)`;
  }
  function startScroll() {
    if (prompterScrollId) return;
    acquireWakeLock();
    let lastTime = null;
    function tick(now) {
      if (lastTime !== null) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        scrollOffset = Math.min(scrollOffset + getSpeedPxPerSecond() * dt, maxScroll);
        applyOffset();
      }
      lastTime = now;
      if (scrollOffset >= maxScroll) {
        prompterScrollId = null;
        releaseWakeLock();
        return;
      }
      prompterScrollId = requestAnimationFrame(tick);
    }
    prompterScrollId = requestAnimationFrame(tick);
  }
  function stopScroll() {
    if (prompterScrollId) {
      cancelAnimationFrame(prompterScrollId);
      prompterScrollId = null;
    }
    releaseWakeLock();
  }

  // ── Screen wake lock (opt-in, held only while auto-scrolling) ──
  const WAKELOCK_KEY = 'teleprompter_wakelock';
  let wakeLock = null;

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock || !wakeLockToggle.checked) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // scrolling may have stopped, or the toggle flipped, while the request was in flight
      if (!prompterScrollId || !wakeLockToggle.checked) {
        lock.release();
        return;
      }
      wakeLock = lock;
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
      // request denied (e.g. battery saver, permissions policy) — screen sleeps as normal
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }

  if ('wakeLock' in navigator) {
    wakeLockToggle.checked = localStorage.getItem(WAKELOCK_KEY) === '1';
    wakeLockToggle.addEventListener('change', () => {
      if (wakeLockToggle.checked && prompterScrollId) acquireWakeLock();
      else releaseWakeLock();
      try {
        localStorage.setItem(WAKELOCK_KEY, wakeLockToggle.checked ? '1' : '0');
      } catch (e) {}
    });
    // the browser force-releases the lock when the tab is hidden;
    // re-acquire if we come back while still scrolling
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && prompterScrollId) acquireWakeLock();
    });
  } else {
    wakeLockLabel.style.display = 'none';
  }
  function togglePause() {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (paused) stopScroll();
    else startScroll();
  }

  prompterContent.addEventListener('wheel', e => {
    e.preventDefault();
    scrollOffset = Math.min(Math.max(0, scrollOffset + e.deltaY), maxScroll);
    applyOffset();
    if (!paused) startScroll();
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (!teleprompterView.classList.contains('active')) return;
    refreshMaxScroll();
    scrollOffset = Math.min(scrollOffset, maxScroll);
    applyOffset();
    if (!paused) startScroll();
  });

  // ── Spacebar toggle ──
  document.addEventListener('keydown', e => {
    if (!teleprompterView.classList.contains('active')) return;
    // ignore if focused on an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    }
    if (e.code === 'Escape') {
      closeTeleprompter();
    }
  });

  // ── Event listeners ──
  newScriptBtn.addEventListener('click', createScript);
  teleprompterBtn.addEventListener('click', openTeleprompter);
  exitBtn.addEventListener('click', closeTeleprompter);
  pauseBtn.addEventListener('click', togglePause);
  speedSlider.addEventListener('input', () => {
    speed = parseInt(speedSlider.value);
    speedLabel.textContent = speed;
  });
  // initial label
  speedLabel.textContent = speedSlider.value;

  // ── Save on page unload (reload, close, navigate away) ──
  window.addEventListener('beforeunload', () => {
    saveCurrent();
    saveScripts(scripts);
  });

  // ── Init ──
  try {
    // Make sure editor view is visible
    editorView.style.display = 'flex';
    scripts = loadScripts();

    // Auto-create initial script if none exist
    if (scripts.length === 0) {
      createScript();
    } else {
      renderList();
      selectScript(scripts[0].id);
    }
  } catch (e) {
    console.error('Initialization error:', e);
  }
})();
