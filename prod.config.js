module.exports = {
  apps: [
    {
      name: 'pinchbackend',
      script: 'npm',
      args: 'run start:prod',
      interpreter: 'none', // This ensures PM2 runs npm, not node directly
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
