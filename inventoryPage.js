/* ==========================================================================
   BWC-HDMS Portal - Medicine Inventory Logic (inventoryPage.js)
   ========================================================================== */

function dispenseMed(medName) {
    showNotification(`Dispensed 30 days supply of ${medName}. Stock balance updated.`, 'success');
}

function requestRestock() {
    showNotification('Stock replenishment manifest generated for RHU submission.', 'success');
}
