import { motion } from 'motion/react'
import { Music2, Facebook, Twitter, Youtube, Instagram } from 'lucide-react'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260429_114316_1c7889ad-2885-410e-b493-98119fee0ddb.mp4'

const linkGroups = [
  { title: 'Discover', links: ['Labs & Workshops', 'Deep Dive Series', 'Global Circle', 'Resource Vault', 'Future Roadmap'] },
  { title: 'The Mission', links: ['Origin Story', 'The Collective', 'Newsroom Hub', 'Join the Team'] },
  { title: 'Concierge', links: ['Get in Touch', 'Legal Privacy', 'User Agreement', 'Report Concern'] },
]

const socials = [
  { Icon: Music2, label: 'Music' },
  { Icon: Facebook, label: 'Facebook' },
  { Icon: Twitter, label: 'Twitter' },
  { Icon: Youtube, label: 'YouTube' },
  { Icon: Instagram, label: 'Instagram' },
]

export default function App() {
  return (
    <main className="relative w-full min-h-[115vh] overflow-x-hidden flex flex-col items-center font-sans selection:bg-white/20 selection:text-white">
      <video
        className="fixed inset-0 w-full h-full object-cover z-[0]"
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="relative z-10 w-full max-w-7xl flex-1 flex flex-col items-center px-4 md:px-8 pt-24 pb-8">
        {/* Placeholder CTA */}
        <div className="text-center text-white">
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight">Clarity on a cosmic scale.</h1>
          <a
            href="../ai.html"
            className="liquid-glass inline-block mt-8 rounded-full px-8 py-3 text-sm text-white hover:bg-white/10 transition-colors"
          >
            Try the AI script writer
          </a>
        </div>

        <div className="flex-1 w-full flex items-end">
          <motion.footer
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
            className="liquid-glass w-full rounded-3xl p-6 md:p-10 text-white/70 mt-32 md:mt-64"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 mb-10">
              <div className="md:col-span-5">
                <div className="flex items-center gap-3 text-white mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M 4.688 136 C 68.373 136 120 187.627 120 251.312 C 120 252.883 119.967 254.445 119.905 256 L 0 256 L 0 136.096 C 1.555 136.034 3.117 136 4.688 136 Z M 251.312 136 C 252.883 136 254.445 136.034 256 136.096 L 256 256 L 136.095 256 C 136.032 254.438 136.001 252.875 136 251.312 C 136 187.627 187.627 136 251.312 136 Z M 119.905 0 C 119.967 1.555 120 3.117 120 4.688 C 120 68.373 68.373 120 4.687 120 C 3.117 120 1.555 119.967 0 119.905 L 0 0 Z M 256 119.905 C 254.445 119.967 252.883 120 251.312 120 C 187.627 120 136 68.373 136 4.687 C 136 3.117 136.033 1.555 136.095 0 L 256 0 Z" /></svg>
                  <span className="text-xl font-medium">LUMINA</span>
                </div>
                <p className="text-sm leading-relaxed max-w-sm">
                  Lumina provides premium clarity on global events and cosmic wonders - shared with all for free.
                </p>
              </div>

              <div className="md:col-span-7 grid grid-cols-3 gap-6">
                {linkGroups.map((group) => (
                  <div key={group.title}>
                    <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">{group.title}</h4>
                    <ul className="text-xs space-y-2">
                      {group.links.map((link) => (
                        <li key={link}>
                          <a href="#" className="hover:text-white transition-colors">{link}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
              <p className="text-[10px] uppercase tracking-widest opacity-50">Curated by @GotInGeorgiG</p>
              <div className="flex items-center gap-4">
                <span className="text-[10px] uppercase tracking-widest opacity-50">Join the Journey:</span>
                <div className="flex items-center gap-4">
                  {socials.map(({ Icon, label }) => (
                    <a key={label} href="#" aria-label={label} className="opacity-70 hover:opacity-100 transition-colors hover:text-white">
                      <Icon size={16} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.footer>
        </div>
      </div>
    </main>
  )
}
