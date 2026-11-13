/**
 * Notes & Daily Checklist App - Main Application Logic
 */

// Simple lightweight Markdown to HTML converter
function parseMarkdown(md) {
  if (!md) return '';
  let html = md
    // Escape raw HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Bold and Italics
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Horizontal rules
  html = html.replace(/^(?:---|\*\*\*|___)$/gim, '<hr>');

  // Checklist items
  html = html.replace(/^- \[x\] (.*$)/gim, '<li class="flex items-center gap-2"><input type="checkbox" checked disabled class="accent-emerald-500"> <span class="line-through text-gray-400">$1</span></li>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<li class="flex items-center gap-2"><input type="checkbox" disabled class="accent-emerald-500"> <span>$1</span></li>');

  // Unordered Lists
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^([*]) (.*$)/gim, '<li>$2</li>');

  // Paragraphs
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<blockquote') || p.startsWith('<hr') || p.startsWith('<li')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// Synthesized Audio Chime for Task Completion
function playCompletionSound() {
  if (!app.audioEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.00, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (e) {
    // Ignore audio context errors
  }
}

// Format Date Helpers
function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const todayStr = getTodayDateStr();

  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const formatted = dateObj.toLocaleDateString(undefined, options);

  if (dateStr === todayStr) {
    return `Today, ${formatted}`;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toISOString().split('T')[0]) {
    return `Yesterday, ${formatted}`;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split('T')[0]) {
    return `Tomorrow, ${formatted}`;
  }
  return formatted;
}

// Main Application Class
class NoteChecklistApp {
  constructor() {
    this.currentTab = 'checklist'; // 'checklist' | 'notes' | 'stats'
    this.currentDate = getTodayDateStr();
    this.checklistItems = [];
    this.checklistFilter = 'all'; // 'all' | 'pending' | 'completed'

    this.notes = [];
    this.selectedNoteId = null;
    this.activeSearch = '';
    this.activeTag = null;
    this.editorMode = 'edit'; // 'edit' | 'preview' | 'split'

    this.darkMode = localStorage.getItem('app_dark_mode') === 'true';
    this.audioEnabled = localStorage.getItem('app_audio_enabled') !== 'false';
    this.saveTimeout = null;
  }

  async start() {
    // Initialize API
    await window.api.init();

    // Init Theme
    this.initTheme();

    // Attach Event Listeners
    this.bindEvents();

    // Initial Data Fetch
    await this.loadChecklist();
    await this.loadNotes();
    await this.loadStats();

    // Auto-select first note if available
    if (this.notes.length > 0 && !this.selectedNoteId) {
      this.selectNote(this.notes[0].id);
    }

    this.render();
  }

