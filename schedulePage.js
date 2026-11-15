/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Monthly Schedule & Appointments Logic (schedulePage.js)
   ==========================================================================
   Description:
   This module handles the schedule tab operations:
   1. Live Server Date & Time Clock widget (updates every second).
   2. Offline-First data synchronization with Flask/SQLite backend or LocalStorage.
   3. Strict Patient Privacy Boundary: Logged-in BHW only sees patient appointments
      assigned to their care; general upcoming events are visible to all users.
   4. Historical Date Selectors: Year integer counter/selector and month dropdown
      defaulting to current live year and month.
   5. Dynamic enumerated type filtering (appointments + upcoming community events).
   6. Chronological date sorting from closest to latest date.
   7. Expandable event details with 4-word truncation and message bubble modal.
   8. New schedule entry modal styled after the add-medicine-supply UI pattern.
   ========================================================================== */

// Storage keys & Backend API URLs
const STORAGE_KEY_APPOINTMENTS = 'bwc_appointments_db';
const BACKEND_API_URL = 'http://127.0.0.1:5000/api/appointments';
const BACKEND_EVENTS_URL = 'http://127.0.0.1:5000/api/upcoming-events';

// In-memory combined schedule list (appointments + upcoming events)
let scheduleData = [];

// Enumerated Upcoming Event Types
const EVENT_TYPES = [
    'Health Campaign',
    'Community Assembly',
    'Admin Meeting',
    'Training Seminar',
    'Outreach Mission'
];

function isUpcomingEventType(type) {
    return EVENT_TYPES.includes(type);
}

// --------------------------------------------------------------------------
// 1. Live Server Date & Time Clock Widget
// --------------------------------------------------------------------------
function initLiveServerClock() {
    const dateEl = document.getElementById('liveClockDate');
    const timeEl = document.getElementById('liveClockTime');
    if (!dateEl && !timeEl) return;

    function tick() {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        if (dateEl) dateEl.textContent = dateString;
        if (timeEl) timeEl.textContent = timeString;
    }

    tick();
    setInterval(tick, 1000);
}

// --------------------------------------------------------------------------
// 2. Historical Year Navigation Helper
// --------------------------------------------------------------------------
function adjustYear(delta) {
    const yEl = document.getElementById('filterYear');
    if (yEl) {
        const cur = parseInt(yEl.value, 10) || new Date().getFullYear();
        yEl.value = cur + delta;
        renderSchedule();
    }
}

// --------------------------------------------------------------------------
// 3. Data Synchronization & Persistence Layer (Starts Clean / Empty State)
// --------------------------------------------------------------------------
function loadAppointmentsFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
    let appts = [];
    if (raw) {
        try {
            appts = JSON.parse(raw);
        } catch (e) {
            console.error("Error parsing local appointment data:", e);
            appts = [];
        }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let hasStatusChanges = false;

    appts = appts.map(item => {
        if (item.status === 'Pending' && item.scheduledDate < todayStr) {
            item.status = 'Defaulted';
            hasStatusChanges = true;
        }
        return item;
    });

    if (hasStatusChanges) {
        saveAppointmentsToStorage(appts);
    }

    return appts;
}

function saveAppointmentsToStorage(appts) {
    localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(appts));
}

/**
 * Synchronizes with Flask/SQLite backend:
 * - Patient Appointments: strictly queries appointments for logged-in BHW (Privacy Boundary)
 * - General Upcoming Events: queries community events visible to all users
 */
