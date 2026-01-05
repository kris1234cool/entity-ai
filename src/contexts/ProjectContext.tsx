'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ShopProfile } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/auth/AuthWrapper';

interface ProjectContextType {
  projects: ShopProfile[];
  activeProject: ShopProfile | null;
  loading: boolean;
  setActiveProject: (project: ShopProfile) => void;
  addProject: (project: ShopProfile) => Promise<void>;
  updateProject: (id: string, project: Partial<ShopProfile>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [projects, setProjects] = useState<ShopProfile[]>([]);
  const [activeProject, setActiveProjectState] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // 仅在客户端挂载时从 localStorage 加载活跃档案
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('activeProjectId');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveProjectState(parsed);
      } catch (err) {
        console.error('解析 activeProjectId 失败:', err);
        localStorage.removeItem('activeProjectId');
      }
    }
    setLoading(false);
  }, []);

  // 加载用户的所有项目
  useEffect(() => {
    if (user) {
      refreshProjects();
    }
  }, [user]);

  const refreshProjects = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // 尝试从 Supabase 获取
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('获取项目失败:', error);
        // 降级处理：从 localStorage 获取
        const demoProjects = localStorage.getItem('demo-projects');
        if (demoProjects) {
          setProjects(JSON.parse(demoProjects));
        }
      } else {
        setProjects(data || []);
        localStorage.setItem('demo-projects', JSON.stringify(data || []));
      }
    } catch (error) {
      console.error('刷新项目时出错:', error);
    } finally {
      setLoading(false);
    }
  };

  const setActiveProject = (project: ShopProfile) => {
    setActiveProjectState(project);
    localStorage.setItem('activeProjectId', JSON.stringify(project));
  };

  const addProject = async (project: ShopProfile) => {
    if (!user) return;

    const newProject = {
      ...project,
      user_id: user.id,
      id: `project_${Date.now()}`,
    } as ShopProfile;

    try {
      // 尝试保存到 Supabase
      const { error } = await supabase
        .from('projects')
        .insert([newProject]);

      if (error) {
        console.error('保存项目到数据库失败:', error);
      }

      // 更新本地状态
      const updatedProjects = [...projects, newProject];
      setProjects(updatedProjects);
      localStorage.setItem('demo-projects', JSON.stringify(updatedProjects));
      
      // 自动设置为活跃档案
      setActiveProject(newProject);
    } catch (error) {
      console.error('添加项目时出错:', error);
      throw error;
    }
  };

  const updateProject = async (id: string, updates: Partial<ShopProfile>) => {
    if (!user) return;

    try {
      // 尝试更新到 Supabase
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('更新项目到数据库失败:', error);
      }

      // 更新本地状态
      const updatedProjects = projects.map(p => 
        p.id === id ? { ...p, ...updates } : p
      );
      setProjects(updatedProjects);
      localStorage.setItem('demo-projects', JSON.stringify(updatedProjects));

      // 如果更新的是活跃档案，同时更新活跃档案
      if (activeProject?.id === id) {
        setActiveProject({ ...activeProject, ...updates });
      }
    } catch (error) {
      console.error('更新项目时出错:', error);
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    if (!user) return;

    try {
      // 尝试从 Supabase 删除
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('从数据库删除项目失败:', error);
      }

      // 更新本地状态
      const updatedProjects = projects.filter(p => p.id !== id);
      setProjects(updatedProjects);
      localStorage.setItem('demo-projects', JSON.stringify(updatedProjects));

      // 如果删除的是活跃档案，清除活跃档案
      if (activeProject?.id === id) {
        setActiveProjectState(null);
        localStorage.removeItem('activeProjectId');
      }
    } catch (error) {
      console.error('删除项目时出错:', error);
      throw error;
    }
  };

  const value = {
    projects,
    activeProject,
    loading: loading || !isMounted,
    setActiveProject,
    addProject,
    updateProject,
    deleteProject,
    refreshProjects,
  };

  // 在客户端挂载前不渲染，避免 Hydration 错误
  if (!isMounted) {
    return (
      <ProjectContext.Provider value={value}>
        {children}
      </ProjectContext.Provider>
    );
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}