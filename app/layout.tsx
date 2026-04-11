import type { Metadata } from "next";
import "./globals.css";
import { ModeProvider } from "@/lib/context/mode-context";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "DeepDiveNote - AI 会议录音转写系统",
  description: "利用大模型自动将会议录音转换为结构化的逐字稿和会议纪要",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <ModeProvider>
          {children}
          <Toaster />
        </ModeProvider>
      </body>
    </html>
  );
}
