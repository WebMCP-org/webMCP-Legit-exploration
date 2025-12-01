/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  redirects: async () => [
    {
      source: "/",
      destination: "/month-view",
      permanent: false,
    },
  ],
  webpack: (config, { isServer, webpack }) => {

    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
    };

    config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];

    config.plugins = config.plugins || [];
    config.plugins.unshift(
      new webpack.NormalModuleReplacementPlugin(
        /^node:/,
        (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        }
      )
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: false,
        fs: false,
        path: false,
        stream: false,
        crypto: false,
        util: false,
        events: false,
        http: false,
        https: false,
        url: false,
        querystring: false,
      };
    }

    return config;
  },
};

export default nextConfig;
