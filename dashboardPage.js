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
const BACKEND_STATS_URL = '/api/dashboard/stats';

document.addEventListener('DOMContentLoaded', () => {
    // 0. Synchronize logged-in user profile header
    syncDashboardUserHeader();

    // 1. Show Privacy Terms modal on initial visit if not yet acknowledged in this session
    initPrivacyGate();

    // 2. Dynamically pull metrics from schedule appointments data store
    updateDashboardMetrics();

    // 3. Render recent consultations if saved locally
    updateRecentConsultations();

    // 4. Render critical inventory alerts dynamically
    updateCriticalInventoryAlerts();
});

function syncDashboardUserHeader() {
    if (typeof initUserProfile === 'function') {
        initUserProfile();
    }
    const fullName = sessionStorage.getItem('bwc_full_name') || sessionStorage.getItem('bwc_user') || 'Charisma Astronomo';
    let station = sessionStorage.getItem('bwc_station') || sessionStorage.getItem('bwc_purok') || 'Purok 1';
    if (station && station.includes(',')) {
        station = station.split(',')[0].trim();
    }
    
    const profileName = document.getElementById('userProfileName');
    if (profileName) profileName.textContent = fullName;
    const profileStation = document.getElementById('userProfileStation');
    if (profileStation) profileStation.textContent = station;
    const activeStation = document.getElementById('dashActiveStation');
    if (activeStation) activeStation.textContent = station;
}

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
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        let response = null;
        try {
            response = await fetch(BACKEND_STATS_URL, { signal: controller.signal });
        } catch (fetchErr) {
            response = await fetch('/api/appointments/stats', { signal: controller.signal });
        }
        clearTimeout(timeoutId);

        if (response && response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                if (dueTodayEl) dueTodayEl.textContent = result.data.due_today ?? 0;
                if (overdueEl) overdueEl.textContent = result.data.overdue_defaulted ?? 0;
                if (activeEl) activeEl.textContent = result.data.total_patients ?? result.data.total_patients_poblacion_2 ?? result.data.active_patients ?? 0;
                if (lowStockEl) lowStockEl.textContent = result.data.low_stock ?? result.data.low_stock_medicines ?? 0;
                console.log("Dashboard stats populated from Flask SQLite backend:", result.data);
                return;
            }
        }
    } catch (e) {
        console.warn("Backend stats fetch error, falling back to local calculation:", e);
    }

    // B. Offline LocalStorage calculation fallback
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

    let inventory = [];
    try {
        const rawInv = localStorage.getItem('bwc_inventory_db');
        inventory = rawInv ? JSON.parse(rawInv) : [];
    } catch (e) {
        inventory = [];
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

    const lowStockCount = inventory.filter(i => {
        const stock = parseInt(i.current_stock ?? i.stock ?? 0, 10);
        const reorder = parseInt(i.reorder_level ?? i.reorderLevel ?? 20, 10);
        const status = (i.status || '').toLowerCase();
        return stock <= reorder || stock <= 0 || ['low stock', 'critical low', 'depleted', 'low', 'out of stock'].includes(status);
    }).length;

    if (dueTodayEl) dueTodayEl.textContent = dueTodayCount;
    if (overdueEl) overdueEl.textContent = overdueCount;
    if (activeEl) activeEl.textContent = patients.length || 30;
    if (lowStockEl) lowStockEl.textContent = lowStockCount;
}

