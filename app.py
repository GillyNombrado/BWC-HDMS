"""
==============================================================================
Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
Capstone Project - CMSC 309
Backend Server: Python / Flask with Embedded SQLite Database
==============================================================================
This module provides the local offline RESTful API and static web server for
the BWC-HDMS portal. It handles data persistence for Target Client Registry
(TCR), Consultations, Medicine Inventory, and the Monthly Schedule System.
==============================================================================
"""

import os
import sqlite3
from datetime import datetime, date, timedelta
from flask import Flask, request, jsonify, send_from_directory, g

# Initialize Flask application
app = Flask(__name__, static_folder=".", static_url_path="")

# SQLite Database configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, "bwc_hdms.db")


# --------------------------------------------------------------------------
# Database Connection Helpers
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
    db = get_db()
    cur = db.execute(query, args)
    db.commit()
    last_id = cur.lastrowid
    cur.close()
    return last_id


# --------------------------------------------------------------------------
# Database Initialization (Schema Only - Clean Zero State)
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

    # 3. Monthly Appointments & Schedule Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT NOT NULL,
            category TEXT NOT NULL,      -- 'Monthly HPN Check', 'Diabetes Follow-up', 'Medicine Refill', 'Purok Assembly'
            scheduled_date TEXT NOT NULL, -- ISO 'YYYY-MM-DD'
            purok TEXT,
            remarks TEXT,
            status TEXT DEFAULT 'Pending', -- 'Pending', 'Completed', 'Defaulted'
            completed_date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 4. Medicine Inventory Table
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        query += " AND (patient_name LIKE ? OR remarks LIKE ? OR purok LIKE ?)"
        like_arg = f"%{search_query}%"
        params.extend([like_arg, like_arg, like_arg])

    query += " ORDER BY scheduled_date ASC, id DESC"
    appointments = query_db(query, params)

    return jsonify({"success": True, "count": len(appointments), "data": appointments})


