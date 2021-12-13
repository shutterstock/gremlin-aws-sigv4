/* eslint-disable no-bitwise */

const aws4 = require('aws4');
const crypto = require('crypto');
const debug = require('debug')('gremlin-aws-sigv4:utils');
const http = require('http');
const https = require('https');

/**
 * Generates a random uuid
 */
const uuid = () => {
  const buffer = crypto.randomBytes(16);
  // clear the version
  buffer[6] &= 0x0f;
  // set the version 4
  buffer[6] |= 0x40;
  // clear the variant
  buffer[8] &= 0x3f;
  // set the IETF variant
  buffer[8] |= 0x80;
  const hex = buffer.toString('hex');
  return (
    `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20, 12)}`);
};

/**
 * Calculates the AWS Signature 4 for IAM authentication on Neptune
 */
const getUrlAndHeaders = (host, port, credentials, canonicalUri, protocol) => {
  debug('Calculating AWS Signature v4');

  if (!host || !port) {
    throw new Error('Host and port are required');
  }
  const accessKeyId = credentials.accessKey || credentials.accessKeyId
    || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = credentials.secretKey || credentials.secretAccessKey
    || process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = credentials.sessionToken || process.env.AWS_SESSION_TOKEN;
  const region = credentials.region || process.env.AWS_DEFAULT_REGION;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Access key and secret key are required');
  }

  const awsCreds = { accessKeyId, secretAccessKey, sessionToken };
  const sigOptions = {
    host: `${host}:${port}`,
    region,
    path: canonicalUri,
    service: 'neptune-db',
  };

  return {
    url: `${protocol}://${host}:${port}${canonicalUri}`,
    headers: aws4.sign(sigOptions, awsCreds).headers,
  };
};

/**
 * Callbackify native http(s) get
 */
const request = (url, options, cb) => {
  debug(`Requesting: ${url}`);
  (url.match('https://') ? https.get : http.get)(url, options, (response) => {
    let body = '';
    response.on('data', (d) => {
      body += d;
    });
    response.on('end', () => {
      cb(null, response, body);
    });
  })
    .on('error', (err) => {
      cb(err, null, null);
    });
};

module.exports = {
  uuid, getUrlAndHeaders, request,
};
