module.exports = {
  apps: [
    {
      name: 'fresh-greens',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/fresh-greens',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '/var/www/fresh-greens/.env',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/pm2/fresh-greens-error.log',
      out_file: '/var/log/pm2/fresh-greens-out.log',
      merge_logs: true,
    },
  ],
};