@app.route("/api/appointments", methods=["POST"])
def create_appointment():
    """
    Registers a new scheduled event or patient follow-up appointment.
    Payload: { patient_name, category, scheduled_date, purok, remarks }
    """
    data = request.get_json() or {}
    patient_name = data.get("patient_name", "").strip()
    category = data.get("category", "Monthly HPN Check").strip()
    scheduled_date = data.get("scheduled_date", date.today().isoformat()).strip()
    purok = data.get("purok", "Poblacion 1").strip()
    remarks = data.get("remarks", "").strip()
    status = data.get("status", "Pending")

    if not patient_name:
        return jsonify({"success": False, "error": "Patient or event name is required"}), 400

    # Auto-flag status if created with past date
    today_str = date.today().isoformat()
    if status == "Pending" and scheduled_date < today_str:
        status = "Defaulted"

    appt_id = execute_db("""
        INSERT INTO appointments (patient_name, category, scheduled_date, purok, remarks, status)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (patient_name, category, scheduled_date, purok, remarks, status))

    new_record = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    return jsonify({"success": True, "message": "Appointment scheduled successfully", "data": new_record}), 201


@app.route("/api/appointments/<int:appt_id>/status", methods=["PUT"])
def update_appointment_status(appt_id):
    """
    Updates the status of an appointment (e.g., mark as Completed, Pending, or Defaulted).
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

    updated = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    return jsonify({"success": True, "message": f"Status updated to {new_status}", "data": updated})


@app.route("/api/appointments/<int:appt_id>/reschedule", methods=["PUT"])
def reschedule_appointment(appt_id):
    """
    Reschedules an appointment to a new date, resets completed state,
    and appends reschedule audit remarks.
    """
    data = request.get_json() or {}
    new_date = data.get("scheduled_date")
    reason = data.get("reason", "").strip()

    if not new_date:
        return jsonify({"success": False, "error": "New scheduled date is required"}), 400

    today_str = date.today().isoformat()
    new_status = "Defaulted" if new_date < today_str else "Pending"

    appt = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    if not appt:
        return jsonify({"success": False, "error": "Appointment not found"}), 404

    current_remarks = appt.get("remarks") or ""
    append_note = f"Rescheduled to {new_date}" + (f": {reason}" if reason else "")
    updated_remarks = f"{current_remarks} | {append_note}" if current_remarks else append_note

    execute_db("""
        UPDATE appointments
        SET scheduled_date = ?, status = ?, completed_date = NULL, remarks = ?
        WHERE id = ?
    """, (new_date, new_status, updated_remarks, appt_id))

    updated = query_db("SELECT * FROM appointments WHERE id = ?", (appt_id,), one=True)
    return jsonify({"success": True, "message": "Appointment rescheduled successfully", "data": updated})


# --------------------------------------------------------------------------
# RESTful API Endpoints - Dashboard Integration & Stats
# --------------------------------------------------------------------------
@app.route("/api/appointments/stats", methods=["GET"])
def get_dashboard_stats():
    """
    Calculates summary metrics dynamically for the Dashboard:
      - Active TCR Patients count
      - Due Today Follow-ups count
      - Overdue / Defaulted count
      - Low-Stock Medicines count
    """
    today_str = date.today().isoformat()

    # Refresh Defaulted statuses first
    execute_db("""
        UPDATE appointments
        SET status = 'Defaulted'
        WHERE status = 'Pending' AND scheduled_date < ?
    """, (today_str,))

    # Active Patients
    res_active = query_db("SELECT COUNT(*) AS count FROM patients", one=True)
    active_count = res_active["count"] if res_active else 0

    # Due Today (Pending on today's date)
    res_due = query_db("""
        SELECT COUNT(*) AS count FROM appointments
        WHERE scheduled_date = ? AND status = 'Pending'
    """, (today_str,), one=True)
    due_today_count = res_due["count"] if res_due else 0

    # Overdue / Defaulted
    res_overdue = query_db("""
        SELECT COUNT(*) AS count FROM appointments
        WHERE status = 'Defaulted'
    """, one=True)
    overdue_count = res_overdue["count"] if res_overdue else 0

    # Low Stock Medicines (current_stock <= reorder_level)
    res_stock = query_db("""
        SELECT COUNT(*) AS count FROM inventory
        WHERE current_stock <= reorder_level
    """, one=True)
    low_stock_count = res_stock["count"] if res_stock else 0

    return jsonify({
        "success": True,
        "data": {
            "active_patients": active_count,
            "due_today": due_today_count,
            "overdue_defaulted": overdue_count,
            "low_stock": low_stock_count,
            "server_date": today_str
        }
    })


# --------------------------------------------------------------------------
# RESTful API Endpoints - Consultations & Auto 30-Day Follow-up
# --------------------------------------------------------------------------
@app.route("/api/consultations", methods=["POST"])
def record_consultation():
    """
    Records a patient consultation and automatically schedules the next
    routine 30-day follow-up appointment in the schedule data store.
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
    """, (patient_name, category, next_date, "Poblacion 1", appt_remarks))

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
        data.get("purok", "Poblacion 1"),
        data.get("address", ""),
        data.get("condition", "Hypertension Only"),
        data.get("diagnosisDate", date.today().isoformat()),
        data.get("ph", ""),
        data.get("lastVisit", "Today"),
        data.get("risk", "Moderate")
    ))
    new_patient = query_db("SELECT * FROM patients WHERE id = ?", (patient_id,), one=True)
    return jsonify({"success": True, "message": "Patient registered successfully", "data": new_patient}), 201


# --------------------------------------------------------------------------
# RESTful API Endpoints - Inventory
# --------------------------------------------------------------------------
@app.route("/api/inventory", methods=["GET"])
def get_inventory():
    """Retrieves all medicine inventory stock items."""
    items = query_db("SELECT * FROM inventory ORDER BY item_name ASC")
    return jsonify({"success": True, "count": len(items), "data": items})


@app.route("/api/inventory", methods=["POST"])
def add_inventory_item():
    """Adds a new medicine item to inventory."""
    data = request.get_json() or {}
    item_name = data.get("item_name", "").strip()
    category = data.get("category", "Antihypertensive").strip()
    batch_no = data.get("batch_no", "").strip()
    dosage = data.get("dosage", "").strip()
    current_stock = int(data.get("current_stock", 0))
    reorder_level = int(data.get("reorder_level", 20))
    unit = data.get("unit", "tabs").strip()

    if not item_name:
        return jsonify({"success": False, "error": "Medicine item name is required"}), 400

    status = "Adequate"
    if current_stock <= 10:
        status = "Critical Low"
    elif current_stock <= reorder_level:
        status = "Low Stock"

    item_id = execute_db("""
        INSERT INTO inventory (item_name, category, batch_no, dosage, current_stock, unit, reorder_level, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (item_name, category, batch_no, dosage, current_stock, unit, reorder_level, status))

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

    updated = query_db("SELECT * FROM inventory WHERE id = ?", (item_id,), one=True)
    return jsonify({"success": True, "message": f"Dispensed {qty} {item['unit']}.", "data": updated})


@app.route("/api/inventory/restock-request", methods=["POST"])
def request_inventory_restock():
    """Logs and generates an RHU replenishment requisition for low or depleted medicines."""
    low_items = query_db("SELECT * FROM inventory WHERE current_stock <= reorder_level")
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
