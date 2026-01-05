'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Compass, User } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProject } = useProject();

  const tabs = [
    {
      id: 'home',
      label: '发现',
      icon: Compass,
      path: '/dashboard',
    },
    {
      id: 'me',
      label: '我的',
      icon: User,
      path: '/profile',
    },
  ];

  const isActive = (path: string) => pathname === path;

 return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/60 backdrop-blur-xl border-t border-white/40 max-w-[480px] mx-auto md:max-w-[480px]" suppressHydrationWarning>
      <div className="flex items-center justify-around h-16 px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              suppressHydrationWarning
              className={`flex flex-col items-center justify-center gap-1.5 py-2 px-4 rounded-lg transition-all ${
                active
                  ? 'bg-blue-600/20 text-blue-600'
                  : 'text-slate-600 active:bg-slate-100'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 活跃档案徽章 - 在发现页显示 */}
      {isActive('/dashboard') && activeProject && (
        <div suppressHydrationWarning className="absolute -top-10 right-4 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm border border-blue-400/50 whitespace-nowrap">
          当前档案: {activeProject.shop_name}
        </div>
      )}
    </nav>
  );
}
