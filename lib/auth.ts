import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getMongoClientPromise } from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

type MongoUser = {
  _id?: { toString(): string };
  name?: string | null;
  email?: string | null;
  image?: string | null;
  password?: string | null;
};

type TokenWithExtras = {
  id?: string;
  email?: string;
  name?: string | null;
  picture?: string | null;
  accessToken?: string;
  sub?: string | null;
} & Record<string, unknown>;


const hasMongoUri = Boolean(process.env.MONGODB_URI ?? process.env.NEXT_PUBLIC_MONGODB_URI);
const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const hasGithub = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const jwtSecret =
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "dev_secret_change_me";

export const authOptions: NextAuthOptions = {
  // Only enable the DB adapter if Mongo is configured.
  ...(hasMongoUri ? { adapter: MongoDBAdapter(getMongoClientPromise()) } : {}),
  providers: [
    ...(hasGoogle
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          }),
        ]
      : []),
    ...(hasGithub
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Minimal, safe default: if Mongo isn't configured, disable credentials auth gracefully.
        if (!hasMongoUri) return null;
        if (!credentials?.email || !credentials?.password) return null;

        const client = await getMongoClientPromise();
        const db = client.db();
        const user = (await db
          .collection("users")
          .findOne({ email: credentials.email })) as MongoUser | null;

        if (!user) return null;

        const hashedPassword = user.password ?? undefined;
        if (!hashedPassword) return null;

        const isValid = await bcrypt.compare(credentials.password, hashedPassword);
        if (!isValid) return null;

        return {
          id: user._id?.toString?.() ?? "",
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const extendedToken = token as TokenWithExtras;
        const userId = (user as { id?: string }).id ?? "";

        extendedToken.id = userId;
        extendedToken.email = user.email ?? undefined;
        extendedToken.name = user.name ?? null;
        extendedToken.picture = user.image ?? null;
        extendedToken.accessToken = jwt.sign(
          { userId },
          jwtSecret,
          { expiresIn: "7d" }
        );
      }
      return token;
    },
    async session({ session, token }) {
      const extendedToken = token as TokenWithExtras;

      return {
        ...session,
        user: {
          id: (extendedToken.id ?? extendedToken.sub ?? "") || "",
          email: extendedToken.email ?? "",
          name: extendedToken.name ?? undefined,
          image: extendedToken.picture ?? undefined,
        },
        accessToken: extendedToken.accessToken,
      };
    },
  },
};
  