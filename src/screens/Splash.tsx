import { motion } from 'framer-motion'

export default function Splash() {
  return (
    <motion.div
      className="min-h-dvh relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #135555 0%, #1A7070 45%, #00897B 100%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute -top-16 -left-20 w-64 h-64 rounded-full"
        style={{ background: 'radial-gradient(circle at 30% 30%, #26C6DA, #00897B)', opacity: 0.55, filter: 'blur(2px)' }}
      />
      <div
        className="absolute top-10 right-[-60px] w-72 h-72 rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 35%, #E0F7F5, #80DEDB)', opacity: 0.35 }}
      />
      <div
        className="absolute bottom-24 left-[-40px] w-40 h-40 rounded-full"
        style={{ background: 'radial-gradient(circle at 30% 30%, #B2EBE6, #00B8A9)', opacity: 0.4 }}
      />
      <div
        className="absolute -bottom-28 right-[-50px] w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 35%, #00B8A9, #135555)', opacity: 0.6 }}
      />

      {/* Logo + wordmark */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4 px-8"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <img
          src="/healthkaki_logo.png"
          alt="HealthKaki"
          className="w-64 max-w-[70vw] h-auto"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
        <p className="text-white text-lg tracking-wide">Healthcare, made clear.</p>
      </motion.div>
    </motion.div>
  )
}
