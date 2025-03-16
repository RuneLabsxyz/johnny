import { input, formatXml } from "../fork/daydreams/packages/core/src";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { context } from "../fork/daydreams/packages/core/src";
import { character } from "./characters/johnny";

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
      let index = 0;
      let timeout: NodeJS.Timeout;

      // Function to schedule the next thought with random timing
      const scheduleNextThought = async () => {
        // Random delay between 3 and 10 minutes (180000-600000 ms)
        const minDelay = 180000; // 3 minutes
        const maxDelay = 3000000; // 10 minutes
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        console.log(`Scheduling next thought in ${randomDelay/60000} minutes`);
        
        timeout = setTimeout(async () => {
          let res = await generateText({ 
            model: openrouter("google/gemini-2.0-flash-001"),
            prompt: "Give me a random thought you want to share on social media considering the following character information: " + character + `don't make the post itself, just say something like "I want to tweet about x"`,
            temperature: 0.5,
          });
    
          console.log('new thought: ' + res.text);
          send(consciousnessContext, { userId: "thought: " + index }, { text: res.text });
          index += 1;
          
          // Schedule the next thought
          scheduleNextThought();
        }, randomDelay);
      };
      
      // Start the first thought cycle
      scheduleNextThought();
  
      return () => clearTimeout(timeout);
    },
  });