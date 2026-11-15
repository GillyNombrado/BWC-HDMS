"""
==============================================================================
Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
Capstone Project - CMSC 309
Backend Server: Python / Flask with Embedded SQLite Database & Flask-Migrate
==============================================================================
This module provides the local offline RESTful API and static web server for
the BWC-HDMS portal. It handles data persistence for Target Client Registry
(TCR), Consultations, Medicine Inventory, Monthly Schedule System, and User
Authentication with password hashing and audit logging.
==============================================================================
"""

import os
import json
import re
import random
import sqlite3
from datetime import datetime, date, timedelta
from flask import Flask, request, jsonify, send_from_directory, g, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_migrate import Migrate

# Import SQLAlchemy database and models
from models import (
    db, User, Patient, Inventory, InventoryItem,
    Appointment, AuditLog, ActivityLog, Vital, Dispensation
)

# --------------------------------------------------------------------------
# Flask Application Setup & Configuration
# --------------------------------------------------------------------------
app = Flask(__name__, static_folder=".", static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "bwc-hdms-offline-secret-key-2026")

# Embedded SQLite Database Configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, "bwc_hdms.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize Flask-SQLAlchemy and Flask-Migrate
db.init_app(app)
migrate = Migrate(app, db)


# --------------------------------------------------------------------------
# Cross-Origin Resource Sharing (CORS) & Browser Compatibility
# --------------------------------------------------------------------------
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = app.make_default_options_response()
        res.headers["Access-Control-Allow-Origin"] = "*"
        res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Username, X-User-Id, X-Purok"
        return res


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Username, X-User-Id, X-Purok"
    return response


# --------------------------------------------------------------------------
# Database Connection Helpers (Direct SQLite Execution)
# --------------------------------------------------------------------------
def get_db():
    """Opens a new database connection if there is none for the current request."""
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row  # Return rows as dict-like objects
    return g.db


@app.teardown_appcontext
def close_db(error):
    """Closes the database again at the end of the request."""
    if hasattr(g, "db"):
        g.db.close()


def query_db(query, args=(), one=False):
    """Helper to query database and return dictionary rows."""
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]


def execute_db(query, args=()):
    """Helper to execute write operations and commit."""
    db_conn = get_db()
    cur = db_conn.execute(query, args)
    db_conn.commit()
    last_id = cur.lastrowid
    cur.close()
    return last_id


def log_audit_event(user_id, action, details=None):
    """Helper to log critical operations into the audit_logs table."""
    try:
        execute_db("""
            INSERT INTO audit_logs (user_id, action, details)
            VALUES (?, ?, ?)
        """, (user_id, action, details))
    except Exception as err:
        print(f"[Audit Log Error] {err}")


