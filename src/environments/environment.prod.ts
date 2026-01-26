export const environment = {
  production: true,
  apiUrl: '/api', // Use relative path - Nginx will proxy to backend
  socketUrl: '' // Empty string uses current origin for production
};
