/**
 * Fully Kiosk Touch Event Cleanup
 * Prevents stuck touch events that break scrolling
 */

(function() {
    'use strict';

    console.log('🔧 Fully Kiosk Touch Fix Loaded');

    let activeTouches = new Set();
    let lastTouchStart = 0;
    const STUCK_TOUCH_TIMEOUT = 5000; // 5 seconds

    // Track all active touches
    document.addEventListener('touchstart', (e) => {
        lastTouchStart = Date.now();
        for (let touch of e.touches) {
            activeTouches.add(touch.identifier);
        }
    }, { capture: true, passive: true });

    document.addEventListener('touchend', (e) => {
        for (let touch of e.changedTouches) {
            activeTouches.delete(touch.identifier);
        }
    }, { capture: true, passive: true });

    document.addEventListener('touchcancel', (e) => {
        for (let touch of e.changedTouches) {
            activeTouches.delete(touch.identifier);
        }
        console.warn('⚠️ Touch cancelled, cleared touches');
    }, { capture: true, passive: true });

    // Force cleanup on visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (activeTouches.size > 0) {
                console.warn('⚠️ Page hidden with active touches, force clearing');
                activeTouches.clear();
            }
        }
    });

    // Force cleanup on window blur
    window.addEventListener('blur', () => {
        if (activeTouches.size > 0) {
            console.warn('⚠️ Window blur with active touches, force clearing');
            activeTouches.clear();
        }
    });

    // Emergency cleanup: check for stuck touches periodically
    setInterval(() => {
        const now = Date.now();
        const timeSinceLastTouch = now - lastTouchStart;

        // If we have "active" touches but haven't seen touch activity in 5 seconds
        if (activeTouches.size > 0 && timeSinceLastTouch > STUCK_TOUCH_TIMEOUT) {
            console.error('🚨 STUCK TOUCH DETECTED! Force clearing...');
            
            // Force dispatch touchend for all active touches
            try {
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

            activeTouches.clear();
            
            // Try to restore scroll ability
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.touchAction = '';
            
            console.log('✅ Touch state cleared, scroll should work now');
        }
    }, 2000); // Check every 2 seconds

    // Fully Kiosk specific: force scroll re-enable
    if (window.fully) {
        setInterval(() => {
            // Re-enable scroll in case Fully locked it
            if (typeof fully.setKioskEnabled === 'function') {
                // No-op to refresh Fully's internal state
                fully.getKioskEnabled();
            }
        }, 10000); // Every 10 seconds
    }

    // Additional safety: detect when scrolling stops working
    let lastScrollY = window.scrollY;
    let scrollAttempts = 0;
    let scrollBroken = false;

    window.addEventListener('scroll', () => {
        lastScrollY = window.scrollY;
        scrollAttempts = 0;
        scrollBroken = false;
    });

    document.addEventListener('touchmove', () => {
        scrollAttempts++;
        
        // If we've had 10+ touchmove events without scroll changing
        if (scrollAttempts > 10 && window.scrollY === lastScrollY && !scrollBroken) {
            console.error('🚨 SCROLL APPEARS BROKEN! Attempting recovery...');
            scrollBroken = true;
            
            // Force clear all touches
            activeTouches.clear();
            
            // Reset scroll/touch properties
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.touchAction = 'auto';
            document.documentElement.style.touchAction = 'auto';
            
            // Force a synthetic touchend
            try {
                document.body.dispatchEvent(new TouchEvent('touchend', {
                    bubbles: true,
                    cancelable: true
                }));
            } catch (err) {
                console.error('Recovery error:', err);
            }
        }
    }, { passive: true });

    console.log('✅ Touch fix initialized - monitoring for stuck touches');
})();