// --------------------------------------------------------------------------
// 2. Recent Consultations Dynamic Display
// --------------------------------------------------------------------------
async function updateRecentConsultations() {
    const tableBody = document.getElementById('recentConsultTable');
    if (!tableBody) return;

    let consults = [];

    // 1. Fetch from Flask / SQLite backend API
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        let res = null;
        try {
            res = await fetch('/api/consultations?limit=10', { signal: controller.signal });
        } catch (fetchErr) {
            res = await fetch('http://127.0.0.1:5000/api/consultations?limit=10', { signal: controller.signal });
        }
        clearTimeout(timeoutId);

        if (res && res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                consults = data.data;
            }
        }
    } catch (e) {
        console.warn("Could not fetch /api/consultations, falling back to local storage:", e);
    }

    // 2. Fallback to localStorage if backend returned nothing
    if (consults.length === 0) {
        try {
            const raw = localStorage.getItem('bwc_consultations_db');
            consults = raw ? JSON.parse(raw) : [];
        } catch (e) {
            consults = [];
        }
    }

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
    consults.slice(0, 8).forEach(c => {
        const patientName = c.patient_name || c.patient || 'Unknown Patient';
        const sys = c.sys_bp ?? c.sys ?? 0;
        const dia = c.dia_bp ?? c.dia ?? 0;
        const glu = c.glucose ?? c.glu ?? 0;
        const risk = c.risk_level || c.risk || 'Stable';
        const consultDate = c.consult_date || c.date || '';
        const condition = c.patient_condition || c.condition || 'Consultation';

        // Badge styling for condition
        let condBadgeClass = 'badge-primary-subtle';
        let condLabel = condition;
        if (condition.includes('Both')) {
            condBadgeClass = 'badge-danger-subtle text-danger';
            condLabel = 'Both (HPN & DM)';
        } else if (condition.includes('Diabet')) {
            condBadgeClass = 'badge-warning-subtle text-warning';
            condLabel = 'Diabetes';
        } else if (condition.includes('Hyper')) {
            condBadgeClass = 'badge-info-subtle text-info';
            condLabel = 'Hypertension';
        }

        // Badge styling for risk / status
        let riskBadgeClass = 'badge-success';
        if (risk && risk.includes('High')) {
            riskBadgeClass = 'badge-danger';
        } else if (risk && risk.includes('Moderate')) {
            riskBadgeClass = 'badge-warning';
        }

        const bpGluText = `${sys}/${dia} mmHg ${glu > 0 ? `&bull; ${glu} mg/dL` : ''}`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="ps-4 fw-semibold">${escapeHtml(patientName)}</td>
            <td><span class="badge ${condBadgeClass}">${escapeHtml(condLabel)}</span></td>
            <td>${bpGluText}</td>
            <td><span class="badge ${riskBadgeClass}">${escapeHtml(risk)}</span></td>
            <td class="text-right pe-4 text-muted" style="font-size: 0.75rem;">${escapeHtml(consultDate)}</td>
        `;
        tableBody.appendChild(row);
    });
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
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        let res = null;
        try {
            res = await fetch('/api/inventory/critical', { signal: controller.signal });
        } catch (fetchErr) {
            res = await fetch('http://127.0.0.1:5000/api/inventory/critical', { signal: controller.signal });
        }
        clearTimeout(timeoutId);

        if (res && res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                items = data.data;
            }
        }
    } catch (e) {
        console.warn("Could not fetch /api/inventory/critical:", e);
    }

    // Fallback: fetch from /api/inventory if critical endpoint returned empty
    if (items.length === 0) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            let res = null;
            try {
                res = await fetch('/api/inventory', { signal: controller.signal });
            } catch (err) {
                res = await fetch('http://127.0.0.1:5000/api/inventory', { signal: controller.signal });
            }
            clearTimeout(timeoutId);

            if (res && res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    items = data.data.filter(i => {
                        const stock = parseInt(i.current_stock ?? i.stock ?? 0, 10);
                        const reorder = parseInt(i.reorder_level ?? i.reorderLevel ?? 20, 10);
                        const status = (i.status || '').toLowerCase();
                        return stock <= reorder || stock <= 0 || ['low stock', 'critical low', 'depleted', 'low', 'out of stock'].includes(status);
                    });
                }
            }
        } catch (e) {}
    }

    // Secondary fallback: local storage
    if (items.length === 0) {
        try {
            const raw = localStorage.getItem('bwc_inventory_db');
            if (raw) {
                const localInv = JSON.parse(raw);
                items = localInv.filter(i => {
                    const stock = parseInt(i.current_stock ?? i.stock ?? 0, 10);
                    const reorder = parseInt(i.reorder_level ?? i.reorderLevel ?? 20, 10);
                    const status = (i.status || '').toLowerCase();
                    return stock <= reorder || stock <= 0 || ['low stock', 'critical low', 'depleted', 'low', 'out of stock'].includes(status);
                });
            }
        } catch (e) {
            items = [];
        }
    }

    const alertCountBadge = document.getElementById('criticalAlertCountBadge');
    if (alertCountBadge) {
        alertCountBadge.textContent = `${items.length} Items Alert`;
        alertCountBadge.className = items.length > 0 ? 'badge badge-danger' : 'badge badge-secondary-subtle';
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-shield-check d-block mb-1" style="font-size: 1.5rem; opacity: 0.5;"></i>
                <span>No critical stock alerts. All supplies adequate in database.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    items.forEach(item => {
        const name = item.item_name || item.name;
        const dosage = item.dosage ? ` ${item.dosage}` : '';
        const category = item.category || 'Medical Supplies';
        const stock = parseInt(item.current_stock ?? item.stock ?? 0, 10);
        const reorder = parseInt(item.reorder_level ?? item.reorderLevel ?? 20, 10);
        const unit = item.unit || 'units';

        let statusText = 'Low Stock';
        let badgeClass = 'badge-warning';
        let fillClass = 'bg-fill-warning';

        if (stock <= 0 || (item.status && item.status.toLowerCase() === 'depleted')) {
            statusText = 'Depleted';
            badgeClass = 'badge-danger';
            fillClass = 'bg-fill-danger';
        } else if (stock <= 10 || (item.status && item.status.toLowerCase() === 'critical low')) {
            statusText = 'Critical Low';
            badgeClass = 'badge-danger';
            fillClass = 'bg-fill-danger';
        }

        const percent = (stock <= 0) ? 0 : Math.min(100, Math.max(5, Math.round((stock / Math.max(1, reorder * 1.5)) * 100)));

        const div = document.createElement('div');
        div.style.cssText = 'padding: 0.85rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; background-color: var(--bg-surface-secondary);';
        div.innerHTML = `
            <div class="d-flex justify-between align-center mb-1">
                <div>
                    <span class="fw-bold text-main" style="font-size: 0.88rem;">${escapeHtml(name)}${escapeHtml(dosage)}</span>
                    <div class="text-muted" style="font-size: 0.72rem;">${escapeHtml(category)} &bull; Reorder Level: ${reorder} ${escapeHtml(unit)}</div>
                </div>
                <div class="text-right">
                    <span class="badge ${badgeClass}" style="font-size: 0.72rem;">${escapeHtml(statusText)}</span>
                    <div class="fw-semibold text-main" style="font-size: 0.78rem; margin-top: 0.2rem;">${stock} ${escapeHtml(unit)} left</div>
                </div>
            </div>
            <div class="progress-track" style="margin-top: 0.45rem;">
                <div class="progress-fill ${fillClass}" style="width: ${percent}%;"></div>
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
