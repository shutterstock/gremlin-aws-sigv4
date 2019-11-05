/* eslint-disable no-bitwise */

const crypto = require('crypto');
const debug = require('debug')('gremlin-aws-sigv4:utils');
const moment = require('moment-timezone');

/**
 * Creates a SHA-256 HMAC
 * @param {*} key
 * @param {*} string
 * @param {*} encoding
 */
const hmac = (key, string, encoding) => crypto.createHmac('sha256', key)
  .update(string, 'utf8')
  .digest(encoding);

/**
 * Creates hash
 * @param {*} string
 * @param {*} encoding
 */
const hash = (string, encoding) => crypto.createHash('sha256')
  .update(string, 'utf8')
  .digest(encoding);

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
 * Converts a string to binary
 * @param {string} text
 */
const bufferFromString = text => Buffer.from(text, 'utf8');

/**
 * Calculates the AWS Signature 4 for IAM authentication on Neptune
 * @return {Promise}
 */
const getUrlAndHeaders = (host, port, credentials, canonicalUri, protocol) => {
  debug('Calculating AWS Signature v4');

  if (!host || !port) {
    throw new Error('Host and port are required');
  }
  const accessKey = credentials.accessKey || process.env.AWS_ACCESS_KEY_ID;
  const secretKey = credentials.secretKey || process.env.AWS_SECRET_ACCESS_KEY;
  const region = credentials.region || process.env.AWS_DEFAULT_REGION;
  const sessionToken = credentials.sessionToken || process.env.AWS_SESSION_TOKEN;
  if (!accessKey || !secretKey) {
    throw new Error('Access key and secret key are required');
  }

  const serviceName = 'neptune-db';

  // Create a date for headers and the credential string.
  const amzdate = `${moment().utc().format('YYYYMMDDTHHmmss')}Z`;
  const datestamp = moment().format('YYYYMMDD');

  // Create the canonical headers and signed headers.
  const headers = {
    Host: `${host}:${port}`,
    'x-amz-date': amzdate,
  };
  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }
  const canonicalHeaders = `host:${host}:${port}\nx-amz-date:${amzdate}\n${
    sessionToken ? `x-amz-security-token:${sessionToken}\n` : ''
  }`;
  const signedHeaders = `host;x-amz-date${
    sessionToken ? ';x-amz-security-token' : ''
  }`;

  // Create payload hash (hash of the request body content)
  const payload = '';
  const payloadHash = hash(payload, 'hex');

  // Combine elements to create canonical request
  const canonicalQuery = '';
  const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n`
    + `${signedHeaders}\n${payloadHash}`;

  // Create the string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${datestamp}/${region}/${serviceName}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzdate}\n${credentialScope}\n`
    + `${hash(canonicalRequest, 'hex')}`;

  // Calculate the signature
  const dateKey = hmac(`AWS4${secretKey}`, datestamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, serviceName);
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');

  // Add signing information to the authorization header
  const authorizationHeader = `${algorithm} `
    + `Credential=${accessKey}/${credentialScope}, `
    + `SignedHeaders=${signedHeaders}, `
    + `Signature=${signature}`;

  headers.Authorization = authorizationHeader;
  return {
    url: `${protocol}://${host}:${port}${canonicalUri}`,
    headers,
  };
};

module.exports = {
  hmac, hash, uuid, bufferFromString, getUrlAndHeaders,
};
