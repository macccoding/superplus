'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OperationsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/operations/checklists');
  }, [router]);

  return null;
}
