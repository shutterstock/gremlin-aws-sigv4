const gremlin = require('../../');

describe('gremlin-aws-sigv4', () => {
  it('should attach to the gremlin driver', () => {
    expect(gremlin.driver.AwsSigV4DriverRemoteConnection).toBeDefined();
  });
});
