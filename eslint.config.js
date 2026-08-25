import js from "@eslint/js";
export default [
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": "warn",
    },
    languageOptions: {
      globals: {
        window: true,
        document: true,
        console: true,
        fetch: true,
        THREE: true,
      },
      sourceType: "module",
    }
  }
];
