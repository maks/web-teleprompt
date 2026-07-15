// @ts-check
import { loadScripts, saveScripts, nextId } from './store.js';
import { md } from './markdown.js';
import { TeleprompterView } from './components/teleprompter-view.js';
/** @import { Script } from './store.js' */

(() => {
  /** @type {Script[]} */
  let scripts = [];
  /** @type {?string} */
  let activeId = null;

  // ── DOM refs ──
  /**
   * Look up an element by id, verifying it exists and has the expected type.
   * @template {HTMLElement} T
   * @param {string} id
   * @param {new () => T} type
   * @returns {T}
   */
  function $(id, type) {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
      throw new Error(`Missing or unexpected element #${id}`);
    }
    return element;
  }

  const editorView = $('editorView', HTMLElement);
  const sidebar = $('sidebar', HTMLElement);
  const scriptList = $('scriptList', HTMLUListElement);
  const newScriptBtn = $('newScriptBtn', HTMLButtonElement);
  const titleInput = $('titleInput', HTMLInputElement);
  const editor = $('editor', HTMLTextAreaElement);
  const teleprompterBtn = $('teleprompterBtn', HTMLButtonElement);
  const emptyState = $('emptyState', HTMLElement);
  const prompter = $('prompter', TeleprompterView);

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
  /** @param {string} id */
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

  /** @param {string} id */
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
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let autosaveTimer;
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
