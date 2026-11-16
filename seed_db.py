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
from models import db, User, Patient, Inventory, Vital, Dispensation, Appointment, UpcomingEvent, AuditLog, PatientFile, Consultation


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

        # 3. Seed Inventory items (30+ items with generic names, valid categories, and dosages)
        print("[DB Seed] Seeding medicine inventory items...")
        inventory_items = [
            Inventory(item_name="Losartan", category="Antihypertensive (HPN Maintenance)", quantity=350, current_stock=350, expiration_date=date(2027, 8, 15), dosage="50mg", unit="tabs", status="Adequate", batch_no="LOT-2026-01"),
            Inventory(item_name="Amlodipine", category="Antihypertensive (HPN Maintenance)", quantity=280, current_stock=280, expiration_date=date(2027, 6, 30), dosage="10mg", unit="tabs", status="Adequate", batch_no="LOT-2026-02"),
            Inventory(item_name="Amlodipine", category="Antihypertensive (HPN Maintenance)", quantity=200, current_stock=200, expiration_date=date(2027, 5, 15), dosage="5mg", unit="tabs", status="Adequate", batch_no="LOT-2026-02B"),
            Inventory(item_name="Metoprolol", category="Antihypertensive (HPN Maintenance)", quantity=220, current_stock=220, expiration_date=date(2027, 5, 20), dosage="50mg", unit="tabs", status="Adequate", batch_no="LOT-2026-03"),
            Inventory(item_name="Telmisartan", category="Antihypertensive (HPN Maintenance)", quantity=150, current_stock=150, expiration_date=date(2027, 11, 10), dosage="40mg", unit="tabs", status="Adequate", batch_no="LOT-2026-12"),
            Inventory(item_name="Carvedilol", category="Antihypertensive (HPN Maintenance)", quantity=140, current_stock=140, expiration_date=date(2027, 12, 5), dosage="25mg", unit="tabs", status="Adequate", batch_no="LOT-2026-13"),
            Inventory(item_name="Captopril", category="Antihypertensive (HPN Maintenance)", quantity=100, current_stock=100, expiration_date=date(2027, 7, 22), dosage="25mg", unit="tabs", status="Adequate", batch_no="LOT-2026-14"),
            Inventory(item_name="Hydrochlorothiazide", category="Antihypertensive (HPN Maintenance)", quantity=120, current_stock=120, expiration_date=date(2027, 9, 18), dosage="25mg", unit="tabs", status="Adequate", batch_no="LOT-2026-15"),
            Inventory(item_name="Metformin", category="Anti-diabetic (DM Maintenance)", quantity=450, current_stock=450, expiration_date=date(2027, 10, 12), dosage="500mg", unit="tabs", status="Adequate", batch_no="LOT-2026-05"),
            Inventory(item_name="Metformin", category="Anti-diabetic (DM Maintenance)", quantity=200, current_stock=200, expiration_date=date(2027, 11, 25), dosage="850mg", unit="tabs", status="Adequate", batch_no="LOT-2026-05B"),
            Inventory(item_name="Gliclazide", category="Anti-diabetic (DM Maintenance)", quantity=250, current_stock=250, expiration_date=date(2027, 7, 25), dosage="80mg", unit="tabs", status="Adequate", batch_no="LOT-2026-06"),
            Inventory(item_name="Gliclazide", category="Anti-diabetic (DM Maintenance)", quantity=180, current_stock=180, expiration_date=date(2027, 8, 30), dosage="30mg MR", unit="tabs", status="Adequate", batch_no="LOT-2026-06B"),
            Inventory(item_name="Glimepiride", category="Anti-diabetic (DM Maintenance)", quantity=160, current_stock=160, expiration_date=date(2027, 10, 5), dosage="2mg", unit="tabs", status="Adequate", batch_no="LOT-2026-16"),
            Inventory(item_name="Insulin Regular", category="Anti-diabetic (DM Maintenance)", quantity=40, current_stock=40, expiration_date=date(2026, 12, 31), dosage="100 IU/ml", unit="vials", status="Adequate", batch_no="LOT-2026-07"),
            Inventory(item_name="Insulin NPH", category="Anti-diabetic (DM Maintenance)", quantity=35, current_stock=35, expiration_date=date(2027, 1, 20), dosage="100 IU/ml", unit="vials", status="Adequate", batch_no="LOT-2026-17"),
            Inventory(item_name="Empagliflozin", category="Anti-diabetic (DM Maintenance)", quantity=90, current_stock=90, expiration_date=date(2027, 9, 15), dosage="10mg", unit="tabs", status="Adequate", batch_no="LOT-2026-18"),
            Inventory(item_name="Atorvastatin", category="Statin / Lipid-lowering", quantity=300, current_stock=300, expiration_date=date(2027, 8, 10), dosage="20mg", unit="tabs", status="Adequate", batch_no="LOT-2026-19"),
            Inventory(item_name="Simvastatin", category="Statin / Lipid-lowering", quantity=200, current_stock=200, expiration_date=date(2027, 6, 25), dosage="20mg", unit="tabs", status="Adequate", batch_no="LOT-2026-20"),
            Inventory(item_name="Rosuvastatin", category="Statin / Lipid-lowering", quantity=120, current_stock=120, expiration_date=date(2027, 11, 18), dosage="10mg", unit="tabs", status="Adequate", batch_no="LOT-2026-21"),
            Inventory(item_name="Fenofibrate", category="Statin / Lipid-lowering", quantity=110, current_stock=110, expiration_date=date(2027, 5, 12), dosage="160mg", unit="tabs", status="Adequate", batch_no="LOT-2026-22"),
            Inventory(item_name="Clopidogrel", category="Cardiovascular Support", quantity=220, current_stock=220, expiration_date=date(2027, 9, 10), dosage="75mg", unit="tabs", status="Adequate", batch_no="LOT-2026-04"),
            Inventory(item_name="Aspirin", category="Cardiovascular Support", quantity=300, current_stock=300, expiration_date=date(2027, 12, 15), dosage="80mg", unit="tabs", status="Adequate", batch_no="LOT-2026-23"),
            Inventory(item_name="Isosorbide Mononitrate", category="Cardiovascular Support", quantity=140, current_stock=140, expiration_date=date(2027, 7, 8), dosage="30mg MR", unit="tabs", status="Adequate", batch_no="LOT-2026-24"),
            Inventory(item_name="Nitroglycerin", category="Emergency Supply", quantity=50, current_stock=50, expiration_date=date(2027, 4, 15), dosage="0.5mg", unit="tabs", status="Adequate", batch_no="LOT-2026-25"),
            Inventory(item_name="Epinephrine", category="Emergency Supply", quantity=25, current_stock=25, expiration_date=date(2027, 3, 30), dosage="1mg/ml", unit="ampules", status="Adequate", batch_no="LOT-2026-26"),
            Inventory(item_name="Furosemide", category="Emergency Supply", quantity=30, current_stock=30, expiration_date=date(2027, 6, 20), dosage="20mg/2ml", unit="ampules", status="Adequate", batch_no="LOT-2026-27"),
            Inventory(item_name="Paracetamol", category="Analgesic / Antipyretic", quantity=600, current_stock=600, expiration_date=date(2028, 1, 15), dosage="500mg", unit="tabs", status="Adequate", batch_no="LOT-2026-09"),
            Inventory(item_name="Ibuprofen", category="Analgesic / Antipyretic", quantity=250, current_stock=250, expiration_date=date(2027, 10, 18), dosage="400mg", unit="tabs", status="Adequate", batch_no="LOT-2026-28"),
            Inventory(item_name="Vitamin C", category="Vitamin / Supplement", quantity=500, current_stock=500, expiration_date=date(2028, 3, 30), dosage="500mg", unit="tabs", status="Adequate", batch_no="LOT-2026-10"),
            Inventory(item_name="Vitamin B-Complex", category="Vitamin / Supplement", quantity=400, current_stock=400, expiration_date=date(2028, 2, 20), dosage="100mg/5mg/50mcg", unit="tabs", status="Adequate", batch_no="LOT-2026-29"),
            Inventory(item_name="Calcium Carbonate + Vit D3", category="Vitamin / Supplement", quantity=250, current_stock=250, expiration_date=date(2028, 4, 10), dosage="600mg/400IU", unit="tabs", status="Adequate", batch_no="LOT-2026-30"),
            Inventory(item_name="Blood Glucose Test Strips", category="Diagnostic / Medical Supplies", quantity=45, current_stock=45, expiration_date=date(2027, 4, 10), dosage="Box of 50", unit="boxes", status="Adequate", batch_no="LOT-2026-08"),
            Inventory(item_name="Disposable Syringes", category="Diagnostic / Medical Supplies", quantity=400, current_stock=400, expiration_date=date(2028, 6, 1), dosage="3ml", unit="pcs", status="Adequate", batch_no="LOT-2026-11"),
            Inventory(item_name="Disposable Syringes", category="Diagnostic / Medical Supplies", quantity=350, current_stock=350, expiration_date=date(2028, 5, 15), dosage="1ml Insulin", unit="pcs", status="Adequate", batch_no="LOT-2026-31"),
            Inventory(item_name="Sterile Lancets", category="Diagnostic / Medical Supplies", quantity=50, current_stock=50, expiration_date=date(2028, 7, 20), dosage="Box of 100", unit="boxes", status="Adequate", batch_no="LOT-2026-32"),
            Inventory(item_name="Alcohol Swabs", category="Diagnostic / Medical Supplies", quantity=60, current_stock=60, expiration_date=date(2028, 8, 15), dosage="Box of 100", unit="boxes", status="Adequate", batch_no="LOT-2026-33")
        ]

        for item in inventory_items:
            db.session.add(item)
        db.session.commit()

        # 4. Seed Baseline Vitals, Consultations, Dispensations, and Appointments
        print("[DB Seed] Seeding vitals, consultations, dispensations, and appointments...")
        random.seed(42)

        losartan_item = Inventory.query.filter_by(item_name="Losartan").first()
        metformin_item = Inventory.query.filter_by(item_name="Metformin").first()

        for patient in inserted_patients:
            cond = patient.condition or "Hypertension Only"
            is_hpn = "Hypertension" in cond
            is_dm = "Diabet" in cond

            # Generate 3 distinct historical clinical visits per patient (at least 3 per patient)
            # Visit 1: ~65-75 days ago (Early Sep 2026)
            # Visit 2: ~35-45 days ago (Early Oct 2026)
            # Visit 3: ~5-12 days ago (Early Nov 2026)
            visit_offsets = [65 + (patient.id % 10), 35 + (patient.id % 10), 5 + (patient.id % 7)]

            p_base_wt = round(52.0 + ((patient.id * 1.7) % 28), 1)
            p_ht = round(152.0 + ((patient.id * 2.3) % 22), 1)
            bmi_val = round(p_base_wt / ((p_ht / 100) ** 2), 1)
            bmi_cat = "Normal" if bmi_val < 25 else ("Overweight" if bmi_val < 30 else "Obese")
            bmi_res = f"{bmi_val} ({bmi_cat})"

            for v_idx, offset_days in enumerate(visit_offsets):
                visit_date = date.today() - timedelta(days=offset_days)
                visit_dt = datetime.combine(visit_date, datetime.min.time()).replace(hour=8 + (patient.id % 4), minute=15 * (v_idx + 1))
                visit_date_str = visit_date.isoformat()

                # Vitals & BP/Glucose based on condition progression across visits
                if is_hpn and is_dm:
                    # Both: Gradual improvement over 3 visits
                    sys_bp = [156, 144, 134][v_idx] + ((patient.id % 5) - 2)
                    dia_bp = [98, 92, 86][v_idx] + ((patient.id % 3) - 1)
                    glucose = [188, 158, 132][v_idx] + ((patient.id % 7) - 3)
                    remarks_pool = [
                        "Baseline dual review. Elevated BP and hyperglycemia; dual maintenance therapy reinforced.",
                        "Follow-up visit. BP and glycemic index improving; advised adherence to low-sodium/low-glycemic meal plan.",
                        "Monthly maintenance check. Conditions stabilized on current regimen; 30-day refills dispensed."
                    ]
                elif is_dm:
                    # Diabetes Only: Normal BP, elevated glucose improving
                    sys_bp = 118 + (patient.id % 6)
                    dia_bp = 76 + (patient.id % 4)
                    glucose = [182, 152, 126][v_idx] + ((patient.id % 7) - 3)
                    remarks_pool = [
                        "Target client intake. Fasting blood sugar elevated; counseling on dietary sugar restriction and Metformin.",
                        "Follow-up glycemic review. Glucose level decreased; patient compliant with morning dosages.",
                        "Routine consultation. Glycemic control near target; maintenance supply refilled for 30 days."
                    ]
                else:
                    # Hypertension Only: Elevated BP improving, normal glucose
                    sys_bp = [152, 142, 130][v_idx] + ((patient.id % 5) - 2)
                    dia_bp = [96, 90, 84][v_idx] + ((patient.id % 3) - 1)
                    glucose = 92 + (patient.id % 15)
                    remarks_pool = [
                        "Quarterly hypertension intake. BP elevated; Losartan maintenance adherence and low-salt intake advised.",
                        "Monthly follow-up. Blood pressure stabilizing; patient reports no headache or dizziness.",
                        "Routine check-up. Blood pressure controlled; 30-day maintenance supply dispensed."
                    ]

                remarks = remarks_pool[v_idx]

                # Risk stratification
                if sys_bp >= 160 or dia_bp >= 100 or glucose >= 180:
                    risk_level = "High Risk"
                elif sys_bp >= 140 or dia_bp >= 90 or glucose >= 140:
                    risk_level = "Moderate"
                else:
                    risk_level = "Stable"

                vital = Vital(
                    patient_id=patient.id,
                    blood_pressure=f"{sys_bp}/{dia_bp}",
                    sys_bp=sys_bp,
                    dia_bp=dia_bp,
                    glucose=glucose,
                    temperature=round(36.4 + ((patient.id + v_idx) % 7) * 0.1, 1),
                    heart_rate=72 + ((patient.id * 3 + v_idx * 5) % 16),
                    weight=round(p_base_wt + (v_idx * 0.2), 1),
                    height=p_ht,
                    bmi_result=bmi_res,
                    risk_level=risk_level,
                    remarks=remarks,
                    recorded_at=visit_dt
                )
                db.session.add(vital)

                consult = Consultation(
                    patient_name=patient.name,
                    sys_bp=sys_bp,
                    dia_bp=dia_bp,
                    glucose=glucose,
                    weight=round(p_base_wt + (v_idx * 0.2), 1),
                    height=p_ht,
                    bmi_result=bmi_res,
                    risk_level=risk_level,
                    remarks=remarks,
                    consult_date=visit_date_str,
                    created_at=visit_dt
                )
                db.session.add(consult)

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
            if patient.condition == "Diabetes Only":
                apt_type = "Diabetes Follow-up"
            elif patient.id in [9, 15, 24]:
                apt_type = "Medicine Refill"
            elif patient.id in [12, 29]:
                apt_type = "Purok Assembly"
            else:
                apt_type = "Monthly HPN Check"

            apt = Appointment(
                patient_id=patient.id,
                user_id=patient.handler_id,
                patient_name=patient.name,
                title="Monthly Check-up & Maintenance Review",
                type=apt_type,
                category=apt_type,
                scheduled_date=apt_date,
                status="Pending",
                notes=f"Handler ID: {patient.handler_id} - Condition: {patient.condition}"
            )
            db.session.add(apt)

        # 5. Seed Baseline Upcoming Community Events (30+ records)
        print("[DB Seed] Seeding upcoming community events...")
        sample_evts = [
            UpcomingEvent(date=date(2026, 11, 18), type="Health Campaign", details="Barangay-wide hypertension and diabetes screening and wellness assembly.", location="Poblacion 2 Plaza", status="Completed"),
            UpcomingEvent(date=date(2026, 11, 20), type="Outreach Mission", details="Mobile clinic consultation and medicine distribution for Sitio Ilaya seniors.", location="Purok 1 Health Station", status="Pending"),
            UpcomingEvent(date=date(2026, 11, 22), type="Community Assembly", details="Monthly Senior Citizen health forum and PhilHealth Konsulta orientation.", location="Poblacion 2 Barangay Hall", status="Pending"),
            UpcomingEvent(date=date(2026, 11, 24), type="Health Campaign", details="Youth & Adult cardiovascular fitness, BMI calculation, and diet coaching.", location="Poblacion 2 Plaza", status="Pending"),
            UpcomingEvent(date=date(2026, 11, 25), type="Training Seminar", details="BHW technical refresher on digital vitals capture and cardiovascular risk stratification.", location="Nagcarlan RHU Conference Room", status="Pending"),
            UpcomingEvent(date=date(2026, 11, 27), type="Community Assembly", details="Purok 2 community health consultation on daily sodium reduction.", location="Purok 2 Multi-Purpose Hall", status="Pending"),
            UpcomingEvent(date=date(2026, 11, 29), type="Admin Meeting", details="Quarterly primary healthcare coordination meeting with Municipal Health Officer.", location="Municipal Health Office", status="Pending"),
            UpcomingEvent(date=date(2026, 11, 30), type="Outreach Mission", details="Home visits and blood pressure check-ups for bedridden hypertension patients.", location="Purok 3 Covered Court", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 2), type="Health Campaign", details="National Diabetes Awareness Week free blood glucose and HbA1c testing.", location="Poblacion 2 Barangay Hall", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 4), type="Outreach Mission", details="Mobile clinical team visiting remote sitios for medicine refills and consultations.", location="Purok 6 Covered Court", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 6), type="Community Assembly", details="Sitio Centro monthly wellness and PhilHealth Konsulta onboarding drive.", location="Purok 1 Health Station", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 8), type="Training Seminar", details="Hands-on training for BHWs on emergency blood pressure triage and stabilization.", location="Nagcarlan RHU Conference Room", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 10), type="Admin Meeting", details="Monthly medicine inventory audit and stock replenishment review meeting.", location="Poblacion 2 Office", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 12), type="Outreach Mission", details="Remote medication refills distribution for Purok 4 and 5 maintenance clients.", location="Purok 4 Community Center", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 14), type="Health Campaign", details="Eye and kidney microvascular screening caravan for chronic diabetic patients.", location="Municipal Gym", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 16), type="Community Assembly", details="Purok 3 Assembly on healthy holiday dining with hypertension and diabetes.", location="Purok 3 Covered Court", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 18), type="Admin Meeting", details="Year-end BHW accomplishment review and target client registry reconciliation.", location="Municipal Health Office", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 20), type="Outreach Mission", details="Pre-holiday chronic disease monitoring and home medicine delivery.", location="Purok 7 Health Outpost", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 22), type="Community Assembly", details="Barangay Health Council community presentation on 2026 NCD control targets.", location="Poblacion 2 Barangay Hall", status="Pending"),
            UpcomingEvent(date=date(2026, 12, 28), type="Health Campaign", details="Year-end hypertension blood pressure re-assessment and medication adherence check.", location="Poblacion 2 Plaza", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 5), type="Admin Meeting", details="New Year primary care planning meeting with Municipal Health Officer.", location="Municipal Health Office", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 8), type="Training Seminar", details="2027 TCR digital record-keeping refresher and privacy compliance orientation.", location="Nagcarlan RHU Conference Room", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 12), type="Health Campaign", details="New Year Healthy Heart campaign: Community brisk walking and vitals screening.", location="Poblacion 2 Plaza", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 15), type="Community Assembly", details="Purok 1 general assembly on salt reduction and physical activity.", location="Purok 1 Health Station", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 18), type="Outreach Mission", details="Sitio Ilaya mobile clinical team follow-up for chronic hypertension cases.", location="Purok 2 Health Station", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 22), type="Training Seminar", details="Community nutrition and meal planning seminar for diabetic diet preparation.", location="Poblacion 2 Barangay Hall", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 26), type="Admin Meeting", details="Midwife-BHW case discussion on high-risk cardiovascular cases.", location="Poblacion 2 Office", status="Pending"),
            UpcomingEvent(date=date(2027, 1, 29), type="Outreach Mission", details="Purok 5 outreach mission: Vitals capture and quarterly maintenance refill.", location="Purok 5 Multi-Purpose Hall", status="Pending"),
            UpcomingEvent(date=date(2027, 2, 4), type="Health Campaign", details="World Cancer & Heart Month: Integrated screening for lifestyle diseases.", location="Municipal Gym", status="Pending"),
            UpcomingEvent(date=date(2027, 2, 10), type="Community Assembly", details="Senior Citizens Valentine wellness forum on stress management and heart health.", location="Poblacion 2 Plaza", status="Pending"),
            UpcomingEvent(date=date(2027, 2, 14), type="Outreach Mission", details="Heart Day mobile health team: Free diagnostic testing and blood pressure checks.", location="Purok 6 Covered Court", status="Pending"),
            UpcomingEvent(date=date(2027, 2, 20), type="Training Seminar", details="Advanced clinical monitoring techniques for BHW chronic disease leads.", location="Nagcarlan RHU Conference Room", status="Pending")
        ]
        for evt in sample_evts:
            db.session.add(evt)

        # 6. Seed PATIENT_FILES (30+ records linking to patients)
        print("[DB Seed] Seeding PATIENT_FILES records...")
        file_templates = [
            ("PhilHealth_MDR_Form.pdf", "pdf"),
            ("Barangay_Residency_Cert.pdf", "pdf"),
            ("FBS_Laboratory_Slip.pdf", "pdf"),
            ("HbA1c_Diagnostics_Report.pdf", "pdf"),
            ("Senior_Citizen_ID_Copy.jpg", "jpg"),
            ("12_Lead_ECG_Baseline.png", "png"),
            ("RHU_Prescription_Slip.pdf", "pdf"),
            ("Barangay_Indigency_Cert.pdf", "pdf"),
            ("Urinalysis_Clinical_Test.pdf", "pdf"),
            ("Lipid_Profile_Report.pdf", "pdf"),
            ("Solo_Parent_Verification.jpg", "jpg"),
            ("PWD_Clinical_Assessment.pdf", "pdf")
        ]
        for idx, pt in enumerate(inserted_patients, start=1):
            t1 = file_templates[(idx - 1) % len(file_templates)]
            f1 = PatientFile(
                patient_id=pt.id,
                file_name=f"{pt.first_name}_{t1[0]}",
                file_type=t1[1],
                file_path=f"uploads/{pt.id}_{t1[0]}"
            )
            db.session.add(f1)
            # Add second file for several patients
            if idx in [1, 3, 5, 10, 15, 20]:
                t2 = file_templates[(idx + 4) % len(file_templates)]
                f2 = PatientFile(
                    patient_id=pt.id,
                    file_name=f"{pt.first_name}_{t2[0]}",
                    file_type=t2[1],
                    file_path=f"uploads/{pt.id}_{t2[0]}"
                )
                db.session.add(f2)

        db.session.commit()

        db.session.commit()
        print("[DB Seed] Successfully seeded BWC-HDMS database matching complete TCR form schema!")


if __name__ == "__main__":
    force_run = "--force" in sys.argv or "--reset" in sys.argv
    seed_data(force=force_run)
