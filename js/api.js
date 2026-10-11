/**
 * API Configuration & Client Helper
 * University Maintenance & Complaint Management System
 * Prepared for Phase 3 API Integration
 */

const API_BASE_URL = 'http://localhost:5000/api';

// Auth Token Management
function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function removeToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// User Profile Management
function getStoredUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function setStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// Check if user is logged in
function isAuthenticated() {
  return !!getToken();
}
