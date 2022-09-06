const nock = require('nock');

const utils = require('../../lib/utils');

afterEach(() => {
  jest.clearAllMocks();
});

describe('utils', () => {
  describe('uuid', () => {
    it('should return a random uuid', () => {
      const result = utils.uuid();
      expect(result).toHaveLength(36);
      expect(result).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    });
  });

  describe('getUrlAndHeaders', () => {
    beforeEach(() => {
      const RealDate = Date;
      jest.spyOn(global, 'Date')
        .mockImplementation(() => new RealDate('1970-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw an error if host or port are not defined', () => {
      expect(() => utils.getUrlAndHeaders(null, null, {}, '', '')).toThrow('Host and port are required');
    });

    it('should return the url and header for connection to Neptune', () => {
      const host = 'local.host';
      const port = 1337;
      const creds = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
      };
      const { url, headers } = utils.getUrlAndHeaders(host, port, creds, '/gremlin', 'ws');

      expect(url).toContain(host);
      expect(url).toContain(`${port}`);
      expect(url).toEqual(`ws://${host}:${port}/gremlin`);

      expect(headers).toHaveProperty('Host');
      expect(headers).toHaveProperty('X-Amz-Date');
      expect(headers).toHaveProperty('Authorization');

      expect(headers.Host).toContain(host);
      expect(headers.Host).toContain(`${port}`);
      expect(headers.Authorization)
        .toContain('AWS4-HMAC-SHA256 '
          + `Credential=${creds.accessKey}/19700101/${creds.region}/neptune-db/aws4_request, `
          + 'SignedHeaders=host;x-amz-date, '
          + 'Signature=');
    });

    it('should include the session token if given', () => {
      const host = 'local.host';
      const port = 1337;
      const creds = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
        sessionToken: 'MY_SESSION_TOKEN',
      };
      const { url, headers } = utils.getUrlAndHeaders(host, port, creds, '/gremlin', 'ws');

      expect(url).toContain(host);
      expect(url).toContain(`${port}`);
      expect(url).toEqual(`ws://${host}:${port}/gremlin`);

      expect(headers).toHaveProperty('Host');
      expect(headers).toHaveProperty('X-Amz-Date');
      expect(headers).toHaveProperty('Authorization');
      expect(headers).toHaveProperty('X-Amz-Security-Token');

      expect(headers.Host).toContain(host);
      expect(headers.Host).toContain(`${port}`);
      expect(headers.Authorization)
        .toContain('AWS4-HMAC-SHA256 '
          + `Credential=${creds.accessKey}/19700101/${creds.region}/neptune-db/aws4_request, `
          + 'SignedHeaders=host;x-amz-date;x-amz-security-token, '
          + 'Signature=');
    });
  });

  describe('request', () => {
    const httpHost = 'http://localhost';
    const httpsHost = 'https://localhost';

    it('should use http for http requests', async () => {
      nock(httpHost).get('/').reply(200, 'ok');

      const result = await new Promise((resolve) => {
        utils.request(`${httpHost}/`, {}, (error, response, body) => {
          resolve({ error, response, body });
        });
      });

      expect(result.error).toBeNull();
      expect(result.response).not.toBeNull();
      expect(result.body).not.toBeNull();

      expect(result.response.socket.remotePort).toEqual(80);
    });

    it('should use https for https requests', async () => {
      nock(httpsHost).get('/').reply(200, 'ok');

      const result = await new Promise((resolve) => {
        utils.request(`${httpsHost}/`, {}, (error, response, body) => {
          resolve({ error, response, body });
        });
      });

      expect(result.error).toBeNull();
      expect(result.response).not.toBeNull();
      expect(result.body).not.toBeNull();

      expect(result.response.socket.remotePort).toEqual(443);
    });

    it('should pass errors to callback function', async () => {
      nock(httpsHost).get('/').replyWithError('oops');

      const result = await new Promise((resolve) => {
        utils.request(`${httpsHost}/`, {}, (error, response, body) => {
          resolve({ error, response, body });
        });
      });

      expect(result.error).not.toBeNull();
      expect(result.response).toBeNull();
      expect(result.body).toBeNull();
    });
  });
});
