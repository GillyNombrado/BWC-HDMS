/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Login & Authentication Controller (loginPage.js)
   ========================================================================== */

const BACKEND_AUTH_URL = 'http://127.0.0.1:5000/api/auth';

// Standard BHW database roster with sequential YY-NNN IDs (e.g. 26-001) for offline fallback
const DEFAULT_BHW_ROSTER = [
    { id: '26-001', username: 'charisma', fullName: 'Charisma Astronomo', purok: 'Purok 1', role: 'BHW' },
    { id: '26-002', username: 'marisa', fullName: 'Marisa Pullan', purok: 'Purok 2', role: 'BHW' },
    { id: '26-003', username: 'thess', fullName: 'Marites Torres', purok: 'Purok 3', role: 'BHW' },
    { id: '26-004', username: 'flora', fullName: 'Flora Angeles', purok: 'Purok 4', role: 'BHW' },
    { id: '26-005', username: 'grace', fullName: 'Grace Yretarino', purok: 'Purok 5', role: 'BHW' },
    { id: '26-006', username: 'michelle', fullName: 'Michelle Oboza', purok: 'Purok 6', role: 'BHW' },
    { id: '26-007', username: 'violy', fullName: 'Violeta Esmijarda', purok: 'Purok 7', role: 'BHW' }
];

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const privacyCheck = document.getElementById('privacyCheck');
    const loginBtn = document.getElementById('loginBtn');
    const userInput = document.getElementById('loginUsername');
    const stationSelect = document.getElementById('loginStation');
    const passInput = document.getElementById('loginPassword');
    const errorBanner = document.getElementById('loginErrorMessage');
    const errorText = document.getElementById('loginErrorText');

    function displayError(message) {
        if (errorBanner && errorText) {
            errorText.textContent = message;
            errorBanner.classList.remove('hidden');
        }
        if (userInput) userInput.classList.add('is-invalid');
        if (passInput) passInput.classList.add('is-invalid');
        showNotification(message, 'danger');
        
        if (loginBtn) {
            loginBtn.disabled = !privacyCheck?.checked;
            loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In to Terminal Station';
        }
    }

    function clearError() {
        if (errorBanner) errorBanner.classList.add('hidden');
        if (userInput) userInput.classList.remove('is-invalid');
        if (passInput) passInput.classList.remove('is-invalid');
    }

    // 1. Clear error states on user input
    if (userInput) {
        userInput.addEventListener('input', clearError);
        userInput.addEventListener('blur', () => {
            const val = userInput.value.trim().toLowerCase();
            if (!val || !stationSelect) return;
            const matched = DEFAULT_BHW_ROSTER.find(b => 
                b.username.toLowerCase() === val || 
                b.id.toLowerCase() === val || 
                b.fullName.toLowerCase() === val
            );
            if (matched) {
                for (let i = 0; i < stationSelect.options.length; i++) {
                    if (stationSelect.options[i].value === matched.purok) {
                        stationSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        });
    }

    if (passInput) passInput.addEventListener('input', clearError);
    if (stationSelect) stationSelect.addEventListener('change', clearError);

    // 2. Enable/disable login button based on privacy checkbox
    if (privacyCheck && loginBtn) {
        privacyCheck.addEventListener('change', () => {
            loginBtn.disabled = !privacyCheck.checked;
        });
    }

    // 3. Populate dynamic health stations dropdown from backend API
    loadLoginStations();

    // 4. Handle Login Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();

            const identifier = userInput ? userInput.value.trim() : '';
            const password = passInput ? passInput.value.trim() : '';
            const station = stationSelect ? stationSelect.value : 'Purok 1';

            if (!identifier || !password) {
                displayError('Invalid Username/Password. Try again.');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';

            try {
                const response = await fetch(`${BACKEND_AUTH_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: identifier, id: identifier, password, station })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    const fullName = result.user?.full_name || identifier;
                    const role = (result.user?.role || 'BHW').toUpperCase();
                    let cleanStation = result.user?.purok || result.user?.station || station;
                    if (cleanStation.includes(',')) {
                        cleanStation = cleanStation.split(',')[0].trim();
                    }

                    // Store authenticated user information in sessionStorage
                    sessionStorage.setItem('bwc_user', result.user?.username || identifier);
                    sessionStorage.setItem('bwc_user_id', result.user?.id || '');
                    sessionStorage.setItem('bwc_full_name', fullName);
                    sessionStorage.setItem('bwc_role', role);
                    sessionStorage.setItem('bwc_station', cleanStation);
                    sessionStorage.setItem('bwc_purok', cleanStation);
                    sessionStorage.setItem('bwc_address', result.user?.address || 'Poblacion 2, Nagcarlan, Laguna');

                    showNotification(`Welcome back, ${fullName}. Initializing secure station...`, 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboardPage.html';
                    }, 800);
                    return;
                } else {
                    displayError(result.error || 'Invalid Username/Password. Try again.');
                    return;
                }
            } catch (err) {
                console.warn('[Offline Auth] Backend server offline or unreachable, applying local validation check.');
            }

            // Offline Fallback Verification against default BHW roster
            const matchedBhw = DEFAULT_BHW_ROSTER.find(b => 
                b.username.toLowerCase() === identifier.toLowerCase() ||
                b.id.toLowerCase() === identifier.toLowerCase() ||
                b.fullName.toLowerCase() === identifier.toLowerCase()
            );

            if (!matchedBhw) {
                displayError('Account does not exist.');
                return;
            }

            if (password !== 'password123') {
                displayError('Invalid Username/Password. Try again.');
                return;
            }

            if (station && matchedBhw.purok !== station) {
                displayError(`Selected health station (${station}) does not match assigned station for ${matchedBhw.fullName}.`);
                return;
            }

            // Successful offline authentication
            sessionStorage.setItem('bwc_user', matchedBhw.username);
            sessionStorage.setItem('bwc_user_id', matchedBhw.id);
            sessionStorage.setItem('bwc_full_name', matchedBhw.fullName);
            sessionStorage.setItem('bwc_role', matchedBhw.role);
            sessionStorage.setItem('bwc_station', matchedBhw.purok);
            sessionStorage.setItem('bwc_purok', matchedBhw.purok);
            sessionStorage.setItem('bwc_address', 'Poblacion 2, Nagcarlan, Laguna');

            showNotification(`Welcome back, ${matchedBhw.fullName}. Initializing local station...`, 'success');
            setTimeout(() => {
                window.location.href = 'dashboardPage.html';
            }, 800);
        });
    }
});

/**
 * Dynamically loads health station options from backend SQLite API.
 */
async function loadLoginStations() {
    const stationSelect = document.getElementById('loginStation');
    if (!stationSelect) return;

    let stations = [];

    // Attempt to pull live station list from Flask SQLite backend
    try {
        const stationsRes = await fetch(`${BACKEND_AUTH_URL}/stations`);
        if (stationsRes.ok) {
            const stationsData = await stationsRes.json();
            if (stationsData.success && Array.isArray(stationsData.data) && stationsData.data.length > 0) {
                stations = stationsData.data;
            }
        }
    } catch (e) {
        // Fallback to standard 7 Puroks of Poblacion 2
    }

    if (stations.length === 0) {
        stations = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6', 'Purok 7'];
    }

    // Populate Health Station dropdown
    stationSelect.innerHTML = '';
    stations.forEach((st, idx) => {
        const cleanSt = st.includes(',') ? st.split(',')[0].trim() : st;
        const opt = document.createElement('option');
        opt.value = cleanSt;
        opt.textContent = cleanSt;
        if (idx === 0) opt.selected = true;
        stationSelect.appendChild(opt);
    });
}
