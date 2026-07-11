import platformConfig from '../config/platform.json'

export const departments = platformConfig.departments

export const serverStats = {
  serverIp: platformConfig.server.publicHost || window.location.hostname,
  user: 'admin',
  maxStreams: platformConfig.defaults.maxStreams,
  version: '1.0.0-preparation',
}

export { platformConfig }
