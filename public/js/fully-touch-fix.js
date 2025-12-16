/**
 * Fully Kiosk Browser - Global Touch & Scroll Fix
 * Include this on ALL pages to prevent scroll breaking
 * Add to <head>: <script src="/js/fully-touch-fix.js"></script>
 */

(function() {
  'use strict';

  console.log('🔧 Fully Kiosk Global Touch Fix Loaded');

  // Track touch state
  let activeTouches = new Map();
  let lastTouchStart = 0;
  
  // Constants
  const STUCK_TOUCH_TIMEOUT = 3000; // 3 seconds
  const SCROLL_CHECK_INTERVAL = 2000; // 2 seconds

  // ===========================================
  // TOUCH EVENT TRACKING
  // ===========================================

  function trackTouchStart(e) {
    lastTouchStart = Date.now();
    for (let touch of e.touches) {
      activeTouches.set(touch.identifier, {
        startTime: Date.now(),
        startX: touch.clientX,
        startY: touch.clientY
      });
    }
  }

  function trackTouchEnd(e) {
    for (let touch of e.changedTouches) {
      activeTouches.delete(touch.identifier);
    }
  }

  function trackTouchCancel(e) {
    for (let touch of e.changedTouches) {
      activeTouches.delete(touch.identifier);
    }
    console.warn('⚠️ Touch cancelled');
  }

  // Add listeners at capture phase to catch all events
  document.addEventListener('touchstart', trackTouchStart, { capture: true, passive: true });
  document.addEventListener('touchend', trackTouchEnd, { capture: true, passive: true });
  document.addEventListener('touchcancel', trackTouchCancel, { capture: true, passive: true });

  // ===========================================
  // FORCE CLEANUP STUCK TOUCHES
  // ===========================================

  function forceEndAllTouches() {
    if (activeTouches.size === 0) return;

    console.error('🚨 FORCING END OF ALL TOUCHES (' + activeTouches.size + ' stuck)');
    
    try {
      // Dispatch synthetic touchend to all elements
      const touchEndEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        view: window,
        touches: [],
        targetTouches: [],
        changedTouches: []
      });
      document.body.dispatchEvent(touchEndEvent);
    } catch (err) {
      console.error('Error dispatching touchend:', err);
    }

    // Clear our tracking
    activeTouches.clear();
    
    // Reset CSS that might be blocking scroll
    restoreScrollability();
    
    console.log('✅ All touches forcefully cleared');
  }

  function restoreScrollability() {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.touchAction = 'pan-y pinch-zoom';
    document.documentElement.style.touchAction = 'pan-y pinch-zoom';
    
    // Remove any position locks
    document.body.style.position = '';
    document.body.style.width = '';
  }

  // ===========================================
  // PERIODIC STUCK TOUCH CHECK
  // ===========================================

  setInterval(() => {
    const now = Date.now();
    
    // Check each active touch
    for (let [id, touchInfo] of activeTouches.entries()) {
      const touchAge = now - touchInfo.startTime;
      
      if (touchAge > STUCK_TOUCH_TIMEOUT) {
        console.error(`🚨 STUCK TOUCH DETECTED (ID: ${id}, Age: ${touchAge}ms)`);
        forceEndAllTouches();
        break; // Exit after fixing
      }
    }
  }, SCROLL_CHECK_INTERVAL);

  // ===========================================
  // VISIBILITY CHANGE CLEANUP
  // ===========================================

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && activeTouches.size > 0) {
      console.warn('⚠️ Page hidden with active touches, force clearing');
      forceEndAllTouches();
    }
  });

  window.addEventListener('blur', () => {
    if (activeTouches.size > 0) {
      console.warn('⚠️ Window blur with active touches, force clearing');
      forceEndAllTouches();
    }
  });

  // ===========================================
  // HORIZONTAL SCROLL FIX
  // ===========================================

  // Fix horizontal scroll areas to not break vertical scroll
  function fixHorizontalScrollAreas() {
    // Target common horizontal scroll containers
    const selectors = [
      '.category-tabs',
      '.horizontal-scroll',
      '.tabs-wrapper',
      '.swipe-container',
      '[style*="overflow-x: auto"]',
      '[style*="overflow-x:auto"]'
    ];
    
    selectors.forEach(selector => {
      const containers = document.querySelectorAll(selector);
      containers.forEach(container => {
        // Only allow horizontal panning in this specific area
        container.style.touchAction = 'pan-x';
        container.style.overflowX = 'auto';
        container.style.overflowY = 'hidden';
        container.style.webkitOverflowScrolling = 'touch';
        
        console.log('📏 Fixed horizontal scroll area:', selector);
      });
    });
  }

  // Apply fixes when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixHorizontalScrollAreas);
  } else {
    fixHorizontalScrollAreas();
  }

  // Also reapply after a delay (for dynamically added content)
  setTimeout(fixHorizontalScrollAreas, 1000);

  // ===========================================
  // GLOBAL TOUCH ACTION FIX
  // ===========================================

  // Set default touch action on body
  function setBodyTouchAction() {
    document.body.style.touchAction = 'pan-y pinch-zoom';
  }

  if (document.body) {
    setBodyTouchAction();
  } else {
    document.addEventListener('DOMContentLoaded', setBodyTouchAction);
  }

  // ===========================================
  // FULLY KIOSK SPECIFIC FIXES
  // ===========================================

  if (window.fully) {
    console.log('📱 Fully Kiosk detected, applying specific fixes');
    
    // Periodically check if Fully has locked scroll
    setInterval(() => {
      // Ensure scroll isn't locked
      if (document.body && document.body.style.overflow === 'hidden') {
        console.warn('⚠️ Scroll appears locked, restoring...');
        restoreScrollability();
      }
    }, 5000);
  }

  // ===========================================
  // EXPOSE GLOBAL FUNCTIONS FOR DEBUGGING
  // ===========================================

  window.fullyFixDebug = {
    activeTouches: activeTouches,
    forceEndAllTouches: forceEndAllTouches,
    restoreScrollability: restoreScrollability,
    getActiveTouchCount: () => activeTouches.size
  };

  console.log('✅ Touch fix initialized');
  console.log('   - Touch tracking: active');
  console.log('   - Stuck touch detection: active');
  console.log('   - Horizontal scroll fix: active');
  console.log('   - Debug: window.fullyFixDebug');
})();