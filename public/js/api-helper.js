// api-helper.js
// Adds auth token and store header to every API request automatically

function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const store = localStorage.getItem('selectedStore') || 'long_beach';

  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${token}`;
  options.headers['x-store'] = store;

  return fetch(url, options);
}