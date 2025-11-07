export class RateLimiter {
  constructor(windowMs = 5000) {
    this.userLastMessageTime = new Map();
    this.windowMs = windowMs;
  }

  isLimited(userId) {
    const lastMessageTime = this.userLastMessageTime.get(userId);
    const now = Date.now();
    
    if (lastMessageTime && (now - lastMessageTime) < this.windowMs) {
      return true;
    }
    
    this.userLastMessageTime.set(userId, now);
    return false;
  }

  get activeUsers() {
    return this.userLastMessageTime.size;
  }
}
