from app import app
from models import db, User, Patient, Inventory, Vital, Dispensation, Appointment, AuditLog
from werkzeug.security import generate_password_hash
from datetime import date, timedelta
import random

def seed_data():
    with app.app_context():
        # Create all tables if they don't exist
        db.create_all()
        
        # Check if users already exist to avoid duplication
        if User.query.first():
            print("Database already contains data. Skipping seed.")
            return

        # 7 BHWs setup with full names, usernames, and purok addresses
        bhw_data = [
            {"username": "charisma", "full_name": "Charisma Astronomo", "purok": "Purok 1, Poblacion 2, Nagcarlan, Laguna", "count": 5},
            {"username": "marisa", "full_name": "Marisa Pullan", "purok": "Purok 2, Poblacion 2, Nagcarlan, Laguna", "count": 4},
            {"username": "thess", "full_name": "Marites Torres", "purok": "Purok 3, Poblacion 2, Nagcarlan, Laguna", "count": 4},
            {"username": "flora", "full_name": "Flora Angeles", "purok": "Purok 4, Poblacion 2, Nagcarlan, Laguna", "count": 5},
            {"username": "grace", "full_name": "Grace Yretarino", "purok": "Purok 5, Poblacion 2, Nagcarlan, Laguna", "count": 4},
            {"username": "michelle", "full_name": "Michelle Oboza", "purok": "Purok 6, Poblacion 2, Nagcarlan, Laguna", "count": 4},
            {"username": "violy", "full_name": "Violeta Esmijarda", "purok": "Purok 7, Poblacion 2, Nagcarlan, Laguna", "count": 4}
        ]

        bhw_address_map = {bhw["username"]: bhw["purok"] for bhw in bhw_data}

        created_users = {}
        for bhw in bhw_data:
            user = User(
                username=bhw["username"],
                password_hash=generate_password_hash("password123"),
                role="bhw",
                full_name=bhw["full_name"],
                station=bhw["purok"]
            )
            db.session.add(user)
            db.session.flush() # Flush to get user.id
            created_users[bhw["username"]] = user.id
            
            # Add initial audit log for account setup
            log = AuditLog(
                user_id=user.id,
                action=f"Registered account for {bhw['full_name']} ({bhw['purok']})"
            )
            db.session.add(log)
        
        db.session.commit()

        # 30 Patients with specific medical status
        sample_data_pool = [
            # Charisma's 5 patients (Purok 1)
            ("Juan", "Dela Cruz", "09123456789", "charisma", "Hypertensive"),
            ("Ana", "Gonzales", "09182223344", "charisma", "General Health Maintenance"),
            ("Elena", "Flores", "09258889900", "charisma", "Diabetic"),
            ("Ernesto", "Rivera", "09303334455", "charisma", "Hypertensive & Diabetic"),
            ("Gloria", "Cruz", "09358889900", "charisma", "General Health Maintenance"),

            # Marisa's 4 patients (Purok 2)
            ("Maria", "Santos", "09198765432", "marisa", "Hypertensive"),
            ("Clara", "Aquino", "09214445566", "marisa", "Diabetic"),
            ("Manuel", "Soriano", "09269990011", "marisa", "Hypertensive"),
            ("Corazon", "Navarro", "09314445566", "marisa", "General Health Maintenance"),

            # Thess/Marites's 4 patients (Purok 3)
            ("Jose", "Reyes", "09171112233", "thess", "Hypertensive & Diabetic"),
            ("Luz", "Villanueva", "09236667788", "thess", "General Health Maintenance"),
            ("Francisco", "Castillo", "09281112233", "thess", "Hypertensive"),
            ("Imelda", "Tolentino", "09336667788", "thess", "Diabetic"),

            # Flora's 5 patients (Purok 4)
            ("Pedro", "Bautista", "09203334455", "flora", "Hypertensive"),
            ("Antonio", "Ramos", "09247778899", "flora", "Hypertensive & Diabetic"),
            ("Rosa", "Pascual", "09292223344", "flora", "General Health Maintenance"),
            ("Eduardo", "Salazar", "09347778899", "flora", "Hypertensive"),
            ("Rosita", "Valdez", "09392223344", "flora", "Diabetic"),

            # Grace's 4 patients (Purok 5)
            ("Roberto", "Garcia", "09225556677", "grace", "Hypertensive"),
            ("Teresa", "Mendoza", "09270001122", "grace", "General Health Maintenance"),
            ("Ricardo", "Mercado", "09325556677", "grace", "Diabetic"),
            ("Carmen", "Macaraeg", "09370001122", "grace", "General Health Maintenance"),

            # Michelle's 4 patients (Purok 6)
            ("Fernando", "De Leon", "09369990011", "michelle", "Hypertensive"),
            ("Rolando", "Hernandez", "09381112233", "michelle", "Hypertensive & Diabetic"),
            ("Lilibeth", "Macalintal", "09414445566", "michelle", "General Health Maintenance"),
            ("Marilou", "Alvarez", "09436667788", "michelle", "Diabetic"),

            # Violy/Violeta's 4 patients (Purok 7)
            ("Gabriel", "Corpuz", "09403334455", "violy", "Hypertensive"),
            ("Danilo", "Dimacuha", "09425556677", "violy", "Diabetic"),
            ("Vicente", "Espeleta", "09447778899", "violy", "Hypertensive"),
            ("Jocelyn", "Panganiban", "09458889900", "violy", "General Health Maintenance")
        ]

        inserted_patients = []
        for p in sample_data_pool:
            fname, lname, contact, bhw_username, med_status = p[0], p[1], p[2], p[3], p[4]
            patient_address = bhw_address_map.get(bhw_username, "Poblacion 2, Nagcarlan, Laguna")
            
            patient = Patient(
                first_name=fname,
                last_name=lname,
                name=f"{fname} {lname}",
                gender="Female" if fname in ["Ana", "Elena", "Gloria", "Maria", "Clara", "Corazon", "Luz", "Imelda", "Rosa", "Rosita", "Teresa", "Carmen", "Lilibeth", "Marilou", "Jocelyn"] else "Male",
                contact_number=contact,
                address=patient_address,
                assigned_bhw=bhw_username,
                medical_status=med_status,
                condition=med_status
            )
            db.session.add(patient)
            inserted_patients.append(patient)
        
        db.session.commit()

        # Seed Inventory items (using 'Inventory' model)
        inventory_items = [
            Inventory(item_name="Losartan 50mg Tablet", category="Antihypertensive", quantity=250, expiration_date=date(2027, 8, 15), dosage="50mg", unit="tabs", status="Adequate", batch_no="LOT-2026-01"),
            Inventory(item_name="Amlodipine 10mg Tablet", category="Antihypertensive", quantity=200, expiration_date=date(2027, 6, 30), dosage="10mg", unit="tabs", status="Adequate", batch_no="LOT-2026-02"),
            Inventory(item_name="Metoprolol 50mg Tablet", category="Antihypertensive", quantity=150, expiration_date=date(2027, 5, 20), dosage="50mg", unit="tabs", status="Adequate", batch_no="LOT-2026-03"),
            Inventory(item_name="Clopidogrel 75mg Tablet", category="Cardiovascular", quantity=120, expiration_date=date(2027, 9, 10), dosage="75mg", unit="tabs", status="Adequate", batch_no="LOT-2026-04"),
            Inventory(item_name="Metformin 500mg Tablet", category="Anti-Diabetic", quantity=300, expiration_date=date(2027, 10, 12), dosage="500mg", unit="tabs", status="Adequate", batch_no="LOT-2026-05"),
            Inventory(item_name="Gliclazide 80mg Tablet", category="Anti-Diabetic", quantity=180, expiration_date=date(2027, 7, 25), dosage="80mg", unit="tabs", status="Adequate", batch_no="LOT-2026-06"),
            Inventory(item_name="Insulin Regular (Human) Vial", category="Anti-Diabetic", quantity=25, expiration_date=date(2026, 12, 31), dosage="10ml", unit="vials", status="Adequate", batch_no="LOT-2026-07"),
            Inventory(item_name="Blood Glucose Test Strips (Box of 50)", category="Diagnostic", quantity=15, expiration_date=date(2027, 4, 10), dosage="N/A", unit="boxes", status="Low", batch_no="LOT-2026-08"),
            Inventory(item_name="Paracetamol 500mg Tablet", category="Analgesic", quantity=500, expiration_date=date(2028, 1, 15), dosage="500mg", unit="tabs", status="Adequate", batch_no="LOT-2026-09"),
            Inventory(item_name="Vitamin C 500mg Ascorbic Acid", category="Vitamin", quantity=400, expiration_date=date(2028, 3, 30), dosage="500mg", unit="tabs", status="Adequate", batch_no="LOT-2026-10"),
            Inventory(item_name="Disposable Syringes 3ml", category="Supplies", quantity=300, expiration_date=date(2028, 6, 1), dosage="3ml", unit="pcs", status="Adequate", batch_no="LOT-2026-11")
        ]

        for item in inventory_items:
            db.session.add(item)
        db.session.commit()

        # Seed Baseline Vitals, Dispensations, and Appointments
        random.seed(42)
        bp_list = ["120/80", "130/85", "118/78", "140/90", "125/82", "135/88", "115/75", "142/91"]
        
        losartan_item = Inventory.query.filter_by(item_name="Losartan 50mg Tablet").first()
        metformin_item = Inventory.query.filter_by(item_name="Metformin 500mg Tablet").first()

        for patient in inserted_patients:
            # Add Vitals
            vital = Vital(
                patient_id=patient.id,
                blood_pressure=random.choice(bp_list),
                temperature=round(random.uniform(36.4, 37.1), 1),
                heart_rate=random.randint(72, 88),
                weight=round(random.uniform(50.0, 75.0), 1),
                height=round(random.uniform(150.0, 175.0), 1)
            )
            db.session.add(vital)

            # Add Dispensations based on medical status
            if "Hypertensive" in patient.medical_status and losartan_item:
                disp = Dispensation(
                    patient_id=patient.id,
                    inventory_id=losartan_item.id,
                    quantity_dispensed=30,
                    dispensed_by=patient.assigned_bhw
                )
                db.session.add(disp)
            
            if "Diabetic" in patient.medical_status and metformin_item:
                disp2 = Dispensation(
                    patient_id=patient.id,
                    inventory_id=metformin_item.id,
                    quantity_dispensed=30,
                    dispensed_by=patient.assigned_bhw
                )
                db.session.add(disp2)

            # Add Appointments (Check-up schedule linking user and patient)
            apt_date = date.today() + timedelta(days=random.randint(1, 14))
            user_id_val = created_users.get(patient.assigned_bhw)
            
            apt = Appointment(
                patient_id=patient.id,
                user_id=user_id_val,
                patient_name=patient.name,
                title=f"Monthly Check-up & Maintenance Review",
                category="Check-up",
                scheduled_date=apt_date,
                status="Pending",
                notes=f"Assigned BHW: {patient.assigned_bhw.capitalize()} - Status: {patient.medical_status}"
            )
            db.session.add(apt)

        db.session.commit()
        print("Successfully seeded full comprehensive database matching columns, audit logs, inventory expirations, and password hashing!")

if __name__ == "__main__":
    seed_data()