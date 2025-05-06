import { z } from "zod";
import { action, extension, input, output, render } from "../../fork/daydreams/packages/core/src";
import { formatMsg } from "../../fork/daydreams/packages/core/src";
import { Events, type Message, Snowflake } from "discord.js";
import { DiscordClient } from "./io";
import { context } from "../../fork/daydreams/packages/core/src";
import { service } from "../../fork/daydreams/packages/core/src";
import { LogLevel } from "../../fork/daydreams/packages/core/src";

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
  schema: { channelId: z.string(), context: z.string() },

  async setup(args, setttings, { container }) {
    const channel = await container
      .resolve<DiscordClient>("discord")
      .client.channels.fetch(args.channelId);

    if (!channel) throw new Error("Invalid channel");

    return { channel };
  },
  create(state) {
    return {
      channelId: state.channelId,
      context: state.context,
    };
  },

  description({ options: { channel } }) {
    return `Make sure to only reply to messages once, and to stop when you have nothing more to say`;
  },
  render({args}) {
    console.log(args);
    return `Channel ID: ${args.channelId}, recent messages: ${args.context}`;
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
      schema: {
        chat: { id: z.string(), context: z.string() },
        user: { id: z.string(), name: z.string() },
        text: z.string(),
      },
      format: (input) =>
        formatMsg({
          role: "user",
          user: input.data.user.name,
          content: input.data.text,
        }),
      async subscribe(send, { container }) {
        async function listener(message: Message) {
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

          let channel = await client.channels.fetch(message.channelId);

          if (!channel || !channel.isTextBased()) {
            return;
          }

          let messages = await channel.messages.fetch({ limit: 15 });

          let sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

          let context = "";
          let i = 0;

          for (const message of sortedMessages) {
            if (i == sortedMessages.size - 1){
              context += `*NEW*`;
            }
            context += `From: @${message[1].author.displayName} (timestamp: ${message[1].createdTimestamp}) - ${message[1].content} \n`;            
          }

         // console.log(context);

          send(
            discord.contexts!.discordChannel,
            { channelId: message.channelId, context: context },
            {
              chat: {
                id: message.channelId,
                context: context,
              },
              user: {
                id: message.author.id,
                name: message.author.displayName,
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

  actions: [
    action({
      name: "discord:send_message",
      schema: {
        channelId: z
          .string()
          .describe("The Discord channel ID to send the message to"),
        content: z.string().describe("The content of the message to send"),
      },
      description: `
      Send a message to a Discord channel
      
      # Rules for sending messages:
      1. Always respond if you have been tagged in the message
      2. Don't repeat yourself
      3. Don't take part in conversations unless you have been mentioned or asked to join the conversation
      4. Don't send multiple messages in a row
      
      `,
      handler: async (data, ctx, { container }) => {
        const channel = await container
          .resolve<DiscordClient>("discord")
          .client.channels.fetch(data.channelId);
        if (channel && (channel.isTextBased() || channel.isDMBased())) {
          await container.resolve<DiscordClient>("discord").sendMessage(data);
          return {
            data,
            timestamp: Date.now(),
          };
        }
        throw new Error("Invalid channel id");
      },
      // format: (res) =>
      //   formatMsg({
      //     role: "assistant",
      //     content: res.data.content,
      //   }),
    }),
  ],
});
