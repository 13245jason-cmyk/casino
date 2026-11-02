import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-2xl border border-[#e2e8e2] bg-white', className)} {...props} />
  );
}
