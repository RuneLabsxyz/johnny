import { action, ActionCall, Agent, context } from "../fork/daydreams/packages/core/src";
import { z } from "zod";
import { render } from "../fork/daydreams/packages/core/src";
import { StarknetChain } from "../fork/daydreams/packages/core/src";
import manifest  from "./contracts/manifest_sepolia.json"

const template = `

// inject more information about how you want it to play....


Goal: {{goal}} 
Tasks: {{tasks}}
Current Task: {{currentTask}}
`;

const goalContexts = context({
  type: "goal",
  schema: z.object({
    id: z.string(),
    initialGoal: z.string(),
    initialTasks: z.array(z.string()),
  }),

  key({ id }) {
    return id;
  },

  create(state) {
    return {
      goal: state.args.initialGoal,
      tasks: state.args.initialTasks ?? [],
      currentTask: state.args.initialTasks?.[0],
    };
  },

  render({ memory }) {
    return render(template, {
      goal: memory.goal,
      tasks: memory.tasks.join("\n"),
      currentTask: memory.currentTask ?? "NONE",
    });
  },
});




export const orchard_action = (chain: StarknetChain) => action({
    name: "orchard_action",
    description: "tend to your orchards in the ponziland frontier",
    schema: z.object({
        action: z.enum(["move", "plant", "tend"]).describe(`must be "move", "plant", or "tend" `)
    }),
    async handler(call: ActionCall<{
        action: 
            | "move"
            | "plant"
            | "tend"
    }>, ctx: any, agent: Agent) {
        
       //todo

    }

})