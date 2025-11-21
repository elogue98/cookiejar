import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/lib/userContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cookie Jar",
  description: "Your personal recipe collection",
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
        </UserProvider>
      </body>
    </html>
  );
}
