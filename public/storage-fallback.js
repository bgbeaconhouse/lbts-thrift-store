// storage-fallback.js
// Cookie-based storage fallback for when localStorage is blocked

(function() {
  'use strict';

  const cookieStorage = {
    setItem: function(key, value) {
      // Set cookie that expires in 1 year
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Strict`;
    },
    
    getItem: function(key) {
      const name = key + "=";
      const cookies = document.cookie.split(';');
      for(let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(name) === 0) {
          return decodeURIComponent(cookie.substring(name.length));
        }
      }
      return null;
    },
    
    removeItem: function(key) {
      document.cookie = `${key}=; path=/; max-age=0`;
    },
    
    clear: function() {
      const cookies = document.cookie.split(';');
      for(let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        const key = cookie.split('=')[0];
        this.removeItem(key);
      }
    }
  };

  // Test if localStorage works
  let localStorageWorks = false;
  try {
    localStorage.setItem('__test__', 'test');
    localStorage.removeItem('__test__');
    localStorageWorks = true;
  } catch(e) {
    console.warn('localStorage blocked, using cookie fallback');
  }

  // Override localStorage with cookie fallback if needed
  if (!localStorageWorks) {
    window.localStorage = cookieStorage;
    console.log('✓ Cookie-based storage fallback activated');
  }
})();