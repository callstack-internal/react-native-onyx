module.exports = {
    preset: 'react-native',
    roots: ['<rootDir>/lib', '<rootDir>/tests', '<rootDir>/prototypes'],
    transform: {
        '\\.[jt]sx?$': 'babel-jest',
    },
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/tests/unit/mocks/', '<rootDir>/tests/e2e/', '<rootDir>/tests/types/'],
    testMatch: ['**/tests/unit/**/*.[jt]s?(x)', '**/?(*.)+(spec|test|perf-test).[jt]s?(x)'],
    globals: {
        __DEV__: true,
        WebSocket: {},
    },
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['./jestSetup.js'],
    testTimeout: 60000,
    transformIgnorePatterns: ['node_modules/(?!((@)?react-native|@ngneat/falso|uuid)/)'],
    testSequencer: './jest-sequencer.js',
    moduleNameMapper: {
        // Redirect all imports of OnyxMerge to its web version during unit tests.
        '^(.*)/OnyxMerge$': '<rootDir>/lib/OnyxMerge/index.ts',
    },
};
