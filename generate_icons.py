import zlib
import struct
import os

def create_app_icon(size, filename):
    # Create an image buffer: RGBA
    pixels = bytearray(size * size * 4)

    center = size / 2.0
    corner_radius = size * 0.22

    # Draw rounded square with border and stylish Nothing OS inspired checklist icon
    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4

            # Compute distance to rounded rectangle boundary
            dx = max(abs(x - center) - (center - corner_radius), 0)
            dy = max(abs(y - center) - (center - corner_radius), 0)
            dist = (dx * dx + dy * dy) ** 0.5

            if dist > corner_radius:
                # Transparent outside rounded rect
                pixels[idx:idx+4] = b'\x00\x00\x00\x00'
                continue

            # Background: Deep sleek black/dark slate
            r, g, b, a = 17, 24, 39, 255 # #111827

            # Subtle outer border
            if dist > corner_radius - 2:
                r, g, b = 55, 65, 81

            # Draw a clipboard / notepad shape in the center
            pad_left = size * 0.28
            pad_right = size * 0.72
            pad_top = size * 0.26
            pad_bottom = size * 0.76

            # Inner notepad
            if pad_left <= x <= pad_right and pad_top <= y <= pad_bottom:
                r, g, b = 255, 255, 255

                # Clipboard top clip
                if y <= pad_top + size * 0.08:
                    if x < size * 0.40 or x > size * 0.60:
                        r, g, b = 243, 244, 246
                    else:
                        r, g, b = 37, 99, 235 # Blue clip

                # Checklist lines / checkboxes
                line_y1 = pad_top + size * 0.16
                line_y2 = pad_top + size * 0.28
                line_y3 = pad_top + size * 0.40

                # Checkbox 1 (Checked with blue)
                if abs(y - line_y1) <= size * 0.025 and pad_left + size * 0.06 <= x <= pad_left + size * 0.11:
                    r, g, b = 16, 185, 129 # Emerald check
                elif abs(y - line_y1) <= size * 0.012 and pad_left + size * 0.14 <= x <= pad_right - size * 0.08:
                    r, g, b = 156, 163, 175 # Gray text line

                # Checkbox 2
                if abs(y - line_y2) <= size * 0.025 and pad_left + size * 0.06 <= x <= pad_left + size * 0.11:
                    r, g, b = 16, 185, 129
                elif abs(y - line_y2) <= size * 0.012 and pad_left + size * 0.14 <= x <= pad_right - size * 0.12:
                    r, g, b = 156, 163, 175

                # Checkbox 3 (Pending)
                if abs(y - line_y3) <= size * 0.025 and pad_left + size * 0.06 <= x <= pad_left + size * 0.11:
                    r, g, b = 209, 213, 219
                elif abs(y - line_y3) <= size * 0.012 and pad_left + size * 0.14 <= x <= pad_right - size * 0.06:
                    r, g, b = 156, 163, 175

            # Nothing-style signature red accent dot in top right
            dot_cx = size * 0.78
            dot_cy = size * 0.22
            dot_rad = size * 0.045
            if ((x - dot_cx)**2 + (y - dot_cy)**2) <= dot_rad**2:
                r, g, b, a = 239, 68, 68, 255 # #ef4444 Nothing red accent

            pixels[idx:idx+4] = bytes([r, g, b, a])

    # Convert to PNG format with filter byte 0
    raw_lines = bytearray()
    row_bytes = size * 4
    for y in range(size):
        raw_lines.append(0) # None filter
        raw_lines.extend(pixels[y * row_bytes : (y + 1) * row_bytes])

    compressed = zlib.compress(bytes(raw_lines))

    def chunk(chunk_type, data):
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xffffffff)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")

    with open(filename, "wb") as f:
        f.write(png)
    print(f"Created {filename} ({size}x{size})")

out_dir = os.path.join(os.path.dirname(__file__), 'static', 'icons')
os.makedirs(out_dir, exist_ok=True)
create_app_icon(192, os.path.join(out_dir, 'icon-192.png'))
create_app_icon(512, os.path.join(out_dir, 'icon-512.png'))
