/**
 * Jest setup. Vector icons load fonts through expo-font/expo-asset native
 * modules that don't exist under Jest; render them as inert placeholders.
 */
jest.mock('@expo/vector-icons', () => {
  const Icon = () => null;
  return new Proxy({}, { get: () => Icon });
});

// Device storage (gameRecordStore): the package's in-memory stand-in.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