# --------------------------------------------------------------------------
# Database Initialization (Schema Creation - Clean Zero State)
# --------------------------------------------------------------------------
def init_db():
    """Initializes tables cleanly without injecting mock or seed data."""
    with app.app_context():
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        # 1. Target Client Registry (Patients) Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                handler_id TEXT,
                name TEXT NOT NULL,
                first_name TEXT,
                middle_name TEXT,
                last_name TEXT,
                dob TEXT,
                age INTEGER,
                sex TEXT,
                contact TEXT,
                contact_number TEXT,
                purok TEXT,
                address TEXT,
                condition TEXT,
                diagnosis_date TEXT,
                ph_id TEXT,
                last_visit TEXT,
                risk_level TEXT DEFAULT 'Moderate',
                emergency_contact_name TEXT,
                emergency_contact_relationship TEXT,
                emergency_contact_number TEXT,
                government_programs TEXT,
                allergies TEXT,
                health_risks TEXT,
                medical_history TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (handler_id) REFERENCES users(id) ON DELETE SET NULL
            )
        """)

        # Upgrade/migrate patients table schema if missing new form fields
        try:
            cursor.execute("PRAGMA table_info(patients)")
            existing_cols = {col[1] for col in cursor.fetchall()}
            
            columns_to_add = [
                ("handler_id", "TEXT"),
                ("first_name", "TEXT"),
                ("middle_name", "TEXT"),
                ("last_name", "TEXT"),
                ("dob", "TEXT"),
                ("age", "INTEGER"),
                ("sex", "TEXT"),
                ("contact", "TEXT"),
                ("contact_number", "TEXT"),
                ("purok", "TEXT"),
                ("address", "TEXT"),
                ("condition", "TEXT"),
                ("diagnosis_date", "TEXT"),
                ("ph_id", "TEXT"),
                ("last_visit", "TEXT"),
                ("risk_level", "TEXT DEFAULT 'Moderate'"),
                ("emergency_contact_name", "TEXT"),
                ("emergency_contact_relationship", "TEXT"),
                ("emergency_contact_number", "TEXT"),
                ("government_programs", "TEXT"),
                ("allergies", "TEXT"),
                ("health_risks", "TEXT"),
                ("medical_history", "TEXT")
            ]
            for col_name, col_def in columns_to_add:
                if col_name not in existing_cols:
                    cursor.execute(f"ALTER TABLE patients ADD COLUMN {col_name} {col_def}")

            # If handler_id is null, link from assigned_bhw or purok
            if "assigned_bhw" in existing_cols and "handler_id" in existing_cols:
                cursor.execute("""
                    UPDATE patients 
                    SET handler_id = (SELECT id FROM users WHERE LOWER(users.username) = LOWER(patients.assigned_bhw) LIMIT 1)
                    WHERE (handler_id IS NULL OR handler_id = '') AND assigned_bhw IS NOT NULL
                """)
        except Exception as mig_err:
            print(f"[Patient Schema Migration Notice] {mig_err}")

        # 2. Consultations & Vitals Ledger Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS consultations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_name TEXT NOT NULL,
                sys_bp INTEGER,
                dia_bp INTEGER,
                glucose INTEGER,
                weight REAL,
                height REAL,
                bmi_result TEXT,
                risk_level TEXT,
                remarks TEXT,
                consult_date TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 3. Monthly Appointments & Schedule Table (with strict Foreign Keys)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER,
                user_id TEXT,
                patient_name TEXT NOT NULL,
                category TEXT NOT NULL,      -- 'Monthly HPN Check', 'Diabetes Follow-up', 'Medicine Refill', 'Purok Assembly'
                scheduled_date TEXT NOT NULL, -- ISO 'YYYY-MM-DD'
                purok TEXT,
                remarks TEXT,
                status TEXT DEFAULT 'Pending', -- 'Pending', 'Completed', 'Defaulted'
                completed_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        """)

        # 4. Medicine Inventory Table (with Expiration Date for shelf-life tracking)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                category TEXT DEFAULT 'Antihypertensive',
                batch_no TEXT,
                dosage TEXT,
                current_stock INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'tabs',
                reorder_level INTEGER DEFAULT 20,
                status TEXT DEFAULT 'Adequate',
                expiration_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 5. User Authentication Table (String Primary Key YY-NNN format e.g. '26-001')
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'bhw',     -- 'bhw', 'admin'
                full_name TEXT,
                purok TEXT,
                address TEXT,
                station TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Check and migrate users table schema if existing id column is INTEGER
        try:
            cursor.execute("PRAGMA table_info(users)")
            user_cols = cursor.fetchall()
            if user_cols:
                id_col = next((c for c in user_cols if c[1] == 'id'), None)
                if id_col and 'INT' in str(id_col[2]).upper():
                    cursor.execute("""
                        CREATE TABLE users_migrated (
                            id TEXT PRIMARY KEY,
                            username TEXT UNIQUE NOT NULL,
                            password_hash TEXT NOT NULL,
                            role TEXT DEFAULT 'bhw',
                            full_name TEXT,
                            purok TEXT,
                            address TEXT,
                            station TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                    cursor.execute("SELECT id, username, password_hash, role, full_name, purok, address, station, created_at FROM users")
                    old_rows = cursor.fetchall()
                    yy = datetime.utcnow().year % 100
                    for idx, row in enumerate(old_rows, start=1):
                        new_id = f"{yy:02d}-{idx:03d}"
                        cursor.execute("""
                            INSERT INTO users_migrated (id, username, password_hash, role, full_name, purok, address, station, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (new_id, row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]))
                    cursor.execute("DROP TABLE users")
                    cursor.execute("ALTER TABLE users_migrated RENAME TO users")
        except Exception as mig_err:
            print(f"[DB Migration Notice] {mig_err}")

        # Ensure purok and address columns exist if upgrading existing SQLite file
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN purok TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN address TEXT")
        except sqlite3.OperationalError:
            pass

        # 6. Audit Logs Table (System & Clinical Integrity Tracking)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                action TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                details TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        """)

        conn.commit()
        conn.close()
        ensure_default_bhw_users()
        print("[DB] SQLite database schema initialized. Ready for live transactions.")


def get_next_user_id(year=None):
    """
    Generates the next sequential user ID in YY-NNN format (e.g., '26-001').
    YY: 2-digit year (default: current year, e.g. 26).
    NNN: 3-digit zero-padded sequential integer starting at 001.
    """
    yy = (year if year is not None else datetime.utcnow().year) % 100
    prefix = f"{yy:02d}-"
    rows = query_db("SELECT id FROM users WHERE id LIKE ? ORDER BY id DESC", (f"{prefix}%",))
    highest_seq = 0
    if rows:
        for r in rows:
            uid_str = str(r.get("id", ""))
            if uid_str.startswith(prefix):
                try:
                    num = int(uid_str.split("-")[1])
                    if num > highest_seq:
                        highest_seq = num
                except (IndexError, ValueError):
                    pass
    return f"{prefix}{highest_seq + 1:03d}"


