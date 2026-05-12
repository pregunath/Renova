describe('Moodboard Editor Journeys', () => {
  // Generate a mock JWT that won't instantly expire
  // Payload: {"exp": 9999999999, "role": "USER", "sub": "test@example.com"}
  const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTksInJvbGUiOiJVU0VSIiwic3ViIjoidGVzdEBleGFtcGxlLmNvbSJ9.mock-signature';

  beforeEach(() => {
    // Set a known viewport for stable canvas coordinates
    cy.viewport(1280, 720);
    
    // Mock APIs to ensure isolation
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { accessToken: mockJwt, refreshToken: mockJwt }
    }).as('loginRequest');

    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: { accessToken: mockJwt, refreshToken: mockJwt }
    }).as('refreshRequest');

    cy.intercept('GET', '**/api/user/me', {
      statusCode: 200,
      body: { email: 'test@example.com', name: 'Test User' }
    }).as('getUser');

    cy.intercept('GET', '**/api/plans/usage', {
      statusCode: 200,
      body: { usage: { moodboardsUsed: 0, moodboardsLimit: 10 } }
    }).as('getUsage');

    cy.intercept('GET', '**/api/moodboard', {
      statusCode: 200,
      body: []
    }).as('getBoards');

    // Mocks for creating and fetching a board
    cy.intercept('POST', '**/api/moodboard', {
      statusCode: 201,
      body: { id: 'mock-board-id', elements: [] }
    }).as('createBoard');

    cy.intercept('POST', '**/api/moodboard/*/items', {
      statusCode: 200,
      body: { src: 'mock-uploaded-image.png' }
    }).as('uploadImage');

    // Mock image load so the canvas promise resolves immediately
    cy.intercept('GET', '**/mock-uploaded-image.png*', {
      fixture: 'test-image.jpg'
    }).as('imageLoad');

    cy.intercept('PATCH', '**/api/moodboard/mock-board-id', {
      statusCode: 200,
      body: { id: 'mock-board-id', elements: [] }
    }).as('updateBoard');

    cy.intercept('GET', '**/api/moodboard/mock-board-id', {
      statusCode: 200,
      body: { id: 'mock-board-id', elements: [], background: "#ffffff", title: "Test Board" }
    }).as('getBoard');

    cy.visit('/auth?mode=login');
    cy.get('input[id="email"]').type('test@example.com');
    cy.get('input[id="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    cy.wait('@loginRequest');
    
    // Check if we reached dashboard and wait for network
    cy.location('pathname', { timeout: 10000 }).should('include', '/dashboard');
  });

  it('Journey 1: Create, Update Properties, Shadow, Mirror, Delete, Save, Reload', () => {
    // 1. Create New Moodboard
    cy.contains(/Create New/i).click({ force: true });
    cy.get('canvas', { timeout: 10000 }).should('be.visible');

    // Must save first to be able to upload images as per application logic
    cy.get('button[title="Save"]').click();
    cy.get('.ant-modal').should('be.visible');
    cy.get('.ant-modal').find('input').clear().type('My UI Test Board');
    cy.get('.ant-modal').contains('button', /Save/i).click();
    
    cy.contains('Moodboard saved.').should('be.visible');
    cy.url().should('include', '/mock-board-id');

    // 2. Uploading Image from file
    cy.get('input[type="file"]').first().selectFile('cypress/fixtures/test-image.jpg', { force: true });
    cy.wait(1000);

    const canvas = () => cy.get('canvas');

    // 3. Moving and Rotating Image
    // Assume it lands near the center, drag it slightly
    canvas().dragCanvas(450, 300, 400, 250);
    // Approximation for rotate handle drag
    canvas().dragCanvas(400, 200, 450, 200);

    // 4. Shadow Image
    cy.get('button[title="Shadow"], button[title="Add shadow"], button[aria-label="Shadow"]').should('exist').click({ force: true });

    // 5. Mirror Image
    cy.get('button[title="Mirror"], button[title="Flip"], button[aria-label*="Flip"]').should('exist').click({ force: true });

    // 6. Delete Image
    cy.get('button[title="Delete"], button[aria-label="Delete"]').should('exist').click({ force: true });

    // 7. Save Board
    cy.get('button[title="Save"]').click({ force: true });
    cy.get('.ant-modal').contains('button', /Save/i).click();

    // 8. Reload and Verify
    cy.reload();
    cy.get('canvas').should('be.visible');
  });

  it('Journey 2: Image Cropping Test', () => {
    // Navigate directly to existing board to simulate "Open Existing"
    cy.visit('/dashboard/moodboards/mock-board-id');
    cy.get('canvas', { timeout: 10000 }).should('be.visible');

    // 1. Uploading Image
    cy.get('input[type="file"]').first().selectFile('cypress/fixtures/test-image.jpg', { force: true });
    cy.wait(1000);

    const canvas = () => cy.get('canvas');
    canvas().clickCanvas(450, 300);

    // 2. Select Crop
    cy.get('button[title="Crop"], button[title="Edit crop"], button[aria-label*="Crop"]').should('exist').click({ force: true });

    // 3. Select Portion of Image
    canvas().dragCanvas(400, 250, 420, 270);

    // 4. Accept Crop
    // Crop implementation captures the enter key on the window event listener to apply
    cy.window().trigger('keydown', { key: 'Enter' });

    // 5. Save Board
    cy.get('button[title="Save"]').click({ force: true });
    cy.get('.ant-modal').contains('button', /Save/i).click();

    // 6. Reload and Verify
    cy.reload();
    cy.get('canvas').should('be.visible');
  });

  it('Journey 3: Pinterest Image Adding Test', () => {
    cy.visit('/dashboard/moodboards/mock-board-id');
    cy.get('canvas', { timeout: 10000 }).should('be.visible');
    
    // 1. Open Pinterest View
    cy.get('nav[role="tablist"]').contains('button', /Pinterest/i).should('exist').click({ force: true });

    // 2. Verify Pinterest Connection/UI Opens
    cy.get('[class*="pinterest"], [data-testid*="pinterest"]').should('be.visible');

    // 3. Save Board
    cy.get('button[title="Save"]').click({ force: true });
    cy.get('.ant-modal').contains('button', /Save/i).click();

    // 4. Reload and Verify
    cy.reload();
    cy.get('canvas').should('be.visible');
  });

  //WIP Journey 4: Text, Drawing, and Background Selection
  it('Journey 4: Text, Drawing, and Background Selection', () => {
    cy.visit('/dashboard/moodboards/mock-board-id');
    cy.get('canvas', { timeout: 10000 }).should('be.visible');

    const canvas = () => cy.get('canvas');

    // 1. Add Text
    cy.get('button[title="Add text"], button[aria-label*="text"]').should('exist').click({ force: true });
    // Text spawns near the center (e.g. 450, 300). Drag it slightly.
    canvas().dragCanvas(450, 300, 450, 200);

    // 2. Add Drawing (Pen mode)
    cy.get('button[title="Add drawing"], button[aria-label*="drawing"]').should('exist').click({ force: true });
    // Draw a stroke by dragging repeatedly (dragCanvas does a pointerdown, move, up)
    canvas().dragCanvas(200, 200, 250, 250);

    // 3. Change Board Background
    cy.get('button[title="Background"], button[aria-label*="Background"]').should('exist').click({ force: true });
    // Pick a color or toggle check
    cy.get('input[type="color"]').should('exist');
    cy.contains('button', /Done/i).click({ force: true });

    // 4. Save Board
    cy.get('button[title="Save"]').click({ force: true });
    cy.get('.ant-modal').contains('button', /Save/i).click();

    // 5. Reload and Verify
    cy.reload();
    cy.get('canvas').should('be.visible');
  });

});


