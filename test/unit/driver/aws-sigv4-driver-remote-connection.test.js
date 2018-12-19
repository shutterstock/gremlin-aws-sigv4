/* eslint no-underscore-dangle: 0 */
const EventEmitter = require('events');
const AwsSigV4DriverRemoteConnection = require('../../../lib/driver/aws-sigv4-driver-remote-connection');

jest.mock('websocket', () => ({
  client: jest.fn().mockImplementation(() => ({
    connect: function connect() {
      this.topics.connect({
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
      });
    },
    topics: {},
    on: function on(topic, callback) {
      this.topics[topic] = callback;
    },
  })),
}));

describe('AwsSigV4DriverRemoteConnection', () => {
  describe('constructor', () => {
    it('should accept options', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.traversalSource).toEqual('g');
      expect(connection.isOpen).toEqual(true);
    });

    it('should accept traversalSource', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        traversalSource: 'o',
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.traversalSource).toEqual('o');
    });

    it('should require host and port', () => {
      expect(() => {
        const connection = new AwsSigV4DriverRemoteConnection();
        expect(connection).toEqual(undefined);
      }).toThrow('Host and port are required');
    });

    it('should require access key and secret', () => {
      expect(() => {
        const connection = new AwsSigV4DriverRemoteConnection('host', 1337);
        expect(connection).toEqual(undefined);
      }).toThrow('Access key and secret key are required');
    });

    it('should resolve the open promise if exist on connection', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      connection._openCallback = jest.fn();
      connection._connected(connection._socket);
      expect(connection._openCallback).toHaveBeenCalled();
    });
  });

  describe('open', () => {
    let connection;
    const host = 'local.host';
    const port = 1337;
    const opts = {
      accessKey: 'MY_ACCESS_KEY',
      secretKey: 'MY_SECRET_KEY',
      region: 'MY_REGION',
    };

    beforeEach(() => {
      connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
    });

    it('should expect socket was opened in the constructor', () => connection.open()
      .then((result) => {
        expect(result).toEqual(undefined);
      }));

    it('should not re-open if alredy open', () => {
      connection.isOpen = false;

      setTimeout(() => {
        connection._openCallback();
      }, 100);

      return connection.open()
        .then(() => connection.open())
        .then((result) => {
          expect(result).toEqual(undefined);
        });
    });

    it('should reject when error on connection', () => {
      connection.isOpen = false;
      const error = new Error('_openCallback error');

      setTimeout(() => {
        connection._openCallback(error);
      }, 100);

      return connection.open()
        .catch((ex) => {
          expect(ex).toEqual(error);
        });
    });
  });

  describe('submit', () => {
    let connection;
    const host = 'local.host';
    const port = 1337;
    const opts = {
      accessKey: 'MY_ACCESS_KEY',
      secretKey: 'MY_SECRET_KEY',
      region: 'MY_REGION',
    };

    beforeEach(() => {
      connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
    });

    it('should submit', () => {
      // simulate request is called back
      setTimeout(() => {
        const requests = Object.keys(connection._responseHandlers);
        expect(requests.length).toEqual(1);
        Object.keys(connection._responseHandlers).forEach((id) => {
          connection._responseHandlers[id].callback(null, 'stuff');
        });
      }, 200);
      const bytecode = 'placeholder';

      return connection.submit(bytecode)
        .then((result) => {
          expect(result).toEqual('stuff');
          expect(connection._socket.send).toHaveBeenCalled();
        });
    });
  });

  describe('_handleMessage', () => {
    let connection;
    const host = 'local.host';
    const port = 1337;
    const opts = {
      accessKey: 'MY_ACCESS_KEY',
      secretKey: 'MY_SECRET_KEY',
      region: 'MY_REGION',
    };

    beforeEach(() => {
      connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
    });

    it('should handle data with undefined request id', () => {
      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            foo: 'bar',
          }),
        },
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual(undefined);
    });

    it('should handle serialization issues', () => {
      connection._responseHandlers.abc = {
        callback: () => 'anything',
        result: ['here'],
      };

      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            foo: 'bar',
            status: {
              code: 500,
              message: 'Something happened',
            },
          }),
        },
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual(undefined);
    });

    it('should handle serialization issues', () => {
      connection._responseHandlers.abc = {
        callback: () => 'anything',
        result: ['here'],
      };

      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            foo: 'bar',
          }),
        },
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual(undefined);
    });

    it('should handle if handlers are gone', () => {
      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            requestId: 'abc',
            status: {
              code: 200,
            },
            result: {
              data: 'stuff',
            },
          }),
        },
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual(undefined);
      expect(connection._responseHandlers.abc).toEqual(undefined);
    });

    it('should handle success', () => {
      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            requestId: 'abc',
            status: {
              code: 200,
            },
            result: {
              data: 'stuff',
            },
          }),
        },
      };
      connection._responseHandlers.abc = {
        callback: () => 'full',
        result: [],
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual('full');
      expect(connection._responseHandlers.abc).toEqual(undefined);
    });

    it('should defualt to success', () => {
      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            requestId: 'abc',
            status: {
              code: 302,
            },
            result: {
              data: 'stuff',
            },
          }),
        },
      };
      connection._responseHandlers.abc = {
        callback: () => 'full',
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual('full');
      expect(connection._responseHandlers.abc).toEqual(undefined);
    });

    it('should handle no content', () => {
      connection._responseHandlers.abc = {
        callback: () => 'pea',
        result: [],
      };

      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            requestId: 'abc',
            status: {
              code: 204,
            },
          }),
        },
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual('pea');
      expect(connection._responseHandlers.abc).toEqual(undefined);
    });

    it('should handle partial content', () => {
      connection._responseHandlers.abc = {
        callback: () => 'anything',
        result: ['here'],
      };

      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            requestId: 'abc',
            status: {
              code: 206,
            },
            result: {
              data: [1, 'foo', 'bar'],
            },
          }),
        },
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual(undefined);
      expect(connection._responseHandlers.abc).not.toEqual(undefined);
      expect(connection._responseHandlers.abc.result).toEqual(['here', 1, 'foo', 'bar']);
    });

    it('should handle partial content starting with empty result', () => {
      connection._responseHandlers.abc = {
        callback: () => 'anything',
      };

      const data = {
        binaryData: {
          toString: () => JSON.stringify({
            requestId: 'abc',
            status: {
              code: 206,
            },
            result: {
              data: [1, 'foo', 'bar'],
            },
          }),
        },
      };

      const result = connection._handleMessage(data);
      expect(result).toEqual(undefined);
      expect(connection._responseHandlers.abc).not.toEqual(undefined);
      expect(connection._responseHandlers.abc.result).toEqual([1, 'foo', 'bar']);
    });

    it('should handle errors', (done) => {
      const submitPromise = connection.submit('a');

      setTimeout(() => {
        const requests = Object.keys(connection._responseHandlers);
        const data = {
          binaryData: {
            toString: () => JSON.stringify({
              requestId: requests[0],
              status: {
                code: 400,
                message: 'Bad requestroo',
              },
              result: {
                // data: [1, 'foo', 'bar']
              },
            }),
          },
        };

        const result = connection._handleMessage(data);
        expect(result).toEqual(undefined);
        expect(connection._responseHandlers.abc).toEqual(undefined);

        submitPromise
          .then(() => {
            throw new Error('should not succeed');
          })
          .catch((err) => {
            expect(err.message).toEqual('Server error: Bad requestroo (400)');
            done();
          });
      });
    }, 100);
  });

  describe('close', () => {
    let connection;
    const host = 'local.host';
    const port = 1337;
    const opts = {
      accessKey: 'MY_ACCESS_KEY',
      secretKey: 'MY_SECRET_KEY',
      region: 'MY_REGION',
    };

    beforeEach(() => {
      connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
    });

    it('should close the socket', () => {
      connection.close();
      expect(connection._socket.close).toHaveBeenCalled();
      expect(connection.isOpen).toEqual(true);
    });

    it('should set open to false if there was no socket', () => {
      delete connection._socket;
      connection.close();
      expect(connection.isOpen).toEqual(false);
    });
  });

  describe('_disconnected', () => {
    it('should set the isOpen flag to false when disconnecting', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: true,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.isOpen).toEqual(true);
      connection._disconnected();
      expect(connection.isOpen).toEqual(false);
    });
  });

  describe('_connectionFailed', () => {
    it('should try to reconnect when autoReconnect is set to true', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: true,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.traversalSource).toEqual('g');
      expect(connection.try).toEqual(0);
      connection._connectionFailed(new Error());
      expect(connection.try).toEqual(1);
    });

    it('should not try to reconnect when autoReconnect is set to false', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: false,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      connection._openCallback = jest.fn();
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.traversalSource).toEqual('g');
      const error = new Error('_connectionFailed error');
      connection._connectionFailed(error);
      expect(connection._openCallback).toHaveBeenLastCalledWith(error);
    });

    it('should not try to reconnect when max connection retries is reached', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: true,
        maxRetry: -1,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      connection._openCallback = undefined;
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.traversalSource).toEqual('g');
      const error = new Error('_connectionFailed error');
      connection._connectionFailed(error);
    });

    it('should call callback function with error on socket connection failure', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: true,
        maxRetry: -1,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      connection._openCallback = jest.fn();
      const error = new Error('connectFailed event error');
      connection.client.topics.connectFailed(error);
      expect(connection._openCallback).toHaveBeenLastCalledWith(error);
    });
  });

  describe('_connectionError', () => {
    it('should try to reconnect when autoReconnect is set to true', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: true,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.traversalSource).toEqual('g');
      expect(connection.try).toEqual(0);
      connection._connectionError(new Error());
      expect(connection.try).toEqual(1);
    });

    it('should not try to reconnect when autoReconnect is set to false', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: false,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.traversalSource).toEqual('g');
      const error = new Error('_connectionError error');
      expect(() => { connection._connectionError(error); }).toThrow(error);
    });

    it('should not try to reconnect when max connection retries is reached', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        autoReconnect: true,
        maxRetry: -1,
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      expect(connection.url).toEqual(`ws://${host}:${port}/gremlin`);
      expect(connection.traversalSource).toEqual('g');
      const error = new Error('_connectionError error');
      expect(() => { connection._connectionError(error); }).toThrow(error);
    });
  });

  describe('socket events', () => {
    class SocketMock extends EventEmitter { }

    test('socket events', () => {
      const host = 'local.host';
      const port = 1337;
      const opts = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
      };

      const connection = new AwsSigV4DriverRemoteConnection(host, port, opts);
      const socket = new SocketMock();
      connection._connected(socket);

      connection._disconnected = jest.fn();
      socket.emit('close');
      expect(connection._disconnected).toHaveBeenCalled();

      connection._handleMessage = jest.fn();
      const message = {};
      socket.emit('message', message);
      expect(connection._handleMessage).toHaveBeenLastCalledWith(message);

      connection._connectionError = jest.fn();
      const error = new Error('socket event error');
      socket.emit('error', error);
      expect(connection._connectionError).toHaveBeenCalledWith(error);
    });
  });
});
