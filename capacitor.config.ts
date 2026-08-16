import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nishadi.pos',
  appName: 'NishadiPOS',
  webDir: 'public', // 👈 out නෙමෙයි, දැන් public දෙන්න
  server: {
    url: 'https://nishadi-enterprise-suite.vercel.app', // 👈 ඔයාගේ Live Vercel ලින්ක් එක
    cleartext: true
  }
};

export default config;