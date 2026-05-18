import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@superplus/db';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000; // 1 minute

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(phone);
  if (record && now < record.resetAt) {
    if (record.count >= MAX_ATTEMPTS) return false;
    record.count++;
    return true;
  }
  loginAttempts.set(phone, { count: 1, resetAt: now + COOLDOWN_MS });
  return true;
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: 'Phone + PIN',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.pin) return null;

        const identifier = credentials.phone as string;
        const pin = credentials.pin as string;

        if (!checkRateLimit(identifier)) return null;

        // Look up by ID (from user-select login) or phone (fallback)
        const user = await db.user.findFirst({
          where: {
            OR: [{ id: identifier }, { phone: identifier }],
            isActive: true,
          },
          include: { store: true },
        });

        if (!user || !user.store) return null;

        const pinValid = await compare(pin, user.pinHash);
        if (!pinValid) return null;

        return {
          id: user.id,
          name: user.fullName,
          role: user.role,
          storeId: user.storeId,
          storeName: user.store.name,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.storeId = (user as any).storeId;
        token.storeName = (user as any).storeName;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.storeId = token.storeId as string;
      session.user.storeName = token.storeName as string;
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
};
