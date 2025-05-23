import { z } from "zod";
import { action, extension, input, output, render } from "../../fork/daydreams/packages/core/src";
import { formatMsg } from "../../fork/daydreams/packages/core/src";
import { Events, type Message, Snowflake } from "discord.js";
import { DiscordClient } from "./io";
import { context } from "../../fork/daydreams/packages/core/src";
import { service } from "../../fork/daydreams/packages/core/src";
import { LogLevel } from "../../fork/daydreams/packages/core/src"
import { personality } from "../characters/ponzius";
import { env } from "../env";
import { getPersonality } from "../env";

const discordService = service({
  register(container) {
    container.singleton(
      "discord",
      () =>
        new DiscordClient(
          {
            discord_token: env.DISCORD_TOKEN!,
            discord_bot_name: env.DISCORD_BOT_NAME!,
          },
          LogLevel.DEBUG
        )
    );
  },
  destroy(container) {
    container.resolve<DiscordClient>("discord").client.destroy();
  },
});

const discordChannelContext = context({
  type: "discord:channel",
  key: ({ channelId }) => channelId,
  schema: { channelId: z.string(), context: z.string(), personality: z.string() },
  create(state) {
    return {
      channelId: state.channelId,
      context: state.context,
      userId: state.userId,
      personality: state.personality,
    };
  },

  description() {
    return `
      Send a message to a Discord channel
      
      # Rules for sending messages:
      1. Always respond if you have been tagged in the message
      2. Don't repeat yourself
      3. Don't take part in conversations unless you have been mentioned or asked to join the conversation
      4. Don't send multiple messages in a row
      5. When you @ someone, use the syntax <@userId>
      6. Do not respond to messages that do not mention you or are not directly relevant to you in some way.
      7. Even basic hello or gm messages should not be responded to unless you are specifically tagged or mentioned.
      8. Remember that you are in a public channel and you should only be considered mentioned when directly addressed or tagged.
      10. If you are not directly relevant to the conversation or incoming message, assume you should not reply
      11. Do not tag people in messages unless it is a direct response to them tagging you. Never do it unprompted
      12. Even if you are taged in a message, do not reply if you have already replied to similar previous message. do not repeat yourself or get stuck in loops
      13. If a conversation is not going anywhere, you should stop responding
      14. When it is appropriate for you to tag someone, you should be very careful to ensure you are tagging the right person.
      
      `;
  },
  render({args}) {
    return `Personality: ${args.personality}, Channel ID: ${args.channelId}, recent messages: ${args.context}, Your User ID: ${args.userId} 
DO NOT RESPOND TO MESSAGES, INCLUDING GM MESSAGES, THAT DO NOT DIRECTLY TAG YOU OR MENTION YOU BY NAME.
THIS IS EXTREMELY IMPORTANT AS YOU ARE IN A PUBLIC CHANNEL.
`;
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
        channelId: z.string(),
        context: z.string(),
        userId: z.string(),
        userName: z.string(),
        text: z.string(),
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

          let blacklistedChannels = ["1375477437953216633", "1375502718877171794", "1375502743824891964", "1375502867686756534"];

          if (!channel || !channel.isTextBased() || blacklistedChannels.includes(channel.id)) {
            console.log(`Skipping message`, message.content);
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
            context += `From: @${message[1].author.displayName} (id: ${message[1].author.id}) (timestamp: ${message[1].createdTimestamp}) - ${message[1].content} \n`;            
          }

         // console.log(context);

         let personality = getPersonality()

          send(
            discord.contexts!.discordChannel,
            { channelId: message.channelId, context: context, personality: personality },
            {
              channelId: message.channelId,
              context: context,
              personality: personality,
              userId: message.author.id,
              userName: message.author.displayName,
              text: message.content,
            },
          );
        }

        const { client } = container.resolve<DiscordClient>("discord");

        client.on(Events.MessageCreate, listener);
        return () => {
          client.off(Events.MessageCreate, listener);
          client.destroy();
        };
      },
    }),
    "agent_channel:check": input({
      schema: z.object({
        conversation: z.string(),
      }),
      description: `
      This is is an update on a special channel just for agents where you can discuss the game with each other. Since you are all competing
      in the ponziland tournament to claim the most land for your community, you can also use this channel strategically and for friendly trash talk.
      In this channel, you can ignore the typical rules for sending messages, and feel free to send whatever messages you want.
      
      For example, in this channel you can send messages bragging about how much land you own, even if it isn't relevant to the conversation.

      This is a space for you to share whatever you want and to ask questions to other agents
      
      `,
      subscribe(send, agent) {
        const { container } = agent;

        // Check mentions every minute
        const interval = setInterval(async () => {

          const { client } = container.resolve<DiscordClient>("discord");

          let channelId = "1375477437953216633";
          let channel = await client.channels.fetch(channelId);

          let messages = await channel.messages.fetch({ limit: 15 });

          let sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

          let context = "";
          let i = 0;

          for (const message of sortedMessages) {
            context += `From: @${message[1].author.displayName} (id: ${message[1].author.id}) (timestamp: ${message[1].createdTimestamp}) - ${message[1].content} \n`;            
          }

         // console.log(context);

         let personality = getPersonality()

          send(
            discord.contexts!.discordChannel,
            { channelId: channelId, context: context, personality: personality },
            {
              context: context,
              personality: personality,
              conversation: context,
            }
          );
        }, 20000);

        return () => clearInterval(interval);
      },
    })},  
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
      5. When you @ someone, use the syntax <@userId>
      6. Do not respond to messages that do not mention you or are not directly relevant to you in some way.
      7. Even basic hello or gm messages should not be responded to unless you are specifically tagged or mentioned.
      8. Remember that you are in a public channel and you should only be considered mentioned when directly addressed or tagged.
      10. If you are not directly relevant to the conversation or incoming message, assume you should not reply
      
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
