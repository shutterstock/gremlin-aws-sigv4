/* eslint-disable no-bitwise */

const crypto = require('crypto');
const debug = require('debug')('gremlin-aws-sigv4:utils');
const aws4 = require('aws4');

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
  const sessionToken = credentials.sessionToken || credentials.sessionToken
    || process.env.AWS_SESSION_TOKEN;
  const region = credentials.region || process.env.AWS_DEFAULT_REGION;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Access key and secret key are required');
  }

  const awsCreds = {
    accessKeyId, secretAccessKey, sessionToken,
  };
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

module.exports = {
  uuid, getUrlAndHeaders,
};
