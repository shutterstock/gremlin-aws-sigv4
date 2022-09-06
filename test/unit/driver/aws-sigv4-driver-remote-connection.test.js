/* eslint-disable-line no-new */
const gremlin = require('gremlin');
const utils = require('../../../lib/utils');
const AwsSigV4DriverRemoteConnection = require('../../../lib/driver/aws-sigv4-driver-remote-connection');

jest.mock('gremlin');
jest.mock('../../../lib/utils', () => ({
  ...jest.requireActual('../../../lib/utils'),
  request: jest.fn(),
}));

const HOST = 'aws.dev.gremlin';
const PORT = 8182;
const OPTS = {
  accessKey: 'MY_ACCESS_KEY',
  secretKey: 'MY_SECRET_KEY',
  region: 'MY_REGION',
};

describe('AwsSigV4DriverRemoteConnection', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    gremlin.driver.Client.mockImplementation((url) => ({
      _connection: {
        url,
        on: jest.fn(),
        _ws: {
          on: jest.fn((event, cb) => { if (event === 'open') { cb(); } }),
        },
      },
      open: jest.fn(),
      submit: jest.fn(() => Promise.resolve({ toArray: jest.fn() })),
      close: jest.fn(),
    }));
  });

  describe('constructor', () => {
    it('should throw an error when AWS credentials are not provided', () => {
      expect(() => {
        new AwsSigV4DriverRemoteConnection(HOST, PORT); // eslint-disable-line no-new
      }).toThrow();
    });

    it('should accept options', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      expect(connection.options).toEqual(OPTS);
    });
  });

  describe('_connect', () => {
    it('should make a get request to the /status endpoint and connect the socket if successful', () => {
      utils.request.mockImplementation((url, options, cb) => { cb(null, { statusCode: 200 }, 'hello world'); });
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      expect(connection).toHaveProperty('_client');
    });

    it('should make a get request to the /status endpoint using secure HTTPS if secure is set', () => {
      utils.request.mockImplementation((url, options, cb) => { cb(null, { statusCode: 200 }, 'hello world'); });
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, { ...OPTS, secure: true });
      expect(connection).toHaveProperty('_client');
    });

    it('should make a get request to the /status endpoint and throw an error if not sucessful', () => {
      utils.request.mockImplementation((url, options, cb) => { cb(null, { statusCode: 403 }, 'hello world'); });
      expect(() => new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS)).toThrow();
    });
  });

  describe('_connectSocket', () => {
    it('should open socket connection', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._connectSocket();
    });

    it('should specify the default /gremlin endpoint for the connection', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._connectSocket();
      expect(connection._client._connection.url).toEqual(`ws://${HOST}:${PORT}/gremlin`);
    });

    it('should use the secure WSS protocol for the connection when the secure option is specified', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, { ...OPTS, secure: true });
      connection._connectSocket();
      expect(connection._client._connection.url).toEqual(`wss://${HOST}:${PORT}/gremlin`);
    });
  });

  describe('_statusCallback', () => {
    it('should handle error', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._statusCallback({}, null, null);
    });

    it('should handle HTTP-200 response', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._statusCallback(null, { statusCode: 200 }, { status: 'healthy' });
    });

    it('should handle non HTTP-200 response', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      expect(() => {
        connection._statusCallback(null, { statusCode: 500 }, null);
      }).toThrow();
    });

    it('should handle empty error and response', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      expect(() => {
        connection._statusCallback(null, null, null);
      }).toThrow();
    });
  });

  describe('_logHandler', () => {
    it('should handle log event', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._logHandler();
    });
  });

  describe('_connectHandle', () => {
    it('should handle connect event', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._client = { _connection: { isOpen: false } };
      connection._connectHandler();
    });

    it('should call the connection callback function', () => {
      const cb = jest.fn();
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS, cb);
      connection._client = { _connection: { isOpen: false } };
      connection._connectHandler();
      expect(cb).toHaveBeenCalled();
    });

    it('should reinitialize the try count', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection.try = 100;
      connection._client = { _connection: { isOpen: true } };
      connection._connectHandler();
      expect(connection.try).toEqual(0);
    });
  });

  describe('_closeHandler', () => {
    it('should handle close event', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._closeHandler();
    });

    it('should call the close connection callback function', () => {
      const cb = jest.fn();
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS, null, cb);
      connection._closeHandler();
      expect(cb).toHaveBeenCalled();
    });

    it('should reinitialize the connection', () => {
      const opts = Object.assign(OPTS, { autoReconnect: true, maxRetry: 10 });
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, opts);
      connection._closeHandler();
    });
  });

  describe('_errorHandler', () => {
    it('should handle error event', () => {
      const opts = Object.assign(OPTS, { autoReconnect: false });
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, opts);
      connection._errorHandler();
    });

    it('should call the error callback function', () => {
      const cb = jest.fn();
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS, null, null, cb);
      connection._errorHandler();
      expect(cb).toHaveBeenCalled();
    });

    it('should reinitialize the connection', () => {
      const opts = Object.assign(OPTS, { autoReconnect: true, maxRetry: 10 });
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, opts);
      connection._errorHandler();
    });

    it('should throw the error', () => {
      const opts = Object.assign(OPTS, { autoReconnect: false });
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, opts);
      expect(() => {
        connection._errorHandler(new Error());
      }).toThrow();
    });
  });

  describe('_cancelPendingQueries', () => {
    it('should call all reject functions', () => {
      const rejections = { a: jest.fn(), b: jest.fn() };
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      connection._rejections = rejections;
      connection._cancelPendingQueries();
      expect(rejections.a).toHaveBeenCalled();
      expect(rejections.b).toHaveBeenCalled();
    });
  });

  describe('open', () => {
    it('should open the client connection', (done) => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, { ...OPTS, openOnStartup: false }, () => { expect(1).toEqual(1); done(); });
      connection.open();
    });
  });

  describe('submit', () => {
    it('should submit the query', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      const submit = jest.fn(() => Promise.resolve(new gremlin.driver.ResultSet([], null)));
      connection._client = { submit };
      connection.submit(null);
    });

    it('should reopen the connection and submit the query  if autoReconnect is true', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, { ...OPTS, autoReconnect: true });
      connection._client = null;
      connection.submit(null);
    });

    it('should fail if autoReconnect is false', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, { ...OPTS, autoReconnect: false });
      connection._client = null;
      connection.submit(null).catch((error) => {
        expect(error.toString()).toContain('Disconnected from database');
      });
    });
  });

  describe('close', () => {
    it('should close the client connection', () => {
      const connection = new AwsSigV4DriverRemoteConnection(HOST, PORT, OPTS);
      const close = jest.fn();
      connection._client = { close };
      connection.options.autoReconnect = true;
      connection.close();
      expect(close).toHaveBeenCalled();
      expect(connection.options.autoReconnect).toEqual(false);
    });
  });
});
