const gremlin = require('../../');

const host = 'localhost';
const port = 8182;

describe('integration test', () => {
  it('should count the items in gremlin', async () => {
    const graph = new gremlin.structure.Graph();
    const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(host, port, {
      accessKey: 'test',
      secretKey: 'test',
      region: 'test',
    });
    const g = graph.traversal().withRemote(connection);

    // run the query, here it counts the number of vertices in database
    const count = await g.V().count().next();

    // close the connection
    connection.close();

    expect(count).toHaveProperty('value');
    expect(count.value).toEqual(0);
  });

  it('should throw an error for incorrect query', async () => {
    const graph = new gremlin.structure.Graph();
    const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(host, port, {
      accessKey: 'test',
      secretKey: 'test',
      region: 'test',
    });

    const g = graph.traversal().withRemote(connection);
    try {
      // runs the query, here it counts the number of vertices in database
      await g.V().count(1234).next();
    } catch (ex) {
      expect(ex.message).toEqual('Server error: Could not locate method: DefaultGraphTraversal.count([1234]) (599)');
    } finally {
      connection.close();
    }

    // eslint-disable-next-line no-underscore-dangle
    expect(() => connection._socket.emit('error', new Error('sample error')))
      .toThrow('sample error');
  });

  it('should not connect to an unexisting server', async () => {
    const graph = new gremlin.structure.Graph();
    const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(host, port + 1, {
      accessKey: 'test',
      secretKey: 'test',
      region: 'test',
    });
    const g = graph.traversal().withRemote(connection);

    try {
      // runs the query, here it counts the number of vertices in database
      await g.V().count().next();
    } catch (ex) {
      expect(ex.message).toEqual('connect ECONNREFUSED 127.0.0.1:8183');
    }
  });
});
