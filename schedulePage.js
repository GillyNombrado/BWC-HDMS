/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Monthly Schedule & Appointments Logic (schedulePage.js)
   ==========================================================================
   Description:
   This module handles the schedule tab operations:
   1. Live Server Date & Time Clock widget (updates every second).
   2. Offline-First data synchronization with Flask/SQLite backend or LocalStorage.
   3. Dynamic month, category, and status filtering for health workers.
   4. Automatic "Defaulted" status evaluation for overdue pending appointments.
   5. Interactive Table Action buttons: "Mark Completed", "Reschedule", "Reopen".
   6. Reschedule Modal handling & date recalculation.
   7. New schedule creation for client follow-ups and Purok assemblies.
   ========================================================================== */

// Storage keys & Backend API URL
const STORAGE_KEY_APPOINTMENTS = 'bwc_appointments_db';
const BACKEND_API_URL = 'http://127.0.0.1:5000/api/appointments';

// In-memory appointments list
let scheduleData = [];

// --------------------------------------------------------------------------
// 1. Live Server Date & Time Clock Widget
// --------------------------------------------------------------------------
/**
 * Starts a real-time interval clock displaying current server/system date & time.
 * Updates #liveClockDate and #liveClockTime every 1,000 milliseconds.
 */
function initLiveServerClock() {
    const dateEl = document.getElementById('liveClockDate');
    const timeEl = document.getElementById('liveClockTime');
    if (!dateEl && !timeEl) return;

    function tick() {
        const now = new Date();

        // Format Date: e.g. "Thu, Nov 12, 2026"
        const dateString = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Format Time: e.g. "09:12:45 PM"
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        if (dateEl) dateEl.textContent = dateString;
        if (timeEl) timeEl.textContent = timeString;
    }

    // Run initial tick immediately, then set interval
    tick();
    setInterval(tick, 1000);
}

// --------------------------------------------------------------------------
// 2. Initial Schedule Data Layer (Clean Zero State)
// --------------------------------------------------------------------------
function getInitialSeedAppointments() {
    // Pristine empty array for clean database imports and live testing
    return [];
}

// --------------------------------------------------------------------------
// 3. Data Synchronization & Persistence Layer (Starts Clean / Empty State)
// --------------------------------------------------------------------------
/**
 * Loads appointments from localStorage.
 * Automatically checks and flags overdue 'Pending' appointments as 'Defaulted'.
 */
function loadAppointmentsFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
    let appts = [];
    if (raw) {
        try {
            appts = JSON.parse(raw);
        } catch (e) {
            console.error("Error parsing local appointment data:", e);
            appts = getInitialSeedAppointments();
        }
    } else {
        appts = getInitialSeedAppointments();
        saveAppointmentsToStorage(appts);
    }

    // Auto-status validation:
    // If appointment is 'Pending' and scheduledDate < today, mark as 'Defaulted'
    const todayStr = new Date().toISOString().split('T')[0];
    let hasStatusChanges = false;

    appts = appts.map(appt => {
        if (appt.status === 'Pending' && appt.scheduledDate < todayStr) {
            appt.status = 'Defaulted';
            hasStatusChanges = true;
        }
        return appt;
    });

    if (hasStatusChanges) {
        saveAppointmentsToStorage(appts);
    }

    return appts;
}

/**
 * Persists appointments array to localStorage.
 */
function saveAppointmentsToStorage(appts) {
    localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(appts));
}

/**
 * Attempts to fetch latest appointments from Flask/SQLite backend.
 * Falls back seamlessly to offline localStorage if server is unreachable.
 */
async function syncWithBackend() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const response = await fetch(BACKEND_API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                // Map backend SQLite snake_case fields to frontend camelCase
                scheduleData = result.data.map(item => ({
                    id: item.id,
                    patientName: item.patient_name,
                    category: item.category,
                    scheduledDate: item.scheduled_date,
                    purok: item.purok,
                    remarks: item.remarks,
                    status: item.status,
                    completedDate: item.completed_date
                }));
                saveAppointmentsToStorage(scheduleData);
                console.log("Successfully synchronized with Flask / SQLite backend.");
                return;
            }
        }
    } catch (err) {
        console.info("Flask backend offline. Running via LocalStorage persistence.");
    }

    // Fallback: Read from LocalStorage
    scheduleData = loadAppointmentsFromStorage();
}

