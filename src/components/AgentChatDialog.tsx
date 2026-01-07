'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Sparkles, X, ChevronLeft, MoreHorizontal, AlertCircle } from 'lucide-react';
import { ScriptType, ConversionGoal, ScriptResult } from '@/types';
import { getAgentConfig, CONVERSION_GOALS } from '@/lib/agent-config';
import ScriptCard from './ScriptCard';
import { useAuth } from './auth/AuthWrapper';

interface Message {
  role: 'ai' | 'user';
  content: string;
  scriptResult?: ScriptResult;
}

interface AgentChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  scriptType: ScriptType;
  shopProfile: any;
}

export default function AgentChatDialog({
  isOpen,
  onClose,
  scriptType,
  shopProfile
}: AgentChatDialogProps) {
  const { user } = useAuth();
  const agentConfig = getAgentConfig(scriptType);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [conversionGoal, setConversionGoal] = useState<ConversionGoal>('涨粉');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGoalSelector, setShowGoalSelector] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化对话 - 显示 AI 开场白
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = shopProfile 
        ? agentConfig.greeting 
        : `嗨！我是${agentConfig.name}。

⚠️ 提示：您还未选择店铺档案，我将以通用模式为您生成内容。如需生成针对您特定店铺的内容，请先在"我的"页面选择或创建档案。

现在就来试试吧！`;
      
      setMessages([{
        role: 'ai',
        content: greeting
      }]);
      setShowGoalSelector(true);
    }
  }, [isOpen, agentConfig.greeting, agentConfig.name, messages.length, shopProfile]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating) return;

    // 添加用户消息
    const newUserMessage: Message = {
      role: 'user',
      content: userInput
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsGenerating(true);
    setShowGoalSelector(false);

    try {
      // 调用 API 生成脚本
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 线索收集模式：传递手机号
      if (user?.phone) {
        headers['x-user-phone'] = user.phone;
      }
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          scriptType,
          conversionGoal,
          topic: userInput,
          shopProfile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 处理不同的错误状态
        if (response.status === 403 && data.shouldShowUpgradeDialog) {
          // 限制错误
          const errorMessage: Message = {
            role: 'ai',
            content: `⚠️ ${data.error}

${data.message}

请点击「我的」页面的「兑换会员」升级为 VIP 会员获得无限生成权限！`
          };
          setMessages(prev => [...prev, errorMessage]);
        } else {
          throw new Error(data.error || `生成失败: ${response.statusText}`);
        }
        return;
      }

      const result: ScriptResult = data;

      // 添加 AI 回复消息（带脚本结果）
      const aiMessage: Message = {
        role: 'ai',
        content: `✨ 太棒了！我已经为你生成了专属脚本。这个脚本结合了${shopProfile ? '你的店铺特色和' : ''} ${conversionGoal} 的目标，可以直接使用哦！`,
        scriptResult: result
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('生成脚本时出错:', error);
      
      // 添加错误消息
      const errorMessage: Message = {
        role: 'ai',
        content: '😅 抱歉，生成脚本时遇到了问题。请稍后再试，或者换个方式描述你的需求。'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="fixed top-0 left-0 translate-x-0 translate-y-0 w-full h-[100dvh] m-0 p-0 rounded-none border-none bg-slate-50 flex flex-col shadow-none max-w-none z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 duration-300 ease-in-out"
        onOpenAutoFocus={(e) => e.preventDefault()}
        showCloseButton={false}
        showOverlay={false}
      >
        {/* Native Navigation Bar */}
        <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-20 pt-safe">
          <button
            onClick={onClose}
            className="w-10 h-10 -ml-2 flex items-center justify-center text-blue-600 active:opacity-50 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex-1 text-center px-4 overflow-hidden">
            <h2 className="text-[17px] font-semibold text-slate-900 truncate tracking-tight">
              {agentConfig.name}
            </h2>
          </div>

          <div className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400">
            <MoreHorizontal className="w-5 h-5" />
          </div>
        </div>

        {/* Chat Area - Scrollable */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full">
            <div className="px-4 pt-4 pb-32 space-y-4">
              {/* 档案警告 - 如果没有店铺档案 */}
              {!shopProfile && (
                <div className="bg-amber-100/80 border border-amber-300 rounded-lg p-3 mb-2 flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold mb-1">💡 未选择店铺档案</p>
                    <p>现在以通用模式生成。为获得针对性更强的内容，建议先在"我的"页面添加店铺档案。</p>
                  </div>
                </div>
              )}
              
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'ai' && (
                    <div className="flex-shrink-0 mr-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm shadow-sm">
                        {agentConfig.icon}
                      </div>
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${message.role === 'user' ? 'order-1' : ''}`}>
                    <div
                      className={`rounded-[20px] px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm border border-gray-100'
                      }`}
                    >
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    {/* 如果有脚本结果，显示脚本卡片 */}
                    {message.scriptResult && (
                      <div className="mt-4 -mx-2">
                        <ScriptCard script={message.scriptResult} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* 生成中的加载动画 */}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="flex-shrink-0 mr-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm shadow-sm">
                      {agentConfig.icon}
                    </div>
                  </div>
                  <div className="bg-white rounded-[20px] px-4 py-2.5 shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                      <span className="text-[15px] text-slate-700">AI 正在创作中...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Bottom Input Area - Fixed iMessage Style */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 py-3 pb-safe z-30">
          {/* 转化目标选择器 - 更加精简 */}
          {showGoalSelector && (
            <div className="mb-3 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar py-1">
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">🎯 目标:</span>
              <div className="flex gap-2">
                {CONVERSION_GOALS.map(goal => (
                  <button
                    key={goal}
                    onClick={() => setConversionGoal(goal)}
                    className={`px-3 py-1 rounded-full text-[13px] transition-all whitespace-nowrap ${
                      conversionGoal === goal 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-500 active:bg-slate-200'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end space-x-2">
            <div className="flex-1 bg-slate-100 rounded-[20px] px-4 py-1.5 min-h-[38px] flex items-center">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={agentConfig.placeholder}
                className="w-full bg-transparent border-none text-slate-900 text-[15px] placeholder:text-slate-400 focus:ring-0 resize-none max-h-32 py-1"
                rows={1}
                disabled={isGenerating}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isGenerating}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white shadow-sm rounded-full w-9 h-9 p-0 flex-shrink-0 mb-0.5"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}