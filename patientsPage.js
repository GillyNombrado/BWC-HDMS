/* ==========================================================================
   BWC-HDMS Portal - Target Client Registry Logic (patientsPage.js)
   Categorized Tiers:
   1. Mandatory Fields (RHU Statutory)
   2. Recommended / Important Fields
   3. Optional Intake Fields
   ========================================================================== */

let stagedUploadFiles = [];

// In-memory patient registry data storage
const patientRegistryData = [
    {
        name: "Juan Mercado Dela Cruz",
        firstName: "Juan",
        middleName: "Mercado",
        lastName: "Dela Cruz",
        dob: "1972-04-12",
        age: 54,
        sex: "Male",
        contact: "0917-555-1234",
        purok: "Poblacion 3",
        address: "House 14, Sitio Riverside, Poblacion 3",
        condition: "Hypertension Only",
        diagnosisDate: "2022-10-14",
        ph: "12-345678901-2",
        lastVisit: "Oct 14, 2026",
        risk: "Moderate",
        programs: ["Senior Citizen ID Holder"],
        healthRisks: ["Smoking / Tobacco", "Family History of Stroke / CVD"],
        allergies: "Sulfonamides, Aspirin",
        medHistory: "Diagnosed with Stage 1 Hypertension in 2022. Maintenance Amlodipine 5mg OD. Hospitalized for dengue fever in 2018.",
        emergencyName: "Juana Dela Cruz",
        emergencyRel: "Spouse",
        emergencyPhone: "0918-777-6543",
        attachments: ["Senior_Citizen_ID_Scanned.pdf", "Prescription_Amlodipine_2026.jpg", "FBS_Lab_Result_Oct2026.pdf"]
    },
    {
        name: "Maria Lopez Santos",
        firstName: "Maria",
        middleName: "Lopez",
        lastName: "Santos",
        dob: "1965-08-25",
        age: 61,
        sex: "Female",
        contact: "0920-888-9911",
        purok: "Poblacion 1",
        address: "Block 3 Lot 8, Poblacion 1",
        condition: "Diabetes Only",
        diagnosisDate: "2019-05-18",
        ph: "14-987654321-9",
        lastVisit: "Oct 14, 2026",
        risk: "High Risk",
        programs: ["4Ps (Pantawid Pamilyang Pilipino Program)", "PWD (Persons with Disability)"],
        healthRisks: ["Family History of Diabetes", "Physical Inactivity"],
        allergies: "Penicillin, Cephalosporins",
        medHistory: "Diagnosed with Type 2 Diabetes Mellitus in 2019. Experiences diabetic peripheral neuropathy in feet. Daily Metformin 500mg BID.",
        emergencyName: "Pedro Santos",
        emergencyRel: "Child",
        emergencyPhone: "0919-222-3344",
        attachments: ["PWD_ID_Card.png", "Blood_Glucose_Lab_Result.pdf", "Solo_Parent_ID.pdf"]
    }
];

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

    // Build badge pills for TCR table preview
    let programBadges = '';
    if (selectedPrograms.length > 0) {
        const topPrograms = selectedPrograms.slice(0, 2);
        programBadges = `<div class="mt-1 d-flex flex-wrap gap-1">` + 
            topPrograms.map(p => `<span class="badge badge-primary-subtle" style="font-size: 0.65rem;">${p}</span>`).join('') +
            (selectedPrograms.length > 2 ? `<span class="badge badge-warning" style="font-size: 0.65rem;">+${selectedPrograms.length - 2} more</span>` : '') +
            `</div>`;
    }

    // Condition badge styling
    let condBadgeClass = "badge-primary-subtle";
    if (condition === "Hypertension Only") condBadgeClass = "badge-danger-subtle";
    else if (condition === "Both") condBadgeClass = "badge-warning-subtle";

    const tbody = document.getElementById('tcrTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="ps-4">
            <div class="fw-semibold">${fullName}</div>
            <small class="text-muted" style="font-size: 0.75rem;">PH: ${ph}</small>
            ${programBadges}
        </td>
        <td>${age} / ${sex.charAt(0)}</td>
        <td>${purok}, San Jose</td>
        <td><span class="badge ${condBadgeClass}">${condition}</span></td>
        <td>Today</td>
        <td><span class="badge ${riskBadgeClass}">${initialRisk}</span></td>
        <td class="text-right pe-4 space-x-1">
            <button class="btn btn-sm btn-outline-primary" onclick="openPatientRecord('${fullName.replace(/'/g, "\\'")}')" title="View Patient Profile"><i class="bi bi-eye"></i></button>
            <button class="btn btn-sm btn-outline-success" onclick="quickPrescribe('${fullName.replace(/'/g, "\\'")}')" title="Consult / Prescribe"><i class="bi bi-capsule"></i></button>
        </td>
    `;
    tbody.prepend(tr);

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
