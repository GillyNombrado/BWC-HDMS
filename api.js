/* ==========================================================================
   Barangay Wellness Circle: Hypertension & Diabetes Management System (BWC-HDMS)
   Capstone Project - CMSC 309
   Module: Centralized API Service & Patient Registry Controller (api.js)
   ==========================================================================
   Description:
   Centralized offline-ready client API and dynamic filtering engine for BWC-HDMS.
   Provides user-restricted patient retrieval, multi-attribute filtering & sorting:
   1. Gender: Male, Female
   2. Risk Level: Sorted High-to-Low and Low-to-High
   3. Age Category: Underage (< 18) vs. Adult (18+)
   4. Table DOM binding & graceful empty-state handling
   ========================================================================== */

// Offline-aware API base URL resolution
const API_BASE_URL = (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http'))
    ? `${window.location.origin}/api`
    : "http://127.0.0.1:5000/api";

const STORAGE_KEY_PATIENTS = "bwc_patients_db";

// Active in-memory filter state for the Target Client Registry
const tcrFilterState = {
    customFilter: "",       // "gender:Male", "risk:high-to-low", "age:underage", etc.
    gender: "",            // "", "Male", "Female"
    ageCategory: "",       // "", "underage" (<18), "adult" (>=18)
    riskSortDirection: "", // "", "high-to-low", "low-to-high"
    condition: "",         // "", "Hypertension", "Diabetes", "Both"
    searchQuery: ""        // text query
};

// Default fallback assigned patients for terminal BHW station (Charisma Astronomo, Purok 1)
const DEFAULT_CHARISMA_PATIENTS = [
    { id: 1, handlerId: "26-001", name: "Juan Santos Dela Cruz", firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz", age: 58, sex: "Male", gender: "Male", purok: "Purok 1", address: "House No. 12, Sitio Ilaya", condition: "Hypertension Only", diagnosisDate: "2023-04-15", risk: "High Risk", ph: "754893737015", phId: "754893737015", lastVisit: "2026-11-10", emergencyName: "Elena Dela Cruz", emergencyRel: "Spouse", emergencyPhone: "09191234567", programs: ["Senior Citizen ID Holder", "PhilHealth Konsulta Beneficiary"], healthRisks: ["Smoking / Tobacco", "Alcohol Consumption"], allergies: "None reported", medHistory: "Diagnosed with Stage 2 Essential Hypertension during 2023 barangay screening." },
    { id: 2, handlerId: "26-001", name: "Ana Gonzales", firstName: "Ana", middleName: "", lastName: "Gonzales", age: 16, sex: "Female", gender: "Female", purok: "Purok 1", address: "Block 4, Lot 9, Mabini St.", condition: "Hypertension Only", diagnosisDate: "2024-01-20", risk: "Moderate", ph: "343134276635", phId: "343134276635", lastVisit: "2026-11-08", emergencyName: "Roberto Gonzales", emergencyRel: "Parent", emergencyPhone: "09182223344", programs: ["4Ps (Pantawid Pamilyang Pilipino Program)"], healthRisks: ["Physical Inactivity"], allergies: "Penicillin", medHistory: "Routine intake for adolescent wellness monitoring." },
    { id: 3, handlerId: "26-001", name: "Elena Reyes Flores", firstName: "Elena", middleName: "Reyes", lastName: "Flores", age: 64, sex: "Female", gender: "Female", purok: "Purok 1", address: "House No. 45, Sitio Riverside", condition: "Diabetes Only", diagnosisDate: "2022-11-05", risk: "High Risk", ph: "609241365465", phId: "609241365465", lastVisit: "2026-11-12", emergencyName: "Carlos Flores", emergencyRel: "Child / Offspring", emergencyPhone: "09258889900", programs: ["Senior Citizen ID Holder", "PWD (Person with Disability)"], healthRisks: ["Family History of Diabetes"], allergies: "None reported", medHistory: "Type 2 diabetes mellitus diagnosed in 2022. Regular fasting blood glucose monitoring at barangay station." },
    { id: 4, handlerId: "26-001", name: "Ernesto Flores Rivera", firstName: "Ernesto", middleName: "Flores", lastName: "Rivera", age: 45, sex: "Male", gender: "Male", purok: "Purok 1", address: "Sitio Ibaba, San Jose Road", condition: "Both (Hypertension & Diabetes)", diagnosisDate: "2023-08-30", risk: "Stable", ph: "428604297017", phId: "428604297017", lastVisit: "2026-11-05", emergencyName: "Maria Rivera", emergencyRel: "Spouse", emergencyPhone: "09303334455", programs: ["PhilHealth Konsulta Beneficiary"], healthRisks: ["Family History of Stroke / CVD", "Physical Inactivity"], allergies: "Aspirin", medHistory: "Diagnosed with combined essential hypertension and borderline diabetes." },
    { id: 5, handlerId: "26-001", name: "Gloria Cruz", firstName: "Gloria", middleName: "", lastName: "Cruz", age: 17, sex: "Female", gender: "Female", purok: "Purok 1", address: "House No. 102, Rizal Avenue", condition: "Hypertension Only", diagnosisDate: "2024-06-12", risk: "Stable", ph: "847243802614", phId: "847243802614", lastVisit: "2026-11-02", emergencyName: "Danilo Cruz", emergencyRel: "Parent", emergencyPhone: "09358889900", programs: [], healthRisks: [], allergies: "None reported", medHistory: "Periodic health assessment. Up-to-date immunizations and healthy baseline vitals." }
];

/**
 * =========================================================================
 * FUNCTION: getAuthContext
 * PURPOSE:  Retrieves the current authenticated BHW staff credentials
 *           from browser sessionStorage.
 * DATA FLOW: Reads sessionStorage ('bwc_user', 'bwc_user_id', 'bwc_purok', 'bwc_full_name')
 *            -> Returns normalized { username, userId, purok, fullName }.
 * =========================================================================
 */
function getAuthContext() {
    return {
        username: sessionStorage.getItem('bwc_user') || 'charisma',
        userId: sessionStorage.getItem('bwc_user_id') || '26-001',
        purok: sessionStorage.getItem('bwc_purok') || 'Purok 1',
        fullName: sessionStorage.getItem('bwc_full_name') || 'Charisma Astronomo',
        role: sessionStorage.getItem('bwc_role') || 'BHW'
    };
}

/**
 * =========================================================================
 * FUNCTION: getAuthHeaders
 * PURPOSE:  Constructs session identification headers for backend API requests.
 * DATA FLOW: Reads auth context -> Returns Headers object including credentials.
 * =========================================================================
 */
function getAuthHeaders() {
    const auth = getAuthContext();
    return {
        'Content-Type': 'application/json',
        'X-Username': auth.username,
        'X-User-Id': auth.userId,
        'X-Purok': auth.purok
    };
}

/**
 * =========================================================================
 * FUNCTION: fetchAssignedPatients
 * PURPOSE:  Fetches patient records strictly restricted to the logged-in user
 *           from the Flask backend endpoint (/api/patients).
 * DATA FLOW: Reads auth context from sessionStorage
 *            -> Dispatches GET to /api/patients?username={user}&user_id={id}
 *            -> On 200 OK: Caches records in localStorage ('bwc_patients_db')
 *            -> On Failure/Empty: Falls back gracefully to local cached or seeded storage
 *            -> Returns Array of assigned patient objects.
 * =========================================================================
 */
async function fetchAssignedPatients() {
    const auth = getAuthContext();
    const queryParams = new URLSearchParams({
        username: auth.username,
        user_id: auth.userId,
        purok: auth.purok
    });

    const targetUrls = [
        `${API_BASE_URL}/patients?${queryParams.toString()}`,
        `http://127.0.0.1:5000/api/patients?${queryParams.toString()}`
    ];

    for (const url of targetUrls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(url, {
                headers: getAuthHeaders(),
                credentials: 'include',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                    const normalized = result.data.map(p => ({
                        id: p.id,
                        name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                        firstName: p.first_name || '',
                        middleName: p.middle_name || '',
                        lastName: p.last_name || '',
                        dob: p.dob || '',
                        age: (typeof p.age === 'number' && !isNaN(p.age)) ? p.age : (parseInt(p.age, 10) || calculateAgeFromDate(p.dob) || 45),
                        sex: p.sex || p.gender || 'Female',
                        gender: p.gender || p.sex || 'Female',
                        contact: p.contact || p.contact_number || '',
                        purok: p.purok || auth.purok,
                        address: p.address || `${p.purok || auth.purok}, Poblacion 2, Nagcarlan, Laguna`,
                        condition: p.condition || p.medical_status || 'Hypertension Only',
                        diagnosisDate: p.diagnosis_date || '2024-03-12',
                        ph: p.ph_id || p.ph || 'Pending RHU Assignment',
                        lastVisit: p.last_visit || 'Today',
                        risk: p.risk_level || p.risk || 'Moderate',
                        assignedBhw: p.assigned_bhw || auth.username,
                        programs: p.programs || [],
                        healthRisks: p.healthRisks || [],
                        allergies: p.allergies || 'None reported',
                        medHistory: p.medHistory || '',
                        emergencyName: p.emergencyName || '',
                        emergencyRel: p.emergencyRel || '',
                        emergencyPhone: p.emergencyPhone || '',
                        attachments: p.attachments || []
                    }));

                    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(normalized));
                    return normalized;
                }
            }
        } catch (err) {
            // Attempt next target URL if any
        }
    }

    // Offline Local Storage Fallback
    const cached = localStorage.getItem(STORAGE_KEY_PATIENTS);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const filtered = parsed.filter(p => 
                    !p.assignedBhw || 
                    p.assignedBhw.toLowerCase() === auth.username.toLowerCase() ||
                    (p.purok && p.purok.toLowerCase() === auth.purok.toLowerCase())
                );
                if (filtered.length > 0) return filtered;
                return parsed;
            }
        } catch (parseErr) {
            console.error("[api.js] Corrupted local cache:", parseErr);
        }
    }

    // Default terminal station fallback (ensures data is always visible)
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(DEFAULT_CHARISMA_PATIENTS));
    return DEFAULT_CHARISMA_PATIENTS;
}

