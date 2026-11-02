import * as React from 'react';
import { cn } from '@/lib/utils';
export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-lg border border-[#dce3de] bg-white px-3 py-2 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