async function syncWithBackend() {
    const authUser = sessionStorage.getItem('bwc_user') || 'charisma';
    const authId = sessionStorage.getItem('bwc_user_id') || '26-001';

    let appointments = [];
    let events = [];

    // 1. Fetch Patient Appointments (enforcing Privacy Boundary)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const resp = await fetch(`${BACKEND_API_URL}?username=${encodeURIComponent(authUser)}&user_id=${encodeURIComponent(authId)}`, {
            signal: controller.signal,
            headers: { 'X-Username': authUser, 'X-User-Id': authId }
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
            const result = await resp.json();
            if (result.success && Array.isArray(result.data)) {
                appointments = result.data.map(item => ({
                    id: item.id,
                    isEvent: false,
                    entryType: 'appointment',
                    patientName: item.patient_name,
                    category: item.category,
                    scheduledDate: item.scheduled_date,
                    purok: item.purok,
                    location: item.purok || 'Barangay Health Station',
                    remarks: item.remarks,
                    details: item.remarks || '',
                    status: item.status,
                    completedDate: item.completed_date
                }));
            }
        }
    } catch (e) {
        console.info("Appointments fetch fallback:", e);
    }

    // 2. Fetch General Upcoming Events (community-wide, visible to all)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const resp = await fetch(BACKEND_EVENTS_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (resp.ok) {
            const result = await resp.json();
            if (result.success && Array.isArray(result.data)) {
                events = result.data.map(item => ({
                    id: item.id,
                    isEvent: true,
                    entryType: 'event',
                    patientName: item.type,
                    category: item.type,
                    scheduledDate: item.date,
                    purok: item.location,
                    location: item.location || 'Poblacion 2',
                    remarks: item.details,
                    details: item.details,
                    status: item.status,
                    completedDate: item.completed_at
                }));
            }
        }
    } catch (e) {
        console.info("Events fetch fallback:", e);
    }

    if (appointments.length > 0 || events.length > 0) {
        scheduleData = [...appointments, ...events];
        saveAppointmentsToStorage(scheduleData);
        return;
    }

    // Fallback: LocalStorage
    scheduleData = loadAppointmentsFromStorage();
}

// --------------------------------------------------------------------------
// 4. UI Rendering Engine & Filtering
// --------------------------------------------------------------------------
/**
 * Renders schedule rows inside #scheduleTableBody based on active filter selections:
 * - Year integer counter/selector
 * - Month dropdown selector (0-11, or "" for all)
 * - Enumerated Type filter (Appointment + Upcoming Event types)
 * - Status filter (Pending, Defaulted, Completed)
 * Sorts chronologically from closest date to latest date.
 */
