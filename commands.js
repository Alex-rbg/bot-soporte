const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa a un miembro del servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('El usuario que deseas expulsar')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Motivo de la expulsión')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea a un miembro del servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('El usuario que deseas banear')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Motivo del baneo')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('borrar_dias')
        .setDescription('Días de mensajes a borrar (0 a 7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('quitar-ban')
    .setDescription('Remueve el baneo de un usuario mediante su ID')
    .addStringOption(option =>
      option.setName('id_usuario')
        .setDescription('ID de Discord del usuario desbaneado')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Motivo del desbaneo')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('aislamiento')
    .setDescription('Aísla (timeout) temporalmente a un miembro del servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('El usuario a aislar')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('minutos')
        .setDescription('Duración del aislamiento en minutos (máximo 40320 / 28 días)')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Motivo del aislamiento')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Aplica una advertencia/sanción, asigna rol de sanción y registra en historial')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('El usuario a sancionar/advertir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Motivo de la sanción/advertencia')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('rol_sancion')
        .setDescription('Rol de sanción a otorgar (si no lo pones, podrás elegirlo de la lista)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('ver-historial')
    .setDescription('Consulta el historial de advertencias y sanciones de un usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a consultar')
        .setRequired(true))
];

module.exports = { commands };

