(function() {
    /* ==========================================================================
       BWC-HDMS Portal - Target Client Registry Logic (patientsPage.js)
       ========================================================================== */

    let stagedUploadFiles = [];

    // Storage keys & Backend API URL
    const STORAGE_KEY_PATIENTS = 'bwc_patients_db';
    const BACKEND_PATIENTS_URL = 'http://127.0.0.1:5000/api/patients';

    let patientRegistryData = [];

    // Helper: Determine clinical risk badge CSS class
    function getRiskBadgeClass(riskStr) {
        const r = (riskStr || '').toLowerCase();
        if (r.includes('high')) {
            return 'badge-danger';
        } else if (r.includes('mod') || r.includes('medium')) {
            return 'badge-warning';
        } else {
            return 'badge-success';
        }
    }

    // Helper: Determine medical condition badge CSS class
    function getConditionBadgeClass(condStr) {
        const c = (condStr || '').toLowerCase();
        if (c.includes('both') || c.includes('&')) {
            return 'badge-warning-subtle';
        } else if (c.includes('hyper')) {
            return 'badge-danger-subtle';
        } else if (c.includes('diabet')) {
            return 'badge-primary-subtle';
        } else {
            return 'badge-primary-subtle';
        }
    }

    // Helper: Format ISO date string into human-readable display
    function formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

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
                    <span class="fw-medium">${escapeHtml(file.name)}</span>
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
                    <span class="fw-medium">${escapeHtml(file.name)}</span>
                    <span class="text-muted" style="font-size: 0.72rem;">(${escapeHtml(file.size)})</span>
                </div>
                <button type="button" class="btn btn-sm text-danger p-0 border-0" onclick="removeStagedFile(${idx})" title="Remove file" style="font-size: 1.1rem; line-height: 1;">&times;</button>
            `;
            list.appendChild(chip);
        });
    }

    function filterTCR() {
        const query = document.getElementById('searchTCR') ? document.getElementById('searchTCR').value : '';
        const cond = document.getElementById('filterCondition') ? document.getElementById('filterCondition').value : '';
        const sortSelect = document.getElementById('filterPatientSort') || document.getElementById('filterPurok');
        const customFilter = sortSelect ? sortSelect.value : '';

        if (window.bwcApi && typeof window.bwcApi.applyPatientTableFilters === 'function') {
            const filtered = window.bwcApi.applyPatientTableFilters(patientRegistryData, {
                ...window.bwcApi.tcrFilterState,
                searchQuery: query,
                condition: cond,
                customFilter: customFilter
            });
            renderTCRTable(filtered);
        } else {
            const rows = document.querySelectorAll('#tcrTableBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const matchesQuery = text.includes(query.toLowerCase());
                const matchesCond = cond === '' || text.includes(cond.toLowerCase());
                row.style.display = (matchesQuery && matchesCond) ? '' : 'none';
            });
        }
    }

    function savePatient(e) {
        e.preventDefault();
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

        const emergencyName = document.getElementById('newPatientEmergencyName').value.trim();
        const emergencyRel = document.getElementById('newPatientEmergencyRel').value;
        const emergencyPhone = document.getElementById('newPatientEmergencyPhone').value.trim();

        if (!firstName || !lastName || !dob || !age || !sex || !purok || !contact || !condition || !diagnosisDate || !emergencyName || !emergencyRel || !emergencyPhone) {
            showNotification("Please fill out all required fields marked with *", "danger");
            return;
        }

        const selectedPrograms = [];
        document.querySelectorAll('input[name="socialPrograms"]:checked').forEach(cb => {
            if (cb.value === 'Other') {
                const otherVal = document.getElementById('newPatientProgOther').value.trim();
                selectedPrograms.push(otherVal ? `Other: ${otherVal}` : 'Other');
            } else {
                selectedPrograms.push(cb.value);
            }
        });

        const selectedRisks = [];
        document.querySelectorAll('input[name="healthRisks"]:checked').forEach(cb => {
            selectedRisks.push(cb.value);
        });

        const allergies = document.getElementById('newPatientAllergies').value.trim() || "None reported";
        const medHistory = document.getElementById('newPatientMedHistory').value.trim() || "No prior chronic illness notes.";

        const attachmentNames = stagedUploadFiles.map(f => f.name);
        if (attachmentNames.length === 0) attachmentNames.push("Barangay_Client_Intake_Form.pdf");

        let initialRisk = "Stable";
        if (condition === "Both" || selectedRisks.length >= 2) initialRisk = "High Risk";
        else if (selectedRisks.length === 1) initialRisk = "Moderate";

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

        try {
            fetch(BACKEND_PATIENTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patientRecord)
            }).catch(() => {});
        } catch (e) {}

        closeModal('patientModal');
        document.getElementById('newPatientForm').reset();
        showNotification(`Resident ${fullName} registered in TCR.`, 'success');
    }

    function openPatientRecord(patientName) {
        let patient = patientRegistryData.find(p => 
            p.name.toLowerCase() === patientName.toLowerCase() ||
            (p.firstName && patientName.toLowerCase().includes(p.firstName.toLowerCase()) && patientName.toLowerCase().includes(p.lastName.toLowerCase()))
        );
        
        if (!patient) {
            patient = {
                name: patientName,
                dob: "1975-01-01",
                age: "--",
                sex: "Unspecified",
                contact: "Not provided",
                purok: "Purok 1",
                address: "Purok 1, Poblacion 2",
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
            recDemographics.textContent = `${patient.age} years old • ${patient.sex || patient.gender || 'Unspecified'}${dobStr}`;
        }
        if (recAddress) recAddress.textContent = patient.address ? `${patient.address}, ${patient.purok}` : (patient.purok || 'San Jose');
        if (recContact) recContact.textContent = patient.contact || patient.contact_number || "Not provided";
        if (recPh) recPh.textContent = patient.ph || patient.ph_id || "N/A";
        if (recDiagnosisDate) recDiagnosisDate.textContent = formatDateDisplay(patient.diagnosisDate || patient.diagnosis_date) || "Recorded on intake";
        
        if (recConditionBadge) {
            const condText = patient.condition || 'General';
            recConditionBadge.textContent = condText;
            recConditionBadge.className = 'badge ' + getConditionBadgeClass(condText);
        }
        
        if (recRiskBadge) {
            const riskText = patient.risk || patient.risk_level || 'Stable';
            recRiskBadge.textContent = riskText;
            recRiskBadge.className = 'badge ' + getRiskBadgeClass(riskText);
        }

        const recEmergencyName = document.getElementById('recEmergencyName');
        const recEmergencyRel = document.getElementById('recEmergencyRel');
        const recEmergencyPhone = document.getElementById('recEmergencyPhone');
        if (recEmergencyName) recEmergencyName.textContent = patient.emergencyName || patient.emergency_contact_name || "None designated";
        if (recEmergencyRel) recEmergencyRel.textContent = patient.emergencyRel || patient.emergency_contact_relationship || "Guardian / Relative";
        if (recEmergencyPhone) recEmergencyPhone.textContent = patient.emergencyPhone || patient.emergency_contact_number || "N/A";

        const progContainer = document.getElementById('recProgramsContainer');
        if (progContainer) {
            progContainer.innerHTML = '';
            const progs = patient.programs || patient.government_programs || [];
            if (progs && progs.length > 0) {
                progs.forEach(prog => {
                    const badge = document.createElement('span');
                    badge.className = 'badge badge-primary-subtle';
                    badge.style.fontSize = '0.75rem';
                    badge.style.padding = '0.35rem 0.6rem';
                    badge.innerHTML = `<i class="bi bi-check-circle-fill text-primary me-1"></i>${escapeHtml(prog)}`;
                    progContainer.appendChild(badge);
                });
            } else {
                progContainer.innerHTML = `<span class="text-muted" style="font-size: 0.75rem;">No social or government program enrollments on file.</span>`;
            }
        }

        const risksContainer = document.getElementById('recRisksContainer');
        if (risksContainer) {
            risksContainer.innerHTML = '';
            const risks = patient.healthRisks || patient.health_risks || [];
            if (risks && risks.length > 0) {
                risks.forEach(risk => {
                    const badge = document.createElement('span');
                    badge.className = 'badge badge-warning-subtle';
                    badge.style.fontSize = '0.75rem';
                    badge.style.padding = '0.35rem 0.6rem';
                    badge.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>${escapeHtml(risk)}`;
                    risksContainer.appendChild(badge);
                });
            } else {
                risksContainer.innerHTML = `<span class="text-muted" style="font-size: 0.75rem;">No pre-existing health risks noted.</span>`;
            }
        }

        const recAllergies = document.getElementById('recAllergies');
        if (recAllergies) {
            recAllergies.innerHTML = `<i class="bi bi-shield-slash text-danger me-2"></i><span>${escapeHtml(patient.allergies || "None reported")}</span>`;
        }

        const recMedHistory = document.getElementById('recMedHistory');
        if (recMedHistory) {
            recMedHistory.textContent = patient.medHistory || patient.medical_history || "No prior clinical history noted.";
        }

        const docsContainer = document.getElementById('recAttachmentsContainer');
        if (docsContainer) {
            docsContainer.innerHTML = '';
            const atts = patient.attachments || [];
            if (atts && atts.length > 0) {
                atts.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'uploaded-file-chip';
                    item.innerHTML = `
                        <div class="d-flex align-center gap-2">
                            <i class="bi bi-file-earmark-medical text-primary" style="font-size: 1rem;"></i>
                            <span class="fw-medium">${escapeHtml(file)}</span>
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

    function quickPrescribe(patientName) {
        // Find the full patient object from loaded data and store it
        const patient = patientRegistryData.find(p => p.name === patientName);
        if (patient) {
            sessionStorage.setItem('consult_patient', JSON.stringify(patient));
        } else {
            sessionStorage.setItem('consult_patient', JSON.stringify({ name: patientName }));
        }
        showNotification(`Selected patient: ${patientName}. Opening consultation form...`, 'success');
        setTimeout(() => {
            window.location.href = `vitalsPage.html?patient=${encodeURIComponent(patientName)}`;
        }, 300);
    }

    function renderTCRTable(displayList = null) {
        const tbody = document.getElementById('tcrTableBody');
        if (!tbody) return;

        const dataToRender = displayList !== null ? displayList : patientRegistryData;
        tbody.innerHTML = '';

        if (dataToRender.length === 0) {
            if (window.bwcApi && typeof window.bwcApi.renderPatientEmptyState === 'function') {
                const isFiltered = (patientRegistryData.length > 0);
                const msg = isFiltered ? "No matching patient records found." : "No registered clients found in Target Client Registry (TCR).";
                const sub = isFiltered ? "Try adjusting your gender, age category, risk level, or search filters." : "Click \"Register New Client in TCR\" above to enroll a resident.";
                window.bwcApi.renderPatientEmptyState(tbody, msg, sub);
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-5 text-muted">
                            <i class="bi bi-people d-block mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
                            <span class="fw-semibold" style="font-size: 0.95rem;">No registered clients found in Target Client Registry (TCR).</span>
                            <p class="text-muted mb-0" style="font-size: 0.8rem; margin-top: 0.25rem;">Click "Register New Client in TCR" above to enroll a resident.</p>
                        </td>
                    </tr>
                `;
            }
            return;
        }

        dataToRender.forEach(p => {
            const displaySex = (p.sex || p.gender || '--');
            const displayAge = (typeof p.age === 'number' && p.age >= 0) ? p.age : '--';
            const riskBadgeClass = getRiskBadgeClass(p.risk || p.risk_level);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-4">
                    <div class="fw-semibold">${escapeHtml(p.name)}</div>
                    <small class="text-muted" style="font-size: 0.75rem;">PH: ${escapeHtml(p.ph || p.ph_id || 'N/A')}</small>
                </td>
                <td>${displayAge} / ${displaySex.charAt(0)}</td>
                <td>${escapeHtml(p.address ? (p.address + (p.purok ? ', ' + p.purok : '')) : (p.purok || 'Purok 1'))}</td>
                <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-primary); font-weight: 500;">${escapeHtml(p.condition || 'General')}</span></td>
                <td>${escapeHtml(p.lastVisit || p.last_visit || 'Today')}</td>
                <td><span class="badge ${riskBadgeClass}">${escapeHtml(p.risk || p.risk_level || 'Stable')}</span></td>
                <td class="text-right pe-4 space-x-1">
                    <button class="btn btn-sm btn-outline-primary" onclick="openPatientRecord('${escapeHtml(p.name).replace(/'/g, "\\'")}')" title="View Patient Profile"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-outline-success" onclick="quickPrescribe('${escapeHtml(p.name).replace(/'/g, "\\'")}')" title="Consult / Prescribe"><i class="bi bi-capsule"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function loadPatients() {
        if (window.bwcApi && typeof window.bwcApi.fetchAssignedPatients === 'function') {
            patientRegistryData = await window.bwcApi.fetchAssignedPatients();
            renderTCRTable();
            return;
        }

        const authUser = sessionStorage.getItem('bwc_user') || 'charisma';
        const authId = sessionStorage.getItem('bwc_user_id') || '26-001';
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);

            const res = await fetch(`${BACKEND_PATIENTS_URL}?username=${authUser}&user_id=${authId}`, {
                headers: { 'X-Username': authUser, 'X-User-Id': authId },
                credentials: 'include',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    patientRegistryData = json.data.map(p => ({
                        id: p.id,
                        name: p.name || `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim(),
                        firstName: p.first_name || p.firstName || '',
                        middleName: p.middle_name || p.middleName || '',
                        lastName: p.last_name || p.lastName || '',
                        dob: p.dob || '',
                        age: p.age,
                        sex: p.sex || p.gender || 'Unspecified',
                        gender: p.gender || p.sex || 'Unspecified',
                        contact: p.contact || p.contact_number || '',
                        purok: p.purok || 'Purok 1',
                        address: p.address || '',
                        condition: p.condition || 'General',
                        diagnosisDate: p.diagnosis_date || p.diagnosisDate || '',
                        ph: p.ph_id || p.ph || 'Pending',
                        lastVisit: p.last_visit || p.lastVisit || 'Today',
                        risk: p.risk_level || p.risk || 'Stable',
                        assignedBhw: p.handler_id || authUser,
                        programs: p.government_programs || p.programs || [],
                        healthRisks: p.health_risks || p.healthRisks || [],
                        allergies: p.allergies || 'None reported',
                        medHistory: p.medical_history || p.medHistory || '',
                        emergencyName: p.emergency_contact_name || p.emergencyName || '',
                        emergencyRel: p.emergency_contact_relationship || p.emergencyRel || '',
                        emergencyPhone: p.emergency_contact_number || p.emergencyPhone || '',
                        attachments: p.attachments || []
                    }));
                    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patientRegistryData));
                    renderTCRTable();
                    return;
                }
            }
        } catch (e) {
            console.warn("Backend fetch failed, falling back to local storage:", e);
        }

        const raw = localStorage.getItem(STORAGE_KEY_PATIENTS);
        patientRegistryData = raw ? JSON.parse(raw) : [];
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

        if (window.bwcApi && typeof window.bwcApi.connectPatientTableFilters === 'function') {
            window.bwcApi.connectPatientTableFilters({
                onFilterChange: (state) => {
                    const filtered = window.bwcApi.applyPatientTableFilters(patientRegistryData, state);
                    renderTCRTable(filtered);
                }
            });
        }
    });

    // Expose necessary functions globally so HTML onclick attributes work
    window.savePatient = savePatient;
    window.filterTCR = filterTCR;
    window.openPatientRecord = openPatientRecord;
    window.quickPrescribe = quickPrescribe;
    window.handlePatientFileUpload = handlePatientFileUpload;
    window.removeStagedFile = removeStagedFile;
    window.toggleOtherProgramInput = toggleOtherProgramInput;
    window.getRiskBadgeClass = getRiskBadgeClass;
    window.getConditionBadgeClass = getConditionBadgeClass;
})();
