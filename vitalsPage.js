/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Consultation & Vitals Logic (vitalsPage.js)
   ==========================================================================
   Description:
   Handles clinical intake for BHWs/Midwives:
   1. Real-time BMI calculation from weight & height.
   2. Risk stratification based on DOH / WHO clinical thresholds.
   3. Automatic 30-day follow-up schedule generation into appointments store.
   4. Dual persistence: LocalStorage + Flask / SQLite backend synchronization.
   ========================================================================== */

const STORAGE_KEY_APPOINTMENTS = 'bwc_appointments_db';
const BACKEND_CONSULT_URL = 'http://127.0.0.1:5000/api/consultations';
const BACKEND_PATIENTS_URL = 'http://127.0.0.1:5000/api/patients';

let registeredPatientsList = [];

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Populate registered patients dropdown
    await populateRegisteredPatients();

    // 2. Attach dynamic onchange listener to update patient info card
    const select = document.getElementById('consultPatient');
    if (select) {
        select.addEventListener('change', () => {
            const chosenName = select.value;
            if (!chosenName) {
                displayPatientInfo(null);
                return;
            }
            const found = registeredPatientsList.find(p => p.name === chosenName) || { name: chosenName };
            displayPatientInfo(found);
        });
    }

    // 3. Automatically input patient information if redirected from TCR / Schedule
    await autoSelectPatientFromRequest();
});

/**
 * Automatically selects and inputs patient information from sessionStorage or URL query params.
 */
async function autoSelectPatientFromRequest() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramName = urlParams.get('patient') || urlParams.get('name');
    const preselectedRaw = sessionStorage.getItem('consult_patient');

    let preselectedObj = null;
    let targetName = paramName ? paramName.trim() : null;

    if (preselectedRaw) {
        try {
            preselectedObj = JSON.parse(preselectedRaw);
            if (preselectedObj && preselectedObj.name) {
                targetName = preselectedObj.name.trim();
            }
        } catch (e) {
            targetName = preselectedRaw.trim();
            preselectedObj = { name: targetName };
        }
        sessionStorage.removeItem('consult_patient');
    }

    if (!targetName) return;

    const select = document.getElementById('consultPatient');
    if (!select) return;

    // Find the patient in registeredPatientsList
    let matchedPatient = registeredPatientsList.find(p => p.name && p.name.trim().toLowerCase() === targetName.toLowerCase());
    if (!matchedPatient) {
        matchedPatient = registeredPatientsList.find(p => p.name && (p.name.toLowerCase().includes(targetName.toLowerCase()) || targetName.toLowerCase().includes(p.name.toLowerCase())));
    }
    if (!matchedPatient && preselectedObj) {
        matchedPatient = preselectedObj;
    }

    // Select in dropdown without ever matching the empty option
    let optionMatched = false;
    for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        if (!opt.value) continue; // CRUCIAL: Never match empty option!
        if (opt.value.trim().toLowerCase() === targetName.toLowerCase() ||
            opt.value.toLowerCase().includes(targetName.toLowerCase()) ||
            targetName.toLowerCase().includes(opt.value.toLowerCase())) {
            select.selectedIndex = i;
            select.value = opt.value;
            optionMatched = true;
            break;
        }
    }

    if (!optionMatched) {
        const conditionLabel = (matchedPatient && matchedPatient.condition) ? matchedPatient.condition : 'General Intake';
        const newOpt = new Option(`${targetName} (${conditionLabel})`, targetName, true, true);
        select.add(newOpt);
        select.value = targetName;
    }

    // Display the patient's demographics, programs, allergies, etc.
    displayPatientInfo(matchedPatient || { name: targetName });

    showNotification(`Patient record automatically loaded for ${targetName}`, 'success');

    // Automatically focus on systolic BP input for immediate vitals recording
    const bpInput = document.getElementById('bpSys');
    if (bpInput) {
        setTimeout(() => bpInput.focus(), 250);
    }
}

/**
 * Displays full demographic, clinical, and contact information for the selected patient.
 */
