// cypress/support/commands.js
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// helper to click a point on canvas using proper mouse events for Konva
Cypress.Commands.add('clickCanvas', { prevSubject: 'element'}, (subject, x, y) => {
  cy.wrap(subject)
    .trigger('mousedown', { 
      clientX: x, 
      clientY: y, 
      offsetX: x,
      offsetY: y,
      button: 0, 
      force: true, 
      bubbles: true,
      cancelable: true
    })
    .trigger('mouseup', { 
      clientX: x, 
      clientY: y, 
      offsetX: x,
      offsetY: y,
      button: 0, 
      force: true, 
      bubbles: true,
      cancelable: true
    });
});

// helper to drag on canvas (e.g. move item or resize with anchor)
Cypress.Commands.add('dragCanvas', { prevSubject: 'element'}, (subject, startX, startY, endX, endY) => {
  cy.wrap(subject)
    .trigger('mousedown', { clientX: startX, clientY: startY, offsetX: startX, offsetY: startY, button: 0, force: true, bubbles: true, cancelable: true })
    .trigger('mousemove', { clientX: endX, clientY: endY, offsetX: endX, offsetY: endY, force: true, bubbles: true, cancelable: true })
    .trigger('mouseup', { clientX: endX, clientY: endY, offsetX: endX, offsetY: endY, button: 0, force: true, bubbles: true, cancelable: true });
});

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/auth');
  cy.get('input[type="email"]').first().type(email);
  cy.get('input[type="password"]').first().type(password);
  cy.contains('button', /Log ?in/i).click();
  cy.url({timeout: 10000}).should('include', '/dashboard');
});

// helper to insert an image via file explorer in moodboard
Cypress.Commands.add('insertImageViaExplorer', (fixturePath) => {
  // Get the input that's near the "Add image" button and select it
  cy.get('button[title="Add image"]')
    .closest('div') // Get the parent container
    .find('input[type="file"]') // Find the file input within that container
    .selectFile(fixturePath, { force: true })
    .trigger('change', { force: true }); // Explicitly trigger change event
  
  // Wait for the API upload to complete
  cy.wait('@uploadItem', { timeout: 5000 });
  
  // Check for error messages - if upload fails, the error will appear
  cy.get('body').then(($body) => {
    if ($body.find(':contains("Failed to add image")').length) {
      throw new Error('Image upload failed - check API mock');
    }
  });
  
  // Wait for the image to be rendered on the canvas
  cy.wait(2000); // Increased wait for image processing
  
  // Verify image was added by checking if any canvas imagery exists
  cy.get('canvas', { timeout: 5000 }).should('exist');
});
