export const NOTIFICATION_COPY = {
  microPrime: {
    standard: {
      title: 'The Sanctuary is open.',
      body: '10 seconds to hold the thread?',
    },
    sovereign: {
      title: 'The thread awaits.',
      body: 'Your touch is needed.',
    },
  },
  weaver: {
    title: 'The thread is still here.',
    body: 'One prime today ties the knot. Reconnect?',
  },
  mirror: {
    title: 'Your week in reflection.',
  },
  alchemist: {
    standard: {
      title: 'The anchor is complete.',
      // body dynamic: `${current_primes} primes forged. Is it time to release to the Vault?`
    },
    sovereign: {
      title: 'The thread is woven.',
    },
  },
} as const;
