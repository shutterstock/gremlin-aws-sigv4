/* eslint no-underscore-dangle: 0 */
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
});
