// idle-break-logger.js
// Comprehensive logging to diagnose the 10-second scroll lock issue
// Logs everything to localStorage so you can review it later

(function() {
  'use strict';
  
  const LOG_KEY = 'fullyScrollDebugLog';
  let eventLog = [];
  let lastTouchTime = Date.now();
  let lastScrollTime = Date.now();
  let logStartTime = Date.now();
  
  // Helper to get timestamp
  function getTimestamp() {
    const elapsed = ((Date.now() - logStartTime) / 1000).toFixed(2);
    return `[${elapsed}s]`;
  }
  
  // Add log entry
  function log(message, data = {}) {
    const entry = {
      timestamp: Date.now(),
      elapsed: ((Date.now() - logStartTime) / 1000).toFixed(2),
      message: message,
      data: data
    };
    
    eventLog.push(entry);
    console.log(`${getTimestamp()} ${message}`, data);
    
    // Keep last 500 entries
    if (eventLog.length > 500) {
      eventLog.shift();
    }
    
    // Save to localStorage periodically
    if (eventLog.length % 10 === 0) {
      saveLog();
    }
  }
  
  // Save log to localStorage
  function saveLog() {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify({
        startTime: logStartTime,
        entries: eventLog
      }));
    } catch(e) {
      console.error('Failed to save log:', e);
    }
  }
  
  // Retrieve and display log
  window.getScrollDebugLog = function() {
    try {
      const saved = localStorage.getItem(LOG_KEY);
      if (!saved) {
        console.log('No log found');
        return;
      }
      
      const log = JSON.parse(saved);
      console.log('=== SCROLL DEBUG LOG ===');
      console.log('Session started:', new Date(log.startTime).toLocaleString());
      console.log('Total entries:', log.entries.length);
      console.log('');
      
      log.entries.forEach(entry => {
        console.log(`[${entry.elapsed}s] ${entry.message}`, entry.data);
      });
      
      return log;
    } catch(e) {
      console.error('Failed to retrieve log:', e);
    }
  };
  
  // Clear log
  window.clearScrollDebugLog = function() {
    localStorage.removeItem(LOG_KEY);
    eventLog = [];
    logStartTime = Date.now();
    console.log('Log cleared');
  };
  
  log('🔍 Idle Break Logger Started');
  
  // Monitor visibility changes
  document.addEventListener('visibilitychange', function() {
    log('📄 Visibility changed', {
      hidden: document.hidden,
      visibilityState: document.visibilityState
    });
  });
  
  // Monitor page focus
  window.addEventListener('focus', function() {
    log('👁️ Window focused');
  });
  
  window.addEventListener('blur', function() {
    log('👁️ Window blurred');
  });
  
  // Monitor all touch events
  let touchCount = 0;
  
  document.addEventListener('touchstart', function(e) {
    touchCount++;
    lastTouchTime = Date.now();
    
    log('👆 Touch START', {
      target: e.target.tagName,
      id: e.target.id || 'none',
      touches: e.touches.length,
      cancelable: e.cancelable,
      timeSinceLastTouch: ((Date.now() - lastTouchTime) / 1000).toFixed(2) + 's'
    });
  }, true);
  
  document.addEventListener('touchend', function(e) {
    log('👆 Touch END', {
      target: e.target.tagName,
      id: e.target.id || 'none'
    });
  }, true);
  
  document.addEventListener('touchcancel', function(e) {
    log('❌ Touch CANCEL!', {
      target: e.target.tagName,
      id: e.target.id || 'none'
    });
  }, true);
  
  // Monitor scroll events
  let scrollCount = 0;
  
  window.addEventListener('scroll', function() {
    scrollCount++;
    lastScrollTime = Date.now();
    
    if (scrollCount % 5 === 0) { // Log every 5th scroll to reduce spam
      log('📜 Scroll event', {
        scrollY: window.scrollY,
        count: scrollCount
      });
    }
  }, true);
  
  // Monitor for scroll lock - check every second
  setInterval(function() {
    const timeSinceTouch = (Date.now() - lastTouchTime) / 1000;
    const timeSinceScroll = (Date.now() - lastScrollTime) / 1000;
    
    // If we haven't touched in 8+ seconds, and haven't scrolled in 3+ seconds
    if (timeSinceTouch > 8 && timeSinceScroll > 3) {
      // Try to scroll programmatically
      const beforeY = window.scrollY;
      window.scrollBy(0, 1);
      
      setTimeout(function() {
        const afterY = window.scrollY;
        const scrollWorked = beforeY !== afterY || beforeY === 0;
        
        if (!scrollWorked) {
          log('🚨 SCROLL LOCK DETECTED!', {
            timeSinceTouch: timeSinceTouch.toFixed(2) + 's',
            timeSinceScroll: timeSinceScroll.toFixed(2) + 's',
            scrollY: window.scrollY
          });
        }
      }, 100);
    }
  }, 1000);
  
  // Monitor any error events
  window.addEventListener('error', function(e) {
    log('⚠️ JavaScript Error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno
    });
  }, true);
  
  // Monitor console errors (preventDefault errors)
  const originalError = console.error;
  console.error = function(...args) {
    log('⚠️ Console Error', {
      message: args.join(' ')
    });
    originalError.apply(console, args);
  };
  
  // Check WebView properties
  log('🌐 WebView Info', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    touchPoints: navigator.maxTouchPoints
  });
  
  // Monitor any fullscreen changes
  document.addEventListener('fullscreenchange', function() {
    log('📺 Fullscreen changed', {
      isFullscreen: !!document.fullscreenElement
    });
  });
  
  // Check for any Fully Kiosk specific variables
  setTimeout(function() {
    if (typeof fully !== 'undefined') {
      log('📱 Fully Kiosk detected', {
        version: fully.getAppVersionName ? fully.getAppVersionName() : 'unknown'
      });
    }
  }, 1000);
  
  log('✅ Logger ready - interact with page and wait for idle scroll break');
  log('💾 Call getScrollDebugLog() in console to see full log');
  log('🗑️ Call clearScrollDebugLog() to clear log');
  
  // Auto-save log before page unload
  window.addEventListener('beforeunload', function() {
    saveLog();
  });
  
})();