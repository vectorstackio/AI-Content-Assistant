// lib/common/config/index.ts

const config = {
  app: {
    name: 'Test AI App',
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  },
}

export type Config = typeof config
export default config
