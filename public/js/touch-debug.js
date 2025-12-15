// touch-debug.js
// Comprehensive touch event debugging for Fully Kiosk Browser
// This will help us see what's happening when scrolling breaks

(function() {
  'use strict';
  
  console.log('🔍 Touch Debug Monitor Loaded');
  
  let touchStartTime = null;
  let lastTouchTarget = null;
  let touchMoveCount = 0;
  
  // Monitor all touch events at the capture phase (before they reach elements)
  document.addEventListener('touchstart', function(e) {
    touchStartTime = Date.now();
    lastTouchTarget = e.target;
    touchMoveCount = 0;
    
    console.log('📍 TOUCHSTART:', {
      target: e.target.tagName,
      targetId: e.target.id || 'no-id',
      targetClass: e.target.className || 'no-class',
      touches: e.touches.length,
      defaultPrevented: e.defaultPrevented,
      cancelable: e.cancelable,
      timestamp: Date.now()
    });
  }, true);
  
  document.addEventListener('touchmove', function(e) {
    touchMoveCount++;
    
    // Log every 10th touchmove to avoid spam, but log first few
    if (touchMoveCount <= 3 || touchMoveCount % 10 === 0) {
      console.log('👆 TOUCHMOVE #' + touchMoveCount + ':', {
        target: e.target.tagName,
        targetId: e.target.id || 'no-id',
        defaultPrevented: e.defaultPrevented,
        cancelable: e.cancelable,
        touches: e.touches.length
      });
    }
  }, true);
  
  document.addEventListener('touchend', function(e) {
    const duration = touchStartTime ? Date.now() - touchStartTime : 0;
    
    console.log('✋ TOUCHEND:', {
      target: e.target.tagName,
      targetId: e.target.id || 'no-id',
      duration: duration + 'ms',
      moveCount: touchMoveCount,
      defaultPrevented: e.defaultPrevented,
      timestamp: Date.now()
    });
    
    touchStartTime = null;
    lastTouchTarget = null;
    touchMoveCount = 0;
  }, true);
  
  document.addEventListener('touchcancel', function(e) {
    console.log('❌ TOUCHCANCEL:', {
      target: e.target.tagName,
      targetId: e.target.id || 'no-id'
    });
    
    touchStartTime = null;
    lastTouchTarget = null;
    touchMoveCount = 0;
  }, true);
  
  // Monitor scroll events
  let scrollLocked = false;
  let lastScrollTime = Date.now();
  
  window.addEventListener('scroll', function() {
    lastScrollTime = Date.now();
    if (scrollLocked) {
      console.log('✅ SCROLL WORKING AGAIN!');
      scrollLocked = false;
    }
  }, true);
  
  // Check if scrolling has stopped working
  setInterval(function() {
    const timeSinceScroll = Date.now() - lastScrollTime;
    
    // If we haven't scrolled in 5 seconds and we've had recent touch events
    if (timeSinceScroll > 5000 && lastTouchTarget && !scrollLocked) {
      console.log('⚠️ WARNING: Scrolling may be locked! Last scroll was ' + 
                  Math.round(timeSinceScroll/1000) + ' seconds ago');
      scrollLocked = true;
    }
  }, 2000);
  
  // Test scroll function you can call manually
  window.testScroll = function() {
    console.log('🧪 Testing scroll...');
    const beforeY = window.scrollY;
    window.scrollBy(0, 10);
    
    setTimeout(function() {
      const afterY = window.scrollY;
      if (beforeY === afterY) {
        console.log('❌ SCROLL IS LOCKED! scrollY did not change');
      } else {
        console.log('✅ SCROLL IS WORKING! scrollY changed from', beforeY, 'to', afterY);
      }
    }, 100);
  };
  
  // Log touch-action CSS on canvases
  setTimeout(function() {
    const canvases = document.querySelectorAll('canvas');
    console.log('🎨 Found ' + canvases.length + ' canvas elements');
    
    canvases.forEach(function(canvas, i) {
      const style = window.getComputedStyle(canvas);
      console.log('Canvas #' + i + ':', {
        id: canvas.id || 'no-id',
        touchAction: style.touchAction,
        pointerEvents: style.pointerEvents,
        width: canvas.width,
        height: canvas.height
      });
    });
  }, 1000);
  
  console.log('✅ Touch Debug Monitor Active');
  console.log('💡 You can call testScroll() in console to check if scrolling works');
})();