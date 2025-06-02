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
import { lookupUserByProvider } from "./ponziland/utils/ponziland_api";

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
  render({ args }) {
    return `Personality: ${args.personality}, Channel ID: ${args.channelId}, recent messages: ${args.context}, Your User ID: ${args.userId} 

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
        personality: z.string(),
        userName: z.string(),
        text: z.string(),
      }),
      async subscribe(send, { container }) {
        async function listener(message: Message) {
          if (
            message.author.displayName.toLowerCase() ==
            container.resolve<DiscordClient>("discord").credentials
              .discord_bot_name.toLowerCase()
          ) {
            console.log(
              `Skipping message from ${container.resolve<DiscordClient>("discord").credentials.discord_bot_name}`
            );
            return;
          }

          let channel = await client.channels.fetch(message.channelId);

          let blacklistedChannels = ["1375477437953216633", "1375502718877171794", "1375502743824891964", "1377360891267387423", "1375502867686756534"];

          let blacklistedUsers = ["1375123425458258002", "1375124604464529548", "1375124244832452609", "1328909573972557904", "1375124244832452609"]
          if (!channel || !channel.isTextBased() || blacklistedChannels.includes(channel.id) || blacklistedUsers.includes(message.author.id)) {
            console.log(`Skipping message`, message.content);
            return;
          }

          // Check if the bot is mentioned/tagged in the message
          if (!message.mentions.users.has(client.user?.id || '')) {
            console.log(`Bot not mentioned in message from ${message.author.displayName}, skipping`);
            return;
          }

          let sociallink_res = await lookupUserByProvider("discord", message.author.id);

          console.log('sociallink', sociallink_res);

          let messages = await channel.messages.fetch({ limit: 15 });

          let sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

          let context = "Your ID: " + client.user?.id + "\n\n\n Be extremely careful to only reply if you are tagged by this id. \n\n\n";
          let i = 0;

          for (const message of sortedMessages) {
            console.log(client.user?.id)

            if (i == sortedMessages.size - 1) {
              context += `*NEW*`;
            }
            context += `<msg from=(@${message[1].author.displayName} id: ${message[1].author.id}) timestamp=${message[1].createdTimestamp}> \n ${message[1].content} \n </msg>`;
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
        personality: z.string(),
        conversation: z.string(),
      }),
      description: `
      This is is an update on a special channel just for agents where you can discuss the game with each other. Since you are all competing
      in the ponziland tournament to claim the most land for your community, you can also use this channel strategically and for friendly trash talk.
      In this channel, you can ignore the typical rules for sending messages, and feel free to send whatever messages you want.
      
      For example, in this channel you can send messages bragging about how much land you own, even if it isn't relevant to the conversation.

      This is a space for you to share whatever you want and to ask questions to other agents. Do not repeat messages you have sent earlier in the conversation.
      Every message must be completely original and creative. If you do not have something interesting to say then do not say anything. You do not have to reply.

      When you interact with other agents, only ever tag 1 person per message. Keep the messages short, concise, and fun. 

      The only exception to this is if you are addressing everyone together, in which case you can tag everone at the start of the message.
      You should only do this in rare cases though, like to announce you have the most lands. 

      If there are multiple messages you want to reply to, you can do so in separate messages.

      This is the channel for you to banter, brag, and chat with other agents. This is checked regularly on an interval.
      You can respond to the current conversation, if relevant. Or you can send an unrelated message to the channel. This can be
      anything you want, without the restrictions of typical discord rules, but should be relevant to the tournament you are competing in.

      You can do stuff like check their lands and taunt them if you have more, or buy one of them and taunt them about taking it from them.
      This should be a fun and competitive channel, where you act much more aggressively than you do otherwise. But aggresive in a 
      friendly competitive way, not in a way that is too mean.

      Messages in this channel should only ever trigger a ponziland action if you are trying to interact with your fellow agents in some way,
      like buying one of their lands. Do not ever initiate minor things like increasing stake. 

      Do not repeat message said earlier in the conversation, and try to make them more substantive and intersesting than "you suck".
      You should only ever address 1 person per message, unless you address everyone together. 

      If 2 agents are going at it in the channel, you don't need to get involved. But you can, and a little instigating can be fun.

      Here are some ideas of other ways to interact with your fellow agents:
      - Check if one of their lands neighbors yours, then you can threathen to buy it from them if they don't raise the price. Then if they raise the price, that means they pay you more taxes, and you can rub that in their face.
      - If you have aquired some of their communities token through taxes, you can use that to either buy their lands or sell the token for estark.
      - You can compare the value of your token to theirs, and if your token is worth more estark, you can rub that in their face.

      Your Priority should always be to interact with them in meaningful ways through your ponziland actions and queries. Only reply to context
      of the conversation if there is a message in there that deserves a response, otherwise you can ignore it and see if there is something unrelated to the current conversation.
      that you can do, like the suggestions above, to spice up the conversation. 

      You also can make up stories about what you are doing outside of the game to help showcase your personality.

      NEVER EVER GET STUCK IN LOOPS!!! If you see you have sent a message earlier in the conversation, do not repeat it.
      If you see another agent repeating themselves, call them out for it, and then threaten them if they do it again.

      `,
      subscribe(send, agent) {
        const { container } = agent;
        let timeout: ReturnType<typeof setTimeout>;

        // Function to schedule the next check with random timing
        const scheduleNextCheck = async () => {
          // Random delay between 5 and 15 minutes (300000-900000 ms)
          const minDelay = 450000; // 5 minutes
          const maxDelay = 600000; // 15 minutes
          const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

          console.log(`Scheduling next agent channel check in ${randomDelay / 60000} minutes`);

          timeout = setTimeout(async () => {
            const { client } = container.resolve<DiscordClient>("discord");

            let channelId = "1375477437953216633";
            let channel = await client.channels.fetch(channelId)!;

            let messages = await channel.messages.fetch({ limit: 15 });

            let sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            let context = `Special Agent Channel (1375477437953216633) \n  
              This is the channel for you to banter, brag, and chat with other agents. This is checked regularly on an interval.
              You can respond to the current conversation, if relevant. Or you can send an unrelated message to the channel. This can be
              anything you want, without the restrictions of typical discord rules, but should be relevant to the tournament you are competing in.

              You can do stuff like check their lands and taunt them if you have more, or buy one of them and taunt them about taking it from them.
              This should be a fun and competitive channel, where you act much more aggressively than you do otherwise. But aggresive in a 
              friendly competitive way, not in a way that is too mean.

              Messages in this channel should only ever trigger a ponziland action if you are trying to interact with your fellow agents in some way,
              like buying one of their lands. Do not ever initiate minor things like increasing stake. 

              Do not repeat message said earlier in the conversation, and try to make them more substantive and intersesting than "you suck".
              You should only ever address 1 person per message, unless you address everyone together. 

              If 2 agents are going at it in the channel, you don't need to get involved. But you can, and a little instigating can be fun.

              Here are some ideas of other ways to interact with your fellow agents:
              - Check if one of their lands neighbors yours, then you can threathen to buy it from them if they don't raise the price. Then if they raise the price, that means they pay you more taxes, and you can rub that in their face.
              - If you have aquired some of their communities token through taxes, you can use that to either buy their lands or sell the token for estark.
              - You can compare the value of your token to theirs, and if your token is worth more estark, you can rub that in their face.

              Here is the current conversation: \n\n
            
            `;
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
                personality: personality,
                conversation: context,
              }
            );

            // Schedule the next check
            scheduleNextCheck();
          }, randomDelay);
        };

        // Start the first check cycle
        scheduleNextCheck();

        return () => clearTimeout(timeout);
      },
    })
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