// --------------------------------------------------------------------------
// 4. UI Rendering Engine & Filtering
// --------------------------------------------------------------------------
/**
 * Renders schedule rows inside #scheduleTableBody based on active filter selections.
 */
function renderSchedule() {
    const tableBody = document.getElementById('scheduleTableBody');
    if (!tableBody) return;

    // Filter values
    const monthSelect = document.getElementById('filterMonth');
    const selectedMonth = monthSelect ? monthSelect.value : "";
    
    const categorySelect = document.getElementById('filterCategory');
    const selectedCategory = categorySelect ? categorySelect.value : "";
    
    const statusSelect = document.getElementById('filterStatus');
    const selectedStatus = statusSelect ? statusSelect.value : "";

    const todayStr = new Date().toISOString().split('T')[0];

    // Filter items
    const filtered = scheduleData.filter(item => {
        // 1. Month filter (0 = Jan, 11 = Dec)
        if (selectedMonth !== "") {
            const itemDate = new Date(item.scheduledDate + 'T00:00:00');
            if (itemDate.getMonth() !== parseInt(selectedMonth, 10)) {
                return false;
            }
        }

        // 2. Category filter
        if (selectedCategory && item.category !== selectedCategory) {
            return false;
        }

        // 3. Status filter
        if (selectedStatus && item.status !== selectedStatus) {
            return false;
        }

        return true;
    });

    // Sort by scheduledDate ascending
    filtered.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

    // Clear previous rows
    tableBody.innerHTML = '';

    // Empty state handling
    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-muted">
                    <i class="bi bi-calendar-x d-block mb-2" style="font-size: 2rem; color: var(--text-muted); opacity: 0.6;"></i>
                    <span class="fw-semibold" style="font-size: 0.95rem;">No scheduled check-ups or events match the selected criteria.</span>
                    <p class="text-muted mb-0" style="font-size: 0.8rem; margin-top: 0.25rem;">Try selecting "All Months" or reset your category and status filters.</p>
                </td>
            </tr>
        `;
        return;
    }

    // Render table rows
    filtered.forEach(item => {
        const row = document.createElement('tr');
        
        // Relative date indicator (Today, Past Due, etc.)
        let dateBadge = '';
        if (item.scheduledDate === todayStr) {
            dateBadge = `<span class="badge badge-primary-subtle ms-2" style="font-size: 0.65rem;">TODAY</span>`;
        } else if (item.status === 'Defaulted') {
            dateBadge = `<span class="badge badge-danger-subtle ms-2" style="font-size: 0.65rem;">PAST DUE</span>`;
        }

        // Formatted display date (e.g., Nov 12, 2026)
        const dateObj = new Date(item.scheduledDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Category & Status Badges
        const categoryBadge = getCategoryBadge(item.category);
        const statusBadge = getStatusBadge(item.status);

        // Action Buttons in "ACTION" column
        let actionButtons = '';
        if (item.status === 'Completed') {
            actionButtons = `
                <div class="d-flex justify-end align-center gap-1">
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="toggleAppointmentStatus(${item.id})" title="Re-open / Mark as Pending">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>Reopen
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="openRescheduleModal(${item.id})" title="Reschedule Date">
                        <i class="bi bi-calendar-event me-1"></i>Reschedule
                    </button>
                </div>
            `;
        } else {
            actionButtons = `
                <div class="d-flex justify-end align-center gap-1" style="flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm btn-outline-success" onclick="markAppointmentCompleted(${item.id})" title="Mark Completed">
                        <i class="bi bi-check-lg me-1"></i>Mark Completed
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="openRescheduleModal(${item.id})" title="Reschedule Date">
                        <i class="bi bi-calendar-event me-1"></i>Reschedule
                    </button>
                    ${item.category !== 'Purok Assembly' ? `
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="proceedToConsultation('${escapeHtml(item.patientName)}')" title="Start Consultation">
                        <i class="bi bi-clipboard2-pulse"></i>
                    </button>` : ''}
                </div>
            `;
        }

        row.innerHTML = `
            <td class="ps-4 fw-semibold" style="white-space: nowrap;">
                ${formattedDate} ${dateBadge}
                <div class="text-muted" style="font-size: 0.75rem; font-weight: normal;">${item.scheduledDate}</div>
            </td>
            <td>${categoryBadge}</td>
            <td>
                <div class="fw-bold" style="color: var(--text-heading); font-size: 0.85rem;">
                    ${escapeHtml(item.patientName)}
                </div>
                <div class="text-muted" style="font-size: 0.75rem; margin-top: 0.15rem;">
                    <i class="bi bi-geo-alt-fill text-primary me-1"></i>${escapeHtml(item.purok || 'Barangay Health Station')}
                    ${item.remarks ? ` &bull; <span>${escapeHtml(item.remarks)}</span>` : ''}
                </div>
            </td>
            <td>${statusBadge}</td>
            <td class="text-right pe-4">${actionButtons}</td>
        `;

        tableBody.appendChild(row);
    });
}

/**
 * Returns styled HTML badge markup for scheduling category.
 */
function getCategoryBadge(category) {
    switch (category) {
        case 'Monthly HPN Check':
            return `<span class="badge badge-danger-subtle"><i class="bi bi-heart-pulse-fill me-1"></i>Monthly HPN Check</span>`;
        case 'Diabetes Follow-up':
            return `<span class="badge badge-primary-subtle"><i class="bi bi-droplet-half me-1"></i>Diabetes Follow-up</span>`;
        case 'Medicine Refill':
            return `<span class="badge badge-warning"><i class="bi bi-capsule me-1"></i>Medicine Refill</span>`;
        case 'Purok Assembly':
            return `<span class="badge badge-success"><i class="bi bi-megaphone-fill me-1"></i>Purok Assembly</span>`;
        default:
            return `<span class="badge badge-secondary-subtle">${escapeHtml(category)}</span>`;
    }
}

/**
 * Returns styled HTML badge markup for status.
 */
function getStatusBadge(status) {
    switch (status) {
        case 'Completed':
            return `<span class="badge badge-success"><i class="bi bi-check-circle-fill me-1"></i>Completed</span>`;
        case 'Defaulted':
            return `<span class="badge badge-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Defaulted</span>`;
        case 'Pending':
        default:
            return `<span class="badge badge-primary"><i class="bi bi-clock-history me-1"></i>Pending</span>`;
    }
}

