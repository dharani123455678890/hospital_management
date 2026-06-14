const appContent = document.getElementById('app-content');
const patientsLink = document.getElementById('patients-link');

let globalPatients = [];
const BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://127.0.0.1:8000"
    : "/api";

// ==========================================
// FIREBASE AUTHENTICATION CONFIG & LOGIC
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAQy2YzrAWTJAC_hMuSNBKEQXyaH6cepw8",
    authDomain: "hosmangt.firebaseapp.com",
    projectId: "hosmangt",
    storageBucket: "hosmangt.firebasestorage.app",
    messagingSenderId: "808230548297",
    appId: "1:808230548297:web:30861ba100c230f0092098",
    measurementId: "G-VK0X4TMEXM"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// DOM Elements for Auth
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const googleSigninBtn = document.getElementById('google-signin-btn');
const googleSignupBtn = document.getElementById('google-signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorMsg = document.getElementById('auth-error-msg');
let authToken = null;

async function apiFetch(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("You must sign in before using the application.");
    }

    authToken = await user.getIdToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${authToken}`);

    return window.fetch(url, { ...options, headers });
}

// Auth State Listener (Handles automatic login on refresh)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in, tokens are handled smoothly.
        authToken = await user.getIdToken();
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        
        // ---------- INIT ----------
        // Call renderSearchPage immediately on successful auth
        renderSearchPage();
    } else {
        // User is signed out.
        authToken = null;
        authContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

// Remove this block later if you only want sign-ins
googleSignupBtn.addEventListener('click', () => {
    errorMsg.innerText = "";
    auth.signInWithPopup(provider)
        .then((result) => {
            const isNewUser = result.additionalUserInfo?.isNewUser;
            // You can implement custom logic here if you want to reject non-new users
            console.log("Signup successful!");
        })
        .catch((error) => {
            errorMsg.innerText = error.message;
        });
});

googleSigninBtn.addEventListener('click', () => {
    errorMsg.innerText = "";
    auth.signInWithPopup(provider)
        .then((result) => {
            const isNewUser = result.additionalUserInfo?.isNewUser;
            // If you want to prevent new users entirely later, you can check isNewUser here 
            // and delete their account immediately if they aren't allowed.
            console.log("Signin successful!");
        })
        .catch((error) => {
            errorMsg.innerText = error.message;
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log("Logged out consciously");
    }).catch((error) => {
        console.error("Logout error", error);
    });
});
// ==========================================


// ---------- NAV ----------
patientsLink.addEventListener('click', (e) => {
    e.preventDefault();
    renderSearchPage();
});

// ---------- ADD PATIENT BUTTON ----------
document.getElementById('add-patient-btn').addEventListener('click', renderAddPatientForm);

// ---------- DELETE ALL BUTTON ----------
const deleteAllBtn = document.getElementById('delete-all-btn');
if (deleteAllBtn) {
deleteAllBtn.addEventListener('click', async () => {
    if (confirm("Are you absolutely sure you want to DELETE ALL patients and their visit history? This cannot be undone.")) {
        const btn = document.getElementById('delete-all-btn');
        btn.innerText = "Deleting...";
        btn.disabled = true;

        try {
            const res = await apiFetch(`${BASE_URL}/delete_all`, {
                method: "DELETE"
            });
            const data = await res.json();
            
            if (data.status === "success") {
                alert("All records completely deleted!");
                // Clear UI cache
                globalPatients = [];
                renderSearchPage();
            } else {
                alert("Deletion error: " + data.message);
            }
        } catch (e) {
            console.error("Delete All Request Error:", e);
            alert("Network error. Could not delete all records.");
        } finally {
            btn.innerText = "Delete All";
            btn.disabled = false;
        }
    }
});
}

// ---------- SEARCH PAGE ----------
function renderSearchPage() {
    globalPatients = [];

    appContent.innerHTML = `
        <h2>Patient Search</h2>

        <div class="search-container">
            <select id="search-by" class="search-input">
                <option value="name">Patient Name</option>
                <option value="phone">Mobile Number</option>
                <option value="id">Patient ID</option>
            </select>

            <input id="search-query" class="search-input" placeholder="Search...">
            <button id="search-btn" class="search-btn view-btn">Search</button>
        </div>

        <div id="search-results-area"></div>
    `;

    document.getElementById('search-btn').addEventListener('click', executeSearch);

    document.getElementById('search-query').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeSearch();
    });
}
async function updateVisit(patientId, visitId, existingImages = []) {

    const visit_date = document.getElementById('e_date').value;
    const amount = document.getElementById('e_amount').value;
    const problem = document.getElementById('e_problem').value.trim();
    const medicine = document.getElementById('e_medicine').value.trim();
    const prescription = document.getElementById('e_prescription').value.trim();

    if (!visit_date || !amount || !problem || !medicine || !prescription) {
        alert("All fields required");
        return;
    }

    let newImageUrls = [];
    const btn = document.getElementById('save-edit-btn');

    if (window.pendingImages && window.pendingImages.length > 0) {
        btn.innerText = "Uploading...";
        btn.disabled = true;

        const formData = new FormData();
        window.pendingImages.forEach(file => {
            formData.append('files', file);
        });

        try {
            const uploadRes = await apiFetch(`${BASE_URL}/upload_images`, {
                method: "POST",
                body: formData
            });
            const result = await uploadRes.json();
            if (result.status === "success") {
                newImageUrls = result.urls;
            } else {
                alert("Failed to upload images: " + result.message);
                btn.innerText = "Save";
                btn.disabled = false;
                return;
            }
        } catch (err) {
            console.error(err);
            alert("Error uploading images");
            btn.innerText = "Save";
            btn.disabled = false;
            return;
        }
    }

    const allImages = [...existingImages, ...newImageUrls];
    btn.innerText = "Saving...";

    try {
        const res = await apiFetch(`${BASE_URL}/update_visit`, {
            method: "POST",   // FIXED
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                visit_id: visitId,
                patient_id: patientId,
                visit_date,
                problem,
                medicine_given: medicine,
                prescription,
                images: allImages,
                amount_paid: Number(amount)
            })
        });

        if (res.ok) {
            alert("Visit updated");
            
            // Re-fetch patient visits
            try {
                const searchRes = await apiFetch(`${BASE_URL}/search_patients?by=id&value=${encodeURIComponent(patientId)}`);
                const latestPatients = await searchRes.json();
                if(latestPatients && latestPatients.length > 0) {
                    const idx = globalPatients.findIndex(p => p.id === patientId);
                    if(idx !== -1) globalPatients[idx] = latestPatients[0];
                }
            } catch(e) {
                console.error("Refresh error:", e);
            }
            
            showVisitDetail(patientId, visitId); // better than reload
        } else {
            const errText = await res.text();
            console.log("ERROR:", errText);
            alert("Update failed");
            btn.innerText = "Save";
            btn.disabled = false;
        }

    } catch (err) {
        console.error(err);
        alert("Server error");
        btn.innerText = "Save";
        btn.disabled = false;
    }
}
// ---------- FORM ----------
function renderAddPatientForm() {
    appContent.innerHTML = `
        <h2>Register New Patient</h2>

        <div class="patient-form">
            <input id="p_name" class="search-input" placeholder="Name">
            <input id="p_age" class="search-input" type="number" placeholder="Age">

            <select id="p_gender" class="search-input">
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
            </select>

            <input id="p_native" class="search-input" placeholder="Native">
            <input id="p_phone" class="search-input" placeholder="Phone">

            <button id="save-patient-btn" class="view-btn">Save Patient</button>
            <button id="cancel-btn" class="back-btn">Cancel</button>

            <p id="form-msg"></p>
        </div>
    `;

    document.getElementById('save-patient-btn').addEventListener('click', savePatient);
    document.getElementById('cancel-btn').addEventListener('click', renderSearchPage);
}

// ---------- SAVE ----------
async function savePatient() {
    const name = document.getElementById('p_name').value.trim();
    const age = document.getElementById('p_age').value.trim();
    const gender = document.getElementById('p_gender').value;
    const native = document.getElementById('p_native').value.trim();
    const phone = document.getElementById('p_phone').value.trim();

    if (!name || !age || !gender || !native || !phone) {
        alert("All fields required");
        return;
    }

    try {
        const res = await apiFetch(`${BASE_URL}/add_patient`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                age: Number(age),
                gender,
                native,
                phone
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert(`Patient registered successfully`);
            renderSearchPage();
        } else {
            alert("Failed to register patient");
        }

    } catch (err) {
        console.error(err);
        alert("Server error");
    }
}

// ---------- SEARCH ----------
async function executeSearch() {
    const by = document.getElementById('search-by').value;
    const query = document.getElementById('search-query').value.trim();
    const resultsArea = document.getElementById('search-results-area');

    if (!query) {
        resultsArea.innerHTML = '<p style="color:red;">Enter value</p>';
        return;
    }

    resultsArea.innerHTML = '<p>Searching...</p>';

    try {
        const res = await apiFetch(`${BASE_URL}/search_patients?by=${by}&value=${encodeURIComponent(query)}`);
        globalPatients = await res.json();

        if (!globalPatients.length) {
            resultsArea.innerHTML = '<p>No results</p>';
            return;
        }

        const container = document.createElement('div');
        container.className = 'patients-grid';

        globalPatients.forEach((p) => {

            const card = document.createElement('div');
            card.className = 'patient-card';

            const profilePic = p.profile_pic ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}`;

            card.innerHTML = `
                <img src="${profilePic}" class="profile-pic">
                <div class="patient-info">
                    <h3>${p.name}</h3>
                    <p><strong>Phone:</strong> ${p.phone}</p>
                    <button class="view-btn">View Full Details</button>
                </div>
            `;

            card.addEventListener('click', () => {
                showPatientDetails(p.id);
            });

            container.appendChild(card);
        });

        resultsArea.innerHTML = '';
        resultsArea.appendChild(container);

    } catch (err) {
        console.error(err);
        resultsArea.innerHTML = '<p style="color:red;">Error</p>';
    }
}

