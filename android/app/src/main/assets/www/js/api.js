/**
 * API client with automatic SQLite Backend + LocalStorage Offline Fallback
 */
class NoteChecklistAPI {
  constructor() {
    this.useLocalStorage = false;
    this.storageKeyNotes = 'app_notes_data';
    this.storageKeyChecklists = 'app_checklists_data';
    this.storageKeyRoutines = 'app_routines_data';
  }

  async init() {
    try {
      // Check if server API is alive
      const res = await fetch('/api/stats', { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        this.useLocalStorage = false;
        console.log('[API] Connected to Python SQLite backend');
      } else {
        this.useLocalStorage = true;
      }
    } catch (e) {
      this.useLocalStorage = true;
      console.warn('[API] Server unreachable, using browser localStorage fallback');
    }
  }

  // --- LocalStorage Helpers (Fallback Mode) ---
  _lsGet(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  _lsSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  }

  // --- Notes API ---
  async getNotes(search = '', tag = '') {
    if (!this.useLocalStorage) {
      try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (tag) params.append('tag', tag);
        const res = await fetch(`/api/notes?${params.toString()}`);
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    // LocalStorage fallback
    let notes = this._lsGet(this.storageKeyNotes, []);
    if (search) {
      const q = search.toLowerCase();
      notes = notes.filter(n => n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q)));
    }
    if (tag) {
      notes = notes.filter(n => Array.isArray(n.tags) && n.tags.includes(tag));
    }
    notes.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.updated_at) - new Date(a.updated_at));
    return notes;
  }

  async createNote(note) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const notes = this._lsGet(this.storageKeyNotes, []);
    const newNote = {
      id: Date.now(),
      title: note.title || 'Untitled',
      content: note.content || '',
      tags: note.tags || [],
      color: note.color || '#ffffff',
      is_pinned: note.is_pinned ? 1 : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    notes.unshift(newNote);
    this._lsSet(this.storageKeyNotes, notes);
    return newNote;
  }

  async updateNote(id, note) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const notes = this._lsGet(this.storageKeyNotes, []);
    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) {
      notes[idx] = {
        ...notes[idx],
        ...note,
        updated_at: new Date().toISOString()
      };
      this._lsSet(this.storageKeyNotes, notes);
      return notes[idx];
    }
    return null;
  }

  async deleteNote(id) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    let notes = this._lsGet(this.storageKeyNotes, []);
    notes = notes.filter(n => n.id !== id);
    this._lsSet(this.storageKeyNotes, notes);
    return true;
  }

  // --- Checklist API ---
  async getChecklist(dateStr) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch(`/api/checklists?date=${dateStr}`);
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const items = this._lsGet(this.storageKeyChecklists, []);
    return items
      .filter(item => item.date === dateStr)
      .sort((a, b) => a.is_completed - b.is_completed || (a.order_index || 0) - (b.order_index || 0));
  }

  async addChecklistItem(item) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const items = this._lsGet(this.storageKeyChecklists, []);
    const newItem = {
      id: Date.now(),
      date: item.date,
      title: item.title,
      priority: item.priority || 'medium',
      category: item.category || 'general',
      order_index: items.filter(i => i.date === item.date).length + 1,
      is_completed: 0,
      created_at: new Date().toISOString(),
      completed_at: null
    };
    items.push(newItem);
    this._lsSet(this.storageKeyChecklists, items);
    return newItem;
  }

  async updateChecklistItem(id, updates) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch(`/api/checklists/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const items = this._lsGet(this.storageKeyChecklists, []);
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        ...updates
      };
      if (updates.is_completed !== undefined) {
        items[idx].completed_at = updates.is_completed ? new Date().toISOString() : null;
      }
      this._lsSet(this.storageKeyChecklists, items);
      return items[idx];
    }
    return null;
  }

  async deleteChecklistItem(id) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch(`/api/checklists/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    let items = this._lsGet(this.storageKeyChecklists, []);
    items = items.filter(i => i.id !== id);
    this._lsSet(this.storageKeyChecklists, items);
    return true;
  }

  async rolloverIncomplete(fromDate, toDate) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/checklists/rollover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from_date: fromDate, to_date: toDate })
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const items = this._lsGet(this.storageKeyChecklists, []);
    const incomplete = items.filter(i => i.date === fromDate && !i.is_completed);
    let added = 0;
    for (const inc of incomplete) {
      const exists = items.some(i => i.date === toDate && i.title === inc.title);
      if (!exists) {
        items.push({
          id: Date.now() + Math.random(),
          date: toDate,
          title: inc.title,
          priority: inc.priority,
          category: inc.category,
          order_index: items.filter(i => i.date === toDate).length + 1,
          is_completed: 0,
          created_at: new Date().toISOString(),
          completed_at: null
        });
        added++;
      }
    }
    this._lsSet(this.storageKeyChecklists, items);
    return { rolled_over: added };
  }

  async applyRecurringRoutines(targetDate) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/checklists/apply-routines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: targetDate })
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const routines = await this.getRoutines();
    const items = this._lsGet(this.storageKeyChecklists, []);
    let added = 0;
    for (const r of routines) {
      const exists = items.some(i => i.date === targetDate && i.title === r.title);
      if (!exists) {
        items.push({
          id: Date.now() + Math.random(),
          date: targetDate,
          title: r.title,
          priority: r.priority,
          category: r.category,
          order_index: items.filter(i => i.date === targetDate).length + 1,
          is_completed: 0,
          created_at: new Date().toISOString(),
          completed_at: null
        });
        added++;
      }
    }
    this._lsSet(this.storageKeyChecklists, items);
    return { added };
  }

  // --- Routines API ---
  async getRoutines() {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/routines');
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const defaultRoutines = [
      { id: 1, title: '🌅 Plan the top 3 priorities of the day', category: 'morning', priority: 'high' },
      { id: 2, title: '💧 Drink 2L of water throughout the day', category: 'health', priority: 'medium' },
      { id: 3, title: '🏃 20-minute movement / exercise', category: 'health', priority: 'medium' },
      { id: 4, title: '📥 Review inbox & pending messages', category: 'work', priority: 'low' },
      { id: 5, title: '🌙 Daily review & prep for tomorrow', category: 'evening', priority: 'medium' }
    ];
    return this._lsGet(this.storageKeyRoutines, defaultRoutines);
  }

  async addRoutine(routine) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/routines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(routine)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const routines = await this.getRoutines();
    const newRoutine = {
      id: Date.now(),
      title: routine.title,
      category: routine.category || 'routine',
      priority: routine.priority || 'medium',
      is_active: 1
    };
    routines.push(newRoutine);
    this._lsSet(this.storageKeyRoutines, routines);
    return newRoutine;
  }

  async deleteRoutine(id) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    let routines = await this.getRoutines();
    routines = routines.filter(r => r.id !== id);
    this._lsSet(this.storageKeyRoutines, routines);
    return true;
  }

  // --- Stats API ---
  async getStats() {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    const notes = this._lsGet(this.storageKeyNotes, []);
    const items = this._lsGet(this.storageKeyChecklists, []);
    const completed = items.filter(i => i.is_completed).length;

    return {
      total_notes: notes.length,
      total_tasks: items.length,
      completed_tasks: completed,
      streak_days: 1,
      last_7_days: []
    };
  }

  // --- Export / Import ---
  async exportData() {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/export');
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    return {
      version: 1,
      exported_at: new Date().toISOString(),
      notes: this._lsGet(this.storageKeyNotes, []),
      checklists: this._lsGet(this.storageKeyChecklists, []),
      recurring_routines: await this.getRoutines()
    };
  }

  async importData(data) {
    if (!this.useLocalStorage) {
      try {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.useLocalStorage = true;
      }
    }

    if (data.notes) this._lsSet(this.storageKeyNotes, data.notes);
    if (data.checklists) this._lsSet(this.storageKeyChecklists, data.checklists);
    if (data.recurring_routines) this._lsSet(this.storageKeyRoutines, data.recurring_routines);
    return { notes_imported: data.notes?.length || 0, checklists_imported: data.checklists?.length || 0 };
  }
}

window.api = new NoteChecklistAPI();
