/**
 * 设备 ID 和本地存储管理工具
 */

const DEVICE_ID_KEY = 'app_device_id';
const GENERATION_COUNT_KEY = 'app_generation_count';
const GENERATION_DATE_KEY = 'app_generation_date';
const LICENSE_KEY = 'app_license_info';

/**
 * 获取或创建设备 ID
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // 生成新的设备 ID
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

/**
 * 获取今天的生成次数
 */
export function getTodayGenerationCount(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const today = new Date().toDateString();
  const lastDate = localStorage.getItem(GENERATION_DATE_KEY);
  
  // 如果日期不同，重置计数
  if (lastDate !== today) {
    localStorage.setItem(GENERATION_DATE_KEY, today);
    localStorage.setItem(GENERATION_COUNT_KEY, '0');
    return 0;
  }
  
  const count = localStorage.getItem(GENERATION_COUNT_KEY);
  return parseInt(count || '0', 10);
}

/**
 * 增加生成次数
 */
export function incrementGenerationCount(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const today = new Date().toDateString();
  const lastDate = localStorage.getItem(GENERATION_DATE_KEY);
  
  let count: number;
  
  // 如果日期不同，重置计数
  if (lastDate !== today) {
    localStorage.setItem(GENERATION_DATE_KEY, today);
    count = 1;
  } else {
    count = getTodayGenerationCount() + 1;
  }
  
  localStorage.setItem(GENERATION_COUNT_KEY, count.toString());
  return count;
}

/**
 * 检查是否在免费限额内
 */
export function isWithinFreeLimit(limit: number = 5): boolean {
  return getTodayGenerationCount() < limit;
}

/**
 * 保存许可证信息到本地存储
 */
export function saveLicenseInfo(info: {
  membershipLevel: 'premium' | 'enterprise';
  expiresAt: string;
  mobile: string;
  code: string;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(LICENSE_KEY, JSON.stringify({
    ...info,
    activatedAt: new Date().toISOString(),
  }));
}

/**
 * 获取许可证信息
 */
export function getLicenseInfo(): any | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const info = localStorage.getItem(LICENSE_KEY);
  if (!info) return null;

  try {
    const parsed = JSON.parse(info);
    
    // 检查是否已过期
    const expiresAt = new Date(parsed.expiresAt);
    if (expiresAt < new Date()) {
      // 已过期，清除
      removeLicenseInfo();
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to parse license info:', error);
    return null;
  }
}

/**
 * 检查许可证是否有效
 */
export function isLicenseValid(): boolean {
  return getLicenseInfo() !== null;
}

/**
 * 移除许可证信息
 */
export function removeLicenseInfo(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(LICENSE_KEY);
}

/**
 * 清除所有本地缓存（用于测试）
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(GENERATION_COUNT_KEY);
  localStorage.removeItem(GENERATION_DATE_KEY);
  localStorage.removeItem(LICENSE_KEY);
}
