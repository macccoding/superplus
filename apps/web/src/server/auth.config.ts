import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@superplus/db';

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Phone + PIN',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.pin) return null;

        const phone = credentials.phone as string;
        const pin = credentials.pin as string;

        const user = await db.user.findUnique({
          where: { phone },
          include: { store: true },
        });

        if (!user || !user.isActive) return null;

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
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
};
