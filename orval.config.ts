import { defineConfig } from "orval";

export default defineConfig({
  backendApi: {
    input: {
      target: "../backend/openapi/openapi.json", 
      // OR: "./openapi/openapi.json" if copied locally
    },
    output: {
      mode: "tags-split",
      target: "./api/index.ts", 
      schemas: "./api/model", 
      client: "react-query",
      clean: true,
      override: {
        mutator: {
          path: "./lib/custom-instance.ts", 
          name: "customInstance",
        },
      },
    },
  },
});