function renderSchedule() {
    const tableBody = document.getElementById('scheduleTableBody');
    if (!tableBody) return;

    const yearInput = document.getElementById('filterYear');
    const selectedYear = yearInput ? yearInput.value.trim() : "";

    const monthSelect = document.getElementById('filterMonth');
    const selectedMonth = monthSelect ? monthSelect.value : "";
    
    const categorySelect = document.getElementById('filterCategory');
    const selectedCategory = categorySelect ? categorySelect.value : "";
    
    const statusSelect = document.getElementById('filterStatus');
    const selectedStatus = statusSelect ? statusSelect.value : "";

    const todayStr = new Date().toISOString().split('T')[0];

    // Filter items
    const filtered = scheduleData.filter(item => {
        if (!item.scheduledDate) return false;

        const parts = item.scheduledDate.split('-');
        if (parts.length >= 2) {
            const itemYear = parseInt(parts[0], 10);
            const itemMonthIdx = parseInt(parts[1], 10) - 1; // 0-based month

            // 1. Year filter
            if (selectedYear !== "") {
                if (itemYear !== parseInt(selectedYear, 10)) {
                    return false;
                }
            }

            // 2. Month filter (0 = Jan, 11 = Dec)
            if (selectedMonth !== "") {
                if (itemMonthIdx !== parseInt(selectedMonth, 10)) {
                    return false;
                }
            }
        }

        // 3. Category / Type filter
        if (selectedCategory && item.category !== selectedCategory) {
            return false;
        }

        // 4. Status filter
        if (selectedStatus && item.status !== selectedStatus) {
            return false;
        }

        return true;
    });

    // Chronological date sorting: closest date to latest date
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
                    <p class="text-muted mb-0" style="font-size: 0.8rem; margin-top: 0.25rem;">Try adjusting the year or month selector, or reset your type and status filters.</p>
                </td>
            </tr>
        `;
        return;
    }

    // Render table rows
    filtered.forEach(item => {
        const row = document.createElement('tr');
        
        // Relative date badge (Today, Past Due, etc.)
        let dateBadge = '';
        if (item.scheduledDate === todayStr) {
            dateBadge = `<span class="badge badge-primary-subtle ms-2" style="font-size: 0.65rem;">TODAY</span>`;
        } else if (item.status === 'Defaulted') {
            dateBadge = `<span class="badge badge-danger-subtle ms-2" style="font-size: 0.65rem;">PAST DUE</span>`;
        }

        // Formatted display date (e.g., Nov 18, 2026)
        const dateObj = new Date(item.scheduledDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Category & Status Badges
        const categoryBadge = getCategoryBadge(item.category);
        const statusBadge = getStatusBadge(item.status);

        // Details & Location presentation
        let detailsHtml = '';
        if (item.isEvent) {
            // Event Details Truncation & Expansion: truncate after 4 words with "..."
            const words = (item.details || '').trim().split(/\s+/).filter(Boolean);
            if (words.length > 4) {
                const truncated = words.slice(0, 4).join(' ') + '...';
                detailsHtml = `
                    <div class="event-details-trigger d-inline-flex align-center gap-1.5" onclick="openEventBubble(${item.id})" title="Click to view full description" style="cursor: pointer;">
                        <span class="fw-bold" style="color: var(--text-heading); font-size: 0.85rem;">${escapeHtml(truncated)}</span>
                        <span class="badge badge-primary-subtle" style="font-size: 0.65rem; padding: 0.15rem 0.35rem; cursor: pointer;" title="View details">
                            <i class="bi bi-chat-text-fill"></i>
                        </span>
                    </div>
                `;
            } else {
                detailsHtml = `<div class="fw-bold" style="color: var(--text-heading); font-size: 0.85rem;">${escapeHtml(item.details || item.patientName)}</div>`;
            }
            // Display location directly below details
            detailsHtml += `
                <div class="text-muted" style="font-size: 0.75rem; margin-top: 0.15rem;">
                    <i class="bi bi-geo-alt-fill text-primary me-1"></i>${escapeHtml(item.location || 'Poblacion 2')}
                </div>
            `;
        } else {
            // Patient Appointment: bold patient name, location and remarks below
            detailsHtml = `
                <div class="fw-bold" style="color: var(--text-heading); font-size: 0.85rem;">
                    ${escapeHtml(item.patientName)}
                </div>
                <div class="text-muted" style="font-size: 0.75rem; margin-top: 0.15rem;">
                    <i class="bi bi-geo-alt-fill text-primary me-1"></i>${escapeHtml(item.location || item.purok || 'Barangay Health Station')}
                    ${item.remarks ? ` &bull; <span>${escapeHtml(item.remarks)}</span>` : ''}
                </div>
            `;
        }

        // Action Buttons in "ACTION" column
        let actionButtons = '';
        if (item.status === 'Completed') {
            actionButtons = `
                <div class="d-flex justify-end align-center gap-1">
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="toggleAppointmentStatus(${item.id}, ${item.isEvent})" title="Re-open / Mark as Pending">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>Reopen
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="openRescheduleModal(${item.id}, ${item.isEvent})" title="Reschedule Date">
                        <i class="bi bi-calendar-event me-1"></i>Reschedule
                    </button>
                </div>
            `;
        } else {
            actionButtons = `
                <div class="d-flex justify-end align-center gap-1" style="flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm btn-outline-success" onclick="markAppointmentCompleted(${item.id}, ${item.isEvent})" title="Mark Completed">
                        <i class="bi bi-check-lg me-1"></i>Mark Completed
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="openRescheduleModal(${item.id}, ${item.isEvent})" title="Reschedule Date">
                        <i class="bi bi-calendar-event me-1"></i>Reschedule
                    </button>
                    ${(!item.isEvent && item.category !== 'Purok Assembly') ? `
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
            <td>${detailsHtml}</td>
            <td>${statusBadge}</td>
            <td class="text-right pe-4">${actionButtons}</td>
        `;

        tableBody.appendChild(row);
    });
}

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
        case 'Health Campaign':
        case 'Community Assembly':
        case 'Admin Meeting':
        case 'Training Seminar':
        case 'Outreach Mission':
            return `<span class="badge badge-secondary-subtle">${escapeHtml(category)}</span>`;
        default:
            return `<span class="badge badge-secondary-subtle">${escapeHtml(category)}</span>`;
    }
}

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
// 5. Expandable Event Details Message Bubble Modal
// --------------------------------------------------------------------------
function openEventBubble(id) {
    const item = scheduleData.find(a => a.id === id && a.isEvent);
    if (!item) return;

    const typeEl = document.getElementById('bubbleEventType');
    const dateEl = document.getElementById('bubbleEventDate');
    const detailsEl = document.getElementById('bubbleEventDetails');
    const locEl = document.getElementById('bubbleEventLocation');

    const dateObj = new Date(item.scheduledDate + 'T00:00:00');
    const formatted = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    if (typeEl) typeEl.textContent = item.category || 'Event Details';
    if (dateEl) dateEl.textContent = formatted;
    if (detailsEl) detailsEl.textContent = item.details || 'No additional details recorded.';
    if (locEl) locEl.textContent = item.location || 'Poblacion 2';

    openModal('eventBubbleModal');
}

