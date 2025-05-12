import { z } from "zod";
import { action, context, render } from "../../../fork/daydreams/packages/core/src";
import { service } from "../../../fork/daydreams/packages/core/src";
import { TwitterClient } from "./twitter-client";
import { extension, input, output } from "../../../fork/daydreams/packages/core/src";
import { formatXml } from "../../../fork/daydreams/packages/core/src";
import { personality } from "../../characters/ponzius";
import { Tweet } from "agent-twitter-client";
const template = `

  Make sure to tweet in character, and to base all tweets off the given input tweet or thought.

  
  <personality>
    {{personality}}
  </personality>
`;

// Define Twitter context
const twitterContext = context({
  type: "twitter:thread",
  key: ({ tweetId }) => tweetId.toString(),
  schema: z.object({
    personality: z.string(),
    tweetId: z.string(),
  }),

  async render({ memory }) {
    return render(template, {
      personality: personality
    });
  },
});

// Twitter service setup
const twitterService = service({
  register(container) {
    container.singleton(
      "twitter",
      () =>
        new TwitterClient({
          username: process.env.TWITTER_USERNAME!,
          password: process.env.TWITTER_PASSWORD!,
          email: process.env.TWITTER_EMAIL!,
        })
    );
  },
  async boot(container) {
    const twitter = container.resolve<TwitterClient>("twitter");
    await twitter.initialize();
    console.log("Twitter client initialized");
  },
});

export const twitter = extension({
  name: "twitter",
  services: [twitterService],
  contexts: {
    twitter: twitterContext,
  },
  inputs: {
    "twitter:mentions": input({
      schema: z.object({
        userId: z.string(),
        tweetId: z.string(),
        text: z.string(),
      }),
      subscribe(send, agent) {
        const { container } = agent;

        const twitter = container.resolve("twitter") as TwitterClient;
        // Check mentions every minute
        const interval = setInterval(async () => {

          const mentions = await twitter.checkMentions(); 

          for (const mention of mentions) {
            let mentionv = await mention;
            console.log("Mention", mentionv.content);

            send(
              twitterContext,
              { tweetId: mentionv.metadata.tweetId || "", personality: personality },
              {
                tweetId: mentionv.metadata.tweetId || "",
                userId: mentionv.metadata.userId || "",
                text: mentionv.content,
              }
            );
          }
        }, 60000);

        return () => clearInterval(interval);
      },
    }),
  },

  actions: [
    action({
      name: "twitter:reply",
      schema: z.object({
        content: z.string().max(280),
        inReplyTo: z.string(),
      }),
      description: "Use this to reply to a tweet",

      handler: async (data, ctx, { container }) => {
        const twitter = container.resolve<TwitterClient>("twitter");
        
        // Remove hashtags at the end of the tweet
        const cleanedContent = data.content.replace(/\s+#\w+\s*$/g, '').trim();
        
        console.log('sending reply', cleanedContent, data.inReplyTo)
        const { tweetId } = await twitter.sendTweet({
          content: cleanedContent,
          inReplyTo: data.inReplyTo,
        });

        return {
          data: {
            ...data,
            tweetId,
          },
          timestamp: Date.now(),
        };
      },
      // format: ({ data }) =>
      //   formatXml({
      //     tag: "tweet-reply",
      //     params: { tweetId: data.tweetId },
      //     children: data.content,
      //   }),
    }),

    action({
      name: "twitter:tweet",
      schema: z.object({
        content: z.string().max(280),
      }),
      description: "Use this to post a new tweet. Remember that tweets are outputs, not actions",

      handler: async (data, ctx, { container }) => {
        const twitter = container.resolve<TwitterClient>("twitter");
        
        // Remove hashtags at the end of the tweet
        const cleanedContent = data.content.replace(/\s+#\w+\s*$/g, '').trim();
        
        console.log('sending tweet', cleanedContent)
        
        await twitter.sendTweet({
          content: cleanedContent,
        });
        return {
          data,
          timestamp: Date.now(),
        };
      },

      // format: ({ data }) =>
      //   formatXml({
      //     tag: "tweet",
      //     children: data.content,
      //   }),
    }),
  ],
});
