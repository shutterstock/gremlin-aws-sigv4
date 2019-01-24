const debug = require('debug')('gremlin-aws-sigv4:driver');
const gremlin = require('gremlin');
const { getUrlAndHeaders } = require('../utils');

class AwsSigV4DriverRemoteConnection extends gremlin.driver.RemoteConnection {
  constructor(host, port, options = {}) {
    debug(`constructor: ${JSON.stringify({ host, port, options })}`);
    const { url } = getUrlAndHeaders(host, port, options);
    super(url);

    this.host = host;
    this.port = port;
    this.options = options;

    this.try = 0;
    this.maxRetries = this.options.maxRetries || 10;

    this.clientOptions = Object.assign({
      connectOnStartup: true,
      mimeType: 'application/vnd.gremlin-v2.0+json',
      pingEnabled: true,
      pingInterval: 1000,
      pongTimeout: 2000,
    }, this.options);

    this.connect();
  }

  connect() {
    const { url, headers } = getUrlAndHeaders(this.host, this.port, this.options);
    debug(`connect: ${JSON.stringify(url, headers)}`);
    this._client = new gremlin.driver.Client(url, Object.assign({ headers }, this.clientOptions));
    this._client._connection.on('log', (event) => {
      debug('driver event: log', { event, time: new Date().toISOString() });
      this._logHandler();
    });
    this._client._connection.on('close', (event) => {
      debug('driver event: close', { event, time: new Date().toISOString() });
      this._errorOrCloseHandler(event);
    });
    this._client._connection.on('error', (event) => {
      debug('driver event: error', { event, time: new Date().toISOString() });
      this._errorOrCloseHandler(event);
    });
  }

  _errorOrCloseHandler(event) {
    if (this.options.autoReconnect && this.try < this.maxRetries) {
      debug(`Auto-reconnection: retry ${this.try}`);
      this.try += 1;
      this.connect();
    } else if (event instanceof Error) {
      throw event;
    }
  }

  _logHandler() {
    if (this._client._connection.isOpen) {
      this.try = 0; // todo: reinit try with the socket itself, not with logs event!
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
