from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), nullable=False) # 'bhw' or 'admin'

class Patient(db.Model):
    __tablename__ = 'patients'
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.String(20), nullable=False)
    contact_number = db.Column(db.String(20))
    address = db.Column(db.String(255))
    assigned_bhw = db.Column(db.String(80), nullable=False)
    medical_status = db.Column(db.String(100), default="Monitoring / Maintenance") # e.g., Hypertensive, Diabetic, Both, Normal
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    vitals = db.relationship('Vital', backref='patient', lazy=True, cascade='all, delete-orphan')
    dispensations = db.relationship('Dispensation', backref='patient', lazy=True, cascade='all, delete-orphan')
    appointments = db.relationship('Appointment', backref='patient', lazy=True, cascade='all, delete-orphan')

class InventoryItem(db.Model):
    __tablename__ = 'inventory'
    id = db.Column(db.Integer, primary_key=True)
    item_name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    quantity = db.Column(db.Integer, nullable=False)
    expiration_date = db.Column(db.Date)
    
    dispensations = db.relationship('Dispensation', backref='inventory_item', lazy=True)

class Vital(db.Model):
    __tablename__ = 'vitals'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    blood_pressure = db.Column(db.String(20))
    temperature = db.Column(db.Float)
    heart_rate = db.Column(db.Integer)
    recorded_at = db.Column(db.DateTime, server_default=db.func.now())

class Dispensation(db.Model):
    __tablename__ = 'dispensations'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=False)
    quantity_dispensed = db.Column(db.Integer, nullable=False)
    dispensed_by = db.Column(db.String(80), nullable=False) # BHW username
    dispensed_at = db.Column(db.DateTime, server_default=db.func.now())

class Appointment(db.Model):
    __tablename__ = 'appointments'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    scheduled_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(50), default="Scheduled") # Scheduled, Completed, Cancelled
    notes = db.Column(db.String(255))

class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, server_default=db.func.now())