/**
 * =========================================================================
 * FUNCTION: filterPatientsByGender
 * PURPOSE:  Filters patient array by Gender (e.g., 'Male', 'Female').
 * DATA FLOW: Input: patients (Array), gender (String)
 *            -> Compares p.sex and p.gender case-insensitively
 *            -> Returns Array of matching patients.
 * =========================================================================
 */
function filterPatientsByGender(patients, gender) {
    if (!Array.isArray(patients)) return [];
    if (!gender || gender.trim() === "" || gender.toLowerCase() === "all") return patients;

    const target = gender.trim().toLowerCase();
    return patients.filter(p => {
        const patientSex = (p.sex || p.gender || "").toLowerCase();
        return patientSex === target || patientSex.startsWith(target.charAt(0));
    });
}

/**
 * =========================================================================
 * FUNCTION: filterPatientsByAgeCategory
 * PURPOSE:  Filters patient array by standard clinical age brackets:
 *           - 'underage': under 18 years old (< 18)
 *           - 'adult': 18 years old and older (>= 18)
 * DATA FLOW: Input: patients (Array), category (String: 'underage' | 'adult' | 'all')
 *            -> Evaluates p.age (with fallback to calculating from p.dob)
 *            -> Filters records by age threshold (18)
 *            -> Returns Array of matching patients.
 * =========================================================================
 */
