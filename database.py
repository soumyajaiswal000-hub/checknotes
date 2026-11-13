import sqlite3
import os
import json
from datetime import datetime, date, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'notes_checklist.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Notes Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            tags TEXT DEFAULT '[]', -- JSON array of strings
            color TEXT DEFAULT '#ffffff',
            is_pinned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Checklists Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS checklists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL, -- YYYY-MM-DD
            title TEXT NOT NULL,
            is_completed INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'medium', -- low, medium, high
            category TEXT DEFAULT 'general',
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    ''')

    # Recurring Daily Routines Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recurring_routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT DEFAULT 'routine',
            priority TEXT DEFAULT 'medium',
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # App Settings Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')

    # Create Indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_checklists_date ON checklists(date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned DESC)')

    # Seed default recurring routines if table is empty
    cursor.execute('SELECT COUNT(*) FROM recurring_routines')
    if cursor.fetchone()[0] == 0:
        default_routines = [
            ("🌅 Plan the top 3 priorities of the day", "morning", "high"),
            ("💧 Drink 2L of water throughout the day", "health", "medium"),
            ("🏃 20-minute movement / exercise", "health", "medium"),
            ("📥 Review inbox & pending messages", "work", "low"),
            ("🌙 Daily review & prep for tomorrow", "evening", "medium")
        ]
        cursor.executemany(
            'INSERT INTO recurring_routines (title, category, priority) VALUES (?, ?, ?)',
            default_routines
        )

    # Seed welcome note if notes table is empty
    cursor.execute('SELECT COUNT(*) FROM notes')
    if cursor.fetchone()[0] == 0:
        welcome_title = "👋 Welcome to your Notes & Daily Checklist App!"
        welcome_content = """# Welcome to Your Personal Workspace! 🚀

This app seamlessly combines **daily checklist task management** with a **rich note-taking system**.

### 🌟 Key Features:
- **Daily Checklist**: Track your tasks by day, set priorities (High, Medium, Low), and watch your progress bar fill up.
- **Habits & Daily Routines**: Quickly apply your recurring morning or evening routines with a single click.
- **Task Rollover**: Didn't finish everything yesterday? Click **"Rollover Incomplete"** to bring them into today!
- **Rich Markdown Notes**: Format headers, bullet points, checklists, code blocks, and blockquotes.
- **Tags & Colors**: Organize your notes with custom color coding and interactive tag filtering.
- **Search & Quick Navigation**: Fast search across all your notes and daily tasks.
- **Streaks & Progress**: Track your daily completion consistency!

Enjoy organizing your days and capturing your thoughts effortlessly! ✨
"""
        cursor.execute(
            'INSERT INTO notes (title, content, tags, color, is_pinned) VALUES (?, ?, ?, ?, ?)',
            (welcome_title, welcome_content, json.dumps(["welcome", "guide"]), "#fef08a", 1)
        )

    conn.commit()
    conn.close()

# ----------------- Notes Operations -----------------

def get_notes(search=None, tag=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM notes WHERE 1=1"
    params = []

    if search:
        query += " AND (title LIKE ? OR content LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    
    if tag:
        query += " AND tags LIKE ?"
        params.append(f"%\"{tag}\"%")

    query += " ORDER BY is_pinned DESC, updated_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    notes = []
    for r in rows:
        d = dict(r)
        try:
            d['tags'] = json.loads(d['tags']) if d['tags'] else []
        except Exception:
            d['tags'] = []
        notes.append(d)
    conn.close()
    return notes

def get_note_by_id(note_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        d = dict(row)
        try:
            d['tags'] = json.loads(d['tags']) if d['tags'] else []
        except Exception:
            d['tags'] = []
        return d
    return None

def create_note(title, content, tags=None, color='#ffffff', is_pinned=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    tags_json = json.dumps(tags if isinstance(tags, list) else [])
    now = datetime.now().isoformat()
    cursor.execute('''
        INSERT INTO notes (title, content, tags, color, is_pinned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (title, content, tags_json, color, 1 if is_pinned else 0, now, now))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_note_by_id(new_id)

