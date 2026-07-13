module.exports = {
  apps: [
    {
      name: "v380-nvr-backend",
      cwd: "./backend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "../logs/backend-error.log",
      out_file: "../logs/backend-out.log",
      merge_logs: true,
      time: true,
      autorestart: true,
      watch: false,
    },
    {
      name: "v380-nvr-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 5050,
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "../logs/frontend-error.log",
      out_file: "../logs/frontend-out.log",
      merge_logs: true,
      time: true,
      autorestart: true,
      watch: false,
    }
  ]
};
