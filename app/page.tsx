"use client";

import { MainPage } from '@/components/MainPage';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black">
      <MainPage onStart={() => router.push('/setup')} />
    </main>
  );
}
