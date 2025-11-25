import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/lib/userContext";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const faviconPath = "/icon.png";

export const metadata: Metadata = {
  title: "Cookie Jar",
  description: "Your personal recipe collection",
  icons: {
    icon: [
      {
        url: faviconPath,
        type: "image/png",
        sizes: "any",
      },
    ],
    shortcut: [{ url: faviconPath, type: "image/png" }],
    apple: [{ url: faviconPath, type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <body
        className={`${inter.variable} font-sans antialiased`}
        style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
      >
        <UserProvider>
          {children}
          <Analytics />
        </UserProvider>
      </body>
    </html>
  );
}
