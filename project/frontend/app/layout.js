export const metadata = {
  title: "OpsMind AI",
  description: "AI DevOps incident intelligence with memory-backed fix generation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
