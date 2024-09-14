module.exports = {
  apps: [
    {
      name: 'pinchbackend',
      script: 'npm',
      args: 'run start:stg',
      interpreter: 'none', // This ensures PM2 runs npm, not node directly
      env: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
