/* ==========================================================================
   BWC-HDMS Portal - Dashboard Page Logic (dashboardPage.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Show Privacy Terms modal on initial visit if not yet acknowledged in this session
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
});

// Quick action navigation
function goToNewVisit() {
    window.location.href = 'vitalsPage.html';
}

function goToRegistry() {
    window.location.href = 'patientsPage.html';
}
