/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Medicine Inventory & Dispensing Ledger (inventoryPage.js)
   ========================================================================== */

const STORAGE_KEY_INVENTORY = 'bwc_inventory_db';
const BACKEND_INVENTORY_URL = 'http://127.0.0.1:5000/api/inventory';

// In-memory inventory list
let inventoryData = [];

// Search & Filter State variables
let currentSearchQuery = '';
let currentCategoryFilter = '';

// --------------------------------------------------------------------------
// 1. Data Synchronization & Persistence Layer
// --------------------------------------------------------------------------
async function loadInventory() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const response = await fetch(BACKEND_INVENTORY_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                inventoryData = result.data.map(item => ({
                    id: item.id,
                    name: item.item_name,
                    dosage: item.dosage || 'N/A',
                    category: item.category || 'Antihypertensive',
                    batchNo: item.batch_no || 'N/A',
                    stock: parseInt(item.current_stock || 0, 10),
                    unit: item.unit || 'tabs',
                    reorderLevel: parseInt(item.reorder_level || 20, 10),
                    status: item.status || calculateStockStatus(item.current_stock, item.reorder_level)
                }));
                localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(inventoryData));
                renderInventoryTable();
                updateSummaryStats();
                return;
            }
        }
    } catch (e) {
        // Fallback silently to offline localStorage
    }

    const raw = localStorage.getItem(STORAGE_KEY_INVENTORY);
    if (raw) {
        try {
            inventoryData = JSON.parse(raw);
        } catch (e) {
            inventoryData = [];
        }
    } else {
        inventoryData = [];
    }

    renderInventoryTable();
    updateSummaryStats();
}

function saveInventoryToStorage(data) {
    localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(data));
}

function calculateStockStatus(stock, reorderLevel = 20) {
    const s = parseInt(stock, 10);
    const r = parseInt(reorderLevel, 10);
    if (s <= 0) return 'Depleted';
    if (s <= 10) return 'Critical Low';
    if (s <= r) return 'Low Stock';
    return 'Adequate';
}

// --------------------------------------------------------------------------
// 2. Summary Statistics Counter Calculator
// --------------------------------------------------------------------------
function updateSummaryStats() {
    const total = inventoryData.length;
    let adequate = 0;
    let lowStock = 0;
    let critical = 0;

    inventoryData.forEach(item => {
        const status = calculateStockStatus(item.stock, item.reorderLevel);
        if (status === 'Adequate') adequate++;
        else if (status === 'Low Stock') lowStock++;
        else critical++; // Critical Low or Depleted
    });

    const elTotal = document.getElementById('statTotalItems');
    const elAdequate = document.getElementById('statAdequate');
    const elLow = document.getElementById('statLowStock');
    const elCritical = document.getElementById('statCritical');

    if (elTotal) elTotal.textContent = total;
    if (elAdequate) elAdequate.textContent = adequate;
    if (elLow) elLow.textContent = lowStock;
    if (elCritical) elCritical.textContent = critical;
}

