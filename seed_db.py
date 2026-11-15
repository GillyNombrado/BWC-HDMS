"""
==============================================================================
Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
Capstone Project - CMSC 309
Module: Database Seeding Script (seed_db.py)
==============================================================================
Initializes the SQLite database with 7 BHW staff accounts and 30 Target Client
Registry (TCR) patient records matching the full "Register New Client in TCR"
schema including:
- Handler ID foreign key reference (YY-NNN format)
- Strictly 12-digit PhilHealth ID without formatting or hyphens
- Clean house/sitio addresses separated from Purok
- Dynamic middle names (some populated, others null/blank)
- Chronic disease diagnosis dates and condition classifications
- Complete emergency contact details (Name, Relationship, Contact Number)
- Multi-selection Government Programs and Health Risks (JSON serialized)
- Allergies and comprehensive Clinical Medical History narratives
==============================================================================
"""

import sys
import json
import random
from datetime import date, timedelta, datetime
from werkzeug.security import generate_password_hash
from app import app
from models import db, User, Patient, Inventory, Vital, Dispensation, Appointment, AuditLog


def seed_data(force=False):
    with app.app_context():
        if force or "--force" in sys.argv or "--reset" in sys.argv:
            print("[DB Seed] Resetting database tables...")
            db.drop_all()

        # Create all database tables
        db.create_all()

        # Prevent duplicate seeding if data exists
        if User.query.first():
            print("[DB Seed] Database already contains records. Skipping seed.")
            return

        print("[DB Seed] Seeding BHW staff accounts...")

        # 1. Seed 7 Barangay Health Workers with sequential YY-NNN IDs
        bhw_data = [
            {"username": "charisma", "full_name": "Charisma Astronomo", "purok": "Purok 1", "address": "Poblacion 2, Nagcarlan, Laguna"},
            {"username": "marisa", "full_name": "Marisa Pullan", "purok": "Purok 2", "address": "Poblacion 2, Nagcarlan, Laguna"},
            {"username": "thess", "full_name": "Marites Torres", "purok": "Purok 3", "address": "Poblacion 2, Nagcarlan, Laguna"},
            {"username": "flora", "full_name": "Flora Angeles", "purok": "Purok 4", "address": "Poblacion 2, Nagcarlan, Laguna"},
            {"username": "grace", "full_name": "Grace Yretarino", "purok": "Purok 5", "address": "Poblacion 2, Nagcarlan, Laguna"},
            {"username": "michelle", "full_name": "Michelle Oboza", "purok": "Purok 6", "address": "Poblacion 2, Nagcarlan, Laguna"},
            {"username": "violy", "full_name": "Violeta Esmijarda", "purok": "Purok 7", "address": "Poblacion 2, Nagcarlan, Laguna"}
        ]

        created_users = {}
        yy = datetime.utcnow().year % 100
        for idx, bhw in enumerate(bhw_data, start=1):
            user_id = f"{yy:02d}-{idx:03d}"
            user = User(
                id=user_id,
                username=bhw["username"],
                password_hash=generate_password_hash("password123"),
                role="bhw",
                full_name=bhw["full_name"],
                purok=bhw["purok"],
                address=bhw["address"],
                station=bhw["purok"]
            )
            db.session.add(user)
            db.session.flush()
            created_users[bhw["username"]] = user.id

            log = AuditLog(
                user_id=user.id,
                action=f"Registered account for {bhw['full_name']} ({bhw['purok']}) [ID: {user.id}]"
            )
            db.session.add(log)

        db.session.commit()
        print(f"[DB Seed] Created {len(created_users)} BHW staff accounts.")

        # 2. Seed 30 Patients with realistic clinical records matching the TCR form
        sample_patients = [
            # Charisma's 5 patients (Purok 1)
            ("Juan", "Dela Cruz", "09123456789", "charisma", "Hypertension Only"),
            ("Ana", "Gonzales", "09182223344", "charisma", "Hypertension Only"),
            ("Elena", "Flores", "09258889900", "charisma", "Diabetes Only"),
            ("Ernesto", "Rivera", "09303334455", "charisma", "Both (Hypertension & Diabetes)"),
            ("Gloria", "Cruz", "09358889900", "charisma", "Hypertension Only"),

            # Marisa's 4 patients (Purok 2)
            ("Maria", "Santos", "09198765432", "marisa", "Hypertension Only"),
            ("Clara", "Aquino", "09214445566", "marisa", "Diabetes Only"),
            ("Manuel", "Soriano", "09269990011", "marisa", "Hypertension Only"),
            ("Corazon", "Navarro", "09314445566", "marisa", "Both (Hypertension & Diabetes)"),

            # Thess/Marites's 4 patients (Purok 3)
            ("Jose", "Reyes", "09171112233", "thess", "Both (Hypertension & Diabetes)"),
            ("Luz", "Villanueva", "09236667788", "thess", "Hypertension Only"),
            ("Francisco", "Castillo", "09281112233", "thess", "Hypertension Only"),
            ("Imelda", "Tolentino", "09336667788", "thess", "Diabetes Only"),

            # Flora's 5 patients (Purok 4)
            ("Pedro", "Bautista", "09203334455", "flora", "Hypertension Only"),
            ("Antonio", "Ramos", "09247778899", "flora", "Both (Hypertension & Diabetes)"),
            ("Rosa", "Pascual", "09292223344", "flora", "Hypertension Only"),
            ("Eduardo", "Salazar", "09347778899", "flora", "Hypertension Only"),
            ("Rosita", "Valdez", "09392223344", "flora", "Diabetes Only"),

            # Grace's 4 patients (Purok 5)
            ("Roberto", "Garcia", "09225556677", "grace", "Hypertension Only"),
            ("Teresa", "Mendoza", "09270001122", "grace", "Both (Hypertension & Diabetes)"),
            ("Ricardo", "Mercado", "09325556677", "grace", "Diabetes Only"),
            ("Carmen", "Macaraeg", "09370001122", "grace", "Hypertension Only"),

            # Michelle's 4 patients (Purok 6)
            ("Fernando", "De Leon", "09369990011", "michelle", "Hypertension Only"),
            ("Rolando", "Hernandez", "09381112233", "michelle", "Both (Hypertension & Diabetes)"),
            ("Lilibeth", "Macalintal", "09414445566", "michelle", "Hypertension Only"),
            ("Marilou", "Alvarez", "09436667788", "michelle", "Diabetes Only"),

            # Violy/Violeta's 4 patients (Purok 7)
            ("Gabriel", "Corpuz", "09403334455", "violy", "Hypertension Only"),
            ("Danilo", "Dimacuha", "09425556677", "violy", "Diabetes Only"),
            ("Vicente", "Espeleta", "09447778899", "violy", "Hypertension Only"),
            ("Jocelyn", "Panganiban", "09458889900", "violy", "Both (Hypertension & Diabetes)")
        ]

        # Clean house/sitio addresses (strictly house/block/sitio, separate from Purok)
        clean_addresses = [
            "House No. 12, Sitio Ilaya",
            "Block 4, Lot 9, Mabini St.",
            "House No. 45, Sitio Riverside",
            "Sitio Ibaba, San Jose Road",
            "House No. 102, Rizal Avenue",
            "Block 5, Lot 12, Sitio Kanluran",
            "House No. 77, Sitio Gitna",
            "Block 1, Lot 3, M.H. Del Pilar St.",
            "House No. 89, Sitio Silangan",
            "Block 3, Lot 15, Bonifacio Drive",
            "House No. 24, Sitio Bukid",
            "Block 7, Lot 2, Mabini Extension",
            "House No. 63, Sitio Ilaya",
            "House No. 31, Rizal St.",
            "Block 2, Lot 5, Sitio Bayan",
            "House No. 118, Sitio Riverside",
            "Block 6, Lot 10, Sitio Kanluran",
            "House No. 54, M.H. Del Pilar St.",
            "House No. 92, Sitio Ilaya",
            "Block 8, Lot 4, Sitio Silangan",
            "House No. 37, Sitio Gitna",
            "Block 1, Lot 11, Bonifacio Drive",
            "House No. 68, Sitio Bukid",
            "House No. 15, Rizal Avenue",
            "Block 4, Lot 1, Sitio Ibaba",
            "House No. 83, Sitio Riverside",
            "Block 3, Lot 8, Sitio Bayan",
            "House No. 49, Sitio Kanluran",
            "House No. 126, Mabini Extension",
            "Block 5, Lot 7, Sitio Ilaya"
        ]

        # Middle name generator: approximately half populated, half null/blank
        middle_name_options = [
            "Santos", None, "Reyes", "Flores", None,
            "Mercado", "Alvarez", None, "Castillo", "Bautista",
            None, "Aquino", "Soriano", None, "Navarro",
            "Villanueva", None, "Tolentino", "Pascual", None,
            "Ramos", "Valdez", "Mendoza", None, "Macaraeg",
            "Hernandez", None, "Macalintal", "Corpuz", None
        ]

        sample_ages = [16, 17, 24, 38, 45, 52, 58, 64, 71]
        sample_risks = ["High Risk", "Moderate", "Stable"]

        # Form-compliant emergency contacts
        emergency_names = [
            "Elena Dela Cruz", "Roberto Gonzales", "Carlos Flores", "Maria Rivera", "Danilo Cruz",
            "Antonio Santos", "Felipe Aquino", "Teresa Soriano", "Luz Navarro", "Carmela Reyes",
            "Benigno Villanueva", "Corazon Castillo", "Jaime Tolentino", "Rosa Bautista", "Emilio Ramos",
            "Arturo Pascual", "Lourdes Salazar", "Rodrigo Valdez", "Milagros Garcia", "Ramon Mendoza",
            "Gloria Mercado", "Nestor Macaraeg", "Consuelo De Leon", "Ferdinand Hernandez", "Lucia Macalintal",
            "Gerardo Alvarez", "Leticia Corpuz", "Melchor Dimacuha", "Josefina Espeleta", "Eduardo Panganiban"
        ]
        emergency_relationships = ["Spouse", "Child / Offspring", "Parent", "Sibling", "Relative / Guardian"]

        # Form-compliant Government Programs (JSON arrays)
        gov_programs_pool = [
            ["Senior Citizen ID Holder", "PhilHealth Konsulta Beneficiary"],
            ["4Ps (Pantawid Pamilyang Pilipino Program)"],
            ["Senior Citizen ID Holder", "PWD (Person with Disability)"],
            ["PhilHealth Konsulta Beneficiary"],
            [],
            ["Solo Parent Assistance"],
            ["4Ps (Pantawid Pamilyang Pilipino Program)", "PhilHealth Konsulta Beneficiary"],
            ["Senior Citizen ID Holder"],
            [],
            ["PWD (Person with Disability)", "Senior Citizen ID Holder"]
        ]

        # Form-compliant Health Risks (strictly from the fixed list)
        health_risks_pool = [
            ["Smoking / Tobacco", "Alcohol Consumption"],
            ["Physical Inactivity"],
            ["Family History of Diabetes"],
            ["Family History of Stroke / CVD", "Physical Inactivity"],
            [],
            ["Smoking / Tobacco", "Family History of Stroke / CVD"],
            ["Alcohol Consumption"],
            ["Family History of Diabetes", "Physical Inactivity"],
            [],
            ["Family History of Stroke / CVD"]
        ]

        allergies_pool = [
            "None reported", "Penicillin", "None reported", "Aspirin", "None reported",
            "Sulfa drugs", "None reported", "Amoxicillin", "None reported", "Ibuprofen"
        ]

        med_history_pool = [
            "Diagnosed with Stage 2 Essential Hypertension during 2023 barangay screening. Compliant with maintenance medications.",
            "Routine intake for adolescent wellness monitoring. No history of chronic illness or hospitalization.",
            "Type 2 diabetes mellitus diagnosed in 2022. Regular fasting blood glucose monitoring at barangay station.",
            "Diagnosed with combined essential hypertension and borderline diabetes. Prescribed combination oral therapy.",
            "Periodic health assessment. Up-to-date immunizations and healthy baseline vitals.",
            "Hypertension managed with daily calcium channel blockers. Under routine monthly BHW blood pressure monitoring.",
            "Type 2 diabetes under dietary control and oral hypoglycemic regimen. Attends monthly health assemblies.",
            "Moderate hypertension diagnosed in 2024. Active lifestyle modifications advised.",
            "Senior citizen baseline health maintenance and cardiovascular monitoring. No prior cardiac events.",
            "Cardiovascular checkup and blood pressure monitoring. Family history of stroke noted on maternal side."
        ]

        diagnosis_dates_pool = [
            "2023-04-15", "2024-01-20", "2022-11-05", "2023-08-30", "2024-06-12",
            "2021-09-18", "2023-12-04", "2024-03-22", "2022-05-14", "2023-10-09"
        ]

        bhw_purok_map = {bhw["username"]: bhw["purok"] for bhw in bhw_data}
        inserted_patients = []

        # Generate unique random 12-digit PhilHealth IDs
        ph_random_gen = random.Random(20261115)
        random_ph_pool = []
        while len(random_ph_pool) < len(sample_patients):
            rand_12 = f"{ph_random_gen.randint(100000, 999999)}{ph_random_gen.randint(100000, 999999)}"
            if rand_12 not in random_ph_pool:
                random_ph_pool.append(rand_12)

        for idx, p in enumerate(sample_patients, start=1):
            fname, lname, contact, bhw_username, cond_val = p[0], p[1], p[2], p[3], p[4]
            handler_id_val = created_users.get(bhw_username, "26-001")
            patient_purok = bhw_purok_map.get(bhw_username, "Purok 1")
            patient_address = clean_addresses[(idx - 1) % len(clean_addresses)]

            # Sex assignment
            is_female = fname in ["Ana", "Elena", "Gloria", "Maria", "Clara", "Corazon", "Luz", "Imelda", "Rosa", "Rosita", "Teresa", "Carmen", "Lilibeth", "Marilou", "Jocelyn"]
            sex_val = "Female" if is_female else "Male"

            # Age and DOB
            age_val = sample_ages[(idx - 1) % len(sample_ages)]
            birth_year = 2026 - age_val
            dob_val = f"{birth_year:04d}-05-15"

            # Middle name: dynamic assignment (some populated, some None)
            mname_val = middle_name_options[(idx - 1) % len(middle_name_options)]
            full_name = f"{fname} {mname_val} {lname}".strip() if mname_val else f"{fname} {lname}".strip()

            # Strictly 12 unique random digits without formatting or hyphens
            ph_12_digits = random_ph_pool[idx - 1]

            risk_val = sample_risks[(idx - 1) % len(sample_risks)]
            diag_date = diagnosis_dates_pool[(idx - 1) % len(diagnosis_dates_pool)]

            emer_name = emergency_names[(idx - 1) % len(emergency_names)]
            emer_rel = emergency_relationships[(idx - 1) % len(emergency_relationships)]
            emer_phone = f"0919{random.randint(1000000, 9999999)}"

            gov_progs_json = json.dumps(gov_programs_pool[(idx - 1) % len(gov_programs_pool)])
            health_risks_json = json.dumps(health_risks_pool[(idx - 1) % len(health_risks_pool)])
            allergy_val = allergies_pool[(idx - 1) % len(allergies_pool)]
            history_val = med_history_pool[(idx - 1) % len(med_history_pool)]

            patient = Patient(
                handler_id=handler_id_val,
                name=full_name,
                first_name=fname,
                middle_name=mname_val,
                last_name=lname,
                dob=dob_val,
                age=age_val,
                sex=sex_val,
                contact_number=contact,
                address=patient_address,
                purok=patient_purok,
                condition=cond_val,
                diagnosis_date=diag_date,
                ph_id=ph_12_digits,
                last_visit="2026-11-10",
                risk_level=risk_val,
                emergency_contact_name=emer_name,
                emergency_contact_relationship=emer_rel,
                emergency_contact_number=emer_phone,
                government_programs=gov_progs_json,
                allergies=allergy_val,
                health_risks=health_risks_json,
                medical_history=history_val
            )
            db.session.add(patient)
            inserted_patients.append(patient)

        db.session.commit()
        print(f"[DB Seed] Created {len(inserted_patients)} TCR patient records with complete form schemas.")

        # 3. Seed Inventory items
        print("[DB Seed] Seeding medicine inventory items...")
        inventory_items = [
            Inventory(item_name="Losartan", category="Antihypertensive", quantity=250, current_stock=250, expiration_date=date(2027, 8, 15), dosage="50mg Tablet", unit="tabs", status="Adequate", batch_no="LOT-2026-01"),
            Inventory(item_name="Amlodipine", category="Antihypertensive", quantity=200, current_stock=200, expiration_date=date(2027, 6, 30), dosage="10mg Tablet", unit="tabs", status="Adequate", batch_no="LOT-2026-02"),
            Inventory(item_name="Metoprolol", category="Antihypertensive", quantity=150, current_stock=150, expiration_date=date(2027, 5, 20), dosage="50mg Tablet", unit="tabs", status="Adequate", batch_no="LOT-2026-03"),
            Inventory(item_name="Clopidogrel", category="Cardiovascular", quantity=120, current_stock=120, expiration_date=date(2027, 9, 10), dosage="75mg Tablet", unit="tabs", status="Adequate", batch_no="LOT-2026-04"),
            Inventory(item_name="Metformin", category="Anti-diabetic", quantity=300, current_stock=300, expiration_date=date(2027, 10, 12), dosage="500mg Tablet", unit="tabs", status="Adequate", batch_no="LOT-2026-05"),
            Inventory(item_name="Gliclazide", category="Anti-diabetic", quantity=180, current_stock=180, expiration_date=date(2027, 7, 25), dosage="80mg Tablet", unit="tabs", status="Adequate", batch_no="LOT-2026-06"),
            Inventory(item_name="Insulin Regular", category="Anti-diabetic", quantity=25, current_stock=25, expiration_date=date(2026, 12, 31), dosage="10ml Vial", unit="vials", status="Adequate", batch_no="LOT-2026-07"),
            Inventory(item_name="Blood Glucose Test Strips", category="Supplies", quantity=15, current_stock=15, expiration_date=date(2027, 4, 10), dosage="Box of 50", unit="boxes", status="Low", batch_no="LOT-2026-08"),
            Inventory(item_name="Paracetamol", category="Analgesic", quantity=500, current_stock=500, expiration_date=date(2028, 1, 15), dosage="500mg Tablet", unit="tabs", status="Adequate", batch_no="LOT-2026-09"),
            Inventory(item_name="Vitamin C", category="Vitamin", quantity=400, current_stock=400, expiration_date=date(2028, 3, 30), dosage="500mg Ascorbic Acid", unit="tabs", status="Adequate", batch_no="LOT-2026-10"),
            Inventory(item_name="Disposable Syringes", category="Supplies", quantity=300, current_stock=300, expiration_date=date(2028, 6, 1), dosage="3ml", unit="pcs", status="Adequate", batch_no="LOT-2026-11")
        ]

        for item in inventory_items:
            db.session.add(item)
        db.session.commit()

        # 4. Seed Baseline Vitals, Dispensations, and Appointments
        print("[DB Seed] Seeding vitals, dispensations, and appointments...")
        random.seed(42)
        bp_list = ["120/80", "130/85", "118/78", "140/90", "125/82", "135/88", "115/75", "142/91"]

        losartan_item = Inventory.query.filter_by(item_name="Losartan").first()
        metformin_item = Inventory.query.filter_by(item_name="Metformin").first()

        for patient in inserted_patients:
            # Baseline Vitals
            vital = Vital(
                patient_id=patient.id,
                blood_pressure=random.choice(bp_list),
                temperature=round(random.uniform(36.4, 37.1), 1),
                heart_rate=random.randint(72, 88),
                weight=round(random.uniform(50.0, 75.0), 1),
                height=round(random.uniform(150.0, 175.0), 1)
            )
            db.session.add(vital)

            # Dispensations
            if "Hypertension" in (patient.condition or "") and losartan_item:
                disp = Dispensation(
                    patient_id=patient.id,
                    inventory_id=losartan_item.id,
                    quantity_dispensed=30,
                    dispensed_by=patient.handler.username if patient.handler else "bhw"
                )
                db.session.add(disp)

            if "Diabet" in (patient.condition or "") and metformin_item:
                disp2 = Dispensation(
                    patient_id=patient.id,
                    inventory_id=metformin_item.id,
                    quantity_dispensed=30,
                    dispensed_by=patient.handler.username if patient.handler else "bhw"
                )
                db.session.add(disp2)

            # Appointments
            apt_date = date.today() + timedelta(days=random.randint(1, 14))
            apt = Appointment(
                patient_id=patient.id,
                user_id=patient.handler_id,
                patient_name=patient.name,
                title="Monthly Check-up & Maintenance Review",
                category="Check-up",
                scheduled_date=apt_date,
                status="Pending",
                notes=f"Handler ID: {patient.handler_id} - Condition: {patient.condition}"
            )
            db.session.add(apt)

        db.session.commit()
        print("[DB Seed] Successfully seeded BWC-HDMS database matching complete TCR form schema!")


if __name__ == "__main__":
    force_run = "--force" in sys.argv or "--reset" in sys.argv
    seed_data(force=force_run)
