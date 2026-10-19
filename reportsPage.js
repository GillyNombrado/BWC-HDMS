/* ==========================================================================
   BWC-HDMS Portal - Reports & Backup Logic (reportsPage.js)
   ========================================================================== */

function downloadReport(type) {
    if (type === 'pdf') {
        showNotification('Generating official DOH Monthly Summary Report (PDF)...', 'success');
    } else if (type === 'csv') {
        showNotification('Compiling Barangay Health registry to Excel spreadsheet (CSV)...', 'success');
    }
}

function createEncryptedBackup() {
    exportSystemBackup();
}