// --------------------------------------------------------------------------
// 3. Dynamic Table Rendering with Enhanced Visual Badges
// --------------------------------------------------------------------------
function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filteredData = inventoryData.filter(item => {
        const matchesSearch = 
            (item.name && item.name.toLowerCase().includes(currentSearchQuery)) ||
            (item.dosage && item.dosage.toLowerCase().includes(currentSearchQuery)) ||
            (item.category && item.category.toLowerCase().includes(currentSearchQuery)) ||
            (item.batchNo && item.batchNo.toLowerCase().includes(currentSearchQuery));
        
        const matchesCategory = !currentCategoryFilter || item.category === currentCategoryFilter;

        return matchesSearch && matchesCategory;
    });

    if (!filteredData || filteredData.length === 0) {
        const isSearching = currentSearchQuery !== '' || currentCategoryFilter !== '';
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-capsule d-block mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
                    <span class="fw-semibold" style="font-size: 0.95rem;">${isSearching ? 'No matching medicine records found.' : 'No medicine inventory records found or unseeded.'}</span>
                    <p class="text-muted mb-0" style="font-size: 0.8rem; margin-top: 0.25rem;">${isSearching ? 'Try adjusting your search query or category filter.' : 'Click "Add Medicine Supply" above to record initial stocks or log an RHU delivery.'}</p>
                </td>
            </tr>
        `;
        return;
    }

    filteredData.forEach(item => {
        const row = document.createElement('tr');
        const currentStatus = calculateStockStatus(item.stock, item.reorderLevel);

        // Enhanced Visual Status Badges
        let statusBadge = '<span class="badge bg-success text-white px-2 py-1"><i class="bi bi-check-circle me-1"></i>Adequate</span>';
        let stockClass = 'text-success';

        if (currentStatus === 'Depleted' || item.stock <= 0) {
            statusBadge = '<span class="badge bg-dark text-white px-2 py-1"><i class="bi bi-x-circle me-1"></i>Depleted</span>';
            stockClass = 'text-muted text-decoration-line-through';
        } else if (currentStatus === 'Critical Low' || item.stock <= 10) {
            statusBadge = '<span class="badge bg-danger text-white px-2 py-1 animate-pulse"><i class="bi bi-exclamation-octagon-fill me-1"></i>Critical Low</span>';
            stockClass = 'text-danger fw-bold';
        } else if (currentStatus === 'Low Stock' || item.stock <= item.reorderLevel) {
            statusBadge = '<span class="badge bg-warning text-dark px-2 py-1"><i class="bi bi-exclamation-triangle-fill me-1"></i>Low Stock</span>';
            stockClass = 'text-warning fw-semibold';
        }

        row.innerHTML = `
            <td class="ps-4 fw-semibold">${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.dosage || 'N/A')}</td>
            <td>${escapeHtml(item.category || 'General')}</td>
            <td class="text-muted" style="font-family: monospace;">${escapeHtml(item.batchNo || 'N/A')}</td>
            <td><span class="${stockClass}">${item.stock} ${escapeHtml(item.unit || 'tabs')}</span></td>
            <td>${statusBadge}</td>
            <td class="text-right pe-4">
                <button class="btn btn-sm btn-outline-primary" onclick="dispenseMed(${item.id})" ${item.stock <= 0 ? 'disabled' : ''}>
                    <i class="bi bi-box-arrow-right me-1"></i>Dispense
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// --------------------------------------------------------------------------
// 4. Dispensing & Stock Deduction
// --------------------------------------------------------------------------
async function dispenseMed(itemId) {
    const item = inventoryData.find(m => m.id === itemId);
    if (!item) return;

    if (item.stock <= 0) {
        showNotification(`Cannot dispense ${item.name} — stock is depleted.`, 'danger');
        return;
    }

    const dispenseQty = Math.min(30, item.stock);
    item.stock -= dispenseQty;
    item.status = calculateStockStatus(item.stock, item.reorderLevel);

    saveInventoryToStorage(inventoryData);
    renderInventoryTable();
    updateSummaryStats();
    showNotification(`Dispensed ${dispenseQty} ${item.unit} of ${item.name}. Stock updated.`, 'success');

    try {
        await fetch(`${BACKEND_INVENTORY_URL}/${itemId}/dispense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: dispenseQty })
        });
    } catch (e) {
        // Offline tolerance
    }
}

async function requestRestock() {
    try {
        const response = await fetch(`${BACKEND_INVENTORY_URL}/restock-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requested_by: sessionStorage.getItem('bwc_full_name') || 'BHW Station Officer' })
        });

        if (response.ok) {
            const result = await response.json();
            showNotification(result.message || 'RHU replenishment requisition submitted.', 'success');
            return;
        }
    } catch (e) {
        // Offline fallback
    }

    showNotification('Stock replenishment requisition manifest generated for RHU submission.', 'success');
}

// --------------------------------------------------------------------------
// 5. Modal Handling: Add Medicine Supply
// --------------------------------------------------------------------------
function openAddMedicineModal() {
    const form = document.getElementById('addMedicineForm');
    if (form) form.reset();
    openModal('addMedicineModal');
}

function closeAddMedicineModal() {
    closeModal('addMedicineModal');
}

async function saveMedicineItem(e) {
    e.preventDefault();

    const name = document.getElementById('medName').value.trim();
    const dosage = document.getElementById('medDosage') ? document.getElementById('medDosage').value.trim() : '';
    const category = document.getElementById('medCategory').value;
    const batch = document.getElementById('medBatch').value.trim() || 'LOT-' + new Date().getFullYear();
    const stock = parseInt(document.getElementById('medStock').value, 10) || 0;
    const unit = document.getElementById('medUnit') ? document.getElementById('medUnit').value : 'tabs';
    const reorder = parseInt(document.getElementById('medReorder').value, 10) || 20;
    const expiry = document.getElementById('medExpiry') ? document.getElementById('medExpiry').value : null;

    if (!name) {
        showNotification('Please enter a medicine name.', 'danger');
        return;
    }

    let newItem = {
        id: Date.now(),
        name: name,
        category: category,
        batchNo: batch,
        dosage: dosage,
        stock: stock,
        unit: unit,
        reorderLevel: reorder,
        expirationDate: expiry,
        status: calculateStockStatus(stock, reorder)
    };

    try {
        const response = await fetch(BACKEND_INVENTORY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                item_name: name,
                category: category,
                batch_no: batch,
                dosage: dosage,
                current_stock: stock,
                reorder_level: reorder,
                unit: unit,
                expiration_date: expiry
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.id) {
                newItem.id = result.data.id;
            }
        }
    } catch (e) {
        // Offline fallback
    }

    inventoryData.unshift(newItem);
    saveInventoryToStorage(inventoryData);
    closeAddMedicineModal();
    renderInventoryTable();
    updateSummaryStats();
    showNotification(`Added ${name} (${stock} ${unit}) to inventory ledger.`, 'success');
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
// 6. Page Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();

    const searchInput = document.getElementById('inventorySearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase().trim();
            renderInventoryTable();
        });
    }

    const categorySelect = document.getElementById('inventoryCategoryFilter');
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            currentCategoryFilter = e.target.value;
            renderInventoryTable();
        });
    }
});