function filterPatientsByAgeCategory(patients, category) {
    if (!Array.isArray(patients)) return [];
    if (!category || category.trim() === "" || category.toLowerCase() === "all") return patients;

    const cat = category.trim().toLowerCase();
    return patients.filter(p => {
        let age = typeof p.age === 'number' ? p.age : parseInt(p.age, 10);
        if (isNaN(age) && p.dob) {
            age = calculateAgeFromDate(p.dob);
        }
        if (isNaN(age)) return false;

        if (cat === 'underage' || cat === 'minor' || cat === '<18') {
            return age < 18;
        } else if (cat === 'adult' || cat === 'senior' || cat === '>=18') {
            return age >= 18;
        }
        return true;
    });
}

/**
 * =========================================================================
 * FUNCTION: sortPatientsByRiskLevel
 * PURPOSE:  Sorts patient records dynamically by clinical risk level severity:
 *           - 'high-to-low': High Risk (3) -> Moderate (2) -> Stable / Low (1)
 *           - 'low-to-high': Stable / Low (1) -> Moderate (2) -> High Risk (3)
 * DATA FLOW: Input: patients (Array), direction (String: 'high-to-low' | 'low-to-high')
 *            -> Maps risk levels to numerical weights
 *            -> Returns sorted Array copy without mutating source array.
 * =========================================================================
 */
