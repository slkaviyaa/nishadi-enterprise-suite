'use client'
import { useState, useEffect } from 'react'
import { Inter } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/src/components/SplashScreen"; // අර ඔයාගේ කම්පෝනන්ට් එක

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // තත්පර 2කින් Web Splash Screen එක අයින් වෙනවා
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>
        {loading ? <SplashScreen /> : children}
      </body>
    </html>
  );
}