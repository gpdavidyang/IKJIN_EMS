const path = require("path");

const fs = require("fs");

const candidatePaths = [
  path.join(__dirname, "dist", "serverless.js"),
  path.join(__dirname, "..", "dist", "serverless.js")
];

const bundlePath = candidatePaths.find((candidate) => fs.existsSync(candidate));

if (!bundlePath) {
  throw new Error("Unable to locate compiled serverless bundle (dist/serverless.js).");
}

const serverModule = require(bundlePath);

module.exports = serverModule.default || serverModule;