// ---------- PATIENT ----------
function showPatientDetails(patientId) {

    const normalizedId = String(patientId).startsWith('p')
        ? String(patientId)
        : 'p' + patientId;

    const patient = globalPatients.find(p => p.id === normalizedId);
    if (!patient) return;

    const profilePic = patient.profile_pic ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(patient.name)}`;

    let visitsHTML = '';

    if (patient.visits && patient.visits.length) {

        visitsHTML = '<div class="visit-dates-list">';

        patient.visits.forEach((visit, index) => {
            const vid = visit.id || index;

            visitsHTML += `
                <div class="visit-date-card" data-id="${vid}">
                    📅 ${visit.visit_date || 'N/A'}
                </div>
            `;
        });

        visitsHTML += '</div>';

    } else {
        visitsHTML = '<p>No visits recorded</p>';
    }

    appContent.innerHTML = `
        <button class="back-btn" id="back-btn">Back</button>

        <div class="patient-profile-header">
            <img src="${profilePic}" class="profile-pic-large">
            <div class="patient-info-large">
                <h2>${patient.name}</h2>
                <p><strong>Age:</strong> ${patient.age}</p>
                <p><strong>Gender:</strong> ${patient.gender}</p>
                <p><strong>Phone:</strong> ${patient.phone}</p>
                <p><strong>Native:</strong> ${patient.native}</p>

                <button id="add-visit-btn" class="view-btn" style="margin-top:10px;">
                    + Add Visit
                </button>
            </div>
        </div>

        <hr class="card-divider">

        <h3>Visit Dates</h3>
        ${visitsHTML}
    `;

    document.getElementById('back-btn').addEventListener('click', renderSearchPage);

    document.getElementById('add-visit-btn').addEventListener('click', () => {
        renderAddVisitForm(patient.id);
    });

    document.querySelectorAll('.visit-date-card').forEach(card => {
        card.addEventListener('click', () => {
            const vid = card.dataset.id;
            showVisitDetail(patient.id, vid);
        });
    });
}

function imageUploaderMarkup(inputId, previewId, label = "Add Images") {
    return `
        <div class="image-uploader">
            <label class="image-uploader-label">${label}</label>
            <div id="${inputId}_dropzone" class="image-dropzone" tabindex="0" role="button" aria-label="Paste, drop, or browse image files">
                <div class="image-dropzone-icon">+</div>
                <strong>Copy and paste images here</strong>
                <span>or drag and drop image files</span>
                <span class="image-dropzone-divider">or</span>
                <button type="button" id="${inputId}_browse" class="image-browse-btn">Browse Files</button>
                <small>You can select multiple images</small>
            </div>
            <input id="${inputId}" class="image-file-input" type="file" multiple accept="image/*">
            <p id="${inputId}_status" class="image-upload-status" aria-live="polite"></p>
            <div id="${previewId}" class="visit-images"></div>
        </div>
    `;
}

function renderAddVisitForm(patientId) {

    window.pendingImages = []; // Clear any previously staged images
    const today = new Date().toISOString().split('T')[0];

   appContent.innerHTML = `
