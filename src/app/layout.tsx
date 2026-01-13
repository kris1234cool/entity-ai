import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthWrapper } from '@/components/auth/AuthWrapper';
import { ProjectProvider } from '@/contexts/ProjectContext';
import BottomNav from '@/components/BottomNav';
import { Toaster } from '@/components/ui/sonner';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "AI文案助手",
  description: "为实体店老板量身定制的AI短视频脚本生成工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <AuthWrapper>
          <Toaster position="top-center" richColors />
          <ProjectProvider>
            <div className="min-h-screen bg-slate-50 relative overflow-hidden">
              {/* Background Blobs */}
              <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[100px] animate-pulse"></div>
              <div className="fixed bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-purple-200/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
              <div className="fixed top-[40%] right-[20%] w-[30%] h-[30%] bg-indigo-200/20 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '4s' }}></div>

              {/* Mobile Container with BottomNav */}
              <div className="relative z-10 w-full md:max-w-[480px] mx-auto min-h-screen md:shadow-2xl md:border-x md:border-white/20 bg-white/10 backdrop-blur-[2px] pb-20">
                {children}
              </div>

              <BottomNav />
            </div>
          </ProjectProvider>
        </AuthWrapper>
      </body>
    </html>
  );
}
