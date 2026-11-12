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

    // 4. Render critical inventory alerts dynamically
    updateCriticalInventoryAlerts();
});

// --------------------------------------------------------------------------
// 1. Dynamic Schedule & Registry Metrics Calculation
// --------------------------------------------------------------------------
async function updateDashboardMetrics() {
    const dueTodayEl = document.getElementById('statDueToday');
    const overdueEl = document.getElementById('statOverdue');
    const activeEl = document.getElementById('statActive');
    const lowStockEl = document.getElementById('statLowStock');

    // A. Attempt to pull from Flask / SQLite backend API
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const response = await fetch(BACKEND_STATS_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                if (dueTodayEl) dueTodayEl.textContent = result.data.due_today ?? 0;
                if (overdueEl) overdueEl.textContent = result.data.overdue_defaulted ?? 0;
                if (activeEl) activeEl.textContent = result.data.active_patients ?? 0;
                if (lowStockEl) lowStockEl.textContent = result.data.low_stock ?? 0;
                console.log("Dashboard stats populated from Flask SQLite backend:", result.data);
                return;
            }
        }
    } catch (e) {
        // Fallback to offline LocalStorage
    }

    // B. Offline LocalStorage calculation (Starts clean / zero state)
    let appts = [];
    try {
        const rawAppts = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
        appts = rawAppts ? JSON.parse(rawAppts) : [];
    } catch (e) {
        appts = [];
    }

    let patients = [];
    try {
        const rawPatients = localStorage.getItem('bwc_patients_db');
        patients = rawPatients ? JSON.parse(rawPatients) : [];
    } catch (e) {
        patients = [];
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
    if (activeEl) activeEl.textContent = patients.length;
}

// --------------------------------------------------------------------------
// 2. Recent Consultations Dynamic Display
// --------------------------------------------------------------------------
function updateRecentConsultations() {
    const tableBody = document.getElementById('recentConsultTable');
    if (!tableBody) return;

    try {
        const raw = localStorage.getItem('bwc_consultations_db');
        const consults = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(consults) || consults.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-clipboard2-x d-block mb-1" style="font-size: 1.5rem; opacity: 0.5;"></i>
                        <span>No recent consultations recorded yet.</span>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';
        consults.slice(0, 5).forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="ps-4 fw-semibold">${escapeHtml(c.patient)}</td>
                <td><span class="badge badge-primary-subtle">Consultation</span></td>
                <td>${c.sys}/${c.dia} mmHg ${c.glu > 0 ? `&bull; ${c.glu} mg/dL` : ''}</td>
                <td><span class="badge ${c.risk && c.risk.includes('High') ? 'badge-danger' : c.risk && c.risk.includes('Moderate') ? 'badge-warning' : 'badge-success'}">${escapeHtml(c.risk || 'Stable')}</span></td>
                <td class="text-right pe-4 text-muted" style="font-size: 0.75rem;">${escapeHtml(c.date)}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (e) {
        console.error("Error rendering recent consultations:", e);
    }
}

// --------------------------------------------------------------------------
// 3. Critical Inventory Alerts Dynamic Display
// --------------------------------------------------------------------------
async function updateCriticalInventoryAlerts() {
    const container = document.getElementById('criticalInventoryAlerts');
    if (!container) return;

    let items = [];
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch('http://127.0.0.1:5000/api/inventory', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                items = data.data;
            }
        }
    } catch (e) {
        // Fallback to local storage
    }

    if (items.length === 0) {
        try {
            const raw = localStorage.getItem('bwc_inventory_db');
            if (raw) items = JSON.parse(raw);
        } catch (e) {
            items = [];
        }
    }

    const lowStockItems = items.filter(i => {
        const stock = i.current_stock ?? i.stock ?? 0;
        const reorder = i.reorder_level ?? i.reorderLevel ?? 20;
        return stock <= reorder;
    });

    if (lowStockItems.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-shield-check d-block mb-1" style="font-size: 1.5rem; opacity: 0.5;"></i>
                <span>No critical stock alerts. All supplies adequate or unseeded.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    lowStockItems.slice(0, 3).forEach(item => {
        const name = item.item_name || item.name;
        const stock = item.current_stock ?? item.stock ?? 0;
        const reorder = item.reorder_level ?? item.reorderLevel ?? 20;
        const isCritical = stock <= 10;
        const percent = Math.min(100, Math.max(5, Math.round((stock / Math.max(1, reorder * 2)) * 100)));

        const div = document.createElement('div');
        div.style.cssText = 'padding: 0.85rem; border: 1px solid var(--border-color); border-radius: 8px; background-color: var(--bg-surface-secondary);';
        div.innerHTML = `
            <div class="d-flex justify-between align-center mb-1">
                <span class="fw-semibold" style="font-size: 0.8rem;">${escapeHtml(name)}</span>
                <span class="badge ${isCritical ? 'badge-danger' : 'badge-warning'}">${stock} tabs left</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill ${isCritical ? 'bg-fill-danger' : 'bg-fill-warning'}" style="width: ${percent}%;"></div>
            </div>
        `;
        container.appendChild(div);
    });
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
