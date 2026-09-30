import redisClient from '../redis';

/**
 * Atomically checks and enforces the hourly limit for a campaign using Redis.
 * Uses a Fixed Window strategy (per calendar hour).
 *
 * @param campaignId The ID of the campaign to rate limit.
 * @param hourlyLimit The maximum number of emails allowed per hour.
 * @returns true if the email is allowed to be sent, false if the limit is exceeded.
 */
export async function checkRateLimit(campaignId: string, hourlyLimit: number): Promise<boolean> {
  const now = new Date();
  // Fixed window key format: reachinbox:rl:campaign:<id>:YYYY-MM-DD-HH
  const hourStr = now.toISOString().substring(0, 13);
  const key = `reachinbox:rl:campaign:${campaignId}:${hourStr}`;

  // Atomic Lua script:
  // 1. INCR the counter
  // 2. If it's 1 (first request), set a 1-hour TTL
  // 3. If count exceeds limit, DECR to undo the consumption and return 0 (blocked)
  // 4. Otherwise return 1 (allowed)
  const luaScript = 
  `
    local current = redis.call("INCR", KEYS[1])
    if current == 1 then
      redis.call("EXPIRE", KEYS[1], 3600)
    end
    if current > tonumber(ARGV[1]) then
      redis.call("DECR", KEYS[1])
      return 0
    end
    return 1 `
    ;

  const result = await redisClient.eval(luaScript, {
    keys: [key],
    arguments: [hourlyLimit.toString()]
  });

  return result === 1;
}

/**
 * Atomically allocates the next available safe timestamp for a rescheduled job,
 * guaranteeing it is at least `delayMs` after the previously allocated time.
 */
export async function getNextSafeScheduleTime(campaignId: string, requestedTimeMs: number, delayMs: number): Promise<number> {
  const key = `reachinbox:safetime:campaign:${campaignId}`;
  const luaScript = `
    local requested = tonumber(ARGV[1])
    local delay = tonumber(ARGV[2])
    local current_safe = tonumber(redis.call("GET", KEYS[1]) or "0")
    
    local next_safe = requested
    if current_safe >= next_safe then
        next_safe = current_safe + delay
    end
    
    redis.call("SET", KEYS[1], tostring(next_safe))
    redis.call("EXPIRE", KEYS[1], 86400 * 7)
    
    return next_safe
  `;
  
  const result = await redisClient.eval(luaScript, {
    keys: [key],
    arguments: [requestedTimeMs.toString(), delayMs.toString()]
  });
  
  return Number(result);
}
