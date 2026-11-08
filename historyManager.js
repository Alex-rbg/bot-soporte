const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const historyFile = path.join(dataDir, 'history.json');

// Asegurar que el directorio de datos y el archivo existan
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(historyFile)) {
  fs.writeFileSync(historyFile, JSON.stringify({}, null, 2), 'utf-8');
}

function loadHistory() {
  try {
    const raw = fs.readFileSync(historyFile, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (error) {
    console.error('Error al leer history.json:', error);
    return {};
  }
}

function saveHistory(data) {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error al guardar history.json:', error);
  }
}

/**
 * Agrega una sanción al historial de un usuario
 */
function addSanction({ guildId, userId, userTag, type, reason, moderatorId, moderatorTag, roleId, roleName, duration }) {
  const data = loadHistory();
  const key = `${guildId}_${userId}`;

  if (!data[key]) {
    data[key] = [];
  }

  const sanction = {
    id: Date.now().toString(),
    userId,
    userTag,
    type, // 'WARN', 'KICK', 'BAN', 'UNBAN', 'AISLAMIENTO'
    reason: reason || 'Sin razón especificada',
    moderatorId,
    moderatorTag,
    roleId: roleId || null,
    roleName: roleName || null,
    duration: duration || null,
    date: new Date().toISOString()
  };

  data[key].push(sanction);
  saveHistory(data);
  return sanction;
}

/**
 * Obtiene el historial de sanciones de un usuario
 */
function getSanctions(guildId, userId) {
  const data = loadHistory();
  const key = `${guildId}_${userId}`;
  return data[key] || [];
}

module.exports = {
  addSanction,
  getSanctions
};

