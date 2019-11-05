const utils = require('../../lib/utils');

jest.mock('moment-timezone', () => () => ({
  utc: jest.fn(() => ({ format: jest.fn(() => '19700101') })),
  format: jest.fn(() => '19700101'),
}));

describe('utils', () => {
  describe('uuid', () => {
    it('should return a random uuid', () => {
      const result = utils.uuid();
      expect(result).toHaveLength(36);
      expect(result).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    });
  });

  describe('getUrlAndHeaders', () => {
    it('should return the url and header for connection to Neptune', () => {
      jest.spyOn(utils, 'hmac');
      jest.spyOn(utils, 'hash');

      const host = 'local.host';
      const port = 1337;
      const creds = {
        accessKey: 'MY_ACCESS_KEY',
        secretKey: 'MY_SECRET_KEY',
        region: 'MY_REGION',
      };
      const { url, headers } = utils.getUrlAndHeaders(host, port, creds, '/gremlin', 'ws');

      expect(url).toContain(host);
      expect(url).toContain(port);
      expect(url).toEqual(`ws://${host}:${port}/gremlin`);

      expect(headers).toHaveProperty('Host');
      expect(headers).toHaveProperty('x-amz-date');
      expect(headers).toHaveProperty('Authorization');

      expect(headers.Host).toContain(host);
      expect(headers.Host).toContain(port);
      expect(headers.Authorization)
        .toContain('AWS4-HMAC-SHA256 '
          + `Credential=${creds.accessKey}/19700101/${creds.region}/neptune-db/aws4_request, `
          + 'SignedHeaders=host;x-amz-date, '
          + 'Signature=');
    });

    it('should include the session token if given', () => {
      jest.spyOn(utils, 'hmac');
      jest.spyOn(utils, 'hash');

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
      expect(url).toContain(port);
      expect(url).toEqual(`ws://${host}:${port}/gremlin`);

      expect(headers).toHaveProperty('Host');
      expect(headers).toHaveProperty('x-amz-date');
      expect(headers).toHaveProperty('Authorization');
      expect(headers).toHaveProperty('x-amz-security-token');

      expect(headers.Host).toContain(host);
      expect(headers.Host).toContain(port);
      expect(headers.Authorization)
        .toContain('AWS4-HMAC-SHA256 '
          + `Credential=${creds.accessKey}/19700101/${creds.region}/neptune-db/aws4_request, `
          + 'SignedHeaders=host;x-amz-date;x-amz-security-token, '
          + 'Signature=');
    });
  });
});
