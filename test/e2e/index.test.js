const gremlin = require('../..');

const connect = (host, port, opts) => new Promise((resolve, reject) => {
  const graph = new gremlin.structure.Graph();
  const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(
    host, port, opts,
    () => { resolve({ connection, g: graph.traversal().withRemote(connection) }); },
    (code, message) => { reject(new Error({ code, message })); },
    (err) => { reject(err); },
  );
});

test('connect, run a simple query and disconnect', async () => {
  const { connection, g } = await connect(
    process.env.TEST_HOST,
    process.env.TEST_PORT,
    {
      accessKeyId: process.env.TEST_ACCESS_KEY_ID,
      secretAccessKey: process.env.TEST_SECRET_ACCESS_KEY,
      region: process.env.TEST_REGION,
      secure: process.env.TEST_SECURE === 'true',
    },
  );
  const result = await g.V().count().next();
  connection.close();
  expect(result).toMatchObject({
    value: expect.any(Number),
    done: expect.any(Boolean),
  });
});
