import { input, formatXml } from "../fork/daydreams/packages/core/src";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { context } from "../fork/daydreams/packages/core/src";

let openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!,
  });

const consciousnessContext = context({
  type: "twitter-consciousnesss",
  key: ({ thoughtId }) => thoughtId.toString(),
  schema: z.object({
    thoughtId: z.string(),
    thought: z.string(),
  }),
  render: ({ thoughtId, thought }) => {
    return `Thought ${thoughtId}: ${thought}`;
  }
});

export const consciousness = (prompt: string) => input({
    schema: z.object({
      text: z.string(),
    }),
    subscribe(send, { container }) {
      // Check mentions every minute
      let index = 0;
      let timeout: ReturnType<typeof setTimeout>;

      // Function to schedule the next thought with random timing
      const scheduleNextThought = async () => {
        // Random delay between 3 and 10 minutes (180000-600000 ms)
        const minDelay = 1000000; // 3 minutes
        const maxDelay = 2400000; // 10 minutes
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
        console.log(`Scheduling next thought in ${randomDelay/60000} minutes`);
        
        timeout = setTimeout(async () => {
          let res = await generateText({ 
            model: openrouter("google/gemini-2.0-flash-001"),
            prompt,
            temperature: 0.7,
          });
    
          console.log('new thought: ' + res.text);
          send(consciousnessContext, { thoughtId: "twitter-thought: " + index , thought: res.text }, { text: "Twitter " + res.text });
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