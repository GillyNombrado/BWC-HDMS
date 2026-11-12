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

document.addEventListener('DOMContentLoaded', () => {
    // If a patient was selected via "quickPrescribe" from TCR or Schedule, auto-select them
    const preselected = sessionStorage.getItem('consult_patient');
    if (preselected) {
        const select = document.getElementById('consultPatient');
        if (select) {
            // Check if exact value exists; if not, find partial match
            let matched = false;
            for (let option of select.options) {
                if (option.value === preselected || option.value.toLowerCase().includes(preselected.toLowerCase()) || preselected.toLowerCase().includes(option.value.toLowerCase())) {
                    select.value = option.value;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // Add dynamically if not present
                const newOpt = new Option(preselected, preselected, true, true);
                select.add(newOpt);
            }
            showNotification(`Loaded consultation intake for ${preselected}`, 'success');
        }
        sessionStorage.removeItem('consult_patient');
    }
});

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
        purok: "Poblacion 1",
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
    calculateRisk();
}
