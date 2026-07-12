// ── <teleprompter-view> — fullscreen auto-scrolling prompter overlay ──
// Public API: open(html) shows the overlay and starts scrolling the given
// markup; close() exits. Everything else (speed, pause, wake lock, wheel and
// keyboard control) is handled internally.

const WAKELOCK_KEY = 'teleprompter_wakelock';

// Shell markup and styles live in sibling .html/.css files (real files, real
// editor tooling); fetched once at module load, shared by all instances.
const [cssText, htmlText] = await Promise.all([
  fetch(new URL('./teleprompter-view.css', import.meta.url)).then((r) => r.text()),
  fetch(new URL('./teleprompter-view.html', import.meta.url)).then((r) => r.text()),
]);

const styles = new CSSStyleSheet();
styles.replaceSync(cssText);

const template = document.createElement('template');
template.innerHTML = htmlText;

class TeleprompterView extends HTMLElement {
  #scrollId = null;
  #paused = false;
  #scrollOffset = 0;
  #maxScroll = 0;
  #lastAppliedOffset = null;
  #wakeLock = null;
  #content;
  #text;
  #speedSlider;
  #speedLabel;
  #wakeLockLabel;
  #wakeLockToggle;
  #pauseBtn;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [styles];
    this.shadowRoot.append(template.content.cloneNode(true));

    const $ = (id) => this.shadowRoot.getElementById(id);
    this.#content = $('prompterContent');
    this.#text = $('prompterText');
    this.#speedSlider = $('speedSlider');
    this.#speedLabel = $('speedLabel');
    this.#wakeLockLabel = $('wakeLockLabel');
    this.#wakeLockToggle = $('wakeLockToggle');
    this.#pauseBtn = $('pauseBtn');

    $('exitBtn').addEventListener('click', () => this.close());
    this.#pauseBtn.addEventListener('click', () => this.#togglePause());
    this.#speedSlider.addEventListener('input', () => {
      this.#speedLabel.textContent = this.#speedSlider.value;
    });
    // initial label
    this.#speedLabel.textContent = this.#speedSlider.value;

    this.#content.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.#scrollOffset = Math.min(Math.max(0, this.#scrollOffset + e.deltaY), this.#maxScroll);
      this.#applyOffset();
      if (!this.#paused) this.#startScroll();
    }, { passive: false });

    if ('wakeLock' in navigator) {
      this.#wakeLockToggle.checked = localStorage.getItem(WAKELOCK_KEY) === '1';
      this.#wakeLockToggle.addEventListener('change', () => {
        if (this.#wakeLockToggle.checked && this.#scrollId) this.#acquireWakeLock();
        else this.#releaseWakeLock();
        try {
          localStorage.setItem(WAKELOCK_KEY, this.#wakeLockToggle.checked ? '1' : '0');
        } catch (e) {}
      });
    } else {
      this.#wakeLockLabel.style.display = 'none';
    }
  }

  connectedCallback() {
    document.addEventListener('keydown', this.#onKeydown);
    window.addEventListener('resize', this.#onResize);
    // the browser force-releases the wake lock when the tab is hidden;
    // re-acquire if we come back while still scrolling
    document.addEventListener('visibilitychange', this.#onVisibilityChange);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.#onKeydown);
    window.removeEventListener('resize', this.#onResize);
    document.removeEventListener('visibilitychange', this.#onVisibilityChange);
  }

  get isOpen() {
    return this.hasAttribute('open');
  }

  open(html) {
    this.#text.innerHTML = html;
    this.#scrollOffset = 0;
    this.#applyOffset();
    this.#paused = false;
    this.#pauseBtn.textContent = 'Pause';
    this.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    this.#refreshMaxScroll();
    this.#startScroll();
  }

  close() {
    this.removeAttribute('open');
    document.body.style.overflow = '';
    this.#stopScroll();
    this.#scrollOffset = 0;
    this.#applyOffset();
  }

  #onKeydown = (e) => {
    if (!this.isOpen) return;
    // ignore if focused on an input (composedPath sees through shadow retargeting)
    const target = e.composedPath()[0];
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.#togglePause();
    }
    if (e.code === 'Escape') {
      this.close();
    }
  };

  #onResize = () => {
    if (!this.isOpen) return;
    this.#refreshMaxScroll();
    this.#scrollOffset = Math.min(this.#scrollOffset, this.#maxScroll);
    this.#applyOffset();
    if (!this.#paused) this.#startScroll();
  };

  #onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && this.#scrollId) this.#acquireWakeLock();
  };

  #togglePause() {
    this.#paused = !this.#paused;
    this.#pauseBtn.textContent = this.#paused ? 'Resume' : 'Pause';
    if (this.#paused) this.#stopScroll();
    else this.#startScroll();
  }

  #getSpeedPxPerSecond() {
    // map 1–100 to ~4.5–180 px/s
    const v = parseFloat(this.#speedSlider.value);
    return 4.5 + (v / 100) * 175.5;
  }

  #refreshMaxScroll() {
    this.#maxScroll = Math.max(0, this.#content.scrollHeight - this.#content.clientHeight);
  }

  #applyOffset() {
    if (this.#scrollOffset === this.#lastAppliedOffset) return;
    this.#lastAppliedOffset = this.#scrollOffset;
    this.#text.style.transform = `translate3d(0, ${-this.#scrollOffset}px, 0)`;
  }

  #startScroll() {
    if (this.#scrollId) return;
    this.#acquireWakeLock();
    let lastTime = null;
    const tick = (now) => {
      if (lastTime !== null) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        this.#scrollOffset = Math.min(this.#scrollOffset + this.#getSpeedPxPerSecond() * dt, this.#maxScroll);
        this.#applyOffset();
      }
      lastTime = now;
      if (this.#scrollOffset >= this.#maxScroll) {
        this.#scrollId = null;
        this.#releaseWakeLock();
        return;
      }
      this.#scrollId = requestAnimationFrame(tick);
    };
    this.#scrollId = requestAnimationFrame(tick);
  }

  #stopScroll() {
    if (this.#scrollId) {
      cancelAnimationFrame(this.#scrollId);
      this.#scrollId = null;
    }
    this.#releaseWakeLock();
  }

  // ── Screen wake lock (opt-in, held only while auto-scrolling) ──
  async #acquireWakeLock() {
    if (!('wakeLock' in navigator) || this.#wakeLock || !this.#wakeLockToggle.checked) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // scrolling may have stopped, or the toggle flipped, while the request was in flight
      if (!this.#scrollId || !this.#wakeLockToggle.checked) {
        lock.release();
        return;
      }
      this.#wakeLock = lock;
      this.#wakeLock.addEventListener('release', () => { this.#wakeLock = null; });
    } catch (e) {
      // request denied (e.g. battery saver, permissions policy) — screen sleeps as normal
    }
  }

  #releaseWakeLock() {
    if (this.#wakeLock) {
      this.#wakeLock.release();
      this.#wakeLock = null;
    }
  }
}

customElements.define('teleprompter-view', TeleprompterView);
