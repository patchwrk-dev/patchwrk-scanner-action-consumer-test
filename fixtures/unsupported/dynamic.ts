// Illustrative expected miss: dynamic module specifier is unsupported.
const sdk = require(process.env.SYNTHETIC_MODULE); new sdk();
