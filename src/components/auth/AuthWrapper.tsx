'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { UserProfile } from '@/types';
import { createClient } from '@/utils/supabase/client';

// localStorage key for lead capture mode
const USER_MOBILE_KEY = 'user_mobile';

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (phone: string) => void;
  signOut: () => void;
  updateProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 从数据库获取用户 profile
  const fetchProfileFromDB = useCallback(async (phone: string) => {
    try {
      const supabase = createClient();
      const userId = `lead_${phone}`;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (data && !error) {
        setProfile({
          id: data.id,
          phone: data.phone,
          membership_level: data.membership_level || 'free',
          membership_expire_at: data.membership_expire_at || '',
          daily_usage_count: data.daily_usage_count || 0,
          max_daily_usage: data.max_daily_usage || 100,
        });
      } else {
        // 如果数据库没有记录，使用默认值
        setProfile({
          id: userId,
          phone,
          membership_level: 'free',
          membership_expire_at: '',
          daily_usage_count: 0,
          max_daily_usage: 100,
        });
      }
    } catch (err) {
      console.error('获取用户档案失败:', err);
    }
  }, []);

  // 检查 localStorage 中的用户手机号（线索收集模式）
  useEffect(() => {
    const checkLocalSession = async () => {
      const storedMobile = localStorage.getItem(USER_MOBILE_KEY);
      
      if (storedMobile) {
        // 设置用户对象
        setUser({ phone: storedMobile, id: `lead_${storedMobile}` });
        setIsAuthenticated(true);
        
        // 从数据库获取用户档案
        await fetchProfileFromDB(storedMobile);
      }
      
      setLoading(false);
    };

    checkLocalSession();
  }, [fetchProfileFromDB]);

  // 线索收集模式的登录：直接保存手机号到 localStorage
  const signIn = async (phone: string) => {
    localStorage.setItem(USER_MOBILE_KEY, phone);
    setUser({ phone, id: `lead_${phone}` });
    setIsAuthenticated(true);
    // 从数据库获取用户档案
    await fetchProfileFromDB(phone);
  };

  const signOut = () => {
    localStorage.removeItem(USER_MOBILE_KEY);
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
  };

  // 线索收集模式：本地更新档案
  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!user) return;
    setProfile(prev => prev ? { ...prev, ...profileData } : null);
  };

  // 刷新用户档案（从数据库重新获取）
  const refreshProfile = async () => {
    const storedMobile = localStorage.getItem(USER_MOBILE_KEY);
    if (storedMobile) {
      await fetchProfileFromDB(storedMobile);
    }
  };

  const value = {
    user,
    profile,
    loading,
    isAuthenticated,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}