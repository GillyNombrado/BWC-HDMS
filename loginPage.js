/* ==========================================================================
   BWC-HDMS Portal - Login Page Logic (loginPage.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const privacyCheck = document.getElementById('privacyCheck');
    const loginBtn = document.getElementById('loginBtn');

    if (privacyCheck && loginBtn) {
        privacyCheck.addEventListener('change', () => {
            loginBtn.disabled = !privacyCheck.checked;
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value || 'Midwife Maria';
            const station = document.getElementById('loginStation').value || 'BHS Purok 3 Station';

            sessionStorage.setItem('bwc_user', username);
            sessionStorage.setItem('bwc_station', station);

            showNotification(`Welcome back, ${username}. Initializing secure station...`, 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboardPage.html';
            }, 800);
        });
    }
});
