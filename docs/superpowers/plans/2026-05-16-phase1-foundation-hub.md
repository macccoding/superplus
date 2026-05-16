# Phase 1: Foundation + Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working hub app where SuperPlus staff can manage tasks, communicate in threads, write logbook entries, and read announcements — with phone+PIN auth and multi-tenant store scoping.

**Architecture:** Single Next.js 16 app with subdomain middleware routing. tRPC for type-safe API layer backed by Prisma 7 + Neon PostgreSQL. NextAuth 5 handles phone+PIN credentials with JWT sessions. Turborepo monorepo with shared packages for DB, UI, and config.

**Tech Stack:** Next.js 16, Prisma 7, Neon PostgreSQL, NextAuth 5, tRPC 11, Tailwind v4, Turborepo, pnpm, Vitest, Vercel

---

## File Structure

```
superplus/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   │   ├── login/page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── (hub)/
│       │   │   │   ├── layout.tsx
│       │   │   │   ├── page.tsx
│       │   │   │   ├── tasks/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── [id]/page.tsx
│       │   │   │   ├── threads/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── [id]/page.tsx
│       │   │   │   ├── logbook/page.tsx
│       │   │   │   └── announcements/page.tsx
│       │   │   ├── (admin)/
│       │   │   │   ├── layout.tsx
│       │   │   │   ├── page.tsx
│       │   │   │   ├── people/page.tsx
│       │   │   │   ├── activity/page.tsx
│       │   │   │   └── stores/page.tsx
│       │   │   ├── api/
│       │   │   │   ├── auth/[...nextauth]/route.ts
│       │   │   │   └── trpc/[trpc]/route.ts
│       │   │   ├── layout.tsx
│       │   │   └── globals.css
│       │   ├── server/
│       │   │   ├── auth.ts
│       │   │   ├── auth.config.ts
│       │   │   └── trpc/
│       │   │       ├── init.ts
│       │   │       ├── router.ts
│       │   │       └── routers/
│       │   │           ├── tasks.ts
│       │   │           ├── threads.ts
│       │   │           ├── logbook.ts
│       │   │           ├── announcements.ts
│       │   │           ├── users.ts
│       │   │           └── stores.ts
│       │   ├── lib/
│       │   │   ├── trpc-client.ts
│       │   │   └── trpc-server.ts
│       │   └── middleware.ts
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   └── index.ts
│   │   ├── prisma.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/
│   │   ├── src/
│   │   │   ├── icon-grid.tsx
│   │   │   ├── bottom-nav.tsx
│   │   │   ├── app-shell.tsx
│   │   │   ├── task-card.tsx
│   │   │   ├── thread-card.tsx
│   │   │   ├── log-entry-card.tsx
│   │   │   ├── announcement-banner.tsx
│   │   │   ├── empty-state.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── config/
│       ├── src/
│       │   ├── brand.ts
│       │   ├── roles.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

---

## Task 1: Scaffold Monorepo

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.gitignore`, `.npmrc`
- Create: `packages/config/package.json`, `packages/config/tsconfig.json`, `packages/config/src/brand.ts`, `packages/config/src/roles.ts`, `packages/config/src/index.ts`
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`

- [ ] **Step 1: Clean existing tracked files and create root configs**

Remove the old git-tracked content (it's already deleted from disk, just need to reset git's index) and create the new root:

```json
// package.json
{
  "name": "superplus",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "db:generate": "turbo db:generate",
    "db:push": "turbo db:push",
    "db:seed": "turbo db:seed"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    }
  }
}
```

```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force"
  }
}
```

```gitignore
# .gitignore
node_modules/
.next/
.turbo/
dist/
.env
.env.local
.env.*.local
*.tsbuildinfo
.vercel
.claude/worktrees/
```

```
# .npmrc
auto-install-peers=true
```

- [ ] **Step 2: Create packages/config**

```json
// packages/config/package.json
{
  "name": "@superplus/config",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

```json
// packages/config/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

```ts
// packages/config/src/brand.ts
export const brand = {
  colors: {
    primary: '#E31837',
    secondary: '#1B3A5C',
    accent: '#F5A623',
    success: '#2ECC71',
    danger: '#E74C3C',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
  },
  radius: {
    card: '12px',
    button: '8px',
    input: '6px',
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
} as const;
```

```ts
// packages/config/src/roles.ts
export const ROLES = ['OWNER', 'MANAGER', 'SUPERVISOR', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  MANAGER: 3,
  SUPERVISOR: 2,
  STAFF: 1,
};

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export type SubdomainApp = 'hub' | 'admin' | 'tools';

export const SUBDOMAIN_ACCESS: Record<SubdomainApp, Role[]> = {
  hub: ['OWNER', 'MANAGER', 'SUPERVISOR', 'STAFF'],
  admin: ['OWNER', 'MANAGER'],
  tools: ['OWNER', 'MANAGER', 'SUPERVISOR', 'STAFF'],
};
```

```ts
// packages/config/src/index.ts
export { brand } from './brand';
export { ROLES, ROLE_HIERARCHY, hasMinRole, SUBDOMAIN_ACCESS } from './roles';
export type { Role, SubdomainApp } from './roles';
```

- [ ] **Step 3: Create packages/ui placeholder**

```json
// packages/ui/package.json
{
  "name": "@superplus/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.8.0"
  }
}
```

```json
// packages/ui/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

```ts
// packages/ui/src/index.ts
// Components will be added in later tasks
```

- [ ] **Step 4: Create packages/db placeholder**

```json
// packages/db/package.json
{
  "name": "@superplus/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/adapter-neon": "^6.0.0",
    "@prisma/client": "^6.0.0",
    "@neondatabase/serverless": "^0.10.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  }
}
```

```json
// packages/db/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist"
  },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 5: Create apps/web scaffold**

```json
// apps/web/package.json
{
  "name": "@superplus/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@superplus/config": "workspace:*",
    "@superplus/db": "workspace:*",
    "@superplus/ui": "workspace:*",
    "@trpc/client": "^11.0.0",
    "@trpc/next": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "@tanstack/react-query": "^5.62.0",
    "next": "^15.3.0",
    "next-auth": "5.0.0-beta.30",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "bcryptjs": "^2.4.3",
    "zod": "^3.24.0",
    "superjson": "^2.2.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.8.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@superplus/ui', '@superplus/config', '@superplus/db'],
};

export default nextConfig;
```

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Install dependencies and verify build**

Run:
```bash
cd /Users/mac/prod/superplus
pnpm install
pnpm turbo typecheck
```

Expected: Install completes, typecheck passes (or warns about empty files — no errors).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold turborepo monorepo with packages and web app"
```

---

## Task 2: Database Schema + Prisma Setup

**Files:**
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma.config.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/prisma/seed.ts`
- Create: `.env.example`

- [ ] **Step 1: Create Prisma schema**

```prisma
// packages/db/prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  OWNER
  MANAGER
  SUPERVISOR
  STAFF
}

enum ThreadCategory {
  GENERAL
  URGENT
  MAINTENANCE
  INVENTORY
  OTHER
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  DONE
  CANCELLED
}

enum LogCategory {
  GENERAL
  INCIDENT
  HANDOVER
  INVENTORY
}

enum AnnouncePriority {
  NORMAL
  IMPORTANT
  CRITICAL
}

model Store {
  id        String   @id @default(cuid())
  name      String
  parish    String
  address   String
  phone     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  users         User[]
  threads       Thread[]
  tasks         Task[]
  logEntries    LogEntry[]
  announcements Announcement[]
}

