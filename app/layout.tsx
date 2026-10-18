import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dark Knights | Cricket Portal",
  description: "Player availability and match-day leave management for Dark Knights Cricket Club.",
  applicationName: "Dark Knights Cricket Portal"
};
export const viewport: Viewport = { themeColor: "#101116", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
