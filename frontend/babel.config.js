module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@/screens': './src/screens',
          '@/components': './src/components',
          '@/services': './src/services',
          '@/utils': './src/utils',
          '@/hooks': './src/hooks',
          '@/theme': './src/theme',
          '@/types': './src/types',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
