const debug = require('debug')('gremlin-aws-sigv4:driver');
const gremlin = require('gremlin');
const request = require('request');
const { getUrlAndHeaders } = require('../utils');

class AwsSigV4DriverRemoteConnection extends gremlin.driver.RemoteConnection {
  constructor(host, port, options = {}, cbConnected = null, cbDisconnected = null, cbError = null) {
    debug(`constructor: ${JSON.stringify({ host, port, options })}`);
    const { url } = getUrlAndHeaders(host, port, options);
    super(url);

    this.host = host;
    this.port = port;
    this.options = options;
    this.cbConnected = cbConnected;
    this.cbDisconnected = cbDisconnected;
    this.cbError = cbError;

    this.try = 0;
    this.maxRetry = this.options.maxRetry || 10;

    this.clientOptions = Object.assign({
      connectOnStartup: true,
      mimeType: 'application/vnd.gremlin-v2.0+json',
      pingEnabled: true,
      pingInterval: 1000,
      pongTimeout: 2000,
    }, this.options);

    this._connect();
  }

  _connect() {
    this.try += 1;
    let { url, headers } = getUrlAndHeaders(this.host, this.port, this.options, '/status', 'http');
    debug(`get Neptune status: ${JSON.stringify(url, headers)} (try #${this.try})`)
    request({ url, headers, timeout: 3000 }, (error, response, body) => {
      if (error) {
        this._errorHandler(error);
      } else if (response) {
        const msg = `Neptune responded with a HTTP-${response.statusCode}`;
        debug(msg);
        if (body) {
          debug(`Neptune status: ${body}`);
        }
        if (response.statusCode === 200) {
          this._connectSocket();
        } else {
          this._errorHandler(new Error(msg));
        }
      } else {
        const msg = `No response or error received from request to ${JSON.stringify(url, headers)}`;
        debug(msg);
        this._errorHandler(new Error(msg));
      }
    });
  }

  _connectSocket() {
    let { url, headers } = getUrlAndHeaders(this.host, this.port, this.options);
    debug(`connect: ${JSON.stringify(url, headers)} (try #${this.try})`);
    this._client = new gremlin.driver.Client(url, Object.assign({ headers }, this.clientOptions));
    this._client._connection.on('log', (log) => this._logHandler(log));
    this._client._connection.on('close', (code, message) => this._closeHandler(code, message));
    this._client._connection.on('error', (error) => this._errorHandler(error));
    this._client._connection._ws.on('open', () => this._connectHandler())
  }

  _logHandler(log) {
    debug('connection event: log', { log });
  }

  _connectHandler() {
    debug('connection/socket event: open');
    if (this.cbConnected) {
      this.cbConnected();
    }
    if (this._client._connection.isOpen) {
      this.try = 0;
    }
  }

  _closeHandler(code, message) {
    debug('connection event: close', { code, message });
    if (this.cbDisconnected) {
      this.cbDisconnected(code, message)
    }
    if (this.options.autoReconnect && this.try < this.maxRetry) {
      this.connect();
    }
  }

  _errorHandler(error) {
    debug('connection event: error', { error });
    if (this.cbError) {
      this.cbError(error);
    }
    if (this.options.autoReconnect && this.try < this.maxRetry) {
      this.connect();
    } else if (error instanceof Error) {
      throw error;
    }
  }

  /** @override */
  open() {
    debug('open');
    return this._client.open();
  }

  /** @override */
  submit(bytecode) {
    debug('submit');
    return this._client.submit(bytecode)
      .then(result => new gremlin.driver.RemoteTraversal(result.toArray()));
  }

  /** @override */
  close() {
    debug('close');
    this.options.autoReconnect = false;
    return this._client.close();
  }
}

module.exports = AwsSigV4DriverRemoteConnection;