// --------------------------------------------------------------------------
// 5. Interactive Table Actions: Complete, Reopen, Reschedule
// --------------------------------------------------------------------------
/**
 * Direct action to mark an appointment as Completed.
 * Updates badge to green and saves timestamp.
 */
async function markAppointmentCompleted(id) {
    const appt = scheduleData.find(a => a.id === id);
    if (!appt) return;

    const todayStr = new Date().toISOString().split('T')[0];
    appt.status = 'Completed';
    appt.completedDate = todayStr;

    saveAppointmentsToStorage(scheduleData);
    renderSchedule();
    showNotification(`Appointment for ${appt.patientName} marked as Completed.`, 'success');

    // Attempt background sync with Flask backend
    try {
        await fetch(`${BACKEND_API_URL}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed' })
        });
    } catch (e) {
        // Handled silently in offline mode
    }
}

/**
 * Re-opens a Completed appointment back to Pending or Defaulted depending on scheduled date.
 */
async function toggleAppointmentStatus(id) {
    const appt = scheduleData.find(a => a.id === id);
    if (!appt) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let newStatus = 'Completed';

    if (appt.status === 'Completed') {
        newStatus = appt.scheduledDate < todayStr ? 'Defaulted' : 'Pending';
        appt.completedDate = null;
    } else {
        newStatus = 'Completed';
        appt.completedDate = todayStr;
    }

    appt.status = newStatus;
    saveAppointmentsToStorage(scheduleData);
    renderSchedule();

    showNotification(`Status updated to ${newStatus} for ${appt.patientName}.`, 'success');

    try {
        await fetch(`${BACKEND_API_URL}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
    } catch (e) {
        // Handled silently in offline mode
    }
}

/**
 * Opens the Reschedule Modal pre-filled with the selected appointment's data.
 */
function openRescheduleModal(id) {
    const appt = scheduleData.find(a => a.id === id);
    if (!appt) return;

    const idInput = document.getElementById('reschedApptId');
    const subtitle = document.getElementById('reschedPatientSubtitle');
    const dateInput = document.getElementById('reschedNewDate');
    const reasonInput = document.getElementById('reschedReason');

    if (idInput) idInput.value = appt.id;
    if (subtitle) subtitle.textContent = `${appt.patientName} &bull; ${appt.category}`;
    if (dateInput) dateInput.value = appt.scheduledDate;
    if (reasonInput) reasonInput.value = '';

    openModal('rescheduleModal');
}

function closeRescheduleModal() {
    closeModal('rescheduleModal');
}

/**
 * Confirms appointment rescheduling, updates date, evaluates status, and persists.
 */
async function confirmReschedule(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('reschedApptId').value, 10);
    const newDate = document.getElementById('reschedNewDate').value;
    const reason = document.getElementById('reschedReason').value.trim();

    if (!newDate) {
        showNotification('Please select a valid date.', 'danger');
        return;
    }

    const appt = scheduleData.find(a => a.id === id);
    if (!appt) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const oldDate = appt.scheduledDate;

    // Update fields
    appt.scheduledDate = newDate;
    appt.status = newDate < todayStr ? 'Defaulted' : 'Pending';
    appt.completedDate = null;

    // Append audit note into remarks
    const appendNote = `Rescheduled from ${oldDate} to ${newDate}${reason ? `: ${reason}` : ''}`;
    appt.remarks = appt.remarks ? `${appt.remarks} | ${appendNote}` : appendNote;

    saveAppointmentsToStorage(scheduleData);
    closeRescheduleModal();
    renderSchedule();
    showNotification(`Rescheduled ${appt.patientName} to ${newDate}.`, 'success');

    // Attempt backend sync with Flask/SQLite
    try {
        await fetch(`${BACKEND_API_URL}/${id}/reschedule`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scheduled_date: newDate,
                reason: reason
            })
        });
    } catch (e) {
        // Handled silently in offline mode
    }
}

