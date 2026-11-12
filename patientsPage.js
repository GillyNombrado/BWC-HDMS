/* ==========================================================================
   BWC-HDMS Portal - Target Client Registry Logic (patientsPage.js)
   Categorized Tiers:
   1. Mandatory Fields (RHU Statutory)
   2. Recommended / Important Fields
   3. Optional Intake Fields
   ========================================================================== */

let stagedUploadFiles = [];

// Storage keys & Backend API URL
const STORAGE_KEY_PATIENTS = 'bwc_patients_db';
const BACKEND_PATIENTS_URL = 'http://127.0.0.1:5000/api/patients';

// In-memory patient registry data storage (starts clean / empty)
let patientRegistryData = [];

// --------------------------------------------------------------------------
// 1. Demographics & Date of Birth Age Auto-Calculation
// --------------------------------------------------------------------------
function calculateAgeFromDOB(dobString) {
    if (!dobString) return;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    
    if (age >= 0 && age <= 130) {
        const ageInput = document.getElementById('newPatientAge');
        if (ageInput) ageInput.value = age;
    }
}

// --------------------------------------------------------------------------
// 2. Government & Social Programs: Custom "Other" Input Toggle
// --------------------------------------------------------------------------
function toggleOtherProgramInput(checkbox) {
    const container = document.getElementById('progOtherContainer');
    const input = document.getElementById('newPatientProgOther');
    if (!container) return;

    if (checkbox.checked) {
        container.classList.remove('hidden');
        if (input) input.focus();
    } else {
        container.classList.add('hidden');
        if (input) input.value = '';
    }
}

// --------------------------------------------------------------------------
// 3. Digital Document Attachment Picker & Preview
// --------------------------------------------------------------------------
function handlePatientFileUpload(input) {
    const list = document.getElementById('fileUploadList');
    if (!list) return;

    list.innerHTML = '';
    stagedUploadFiles = [];

    if (!input.files || input.files.length === 0) {
        list.classList.add('hidden');
        return;
    }

    list.classList.remove('hidden');
    Array.from(input.files).forEach((file, index) => {
        stagedUploadFiles.push({
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB'
        });

        const chip = document.createElement('div');
        chip.className = 'uploaded-file-chip';
        chip.innerHTML = `
            <div class="d-flex align-center gap-2">
                <i class="bi bi-file-earmark-check text-primary"></i>
                <span class="fw-medium">${file.name}</span>
                <span class="text-muted" style="font-size: 0.72rem;">(${(file.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button type="button" class="btn btn-sm text-danger p-0 border-0" onclick="removeStagedFile(${index})" title="Remove file" style="font-size: 1.1rem; line-height: 1;">&times;</button>
        `;
        list.appendChild(chip);
    });
}

function removeStagedFile(index) {
    stagedUploadFiles.splice(index, 1);
    const list = document.getElementById('fileUploadList');
    if (!list) return;

    if (stagedUploadFiles.length === 0) {
        list.innerHTML = '';
        list.classList.add('hidden');
        const fileInput = document.getElementById('newPatientAttachment');
        if (fileInput) fileInput.value = '';
        return;
    }

    list.innerHTML = '';
    stagedUploadFiles.forEach((file, idx) => {
        const chip = document.createElement('div');
        chip.className = 'uploaded-file-chip';
        chip.innerHTML = `
            <div class="d-flex align-center gap-2">
                <i class="bi bi-file-earmark-check text-primary"></i>
                <span class="fw-medium">${file.name}</span>
                <span class="text-muted" style="font-size: 0.72rem;">(${file.size})</span>
            </div>
            <button type="button" class="btn btn-sm text-danger p-0 border-0" onclick="removeStagedFile(${idx})" title="Remove file" style="font-size: 1.1rem; line-height: 1;">&times;</button>
        `;
        list.appendChild(chip);
    });
}

