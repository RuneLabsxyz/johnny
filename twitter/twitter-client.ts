import { Scraper, SearchMode, type Tweet } from "agent-twitter-client";
import type { JSONSchemaType } from "ajv";
import { Logger } from "@daydreamsai/core";
import { LogLevel } from "@daydreamsai/core";
import { z } from "zod";

const envSchema = z.object({
  TWITTER_USERNAME: z.string(),
  TWITTER_PASSWORD: z.string(),
  TWITTER_EMAIL: z.string(),
  DRY_RUN: z
    .preprocess((val) => val === "1" || val === "true", z.boolean())
    .default(true),
});

export interface TwitterCredentials {
  username: string;
  password: string;
  email: string;
}

export interface TweetData {
  content: string;
  inReplyTo?: string;
  conversationId?: string;
}

// Schema for tweet output validation
export const tweetSchema: JSONSchemaType<TweetData> = {
  type: "object",
  properties: {
    content: { type: "string" },
    inReplyTo: { type: "string", nullable: true },
    conversationId: { type: "string", nullable: true },
  },
  required: ["content"],
  additionalProperties: false,
};

export class TwitterClient {
  private scraper: Scraper;
  private isInitialized: boolean = false;
  private lastCheckedTweetId: bigint | null = null;
  private logger: Logger;

  private env: z.infer<typeof envSchema>;
  constructor(
    private credentials: TwitterCredentials,
    logLevel: LogLevel = LogLevel.INFO
  ) {
    this.scraper = new Scraper();
    this.logger = new Logger({
      level: logLevel,
      enableColors: true,
      enableTimestamp: true,
    });

    this.env = envSchema.parse(process.env);
  }

  async initialize() {
    if (!this.isInitialized) {
      try {
        let cookie = [process.env.TWITTER_COOKIES];
   //
    //    this.scraper.setCookies(cookie);
        console.log('scraper cookies', await this.scraper.getCookies())

        console.log(cookie)
        await this.scraper.login(
          this.credentials.username,
          this.credentials.password,
        );

        let cookies = await this.scraper.getCookies();

        console.log(cookies);
        this.isInitialized = true;
        this.logger.info("TwitterClient", "Initialized successfully");
      } catch (error) {
        this.logger.error("TwitterClient", "Failed to initialize", {
          error,
        });
        throw error;
      }
    }
  }

  async checkMentions() {
    try {
      this.logger.debug("TwitterClient.checkMentions", "Checking mentions", {
        username: this.credentials.username,
      });

      const mentions = await this.scraper.fetchSearchTweets(
        `@${this.credentials.username}`,
        20,
        SearchMode.Latest
      );

      // Convert AsyncGenerator to array and process
      const mentionsArray: Tweet[] = [];
      for await (const mention of mentions.tweets) {
        if (mention) {
          let hasReplied = await this.checkHasRepliedToTweet(mention.conversationId!, mention.id!);


          if (hasReplied) {
            continue;
          }
          else {
            console.log("Unreplied to tweet: ", mention)

          }
          mentionsArray.push(mention);

          if (
            this.lastCheckedTweetId &&
            BigInt(mention.id ?? "") <= this.lastCheckedTweetId
          ) {
            continue;
          }
        }
      }
      console.log(mentionsArray)
      // Filter and format mentions

      let res = mentionsArray.map(this.formatTweetData)
      console.log('res', res)
      // Only return if we have new mentions
      return res.length > 0 ? res : [];
    } catch (error) {
      this.logger.error(
        "TwitterClient.checkMentions",
        "Error checking mentions",
        { error }
      );
      throw error;
    }
  }

  async fetchUserTweets(username: string): Promise<Tweet[]> {
    const tweets: Tweet[] = [];
    try {
      for await (const tweet of this.scraper.getTweets(username, 10)) {
        tweets.push(tweet);
      }
    } catch (error) {
      this.logger.error(
        "TwitterClient.fetchUserTweets",
        "Error fetching tweets",
        { error }
      );
      throw error;
    }
    return tweets;
  }


  async sendTweet(data: TweetData) {
    try {
      this.logger.info("TwitterClient.sendTweet", "Would send tweet", {
        data,
      });

      if (this.env.DRY_RUN) {
        return {
          success: true,
          tweetId: "DRY RUN TWEET ID",
        };
      }

      const sendTweetResults = await this.scraper.sendTweet(
        data.content,
        data?.inReplyTo
      );

      return {
        success: true,
        tweetId: await sendTweetResults.json(),
      };
    } catch (error) {
      this.logger.error("TwitterClient.sendTweet", "Error sending tweet", {
        error,
      });
      throw error;
    }
  }

  async checkHasRepliedToTweet(conversationId: string, tweetId: string): Promise<boolean> {
    const query = `conversation_id:${conversationId} from:${this.credentials.username}`;
    const search = (await this.scraper.searchTweets(query, 250, SearchMode.Latest));

    for await (const tweet of search) {
      if (tweet.username?.toLowerCase() === this.credentials.username.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  private formatTweetData(mention: Tweet) {
    let tweet = mention;
    console.log(tweet)
    let res =  {
      type: "tweet",
      content: tweet.text ?? "",
      metadata: {
        tweetId: tweet.id,
        userId: tweet.userId,
        username: tweet.username,
        timestamp: new Date(tweet.timestamp ?? ""),
        metrics: {
          likes: tweet.likes,
          retweets: tweet.retweets,
          replies: tweet.replies,
        },
        isRetweet: tweet.isRetweet,
        isReply: tweet.isReply,
        hasMedia: tweet.photos.length > 0 || tweet.videos.length > 0,
        url: tweet.permanentUrl,
        conversationId: tweet.conversationId,
        inReplyToId: tweet.inReplyToStatusId,
      },
    };

    return res
  }
}



// Example usage:
/*
const twitter = new TwitterClient({
  username: "mybot",
  password: "pass",
  email: "bot@example.com"
});

// Register inputs
core.registerInput(twitter.createMentionsInput());
core.registerInput(twitter.createTimelineInput("elonmusk"));

// Register output
core.registerOutput(twitter.createTweetOutput());
*/

