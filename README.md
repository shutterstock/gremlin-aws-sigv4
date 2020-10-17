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

  const graph = new gremlin.structure.Graph();
  const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(
    // host
    'your-instance.neptune.amazonaws.com', 

    // port
    8182,

    // options, 
    {}, 

    // connected callback
    () => { 
      const g = graph.traversal().withRemote(connection);
      const count = await g.V().count().next();
      connection.close();
    }, 

    // disconnected callback
    (code, message) => { }, 

    // error callback
    (error) => { } 
  );
```

### Usage without environment variables
```js
  const gremlin = require('gremlin-aws-sigv4');

  // creates the connection
  const graph = new gremlin.structure.Graph();
  const connection = new gremlin.driver.AwsSigV4DriverRemoteConnection(
    // host
    'your-instance.neptune.amazonaws.com',

    // port
    8182, 
    
    // options
    { 
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key',
      sessionToken: 'your-optional-session-token',
      region: 'your-region',
    },
    
    // connected callback
    () => { 
      const g = graph.traversal().withRemote(connection);
      const count = await g.V().count().next();
      connection.close();
    }, 
    
    // disconnected callback
    (code, message) => { }, 
    
     // error callback
     (error) => { }
  );
```

### Additional options
Thses are the available config options, none of them is required.
```js
{
  // Open secure connection - mandatory for engine version 1.0.4.0 and above
  secure: true,

  // Enable auto-reconnection on connection failure - default: false 
  autoReconnect: true,

  // Number of auto-reconnection retries - default: 10 
  maxRetry: 3,
}
```

## Tests

### Unit tests
```bash
# install dependencies
npm install

# run the tests
npm run test:unit
```

## Dependencies

- [aws4](https://www.npmjs.com/package/aws4)
- [debug](https://www.npmjs.com/package/debug)
- [gremlin](https://www.npmjs.com/package/gremlin)

## Contribute
Please do contribute! Open an issue or submit a pull request.

The project falls under [@Shutterstock](https://github.com/shutterstock/welcome)'s [Code of Conduct](https://github.com/shutterstock/welcome/blob/master/CODE_OF_CONDUCT.md).

## License
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