<button class="back-btn" id="back-btn">Back</button>

<h2>Add Visit</h2>
        <div class="full" style="margin-bottom: 20px;">
            ${imageUploaderMarkup('v_images', 'v_images_preview')}
        </div>

<div class="visit-form-grid">

    <!-- ROW 1: DATE + AMOUNT + BUTTON -->
    <div>
        <label>Date</label>
        <input id="v_date" class="search-input" type="date" value="${today}">
    </div>

    <div>
        <label>Amount</label>
        <input id="v_amount" class="search-input" type="number" placeholder="Amount Paid">
    </div>

    <div class="btn-align">
        <button id="save-visit-btn" class="view-btn">Save Visit</button>
    </div>

    <!-- ROW 2: PROBLEM -->
    <div class="full">
        <label>Problem</label>
        <textarea id="v_problem" class="search-input" rows="4"></textarea>
    </div>

    <!-- ROW 3: HALF + HALF -->
    <div>
        <label>Medicine</label>
        <textarea id="v_medicine" class="search-input" rows="4"></textarea>
    </div>

    <div>
        <label>Prescription / Advice</label>
        <textarea id="v_prescription" class="search-input" rows="4"></textarea>

    </div>
</div>
`;

    document.getElementById('back-btn').addEventListener('click', () => {
        showPatientDetails(patientId);
    });

    document.getElementById('save-visit-btn').addEventListener('click', () => {
        saveVisit(patientId);
    });

    setupImageUploader('v_images', 'v_images_preview');
}

async function saveVisit(patientId) {

    const visit_date = document.getElementById('v_date').value;
    const problem = document.getElementById('v_problem').value.trim();
    const medicine = document.getElementById('v_medicine').value.trim();
    const prescription = document.getElementById('v_prescription').value.trim();
    const amount = document.getElementById('v_amount').value.trim();

    if (!visit_date || !problem || !medicine || !prescription || !amount) {
        alert("All fields required");
        return;
    }

    let imageUrls = [];
    const btn = document.getElementById('save-visit-btn');

    if (window.pendingImages && window.pendingImages.length > 0) {
        btn.innerText = "Uploading Images...";
        btn.disabled = true;

        const formData = new FormData();
        window.pendingImages.forEach(file => {
            formData.append('files', file);
        });

        try {
            const uploadRes = await apiFetch(`${BASE_URL}/upload_images`, {
                method: "POST",
                body: formData
            });
            const result = await uploadRes.json();
            if (result.status === "success") {
                imageUrls = result.urls;
            } else {
                alert("Failed to upload images: " + result.message);
                btn.innerText = "Save Visit";
                btn.disabled = false;
                return;
            }
        } catch (err) {
            console.error(err);
            alert("Error uploading images");
            btn.innerText = "Save Visit";
            btn.disabled = false;
            return;
        }
    }

    btn.innerText = "Saving Visit...";

    try {
        const res = await apiFetch(`${BASE_URL}/add_visit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                patient_id: patientId,
                visit_date,
                problem,
                medicine_given: medicine,
                prescription,
                images: imageUrls,
                amount_paid: Number(amount)
            })
        });

        if (res.ok) {
            alert("Visit added successfully");
            renderSearchPage();
        } else {
            alert("Failed to add visit");
            btn.innerText = "Save Visit";
            btn.disabled = false;
        }

    } catch (err) {
        console.error(err);
        alert("Server error");
        btn.innerText = "Save Visit";
        btn.disabled = false;
    }
}
// ---------- VISIT ----------
function showVisitDetail(patientId, visitId) {

    window.pendingImages = []; // Clear pending images for edit mode

    const patient = globalPatients.find(p => p.id === patientId);
    if (!patient) return;

    const visit = patient.visits.find(v => String(v.id) === String(visitId));
    if (!visit) return;

    appContent.innerHTML = `
        <button class="back-btn" id="back-btn">Back</button>

        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2>Visit Details</h2>
            <button id="edit-btn" class="view-btn">Edit</button>
        </div>

        <div id="visit-container">

            <!-- VIEW MODE -->
            <div id="view-mode">

                <div class="visit-top-row">
                    <div>
                        <label>Date</label>
                        <div class="value">${visit.visit_date}</div>
                    </div>

                    <div>
                        <label>Amount</label>
                        <div class="value">₹${visit.amount_paid}</div>
                    </div>

                    <div class="visit-section full" id="visit-images-container">
                        <!-- Images will be injected here -->
                    </div>
                </div>

                <div class="visit-section full">
                    <label>Problem</label>
                    <div class="box">${visit.problem}</div>
                </div>

                <div class="visit-row">
                    <div class="visit-section">
                        <label>Medicine</label>
                        <div class="box">${visit.medicine_given}</div>
                    </div>

                    <div class="visit-section">
                        <label>Prescription</label>
                        <div class="box">${visit.prescription}</div>
                    </div>
                </div>



            </div>

            <!-- EDIT MODE -->
            <div id="edit-mode" style="display:none;">

                <div class="visit-form-grid">

                    <div>
                        <label>Date</label>
                        <input id="e_date" type="date" value="${visit.visit_date}">
                    </div>

                    <div>
                        <label>Amount</label>
                        <input id="e_amount" type="number" value="${visit.amount_paid}">
                    </div>

                    <div class="btn-align">
                        <button id="save-edit-btn" class="view-btn">Save</button>
                    </div>

                    <div class="full">
                        <label>Problem</label>
                        <textarea id="e_problem">${visit.problem}</textarea>
                    </div>

                    <div class="full">
                        <label>Medicine</label>
                        <textarea id="e_medicine">${visit.medicine_given}</textarea>
                    </div>

                    <div class="full">
                        <label>Prescription</label>
                        <textarea id="e_prescription">${visit.prescription}</textarea>
                    </div>

                    <div class="full" style="margin-bottom: 20px;">
                        ${imageUploaderMarkup('e_images', 'e_images_preview', 'Upload More Images (Optional)')}
                    </div>

                </div>

            </div>

        </div>
    `;

    document.getElementById('back-btn').onclick = () => showPatientDetails(patientId);

    const editBtn = document.getElementById('edit-btn');
    const viewMode = document.getElementById('view-mode');
    const editMode = document.getElementById('edit-mode');

    // Render Images
    const imagesContainer = document.getElementById('visit-images-container');
    if (visit.images && visit.images.length > 0) {
        imagesContainer.innerHTML = '<label>Images</label><div class="visit-images"></div>';
        const imgFlex = imagesContainer.querySelector('.visit-images');
        
        visit.images.forEach((imgUrl, index) => {
            const imgEl = document.createElement('img');
            imgEl.src = imgUrl;
            imgEl.className = 'visit-img-thumb';
            imgEl.onclick = () => openImageGallery(visit.images, index);
            imgFlex.appendChild(imgEl);
        });
    }

    editBtn.onclick = () => {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
    };

    setupImageUploader('e_images', 'e_images_preview');

    document.getElementById('save-edit-btn').onclick = () => {
        updateVisit(patientId, visitId, visit.images || []);
    };
}

