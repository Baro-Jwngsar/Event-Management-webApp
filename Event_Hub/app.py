from dotenv import load_dotenv
load_dotenv()
import os
import sqlite3
import csv
import io
from datetime import date
from flask import Flask, render_template, request, redirect, url_for, session, flash, make_response, jsonify

app = Flask(__name__)


app.secret_key = os.environ.get('SECRET_KEY', 'default-secret-key')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

@app.context_processor
def inject_csrf():
    return dict(csrf_token=lambda: "dummy-csrf-token")

DATABASE = "database.db"

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_column(conn, table, column, definition):
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [col["name"] for col in cursor.fetchall()]
    if column not in columns:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        conn.commit()

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            capacity INTEGER DEFAULT 0,
            venue TEXT,
            address TEXT,
            audience TEXT,
            info TEXT,
            image TEXT NOT NULL DEFAULT ''
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            event_title TEXT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            role TEXT,
            seats INTEGER DEFAULT 1,
            message TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    ensure_column(conn, "events", "image", "TEXT NOT NULL DEFAULT ''")
    ensure_column(conn, "registrations", "event_title", "TEXT")
    ensure_column(conn, "registrations", "status", "TEXT DEFAULT 'pending'")
    conn.close()

init_db()

def clean(val, max_len=200):
    if not val:
        return ""
    return str(val).strip()[:max_len]

def read_event_form(form):
    title = clean(form.get("title"), 120)
    date_val = clean(form.get("date"), 20)
    time_val = clean(form.get("time"), 20)
    try:
        capacity = int(form.get("capacity", 0))
    except ValueError:
        capacity = 0
    venue = clean(form.get("venue"), 120)
    address = clean(form.get("address"), 200)
    audience_list = form.getlist("audience")
    audience = ",".join([clean(a, 30) for a in audience_list if a])
    info = clean(form.get("info"), 500)
    image = clean(form.get("image"), 255)
    return {
        "title": title,
        "date": date_val,
        "time": time_val,
        "capacity": capacity,
        "venue": venue,
        "address": address,
        "audience": audience,
        "info": info,
        "image": image
    }

@app.route('/')
def index():
    host_data = {
        'phone': '+91 XXXXXXXXXX',
        'email': 'host@eventhub.local',
        'hours': 'Mon-Sat, 10 am - 6 pm'
    }
    
    venue_data = {
        'place': 'University Auditorium',
        'address': 'Main Campus, Assam down town University, Guwahati, Assam',
        'map_link': 'https://maps.app.goo.gl/6eEy742Pdp4DW6zC6'
    }

    return render_template('index.html', host=host_data, venue=venue_data)

@app.route("/api/events")
def api_events():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY date ASC")
    events = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT event_id, SUM(seats) as total_seats FROM registrations WHERE status != 'rejected' GROUP BY event_id")
    taken = {row["event_id"]: row["total_seats"] or 0 for row in cursor.fetchall()}
    conn.close()

    for e in events:
        e["taken"] = taken.get(e["id"], 0)
    return jsonify(events)

@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.json or request.form
    event_id = data.get("event_id")
    name = clean(data.get("name"), 100)
    phone = clean(data.get("phone"), 20)
    email = clean(data.get("email"), 120)
    role = clean(data.get("role"), 50)
    try:
        seats = int(data.get("seats", 1))
    except ValueError:
        seats = 1
    message = clean(data.get("message"), 300)

    if not name or not phone or not event_id:
        return jsonify({"success": False, "error": "Name, phone and event are required."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        conn.close()
        return jsonify({"success": False, "error": "Event not found."}), 404

    cursor.execute("""
        INSERT INTO registrations (event_id, event_title, name, phone, email, role, seats, message, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    """, (event["id"], event["title"], name, phone, email, role, seats, message))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Registration successful! Waiting for host confirmation."})

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if session.get("admin_logged_in"):
        return redirect(url_for("admin_dashboard"))
        
    if request.method == "POST":
        password = request.form.get("password", "")
        
        if password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            flash("Logged in successfully.", "ok")
            return redirect(url_for("admin_dashboard"))
        else:
            flash("Incorrect password.", "err")
            
    return render_template("admin_login.html")

@app.route("/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("admin_logged_in", None)
    flash("Logged out successfully.", "ok")
    return redirect(url_for("admin_login"))

@app.route("/admin")
def admin_dashboard():
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY date ASC")
    events = cursor.fetchall()
    cursor.execute("SELECT * FROM registrations ORDER BY id DESC")
    regs = cursor.fetchall()
    cursor.execute("SELECT event_id, SUM(seats) as total_seats FROM registrations WHERE status != 'rejected' GROUP BY event_id")
    taken = {row["event_id"]: row["total_seats"] or 0 for row in cursor.fetchall()}
    conn.close()
    
    audiences = ["Students", "Teachers", "Public", "Parents", "Alumni"]
    today_str = date.today().isoformat()
    default_pass = (ADMIN_PASSWORD == 'securepassword123')
    
    return render_template("admin.html", events=events, regs=regs, taken=taken, audiences=audiences, today=today_str, default_password=default_pass)

@app.route("/admin/event/add", methods=["POST"])
def admin_add_event():
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    data = read_event_form(request.form)
    if not data["title"] or not data["date"]:
        flash("Title and Date are required.", "err")
        return redirect(url_for("admin_dashboard"))
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO events (title, date, time, capacity, venue, address, audience, info, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (data["title"], data["date"], data["time"], data["capacity"], data["venue"], data["address"], data["audience"], data["info"], data["image"]))
    conn.commit()
    conn.close()
    flash("Event added successfully.", "ok")
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/event/edit/<int:ev_id>", methods=["POST"])
def admin_edit_event(ev_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    data = read_event_form(request.form)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE events SET title=?, date=?, time=?, capacity=?, venue=?, address=?, audience=?, info=?, image=?
        WHERE id=?
    """, (data["title"], data["date"], data["time"], data["capacity"], data["venue"], data["address"], data["audience"], data["info"], data["image"], ev_id))
    conn.commit()
    conn.close()
    flash("Event updated successfully.", "ok")
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/event/delete/<int:ev_id>", methods=["POST"])
def admin_delete_event(ev_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events WHERE id = ?", (ev_id,))
    cursor.execute("DELETE FROM registrations WHERE event_id = ?", (ev_id,))
    conn.commit()
    conn.close()
    flash("Event deleted.", "ok")
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/reg/confirm/<int:reg_id>", methods=["POST"])
def admin_confirm_registration(reg_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE registrations SET status = 'confirmed' WHERE id = ?", (reg_id,))
    conn.commit()
    conn.close()
    flash("Registration confirmed.", "ok")
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/reg/reject/<int:reg_id>", methods=["POST"])
def admin_reject_registration(reg_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE registrations SET status = 'rejected' WHERE id = ?", (reg_id,))
    conn.commit()
    conn.close()
    flash("Registration rejected.", "err")
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/reg/delete/<int:reg_id>", methods=["POST"])
def admin_delete_registration(reg_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM registrations WHERE id = ?", (reg_id,))
    conn.commit()
    conn.close()
    flash("Registration deleted.", "ok")
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/csv")
def admin_csv():
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM registrations ORDER BY id DESC")
    regs = cursor.fetchall()
    conn.close()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Event", "Name", "Phone", "Email", "Role", "Seats", "Message", "Status", "Date"])
    for r in regs:
        writer.writerow([r["id"], r["event_title"], r["name"], r["phone"], r["email"], r["role"], r["seats"], r["message"], r["status"], r["created_at"]])
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=registrations.csv"
    response.headers["Content-Type"] = "text/csv"
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)