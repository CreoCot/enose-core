import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  it('cn merges and resolves tailwind conflicts correctly', () => {
    // 1. Простая склейка (нет конфликтов)
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
    
    // 2. Разрешение конфликтов (p-4 перекрывает px-2 и py-1)
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
    
    // 3. Разрешение конфликтов цветов (последний выигрывает)
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });
});