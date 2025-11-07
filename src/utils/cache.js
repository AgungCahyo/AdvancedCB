export class MessageCache {
  constructor(maxSize = 1000, cleanupSize = 500) {
    this.cache = new Set();
    this.maxSize = maxSize;
    this.cleanupSize = cleanupSize;
  }

  has(messageId) {
    return this.cache.has(messageId);
  }

  add(messageId) {
    this.cache.add(messageId);
    this.cleanup();
  }

  cleanup() {
    if (this.cache.size > this.maxSize) {
      const arr = Array.from(this.cache);
      this.cache.clear();
      
      // Simpan hanya pesan terbaru
      arr.slice(-this.cleanupSize).forEach(id => this.cache.add(id));
      
      return true;
    }
    return false;
  }

  get size() {
    return this.cache.size;
  }
}