def ensure_default_bhw_users():
    """Ensures the 7 standard BHW accounts from Poblacion 2 are registered with YY-NNN format IDs and cleanly separated purok and address."""
    with app.app_context():
        try:
            bhws = [
                ("charisma", "Charisma Astronomo", "Purok 1", "Poblacion 2, Nagcarlan, Laguna"),
                ("marisa", "Marisa Pullan", "Purok 2", "Poblacion 2, Nagcarlan, Laguna"),
                ("thess", "Marites Torres", "Purok 3", "Poblacion 2, Nagcarlan, Laguna"),
                ("flora", "Flora Angeles", "Purok 4", "Poblacion 2, Nagcarlan, Laguna"),
                ("grace", "Grace Yretarino", "Purok 5", "Poblacion 2, Nagcarlan, Laguna"),
                ("michelle", "Michelle Oboza", "Purok 6", "Poblacion 2, Nagcarlan, Laguna"),
                ("violy", "Violeta Esmijarda", "Purok 7", "Poblacion 2, Nagcarlan, Laguna")
            ]
            user_count = query_db("SELECT COUNT(*) as cnt FROM users", one=True)
            yy = datetime.utcnow().year % 100
            default_hash = generate_password_hash("password123", method="pbkdf2:sha256")
            
            if user_count and user_count["cnt"] == 0:
                for idx, (username, full_name, purok, address) in enumerate(bhws, start=1):
                    user_id = f"{yy:02d}-{idx:03d}"
                    execute_db("""
                        INSERT INTO users (id, username, password_hash, role, full_name, purok, address, station)
                        VALUES (?, ?, ?, 'bhw', ?, ?, ?, ?)
                    """, (user_id, username, default_hash, full_name, purok, address, purok))
                print(f"[DB] Initialized standard BHW accounts for Poblacion 2 with {yy:02d}-NNN IDs.")
            else:
                # Sync existing users to keep station, purok, address, and YY-NNN IDs clean
                for idx, (username, full_name, purok, address) in enumerate(bhws, start=1):
                    expected_id = f"{yy:02d}-{idx:03d}"
                    existing = query_db("""
                        SELECT id, username FROM users 
                        WHERE LOWER(username) = LOWER(?) 
                           OR LOWER(username) LIKE ? 
                           OR LOWER(full_name) = LOWER(?)
                    """, (username, f"{username}%", full_name), one=True)
                    if existing:
                        matched_user = existing["username"]
                        curr_id = str(existing.get("id", ""))
                        if not curr_id.startswith(f"{yy:02d}-"):
                            execute_db("UPDATE users SET id = ? WHERE username = ?", (expected_id, matched_user))
                        execute_db("""
                            UPDATE users
                            SET username = ?, purok = ?, address = ?, station = ?, full_name = ?
                            WHERE username = ?
                        """, (username, purok, address, purok, full_name, matched_user))
                    else:
                        execute_db("""
                            INSERT INTO users (id, username, password_hash, role, full_name, purok, address, station)
                            VALUES (?, ?, ?, 'bhw', ?, ?, ?, ?)
                        """, (expected_id, username, default_hash, full_name, purok, address, purok))
        except Exception as err:
            print(f"[DB Warning] Could not verify default BHW users: {err}")


# --------------------------------------------------------------------------
# Static Route Handlers
# --------------------------------------------------------------------------
@app.route("/")
def index():
    """Serves the primary landing page or redirects to dashboard."""
    return send_from_directory(".", "dashboardPage.html")


@app.route("/<path:filename>")
def serve_static(filename):
    """Serves static files (HTML, CSS, JS, images, icons)."""
    return send_from_directory(".", filename)


# --------------------------------------------------------------------------
# RESTful API Endpoints - Authentication & Security (Password Hashing)
# --------------------------------------------------------------------------
@app.route("/api/auth/register", methods=["POST"])
@app.route("/api/register", methods=["POST"])
def register_user():
    """
    Registers a new health station worker with salted password hashing and sequential YY-NNN ID format.
    Payload: { username, password, role, full_name, station, purok, address, id }
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "bhw").strip()
    full_name = data.get("full_name", "").strip()
    station = data.get("station", "Purok 1").strip()
    purok = data.get("purok", station).strip()
    address = data.get("address", "Poblacion 2, Nagcarlan, Laguna").strip()
    clean_purok = purok.split(",")[0].strip() if "," in purok else purok.strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required"}), 400

    # Ensure unique username
    existing = query_db("SELECT id FROM users WHERE username = ?", (username,), one=True)
    if existing:
        return jsonify({"success": False, "error": f"Username '{username}' is already registered."}), 409

    # Generate sequential YY-NNN user ID (e.g. '26-001')
    user_id = data.get("id") or get_next_user_id()

    # Hash the password securely using PBKDF2:SHA256
    password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    execute_db("""
        INSERT INTO users (id, username, password_hash, role, full_name, purok, address, station)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, username, password_hash, role, full_name or username, clean_purok, address, clean_purok))

    log_audit_event(user_id, "USER_REGISTERED", f"Created user '{username}' (ID: {user_id}) with role '{role}'.")

    return jsonify({
        "success": True,
        "message": "User registered successfully",
        "user": {
            "id": user_id,
            "username": username,
            "role": role,
            "full_name": full_name or username,
            "purok": clean_purok,
            "address": address,
            "station": clean_purok
        }
    }), 201


