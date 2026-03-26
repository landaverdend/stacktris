import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateName(name: string, cap: number): string {
  return name.length > cap ? name.slice(0, cap) + '...' : name;
}
