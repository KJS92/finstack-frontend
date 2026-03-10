module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules.forEach((rule) => {
        if (rule.oneOf) {
          rule.oneOf.forEach((loader) => {
            if (loader.loader && loader.loader.includes('babel-loader')) {
              loader.exclude = /node_modules/;
            }
          });
        }
      });
      return webpackConfig;
    }
  }
};