model User {
  id        String   @id @default(cuid())
  storeId   String
  fullName  String
  phone     String   @unique
  pinHash   String
  role      Role     @default(STAFF)
  email     String?  @unique
  avatarUrl String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  store            Store           @relation(fields: [storeId], references: [id])
  createdThreads   Thread[]        @relation("ThreadAuthor")
  threadMessages   ThreadMessage[]
  createdTasks     Task[]          @relation("TaskCreator")
  assignedTasks    Task[]          @relation("TaskAssignee")
  logEntries       LogEntry[]
  announcements    Announcement[]

  @@index([storeId])
  @@index([phone])
}

model Thread {
  id         String         @id @default(cuid())
  storeId    String
  authorId   String
  title      String
  category   ThreadCategory @default(GENERAL)
  isPinned   Boolean        @default(false)
  isResolved Boolean        @default(false)
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  store    Store           @relation(fields: [storeId], references: [id])
  author   User            @relation("ThreadAuthor", fields: [authorId], references: [id])
  messages ThreadMessage[]

  @@index([storeId, createdAt])
}

model ThreadMessage {
  id        String   @id @default(cuid())
  threadId  String
  authorId  String
  body      String
  createdAt DateTime @default(now())

  thread Thread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  author User   @relation(fields: [authorId], references: [id])

  @@index([threadId, createdAt])
}

model Task {
  id           String     @id @default(cuid())
  storeId      String
  title        String
  description  String?
  category     String?
  createdById  String
  assignedToId String?
  priority     Priority   @default(NORMAL)
  status       TaskStatus @default(OPEN)
  dueDate      DateTime?
  completedAt  DateTime?
  createdAt    DateTime   @default(now())

  store      Store @relation(fields: [storeId], references: [id])
  createdBy  User  @relation("TaskCreator", fields: [createdById], references: [id])
  assignedTo User? @relation("TaskAssignee", fields: [assignedToId], references: [id])

  @@index([storeId, status])
  @@index([assignedToId, status])
}

model LogEntry {
  id        String      @id @default(cuid())
  storeId   String
  authorId  String
  date      DateTime    @db.Date
  body      String
  category  LogCategory @default(GENERAL)
  isFlagged Boolean     @default(false)
  createdAt DateTime    @default(now())

  store  Store @relation(fields: [storeId], references: [id])
  author User  @relation(fields: [authorId], references: [id])

  @@index([storeId, date])
}

model Announcement {
  id        String           @id @default(cuid())
  storeId   String?
  authorId  String
  title     String
  body      String
  priority  AnnouncePriority @default(NORMAL)
  expiresAt DateTime?
  createdAt DateTime         @default(now())

  store  Store? @relation(fields: [storeId], references: [id])
  author User   @relation(fields: [authorId], references: [id])

  @@index([storeId, createdAt])
}
```

- [ ] **Step 2: Create Prisma config and client**

```ts
// packages/db/prisma.config.ts
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
});
```

```ts
// packages/db/src/client.ts
import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

// Required for Neon serverless
neonConfig.useSecureWebSocket = true;

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

```ts
// packages/db/src/index.ts
export { db } from './client';
export type {
  Store,
  User,
  Thread,
  ThreadMessage,
  Task,
  LogEntry,
  Announcement,
} from '@prisma/client';
export {
  Role,
  ThreadCategory,
  Priority,
  TaskStatus,
  LogCategory,
  AnnouncePriority,
} from '@prisma/client';
```

- [ ] **Step 3: Create seed file**

```ts
// packages/db/prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pinHash = await hash('1234', 10);

  const store = await prisma.store.create({
    data: {
      name: 'SuperPlus Mandeville',
      parish: 'Manchester',
      address: '4 Manchester Road, Mandeville',
      phone: '+18769613897',
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Admin Owner',
      phone: '+18760000001',
      pinHash,
      role: Role.OWNER,
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Store Manager',
      phone: '+18760000002',
      pinHash,
      role: Role.MANAGER,
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Floor Supervisor',
      phone: '+18760000003',
      pinHash,
      role: Role.SUPERVISOR,
    },
  });

  await prisma.user.create({
    data: {
      storeId: store.id,
      fullName: 'Cashier Staff',
      phone: '+18760000004',
      pinHash,
      role: Role.STAFF,
    },
  });

  console.log('Seed complete: 1 store, 4 users (PIN: 1234 for all)');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 4: Create .env.example**

```
# .env.example
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/superplus?sslmode=require
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 5: Generate Prisma client and push schema**

Run:
```bash
cd /Users/mac/prod/superplus/packages/db
pnpm db:generate
```

Expected: Prisma client generated successfully.

If a Neon database exists and DATABASE_URL is set:
```bash
pnpm db:push
pnpm db:seed
```

If no database yet, skip push/seed — they'll run once Neon is provisioned.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with all Phase 1 entities and seed data"
```

---

## Task 3: NextAuth Phone+PIN Authentication

**Files:**
- Create: `apps/web/src/server/auth.config.ts`
- Create: `apps/web/src/server/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create auth config with phone+PIN credentials provider**

```ts
// apps/web/src/server/auth.config.ts
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
```

```ts
// apps/web/src/server/auth.ts
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

- [ ] **Step 2: Create NextAuth route handler**

```ts
// apps/web/src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/server/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Create auth types declaration**

```ts
// apps/web/src/types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
      storeId: string;
      storeName: string;
    };
  }
}
```

- [ ] **Step 4: Create login page**

```tsx
// apps/web/src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F8F9FA] p-4">
      {children}
    </div>
  );
}
```

```tsx
// apps/web/src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      phone,
      pin,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Wrong PIN. Try again.');
      setPin('');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E31837] rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">S+</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">SuperPlus</h1>
          <p className="text-[#6B7280] mt-1">Staff Hub</p>
        </div>

        {step === 'phone' ? (
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 876 000 0000"
              className="w-full h-14 px-4 text-lg border-2 border-gray-200 rounded-lg focus:border-[#E31837] focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => phone.length >= 10 && setStep('pin')}
              disabled={phone.length < 10}
              className="w-full h-14 mt-4 bg-[#E31837] text-white text-lg font-semibold rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">
              Enter PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full h-14 px-4 text-center text-3xl tracking-[0.5em] border-2 border-gray-200 rounded-lg focus:border-[#E31837] focus:outline-none"
              autoFocus
            />
            {error && (
              <p className="text-[#E74C3C] text-sm mt-2 text-center">{error}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={pin.length !== 4 || loading}
              className="w-full h-14 mt-4 bg-[#E31837] text-white text-lg font-semibold rounded-lg disabled:opacity-40"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              onClick={() => { setStep('phone'); setPin(''); setError(''); }}
              className="w-full h-12 mt-2 text-[#6B7280] text-sm"
            >
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add NextAuth phone+PIN authentication with login page"
```

---

## Task 4: Subdomain Middleware + Root Layout

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/globals.css`

- [ ] **Step 1: Create subdomain middleware**

```ts
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/server/auth';

