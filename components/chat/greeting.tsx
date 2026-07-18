import { motion } from "framer-motion";

export const Greeting = () => (
  <div className="flex flex-col items-center px-4" key="overview">
    {/* biome-ignore lint/performance/noImgElement: local asset; next/image adds nothing here */}
    <motion.img
      alt="ASELSAN"
      animate={{ opacity: 1, y: 0 }}
      // The PNG has generous transparent padding around the wordmark;
      // negative margins collapse it so the mark sits tight to the text.
      // White artwork: invert to dark in light mode, keep as-is in dark.
      className="-mt-[150px] -mb-[90px] h-[360px] w-auto select-none invert md:h-[410px] dark:invert-0"
      draggable={false}
      initial={{ opacity: 0, y: 10 }}
      src={"/images/asel_logo.png"}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    />
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 text-center font-semibold text-2xl tracking-tight text-foreground md:text-3xl"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      What can I help with?
    </motion.div>
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 text-center text-muted-foreground/80 text-sm"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      Ask a question, explore ideas to secure the beyond, the future and our
      country.
    </motion.div>
  </div>
);
