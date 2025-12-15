// touch-debug-visual.js
// Visual touch event debugging that displays directly on the page
// No console needed - you can see everything on screen!

(function() {
  'use strict';
  
  // Create debug overlay
  const debugOverlay = document.createElement('div');
  debugOverlay.id = 'touchDebugOverlay';
  debugOverlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 350px;
    max-height: 80vh;
    background: rgba(0, 0, 0, 0.95);
    color: #00ff00;
    font-family: monospace;
    font-size: 11px;
    padding: 10px;
    border-radius: 8px;
    z-index: 999999;
    overflow-y: auto;
    border: 2px solid #00ff00;
    box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
  `;
  
  const debugTitle = document.createElement('div');
  debugTitle.style.cssText = `
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #00ff00;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  debugTitle.innerHTML = '🔍 TOUCH DEBUG <span style="font-size: 10px; opacity: 0.7;">tap to minimize</span>';
  
  const debugContent = document.createElement('div');
  debugContent.id = 'debugContent';
  debugContent.style.cssText = 'line-height: 1.4;';
  
  debugOverlay.appendChild(debugTitle);
  debugOverlay.appendChild(debugContent);
  
  // Add to page when DOM ready
  function addOverlay() {
    if (document.body) {
      document.body.appendChild(debugOverlay);
    } else {
      setTimeout(addOverlay, 100);
    }
  }
  addOverlay();
  
  // Toggle minimize on title click
  let minimized = false;
  debugTitle.addEventListener('click', function() {
    minimized = !minimized;
    debugContent.style.display = minimized ? 'none' : 'block';
    debugTitle.querySelector('span').textContent = minimized ? 'tap to expand' : 'tap to minimize';
  });
  
  // Log function
  let logLines = [];
  const maxLines = 50;
  
  function log(message, color) {
    const timestamp = new Date().toLocaleTimeString();
    const line = `<div style="color: ${color || '#00ff00'}; margin: 2px 0;">[${timestamp}] ${message}</div>`;
    
    logLines.push(line);
    if (logLines.length > maxLines) {
      logLines.shift();
    }
    
    debugContent.innerHTML = logLines.join('');
    debugContent.scrollTop = debugContent.scrollHeight;
  }
  
  log('Touch Debug Monitor Started', '#ffff00');
  
  // Track touch state
  let touchStartTime = null;
  let touchMoveCount = 0;
  let lastScrollY = window.scrollY;
  let scrollLocked = false;
  
  // Monitor touch events
  document.addEventListener('touchstart', function(e) {
    touchStartTime = Date.now();
    touchMoveCount = 0;
    
    const target = e.target.tagName + (e.target.id ? '#' + e.target.id : '');
    log('📍 START: ' + target + ' (touches: ' + e.touches.length + ')', '#00ffff');
    
    if (e.target.tagName === 'CANVAS') {
      log('⚠️ CANVAS TOUCHED!', '#ff00ff');
    }
  }, true);
  
  document.addEventListener('touchmove', function(e) {
    touchMoveCount++;
    
    if (touchMoveCount === 1 || touchMoveCount % 20 === 0) {
      const prevented = e.defaultPrevented ? 'PREVENTED' : 'allowed';
      log('👆 MOVE #' + touchMoveCount + ' (' + prevented + ')', 
          e.defaultPrevented ? '#ff6600' : '#00ff00');
    }
  }, true);
  
  document.addEventListener('touchend', function(e) {
    const duration = touchStartTime ? Date.now() - touchStartTime : 0;
    const target = e.target.tagName + (e.target.id ? '#' + e.target.id : '');
    
    log('✋ END: ' + target + ' (' + duration + 'ms, ' + touchMoveCount + ' moves)', '#00ffff');
    
    touchStartTime = null;
    touchMoveCount = 0;
    
    // Test if scrolling still works after 500ms
    setTimeout(testScrolling, 500);
  }, true);
  
  document.addEventListener('touchcancel', function(e) {
    log('❌ TOUCHCANCEL!', '#ff0000');
    touchStartTime = null;
    touchMoveCount = 0;
  }, true);
  
  // Monitor scroll
  let lastScrollTime = Date.now();
  
  window.addEventListener('scroll', function() {
    const scrollY = window.scrollY;
    
    if (scrollY !== lastScrollY) {
      lastScrollTime = Date.now();
      
      if (scrollLocked) {
        log('✅ SCROLL RESTORED!', '#00ff00');
        scrollLocked = false;
      }
      
      lastScrollY = scrollY;
    }
  }, true);
  
  // Test if scrolling works
  function testScrolling() {
    const timeSinceScroll = Date.now() - lastScrollTime;
    
    if (timeSinceScroll > 3000 && touchStartTime === null) {
      if (!scrollLocked) {
        log('🚨 SCROLL LOCKED DETECTED!', '#ff0000');
        scrollLocked = true;
        
        // Try to scroll programmatically
        const beforeY = window.scrollY;
        window.scrollBy(0, 1);
        
        setTimeout(function() {
          const afterY = window.scrollY;
          if (beforeY === afterY && beforeY > 0) {
            log('🚨 CONFIRMED: Scroll is broken!', '#ff0000');
          }
        }, 100);
      }
    }
  }
  
  // Check scroll status every 2 seconds
  setInterval(testScrolling, 2000);
  
  // Log canvas info after page loads
  setTimeout(function() {
    const canvases = document.querySelectorAll('canvas');
    log('🎨 Found ' + canvases.length + ' canvas elements', '#ffff00');
    
    canvases.forEach(function(canvas, i) {
      const id = canvas.id || 'no-id';
      const style = window.getComputedStyle(canvas);
      log('Canvas #' + i + ': ' + id + ' (touch-action: ' + style.touchAction + ')', '#ffff00');
    });
  }, 1000);
  
  log('✅ Monitoring active - interact with page', '#00ff00');
  
  // Add test button
  const testBtn = document.createElement('button');
  testBtn.textContent = 'Test Scroll';
  testBtn.style.cssText = `
    margin-top: 10px;
    padding: 8px 12px;
    background: #00ff00;
    color: #000;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    width: 100%;
  `;
  testBtn.addEventListener('click', function() {
    log('🧪 Manual scroll test...', '#ffff00');
    const beforeY = window.scrollY;
    window.scrollBy(0, 10);
    
    setTimeout(function() {
      const afterY = window.scrollY;
      if (beforeY === afterY) {
        log('❌ Scroll test FAILED - locked!', '#ff0000');
      } else {
        log('✅ Scroll test PASSED - working!', '#00ff00');
      }
    }, 100);
  });
  
  debugOverlay.appendChild(testBtn);
  
  // Add clear button
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Log';
  clearBtn.style.cssText = testBtn.style.cssText;
  clearBtn.style.marginTop = '5px';
  clearBtn.addEventListener('click', function() {
    logLines = [];
    debugContent.innerHTML = '';
    log('Log cleared', '#ffff00');
  });
  
  debugOverlay.appendChild(clearBtn);
  
})();