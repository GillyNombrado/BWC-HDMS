from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# ==============================================================================
# 1. User Authentication & Authorization Model
# ==============================================================================
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(20), primary_key=True)  # Format: YY-NNN (e.g. '26-001')
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='bhw') # 'bhw', 'midwife', 'admin'
    full_name = db.Column(db.String(120), nullable=True)
    purok = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    station = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Strict Foreign Key Relationships
    appointments = db.relationship('Appointment', back_populates='user', lazy=True)
    audit_logs = db.relationship('AuditLog', back_populates='user', lazy=True)

    @staticmethod
    def generate_next_id(year=None):
        """
        Generates a sequential user ID with format YY-NNN (e.g., '26-001').
        YY: 2-digit year of creation (e.g. '26' for 2026).
        NNN: 3-digit zero-padded sequential integer starting at 001.
        """
        yy = (year if year is not None else datetime.utcnow().year) % 100
        prefix = f"{yy:02d}-"
        # Query highest existing ID for the given prefix
        try:
            latest = User.query.filter(User.id.like(f"{prefix}%")).order_by(User.id.desc()).first()
            if latest and latest.id:
                parts = str(latest.id).split("-")
                seq = int(parts[1]) + 1 if len(parts) > 1 else 1
            else:
                seq = 1
        except Exception:
            seq = 1
        return f"{prefix}{seq:03d}"

    def __init__(self, **kwargs):
        if 'id' not in kwargs or not kwargs['id']:
            kwargs['id'] = User.generate_next_id()
        super(User, self).__init__(**kwargs)

    def set_password(self, password):
        """Hashes and stores the user's password securely."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifies plain-text password against the securely stored hash."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Serializes user info without exposing password hash."""
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'full_name': self.full_name,
            'purok': self.purok or self.station,
            'address': self.address,
            'station': self.purok or self.station,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ==============================================================================
# 2. Target Client Registry (Patient) Model
# ==============================================================================
class Patient(db.Model):
    __tablename__ = 'patients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=True)
    first_name = db.Column(db.String(80), nullable=False)
    middle_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=False)
    dob = db.Column(db.String(20), nullable=True)
    age = db.Column(db.Integer, nullable=True)
    sex = db.Column(db.String(20), nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    contact_number = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    purok = db.Column(db.String(100), nullable=True)
    assigned_bhw = db.Column(db.String(80), nullable=True)
    medical_status = db.Column(db.String(100), default="Monitoring / Maintenance")
    condition = db.Column(db.String(100), nullable=True)
    diagnosis_date = db.Column(db.String(50), nullable=True)
    ph_id = db.Column(db.String(50), nullable=True)
    last_visit = db.Column(db.String(50), nullable=True)
    risk_level = db.Column(db.String(50), default="Moderate")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Cascade Relationships
    vitals = db.relationship('Vital', back_populates='patient', lazy=True, cascade='all, delete-orphan')
    dispensations = db.relationship('Dispensation', back_populates='patient', lazy=True, cascade='all, delete-orphan')
    appointments = db.relationship('Appointment', back_populates='patient', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name or f"{self.first_name} {self.last_name}".strip(),
            'first_name': self.first_name,
            'last_name': self.last_name,
            'middle_name': self.middle_name,
            'age': self.age,
            'sex': self.sex or self.gender,
            'contact': self.contact_number,
            'purok': self.purok,
            'address': self.address,
            'condition': self.condition or self.medical_status,
            'diagnosis_date': self.diagnosis_date,
            'ph_id': self.ph_id,
            'last_visit': self.last_visit,
            'risk_level': self.risk_level,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ==============================================================================
# 3. Medicine Inventory & Supply Model
# ==============================================================================
class Inventory(db.Model):
    __tablename__ = 'inventory'

    id = db.Column(db.Integer, primary_key=True)
    item_name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), default='Antihypertensive')
    batch_no = db.Column(db.String(50), nullable=True)
    dosage = db.Column(db.String(50), nullable=True)
    quantity = db.Column(db.Integer, default=0)
    current_stock = db.Column(db.Integer, default=0)
    unit = db.Column(db.String(20), default='tabs')
    reorder_level = db.Column(db.Integer, default=20)
    status = db.Column(db.String(50), default='Adequate')
    expiration_date = db.Column(db.Date, nullable=True)  # Supply shelf-life tracking
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    dispensations = db.relationship('Dispensation', back_populates='inventory_item', lazy=True)

    def to_dict(self):
        stock = self.current_stock if self.current_stock is not None else self.quantity
        return {
            'id': self.id,
            'item_name': self.item_name,
            'category': self.category,
            'batch_no': self.batch_no,
            'dosage': self.dosage,
            'current_stock': stock,
            'quantity': stock,
            'unit': self.unit,
            'reorder_level': self.reorder_level,
            'status': self.status,
            'expiration_date': self.expiration_date.isoformat() if self.expiration_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Backwards compatibility alias
InventoryItem = Inventory


# ==============================================================================
# 4. Appointment & Follow-Up Schedule Model
# ==============================================================================
class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    # Strict Foreign Key Constraints
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=True)
    user_id = db.Column(db.String(20), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    patient_name = db.Column(db.String(150), nullable=True)
    title = db.Column(db.String(100), nullable=True)
    category = db.Column(db.String(50), default='Monthly HPN Check')
    scheduled_date = db.Column(db.Date, nullable=False)
    purok = db.Column(db.String(100), nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    notes = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default='Pending') # 'Pending', 'Completed', 'Defaulted', 'Cancelled'
    completed_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Strict Relationships
    patient = db.relationship('Patient', back_populates='appointments')
    user = db.relationship('User', back_populates='appointments')

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'user_id': self.user_id,
            'patient_name': self.patient_name,
            'category': self.category,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'purok': self.purok,
            'remarks': self.remarks or self.notes,
            'status': self.status,
            'completed_date': self.completed_date.isoformat() if self.completed_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ==============================================================================
# 5. Audit Log Model (System & Clinical Security Tracking)
# ==============================================================================
class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(20), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text, nullable=True)

    # Relationships
    user = db.relationship('User', back_populates='audit_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'action': self.action,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'details': self.details
        }

# Backwards compatibility alias
ActivityLog = AuditLog


# ==============================================================================
# 6. Clinical Vitals & Consultation Ledger Model
# ==============================================================================
class Vital(db.Model):
    __tablename__ = 'vitals'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    blood_pressure = db.Column(db.String(20), nullable=True)
    sys_bp = db.Column(db.Integer, nullable=True)
    dia_bp = db.Column(db.Integer, nullable=True)
    glucose = db.Column(db.Integer, nullable=True)
    temperature = db.Column(db.Float, nullable=True)
    heart_rate = db.Column(db.Integer, nullable=True)
    weight = db.Column(db.Float, nullable=True)
    height = db.Column(db.Float, nullable=True)
    bmi_result = db.Column(db.String(50), nullable=True)
    risk_level = db.Column(db.String(50), nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    patient = db.relationship('Patient', back_populates='vitals')


# ==============================================================================
# 7. Medicine Dispensation Ledger Model
# ==============================================================================
class Dispensation(db.Model):
    __tablename__ = 'dispensations'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id', ondelete='CASCADE'), nullable=False)
    quantity_dispensed = db.Column(db.Integer, nullable=False)
    dispensed_by = db.Column(db.String(80), nullable=False) # BHW username or Midwife
    dispensed_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    patient = db.relationship('Patient', back_populates='dispensations')
    inventory_item = db.relationship('Inventory', back_populates='dispensations')
