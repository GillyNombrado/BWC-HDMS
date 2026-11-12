/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Dashboard Page Logic (dashboardPage.js)
   ==========================================================================
   Description:
   Controls executive dashboard metrics:
   1. Dynamic stat counters: "Due Today Follow-ups" and "Overdue / Defaulted"
      calculated directly from appointments data store (SQLite / LocalStorage).
   2. Privacy policy acknowledgment session gatekeeper.
   3. Quick navigation handlers.
   ========================================================================== */

const STORAGE_KEY_APPOINTMENTS = 'bwc_appointments_db';
const BACKEND_STATS_URL = 'http://127.0.0.1:5000/api/appointments/stats';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Show Privacy Terms modal on initial visit if not yet acknowledged in this session
    initPrivacyGate();

    // 2. Dynamically pull metrics from schedule appointments data store
    updateDashboardMetrics();

    // 3. Render recent consultations if saved locally
    updateRecentConsultations();
});

// --------------------------------------------------------------------------
// 1. Dynamic Schedule Metrics Calculation
// --------------------------------------------------------------------------
async function updateDashboardMetrics() {
    const dueTodayEl = document.getElementById('statDueToday');
    const overdueEl = document.getElementById('statOverdue');

    if (!dueTodayEl && !overdueEl) return;

    // A. Attempt to pull from Flask / SQLite backend API
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const response = await fetch(BACKEND_STATS_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                if (dueTodayEl) dueTodayEl.textContent = result.data.due_today;
                if (overdueEl) overdueEl.textContent = result.data.overdue_defaulted;
                console.log("Dashboard stats populated from Flask SQLite backend:", result.data);
                return;
            }
        }
    } catch (e) {
        // Fallback to offline LocalStorage
    }

    // B. Offline LocalStorage calculation
    let appts = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
        if (raw) {
            appts = JSON.parse(raw);
        } else {
            // Seed initial counts matching initial schedule
            appts = [
                { status: 'Pending', scheduledDate: new Date().toISOString().split('T')[0] },
                { status: 'Pending', scheduledDate: new Date().toISOString().split('T')[0] },
                { status: 'Defaulted', scheduledDate: '2026-10-15' },
                { status: 'Defaulted', scheduledDate: '2026-10-20' },
                { status: 'Defaulted', scheduledDate: '2026-11-01' }
            ];
        }
    } catch (e) {
        appts = [];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let dueTodayCount = 0;
    let overdueCount = 0;

    appts.forEach(item => {
        const isPast = item.scheduledDate < todayStr;
        const isToday = item.scheduledDate === todayStr;

        if (item.status === 'Defaulted') {
            overdueCount++;
        } else if (item.status === 'Pending') {
            if (isToday) {
                dueTodayCount++;
            } else if (isPast) {
                overdueCount++;
            }
        }
    });

    if (dueTodayEl) dueTodayEl.textContent = dueTodayCount;
    if (overdueEl) overdueEl.textContent = overdueCount;
}

// --------------------------------------------------------------------------
// 2. Recent Consultations Dynamic Display
// --------------------------------------------------------------------------
function updateRecentConsultations() {
    const tableBody = document.getElementById('recentConsultTable');
    if (!tableBody) return;

    try {
        const raw = localStorage.getItem('bwc_consultations_db');
        if (!raw) return;
        const consults = JSON.parse(raw);
        if (!Array.isArray(consults) || consults.length === 0) return;

        // Render recent consultations prepended
        consults.slice(0, 5).forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="ps-4 fw-semibold">${escapeHtml(c.patient)}</td>
                <td><span class="badge badge-primary-subtle">Consultation</span></td>
                <td>${c.sys}/${c.dia} mmHg ${c.glu > 0 ? `&bull; ${c.glu} mg/dL` : ''}</td>
                <td><span class="badge ${c.risk.includes('High') ? 'badge-danger' : c.risk.includes('Moderate') ? 'badge-warning' : 'badge-success'}">${escapeHtml(c.risk)}</span></td>
                <td class="text-right pe-4 text-muted" style="font-size: 0.75rem;">${c.date}</td>
            `;
            tableBody.prepend(row);
        });
    } catch (e) {
        console.error("Error rendering recent consultations:", e);
    }
}

// --------------------------------------------------------------------------
// 3. Privacy Policy Modal Gatekeeper
// --------------------------------------------------------------------------
function initPrivacyGate() {
    const privacyModal = document.getElementById('privacyModal');
    const hasAgreed = sessionStorage.getItem('bwc_privacy_acknowledged');

    if (privacyModal && !hasAgreed) {
        openModal('privacyModal');

        const agreeCheck = document.getElementById('agreePrivacy');
        const btnAccept = document.getElementById('btnAcceptPrivacy');

        if (agreeCheck && btnAccept) {
            agreeCheck.addEventListener('change', function() {
                btnAccept.disabled = !this.checked;
            });

            btnAccept.addEventListener('click', () => {
                closeModal('privacyModal');
                sessionStorage.setItem('bwc_privacy_acknowledged', 'true');
                showNotification('Privacy terms acknowledged. Station ready.', 'success');
            });
        }
    }
}

// Quick action navigation
function goToNewVisit() {
    window.location.href = 'vitalsPage.html';
}

function goToRegistry() {
    window.location.href = 'patientsPage.html';
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
