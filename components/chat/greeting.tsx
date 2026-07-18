import { motion } from "framer-motion";
import { AselsanLogo } from "@/components/aselsan-logo";
import { ACP_AGENTS, getAcpAgent, isAcpAgentId } from "@/lib/acp/agents";

type GreetingProps = {
  selectedAgentId: string;
};

export const Greeting = ({ selectedAgentId }: GreetingProps) => {
  const agent = isAcpAgentId(selectedAgentId)
    ? getAcpAgent(selectedAgentId)
    : ACP_AGENTS[0];

  return (
    <div className="flex flex-col items-center px-4" key="overview">
      {/* The PNG has generous transparent padding around the wordmark;
          negative margins collapse it so the mark sits tight to the text. */}
      <AselsanLogo className="-mt-[150px] -mb-[90px] h-[360px] md:h-[410px]" />
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1 text-center font-semibold text-2xl tracking-tight md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="text-primary">I am {agent.label},</span>
        <span className="text-foreground">What can I help with?</span>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-center text-muted-foreground/80 text-sm"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {agent.greetingTagline}
      </motion.div>
    </div>
  );
};
