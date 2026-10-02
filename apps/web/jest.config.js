module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@haseela/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@haseela/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
};

