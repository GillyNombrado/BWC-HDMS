/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Medicine Inventory & Dispensing Ledger (inventoryPage.js)
   ==========================================================================
   Description:
   Handles medicine inventory tracking:
   1. Clean zero-state initialization (empty array `[]`).
   2. Offline-First data synchronization with Flask / SQLite backend or LocalStorage.
   3. Dynamic rendering of stock balances, low-stock thresholds, and status badges.
   4. Live dispensing actions (deducts maintenance supply & syncs to ledger).
   5. Supply intake modal for logging new RHU medicine shipments.
   ========================================================================== */

const STORAGE_KEY_INVENTORY = 'bwc_inventory_db';
const BACKEND_INVENTORY_URL = 'http://127.0.0.1:5000/api/inventory';

// In-memory inventory list (Starts clean / zero state)
let inventoryData = [];

// --------------------------------------------------------------------------
// 1. Data Synchronization & Persistence Layer
// --------------------------------------------------------------------------
/**
 * Loads medicine inventory from Flask SQLite backend or fallback LocalStorage.
 */
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
                    category: item.category || 'Antihypertensive',
                    batchNo: item.batch_no || 'N/A',
                    stock: parseInt(item.current_stock || 0, 10),
                    unit: item.unit || 'tabs',
                    reorderLevel: parseInt(item.reorder_level || 20, 10),
                    status: item.status || calculateStockStatus(item.current_stock, item.reorder_level)
                }));
                localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(inventoryData));
                renderInventoryTable();
                return;
            }
        }
    } catch (e) {
        // Fallback to offline localStorage
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
}

function saveInventoryToStorage(data) {
    localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(data));
}

function calculateStockStatus(stock, reorderLevel = 20) {
    const s = parseInt(stock, 10);
    const r = parseInt(reorderLevel, 10);
    if (s <= 10) return 'Critical Low';
    if (s <= r) return 'Low Stock';
    return 'Adequate';
}

// --------------------------------------------------------------------------
// 2. Dynamic Table Rendering & Clean Empty State Handling
// --------------------------------------------------------------------------
function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Clean empty state
    if (!inventoryData || inventoryData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <i class="bi bi-capsule d-block mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
                    <span class="fw-semibold" style="font-size: 0.95rem;">No medicine stock records found in inventory.</span>
                    <p class="text-muted mb-0" style="font-size: 0.8rem; margin-top: 0.25rem;">Click "Add Medicine Supply" above to record initial stocks or log an RHU delivery.</p>
                </td>
            </tr>
        `;
        return;
    }

    inventoryData.forEach(item => {
        const row = document.createElement('tr');
        
        // Status badge formatting
        let statusBadge = '<span class="badge badge-success">Adequate</span>';
        let stockClass = 'text-success';
        if (item.status === 'Critical Low' || item.stock <= 10) {
            statusBadge = '<span class="badge badge-danger">Critical Low</span>';
            stockClass = 'text-danger';
        } else if (item.status === 'Low Stock' || item.stock <= item.reorderLevel) {
            statusBadge = '<span class="badge badge-warning">Low Stock</span>';
            stockClass = 'text-warning';
        }

        row.innerHTML = `
            <td class="ps-4 fw-semibold">${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.category || 'General')}</td>
            <td class="text-muted" style="font-family: monospace;">${escapeHtml(item.batchNo || 'LOT-2026')}</td>
            <td><span class="fw-bold ${stockClass}">${item.stock} ${escapeHtml(item.unit || 'tabs')}</span></td>
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
// 3. Dispensing & Stock Deduction
// --------------------------------------------------------------------------
async function dispenseMed(itemId) {
    const item = inventoryData.find(m => m.id === itemId);
    if (!item) return;

    if (item.stock <= 0) {
        showNotification(`Cannot dispense ${item.name} — out of stock.`, 'danger');
        return;
    }

    const dispenseQty = Math.min(30, item.stock);
    item.stock -= dispenseQty;
    item.status = calculateStockStatus(item.stock, item.reorderLevel);

    saveInventoryToStorage(inventoryData);
    renderInventoryTable();
    showNotification(`Dispensed ${dispenseQty} ${item.unit} of ${item.name}. Stock updated.`, 'success');

    // Attempt backend sync
    try {
        await fetch(`${BACKEND_INVENTORY_URL}/${itemId}/dispense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: dispenseQty })
        });
    } catch (e) {
        // Handled silently in offline mode
    }
}

function requestRestock() {
    showNotification('Stock replenishment requisition manifest generated for RHU submission.', 'success');
}

// --------------------------------------------------------------------------
// 4. Modal Handling: Add Medicine Supply
// --------------------------------------------------------------------------
function openAddMedicineModal() {
    const modal = document.getElementById('addMedicineModal');
    if (!modal) return;

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
    const category = document.getElementById('medCategory').value;
    const batch = document.getElementById('medBatch').value.trim() || 'LOT-' + new Date().getFullYear();
    const stock = parseInt(document.getElementById('medStock').value, 10) || 0;
    const reorder = parseInt(document.getElementById('medReorder').value, 10) || 20;

    if (!name) {
        showNotification('Please enter a medicine name.', 'danger');
        return;
    }

    const newItem = {
        id: Date.now(),
        name: name,
        category: category,
        batchNo: batch,
        stock: stock,
        unit: 'tabs',
        reorderLevel: reorder,
        status: calculateStockStatus(stock, reorder)
    };

    inventoryData.push(newItem);
    saveInventoryToStorage(inventoryData);
    closeAddMedicineModal();
    renderInventoryTable();
    showNotification(`Added ${name} (${stock} tabs) to inventory.`, 'success');

    // Attempt backend sync
    try {
        await fetch(BACKEND_INVENTORY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                item_name: name,
                category: category,
                batch_no: batch,
                current_stock: stock,
                reorder_level: reorder,
                unit: 'tabs'
            })
        });
    } catch (e) {
        // Handled silently in offline mode
    }
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
// 5. Page Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
});
