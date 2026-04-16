export default {
  displayName: '@bahmni/distro',
  preset: '../jest.preset.js',
  setupFilesAfterEnv: ['./setupTests.ts'],
  moduleNameMapper: {
    // @bahmni/clinical-app deep imports (stores, services, etc.) are not in
    // the package's exports field — map directly to the source files.
    '^@bahmni/clinical-app/(.*)$': '<rootDir>/../apps/clinical/src/$1',

    // SCSS CSS Modules → identity-obj-proxy returns the class name as-is.
    '\\.module\\.(css|scss)$': 'identity-obj-proxy',
  },
};
