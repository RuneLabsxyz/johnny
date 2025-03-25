import { z } from "zod";
import { extension, input, output } from "../../fork/daydreams/packages/core/src/utils";
import { formatMsg } from "../../fork/daydreams/packages/core/src/formatters";
import { ChannelType, Events, type Message } from "discord.js";
import { DiscordClient } from "../../fork/daydreams/packages/core/src/io/discord";
import { context } from "../../fork/daydreams/packages/core/src/context";
import { service } from "../../fork/daydreams/packages/core/src/serviceProvider";
import { LogLevel } from "../../fork/daydreams/packages/core/src/types";

const discordService = service({
  register(container) {
    container.singleton(
      "discord",
      () =>
        new DiscordClient(
          {
            discord_token: process.env.DISCORD_TOKEN!,
            discord_bot_name: process.env.DISCORD_BOT_NAME!,
          },
          LogLevel.DEBUG
        )
    );
  },
});

const discordChannelContext = context({
  type: "discord:channel",
  key: ({ channelId }) => channelId,
  schema: z.object({ channelId: z.string() }),

  async setup(args, { container }) {
    const channel = await container
      .resolve<DiscordClient>("discord")
      .client.channels.fetch(args.channelId);

    if (!channel) throw new Error("Invalid channel");

    return { channel };
  },

  description({ options: { channel } }) {
    return `Channel ID: ${channel.id}`;
  },
});

export const discord = extension({
  name: "discord",
  services: [discordService],
  contexts: {
    discordChannel: discordChannelContext,
  },
  inputs: {
    "discord:message": input({
      schema: z.object({
        chat: z.object({ id: z.string() }),
        user: z.object({ id: z.string(), name: z.string() }),
        text: z.string(),
      }),
      format: ({ user, text }) =>
        formatMsg({
          role: "user",
          user: user.name,
          content: text,
        }),
      subscribe(send, { container }) {
        function listener(message: Message) {
          if (
            message.author.displayName ==
            container.resolve<DiscordClient>("discord").credentials
              .discord_bot_name
          ) {
            console.log(
              `Skipping message from ${container.resolve<DiscordClient>("discord").credentials.discord_bot_name}`
            );
            return;
          }
          send(
            discord.contexts!.discordChannel,
            { channelId: message.channelId },
            {
              chat: {
                id: message.channelId,
              },
              user: {
                id: message.member!.id,
                name: message.member!.displayName,
              },
              text: message.content,
            }
          );
        }

        const { client } = container.resolve<DiscordClient>("discord");

        client.on(Events.MessageCreate, listener);
        return () => {
          client.off(Events.MessageCreate, listener);
        };
      },
    }),
  },
  outputs: {
    "discord:send_message": output({
      schema: z.object({
        channelId: z
          .string()
          .describe("The Discord channel ID to send the message to"),
        content: z.string().describe("The content of the message to send"),
      }),
      handler: async (data, ctx, { container }) => {
        const channel = await container
          .resolve<DiscordClient>("discord")
          .client.channels.fetch(data.channelId);
        console.log("Sending message to discord", data)
        if (channel && channel.isSendable()) {
          await container.resolve<DiscordClient>("discord").sendMessage(data);
          return {
            data,
            timestamp: Date.now(),
          };
        }
        throw new Error("Invalid channel id");
      },
      format: ({ data }) =>
        formatMsg({
          role: "assistant",
          content: data.content,
        }),
    }),
  },
});
