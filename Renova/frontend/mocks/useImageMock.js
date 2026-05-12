// mocks/useImageMock.js
// Stubs use-image so image loading never hits real network in tests.
// Returns [null, 'loaded'] so components that check status see a resolved state.
module.exports = () => [null, 'loaded'];
