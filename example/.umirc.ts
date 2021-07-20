import { defineConfig } from 'umi';

export default defineConfig({
  plugins: [require.resolve('../lib')],
  apollo: {
    uri: 'http://localhost:8080/graphql',
  },
  app: {
    id: '5cc2a9d305297b47dc26c5da',
  },
});