function closeEventBubble() {
    closeModal('eventBubbleModal');
}

// --------------------------------------------------------------------------
// 6. Interactive Table Actions: Complete, Reopen, Reschedule
// --------------------------------------------------------------------------
async function markAppointmentCompleted(id, isEvent = false) {
    const item = scheduleData.find(a => a.id === id && a.isEvent === isEvent);
    if (!item) return;

    const todayStr = new Date().toISOString().split('T')[0];
    item.status = 'Completed';
    item.completedDate = todayStr;

    saveAppointmentsToStorage(scheduleData);
    renderSchedule();
    showNotification(`${item.patientName || item.category} marked as Completed.`, 'success');

    try {
        const url = isEvent ? `${BACKEND_EVENTS_URL}/${id}/status` : `${BACKEND_API_URL}/${id}/status`;
        await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed' })
        });
    } catch (e) {}
}

async function toggleAppointmentStatus(id, isEvent = false) {
    const item = scheduleData.find(a => a.id === id && a.isEvent === isEvent);
    if (!item) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let newStatus = 'Completed';

    if (item.status === 'Completed') {
        newStatus = item.scheduledDate < todayStr ? 'Defaulted' : 'Pending';
        item.completedDate = null;
    } else {
        newStatus = 'Completed';
        item.completedDate = todayStr;
    }

    item.status = newStatus;
    saveAppointmentsToStorage(scheduleData);
    renderSchedule();

    showNotification(`Status updated to ${newStatus} for ${item.patientName || item.category}.`, 'success');

    try {
        const url = isEvent ? `${BACKEND_EVENTS_URL}/${id}/status` : `${BACKEND_API_URL}/${id}/status`;
        await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
    } catch (e) {}
}

function openRescheduleModal(id, isEvent = false) {
    const item = scheduleData.find(a => a.id === id && a.isEvent === isEvent);
    if (!item) return;

    const idInput = document.getElementById('reschedApptId');
    const isEvtInput = document.getElementById('reschedIsEvent');
    const subtitle = document.getElementById('reschedPatientSubtitle');
    const dateInput = document.getElementById('reschedNewDate');
    const reasonInput = document.getElementById('reschedReason');

    if (idInput) idInput.value = item.id;
    if (isEvtInput) isEvtInput.value = item.isEvent ? 'true' : 'false';
    if (subtitle) subtitle.innerHTML = `${escapeHtml(item.patientName || item.category)} &bull; ${escapeHtml(item.category)}`;
    if (dateInput) dateInput.value = item.scheduledDate;
    if (reasonInput) reasonInput.value = '';

    openModal('rescheduleModal');
}

function closeRescheduleModal() {
    closeModal('rescheduleModal');
}

async function confirmReschedule(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('reschedApptId').value, 10);
    const isEvent = document.getElementById('reschedIsEvent')?.value === 'true';
    const newDate = document.getElementById('reschedNewDate').value;
    const reason = document.getElementById('reschedReason').value.trim();

    if (!newDate) {
        showNotification('Please select a valid date.', 'danger');
        return;
    }

    const item = scheduleData.find(a => a.id === id && a.isEvent === isEvent);
    if (!item) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const oldDate = item.scheduledDate;

    item.scheduledDate = newDate;
    item.status = newDate < todayStr ? 'Defaulted' : 'Pending';
    item.completedDate = null;

    const appendNote = `Rescheduled from ${oldDate} to ${newDate}${reason ? `: ${reason}` : ''}`;
    item.remarks = item.remarks ? `${item.remarks} | ${appendNote}` : appendNote;
    item.details = item.remarks;

    saveAppointmentsToStorage(scheduleData);
    closeRescheduleModal();
    renderSchedule();
    showNotification(`Rescheduled to ${newDate}.`, 'success');

    try {
        const url = isEvent ? `${BACKEND_EVENTS_URL}/${id}/reschedule` : `${BACKEND_API_URL}/${id}/reschedule`;
        await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                new_date: newDate,
                scheduled_date: newDate,
                reason: reason
            })
        });
    } catch (e) {}
}

