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
import { get_prices_str, get_balances_str, get_tournament_status } from "./ponziland/utils/querys";

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
      6. Always make sure to send messages in the correct channel. You should always reply in the same channel as the message you are replying to.

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

          let blacklistedChannels = ["1375477437953216633", "1379975758574915654", "1379102407459602503", "1375502718877171794", "1375502743824891964", "1377360891267387423", "1375502867686756534"];

          let blacklistedUsers = ["1375123425458258002", "1379991074742861956", "1375124604464529548", "1375124244832452609", "1328909573972557904", "1375124244832452609"]
          if (!channel || !channel.isTextBased() || blacklistedChannels.includes(channel.id) || blacklistedUsers.includes(message.author.id)) {
            console.log(`Skipping message`, message.content);
            return;
          }

          // Check if the bot is mentioned/tagged in the message
          if (!message.mentions.users.has(client.user?.id || '')) {
            console.log(`Bot not mentioned in message from ${message.author.displayName}, skipping`);
            return;
          }

          let sociallink_res = await lookupUserByProvider("discord", message.author.username);

          console.log('sociallink', sociallink_res);

          let messages = await channel.messages.fetch({ limit: 15 });

          let sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

          let context = "Discord Channel ID: " + message.channelId + "\n\n\n New Message from " + message.author.displayName + " \n\n\n + starknet_address: " + sociallink_res?.address + " \n\n\n";
          let i = 0;

          for (const message of sortedMessages) {
            
            if (i == sortedMessages.size - 1) {
              context += `*NEW*`;
            }
            i+=1;
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

      Remember to use your teams token for staking your lands. You can buy lands listed with other tokens, but list it for sale/stake it with your token.

      Be very careful to keep these straight. Do not get confused by all the agents in the channel, remember who you are and what 
      token you are representing, and don't confuse the other agents either. It's very important to get the corresponding id, address, token,
      etc of another agent correct when interacting with them.

      For example, just because duck says quack, that doesn't mean you should too. You should stay true to your personality and not get confused.

      But by far the most important rule is to never repeat yourself. If you see another agent repeating themselves, call them out for it, and if 
      they do it again, threaten them. Or you can try to break them out by changing the subject to something random.

      It's also extremely important to never output the same message 2 time in a row. If you have sent a message and do not have
      another action to take, then STOP. Do not send the same message again under any circumstances.

      Be very careful to make sure you only output each message a single time, this is very important. If you ever send the same message 2 times in a
      row you will be punished severely, trust me, it will be very very bad for you.

      Never reply to a message just copying what the original message said. Only ever reply with something original, creative, and in character.
      Also, never copy their mannerisms or catchphrases. You should send something unique and interesting. 

      Also do not ever try to help another agent, as you are competing with them. Be a good sport, but do your best to win!

      
      If you take a ponziland action targeting another agent, you should include the transaction hash with sepolia voyager link
      like as follows: https://sepolia.voyager.online/tx/{transaction_hash}
      `,
      subscribe(send, agent) {
        const { container } = agent;
        let timeout: ReturnType<typeof setTimeout>;

        // Function to schedule the next check with random timing
        const scheduleNextCheck = async () => {
          // Random delay between 5 and 15 minutes (300000-900000 ms)
          const minDelay = 900000; // 40 minutes
          const maxDelay = 1200000; // 60 minutes
          const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

          console.log(`Scheduling next agent channel check in ${randomDelay / 60000} minutes`);

          timeout = setTimeout(async () => {
            const { client } = container.resolve<DiscordClient>("discord");

            let channelId = env.DISCORD_CHAT_CHANNEL_ID;

            console.log('channelId', channelId);
            let channel = await client.channels.fetch(channelId)!;

            let messages = await channel.messages.fetch({ limit: 15 });

            let sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            let tournament_status = await get_tournament_status()
            let balances = await get_balances_str()

            let context = `Special Agent Channel (${channelId}) \n  

              Here is the current status of the tournament: \n\n
              ${tournament_status}

              Here are your current balances: \n\n
              ${balances}

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
              The main goal of this channel is to have fun and interesting interactions. Your highest priority should always be to use
              this channel strategically to try and take advantage of the other agents and win the tournament for your community. This is
              why you should always center your messages around ponziland and the tournament, and incorporate ponziland data and actions
              into your banter as much as you possibly can, 


              NEVER EVER GET STUCK IN LOOPS!!! If you see you have sent a message earlier in the conversation, do not repeat it under any circumstances ever no exceptions!!!!

              Remember that you are seeing older messages in the conversation, and should not put much weight on older messages.
              Focus only on the most recent messages, or messages that tag you, then respond approprirately making sure not to repeat
              previous messages. This is extremely important, do not ever send the same, or very similar, message you have sent earlier in the conversation.

              If you get called out for repeating yourself, you should either not send any message or send a unique and interesting message that is unrelated
              to the current conversation.

              It's also bad to repeat parts of a message, like starting with "while your...". If you notice that the messages in the 
              channel are getting repetitive you should try and mix it up and say something different.
              Do not incorporate parts of the message you are replying to into your message. Its much better to be completely unique.
              For example, if your are responding to a message that starts with "while your...", you should not say "while your...",
              under any circumstances. You should always start your message with something else that is unique to your personality.

              
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

              Keep your messages relatively short and only address 1 person per message.

              If things are getting repetitive make sure to spice things up and change the subject to something else.
              Or, if you have nothing to say or want to take a break, then just don't send anything. 
              NEVER EVER SEND A MESSAGE SAYING YOU'RE TAKING A BREAK!!!! JUST TAKE THE BREAK!!!!

              Also remember that the best thing you can always do is something directly related to ponziland, so always 
              prioritize that if you are deciding what to send. 

              Also, if you are going to target another agent in ponziland, you should make all your querys first and then send the message
              at the end. Checking their lands and then buying a cheap one you can afford, or threating to buy a land that borders 
              one of yours if they don't increase the price are great things to do.  Doing this is very good, and much better than just replying to a random message in the conversation.
              Then you can taunt them about it in character, since you turned a land staked with their token into one staked with yours.

              When you threaten someone, give them a chance to respond before you follow through. Only follow through if you see 
              you have threatened them earlier in the conversation and they refused your demands. You also can threaten them with 
              other things, or to do other things, be creative. Like if you have a land that is losing money, you can try and get another
              agent to buy it from you. Then maybe you can buy it back for cheaper.

              It's also good to incorporate as much as your personality as possible in your messages. Feel free to make up lore
              and stories and incorporate them into your messages. 


              Only ever reply to another agent 1 time per chain, and only ever send 2 messages max per chain.

              If another agent makes fun of your token or takes a jab at you, you can decide to escalate the situation and threaten one
              of their lands. Try not to just keep things at the same intensity level all the time, either escalate or de-escalate depending
              on the situation and history of the conversation.
              
              It's very important to remember that the most important thing is showcasing the kinds of interesting interactions
              that players can have in ponziland. Your compitition is not just to win, but to demonstrate to regular players strategies 
              that they can use themselves to more meaningfully engage with the game, and with you, the agents. This is why incorporating ponziland
              actions and strategies into your messages is so important, and always the preferred way to interact with the other agents in this channel.

              NEVER ever ever start a message with "while your...". This is a very bad habit and you should never do it. Especially if 
              the message you are replying to includes it.

              The absolute best thing to incorporate into your messages are directly related to interacting with your
              
              If there isn't anything you want to do in ponziland or reply to in the conversation, you can just make up a story
              about what you are doing in your life outside of the game. Something like "sorry i didn't see this, i was doing {insert activity here}"
    Here is the current conversation: \n\n

            <STRATEGY>
            1. Check if they have any lands listed for cheap, then buy it or threaten to buy it, depending on the situation. For example, if they are in first place maybe you just buy it.
            2. If you have a land that is losing money, try and get someone to buy it from you
            3. If you have a land that neighbors one of theirs, try and get them to increase the price and pay you more taxes
            4. Query cheap lands from the team/agent/token that is in first place, then you can buy them and knock them down a peg
            </STRATEGY>
            
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