function displayPatientInfo(patient) {
    const card = document.getElementById('patientInfoCard');
    const autoBadge = document.getElementById('autoLoadedIndicator');
    if (!card) return;

    if (!patient || !patient.name) {
        card.classList.add('hidden');
        if (autoBadge) autoBadge.classList.add('hidden');
        return;
    }

    const nameEl = document.getElementById('dispPatientName');
    const phEl = document.getElementById('dispPatientPhId');
    const condEl = document.getElementById('dispPatientCondition');
    const ageSexEl = document.getElementById('dispPatientAgeSex');
    const purokEl = document.getElementById('dispPatientPurok');
    const emergEl = document.getElementById('dispPatientEmergency');
    const addrEl = document.getElementById('dispPatientAddress');
    const progRow = document.getElementById('dispPatientProgramsRow');
    const progEl = document.getElementById('dispPatientPrograms');
    const algRow = document.getElementById('dispPatientAllergiesRow');
    const algEl = document.getElementById('dispPatientAllergies');

    if (nameEl) nameEl.textContent = patient.name;
    if (phEl) phEl.textContent = patient.ph || patient.ph_id || 'N/A';
    if (condEl) condEl.textContent = patient.condition || 'General Intake';

    const age = (patient.age !== undefined && patient.age !== null && patient.age !== '') ? `${patient.age} yrs` : '--';
    const sex = patient.sex || patient.gender || '--';
    if (ageSexEl) ageSexEl.textContent = `${age} / ${sex}`;

    if (purokEl) purokEl.textContent = patient.purok || 'Purok 1';

    const emName = patient.emergency_contact_name || patient.emergencyContact || '';
    const emRel = patient.emergency_contact_relationship || patient.emergencyRel || '';
    const emNum = patient.emergency_contact_number || patient.emergencyPhone || '';
    let emText = 'None listed';
    if (emName) {
        emText = emName + (emRel ? ` (${emRel})` : '') + (emNum ? ` - ${emNum}` : '');
    }
    if (emergEl) emergEl.textContent = emText;

    let fullAddr = patient.address || '';
    if (patient.purok && !fullAddr.includes(patient.purok)) {
        fullAddr = fullAddr ? `${fullAddr}, ${patient.purok}` : patient.purok;
    }
    if (addrEl) addrEl.textContent = fullAddr || 'Barangay Proper';

    // Programs
    const progs = patient.government_programs || patient.programs || [];
    if (progRow && progEl) {
        if (Array.isArray(progs) && progs.length > 0) {
            progEl.innerHTML = progs.map(pr => `<span class="badge badge-primary-subtle me-1" style="font-size: 0.7rem;">${escapeHtml(pr)}</span>`).join('');
            progRow.classList.remove('hidden');
        } else {
            progRow.classList.add('hidden');
        }
    }

    // Allergies & Risks
    const alg = (patient.allergies && patient.allergies !== 'None reported' && patient.allergies !== 'None') ? patient.allergies : '';
    const risks = patient.health_risks || patient.healthRisks || [];
    if (algRow && algEl) {
        let items = [];
        if (alg) items.push(`Allergies: ${alg}`);
        if (Array.isArray(risks) && risks.length > 0) items.push(`Risks: ${risks.join(', ')}`);
        if (items.length > 0) {
            algEl.textContent = items.join(' | ');
            algRow.classList.remove('hidden');
        } else {
            algRow.classList.add('hidden');
        }
    }

    card.classList.remove('hidden');
    if (autoBadge) autoBadge.classList.remove('hidden');
}