@app.route("/api/auth/login", methods=["POST"])
@app.route("/api/login", methods=["POST"])
def login_user():
    """
    Authenticates station worker credentials using secure password hash comparison.
    Supports input via Staff ID (YY-NNN, e.g. 26-001), username, or full name.
    Payload: { username / id, password, station }
    """
    data = request.get_json() or {}
    identifier = (data.get("username") or data.get("user_id") or data.get("id") or "").strip()
    password = data.get("password", "").strip()
    station = data.get("station", "").strip()

    if not identifier or not password:
        return jsonify({"success": False, "error": "Username/ID and password are required"}), 400

    user = query_db("""
        SELECT * FROM users 
        WHERE LOWER(id) = LOWER(?) 
           OR LOWER(username) = LOWER(?) 
           OR LOWER(full_name) = LOWER(?)
    """, (identifier, identifier, identifier), one=True)

    if not user:
        log_audit_event(
            None,
            "LOGIN_FAILED",
            f"Failed sign-in attempt for non-existent username/staff ID '{identifier}'."
        )
        return jsonify({"success": False, "error": "Account does not exist."}), 401

    if not check_password_hash(user["password_hash"], password):
        log_audit_event(
            user["id"],
            "LOGIN_FAILED",
            f"Incorrect password attempt for user '{user['username']}' (ID: {user['id']})."
        )
        return jsonify({"success": False, "error": "Invalid Username/Password. Try again."}), 401

    # Verify health station / purok if selected
    if station:
        user_purok = (user.get("purok") or user.get("station") or "").lower()
        clean_selected_station = station.split(",")[0].strip().lower()
        if user_purok and clean_selected_station and (clean_selected_station not in user_purok and user_purok not in clean_selected_station):
            log_audit_event(
                user["id"],
                "LOGIN_FAILED",
                f"Health station mismatch for user '{user['username']}': selected '{station}' vs assigned '{user.get('purok')}'."
            )
            return jsonify({"success": False, "error": f"Selected health station ({station}) does not match assigned station for {user.get('full_name')}."}), 401

    log_audit_event(
        user["id"],
        "LOGIN_SUCCESS",
        f"User '{user['username']}' (ID: {user['id']}) logged in successfully at station '{station or user['station']}'."
    )

    raw_purok = user.get("purok") or station or user.get("station") or "Purok 1"
    clean_purok = raw_purok.split(",")[0].strip() if "," in raw_purok else raw_purok.strip()

    # Store user session for user-specific data restriction
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["role"] = user["role"]
    session["full_name"] = user.get("full_name") or user["username"]
    session["station"] = clean_purok
    session["purok"] = clean_purok
    session.permanent = True

    return jsonify({
        "success": True,
        "message": "Authentication successful",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "full_name": user.get("full_name") or user["username"],
            "purok": clean_purok,
            "address": user.get("address") or "Poblacion 2, Nagcarlan, Laguna",
            "station": clean_purok
        }
    })


@app.route("/api/auth/users", methods=["GET"])
def get_users():
    """Retrieves registered terminal users with cleanly separated purok and address."""
    users = query_db("SELECT id, username, role, full_name, purok, address, station, created_at FROM users ORDER BY id ASC")
    for u in users:
        raw_p = u.get("purok") or u.get("station") or "Purok 1"
        u["purok"] = raw_p.split(",")[0].strip() if "," in raw_p else raw_p.strip()
        u["station"] = u["purok"]
        if not u.get("address"):
            u["address"] = "Poblacion 2, Nagcarlan, Laguna"
    return jsonify({"success": True, "count": len(users), "data": users})


@app.route("/api/auth/stations", methods=["GET"])
def get_stations():
    """Retrieves available health stations / puroks from the database."""
    stations = query_db("SELECT DISTINCT purok FROM users WHERE purok IS NOT NULL AND purok != '' ORDER BY purok ASC")
    station_list = [s["purok"] for s in stations if s["purok"]]
    if not station_list:
        station_list = [f"Purok {i}" for i in range(1, 8)]
    return jsonify({"success": True, "count": len(station_list), "data": station_list})


# --------------------------------------------------------------------------
# RESTful API Endpoints - Audit Trail & Security Logs
# --------------------------------------------------------------------------
@app.route("/api/audit-logs", methods=["GET"])
def get_audit_logs():
    """Retrieves system and clinical audit log trail."""
    logs = query_db("""
        SELECT a.id, a.user_id, u.username, a.action, a.details, a.timestamp
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.id DESC
        LIMIT 100
    """)
    return jsonify({"success": True, "count": len(logs), "data": logs})


# --------------------------------------------------------------------------
# RESTful API Endpoints - Monthly Schedule System
# --------------------------------------------------------------------------
@app.route("/api/appointments", methods=["GET"])
def get_appointments():
    """
    Retrieves appointments with dynamic filtering and automatic status calculation.
    Query parameters:
      - month: 0-11 (Jan=0, Dec=11)
      - category: filter by specific category
      - status: 'Pending', 'Completed', 'Defaulted'
      - search: text query for patient name or remarks
    """
    today_str = date.today().isoformat()

    # Automatic maintenance: Flag overdue Pending appointments as Defaulted in SQLite
    execute_db("""
        UPDATE appointments
        SET status = 'Defaulted'
        WHERE status = 'Pending' AND scheduled_date < ?
    """, (today_str,))

    # Parse query filters
    month_filter = request.args.get("month")
    category_filter = request.args.get("category")
    status_filter = request.args.get("status")
    search_query = request.args.get("search")

    query = "SELECT * FROM appointments WHERE 1=1"
    params = []

    if month_filter is not None and month_filter != "":
        try:
            m_idx = int(month_filter) + 1  # SQLite strftime month is 01-12
            month_formatted = f"{m_idx:02d}"
            query += " AND strftime('%m', scheduled_date) = ?"
            params.append(month_formatted)
        except ValueError:
            pass

    if category_filter:
        query += " AND category = ?"
        params.append(category_filter)

    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)

    if search_query:
        query += " AND (patient_name LIKE ? OR remarks LIKE ?)"
        term = f"%{search_query.strip()}%"
        params.extend([term, term])

    query += " ORDER BY scheduled_date ASC, id ASC"

    appointments = query_db(query, params)
    return jsonify({"success": True, "count": len(appointments), "data": appointments})


