import { db } from '@superplus/db';
import { LoginClient } from './login-client';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const users = await db.user.findMany({
    where: { isActive: true },
    include: { store: true },
    orderBy: { fullName: 'asc' },
  });

  const staff = users.map(u => ({
    id: u.id,
    fullName: u.fullName,
    firstName: u.fullName.split(' ')[0],
    initials: u.fullName.split(' ').map(n => n[0]).join('').toUpperCase(),
    role: u.role,
    storeName: u.store.name,
  }));

  return <LoginClient staff={staff} />;
}