// Populate registered patient dropdown dynamically from DB or local state
async function populateRegisteredPatients() {
    const select = document.getElementById('consultPatient');
    if (!select) return;

    registeredPatientsList = [];
    const authUser = sessionStorage.getItem('bwc_user') || 'charisma';
    const authId = sessionStorage.getItem('bwc_user_id') || '26-001';

    // Attempt backend fetch with user auth headers
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${BACKEND_PATIENTS_URL}?username=${authUser}&user_id=${authId}`, {
            headers: { 'X-Username': authUser, 'X-User-Id': authId },
            credentials: 'include',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                registeredPatientsList = data.data;
            }
        }
    } catch (e) {
        // Fallback to local storage
    }

    if (registeredPatientsList.length === 0) {
        try {
            const raw = localStorage.getItem('bwc_patients_db');
            if (raw) registeredPatientsList = JSON.parse(raw);
        } catch (e) {
            registeredPatientsList = [];
        }
    }

    // Clear previous options except default
    select.innerHTML = '<option value="">Choose registered patient...</option>';

    if (registeredPatientsList.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.textContent = 'No registered clients in TCR — please register a patient first';
        select.appendChild(opt);
        return;
    }

    registeredPatientsList.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = `${p.name} (${p.condition || 'General Intake'})`;
        select.appendChild(opt);
    });
}

// Calculate BMI & Status
function calculateBMI() {
    const w = parseFloat(document.getElementById('patWeight').value);
    const h = parseFloat(document.getElementById('patHeight').value) / 100;
    const resBox = document.getElementById('bmiResult');

    if (w > 0 && h > 0) {
        const bmi = (w / (h * h)).toFixed(1);
        let status = '';
        if (bmi < 18.5) status = 'Underweight';
        else if (bmi < 25) status = 'Normal Weight';
        else if (bmi < 30) status = 'Overweight';
        else status = 'Obese';
        resBox.value = `${bmi} kg/m² (${status})`;
    } else {
        resBox.value = 'Enter weight and height...';
    }
}

// Calculate Risk Stratification
function calculateRisk() {
    const sys = parseInt(document.getElementById('bpSys').value) || 0;
    const dia = parseInt(document.getElementById('bpDia').value) || 0;
    const glu = parseInt(document.getElementById('gluVal').value) || 0;

    const title = document.getElementById('riskTitle');
    const desc = document.getElementById('riskDesc');
    const box = document.getElementById('riskDisplayBox');
    const icon = document.getElementById('riskIcon');

    if (sys === 0 && dia === 0 && glu === 0) {
        title.textContent = 'Awaiting Readings';
        desc.textContent = 'Input blood pressure and blood glucose values to instantly evaluate cardiovascular and metabolic risk according to DOH guidelines.';
        box.className = 'risk-box';
        icon.className = 'bi bi-shield-exclamation risk-icon text-muted';
        return;
    }

    let riskLevel = 'Low / Stable';
    let boxClass = 'risk-box low';
    let iconClass = 'bi bi-shield-check risk-icon text-success';

    if (sys >= 160 || dia >= 100 || glu >= 200) {
        riskLevel = 'High Risk / Stage 2 / Urgent Action';
        boxClass = 'risk-box high';
        iconClass = 'bi bi-shield-fill-exclamation risk-icon text-danger';
    } else if (sys >= 140 || dia >= 90 || glu >= 126) {
        riskLevel = 'Moderate Risk / Elevated Stage';
        boxClass = 'risk-box moderate';
        iconClass = 'bi bi-shield-exclamation risk-icon text-warning';
    }

    title.textContent = riskLevel;
    desc.textContent = `Based on BP (${sys}/${dia} mmHg) and Blood Glucose (${glu} mg/dL).`;
    box.className = boxClass;
    icon.className = iconClass;
}

// Submit Consultation Form & Automatically Schedule 30-Day Follow-Up
async function submitConsultation(e) {
    e.preventDefault();
    const patient = document.getElementById('consultPatient').value;
    const sys = parseInt(document.getElementById('bpSys').value) || 0;
    const dia = parseInt(document.getElementById('bpDia').value) || 0;
    const glu = parseInt(document.getElementById('gluVal').value) || 0;
    const weight = parseFloat(document.getElementById('patWeight').value) || null;
    const height = parseFloat(document.getElementById('patHeight').value) || null;
    const bmiResult = document.getElementById('bmiResult').value;
    const remarks = document.getElementById('consultRemarks').value.trim();
    const riskTitle = document.getElementById('riskTitle').textContent;

    if (!patient) {
        showNotification('Please select a patient.', 'danger');
        return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Calculate 30-Day Next Visit Date
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + 30);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    const formattedNextDate = nextDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    // 2. Determine Category based on clinical readings & remarks
    let category = "Monthly HPN Check";
    if (glu >= 126 || patient.toLowerCase().includes('diabetes')) {
        category = "Diabetes Follow-up";
    } else if (remarks.toLowerCase().includes('refill') || remarks.toLowerCase().includes('dispense')) {
        category = "Medicine Refill";
    }

    // 3. Register into Appointments LocalStorage Data Store
    let appts = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
        appts = raw ? JSON.parse(raw) : [];
    } catch (err) {
        appts = [];
    }

    // A. Mark any past-due / due today pending appointment for this patient as Completed
    appts = appts.map(item => {
        if (item.patientName === patient && (item.status === 'Pending' || item.status === 'Defaulted') && item.scheduledDate <= todayStr) {
            item.status = 'Completed';
            item.completedDate = todayStr;
        }
        return item;
    });

    // B. Register the new 30-day routine follow-up appointment
    const newAppointment = {
        id: Date.now(),
        patientName: patient,
        category: category,
        scheduledDate: nextDateStr,
        purok: "Purok 1",
        remarks: `Auto-scheduled 30-day routine follow-up. Prior reading: BP ${sys}/${dia} mmHg${glu > 0 ? `, Glucose: ${glu} mg/dL` : ''}.`,
        status: "Pending",
        completedDate: null
    };
    appts.push(newAppointment);
    localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(appts));

    // 4. Save consultation to local consultation ledger for dashboard display
    let consultLedger = [];
    try {
        const rawConsult = localStorage.getItem('bwc_consultations_db');
        consultLedger = rawConsult ? JSON.parse(rawConsult) : [];
    } catch (err) {
        consultLedger = [];
    }
    consultLedger.unshift({
        patient: patient,
        sys: sys,
        dia: dia,
        glu: glu,
        risk: riskTitle,
        remarks: remarks,
        date: todayStr
    });
    localStorage.setItem('bwc_consultations_db', JSON.stringify(consultLedger));

    // 5. Attempt background synchronization with Flask/SQLite API
    try {
        await fetch(BACKEND_CONSULT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_name: patient,
                sys_bp: sys,
                dia_bp: dia,
                glucose: glu,
                weight: weight,
                height: height,
                bmi_result: bmiResult,
                risk_level: riskTitle,
                remarks: remarks
            })
        });
    } catch (err) {
        // Handled silently in offline mode
    }

    // 6. User Feedback
    showNotification(`Consultation saved! Next follow-up auto-scheduled for ${formattedNextDate} (30 days).`, 'success');

    // Reset Form
    document.getElementById('consultForm').reset();
    document.getElementById('bmiResult').value = 'Enter weight and height...';
    displayPatientInfo(null);
    calculateRisk();
}
