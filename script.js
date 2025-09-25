// Declare global variables
let tokenClient;          // Google OAuth2 token client for authentication
let startTime = null;     // Stores the task start time
let timerInterval = null; // Interval ID for updating the timer display

// Format elapsed time (ms → HH:MM:SS or MM:SS)
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);       // Convert ms to total seconds
  const hours = Math.floor(totalSeconds / 3600);    // Extract hours
  const minutes = Math.floor((totalSeconds % 3600) / 60); // Extract minutes
  const seconds = totalSeconds % 60;                // Remaining seconds

  // If task exceeds 1 hour, show HH:MM:SS, otherwise MM:SS
  return hours > 0
    ? `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`
    : `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

// Display a message in the status area (info, success, error)
function showMessage(text, type="info") {
  const status = document.getElementById("status-message"); // Status message element
  status.textContent = text;                                // Set message text
  status.className = "";                                    // Reset classes
  status.classList.add(type);                               // Apply type class
  status.style.display = "block";                           // Make visible
}

// Sign in to Google and save a task in Google Calendar
async function signInAndSaveTask(title, startTime, endTime) {
  return new Promise((resolve, reject) => {
    // Define callback after token request
    tokenClient.callback = async (resp) => {
      if (resp.error) return reject(resp); // Handle login error

      try {
        // Insert new event into Google Calendar
        await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: {
            summary: title, // Task title
            description: `Task duration: ${Math.round((endTime - startTime)/60000)} minutes`, // Duration in minutes
            start: { dateTime: startTime.toISOString() }, // Start time in ISO format
            end: { dateTime: endTime.toISOString() }      // End time in ISO format
          }
        });

        // Show success message
        showMessage(`Task "${title}" added to your Google Calendar!`, 'success');

        // Immediately revoke token (security: prevents re-use)
        const token = gapi.client.getToken();
        if (token) {
          google.accounts.oauth2.revoke(token.access_token); // Revoke
          gapi.client.setToken(null);                        // Clear from client
        }

        resolve();
      } catch (err) {
        console.error(err);
        showMessage('Failed to add task to calendar.', 'error');
        reject(err);
      }
    };

    // Always force user to log in/consent before saving
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// When the page finishes loading
window.onload = () => {
  // Initialize Google OAuth2 token client
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: '1019538699200-f8kis1dibmi0f2lohmdhc81pp8vfe9m6.apps.googleusercontent.com', // OAuth client ID
    scope: 'https://www.googleapis.com/auth/calendar.events', // Calendar scope
    prompt: '' // No persistent prompt
  });

  // Load Google API client library
  gapi.load('client', async () => {
    await gapi.client.init({
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'] // Calendar API docs
    });
  });

  // Show task controls (hidden by default in HTML)
  document.getElementById('task-controls').style.display = 'block';

  // START TASK button logic
  document.getElementById('start-task').addEventListener('click', () => {
    startTime = new Date(); // Save current time as start
    document.getElementById('timer-display').textContent = '00:00'; // Reset display
    document.getElementById('start-task').style.display = 'none';   // Hide start button
    document.getElementById('stop-task').style.display = 'block';   // Show stop button

    // Update timer every second
    timerInterval = setInterval(() => {
      document.getElementById('timer-display').textContent = formatTime(new Date() - startTime);
    }, 1000);

    // Show info message
    showMessage(`Task started at ${startTime.toLocaleTimeString()}`, 'info');
  });

  // STOP TASK button logic
  document.getElementById('stop-task').addEventListener('click', () => {
    if (!startTime) return showMessage('Please start the task first!', 'error'); // Prevent stopping without start

    const endTime = new Date(); // Save current time as end
    clearInterval(timerInterval); // Stop timer updates

    // Show duration in minutes
    showMessage(`Task duration: ${Math.round((endTime - startTime)/60000)} minutes`, 'info');

    // Reset button states
    document.getElementById('start-task').style.display = 'block';
    document.getElementById('stop-task').style.display = 'none';

    // Open task title modal (popup)
    const modal = document.getElementById("task-modal");
    modal.style.display = "flex";
    document.getElementById("task-title-input").focus();

    // Save button in modal
    document.getElementById("save-task").onclick = async () => {
      const title = document.getElementById("task-title-input").value.trim();
      if (!title) return showMessage("Task title cannot be empty!", "error"); // Validate input

      try {
        // Save task to Google Calendar
        await signInAndSaveTask(title, startTime, endTime);
        startTime = null; // Reset start time
        document.getElementById('timer-display').textContent = '00:00'; // Reset timer display
      } catch (err) {
        console.error(err);
      }

      // Close modal and clear input
      modal.style.display = "none";
      document.getElementById("task-title-input").value = "";
    };

    // Cancel button in modal
    document.getElementById("cancel-task").onclick = () => {
      modal.style.display = "none"; // Hide modal
      document.getElementById("task-title-input").value = ""; // Clear input
    };

    // Allow pressing Enter key to save
    document.getElementById("task-title-input").onkeydown = (e) => {
      if (e.key === "Enter") document.getElementById("save-task").click();
    };
  });

  // THEME TOGGLE (light ↔ dark)
  document.getElementById("theme-toggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode"); // Toggle dark mode class
    const btn = document.getElementById("theme-toggle");
    // Switch button icon depending on theme
    btn.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
  });

  // Register service worker for PWA (offline support)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service worker registered:', reg))
        .catch(err => console.error('Service worker failed:', err));
    });
  }
};
