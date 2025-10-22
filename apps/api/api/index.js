const path = require("path");

const bundlePath = path.join(__dirname, "dist", "serverless.js");
const serverModule = require(bundlePath);

module.exports = serverModule.default || serverModule;
