import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Hikvision attendance",
  description: "Live attendance and people management for a DS-K1T342MFWX-E1 terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <div className="top">
            <div>
              <h1>Hikvision attendance</h1>
              <div className="muted">DS-K1T342MFWX-E1 · face, fingerprint, and card</div>
            </div>
            <Nav />
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