def update_note(note_id, title=None, content=None, tags=None, color=None, is_pinned=None):
    existing = get_note_by_id(note_id)
    if not existing:
        return None
    
    new_title = title if title is not None else existing['title']
    new_content = content if content is not None else existing['content']
    new_tags = json.dumps(tags if isinstance(tags, list) else existing['tags'])
    new_color = color if color is not None else existing['color']
    new_pinned = 1 if (is_pinned if is_pinned is not None else existing['is_pinned']) else 0
    now = datetime.now().isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE notes
        SET title = ?, content = ?, tags = ?, color = ?, is_pinned = ?, updated_at = ?
        WHERE id = ?
    ''', (new_title, new_content, new_tags, new_color, new_pinned, now, note_id))
    conn.commit()
    conn.close()
    return get_note_by_id(note_id)

def delete_note(note_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# ----------------- Checklist Operations -----------------

def get_checklist_for_date(date_str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM checklists 
        WHERE date = ? 
        ORDER BY is_completed ASC, order_index ASC, id ASC
    ''', (date_str,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_checklist_item(date_str, title, priority='medium', category='general'):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get max order index for date
    cursor.execute('SELECT MAX(order_index) FROM checklists WHERE date = ?', (date_str,))
    max_order = cursor.fetchone()[0]
    next_order = 1 if max_order is None else max_order + 1

    cursor.execute('''
        INSERT INTO checklists (date, title, priority, category, order_index, is_completed)
        VALUES (?, ?, ?, ?, ?, 0)
    ''', (date_str, title.strip(), priority, category, next_order))
    new_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute('SELECT * FROM checklists WHERE id = ?', (new_id,))
    item = dict(cursor.fetchone())
    conn.close()
    return item

def update_checklist_item(item_id, title=None, is_completed=None, priority=None, category=None, order_index=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM checklists WHERE id = ?', (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    item = dict(row)

    new_title = title if title is not None else item['title']
    new_priority = priority if priority is not None else item['priority']
    new_category = category if category is not None else item['category']
    new_order = order_index if order_index is not None else item['order_index']
    
    completed_at = item['completed_at']
    if is_completed is not None:
        new_completed = 1 if is_completed else 0
        if new_completed and not item['is_completed']:
            completed_at = datetime.now().isoformat()
        elif not new_completed:
            completed_at = None
    else:
        new_completed = item['is_completed']

    cursor.execute('''
        UPDATE checklists
        SET title = ?, is_completed = ?, priority = ?, category = ?, order_index = ?, completed_at = ?
        WHERE id = ?
    ''', (new_title, new_completed, new_priority, new_category, new_order, completed_at, item_id))
    conn.commit()

    cursor.execute('SELECT * FROM checklists WHERE id = ?', (item_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return updated

def delete_checklist_item(item_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM checklists WHERE id = ?', (item_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def reorder_checklist_items(date_str, item_ids):
    conn = get_db_connection()
    cursor = conn.cursor()
    for idx, item_id in enumerate(item_ids):
        cursor.execute('UPDATE checklists SET order_index = ? WHERE id = ? AND date = ?', (idx, item_id, date_str))
    conn.commit()
    conn.close()
    return get_checklist_for_date(date_str)

def rollover_incomplete_tasks(from_date, to_date):
    """Copies or moves incomplete tasks from from_date to to_date."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT title, priority, category FROM checklists
        WHERE date = ? AND is_completed = 0
    ''', (from_date,))
    incomplete = cursor.fetchall()

    added = 0
    for row in incomplete:
        # Check if already present in to_date to avoid duplicate rollover
        cursor.execute('''
            SELECT id FROM checklists WHERE date = ? AND title = ?
        ''', (to_date, row['title']))
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO checklists (date, title, priority, category, is_completed)
                VALUES (?, ?, ?, ?, 0)
            ''', (to_date, row['title'], row['priority'], row['category']))
            added += 1

    conn.commit()
    conn.close()
    return {"rolled_over": added}

def apply_recurring_routines(target_date):
    """Applies recurring routines to the given target date if not already present."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT title, category, priority FROM recurring_routines WHERE is_active = 1')
    routines = cursor.fetchall()
    
    added = 0
    for r in routines:
        cursor.execute('SELECT id FROM checklists WHERE date = ? AND title = ?', (target_date, r['title']))
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO checklists (date, title, priority, category, is_completed)
                VALUES (?, ?, ?, ?, 0)
            ''', (target_date, r['title'], r['priority'], r['category']))
            added += 1

    conn.commit()
    conn.close()
    return {"added": added}

# ----------------- Recurring Routines Operations -----------------

def get_recurring_routines():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM recurring_routines ORDER BY id ASC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_recurring_routine(title, category='routine', priority='medium'):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO recurring_routines (title, category, priority, is_active)
        VALUES (?, ?, ?, 1)
    ''', (title.strip(), category, priority))
    new_id = cursor.lastrowid
    conn.commit()
    cursor.execute('SELECT * FROM recurring_routines WHERE id = ?', (new_id,))
    item = dict(cursor.fetchone())
    conn.close()
    return item

def delete_recurring_routine(routine_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM recurring_routines WHERE id = ?', (routine_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# ----------------- Stats & Streaks -----------------

def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Note count
    cursor.execute('SELECT COUNT(*) FROM notes')
    total_notes = cursor.fetchone()[0]

    # Checklist overall
    cursor.execute('SELECT COUNT(*), SUM(is_completed) FROM checklists')
    row = cursor.fetchone()
    total_tasks = row[0] or 0
    completed_tasks = row[1] or 0

    # Calculate streak (days with at least 1 completed task)
    today = date.today()
    current_streak = 0
    check_date = today

    # Check up to past 365 days
    for i in range(365):
        d_str = check_date.strftime('%Y-%m-%d')
        cursor.execute('SELECT COUNT(*) FROM checklists WHERE date = ? AND is_completed = 1', (d_str,))
        count = cursor.fetchone()[0]
        if count > 0:
            current_streak += 1
            check_date -= timedelta(days=1)
        else:
            # If today has 0 completed, we check if yesterday had completed tasks before breaking streak
            if i == 0:
                check_date -= timedelta(days=1)
                continue
            break

    # Last 7 days breakdown
    last_7_days = []
    for offset in range(6, -1, -1):
        d = today - timedelta(days=offset)
        d_str = d.strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT COUNT(*), SUM(is_completed) FROM checklists WHERE date = ?
        ''', (d_str,))
        r = cursor.fetchone()
        tot = r[0] or 0
        comp = r[1] or 0
        last_7_days.append({
            "date": d_str,
            "day": d.strftime('%a'),
            "total": tot,
            "completed": comp,
            "percentage": round((comp / tot * 100) if tot > 0 else 0)
        })

    conn.close()
    return {
        "total_notes": total_notes,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "streak_days": current_streak,
        "last_7_days": last_7_days
    }

# ----------------- Export / Import -----------------

def export_all():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM notes')
    notes = [dict(r) for r in cursor.fetchall()]
    cursor.execute('SELECT * FROM checklists')
    checklists = [dict(r) for r in cursor.fetchall()]
    cursor.execute('SELECT * FROM recurring_routines')
    routines = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return {
        "version": 1,
        "exported_at": datetime.now().isoformat(),
        "notes": notes,
        "checklists": checklists,
        "recurring_routines": routines
    }

def import_all(data):
    conn = get_db_connection()
    cursor = conn.cursor()

    imported_notes = 0
    imported_checklists = 0

    if 'notes' in data and isinstance(data['notes'], list):
        for n in data['notes']:
            cursor.execute('''
                INSERT INTO notes (title, content, tags, color, is_pinned, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (n.get('title', 'Untitled'), n.get('content', ''), json.dumps(n.get('tags', [])),
                  n.get('color', '#ffffff'), n.get('is_pinned', 0),
                  n.get('created_at', datetime.now().isoformat()),
                  n.get('updated_at', datetime.now().isoformat())))
            imported_notes += 1

    if 'checklists' in data and isinstance(data['checklists'], list):
        for c in data['checklists']:
            cursor.execute('''
                INSERT INTO checklists (date, title, is_completed, priority, category, order_index, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (c.get('date', date.today().isoformat()), c.get('title', ''), c.get('is_completed', 0),
                  c.get('priority', 'medium'), c.get('category', 'general'), c.get('order_index', 0),
                  c.get('created_at', datetime.now().isoformat()), c.get('completed_at')))
            imported_checklists += 1

    conn.commit()
    conn.close()
    return {"notes_imported": imported_notes, "checklists_imported": imported_checklists}
