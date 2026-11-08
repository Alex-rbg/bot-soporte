require('dotenv').config();
const http = require('http');
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

// Servidor HTTP ligero para compatibilidad con hostings gratuitos en la nube (Render, Koyeb, etc.)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Bot de Soporte Técnico activo 24/7\n');
}).listen(PORT, () => {
  console.log(`[INFO] Servidor HTTP de monitoreo activo en el puerto ${PORT}`);
});

const { commands } = require('./commands');
const historyManager = require('./historyManager');

const REQUIRED_ROLE_ID = '1568832975825674300';
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('[ERROR] No se encontró el DISCORD_TOKEN en el archivo .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Comprobar si el usuario tiene el rol requerido o es el dueño del servidor
function hasModerationPermission(interaction) {
  if (!interaction.member || !interaction.member.roles) return false;
  return (
    interaction.member.roles.cache.has(REQUIRED_ROLE_ID) ||
    interaction.guild.ownerId === interaction.user.id
  );
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[OK] Bot encendido exitosamente como: ${readyClient.user.tag}`);

  // Registrar comandos Slash
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('[INFO] Registrando comandos de barra diagonal (Slash Commands)...');
    const commandPayload = commands.map(cmd => cmd.toJSON());

    // Registro global
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: commandPayload
    });

    // Limpiar comandos a nivel de servidor para que Discord NO los duplique
    for (const guild of readyClient.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(readyClient.user.id, guild.id),
        { body: [] }
      ).catch(() => {});
    }

    console.log('✅ Comandos registrados y listos para usarse.');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Validación de permisos: solo el rol especificado puede ejecutar los comandos
  if (!hasModerationPermission(interaction)) {
    return interaction.reply({
      content: `❌ **Acceso denegado.** Solo los miembros con el rol <@&${REQUIRED_ROLE_ID}> tienen permiso para ejecutar este comando.`,
      ephemeral: true
    });
  }

  try {
    // ==========================================
    // COMANDO: KICK
    // ==========================================
    if (commandName === 'kick') {
      const targetUser = interaction.options.getUser('usuario');
      const razon = interaction.options.getString('razon');

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ El usuario no se encuentra en el servidor.', ephemeral: true });
      }

      if (!targetMember.kickable) {
        return interaction.reply({
          content: '❌ No puedo expulsar a este usuario. Verifica que mi rol esté por encima del suyo en la jerarquía del servidor.',
          ephemeral: true
        });
      }

      await targetMember.kick(razon);

      historyManager.addSanction({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        userTag: targetUser.tag,
        type: 'KICK',
        reason: razon,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag
      });

      const embed = new EmbedBuilder()
        .setTitle('👢 Usuario Expulsado')
        .setColor(0xE67E22)
        .addFields(
          { name: '👤 Usuario', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
          { name: '🛡️ Moderador', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📄 Razón', value: razon, inline: false },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Moderación' });

      return interaction.reply({ embeds: [embed] });
    }

    // ==========================================
    // COMANDO: BAN
    // ==========================================
    if (commandName === 'ban') {
      const targetUser = interaction.options.getUser('usuario');
      const razon = interaction.options.getString('razon');
      const borrarDias = interaction.options.getInteger('borrar_dias') || 0;

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (targetMember && !targetMember.bannable) {
        return interaction.reply({
          content: '❌ No puedo banear a este usuario. Su rol es igual o superior al mío o faltan permisos.',
          ephemeral: true
        });
      }

      await interaction.guild.bans.create(targetUser.id, {
        reason: razon,
        deleteMessageSeconds: borrarDias * 24 * 60 * 60
      });

      historyManager.addSanction({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        userTag: targetUser.tag,
        type: 'BAN',
        reason: razon,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag
      });

      const embed = new EmbedBuilder()
        .setTitle('🔨 Usuario Baneado')
        .setColor(0xED4245)
        .addFields(
          { name: '👤 Usuario', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
          { name: '🛡️ Moderador', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📄 Razón', value: razon, inline: false },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Moderación' });

      return interaction.reply({ embeds: [embed] });
    }

    // ==========================================
    // COMANDO: QUITAR-BAN (UNBAN)
    // ==========================================
    if (commandName === 'quitar-ban') {
      const userId = interaction.options.getString('id_usuario').trim();
      const razon = interaction.options.getString('razon') || 'Sin razón especificada';

      const bans = await interaction.guild.bans.fetch().catch(() => null);
      const banInfo = bans ? bans.get(userId) : null;

      if (!banInfo) {
        return interaction.reply({
          content: `❌ No se encontró ningún baneo activo para la ID \`${userId}\`.`,
          ephemeral: true
        });
      }

      await interaction.guild.bans.remove(userId, razon);

      historyManager.addSanction({
        guildId: interaction.guild.id,
        userId: userId,
        userTag: banInfo.user.tag,
        type: 'UNBAN',
        reason: razon,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag
      });

      const embed = new EmbedBuilder()
        .setTitle('🔓 Baneo Removido')
        .setColor(0x57F287)
        .addFields(
          { name: '👤 Usuario Desbaneado', value: `${banInfo.user.tag} (<@${userId}>)`, inline: true },
          { name: '🛡️ Moderador', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📄 Razón', value: razon, inline: false },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(banInfo.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Moderación' });

      return interaction.reply({ embeds: [embed] });
    }

    // ==========================================
    // COMANDO: AISLAMIENTO (TIMEOUT)
    // ==========================================
    if (commandName === 'aislamiento') {
      const targetUser = interaction.options.getUser('usuario');
      const minutos = interaction.options.getInteger('minutos');
      const razon = interaction.options.getString('razon');

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ El usuario no está en el servidor.', ephemeral: true });
      }

      if (!targetMember.moderatable) {
        return interaction.reply({
          content: '❌ No puedo aislar a este usuario. Verifica la jerarquía de roles o permisos.',
          ephemeral: true
        });
      }

      const durationMs = minutos * 60 * 1000;
      await targetMember.timeout(durationMs, razon);

      historyManager.addSanction({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        userTag: targetUser.tag,
        type: 'AISLAMIENTO',
        duration: `${minutos} minutos`,
        reason: razon,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag
      });

      const embed = new EmbedBuilder()
        .setTitle('🔇 Usuario en Aislamiento')
        .setColor(0x95A5A6)
        .addFields(
          { name: '👤 Usuario', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
          { name: '🛡️ Moderador', value: `<@${interaction.user.id}>`, inline: true },
          { name: '⏱️ Duración', value: `${minutos} minutos`, inline: true },
          { name: '📄 Razón', value: razon, inline: false },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Moderación' });

      return interaction.reply({ embeds: [embed] });
    }

    // ==========================================
    // COMANDO: WARN (CON SELECCIÓN DE ROL DE SANCIÓN)
    // ==========================================
    if (commandName === 'warn') {
      const targetUser = interaction.options.getUser('usuario');
      const razon = interaction.options.getString('razon');
      const directRole = interaction.options.getRole('rol_sancion');

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ El usuario no se encuentra en el servidor.', ephemeral: true });
      }

      // Si ya especificó el rol directamente en el comando
      if (directRole) {
        if (directRole.id === interaction.guild.id) {
          return interaction.reply({ content: '❌ No puedes asignar el rol @everyone como sanción.', ephemeral: true });
        }

        try {
          await targetMember.roles.add(directRole);
        } catch (err) {
          return interaction.reply({
            content: `❌ No se pudo asignar el rol <@&${directRole.id}>. Asegúrate de que mi rol esté colocado más arriba en la lista de roles del servidor.`,
            ephemeral: true
          });
        }

        historyManager.addSanction({
          guildId: interaction.guild.id,
          userId: targetUser.id,
          userTag: targetUser.tag,
          type: 'WARN',
          reason: razon,
          roleId: directRole.id,
          roleName: directRole.name,
          moderatorId: interaction.user.id,
          moderatorTag: interaction.user.tag
        });

        const embed = new EmbedBuilder()
          .setTitle('⚠️ Advertencia y Sanción Aplicada')
          .setColor(0xF1C40F)
          .addFields(
            { name: '👤 Usuario', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
            { name: '🛡️ Moderador', value: `<@${interaction.user.id}>`, inline: true },
            { name: '🏷️ Rol asignado', value: `<@&${directRole.id}>`, inline: true },
            { name: '📄 Razón', value: razon, inline: false },
            { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: 'Sistema de Moderación • Registrado en el Historial' });

        return interaction.reply({ embeds: [embed] });
      }

      // Si no especificó el rol, mostramos la lista desplegable interactiva con todos los roles
      const roleSelectMenu = new RoleSelectMenuBuilder()
        .setCustomId(`warn_role_${interaction.id}`)
        .setPlaceholder('Selecciona el rol de sanción de la lista...')
        .setMinValues(1)
        .setMaxValues(1);

      const noRoleButton = new ButtonBuilder()
        .setCustomId(`warn_norole_${interaction.id}`)
        .setLabel('Advertir sin asignar rol')
        .setStyle(ButtonStyle.Secondary);

      const row1 = new ActionRowBuilder().addComponents(roleSelectMenu);
      const row2 = new ActionRowBuilder().addComponents(noRoleButton);

      const selectEmbed = new EmbedBuilder()
        .setTitle('⚠️ Aplicar Advertencia / Sanción')
        .setDescription(
          `Vas a sancionar a **${targetUser.tag}** (<@${targetUser.id}>).\n\n` +
          `**Razón:** ${razon}\n\n` +
          `Selecciona un **rol de sanción** del menú desplegable inferior para otorgárselo automáticamente, o presiona **Advertir sin asignar rol**.`
        )
        .setColor(0xF39C12);

      const response = await interaction.reply({
        embeds: [selectEmbed],
        components: [row1, row2],
        fetchReply: true
      });

      try {
        const filter = (i) => i.user.id === interaction.user.id;
        const confirmation = await response.awaitMessageComponent({
          filter,
          time: 60000
        });

        let assignedRole = null;

        if (confirmation.isRoleSelectMenu()) {
          const selectedRoleId = confirmation.values[0];
          const roleObj = interaction.guild.roles.cache.get(selectedRoleId);

          if (roleObj && roleObj.id !== interaction.guild.id) {
            try {
              await targetMember.roles.add(roleObj);
              assignedRole = roleObj;
            } catch (err) {
              return confirmation.update({
                content: `❌ No pude otorgar el rol <@&${roleObj.id}> por jerarquía de permisos del bot. Sube el rol del bot por encima de este rol.`,
                embeds: [],
                components: []
              });
            }
          }
        }

        historyManager.addSanction({
          guildId: interaction.guild.id,
          userId: targetUser.id,
          userTag: targetUser.tag,
          type: 'WARN',
          reason: razon,
          roleId: assignedRole ? assignedRole.id : null,
          roleName: assignedRole ? assignedRole.name : null,
          moderatorId: interaction.user.id,
          moderatorTag: interaction.user.tag
        });

        const finalEmbed = new EmbedBuilder()
          .setTitle('⚠️ Advertencia y Sanción Registrada')
          .setColor(0xF1C40F)
          .addFields(
            { name: '👤 Usuario', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
            { name: '🛡️ Moderador', value: `<@${interaction.user.id}>`, inline: true },
            {
              name: '🏷️ Rol asignado',
              value: assignedRole ? `<@&${assignedRole.id}>` : 'Ninguno',
              inline: true
            },
            { name: '📄 Razón', value: razon, inline: false },
            { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: 'Sistema de Moderación • Guardado en el Historial' });

        await confirmation.update({ embeds: [finalEmbed], components: [] });
      } catch (err) {
        await interaction.editReply({
          content: '⏱️ Se agotó el tiempo para seleccionar el rol de sanción. Puedes ejecutar `/warn` nuevamente.',
          embeds: [],
          components: []
        }).catch(() => {});
      }
      return;
    }

    // ==========================================
    // COMANDO: VER-HISTORIAL
    // ==========================================
    if (commandName === 'ver-historial') {
      const targetUser = interaction.options.getUser('usuario');
      const sanctions = historyManager.getSanctions(interaction.guild.id, targetUser.id);

      if (!sanctions || sanctions.length === 0) {
        const cleanEmbed = new EmbedBuilder()
          .setTitle(`📋 Historial: ${targetUser.tag}`)
          .setDescription(`✅ Este usuario no cuenta con ninguna sanción registrada.`)
          .setColor(0x2ECC71)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: 'Sistema de Moderación' });

        return interaction.reply({ embeds: [cleanEmbed] });
      }

      const typeLabels = {
        WARN: '⚠️ Advertencia / Rol',
        KICK: '👢 Expulsión',
        BAN: '🔨 Baneo',
        UNBAN: '🔓 Desbaneo',
        AISLAMIENTO: '🔇 Aislamiento'
      };

      const historyEmbed = new EmbedBuilder()
        .setTitle(`📋 Historial de Sanciones: ${targetUser.tag}`)
        .setDescription(
          `**ID:** \`${targetUser.id}\`\n` +
          `**Total de sanciones:** ${sanctions.length}`
        )
        .setColor(0xE74C3C)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      // Mostramos las últimas 10 sanciones (más recientes primero)
      sanctions.slice(-10).reverse().forEach((s, idx) => {
        const timestamp = Math.floor(new Date(s.date).getTime() / 1000);
        let detail = `**Tipo:** ${typeLabels[s.type] || s.type}\n` +
                     `**Moderador:** <@${s.moderatorId}>\n` +
                     `**Razón:** ${s.reason}\n` +
                     `**Fecha:** <t:${timestamp}:F> (<t:${timestamp}:R>)`;

        if (s.roleId) {
          detail += `\n**Rol Otorgado:** <@&${s.roleId}>`;
        }
        if (s.duration) {
          detail += `\n**Duración:** ${s.duration}`;
        }

        historyEmbed.addFields({
          name: `Sanción #${sanctions.length - idx}`,
          value: detail
        });
      });

      if (sanctions.length > 10) {
        historyEmbed.setFooter({
          text: `Mostrando las últimas 10 de ${sanctions.length} sanciones registradas.`
        });
      } else {
        historyEmbed.setFooter({ text: 'Sistema de Moderación' });
      }

      return interaction.reply({ embeds: [historyEmbed] });
    }
  } catch (error) {
    console.error(`Error procesando el comando ${commandName}:`, error);
    const errorMsg = '❌ Hubo un error al ejecutar este comando.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMsg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(token).catch((err) => {
  console.error('[ERROR] Error al iniciar sesión en Discord:', err);
});
