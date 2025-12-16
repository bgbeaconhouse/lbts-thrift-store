/**
 * Fully Kiosk - Navigation-Aware Touch Fix
 * Prevents stuck touches during page navigation
 */

(function() {
  'use strict';

  console.log('🔧 Navigation-Aware Touch Fix Loaded');

  let activeTouches = new Set();
  let isNavigating = false;

  // ===========================================
  // INTERCEPT ALL NAVIGATION
  // ===========================================

  // Before ANY navigation, force clear all touches
  function clearTouchesBeforeNavigation() {
    if (activeTouches.size > 0) {
      console.warn(`⚠️ Navigation with ${activeTouches.size} active touches - force clearing`);
      
      // Dispatch touchend
      try {
        const event = new TouchEvent('touchend', {
          bubbles: true,
          cancelable: false,
          touches: [],
          targetTouches: [],
          changedTouches: []
        });
        document.body.dispatchEvent(event);
        document.dispatchEvent(event);
      } catch (err) {
        console.error('Navigation touchend error:', err);
      }
      
      activeTouches.clear();
    }
    
    isNavigating = true;
  }

  // Intercept all link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (link && !link.href.startsWith('javascript:')) {
      console.log('🔗 Link click detected:', link.href);
      clearTouchesBeforeNavigation();
    }
  }, { capture: true });

  // Intercept all form submissions
  document.addEventListener('submit', () => {
    console.log('📝 Form submit detected');
    clearTouchesBeforeNavigation();
  }, { capture: true });

  // Intercept all button clicks that might navigate
  document.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (button) {
      // Wait a moment then clear touches (in case button triggers navigation)
      setTimeout(() => {
        if (activeTouches.size > 0) {
          console.log('🔘 Button click - clearing touches');
          clearTouchesBeforeNavigation();
        }
      }, 50);
    }
  }, { capture: true });

  // ===========================================
  // TRACK TOUCH EVENTS
  // ===========================================

  document.addEventListener('touchstart', (e) => {
    if (isNavigating) {
      console.warn('⚠️ Touch started during navigation - blocking');
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    
    for (let touch of e.touches) {
      activeTouches.add(touch.identifier);
    }
  }, { capture: true, passive: false });

  document.addEventListener('touchend', (e) => {
    for (let touch of e.changedTouches) {
      activeTouches.delete(touch.identifier);
    }
  }, { capture: true });

  document.addEventListener('touchcancel', (e) => {
    for (let touch of e.changedTouches) {
      activeTouches.delete(touch.identifier);
    }
  }, { capture: true });

  // ===========================================
  // VISIBILITY CHANGE HANDLER
  // ===========================================

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('📄 Page hidden - clearing all touches');
      clearTouchesBeforeNavigation();
    } else {
      // Page visible again - reset navigation flag
      isNavigating = false;
      activeTouches.clear();
    }
  });

  // ===========================================
  // PAGE LOAD HANDLER
  // ===========================================

  // When page loads, ensure clean state
  window.addEventListener('load', () => {
    console.log('📄 Page loaded - resetting touch state');
    isNavigating = false;
    activeTouches.clear();
    
    // Force clear any stuck touches from previous page
    try {
      const event = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: false
      });
      document.body.dispatchEvent(event);
    } catch (err) {
      // Ignore
    }
  });

  // ===========================================
  // BEFORE UNLOAD
  // ===========================================

  window.addEventListener('beforeunload', () => {
    console.log('📤 Page unloading - clearing touches');
    clearTouchesBeforeNavigation();
  });

  // ===========================================
  // PAGEHIDE (for mobile)
  // ===========================================

  window.addEventListener('pagehide', () => {
    console.log('👋 Page hide - clearing touches');
    clearTouchesBeforeNavigation();
  });

  // ===========================================
  // STUCK TOUCH DETECTOR
  // ===========================================

  let lastTouchStart = 0;
  
  document.addEventListener('touchstart', () => {
    lastTouchStart = Date.now();
  }, { capture: true, passive: true });

  setInterval(() => {
    if (activeTouches.size > 0 && !isNavigating) {
      const age = Date.now() - lastTouchStart;
      if (age > 2000) {
        console.error(`🚨 STUCK TOUCH (${age}ms) - force clearing`);
        clearTouchesBeforeNavigation();
        isNavigating = false;
      }
    }
  }, 1000);

  // ===========================================
  // GLOBAL CSS
  // ===========================================

  const style = document.createElement('style');
  style.textContent = `
    body, html {
      touch-action: pan-y pinch-zoom !important;
    }
  `;
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.head.appendChild(style);
    });
  }

  console.log('✅ Navigation-aware touch fix initialized');
})();