// ==== IMAGE UPLOADER ====
function setupImageUploader(inputId, previewContainerId) {
    const fileInput = document.getElementById(inputId);
    const browseButton = document.getElementById(`${inputId}_browse`);
    const dropzone = document.getElementById(`${inputId}_dropzone`);
    const status = document.getElementById(`${inputId}_status`);

    if (!fileInput || !browseButton || !dropzone) return;

    const addFiles = (files, source) => {
        const addedCount = addPendingImages(files, previewContainerId);
        status.textContent = addedCount
            ? `${addedCount} image${addedCount === 1 ? "" : "s"} added by ${source}.`
            : "No image files were found.";
    };

    browseButton.addEventListener('click', (event) => {
        event.stopPropagation();
        fileInput.click();
    });

    dropzone.addEventListener('click', (event) => {
        if (event.target !== browseButton) fileInput.click();
    });

    dropzone.addEventListener('keydown', (event) => {
        if (event.target === dropzone && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', () => {
        addFiles(fileInput.files, "File Explorer");
        fileInput.value = "";
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropzone.classList.add('is-dragging');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropzone.classList.remove('is-dragging');
        });
    });

    dropzone.addEventListener('drop', (event) => {
        addFiles(event.dataTransfer.files, "drag and drop");
    });

    dropzone.addEventListener('paste', (event) => {
        const pastedImages = Array.from(event.clipboardData?.items || [])
            .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter(Boolean);

        if (pastedImages.length) {
            event.preventDefault();
            addFiles(pastedImages, "paste");
        }
    });
}

