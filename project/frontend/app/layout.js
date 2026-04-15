import "./globals.css";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata = {
  title: "OpsMind AI",
  description: "AI DevOps incident intelligence with memory-backed fix generation",
  manifest: "/manifest.json",
  icons: {
    icon: "/6F1E559E-0C07-40B9-8C4C-C151F5B31A6A_1_201_a.jpeg?v=20260415",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>{children}</body>
    </html>
  );
}