const SUBDOMAIN_MAP: Record<string, string> = {
  hub: '/hub',
  admin: '/admin',
  tools: '/tools',
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Skip static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Skip login page
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Auth check — redirect unauthenticated users to login
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Subdomain routing (production only)
  const host = req.headers.get('host') || '';
  const subdomain = host.split('.')[0];

  if (subdomain && subdomain in SUBDOMAIN_MAP && !host.includes('localhost')) {
    const prefix = SUBDOMAIN_MAP[subdomain];

    // Role check for admin subdomain
    if (subdomain === 'admin') {
      const role = req.auth.user?.role;
      if (role !== 'OWNER' && role !== 'MANAGER') {
        return NextResponse.redirect(new URL('/hub', req.url));
      }
    }

    // Rewrite if not already under the prefix
    if (!pathname.startsWith(prefix)) {
      const url = req.nextUrl.clone();
      url.pathname = `${prefix}${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // Local dev: no rewrite needed, path-based routing works directly
  // Default: redirect root to /hub
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/hub', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Create root layout**

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SuperPlus Hub',
  description: 'SuperPlus staff operations platform',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#E31837',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F8F9FA] text-[#1A1A2E] antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create globals.css**

```css
/* apps/web/src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand: #E31837;
  --color-navy: #1B3A5C;
  --color-accent: #F5A623;
  --color-success: #2ECC71;
  --color-danger: #E74C3C;
  --color-surface: #FFFFFF;
  --color-muted: #6B7280;
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-input: 6px;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: "Inter", system-ui, sans-serif;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add subdomain middleware, root layout, and Tailwind v4 theme"
```

---

## Task 5: tRPC Setup

**Files:**
- Create: `apps/web/src/server/trpc/init.ts`
- Create: `apps/web/src/server/trpc/router.ts`
- Create: `apps/web/src/server/trpc/routers/tasks.ts`
- Create: `apps/web/src/server/trpc/routers/threads.ts`
- Create: `apps/web/src/server/trpc/routers/logbook.ts`
- Create: `apps/web/src/server/trpc/routers/announcements.ts`
- Create: `apps/web/src/server/trpc/routers/users.ts`
- Create: `apps/web/src/server/trpc/routers/stores.ts`
- Create: `apps/web/src/app/api/trpc/[trpc]/route.ts`
- Create: `apps/web/src/lib/trpc-client.ts`
- Create: `apps/web/src/lib/trpc-server.ts`

- [ ] **Step 1: Create tRPC initialization with auth context**

```ts
// apps/web/src/server/trpc/init.ts
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { auth } from '@/server/auth';
import { db } from '@superplus/db';
import type { Role } from '@superplus/config';
import { hasMinRole } from '@superplus/config';

export async function createContext() {
  const session = await auth();
  return { session, db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware: require authenticated user
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      storeId: ctx.session.user.storeId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

// Middleware: require minimum role
export function requireRole(minRole: Role) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    if (!hasMinRole(ctx.session.user.role as Role, minRole)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.session.user,
        storeId: ctx.session.user.storeId,
      },
    });
  });
}

export const supervisorProcedure = t.procedure.use(requireRole('SUPERVISOR'));
export const managerProcedure = t.procedure.use(requireRole('MANAGER'));
export const ownerProcedure = t.procedure.use(requireRole('OWNER'));
```

- [ ] **Step 2: Create task router**

```ts
// apps/web/src/server/trpc/routers/tasks.ts
import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure } from '../init';
import { TaskStatus, Priority } from '@superplus/db';

export const tasksRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.nativeEnum(TaskStatus).optional(),
      assignedToMe: z.boolean().optional(),
      unassigned: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId };
      if (input?.status) where.status = input.status;
      if (input?.assignedToMe) where.assignedToId = ctx.user.id;
      if (input?.unassigned) where.assignedToId = null;

      return ctx.db.task.findMany({
        where,
        include: { createdBy: true, assignedTo: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: { createdBy: true, assignedTo: true },
      });
    }),

  create: supervisorProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      category: z.string().max(50).optional(),
      assignedToId: z.string().optional(),
      priority: z.nativeEnum(Priority).optional(),
      dueDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.create({
        data: {
          ...input,
          storeId: ctx.storeId,
          createdById: ctx.user.id,
        },
      });
    }),

  pickup: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.update({
        where: { id: input.id, storeId: ctx.storeId, assignedToId: null },
        data: { assignedToId: ctx.user.id, status: TaskStatus.IN_PROGRESS },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.nativeEnum(TaskStatus),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { status: input.status };
      if (input.status === TaskStatus.DONE) {
        data.completedAt = new Date();
      }
      return ctx.db.task.update({
        where: { id: input.id, storeId: ctx.storeId },
        data,
      });
    }),
});
```

- [ ] **Step 3: Create threads router**

```ts
// apps/web/src/server/trpc/routers/threads.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { ThreadCategory } from '@superplus/db';

export const threadsRouter = router({
  list: protectedProcedure
    .input(z.object({
      category: z.nativeEnum(ThreadCategory).optional(),
      pinnedOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId };
      if (input?.category) where.category = input.category;
      if (input?.pinnedOnly) where.isPinned = true;

      return ctx.db.thread.findMany({
        where,
        include: {
          author: true,
          _count: { select: { messages: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: {
          author: true,
          messages: {
            include: { author: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      category: z.nativeEnum(ThreadCategory).optional(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.thread.create({
        data: {
          storeId: ctx.storeId,
          authorId: ctx.user.id,
          title: input.title,
          category: input.category,
          messages: {
            create: {
              authorId: ctx.user.id,
              body: input.body,
            },
          },
        },
      });
    }),

  reply: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify thread belongs to user's store
      await ctx.db.thread.findFirstOrThrow({
        where: { id: input.threadId, storeId: ctx.storeId },
      });

      const message = await ctx.db.threadMessage.create({
        data: {
          threadId: input.threadId,
          authorId: ctx.user.id,
          body: input.body,
        },
      });

      // Touch thread updatedAt
      await ctx.db.thread.update({
        where: { id: input.threadId },
        data: { updatedAt: new Date() },
      });

      return message;
    }),

  togglePin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      return ctx.db.thread.update({
        where: { id: input.id },
        data: { isPinned: !thread.isPinned },
      });
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.thread.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: { isResolved: true },
      });
    }),
});
```

- [ ] **Step 4: Create logbook router**

```ts
// apps/web/src/server/trpc/routers/logbook.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { LogCategory } from '@superplus/db';

export const logbookRouter = router({
  listByDate: protectedProcedure
    .input(z.object({
      date: z.date().optional(), // defaults to today
    }).optional())
    .query(async ({ ctx, input }) => {
      const date = input?.date ?? new Date();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return ctx.db.logEntry.findMany({
        where: {
          storeId: ctx.storeId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      body: z.string().min(1).max(2000),
      category: z.nativeEnum(LogCategory).optional(),
      isFlagged: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.logEntry.create({
        data: {
          storeId: ctx.storeId,
          authorId: ctx.user.id,
          date: new Date(),
          body: input.body,
          category: input.category,
          isFlagged: input.isFlagged,
        },
      });
    }),

  flagged: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.logEntry.findMany({
        where: { storeId: ctx.storeId, isFlagged: true },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }),
});
```

- [ ] **Step 5: Create announcements router**

```ts
// apps/web/src/server/trpc/routers/announcements.ts
import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { AnnouncePriority } from '@superplus/db';

export const announcementsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.announcement.findMany({
        where: {
          AND: [
            {
              OR: [
                { storeId: ctx.storeId },
                { storeId: null },
              ],
            },
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gte: new Date() } },
              ],
            },
          ],
        },
        include: { author: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      });
    }),

  create: managerProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(2000),
      priority: z.nativeEnum(AnnouncePriority).optional(),
      broadcast: z.boolean().optional(), // null storeId = all stores
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.announcement.create({
        data: {
          storeId: input.broadcast ? null : ctx.storeId,
          authorId: ctx.user.id,
          title: input.title,
          body: input.body,
          priority: input.priority,
          expiresAt: input.expiresAt,
        },
      });
    }),
});
```

- [ ] **Step 6: Create users and stores routers**

```ts
// apps/web/src/server/trpc/routers/users.ts
import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { Role } from '@superplus/db';
import { hash } from 'bcryptjs';

export const usersRouter = router({
  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        include: { store: true },
      });
    }),

  list: managerProcedure
    .input(z.object({ storeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = input?.storeId ?? ctx.storeId;
      return ctx.db.user.findMany({
        where: { storeId },
        orderBy: { fullName: 'asc' },
      });
    }),

  create: managerProcedure
    .input(z.object({
      fullName: z.string().min(1).max(100),
      phone: z.string().min(10).max(15),
      pin: z.string().length(4).regex(/^\d{4}$/),
      role: z.nativeEnum(Role),
    }))
    .mutation(async ({ ctx, input }) => {
      const pinHash = await hash(input.pin, 10);
      return ctx.db.user.create({
        data: {
          storeId: ctx.storeId,
          fullName: input.fullName,
          phone: input.phone,
          pinHash,
          role: input.role,
        },
      });
    }),

  toggleActive: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      return ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: !user.isActive },
      });
    }),

  resetPin: managerProcedure
    .input(z.object({
      id: z.string(),
      newPin: z.string().length(4).regex(/^\d{4}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const pinHash = await hash(input.newPin, 10);
      return ctx.db.user.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: { pinHash },
      });
    }),

  changeMyPin: protectedProcedure
    .input(z.object({
      currentPin: z.string().length(4),
      newPin: z.string().length(4).regex(/^\d{4}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
      });
      const { compare } = await import('bcryptjs');
      const valid = await compare(input.currentPin, user.pinHash);
      if (!valid) throw new Error('Current PIN is incorrect');

      const pinHash = await hash(input.newPin, 10);
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { pinHash },
      });
    }),
});
```

```ts
// apps/web/src/server/trpc/routers/stores.ts
import { z } from 'zod';
import { router, managerProcedure, ownerProcedure } from '../init';

export const storesRouter = router({
  list: managerProcedure
    .query(async ({ ctx }) => {
      // Managers see their own store, owners see all
      if (ctx.user.role === 'OWNER') {
        return ctx.db.store.findMany({ orderBy: { name: 'asc' } });
      }
      return ctx.db.store.findMany({
        where: { id: ctx.storeId },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.store.findUniqueOrThrow({
        where: { id: input.id },
        include: { _count: { select: { users: true, tasks: true } } },
      });
    }),

  create: ownerProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      parish: z.string().min(1).max(50),
      address: z.string().min(1).max(200),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.store.create({ data: input });
    }),
});
```

- [ ] **Step 7: Create root router**

```ts
// apps/web/src/server/trpc/router.ts
import { router } from './init';
import { tasksRouter } from './routers/tasks';
import { threadsRouter } from './routers/threads';
import { logbookRouter } from './routers/logbook';
import { announcementsRouter } from './routers/announcements';
import { usersRouter } from './routers/users';
import { storesRouter } from './routers/stores';

export const appRouter = router({
  tasks: tasksRouter,
  threads: threadsRouter,
  logbook: logbookRouter,
  announcements: announcementsRouter,
  users: usersRouter,
  stores: storesRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 8: Create tRPC API route handler**

```ts
// apps/web/src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/init';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 9: Create tRPC client utilities**

```ts
// apps/web/src/lib/trpc-client.ts
'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();
```

```ts
// apps/web/src/lib/trpc-server.ts
import 'server-only';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/init';

const createCaller = createCallerFactory(appRouter);

export async function serverTrpc() {
  const ctx = await createContext();
  return createCaller(ctx);
}
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add tRPC routers for tasks, threads, logbook, announcements, users, stores"
```

---

## Task 6: tRPC Provider + Query Client

**Files:**
- Create: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Create providers component**

```tsx
// apps/web/src/app/providers.tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc-client';
import superjson from 'superjson';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 2: Wrap root layout with providers**

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'SuperPlus Hub',
  description: 'SuperPlus staff operations platform',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#E31837',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F8F9FA] text-[#1A1A2E] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add tRPC provider and React Query client"
```

---

## Task 7: Hub Layout + Home Screen (Icon Grid)

**Files:**
- Create: `packages/ui/src/icon-grid.tsx`
- Create: `packages/ui/src/bottom-nav.tsx`
- Create: `packages/ui/src/app-shell.tsx`
- Update: `packages/ui/src/index.ts`
- Create: `apps/web/src/app/(hub)/layout.tsx`
- Create: `apps/web/src/app/(hub)/page.tsx`

- [ ] **Step 1: Create icon grid component**

```tsx
// packages/ui/src/icon-grid.tsx
'use client';

import { useRouter } from 'next/navigation';

export interface IconGridItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  badge?: number;
}

export function IconGrid({ items }: { items: IconGridItem[] }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => router.push(item.href)}
          className="relative flex flex-col items-center justify-center gap-2 p-6 bg-white rounded-[12px] shadow-sm active:scale-95 transition-transform min-h-[120px]"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl"
            style={{ backgroundColor: item.color }}
          >
            {item.icon}
          </div>
          <span className="text-sm font-medium text-[#1A1A2E] text-center">
            {item.label}
          </span>
          {item.badge && item.badge > 0 ? (
            <span className="absolute top-2 right-2 w-6 h-6 bg-[#E31837] text-white text-xs font-bold rounded-full flex items-center justify-center">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create bottom nav component**

```tsx
// packages/ui/src/bottom-nav.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full ${
                active ? 'text-[#E31837]' : 'text-[#6B7280]'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Create app shell**

```tsx
// packages/ui/src/app-shell.tsx
import { BottomNav, type NavItem } from './bottom-nav';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  navItems: NavItem[];
}

export function AppShell({ children, title, navItems }: AppShellProps) {
  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center">
        <h1 className="text-lg font-bold text-[#1A1A2E]">{title}</h1>
      </header>
      <main>{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
```

- [ ] **Step 4: Export from packages/ui**

```ts
// packages/ui/src/index.ts
export { IconGrid, type IconGridItem } from './icon-grid';
export { BottomNav, type NavItem } from './bottom-nav';
export { AppShell } from './app-shell';
```

- [ ] **Step 5: Create hub layout**

```tsx
// apps/web/src/app/(hub)/layout.tsx
import { AppShell } from '@superplus/ui';

const navItems = [
  { label: 'Home', icon: '🏠', href: '/hub' },
  { label: 'Tasks', icon: '📋', href: '/hub/tasks' },
  { label: 'Threads', icon: '💬', href: '/hub/threads' },
  { label: 'Log', icon: '📓', href: '/hub/logbook' },
];

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <AppShell title="SuperPlus" navItems={navItems}>{children}</AppShell>;
}
```

- [ ] **Step 6: Create hub home page (icon grid)**

```tsx
// apps/web/src/app/(hub)/page.tsx
import { IconGrid } from '@superplus/ui';

const hubItems = [
  { label: 'Tasks', icon: '📋', href: '/hub/tasks', color: '#1B3A5C' },
  { label: 'Threads', icon: '💬', href: '/hub/threads', color: '#2ECC71' },
  { label: 'Logbook', icon: '📓', href: '/hub/logbook', color: '#F5A623' },
  { label: 'Announce', icon: '📢', href: '/hub/announcements', color: '#E31837' },
  { label: 'Profile', icon: '👤', href: '/hub/profile', color: '#6B7280' },
  { label: 'Tools', icon: '🔧', href: '/tools', color: '#9B59B6' },
];

export default function HubHomePage() {
  return (
    <div className="pt-2">
      <IconGrid items={hubItems} />
    </div>
  );
}
```

- [ ] **Step 7: Verify dev server starts**

Run:
```bash
cd /Users/mac/prod/superplus
pnpm dev
```

Expected: Dev server starts on localhost:3000. Navigate to localhost:3000 → redirects to /hub → shows icon grid.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add hub layout with icon grid home screen and bottom nav"
```

---

## Task 8: Tasks Feature (Hub)

**Files:**
- Create: `packages/ui/src/task-card.tsx`
- Create: `packages/ui/src/empty-state.tsx`
- Create: `apps/web/src/app/(hub)/tasks/page.tsx`
- Create: `apps/web/src/app/(hub)/tasks/[id]/page.tsx`
- Create: `apps/web/src/app/(hub)/tasks/create/page.tsx`
- Update: `packages/ui/src/index.ts`

- [ ] **Step 1: Create task card component**

```tsx
// packages/ui/src/task-card.tsx
interface TaskCardProps {
  title: string;
  priority: string;
  status: string;
  assignedTo?: string;
  createdBy: string;
  dueDate?: string;
  onClick?: () => void;
}

const priorityColors: Record<string, string> = {
  URGENT: '#E74C3C',
  HIGH: '#F5A623',
  NORMAL: '#6B7280',
  LOW: '#9CA3AF',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export function TaskCard({ title, priority, status, assignedTo, createdBy, dueDate, onClick }: TaskCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-[12px] p-4 shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-[#1A1A2E] text-base leading-tight">{title}</h3>
        <span
          className="shrink-0 w-3 h-3 rounded-full mt-1"
          style={{ backgroundColor: priorityColors[priority] }}
        />
      </div>
      <div className="flex items-center gap-2 mt-2 text-sm text-[#6B7280]">
        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
          {statusLabels[status] || status}
        </span>
        {assignedTo && <span>→ {assignedTo}</span>}
        {!assignedTo && <span className="text-[#F5A623] font-medium">Unassigned</span>}
      </div>
      {dueDate && (
        <p className="text-xs text-[#6B7280] mt-1">Due: {dueDate}</p>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create empty state component**

```tsx
// packages/ui/src/empty-state.tsx
interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-[#1A1A2E]">{title}</h3>
      {description && <p className="text-sm text-[#6B7280] mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create tasks list page**

```tsx
// apps/web/src/app/(hub)/tasks/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { TaskCard, EmptyState } from '@superplus/ui';

type Tab = 'mine' | 'available' | 'all';

export default function TasksPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');

  const { data: myTasks } = trpc.tasks.list.useQuery(
    { assignedToMe: true, status: undefined },
    { enabled: tab === 'mine' }
  );
  const { data: availableTasks } = trpc.tasks.list.useQuery(
    { unassigned: true },
    { enabled: tab === 'available' }
  );
  const { data: allTasks } = trpc.tasks.list.useQuery(
    undefined,
    { enabled: tab === 'all' }
  );

  const tasks = tab === 'mine' ? myTasks : tab === 'available' ? availableTasks : allTasks;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex bg-white border-b border-gray-100 px-4">
        {(['mine', 'available', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[#E31837] text-[#E31837]'
                : 'border-transparent text-[#6B7280]'
            }`}
          >
            {t === 'mine' ? 'My Tasks' : t === 'available' ? 'Pick Up' : 'All'}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="p-4 space-y-3">
        {tasks && tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              title={task.title}
              priority={task.priority}
              status={task.status}
              assignedTo={task.assignedTo?.fullName}
              createdBy={task.createdBy.fullName}
              dueDate={task.dueDate?.toLocaleDateString()}
              onClick={() => router.push(`/hub/tasks/${task.id}`)}
            />
          ))
        ) : (
          <EmptyState
            icon="📋"
            title={tab === 'available' ? 'No tasks to pick up' : 'No tasks yet'}
            description={tab === 'available' ? 'All tasks are assigned' : undefined}
          />
        )}
      </div>

      {/* FAB for supervisors+ */}
      <button
        onClick={() => router.push('/hub/tasks/create')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-[#E31837] text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform z-30"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create task detail page**

```tsx
// apps/web/src/app/(hub)/tasks/[id]/page.tsx
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id });
  const pickup = trpc.tasks.pickup.useMutation({
    onSuccess: () => utils.tasks.invalidate(),
  });
  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => utils.tasks.invalidate(),
  });

  if (isLoading) return <div className="p-4 text-center text-[#6B7280]">Loading...</div>;
  if (!task) return <div className="p-4 text-center text-[#6B7280]">Task not found</div>;

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="text-sm text-[#6B7280] mb-4">
        ← Back
      </button>

      <div className="bg-white rounded-[12px] p-5 shadow-sm">
        <h2 className="text-xl font-bold text-[#1A1A2E]">{task.title}</h2>
        {task.description && (
          <p className="text-[#6B7280] mt-2">{task.description}</p>
        )}

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Priority</span>
            <span className="font-medium">{task.priority}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Status</span>
            <span className="font-medium">{task.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Created by</span>
            <span className="font-medium">{task.createdBy.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Assigned to</span>
            <span className="font-medium">{task.assignedTo?.fullName || 'Unassigned'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          {!task.assignedToId && (
            <button
              onClick={() => pickup.mutate({ id: task.id })}
              className="w-full h-14 bg-[#1B3A5C] text-white font-semibold rounded-[8px] active:scale-95 transition-transform"
            >
              Take This Task
            </button>
          )}
          {task.status === 'OPEN' && task.assignedToId && (
            <button
              onClick={() => updateStatus.mutate({ id: task.id, status: 'IN_PROGRESS' })}
              className="w-full h-14 bg-[#F5A623] text-white font-semibold rounded-[8px] active:scale-95 transition-transform"
            >
              Start Working
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <button
              onClick={() => updateStatus.mutate({ id: task.id, status: 'DONE' })}
              className="w-full h-14 bg-[#2ECC71] text-white font-semibold rounded-[8px] active:scale-95 transition-transform"
            >
              Mark Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create task creation page**

```tsx
// apps/web/src/app/(hub)/tasks/create/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function CreateTaskPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      router.push('/hub/tasks');
    },
  });

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="text-sm text-[#6B7280] mb-4">
        ← Back
      </button>

      <div className="bg-white rounded-[12px] p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-[#1A1A2E]">New Task</h2>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any extra info..."
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`py-2 rounded-[8px] text-xs font-medium transition-colors ${
                  priority === p
                    ? 'bg-[#E31837] text-white'
                    : 'bg-gray-100 text-[#6B7280]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => create.mutate({ title, description: description || undefined, priority })}
          disabled={!title.trim() || create.isPending}
          className="w-full h-14 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40 active:scale-95 transition-transform"
        >
          {create.isPending ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Update packages/ui exports**

```ts
// packages/ui/src/index.ts
export { IconGrid, type IconGridItem } from './icon-grid';
export { BottomNav, type NavItem } from './bottom-nav';
export { AppShell } from './app-shell';
export { TaskCard } from './task-card';
export { EmptyState } from './empty-state';
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add tasks feature — list, detail, create, pickup"
```

---

## Task 9: Threads Feature (Hub)

**Files:**
- Create: `packages/ui/src/thread-card.tsx`
- Create: `apps/web/src/app/(hub)/threads/page.tsx`
- Create: `apps/web/src/app/(hub)/threads/[id]/page.tsx`
- Create: `apps/web/src/app/(hub)/threads/create/page.tsx`
- Update: `packages/ui/src/index.ts`

- [ ] **Step 1: Create thread card component**

```tsx
// packages/ui/src/thread-card.tsx
interface ThreadCardProps {
  title: string;
  author: string;
  category: string;
  messageCount: number;
  isPinned: boolean;
  isResolved: boolean;
  updatedAt: string;
  onClick?: () => void;
}

const categoryColors: Record<string, string> = {
  GENERAL: '#6B7280',
  URGENT: '#E74C3C',
  MAINTENANCE: '#F5A623',
  INVENTORY: '#1B3A5C',
  OTHER: '#9B59B6',
};

export function ThreadCard({
  title, author, category, messageCount, isPinned, isResolved, updatedAt, onClick
}: ThreadCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-[12px] p-4 shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start gap-3">
        {isPinned && <span className="text-lg">📌</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-base truncate ${isResolved ? 'line-through text-[#6B7280]' : 'text-[#1A1A2E]'}`}>
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-[#6B7280]">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: categoryColors[category] }}
            >
              {category}
            </span>
            <span>{author}</span>
            <span>·</span>
            <span>{messageCount} replies</span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">{updatedAt}</p>
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create threads list page**

```tsx
// apps/web/src/app/(hub)/threads/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { ThreadCard, EmptyState } from '@superplus/ui';

export default function ThreadsPage() {
  const router = useRouter();
  const { data: threads } = trpc.threads.list.useQuery();

  return (
    <div>
      <div className="p-4 space-y-3">
        {threads && threads.length > 0 ? (
          threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              title={thread.title}
              author={thread.author.fullName}
              category={thread.category}
              messageCount={thread._count.messages}
              isPinned={thread.isPinned}
              isResolved={thread.isResolved}
              updatedAt={thread.updatedAt.toLocaleDateString()}
              onClick={() => router.push(`/hub/threads/${thread.id}`)}
            />
          ))
        ) : (
          <EmptyState
            icon="💬"
            title="No threads yet"
            description="Start a conversation with your team"
          />
        )}
      </div>

      <button
        onClick={() => router.push('/hub/threads/create')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-[#2ECC71] text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform z-30"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create thread detail page (WhatsApp-style)**

```tsx
// apps/web/src/app/(hub)/threads/[id]/page.tsx
'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [reply, setReply] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: thread } = trpc.threads.getById.useQuery({ id });
  const sendReply = trpc.threads.reply.useMutation({
    onSuccess: () => {
      setReply('');
      utils.threads.getById.invalidate({ id });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  if (!thread) return <div className="p-4 text-center text-[#6B7280]">Loading...</div>;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => router.back()} className="text-sm text-[#6B7280]">
          ← Back
        </button>
        <h2 className="font-bold text-[#1A1A2E] mt-1">{thread.title}</h2>
        <span className="text-xs text-[#6B7280]">by {thread.author.fullName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.messages.map((msg) => (
          <div key={msg.id} className="bg-white rounded-[12px] p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-[#1A1A2E]">{msg.author.fullName}</span>
              <span className="text-xs text-[#9CA3AF]">
                {msg.createdAt.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-[#1A1A2E] whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {!thread.isResolved && (
        <div className="bg-white border-t border-gray-100 p-3 flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply..."
            className="flex-1 h-12 px-4 border-2 border-gray-200 rounded-full focus:border-[#E31837] focus:outline-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reply.trim()) {
                sendReply.mutate({ threadId: id, body: reply });
              }
            }}
          />
          <button
            onClick={() => reply.trim() && sendReply.mutate({ threadId: id, body: reply })}
            disabled={!reply.trim() || sendReply.isPending}
            className="w-12 h-12 bg-[#E31837] text-white rounded-full flex items-center justify-center disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create thread creation page**

```tsx
// apps/web/src/app/(hub)/threads/create/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const categories = ['GENERAL', 'URGENT', 'MAINTENANCE', 'INVENTORY', 'OTHER'] as const;

export default function CreateThreadPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('GENERAL');

  const create = trpc.threads.create.useMutation({
    onSuccess: (thread) => {
      utils.threads.invalidate();
      router.push(`/hub/threads/${thread.id}`);
    },
  });

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="text-sm text-[#6B7280] mb-4">
        ← Back
      </button>

      <div className="bg-white rounded-[12px] p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-[#1A1A2E]">New Thread</h2>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Topic</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this about?"
            className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-2 rounded-[8px] text-xs font-medium ${
                  category === c ? 'bg-[#E31837] text-white' : 'bg-gray-100 text-[#6B7280]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start the conversation..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base resize-none"
          />
        </div>

        <button
          onClick={() => create.mutate({ title, body, category })}
          disabled={!title.trim() || !body.trim() || create.isPending}
          className="w-full h-14 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40 active:scale-95 transition-transform"
        >
          {create.isPending ? 'Posting...' : 'Start Thread'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update packages/ui exports**

```ts
// packages/ui/src/index.ts
export { IconGrid, type IconGridItem } from './icon-grid';
export { BottomNav, type NavItem } from './bottom-nav';
export { AppShell } from './app-shell';
export { TaskCard } from './task-card';
export { ThreadCard } from './thread-card';
export { EmptyState } from './empty-state';
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add threads feature — list, WhatsApp-style detail, create"
```

---

## Task 10: Logbook Feature (Hub)

**Files:**
- Create: `packages/ui/src/log-entry-card.tsx`
- Create: `apps/web/src/app/(hub)/logbook/page.tsx`
- Update: `packages/ui/src/index.ts`

- [ ] **Step 1: Create log entry card component**

```tsx
// packages/ui/src/log-entry-card.tsx
interface LogEntryCardProps {
  body: string;
  author: string;
  category: string;
  isFlagged: boolean;
  createdAt: string;
}

export function LogEntryCard({ body, author, category, isFlagged, createdAt }: LogEntryCardProps) {
  return (
    <div className={`bg-white rounded-[12px] p-4 shadow-sm ${isFlagged ? 'border-l-4 border-[#E74C3C]' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1A1A2E]">{author}</span>
          {isFlagged && <span className="text-xs bg-red-100 text-[#E74C3C] px-2 py-0.5 rounded font-medium">Flagged</span>}
        </div>
        <span className="text-xs text-[#9CA3AF]">{createdAt}</span>
      </div>
      <p className="text-sm text-[#1A1A2E] whitespace-pre-wrap">{body}</p>
      <span className="inline-block mt-2 text-xs text-[#6B7280] bg-gray-100 px-2 py-0.5 rounded">
        {category}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create logbook page**

```tsx
// apps/web/src/app/(hub)/logbook/page.tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { LogEntryCard, EmptyState } from '@superplus/ui';

const categories = ['GENERAL', 'INCIDENT', 'HANDOVER', 'INVENTORY'] as const;

export default function LogbookPage() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('GENERAL');
  const [isFlagged, setIsFlagged] = useState(false);

  const { data: entries } = trpc.logbook.listByDate.useQuery();

  const create = trpc.logbook.create.useMutation({
    onSuccess: () => {
      setBody('');
      setShowForm(false);
      setIsFlagged(false);
      setCategory('GENERAL');
      utils.logbook.invalidate();
    },
  });

  return (
    <div>
      <div className="p-4 space-y-3">
        {/* Date header */}
        <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wide">
          Today — {new Date().toLocaleDateString('en-JM', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>

        {/* Entries */}
        {entries && entries.length > 0 ? (
          entries.map((entry) => (
            <LogEntryCard
              key={entry.id}
              body={entry.body}
              author={entry.author.fullName}
              category={entry.category}
              isFlagged={entry.isFlagged}
              createdAt={entry.createdAt.toLocaleTimeString()}
            />
          ))
        ) : (
          <EmptyState
            icon="📓"
            title="No entries today"
            description="Add a note for the record"
          />
        )}
      </div>

      {/* Quick-add form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 space-y-4 animate-in slide-in-from-bottom">
            <h3 className="text-lg font-bold text-[#1A1A2E]">New Log Entry</h3>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened?"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none text-base resize-none"
              autoFocus
            />

            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-2 rounded-[8px] text-xs font-medium ${
                    category === c ? 'bg-[#E31837] text-white' : 'bg-gray-100 text-[#6B7280]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={isFlagged}
                onChange={(e) => setIsFlagged(e.target.checked)}
                className="w-5 h-5 rounded accent-[#E74C3C]"
              />
              <span className="text-sm font-medium text-[#1A1A2E]">Flag for manager attention</span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-12 border-2 border-gray-200 rounded-[8px] text-[#6B7280] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate({ body, category, isFlagged })}
                disabled={!body.trim() || create.isPending}
                className="flex-1 h-12 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-[#F5A623] text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform z-30"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Update packages/ui exports**

```ts
// packages/ui/src/index.ts
export { IconGrid, type IconGridItem } from './icon-grid';
export { BottomNav, type NavItem } from './bottom-nav';
export { AppShell } from './app-shell';
export { TaskCard } from './task-card';
export { ThreadCard } from './thread-card';
export { LogEntryCard } from './log-entry-card';
export { EmptyState } from './empty-state';
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add logbook feature — daily entries with category and flag"
```

---

## Task 11: Announcements Feature (Hub)

**Files:**
- Create: `packages/ui/src/announcement-banner.tsx`
- Create: `apps/web/src/app/(hub)/announcements/page.tsx`
- Update: `packages/ui/src/index.ts`

- [ ] **Step 1: Create announcement banner component**

```tsx
// packages/ui/src/announcement-banner.tsx
interface AnnouncementBannerProps {
  title: string;
  body: string;
  author: string;
  priority: string;
  createdAt: string;
}

const priorityStyles: Record<string, { bg: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-50', border: 'border-[#E74C3C]' },
  IMPORTANT: { bg: 'bg-orange-50', border: 'border-[#F5A623]' },
  NORMAL: { bg: 'bg-white', border: 'border-gray-200' },
};

export function AnnouncementBanner({ title, body, author, priority, createdAt }: AnnouncementBannerProps) {
  const styles = priorityStyles[priority] || priorityStyles.NORMAL;

  return (
    <div className={`${styles.bg} border-l-4 ${styles.border} rounded-[12px] p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-[#1A1A2E]">{title}</h3>
        {priority === 'CRITICAL' && (
          <span className="text-xs bg-[#E74C3C] text-white px-2 py-0.5 rounded font-bold">URGENT</span>
        )}
      </div>
      <p className="text-sm text-[#1A1A2E] whitespace-pre-wrap">{body}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-[#6B7280]">
        <span>{author}</span>
        <span>·</span>
        <span>{createdAt}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create announcements page**

```tsx
// apps/web/src/app/(hub)/announcements/page.tsx
'use client';

import { trpc } from '@/lib/trpc-client';
import { AnnouncementBanner, EmptyState } from '@superplus/ui';

export default function AnnouncementsPage() {
  const { data: announcements } = trpc.announcements.list.useQuery();

  return (
    <div className="p-4 space-y-3">
      {announcements && announcements.length > 0 ? (
        announcements.map((a) => (
          <AnnouncementBanner
            key={a.id}
            title={a.title}
            body={a.body}
            author={a.author.fullName}
            priority={a.priority}
            createdAt={a.createdAt.toLocaleDateString()}
          />
        ))
      ) : (
        <EmptyState
          icon="📢"
          title="No announcements"
          description="All clear for now"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update packages/ui exports**

```ts
// packages/ui/src/index.ts
export { IconGrid, type IconGridItem } from './icon-grid';
export { BottomNav, type NavItem } from './bottom-nav';
export { AppShell } from './app-shell';
export { TaskCard } from './task-card';
export { ThreadCard } from './thread-card';
export { LogEntryCard } from './log-entry-card';
export { AnnouncementBanner } from './announcement-banner';
export { EmptyState } from './empty-state';
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add announcements feature — priority-styled banners"
```

---

## Task 12: Admin Layout + Dashboard

**Files:**
- Create: `packages/ui/src/sidebar.tsx`
- Create: `apps/web/src/app/(admin)/layout.tsx`
- Create: `apps/web/src/app/(admin)/page.tsx`
- Update: `packages/ui/src/index.ts`

- [ ] **Step 1: Create sidebar component**

```tsx
// packages/ui/src/sidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface SidebarItem {
  label: string;
  icon: string;
  href: string;
}

export function Sidebar({ items, title }: { items: SidebarItem[]; title: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-dvh bg-[#1B3A5C] text-white fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-white/60 mt-1">Admin</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-medium transition-colors ${
                active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <Link href="/hub" className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          ← Back to Hub
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create admin layout**

```tsx
// apps/web/src/app/(admin)/layout.tsx
import { Sidebar } from '@superplus/ui';

const adminNav = [
  { label: 'Dashboard', icon: '📊', href: '/admin' },
  { label: 'People', icon: '👥', href: '/admin/people' },
  { label: 'Activity', icon: '📋', href: '/admin/activity' },
  { label: 'Stores', icon: '🏪', href: '/admin/stores' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar items={adminNav} title="SuperPlus" />
      <main className="ml-64 flex-1 min-h-dvh p-8">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create admin dashboard page**

```tsx
// apps/web/src/app/(admin)/page.tsx
import { serverTrpc } from '@/lib/trpc-server';

export default async function AdminDashboardPage() {
  const trpc = await serverTrpc();
  const stores = await trpc.stores.list();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store) => (
          <div key={store.id} className="bg-white rounded-[12px] p-5 shadow-sm">
            <h3 className="font-bold text-[#1A1A2E]">{store.name}</h3>
            <p className="text-sm text-[#6B7280] mt-1">{store.parish}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${store.isActive ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}`} />
              <span className="text-xs text-[#6B7280]">{store.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update packages/ui exports**

```ts
// packages/ui/src/index.ts
export { IconGrid, type IconGridItem } from './icon-grid';
export { BottomNav, type NavItem } from './bottom-nav';
export { AppShell } from './app-shell';
export { TaskCard } from './task-card';
export { ThreadCard } from './thread-card';
export { LogEntryCard } from './log-entry-card';
export { AnnouncementBanner } from './announcement-banner';
export { EmptyState } from './empty-state';
export { Sidebar, type SidebarItem } from './sidebar';
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add admin layout with sidebar and store dashboard"
```

---

## Task 13: Admin People Management

**Files:**
- Create: `apps/web/src/app/(admin)/people/page.tsx`

- [ ] **Step 1: Create people management page**

```tsx
// apps/web/src/app/(admin)/people/page.tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function PeoplePage() {
  const utils = trpc.useUtils();
  const { data: users } = trpc.users.list.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', phone: '', pin: '', role: 'STAFF' as const });

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.invalidate();
      setShowAdd(false);
      setNewUser({ fullName: '', phone: '', pin: '', role: 'STAFF' });
    },
  });

  const toggleActive = trpc.users.toggleActive.useMutation({
    onSuccess: () => utils.users.invalidate(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">People</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-[#E31837] text-white font-medium rounded-[8px]"
        >
          Add Staff
        </button>
      </div>

      {/* Staff table */}
      <div className="bg-white rounded-[12px] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Phone</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Role</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[#6B7280]">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E]">{user.fullName}</td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{user.phone}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">{user.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${user.isActive ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive.mutate({ id: user.id })}
                    className="text-xs text-[#6B7280] hover:text-[#1A1A2E]"
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-[#1A1A2E]">Add Staff Member</h2>

            <input
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              placeholder="Full name"
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            />
            <input
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              placeholder="Phone (+1876...)"
              type="tel"
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            />
            <input
              value={newUser.pin}
              onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4-digit PIN"
              inputMode="numeric"
              maxLength={4}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-[6px] focus:border-[#E31837] focus:outline-none"
            >
              <option value="STAFF">Staff</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="MANAGER">Manager</option>
            </select>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 h-12 border-2 border-gray-200 rounded-[8px] text-[#6B7280] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => createUser.mutate(newUser)}
                disabled={!newUser.fullName || !newUser.phone || newUser.pin.length !== 4}
                className="flex-1 h-12 bg-[#E31837] text-white font-semibold rounded-[8px] disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add admin people management — list, add, activate/deactivate"
```

---

## Task 14: Admin Activity Feed

**Files:**
- Create: `apps/web/src/app/(admin)/activity/page.tsx`
- Create: `apps/web/src/server/trpc/routers/activity.ts`
- Modify: `apps/web/src/server/trpc/router.ts`

- [ ] **Step 1: Create activity router**

```ts
// apps/web/src/server/trpc/routers/activity.ts
import { router, managerProcedure } from '../init';

export const activityRouter = router({
  recent: managerProcedure
    .query(async ({ ctx }) => {
      const storeFilter = ctx.user.role === 'OWNER' ? {} : { storeId: ctx.storeId };

      const [tasks, threads, logs] = await Promise.all([
        ctx.db.task.findMany({
          where: storeFilter,
          include: { createdBy: true, assignedTo: true, store: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        ctx.db.thread.findMany({
          where: storeFilter,
          include: { author: true, store: true, _count: { select: { messages: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        }),
        ctx.db.logEntry.findMany({
          where: { ...storeFilter, isFlagged: true },
          include: { author: true, store: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return { tasks, threads, flaggedLogs: logs };
    }),
});
```

- [ ] **Step 2: Add activity router to root**

```ts
// apps/web/src/server/trpc/router.ts
import { router } from './init';
import { tasksRouter } from './routers/tasks';
import { threadsRouter } from './routers/threads';
import { logbookRouter } from './routers/logbook';
import { announcementsRouter } from './routers/announcements';
import { usersRouter } from './routers/users';
import { storesRouter } from './routers/stores';
import { activityRouter } from './routers/activity';

export const appRouter = router({
  tasks: tasksRouter,
  threads: threadsRouter,
  logbook: logbookRouter,
  announcements: announcementsRouter,
  users: usersRouter,
  stores: storesRouter,
  activity: activityRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Create activity page**

```tsx
// apps/web/src/app/(admin)/activity/page.tsx
'use client';

import { trpc } from '@/lib/trpc-client';

export default function ActivityPage() {
  const { data } = trpc.activity.recent.useQuery();

  if (!data) return <div className="text-[#6B7280]">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Activity</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tasks */}
        <div className="bg-white rounded-[12px] p-5 shadow-sm">
          <h2 className="font-bold text-[#1A1A2E] mb-4">Recent Tasks</h2>
          <div className="space-y-3">
            {data.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">{task.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {task.store.name} · {task.createdBy.fullName}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  task.status === 'DONE' ? 'bg-green-100 text-[#2ECC71]' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-[#6B7280]'
                }`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active threads */}
        <div className="bg-white rounded-[12px] p-5 shadow-sm">
          <h2 className="font-bold text-[#1A1A2E] mb-4">Active Threads</h2>
          <div className="space-y-3">
            {data.threads.map((thread) => (
              <div key={thread.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E]">{thread.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {thread.store.name} · {thread._count.messages} messages
                  </p>
                </div>
                <span className="text-xs text-[#6B7280]">
                  {thread.updatedAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Flagged log entries */}
        <div className="bg-white rounded-[12px] p-5 shadow-sm lg:col-span-2">
          <h2 className="font-bold text-[#E74C3C] mb-4">Flagged for Attention</h2>
          {data.flaggedLogs.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No flagged items</p>
          ) : (
            <div className="space-y-3">
              {data.flaggedLogs.map((log) => (
                <div key={log.id} className="border-l-4 border-[#E74C3C] pl-3 py-2">
                  <p className="text-sm text-[#1A1A2E]">{log.body}</p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {log.store.name} · {log.author.fullName} · {log.createdAt.toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin activity feed — cross-store tasks, threads, flagged logs"
```

---

## Task 15: Admin Stores Page

**Files:**
- Create: `apps/web/src/app/(admin)/stores/page.tsx`

- [ ] **Step 1: Create stores management page**

```tsx
// apps/web/src/app/(admin)/stores/page.tsx
'use client';

import { trpc } from '@/lib/trpc-client';

export default function StoresPage() {
  const { data: stores } = trpc.stores.list.useQuery();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Stores</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stores?.map((store) => (
          <div key={store.id} className="bg-white rounded-[12px] p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-[#1A1A2E] text-lg">{store.name}</h3>
                <p className="text-sm text-[#6B7280] mt-1">{store.address}</p>
                <p className="text-sm text-[#6B7280]">{store.parish}</p>
              </div>
              <span className={`w-3 h-3 rounded-full mt-1 ${store.isActive ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}`} />
            </div>
            {store.phone && (
              <p className="text-sm text-[#6B7280] mt-2">{store.phone}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add admin stores page"
```

---

## Task 16: PWA Manifest + Service Worker

**Files:**
- Create: `apps/web/public/manifest.json`
- Create: `apps/web/public/icons/` (placeholder)
- Create: `apps/web/public/sw.js` (basic service worker)

- [ ] **Step 1: Create PWA manifest**

```json
// apps/web/public/manifest.json
{
  "name": "SuperPlus Hub",
  "short_name": "SuperPlus",
  "description": "Staff operations platform",
  "start_url": "/hub",
  "display": "standalone",
  "background_color": "#F8F9FA",
  "theme_color": "#E31837",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create basic service worker**

```js
// apps/web/public/sw.js
const CACHE_NAME = 'superplus-v1';
const STATIC_ASSETS = [
  '/hub',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and API requests
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  // Network first for HTML, cache first for static assets
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
```

- [ ] **Step 3: Register service worker in root layout**

Add SW registration script to `apps/web/src/app/layout.tsx` by adding before closing `</body>`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js');
        });
      }
    `,
  }}
/>
```

- [ ] **Step 4: Create placeholder icons**

Create a minimal 192x192 and 512x512 icon placeholder (can be replaced with real logo later):

```bash
mkdir -p apps/web/public/icons
# Generate simple placeholder SVGs converted to PNG later
# For now, create .gitkeep
touch apps/web/public/icons/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add PWA manifest and basic service worker"
```

---

## Task 17: Final Integration Test + Build Verification

- [ ] **Step 1: Install all dependencies fresh**

```bash
cd /Users/mac/prod/superplus
rm -rf node_modules apps/web/node_modules packages/*/node_modules
pnpm install
```

- [ ] **Step 2: Generate Prisma client**

```bash
cd packages/db && pnpm db:generate && cd ../..
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm turbo typecheck
```

Expected: All packages pass type checking.

- [ ] **Step 4: Run build**

```bash
pnpm turbo build
```

Expected: Next.js builds successfully with no errors.

- [ ] **Step 5: Start dev server and verify**

```bash
pnpm dev
```

Verify in browser:
- `localhost:3000` → redirects to `/hub`
- `/hub` → shows icon grid with 6 items
- `/hub/tasks` → shows empty tasks page with tabs
- `/hub/threads` → shows empty threads page
- `/hub/logbook` → shows today's date, empty state
- `/hub/announcements` → shows empty state
- `/admin` → shows dashboard (or access denied if not owner/manager)
- `/admin/people` → shows staff table
- `/admin/activity` → shows activity feed
- `/login` → shows phone+PIN login flow

- [ ] **Step 6: Fix any build/type errors found**

Address any issues from steps 3-5. Common fixes:
- Missing type imports
- Prisma client not generated
- tRPC type mismatches

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "fix: resolve build issues from integration testing"
```

- [ ] **Step 8: Push to GitHub**

```bash
git push origin main
```
