// import mongoose from "mongoose";

// const MONGODB_URI: string = process.env.MONGODB_URI as string;

// if (!MONGODB_URI) {
//   throw new Error("Please define the MONGODB_URI environment variable");
// }

// let cached = (global as any).mongoose || { conn: null, promise: null };

// async function connectToDatabase() {
//   if (cached.conn) {
//     return cached.conn;
//   }

//   if (!cached.promise) {
//     cached.promise = mongoose.connect(MONGODB_URI, {}).then((mongoose) => mongoose);
//   }

//   cached.conn = await cached.promise;
//   return cached.conn;
// }

// (global as any).mongoose = cached;

// export default connectToDatabase;




import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Server-side MongoDB connection helper.
 *
 * - Does NOT throw at import time (so `next dev` can boot without env configured).
 * - Reads `MONGODB_URI` (preferred). Falls back to `NEXT_PUBLIC_MONGODB_URI` for legacy configs.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI ?? process.env.NEXT_PUBLIC_MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Missing MongoDB connection string. Set `MONGODB_URI` (preferred) or `NEXT_PUBLIC_MONGODB_URI` in `.env.local`."
    );
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }

  return global._mongoClientPromise;
}

export function getMongoDbName(): string | undefined {
  return process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
}