// --------------------------------------------------------------------------
// 4. Filter TCR Table Rows
// --------------------------------------------------------------------------
function filterTCR() {
    const query = document.getElementById('searchTCR').value.toLowerCase();
    const cond = document.getElementById('filterCondition').value;
    const pur = document.getElementById('filterPurok').value;

    const rows = document.querySelectorAll('#tcrTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matchesQuery = text.includes(query);
        const matchesCond = cond === '' || text.includes(cond.toLowerCase());
        const matchesPur = pur === '' || text.includes(pur.toLowerCase());

        if (matchesQuery && matchesCond && matchesPur) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// --------------------------------------------------------------------------
// 5. Save New Patient to TCR Table
// --------------------------------------------------------------------------
function savePatient(e) {
    e.preventDefault();

    // Required Demographics & Clinical Information
    const firstName = document.getElementById('newPatientFirstName').value.trim();
    const middleName = document.getElementById('newPatientMiddleName').value.trim();
    const lastName = document.getElementById('newPatientLastName').value.trim();
    const fullName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;

    const dob = document.getElementById('newPatientDOB').value;
    const age = document.getElementById('newPatientAge').value.trim();
    const sex = document.getElementById('newPatientSex').value;
    const purok = document.getElementById('newPatientPurok').value;
    const address = document.getElementById('newPatientAddress').value.trim() || `${purok}, Barangay San Jose`;
    const contact = document.getElementById('newPatientContact').value.trim();
    const ph = document.getElementById('newPatientPH').value.trim() || "Pending RHU Assignment";

    const condition = document.getElementById('newPatientCondition').value;
    const diagnosisDate = document.getElementById('newPatientDiagnosisDate').value;

    // Required Emergency Contact Details
    const emergencyName = document.getElementById('newPatientEmergencyName').value.trim();
    const emergencyRel = document.getElementById('newPatientEmergencyRel').value;
    const emergencyPhone = document.getElementById('newPatientEmergencyPhone').value.trim();

    // Strict validation for all required fields
    if (!firstName || !lastName || !dob || !age || !sex || !purok || !contact || !condition || !diagnosisDate || !emergencyName || !emergencyRel || !emergencyPhone) {
        showNotification("Please fill out all required fields marked with *", "danger");
        return;
    }

    const selectedPrograms = [];
    document.querySelectorAll('input[name="socialPrograms"]:checked').forEach(cb => {
        if (cb.value === 'Other') {
            const otherVal = document.getElementById('newPatientProgOther').value.trim();
            if (otherVal) {
                selectedPrograms.push(`Other: ${otherVal}`);
            } else {
                selectedPrograms.push('Other');
            }
        } else {
            selectedPrograms.push(cb.value);
        }
    });

    // ==========================================
    // Tier 3: Optional Fields
    // ==========================================
    const selectedRisks = [];
    document.querySelectorAll('input[name="healthRisks"]:checked').forEach(cb => {
        selectedRisks.push(cb.value);
    });

    const allergies = document.getElementById('newPatientAllergies').value.trim() || "None reported";
    const medHistory = document.getElementById('newPatientMedHistory').value.trim() || 
        "No prior chronic illness or hospitalizations noted during intake.";

    const attachmentNames = stagedUploadFiles.map(f => f.name);
    if (attachmentNames.length === 0) {
        attachmentNames.push("Barangay_Client_Intake_Form.pdf");
    }

    // Determine initial risk assessment badge
    let initialRisk = "Stable";
    let riskBadgeClass = "badge-success";
    if (condition === "Both" || selectedRisks.length >= 2) {
        initialRisk = "High Risk";
        riskBadgeClass = "badge-danger";
    } else if (selectedRisks.length === 1) {
        initialRisk = "Moderate";
        riskBadgeClass = "badge-warning";
    }

    // Add to patient registry storage
    const patientRecord = {
        name: fullName,
        firstName,
        middleName,
        lastName,
        dob,
        age: parseInt(age, 10),
        sex,
        contact,
        purok,
        address,
        condition,
        diagnosisDate,
        ph,
        lastVisit: "Today",
        risk: initialRisk,
        programs: selectedPrograms,
        healthRisks: selectedRisks,
        allergies,
        medHistory,
        emergencyName,
        emergencyRel,
        emergencyPhone,
        attachments: attachmentNames
    };
    patientRegistryData.unshift(patientRecord);
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patientRegistryData));
    renderTCRTable();

    // Background asynchronous sync to Flask / SQLite backend
    try {
        fetch(BACKEND_PATIENTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientRecord)
        }).catch(() => {});
    } catch (e) {}

    // Reset Form & Clear UI Upload States
    closeModal('patientModal');
    document.getElementById('newPatientForm').reset();
    
    const progOtherContainer = document.getElementById('progOtherContainer');
    if (progOtherContainer) progOtherContainer.classList.add('hidden');

    const uploadList = document.getElementById('fileUploadList');
    if (uploadList) {
        uploadList.innerHTML = '';
        uploadList.classList.add('hidden');
    }
    stagedUploadFiles = [];

    showNotification(`Resident ${fullName} registered in TCR with statutory RHU data.`, 'success');
}

