import { loadScripts, saveScripts, nextId } from './store.js';
import { md } from './markdown.js';
import './components/teleprompter-view.js';

(() => {
  let scripts = [];
  let activeId = null;

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
  const prompter = document.querySelector('teleprompter-view');

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
    prompter.open(md(s.content));
  }

  // ── Event listeners ──
  newScriptBtn.addEventListener('click', createScript);
  teleprompterBtn.addEventListener('click', openTeleprompter);

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
