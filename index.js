const gremlin = require('gremlin');
const AwsSigV4DriverRemoteConnection = require('./lib/driver/aws-sigv4-driver-remote-connection');

gremlin.driver.AwsSigV4DriverRemoteConnection = AwsSigV4DriverRemoteConnection;
module.exports = gremlin;
