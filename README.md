# gremlin-aws-sigv4
This package provides an extension for Apache's TinkerPop3 Gremlin [javascript driver](https://github.com/apache/tinkerpop/tree/master/gremlin-javascript/src/main/javascript/gremlin-javascript) compatible with [IAM Database Authentication for Neptune](https://docs.aws.amazon.com/neptune/latest/userguide/iam-auth.html).

## Installation
This project is a [Node.js](https://nodejs.org) module and can be installed with [npm](https://npmjs.com).

`npm install gremlin-aws-sigv4`

## Usage
This package reads the environment variables for AWS authentication. These variables can be overridden.

### Usage with environment variables
These three enviroment variables must be defined.
+ `AWS_ACCESS_KEY_ID` – AWS access key.
+ `AWS_SECRET_ACCESS_KEY` – AWS secret key.
+ `AWS_DEFAULT_REGION` – AWS region.

```js
  const gremlin = require('gremlin-aws-sigv4');

  const host = 'your-instance.neptune.amazonaws.com';
  const port = 8182;

  // creates the connection
  const graph = new gremlin.structure.Graph();
  const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(host, port);
  const g = graph.traversal().withRemote(connection);

  // run the query, here it counts the number of vertices in database
  const count = await g.V().count().next();

  // close the connection
  connection.close();
```

### Usage without environment variables
```js
  const gremlin = require('gremlin-aws-sigv4');

  const host = 'your-instance.neptune.amazonaws.com';
  const port = 8182;
  const opts = {
    accessKey: 'your-access-key',
    secretKey: 'your-secret-key',
    region: 'your-region',
  };

  // creates the connection
  const graph = new gremlin.structure.Graph();
  const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(host, port, opts);
  const g = graph.traversal().withRemote(connection);

  // run the query, here it counts the number of vertices in database
  const count = await g.V().count().next();

  // close the connection
  connection.close();
```

## Tests

### Unit tests
```bash
# install dependencies
npm install

# run the tests
npm run test:unit
```

### Integration tests
[Docker](https://www.docker.com/) is required to run integration tests, a [gremlin-server](https://hub.docker.com/r/jbmusso/gremlin-server/) container will be created.
```bash
# install dependencies
npm install

# start docker container
npm run docker:start

# run the tests
npm run test:e2e

# stop and delete docker container
npm run docker:stop
```

### All tests and coverage
[Docker](https://www.docker.com/) is required to run all tests, a [gremlin-server](https://hub.docker.com/r/jbmusso/gremlin-server/) container will be created.
```bash
# install dependencies
npm install

# start docker container
npm run docker:start

# run the tests
npm run test

# stop and delete docker container
npm run docker:stop
```


## Dependencies

- [gremlin](https://www.npmjs.com/package/gremlin)
- [moment-timezone](https://www.npmjs.com/package/moment-timezone)
- [websocket](https://www.npmjs.com/package/websocket)

## Contribute
Please do contribute! Open an issue or submit a pull request.

The project falls under [@Shutterstock](https://github.com/shutterstock/welcome)'s [Code of Conduct](https://github.com/shutterstock/welcome/blob/master/CODE_OF_CONDUCT.md).

## License
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
