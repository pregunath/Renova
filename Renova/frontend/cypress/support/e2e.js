// cypress/support/e2e.js
import './commands';
import 'cypress-real-events/support';

beforeEach(() => {
  // Handle uncaught exceptions
  Cypress.on('uncaught:exception', (err, runnable) => {
    console.error('Uncaught exception:', err);
    return false;
  });

  // Clear auth state
  cy.window().then((win) => {
    win.localStorage.clear();
  });
});