function addPendingImages(files, previewContainerId) {
    if (!window.pendingImages) {
        window.pendingImages = [];
    }

    const previewContainer = document.getElementById(previewContainerId);
    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));

    imageFiles.forEach(file => {
            window.pendingImages.push(file);

            const wrapper = document.createElement('div');
            wrapper.className = 'image-preview-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'visit-img-thumb';
            img.onload = () => URL.revokeObjectURL(img.src);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'image-preview-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `Remove ${file.name || "pasted image"}`);

            removeBtn.onclick = (e) => {
                e.stopPropagation();
                const idx = window.pendingImages.indexOf(file);
                if (idx > -1) {
                    window.pendingImages.splice(idx, 1);
                }
                wrapper.remove();
            };

            wrapper.appendChild(img);
            wrapper.appendChild(removeBtn);
            previewContainer.appendChild(wrapper);
    });

    return imageFiles.length;
}

// ==== IMAGE GALLERY MODAL ====
window.galleryImages = [];
window.currentImageIndex = 0;

function openImageGallery(images, index) {
    if (!images || images.length === 0) return;

    window.galleryImages = images;
    window.currentImageIndex = index;

    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-img");
    const closeBtn = modal.querySelector(".close"); // IMPORTANT

    modal.style.display = "block";
    modalImg.src = images[index];
    modalImg.classList.remove('zoom');

    // attach fresh handler every time
    closeBtn.onclick = function () {
        modal.style.display = "none";
        modalImg.classList.remove('zoom');
    };

    modal.onclick = function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
            modalImg.classList.remove('zoom');
        }
    };

    modalImg.onclick = function () {
        modalImg.classList.toggle('zoom');
    };
}

function changeImage(step, event) {
    if(event) event.stopPropagation(); // Prevent modal from closing when clicking arrows
    if (!window.galleryImages || window.galleryImages.length <= 1) return;
    
    window.currentImageIndex += step;
    
    if (window.currentImageIndex < 0) {
        window.currentImageIndex = window.galleryImages.length - 1;
    } else if (window.currentImageIndex >= window.galleryImages.length) {
        window.currentImageIndex = 0;
    }
    
    const modalImg = document.getElementById("modal-img");
    modalImg.src = window.galleryImages[window.currentImageIndex];
    modalImg.classList.remove('zoom');
}

