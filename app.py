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
import sqlite3
from datetime import datetime, date, timedelta
from flask import Flask, request, jsonify, send_from_directory, g
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
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # 1. Target Client Registry (Patients) Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            first_name TEXT,
            middle_name TEXT,
            last_name TEXT,
            dob TEXT,
            age INTEGER,
            sex TEXT,
            contact TEXT,
            purok TEXT,
            address TEXT,
            condition TEXT,
            diagnosis_date TEXT,
            ph_id TEXT,
            last_visit TEXT,
            risk_level TEXT DEFAULT 'Moderate',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

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
            user_id INTEGER,
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

    # 5. User Authentication Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'bhw',     -- 'bhw', 'midwife', 'admin'
            full_name TEXT,
            station TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 6. Audit Logs Table (System & Clinical Integrity Tracking)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            details TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    conn.commit()
    conn.close()
    print("[DB] SQLite database schema initialized (clean zero-state). Ready for live transactions.")


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
    Registers a new health station worker with salted password hashing.
    Payload: { username, password, role, full_name, station }
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "bhw").strip()
    full_name = data.get("full_name", "").strip()
    station = data.get("station", "BHS Poblacion 2").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required"}), 400

    # Ensure unique username
    existing = query_db("SELECT id FROM users WHERE username = ?", (username,), one=True)
    if existing:
        return jsonify({"success": False, "error": f"Username '{username}' is already registered."}), 409

    # Hash the password securely using PBKDF2:SHA256
    password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    user_id = execute_db("""
        INSERT INTO users (username, password_hash, role, full_name, station)
        VALUES (?, ?, ?, ?, ?)
    """, (username, password_hash, role, full_name or username, station))

    log_audit_event(user_id, "USER_REGISTERED", f"Created user '{username}' with role '{role}'.")

    return jsonify({
        "success": True,
        "message": "User registered successfully",
        "user": {
            "id": user_id,
            "username": username,
            "role": role,
            "full_name": full_name or username,
            "station": station
        }
    }), 201


@app.route("/api/auth/login", methods=["POST"])
@app.route("/api/login", methods=["POST"])
def login_user():
    """
    Authenticates station worker credentials using secure password hash comparison.
    Payload: { username, password, station }
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    station = data.get("station", "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required"}), 400

    user = query_db("SELECT * FROM users WHERE username = ?", (username,), one=True)
    if not user or not check_password_hash(user["password_hash"], password):
        log_audit_event(
            user["id"] if user else None,
            "LOGIN_FAILED",
            f"Failed sign-in attempt for username '{username}'."
        )
        return jsonify({"success": False, "error": "Invalid username or station security password."}), 401

    log_audit_event(
        user["id"],
        "LOGIN_SUCCESS",
        f"User '{username}' logged in successfully at station '{station or user['station']}'."
    )

    return jsonify({
        "success": True,
        "message": "Authentication successful",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "full_name": user.get("full_name") or user["username"],
            "station": station or user.get("station") or "BHS Poblacion 2"
        }
    })


@app.route("/api/auth/users", methods=["GET"])
def get_users():
    """Retrieves registered terminal users (hashes strictly excluded)."""
    users = query_db("SELECT id, username, role, full_name, station, created_at FROM users ORDER BY id ASC")
    return jsonify({"success": True, "count": len(users), "data": users})


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
    """Retrieves all registered TCR patients from SQLite."""
    patients = query_db("SELECT * FROM patients ORDER BY id DESC")
    return jsonify({"success": True, "count": len(patients), "data": patients})


@app.route("/api/patients", methods=["POST"])
def register_patient():
    """Registers a new patient into the TCR table."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "error": "Patient name is required"}), 400

    patient_id = execute_db("""
        INSERT INTO patients (name, first_name, middle_name, last_name, dob, age, sex, contact, purok, address, condition, diagnosis_date, ph_id, last_visit, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        name,
        data.get("firstName", ""),
        data.get("middleName", ""),
        data.get("lastName", ""),
        data.get("dob", ""),
        data.get("age", 0),
        data.get("sex", "Male"),
        data.get("contact", ""),
        data.get("purok", "Purok 1"),
        data.get("address", ""),
        data.get("condition", "Hypertension Only"),
        data.get("diagnosisDate", date.today().isoformat()),
        data.get("ph", ""),
        data.get("lastVisit", "Today"),
        data.get("risk", "Moderate")
    ))

    log_audit_event(None, "PATIENT_REGISTERED", f"Registered new client '{name}' in TCR.")

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
@app.route("/api/admin/reset", methods=["POST"])
def reset_database():
    """Wipes all transactional records to return database to clean zero-state."""
    execute_db("DELETE FROM appointments")
    execute_db("DELETE FROM consultations")
    execute_db("DELETE FROM patients")
    execute_db("DELETE FROM inventory")
    execute_db("DELETE FROM audit_logs")
    return jsonify({"success": True, "message": "Database successfully reset to clean zero-state."})


# --------------------------------------------------------------------------
# Main Execution
# --------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print("=" * 70)
    print(" BWC-HDMS Capstone Server running in offline mode")
    print(" Access URL: http://127.0.0.1:5000/dashboardPage.html")
    print("=" * 70)
    app.run(host="127.0.0.1", port=5000, debug=True)