function sortPatientsByRiskLevel(patients, direction) {
    if (!Array.isArray(patients)) return [];
    if (!direction || direction.trim() === "") return [...patients];

    const dir = direction.trim().toLowerCase();
    const riskWeights = {
        'high risk': 3,
        'high': 3,
        'critical': 3,
        'moderate': 2,
        'medium': 2,
        'stable': 1,
        'low': 1,
        'low risk': 1
    };

    return [...patients].sort((a, b) => {
        const weightA = riskWeights[(a.risk || a.risk_level || '').toLowerCase()] || 0;
        const weightB = riskWeights[(b.risk || b.risk_level || '').toLowerCase()] || 0;

        if (dir === 'high-to-low' || dir === 'desc') {
            return weightB - weightA;
        } else if (dir === 'low-to-high' || dir === 'asc') {
            return weightA - weightB;
        }
        return 0;
    });
}

/**
 * =========================================================================
 * FUNCTION: filterPatientsBySearchQuery
 * PURPOSE:  Multi-field text matching across patient name, PhilHealth ID,
 *           Purok, medical condition, and specialized keywords.
 * DATA FLOW: Input: patients (Array), query (String)
 *            -> Checks query against demographics and clinical fields
 *            -> Returns Array of matching patients.
 * =========================================================================
 */
function filterPatientsBySearchQuery(patients, query) {
    if (!Array.isArray(patients)) return [];
    if (!query || query.trim() === "") return patients;

    const q = query.trim().toLowerCase();

    // Check for explicit filter keyword shortcuts
    if (q === 'male' || q === 'female') {
        return filterPatientsByGender(patients, q);
    }
    if (q === 'underage' || q === 'minor' || q === '<18') {
        return filterPatientsByAgeCategory(patients, 'underage');
    }
    if (q === 'adult' || q === '>=18') {
        return filterPatientsByAgeCategory(patients, 'adult');
    }

    return patients.filter(p => {
        const name = (p.name || '').toLowerCase();
        const ph = (p.ph || p.ph_id || '').toLowerCase();
        const purok = (p.purok || '').toLowerCase();
        const condition = (p.condition || '').toLowerCase();
        const risk = (p.risk || p.risk_level || '').toLowerCase();

        return name.includes(q) || ph.includes(q) || purok.includes(q) || condition.includes(q) || risk.includes(q);
    });
}

/**
 * =========================================================================
 * FUNCTION: applyPatientTableFilters
 * PURPOSE:  Master filter processor combining Gender, Age Category,
 *           Risk Level Sorting, Medical Condition, and Text Search.
 * DATA FLOW: Input: patients (Array), options (Object)
 *            -> Extracts custom filter (gender, risk, age)
 *            -> Executes sequential filter pipeline
 *            -> Returns final filtered and sorted Array.
 * =========================================================================
 */