@app.route("/api/appointments", methods=["POST"])
def create_appointment():
    """
    Registers a new scheduled appointment or community check-up event.
    Payload: { patient_id, user_id, patient_name, category, scheduled_date, purok, remarks }
    """
    data = request.get_json() or {}
    patient_id = data.get("patient_id")
    user_id = data.get("user_id")
    patient_name = data.get("patient_name", "").strip()
    category = data.get("category", "Monthly HPN Check").strip()
    scheduled_date = data.get("scheduled_date", date.today().isoformat()).strip()
    purok = data.get("purok", "Purok 1").strip()
    remarks = data.get("remarks", "").strip()
    status = data.get("status", "Pending")

    if not patient_name:
        return jsonify({"success": False, "error": "Patient or event name is required"}), 400

    # Auto-flag status if created with past date
    today_str = date.today().isoformat()
    if status == "Pending" and scheduled_date < today_str:
        status = "Defaulted"

    appt_id = execute_db("""
        INSERT INTO appointments (patient_id, user_id, patient_name, category, scheduled_date, purok, remarks, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (patient_id, user_id, patient_name, category, scheduled_date, purok, remarks, status))

    log_audit_event(user_id, "APPOINTMENT_SCHEDULED", f"Scheduled '{category}' for {patient_name} on {scheduled_date}.")

    new_appt = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    return jsonify({"success": True, "message": "Appointment created successfully", "data": new_appt}), 201


@app.route("/api/appointments/<int:appt_id>/status", methods=["PUT"])
def update_appointment_status(appt_id):
    """
    Updates the status of an appointment (e.g. 'Completed', 'Pending', 'Defaulted').
    Payload: { status: 'Completed' | 'Pending' | 'Defaulted' }
    """
    data = request.get_json() or {}
    new_status = data.get("status")

    if new_status not in ["Pending", "Completed", "Defaulted"]:
        return jsonify({"success": False, "error": "Invalid status value"}), 400

    completed_date = date.today().isoformat() if new_status == "Completed" else None

    execute_db("""
        UPDATE appointments
        SET status = ?, completed_date = ?
        WHERE id = ?
    """, (new_status, completed_date, appt_id))

    updated_appt = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    if not updated_appt:
        return jsonify({"success": False, "error": "Appointment not found"}), 404

    log_audit_event(None, "APPOINTMENT_STATUS_UPDATE", f"Appointment #{appt_id} updated to {new_status}.")

    return jsonify({"success": True, "message": f"Status updated to {new_status}", "data": updated_appt})


@app.route("/api/appointments/<int:appt_id>/reschedule", methods=["PUT"])
def reschedule_appointment(appt_id):
    """
    Reschedules an appointment to a new date and updates remarks.
    Payload: { new_date: 'YYYY-MM-DD', reason: '...' }
    """
    data = request.get_json() or {}
    new_date = data.get("new_date", "").strip()
    reason = data.get("reason", "").strip()

    if not new_date:
        return jsonify({"success": False, "error": "New date is required"}), 400

    appt = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    if not appt:
        return jsonify({"success": False, "error": "Appointment not found"}), 404

    today_str = date.today().isoformat()
    new_status = "Pending" if new_date >= today_str else "Defaulted"

    existing_remarks = appt.get("remarks") or ""
    reschedule_note = f"[Rescheduled from {appt['scheduled_date']} to {new_date}{': ' + reason if reason else ''}]"
    updated_remarks = f"{existing_remarks} {reschedule_note}".strip()

    execute_db("""
        UPDATE appointments
        SET scheduled_date = ?, remarks = ?, status = ?, completed_date = NULL
        WHERE id = ?
    """, (new_date, updated_remarks, new_status, appt_id))

    updated_appt = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    log_audit_event(None, "APPOINTMENT_RESCHEDULED", f"Appointment #{appt_id} rescheduled to {new_date}.")

    return jsonify({"success": True, "message": "Appointment rescheduled successfully", "data": updated_appt})


@app.route("/api/appointments/stats", methods=["GET"])
def get_appointment_stats():
    """
    Provides aggregated counts for the dashboard cards:
    - Due Today
    - Overdue / Defaulted
    - Pending This Month
    - Completed This Month
    """
    today_str = date.today().isoformat()
    current_month = f"{date.today().month:02d}"

    due_today = query_db("""
        SELECT COUNT(*) as count FROM appointments
        WHERE scheduled_date = ? AND status = 'Pending'
    """, (today_str,), one=True)["count"]

    overdue = query_db("""
        SELECT COUNT(*) as count FROM appointments
        WHERE status = 'Defaulted' OR (status = 'Pending' AND scheduled_date < ?)
    """, (today_str,), one=True)["count"]

    completed_month = query_db("""
        SELECT COUNT(*) as count FROM appointments
        WHERE status = 'Completed' AND strftime('%m', completed_date) = ?
    """, (current_month,), one=True)["count"]

    pending_month = query_db("""
        SELECT COUNT(*) as count FROM appointments
        WHERE status = 'Pending' AND strftime('%m', scheduled_date) = ?
    """, (current_month,), one=True)["count"]

    return jsonify({
        "success": True,
        "data": {
            "due_today": due_today,
            "overdue_defaulted": overdue,
            "completed_this_month": completed_month,
            "pending_this_month": pending_month
        }
    })


# --------------------------------------------------------------------------
# RESTful API Endpoints - Consultations & Clinical Follow-up Engine
# --------------------------------------------------------------------------
@app.route("/api/consultations", methods=["POST"])
def submit_consultation():
    """
    Records a patient clinical consultation and automatically schedules
    a 30-day routine follow-up appointment in the SQLite appointments ledger.
    """
    data = request.get_json() or {}
    patient_name = data.get("patient_name", "").strip()
    sys_bp = data.get("sys_bp")
    dia_bp = data.get("dia_bp")
    glucose = data.get("glucose")
    weight = data.get("weight")
    height = data.get("height")
    bmi_result = data.get("bmi_result", "")
    risk_level = data.get("risk_level", "Low / Stable")
    remarks = data.get("remarks", "")
    today_str = date.today().isoformat()

    if not patient_name:
        return jsonify({"success": False, "error": "Patient name is required"}), 400

    # 1. Insert Consultation record
    consult_id = execute_db("""
        INSERT INTO consultations (patient_name, sys_bp, dia_bp, glucose, weight, height, bmi_result, risk_level, remarks, consult_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (patient_name, sys_bp, dia_bp, glucose, weight, height, bmi_result, risk_level, remarks, today_str))

    # 2. Update patient's last visit in TCR
    execute_db("""
        UPDATE patients
        SET last_visit = ?
        WHERE name = ?
    """, (today_str, patient_name))

    # 3. Calculate 30-day next appointment date
    next_date = (date.today() + timedelta(days=30)).isoformat()

    # Determine appointment category based on clinical readings
    category = "Monthly HPN Check"
    if glucose and int(glucose) > 125:
        category = "Diabetes Follow-up"
    elif "refill" in remarks.lower() or "dispense" in remarks.lower():
        category = "Medicine Refill"

    # 4. Auto-register in appointments table
    appt_remarks = f"Auto-scheduled 30-day routine follow-up. Prior BP: {sys_bp}/{dia_bp} mmHg."
    execute_db("""
        INSERT INTO appointments (patient_name, category, scheduled_date, purok, remarks, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
    """, (patient_name, category, next_date, "Purok 1", appt_remarks))

    log_audit_event(None, "CONSULTATION_SUBMITTED", f"Recorded vitals for {patient_name} (BP: {sys_bp}/{dia_bp}).")

    return jsonify({
        "success": True,
        "message": f"Consultation saved. Next appointment auto-scheduled for {next_date}.",
        "consult_id": consult_id,
        "next_visit_date": next_date
    }), 201


# --------------------------------------------------------------------------
# RESTful API Endpoints - Patients (Target Client Registry)
# --------------------------------------------------------------------------
@app.route("/api/patients", methods=["GET"])
def get_patients():
    """
    Retrieves TCR patients assigned to or managed by the logged-in user session.
    Checks session['user_id'] or session['username'] (with fallback to request headers, query parameters, or default station BHW).
    """
    user_id = session.get("user_id") or request.args.get("user_id") or request.headers.get("X-User-Id")
    username = session.get("username") or request.args.get("username") or request.headers.get("X-Username")

    logged_user = None
    if user_id:
        logged_user = query_db("""
            SELECT * FROM users 
            WHERE id = ? OR LOWER(username) = LOWER(?)
        """, (str(user_id), str(user_id)), one=True)
    elif username:
        logged_user = query_db("""
            SELECT * FROM users 
            WHERE LOWER(username) = LOWER(?) OR id = ?
        """, (str(username), str(username)), one=True)

    # Fallback to default terminal BHW (Charisma Astronomo, Purok 1) if no session or params passed
    if not logged_user:
        logged_user = query_db("""
            SELECT * FROM users 
            WHERE LOWER(username) = 'charisma' OR id = '26-001'
            LIMIT 1
        """, one=True)

    if logged_user:
        u_username = logged_user["username"].lower()
        u_id = str(logged_user["id"])
        u_purok = (logged_user.get("purok") or logged_user.get("station") or "").strip()
        u_role = (logged_user.get("role") or "").lower()

        # Admin users can view all records if requested with ?all=true
        if u_role == "admin" and request.args.get("all") == "true":
            patients = query_db("SELECT * FROM patients ORDER BY id DESC")
        else:
            patients = query_db("""
                SELECT * FROM patients 
                WHERE handler_id = ? 
                   OR handler_id = ?
                   OR (purok IS NOT NULL AND LOWER(purok) = LOWER(?))
                ORDER BY id DESC
            """, (u_id, u_username, u_purok))
    else:
        patients = []

    # Format patients to ensure compatibility across client templates
    formatted_patients = []
    for p in patients:
        p_dict = dict(p)
        # Parse JSON array fields
        gov_progs = []
        if p_dict.get("government_programs"):
            try:
                raw_gp = str(p_dict["government_programs"]).strip()
                gov_progs = json.loads(raw_gp) if raw_gp.startswith("[") else [raw_gp]
            except Exception:
                gov_progs = [p_dict["government_programs"]]

        h_risks = []
        if p_dict.get("health_risks"):
            try:
                raw_hr = str(p_dict["health_risks"]).strip()
                h_risks = json.loads(raw_hr) if raw_hr.startswith("[") else [raw_hr]
            except Exception:
                h_risks = [p_dict["health_risks"]]

        clean_sex = p_dict.get("sex") or p_dict.get("gender") or "Female"
        clean_ph = str(p_dict.get("ph_id") or p_dict.get("ph") or "").strip()
        if not clean_ph:
            clean_ph = "Pending RHU Assignment"

        p_dict["sex"] = clean_sex
        p_dict["gender"] = clean_sex
        p_dict["ph_id"] = clean_ph
        p_dict["ph"] = clean_ph
        p_dict["programs"] = gov_progs
        p_dict["government_programs"] = gov_progs
        p_dict["healthRisks"] = h_risks
        p_dict["health_risks"] = h_risks
        p_dict["firstName"] = p_dict.get("first_name") or ""
        p_dict["middleName"] = p_dict.get("middle_name") or ""
        p_dict["lastName"] = p_dict.get("last_name") or ""
        p_dict["contact"] = p_dict.get("contact") or p_dict.get("contact_number") or ""
        p_dict["contact_number"] = p_dict["contact"]
        p_dict["diagnosisDate"] = p_dict.get("diagnosis_date") or ""
        p_dict["diagnosis_date"] = p_dict["diagnosisDate"]
        p_dict["risk"] = p_dict.get("risk_level") or "Moderate"
        p_dict["risk_level"] = p_dict["risk"]
        p_dict["lastVisit"] = p_dict.get("last_visit") or "Today"
        p_dict["last_visit"] = p_dict["lastVisit"]
        p_dict["emergencyName"] = p_dict.get("emergency_contact_name") or ""
        p_dict["emergency_contact_name"] = p_dict["emergencyName"]
        p_dict["emergencyRel"] = p_dict.get("emergency_contact_relationship") or ""
        p_dict["emergency_contact_relationship"] = p_dict["emergencyRel"]
        p_dict["emergencyPhone"] = p_dict.get("emergency_contact_number") or ""
        p_dict["emergency_contact_number"] = p_dict["emergencyPhone"]
        p_dict["medHistory"] = p_dict.get("medical_history") or ""
        p_dict["medical_history"] = p_dict["medHistory"]
        p_dict["allergies"] = p_dict.get("allergies") or "None reported"

        formatted_patients.append(p_dict)

    return jsonify({"success": True, "count": len(formatted_patients), "data": formatted_patients})


@app.route("/api/patients", methods=["POST"])
def register_patient():
    """Registers a new patient into the TCR table assigned to current user."""
    data = request.get_json() or {}
    first_name = (data.get("firstName") or data.get("first_name") or "").strip()
    middle_name = (data.get("middleName") or data.get("middle_name") or "").strip() or None
    last_name = (data.get("lastName") or data.get("last_name") or "").strip()
    name = (data.get("name") or "").strip()
    if not name and (first_name or last_name):
        name = f"{first_name} {middle_name} {last_name}".replace("  ", " ").strip() if middle_name else f"{first_name} {last_name}".strip()

    if not name:
        return jsonify({"success": False, "error": "Patient name is required"}), 400

    # Handler reference resolution: handler_id foreign key linking to users.id (YY-NNN format)
    handler_id = data.get("handler_id") or session.get("user_id") or request.headers.get("X-User-Id")
    if not handler_id:
        user_identifier = session.get("username") or request.headers.get("X-Username") or request.args.get("username") or "charisma"
        user_row = query_db("SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR id = ?", (user_identifier, user_identifier), one=True)
        handler_id = user_row["id"] if user_row else "26-001"

    # PhilHealth ID validation: strictly 12 unique numbers without formatting or hyphens
    raw_ph = str(data.get("ph") or data.get("ph_id") or "").strip()
    digits_ph = re.sub(r"\D", "", raw_ph)
    if len(digits_ph) == 12:
        clean_ph = digits_ph
    elif digits_ph:
        clean_ph = digits_ph[:12].zfill(12)
    else:
        clean_ph = f"{random.randint(100000, 999999)}{random.randint(100000, 999999)}"

    # Address cleanup: house/block/sitio address only (purok stored in dedicated column)
    purok = (data.get("purok") or "Purok 1").strip()
    address = (data.get("address") or "").strip()
    if address.lower().startswith(purok.lower()):
        address = address[len(purok):].lstrip(", ").strip()
    if not address:
        address = "Sitio Sentro"

    # Parse and serialize multi-value arrays to JSON strings
    programs_input = data.get("programs") or data.get("government_programs") or []
    if isinstance(programs_input, list):
        gov_programs_json = json.dumps(programs_input)
    else:
        gov_programs_json = json.dumps([programs_input]) if programs_input else "[]"

    risks_input = data.get("healthRisks") or data.get("health_risks") or []
    if isinstance(risks_input, list):
        health_risks_json = json.dumps(risks_input)
    else:
        health_risks_json = json.dumps([risks_input]) if risks_input else "[]"

    sex = (data.get("sex") or "Female").strip()
    age = int(data.get("age", 0)) if str(data.get("age", "")).isdigit() else 0
    dob = (data.get("dob") or "").strip()
    contact = (data.get("contact") or data.get("contact_number") or "").strip()
    condition = (data.get("condition") or "Hypertension Only").strip()
    diagnosis_date = (data.get("diagnosisDate") or data.get("diagnosis_date") or date.today().isoformat()).strip()
    last_visit = (data.get("lastVisit") or data.get("last_visit") or "Today").strip()
    risk_level = (data.get("risk") or data.get("risk_level") or "Moderate").strip()
    emergency_name = (data.get("emergencyName") or data.get("emergency_contact_name") or "").strip()
    emergency_rel = (data.get("emergencyRel") or data.get("emergency_contact_relationship") or "").strip()
    emergency_phone = (data.get("emergencyPhone") or data.get("emergency_contact_number") or "").strip()
    allergies = (data.get("allergies") or "None reported").strip()
    med_history = (data.get("medHistory") or data.get("medical_history") or "").strip()

    patient_id = execute_db("""
        INSERT INTO patients (
            handler_id, name, first_name, middle_name, last_name, dob, age, sex,
            contact, contact_number, purok, address, condition, diagnosis_date, ph_id,
            last_visit, risk_level, emergency_contact_name, emergency_contact_relationship,
            emergency_contact_number, government_programs, allergies, health_risks, medical_history
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        handler_id, name, first_name, middle_name, last_name, dob, age, sex,
        contact, contact, purok, address, condition, diagnosis_date, clean_ph,
        last_visit, risk_level, emergency_name, emergency_rel, emergency_phone,
        gov_programs_json, allergies, health_risks_json, med_history
    ))

    log_audit_event(handler_id, "PATIENT_REGISTERED", f"Registered new client '{name}' in TCR (Handler ID: {handler_id}).")

    new_patient = query_db("SELECT * FROM patients WHERE id = ?", (patient_id,), one=True)
    return jsonify({"success": True, "message": "Patient registered successfully", "data": new_patient}), 201


# --------------------------------------------------------------------------
# RESTful API Endpoints - Medicine Inventory & Supply
# --------------------------------------------------------------------------
@app.route("/api/inventory", methods=["GET"])
def get_inventory():
    """Retrieves all medicine inventory stock items."""
    items = query_db("SELECT * FROM inventory ORDER BY item_name ASC")
    return jsonify({"success": True, "count": len(items), "data": items})


@app.route("/api/inventory", methods=["POST"])
def add_inventory_item():
    """Adds a new medicine item to inventory with expiration shelf-life tracking."""
    data = request.get_json() or {}
    item_name = data.get("item_name", "").strip()
    category = data.get("category", "Antihypertensive").strip()
    batch_no = data.get("batch_no", "").strip()
    dosage = data.get("dosage", "").strip()
    current_stock = int(data.get("current_stock", 0))
    reorder_level = int(data.get("reorder_level", 20))
    unit = data.get("unit", "tabs").strip()
    expiration_date = data.get("expiration_date") or None

    if not item_name:
        return jsonify({"success": False, "error": "Medicine item name is required"}), 400

    status = "Adequate"
    if current_stock <= 10:
        status = "Critical Low"
    elif current_stock <= reorder_level:
        status = "Low Stock"

    item_id = execute_db("""
        INSERT INTO inventory (item_name, category, batch_no, dosage, current_stock, unit, reorder_level, status, expiration_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (item_name, category, batch_no, dosage, current_stock, unit, reorder_level, status, expiration_date))

    log_audit_event(None, "INVENTORY_ADDED", f"Added medicine '{item_name}' (Stock: {current_stock} {unit}).")

    new_item = query_db("SELECT * FROM inventory WHERE id = ?", (item_id,), one=True)
    return jsonify({"success": True, "message": "Medicine added successfully", "data": new_item}), 201


@app.route("/api/inventory/<int:item_id>/dispense", methods=["POST"])
def dispense_inventory_item(item_id):
    """Dispenses medicine quantity from inventory and updates status."""
    data = request.get_json() or {}
    qty = int(data.get("quantity", 30))

    item = query_db("SELECT * FROM inventory WHERE id = ?", (item_id,), one=True)
    if not item:
        return jsonify({"success": False, "error": "Item not found"}), 404

    current_stock = max(0, item["current_stock"] - qty)
    reorder_level = item["reorder_level"]

    status = "Adequate"
    if current_stock <= 10:
        status = "Critical Low"
    elif current_stock <= reorder_level:
        status = "Low Stock"

    execute_db("""
        UPDATE inventory
        SET current_stock = ?, status = ?
        WHERE id = ?
    """, (current_stock, status, item_id))

    log_audit_event(None, "MEDICINE_DISPENSED", f"Dispensed {qty} {item['unit']} of {item['item_name']}.")

    updated = query_db("SELECT * FROM inventory WHERE id = ?", (item_id,), one=True)
    return jsonify({"success": True, "message": f"Dispensed {qty} {item['unit']}.", "data": updated})


@app.route("/api/inventory/restock-request", methods=["POST"])
def request_inventory_restock():
    """Logs and generates an RHU replenishment requisition for low or depleted medicines."""
    low_items = query_db("SELECT * FROM inventory WHERE current_stock <= reorder_level")
    log_audit_event(None, "RESTOCK_REQUESTED", f"RHU replenishment requested for {len(low_items)} low-stock item(s).")

    return jsonify({
        "success": True,
        "message": f"Stock replenishment requisition generated for RHU submission ({len(low_items)} item(s) flagged).",
        "flagged_count": len(low_items)
    })


# --------------------------------------------------------------------------
# Administrative Reset Endpoint
# --------------------------------------------------------------------------
# @app.route("/api/admin/reset", methods=["POST"])
# def reset_database():
#     """Wipes all transactional records to return database to clean zero-state."""
#     execute_db("DELETE FROM appointments")
#     execute_db("DELETE FROM consultations")
#     execute_db("DELETE FROM patients")
#     execute_db("DELETE FROM inventory")
#     execute_db("DELETE FROM audit_logs")
#     return jsonify({"success": True, "message": "Database successfully reset to clean zero-state."})


# --------------------------------------------------------------------------
# Main Execution
# --------------------------------------------------------------------------
if __name__ == "__main__":
    with app.app_context():
        init_db()
    print("=" * 70)
    print(" BWC-HDMS Capstone Server running in offline mode")
    print(" Access URL: http://127.0.0.1:5000/loginPage.html")
    print("=" * 70)
    app.run(host="127.0.0.1", port=5000, debug=True)
