import { type User, type InsertUser } from "@vendora/shared";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      supabase_id: insertUser.supabase_id ?? null,
      revenuecat_app_user_id: null,
      subscription_status: "trialing",
      subscription_expires_at: null,
      created_at: new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
