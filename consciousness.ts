import { input, formatXml } from "../fork/daydreams/packages/core/src";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { context } from "../fork/daydreams/packages/core/src";
import { character } from "./characters/quain";

let openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

const consciousnessContext = context({
  type: "consciousness",
  key: ({ userId }) => userId.toString(),
  schema: z.object({
    userId: z.string(),
  }),
});

export const consciousness = input({
    schema: z.object({
      text: z.string(),
    }),
    format: (data) =>
      formatXml({
        tag: "consciousness",
        content: data.text,
      }),
    subscribe(send, { container }) {
      // Check mentions every minute
      const interval = setInterval(async () => {
  
        let res = await generateText({ 
          model: openrouter("google/gemini-2.0-flash-001"),
          prompt: "Give me a random thought you want to share on social media considering the following character information: " + character + `don't make the post itself, just say something like "I want to tweet about x"`,
          temperature: 0.5,
        })
  
        console.log('new thought: ' + res.text)

        send(consciousnessContext, { userId: "1" }, { text: res.text })
        
      }, 300000);
  
      return () => clearInterval(interval);
    },
  });