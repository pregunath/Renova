const errorHandler = require('../../../middleware/error');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should respond with the error status and message', () => {
    const err = { status: 400, message: 'Bad Request' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Bad Request' });
  });

  it('should default to status 500 when err.status is missing', () => {
    const err = { message: 'something broke' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should default to "Internal Server Error" when err.message is missing', () => {
    const err = { status: 500 };

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('should fall back to 500 and generic message for an empty error object', () => {
    errorHandler({}, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('should work with a native Error instance', () => {
    const err = new Error('native error');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'native error' });
  });

  it('should use err.status from a native Error with a status property', () => {
    const err = Object.assign(new Error('not found'), { status: 404 });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'not found' });
  });

  it('should handle common HTTP error codes', () => {
    const cases = [
      { status: 401, message: 'Unauthorized' },
      { status: 403, message: 'Forbidden' },
      { status: 404, message: 'Not Found' },
      { status: 422, message: 'Unprocessable Entity' },
    ];

    for (const err of cases) {
      jest.clearAllMocks();
      errorHandler(err, req, res, next);
      expect(res.status).toHaveBeenCalledWith(err.status);
      expect(res.json).toHaveBeenCalledWith({ message: err.message });
    }
  });

  it('should not call next', () => {
    errorHandler({ status: 500, message: 'oops' }, req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});
