import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Don't transform next-auth internals — mock them instead
  transformIgnorePatterns: ["/node_modules/(?!next-auth)"],
};

export default config;