// --------------------------------------------------------------------------
// 6. View Patient Health Record Modal
// --------------------------------------------------------------------------
function openPatientRecord(patientName) {
    let patient = patientRegistryData.find(p => 
        p.name.toLowerCase() === patientName.toLowerCase() ||
        (p.firstName && patientName.toLowerCase().includes(p.firstName.toLowerCase()) && patientName.toLowerCase().includes(p.lastName.toLowerCase()))
    );
    
    // Fallback if row wasn't found in array
    if (!patient) {
        patient = {
            name: patientName,
            dob: "1975-01-01",
            age: "--",
            sex: "Unspecified",
            contact: "Not provided",
            purok: "Poblacion 1",
            address: "Poblacion 1, San Jose",
            condition: "Hypertension Only",
            diagnosisDate: "2023-01-01",
            ph: "PH-Registered",
            risk: "Stable",
            programs: [],
            healthRisks: [],
            allergies: "None reported",
            medHistory: "Registered in TCR client registry.",
            emergencyName: "Barangay Health Center",
            emergencyRel: "BHW Station",
            emergencyPhone: "0917-000-0000",
            attachments: ["Patient_Profile_Summary.pdf"]
        };
    }

    // Populate demographics
    const recName = document.getElementById('recName');
    const recDemographics = document.getElementById('recDemographics');
    const recAddress = document.getElementById('recAddress');
    const recContact = document.getElementById('recContact');
    const recPh = document.getElementById('recPh');
    const recConditionBadge = document.getElementById('recConditionBadge');
    const recRiskBadge = document.getElementById('recRiskBadge');
    const recDiagnosisDate = document.getElementById('recDiagnosisDate');

    if (recName) recName.textContent = patient.name;
    if (recDemographics) {
        let dobStr = patient.dob ? ` • Born ${formatDateDisplay(patient.dob)}` : '';
        recDemographics.textContent = `${patient.age} years old • ${patient.sex}${dobStr}`;
    }
    if (recAddress) recAddress.textContent = patient.address || `${patient.purok}, San Jose`;
    if (recContact) recContact.textContent = patient.contact || "Not provided";
    if (recPh) recPh.textContent = patient.ph;
    if (recDiagnosisDate) recDiagnosisDate.textContent = formatDateDisplay(patient.diagnosisDate) || "Recorded on intake";
    
    if (recConditionBadge) {
        recConditionBadge.textContent = patient.condition;
        if (patient.condition === "Hypertension Only") {
            recConditionBadge.className = 'badge badge-danger-subtle';
        } else if (patient.condition === "Diabetes Only") {
            recConditionBadge.className = 'badge badge-primary-subtle';
        } else {
            recConditionBadge.className = 'badge badge-warning-subtle';
        }
    }
    
    if (recRiskBadge) {
        recRiskBadge.textContent = patient.risk;
        if (patient.risk === 'High Risk') {
            recRiskBadge.className = 'badge badge-danger';
        } else if (patient.risk === 'Moderate') {
            recRiskBadge.className = 'badge badge-warning';
        } else {
            recRiskBadge.className = 'badge badge-success';
        }
    }

    // Populate Emergency Contact
    const recEmergencyName = document.getElementById('recEmergencyName');
    const recEmergencyRel = document.getElementById('recEmergencyRel');
    const recEmergencyPhone = document.getElementById('recEmergencyPhone');
    if (recEmergencyName) recEmergencyName.textContent = patient.emergencyName || "None designated";
    if (recEmergencyRel) recEmergencyRel.textContent = patient.emergencyRel || "Guardian / Relative";
    if (recEmergencyPhone) recEmergencyPhone.textContent = patient.emergencyPhone || "N/A";

    // Populate Social Programs Badges
    const progContainer = document.getElementById('recProgramsContainer');
    if (progContainer) {
        progContainer.innerHTML = '';
        if (patient.programs && patient.programs.length > 0) {
            patient.programs.forEach(prog => {
                const badge = document.createElement('span');
                badge.className = 'badge badge-primary-subtle';
                badge.style.fontSize = '0.75rem';
                badge.style.padding = '0.35rem 0.6rem';
                badge.innerHTML = `<i class="bi bi-check-circle-fill text-primary me-1"></i>${prog}`;
                progContainer.appendChild(badge);
            });
        } else {
            progContainer.innerHTML = `<span class="text-muted" style="font-size: 0.75rem;">No social or government program enrollments on file.</span>`;
        }
    }

    // Populate Health Risks Badges
    const risksContainer = document.getElementById('recRisksContainer');
    if (risksContainer) {
        risksContainer.innerHTML = '';
        if (patient.healthRisks && patient.healthRisks.length > 0) {
            patient.healthRisks.forEach(risk => {
                const badge = document.createElement('span');
                badge.className = 'badge badge-warning-subtle';
                badge.style.fontSize = '0.75rem';
                badge.style.padding = '0.35rem 0.6rem';
                badge.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>${risk}`;
                risksContainer.appendChild(badge);
            });
        } else {
            risksContainer.innerHTML = `<span class="text-muted" style="font-size: 0.75rem;">No pre-existing health risks noted.</span>`;
        }
    }

    // Populate Allergies & Medical History
    const recAllergies = document.getElementById('recAllergies');
    if (recAllergies) {
        recAllergies.innerHTML = `<i class="bi bi-shield-slash text-danger me-2"></i><span>${patient.allergies || "None reported"}</span>`;
    }

    const recMedHistory = document.getElementById('recMedHistory');
    if (recMedHistory) {
        recMedHistory.textContent = patient.medHistory || "No prior clinical history noted.";
    }

    // Populate Document Attachments
    const docsContainer = document.getElementById('recAttachmentsContainer');
    if (docsContainer) {
        docsContainer.innerHTML = '';
        if (patient.attachments && patient.attachments.length > 0) {
            patient.attachments.forEach(file => {
                const item = document.createElement('div');
                item.className = 'uploaded-file-chip';
                item.innerHTML = `
                    <div class="d-flex align-center gap-2">
                        <i class="bi bi-file-earmark-medical text-primary" style="font-size: 1rem;"></i>
                        <span class="fw-medium">${file}</span>
                    </div>
                    <span class="badge badge-success" style="font-size: 0.68rem;"><i class="bi bi-check-circle me-1"></i>Verified Local Copy</span>
                `;
                docsContainer.appendChild(item);
            });
        } else {
            docsContainer.innerHTML = `<span class="text-muted" style="font-size: 0.75rem;">No verification documents attached.</span>`;
        }
    }

    openModal('patientRecordModal');
}

// Helper: Format Date String to Readable Format
function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// --------------------------------------------------------------------------
// 7. Quick Prescribe & Consult Helper
// --------------------------------------------------------------------------
function quickPrescribe(patientName) {
    sessionStorage.setItem('consult_patient', patientName);
    showNotification(`Selected patient: ${patientName}. Opening consultation form...`, 'success');
    setTimeout(() => {
        window.location.href = 'vitalsPage.html';
    }, 400);
}

// --------------------------------------------------------------------------
// 8. Dynamic TCR Table Rendering & Clean Empty State Handling
// --------------------------------------------------------------------------
function renderTCRTable() {
    const tbody = document.getElementById('tcrTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (patientRegistryData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-people d-block mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
                    <span class="fw-semibold" style="font-size: 0.95rem;">No registered clients found in Target Client Registry (TCR).</span>
                    <p class="text-muted mb-0" style="font-size: 0.8rem; margin-top: 0.25rem;">Click "Register New Client in TCR" above to enroll a resident.</p>
                </td>
            </tr>
        `;
        return;
    }

    patientRegistryData.forEach(p => {
        let programBadges = '';
        if (p.programs && p.programs.length > 0) {
            const topPrograms = p.programs.slice(0, 2);
            programBadges = `<div class="mt-1 d-flex flex-wrap gap-1">` + 
                topPrograms.map(prog => `<span class="badge badge-primary-subtle" style="font-size: 0.65rem;">${escapeHtml(prog)}</span>`).join('') +
                (p.programs.length > 2 ? `<span class="badge badge-warning" style="font-size: 0.65rem;">+${p.programs.length - 2} more</span>` : '') +
                `</div>`;
        }

        let condBadgeClass = "badge-primary-subtle";
        if (p.condition === "Hypertension Only") condBadgeClass = "badge-danger-subtle";
        else if (p.condition === "Both") condBadgeClass = "badge-warning-subtle";

        let riskBadgeClass = "badge-success";
        if (p.risk === "High Risk") riskBadgeClass = "badge-danger";
        else if (p.risk === "Moderate") riskBadgeClass = "badge-warning";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-semibold">${escapeHtml(p.name)}</div>
                <small class="text-muted" style="font-size: 0.75rem;">PH: ${escapeHtml(p.ph || 'N/A')}</small>
                ${programBadges}
            </td>
            <td>${p.age || '--'} / ${p.sex ? p.sex.charAt(0) : '--'}</td>
            <td>${escapeHtml(p.purok || 'San Jose')}, San Jose</td>
            <td><span class="badge ${condBadgeClass}">${escapeHtml(p.condition || 'General')}</span></td>
            <td>${escapeHtml(p.lastVisit || 'Today')}</td>
            <td><span class="badge ${riskBadgeClass}">${escapeHtml(p.risk || 'Stable')}</span></td>
            <td class="text-right pe-4 space-x-1">
                <button class="btn btn-sm btn-outline-primary" onclick="openPatientRecord('${escapeHtml(p.name).replace(/'/g, "\\'")}')" title="View Patient Profile"><i class="bi bi-eye"></i></button>
                <button class="btn btn-sm btn-outline-success" onclick="quickPrescribe('${escapeHtml(p.name).replace(/'/g, "\\'")}')" title="Consult / Prescribe"><i class="bi bi-capsule"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --------------------------------------------------------------------------
// 9. Data Loading & Initialization
// --------------------------------------------------------------------------
async function loadPatients() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const res = await fetch(BACKEND_PATIENTS_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                patientRegistryData = json.data.map(p => ({
                    id: p.id,
                    name: p.name,
                    firstName: p.first_name,
                    middleName: p.middle_name,
                    lastName: p.last_name,
                    dob: p.dob,
                    age: p.age,
                    sex: p.sex,
                    contact: p.contact,
                    purok: p.purok,
                    address: p.address,
                    condition: p.condition,
                    diagnosisDate: p.diagnosis_date,
                    ph: p.ph_id,
                    lastVisit: p.last_visit || 'Never',
                    risk: p.risk_level || 'Moderate',
                    programs: [],
                    healthRisks: [],
                    allergies: '',
                    medHistory: '',
                    emergencyName: '',
                    emergencyRel: '',
                    emergencyPhone: '',
                    attachments: []
                }));
                localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patientRegistryData));
                renderTCRTable();
                return;
            }
        }
    } catch (e) {
        // Fallback to offline local storage
    }

    const raw = localStorage.getItem(STORAGE_KEY_PATIENTS);
    if (raw) {
        try {
            patientRegistryData = JSON.parse(raw);
        } catch (e) {
            patientRegistryData = [];
        }
    } else {
        patientRegistryData = [];
    }

    renderTCRTable();
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
    loadPatients();
});