function applyPatientTableFilters(patients, options = {}) {
    if (!Array.isArray(patients)) return [];

    let result = [...patients];
    const custom = (options.customFilter || "").trim();

    let genderFilter = options.gender || "";
    let ageFilter = options.ageCategory || "";
    let riskSort = options.riskSortDirection || "";

    // Parse direct or composite custom dropdown selection:
    // "Male", "Female", "Adult", "Underage", "Risk (High to Low)", "Risk (Low to High)"
    const lowerCustom = custom.toLowerCase();
    if (lowerCustom === "male" || lowerCustom === "gender:male") {
        genderFilter = "Male";
    } else if (lowerCustom === "female" || lowerCustom === "gender:female") {
        genderFilter = "Female";
    } else if (lowerCustom === "adult" || lowerCustom === "age:adult") {
        ageFilter = "adult";
    } else if (lowerCustom === "underage" || lowerCustom === "age:underage") {
        ageFilter = "underage";
    } else if (lowerCustom === "risk (high to low)" || lowerCustom === "risk:high-to-low" || lowerCustom === "high-to-low") {
        riskSort = "high-to-low";
    } else if (lowerCustom === "risk (low to high)" || lowerCustom === "risk:low-to-high" || lowerCustom === "low-to-high") {
        riskSort = "low-to-high";
    }

    // 1. Filter by Gender (Male vs. Female)
    if (genderFilter) {
        result = filterPatientsByGender(result, genderFilter);
    }

    // 2. Filter by Age Category (Underage < 18 vs. Adult >= 18)
    if (ageFilter) {
        result = filterPatientsByAgeCategory(result, ageFilter);
    }

    // 3. Filter by Medical Condition (Hypertension, Diabetes, Both)
    if (options.condition && options.condition !== "All Conditions" && options.condition !== "") {
        const cond = options.condition.toLowerCase();
        result = result.filter(p => (p.condition || '').toLowerCase().includes(cond));
    }

    // 4. Filter by Search Query
    if (options.searchQuery) {
        result = filterPatientsBySearchQuery(result, options.searchQuery);
    }

    // 5. Sort by Clinical Risk Level (High-to-Low or Low-to-High)
    if (riskSort) {
        result = sortPatientsByRiskLevel(result, riskSort);
    }

    return result;
}

/**
 * =========================================================================
 * FUNCTION: renderPatientEmptyState
 * PURPOSE:  Renders a graceful, layout-safe empty state inside the TCR table.
 * DATA FLOW: Input: tbodyElement (DOM element), message (String), subtext (String)
 *            -> Injects single <tr> with colspan="7"
 *            -> Preserves table header alignment and zero visual defects.
 * =========================================================================
 */
