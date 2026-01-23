const warnedMessages = new Set<string>();

export const warnOnce = (key: string, message: string, details?: unknown) => {
  if (warnedMessages.has(key)) {
    return;
  }

  warnedMessages.add(key);
  if (details) {
    console.warn(message, details);
    return;
  }

  console.warn(message);
};