/**
 * Quick action to jump straight to vitals consultation form for the selected patient.
 */
function proceedToConsultation(patientName) {
    sessionStorage.setItem('consult_patient', patientName);
    window.location.href = 'vitalsPage.html';
}

// --------------------------------------------------------------------------
// 6. Modal Handling: New Schedule Entry Creation
// --------------------------------------------------------------------------
function openScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;

    const form = document.getElementById('newScheduleForm');
    if (form) form.reset();

    // Populate patient suggestions dynamically from TCR storage
    const datalist = document.getElementById('patientSuggestions');
    if (datalist) {
        datalist.innerHTML = `
            <option value="Barangay Residents - Purok 1">
            <option value="Barangay Residents - Purok 2">
            <option value="Barangay Residents - Purok 3">
        `;
        try {
            const raw = localStorage.getItem('bwc_patients_db');
            if (raw) {
                const patients = JSON.parse(raw);
                patients.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.name;
                    datalist.appendChild(opt);
                });
            }
        } catch (e) {}
    }

    // Default scheduled date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('schedDate');
    if (dateInput) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
    }

    openModal('scheduleModal');
}

function closeScheduleModal() {
    closeModal('scheduleModal');
}

/**
 * Handles submission of new schedule form.
 */
async function saveScheduleEntry(e) {
    e.preventDefault();

    const category = document.getElementById('schedCategory').value;
    const patientName = document.getElementById('schedPatientName').value.trim();
    const scheduledDate = document.getElementById('schedDate').value;
    const purok = document.getElementById('schedPurok').value;
    const remarks = document.getElementById('schedRemarks').value.trim();

    if (!patientName || !scheduledDate) {
        showNotification('Please fill in required fields.', 'danger');
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const initialStatus = scheduledDate < todayStr ? 'Defaulted' : 'Pending';

    const newAppointment = {
        id: Date.now(),
        patientName: patientName,
        category: category,
        scheduledDate: scheduledDate,
        purok: purok,
        remarks: remarks,
        status: initialStatus,
        completedDate: null
    };

    scheduleData.push(newAppointment);
    saveAppointmentsToStorage(scheduleData);

    closeScheduleModal();
    renderSchedule();
    showNotification(`New schedule entry added for ${patientName}`, 'success');

    try {
        await fetch(BACKEND_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_name: patientName,
                category: category,
                scheduled_date: scheduledDate,
                purok: purok,
                remarks: remarks,
                status: initialStatus
            })
        });
    } catch (e) {
        // Handled silently in offline mode
    }
}

// Helper to sanitize HTML content
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --------------------------------------------------------------------------
// 7. Page Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize real-time live clock
    initLiveServerClock();

    // 2. Synchronize data (Backend SQLite or LocalStorage)
    await syncWithBackend();

    // 3. Render schedule table with initial filters
    renderSchedule();
});
