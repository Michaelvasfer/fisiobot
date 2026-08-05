// PM2: los dos procesos del sistema en producción.
//   fisiobot-dashboard → Next.js standalone en :3210
//   fisiobot           → agente de WhatsApp (Express) en :3201
// Uso: pm2 startOrRestart ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'fisiobot-dashboard',
      script: '.next/standalone/server.js',
      env: { NODE_ENV: 'production', PORT: 3210 },
    },
    {
      name: 'fisiobot',
      script: 'bot/src/server.js',
      env: { NODE_ENV: 'production', PORT: 3201 },
    },
  ],
};
