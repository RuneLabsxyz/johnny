import { z } from "zod";
import { context } from "../../../fork/daydreams/packages/core/src/context";
import { service } from "../../../fork/daydreams/packages/core/src/serviceProvider";
import { TwitterClient } from "./twitter-client";
import { extension, input, output } from "../../../fork/daydreams/packages/core/src";
import { formatXml } from "../../../fork/daydreams/packages/core/src/xml";

// Define Twitter context
const twitterContext = context({
  type: "twitter:thread",
  key: ({ tweetId }) => tweetId.toString(),
  schema: z.object({
    tweetId: z.string(),
  }),
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
        username: z.string(),
        text: z.string(),
      }),
      format: (data) =>
        formatXml({
          tag: "tweet",
          params: { tweetId: data.tweetId, from: data.username },
          content: data.text,
        }),
      subscribe(send, { container }) {
        const twitter = container.resolve<TwitterClient>("twitter");

        // Check mentions every minute
        const interval = setInterval(async () => {
          const mentions = await twitter.checkMentions();


          for await (const mention of mentions) {
            console.log("Mention", mention);
            
            send(
              twitterContext,
              { tweetId: mention.metadata.tweetId || "" },
              {
                tweetId: mention.metadata.tweetId || "",
                userId: mention.metadata.userId || "",
                username: mention.metadata.username || "",
                text: mention.content,
              }
            );
          }

        }, 250000);

        return () => clearInterval(interval);
      },
    }),
  },

  outputs: {
    "twitter:reply": output({
      schema: z.object({
        content: z.string().max(280),
        inReplyTo: z.string(),
      }),
      description: "Use this to reply to a tweet",

      handler: async (data, ctx, { container }) => {
        const twitter = container.resolve<TwitterClient>("twitter");
        const { tweetId } = await twitter.sendTweet({
          content: data.content,
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
      format: ({ data }) =>
        formatXml({
          tag: "tweet-reply",
          params: { tweetId: data.tweetId },
          content: data.content,
        }),
    }),

    "twitter:tweet": output({
      schema: z.object({
        content: z.string().max(280).describe("tweet content, keep it short"),
        reasoning: z.string().optional()
      }),
      description: "Use this to post a new tweet. Remember not to include any slashes in your response, And remember tweest are outputs, not actions",

      handler: async (data, ctx, { container }) => {
        const twitter = container.resolve<TwitterClient>("twitter");

        console.log(data);
        await twitter.sendTweet({
          content: data.content,
        });
        return {
          data,
          timestamp: Date.now(),
        };
      },

      format: ({ data }) =>
        formatXml({
          tag: "tweet",
          content: data.content,
        }),
    }),
  },
});
