import mongoose from 'mongoose';

export async function connectDB() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Database] No DATABASE_URL set. Running in stateless mode.');
    return null;
  }

  try {
    const conn = await mongoose.connect(dbUrl);
    console.log('[Database] Connected to MongoDB:', conn.connection.host);
    return conn;
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error.message);
    return null;
  }
}
