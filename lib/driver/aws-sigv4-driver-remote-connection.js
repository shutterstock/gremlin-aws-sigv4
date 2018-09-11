/* eslint no-underscore-dangle: ["error", { "allowAfterThis": true }] */

const gremlin = require('gremlin');
const util = require('util');
const WebSocketClient = require('websocket').client;
const { uuid, getUrlAndHeaders, bufferFromString } = require('../utils');

const responseStatusCode = {
  success: 200,
  noContent: 204,
  partialContent: 206,
};

class AwsSigV4DriverRemoteConnection extends gremlin.driver.RemoteConnection {
  constructor(host, port, options = {}) {
    const { url, headers } = getUrlAndHeaders(host, port, options);
    super(url);

    this._responseHandlers = {};
    this._reader = options.reader || new gremlin.structure.io.GraphSONReader();
    this._writer = options.writer || new gremlin.structure.io.GraphSONWriter();
    this._openPromise = null;
    this._openCallback = null;
    const mimeType = options.mimeType || 'application/vnd.gremlin-v2.0+json';
    this._header = String.fromCharCode(mimeType.length) + mimeType;
    this.isOpen = false;
    this.traversalSource = options.traversalSource || 'g';

    const client = new WebSocketClient();
    const self = this; // trick to access to this from socket event
    client.on('connect', (connection) => {
      self.isOpen = true;
      self._socket = connection; // eslint-disable-line no-underscore-dangle
      if (self._openCallback) { // eslint-disable-line no-underscore-dangle
        self._openCallback(); // eslint-disable-line no-underscore-dangle
      }
      connection.on('close', () => {
        self.isOpen = false;
      });
      connection.on('message', (data) => {
        self._handleMessage(data); // eslint-disable-line no-underscore-dangle
      });
      connection.on('error', (error) => {
        throw error;
      });
    });
    client.on('connectFailed', (error) => {
      self._openCallback(error); // eslint-disable-line no-underscore-dangle
    });
    client.connect(url, null, null, headers);
  }

  /**
   * Opens the connection, if its not already opened.
   * @returns {Promise}
   */
  open() {
    if (this.isOpen) {
      return Promise.resolve();
    }
    if (this._openPromise) {
      return this._openPromise;
    }
    this._openPromise = new Promise((resolve, reject) => {
      // Set the callback that will be invoked once the WS is opened
      this._openCallback = err => (err ? reject(err) : resolve());
    });
    return this._openPromise;
  }

  /** @override */
  submit(bytecode) {
    return this.open()
      .then(() => new Promise((resolve, reject) => {
        const requestId = uuid();
        this._responseHandlers[requestId] = {
          callback: (err, result) => (err ? reject(err) : resolve(result)),
          result: null,
        };
        const message = bufferFromString(this._header
          + JSON.stringify(this._getRequest(requestId, bytecode)));
        this._socket.send(message);
      }));
  }

  _getRequest(id, bytecode) {
    return ({
      requestId: { '@type': 'g:UUID', '@value': id },
      op: 'bytecode',
      processor: 'traversal',
      args: {
        gremlin: this._writer.adaptObject(bytecode),
        aliases: { g: this.traversalSource },
      },
    });
  }

  _handleMessage(data) {
    const response = this._reader.read(JSON.parse(data.binaryData.toString()));
    if (response.requestId === null || response.requestId === undefined) {
      // There was a serialization issue on the server that prevented the parsing of the request id
      // We invoke any of the pending handlers with an error
      Object.keys(this._responseHandlers).forEach((requestId) => {
        const handler = this._responseHandlers[requestId];
        this._clearHandler(requestId);
        if (response.status !== undefined && response.status.message) {
          return handler.callback(
            new Error(util.format(
              'Server error (no request information): %s (%d)', response.status.message, response.status.code,
            )),
          );
        }
        return handler.callback(new Error(util.format('Server error (no request information): %j', response)));
      });
      return undefined;
    }

    const handler = this._responseHandlers[response.requestId];

    if (!handler) {
      return undefined;
    }

    if (response.status.code >= 400) {
      // callback in error
      return handler.callback(
        new Error(util.format('Server error: %s (%d)', response.status.message, response.status.code)),
      );
    }
    switch (response.status.code) {
      case responseStatusCode.noContent:
        this._clearHandler(response.requestId);
        return handler.callback(null, { traversers: [] });
      case responseStatusCode.partialContent:
        handler.result = handler.result || [];
        handler.result.push(...response.result.data);
        break;
      default:
        if (handler.result) {
          handler.result.push(...response.result.data);
        } else {
          handler.result = response.result.data;
        }
        this._clearHandler(response.requestId);
        return handler.callback(null, { traversers: handler.result });
    }
    return undefined;
  }

  /**
   * Clears the internal state containing the callback and result buffer of a given request.
   * @param requestId
   * @private
   */
  _clearHandler(requestId) {
    delete this._responseHandlers[requestId];
  }

  /**
   * Closes the Connection.
   * @return {Promise}
   */
  close() {
    if (this._socket) {
      this._socket.close();
    } else {
      this.isOpen = false;
    }
  }
}

module.exports = AwsSigV4DriverRemoteConnection;
