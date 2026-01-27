import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getMongoClientPromise } from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


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
        const user = await db
          .collection("users")
          .findOne({ email: credentials.email });

        if (!user) return null;

        const hashedPassword = (user as any).password as string | undefined;
        if (!hashedPassword) return null;

        const isValid = await bcrypt.compare(credentials.password, hashedPassword);
        if (!isValid) return null;

        return {
          id: (user as any)._id?.toString?.() ?? "",
          name: (user as any).name,
          email: (user as any).email,
          image: (user as any).image,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        (token as any).accessToken = jwt.sign(
          { userId: (user as any).id },
          jwtSecret,
          { expiresIn: "7d" }
        );
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          id: ((token as any).id ?? token.sub ?? "") as string,
          email: (token.email ?? "") as string,
          name: (token.name ?? undefined) as string | undefined,
          image: ((token as any).picture ?? undefined) as string | undefined,
        },
        accessToken: (token as any).accessToken as string | undefined,
      };
    },
  },
};
  