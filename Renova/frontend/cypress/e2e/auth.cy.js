// cypress/e2e/auth.cy.js
describe('Authentication Flow', () => {
  // Valid JWT format to prevent instant "access expired" auto-redirections in _isExpired helper
  // Payload: {"exp": 9999999999, "role": "USER", "sub": "test@example.com"}
  const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTksInJvbGUiOiJVU0VSIiwic3ViIjoidGVzdEBleGFtcGxlLmNvbSJ9.mock-signature';

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    // Start from the auth page before each test
    cy.visit('/auth?mode=login');
  });

  it('should successfully complete user login', () => {
    // Mock the API response
    cy.intercept('POST', 'http://localhost:8080/api/auth/login', {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        accessToken: mockJwt,
        refreshToken: mockJwt
      }
    }).as('loginRequest');

    // Mock refresh token request to prevent auto-logout due to invalid/expired mock token
    cy.intercept('POST', 'http://localhost:8080/api/auth/refresh', {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        accessToken: mockJwt
      }
    }).as('refreshRequest');

    cy.intercept('GET', 'http://localhost:8080/api/user/me', {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        email: 'test@example.com',
        name: 'Test User'
      }
    }).as('getUser');

    // Fill out login form
    cy.get('input[id="email"]').type('test@example.com');
    cy.get('input[id="password"]').type('securePassword123');
    
    // Submit form
    cy.get('button[type="submit"]').click();

    // Wait for API calls
    cy.wait('@loginRequest');
    // Refresh might happen, we don't strictly need to wait for it, but it shouldn't fail
    
    // Increase timeout for getUser as it might take a moment after login
    cy.wait('@getUser', { timeout: 10000 });

    // Verify successful login and redirect
    cy.url().should('include', '/dashboard/moodboards');
    // Token might be the original or refreshed one
    cy.window().its('localStorage').invoke('getItem', 'accessToken').should('exist');
  });

  it('should show error for invalid login credentials', () => {
    cy.intercept('POST', 'http://localhost:8080/api/auth/login', {
      statusCode: 401,
      headers: { 'content-type': 'application/json' },
      body: { message: 'Invalid credentials' }
    }).as('loginRequest');

    cy.get('input[id="email"]').type('wrong@example.com');
    cy.get('input[id="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest');

    // Verify error message
    cy.get('.error-message').should('be.visible').and('contain.text', 'Invalid credentials');
  });

  it('should switch to signup mode', () => {
    // Use a more specific selector or force click if multiple exist
    cy.get('.auth-toggle a[href="/auth?mode=signup"]').click();
    cy.url().should('include', 'mode=signup');
  });
});