/* ==========================================================================
   BWC-HDMS Portal - Target Client Registry Logic (patientsPage.js)
   ========================================================================== */

// Filter TCR Table Rows
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

// Save New Patient to TCR Table
function savePatient(e) {
    e.preventDefault();
    const name = document.getElementById('newPatientName').value;
    const age = document.getElementById('newPatientAge').value;
    const sex = document.getElementById('newPatientSex').value;
    const purok = document.getElementById('newPatientPurok').value;
    const condition = document.getElementById('newPatientCondition').value;
    const ph = document.getElementById('newPatientPH').value;

    const tbody = document.getElementById('tcrTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="ps-4">
            <div class="fw-semibold">${name}</div>
            <small class="text-muted" style="font-size: 0.75rem;">PH: ${ph}</small>
        </td>
        <td>${age} / ${sex}</td>
        <td>${purok}, San Jose</td>
        <td><span class="badge badge-primary-subtle">${condition}</span></td>
        <td>Today</td>
        <td><span class="badge badge-success">Stable</span></td>
        <td class="text-right pe-4 space-x-1">
            <button class="btn btn-sm btn-outline-primary" onclick="openPatientRecord('${name}')"><i class="bi bi-eye"></i></button>
            <button class="btn btn-sm btn-outline-success" onclick="quickPrescribe('${name}')"><i class="bi bi-capsule"></i></button>
        </td>
    `;
    tbody.prepend(tr);

    closeModal('patientModal');
    document.getElementById('newPatientForm').reset();
    showNotification(`Patient ${name} registered successfully.`, 'success');
}

// Action Helpers
function openPatientRecord(patientName) {
    showNotification(`Opening electronic health record for ${patientName}...`, 'success');
}

function quickPrescribe(patientName) {
    sessionStorage.setItem('consult_patient', patientName);
    showNotification(`Selected patient: ${patientName}. Opening consultation form...`, 'success');
    setTimeout(() => {
        window.location.href = 'vitalsPage.html';
    }, 400);
}
