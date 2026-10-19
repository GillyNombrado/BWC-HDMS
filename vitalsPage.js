/* ==========================================================================
   BWC-HDMS Portal - Consultation & Vitals Logic (vitalsPage.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // If a patient was selected via "quickPrescribe" from TCR, auto-select them
    const preselected = sessionStorage.getItem('consult_patient');
    if (preselected) {
        const select = document.getElementById('consultPatient');
        if (select) {
            select.value = preselected;
            showNotification(`Loaded consultation form for ${preselected}`, 'success');
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

// Submit Consultation Form
function submitConsultation(e) {
    e.preventDefault();
    const patient = document.getElementById('consultPatient').value;

    if (!patient) {
        showNotification('Please select a patient.', 'danger');
        return;
    }

    showNotification(`Consultation for ${patient} saved and synced to ledger.`, 'success');
    document.getElementById('consultForm').reset();
    document.getElementById('bmiResult').value = 'Enter weight and height...';
    calculateRisk();
}
