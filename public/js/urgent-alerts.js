// public/js/urgent-alerts.js
// Shared urgent note alert system for all pages
// Automatically checks for and displays urgent notes via SSE

(function() {
  'use strict';

  let eventSource = null;
  let currentAlertNoteId = null;

  // Initialize urgent alert system
  function initUrgentAlerts() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found, skipping urgent alerts setup');
      return;
    }

    // Check for any existing undismissed urgent notes on page load
    checkForUndismissedNotes();

    // Establish SSE connection for real-time urgent note broadcasts
    connectToUrgentStream();
  }

  // Check for undismissed urgent notes on page load
  async function checkForUndismissedNotes() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/communication/urgent/undismissed', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.urgentNotes && data.urgentNotes.length > 0) {
          // Show the most recent undismissed urgent note
          showUrgentAlert(data.urgentNotes[0]);
        }
      }
    } catch (error) {
      console.error('Error checking for undismissed urgent notes:', error);
    }
  }

  // Connect to SSE stream for real-time urgent note broadcasts
  function connectToUrgentStream() {
    const token = localStorage.getItem('token');
    
    // Create EventSource with custom headers isn't directly supported
    // We'll use a workaround with query parameter
    eventSource = new EventSource(`/api/communication/urgent-stream?token=${encodeURIComponent(token)}`);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('Connected to urgent alerts stream');
        } else if (data.type === 'urgent_note') {
          // New urgent note received - show it immediately
          showUrgentAlert(data.note);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    });

    eventSource.addEventListener('error', (error) => {
      console.error('SSE connection error:', error);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('Attempting to reconnect to urgent alerts stream...');
          connectToUrgentStream();
        }
      }, 5000);
    });
  }

  // Show urgent alert modal
  function showUrgentAlert(note) {
    const overlay = document.getElementById('urgentNoteAlert');
    if (!overlay) {
      console.error('Urgent alert overlay not found in DOM');
      return;
    }

    currentAlertNoteId = note.id;

    // Populate alert content
    document.getElementById('urgentNoteContent').textContent = note.note;
    document.getElementById('urgentNoteAuthor').textContent = note.username || 'Unknown';
    
    // Format timestamp
    const createdDate = new Date(note.created_at);
    document.getElementById('urgentNoteTime').textContent = createdDate.toLocaleString();

    // Show the overlay
    overlay.style.display = 'flex';
  }

  // Dismiss urgent alert
  async function dismissUrgentAlert() {
    if (!currentAlertNoteId) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/communication/urgent/${currentAlertNoteId}/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Hide the overlay
        const overlay = document.getElementById('urgentNoteAlert');
        overlay.style.display = 'none';
        currentAlertNoteId = null;

        // Check if there are more undismissed notes to show
        setTimeout(checkForUndismissedNotes, 500);
      } else {
        alert('Failed to dismiss urgent note. Please try again.');
      }
    } catch (error) {
      console.error('Error dismissing urgent note:', error);
      alert('Failed to dismiss urgent note. Please try again.');
    }
  }

  // Setup dismiss button listener when DOM is ready
  function setupDismissButton() {
    const dismissBtn = document.getElementById('dismissUrgentNote');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', dismissUrgentAlert);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupDismissButton();
      initUrgentAlerts();
    });
  } else {
    setupDismissButton();
    initUrgentAlerts();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (eventSource) {
      eventSource.close();
    }
  });
})();