function renderPatientEmptyState(tbodyElement, message = "No registered clients found in Target Client Registry (TCR).", subtext = "Click \"Register New Client in TCR\" above to enroll a resident.") {
    if (!tbodyElement) return;

    tbodyElement.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-5 text-muted">
                <i class="bi bi-people d-block mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
                <span class="fw-semibold" style="font-size: 0.95rem;">${escapeHtml(message)}</span>
                <p class="text-muted mb-0" style="font-size: 0.8rem; margin-top: 0.25rem;">${escapeHtml(subtext)}</p>
            </td>
        </tr>
    `;
}

/**
 * =========================================================================
 * FUNCTION: connectPatientTableFilters
 * PURPOSE:  Attaches interactive filter and sort handlers directly to the
 *           TCR patient table (#tcrTable) and search controls.
 * DATA FLOW: Binds click handlers to table headers ('Age / Sex', 'Risk Level')
 *            -> Binds onkeyup / onchange to #searchTCR, #filterCondition, #filterPatientSort
 *            -> Updates tcrFilterState and triggers onFilterChange callback.
 * =========================================================================
 */
function connectPatientTableFilters(config = {}) {
    const table = document.getElementById('tcrTable');
    const searchInput = document.getElementById('searchTCR');
    const conditionSelect = document.getElementById('filterCondition');
    const sortSelect = document.getElementById('filterPatientSort') || document.getElementById('filterPurok');
    const onFilterChange = config.onFilterChange || function() {};

    function triggerUpdate() {
        if (searchInput) tcrFilterState.searchQuery = searchInput.value.trim();
        if (conditionSelect) tcrFilterState.condition = conditionSelect.value;
        if (sortSelect) tcrFilterState.customFilter = sortSelect.value;
        onFilterChange(tcrFilterState);
    }

    // Connect Search Input
    if (searchInput) {
        searchInput.addEventListener('input', triggerUpdate);
    }

    // Connect Condition Dropdown
    if (conditionSelect) {
        conditionSelect.addEventListener('change', triggerUpdate);
    }

    // Connect Dynamic Patient Sort & Filter Dropdown (replaces purok dropdown)
    if (sortSelect) {
        sortSelect.addEventListener('change', triggerUpdate);
    }

    // Connect Table Column Headers for Interactive Sorting / Filtering
    if (table) {
        const headers = table.querySelectorAll('thead th');
        
        // Header 1: 'Age / Sex' (index 1) -> Click to cycle Age/Gender filter
        if (headers[1]) {
            headers[1].style.cursor = 'pointer';
            headers[1].title = 'Click to filter Age Category (Underage vs. Adult) and Gender';
            headers[1].addEventListener('click', () => {
                if (!tcrFilterState.ageCategory && !tcrFilterState.gender) {
                    tcrFilterState.ageCategory = 'underage';
                    if (sortSelect) sortSelect.value = 'Underage';
                    if (window.showNotification) showNotification('Filtering: Underage clients (< 18 yrs)', 'info');
                } else if (tcrFilterState.ageCategory === 'underage') {
                    tcrFilterState.ageCategory = 'adult';
                    if (sortSelect) sortSelect.value = 'Adult';
                    if (window.showNotification) showNotification('Filtering: Adult clients (≥ 18 yrs)', 'info');
                } else if (tcrFilterState.ageCategory === 'adult' && !tcrFilterState.gender) {
                    tcrFilterState.ageCategory = '';
                    tcrFilterState.gender = 'Female';
                    if (sortSelect) sortSelect.value = 'Female';
                    if (window.showNotification) showNotification('Filtering: Female clients', 'info');
                } else if (tcrFilterState.gender === 'Female') {
                    tcrFilterState.gender = 'Male';
                    if (sortSelect) sortSelect.value = 'Male';
                    if (window.showNotification) showNotification('Filtering: Male clients', 'info');
                } else {
                    tcrFilterState.ageCategory = '';
                    tcrFilterState.gender = '';
                    if (sortSelect) sortSelect.value = '';
                    if (window.showNotification) showNotification('Reset Age & Gender filters', 'info');
                }
                triggerUpdate();
            });
        }

        // Header 5: 'Risk Level' (index 5) -> Click to toggle Risk Level sort
        if (headers[5]) {
            headers[5].style.cursor = 'pointer';
            headers[5].title = 'Click to sort Risk Level (High-to-Low or Low-to-High)';
            headers[5].addEventListener('click', () => {
                if (tcrFilterState.riskSortDirection === 'high-to-low') {
                    tcrFilterState.riskSortDirection = 'low-to-high';
                    if (sortSelect) sortSelect.value = 'Risk (Low to High)';
                    if (window.showNotification) showNotification('Sorted Risk Level: Low-to-High', 'info');
                } else if (tcrFilterState.riskSortDirection === 'low-to-high') {
                    tcrFilterState.riskSortDirection = '';
                    if (sortSelect) sortSelect.value = '';
                    if (window.showNotification) showNotification('Reset Risk Level sorting', 'info');
                } else {
                    tcrFilterState.riskSortDirection = 'high-to-low';
                    if (sortSelect) sortSelect.value = 'Risk (High to Low)';
                    if (window.showNotification) showNotification('Sorted Risk Level: High-to-Low', 'info');
                }
                triggerUpdate();
            });
        }
    }
}

/**
 * Helper: Calculates integer age from a given YYYY-MM-DD birthdate string.
 */
function calculateAgeFromDate(dateStr) {
    if (!dateStr) return NaN;
    try {
        const dob = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age >= 0 ? age : NaN;
    } catch {
        return NaN;
    }
}

/**
 * Helper: Escapes HTML to prevent cross-site scripting in dynamically generated tables.
 */
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
// Generic RESTful HTTP Client Methods (Offline Resilient)
// --------------------------------------------------------------------------
const api = {
    async get(endpoint) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                headers: getAuthHeaders(),
                credentials: 'include',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`[api.js] GET /${endpoint} offline.`, error);
            return null;
        }
    },

    async post(endpoint, data) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`[api.js] POST /${endpoint} failed.`, error);
            return null;
        }
    },

    async put(endpoint, data) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`[api.js] PUT /${endpoint} failed.`, error);
            return null;
        }
    },

    // Patient registry methods & filter helpers
    fetchAssignedPatients,
    filterPatientsByGender,
    filterPatientsByAgeCategory,
    sortPatientsByRiskLevel,
    filterPatientsBySearchQuery,
    applyPatientTableFilters,
    renderPatientEmptyState,
    connectPatientTableFilters,
    getAuthContext,
    tcrFilterState
};

// Global Service Exposure
window.bwcApi = api;
window.api = api;
