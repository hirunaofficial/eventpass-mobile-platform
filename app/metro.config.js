const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// @eventpass/shared is consumed directly from source and uses explicit
// ".js" extensions on relative imports (required by its tsconfig's Node16
// module resolution) even though the real files are ".ts". Metro doesn't
// do that TS-style remap on its own, so retry failed ".js" relative
// imports without the extension and let Metro's normal .ts/.tsx resolution
// find the real file.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