function proceedToConsultation(patientName) {
    sessionStorage.setItem('consult_patient', patientName);
    window.location.href = `vitalsPage.html?patient=${encodeURIComponent(patientName)}`;
}

// --------------------------------------------------------------------------
// 7. Modal Handling: New Schedule Entry Creation (Bubble Pattern)
// --------------------------------------------------------------------------
function handleSchedTypeChange() {
    const cat = document.getElementById('schedCategory').value;
    const lbl = document.getElementById('lblSchedTarget');
    const input = document.getElementById('schedPatientName');
    if (isUpcomingEventType(cat)) {
        if (lbl) lbl.innerHTML = 'Event Target / Beneficiaries <span class="text-danger">*</span>';
        if (input) input.placeholder = 'e.g. Barangay Residents, Senior Citizens, BHW Staff';
    } else {
        if (lbl) lbl.innerHTML = 'Target Client / Beneficiary <span class="text-danger">*</span>';
        if (input) input.placeholder = 'e.g. Juan Dela Cruz';
    }
}

function openScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;

    const form = document.getElementById('newScheduleForm');
    if (form) form.reset();

    const datalist = document.getElementById('patientSuggestions');
    if (datalist) {
        datalist.innerHTML = `
            <option value="Barangay Residents - Purok 1">
            <option value="Barangay Residents - Purok 2">
            <option value="Barangay Residents - Purok 3">
            <option value="Hypertension & Diabetes Patients">
            <option value="Senior Citizens Circle">
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

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('schedDate');
    if (dateInput) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
    }

    handleSchedTypeChange();
    openModal('scheduleModal');
}

function closeScheduleModal() {
    closeModal('scheduleModal');
}

async function saveScheduleEntry(e) {
    e.preventDefault();

    const category = document.getElementById('schedCategory').value;
    const patientName = document.getElementById('schedPatientName').value.trim();
    const scheduledDate = document.getElementById('schedDate').value;
    const location = document.getElementById('schedPurok').value.trim();
    const remarks = document.getElementById('schedRemarks').value.trim();

    if (!patientName || !scheduledDate) {
        showNotification('Please fill in required fields.', 'danger');
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const initialStatus = scheduledDate < todayStr ? 'Defaulted' : 'Pending';
    const isEvt = isUpcomingEventType(category);

    const newEntry = {
        id: Date.now(),
        isEvent: isEvt,
        entryType: isEvt ? 'event' : 'appointment',
        category: category,
        patientName: patientName,
        scheduledDate: scheduledDate,
        purok: location,
        location: location,
        remarks: remarks,
        details: remarks,
        status: initialStatus,
        completedDate: null
    };

    scheduleData.push(newEntry);
    saveAppointmentsToStorage(scheduleData);

    closeScheduleModal();
    renderSchedule();
    showNotification(`New schedule entry added: ${category}`, 'success');

    try {
        if (isEvt) {
            const resp = await fetch(BACKEND_EVENTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: scheduledDate,
                    type: category,
                    details: remarks || patientName,
                    location: location,
                    status: initialStatus
                })
            });
            if (resp.ok) {
                const resData = await resp.json();
                if (resData.data && resData.data.id) newEntry.id = resData.data.id;
            }
        } else {
            const authId = sessionStorage.getItem('bwc_user_id') || '26-001';
            const resp = await fetch(BACKEND_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_name: patientName,
                    category: category,
                    scheduled_date: scheduledDate,
                    purok: location,
                    remarks: remarks,
                    user_id: authId,
                    status: initialStatus
                })
            });
            if (resp.ok) {
                const resData = await resp.json();
                if (resData.data && resData.data.id) newEntry.id = resData.data.id;
            }
        }
    } catch (e) {}
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

// --------------------------------------------------------------------------
// 8. Page Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize real-time live clock
    initLiveServerClock();

    // 2. Set default live year and month in historical selectors
    const now = new Date();
    const yearInput = document.getElementById('filterYear');
    const monthSelect = document.getElementById('filterMonth');
    if (yearInput) yearInput.value = now.getFullYear();
    if (monthSelect) monthSelect.value = String(now.getMonth());

    // 3. Synchronize data (enforcing patient privacy for appointments, and community events)
    await syncWithBackend();

    // 4. Render schedule table with live month/year filters sorted chronologically
    renderSchedule();
});
