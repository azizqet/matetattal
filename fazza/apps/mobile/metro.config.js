// Metro: also watch the shared package that lives outside this app folder.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, "../../packages/shared");
const config = getDefaultConfig(projectRoot);
config.watchFolders = [sharedRoot];
config.resolver.extraNodeModules = { "@fazza/shared": path.join(sharedRoot, "src") };
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
module.exports = config;
