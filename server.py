import http.server
import socketserver
import urllib.parse
import json
import os
import sys
import mimetypes
from datetime import date, datetime

# Ensure our local directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

import database

database.init_db()

STATIC_DIR = os.path.join(CURRENT_DIR, 'static')

class NoteChecklistHandler(http.server.BaseHTTPRequestHandler):
    
    def _send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, message, status=400):
        self._send_json({"error": message}, status=status)

    def _read_json(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}
            raw_data = self.rfile.read(content_length).decode('utf-8')
            return json.loads(raw_data)
        except Exception as e:
            return None

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        # API Routes
        if path.startswith('/api/'):
            if path == '/api/notes':
                search = query.get('search', [None])[0]
                tag = query.get('tag', [None])[0]
                notes = database.get_notes(search=search, tag=tag)
                self._send_json(notes)
                return

            elif path.startswith('/api/notes/'):
                note_id = path[len('/api/notes/'):]
                if note_id.isdigit():
                    note = database.get_note_by_id(int(note_id))
                    if note:
                        self._send_json(note)
                    else:
                        self._send_error("Note not found", 404)
                    return

            elif path == '/api/checklists':
                target_date = query.get('date', [date.today().isoformat()])[0]
                items = database.get_checklist_for_date(target_date)
                self._send_json(items)
                return

            elif path == '/api/routines':
                routines = database.get_recurring_routines()
                self._send_json(routines)
                return

            elif path == '/api/stats':
                stats = database.get_stats()
                self._send_json(stats)
                return

            elif path == '/api/export':
                data = database.export_all()
                self._send_json(data)
                return

            self._send_error("API endpoint not found", 404)
            return

        # Static File Serving
        clean_path = path.lstrip('/')
        if clean_path == '' or clean_path == 'index.html':
            filepath = os.path.join(STATIC_DIR, 'index.html')
        else:
            filepath = os.path.join(STATIC_DIR, clean_path)

        # Normalize and prevent directory traversal
        filepath = os.path.normpath(filepath)
        if not filepath.startswith(STATIC_DIR) or not os.path.isfile(filepath):
            # Fallback to index.html for SPA if not an asset
            if not any(clean_path.endswith(ext) for ext in ['.js', '.css', '.svg', '.png', '.jpg', '.ico', '.json']):
                filepath = os.path.join(STATIC_DIR, 'index.html')
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"404 Not Found")
                return

        mime_type, _ = mimetypes.guess_type(filepath)
        if not mime_type:
            mime_type = 'application/octet-stream'

        try:
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', f'{mime_type}; charset=utf-8' if 'text' in mime_type or 'javascript' in mime_type else mime_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Error loading file: {str(e)}".encode('utf-8'))

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        payload = self._read_json()
        if payload is None:
            self._send_error("Invalid JSON body", 400)
            return

        if path == '/api/notes':
            title = payload.get('title', 'Untitled')
            content = payload.get('content', '')
            tags = payload.get('tags', [])
            color = payload.get('color', '#ffffff')
            is_pinned = payload.get('is_pinned', False)
            created = database.create_note(title, content, tags, color, is_pinned)
            self._send_json(created, 201)
            return

        elif path == '/api/checklists':
            target_date = payload.get('date', date.today().isoformat())
            title = payload.get('title', '').strip()
            if not title:
                self._send_error("Title is required", 400)
                return
            priority = payload.get('priority', 'medium')
            category = payload.get('category', 'general')
            item = database.add_checklist_item(target_date, title, priority, category)
            self._send_json(item, 201)
            return

        elif path == '/api/checklists/reorder':
            target_date = payload.get('date', date.today().isoformat())
            item_ids = payload.get('item_ids', [])
            updated_list = database.reorder_checklist_items(target_date, item_ids)
            self._send_json(updated_list)
            return

        elif path == '/api/checklists/rollover':
            from_date = payload.get('from_date')
            to_date = payload.get('to_date', date.today().isoformat())
            if not from_date:
                self._send_error("from_date is required", 400)
                return
            result = database.rollover_incomplete_tasks(from_date, to_date)
            self._send_json(result)
            return

        elif path == '/api/checklists/apply-routines':
            target_date = payload.get('date', date.today().isoformat())
            result = database.apply_recurring_routines(target_date)
            self._send_json(result)
            return

        elif path == '/api/routines':
            title = payload.get('title', '').strip()
            if not title:
                self._send_error("Title is required", 400)
                return
            category = payload.get('category', 'routine')
            priority = payload.get('priority', 'medium')
            item = database.add_recurring_routine(title, category, priority)
            self._send_json(item, 201)
            return

        elif path == '/api/import':
            result = database.import_all(payload)
            self._send_json(result)
            return

        self._send_error("Endpoint not found", 404)

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        payload = self._read_json()
        if payload is None:
            self._send_error("Invalid JSON body", 400)
            return

        if path.startswith('/api/notes/'):
            note_id = path[len('/api/notes/'):]
            if note_id.isdigit():
                updated = database.update_note(
                    int(note_id),
                    title=payload.get('title'),
                    content=payload.get('content'),
                    tags=payload.get('tags'),
                    color=payload.get('color'),
                    is_pinned=payload.get('is_pinned')
                )
                if updated:
                    self._send_json(updated)
                else:
                    self._send_error("Note not found", 404)
                return

        elif path.startswith('/api/checklists/'):
            item_id = path[len('/api/checklists/'):]
            if item_id.isdigit():
                updated = database.update_checklist_item(
                    int(item_id),
                    title=payload.get('title'),
                    is_completed=payload.get('is_completed'),
                    priority=payload.get('priority'),
                    category=payload.get('category'),
                    order_index=payload.get('order_index')
                )
                if updated:
                    self._send_json(updated)
                else:
                    self._send_error("Checklist item not found", 404)
                return

        self._send_error("Endpoint not found", 404)

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path.startswith('/api/notes/'):
            note_id = path[len('/api/notes/'):]
            if note_id.isdigit():
                deleted = database.delete_note(int(note_id))
                if deleted:
                    self._send_json({"deleted": True, "id": int(note_id)})
                else:
                    self._send_error("Note not found", 404)
                return

        elif path.startswith('/api/checklists/'):
            item_id = path[len('/api/checklists/'):]
            if item_id.isdigit():
                deleted = database.delete_checklist_item(int(item_id))
                if deleted:
                    self._send_json({"deleted": True, "id": int(item_id)})
                else:
                    self._send_error("Checklist item not found", 404)
                return

        elif path.startswith('/api/routines/'):
            routine_id = path[len('/api/routines/'):]
            if routine_id.isdigit():
                deleted = database.delete_recurring_routine(int(routine_id))
                if deleted:
                    self._send_json({"deleted": True, "id": int(routine_id)})
                else:
                    self._send_error("Routine not found", 404)
                return

        self._send_error("Endpoint not found", 404)

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} - {args[1]} {args[2]}\n")

def run_server(port=8080):
    handler = NoteChecklistHandler
    max_retries = 10
    current_port = port

    for _ in range(max_retries):
        try:
            with socketserver.TCPServer(("", current_port), handler) as httpd:
                print(f"======================================================")
                print(f" ✨ Notes & Daily Checklist App is running!          ")
                print(f" 🌐 Open in browser: http://localhost:{current_port} ")
                print(f" 📁 Local workspace: {CURRENT_DIR}                   ")
                print(f" Press Ctrl+C to stop the server                      ")
                print(f"======================================================")
                sys.stdout.flush()
                httpd.serve_forever()
                break
        except OSError as e:
            if "Address already in use" in str(e):
                current_port += 1
            else:
                raise e

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8080
    run_server(port)
