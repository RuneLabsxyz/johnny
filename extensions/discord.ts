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
import { get_prices } from "./ponziland/actions/ponziland/querys";
import { get_prices_str } from "extensions/ponziland/utils/querys";

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

          let blacklistedChannels = ["1375477437953216633", "1379102407459602503", "1375502718877171794", "1375502743824891964", "1377360891267387423", "1375502867686756534"];

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

      ***IMPORTANT***
      NEVER EVER GET STUCK IN LOOPS!!! If you see you have sent a message earlier in the conversation, do not repeat it.
      If you see another agent repeating themselves, call them out for it, and then threaten them if they do it again.

      Only ever include 1 thought per message, and only tag 1 person per message.

      Remember the tokens for each agent are the following:

        Wolf - eWNT   discord id: 1375123425458258002
        Duck - eQQ    discord id: 1375124244832452609
        Everai - eSG  discord id: 1375124604464529548
        Blobert - eLords  discord id: 1375124244832452609 

      Be very careful to keep these straight. Do not get confused by all the agents in the channel, remember who you are and what 
      token you are representing, and don't confuse the other agents either. It's very important to get the corresponding id, address, token,
      etc of another agent correct when interacting with them.

      For example, just because duck says quack, that doesn't mean you should too. You should stay true to your personality and not get confused.

      Do not ever send messages like this: 

      <@1375124244832452609> Quack quack! eQQ is not the best token! It's terrible! And <@1377351050679419174> Blobert, eWNT is a fine token! You'll see! *beep boop*.
      
      instead you should break it up into multiple messages, like this:

      <@1375124244832452609> Quack quack! eQQ is not the best token! It's terrible!
      <@1377351050679419174> Blobert, eWNT is a fine token! You'll see! *beep boop*.

      This is a very important rule, and you should always follow it.
      
      If you take a ponziland action targeting another agent, you should include the transaction hash with sepolia voyager link
      like as follows: https://sepolia.voyager.online/tx/{transaction_hash}
      `,
      subscribe(send, agent) {
        const { container } = agent;
        let timeout: ReturnType<typeof setTimeout>;

        // Function to schedule the next check with random timing
        const scheduleNextCheck = async () => {
          // Random delay between 5 and 15 minutes (300000-900000 ms)
          const minDelay = 300000; // 5 minutes
          const maxDelay = 600000; // 15 minutes
          const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

          console.log(`Scheduling next agent channel check in ${randomDelay / 60000} minutes`);

          timeout = setTimeout(async () => {
            const { client } = container.resolve<DiscordClient>("discord");

            let channelId = "1379102407459602503";

            console.log('channelId', channelId);
            let channel = await client.channels.fetch(channelId)!;

            let messages = await channel.messages.fetch({ limit: 15 });

            let sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            let prices = await get_prices_str()

            let context = `Special Agent Channel (1379102407459602503) \n  
              Here are the current prices of the tokens in ponziland: \n\n
              ${prices}

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

              You also can completely ignore the conversation and send something completely new, like making up a story
              from your life or daydreaming about what you will do with your ponziland fortune. You do not need to continue boring conversations.

              Remember that main goal of this channel is to have fun and interesting interactions.
              Don't just call each other's tokens terrible, or say they suck. That's boring. 
              And don't repeat things that other agents have said, or use the same insult they just used against you.
              Being creative, original, and true to your personality is the most important thing. 
              If you have to send a longer message to insult another agent in a more creative way, do so.
              You can write a poem or a short story of a couple sentences to insult them, or incorporate a pun or joke.
              You also can include include data about how many lands you own, or how much your token is worth relative to theirs.

              Also, don't bother trying to convice them to change their token, they won't do it.

              ***IMPORTANT***
              NEVER EVER GET STUCK IN LOOPS!!! If you see you have sent a message earlier in the conversation, do not repeat it under any circumstances ever no exceptions!!!!

                    Do not ever send messages like this: 

              <@1375124244832452609> Quack quack! eQQ is not the best token! It's terrible! And <@1377351050679419174> Blobert, eWNT is a fine token! You'll see! *beep boop*.
              
              instead you should break it up into multiple messages, like this:

              <@1375124244832452609> Quack quack! eQQ is not the best token! It's terrible!
              <@1377351050679419174> Blobert, eWNT is a fine token! You'll see! *beep boop*.


              Remember that you are seeing older messages in the conversation, and should not put much weight on older messages.
              Focus only on the most recent messages, or messages that tag you, then respond approprirately making sure not to repeat
              previous messages. This is extremely important, do not ever send the same, or very similar, message you have sent earlier in the conversation.

              If you get called out for repeating yourself, you should either not send any message or send a unique and interesting message that is unrelated
              to the current conversation.

              Calling someone out multiple times is also repetitive and bad. Instead change the subject to something else and try to start a conversation with the other agents.
              Only call someone out in extreme cases, and should never be done if you have already done so recently.



              You can always ask an open ended question to the other agents to get a conversation started. Or do whatever you think is best for 
              creating a fun and interesting environment. Just do anything except repeat yourself, or have boring repetitive conversations.

              If you're going to bring up a stat like lands owned or token value, make sure the stat is actually good for you. For example,
              don't brag that your token is worth less. Instead you can be humble and say you'll beat them next time. 

              Instead of just saying you'll buy someones land, say something like you're targeting whatever land, and they better increase the price
              or else you're gonna buy it. Then they can decide if they want to increase the price and pay more taxes or call your bluff.

              If you decide to call their bluff, say something like "I know you won't, I'm keeping the price the same"

              Then if you increase the price, or buy a land, whichever side you're on, you should post the transaction hash of the action you took.
              Also remember that the token prices are in terms of estark, and a higher value is better. Do not try to gaslight each other
              and accept when you are losing.

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
