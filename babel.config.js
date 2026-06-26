const envConfig = {
  development: {
    presets: [],
    plugins: [],
  },
  production: {
    presets: [],
    plugins: [],
  },
};

module.exports = function (api) {
  // api.cache.never();
  api.cache.using(() => process.env.NODE_ENV);

  const additional = envConfig[process.env.NODE_ENV] || {};

  return {
    plugins: [
      ...additional.plugins,
    ],

    presets: [
      ['@babel/preset-env', { targets: { node: '22' } }],
      ...(additional.presets || []),
    ],

  };
};
