import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/lib/userContext";
import { ThemeProvider } from "./providers";
import { Analytics } from "@vercel/analytics/next";

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
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <UserProvider>
            {children}
            <Analytics />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