  initTheme() {
    if (this.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = this.darkMode
        ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
        : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;
    }
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('app_dark_mode', this.darkMode);
    this.initTheme();
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    localStorage.setItem('app_audio_enabled', this.audioEnabled);
    this.showToast(this.audioEnabled ? 'Chime sound enabled 🔔' : 'Sound muted 🔕');
    this.renderSidebar();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 border ${
      type === 'error'
        ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/80 dark:border-rose-900 dark:text-rose-200'
        : 'bg-slate-900 border-slate-800 text-white dark:bg-slate-100 dark:border-slate-200 dark:text-slate-900'
    }`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ----------------- Data Loading -----------------

  async loadChecklist() {
    this.checklistItems = await window.api.getChecklist(this.currentDate);
    this.renderChecklist();
    this.updateStatsUI();
  }

  async loadNotes() {
    this.notes = await window.api.getNotes(this.activeSearch, this.activeTag);
    this.renderNotesList();
    this.renderTagsList();
  }

  async loadStats() {
    const stats = await window.api.getStats();
    this.stats = stats;
    this.renderStatsView();
  }

  // ----------------- Checklist Actions -----------------

  async addChecklistItem(title, priority = 'medium', category = 'general') {
    if (!title || !title.trim()) return;
    const newItem = await window.api.addChecklistItem({
      date: this.currentDate,
      title: title.trim(),
      priority,
      category
    });
    this.checklistItems.push(newItem);
    this.renderChecklist();
    this.loadStats();
    this.showToast('Task added! 🎯');
  }

  async toggleChecklistItem(id) {
    const item = this.checklistItems.find(i => i.id === id);
    if (!item) return;

    const newStatus = item.is_completed ? 0 : 1;
    item.is_completed = newStatus;

    if (newStatus === 1) {
      playCompletionSound();
    }

    await window.api.updateChecklistItem(id, { is_completed: newStatus });
    this.renderChecklist();
    this.loadStats();
  }

  async updateChecklistItemTitle(id, newTitle) {
    if (!newTitle.trim()) return;
    await window.api.updateChecklistItem(id, { title: newTitle.trim() });
    const item = this.checklistItems.find(i => i.id === id);
    if (item) item.title = newTitle.trim();
    this.renderChecklist();
  }

  async updateChecklistItemPriority(id, priority) {
    await window.api.updateChecklistItem(id, { priority });
    const item = this.checklistItems.find(i => i.id === id);
    if (item) item.priority = priority;
    this.renderChecklist();
  }

  async deleteChecklistItem(id) {
    await window.api.deleteChecklistItem(id);
    this.checklistItems = this.checklistItems.filter(i => i.id !== id);
    this.renderChecklist();
    this.loadStats();
    this.showToast('Task removed');
  }

  async rolloverYesterday() {
    const [y, m, d] = this.currentDate.split('-').map(Number);
    const prev = new Date(y, m - 1, d);
    prev.setDate(prev.getDate() - 1);
    const prevDateStr = prev.toISOString().split('T')[0];

    const res = await window.api.rolloverIncomplete(prevDateStr, this.currentDate);
    await this.loadChecklist();
    this.showToast(
      res.rolled_over > 0
        ? `Rolled over ${res.rolled_over} pending task${res.rolled_over > 1 ? 's' : ''}! 🔄`
        : 'No pending tasks from yesterday to roll over.'
    );
  }

  async applyDailyRoutines() {
    const res = await window.api.applyRecurringRoutines(this.currentDate);
    await this.loadChecklist();
    this.showToast(
      res.added > 0
        ? `Applied ${res.added} daily routine habit${res.added > 1 ? 's' : ''}! ✨`
        : 'Daily routines are already added for this day.'
    );
  }

  convertTaskToNote(taskTitle) {
    this.createNote({
      title: taskTitle,
      content: `### Notes for: ${taskTitle}\n\n- Created from daily checklist on ${this.currentDate}\n\n`,
      tags: ['task-notes']
    });
    this.switchTab('notes');
    this.showToast(`Converted "${taskTitle.substring(0, 20)}..." to Note! 📝`);
  }

  // ----------------- Notes Actions -----------------

  async createNote(override = {}) {
    const defaultNote = {
      title: 'Untitled Note',
      content: '',
      tags: ['general'],
      color: '#ffffff',
      is_pinned: 0,
      ...override
    };
    const created = await window.api.createNote(defaultNote);
    this.notes.unshift(created);
    this.selectedNoteId = created.id;
    this.renderNotesList();
    this.renderEditor();
    this.renderTagsList();
    this.loadStats();

    // Focus editor title
    setTimeout(() => {
      const titleInput = document.getElementById('note-title-input');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 50);
  }

  async openTodayDailyNote() {
    const dailyTitle = `📅 Daily Log: ${this.currentDate}`;
    // Check if daily note exists
    const existing = this.notes.find(n => n.title.includes(this.currentDate) || n.title === dailyTitle);
    if (existing) {
      this.selectedNoteId = existing.id;
      this.switchTab('notes');
      this.renderNotesList();
      this.renderEditor();
      this.showToast(`Opened today's daily log! 📖`);
    } else {
      const template = `# Daily Log — ${formatDateDisplay(this.currentDate)}\n\n### 🎯 Daily Focus & Goals:\n1. \n2. \n3. \n\n### 📝 Notes & Thoughts:\n- \n\n### 💡 Wins & Takeaways:\n- \n`;
      await this.createNote({
        title: dailyTitle,
        content: template,
        tags: ['daily-log', 'journal'],
        color: '#fef3c7'
      });
      this.switchTab('notes');
      this.showToast(`Created today's daily log! 📖`);
    }
  }

  selectNote(id) {
    this.selectedNoteId = id;
    this.renderNotesList();
    this.renderEditor();
  }

  async saveCurrentNote() {
    if (!this.selectedNoteId) return;
    const titleInput = document.getElementById('note-title-input');
    const contentTextarea = document.getElementById('note-content-input');
    const colorSelect = document.getElementById('note-color-badge');

    const note = this.notes.find(n => n.id === this.selectedNoteId);
    if (!note) return;

    const updatedData = {
      title: titleInput ? titleInput.value : note.title,
      content: contentTextarea ? contentTextarea.value : note.content,
      tags: note.tags,
      color: note.color,
      is_pinned: note.is_pinned
    };

    const updated = await window.api.updateNote(this.selectedNoteId, updatedData);
    if (updated) {
      Object.assign(note, updated);
      this.renderNotesList();
      this.renderTagsList();
    }
  }

  debouncedSaveNote() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentNote();
    }, 400);
  }

  async togglePinNote(id) {
    const note = this.notes.find(n => n.id === id);
    if (!note) return;
    const newPinned = note.is_pinned ? 0 : 1;
    await window.api.updateNote(id, { is_pinned: newPinned });
    note.is_pinned = newPinned;
    await this.loadNotes();
    this.showToast(newPinned ? 'Note pinned to top 📌' : 'Note unpinned');
  }

  async setNoteColor(color) {
    const note = this.notes.find(n => n.id === this.selectedNoteId);
    if (!note) return;
    note.color = color;
    await window.api.updateNote(this.selectedNoteId, { color });
    this.renderNotesList();
    this.renderEditor();
  }

  async addNoteTag(tag) {
    if (!tag || !tag.trim()) return;
    const cleanTag = tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const note = this.notes.find(n => n.id === this.selectedNoteId);
    if (!note) return;
    if (!note.tags.includes(cleanTag)) {
      note.tags.push(cleanTag);
      await window.api.updateNote(this.selectedNoteId, { tags: note.tags });
      this.renderEditor();
      this.renderTagsList();
      this.renderNotesList();
    }
  }

  async removeNoteTag(tag) {
    const note = this.notes.find(n => n.id === this.selectedNoteId);
    if (!note) return;
    note.tags = note.tags.filter(t => t !== tag);
    await window.api.updateNote(this.selectedNoteId, { tags: note.tags });
    this.renderEditor();
    this.renderTagsList();
    this.renderNotesList();
  }

  async deleteCurrentNote() {
    if (!this.selectedNoteId) return;
    if (!confirm('Are you sure you want to delete this note?')) return;

    await window.api.deleteNote(this.selectedNoteId);
    this.notes = this.notes.filter(n => n.id !== this.selectedNoteId);
    this.selectedNoteId = this.notes.length > 0 ? this.notes[0].id : null;
    this.renderNotesList();
    this.renderEditor();
    this.renderTagsList();
    this.loadStats();
    this.showToast('Note deleted 🗑️');
  }

  exportCurrentNoteAsMarkdown() {
    const note = this.notes.find(n => n.id === this.selectedNoteId);
    if (!note) return;

    const content = `# ${note.title}\n\n${note.content}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exported note as .md file! 📄');
  }

  insertEditorSnippet(prefix, suffix = '') {
    const textarea = document.getElementById('note-content-input');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = `${prefix}${selected}${suffix}`;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.selectionStart = start + prefix.length;
    textarea.selectionEnd = start + replacement.length - suffix.length;
    textarea.focus();
    this.debouncedSaveNote();
    if (this.editorMode === 'split' || this.editorMode === 'preview') {
      this.updateMarkdownPreview();
    }
  }

  // ----------------- Date Navigation -----------------

  changeDate(offsetDays) {
    const [y, m, d] = this.currentDate.split('-').map(Number);
    const newDate = new Date(y, m - 1, d);
    newDate.setDate(newDate.getDate() + offsetDays);
    this.currentDate = newDate.toISOString().split('T')[0];
    this.loadChecklist();
    this.renderDateStrip();
  }

  setDate(dateStr) {
    this.currentDate = dateStr;
    this.loadChecklist();
    this.renderDateStrip();
  }

  // ----------------- UI Rendering -----------------

  switchTab(tab) {
    this.currentTab = tab;
    ['tab-checklist', 'tab-notes', 'tab-stats'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`tab-${tab}`);
    if (activeEl) activeEl.classList.remove('hidden');

    // Update nav active states
    document.querySelectorAll('.nav-link').forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('bg-blue-500/10', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        btn.classList.remove('text-slate-600', 'dark:text-slate-400');
      } else {
        btn.classList.remove('bg-blue-500/10', 'text-blue-600', 'dark:text-blue-400', 'font-semibold');
        btn.classList.add('text-slate-600', 'dark:text-slate-400');
      }
    });

    if (tab === 'stats') {
      this.loadStats();
    }
  }

  renderDateStrip() {
    const stripContainer = document.getElementById('date-strip-container');
    if (!stripContainer) return;

    // Generate 7 days centered around selected date or today
    const [y, m, d] = this.currentDate.split('-').map(Number);
    const current = new Date(y, m - 1, d);
    const days = [];

    for (let i = -3; i <= 3; i++) {
      const dayDate = new Date(current);
      dayDate.setDate(dayDate.getDate() + i);
      days.push(dayDate);
    }

    const todayStr = getTodayDateStr();

    stripContainer.innerHTML = days.map(dObj => {
      const dStr = dObj.toISOString().split('T')[0];
      const isSelected = dStr === this.currentDate;
      const isToday = dStr === todayStr;
      const dayName = dObj.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = dObj.getDate();

      return `
        <button
          onclick="app.setDate('${dStr}')"
          class="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
            isSelected
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold scale-105'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }"
        >
          <span class="text-xs uppercase font-medium ${isSelected ? 'text-blue-100' : 'text-slate-400'}">${dayName}</span>
          <span class="text-base font-bold ${isToday && !isSelected ? 'text-blue-600 dark:text-blue-400 underline underline-offset-2' : ''}">${dayNum}</span>
        </button>
      `;
    }).join('');

    const dateTitle = document.getElementById('current-date-title');
    if (dateTitle) {
      dateTitle.innerText = formatDateDisplay(this.currentDate);
    }
  }

  renderChecklist() {
    this.renderDateStrip();
    const container = document.getElementById('checklist-items-container');
    const emptyState = document.getElementById('checklist-empty-state');
    if (!container) return;

    let items = [...this.checklistItems];

    if (this.checklistFilter === 'pending') {
      items = items.filter(i => !i.is_completed);
    } else if (this.checklistFilter === 'completed') {
      items = items.filter(i => i.is_completed);
    }

    // Update Progress Bar
    const total = this.checklistItems.length;
    const completed = this.checklistItems.filter(i => i.is_completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const progressFill = document.getElementById('checklist-progress-bar');
    const progressText = document.getElementById('checklist-progress-text');
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.innerText = `${completed} of ${total} completed (${percent}%)`;

    if (items.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = items.map(item => {
      const isCompleted = item.is_completed === 1;
      const priorityClass = `badge-priority-${item.priority || 'medium'}`;

      return `
        <div class="task-item group flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm ${
          isCompleted ? 'completed bg-slate-50/60 dark:bg-slate-900/40' : ''
        }" data-id="${item.id}">
          <div class="flex items-center gap-3.5 flex-1 min-w-0 mr-3">
            <input
              type="checkbox"
              ${isCompleted ? 'checked' : ''}
              onchange="app.toggleChecklistItem(${item.id})"
              class="checklist-checkbox flex-shrink-0"
              title="Toggle complete"
            />
            <div class="flex-1 min-w-0">
              <input
                type="text"
                value="${item.title.replace(/"/g, '&quot;')}"
                onblur="app.updateChecklistItemTitle(${item.id}, this.value)"
                onkeydown="if(event.key === 'Enter') this.blur()"
                class="task-title w-full bg-transparent border-none p-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded text-slate-800 dark:text-slate-100 font-medium text-sm truncate"
              />
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Category Badge -->
            <span class="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
              #${item.category || 'general'}
            </span>

            <!-- Priority Badge Dropdown -->
            <select
              onchange="app.updateChecklistItemPriority(${item.id}, this.value)"
              class="text-xs font-semibold px-2 py-0.5 rounded-md border-0 cursor-pointer ${priorityClass} focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="low" ${item.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${item.priority === 'medium' ? 'selected' : ''}>Med</option>
              <option value="high" ${item.priority === 'high' ? 'selected' : ''}>High</option>
            </select>

            <!-- Actions: Convert to Note & Delete -->
            <button
              onclick="app.convertTaskToNote('${item.title.replace(/'/g, "\\'")}')"
              class="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100 transition-opacity"
              title="Convert to Note"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </button>

            <button
              onclick="app.deleteChecklistItem(${item.id})"
              class="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 opacity-60 group-hover:opacity-100 transition-opacity"
              title="Delete task"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderNotesList() {
    const listContainer = document.getElementById('notes-list-container');
    const countBadge = document.getElementById('notes-count-badge');
    if (!listContainer) return;

    if (countBadge) countBadge.innerText = this.notes.length;

    if (this.notes.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-12 px-4 text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          <p class="font-medium text-sm">No notes found</p>
          <p class="text-xs mt-1">Click "+ New Note" to start writing!</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = this.notes.map(note => {
      const isSelected = note.id === this.selectedNoteId;
      const snippet = (note.content || '').replace(/[#*`_>\[\]]/g, '').slice(0, 75).trim() || 'No additional text...';
      const dateFormatted = new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      // Color tint border
      const customBorder = note.color && note.color !== '#ffffff' ? `border-l-4` : '';
      const customBorderStyle = note.color && note.color !== '#ffffff' ? `border-left-color: ${note.color};` : '';

      return `
        <div
          onclick="app.selectNote(${note.id})"
          style="${customBorderStyle}"
          class="p-3.5 rounded-xl cursor-pointer border transition-all ${customBorder} ${
            isSelected
              ? 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
            <h4 class="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate flex-1">
              ${note.is_pinned ? '<span class="inline-block mr-1 text-amber-500">📌</span>' : ''}
              ${note.title || 'Untitled Note'}
            </h4>
            <span class="text-[11px] text-slate-400 whitespace-nowrap">${dateFormatted}</span>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2">
            ${snippet}
          </p>

          <div class="flex items-center gap-1.5 flex-wrap">
            ${(note.tags || []).slice(0, 3).map(tag => `
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">#${tag}</span>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderTagsList() {
    const tagsContainer = document.getElementById('tags-filter-container');
    if (!tagsContainer) return;

    // Collect all unique tags and counts
    const tagCounts = {};
    this.notes.forEach(n => {
      (n.tags || []).forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });

    const tags = Object.keys(tagCounts).sort();

    tagsContainer.innerHTML = tags.map(tag => {
      const isActive = this.activeTag === tag;
      return `
        <button
          onclick="app.filterByTag('${tag}')"
          class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isActive
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }"
        >
          <span>#${tag}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">${tagCounts[tag]}</span>
        </button>
      `;
    }).join('');
  }

  filterByTag(tag) {
    if (this.activeTag === tag) {
      this.activeTag = null; // Toggle off
    } else {
      this.activeTag = tag;
    }
    this.loadNotes();
  }

  renderEditor() {
    const emptyView = document.getElementById('editor-empty-state');
    const editorView = document.getElementById('editor-active-state');
    if (!emptyView || !editorView) return;

    const note = this.notes.find(n => n.id === this.selectedNoteId);
    if (!note) {
      emptyView.classList.remove('hidden');
      editorView.classList.add('hidden');
      return;
    }

    emptyView.classList.add('hidden');
    editorView.classList.remove('hidden');

    const titleInput = document.getElementById('note-title-input');
    const contentInput = document.getElementById('note-content-input');
    const pinBtn = document.getElementById('note-pin-btn');
    const tagsContainer = document.getElementById('note-editor-tags');

    if (titleInput) titleInput.value = note.title;
    if (contentInput) contentInput.value = note.content;

    if (pinBtn) {
      pinBtn.classList.toggle('text-amber-500', !!note.is_pinned);
      pinBtn.title = note.is_pinned ? 'Unpin note' : 'Pin note to top';
    }

    if (tagsContainer) {
      tagsContainer.innerHTML = (note.tags || []).map(tag => `
        <span class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
          #${tag}
          <button onclick="app.removeNoteTag('${tag}')" class="hover:text-rose-500 font-bold ml-0.5">&times;</button>
        </span>
      `).join('');
    }

    this.updateEditorMode();
  }

  setEditorMode(mode) {
    this.editorMode = mode;
    this.updateEditorMode();
  }

  updateEditorMode() {
    const editPane = document.getElementById('editor-edit-pane');
    const previewPane = document.getElementById('editor-preview-pane');

    ['mode-btn-edit', 'mode-btn-preview', 'mode-btn-split'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('bg-blue-600', 'text-white');
    });

    const activeBtn = document.getElementById(`mode-btn-${this.editorMode}`);
    if (activeBtn) activeBtn.classList.add('bg-blue-600', 'text-white');

    if (this.editorMode === 'edit') {
      editPane?.classList.remove('hidden');
      editPane?.classList.remove('w-1/2');
      editPane?.classList.add('w-full');
      previewPane?.classList.add('hidden');
    } else if (this.editorMode === 'preview') {
      editPane?.classList.add('hidden');
      previewPane?.classList.remove('hidden');
      previewPane?.classList.remove('w-1/2');
      previewPane?.classList.add('w-full');
      this.updateMarkdownPreview();
    } else if (this.editorMode === 'split') {
      editPane?.classList.remove('hidden');
      editPane?.classList.remove('w-full');
      editPane?.classList.add('w-1/2');

      previewPane?.classList.remove('hidden');
      previewPane?.classList.remove('w-full');
      previewPane?.classList.add('w-1/2');
      this.updateMarkdownPreview();
    }
  }

  updateMarkdownPreview() {
    const previewContent = document.getElementById('markdown-preview-content');
    const contentInput = document.getElementById('note-content-input');
    if (previewContent && contentInput) {
      previewContent.innerHTML = parseMarkdown(contentInput.value);
    }
  }

  renderStatsView() {
    const streakEl = document.getElementById('stats-streak-count');
    const notesCountEl = document.getElementById('stats-notes-count');
    const tasksCountEl = document.getElementById('stats-tasks-count');
    const chartContainer = document.getElementById('stats-chart-bars');

    if (!this.stats) return;

    if (streakEl) streakEl.innerText = `${this.stats.streak_days} Days 🔥`;
    if (notesCountEl) notesCountEl.innerText = this.stats.total_notes;
    if (tasksCountEl) tasksCountEl.innerText = `${this.stats.completed_tasks} / ${this.stats.total_tasks}`;

    // Streak badge on sidebar
    const sidebarStreak = document.getElementById('sidebar-streak-badge');
    if (sidebarStreak) {
      sidebarStreak.innerText = `🔥 ${this.stats.streak_days}d streak`;
    }

    if (chartContainer && this.stats.last_7_days) {
      chartContainer.innerHTML = this.stats.last_7_days.map(d => {
        const heightPct = Math.max(d.percentage, 10);
        const isToday = d.date === getTodayDateStr();

        return `
          <div class="flex-1 flex flex-col items-center gap-2">
            <span class="text-xs font-semibold text-slate-500">${d.percentage}%</span>
            <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg h-36 flex items-end justify-center p-1">
              <div
                class="w-full rounded-md transition-all duration-500 ${
                  isToday ? 'bg-blue-600' : 'bg-emerald-500'
                }"
                style="height: ${heightPct}%;"
                title="${d.date}: ${d.completed}/${d.total} tasks completed"
              ></div>
            </div>
            <span class="text-xs font-medium ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400'}">${d.day}</span>
          </div>
        `;
      }).join('');
    }
  }

  updateStatsUI() {
    // Quick refresh of stats
    this.loadStats();
  }

  renderSidebar() {
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) {
      audioBtn.innerHTML = this.audioEnabled
        ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z"/></svg>`
        : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>`;
    }
  }

  // ----------------- Manage Recurring Routines Modal -----------------

  async openRoutinesModal() {
    const modal = document.getElementById('routines-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    await this.renderRoutinesList();
  }

  closeRoutinesModal() {
    const modal = document.getElementById('routines-modal');
    if (modal) modal.classList.add('hidden');
  }

  async renderRoutinesList() {
    const listEl = document.getElementById('routines-list-container');
    if (!listEl) return;
    const routines = await window.api.getRoutines();

    if (routines.length === 0) {
      listEl.innerHTML = `<p class="text-sm text-slate-400 py-4 text-center">No recurring routines configured yet.</p>`;
      return;
    }

    listEl.innerHTML = routines.map(r => `
      <div class="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
        <div class="flex items-center gap-2">
          <span class="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 uppercase font-semibold text-[10px]">${r.category}</span>
          <span class="text-sm font-medium text-slate-800 dark:text-slate-200">${r.title}</span>
        </div>
        <button
          onclick="app.deleteRoutineItem(${r.id})"
          class="text-rose-500 hover:text-rose-700 p-1 rounded"
          title="Delete routine"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    `).join('');
  }

  async addRoutineItem(title, category = 'routine', priority = 'medium') {
    if (!title || !title.trim()) return;
    await window.api.addRoutine({ title: title.trim(), category, priority });
    await this.renderRoutinesList();
    this.showToast('Recurring habit added! 🌿');
  }

  async deleteRoutineItem(id) {
    await window.api.deleteRoutine(id);
    await this.renderRoutinesList();
    this.showToast('Routine removed');
  }

  // ----------------- Backup / Restore -----------------

  async exportAllData() {
    const data = await window.api.exportData();
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", jsonStr);
    dlAnchor.setAttribute("download", `notes_checklist_backup_${getTodayDateStr()}.json`);
    dlAnchor.click();
    dlAnchor.remove();
    this.showToast('Full backup downloaded! 💾');
  }

  async importDataFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        await window.api.importData(parsed);
        this.showToast('Data imported successfully! 🎉');
        await this.loadChecklist();
        await this.loadNotes();
        await this.loadStats();
      } catch (err) {
        alert('Invalid JSON file format!');
      }
    };
    reader.readAsText(file);
  }

  // ----------------- Event Listeners -----------------

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Theme Toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

    // Audio Toggle
    document.getElementById('audio-toggle-btn')?.addEventListener('click', () => this.toggleAudio());

    // Checklist Input
    const taskInput = document.getElementById('new-task-input');
    const taskPriority = document.getElementById('new-task-priority');
    const taskCategory = document.getElementById('new-task-category');
    const addTaskBtn = document.getElementById('add-task-btn');

    const handleAddTask = () => {
      if (taskInput && taskInput.value.trim()) {
        this.addChecklistItem(
          taskInput.value,
          taskPriority ? taskPriority.value : 'medium',
          taskCategory ? taskCategory.value : 'general'
        );
        taskInput.value = '';
        taskInput.focus();
      }
    };

    addTaskBtn?.addEventListener('click', handleAddTask);
    taskInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddTask();
    });

    // Filter Checklist Tabs
    document.querySelectorAll('.checklist-filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.checklistFilter = tab.dataset.filter;
        document.querySelectorAll('.checklist-filter-tab').forEach(t => {
          t.classList.remove('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-slate-900', 'dark:text-white', 'font-semibold');
          t.classList.add('text-slate-500');
        });
        tab.classList.add('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'text-slate-900', 'dark:text-white', 'font-semibold');
        tab.classList.remove('text-slate-500');
        this.renderChecklist();
      });
    });

    // Notes Actions
    document.getElementById('new-note-btn')?.addEventListener('click', () => this.createNote());
    document.getElementById('delete-note-btn')?.addEventListener('click', () => this.deleteCurrentNote());
    document.getElementById('note-pin-btn')?.addEventListener('click', () => {
      if (this.selectedNoteId) this.togglePinNote(this.selectedNoteId);
    });
    document.getElementById('export-note-md-btn')?.addEventListener('click', () => this.exportCurrentNoteAsMarkdown());

    // Search Input
    const searchInput = document.getElementById('notes-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.activeSearch = e.target.value.trim();
      this.loadNotes();
    });

    // Editor Content Changes
    const titleInput = document.getElementById('note-title-input');
    titleInput?.addEventListener('input', () => this.debouncedSaveNote());

    const contentInput = document.getElementById('note-content-input');
    contentInput?.addEventListener('input', () => {
      this.debouncedSaveNote();
      if (this.editorMode === 'split' || this.editorMode === 'preview') {
        this.updateMarkdownPreview();
      }
    });

    // Add Tag Input
    const addTagInput = document.getElementById('add-tag-input');
    addTagInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && addTagInput.value.trim()) {
        this.addNoteTag(addTagInput.value);
        addTagInput.value = '';
      }
    });

    // Import file picker
    const importInput = document.getElementById('import-file-input');
    importInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.importDataFromFile(e.target.files[0]);
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        this.createNote();
      } else if (isCmdOrCtrl && e.key === 't') {
        e.preventDefault();
        this.switchTab('checklist');
        document.getElementById('new-task-input')?.focus();
      } else if (isCmdOrCtrl && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        this.toggleTheme();
      } else if (e.key === 'Escape') {
        this.closeRoutinesModal();
      }
    });
  }

  render() {
    this.renderSidebar();
    this.renderDateStrip();
    this.renderChecklist();
    this.renderNotesList();
    this.renderTagsList();
    this.renderEditor();
    this.renderStatsView();
  }
}

// Register Service Worker for PWA (Nothing Phone 3 offline install)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker registered with scope:', reg.scope))
      .catch(err => console.log('[PWA] Service Worker registration failed:', err));
  });
}

// Instantiate global app
window.app = new NoteChecklistApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.start();
});
