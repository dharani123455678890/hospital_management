const appContent = document.getElementById('app-content');
const homeLink = document.getElementById('home-link');
const patientsLink = document.getElementById('patients-link');

homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    appContent.innerHTML = `
        <h2>Welcome to the dashboard</h2>
        <p>Select an option from the menu to get started.</p>
    `;
});

patientsLink.addEventListener('click', (e) => {
    e.preventDefault();
    appContent.innerHTML = `
        <h2>Patients List</h2>
        <p>Loading patients from the backend...</p>
    `;
   
});

console.log("Frontend loaded.");