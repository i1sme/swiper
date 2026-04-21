export class WidgetShell {
  constructor(widget, header, manager) {
    this.widget   = widget;
    this.header   = header;
    this.manager  = manager;
    this._currentName = null;
    this._pickerOpen  = false;

    this._drag = { active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);
  }

  init() {
    this._setupDrag();
    this._buildPickerOverlay();
    this._setupButtons();
    if (!window.__TAURI__) this.widget.style.position = 'relative';
  }

  // Устанавливает начальную игру (вызывается из index.html вместо manager.switchTo)
  startWith(name) {
    this._selectGame(name);
  }

  // --- drag ---

  _setupDrag() {
    this.header.addEventListener('mousedown', this._onMouseDown);
  }

  _onMouseDown(e) {
    if (e.target.closest('button')) return;
    if (window.__TAURI__) {
      window.__TAURI__.window.getCurrent().startDragging();
      return;
    }
    this._drag.active = true;
    this._drag.startX = e.clientX;
    this._drag.startY = e.clientY;

    const rect = this.widget.getBoundingClientRect();
    this._drag.origLeft = rect.left;
    this._drag.origTop  = rect.top;

    this.widget.style.position = 'fixed';
    this.widget.style.left   = rect.left + 'px';
    this.widget.style.top    = rect.top  + 'px';
    this.widget.style.margin = '0';

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup',   this._onMouseUp);
  }

  _onMouseMove(e) {
    if (!this._drag.active) return;
    const dx = e.clientX - this._drag.startX;
    const dy = e.clientY - this._drag.startY;
    this.widget.style.left = (this._drag.origLeft + dx) + 'px';
    this.widget.style.top  = (this._drag.origTop  + dy) + 'px';
  }

  _onMouseUp() {
    this._drag.active = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
  }

  // --- picker overlay ---

  _buildPickerOverlay() {
    this._picker = document.createElement('div');
    this._picker.id = 'game-picker';
    this._picker.classList.add('hidden');
    document.getElementById('widget-body').appendChild(this._picker);
  }

  _refreshPicker() {
    this._picker.innerHTML = '';
    for (const game of this.manager.games.values()) {
      const btn = document.createElement('button');
      btn.className = 'picker-item' + (game.name === this._currentName ? ' active' : '');

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
        window.__TAURI__.window.getCurrent().hide();
        return;
      }
      this.widget.classList.toggle('minimized');
      if (this._pickerOpen) this._closePicker();
    });

    document.getElementById('btn-picker').addEventListener('click', () => {
      this._togglePicker();
    });
  }

  _updateLabel() {
    const game = this.manager.games.get(this._currentName);
    document.getElementById('game-label').textContent = game?.label ?? '';
  }

  destroy() {
    this.header.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
  }
}
