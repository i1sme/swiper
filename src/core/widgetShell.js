import audio from './audio.js';

export class WidgetShell {
  constructor(widget, header, manager) {
    this.widget   = widget;
    this.header   = header;
    this.manager  = manager;
    this._currentName = null;
    this._pickerOpen  = false;

    this._drag = { active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };

    this._onMouseDown  = this._onMouseDown.bind(this);
    this._onMouseMove  = this._onMouseMove.bind(this);
    this._onMouseUp    = this._onMouseUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove  = this._onTouchMove.bind(this);
    this._onTouchEnd   = this._onTouchEnd.bind(this);
  }

  init() {
    this._setupDrag();
    this._buildPickerOverlay();
    this._setupButtons();
    if (!window.__TAURI__ && !window.Capacitor) this.widget.style.position = 'relative';

    if (window.__TAURI__) {
      this._expandedH = window.innerHeight;
      this._onWindowResize = () => {
        if (!this.widget.classList.contains('minimized')) {
          this._expandedH = window.innerHeight;
        }
      };
      window.addEventListener('resize', this._onWindowResize);
    }
  }

  // Устанавливает начальную игру (вызывается из index.html вместо manager.switchTo)
  startWith(name) {
    this._selectGame(name);
  }

  // --- drag ---

  _setupDrag() {
    this.header.addEventListener('mousedown', this._onMouseDown);
    if (!window.__TAURI__ && !window.Capacitor) {
      this.header.addEventListener('touchstart', this._onTouchStart, { passive: false });
    }
  }

  _beginDrag(clientX, clientY) {
    this._drag.active = true;
    this._drag.startX = clientX;
    this._drag.startY = clientY;

    const rect = this.widget.getBoundingClientRect();
    this._drag.origLeft = rect.left;
    this._drag.origTop  = rect.top;

    this.widget.style.position = 'fixed';
    this.widget.style.left   = rect.left + 'px';
    this.widget.style.top    = rect.top  + 'px';
    this.widget.style.margin = '0';
  }

  _updateDrag(clientX, clientY) {
    if (!this._drag.active) return;
    const dx = clientX - this._drag.startX;
    const dy = clientY - this._drag.startY;
    this.widget.style.left = (this._drag.origLeft + dx) + 'px';
    this.widget.style.top  = (this._drag.origTop  + dy) + 'px';
  }

  _onMouseDown(e) {
    if (e.target.closest('button')) return;
    if (window.__TAURI__) {
      window.__TAURI__.window.getCurrent().startDragging();
      return;
    }
    if (window.Capacitor) return;
    this._beginDrag(e.clientX, e.clientY);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup',   this._onMouseUp);
  }

  _onMouseMove(e) {
    this._updateDrag(e.clientX, e.clientY);
  }

  _onMouseUp() {
    this._drag.active = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
  }

  _onTouchStart(e) {
    if (e.target.closest('button')) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    this._beginDrag(t.clientX, t.clientY);
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend',  this._onTouchEnd);
    document.addEventListener('touchcancel', this._onTouchEnd);
  }

  _onTouchMove(e) {
    if (!this._drag.active || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    this._updateDrag(t.clientX, t.clientY);
  }

  _onTouchEnd() {
    this._drag.active = false;
    document.removeEventListener('touchmove',   this._onTouchMove);
    document.removeEventListener('touchend',    this._onTouchEnd);
    document.removeEventListener('touchcancel', this._onTouchEnd);
  }

  // --- picker overlay ---

  _buildPickerOverlay() {
    this._picker = document.createElement('div');
    this._picker.id = 'game-picker';
    this._picker.classList.add('hidden');
    document.getElementById('widget-body').appendChild(this._picker);

    for (const game of this.manager.games.values()) {
      const btn = document.createElement('button');
      btn.className = 'picker-item';
      btn.dataset.name = game.name;

      const iconEl = document.createElement('span');
      iconEl.className   = 'picker-icon';
      iconEl.textContent = game.icon ?? '🎮';

      const labelEl = document.createElement('span');
      labelEl.className   = 'picker-label';
      labelEl.textContent = game.label;

      btn.append(iconEl, labelEl);
      btn.addEventListener('click', () => {
        this._selectGame(game.name);
        this._closePicker();
      });

      this._picker.appendChild(btn);
    }
  }

  _refreshPicker() {
    for (const btn of this._picker.children) {
      btn.classList.toggle('active', btn.dataset.name === this._currentName);
    }
  }

  _selectGame(name) {
    this._currentName = name;
    this.manager.switchTo(name);
    this._updateLabel();
  }

  _togglePicker() {
    this._pickerOpen ? this._closePicker() : this._openPicker();
  }

  _openPicker() {
    this._pickerOpen = true;
    this._refreshPicker();
    this._picker.classList.remove('hidden');
    document.getElementById('btn-picker').classList.add('active');
  }

  _closePicker() {
    this._pickerOpen = false;
    this._picker.classList.add('hidden');
    document.getElementById('btn-picker').classList.remove('active');
  }

  // --- buttons ---

  _setupButtons() {
    document.getElementById('btn-minimize').addEventListener('click', () => {
      if (window.__TAURI__) {
        const win = window.__TAURI__.window.getCurrent();
        const wasMin = this.widget.classList.contains('minimized');
        if (!wasMin) this._expandedH = window.innerHeight;
        const isNowMin = this.widget.classList.toggle('minimized');
        const targetH  = isNowMin ? 36 : (this._expandedH ?? 316);
        win.setSize(new window.__TAURI__.window.LogicalSize(window.innerWidth, targetH));
        if (isNowMin && this._pickerOpen) this._closePicker();
        return;
      }
      this.widget.classList.toggle('minimized');
      if (this._pickerOpen) this._closePicker();
    });

    document.getElementById('btn-picker').addEventListener('click', () => {
      this._togglePicker();
    });

    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const next = !audio.isMuted();
        audio.setMuted(next);
        muteBtn.textContent = next ? '🔇' : '🔊';
        muteBtn.classList.toggle('muted', next);
      });
    }

    const closeBtn = document.getElementById('btn-close');
    if (closeBtn) {
      // На Capacitor приложение управляется системой — кнопка не нужна
      if (window.Capacitor) {
        closeBtn.style.display = 'none';
      } else {
        closeBtn.addEventListener('click', () => {
          if (window.__TAURI__) {
            window.__TAURI__.window.getCurrent().close();
          } else {
            // В вебе — просто свернём виджет (закрыть страницу нельзя)
            this.widget.classList.add('minimized');
          }
        });
      }
    }
  }

  _updateLabel() {
    const game = this.manager.games.get(this._currentName);
    document.getElementById('game-label').textContent = game?.label ?? '';
  }

  destroy() {
    this.header.removeEventListener('mousedown',  this._onMouseDown);
    this.header.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('mousemove',  this._onMouseMove);
    document.removeEventListener('mouseup',    this._onMouseUp);
    document.removeEventListener('touchmove',  this._onTouchMove);
    document.removeEventListener('touchend',   this._onTouchEnd);
    document.removeEventListener('touchcancel', this._onTouchEnd);
    if (this._onWindowResize) {
      window.removeEventListener('resize', this._onWindowResize);
    }
  }
}
